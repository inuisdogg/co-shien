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
  ContactLog,
  ContactLogFormData,
  Lead,
  LeadFormData,
  LeadStatus,
  ManagementTarget,
  ManagementTargetFormData,
  TimeSlot,
  FacilityTimeSlot,
  AccountStatus,
  UserPermissions,
} from '@/types';

export const useFacilityData = () => {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  // デバッグ: facilityIdが設定されているか確認
  useEffect(() => {
    if (facilityId) {
      console.log('✅ useFacilityData: facilityIdが設定されました:', facilityId);
    } else {
      console.warn('⚠️  useFacilityData: facilityIdが設定されていません。ログインが必要です。');
    }
  }, [facilityId]);

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
    businessHoursPeriods: [],
    flexibleBusinessHours: {
      default: { start: '09:00', end: '18:00' },
      dayOverrides: {},
    },
    serviceHours: {
      AM: { start: '09:00', end: '12:00' },
      PM: { start: '13:00', end: '18:00' },
    },
    flexibleServiceHours: {
      default: { start: '09:00', end: '18:00' },
      dayOverrides: {},
    },
    serviceCategories: {
      childDevelopmentSupport: false,
      afterSchoolDayService: true, // デフォルトで放デイを選択
      nurseryVisitSupport: false,
      homeBasedChildSupport: false,
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
  const [contactLogs, setContactLogs] = useState<ContactLog[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [managementTargets, setManagementTargets] = useState<ManagementTarget[]>([]);
  const [timeSlots, setTimeSlots] = useState<FacilityTimeSlot[]>([]);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(true);

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
            // 施設住所（送迎起点/終点）
            address: data.address || undefined,
            postalCode: data.postal_code || undefined,
            latitude: data.latitude || undefined,
            longitude: data.longitude || undefined,
            regularHolidays: data.regular_holidays || [0],
            holidayPeriods: data.holiday_periods || [],
            customHolidays: data.custom_holidays || [],
            includeHolidays: data.include_holidays || false,
            businessHours: data.business_hours || {
              AM: { start: '09:00', end: '12:00' },
              PM: { start: '13:00', end: '18:00' },
            },
            businessHoursPeriods: data.business_hours_periods || [],
            flexibleBusinessHours: data.flexible_business_hours || {
              default: { start: '09:00', end: '18:00' },
              dayOverrides: {},
            },
            serviceHours: data.service_hours || {
              AM: { start: '09:00', end: '12:00' },
              PM: { start: '13:00', end: '18:00' },
            },
            flexibleServiceHours: data.flexible_service_hours || {
              default: { start: '09:00', end: '18:00' },
              dayOverrides: {},
            },
            serviceCategories: data.service_categories || {
              childDevelopmentSupport: false,
              afterSchoolDayService: true,
              nurseryVisitSupport: false,
              homeBasedChildSupport: false,
            },
            capacity: data.capacity || {
              AM: 10,
              PM: 10,
            },
            // 送迎可能人数
            transportCapacity: data.transport_capacity || { pickup: 4, dropoff: 4 },
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

  // Supabaseから施設時間枠を取得
  useEffect(() => {
    if (!facilityId) {
      setLoadingTimeSlots(false);
      return;
    }

    const fetchTimeSlots = async () => {
      try {
        console.log('=== Biz側: 施設時間枠取得 ===');
        const { data, error } = await supabase
          .from('facility_time_slots')
          .select('*')
          .eq('facility_id', facilityId)
          .order('display_order', { ascending: true });

        if (error) {
          console.error('Error fetching time slots:', error);
          setLoadingTimeSlots(false);
          return;
        }

        if (data) {
          const timeSlotsData: FacilityTimeSlot[] = data.map((row) => ({
            id: row.id,
            facilityId: row.facility_id,
            name: row.name,
            startTime: row.start_time,
            endTime: row.end_time,
            capacity: row.capacity || 10,
            displayOrder: row.display_order || 0,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));
          setTimeSlots(timeSlotsData);
          console.log('✅ 施設時間枠取得成功:', timeSlotsData.length, '件');
        }
      } catch (error) {
        console.error('Error in fetchTimeSlots:', error);
      } finally {
        setLoadingTimeSlots(false);
      }
    };

    fetchTimeSlots();
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
          const childrenData: Child[] = data.map((row) => {
            // pattern_daysをパース（JSON文字列の場合）
            let patternDays: number[] | undefined = undefined;
            if (row.pattern_days) {
              try {
                patternDays = typeof row.pattern_days === 'string'
                  ? JSON.parse(row.pattern_days)
                  : Array.isArray(row.pattern_days) ? row.pattern_days : undefined;
              } catch (e) {
                console.error('Error parsing pattern_days:', e);
              }
            }

            // pattern_time_slotsをパース（JSON文字列の場合）
            let patternTimeSlots: Record<number, 'AM' | 'PM' | 'AMPM'> | undefined = undefined;
            if (row.pattern_time_slots) {
              try {
                patternTimeSlots = typeof row.pattern_time_slots === 'string'
                  ? JSON.parse(row.pattern_time_slots)
                  : typeof row.pattern_time_slots === 'object' ? row.pattern_time_slots : undefined;
              } catch (e) {
                console.error('Error parsing pattern_time_slots:', e);
              }
            }

            // 送迎場所を復元（pickup_location_customがある場合は「その他」として扱う）
            let pickupLocation = row.pickup_location;
            let pickupLocationCustom = row.pickup_location_custom;
            if (pickupLocationCustom && !['事業所', '自宅'].includes(pickupLocation || '')) {
              pickupLocation = 'その他';
            }
            
            let dropoffLocation = row.dropoff_location;
            let dropoffLocationCustom = row.dropoff_location_custom;
            if (dropoffLocationCustom && !['事業所', '自宅'].includes(dropoffLocation || '')) {
              dropoffLocation = 'その他';
            }
            
            return {
              id: row.id,
              facilityId: row.facility_id,
              name: row.name,
              nameKana: row.name_kana,
              age: row.age,
              birthDate: row.birth_date,
              guardianName: row.guardian_name,
              guardianNameKana: row.guardian_name_kana,
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
              patternDays: patternDays,
              patternTimeSlots: patternTimeSlots,
              needsPickup: row.needs_pickup || false,
              needsDropoff: row.needs_dropoff || false,
              pickupLocation: pickupLocation,
              pickupLocationCustom: pickupLocationCustom,
              // 送迎場所の住所・座標
              pickupAddress: row.pickup_address || undefined,
              pickupPostalCode: row.pickup_postal_code || undefined,
              pickupLatitude: row.pickup_latitude || undefined,
              pickupLongitude: row.pickup_longitude || undefined,
              dropoffLocation: dropoffLocation,
              dropoffLocationCustom: dropoffLocationCustom,
              dropoffAddress: row.dropoff_address || undefined,
              dropoffPostalCode: row.dropoff_postal_code || undefined,
              dropoffLatitude: row.dropoff_latitude || undefined,
              dropoffLongitude: row.dropoff_longitude || undefined,
              characteristics: row.characteristics,
              contractStatus: row.contract_status,
              contractStartDate: row.contract_start_date,
              contractEndDate: row.contract_end_date,
              registrationType: row.registration_type,
              plannedContractDays: row.planned_contract_days,
              plannedUsageStartDate: row.planned_usage_start_date,
              plannedUsageDays: row.planned_usage_days,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            };
          });
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
        // 0. 施設のオーナーユーザーIDを取得
        const { data: facilityData, error: facilityError } = await supabase
          .from('facilities')
          .select('owner_user_id')
          .eq('id', facilityId)
          .single();

        const ownerUserId = facilityData?.owner_user_id || null;
        console.log('✅ fetchStaff: ownerUserId:', ownerUserId);

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
        const existingStaffKeys = new Set<string>(); // user_idまたは(name+email)の組み合わせ

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
              .select('id, name, email, phone, birth_date, gender, address, postal_code, my_number, spouse_name, basic_pension_symbol, basic_pension_number, employment_insurance_status, employment_insurance_number, previous_retirement_date, previous_name, social_insurance_status, has_dependents, dependent_count, dependents, account_status')
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
                    } catch (e) {
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
                    id: `emp-${emp.id}`, // employment_recordのIDを使用（重複を避けるためプレフィックス）
                    facilityId: emp.facility_id,
                    name: user.name || '',
                    nameKana: '',
                    role: (emp.role as '一般スタッフ' | 'マネージャー' | '管理者') || '一般スタッフ',
                    type: (emp.employment_type === '常勤' ? '常勤' : '非常勤') as '常勤' | '非常勤',
                    facilityRole: facilityRoleFromStaff, // staffテーブルのmemoフィールドから取得した施設での役割
                    accountStatus: (user.account_status as AccountStatus) || 'pending', // アカウントステータス
                    permissions: permissions, // ダッシュボード権限
                    hasDashboardAccess: hasDashboardAccess || isMaster, // ダッシュボード権限があるかどうか（マスターは常にtrue）
                    isMaster: isMaster, // マスター管理者かどうか
                    birthDate: user.birth_date || '',
                    gender: user.gender as '男性' | '女性' | 'その他' | undefined,
                    address: user.address || '',
                    phone: user.phone || '',
                    email: user.email || '',
                    // 個人情報（usersテーブルから取得）
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
              } catch (e) {
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
                facilityRole: facilityRoleFromMemo, // memoフィールドから取得した施設での役割
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
                user_id: row.user_id, // NULLの場合はシャドウアカウント
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

  // Supabaseからスケジュールデータを取得
  useEffect(() => {
    if (!facilityId) {
      console.warn('⚠️  fetchSchedules: facilityIdが設定されていません');
      return;
    }

    const fetchSchedules = async () => {
      try {
        console.log('📅 fetchSchedules: スケジュールデータを取得中... facilityId:', facilityId);
        const { data, error } = await supabase
          .from('schedules')
          .select('*')
          .eq('facility_id', facilityId)
          .order('date', { ascending: true })
          .order('slot', { ascending: true });

        if (error) {
          console.error('❌ Error fetching schedules:', error);
          return;
        }

        console.log('✅ fetchSchedules: スケジュールデータ取得成功:', data?.length || 0, '件');
        if (data) {
          const schedulesData: ScheduleItem[] = data.map((row) => ({
            id: row.id,
            facilityId: row.facility_id,
            date: row.date,
            childId: row.child_id,
            childName: row.child_name,
            slot: row.slot as TimeSlot,
            hasPickup: row.has_pickup || false,
            hasDropoff: row.has_dropoff || false,
            staffId: row.staff_id || undefined,
            createdAt: row.created_at || new Date().toISOString(),
            updatedAt: row.updated_at || new Date().toISOString(),
          }));
          setSchedules(schedulesData);
        }
      } catch (error) {
        console.error('❌ Error in fetchSchedules:', error);
      }
    };

    fetchSchedules();
  }, [facilityId]);

  // Supabaseから連絡帳データを取得
  useEffect(() => {
    if (!facilityId) {
      return;
    }

    const fetchContactLogs = async () => {
      try {
        console.log('📋 fetchContactLogs: 連絡帳データを取得中... facilityId:', facilityId);
        const { data, error } = await supabase
          .from('contact_logs')
          .select('*')
          .eq('facility_id', facilityId)
          .order('date', { ascending: false });

        if (error) {
          console.error('❌ Error fetching contact logs:', error);
          return;
        }

        console.log('✅ fetchContactLogs: 連絡帳データ取得成功:', data?.length || 0, '件');
        if (data) {
          const contactLogsData: ContactLog[] = data.map((row) => ({
            id: row.id,
            facilityId: row.facility_id,
            childId: row.child_id,
            scheduleId: row.schedule_id || undefined,
            date: row.date,
            slot: row.slot || undefined,
            activities: row.activities || undefined,
            healthStatus: row.health_status || undefined,
            mood: row.mood || undefined,
            appetite: row.appetite || undefined,
            mealMain: row.meal_main || false,
            mealSide: row.meal_side || false,
            mealNotes: row.meal_notes || undefined,
            toiletCount: row.toilet_count || 0,
            toiletNotes: row.toilet_notes || undefined,
            napStartTime: row.nap_start_time || undefined,
            napEndTime: row.nap_end_time || undefined,
            napNotes: row.nap_notes || undefined,
            staffComment: row.staff_comment || undefined,
            staffUserId: row.staff_user_id || undefined,
            parentMessage: row.parent_message || undefined,
            parentReply: row.parent_reply || undefined,
            parentReplyAt: row.parent_reply_at || undefined,
            isSigned: row.is_signed || false,
            signedAt: row.signed_at || undefined,
            signedByUserId: row.signed_by_user_id || undefined,
            signatureData: row.signature_data || undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            createdBy: row.created_by || undefined,
          }));
          setContactLogs(contactLogsData);
        }
      } catch (error) {
        console.error('❌ Error in fetchContactLogs:', error);
      }
    };

    fetchContactLogs();
  }, [facilityId]);

  // Supabaseからリードデータを取得
  useEffect(() => {
    if (!facilityId) {
      console.warn('⚠️  fetchLeads: facilityIdが設定されていません');
      return;
    }

    const fetchLeads = async () => {
      try {
        console.log('📞 fetchLeads: リードデータを取得中... facilityId:', facilityId);
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .eq('facility_id', facilityId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ Error fetching leads:', error);
          return;
        }

        console.log('✅ fetchLeads: リードデータ取得成功:', data?.length || 0, '件');
        if (data) {
          const leadsData: Lead[] = data.map((row) => ({
            id: row.id,
            facilityId: row.facility_id,
            name: row.name,
            childName: row.child_name || '',
            status: row.status as LeadStatus,
            phone: row.phone || '',
            email: row.email || '',
            address: row.address || '',
            expectedStartDate: row.expected_start_date || '',
            preferredDays: row.preferred_days || [],
            pickupOption: row.pickup_option || null,
            inquirySource: row.inquiry_source || null,
            inquirySourceDetail: row.inquiry_source_detail || null,
            childIds: row.child_ids || [],
            memo: row.memo || '',
            createdAt: row.created_at || new Date().toISOString(),
            updatedAt: row.updated_at || new Date().toISOString(),
          }));
          setLeads(leadsData);
        }
      } catch (error) {
        console.error('❌ Error in fetchLeads:', error);
      }
    };

    fetchLeads();
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
      // 送迎場所を統合（「その他」の場合は自由記入の値を保存）
      const finalPickupLocation = child.pickupLocation === 'その他' 
        ? child.pickupLocationCustom || ''
        : child.pickupLocation || '';
      const finalDropoffLocation = child.dropoffLocation === 'その他'
        ? child.dropoffLocationCustom || ''
        : child.dropoffLocation || '';
      
      // Supabaseに保存
      const { data, error } = await supabase
        .from('children')
        .insert({
          id: newChildId,
          facility_id: facilityId,
          name: child.name,
          name_kana: child.nameKana,
          age: child.age,
          birth_date: child.birthDate,
          guardian_name: child.guardianName,
          guardian_name_kana: child.guardianNameKana,
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
          pattern_days: child.patternDays || null,
          pattern_time_slots: child.patternTimeSlots || null,
          needs_pickup: child.needsPickup || false,
          needs_dropoff: child.needsDropoff || false,
          pickup_location: finalPickupLocation,
          pickup_location_custom: child.pickupLocationCustom,
          // 送迎場所の住所・座標
          pickup_address: child.pickupAddress || null,
          pickup_postal_code: child.pickupPostalCode || null,
          pickup_latitude: child.pickupLatitude || null,
          pickup_longitude: child.pickupLongitude || null,
          dropoff_location: finalDropoffLocation,
          dropoff_location_custom: child.dropoffLocationCustom,
          dropoff_address: child.dropoffAddress || null,
          dropoff_postal_code: child.dropoffPostalCode || null,
          dropoff_latitude: child.dropoffLatitude || null,
          dropoff_longitude: child.dropoffLongitude || null,
          characteristics: child.characteristics,
          contract_status: child.contractStatus,
          contract_start_date: child.contractStartDate,
          contract_end_date: child.contractEndDate,
          registration_type: child.registrationType,
          planned_contract_days: child.plannedContractDays,
          planned_usage_start_date: child.plannedUsageStartDate,
          planned_usage_days: child.plannedUsageDays,
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
      // 送迎場所を統合（「その他」の場合は自由記入の値を保存）
      const finalPickupLocation = child.pickupLocation === 'その他'
        ? child.pickupLocationCustom || ''
        : child.pickupLocation || '';
      const finalDropoffLocation = child.dropoffLocation === 'その他'
        ? child.dropoffLocationCustom || ''
        : child.dropoffLocation || '';
      
      // Supabaseを更新
      const { error } = await supabase
        .from('children')
        .update({
          name: child.name,
          name_kana: child.nameKana,
          age: child.age,
          birth_date: child.birthDate,
          guardian_name: child.guardianName,
          guardian_name_kana: child.guardianNameKana,
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
          pattern_days: child.patternDays || null,
          pattern_time_slots: child.patternTimeSlots || null,
          needs_pickup: child.needsPickup || false,
          needs_dropoff: child.needsDropoff || false,
          pickup_location: finalPickupLocation,
          pickup_location_custom: child.pickupLocationCustom,
          // 送迎場所の住所・座標
          pickup_address: child.pickupAddress || null,
          pickup_postal_code: child.pickupPostalCode || null,
          pickup_latitude: child.pickupLatitude || null,
          pickup_longitude: child.pickupLongitude || null,
          dropoff_location: finalDropoffLocation,
          dropoff_location_custom: child.dropoffLocationCustom,
          dropoff_address: child.dropoffAddress || null,
          dropoff_postal_code: child.dropoffPostalCode || null,
          dropoff_latitude: child.dropoffLatitude || null,
          dropoff_longitude: child.dropoffLongitude || null,
          characteristics: child.characteristics,
          contract_status: child.contractStatus,
          contract_start_date: child.contractStartDate,
          contract_end_date: child.contractEndDate,
          registration_type: child.registrationType,
          planned_contract_days: child.plannedContractDays,
          planned_usage_start_date: child.plannedUsageStartDate,
          planned_usage_days: child.plannedUsageDays,
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

  const addSchedule = async (schedule: Omit<ScheduleItem, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>) => {
    if (!facilityId) {
      console.error('❌ addSchedule: facilityIdが設定されていません');
      throw new Error('施設IDが設定されていません。ログインしてください。');
    }

    console.log('💾 addSchedule: スケジュールを保存中... facilityId:', facilityId, 'date:', schedule.date);
    const scheduleId = `schedule-${Date.now()}`;
    const now = new Date().toISOString();
    
    try {
      // Supabaseに保存
      const { data, error } = await supabase
        .from('schedules')
        .insert({
          id: scheduleId,
          facility_id: facilityId,
          child_id: schedule.childId,
          child_name: schedule.childName,
          date: schedule.date,
          slot: schedule.slot,
          has_pickup: schedule.hasPickup || false,
          has_dropoff: schedule.hasDropoff || false,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error adding schedule to Supabase:', error);
        throw error;
      }

      console.log('✅ addSchedule: スケジュールを保存しました:', schedule.childName, schedule.date, schedule.slot);
      // ローカル状態を更新
      const newSchedule: ScheduleItem = {
        ...schedule,
        id: scheduleId,
        facilityId,
        createdAt: now,
        updatedAt: now,
      };
      setSchedules([...schedules, newSchedule]);
      return newSchedule;
    } catch (error) {
      console.error('Error in addSchedule:', error);
      throw error;
    }
  };

  const addRequest = (request: Omit<BookingRequest, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>) => {
    const newRequest: BookingRequest = {
      ...request,
      id: `request-${Date.now()}`,
      facilityId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setRequests([...requests, newRequest]);
    return newRequest;
  };

  const updateFacilitySettings = async (settings: Partial<FacilitySettings>, changeDescription?: string) => {
    const updatedSettings = {
      ...facilitySettings,
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    
    // 変更履歴を記録
    const { data: { user } } = await supabase.auth.getUser();
    const changedBy = user?.id || null;
    
    // 変更タイプを判定（複数のフィールドが変更される可能性があるため、より柔軟に判定）
    let changeType: 'business_hours' | 'holidays' | 'capacity' | 'all' = 'all';
    const hasBusinessHoursChange = settings.businessHours !== undefined;
    const hasHolidaysChange = settings.regularHolidays !== undefined || settings.holidayPeriods !== undefined || settings.customHolidays !== undefined || settings.includeHolidays !== undefined;
    const hasCapacityChange = settings.capacity !== undefined;
    
    if (hasCapacityChange && !hasBusinessHoursChange && !hasHolidaysChange) {
      changeType = 'capacity';
    } else if (hasHolidaysChange && !hasBusinessHoursChange && !hasCapacityChange) {
      changeType = 'holidays';
    } else if (hasBusinessHoursChange && !hasHolidaysChange && !hasCapacityChange) {
      changeType = 'business_hours';
    } else {
      changeType = 'all';
    }
    
    // 変更前の値を保存
    const oldValue = {
      businessHours: facilitySettings.businessHours,
      regularHolidays: facilitySettings.regularHolidays,
      holidayPeriods: facilitySettings.holidayPeriods,
      customHolidays: facilitySettings.customHolidays,
      includeHolidays: facilitySettings.includeHolidays,
      capacity: facilitySettings.capacity,
      businessHoursPeriods: facilitySettings.businessHoursPeriods,
    };
    
    const newValue = {
      businessHours: updatedSettings.businessHours,
      regularHolidays: updatedSettings.regularHolidays,
      holidayPeriods: updatedSettings.holidayPeriods,
      customHolidays: updatedSettings.customHolidays,
      includeHolidays: updatedSettings.includeHolidays,
      capacity: updatedSettings.capacity,
      businessHoursPeriods: updatedSettings.businessHoursPeriods,
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
          // 施設住所（送迎起点/終点）
          address: updatedSettings.address || null,
          postal_code: updatedSettings.postalCode || null,
          latitude: updatedSettings.latitude || null,
          longitude: updatedSettings.longitude || null,
          regular_holidays: updatedSettings.regularHolidays,
          holiday_periods: updatedSettings.holidayPeriods || [],
          custom_holidays: updatedSettings.customHolidays,
          include_holidays: updatedSettings.includeHolidays ?? false,
          business_hours: updatedSettings.businessHours,
          business_hours_periods: updatedSettings.businessHoursPeriods || [],
          flexible_business_hours: updatedSettings.flexibleBusinessHours || null,
          service_hours: updatedSettings.serviceHours || null,
          flexible_service_hours: updatedSettings.flexibleServiceHours || null,
          service_categories: updatedSettings.serviceCategories || null,
          capacity: updatedSettings.capacity,
          // 送迎可能人数
          transport_capacity: updatedSettings.transportCapacity || { pickup: 4, dropoff: 4 },
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
          console.error('❌ Error updating facility settings:', error);
          // エラーが発生した場合はローカル状態を元に戻す
          setFacilitySettings(facilitySettings);
          throw error;
        } else if (data) {
          console.log('✅ updateFacilitySettings: 施設設定を保存しました');
          // 変更履歴を保存
          try {
            await supabase.from('facility_settings_history').insert({
              facility_id: facilityId,
              change_type: changeType,
              old_value: oldValue,
              new_value: newValue,
              changed_by: changedBy,
              description: changeDescription,
            });
          } catch (historyError) {
            console.error('Error saving facility settings history:', historyError);
            // 履歴の保存に失敗してもメインの保存は成功しているので続行
          }
          
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
            // 施設住所（送迎起点/終点）
            address: data.address || undefined,
            postalCode: data.postal_code || undefined,
            latitude: data.latitude || undefined,
            longitude: data.longitude || undefined,
            regularHolidays: data.regular_holidays,
            holidayPeriods: data.holiday_periods || [],
            customHolidays: data.custom_holidays,
            includeHolidays: data.include_holidays ?? false,
            businessHours: data.business_hours,
            businessHoursPeriods: data.business_hours_periods || [],
            capacity: data.capacity,
            // 送迎可能人数
            transportCapacity: data.transport_capacity || { pickup: 4, dropoff: 4 },
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

  const deleteSchedule = async (scheduleId: string) => {
    try {
      // Supabaseから削除
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', scheduleId);

      if (error) {
        console.error('Error deleting schedule from Supabase:', error);
        throw error;
      }

      // ローカル状態を更新
      setSchedules(schedules.filter((s) => s.id !== scheduleId));
      // 関連する実績も削除
      setUsageRecords(usageRecords.filter((r) => r.scheduleId !== scheduleId));
    } catch (error) {
      console.error('Error in deleteSchedule:', error);
      throw error;
    }
  };

  // スケジュールを別の時間枠に移動
  const moveSchedule = async (scheduleId: string, newSlot: TimeSlot) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) {
      throw new Error('スケジュールが見つかりません');
    }

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('schedules')
        .update({
          slot: newSlot,
          updated_at: now,
        })
        .eq('id', scheduleId);

      if (error) {
        console.error('Error moving schedule:', error);
        throw error;
      }

      // ローカル状態を更新
      setSchedules(schedules.map(s =>
        s.id === scheduleId
          ? { ...s, slot: newSlot, updatedAt: now }
          : s
      ));
    } catch (error) {
      console.error('Error in moveSchedule:', error);
      throw error;
    }
  };

  // スケジュールの送迎設定を更新
  const updateScheduleTransport = async (scheduleId: string, hasPickup: boolean, hasDropoff: boolean) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) {
      throw new Error('スケジュールが見つかりません');
    }

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('schedules')
        .update({
          has_pickup: hasPickup,
          has_dropoff: hasDropoff,
          updated_at: now,
        })
        .eq('id', scheduleId);

      if (error) {
        console.error('Error updating schedule transport:', error);
        throw error;
      }

      // ローカル状態を更新
      setSchedules(schedules.map(s =>
        s.id === scheduleId
          ? { ...s, hasPickup, hasDropoff, updatedAt: now }
          : s
      ));
    } catch (error) {
      console.error('Error in updateScheduleTransport:', error);
      throw error;
    }
  };

  // パターンに基づいて月間一括登録
  const bulkRegisterFromPatterns = async (
    year: number,
    month: number
  ): Promise<{ added: number; skipped: number }> => {
    if (!facilityId) {
      throw new Error('施設IDが設定されていません');
    }

    let added = 0;
    let skipped = 0;

    // 月の日数を取得
    const daysInMonth = new Date(year, month, 0).getDate();

    // 既存のスケジュールを取得（重複チェック用）
    const existingSchedules = new Set(
      schedules
        .filter(s => {
          const [y, m] = s.date.split('-').map(Number);
          return y === year && m === month;
        })
        .map(s => `${s.date}-${s.childId}-${s.slot}`)
    );

    // 施設設定から休日情報を取得
    const regularHolidays = facilitySettings.regularHolidays || [0];
    const customHolidays = facilitySettings.customHolidays || [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = dateObj.getDay();

      // 定休日チェック
      if (regularHolidays.includes(dayOfWeek)) {
        continue;
      }

      // カスタム休日チェック
      if (customHolidays.includes(date)) {
        continue;
      }

      for (const child of children) {
        // パターンに含まれる曜日かチェック
        if (!child.patternDays?.includes(dayOfWeek)) {
          continue;
        }

        // 時間枠を取得
        const timeSlot = child.patternTimeSlots?.[dayOfWeek];
        if (!timeSlot) {
          continue;
        }

        // AMPM の場合は両方に登録
        const slotsToRegister: TimeSlot[] = timeSlot === 'AMPM' ? ['AM', 'PM'] : [timeSlot as TimeSlot];

        for (const slot of slotsToRegister) {
          // 重複チェック
          const key = `${date}-${child.id}-${slot}`;
          if (existingSchedules.has(key)) {
            skipped++;
            continue;
          }

          // 登録
          try {
            await addSchedule({
              date,
              childId: child.id,
              childName: child.name,
              slot,
              hasPickup: child.needsPickup || false,
              hasDropoff: child.needsDropoff || false,
            });
            existingSchedules.add(key); // 重複防止のため追加
            added++;
          } catch (error) {
            console.error(`Error adding schedule for ${child.name} on ${date}:`, error);
            skipped++;
          }
        }
      }
    }

    return { added, skipped };
  };

  // 日次リセット（実績登録済みは除外）
  const resetDaySchedules = async (date: string): Promise<number> => {
    if (!facilityId) {
      throw new Error('施設IDが設定されていません');
    }

    // この日のスケジュールを取得
    const daySchedules = schedules.filter(s => s.date === date);

    // 実績登録済みでないもののみ削除
    const schedulesToDelete = daySchedules.filter(s => !getUsageRecordByScheduleId(s.id));

    let deleted = 0;
    for (const schedule of schedulesToDelete) {
      try {
        await deleteSchedule(schedule.id);
        deleted++;
      } catch (error) {
        console.error(`Error deleting schedule ${schedule.id}:`, error);
      }
    }

    return deleted;
  };

  // 月次リセット（実績登録済みは除外）
  const resetMonthSchedules = async (year: number, month: number): Promise<number> => {
    if (!facilityId) {
      throw new Error('施設IDが設定されていません');
    }

    // 指定月のスケジュールを取得
    const monthSchedules = schedules.filter(s => {
      const [y, m] = s.date.split('-').map(Number);
      return y === year && m === month;
    });

    // 実績登録済みでないもののみ削除
    const schedulesToDelete = monthSchedules.filter(s => !getUsageRecordByScheduleId(s.id));

    let deleted = 0;
    for (const schedule of schedulesToDelete) {
      try {
        await deleteSchedule(schedule.id);
        deleted++;
      } catch (error) {
        console.error(`Error deleting schedule ${schedule.id}:`, error);
      }
    }

    return deleted;
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

  const getUsageRecordByScheduleId = (scheduleId: string): UsageRecord | undefined => {
    return usageRecords.find((r) => r.scheduleId === scheduleId);
  };

  const filteredUsageRecords = useMemo(
    () => usageRecords.filter((r) => r.facilityId === facilityId),
    [usageRecords, facilityId]
  );

  // 連絡帳機能
  const filteredContactLogs = useMemo(
    () => contactLogs.filter((c) => c.facilityId === facilityId),
    [contactLogs, facilityId]
  );

  const getContactLogByScheduleId = (scheduleId: string): ContactLog | undefined => {
    return contactLogs.find((c) => c.scheduleId === scheduleId);
  };

  const getContactLogByChildAndDate = (childId: string, date: string, slot?: string): ContactLog | undefined => {
    return contactLogs.find((c) =>
      c.childId === childId &&
      c.date === date &&
      (slot ? c.slot === slot : true)
    );
  };

  const addContactLog = async (data: ContactLogFormData) => {
    if (!facilityId) {
      throw new Error('施設IDが設定されていません');
    }

    const contactLogId = `contact-${Date.now()}`;
    const now = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('contact_logs')
        .insert({
          id: contactLogId,
          facility_id: facilityId,
          child_id: data.childId,
          schedule_id: data.scheduleId || null,
          date: data.date,
          slot: data.slot || null,
          activities: data.activities || null,
          health_status: data.healthStatus || null,
          mood: data.mood || null,
          appetite: data.appetite || null,
          meal_main: data.mealMain || false,
          meal_side: data.mealSide || false,
          meal_notes: data.mealNotes || null,
          toilet_count: data.toiletCount || 0,
          toilet_notes: data.toiletNotes || null,
          nap_start_time: data.napStartTime || null,
          nap_end_time: data.napEndTime || null,
          nap_notes: data.napNotes || null,
          staff_comment: data.staffComment || null,
          staff_user_id: data.staffUserId || null,
          parent_message: data.parentMessage || null,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding contact log:', error);
        throw error;
      }

      const newContactLog: ContactLog = {
        ...data,
        id: contactLogId,
        facilityId,
        createdAt: now,
        updatedAt: now,
      };
      setContactLogs([...contactLogs, newContactLog]);
      return newContactLog;
    } catch (error) {
      console.error('Error in addContactLog:', error);
      throw error;
    }
  };

  const updateContactLog = async (contactLogId: string, data: Partial<ContactLogFormData>) => {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (data.activities !== undefined) updateData.activities = data.activities;
      if (data.healthStatus !== undefined) updateData.health_status = data.healthStatus;
      if (data.mood !== undefined) updateData.mood = data.mood;
      if (data.appetite !== undefined) updateData.appetite = data.appetite;
      if (data.mealMain !== undefined) updateData.meal_main = data.mealMain;
      if (data.mealSide !== undefined) updateData.meal_side = data.mealSide;
      if (data.mealNotes !== undefined) updateData.meal_notes = data.mealNotes;
      if (data.toiletCount !== undefined) updateData.toilet_count = data.toiletCount;
      if (data.toiletNotes !== undefined) updateData.toilet_notes = data.toiletNotes;
      if (data.napStartTime !== undefined) updateData.nap_start_time = data.napStartTime;
      if (data.napEndTime !== undefined) updateData.nap_end_time = data.napEndTime;
      if (data.napNotes !== undefined) updateData.nap_notes = data.napNotes;
      if (data.staffComment !== undefined) updateData.staff_comment = data.staffComment;
      if (data.parentMessage !== undefined) updateData.parent_message = data.parentMessage;

      const { error } = await supabase
        .from('contact_logs')
        .update(updateData)
        .eq('id', contactLogId);

      if (error) {
        console.error('Error updating contact log:', error);
        throw error;
      }

      setContactLogs(
        contactLogs.map((c) =>
          c.id === contactLogId
            ? { ...c, ...data, updatedAt: updateData.updated_at }
            : c
        )
      );
    } catch (error) {
      console.error('Error in updateContactLog:', error);
      throw error;
    }
  };

  const deleteContactLog = async (contactLogId: string) => {
    try {
      const { error } = await supabase
        .from('contact_logs')
        .delete()
        .eq('id', contactLogId);

      if (error) {
        console.error('Error deleting contact log:', error);
        throw error;
      }

      setContactLogs(contactLogs.filter((c) => c.id !== contactLogId));
    } catch (error) {
      console.error('Error in deleteContactLog:', error);
      throw error;
    }
  };

  const filteredLeads = useMemo(
    () => leads.filter((l) => l.facilityId === facilityId),
    [leads, facilityId]
  );

  const filteredManagementTargets = useMemo(
    () => managementTargets.filter((t) => t.facilityId === facilityId),
    [managementTargets, facilityId]
  );

  // リード管理機能
  const addLead = async (leadData: LeadFormData) => {
    if (!facilityId) {
      console.error('❌ addLead: facilityIdが設定されていません');
      throw new Error('施設IDが設定されていません。ログインしてください。');
    }

    console.log('💾 addLead: リードを保存中... facilityId:', facilityId, 'name:', leadData.name);
    const leadId = `lead-${Date.now()}`;
    const now = new Date().toISOString();
    
    try {
      // Supabaseに保存
      const { data, error } = await supabase
        .from('leads')
        .insert({
          id: leadId,
          facility_id: facilityId,
          name: leadData.name,
          child_name: null, // 関連児童登録で登録した児童と結びつけるため不要
          status: leadData.status,
          phone: leadData.phone,
          email: leadData.email,
          address: leadData.address,
          expected_start_date: leadData.expectedStartDate || null,
          preferred_days: leadData.preferredDays || [],
          pickup_option: leadData.pickupOption || null,
          inquiry_source: leadData.inquirySource || null,
          inquiry_source_detail: leadData.inquirySourceDetail || null,
          child_ids: leadData.childIds || [],
          memo: leadData.memo || null,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error adding lead to Supabase:', error);
        throw error;
      }

      console.log('✅ addLead: リードを保存しました:', leadData.name);
      // ローカル状態を更新
      const newLead: Lead = {
        ...leadData,
        id: leadId,
        facilityId,
        createdAt: now,
        updatedAt: now,
      };
      setLeads([...leads, newLead]);
      return newLead;
    } catch (error) {
      console.error('Error in addLead:', error);
      throw error;
    }
  };

  const updateLead = async (leadId: string, leadData: Partial<LeadFormData>) => {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (leadData.name !== undefined) updateData.name = leadData.name;
      // childNameは関連児童登録で登録した児童と結びつけるため不要（nullを設定）
      updateData.child_name = null;
      if (leadData.status !== undefined) updateData.status = leadData.status;
      if (leadData.phone !== undefined) updateData.phone = leadData.phone;
      if (leadData.email !== undefined) updateData.email = leadData.email;
      if (leadData.address !== undefined) updateData.address = leadData.address;
      if (leadData.expectedStartDate !== undefined) updateData.expected_start_date = leadData.expectedStartDate || null;
      if (leadData.preferredDays !== undefined) updateData.preferred_days = leadData.preferredDays || [];
      if (leadData.pickupOption !== undefined) updateData.pickup_option = leadData.pickupOption || null;
      if (leadData.inquirySource !== undefined) updateData.inquiry_source = leadData.inquirySource || null;
      if (leadData.inquirySourceDetail !== undefined) updateData.inquiry_source_detail = leadData.inquirySourceDetail || null;
      if (leadData.childIds !== undefined) updateData.child_ids = leadData.childIds || [];
      if (leadData.memo !== undefined) updateData.memo = leadData.memo || null;

      const { error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', leadId);

      if (error) {
        console.error('Error updating lead in Supabase:', error);
        throw error;
      }

      // ローカル状態を更新
      setLeads(
        leads.map((l) =>
          l.id === leadId
            ? { ...l, ...leadData, updatedAt: new Date().toISOString() }
            : l
        )
      );
    } catch (error) {
      console.error('Error in updateLead:', error);
      throw error;
    }
  };

  const deleteLead = async (leadId: string) => {
    try {
      // Supabaseから削除
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId);

      if (error) {
        console.error('Error deleting lead from Supabase:', error);
        throw error;
      }

      // ローカル状態を更新
      setLeads(leads.filter((l) => l.id !== leadId));
    } catch (error) {
      console.error('Error in deleteLead:', error);
      throw error;
    }
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

  // シフト管理機能
  const saveShifts = async (shifts: Record<string, Record<string, boolean>>) => {
    console.log('💾 saveShifts 開始:', { facilityId, shiftsCount: Object.keys(shifts).length });

    if (!facilityId) {
      console.warn('⚠️  saveShifts: facilityIdが設定されていません');
      throw new Error('施設IDが設定されていません');
    }

    try {
      console.log('💾 saveShifts: シフトデータを保存中...', Object.keys(shifts).length, '名分');

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
              console.log('📝 staffテーブルにエントリを作成:', usersWithoutStaff.length, '件');

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
        console.log('📋 staff ID マッピング:', staffIdMapping);
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
          console.warn('⚠️  スキップ: マッピングできないstaff ID:', staffId);
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
        console.log('⚠️  saveShifts: 保存するシフトデータがありません');
        return;
      }

      // upsertを使用して保存（UNIQUE制約: facility_id, staff_id, date）
      const now = new Date().toISOString();
      const upsertData = shiftData.map(shift => ({
        ...shift,
        updated_at: now,
      }));

      console.log('📤 saveShifts: upsertするデータ:', upsertData.length, '件', upsertData.slice(0, 3));

      const { error: upsertError } = await supabase
        .from('shifts')
        .upsert(upsertData, { onConflict: 'facility_id,staff_id,date' });

      if (upsertError) {
        console.error('❌ Error upserting shifts:', upsertError);
        console.error('❌ Error details:', JSON.stringify(upsertError, null, 2));
        throw upsertError;
      }

      console.log('✅ saveShifts: シフトデータを保存しました', shiftData.length, '件');
    } catch (error) {
      console.error('❌ Error in saveShifts:', error);
      throw error;
    }
  };

  const fetchShifts = async (startDate: string, endDate: string): Promise<Record<string, Record<string, boolean>>> => {
    if (!facilityId) {
      console.warn('⚠️  fetchShifts: facilityIdが設定されていません');
      return {};
    }

    try {
      console.log('🕐 fetchShifts: シフトデータを取得中...', startDate, '～', endDate);

      // シフトデータを取得
      const { data, error } = await supabase
        .from('shifts')
        .select('staff_id, date, has_shift')
        .eq('facility_id', facilityId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) {
        console.error('❌ Error fetching shifts:', error);
        return {};
      }

      // staff_id → emp-{employment_record_id} の逆マッピングを作成
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
            for (const staff of staffRecords) {
              const emp = empRecords.find(e => e.user_id === staff.user_id);
              if (emp) {
                // staff.id → emp-{emp.id} のマッピング
                reverseMapping[staff.id] = `emp-${emp.id}`;
              }
            }
          }
        }
      }

      console.log('📋 逆マッピング:', Object.keys(reverseMapping).length, '件');

      const shifts: Record<string, Record<string, boolean>> = {};
      if (data) {
        for (const row of data) {
          // staff_idを元のID（emp-付き または そのまま）に変換
          const originalId = reverseMapping[row.staff_id] || row.staff_id;
          if (!shifts[originalId]) {
            shifts[originalId] = {};
          }
          shifts[originalId][row.date] = row.has_shift;
        }
        console.log('✅ fetchShifts: シフトデータ取得成功:', data.length, '件');
      } else {
        console.log('⚠️  fetchShifts: シフトデータがありません');
      }

      return shifts;
    } catch (error) {
      console.error('❌ Error in fetchShifts:', error);
      return {};
    }
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

  // 時間枠管理機能
  const addTimeSlot = async (slotData: Omit<FacilityTimeSlot, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>) => {
    if (!facilityId) {
      throw new Error('施設IDが設定されていません');
    }

    try {
      const { data, error } = await supabase
        .from('facility_time_slots')
        .insert({
          facility_id: facilityId,
          name: slotData.name,
          start_time: slotData.startTime,
          end_time: slotData.endTime,
          capacity: slotData.capacity,
          display_order: slotData.displayOrder,
        })
        .select()
        .single();

      if (error) throw error;

      const newSlot: FacilityTimeSlot = {
        id: data.id,
        facilityId: data.facility_id,
        name: data.name,
        startTime: data.start_time,
        endTime: data.end_time,
        capacity: data.capacity,
        displayOrder: data.display_order,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
      setTimeSlots([...timeSlots, newSlot].sort((a, b) => a.displayOrder - b.displayOrder));
      return newSlot;
    } catch (error) {
      console.error('Error adding time slot:', error);
      throw error;
    }
  };

  const updateTimeSlot = async (slotId: string, slotData: Partial<Omit<FacilityTimeSlot, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>>) => {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (slotData.name !== undefined) updateData.name = slotData.name;
      if (slotData.startTime !== undefined) updateData.start_time = slotData.startTime;
      if (slotData.endTime !== undefined) updateData.end_time = slotData.endTime;
      if (slotData.capacity !== undefined) updateData.capacity = slotData.capacity;
      if (slotData.displayOrder !== undefined) updateData.display_order = slotData.displayOrder;

      const { error } = await supabase
        .from('facility_time_slots')
        .update(updateData)
        .eq('id', slotId);

      if (error) throw error;

      setTimeSlots(
        timeSlots
          .map((s) => (s.id === slotId ? { ...s, ...slotData, updatedAt: new Date().toISOString() } : s))
          .sort((a, b) => a.displayOrder - b.displayOrder)
      );
    } catch (error) {
      console.error('Error updating time slot:', error);
      throw error;
    }
  };

  const deleteTimeSlot = async (slotId: string) => {
    try {
      const { error } = await supabase
        .from('facility_time_slots')
        .delete()
        .eq('id', slotId);

      if (error) throw error;

      setTimeSlots(timeSlots.filter((s) => s.id !== slotId));
    } catch (error) {
      console.error('Error deleting time slot:', error);
      throw error;
    }
  };

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
    contactLogs: filteredContactLogs,
    leads: filteredLeads,
    managementTargets: filteredManagementTargets,
    timeSlots,
    loadingTimeSlots,
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
    moveSchedule,
    updateScheduleTransport,
    bulkRegisterFromPatterns,
    resetDaySchedules,
    resetMonthSchedules,
    addUsageRecord,
    updateUsageRecord,
    deleteUsageRecord,
    getUsageRecordByScheduleId,
    addContactLog,
    updateContactLog,
    deleteContactLog,
    getContactLogByScheduleId,
    getContactLogByChildAndDate,
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
    saveShifts,
    fetchShifts,
    addTimeSlot,
    updateTimeSlot,
    deleteTimeSlot,
  };
};

