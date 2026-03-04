/**
 * 契約内容報告書フック
 * 契約変更の自動検出 → 報告書生成 → 提出管理
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ContractReportItem, GovernmentDocumentSubmission, DocumentSubmissionStatus } from '@/types';

// DB行 → 型変換
function mapSubmissionRow(row: any): GovernmentDocumentSubmission {
  return {
    id: row.id,
    facilityId: row.facility_id,
    organizationId: row.organization_id,
    categoryId: row.category_id,
    title: row.title,
    targetPeriod: row.target_period,
    targetYear: row.target_year,
    targetMonth: row.target_month,
    content: row.content,
    fileUrl: row.file_url,
    fileName: row.file_name,
    status: row.status,
    submittedAt: row.submitted_at,
    submittedBy: row.submitted_by,
    receivedAt: row.received_at,
    receivedBy: row.received_by,
    returnReason: row.return_reason,
    completionNote: row.completion_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReportItemRow(row: any): ContractReportItem {
  return {
    id: row.id,
    submissionId: row.submission_id,
    childId: row.child_id,
    contractId: row.contract_id,
    reportType: row.report_type,
    childName: row.child_name,
    childBirthday: row.child_birthday,
    recipientNumber: row.recipient_number,
    contractStartDate: row.contract_start_date,
    contractEndDate: row.contract_end_date,
    serviceType: row.service_type,
    daysPerMonth: row.days_per_month,
    changeContent: row.change_content,
    terminationReason: row.termination_reason,
    createdAt: row.created_at,
  };
}

export type DetectedChange = {
  childId: string;
  childName: string;
  birthDate?: string;
  beneficiaryNumber?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  contractDays?: number;
  reportType: 'new' | 'change' | 'termination';
  changeDetail?: string;
};

export type ContractReportData = {
  submission: GovernmentDocumentSubmission | null;
  items: ContractReportItem[];
  detectedChanges: DetectedChange[];
  governmentOrg: { id: string; name: string } | null;
};

export const useContractReport = () => {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ContractReportData>({
    submission: null,
    items: [],
    detectedChanges: [],
    governmentOrg: null,
  });

  // 施設の管轄行政機関を取得
  const fetchGovernmentOrg = useCallback(async (): Promise<{ id: string; name: string } | null> => {
    if (!facilityId) return null;

    const { data, error } = await supabase
      .from('facility_government_links')
      .select('organization_id, government_organizations(id, name)')
      .eq('facility_id', facilityId)
      .eq('link_type', 'jurisdiction')
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const org = data.government_organizations as any;
    if (!org) return null;

    return { id: org.id, name: org.name };
  }, [facilityId]);

  // 契約変更を自動検出
  const detectContractChanges = useCallback(async (
    year: number,
    month: number,
  ): Promise<DetectedChange[]> => {
    if (!facilityId) return [];

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    // 既に登録済みの児童IDを取得（重複防止）
    const { data: existingItems } = await supabase
      .from('contract_report_items')
      .select('child_id, submission_id')
      .eq('submission_id', `${facilityId}_${year}_${month}`);

    // 実際のsubmissionに紐づくアイテムも確認
    const { data: submissions } = await supabase
      .from('government_document_submissions')
      .select('id')
      .eq('facility_id', facilityId)
      .eq('target_year', year)
      .eq('target_month', month)
      .eq('category_id', 'contract_report');

    let existingChildIds = new Set<string>();
    if (submissions && submissions.length > 0) {
      const subIds = submissions.map(s => s.id);
      const { data: subItems } = await supabase
        .from('contract_report_items')
        .select('child_id')
        .in('submission_id', subIds);
      if (subItems) {
        subItems.forEach(item => existingChildIds.add(item.child_id));
      }
    }
    if (existingItems) {
      existingItems.forEach(item => existingChildIds.add(item.child_id));
    }

    const detected: DetectedChange[] = [];

    // 新規: contract_start_date が対象月内 & contract_status = 'active'
    const { data: newChildren } = await supabase
      .from('children')
      .select('id, name, birth_date, beneficiary_number, contract_start_date, contract_end_date, contract_days')
      .eq('facility_id', facilityId)
      .eq('contract_status', 'active')
      .gte('contract_start_date', startDate)
      .lte('contract_start_date', endDate);

    if (newChildren) {
      for (const child of newChildren) {
        if (existingChildIds.has(child.id)) continue;
        detected.push({
          childId: child.id,
          childName: child.name,
          birthDate: child.birth_date,
          beneficiaryNumber: child.beneficiary_number,
          contractStartDate: child.contract_start_date,
          contractEndDate: child.contract_end_date,
          contractDays: child.contract_days,
          reportType: 'new',
        });
      }
    }

    // 終了: contract_end_date が対象月内 or contract_status が terminated/expired
    const { data: endedByDate } = await supabase
      .from('children')
      .select('id, name, birth_date, beneficiary_number, contract_start_date, contract_end_date, contract_days')
      .eq('facility_id', facilityId)
      .gte('contract_end_date', startDate)
      .lte('contract_end_date', endDate);

    if (endedByDate) {
      for (const child of endedByDate) {
        if (existingChildIds.has(child.id)) continue;
        if (detected.find(d => d.childId === child.id)) continue;
        detected.push({
          childId: child.id,
          childName: child.name,
          birthDate: child.birth_date,
          beneficiaryNumber: child.beneficiary_number,
          contractStartDate: child.contract_start_date,
          contractEndDate: child.contract_end_date,
          contractDays: child.contract_days,
          reportType: 'termination',
        });
      }
    }

    const { data: endedByStatus } = await supabase
      .from('children')
      .select('id, name, birth_date, beneficiary_number, contract_start_date, contract_end_date, contract_days, updated_at')
      .eq('facility_id', facilityId)
      .in('contract_status', ['terminated', 'inactive'])
      .gte('updated_at', startDate)
      .lte('updated_at', endDate + 'T23:59:59');

    if (endedByStatus) {
      for (const child of endedByStatus) {
        if (existingChildIds.has(child.id)) continue;
        if (detected.find(d => d.childId === child.id)) continue;
        detected.push({
          childId: child.id,
          childName: child.name,
          birthDate: child.birth_date,
          beneficiaryNumber: child.beneficiary_number,
          contractStartDate: child.contract_start_date,
          contractEndDate: child.contract_end_date,
          contractDays: child.contract_days,
          reportType: 'termination',
        });
      }
    }

    // 変更: updated_at が対象月内で、契約日数等が変わった児童（簡易検出）
    const { data: updatedChildren } = await supabase
      .from('children')
      .select('id, name, birth_date, beneficiary_number, contract_start_date, contract_end_date, contract_days, updated_at')
      .eq('facility_id', facilityId)
      .eq('contract_status', 'active')
      .gte('updated_at', startDate)
      .lte('updated_at', endDate + 'T23:59:59');

    if (updatedChildren) {
      for (const child of updatedChildren) {
        if (existingChildIds.has(child.id)) continue;
        if (detected.find(d => d.childId === child.id)) continue;
        // 新規検出済みでなければ変更候補
        detected.push({
          childId: child.id,
          childName: child.name,
          birthDate: child.birth_date,
          beneficiaryNumber: child.beneficiary_number,
          contractStartDate: child.contract_start_date,
          contractEndDate: child.contract_end_date,
          contractDays: child.contract_days,
          reportType: 'change',
          changeDetail: '契約内容が更新されました',
        });
      }
    }

    return detected;
  }, [facilityId]);

  // 既存レポートを取得
  const fetchContractReport = useCallback(async (year: number, month: number) => {
    if (!facilityId) return;

    setLoading(true);
    try {
      // 行政機関を取得
      const gov = await fetchGovernmentOrg();

      // 提出レコードを取得
      const { data: subData } = await supabase
        .from('government_document_submissions')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('target_year', year)
        .eq('target_month', month)
        .eq('category_id', 'contract_report')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let submission: GovernmentDocumentSubmission | null = null;
      let items: ContractReportItem[] = [];

      if (subData) {
        submission = mapSubmissionRow(subData);

        // 明細を取得
        const { data: itemsData } = await supabase
          .from('contract_report_items')
          .select('*')
          .eq('submission_id', subData.id)
          .order('created_at', { ascending: true });

        if (itemsData) {
          items = itemsData.map(mapReportItemRow);
        }
      }

      // 変更を検出
      const detectedChanges = await detectContractChanges(year, month);

      setReportData({
        submission,
        items,
        detectedChanges,
        governmentOrg: gov,
      });
    } catch (error) {
      console.error('契約報告書データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  }, [facilityId, fetchGovernmentOrg, detectContractChanges]);

  // 報告書提出レコード作成
  const createSubmission = useCallback(async (year: number, month: number): Promise<string | null> => {
    if (!facilityId) return null;

    const gov = await fetchGovernmentOrg();
    if (!gov) return null;

    const id = `cr_${facilityId}_${year}_${month}_${Date.now()}`;
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('government_document_submissions')
      .insert({
        id,
        facility_id: facilityId,
        organization_id: gov.id,
        category_id: 'contract_report',
        title: `契約内容報告書 ${year}年${month}月分`,
        target_year: year,
        target_month: month,
        status: 'draft',
        created_at: now,
        updated_at: now,
      });

    if (error) {
      console.error('提出レコード作成エラー:', error);
      return null;
    }

    return id;
  }, [facilityId, fetchGovernmentOrg]);

  // 報告項目を追加
  const addReportItem = useCallback(async (
    submissionId: string,
    item: Omit<ContractReportItem, 'id' | 'submissionId' | 'createdAt'>,
  ): Promise<ContractReportItem | null> => {
    const id = `cri_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('contract_report_items')
      .insert({
        id,
        submission_id: submissionId,
        child_id: item.childId,
        contract_id: item.contractId || null,
        report_type: item.reportType,
        child_name: item.childName,
        child_birthday: item.childBirthday || null,
        recipient_number: item.recipientNumber || null,
        contract_start_date: item.contractStartDate || null,
        contract_end_date: item.contractEndDate || null,
        service_type: item.serviceType || null,
        days_per_month: item.daysPerMonth || null,
        change_content: item.changeContent || null,
        termination_reason: item.terminationReason || null,
        created_at: now,
      });

    if (error) {
      console.error('報告項目追加エラー:', error);
      return null;
    }

    return {
      id,
      submissionId,
      ...item,
      createdAt: now,
    };
  }, []);

  // 報告項目を削除
  const deleteReportItem = useCallback(async (itemId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('contract_report_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('報告項目削除エラー:', error);
      return false;
    }
    return true;
  }, []);

  // 提出ステータスを更新
  const updateSubmissionStatus = useCallback(async (
    submissionId: string,
    status: DocumentSubmissionStatus,
  ): Promise<boolean> => {
    const updates: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'submitted') {
      updates.submitted_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('government_document_submissions')
      .update(updates)
      .eq('id', submissionId);

    if (error) {
      console.error('ステータス更新エラー:', error);
      return false;
    }
    return true;
  }, []);

  // 検出された変更を一括追加
  const addDetectedChanges = useCallback(async (
    submissionId: string,
    changes: DetectedChange[],
  ): Promise<ContractReportItem[]> => {
    const addedItems: ContractReportItem[] = [];

    for (const change of changes) {
      const item = await addReportItem(submissionId, {
        childId: change.childId,
        reportType: change.reportType,
        childName: change.childName,
        childBirthday: change.birthDate,
        recipientNumber: change.beneficiaryNumber,
        contractStartDate: change.contractStartDate,
        contractEndDate: change.contractEndDate,
        daysPerMonth: change.contractDays,
        changeContent: change.changeDetail,
      });
      if (item) addedItems.push(item);
    }

    return addedItems;
  }, [addReportItem]);

  return {
    loading,
    reportData,
    fetchContractReport,
    createSubmission,
    addReportItem,
    deleteReportItem,
    updateSubmissionStatus,
    addDetectedChanges,
    fetchGovernmentOrg,
  };
};
