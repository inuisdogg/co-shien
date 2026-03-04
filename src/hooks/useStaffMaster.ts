/**
 * スタッフマスタ管理フック
 * スタッフのCRUD操作と関連データの取得
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Staff, StaffPersonnelSettings, StaffLeaveSettings, ProxyAccountData } from '@/types';
import type { ParsedCSVRow, BulkImportResult } from '@/types/bulkImport';
import { useAuth } from '@/contexts/AuthContext';
import { parseQualifications } from '@/utils/qualifications';

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

  // 代理アカウント作成
  proxyCreateStaff: (data: ProxyAccountData) => Promise<{ invitationToken: string } | null>;

  // CSV一括インポート
  bulkImportStaff: (rows: ParsedCSVRow[], importType: 'full' | 'minimal', sendEmails: boolean) => Promise<BulkImportResult | null>;
}

export function useStaffMaster(): UseStaffMasterReturn {
  const { facility } = useAuth();
  const [staffList, setStaffList] = useState<StaffWithRelations[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffWithRelations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // スタッフ一覧を取得（staffテーブル + employment_records/usersテーブルの両方から取得してマージ）
  const fetchStaffList = useCallback(async () => {
    if (!facility?.id) return;

    setLoading(true);
    setError(null);

    try {
      // 1. staffテーブルから取得（従来の方法）
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('facility_id', facility.id)
        .order('name');

      if (staffError) {
        console.error('Error fetching staff:', staffError);
      }

      // 2. employment_recordsから取得（新規招待されたスタッフ）
      const { data: employmentData, error: employmentError } = await supabase
        .from('employment_records')
        .select('id, user_id, facility_id, role, employment_type, start_date, end_date, permissions')
        .eq('facility_id', facility.id)
        .is('end_date', null)
        .order('start_date', { ascending: false });

      if (employmentError) {
        console.error('Error fetching employment records:', employmentError);
      }

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

      const allStaff: StaffWithRelations[] = [];
      const existingUserIds = new Set<string>();

      // 3. employment_recordsからスタッフを構築（パーソナルアカウントに紐づいているスタッフを優先）
      if (employmentData && employmentData.length > 0) {
        const userIds = employmentData
          .map(emp => emp.user_id)
          .filter((id): id is string => !!id);

        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from('users')
            .select('id, name, email, phone, account_status, profile_photo_url')
            .in('id', userIds);

          if (usersData) {
            const usersMap = new Map(usersData.map(u => [u.id, u]));

            employmentData.forEach((emp) => {
              const user = usersMap.get(emp.user_id || '');
              if (user) {
                // staffテーブルにも対応するレコードがあるか検索
                const matchingStaffRecord = staffData?.find(s => s.user_id === user.id);

                const personnel = matchingStaffRecord
                  ? personnelData?.find((p) => p.staff_id === matchingStaffRecord.id)
                  : undefined;
                const leave = leaveData?.find((l) => l.user_id === user.id);

                const staffFromEmployment: StaffWithRelations = {
                  // staffテーブルのレコードがあればそのIDを使用、なければ生成
                  id: matchingStaffRecord?.id || `emp-${emp.id}`,
                  facilityId: emp.facility_id,
                  user_id: user.id,
                  name: user.name || '',
                  nameKana: matchingStaffRecord?.name_kana || undefined,
                  role: (emp.role as Staff['role']) || '一般スタッフ',
                  type: (emp.employment_type === '常勤' ? '常勤' : '非常勤') as Staff['type'],
                  phone: user.phone || matchingStaffRecord?.phone || undefined,
                  email: user.email || matchingStaffRecord?.email || undefined,
                  profilePhotoUrl: (user as any).profile_photo_url || undefined,
                  accountStatus: (user as any).account_status || undefined,
                  qualifications: matchingStaffRecord?.qualifications
                    ? parseQualifications(matchingStaffRecord.qualifications)
                    : undefined,
                  yearsOfExperience: matchingStaffRecord?.years_of_experience || undefined,
                  emergencyContact: matchingStaffRecord?.emergency_contact || undefined,
                  memo: matchingStaffRecord?.memo || undefined,
                  monthlySalary: matchingStaffRecord?.monthly_salary || undefined,
                  hourlyWage: matchingStaffRecord?.hourly_wage || undefined,
                  position: matchingStaffRecord?.position || undefined,
                  department: matchingStaffRecord?.department || undefined,
                  createdAt: emp.start_date || new Date().toISOString(),
                  updatedAt: matchingStaffRecord?.updated_at || emp.start_date || new Date().toISOString(),
                  permissions: emp.permissions || undefined,
                  personnelSettings: personnel ? mapPersonnelFromDb(personnel) : undefined,
                  leaveSettings: leave ? mapLeaveFromDb(leave) : undefined,
                };
                allStaff.push(staffFromEmployment);
                existingUserIds.add(user.id);
              }
            });
          }
        }
      }

      // 4. staffテーブルのデータを追加（employment_recordsに存在しないもののみ）
      if (staffData) {
        // staff-onlyレコードのuser_idからaccountStatusを取得
        const staffOnlyUserIds = staffData
          .filter(row => row.user_id && !existingUserIds.has(row.user_id))
          .map(row => row.user_id)
          .filter((id): id is string => !!id);

        let staffUsersMap = new Map<string, { account_status?: string; profile_photo_url?: string }>();
        if (staffOnlyUserIds.length > 0) {
          const { data: staffUsers } = await supabase
            .from('users')
            .select('id, account_status, profile_photo_url')
            .in('id', staffOnlyUserIds);
          if (staffUsers) {
            staffUsersMap = new Map(staffUsers.map(u => [u.id, u]));
          }
        }

        staffData.forEach((row) => {
          // user_idがあり、すでにemployment_recordsから取得済みならスキップ
          if (row.user_id && existingUserIds.has(row.user_id)) {
            return;
          }

          const personnel = personnelData?.find((p) => p.staff_id === row.id);
          const leave = row.user_id ? leaveData?.find((l) => l.user_id === row.user_id) : undefined;
          const userInfo = row.user_id ? staffUsersMap.get(row.user_id) : undefined;

          allStaff.push({
            ...mapStaffFromDb(row),
            accountStatus: (userInfo?.account_status as Staff['accountStatus']) || undefined,
            profilePhotoUrl: userInfo?.profile_photo_url || undefined,
            personnelSettings: personnel ? mapPersonnelFromDb(personnel) : undefined,
            leaveSettings: leave ? mapLeaveFromDb(leave) : undefined,
          });

          if (row.user_id) {
            existingUserIds.add(row.user_id);
          }
        });
      }

      setStaffList(allStaff);
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
        let leave = null;
        if (data.user_id) {
          const { data: leaveData } = await supabase
            .from('staff_leave_settings')
            .select('*')
            .eq('user_id', data.user_id)
            .eq('facility_id', facility.id)
            .single();
          leave = leaveData;
        }

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

  // スタッフ作成（staffテーブル + employment_recordsの両方に挿入）
  const createStaff = useCallback(
    async (data: Partial<Staff>): Promise<string | null> => {
      if (!facility?.id) return null;

      setLoading(true);
      setError(null);

      try {
        const newId = `staff-${Date.now()}`;
        const userId = data.user_id || undefined;

        // 1. staffテーブルに挿入
        const { error: staffError } = await supabase.from('staff').insert({
          id: newId,
          facility_id: facility.id,
          user_id: userId,
          name: data.name,
          name_kana: data.nameKana,
          type: data.type || '常勤',
          role: data.role || '一般スタッフ',
          qualifications: data.qualifications || [],
          years_of_experience: data.yearsOfExperience,
          emergency_contact: data.emergencyContact,
          memo: data.memo,
          monthly_salary: data.monthlySalary,
          hourly_wage: data.hourlyWage,
          email: data.email,
          phone: data.phone,
        });

        if (staffError) throw staffError;

        // 2. user_idがある場合、employment_recordsにも挿入（重複チェック付き）
        if (userId) {
          const { data: existingEmp } = await supabase
            .from('employment_records')
            .select('id')
            .eq('user_id', userId)
            .eq('facility_id', facility.id)
            .is('end_date', null)
            .maybeSingle();

          if (!existingEmp) {
            const { error: empError } = await supabase.from('employment_records').insert({
              user_id: userId,
              facility_id: facility.id,
              role: data.role || '一般スタッフ',
              employment_type: data.type || '常勤',
              start_date: new Date().toISOString().split('T')[0],
            });

            if (empError) {
              console.error('Failed to create employment record:', empError);
              // staffは作成済みなのでエラーにはしない
            }
          }
        }

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

  // スタッフ更新（staffテーブル + employment_recordsの両方を同期更新）
  const updateStaff = useCallback(
    async (staffId: string, data: Partial<Staff>): Promise<boolean> => {
      if (!facility?.id) return false;

      setLoading(true);
      setError(null);

      try {
        // staffテーブルのカラムマッピング
        const updateData: Record<string, unknown> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.nameKana !== undefined) updateData.name_kana = data.nameKana;
        if (data.type !== undefined) updateData.type = data.type;
        if (data.role !== undefined) updateData.role = data.role;
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.email !== undefined) updateData.email = data.email;
        if (data.qualifications !== undefined) updateData.qualifications = data.qualifications;
        if (data.yearsOfExperience !== undefined) updateData.years_of_experience = data.yearsOfExperience;
        if (data.emergencyContact !== undefined) updateData.emergency_contact = data.emergencyContact;
        if (data.memo !== undefined) updateData.memo = data.memo;
        if (data.monthlySalary !== undefined) updateData.monthly_salary = data.monthlySalary;
        if (data.hourlyWage !== undefined) updateData.hourly_wage = data.hourlyWage;
        if (data.position !== undefined) updateData.position = data.position;
        if (data.department !== undefined) updateData.department = data.department;

        // employment_records用のカラムマッピング
        const empUpdateData: Record<string, unknown> = {};
        if (data.role !== undefined) empUpdateData.role = data.role;
        if (data.type !== undefined) empUpdateData.employment_type = data.type;
        if ((data as any).permissions !== undefined) empUpdateData.permissions = (data as any).permissions;

        const isEmploymentOnly = staffId.startsWith('emp-');

        if (isEmploymentOnly) {
          // staffテーブルにレコードがない（employment_recordsのみ）場合
          // employment_recordsのIDを抽出して直接更新
          const empId = staffId.replace('emp-', '');

          if (Object.keys(empUpdateData).length > 0) {
            const { error: empError } = await supabase
              .from('employment_records')
              .update(empUpdateData)
              .eq('id', empId)
              .eq('facility_id', facility.id);

            if (empError) {
              console.error('Failed to update employment record:', empError);
              throw empError;
            }
          }
        } else {
          // 1. staffテーブルを更新
          if (Object.keys(updateData).length > 0) {
            const { error: staffError } = await supabase
              .from('staff')
              .update(updateData)
              .eq('id', staffId)
              .eq('facility_id', facility.id);

            if (staffError) throw staffError;
          }

          // 2. employment_recordsも同期更新（role, type, permissionsを反映）
          //    fetchStaffListではemployment_recordsのrole/employment_typeを優先読み取りするため、
          //    ここでも同期しないと変更が反映されない（既知のバグ修正）
          if (Object.keys(empUpdateData).length > 0) {
            // staffからuser_idを取得
            const { data: staffRecord } = await supabase
              .from('staff')
              .select('user_id')
              .eq('id', staffId)
              .single();

            if (staffRecord?.user_id) {
              // end_dateがnull（現在有効）のレコードのみ更新
              const { error: empError } = await supabase
                .from('employment_records')
                .update(empUpdateData)
                .eq('user_id', staffRecord.user_id)
                .eq('facility_id', facility.id)
                .is('end_date', null);

              if (empError) {
                console.error('Failed to update employment record:', empError);
                // employment_recordsの更新が失敗してもstaffは更新済みなので
                // エラーはログのみ（ただしデータ不整合の可能性を通知）
              }
            }
          }
        }

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

  // スタッフ削除
  const deleteStaff = useCallback(
    async (staffId: string): Promise<boolean> => {
      if (!facility?.id) return false;

      setLoading(true);
      setError(null);

      try {
        const isEmploymentOnly = staffId.startsWith('emp-');

        if (isEmploymentOnly) {
          // employment_recordsのみのスタッフ: end_dateを設定して無効化
          const empId = staffId.replace('emp-', '');
          const { error } = await supabase
            .from('employment_records')
            .update({ end_date: new Date().toISOString().split('T')[0] })
            .eq('id', empId)
            .eq('facility_id', facility.id);
          if (error) throw error;
        } else {
          // staffテーブルから削除
          const { error: staffError } = await supabase
            .from('staff')
            .delete()
            .eq('id', staffId)
            .eq('facility_id', facility.id);
          if (staffError) throw staffError;
        }

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
        const token = `inv-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').substring(0, 9)}`;

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

  // 代理アカウント作成（招待トークン付きでstaff + employment_recordsを作成）
  const proxyCreateStaff = useCallback(
    async (data: ProxyAccountData): Promise<{ invitationToken: string } | null> => {
      if (!facility?.id) return null;

      setLoading(true);
      setError(null);

      try {
        const newStaffId = `staff-${Date.now()}`;
        const token = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

        // 1. staffテーブルに挿入
        const { error: staffError } = await supabase.from('staff').insert({
          id: newStaffId,
          facility_id: facility.id,
          name: data.name,
          name_kana: data.nameKana || null,
          type: data.employmentType || '常勤',
          role: data.role || '一般スタッフ',
          qualifications: data.qualifications ? parseQualifications(data.qualifications) : [],
          memo: data.memo || null,
          monthly_salary: data.monthlySalary || null,
          hourly_wage: data.hourlyWage || null,
          email: data.email || null,
          phone: data.phone || null,
        });

        if (staffError) throw staffError;

        // 2. 招待レコードを作成
        const { error: invError } = await supabase.from('staff_invitations').insert({
          facility_id: facility.id,
          email: data.email || '',
          name: data.name,
          token,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

        if (invError) {
          console.error('Failed to create invitation:', invError);
        }

        await fetchStaffList();
        return { invitationToken: token };
      } catch (err) {
        console.error('Failed to proxy create staff:', err);
        setError('スタッフの代理登録に失敗しました');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [facility?.id, fetchStaffList]
  );

  // CSV一括インポート
  const bulkImportStaff = useCallback(
    async (rows: ParsedCSVRow[], _importType: 'full' | 'minimal', _sendEmails: boolean): Promise<BulkImportResult | null> => {
      if (!facility?.id) return null;

      setLoading(true);
      setError(null);

      const batchId = `batch-${Date.now()}`;
      const results: BulkImportResult['results'] = [];

      try {
        // バッチインサートデータを構築
        const insertRows = rows.map((row, idx) => ({
          id: `staff-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          facility_id: facility.id,
          name: `${row.lastName}${row.firstName}`.trim() || `行${row.rowIndex}`,
          name_kana: row.lastNameKana && row.firstNameKana ? `${row.lastNameKana}${row.firstNameKana}` : null,
          type: row.employmentType || '常勤',
          role: '一般スタッフ' as const,
          email: row.email || null,
          phone: row.phone || null,
          qualifications: row.qualifications ? parseQualifications(row.qualifications) : [],
          monthly_salary: row.monthlySalary ? Number(row.monthlySalary) : null,
          hourly_wage: row.hourlyWage ? Number(row.hourlyWage) : null,
          memo: row.memo || null,
        }));

        // 一括インサート（N+1解消）
        const { data: insertedData, error: batchError } = await supabase
          .from('staff')
          .insert(insertRows)
          .select('id');

        if (batchError) {
          // バッチ失敗時は個別にフォールバック
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const name = insertRows[i].name;
            try {
              const { error: staffError } = await supabase.from('staff').insert(insertRows[i]);
              if (staffError) {
                results.push({ rowIndex: row.rowIndex, success: false, name, error: staffError.message });
              } else {
                results.push({ rowIndex: row.rowIndex, success: true, name, email: row.email });
              }
            } catch (err: any) {
              results.push({ rowIndex: row.rowIndex, success: false, name, error: err.message });
            }
          }
        } else {
          // バッチ成功 — 全行成功
          rows.forEach((row, i) => {
            results.push({ rowIndex: row.rowIndex, success: true, name: insertRows[i].name, email: row.email });
          });
        }

        await fetchStaffList();
        const successCount = results.filter(r => r.success).length;
        return {
          batchId,
          totalRows: rows.length,
          successCount,
          errorCount: rows.length - successCount,
          results,
        };
      } catch (err) {
        console.error('Bulk import error:', err);
        setError('一括インポートに失敗しました');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [facility?.id, fetchStaffList]
  );

  // 初期読み込み（コンポーネントアンマウント時はスキップ）
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    if (facility?.id) {
      fetchStaffList();
    }
    return () => { mountedRef.current = false; };
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
    proxyCreateStaff,
    bulkImportStaff,
  };
}

// DBレコードを型にマッピング
function mapStaffFromDb(record: Record<string, unknown>): Staff {
  return {
    id: record.id as string,
    facilityId: record.facility_id as string,
    user_id: record.user_id as string | undefined,
    name: (record.name as string) || '',
    nameKana: record.name_kana as string | undefined,
    type: (record.type as Staff['type']) || '常勤',
    role: (record.role as Staff['role']) || '一般スタッフ',
    qualifications: record.qualifications ? parseQualifications(record.qualifications) : undefined,
    yearsOfExperience: record.years_of_experience as number | undefined,
    emergencyContact: record.emergency_contact as string | undefined,
    memo: record.memo as string | undefined,
    monthlySalary: record.monthly_salary as number | undefined,
    hourlyWage: record.hourly_wage as number | undefined,
    phone: record.phone as string | undefined,
    email: record.email as string | undefined,
    position: record.position as string | undefined,
    department: record.department as string | undefined,
    defaultWorkPattern: record.default_work_pattern as Staff['defaultWorkPattern'],
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
