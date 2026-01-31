/**
 * 人員配置コンプライアンス管理フック
 * Staffing Compliance Management Hook
 */

import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  StaffPersonnelSettings,
  DailyStaffingCompliance,
  AdditionStaffRequirement,
  WorkScheduleReport,
  Staff,
  ShiftWithPattern,
  FacilityStaffingSettings,
  PersonnelType,
  WorkStyle,
} from '@/types';
import {
  calculateDailyCompliance,
  calculateMonthlyCompliance,
  calculateMonthlySummary,
} from '@/utils/staffingComplianceCalculator';

// ============================================
// 型定義
// ============================================

type UseStaffingComplianceReturn = {
  // データ
  personnelSettings: StaffPersonnelSettings[];
  additionRequirements: AdditionStaffRequirement[];
  facilityStaffingSettings: FacilityStaffingSettings | null;
  dailyCompliance: Map<string, DailyStaffingCompliance>;
  workScheduleReports: WorkScheduleReport[];

  // ローディング・エラー状態
  loading: boolean;
  error: string | null;

  // アクション
  fetchPersonnelSettings: () => Promise<void>;
  fetchAdditionRequirements: () => Promise<void>;
  fetchFacilityStaffingSettings: () => Promise<void>;
  savePersonnelSettings: (settings: Partial<StaffPersonnelSettings>) => Promise<void>;
  updatePersonnelSettings: (id: string, updates: Partial<StaffPersonnelSettings>) => Promise<void>;
  deletePersonnelSettings: (id: string) => Promise<void>;
  saveFacilityStaffingSettings: (settings: Partial<FacilityStaffingSettings>) => Promise<void>;

  // コンプライアンス計算
  calculateComplianceForDate: (
    date: string,
    shifts: ShiftWithPattern[],
    staffList: Staff[]
  ) => DailyStaffingCompliance | null;
  calculateComplianceForMonth: (
    year: number,
    month: number,
    shifts: ShiftWithPattern[],
    staffList: Staff[]
  ) => Map<string, DailyStaffingCompliance>;
  getMonthlySummary: () => ReturnType<typeof calculateMonthlySummary> | null;

  // 勤務体制一覧表
  fetchWorkScheduleReports: (year: number, month: number) => Promise<void>;
  generateWorkScheduleReport: (year: number, month: number) => Promise<WorkScheduleReport | null>;
  saveWorkScheduleReport: (report: Partial<WorkScheduleReport>) => Promise<void>;
};

// ============================================
// フック実装
// ============================================

export function useStaffingCompliance(): UseStaffingComplianceReturn {
  const { facility } = useAuth();
  const facilityId = facility?.id;

  // 状態
  const [personnelSettings, setPersonnelSettings] = useState<StaffPersonnelSettings[]>([]);
  const [additionRequirements, setAdditionRequirements] = useState<AdditionStaffRequirement[]>([]);
  const [facilityStaffingSettings, setFacilityStaffingSettings] = useState<FacilityStaffingSettings | null>(null);
  const [dailyCompliance, setDailyCompliance] = useState<Map<string, DailyStaffingCompliance>>(new Map());
  const [workScheduleReports, setWorkScheduleReports] = useState<WorkScheduleReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================
  // データ取得
  // ============================================

  /**
   * スタッフ人員設定を取得
   */
  const fetchPersonnelSettings = useCallback(async () => {
    if (!facilityId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('staff_personnel_settings')
        .select(`
          *,
          staff:staff_id (
            id,
            name,
            qualifications,
            years_of_experience
          )
        `)
        .eq('facility_id', facilityId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const mapped: StaffPersonnelSettings[] = (data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        facilityId: row.facility_id as string,
        staffId: row.staff_id as string,
        personnelType: row.personnel_type as PersonnelType,
        workStyle: row.work_style as WorkStyle,
        isManager: row.is_manager as boolean,
        isServiceManager: row.is_service_manager as boolean,
        managerConcurrentRole: row.manager_concurrent_role as string | undefined,
        contractedWeeklyHours: row.contracted_weekly_hours as number | undefined,
        assignedAdditionCodes: row.assigned_addition_codes as string[] | undefined,
        effectiveFrom: row.effective_from as string,
        effectiveTo: row.effective_to as string | undefined,
        notes: row.notes as string | undefined,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        staffName: (row.staff as Record<string, unknown>)?.name as string,
        qualifications: ((row.staff as Record<string, unknown>)?.qualifications as string)?.split(',').map((q: string) => q.trim()),
        yearsOfExperience: (row.staff as Record<string, unknown>)?.years_of_experience as number,
      }));

      setPersonnelSettings(mapped);
    } catch (err) {
      console.error('Error fetching personnel settings:', err);
      setError('人員設定の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  /**
   * 加算スタッフ要件を取得
   */
  const fetchAdditionRequirements = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('addition_staff_requirements')
        .select('*')
        .order('addition_code');

      if (fetchError) throw fetchError;

      const mapped: AdditionStaffRequirement[] = (data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        additionCode: row.addition_code as string,
        requiredQualifications: row.required_qualifications as string[] | undefined,
        anyQualification: row.any_qualification as boolean,
        minYearsExperience: row.min_years_experience as number | undefined,
        requiredWorkStyle: row.required_work_style as WorkStyle | undefined,
        minFte: row.min_fte as number | undefined,
        minStaffCount: row.min_staff_count as number,
        additionalConditions: row.additional_conditions as Record<string, unknown> | undefined,
        description: row.description as string | undefined,
      }));

      setAdditionRequirements(mapped);
    } catch (err) {
      console.error('Error fetching addition requirements:', err);
      setError('加算要件の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 施設の人員関連設定を取得
   */
  const fetchFacilityStaffingSettings = useCallback(async () => {
    if (!facilityId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('facility_settings')
        .select('standard_weekly_hours, manager_staff_id, service_manager_staff_id')
        .eq('facility_id', facilityId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      if (data) {
        setFacilityStaffingSettings({
          standardWeeklyHours: data.standard_weekly_hours || 40.0,
          managerStaffId: data.manager_staff_id || undefined,
          serviceManagerStaffId: data.service_manager_staff_id || undefined,
        });
      } else {
        // デフォルト値
        setFacilityStaffingSettings({
          standardWeeklyHours: 40.0,
        });
      }
    } catch (err) {
      console.error('Error fetching facility staffing settings:', err);
      setError('施設設定の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  // ============================================
  // データ保存
  // ============================================

  /**
   * スタッフ人員設定を保存（新規）
   */
  const savePersonnelSettings = useCallback(async (settings: Partial<StaffPersonnelSettings>) => {
    if (!facilityId) return;

    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('staff_personnel_settings')
        .upsert({
          facility_id: facilityId,
          staff_id: settings.staffId,
          personnel_type: settings.personnelType || 'standard',
          work_style: settings.workStyle || 'parttime',
          is_manager: settings.isManager || false,
          is_service_manager: settings.isServiceManager || false,
          manager_concurrent_role: settings.managerConcurrentRole,
          contracted_weekly_hours: settings.contractedWeeklyHours,
          assigned_addition_codes: settings.assignedAdditionCodes,
          effective_from: settings.effectiveFrom || new Date().toISOString().split('T')[0],
          effective_to: settings.effectiveTo,
          notes: settings.notes,
        }, {
          onConflict: 'facility_id,staff_id',
        });

      if (insertError) throw insertError;

      // リフレッシュ
      await fetchPersonnelSettings();
    } catch (err) {
      console.error('Error saving personnel settings:', err);
      setError('人員設定の保存に失敗しました');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [facilityId, fetchPersonnelSettings]);

  /**
   * スタッフ人員設定を更新
   */
  const updatePersonnelSettings = useCallback(async (id: string, updates: Partial<StaffPersonnelSettings>) => {
    setLoading(true);
    setError(null);

    try {
      const updateData: Record<string, unknown> = {};

      if (updates.personnelType !== undefined) updateData.personnel_type = updates.personnelType;
      if (updates.workStyle !== undefined) updateData.work_style = updates.workStyle;
      if (updates.isManager !== undefined) updateData.is_manager = updates.isManager;
      if (updates.isServiceManager !== undefined) updateData.is_service_manager = updates.isServiceManager;
      if (updates.managerConcurrentRole !== undefined) updateData.manager_concurrent_role = updates.managerConcurrentRole;
      if (updates.contractedWeeklyHours !== undefined) updateData.contracted_weekly_hours = updates.contractedWeeklyHours;
      if (updates.assignedAdditionCodes !== undefined) updateData.assigned_addition_codes = updates.assignedAdditionCodes;
      if (updates.effectiveFrom !== undefined) updateData.effective_from = updates.effectiveFrom;
      if (updates.effectiveTo !== undefined) updateData.effective_to = updates.effectiveTo;
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      const { error: updateError } = await supabase
        .from('staff_personnel_settings')
        .update(updateData)
        .eq('id', id);

      if (updateError) throw updateError;

      // リフレッシュ
      await fetchPersonnelSettings();
    } catch (err) {
      console.error('Error updating personnel settings:', err);
      setError('人員設定の更新に失敗しました');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchPersonnelSettings]);

  /**
   * スタッフ人員設定を削除
   */
  const deletePersonnelSettings = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('staff_personnel_settings')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // リフレッシュ
      await fetchPersonnelSettings();
    } catch (err) {
      console.error('Error deleting personnel settings:', err);
      setError('人員設定の削除に失敗しました');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchPersonnelSettings]);

  /**
   * 施設の人員関連設定を保存
   */
  const saveFacilityStaffingSettings = useCallback(async (settings: Partial<FacilityStaffingSettings>) => {
    if (!facilityId) return;

    setLoading(true);
    setError(null);

    try {
      const updateData: Record<string, unknown> = {};

      if (settings.standardWeeklyHours !== undefined) {
        updateData.standard_weekly_hours = settings.standardWeeklyHours;
      }
      if (settings.managerStaffId !== undefined) {
        updateData.manager_staff_id = settings.managerStaffId;
      }
      if (settings.serviceManagerStaffId !== undefined) {
        updateData.service_manager_staff_id = settings.serviceManagerStaffId;
      }

      const { error: updateError } = await supabase
        .from('facility_settings')
        .update(updateData)
        .eq('facility_id', facilityId);

      if (updateError) throw updateError;

      // リフレッシュ
      await fetchFacilityStaffingSettings();
    } catch (err) {
      console.error('Error saving facility staffing settings:', err);
      setError('施設設定の保存に失敗しました');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [facilityId, fetchFacilityStaffingSettings]);

  // ============================================
  // コンプライアンス計算
  // ============================================

  /**
   * 特定日のコンプライアンスを計算
   */
  const calculateComplianceForDate = useCallback((
    date: string,
    shifts: ShiftWithPattern[],
    staffList: Staff[]
  ): DailyStaffingCompliance | null => {
    if (!facilityStaffingSettings) return null;

    const dayShifts = shifts.filter((s) => s.date === date);

    return calculateDailyCompliance(
      date,
      dayShifts,
      personnelSettings,
      staffList,
      facilityStaffingSettings,
      additionRequirements
    );
  }, [personnelSettings, facilityStaffingSettings, additionRequirements]);

  /**
   * 月間のコンプライアンスを計算
   */
  const calculateComplianceForMonth = useCallback((
    year: number,
    month: number,
    shifts: ShiftWithPattern[],
    staffList: Staff[]
  ): Map<string, DailyStaffingCompliance> => {
    if (!facilityStaffingSettings) return new Map();

    const results = calculateMonthlyCompliance(
      year,
      month,
      shifts,
      personnelSettings,
      staffList,
      facilityStaffingSettings,
      additionRequirements
    );

    setDailyCompliance(results);
    return results;
  }, [personnelSettings, facilityStaffingSettings, additionRequirements]);

  /**
   * 月次サマリーを取得
   */
  const getMonthlySummary = useCallback(() => {
    if (dailyCompliance.size === 0) return null;
    return calculateMonthlySummary(dailyCompliance);
  }, [dailyCompliance]);

  // ============================================
  // 勤務体制一覧表
  // ============================================

  /**
   * 勤務体制一覧表を取得
   */
  const fetchWorkScheduleReports = useCallback(async (year: number, month: number) => {
    if (!facilityId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('work_schedule_reports')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('year', year)
        .eq('month', month)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const mapped: WorkScheduleReport[] = (data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        facilityId: row.facility_id as string,
        year: row.year as number,
        month: row.month as number,
        staffAssignments: row.staff_assignments as WorkScheduleReport['staffAssignments'],
        totalStandardStaff: row.total_standard_staff as number,
        totalAdditionStaff: row.total_addition_staff as number,
        fteTotal: row.fte_total as number,
        status: row.status as WorkScheduleReport['status'],
        generatedAt: row.generated_at as string | undefined,
        submittedAt: row.submitted_at as string | undefined,
        submittedTo: row.submitted_to as string | undefined,
        approvedAt: row.approved_at as string | undefined,
        notes: row.notes as string | undefined,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      }));

      setWorkScheduleReports(mapped);
    } catch (err) {
      console.error('Error fetching work schedule reports:', err);
      setError('勤務体制一覧表の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  /**
   * 勤務体制一覧表を生成
   */
  const generateWorkScheduleReport = useCallback(async (
    year: number,
    month: number
  ): Promise<WorkScheduleReport | null> => {
    if (!facilityId || !facilityStaffingSettings) return null;

    // スタッフ配置データを構築
    const staffAssignments: WorkScheduleReport['staffAssignments'] = personnelSettings.map((p) => ({
      staffId: p.staffId,
      name: p.staffName || '',
      personnelType: p.personnelType,
      workStyle: p.workStyle,
      qualifications: p.qualifications || [],
      yearsOfExperience: p.yearsOfExperience,
      weeklyHours: p.contractedWeeklyHours || 0,
      fte: p.contractedWeeklyHours
        ? p.contractedWeeklyHours / facilityStaffingSettings.standardWeeklyHours
        : 0,
      assignedAdditions: p.assignedAdditionCodes || [],
      role: p.isServiceManager ? '児発管' : p.isManager ? '管理者' : undefined,
    }));

    const totalStandardStaff = staffAssignments.filter((s) => s.personnelType === 'standard').length;
    const totalAdditionStaff = staffAssignments.filter((s) => s.personnelType === 'addition').length;
    const fteTotal = staffAssignments.reduce((sum, s) => sum + s.fte, 0);

    const report: WorkScheduleReport = {
      id: '',
      facilityId,
      year,
      month,
      staffAssignments,
      totalStandardStaff,
      totalAdditionStaff,
      fteTotal: Math.round(fteTotal * 100) / 100,
      status: 'draft',
      generatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return report;
  }, [facilityId, facilityStaffingSettings, personnelSettings]);

  /**
   * 勤務体制一覧表を保存
   */
  const saveWorkScheduleReport = useCallback(async (report: Partial<WorkScheduleReport>) => {
    if (!facilityId) return;

    setLoading(true);
    setError(null);

    try {
      const { error: upsertError } = await supabase
        .from('work_schedule_reports')
        .upsert({
          facility_id: facilityId,
          year: report.year,
          month: report.month,
          staff_assignments: report.staffAssignments,
          total_standard_staff: report.totalStandardStaff,
          total_addition_staff: report.totalAdditionStaff,
          fte_total: report.fteTotal,
          status: report.status || 'draft',
          generated_at: report.generatedAt,
          submitted_at: report.submittedAt,
          submitted_to: report.submittedTo,
          approved_at: report.approvedAt,
          notes: report.notes,
        }, {
          onConflict: 'facility_id,year,month',
        });

      if (upsertError) throw upsertError;

      // リフレッシュ
      if (report.year && report.month) {
        await fetchWorkScheduleReports(report.year, report.month);
      }
    } catch (err) {
      console.error('Error saving work schedule report:', err);
      setError('勤務体制一覧表の保存に失敗しました');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [facilityId, fetchWorkScheduleReports]);

  // ============================================
  // 返却
  // ============================================

  return {
    personnelSettings,
    additionRequirements,
    facilityStaffingSettings,
    dailyCompliance,
    workScheduleReports,
    loading,
    error,
    fetchPersonnelSettings,
    fetchAdditionRequirements,
    fetchFacilityStaffingSettings,
    savePersonnelSettings,
    updatePersonnelSettings,
    deletePersonnelSettings,
    saveFacilityStaffingSettings,
    calculateComplianceForDate,
    calculateComplianceForMonth,
    getMonthlySummary,
    fetchWorkScheduleReports,
    generateWorkScheduleReport,
    saveWorkScheduleReport,
  };
}

export default useStaffingCompliance;
