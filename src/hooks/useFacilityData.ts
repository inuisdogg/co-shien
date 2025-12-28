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

  // Supabaseから施設設定を取得
  useEffect(() => {
    if (!facilityId) {
      setLoadingSettings(false);
      return;
    }

    const fetchFacilitySettings = async () => {
      try {
        const { data, error } = await supabase
          .from('facility_settings')
          .select('*')
          .eq('facility_id', facilityId)
          .single();

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
            customHolidays: data.custom_holidays || [],
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
        const { data, error } = await supabase
          .from('staff')
          .select('*')
          .eq('facility_id', facilityId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching staff:', error);
          setLoadingStaff(false);
          return;
        }

        if (data) {
          // データベースのスネークケースをキャメルケースに変換
          const staffData: Staff[] = data.map((row) => ({
            id: row.id,
            facilityId: row.facility_id,
            name: row.name,
            nameKana: row.name_kana,
            role: row.role,
            type: row.type,
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
            defaultShiftPattern: row.default_shift_pattern && Array.isArray(row.default_shift_pattern) 
              ? row.default_shift_pattern as boolean[] 
              : undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));
          setStaff(staffData);
        }
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
          custom_holidays: updatedSettings.customHolidays,
          business_hours: updatedSettings.businessHours,
          capacity: updatedSettings.capacity,
          updated_at: updatedSettings.updatedAt,
        };

        // 既存レコードがある場合はidを指定、ない場合はidを指定しない（自動生成）
        if (existingData) {
          upsertData.id = existingData.id;
          upsertData.created_at = updatedSettings.createdAt;
        }

        const { data, error } = await supabase
          .from('facility_settings')
          .upsert(upsertData)
          .eq('facility_id', facilityId)
          .select()
          .single();

        if (error) {
          console.error('Error updating facility settings:', error);
          // エラーが発生した場合はローカル状態を元に戻す
          setFacilitySettings(facilitySettings);
        } else if (data) {
          // データベースから取得したデータで状態を更新
          setFacilitySettings({
            id: data.id,
            facilityId: data.facility_id,
            facilityName: data.facility_name || '',
            regularHolidays: data.regular_holidays,
            customHolidays: data.custom_holidays,
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

  const updateStaff = async (staffId: string, staffData: Partial<Staff>) => {
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
  };
};

