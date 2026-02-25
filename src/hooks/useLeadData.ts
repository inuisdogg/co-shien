/**
 * リード・経営目標データ管理フック
 * leads テーブルと management_targets テーブルの取得・CRUD操作
 */

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Lead,
  LeadFormData,
  LeadStatus,
  ManagementTarget,
  ManagementTargetFormData,
} from '@/types';

export const useLeadData = () => {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [leads, setLeads] = useState<Lead[]>([]);
  const [managementTargets, setManagementTargets] = useState<ManagementTarget[]>([]);

  // Supabaseからリードデータを取得
  useEffect(() => {
    if (!facilityId) {
      return;
    }

    const fetchLeads = async () => {
      try {
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .eq('facility_id', facilityId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching leads:', error);
          return;
        }

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
        console.error('Error in fetchLeads:', error);
      }
    };

    fetchLeads();
  }, [facilityId]);

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
      throw new Error('施設IDが設定されていません。ログインしてください。');
    }

    const leadId = `lead-${Date.now()}`;
    const now = new Date().toISOString();

    try {
      const { data, error } = await supabase
        .from('leads')
        .insert({
          id: leadId,
          facility_id: facilityId,
          name: leadData.name,
          child_name: null,
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

      if (error) throw error;

      const newLead: Lead = {
        ...leadData,
        id: leadId,
        facilityId,
        createdAt: now,
        updatedAt: now,
      };
      setLeads(prev => [...prev, newLead]);
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

      if (error) throw error;

      setLeads(prev =>
        prev.map((l) =>
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
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId);

      if (error) throw error;

      setLeads(prev => prev.filter((l) => l.id !== leadId));
    } catch (error) {
      console.error('Error in deleteLead:', error);
      throw error;
    }
  };

  const getLeadsByChildId = (childId: string): Lead[] => {
    return filteredLeads.filter((lead) => lead.childIds.includes(childId));
  };

  // 経営目標管理機能
  const addManagementTarget = async (targetData: ManagementTargetFormData) => {
    const newTargetId = `target-${Date.now()}`;
    const now = new Date().toISOString();

    try {
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

      if (error) throw error;

      const newTarget: ManagementTarget = {
        ...targetData,
        id: newTargetId,
        facilityId,
        createdAt: now,
        updatedAt: now,
      };
      setManagementTargets(prev => [...prev, newTarget]);
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
      setManagementTargets(prev => [...prev, newTarget]);
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

      if (error) throw error;

      setManagementTargets(prev =>
        prev.map((t) =>
          t.id === targetId
            ? { ...t, ...targetData, updatedAt: new Date().toISOString() }
            : t
        )
      );
    } catch (error) {
      console.error('Error in updateManagementTarget:', error);
      // エラー時もローカル状態を更新
      setManagementTargets(prev =>
        prev.map((t) =>
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

      if (error) throw error;

      setManagementTargets(prev => prev.filter((t) => t.id !== targetId));
    } catch (error) {
      console.error('Error in deleteManagementTarget:', error);
      // エラー時もローカル状態から削除
      setManagementTargets(prev => prev.filter((t) => t.id !== targetId));
    }
  };

  const getManagementTarget = (year: number, month: number): ManagementTarget | undefined => {
    return filteredManagementTargets.find(
      (t) => t.year === year && t.month === month
    );
  };

  return {
    leads: filteredLeads,
    managementTargets: filteredManagementTargets,
    addLead,
    updateLead,
    deleteLead,
    getLeadsByChildId,
    addManagementTarget,
    updateManagementTarget,
    deleteManagementTarget,
    getManagementTarget,
  };
};
