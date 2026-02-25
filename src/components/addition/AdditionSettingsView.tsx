'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ListChecks,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Filter,
  ChevronDown,
  ChevronRight,
  Info,
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface Addition {
  code: string;
  name: string;
  shortName: string;
  units: number;
  unitType: string;
  isPercentage: boolean;
  percentageRate: number;
  categoryCode: string;
  additionType: string;
  isExclusive: boolean;
  exclusiveWith: string[];
  requirementsJson: any;
  isActive: boolean;
}

interface AdditionCategory {
  code: string;
  name: string;
  description: string;
}

interface FacilityAdditionSetting {
  id: string;
  facilityId: string;
  additionCode: string;
  isEnabled: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  notes: string | null;
}

interface StaffRequirement {
  additionCode: string;
  requiredQualifications: string[];
  anyQualification: boolean;
  minYearsExperience: number;
  requiredWorkStyle: string | null;
  minFte: number;
  minStaffCount: number;
  description: string;
}

const ADDITION_TYPE_LABELS: Record<string, string> = {
  facility_preset: '体制加算',
  monthly: '月次選択型',
  daily: '日次実績型',
};

const QUALIFICATION_LABELS: Record<string, string> = {
  PT: '理学療法士',
  OT: '作業療法士',
  ST: '言語聴覚士',
  PSYCHOLOGIST: '公認心理師',
  VISION_TRAINER: '視能訓練士',
  NURSE: '看護師',
  NURSERY_TEACHER: '保育士',
  CHILD_INSTRUCTOR: '児童指導員',
  SOCIAL_WORKER: '社会福祉士',
  CARE_WORKER: '介護福祉士',
};

export default function AdditionSettingsView() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [additions, setAdditions] = useState<Addition[]>([]);
  const [categories, setCategories] = useState<AdditionCategory[]>([]);
  const [settings, setSettings] = useState<FacilityAdditionSetting[]>([]);
  const [requirements, setRequirements] = useState<StaffRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTypeFilter, setActiveTypeFilter] = useState<string>('all');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!facilityId) return;
    const fetchData = async () => {
      try {
        const [additionsRes, categoriesRes, settingsRes, requirementsRes] = await Promise.all([
          supabase.from('additions').select('*').eq('is_active', true).order('category_code').order('code'),
          supabase.from('addition_categories').select('*').order('code'),
          supabase.from('facility_addition_settings').select('*').eq('facility_id', facilityId),
          supabase.from('addition_staff_requirements').select('*'),
        ]);

        if (additionsRes.data) {
          setAdditions(additionsRes.data.map((row: any) => ({
            code: row.code,
            name: row.name,
            shortName: row.short_name,
            units: row.units,
            unitType: row.unit_type,
            isPercentage: row.is_percentage,
            percentageRate: row.percentage_rate,
            categoryCode: row.category_code,
            additionType: row.addition_type || 'facility_preset',
            isExclusive: row.is_exclusive,
            exclusiveWith: row.exclusive_with || [],
            requirementsJson: row.requirements_json,
            isActive: row.is_active,
          })));
        }
        if (categoriesRes.data) {
          setCategories(categoriesRes.data.map((row: any) => ({
            code: row.code,
            name: row.name,
            description: row.description,
          })));
        }
        if (settingsRes.data) {
          setSettings(settingsRes.data.map((row: any) => ({
            id: row.id,
            facilityId: row.facility_id,
            additionCode: row.addition_code,
            isEnabled: row.is_enabled,
            effectiveFrom: row.effective_from,
            effectiveTo: row.effective_to,
            notes: row.notes,
          })));
        }
        if (requirementsRes.data) {
          setRequirements(requirementsRes.data.map((row: any) => ({
            additionCode: row.addition_code,
            requiredQualifications: row.required_qualifications || [],
            anyQualification: row.any_qualification || false,
            minYearsExperience: row.min_years_experience || 0,
            requiredWorkStyle: row.required_work_style,
            minFte: row.min_fte || 0,
            minStaffCount: row.min_staff_count || 0,
            description: row.description || '',
          })));
        }
      } catch (error) {
        console.error('Error fetching addition data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [facilityId]);

  const isEnabled = (code: string) => settings.some(s => s.additionCode === code && s.isEnabled);

  const stats = useMemo(() => {
    const enabled = settings.filter(s => s.isEnabled);
    const totalUnits = enabled.reduce((sum, s) => {
      const addition = additions.find(a => a.code === s.additionCode);
      return sum + (addition?.units || 0);
    }, 0);
    return { enabledCount: enabled.length, totalUnits };
  }, [settings, additions]);

  const filteredAdditions = useMemo(() => {
    if (activeTypeFilter === 'all') return additions;
    return additions.filter(a => a.additionType === activeTypeFilter);
  }, [additions, activeTypeFilter]);

  const additionsByCategory = useMemo(() => {
    const map = new Map<string, Addition[]>();
    filteredAdditions.forEach(a => {
      const existing = map.get(a.categoryCode) || [];
      existing.push(a);
      map.set(a.categoryCode, existing);
    });
    return map;
  }, [filteredAdditions]);

  const handleToggle = async (code: string) => {
    const currentSetting = settings.find(s => s.additionCode === code);
    const newEnabled = !currentSetting?.isEnabled;

    try {
      if (currentSetting) {
        const { error } = await supabase
          .from('facility_addition_settings')
          .update({ is_enabled: newEnabled, updated_at: new Date().toISOString() })
          .eq('id', currentSetting.id);
        if (error) throw error;
        setSettings(prev => prev.map(s => s.id === currentSetting.id ? { ...s, isEnabled: newEnabled } : s));
      } else {
        const { data, error } = await supabase
          .from('facility_addition_settings')
          .insert({
            facility_id: facilityId,
            addition_code: code,
            is_enabled: true,
            effective_from: new Date().toISOString().split('T')[0],
          })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          setSettings(prev => [...prev, {
            id: data.id,
            facilityId: data.facility_id,
            additionCode: data.addition_code,
            isEnabled: data.is_enabled,
            effectiveFrom: data.effective_from,
            effectiveTo: data.effective_to,
            notes: data.notes,
          }]);
        }
      }
    } catch (error) {
      console.error('Error toggling addition:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ListChecks className="w-6 h-6 text-cyan-500" />
        <h1 className="text-xl font-bold text-gray-800">加算体制設定</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 rounded-lg"><CheckCircle className="w-5 h-5 text-cyan-600" /></div>
            <div>
              <p className="text-sm text-gray-500">有効な加算</p>
              <p className="text-2xl font-bold text-gray-800">{stats.enabledCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg"><TrendingUp className="w-5 h-5 text-green-600" /></div>
            <div>
              <p className="text-sm text-gray-500">加算合計単位/日</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalUnits}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg"><Users className="w-5 h-5 text-purple-600" /></div>
            <div>
              <p className="text-sm text-gray-500">加算カテゴリ</p>
              <p className="text-2xl font-bold text-gray-800">{categories.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Type Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setActiveTypeFilter('all')} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${activeTypeFilter === 'all' ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>全て</button>
          {Object.entries(ADDITION_TYPE_LABELS).map(([k, v]) => (
            <button key={k} onClick={() => setActiveTypeFilter(k)} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${activeTypeFilter === k ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{v}</button>
          ))}
        </div>
      </div>

      {/* Additions by Category */}
      <div className="space-y-3">
        {categories.map(cat => {
          const catAdditions = additionsByCategory.get(cat.code) || [];
          if (catAdditions.length === 0) return null;
          const isExpanded = expandedCategory === cat.code;
          const enabledInCat = catAdditions.filter(a => isEnabled(a.code)).length;

          return (
            <div key={cat.code} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : cat.code)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-cyan-400 rounded-full" />
                  <div className="text-left">
                    <p className="font-medium text-gray-800">{cat.name}</p>
                    <p className="text-xs text-gray-500">{catAdditions.length}種類 / {enabledInCat}件有効</p>
                  </div>
                </div>
                {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              </button>
              {isExpanded && (
                <div className="border-t border-gray-100 divide-y divide-gray-50">
                  {catAdditions.map(addition => {
                    const enabled = isEnabled(addition.code);
                    const req = requirements.find(r => r.additionCode === addition.code);
                    return (
                      <div key={addition.code} className={`p-4 ${enabled ? 'bg-cyan-50/30' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-800">{addition.name}</p>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{ADDITION_TYPE_LABELS[addition.additionType] || addition.additionType}</span>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                              {addition.isPercentage
                                ? `${addition.percentageRate}%`
                                : `${addition.units}単位/${addition.unitType === 'per_day' ? '日' : '月'}`
                              }
                            </p>
                          </div>
                          <button onClick={() => handleToggle(addition.code)} className="flex-shrink-0">
                            {enabled
                              ? <ToggleRight className="w-10 h-6 text-cyan-500" />
                              : <ToggleLeft className="w-10 h-6 text-gray-300" />
                            }
                          </button>
                        </div>
                        {req && (
                          <div className="mt-2 p-2 bg-gray-50 rounded-lg text-xs text-gray-600">
                            <div className="flex items-start gap-1">
                              <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium">要件:</p>
                                {req.requiredQualifications.length > 0 && (
                                  <p>資格: {req.requiredQualifications.map(q => QUALIFICATION_LABELS[q] || q).join(req.anyQualification ? ' or ' : ' + ')}</p>
                                )}
                                {req.minFte > 0 && <p>最低FTE: {req.minFte}</p>}
                                {req.minStaffCount > 0 && <p>最低人数: {req.minStaffCount}名</p>}
                                {req.description && <p>{req.description}</p>}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
