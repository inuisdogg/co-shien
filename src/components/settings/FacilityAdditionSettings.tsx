/**
 * 施設加算体制設定コンポーネント
 * - 体制加算の有効/無効と区分選択を管理
 * - スタッフ配置状況の表示
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Settings,
  CheckCircle,
  Clock,
  AlertCircle,
  Save,
  Users,
  DollarSign,
  Target,
  AlertTriangle,
  Info,
  Building,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface FacilityAdditionSettingsProps {
  facilityId: string;
}

// 体制加算の定義（区分選択可能なもの）
interface AdditionConfig {
  id: string;
  name: string;
  description: string;
  tiers?: {
    id: string;
    label: string;
    units: string;
    requirements: string;
  }[];
  singleUnits?: string;
  notes: string;
}

const STRUCTURE_ADDITIONS: AdditionConfig[] = [
  {
    id: 'staff_allocation',
    name: '児童指導員等加配加算',
    description: '基本の人員基準に加え、児童指導員等の有資格者やその他の従業者を常勤換算で1人以上配置',
    tiers: [
      { id: 'tier1_fulltime_exp', label: '常勤専従・経験5年以上', units: '187単位/日', requirements: '有資格者を常勤専従で配置、経験5年以上' },
      { id: 'tier1_fulltime', label: '常勤専従・経験5年未満', units: '152単位/日', requirements: '有資格者を常勤専従で配置' },
      { id: 'tier2_convert_exp', label: '常勤換算・経験5年以上', units: '123単位/日', requirements: '有資格者を常勤換算1名以上配置、経験5年以上' },
      { id: 'tier2_convert', label: '常勤換算・経験5年未満', units: '107単位/日', requirements: '有資格者を常勤換算1名以上配置' },
      { id: 'tier3_other', label: 'その他従業者', units: '90単位/日', requirements: 'その他の従業者を1名以上加配' },
    ],
    notes: '対象資格：保育士、児童指導員、理学療法士、作業療法士、言語聴覚士、心理担当職員など。経験年数は180日以上/年を1年とする。定員10名の場合の単位数。',
  },
  {
    id: 'specialist_support',
    name: '専門的支援体制加算',
    description: '専門的な支援を提供する体制（理学療法士等）を常勤換算で1人以上配置',
    singleUnits: '123単位/日（定員10名の場合）',
    notes: '対象：理学療法士、作業療法士、言語聴覚士、心理担当職員、視覚障害児支援担当職員。5年以上従事した保育士・児童指導員も対象。',
  },
  {
    id: 'welfare_professional',
    name: '福祉専門職員配置等加算',
    description: '社会福祉士、介護福祉士、精神保健福祉士、公認心理師の配置割合に応じた加算',
    tiers: [
      { id: 'tier1', label: '(I) 35%以上', units: '15単位/日', requirements: '常勤従業者のうち資格者割合35%以上' },
      { id: 'tier2', label: '(II) 25%以上', units: '10単位/日', requirements: '常勤従業者のうち資格者割合25%以上' },
      { id: 'tier3', label: '(III) 常勤率等', units: '6単位/日', requirements: '常勤割合75%以上、または勤続3年以上30%以上' },
    ],
    notes: '(I)と(II)は社会福祉士等の資格割合、(III)は常勤率や勤続年数で評価。',
  },
  {
    id: 'treatment_improvement',
    name: '福祉・介護職員処遇改善加算',
    description: 'キャリアパス要件・月額賃金改善要件・職場環境等要件を満たし算定',
    tiers: [
      { id: 'tier1', label: '新加算(I)', units: '13.1%', requirements: '全要件を満たす（最高区分）' },
      { id: 'tier2', label: '新加算(II)', units: '10.0%', requirements: '一部要件を満たす' },
      { id: 'tier3', label: '新加算(III)', units: '7.0%', requirements: '基本要件を満たす' },
      { id: 'tier4', label: '新加算(IV)', units: '4.0%', requirements: '最低限の要件を満たす' },
    ],
    notes: '令和6年度に一本化。加算額はすべて職員の賃金改善に充てる必要がある。計画書・実績報告書の提出が必要。',
  },
];

// ローカルストレージのキー
const getStorageKey = (facilityId: string) => `facility_addition_settings_${facilityId}`;

interface AdditionSetting {
  enabled: boolean;
  selectedTier: string | null;
  status: 'planned' | 'applying' | 'submitted' | 'active' | 'inactive';
  effectiveFrom?: string;
}

type SettingsMap = Record<string, AdditionSetting>;

export default function FacilityAdditionSettings({ facilityId }: FacilityAdditionSettingsProps) {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [staffCount, setStaffCount] = useState({ total: 0, fullTime: 0, specialists: 0, welfare: 0, experienced: 0 });

  // 初期化
  useEffect(() => {
    // ローカルストレージから設定を読み込み
    const saved = localStorage.getItem(getStorageKey(facilityId));
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error('設定の読み込みに失敗:', e);
      }
    }

    // スタッフ数を取得
    const fetchStaffCount = async () => {
      const { data } = await supabase
        .from('staff')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('is_active', true);

      if (data) {
        let specialists = 0;
        let welfare = 0;
        let experienced = 0;
        let fullTime = 0;

        data.forEach(staff => {
          const quals = staff.qualifications || [];
          if (['PT', 'OT', 'ST', 'PSYCHOLOGIST'].some(q => quals.includes(q))) specialists++;
          if (['SOCIAL_WORKER', 'CARE_WORKER', 'MENTAL_HEALTH_WELFARE', 'PSYCHOLOGIST'].some(q => quals.includes(q))) welfare++;
          if ((staff.years_of_experience || 0) >= 5) experienced++;
          if ((staff.weekly_hours || 0) >= 32) fullTime++;
        });

        setStaffCount({
          total: data.length,
          fullTime,
          specialists,
          welfare,
          experienced,
        });
      }
    };

    fetchStaffCount();
  }, [facilityId]);

  // 設定を更新
  const updateSetting = (additionId: string, updates: Partial<AdditionSetting>) => {
    setSettings(prev => {
      const current = prev[additionId] || { enabled: false, selectedTier: null, status: 'planned' };
      return {
        ...prev,
        [additionId]: { ...current, ...updates },
      };
    });
    setHasChanges(true);
  };

  // 保存
  const handleSave = () => {
    setIsSaving(true);
    localStorage.setItem(getStorageKey(facilityId), JSON.stringify(settings));
    setTimeout(() => {
      setIsSaving(false);
      setHasChanges(false);
    }, 500);
  };

  // 統計
  const stats = useMemo(() => {
    let active = 0;
    let planned = 0;

    Object.values(settings).forEach(s => {
      if (s.enabled) {
        if (s.status === 'active') active++;
        else planned++;
      }
    });

    return { active, planned };
  }, [settings]);

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Settings className="w-6 h-6 text-teal-600" />
              加算体制設定
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              体制加算の有効/無効と適用する区分を設定します
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold transition-all ${
              hasChanges
                ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-md'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4" />
            {isSaving ? '保存中...' : '設定を保存'}
          </button>
        </div>

        {/* スタッフ配置状況 */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-blue-800">現在のスタッフ配置状況</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-800">{staffCount.total}</div>
              <div className="text-xs text-blue-600">総スタッフ数</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-800">{staffCount.fullTime}</div>
              <div className="text-xs text-blue-600">常勤（32h+）</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-800">{staffCount.specialists}</div>
              <div className="text-xs text-blue-600">専門職</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-800">{staffCount.welfare}</div>
              <div className="text-xs text-blue-600">福祉専門職</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-800">{staffCount.experienced}</div>
              <div className="text-xs text-blue-600">経験5年+</div>
            </div>
          </div>
        </div>

        {/* 統計 */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-center">
            <div className="text-2xl font-bold text-green-700">{stats.active}</div>
            <div className="text-xs text-green-600">適用中</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-center">
            <div className="text-2xl font-bold text-gray-700">{stats.planned}</div>
            <div className="text-xs text-gray-600">計画中/準備中</div>
          </div>
        </div>
      </div>

      {/* 加算設定リスト */}
      <div className="space-y-4">
        {STRUCTURE_ADDITIONS.map(addition => {
          const setting = settings[addition.id] || { enabled: false, selectedTier: null, status: 'planned' };

          return (
            <div key={addition.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* ヘッダー */}
              <div className="px-4 py-4 border-b border-gray-100">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <label className="relative inline-flex items-center cursor-pointer mt-1">
                      <input
                        type="checkbox"
                        checked={setting.enabled}
                        onChange={(e) => updateSetting(addition.id, { enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                    <div>
                      <h3 className={`font-bold ${setting.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                        {addition.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">{addition.description}</p>
                    </div>
                  </div>

                  {setting.enabled && (
                    <select
                      value={setting.status}
                      onChange={(e) => updateSetting(addition.id, { status: e.target.value as AdditionSetting['status'] })}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    >
                      <option value="planned">計画中</option>
                      <option value="applying">届出準備中</option>
                      <option value="submitted">届出済み</option>
                      <option value="active">適用中</option>
                      <option value="inactive">停止中</option>
                    </select>
                  )}
                </div>
              </div>

              {/* 区分選択（有効時のみ） */}
              {setting.enabled && (
                <div className="px-4 py-4 bg-gray-50">
                  {addition.tiers ? (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-500 uppercase">区分を選択</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {addition.tiers.map(tier => (
                          <label
                            key={tier.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                              setting.selectedTier === tier.id
                                ? 'border-teal-500 bg-teal-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`tier_${addition.id}`}
                              checked={setting.selectedTier === tier.id}
                              onChange={() => updateSetting(addition.id, { selectedTier: tier.id })}
                              className="mt-1 text-teal-600 focus:ring-teal-500"
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-900">{tier.label}</span>
                                <span className="text-sm font-bold text-teal-600">{tier.units}</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">{tier.requirements}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                      <span className="text-gray-700">単位数</span>
                      <span className="font-bold text-teal-600">{addition.singleUnits}</span>
                    </div>
                  )}

                  {/* 注意事項 */}
                  <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">{addition.notes}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 注意事項 */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-600">
            <p className="font-medium text-gray-700 mb-2">届出について</p>
            <ul className="space-y-1 list-disc list-inside text-xs">
              <li>体制加算の変更は、適用月の前月15日までに届出が必要です</li>
              <li>「適用中」にすると売上シミュレーターに反映されます</li>
              <li>単位数は定員により異なる場合があります</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
