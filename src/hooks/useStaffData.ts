/**
 * スタッフデータ管理フック
 * staff テーブルと employment_records の取得・CRUD操作・シフト管理
 */

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Staff, AccountStatus, UserPermissions } from '@/types';

export const useStaffData = () => {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [staff, setStaff] = useState<Staff[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);

  // Supabaseからスタッフデータを取得
  useEffect(() => {
    if (!facilityId) {
      setLoadingStaff(false);
      return;
    }

    const fetchStaff = async () => {
      try {
        // 0. 施設のオーナーユーザーIDを取得
        const { data: facilityData } = await supabase
          .from('facilities')
          .select('owner_user_id')
          .eq('id', facilityId)
          .single();

        const ownerUserId = facilityData?.owner_user_id || null;

        // 1. staffテーブルから取得（従来の方法）
        const { data: staffData, error: staffError } = await supabase
          .from('staff')
          .select('*')
          .eq('facility_id', facilityId)
          .order('created_at', { ascending: false });

        if (staffError) {
          console.error('Error fetching staff:', staffError);
        }

        // 2. employment_recordsから取得（新規招待されたスタッフ）※permissionsも含む
        const { data: employmentData, error: employmentError } = await supabase
          .from('employment_records')
          .select('id, user_id, facility_id, role, employment_type, start_date, end_date, permissions')
          .eq('facility_id', facilityId)
          .is('end_date', null)
          .order('start_date', { ascending: false });

        if (employmentError) {
          console.error('Error fetching employment records:', employmentError);
        }

        const allStaff: Staff[] = [];
        const existingUserIds = new Set<string>();
        const existingStaffKeys = new Set<string>();

        // 1. employment_recordsから取得（パーソナルアカウントに紐づいているスタッフを優先）
        if (employmentData && employmentData.length > 0) {
          // ユーザーIDのリストを取得
          const userIds = employmentData
            .map(emp => emp.user_id)
            .filter((id): id is string => !!id);

          if (userIds.length > 0) {
            // usersテーブルからユーザー情報を取得（個人情報も含む）
            const { data: usersData, error: usersError } = await supabase
              .from('users')
              .select('id, name, email, phone, birth_date, gender, address, postal_code, my_number, spouse_name, basic_pension_symbol, basic_pension_number, employment_insurance_status, employment_insurance_number, previous_retirement_date, previous_name, social_insurance_status, has_dependents, dependent_count, dependents, account_status, profile_photo_url')
              .in('id', userIds);

            if (usersError) {
              console.error('Error fetching users:', usersError);
            }

            // employment_recordsとusersをマージ
            if (usersData) {
              const usersMap = new Map(usersData.map(u => [u.id, u]));

              // staffテーブルからfacilityRoleを取得するためのマップを作成
              const staffRoleMap = new Map<string, string>();
              if (staffData) {
                staffData.forEach((row) => {
                  if (row.user_id) {
                    let facilityRoleFromMemo = '';
                    try {
                      if (row.memo && typeof row.memo === 'string') {
                        const memoData = JSON.parse(row.memo);
                        facilityRoleFromMemo = memoData?.facilityRole || '';
                      }
                    } catch {
                      // memoがJSONでない場合は無視
                    }
                    staffRoleMap.set(row.user_id, facilityRoleFromMemo);
                  }
                });
              }

              employmentData.forEach((emp) => {
                const user = usersMap.get(emp.user_id || '');
                if (user) {
                  // staffテーブルからfacilityRoleを取得
                  const facilityRoleFromStaff = staffRoleMap.get(user.id) || '';

                  // 権限情報を取得
                  const permissions = (emp.permissions as UserPermissions) || {};
                  // ダッシュボード権限があるかどうか（いずれかの権限がtrueならtrue）
                  const hasDashboardAccess = Object.values(permissions).some(v => v === true);
                  // マスター管理者かどうか（施設オーナー）
                  const isMaster = ownerUserId === user.id;

                  const staffFromEmployment: Staff = {
                    id: `emp-${emp.id}`,
                    facilityId: emp.facility_id,
                    name: user.name || '',
                    nameKana: '',
                    role: (emp.role as '一般スタッフ' | 'マネージャー' | '管理者') || '一般スタッフ',
                    type: (emp.employment_type === '常勤' ? '常勤' : '非常勤') as '常勤' | '非常勤',
                    facilityRole: facilityRoleFromStaff,
                    accountStatus: (user.account_status as AccountStatus) || 'pending',
                    permissions: permissions,
                    hasDashboardAccess: hasDashboardAccess || isMaster,
                    isMaster: isMaster,
                    birthDate: user.birth_date || '',
                    gender: user.gender as '男性' | '女性' | 'その他' | undefined,
                    address: user.address || '',
                    phone: user.phone || '',
                    email: user.email || '',
                    postalCode: user.postal_code || null,
                    myNumber: user.my_number || null,
                    hasSpouse: !!user.spouse_name,
                    spouseName: user.spouse_name || null,
                    basicPensionSymbol: user.basic_pension_symbol || null,
                    basicPensionNumber: user.basic_pension_number || null,
                    employmentInsuranceStatus: user.employment_insurance_status || null,
                    employmentInsuranceNumber: user.employment_insurance_number || null,
                    previousRetirementDate: user.previous_retirement_date || null,
                    previousName: user.previous_name || null,
                    socialInsuranceStatus: user.social_insurance_status || null,
                    hasDependents: user.has_dependents || false,
                    dependentCount: user.dependent_count || 0,
                    dependents: user.dependents || null,
                    profilePhotoUrl: user.profile_photo_url || undefined,
                    qualifications: '',
                    yearsOfExperience: 0,
                    qualificationCertificate: '',
                    experienceCertificate: '',
                    emergencyContact: '',
                    emergencyContactPhone: '',
                    memo: '',
                    monthlySalary: 0,
                    hourlyWage: 0,
                    user_id: user.id,
                    createdAt: emp.start_date || new Date().toISOString(),
                    updatedAt: emp.start_date || new Date().toISOString(),
                  };
                  allStaff.push(staffFromEmployment);

                  // 重複チェック用のキーを追加
                  if (user.id) {
                    existingUserIds.add(user.id);
                    existingStaffKeys.add(`user-${user.id}`);
                  }
                  if (user.name && user.email) {
                    existingStaffKeys.add(`name-email-${user.name}-${user.email}`);
                  }
                }
              });
            }
          }
        }

        // 2. staffテーブルのデータを追加（employment_recordsに存在しないもののみ）
        // シャドウアカウント（user_idがNULL）も含めて取得
        if (staffData) {
          staffData.forEach((row) => {
            // 重複チェック
            let shouldSkip = false;

            if (row.user_id) {
              // user_idがある場合、employment_recordsに既に存在するかチェック
              if (existingUserIds.has(row.user_id)) {
                shouldSkip = true;
              } else {
                existingUserIds.add(row.user_id);
                existingStaffKeys.add(`user-${row.user_id}`);
              }
            }

            // user_idがない場合（シャドウアカウント）でも、名前とメールアドレスで重複チェック
            if (!shouldSkip && row.name && row.email) {
              const key = `name-email-${row.name}-${row.email}`;
              if (existingStaffKeys.has(key)) {
                shouldSkip = true;
              } else {
                existingStaffKeys.add(key);
              }
            }

            // user_idがない場合（シャドウアカウント）でも、名前と電話番号で重複チェック
            if (!shouldSkip && row.name && row.phone && !row.email) {
              const key = `name-phone-${row.name}-${row.phone}`;
              if (existingStaffKeys.has(key)) {
                shouldSkip = true;
              } else {
                existingStaffKeys.add(key);
              }
            }

            if (!shouldSkip) {
              // memoフィールドからfacilityRoleを取得
              let facilityRoleFromMemo = '';
              try {
                if (row.memo && typeof row.memo === 'string') {
                  const memoData = JSON.parse(row.memo);
                  facilityRoleFromMemo = memoData?.facilityRole || '';
                }
              } catch {
                // memoがJSONでない場合は無視
              }

              const staffFromTable: Staff = {
                id: row.id,
                facilityId: row.facility_id,
                name: row.name,
                lastName: row.last_name,
                firstName: row.first_name,
                nameKana: row.name_kana,
                lastNameKana: row.last_name_kana,
                firstNameKana: row.first_name_kana,
                role: row.role as '一般スタッフ' | 'マネージャー' | '管理者',
                type: row.type as '常勤' | '非常勤',
                facilityRole: facilityRoleFromMemo,
                birthDate: row.birth_date,
                gender: row.gender,
                address: row.address,
                phone: row.phone,
                email: row.email,
                qualifications: row.qualifications,
                yearsOfExperience: row.years_of_experience,
                qualificationCertificate: row.qualification_certificate,
                experienceCertificate: row.experience_certificate,
                emergencyContact: row.emergency_contact,
                emergencyContactPhone: row.emergency_contact_phone,
                profilePhotoUrl: row.profile_photo_url || undefined,
                memo: row.memo,
                monthlySalary: row.monthly_salary,
                hourlyWage: row.hourly_wage,
                user_id: row.user_id,
                defaultShiftPattern: row.default_shift_pattern && Array.isArray(row.default_shift_pattern)
                  ? row.default_shift_pattern as boolean[]
                  : undefined,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
              };
              allStaff.push(staffFromTable);
            }
          });
        }

        setStaff(allStaff);
      } catch (error) {
        console.error('Error in fetchStaff:', error);
      } finally {
        setLoadingStaff(false);
      }
    };

    fetchStaff();
  }, [facilityId]);

  const filteredStaff = useMemo(
    () => staff.filter((s) => s.facilityId === facilityId),
    [staff, facilityId]
  );

  const addStaff = async (staffData: Omit<Staff, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>) => {
    const newStaffId = `staff-${Date.now()}`;
    const now = new Date().toISOString();

    try {
      const { data, error } = await supabase
        .from('staff')
        .insert({
          id: newStaffId,
          facility_id: facilityId,
          name: staffData.name,
          name_kana: staffData.nameKana,
          role: staffData.role,
          type: staffData.type,
          birth_date: staffData.birthDate,
          gender: staffData.gender,
          address: staffData.address,
          phone: staffData.phone,
          email: staffData.email,
          qualifications: staffData.qualifications,
          years_of_experience: staffData.yearsOfExperience,
          qualification_certificate: staffData.qualificationCertificate,
          experience_certificate: staffData.experienceCertificate,
          emergency_contact: staffData.emergencyContact,
          emergency_contact_phone: staffData.emergencyContactPhone,
          memo: staffData.memo,
          monthly_salary: staffData.monthlySalary,
          hourly_wage: staffData.hourlyWage,
          default_shift_pattern: staffData.defaultShiftPattern || null,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) throw error;

      const newStaff: Staff = {
        ...staffData,
        id: newStaffId,
        facilityId,
        createdAt: now,
        updatedAt: now,
      };
      setStaff(prev => [...prev, newStaff]);
      return newStaff;
    } catch (error) {
      console.error('Error in addStaff:', error);
      throw error;
    }
  };

  const updateStaff = async (staffId: string, staffData: Partial<Staff & { passwordHash?: string; hasAccount?: boolean }>) => {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (staffData.name !== undefined) updateData.name = staffData.name;
      if (staffData.nameKana !== undefined) updateData.name_kana = staffData.nameKana;
      if (staffData.role !== undefined) updateData.role = staffData.role;
      if (staffData.type !== undefined) updateData.type = staffData.type;
      if (staffData.birthDate !== undefined) updateData.birth_date = staffData.birthDate;
      if (staffData.gender !== undefined) updateData.gender = staffData.gender;
      if (staffData.address !== undefined) updateData.address = staffData.address;
      if (staffData.phone !== undefined) updateData.phone = staffData.phone;
      if (staffData.email !== undefined) updateData.email = staffData.email;
      if (staffData.qualifications !== undefined) updateData.qualifications = staffData.qualifications;
      if (staffData.yearsOfExperience !== undefined) updateData.years_of_experience = staffData.yearsOfExperience;
      if (staffData.qualificationCertificate !== undefined) updateData.qualification_certificate = staffData.qualificationCertificate;
      if (staffData.experienceCertificate !== undefined) updateData.experience_certificate = staffData.experienceCertificate;
      if (staffData.emergencyContact !== undefined) updateData.emergency_contact = staffData.emergencyContact;
      if (staffData.emergencyContactPhone !== undefined) updateData.emergency_contact_phone = staffData.emergencyContactPhone;
      if (staffData.memo !== undefined) updateData.memo = staffData.memo;
      if (staffData.monthlySalary !== undefined) updateData.monthly_salary = staffData.monthlySalary;
      if (staffData.hourlyWage !== undefined) updateData.hourly_wage = staffData.hourlyWage;
      if (staffData.defaultShiftPattern !== undefined) updateData.default_shift_pattern = staffData.defaultShiftPattern || null;

      // パスワード関連のフィールド
      if (staffData.passwordHash !== undefined) updateData.password_hash = staffData.passwordHash;
      if (staffData.hasAccount !== undefined) updateData.has_account = staffData.hasAccount;

      const { error } = await supabase
        .from('staff')
        .update(updateData)
        .eq('id', staffId);

      if (error) throw error;

      setStaff(prev =>
        prev.map((s) =>
          s.id === staffId
            ? { ...s, ...staffData, updatedAt: new Date().toISOString() }
            : s
        )
      );
    } catch (error) {
      console.error('Error in updateStaff:', error);
      throw error;
    }
  };

  const deleteStaff = async (staffId: string) => {
    try {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', staffId);

      if (error) throw error;

      setStaff(prev => prev.filter((s) => s.id !== staffId));
    } catch (error) {
      console.error('Error in deleteStaff:', error);
      throw error;
    }
  };

  const saveShifts = async (shifts: Record<string, Record<string, boolean>>) => {
    if (!facilityId) {
      throw new Error('施設IDが設定されていません');
    }

    try {
      // emp-プレフィックス付きIDをstaffテーブルのIDにマッピングする
      const staffIdMapping: Record<string, string> = {};
      const empPrefixedIds = Object.keys(shifts).filter(id => id.startsWith('emp-'));

      if (empPrefixedIds.length > 0) {
        // employment_recordsのIDからuser_idを取得
        const empIds = empPrefixedIds.map(id => id.replace('emp-', ''));
        const { data: empRecords } = await supabase
          .from('employment_records')
          .select('id, user_id')
          .in('id', empIds);

        if (empRecords) {
          const userIds = empRecords.map(e => e.user_id).filter(Boolean);

          // user_idからstaffテーブルのIDを取得
          if (userIds.length > 0) {
            const { data: staffRecords } = await supabase
              .from('staff')
              .select('id, user_id')
              .eq('facility_id', facilityId)
              .in('user_id', userIds);

            // マッピングを作成し、staffテーブルにエントリがないユーザーを特定
            const usersWithoutStaff: string[] = [];
            for (const emp of empRecords) {
              const matchingStaff = staffRecords?.find(s => s.user_id === emp.user_id);
              if (matchingStaff) {
                staffIdMapping[`emp-${emp.id}`] = matchingStaff.id;
              } else if (emp.user_id) {
                usersWithoutStaff.push(emp.user_id);
              }
            }

            // staffテーブルにエントリがないユーザー用にエントリを作成
            if (usersWithoutStaff.length > 0) {
              // ユーザー情報を取得
              const { data: usersData } = await supabase
                .from('users')
                .select('id, name')
                .in('id', usersWithoutStaff);

              if (usersData) {
                for (const user of usersData) {
                  const newStaffId = `staff-${user.id}`;
                  const { error: insertError } = await supabase
                    .from('staff')
                    .upsert({
                      id: newStaffId,
                      facility_id: facilityId,
                      user_id: user.id,
                      name: user.name || '名称未設定',
                      role: '一般スタッフ',
                      type: '常勤',
                    }, { onConflict: 'id' });

                  if (!insertError) {
                    // マッピングを追加
                    const emp = empRecords.find(e => e.user_id === user.id);
                    if (emp) {
                      staffIdMapping[`emp-${emp.id}`] = newStaffId;
                    }
                  }
                }
              }
            }
          }
        }
      }

      // すべてのシフトデータを準備（has_shiftがfalseのものも含む）
      const shiftData: Array<{
        facility_id: string;
        staff_id: string;
        date: string;
        has_shift: boolean;
      }> = [];

      for (const [staffId, dates] of Object.entries(shifts)) {
        // emp-プレフィックスがある場合はマッピングから実際のstaff_idを取得
        const actualStaffId = staffIdMapping[staffId] || staffId;

        // マッピングできなかった emp- ID はスキップ
        if (staffId.startsWith('emp-') && !staffIdMapping[staffId]) {
          continue;
        }

        for (const [date, hasShift] of Object.entries(dates)) {
          shiftData.push({
            facility_id: facilityId,
            staff_id: actualStaffId,
            date: date,
            has_shift: hasShift,
          });
        }
      }

      if (shiftData.length === 0) {
        return;
      }

      // upsertを使用して保存（UNIQUE制約: facility_id, staff_id, date）
      const now = new Date().toISOString();
      const upsertData = shiftData.map(shift => ({
        ...shift,
        updated_at: now,
      }));

      const { error: upsertError } = await supabase
        .from('shifts')
        .upsert(upsertData, { onConflict: 'facility_id,staff_id,date' });

      if (upsertError) {
        throw upsertError;
      }
    } catch (error) {
      console.error('Error in saveShifts:', error);
      throw error;
    }
  };

  const fetchShifts = async (startDate: string, endDate: string): Promise<Record<string, Record<string, boolean>>> => {
    if (!facilityId) {
      return {};
    }

    try {
      // シフトデータを取得
      const { data, error } = await supabase
        .from('shifts')
        .select('staff_id, date, has_shift')
        .eq('facility_id', facilityId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) {
        console.error('Error fetching shifts:', error);
        return {};
      }

      // staff_id -> emp-{employment_record_id} の逆マッピングを作成
      const reverseMapping: Record<string, string> = {};

      // staffテーブルからuser_idを取得
      const { data: staffRecords } = await supabase
        .from('staff')
        .select('id, user_id')
        .eq('facility_id', facilityId);

      if (staffRecords && staffRecords.length > 0) {
        const userIdsFromStaff = staffRecords.map(s => s.user_id).filter(Boolean);

        if (userIdsFromStaff.length > 0) {
          // employment_recordsからuser_idとidのマッピングを取得
          const { data: empRecords } = await supabase
            .from('employment_records')
            .select('id, user_id')
            .eq('facility_id', facilityId)
            .in('user_id', userIdsFromStaff);

          if (empRecords) {
            for (const staffRecord of staffRecords) {
              const emp = empRecords.find(e => e.user_id === staffRecord.user_id);
              if (emp) {
                // staff.id -> emp-{emp.id} のマッピング
                reverseMapping[staffRecord.id] = `emp-${emp.id}`;
              }
            }
          }
        }
      }

      const shiftsResult: Record<string, Record<string, boolean>> = {};
      if (data) {
        for (const row of data) {
          // staff_idを元のID（emp-付き または そのまま）に変換
          const originalId = reverseMapping[row.staff_id] || row.staff_id;
          if (!shiftsResult[originalId]) {
            shiftsResult[originalId] = {};
          }
          shiftsResult[originalId][row.date] = row.has_shift;
        }
      }

      return shiftsResult;
    } catch (error) {
      console.error('Error in fetchShifts:', error);
      return {};
    }
  };

  return {
    staff: filteredStaff,
    loadingStaff,
    setStaff,
    addStaff,
    updateStaff,
    deleteStaff,
    saveShifts,
    fetchShifts,
  };
};
