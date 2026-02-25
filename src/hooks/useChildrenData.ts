/**
 * 児童データ管理フック
 * children テーブルの取得・CRUD操作
 */

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Child } from '@/types';

function mapRowToChild(row: any): Child {
  let patternDays: number[] | undefined = undefined;
  if (row.pattern_days) {
    try {
      patternDays = typeof row.pattern_days === 'string'
        ? JSON.parse(row.pattern_days)
        : Array.isArray(row.pattern_days) ? row.pattern_days : undefined;
    } catch { /* ignore */ }
  }

  let patternTimeSlots: Record<number, 'AM' | 'PM' | 'AMPM'> | undefined = undefined;
  if (row.pattern_time_slots) {
    try {
      patternTimeSlots = typeof row.pattern_time_slots === 'string'
        ? JSON.parse(row.pattern_time_slots)
        : typeof row.pattern_time_slots === 'object' ? row.pattern_time_slots : undefined;
    } catch { /* ignore */ }
  }

  let pickupLocation = row.pickup_location;
  const pickupLocationCustom = row.pickup_location_custom;
  if (pickupLocationCustom && !['事業所', '自宅'].includes(pickupLocation || '')) {
    pickupLocation = 'その他';
  }

  let dropoffLocation = row.dropoff_location;
  const dropoffLocationCustom = row.dropoff_location_custom;
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
    patternDays,
    patternTimeSlots,
    needsPickup: row.needs_pickup || false,
    needsDropoff: row.needs_dropoff || false,
    pickupLocation,
    pickupLocationCustom,
    pickupAddress: row.pickup_address || undefined,
    pickupPostalCode: row.pickup_postal_code || undefined,
    pickupLatitude: row.pickup_latitude || undefined,
    pickupLongitude: row.pickup_longitude || undefined,
    dropoffLocation,
    dropoffLocationCustom,
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
}

function childToDbRow(child: Partial<Child>, facilityId?: string) {
  const finalPickupLocation = child.pickupLocation === 'その他'
    ? child.pickupLocationCustom || ''
    : child.pickupLocation || '';
  const finalDropoffLocation = child.dropoffLocation === 'その他'
    ? child.dropoffLocationCustom || ''
    : child.dropoffLocation || '';

  const row: any = {
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
  };

  if (facilityId) {
    row.facility_id = facilityId;
  }

  return row;
}

export const useChildrenData = () => {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [children, setChildren] = useState<Child[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(true);

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
          setChildren(data.map(mapRowToChild));
        }
      } catch (error) {
        console.error('Error in fetchChildren:', error);
      } finally {
        setLoadingChildren(false);
      }
    };

    fetchChildren();
  }, [facilityId]);

  const filteredChildren = useMemo(
    () => children.filter((c) => c.facilityId === facilityId),
    [children, facilityId]
  );

  const addChild = async (child: Omit<Child, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>) => {
    const newChildId = `c${Date.now()}`;
    const now = new Date().toISOString();

    try {
      const { data, error } = await supabase
        .from('children')
        .insert({
          id: newChildId,
          ...childToDbRow(child, facilityId),
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) throw error;

      const newChild: Child = {
        ...child,
        id: newChildId,
        facilityId,
        createdAt: now,
        updatedAt: now,
      };
      setChildren(prev => [...prev, newChild]);
      return newChild;
    } catch (error) {
      console.error('Error in addChild:', error);
      throw error;
    }
  };

  const updateChild = async (child: Child) => {
    try {
      const { error } = await supabase
        .from('children')
        .update(childToDbRow(child))
        .eq('id', child.id);

      if (error) throw error;

      setChildren(prev => prev.map(c =>
        c.id === child.id ? { ...child, updatedAt: new Date().toISOString() } : c
      ));
    } catch (error) {
      console.error('Error in updateChild:', error);
      throw error;
    }
  };

  const deleteChild = async (childId: string) => {
    try {
      const { error } = await supabase
        .from('children')
        .delete()
        .eq('id', childId);

      if (error) throw error;
      setChildren(prev => prev.filter(c => c.id !== childId));
    } catch (error) {
      console.error('Error in deleteChild:', error);
      throw error;
    }
  };

  return {
    children: filteredChildren,
    loadingChildren,
    setChildren,
    addChild,
    updateChild,
    deleteChild,
  };
};
