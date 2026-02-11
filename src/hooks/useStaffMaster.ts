/**
 * スタッフマスタ管理フック
 * スタッフのCRUD操作と関連データの取得
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Staff, StaffPersonnelSettings, StaffLeaveSettings } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

interface StaffWithRelations extends Staff {
  personnelSettings?: StaffPersonnelSettings;
  leaveSettings?: StaffLeaveSettings;
}

interface UseStaffMasterReturn {
  staffList: StaffWithRelations[];
  selectedStaff: StaffWithRelations | null;
  loading: boolean;
  error: string | null;

  // CRUD操作
  fetchStaffList: () => Promise<void>;
  fetchStaffById: (staffId: string) => Promise<StaffWithRelations | null>;
  createStaff: (data: Partial<Staff>) => Promise<string | null>;
  updateStaff: (staffId: string, data: Partial<Staff>) => Promise<boolean>;
  deleteStaff: (staffId: string) => Promise<boolean>;

  // 人員配置設定
  updatePersonnelSettings: (
    staffId: string,
    settings: Partial<StaffPersonnelSettings>
  ) => Promise<boolean>;

  // 有給設定
  updateLeaveSettings: (
    staffId: string,
    settings: Partial<StaffLeaveSettings>
  ) => Promise<boolean>;

  // 選択
  setSelectedStaff: (staff: StaffWithRelations | null) => void;

  // 招待
  inviteStaff: (email: string, name: string) => Promise<{ token: string } | null>;
}

export function useStaffMaster(): UseStaffMasterReturn {
  const { facility } = useAuth();
  const [staffList, setStaffList] = useState<StaffWithRelations[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffWithRelations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // スタッフ一覧を取得
  const fetchStaffList = useCallback(async () => {
    if (!facility?.id) return;

    setLoading(true);
    setError(null);

    try {
      // スタッフ基本情報を取得
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('facility_id', facility.id)
        .order('name');

      if (staffError) throw staffError;

      // 人員配置設定を取得
      const { data: personnelData } = await supabase
        .from('staff_personnel_settings')
        .select('*')
        .eq('facility_id', facility.id);

      // 有給設定を取得
      const { data: leaveData } = await supabase
        .from('staff_leave_settings')
        .select('*')
        .eq('facility_id', facility.id);

      // マージ
      const mergedList: StaffWithRelations[] = (staffData || []).map((staff) => {
        const personnel = personnelData?.find((p) => p.staff_id === staff.id);
        const leave = leaveData?.find((l) => l.user_id === staff.user_id);

        return {
          ...mapStaffFromDb(staff),
          personnelSettings: personnel ? mapPersonnelFromDb(personnel) : undefined,
          leaveSettings: leave ? mapLeaveFromDb(leave) : undefined,
        };
      });

      setStaffList(mergedList);
    } catch (err) {
      console.error('Failed to fetch staff list:', err);
      setError('スタッフ一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [facility?.id]);

  // 個別スタッフを取得
  const fetchStaffById = useCallback(
    async (staffId: string): Promise<StaffWithRelations | null> => {
      if (!facility?.id) return null;

      try {
        const { data, error } = await supabase
          .from('staff')
          .select('*')
          .eq('id', staffId)
          .eq('facility_id', facility.id)
          .single();

        if (error) throw error;
        if (!data) return null;

        // 人員配置設定
        const { data: personnel } = await supabase
          .from('staff_personnel_settings')
          .select('*')
          .eq('staff_id', staffId)
          .eq('facility_id', facility.id)
          .single();

        // 有給設定
        const { data: leave } = await supabase
          .from('staff_leave_settings')
          .select('*')
          .eq('user_id', data.user_id)
          .eq('facility_id', facility.id)
          .single();

        return {
          ...mapStaffFromDb(data),
          personnelSettings: personnel ? mapPersonnelFromDb(personnel) : undefined,
          leaveSettings: leave ? mapLeaveFromDb(leave) : undefined,
        };
      } catch (err) {
        console.error('Failed to fetch staff:', err);
        return null;
      }
    },
    [facility?.id]
  );

  // スタッフ作成
  const createStaff = useCallback(
    async (data: Partial<Staff>): Promise<string | null> => {
      if (!facility?.id) return null;

      setLoading(true);
      setError(null);

      try {
        const newId = `staff-${Date.now()}`;

        const { error } = await supabase.from('staff').insert({
          id: newId,
          facility_id: facility.id,
          name: data.name,
          name_kana: data.nameKana,
          type: data.type || 'other',
          role: data.role || 'staff',
          qualifications: data.qualifications || [],
          years_of_experience: data.yearsOfExperience,
          emergency_contact: data.emergencyContact,
          memo: data.memo,
          monthly_salary: data.monthlySalary,
          hourly_wage: data.hourlyWage,
        });

        if (error) throw error;

        await fetchStaffList();
        return newId;
      } catch (err) {
        console.error('Failed to create staff:', err);
        setError('スタッフの作成に失敗しました');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [facility?.id, fetchStaffList]
  );

  // スタッフ更新
  const updateStaff = useCallback(
    async (staffId: string, data: Partial<Staff>): Promise<boolean> => {
      if (!facility?.id) return false;

      setLoading(true);
      setError(null);

      try {
        const updateData: Record<string, unknown> = {};

        if (data.name !== undefined) updateData.name = data.name;
        if (data.nameKana !== undefined) updateData.name_kana = data.nameKana;
        if (data.type !== undefined) updateData.type = data.type;
        if (data.role !== undefined) updateData.role = data.role;
        if (data.qualifications !== undefined) updateData.qualifications = data.qualifications;
        if (data.yearsOfExperience !== undefined) updateData.years_of_experience = data.yearsOfExperience;
        if (data.emergencyContact !== undefined) updateData.emergency_contact = data.emergencyContact;
        if (data.memo !== undefined) updateData.memo = data.memo;
        if (data.monthlySalary !== undefined) updateData.monthly_salary = data.monthlySalary;
        if (data.hourlyWage !== undefined) updateData.hourly_wage = data.hourlyWage;

        const { error } = await supabase
          .from('staff')
          .update(updateData)
          .eq('id', staffId)
          .eq('facility_id', facility.id);

        if (error) throw error;

        await fetchStaffList();
        return true;
      } catch (err) {
        console.error('Failed to update staff:', err);
        setError('スタッフの更新に失敗しました');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [facility?.id, fetchStaffList]
  );

  // スタッフ削除（論理削除）
  const deleteStaff = useCallback(
    async (staffId: string): Promise<boolean> => {
      if (!facility?.id) return false;

      setLoading(true);
      setError(null);

      try {
        // 論理削除 (is_deleted フラグを立てる or 物理削除)
        const { error } = await supabase
          .from('staff')
          .delete()
          .eq('id', staffId)
          .eq('facility_id', facility.id);

        if (error) throw error;

        await fetchStaffList();
        return true;
      } catch (err) {
        console.error('Failed to delete staff:', err);
        setError('スタッフの削除に失敗しました');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [facility?.id, fetchStaffList]
  );

  // 人員配置設定を更新
  const updatePersonnelSettings = useCallback(
    async (staffId: string, settings: Partial<StaffPersonnelSettings>): Promise<boolean> => {
      if (!facility?.id) return false;

      setLoading(true);
      setError(null);

      try {
        const upsertData: Record<string, unknown> = {
          facility_id: facility.id,
          staff_id: staffId,
        };

        if (settings.personnelType !== undefined) upsertData.personnel_type = settings.personnelType;
        if (settings.workStyle !== undefined) upsertData.work_style = settings.workStyle;
        if (settings.isManager !== undefined) upsertData.is_manager = settings.isManager;
        if (settings.isServiceManager !== undefined) upsertData.is_service_manager = settings.isServiceManager;
        if (settings.contractedWeeklyHours !== undefined) upsertData.contracted_weekly_hours = settings.contractedWeeklyHours;
        if (settings.assignedAdditionCodes !== undefined) upsertData.assigned_addition_codes = settings.assignedAdditionCodes;
        if (settings.effectiveFrom !== undefined) upsertData.effective_from = settings.effectiveFrom;
        if (settings.effectiveTo !== undefined) upsertData.effective_to = settings.effectiveTo;
        if (settings.notes !== undefined) upsertData.notes = settings.notes;

        const { error } = await supabase
          .from('staff_personnel_settings')
          .upsert(upsertData, {
            onConflict: 'facility_id,staff_id',
          });

        if (error) throw error;

        await fetchStaffList();
        return true;
      } catch (err) {
        console.error('Failed to update personnel settings:', err);
        setError('人員配置設定の更新に失敗しました');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [facility?.id, fetchStaffList]
  );

  // 有給設定を更新
  const updateLeaveSettings = useCallback(
    async (staffId: string, settings: Partial<StaffLeaveSettings>): Promise<boolean> => {
      if (!facility?.id) return false;

      // スタッフのuser_idを取得
      const staff = staffList.find((s) => s.id === staffId);
      if (!staff?.user_id) return false;

      setLoading(true);
      setError(null);

      try {
        const upsertData: Record<string, unknown> = {
          facility_id: facility.id,
          user_id: staff.user_id,
        };

        if (settings.paidLeaveEnabled !== undefined) upsertData.paid_leave_enabled = settings.paidLeaveEnabled;
        if (settings.paidLeaveDays !== undefined) upsertData.paid_leave_days = settings.paidLeaveDays;
        if (settings.substituteLeaveEnabled !== undefined) upsertData.substitute_leave_enabled = settings.substituteLeaveEnabled;
        if (settings.substituteLeaveDays !== undefined) upsertData.substitute_leave_days = settings.substituteLeaveDays;
        if (settings.notes !== undefined) upsertData.notes = settings.notes;

        const { error } = await supabase
          .from('staff_leave_settings')
          .upsert(upsertData, {
            onConflict: 'facility_id,user_id',
          });

        if (error) throw error;

        await fetchStaffList();
        return true;
      } catch (err) {
        console.error('Failed to update leave settings:', err);
        setError('有給設定の更新に失敗しました');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [facility?.id, staffList, fetchStaffList]
  );

  // スタッフ招待
  const inviteStaff = useCallback(
    async (email: string, name: string): Promise<{ token: string } | null> => {
      if (!facility?.id) return null;

      setLoading(true);
      setError(null);

      try {
        const token = `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const { error } = await supabase.from('staff_invitations').insert({
          facility_id: facility.id,
          email,
          name,
          token,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7日後
        });

        if (error) throw error;

        return { token };
      } catch (err) {
        console.error('Failed to invite staff:', err);
        setError('スタッフの招待に失敗しました');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [facility?.id]
  );

  // 初期読み込み
  useEffect(() => {
    if (facility?.id) {
      fetchStaffList();
    }
  }, [facility?.id, fetchStaffList]);

  return {
    staffList,
    selectedStaff,
    loading,
    error,
    fetchStaffList,
    fetchStaffById,
    createStaff,
    updateStaff,
    deleteStaff,
    updatePersonnelSettings,
    updateLeaveSettings,
    setSelectedStaff,
    inviteStaff,
  };
}

// DBレコードを型にマッピング
function mapStaffFromDb(record: Record<string, unknown>): Staff {
  return {
    id: record.id as string,
    facilityId: record.facility_id as string,
    user_id: record.user_id as string | undefined,
    name: record.name as string,
    nameKana: record.name_kana as string | undefined,
    type: record.type as Staff['type'],
    role: record.role as Staff['role'],
    qualifications: record.qualifications as string | undefined,
    yearsOfExperience: record.years_of_experience as number | undefined,
    emergencyContact: record.emergency_contact as string | undefined,
    memo: record.memo as string | undefined,
    monthlySalary: record.monthly_salary as number | undefined,
    hourlyWage: record.hourly_wage as number | undefined,
    phone: record.phone as string | undefined,
    email: record.email as string | undefined,
    createdAt: record.created_at as string,
    updatedAt: record.updated_at as string,
  };
}

function mapPersonnelFromDb(record: Record<string, unknown>): StaffPersonnelSettings {
  return {
    id: record.id as string,
    facilityId: record.facility_id as string,
    staffId: record.staff_id as string,
    personnelType: record.personnel_type as 'standard' | 'addition',
    workStyle: record.work_style as 'fulltime_dedicated' | 'fulltime_concurrent' | 'parttime',
    isManager: record.is_manager as boolean,
    isServiceManager: record.is_service_manager as boolean,
    managerConcurrentRole: record.manager_concurrent_role as string | undefined,
    contractedWeeklyHours: record.contracted_weekly_hours as number | undefined,
    assignedAdditionCodes: record.assigned_addition_codes as string[] | undefined,
    effectiveFrom: record.effective_from as string,
    effectiveTo: record.effective_to as string | undefined,
    notes: record.notes as string | undefined,
    createdAt: record.created_at as string,
    updatedAt: record.updated_at as string,
  };
}

function mapLeaveFromDb(record: Record<string, unknown>): StaffLeaveSettings {
  return {
    id: record.id as string,
    facilityId: record.facility_id as string,
    userId: record.user_id as string,
    paidLeaveEnabled: record.paid_leave_enabled as boolean,
    paidLeaveDays: record.paid_leave_days as number,
    substituteLeaveEnabled: record.substitute_leave_enabled as boolean,
    substituteLeaveDays: record.substitute_leave_days as number,
    notes: record.notes as string | undefined,
    createdAt: record.created_at as string,
    updatedAt: record.updated_at as string,
  };
}

export default useStaffMaster;
