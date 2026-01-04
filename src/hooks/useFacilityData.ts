/**
 * 施設データ管理フック
 * マルチテナント対応：現在の施設に紐づくデータのみを取得・管理
 */

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Child,
  Staff,
  ScheduleItem,
  BookingRequest,
  FacilitySettings,
  UsageRecord,
  UsageRecordFormData,
  Lead,
  LeadFormData,
  ManagementTarget,
  ManagementTargetFormData,
} from '@/types';

export const useFacilityData = () => {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  // データの状態管理
  const [children, setChildren] = useState<Child[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [facilitySettings, setFacilitySettings] = useState<FacilitySettings>({
    id: `settings-${Date.now()}`,
    facilityId,
    facilityName: '',
    regularHolidays: [0],
    customHolidays: [],
    includeHolidays: false,
    businessHours: {
      AM: { start: '09:00', end: '12:00' },
      PM: { start: '13:00', end: '18:00' },
    },
    capacity: {
      AM: 10,
      PM: 10,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingStaff, setLoadingStaff] = useState(true);

  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [managementTargets, setManagementTargets] = useState<ManagementTarget[]>([]);

  // Supabaseから施設設定を取得
  useEffect(() => {
    if (!facilityId) {
      setLoadingSettings(false);
      return;
    }

    const fetchFacilitySettings = async () => {
      try {
        console.log('=== Biz側: 施設設定取得 ===');
        console.log('facilityId:', facilityId);
        
        const { data, error } = await supabase
          .from('facility_settings')
          .select('*')
          .eq('facility_id', facilityId)
          .single();
        
        console.log('Biz側: 施設設定取得結果:', { data, error });

        if (error && error.code !== 'PGRST116') {
          // PGRST116は「行が見つからない」エラー（正常）
          console.error('Error fetching facility settings:', error);
          setLoadingSettings(false);
          return;
        }

        if (data) {
          // データベースのスネークケースをキャメルケースに変換
          setFacilitySettings({
            id: data.id,
            facilityId: data.facility_id,
            facilityName: data.facility_name || '',
            regularHolidays: data.regular_holidays || [0],
            holidayPeriods: data.holiday_periods || [],
            customHolidays: data.custom_holidays || [],
            includeHolidays: data.include_holidays || false,
            businessHours: data.business_hours || {
              AM: { start: '09:00', end: '12:00' },
              PM: { start: '13:00', end: '18:00' },
            },
            capacity: data.capacity || {
              AM: 10,
              PM: 10,
            },
            createdAt: data.created_at || new Date().toISOString(),
            updatedAt: data.updated_at || new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error('Error in fetchFacilitySettings:', error);
      } finally {
        setLoadingSettings(false);
      }
    };

    fetchFacilitySettings();
  }, [facilityId]);

  // Supabaseから児童データを取得
  useEffect(() => {
    if (!facilityId) {
      setLoadingChildren(false);
      return;
    }

    const fetchChildren = async () => {
      try {
        const { data, error } = await supabase
          .from('children')
          .select('*')
          .eq('facility_id', facilityId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching children:', error);
          setLoadingChildren(false);
          return;
        }

        if (data) {
          // データベースのスネークケースをキャメルケースに変換
          const childrenData: Child[] = data.map((row) => ({
            id: row.id,
            facilityId: row.facility_id,
            name: row.name,
            age: row.age,
            guardianName: row.guardian_name,
            guardianRelationship: row.guardian_relationship,
            beneficiaryNumber: row.beneficiary_number,
            grantDays: row.grant_days,
            contractDays: row.contract_days,
            address: row.address,
            phone: row.phone,
            email: row.email,
            doctorName: row.doctor_name,
            doctorClinic: row.doctor_clinic,
            schoolName: row.school_name,
            pattern: row.pattern,
            needsPickup: row.needs_pickup || false,
            needsDropoff: row.needs_dropoff || false,
            pickupLocation: row.pickup_location,
            dropoffLocation: row.dropoff_location,
            contractStatus: row.contract_status,
            contractStartDate: row.contract_start_date,
            contractEndDate: row.contract_end_date,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));
          setChildren(childrenData);
        }
      } catch (error) {
        console.error('Error in fetchChildren:', error);
      } finally {
        setLoadingChildren(false);
      }
    };

    fetchChildren();
  }, [facilityId]);

  // Supabaseからスタッフデータを取得
  useEffect(() => {
    if (!facilityId) {
      setLoadingStaff(false);
      return;
    }

    const fetchStaff = async () => {
      try {
        // 1. staffテーブルから取得（従来の方法）
        const { data: staffData, error: staffError } = await supabase
          .from('staff')
          .select('*')
          .eq('facility_id', facilityId)
          .order('created_at', { ascending: false });

        if (staffError) {
          console.error('Error fetching staff:', staffError);
        }

        // 2. employment_recordsから取得（新規招待されたスタッフ）
        const { data: employmentData, error: employmentError } = await supabase
          .from('employment_records')
          .select('id, user_id, facility_id, role, employment_type, start_date, end_date')
          .eq('facility_id', facilityId)
          .is('end_date', null)
          .order('start_date', { ascending: false });

        if (employmentError) {
          console.error('Error fetching employment records:', employmentError);
        }

        const allStaff: Staff[] = [];
        const existingUserIds = new Set<string>();
        const existingStaffKeys = new Set<string>(); // user_idまたは(name+email)の組み合わせ

        // 1. employment_recordsから取得（パーソナルアカウントに紐づいているスタッフを優先）
        if (employmentData && employmentData.length > 0) {
          // ユーザーIDのリストを取得
          const userIds = employmentData
            .map(emp => emp.user_id)
            .filter((id): id is string => !!id);

          if (userIds.length > 0) {
            // usersテーブルからユーザー情報を取得
            const { data: usersData, error: usersError } = await supabase
              .from('users')
              .select('id, name, email, phone, birth_date, gender, address')
              .in('id', userIds);

            if (usersError) {
              console.error('Error fetching users:', usersError);
            }

            // employment_recordsとusersをマージ
            if (usersData) {
              const usersMap = new Map(usersData.map(u => [u.id, u]));
              
              employmentData.forEach((emp) => {
                const user = usersMap.get(emp.user_id || '');
                if (user) {
                  const staffFromEmployment: Staff = {
                    id: `emp-${emp.id}`, // employment_recordのIDを使用（重複を避けるためプレフィックス）
                    facilityId: emp.facility_id,
                    name: user.name || '',
                    nameKana: '',
                    role: (emp.role as '一般スタッフ' | 'マネージャー' | '管理者') || '一般スタッフ',
                    type: (emp.employment_type === '常勤' ? '常勤' : '非常勤') as '常勤' | '非常勤',
                    facilityRole: emp.role || '一般スタッフ', // 施設での役割として使用
                    birthDate: user.birth_date || '',
                    gender: user.gender as '男性' | '女性' | 'その他' | undefined,
                    address: user.address || '',
                    phone: user.phone || '',
                    email: user.email || '',
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
            
            // user_idがない場合でも、名前とメールアドレスで重複チェック
            if (!shouldSkip && row.name && row.email) {
              const key = `name-email-${row.name}-${row.email}`;
              if (existingStaffKeys.has(key)) {
                shouldSkip = true;
              } else {
                existingStaffKeys.add(key);
              }
            }
            
            if (!shouldSkip) {
              const staffFromTable: Staff = {
                id: row.id,
                facilityId: row.facility_id,
                name: row.name,
                nameKana: row.name_kana,
                role: row.role as '一般スタッフ' | 'マネージャー' | '管理者',
                type: row.type as '常勤' | '非常勤',
                facilityRole: row.role, // 施設での役割として使用
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

  // 施設IDでフィルタリングされたデータのみを返す
  const filteredChildren = useMemo(
    () => children.filter((c) => c.facilityId === facilityId),
    [children, facilityId]
  );

  const filteredStaff = useMemo(
    () => staff.filter((s) => s.facilityId === facilityId),
    [staff, facilityId]
  );

  const filteredSchedules = useMemo(
    () => schedules.filter((s) => s.facilityId === facilityId),
    [schedules, facilityId]
  );

  const filteredRequests = useMemo(
    () => requests.filter((r) => r.facilityId === facilityId),
    [requests, facilityId]
  );

  // 新しいデータを追加する際は自動的にfacilityIdを付与
  const addChild = async (child: Omit<Child, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>) => {
    const newChildId = `c${Date.now()}`;
    const now = new Date().toISOString();
    
    try {
      // Supabaseに保存
      const { data, error } = await supabase
        .from('children')
        .insert({
          id: newChildId,
          facility_id: facilityId,
          name: child.name,
          age: child.age,
          guardian_name: child.guardianName,
          guardian_relationship: child.guardianRelationship,
          beneficiary_number: child.beneficiaryNumber,
          grant_days: child.grantDays,
          contract_days: child.contractDays,
          address: child.address,
          phone: child.phone,
          email: child.email,
          doctor_name: child.doctorName,
          doctor_clinic: child.doctorClinic,
          school_name: child.schoolName,
          pattern: child.pattern,
          needs_pickup: child.needsPickup || false,
          needs_dropoff: child.needsDropoff || false,
          pickup_location: child.pickupLocation,
          dropoff_location: child.dropoffLocation,
          contract_status: child.contractStatus,
          contract_start_date: child.contractStartDate,
          contract_end_date: child.contractEndDate,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding child to Supabase:', error);
        throw error;
      }

      // ローカル状態を更新
      const newChild: Child = {
        ...child,
        id: newChildId,
        facilityId,
        createdAt: now,
        updatedAt: now,
      };
      setChildren([...children, newChild]);
      return newChild;
    } catch (error) {
      console.error('Error in addChild:', error);
      throw error;
    }
  };

  const updateChild = async (child: Child) => {
    try {
      // Supabaseを更新
      const { error } = await supabase
        .from('children')
        .update({
          name: child.name,
          age: child.age,
          guardian_name: child.guardianName,
          guardian_relationship: child.guardianRelationship,
          beneficiary_number: child.beneficiaryNumber,
          grant_days: child.grantDays,
          contract_days: child.contractDays,
          address: child.address,
          phone: child.phone,
          email: child.email,
          doctor_name: child.doctorName,
          doctor_clinic: child.doctorClinic,
          school_name: child.schoolName,
          pattern: child.pattern,
          needs_pickup: child.needsPickup || false,
          needs_dropoff: child.needsDropoff || false,
          pickup_location: child.pickupLocation,
          dropoff_location: child.dropoffLocation,
          contract_status: child.contractStatus,
          contract_start_date: child.contractStartDate,
          contract_end_date: child.contractEndDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', child.id);

      if (error) {
        console.error('Error updating child in Supabase:', error);
        throw error;
      }

      // ローカル状態を更新
      setChildren(children.map((c) => (c.id === child.id ? { ...child, updatedAt: new Date().toISOString() } : c)));
    } catch (error) {
      console.error('Error in updateChild:', error);
      throw error;
    }
  };

  const deleteChild = async (childId: string) => {
    try {
      // Supabaseから削除
      const { error } = await supabase
        .from('children')
        .delete()
        .eq('id', childId);

      if (error) {
        console.error('Error deleting child from Supabase:', error);
        throw error;
      }

      // ローカル状態を更新
      setChildren(children.filter((c) => c.id !== childId));
    } catch (error) {
      console.error('Error in deleteChild:', error);
      throw error;
    }
  };

  const addSchedule = (schedule: Omit<ScheduleItem, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>) => {
    const newSchedule: ScheduleItem = {
      ...schedule,
      id: Date.now(),
      facilityId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSchedules([...schedules, newSchedule]);
    return newSchedule;
  };

  const addRequest = (request: Omit<BookingRequest, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>) => {
    const newRequest: BookingRequest = {
      ...request,
      id: Date.now(),
      facilityId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setRequests([...requests, newRequest]);
    return newRequest;
  };

  const updateFacilitySettings = async (settings: Partial<FacilitySettings>) => {
    const updatedSettings = {
      ...facilitySettings,
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    
    setFacilitySettings(updatedSettings);

    // Supabaseに保存
    if (facilityId) {
      try {
        // 既存のレコードを確認
        const { data: existingData } = await supabase
          .from('facility_settings')
          .select('id')
          .eq('facility_id', facilityId)
          .single();

        const upsertData: any = {
          facility_id: facilityId,
          facility_name: updatedSettings.facilityName || null,
          regular_holidays: updatedSettings.regularHolidays,
          holiday_periods: updatedSettings.holidayPeriods || [],
          custom_holidays: updatedSettings.customHolidays,
          include_holidays: updatedSettings.includeHolidays ?? false,
          business_hours: updatedSettings.businessHours,
          capacity: updatedSettings.capacity,
          updated_at: updatedSettings.updatedAt,
        };

        // デバッグ用: 保存するデータをログに出力
        console.log('Saving facility settings:', {
          includeHolidays: updatedSettings.includeHolidays,
          upsertDataIncludeHolidays: upsertData.include_holidays,
        });

        // 既存レコードがある場合はidを指定、ない場合はidを指定しない（自動生成）
        if (existingData) {
          upsertData.id = existingData.id;
          upsertData.created_at = updatedSettings.createdAt;
        }

        // facility_idにUNIQUE制約があるため、upsertを使用
        const { data, error } = await supabase
          .from('facility_settings')
          .upsert(upsertData)
          .select()
          .single();

        if (error) {
          console.error('Error updating facility settings:', error);
          // エラーが発生した場合はローカル状態を元に戻す
          setFacilitySettings(facilitySettings);
        } else if (data) {
          // デバッグ用: 取得したデータをログに出力
          console.log('Retrieved facility settings from DB:', {
            include_holidays: data.include_holidays,
            includeHolidays: data.include_holidays ?? false,
          });
          
          // データベースから取得したデータで状態を更新
          setFacilitySettings({
            id: data.id,
            facilityId: data.facility_id,
            facilityName: data.facility_name || '',
            regularHolidays: data.regular_holidays,
            holidayPeriods: data.holiday_periods || [],
            customHolidays: data.custom_holidays,
            includeHolidays: data.include_holidays ?? false,
            businessHours: data.business_hours,
            capacity: data.capacity,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          });
        }
      } catch (error) {
        console.error('Error in updateFacilitySettings:', error);
        // エラーが発生した場合はローカル状態を元に戻す
        setFacilitySettings(facilitySettings);
      }
    }
  };

  const deleteSchedule = (scheduleId: number) => {
    setSchedules(schedules.filter((s) => s.id !== scheduleId));
    // 関連する実績も削除
    setUsageRecords(usageRecords.filter((r) => r.scheduleId !== scheduleId));
  };

  const addUsageRecord = (recordData: UsageRecordFormData) => {
    const newRecord: UsageRecord = {
      ...recordData,
      id: `record-${Date.now()}`,
      facilityId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setUsageRecords([...usageRecords, newRecord]);
    return newRecord;
  };

  const updateUsageRecord = (recordId: string, recordData: Partial<UsageRecordFormData>) => {
    setUsageRecords(
      usageRecords.map((r) =>
        r.id === recordId
          ? { ...r, ...recordData, updatedAt: new Date().toISOString() }
          : r
      )
    );
  };

  const deleteUsageRecord = (recordId: string) => {
    setUsageRecords(usageRecords.filter((r) => r.id !== recordId));
  };

  const getUsageRecordByScheduleId = (scheduleId: number): UsageRecord | undefined => {
    return usageRecords.find((r) => r.scheduleId === scheduleId);
  };

  const filteredUsageRecords = useMemo(
    () => usageRecords.filter((r) => r.facilityId === facilityId),
    [usageRecords, facilityId]
  );

  const filteredLeads = useMemo(
    () => leads.filter((l) => l.facilityId === facilityId),
    [leads, facilityId]
  );

  const filteredManagementTargets = useMemo(
    () => managementTargets.filter((t) => t.facilityId === facilityId),
    [managementTargets, facilityId]
  );

  // リード管理機能
  const addLead = (leadData: LeadFormData) => {
    const newLead: Lead = {
      ...leadData,
      id: `lead-${Date.now()}`,
      facilityId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setLeads([...leads, newLead]);
    return newLead;
  };

  const updateLead = (leadId: string, leadData: Partial<LeadFormData>) => {
    setLeads(
      leads.map((l) =>
        l.id === leadId
          ? { ...l, ...leadData, updatedAt: new Date().toISOString() }
          : l
      )
    );
  };

  const deleteLead = (leadId: string) => {
    setLeads(leads.filter((l) => l.id !== leadId));
  };

  const getLeadsByChildId = (childId: string): Lead[] => {
    return filteredLeads.filter((lead) => lead.childIds.includes(childId));
  };

  // スタッフ管理機能
  const addStaff = async (staffData: Omit<Staff, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>) => {
    const newStaffId = `staff-${Date.now()}`;
    const now = new Date().toISOString();
    
    try {
      // Supabaseに保存
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

      if (error) {
        console.error('Error adding staff to Supabase:', error);
        throw error;
      }

      // ローカル状態を更新
      const newStaff: Staff = {
        ...staffData,
        id: newStaffId,
        facilityId,
        createdAt: now,
        updatedAt: now,
      };
      setStaff([...staff, newStaff]);
      return newStaff;
    } catch (error) {
      console.error('Error in addStaff:', error);
      throw error;
    }
  };

  const updateStaff = async (staffId: string, staffData: Partial<Staff & { passwordHash?: string; hasAccount?: boolean }>) => {
    try {
      // Supabaseを更新
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

      if (error) {
        console.error('Error updating staff in Supabase:', error);
        throw error;
      }

      // ローカル状態を更新
      setStaff(
        staff.map((s) =>
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
      // Supabaseから削除
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', staffId);

      if (error) {
        console.error('Error deleting staff from Supabase:', error);
        throw error;
      }

      // ローカル状態を更新
      setStaff(staff.filter((s) => s.id !== staffId));
    } catch (error) {
      console.error('Error in deleteStaff:', error);
      throw error;
    }
  };

  // 経営目標管理機能
  const addManagementTarget = async (targetData: ManagementTargetFormData) => {
    const newTargetId = `target-${Date.now()}`;
    const now = new Date().toISOString();
    
    try {
      // Supabaseに保存
      const { data, error } = await supabase
        .from('management_targets')
        .insert({
          id: newTargetId,
          facility_id: facilityId,
          year: targetData.year,
          month: targetData.month,
          staff_salaries: targetData.staffSalaries || [],
          fixed_cost_items: targetData.fixedCostItems || [],
          variable_cost_items: targetData.variableCostItems || [],
          total_fixed_cost: targetData.totalFixedCost || 0,
          total_variable_cost: targetData.totalVariableCost || 0,
          target_revenue: targetData.targetRevenue,
          target_occupancy_rate: targetData.targetOccupancyRate,
          daily_price_per_child: targetData.dailyPricePerChild,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding management target to Supabase:', error);
        throw error;
      }

      // ローカル状態を更新
      const newTarget: ManagementTarget = {
        ...targetData,
        id: newTargetId,
        facilityId,
        createdAt: now,
        updatedAt: now,
      };
      setManagementTargets([...managementTargets, newTarget]);
      return newTarget;
    } catch (error) {
      console.error('Error in addManagementTarget:', error);
      // エラー時もローカル状態に追加（オフライン対応）
      const newTarget: ManagementTarget = {
        ...targetData,
        id: newTargetId,
        facilityId,
        createdAt: now,
        updatedAt: now,
      };
      setManagementTargets([...managementTargets, newTarget]);
      return newTarget;
    }
  };

  const updateManagementTarget = async (targetId: string, targetData: Partial<ManagementTargetFormData>) => {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (targetData.year !== undefined) updateData.year = targetData.year;
      if (targetData.month !== undefined) updateData.month = targetData.month;
      if (targetData.staffSalaries !== undefined) updateData.staff_salaries = targetData.staffSalaries;
      if (targetData.fixedCostItems !== undefined) updateData.fixed_cost_items = targetData.fixedCostItems;
      if (targetData.variableCostItems !== undefined) updateData.variable_cost_items = targetData.variableCostItems;
      if (targetData.totalFixedCost !== undefined) updateData.total_fixed_cost = targetData.totalFixedCost;
      if (targetData.totalVariableCost !== undefined) updateData.total_variable_cost = targetData.totalVariableCost;
      if (targetData.targetRevenue !== undefined) updateData.target_revenue = targetData.targetRevenue;
      if (targetData.targetOccupancyRate !== undefined) updateData.target_occupancy_rate = targetData.targetOccupancyRate;
      if (targetData.dailyPricePerChild !== undefined) updateData.daily_price_per_child = targetData.dailyPricePerChild;

      const { error } = await supabase
        .from('management_targets')
        .update(updateData)
        .eq('id', targetId);

      if (error) {
        console.error('Error updating management target in Supabase:', error);
        throw error;
      }

      // ローカル状態を更新
      setManagementTargets(
        managementTargets.map((t) =>
          t.id === targetId
            ? { ...t, ...targetData, updatedAt: new Date().toISOString() }
            : t
        )
      );
    } catch (error) {
      console.error('Error in updateManagementTarget:', error);
      // エラー時もローカル状態を更新
      setManagementTargets(
        managementTargets.map((t) =>
          t.id === targetId
            ? { ...t, ...targetData, updatedAt: new Date().toISOString() }
            : t
        )
      );
    }
  };

  const deleteManagementTarget = async (targetId: string) => {
    try {
      const { error } = await supabase
        .from('management_targets')
        .delete()
        .eq('id', targetId);

      if (error) {
        console.error('Error deleting management target from Supabase:', error);
        throw error;
      }

      // ローカル状態を更新
      setManagementTargets(managementTargets.filter((t) => t.id !== targetId));
    } catch (error) {
      console.error('Error in deleteManagementTarget:', error);
      // エラー時もローカル状態から削除
      setManagementTargets(managementTargets.filter((t) => t.id !== targetId));
    }
  };

  const getManagementTarget = (year: number, month: number): ManagementTarget | undefined => {
    return filteredManagementTargets.find(
      (t) => t.year === year && t.month === month
    );
  };

  // Supabaseから経営目標を取得
  useEffect(() => {
    if (!facilityId) return;

    const fetchManagementTargets = async () => {
      try {
        const { data, error } = await supabase
          .from('management_targets')
          .select('*')
          .eq('facility_id', facilityId)
          .order('year', { ascending: false })
          .order('month', { ascending: false });

        if (error) {
          console.error('Error fetching management targets:', error);
          return;
        }

        if (data) {
          const targetsData: ManagementTarget[] = data.map((row) => ({
            id: row.id,
            facilityId: row.facility_id,
            year: row.year,
            month: row.month,
            staffSalaries: row.staff_salaries || [],
            fixedCostItems: row.fixed_cost_items || [],
            variableCostItems: row.variable_cost_items || [],
            totalFixedCost: row.total_fixed_cost || 0,
            totalVariableCost: row.total_variable_cost || 0,
            targetRevenue: row.target_revenue || 0,
            targetOccupancyRate: row.target_occupancy_rate || 0,
            dailyPricePerChild: row.daily_price_per_child || 0,
            createdAt: row.created_at || new Date().toISOString(),
            updatedAt: row.updated_at || new Date().toISOString(),
          }));
          setManagementTargets(targetsData);
        }
      } catch (error) {
        console.error('Error in fetchManagementTargets:', error);
      }
    };

    fetchManagementTargets();
  }, [facilityId]);

  return {
    children: filteredChildren,
    staff: filteredStaff,
    schedules: filteredSchedules,
    requests: filteredRequests,
    facilitySettings,
    loadingSettings,
    loadingChildren,
    loadingStaff,
    usageRecords: filteredUsageRecords,
    leads: filteredLeads,
    managementTargets: filteredManagementTargets,
    setChildren,
    setStaff,
    setSchedules,
    setRequests,
    addChild,
    updateChild,
    deleteChild,
    addSchedule,
    addRequest,
    updateFacilitySettings,
    deleteSchedule,
    addUsageRecord,
    updateUsageRecord,
    deleteUsageRecord,
    getUsageRecordByScheduleId,
    addLead,
    updateLead,
    deleteLead,
    getLeadsByChildId,
    addStaff,
    updateStaff,
    deleteStaff,
    addManagementTarget,
    updateManagementTarget,
    deleteManagementTarget,
    getManagementTarget,
  };
};

