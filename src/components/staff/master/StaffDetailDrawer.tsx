/**
 * スタッフ詳細ドロワー
 * タブ: 基本情報 | 書類 | 勤怠 | 人員配置 | 休暇 | 設定
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Award,
  Clock,
  Shield,
  Calendar,
  Briefcase,
  FileText,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  CheckCircle,
  Eye,
  Download,
  Upload,
  Link2,
  Send,
  Copy,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  Archive,
} from 'lucide-react';
import { Staff, StaffPersonnelSettings, StaffLeaveSettings, QUALIFICATION_CODES, AccountStatus, UserPermissions } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import DocumentPreviewModal from '@/components/common/DocumentPreviewModal';
import LaborConditionsPanel from './LaborConditionsPanel';
import PermissionEditor from './PermissionEditor';
import { useToast } from '@/components/ui/Toast';
import { parseQualifications } from '@/utils/qualifications';

interface StaffWithRelations extends Staff {
  personnelSettings?: StaffPersonnelSettings;
  leaveSettings?: StaffLeaveSettings;
  accountStatus?: AccountStatus;
  profilePhotoUrl?: string;
}

interface StaffDocument {
  id: string;
  title: string;
  document_type: string;
  document_category: 'received' | 'distributed';
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  is_read: boolean;
  created_at: string;
  target_year?: number;
  target_month?: number;
}

interface AttendanceDay {
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: string;
}

interface StaffDetailDrawerProps {
  staff: StaffWithRelations | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (staff: StaffWithRelations) => void;
  onDelete: (staff: StaffWithRelations) => void;
  onEditLeave?: (staff: StaffWithRelations) => void;
  onEditPersonnel?: (staff: StaffWithRelations) => void;
  onRefresh?: () => void;
}

type TabId = 'info' | 'documents' | 'attendance' | 'personnel' | 'leave' | 'settings';

// 受領書類タイプ（スタッフから受け取る書類）
const RECEIVED_DOC_TYPES = [
  { key: 'resume', label: '履歴書' },
  { key: 'qualification_cert', label: '資格証明書' },
  { key: 'work_experience', label: '実務経験証明書' },
  { key: 'career_history', label: '職務経歴書' },
  { key: 'health_checkup', label: '健康診断書' },
  { key: 'confidentiality_agreement', label: '守秘義務誓約書' },
  { key: 'id_document', label: '身分証明書' },
  { key: 'commute_certificate', label: '通勤届' },
  { key: 'tax_withholding_form', label: '扶養控除申告書' },
  { key: 'other_received', label: 'その他' },
] as const;

// 配布書類タイプ（スタッフへ配布する書類）
const DISTRIBUTED_DOC_TYPES = [
  { key: 'payslip', label: '給与明細' },
  { key: 'wage_notice', label: '賃金通知書' },
  { key: 'employment_contract', label: '労働条件通知書' },
  { key: 'social_insurance', label: '社会保険関連' },
  { key: 'withholding_tax', label: '源泉徴収票' },
  { key: 'year_end_adjustment', label: '年末調整' },
  { key: 'employment_regulation', label: '就業規則' },
  { key: 'other_distributed', label: 'その他' },
] as const;

// document_type から category を推定（document_category がない既存データ用フォールバック）
function inferDocCategory(docType: string): 'received' | 'distributed' {
  const receivedTypes = [
    'resume', 'qualification_cert', 'work_experience', 'career_history',
    'health_checkup', 'confidentiality_agreement', 'id_document',
    'commute_certificate', 'tax_withholding_form', 'other_received',
  ];
  return receivedTypes.includes(docType) ? 'received' : 'distributed';
}

function getDocTypeLabel(docType: string): string {
  const all = [...RECEIVED_DOC_TYPES, ...DISTRIBUTED_DOC_TYPES];
  return all.find(t => t.key === docType)?.label || docType;
}

const StaffDetailDrawer: React.FC<StaffDetailDrawerProps> = ({
  staff,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onEditLeave,
  onEditPersonnel,
  onRefresh,
}) => {
  const { facility } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('info');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 書類関連
  const [documents, setDocuments] = useState<StaffDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<StaffDocument | null>(null);
  const [receivedExpanded, setReceivedExpanded] = useState(true);
  const [distributedExpanded, setDistributedExpanded] = useState(true);

  // 受領書類アップロード
  const [showReceivedUpload, setShowReceivedUpload] = useState(false);
  const [receivedUploadType, setReceivedUploadType] = useState('resume');
  const [receivedUploadTitle, setReceivedUploadTitle] = useState('');
  const [receivedUploadFile, setReceivedUploadFile] = useState<File | null>(null);
  const [receivedUploading, setReceivedUploading] = useState(false);
  const receivedFileInputRef = useRef<HTMLInputElement>(null);

  // 配布書類アップロード
  const [showDistributeForm, setShowDistributeForm] = useState(false);
  const [distributeType, setDistributeType] = useState('payslip');
  const [distributeTitle, setDistributeTitle] = useState('');
  const [distributeYear, setDistributeYear] = useState(new Date().getFullYear());
  const [distributeMonth, setDistributeMonth] = useState(new Date().getMonth() + 1);
  const [distributeFile, setDistributeFile] = useState<File | null>(null);
  const [distributing, setDistributing] = useState(false);
  const distributeFileInputRef = useRef<HTMLInputElement>(null);

  // 書類削除確認
  const [docToDelete, setDocToDelete] = useState<StaffDocument | null>(null);
  const [docDeleting, setDocDeleting] = useState(false);

  // 操作結果メッセージ
  const [docMessage, setDocMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 招待関連
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ url: string; token: string } | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  // 人員配置インライン編集
  const [personnelEditing, setPersonnelEditing] = useState(false);
  const [pForm, setPForm] = useState({
    personnelType: '' as string,
    workStyle: '' as string,
    isServiceManager: false,
    isManager: false,
    managerConcurrentRole: '' as string,
    contractedWeeklyHours: 40,
    yearsOfExperience: 0,
    additionCodes: [] as string[],
  });
  const [personnelSaving, setPersonnelSaving] = useState(false);
  const [personnelMessage, setPersonnelMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 施設の所定労働時間（FTE分母）
  const [facilityStandardHours, setFacilityStandardHours] = useState<number>(40);

  // 労働条件通知書から取得した契約時間
  const [contractWeeklyHours, setContractWeeklyHours] = useState<number | null>(null);
  const [activeContractId, setActiveContractId] = useState<string | null>(null);

  // 実務経験証明書の有無
  const [hasExpCertificate, setHasExpCertificate] = useState(false);

  // 労働条件通知書パネル表示
  const [showLaborPanel, setShowLaborPanel] = useState(false);

  // 勤怠関連
  const [attendanceMonth, setAttendanceMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [attendanceData, setAttendanceData] = useState<AttendanceDay[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // 設定タブ（hooks はすべて早期returnの前に配置する必要がある）
  const [permissionsEditing, setPermissionsEditing] = useState(false);
  const [editPermissions, setEditPermissions] = useState<UserPermissions>({});
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!staff) return;
    setEditPermissions(staff.permissions || {});
    setPermissionsEditing(false);
  }, [staff?.id, staff?.permissions]);

  // スタッフ変更時にリセット
  useEffect(() => {
    setActiveTab('info');
    setDocuments([]);
    setPreviewDoc(null);
    setInviteResult(null);
    setInviteCopied(false);
    setAttendanceData([]);
    setShowReceivedUpload(false);
    setShowDistributeForm(false);
    setDocToDelete(null);
    setDocMessage(null);
    setReceivedUploadFile(null);
    setDistributeFile(null);
    setPersonnelEditing(false);
    setPersonnelMessage(null);
    setContractWeeklyHours(null);
    setActiveContractId(null);
    setHasExpCertificate(false);
    setShowLaborPanel(false);
    setShowDeleteConfirm(false);
  }, [staff?.id]);

  // 施設の所定労働時間を取得
  useEffect(() => {
    if (!facility?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('facility_settings')
        .select('standard_weekly_hours')
        .eq('facility_id', facility.id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.standard_weekly_hours) {
        setFacilityStandardHours(Number(data.standard_weekly_hours));
      }
    })();
    return () => { cancelled = true; };
  }, [facility?.id]);

  // 有効な労働条件通知書から契約時間を取得
  useEffect(() => {
    if (!facility?.id || !staff?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('employment_contracts')
        .select('id, contracted_weekly_hours, status')
        .eq('facility_id', facility.id)
        .eq('staff_id', staff.id)
        .in('status', ['issued', 'acknowledged', 'signed'])
        .order('contract_start_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        const hours = data.contracted_weekly_hours != null ? Number(data.contracted_weekly_hours) : null;
        setContractWeeklyHours(hours);
        setActiveContractId(data.id);
      }
    })();
    return () => { cancelled = true; };
  }, [facility?.id, staff?.id]);

  // 実務経験証明書の有無を確認
  useEffect(() => {
    if (!facility?.id || !staff?.user_id) return;
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from('staff_documents')
        .select('id', { count: 'exact', head: true })
        .eq('facility_id', facility.id)
        .eq('user_id', staff.user_id)
        .eq('document_type', 'work_experience');
      if (cancelled) return;
      setHasExpCertificate((count || 0) > 0);
    })();
    return () => { cancelled = true; };
  }, [facility?.id, staff?.user_id]);

  // 書類取得
  const fetchDocuments = useCallback(async () => {
    if (!facility?.id || !staff?.user_id) return;
    setDocsLoading(true);
    try {
      const { data, error } = await supabase
        .from('staff_documents')
        .select('*')
        .eq('facility_id', facility.id)
        .eq('user_id', staff.user_id)
        .order('created_at', { ascending: false });

      if (!error && data) setDocuments(data);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setDocsLoading(false);
    }
  }, [facility?.id, staff?.user_id]);

  // 書類を初期取得（未読バッジ表示のためタブ選択前にロード）
  useEffect(() => {
    if (staff?.user_id) {
      fetchDocuments();
    }
  }, [staff?.user_id, fetchDocuments]);

  // 勤怠データ取得
  const fetchAttendance = useCallback(async () => {
    if (!facility?.id || !staff?.user_id) return;
    setAttendanceLoading(true);
    try {
      const [year, month] = attendanceMonth.split('-').map(Number);
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0);
      const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

      const { data } = await supabase
        .from('attendance_daily_summary')
        .select('date, start_time, end_time, status')
        .eq('facility_id', facility.id)
        .eq('user_id', staff.user_id)
        .gte('date', startDate)
        .lte('date', endDateStr)
        .order('date');

      setAttendanceData((data || []).map(r => ({
        date: r.date,
        checkIn: r.start_time || undefined,
        checkOut: r.end_time || undefined,
        status: r.status === 'completed' || r.status === 'working' ? 'present' : r.status || 'present',
      })));
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
    } finally {
      setAttendanceLoading(false);
    }
  }, [facility?.id, staff?.user_id, attendanceMonth]);

  useEffect(() => {
    if (activeTab === 'attendance' && staff?.user_id) {
      fetchAttendance();
    }
  }, [activeTab, staff?.user_id, attendanceMonth, fetchAttendance]);

  // 書類プレビュー
  const handlePreview = (doc: StaffDocument) => {
    setPreviewDoc(doc);
  };

  // 書類ダウンロード
  const handleDownload = async (doc: StaffDocument) => {
    try {
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_url, 3600);
      if (data?.signedUrl) {
        const a = document.createElement('a');
        a.href = data.signedUrl;
        a.download = doc.file_name || doc.title;
        a.click();
      }
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  // 受領書類アップロード
  const handleReceivedUpload = async () => {
    if (!facility?.id || !staff?.user_id || !receivedUploadFile) return;
    setReceivedUploading(true);
    setDocMessage(null);
    try {
      const fileExt = receivedUploadFile.name.split('.').pop();
      const filePath = `staff-docs/${facility.id}/${staff.user_id}/received/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, receivedUploadFile);
      if (uploadError) throw new Error(`アップロード失敗: ${uploadError.message}`);

      const typeLabel = RECEIVED_DOC_TYPES.find(t => t.key === receivedUploadType)?.label || receivedUploadType;
      const title = receivedUploadTitle.trim() || `${staff.name} ${typeLabel}`;

      const { error: insertError } = await supabase
        .from('staff_documents')
        .insert({
          facility_id: facility.id,
          user_id: staff.user_id,
          document_type: receivedUploadType,
          document_category: 'received',
          title,
          file_url: filePath,
          file_name: receivedUploadFile.name,
          file_type: receivedUploadFile.type || null,
          file_size: receivedUploadFile.size,
          is_read: true, // 受領書類は既読扱い（配布ワークフローなし）
        });
      if (insertError) throw new Error(`保存失敗: ${insertError.message}`);

      setDocMessage({ type: 'success', text: `「${title}」を保管しました` });
      setShowReceivedUpload(false);
      setReceivedUploadTitle('');
      setReceivedUploadType('resume');
      setReceivedUploadFile(null);
      fetchDocuments();
      setTimeout(() => setDocMessage(null), 3000);
    } catch (err: any) {
      setDocMessage({ type: 'error', text: err.message || 'アップロードに失敗しました' });
    } finally {
      setReceivedUploading(false);
    }
  };

  // 配布書類アップロード・配布
  const handleDistribute = async () => {
    if (!facility?.id || !staff?.user_id || !distributeFile) return;
    setDistributing(true);
    setDocMessage(null);
    try {
      const fileExt = distributeFile.name.split('.').pop();
      const filePath = `staff-docs/${facility.id}/${staff.user_id}/distributed/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, distributeFile);
      if (uploadError) throw new Error(`アップロード失敗: ${uploadError.message}`);

      const typeLabel = DISTRIBUTED_DOC_TYPES.find(t => t.key === distributeType)?.label || distributeType;
      const title = distributeTitle.trim() || `${typeLabel} ${distributeYear}年${distributeMonth}月`;

      const { error: insertError } = await supabase
        .from('staff_documents')
        .insert({
          facility_id: facility.id,
          user_id: staff.user_id,
          document_type: distributeType,
          document_category: 'distributed',
          title,
          file_url: filePath,
          file_name: distributeFile.name,
          file_type: distributeFile.type || null,
          file_size: distributeFile.size,
          target_year: distributeYear,
          target_month: distributeMonth,
          issued_at: new Date().toISOString(),
          is_read: false,
        });
      if (insertError) throw new Error(`保存失敗: ${insertError.message}`);

      // 通知を送信
      try {
        await supabase.from('notifications').insert({
          id: `notif-${Date.now()}-${staff.user_id}`,
          user_id: staff.user_id,
          title: '新しい書類が届きました',
          message: `${typeLabel}「${title}」が配布されました`,
          type: 'document_available',
          is_read: false,
          created_at: new Date().toISOString(),
        });
      } catch {
        // 通知失敗は書類配布成功に影響させない
      }

      setDocMessage({ type: 'success', text: `「${title}」を${staff.name}さんに配布しました` });
      setShowDistributeForm(false);
      setDistributeTitle('');
      setDistributeType('payslip');
      setDistributeFile(null);
      fetchDocuments();
      setTimeout(() => setDocMessage(null), 3000);
    } catch (err: any) {
      setDocMessage({ type: 'error', text: err.message || '配布に失敗しました' });
    } finally {
      setDistributing(false);
    }
  };

  // 書類削除
  const handleDeleteDoc = async () => {
    if (!docToDelete) return;
    setDocDeleting(true);
    try {
      await supabase.storage.from('documents').remove([docToDelete.file_url]);
      const { error } = await supabase.from('staff_documents').delete().eq('id', docToDelete.id);
      if (error) throw error;
      setDocMessage({ type: 'success', text: `「${docToDelete.title}」を削除しました` });
      setDocToDelete(null);
      fetchDocuments();
      setTimeout(() => setDocMessage(null), 3000);
    } catch {
      setDocMessage({ type: 'error', text: '削除に失敗しました' });
    } finally {
      setDocDeleting(false);
    }
  };

  // 人員配置保存
  const handleSavePersonnel = async () => {
    if (!facility?.id || !staff) return;
    setPersonnelSaving(true);
    setPersonnelMessage(null);
    try {
      const upsertData: Record<string, unknown> = {
        facility_id: facility.id,
        staff_id: staff.id.startsWith('emp-') ? undefined : staff.id,
      };
      if (!upsertData.staff_id) {
        setPersonnelMessage({ type: 'error', text: 'このスタッフの人員配置は編集できません' });
        setPersonnelSaving(false);
        return;
      }
      upsertData.personnel_type = pForm.personnelType || null;
      upsertData.work_style = pForm.workStyle || null;
      upsertData.is_service_manager = pForm.isServiceManager;
      upsertData.is_manager = pForm.isManager;
      upsertData.manager_concurrent_role = pForm.isManager ? (pForm.managerConcurrentRole || null) : null;
      upsertData.contracted_weekly_hours = pForm.contractedWeeklyHours || null;
      upsertData.assigned_addition_codes = pForm.additionCodes.length > 0 ? pForm.additionCodes : null;

      const { error } = await supabase
        .from('staff_personnel_settings')
        .upsert(upsertData, { onConflict: 'facility_id,staff_id' });

      if (error) throw error;

      // 実務経験年数はstaffテーブルに保存
      if (staff.id && !staff.id.startsWith('emp-')) {
        await supabase
          .from('staff')
          .update({ years_of_experience: pForm.yearsOfExperience || 0 })
          .eq('id', staff.id);
      }

      setPersonnelEditing(false);
      setPersonnelMessage({ type: 'success', text: '人員配置設定を保存しました' });
      setTimeout(() => setPersonnelMessage(null), 3000);
      onRefresh?.();
    } catch (err: any) {
      console.error('Personnel save error:', err);
      setPersonnelMessage({ type: 'error', text: '保存に失敗しました: ' + (err.message || '') });
    } finally {
      setPersonnelSaving(false);
    }
  };

  const startPersonnelEdit = () => {
    // contractWeeklyHoursが労働条件通知書から取得できている場合はそちらを優先
    const weeklyHours = contractWeeklyHours ?? staff?.personnelSettings?.contractedWeeklyHours ?? 40;
    setPForm({
      personnelType: staff?.personnelSettings?.personnelType || '',
      workStyle: staff?.personnelSettings?.workStyle || '',
      isServiceManager: staff?.personnelSettings?.isServiceManager || false,
      isManager: staff?.personnelSettings?.isManager || false,
      managerConcurrentRole: staff?.personnelSettings?.managerConcurrentRole || '',
      contractedWeeklyHours: weeklyHours,
      yearsOfExperience: staff?.yearsOfExperience || 0,
      additionCodes: staff?.personnelSettings?.assignedAdditionCodes || [],
    });
    setPersonnelEditing(true);
  };

  // 招待ボタン
  const handleInvite = async () => {
    if (!facility?.id || !staff) return;
    setInviting(true);
    try {
      const token = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const { error } = await supabase.from('staff_invitations').insert({
        facility_id: facility.id,
        email: staff.email || '',
        name: staff.name,
        token,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (!error) {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        setInviteResult({ url: `${baseUrl}/facility/join?token=${token}`, token });
      } else {
        setDocMessage({ type: 'error', text: `招待の作成に失敗しました: ${error.message}` });
      }
    } catch (err) {
      console.error('Invite error:', err);
    } finally {
      setInviting(false);
    }
  };

  const handleCopyInviteUrl = async () => {
    if (!inviteResult) return;
    try {
      await navigator.clipboard.writeText(inviteResult.url);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = inviteResult.url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    }
  };

  const handleSendInviteEmail = async () => {
    if (!inviteResult || !staff?.email) return;
    try {
      await fetch('/api/staff/bulk-invite-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitations: [{ email: staff.email, name: staff.name, token: inviteResult.token }],
          facilityName: facility?.name || '',
        }),
      });
    } catch (err) {
      console.error('Email send error:', err);
    }
  };

  if (!isOpen || !staff) return null;

  // 資格ラベル取得
  const getQualificationLabels = (): string[] => {
    return (staff.personnelSettings?.qualifications || []).map(
      (q: string) => QUALIFICATION_CODES[q as keyof typeof QUALIFICATION_CODES] || q
    );
  };

  const getWorkStyleLabel = () => {
    if (!staff.personnelSettings?.workStyle) return '未設定';
    const labels: Record<string, string> = {
      fulltime_dedicated: '常勤専従',
      fulltime_concurrent: '常勤兼務',
      parttime: '非常勤',
    };
    return labels[staff.personnelSettings.workStyle] || staff.personnelSettings.workStyle;
  };

  const getPersonnelTypeLabel = () => {
    if (!staff.personnelSettings?.personnelType) return '未設定';
    return staff.personnelSettings.personnelType === 'standard' ? '基準人員' : '加算人員';
  };

  const getFte = (hours?: number) => {
    const h = hours ?? contractWeeklyHours ?? staff.personnelSettings?.contractedWeeklyHours;
    if (!h || !facilityStandardHours || facilityStandardHours <= 0) return null;
    return (h / facilityStandardHours).toFixed(2);
  };

  const isLinked = staff.accountStatus === 'active';

  // 書類をカテゴリ別に分類
  const receivedDocs = documents.filter(d =>
    (d.document_category || inferDocCategory(d.document_type)) === 'received'
  );
  const distributedDocs = documents.filter(d =>
    (d.document_category || inferDocCategory(d.document_type)) === 'distributed'
  );
  const unreadDistributedCount = distributedDocs.filter(d => !d.is_read).length;

  // === 基本情報タブ ===
  const renderInfoTab = () => (
    <div className="space-y-6">
      {/* 招待ボタン / 連携状態 */}
      <section>
        {isLinked ? (
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg text-green-700 text-sm">
            <Link2 size={16} />
            <span>キャリアアカウント連携済み</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-gray-500 text-sm">
              <Link2 size={16} />
              <span>キャリアアカウント未連携</span>
            </div>
            {!inviteResult ? (
              <button
                onClick={handleInvite}
                disabled={inviting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 text-sm font-medium"
              >
                {inviting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                招待リンクを発行
              </button>
            ) : (
              <div className="space-y-2 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-600 font-medium">招待リンク（7日間有効）</p>
                <div className="flex gap-1">
                  <input
                    readOnly
                    value={inviteResult.url}
                    className="flex-1 text-xs bg-white border rounded px-2 py-1.5 text-gray-600"
                  />
                  <button
                    onClick={handleCopyInviteUrl}
                    className="px-2 py-1.5 bg-white border rounded hover:bg-gray-50"
                  >
                    {inviteCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                </div>
                {staff.email && (
                  <button
                    onClick={handleSendInviteEmail}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-blue-600 bg-white border border-blue-200 rounded text-xs hover:bg-blue-50"
                  >
                    <Mail size={12} />
                    {staff.email}にメール送信
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 連絡先 */}
      <section>
        <h4 className="text-sm font-medium text-gray-500 mb-3">連絡先</h4>
        <div className="space-y-3">
          {staff.phone && (
            <div className="flex items-center gap-3 text-gray-700">
              <Phone size={18} className="text-gray-400" />
              <span>{staff.phone}</span>
            </div>
          )}
          {staff.email && (
            <div className="flex items-center gap-3 text-gray-700">
              <Mail size={18} className="text-gray-400" />
              <span className="text-sm">{staff.email}</span>
            </div>
          )}
          {!staff.phone && !staff.email && (
            <p className="text-sm text-gray-400">連絡先が登録されていません</p>
          )}
        </div>
      </section>

      {/* 資格 */}
      <section>
        <h4 className="text-sm font-medium text-gray-500 mb-3">資格・経験</h4>
        <div className="space-y-3">
          {(() => {
            // personnelSettings.qualifications（コード値）をラベルに変換
            const pLabels = getQualificationLabels();
            // staff.qualifications（自由入力文字列 or 配列）
            const rawQuals = parseQualifications(staff.qualifications);
            // pLabelsに含まれない自由入力のみ表示（重複排除）
            const pLabelSet = new Set(pLabels.map(l => l.toLowerCase()));
            const extraQuals = rawQuals.filter((q: string) => !pLabelSet.has(q.toLowerCase()));
            const hasAny = pLabels.length > 0 || extraQuals.length > 0;

            return hasAny ? (
              <div className="flex flex-wrap gap-2">
                {pLabels.map((label, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-primary/5 text-primary rounded-full text-sm"
                  >
                    <Award size={14} />
                    {label}
                  </span>
                ))}
                {extraQuals.map((q: string, idx: number) => (
                  <span
                    key={`q-${idx}`}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm"
                  >
                    <Award size={14} />
                    {q}
                  </span>
                ))}
              </div>
            ) : null;
          })()}
          {staff.yearsOfExperience !== undefined && staff.yearsOfExperience > 0 && (
            <div className="flex items-center gap-2 text-gray-600">
              <Clock size={16} className="text-gray-400" />
              <span>実務経験 {staff.yearsOfExperience}年</span>
            </div>
          )}
        </div>
      </section>

      {/* メモ */}
      {(staff.memo || staff.personnelSettings?.notes) && (
        <section>
          <h4 className="text-sm font-medium text-gray-500 mb-3">メモ</h4>
          <div className="p-3 bg-gray-50 rounded-lg text-gray-700 text-sm whitespace-pre-wrap">
            {staff.memo || staff.personnelSettings?.notes}
          </div>
        </section>
      )}
    </div>
  );

  // === 書類タブ ===
  const renderDocumentsTab = () => {
    if (!staff.user_id) {
      return (
        <div className="py-12 text-center">
          <FileText size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">書類管理にはアカウント連携が必要です</p>
          <p className="text-xs text-gray-400 mt-1">基本情報タブから招待リンクを発行してください</p>
        </div>
      );
    }

    if (docsLoading) {
      return (
        <div className="py-12 text-center">
          <Loader2 className="animate-spin mx-auto text-gray-400" size={24} />
          <p className="text-sm text-gray-400 mt-2">読み込み中...</p>
        </div>
      );
    }

    // 書類行コンポーネント
    const renderDocRow = (doc: StaffDocument, showReadStatus: boolean) => (
      <div
        key={doc.id}
        className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-lg hover:border-gray-200 transition-colors group"
      >
        <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${
          showReadStatus && !doc.is_read ? 'bg-amber-50' : 'bg-gray-50'
        }`}>
          <FileText size={16} className={
            showReadStatus && !doc.is_read ? 'text-amber-500' : 'text-gray-400'
          } />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-800 truncate">{doc.title}</p>
            {showReadStatus && !doc.is_read && (
              <span className="flex-shrink-0 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">
                未読
              </span>
            )}
            {showReadStatus && doc.is_read && (
              <span className="flex-shrink-0 text-[10px] text-green-600 flex items-center gap-0.5">
                <CheckCircle size={10} />既読
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>{getDocTypeLabel(doc.document_type)}</span>
            <span>{new Date(doc.created_at).toLocaleDateString('ja-JP')}</span>
            {doc.file_size && <span>{(doc.file_size / 1024).toFixed(0)}KB</span>}
          </div>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); handlePreview(doc); }}
            className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded"
            title="プレビュー"
          >
            <Eye size={15} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            title="ダウンロード"
          >
            <Download size={15} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDocToDelete(doc); }}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
            title="削除"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    );

    return (
      <div className="space-y-5">
        {/* 操作結果メッセージ */}
        {docMessage && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
            docMessage.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {docMessage.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            <span className="flex-1">{docMessage.text}</span>
            <button onClick={() => setDocMessage(null)} className="p-0.5 hover:opacity-70">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ========================================== */}
        {/* セクション1: 受領書類（保管） */}
        {/* ========================================== */}
        <section>
          <button
            onClick={() => setReceivedExpanded(!receivedExpanded)}
            className="w-full flex items-center justify-between py-2 group"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
                <Archive size={13} className="text-blue-600" />
              </div>
              <h4 className="text-sm font-bold text-gray-800">受領書類</h4>
              <span className="text-xs text-gray-400">保管</span>
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                {receivedDocs.length}
              </span>
            </div>
            {receivedExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>

          {receivedExpanded && (
            <div className="space-y-2 mt-1">
              <p className="text-xs text-gray-400 mb-2">
                スタッフから受け取った書類（履歴書・資格証など）
              </p>

              {/* 受領書類アップロードボタン */}
              {!showReceivedUpload ? (
                <button
                  onClick={() => setShowReceivedUpload(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-colors"
                >
                  <Upload size={14} />
                  受領書類を保管
                </button>
              ) : (
                /* 受領書類アップロードフォーム */
                <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-blue-800">受領書類を保管</h5>
                    <button onClick={() => { setShowReceivedUpload(false); setReceivedUploadFile(null); }}>
                      <X size={14} className="text-gray-400" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">書類種別</label>
                    <select
                      value={receivedUploadType}
                      onChange={e => setReceivedUploadType(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    >
                      {RECEIVED_DOC_TYPES.map(t => (
                        <option key={t.key} value={t.key}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">タイトル（任意）</label>
                    <input
                      type="text"
                      value={receivedUploadTitle}
                      onChange={e => setReceivedUploadTitle(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      placeholder="空欄で自動生成"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">ファイル</label>
                    {!receivedUploadFile ? (
                      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-3 cursor-pointer hover:border-blue-400 transition-colors bg-white">
                        <Upload size={14} className="text-gray-400" />
                        <span className="text-xs text-gray-500">PDF / 画像（10MB以下）</span>
                        <input
                          ref={receivedFileInputRef}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={e => setReceivedUploadFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="flex items-center gap-2 border border-gray-200 rounded-lg p-2 bg-white">
                        <FileText size={14} className="text-blue-500" />
                        <span className="text-xs text-gray-800 flex-1 truncate">{receivedUploadFile.name}</span>
                        <button onClick={() => setReceivedUploadFile(null)}>
                          <X size={12} className="text-gray-400" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setShowReceivedUpload(false); setReceivedUploadFile(null); }}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleReceivedUpload}
                      disabled={receivedUploading || !receivedUploadFile}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {receivedUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                      {receivedUploading ? '保管中...' : '保管する'}
                    </button>
                  </div>
                </div>
              )}

              {/* 受領書類リスト */}
              {receivedDocs.length === 0 && !showReceivedUpload ? (
                <div className="py-4 text-center">
                  <p className="text-xs text-gray-400">受領書類はまだありません</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {receivedDocs.map(doc => renderDocRow(doc, false))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* 区切り線 */}
        <div className="border-t border-gray-100" />

        {/* ========================================== */}
        {/* セクション2: 配布書類 */}
        {/* ========================================== */}
        <section>
          <button
            onClick={() => setDistributedExpanded(!distributedExpanded)}
            className="w-full flex items-center justify-between py-2 group"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                <Send size={13} className="text-primary" />
              </div>
              <h4 className="text-sm font-bold text-gray-800">配布書類</h4>
              <span className="text-xs text-gray-400">配信</span>
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                {distributedDocs.length}
              </span>
              {unreadDistributedCount > 0 && (
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                  {unreadDistributedCount}件未読
                </span>
              )}
            </div>
            {distributedExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>

          {distributedExpanded && (
            <div className="space-y-2 mt-1">
              <p className="text-xs text-gray-400 mb-2">
                スタッフへ配布した書類（給与明細・労働条件通知書など）
              </p>

              {/* 配布ボタン */}
              {!showDistributeForm ? (
                <button
                  onClick={() => setShowDistributeForm(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                >
                  <Send size={14} />
                  書類を配布
                </button>
              ) : (
                /* 配布書類フォーム */
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-[#00839a]">書類を配布</h5>
                    <button onClick={() => { setShowDistributeForm(false); setDistributeFile(null); }}>
                      <X size={14} className="text-gray-400" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">書類種別</label>
                      <select
                        value={distributeType}
                        onChange={e => setDistributeType(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        {DISTRIBUTED_DOC_TYPES.map(t => (
                          <option key={t.key} value={t.key}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">対象年月</label>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          value={distributeYear}
                          onChange={e => setDistributeYear(parseInt(e.target.value))}
                          className="w-[70px] px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
                          min={2020} max={2030}
                        />
                        <select
                          value={distributeMonth}
                          onChange={e => setDistributeMonth(parseInt(e.target.value))}
                          className="w-[60px] px-1.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
                        >
                          {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>{i + 1}月</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">タイトル（任意）</label>
                    <input
                      type="text"
                      value={distributeTitle}
                      onChange={e => setDistributeTitle(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="空欄で自動生成"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">ファイル</label>
                    {!distributeFile ? (
                      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-3 cursor-pointer hover:border-primary transition-colors bg-white">
                        <Upload size={14} className="text-gray-400" />
                        <span className="text-xs text-gray-500">PDF / 画像 / Excel（10MB以下）</span>
                        <input
                          ref={distributeFileInputRef}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx"
                          onChange={e => setDistributeFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="flex items-center gap-2 border border-gray-200 rounded-lg p-2 bg-white">
                        <FileText size={14} className="text-primary" />
                        <span className="text-xs text-gray-800 flex-1 truncate">{distributeFile.name}</span>
                        <button onClick={() => setDistributeFile(null)}>
                          <X size={12} className="text-gray-400" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setShowDistributeForm(false); setDistributeFile(null); }}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleDistribute}
                      disabled={distributing || !distributeFile}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
                    >
                      {distributing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      {distributing ? '配布中...' : '配布する'}
                    </button>
                  </div>
                </div>
              )}

              {/* 配布書類リスト */}
              {distributedDocs.length === 0 && !showDistributeForm ? (
                <div className="py-4 text-center">
                  <p className="text-xs text-gray-400">配布書類はまだありません</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {distributedDocs.map(doc => renderDocRow(doc, true))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* 書類削除確認ダイアログ */}
        {docToDelete && (
          <>
            <div className="fixed inset-0 bg-black/40 z-[9999]" onClick={() => setDocToDelete(null)} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl p-5 z-[9999] w-full max-w-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 size={18} className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">書類を削除</h3>
                  <p className="text-xs text-gray-500 truncate max-w-[240px]">{docToDelete.title}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">この書類を削除してもよろしいですか？ファイルも完全に削除されます。</p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setDocToDelete(null)}
                  disabled={docDeleting}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleDeleteDoc}
                  disabled={docDeleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {docDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {docDeleting ? '削除中...' : '削除する'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // === 勤怠カレンダータブ ===
  const renderAttendanceTab = () => {
    const [year, month] = attendanceMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
    const today = new Date().toISOString().split('T')[0];
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    const attendanceMap = new Map(attendanceData.map(a => [a.date, a]));

    // 月サマリー
    const workDays = attendanceData.filter(a => ['present', 'completed'].includes(a.status)).length;
    const totalHours = attendanceData.reduce((sum, a) => {
      if (a.checkIn && a.checkOut) {
        const start = new Date(`2000-01-01T${a.checkIn}`);
        const end = new Date(`2000-01-01T${a.checkOut}`);
        return sum + (end.getTime() - start.getTime()) / 3600000;
      }
      return sum;
    }, 0);

    const prevMonth = () => {
      const d = new Date(year, month - 2, 1);
      setAttendanceMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };
    const nextMonth = () => {
      const d = new Date(year, month, 1);
      setAttendanceMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };

    return (
      <div className="space-y-4">
        {/* 勤怠設定リンク */}
        <div className="flex justify-end">
          <span
            onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'staffing' }))}
            className="text-xs text-primary hover:underline cursor-pointer"
          >
            勤怠設定 &rarr;
          </span>
        </div>
        {/* 月ナビゲーション */}
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded">
            <ChevronLeft size={18} />
          </button>
          <h4 className="text-sm font-bold text-gray-800">{year}年{month}月</h4>
          <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* サマリー */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-emerald-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-emerald-600">{workDays}</p>
            <p className="text-xs text-emerald-500">出勤日数</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-600">{totalHours.toFixed(1)}</p>
            <p className="text-xs text-blue-500">総労働時間</p>
          </div>
        </div>

        {attendanceLoading ? (
          <div className="py-8 text-center">
            <Loader2 className="animate-spin mx-auto text-gray-400" size={24} />
          </div>
        ) : (
          <>
            {/* カレンダーグリッド */}
            <div className="border rounded-lg overflow-hidden">
              {/* 曜日ヘッダー */}
              <div className="grid grid-cols-7 bg-gray-50">
                {dayNames.map((name, i) => (
                  <div
                    key={name}
                    className={`text-center text-xs font-medium py-2 ${
                      i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'
                    }`}
                  >
                    {name}
                  </div>
                ))}
              </div>

              {/* 日付セル */}
              <div className="grid grid-cols-7">
                {/* 空セル */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="border-t border-gray-100 p-1 min-h-[52px]" />
                ))}

                {/* 日付 */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayOfWeek = new Date(year, month - 1, day).getDay();
                  const record = attendanceMap.get(dateStr);
                  const isToday = dateStr === today;
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                  let bgColor = '';
                  let statusDot = '';
                  if (record) {
                    if (['present', 'completed'].includes(record.status)) {
                      bgColor = 'bg-emerald-50';
                      statusDot = 'bg-emerald-400';
                    } else if (record.status === 'absent') {
                      bgColor = 'bg-red-50';
                      statusDot = 'bg-red-400';
                    } else if (record.status === 'late') {
                      bgColor = 'bg-yellow-50';
                      statusDot = 'bg-yellow-400';
                    }
                  }

                  return (
                    <div
                      key={day}
                      className={`border-t border-gray-100 p-1 min-h-[52px] ${bgColor} ${
                        isToday ? 'ring-2 ring-primary ring-inset' : ''
                      }`}
                      title={record?.checkIn ? `${record.checkIn}〜${record.checkOut || ''}` : undefined}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${
                          dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-700'
                        }`}>
                          {day}
                        </span>
                        {statusDot && <div className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />}
                      </div>
                      {record?.checkIn && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {record.checkIn.substring(0, 5)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 凡例 */}
            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />出勤</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />欠勤</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" />遅刻/早退</span>
            </div>
          </>
        )}
      </div>
    );
  };

  // === 加算コード定義 ===
  const ADDITION_OPTIONS = [
    { code: 'kahai_senmon', label: '児童指導員等加配加算（常勤専従）', desc: '基準人員に加え、児童指導員・保育士等を常勤専従で1名以上加配', category: 'kahai' },
    { code: 'kahai_kansan', label: '児童指導員等加配加算（常勤換算）', desc: '基準人員に加え、児童指導員・保育士等を常勤換算1.0以上で加配', category: 'kahai' },
    { code: 'senmon_taisei', label: '専門的支援体制加算', desc: 'PT/OT/ST/心理士、または5年以上経験の保育士・児童指導員を常勤換算1.0以上で配置', category: 'senmon' },
  ] as const;

  const getAdditionLabel = (code: string) => ADDITION_OPTIONS.find(a => a.code === code)?.label || code;

  // === 人員配置タブ ===
  const renderPersonnelTab = () => {
    const fte = facilityStandardHours > 0 ? (contractWeeklyHours ?? pForm.contractedWeeklyHours) / facilityStandardHours : 0;
    const has5YearsExp = pForm.yearsOfExperience >= 5;

    if (personnelEditing) {
      return (
        <div className="space-y-5">
          {personnelMessage && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              personnelMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {personnelMessage.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              {personnelMessage.text}
            </div>
          )}

          {/* ── セクション1: ポジション ── */}
          <div className="p-4 bg-gray-50 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">ポジション</h4>

            <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              pForm.isServiceManager ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}>
              <input
                type="checkbox"
                checked={pForm.isServiceManager}
                onChange={e => setPForm(p => ({ ...p, isServiceManager: e.target.checked }))}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-800">児童発達支援管理責任者（児発管）</span>
                <p className="text-xs text-gray-400">個別支援計画の作成・管理。常勤専任、管理者との兼務可</p>
              </div>
            </label>

            <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              pForm.isManager ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}>
              <input
                type="checkbox"
                checked={pForm.isManager}
                onChange={e => setPForm(p => ({ ...p, isManager: e.target.checked }))}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-800">管理者</span>
                <p className="text-xs text-gray-400">施設の運営管理。児発管との兼務可</p>
              </div>
            </label>

            {/* 管理者の兼務役割 */}
            {pForm.isManager && (
              <div className="ml-7">
                <label className="block text-xs text-gray-500 mb-1">兼務役割（管理者が他の役割を兼ねる場合）</label>
                <input
                  type="text"
                  value={pForm.managerConcurrentRole}
                  onChange={e => setPForm(p => ({ ...p, managerConcurrentRole: e.target.value }))}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  placeholder="例: 児発管兼務"
                />
              </div>
            )}
          </div>

          {/* ── セクション2: 勤務形態・常勤換算 ── */}
          <div className="p-4 bg-gray-50 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">勤務形態・常勤換算</h4>

            <div className="flex gap-2">
              {[
                { value: 'fulltime_dedicated', label: '常勤専従', desc: '所定時間フル勤務・専任' },
                { value: 'fulltime_concurrent', label: '常勤兼務', desc: '所定時間フル勤務・兼務あり' },
                { value: 'parttime', label: '非常勤', desc: '所定時間未満' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPForm(p => ({ ...p, workStyle: opt.value }))}
                  className={`flex-1 px-2 py-2 rounded-lg border-2 text-xs font-medium transition-colors ${
                    pForm.workStyle === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                  title={opt.desc}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {contractWeeklyHours !== null ? (
              <div className="p-3 bg-white rounded-lg border border-gray-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">週契約時間（労働条件通知書より）</span>
                  <span className="text-sm font-bold text-gray-800">{contractWeeklyHours}h</span>
                </div>
                <button
                  onClick={() => setShowLaborPanel(true)}
                  className="text-xs text-primary hover:text-primary-dark"
                >
                  労働条件通知書を確認 →
                </button>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-700 mb-1">労働条件通知書が未作成のため、手動入力で算出します</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">週</span>
                  <input
                    type="number"
                    value={pForm.contractedWeeklyHours}
                    onChange={e => setPForm(p => ({ ...p, contractedWeeklyHours: Number(e.target.value) }))}
                    className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-primary focus:border-transparent"
                    min={0} max={60} step={0.5}
                  />
                  <span className="text-xs text-gray-500">時間</span>
                </div>
                <button
                  onClick={() => setShowLaborPanel(true)}
                  className="mt-1.5 text-xs text-primary hover:text-primary-dark"
                >
                  + 労働条件通知書を作成する
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200">
              <span className="text-xs text-gray-400">常勤換算</span>
              <span className={`text-sm font-bold ${fte >= 1 ? 'text-primary' : fte >= 0.5 ? 'text-amber-600' : 'text-gray-600'}`}>
                FTE {fte.toFixed(2)}
              </span>
              <span className="text-[10px] text-gray-400 ml-auto">÷ {facilityStandardHours}h</span>
            </div>
            <p className="text-[10px] text-gray-400">
              FTE = 週契約時間 ÷ 施設の所定労働時間（{facilityStandardHours}h）。
              {facilityStandardHours !== 40 ? '' : '施設設定で変更可。'}常勤換算1.0以上で加算要件充足
            </p>
          </div>

          {/* ── セクション3: 経験年数 ── */}
          <div className="p-4 bg-gray-50 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">実務経験</h4>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">児童福祉事業での経験</span>
              <input
                type="number"
                value={pForm.yearsOfExperience}
                onChange={e => setPForm(p => ({ ...p, yearsOfExperience: Number(e.target.value) }))}
                className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-primary focus:border-transparent"
                min={0} max={50}
              />
              <span className="text-xs text-gray-500">年</span>
              {has5YearsExp && (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">5年以上</span>
              )}
            </div>
            {/* 実務経験証明書 verification */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
              hasExpCertificate
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {hasExpCertificate ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              <span className="font-medium">
                実務経験証明書: {hasExpCertificate ? '提出済み' : '未提出'}
              </span>
              {!hasExpCertificate && (
                <button
                  onClick={() => setActiveTab('documents')}
                  className="ml-auto text-amber-600 hover:text-amber-800 underline"
                >
                  書類タブで登録
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-400">
              5年以上で児童指導員等加配加算（経験者区分）・専門的支援体制加算の対象。
              加算申請には実務経験証明書の提出が必要です。
            </p>
          </div>

          {/* ── セクション4: 人員区分・加算配置 ── */}
          <div className="p-4 bg-gray-50 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">人員区分</h4>
            <div className="flex gap-2">
              {[
                { value: 'standard', label: '基準人員', desc: '配置基準に算入される人員' },
                { value: 'addition', label: '加算人員', desc: '基準人員に加え配置する加算対象人員' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPForm(p => ({
                    ...p,
                    personnelType: opt.value,
                    additionCodes: opt.value === 'standard' ? [] : p.additionCodes,
                  }))}
                  className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                    pForm.personnelType === opt.value
                      ? opt.value === 'standard'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-orange-400 bg-orange-50 text-orange-700'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                  title={opt.desc}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* 加算人員の場合 → 加算種別選択 */}
            {pForm.personnelType === 'addition' && (
              <div className="space-y-2 mt-2">
                <p className="text-xs text-gray-500 font-medium">この人員が算定対象となる加算を選択:</p>
                {ADDITION_OPTIONS.map(opt => {
                  const checked = pForm.additionCodes.includes(opt.code);
                  return (
                    <label
                      key={opt.code}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        checked ? 'border-orange-300 bg-orange-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          setPForm(p => ({
                            ...p,
                            additionCodes: e.target.checked
                              ? [...p.additionCodes, opt.code]
                              : p.additionCodes.filter(c => c !== opt.code),
                          }));
                        }}
                        className="w-4 h-4 mt-0.5 rounded text-orange-600 focus:ring-orange-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                        <p className="text-xs text-gray-400">{opt.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* アクションボタン */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => { setPersonnelEditing(false); setPersonnelMessage(null); }}
              className="flex-1 px-4 py-2.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSavePersonnel}
              disabled={personnelSaving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
            >
              {personnelSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {personnelSaving ? '保存中...' : '保存する'}
            </button>
          </div>
        </div>
      );
    }

    // ── 閲覧モード ──
    const expYears = staff.yearsOfExperience || 0;
    const currentAdditions = staff.personnelSettings?.assignedAdditionCodes || [];

    return (
      <div className="space-y-5">
        {personnelMessage && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
            personnelMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {personnelMessage.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            {personnelMessage.text}
          </div>
        )}

        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-500">人員配置設定</h4>
          <button onClick={startPersonnelEdit} className="text-sm text-primary hover:text-primary-dark font-medium">
            編集
          </button>
        </div>

        {/* ポジション */}
        <section className="p-4 bg-gray-50 rounded-xl space-y-2">
          <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider">ポジション</h5>
          <div className="flex flex-wrap gap-2">
            {staff.personnelSettings?.isServiceManager && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium">
                <CheckCircle size={14} />
                児童発達支援管理責任者
              </span>
            )}
            {staff.personnelSettings?.isManager && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
                <CheckCircle size={14} />
                管理者
                {staff.personnelSettings?.managerConcurrentRole && (
                  <span className="text-xs text-blue-500">（{staff.personnelSettings.managerConcurrentRole}）</span>
                )}
              </span>
            )}
            {!staff.personnelSettings?.isServiceManager && !staff.personnelSettings?.isManager && (
              <button onClick={startPersonnelEdit} className="text-sm text-gray-400 hover:text-primary">
                ポジション未設定 — 設定する →
              </button>
            )}
          </div>
        </section>

        {/* 勤務形態・常勤換算 */}
        <section className="p-4 bg-gray-50 rounded-xl space-y-2">
          <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider">勤務形態・常勤換算</h5>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 bg-white rounded-lg text-center">
              <p className="text-xs text-gray-400">勤務形態</p>
              <p className="text-sm font-bold text-gray-800">{getWorkStyleLabel()}</p>
            </div>
            <div className="p-2 bg-white rounded-lg text-center">
              <p className="text-xs text-gray-400">週時間</p>
              <p className="text-sm font-bold text-gray-800">
                {contractWeeklyHours ? `${contractWeeklyHours}h` : staff.personnelSettings?.contractedWeeklyHours ? `${staff.personnelSettings.contractedWeeklyHours}h` : '—'}
              </p>
              {contractWeeklyHours !== null && (
                <p className="text-[9px] text-primary">契約書連動</p>
              )}
            </div>
            <div className="p-2 bg-white rounded-lg text-center">
              <p className="text-xs text-gray-400">FTE</p>
              <p className={`text-sm font-bold ${getFte() && Number(getFte()) >= 1 ? 'text-primary' : 'text-amber-600'}`}>
                {getFte() || '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-400">FTE = 週契約時間 ÷ {facilityStandardHours}h（施設所定労働時間）</p>
            {activeContractId ? (
              <button onClick={() => setShowLaborPanel(true)} className="text-[10px] text-primary hover:text-primary-dark">
                通知書を確認 →
              </button>
            ) : (
              <button onClick={() => setShowLaborPanel(true)} className="text-[10px] text-amber-600 hover:text-amber-700">
                通知書を作成 →
              </button>
            )}
          </div>
        </section>

        {/* 経験・人員区分 */}
        <section className="p-4 bg-gray-50 rounded-xl space-y-2">
          <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider">経験・人員区分</h5>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-white rounded-lg">
              <p className="text-xs text-gray-400">実務経験</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-800">{expYears > 0 ? `${expYears}年` : '未設定'}</p>
                {expYears >= 5 && (
                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold">5年以上</span>
                )}
              </div>
            </div>
            <div className="p-2 bg-white rounded-lg">
              <p className="text-xs text-gray-400">人員区分</p>
              <p className={`text-sm font-bold ${
                staff.personnelSettings?.personnelType === 'addition' ? 'text-orange-700' : 'text-primary'
              }`}>
                {getPersonnelTypeLabel()}
              </p>
            </div>
          </div>
          {/* 実務経験証明書 verification */}
          {expYears > 0 && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
              hasExpCertificate
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            }`}>
              {hasExpCertificate ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
              <span>実務経験証明書: {hasExpCertificate ? '提出済み' : '未提出'}</span>
              {!hasExpCertificate && (
                <button onClick={() => setActiveTab('documents')} className="ml-auto underline text-amber-600 hover:text-amber-800">
                  登録
                </button>
              )}
            </div>
          )}
        </section>

        {/* 加算配置 */}
        {currentAdditions.length > 0 && (
          <section className="p-4 bg-orange-50/50 border border-orange-200 rounded-xl space-y-2">
            <h5 className="text-xs font-bold text-orange-600 uppercase tracking-wider">算定対象の加算</h5>
            <div className="space-y-1.5">
              {currentAdditions.map((code: string, idx: number) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded-lg">
                  <CheckCircle size={14} className="text-orange-500 flex-shrink-0" />
                  <span className="text-sm text-gray-800">{getAdditionLabel(code)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  };

  // === 有給タブ ===
  const renderLeaveTab = () => {
    const leave = staff.leaveSettings;
    return (
      <div className="space-y-6">
        {/* 休暇設定リンク */}
        <div className="flex justify-end">
          <span
            onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'leave-approval' }))}
            className="text-xs text-primary hover:underline cursor-pointer"
          >
            休暇設定 &rarr;
          </span>
        </div>
        <section>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-500">有給休暇</h4>
            {onEditLeave && (
              <button onClick={() => onEditLeave(staff)} className="text-sm text-primary">
                編集
              </button>
            )}
          </div>
          {leave?.paidLeaveEnabled ? (
            <div className="space-y-3">
              <div className="p-4 bg-primary/5 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-primary font-medium">有給残日数</span>
                  <span className="text-2xl font-bold text-primary">{leave.paidLeaveDays}日</span>
                </div>
              </div>
              {leave.substituteLeaveEnabled && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">振替休日残</span>
                    <span className="text-xl font-bold text-gray-700">{leave.substituteLeaveDays}日</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <Calendar size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-gray-500 text-sm">有給休暇管理が無効です</p>
              {onEditLeave && (
                <button onClick={() => onEditLeave(staff)} className="mt-2 text-sm text-primary">
                  有効にする
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    );
  };

  // === 設定タブ ===
  const handleSavePermissions = async () => {
    const userId = staff.user_id;
    if (!userId) {
      toast.warning('このスタッフはアカウント未連携のため、権限設定はアカウント連携後に有効になります');
      return;
    }
    setPermissionsSaving(true);
    try {
      // Update user permissions
      const { error: userErr } = await supabase
        .from('users')
        .update({ permissions: editPermissions })
        .eq('id', userId);
      if (userErr) throw userErr;

      // Also update employment_records permissions
      if (facility?.id) {
        const { error: empErr } = await supabase
          .from('employment_records')
          .update({ permissions: editPermissions })
          .eq('user_id', userId)
          .eq('facility_id', facility.id);
        if (empErr) console.warn('employment_records update warning:', empErr);
      }

      toast.success('権限設定を保存しました');
      setPermissionsEditing(false);
      onRefresh?.();
    } catch (err: any) {
      toast.error('権限設定の保存に失敗しました: ' + (err.message || ''));
    } finally {
      setPermissionsSaving(false);
    }
  };

  const isRoleAdmin = staff.role === '管理者' || staff.role === 'マネージャー';

  const renderSettingsTab = () => (
    <div className="space-y-6">
      {/* Account Info */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-500">アカウント情報</h4>
          <button
            onClick={() => onEdit(staff)}
            className="text-sm text-primary hover:text-primary-dark font-medium"
          >
            編集
          </button>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
            <span className="text-gray-600">雇用形態</span>
            <span className="font-medium text-gray-800">{staff.type || '未設定'}</span>
          </div>
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
            <span className="text-gray-600">役割</span>
            <span className="font-medium text-gray-800">{staff.role || '未設定'}</span>
          </div>
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
            <span className="text-gray-600">アカウント状態</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              isLinked ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {isLinked ? '連携済み' : '未連携'}
            </span>
          </div>
        </div>
      </section>

      {/* Permission Editor */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-500">アクセス権限設定</h4>
          {!permissionsEditing ? (
            <button
              onClick={() => setPermissionsEditing(true)}
              className="text-sm text-primary hover:text-primary-dark font-medium"
            >
              編集
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditPermissions(staff.permissions || {});
                  setPermissionsEditing(false);
                }}
                className="text-xs px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSavePermissions}
                disabled={permissionsSaving}
                className="text-xs px-3 py-1 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
              >
                {permissionsSaving ? '保存中...' : '保存'}
              </button>
            </div>
          )}
        </div>

        {isRoleAdmin && !permissionsEditing && (
          <div className="p-3 bg-primary-light border border-primary/10 rounded-lg mb-3">
            <p className="text-xs text-gray-600">
              <span className="font-medium text-primary">{staff.role}</span> は全機能にアクセス可能です。個別の権限設定は一般スタッフに適用されます。
            </p>
          </div>
        )}

        <PermissionEditor
          permissions={permissionsEditing ? editPermissions : (staff.permissions || {})}
          onChange={setEditPermissions}
          readOnly={!permissionsEditing}
          role={staff.role}
        />
      </section>
    </div>
  );

  // タブコンテンツ
  const renderTabContent = () => {
    switch (activeTab) {
      case 'info': return renderInfoTab();
      case 'documents': return renderDocumentsTab();
      case 'attendance': return renderAttendanceTab();
      case 'personnel': return renderPersonnelTab();
      case 'leave': return renderLeaveTab();
      case 'settings': return renderSettingsTab();
      default: return null;
    }
  };

  return (
    <>
      {/* オーバーレイ */}
      <div className="fixed inset-0 bg-black/30 z-40 transition-opacity" onClick={onClose} />

      {/* ドロワー */}
      <div className="fixed right-0 top-0 h-full w-full md:w-[480px] bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(staff)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-primary hover:bg-primary/5 rounded-lg transition-colors text-sm font-medium"
              >
                <Edit2 size={16} />
                編集
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
              >
                <Trash2 size={16} />
                削除
              </button>
            </div>
          </div>
        </div>

        {/* プロフィールヘッダー */}
        <div className="flex-shrink-0 px-6 py-6 bg-gradient-to-br from-primary/5 to-white">
          <div className="flex items-center gap-4">
            {staff.profilePhotoUrl ? (
              <img
                src={staff.profilePhotoUrl}
                alt={staff.name}
                className="w-20 h-20 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-3xl">
                  {staff.name?.charAt(0) || '?'}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-gray-800 truncate">{staff.name}</h2>
              {staff.nameKana && <p className="text-gray-500 text-sm">{staff.nameKana}</p>}
              <div className="flex flex-wrap gap-2 mt-2">
                {staff.role === '管理者' && (
                  <button onClick={() => setActiveTab('settings')} className="px-2 py-0.5 bg-blue-900 text-white rounded-full text-xs font-medium hover:opacity-80 transition-opacity">管理者</button>
                )}
                {staff.role === 'マネージャー' && (
                  <button onClick={() => setActiveTab('settings')} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium hover:opacity-80 transition-opacity">マネージャー</button>
                )}
                {staff.personnelSettings?.isServiceManager && (
                  <button onClick={() => setActiveTab('personnel')} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium hover:opacity-80 transition-opacity">児発管</button>
                )}
                {!staff.personnelSettings?.isServiceManager && !staff.personnelSettings?.isManager && (
                  <button
                    onClick={() => { setActiveTab('personnel'); startPersonnelEdit(); }}
                    className="px-2 py-0.5 bg-purple-50 text-purple-400 border border-dashed border-purple-300 rounded-full text-xs font-medium hover:bg-purple-100 hover:text-purple-600 transition-colors"
                  >
                    + 役割を設定
                  </button>
                )}
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  staff.type === '常勤' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {staff.type || '未設定'}
                </span>
                {isLinked && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    連携済
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* タブ */}
        <div className="flex-shrink-0 px-6 border-b border-gray-200 overflow-x-auto">
          <div className="flex gap-4 whitespace-nowrap">
            {([
              { id: 'info' as TabId, label: '基本情報' },
              { id: 'personnel' as TabId, label: '人員配置' },
              { id: 'attendance' as TabId, label: '勤怠' },
              { id: 'leave' as TabId, label: '休暇' },
              { id: 'documents' as TabId, label: '書類' },
              { id: 'settings' as TabId, label: '設定' },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {/* 配布書類の未読バッジ（配布書類のみ） */}
                {tab.id === 'documents' && unreadDistributedCount > 0 && (
                  <span className="absolute -top-0.5 -right-2 min-w-[16px] h-4 flex items-center justify-center bg-amber-500 text-white text-[10px] font-bold rounded-full px-1">
                    {unreadDistributedCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto px-6 py-6">{renderTabContent()}</div>

        {/* フッター */}
        <div className="flex-shrink-0 px-6 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
          <div className="flex items-center justify-between">
            <span>登録: {staff.createdAt ? new Date(staff.createdAt).toLocaleDateString('ja-JP') : '-'}</span>
            <span>ID: {staff.id}</span>
          </div>
        </div>
      </div>

      {/* 労働条件通知書パネル */}
      {showLaborPanel && staff && facility && (
        <LaborConditionsPanel
          staff={{ id: staff.id, name: staff.name, user_id: staff.user_id }}
          facilityId={facility.id}
          facilityName={facility.name || ''}
          isOpen={showLaborPanel}
          onClose={() => setShowLaborPanel(false)}
          onContractSaved={(hours) => {
            setContractWeeklyHours(hours);
            // パネルは閉じない（LaborConditionsPanel内部でリスト表示に戻る）
          }}
        />
      )}

      {/* 削除確認モーダル */}
      {showDeleteConfirm && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[9999]" onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl p-6 z-[9999] w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={24} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">スタッフを削除</h3>
                <p className="text-sm text-gray-500">{staff.name}</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">このスタッフを削除してもよろしいですか？この操作は取り消せません。</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={() => { onDelete(staff); setShowDeleteConfirm(false); }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                削除する
              </button>
            </div>
          </div>
        </>
      )}

      {/* 書類プレビューモーダル */}
      {previewDoc && (
        <DocumentPreviewModal
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          filePath={previewDoc.file_url}
          fileName={previewDoc.file_name || previewDoc.title}
          mimeType={previewDoc.file_type}
          title={previewDoc.title}
          bucket="documents"
          onViewed={() => {
            if (previewDoc && !previewDoc.is_read) {
              supabase.from('staff_documents')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', previewDoc.id)
                .then(() => fetchDocuments());
            }
          }}
        />
      )}

      <style jsx>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default StaffDetailDrawer;
