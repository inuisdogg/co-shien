'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Calculator,
  Plus,
  Trash2,
  Users,
  Calendar,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  Copy,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Award,
  Info,
} from 'lucide-react';
import {
  QUALIFICATION_CODES,
  QualificationCode,
  WORK_STYLE_LABELS,
  WorkStyle,
  PERSONNEL_TYPE_LABELS,
  PersonnelType,
} from '@/types';
import {
  calculateFTE,
  judgeAllSystemAdditions,
  selectBestAdditionInGroup,
  simulateMonthlyRevenue,
  REGION_UNIT_RATES,
  StaffForJudgment,
  AdditionJudgmentResult,
} from '@/utils/additionJudgment';

// 仮想スタッフの型
type PlannedStaff = {
  id: string;
  name: string;
  personnelType: PersonnelType;
  workStyle: WorkStyle;
  qualifications: QualificationCode[];
  yearsOfExperience: number;
  monthlySalary?: number; // 月給（常勤）
  hourlyWage?: number; // 時給（非常勤）
  workDays: boolean[]; // 月〜土の勤務日（6日分）
  hoursPerDay: number; // 1日の勤務時間
  isExpanded: boolean; // UI用：詳細展開状態
};

// シミュレーション設定
type SimulationSettings = {
  childCount: number;
  averageUsageDays: number;
  regionGrade: number;
  baseUnits: number;
  standardWeeklyHours: number; // 週所定労働時間（常勤の基準）
  percentAdditions: number; // 処遇改善加算
};

// デフォルトの仮想スタッフ
const createDefaultStaff = (index: number): PlannedStaff => ({
  id: `planned-${Date.now()}-${index}`,
  name: `スタッフ ${index + 1}`,
  personnelType: 'standard',
  workStyle: 'fulltime_dedicated',
  qualifications: [],
  yearsOfExperience: 0,
  monthlySalary: 250000,
  hourlyWage: 1200,
  workDays: [true, true, true, true, true, true], // 月〜土
  hoursPerDay: 8,
  isExpanded: true,
});

// 曜日ラベル
const DAY_LABELS = ['月', '火', '水', '木', '金', '土'];

// 資格の選択肢
const QUALIFICATION_OPTIONS: { code: QualificationCode; label: string }[] = [
  { code: 'NURSERY_TEACHER', label: '保育士' },
  { code: 'CHILD_INSTRUCTOR', label: '児童指導員' },
  { code: 'PT', label: '理学療法士' },
  { code: 'OT', label: '作業療法士' },
  { code: 'ST', label: '言語聴覚士' },
  { code: 'PSYCHOLOGIST', label: '公認心理師' },
  { code: 'SOCIAL_WORKER', label: '社会福祉士' },
  { code: 'CARE_WORKER', label: '介護福祉士' },
  { code: 'PSYCH_WELFARE_WORKER', label: '精神保健福祉士' },
  { code: 'NURSE', label: '看護師' },
];

// 地域区分の選択肢
const REGION_OPTIONS = [
  { value: 1, label: '1級地', rate: 11.12 },
  { value: 2, label: '2級地', rate: 10.88 },
  { value: 3, label: '3級地', rate: 10.70 },
  { value: 4, label: '4級地', rate: 10.52 },
  { value: 5, label: '5級地', rate: 10.28 },
  { value: 6, label: '6級地', rate: 10.10 },
  { value: 7, label: '7級地', rate: 10.00 },
  { value: 8, label: 'その他', rate: 10.00 },
];

export default function StaffPlanningSimulator() {
  // 仮想スタッフリスト
  const [plannedStaff, setPlannedStaff] = useState<PlannedStaff[]>([]);

  // シミュレーション設定
  const [settings, setSettings] = useState<SimulationSettings>({
    childCount: 10,
    averageUsageDays: 20,
    regionGrade: 6,
    baseUnits: 897,
    standardWeeklyHours: 40,
    percentAdditions: 10.0,
  });

  // スタッフ追加
  const addStaff = useCallback(() => {
    setPlannedStaff(prev => [...prev, createDefaultStaff(prev.length)]);
  }, []);

  // スタッフ削除
  const removeStaff = useCallback((id: string) => {
    setPlannedStaff(prev => prev.filter(s => s.id !== id));
  }, []);

  // スタッフ複製
  const duplicateStaff = useCallback((staff: PlannedStaff) => {
    const newStaff: PlannedStaff = {
      ...staff,
      id: `planned-${Date.now()}`,
      name: `${staff.name} (コピー)`,
      isExpanded: true,
    };
    setPlannedStaff(prev => [...prev, newStaff]);
  }, []);

  // スタッフ更新
  const updateStaff = useCallback((id: string, updates: Partial<PlannedStaff>) => {
    setPlannedStaff(prev =>
      prev.map(s => (s.id === id ? { ...s, ...updates } : s))
    );
  }, []);

  // 展開/折りたたみ切り替え
  const toggleExpand = useCallback((id: string) => {
    setPlannedStaff(prev =>
      prev.map(s => (s.id === id ? { ...s, isExpanded: !s.isExpanded } : s))
    );
  }, []);

  // リセット
  const resetAll = useCallback(() => {
    setPlannedStaff([]);
    setSettings({
      childCount: 10,
      averageUsageDays: 20,
      regionGrade: 6,
      baseUnits: 897,
      standardWeeklyHours: 40,
      percentAdditions: 10.0,
    });
  }, []);

  // FTE計算
  const calculateStaffFTE = useCallback((staff: PlannedStaff): number => {
    if (staff.workStyle === 'fulltime_dedicated') {
      return 1.0;
    }
    if (staff.workStyle === 'fulltime_concurrent') {
      return 0.75;
    }
    // 非常勤: 週の実労働時間 / 週所定労働時間
    const workDaysCount = staff.workDays.filter(d => d).length;
    const weeklyHours = workDaysCount * staff.hoursPerDay;
    return Math.min(weeklyHours / settings.standardWeeklyHours, 1.0);
  }, [settings.standardWeeklyHours]);

  // 人件費計算
  const calculateLaborCost = useCallback((staff: PlannedStaff): number => {
    if (staff.workStyle === 'fulltime_dedicated' || staff.workStyle === 'fulltime_concurrent') {
      return staff.monthlySalary || 0;
    }
    // 非常勤: 時給 × 日の勤務時間 × 月の勤務日数
    const workDaysPerWeek = staff.workDays.filter(d => d).length;
    const workDaysPerMonth = workDaysPerWeek * 4.33; // 平均週数
    return (staff.hourlyWage || 0) * staff.hoursPerDay * workDaysPerMonth;
  }, []);

  // シミュレーション結果を計算
  const simulationResult = useMemo(() => {
    if (plannedStaff.length === 0) return null;

    // StaffForJudgment形式に変換
    const staffForJudgment: StaffForJudgment[] = plannedStaff.map(s => ({
      id: s.id,
      name: s.name,
      personnelType: s.personnelType,
      workStyle: s.workStyle,
      isManager: false,
      isServiceManager: false,
      contractedWeeklyHours: s.workDays.filter(d => d).length * s.hoursPerDay,
      qualifications: s.qualifications,
      yearsOfExperience: s.yearsOfExperience,
      fte: calculateStaffFTE(s),
    }));

    // 加算判定
    const systemAdditions = judgeAllSystemAdditions(staffForJudgment, []);
    const selectedAdditions = selectBestAdditionInGroup(systemAdditions);

    // 取得可能な加算の単位数合計
    const systemAdditionUnits = selectedAdditions
      .filter(a => a.isEligible)
      .reduce((sum, a) => sum + a.units, 0);

    // 月間売上シミュレーション
    const revenue = simulateMonthlyRevenue({
      baseUnits: settings.baseUnits,
      systemAdditionUnits,
      percentAdditions: settings.percentAdditions,
      childCount: settings.childCount,
      averageUsageDays: settings.averageUsageDays,
      regionGrade: settings.regionGrade,
    });

    // 人件費合計
    const totalLaborCost = plannedStaff.reduce(
      (sum, s) => sum + calculateLaborCost(s),
      0
    );

    // FTE合計
    const totalFTE = staffForJudgment.reduce((sum, s) => sum + s.fte, 0);
    const standardFTE = staffForJudgment
      .filter(s => s.personnelType === 'standard')
      .reduce((sum, s) => sum + s.fte, 0);
    const additionFTE = staffForJudgment
      .filter(s => s.personnelType === 'addition')
      .reduce((sum, s) => sum + s.fte, 0);

    return {
      systemAdditions,
      selectedAdditions,
      revenue,
      totalLaborCost,
      profit: revenue.totalRevenue - totalLaborCost,
      totalFTE,
      standardFTE,
      additionFTE,
      staffCount: plannedStaff.length,
    };
  }, [plannedStaff, settings, calculateStaffFTE, calculateLaborCost]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Calculator size={24} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">採用計画シミュレーター</h1>
            <p className="text-sm text-gray-500">
              仮想のスタッフ配置で加算取得と収益をシミュレーション
            </p>
          </div>
        </div>
        <button
          onClick={resetAll}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RotateCcw size={16} />
          リセット
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左: スタッフ設定 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 条件設定 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Info size={18} className="text-[#00c4cc]" />
              シミュレーション条件
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">利用児童数</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.childCount}
                  onChange={(e) => setSettings(s => ({ ...s, childCount: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">平均利用日数/月</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={settings.averageUsageDays}
                  onChange={(e) => setSettings(s => ({ ...s, averageUsageDays: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">基本報酬単位</label>
                <input
                  type="number"
                  min={100}
                  value={settings.baseUnits}
                  onChange={(e) => setSettings(s => ({ ...s, baseUnits: parseInt(e.target.value) || 700 }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">地域区分</label>
                <select
                  value={settings.regionGrade}
                  onChange={(e) => setSettings(s => ({ ...s, regionGrade: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded text-sm"
                >
                  {REGION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">週所定労働時間</label>
                <input
                  type="number"
                  min={20}
                  max={48}
                  value={settings.standardWeeklyHours}
                  onChange={(e) => setSettings(s => ({ ...s, standardWeeklyHours: parseInt(e.target.value) || 40 }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">処遇改善加算(%)</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.1}
                  value={settings.percentAdditions}
                  onChange={(e) => setSettings(s => ({ ...s, percentAdditions: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded text-sm"
                />
              </div>
            </div>
          </div>

          {/* スタッフリスト */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Users size={18} className="text-[#00c4cc]" />
                計画スタッフ ({plannedStaff.length}名)
              </h3>
              <button
                onClick={addStaff}
                className="flex items-center gap-2 px-4 py-2 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] text-sm"
              >
                <Plus size={16} />
                スタッフを追加
              </button>
            </div>

            {plannedStaff.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Users size={48} className="mx-auto mb-4 opacity-50" />
                <p>スタッフを追加してシミュレーションを開始</p>
                <button
                  onClick={addStaff}
                  className="mt-4 px-6 py-2 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8]"
                >
                  最初のスタッフを追加
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {plannedStaff.map((staff, index) => (
                  <StaffCard
                    key={staff.id}
                    staff={staff}
                    index={index}
                    fte={calculateStaffFTE(staff)}
                    laborCost={calculateLaborCost(staff)}
                    onUpdate={(updates) => updateStaff(staff.id, updates)}
                    onRemove={() => removeStaff(staff.id)}
                    onDuplicate={() => duplicateStaff(staff)}
                    onToggleExpand={() => toggleExpand(staff.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右: シミュレーション結果 */}
        <div className="space-y-4">
          {/* サマリー */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-green-500" />
              シミュレーション結果
            </h3>

            {simulationResult ? (
              <div className="space-y-4">
                {/* 収益 */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">月間見込み売上</div>
                  <div className="text-2xl font-bold text-green-600">
                    ¥{simulationResult.revenue.totalRevenue.toLocaleString()}
                  </div>
                </div>

                {/* 人件費 */}
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">月間人件費</div>
                  <div className="text-2xl font-bold text-orange-600">
                    ¥{Math.round(simulationResult.totalLaborCost).toLocaleString()}
                  </div>
                </div>

                {/* 粗利 */}
                <div className={`rounded-lg p-4 ${
                  simulationResult.profit >= 0
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50'
                    : 'bg-gradient-to-r from-red-50 to-pink-50'
                }`}>
                  <div className="text-sm text-gray-600 mb-1">粗利（売上 - 人件費）</div>
                  <div className={`text-2xl font-bold ${
                    simulationResult.profit >= 0 ? 'text-blue-600' : 'text-red-600'
                  }`}>
                    ¥{Math.round(simulationResult.profit).toLocaleString()}
                  </div>
                </div>

                {/* FTEサマリー */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-700 mb-3">常勤換算（FTE）</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold text-gray-800">
                        {simulationResult.totalFTE.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">合計</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-600">
                        {simulationResult.standardFTE.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">基準人員</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-600">
                        {simulationResult.additionFTE.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">加算人員</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                スタッフを追加すると結果が表示されます
              </div>
            )}
          </div>

          {/* 取得可能な加算 */}
          {simulationResult && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Award size={18} className="text-purple-500" />
                取得可能な加算
              </h3>
              <div className="space-y-2">
                {simulationResult.selectedAdditions.map(addition => (
                  <AdditionResultCard key={addition.code} addition={addition} />
                ))}
              </div>
            </div>
          )}

          {/* 人員配置基準チェック */}
          {simulationResult && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <CheckCircle size={18} className="text-blue-500" />
                人員配置基準
              </h3>
              <div className="space-y-2 text-sm">
                <ComplianceCheck
                  label="スタッフ2名以上配置"
                  met={simulationResult.staffCount >= 2}
                  current={`${simulationResult.staffCount}名`}
                  required="2名以上"
                />
                <ComplianceCheck
                  label="常勤専従1名以上"
                  met={plannedStaff.some(s => s.workStyle === 'fulltime_dedicated' && s.personnelType === 'standard')}
                  current={plannedStaff.filter(s => s.workStyle === 'fulltime_dedicated' && s.personnelType === 'standard').length + '名'}
                  required="1名以上"
                />
                <ComplianceCheck
                  label="児童定員に対する配置"
                  met={simulationResult.totalFTE >= settings.childCount / 10}
                  current={`FTE ${simulationResult.totalFTE.toFixed(2)}`}
                  required={`FTE ${(settings.childCount / 10).toFixed(2)}以上`}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// スタッフカード
function StaffCard({
  staff,
  index,
  fte,
  laborCost,
  onUpdate,
  onRemove,
  onDuplicate,
  onToggleExpand,
}: {
  staff: PlannedStaff;
  index: number;
  fte: number;
  laborCost: number;
  onUpdate: (updates: Partial<PlannedStaff>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onToggleExpand: () => void;
}) {
  const isFulltime = staff.workStyle === 'fulltime_dedicated' || staff.workStyle === 'fulltime_concurrent';

  return (
    <div className="p-4">
      {/* ヘッダー（常に表示） */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleExpand}
            className="p-1 hover:bg-gray-100 rounded"
          >
            {staff.isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <input
            type="text"
            value={staff.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="font-medium text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#00c4cc] focus:outline-none px-1"
          />
          <span className={`text-xs px-2 py-0.5 rounded ${
            staff.personnelType === 'standard'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-green-100 text-green-700'
          }`}>
            {PERSONNEL_TYPE_LABELS[staff.personnelType]}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
            {WORK_STYLE_LABELS[staff.workStyle]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            FTE: <span className="font-bold text-gray-800">{fte.toFixed(2)}</span>
          </span>
          <span className="text-sm text-gray-500">
            ¥{Math.round(laborCost).toLocaleString()}/月
          </span>
          <button onClick={onDuplicate} className="p-1.5 hover:bg-gray-100 rounded" title="複製">
            <Copy size={14} className="text-gray-400" />
          </button>
          <button onClick={onRemove} className="p-1.5 hover:bg-red-50 rounded" title="削除">
            <Trash2 size={14} className="text-red-400" />
          </button>
        </div>
      </div>

      {/* 詳細（展開時のみ） */}
      {staff.isExpanded && (
        <div className="mt-4 pl-8 space-y-4">
          {/* 基本設定 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">人員区分</label>
              <select
                value={staff.personnelType}
                onChange={(e) => onUpdate({ personnelType: e.target.value as PersonnelType })}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
              >
                <option value="standard">基準人員</option>
                <option value="addition">加算人員</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">勤務形態</label>
              <select
                value={staff.workStyle}
                onChange={(e) => onUpdate({ workStyle: e.target.value as WorkStyle })}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
              >
                <option value="fulltime_dedicated">常勤専従</option>
                <option value="fulltime_concurrent">常勤兼務</option>
                <option value="parttime">非常勤</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">経験年数</label>
              <input
                type="number"
                min={0}
                max={50}
                value={staff.yearsOfExperience}
                onChange={(e) => onUpdate({ yearsOfExperience: parseInt(e.target.value) || 0 })}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {isFulltime ? '月給' : '時給'}
              </label>
              <input
                type="number"
                min={0}
                value={isFulltime ? staff.monthlySalary : staff.hourlyWage}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  if (isFulltime) {
                    onUpdate({ monthlySalary: value });
                  } else {
                    onUpdate({ hourlyWage: value });
                  }
                }}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
              />
            </div>
          </div>

          {/* 勤務日設定（非常勤の場合） */}
          {staff.workStyle === 'parttime' && (
            <div>
              <label className="block text-xs text-gray-500 mb-2">勤務日・時間</label>
              <div className="flex items-center gap-4">
                <div className="flex gap-1">
                  {DAY_LABELS.map((day, i) => (
                    <button
                      key={day}
                      onClick={() => {
                        const newDays = [...staff.workDays];
                        newDays[i] = !newDays[i];
                        onUpdate({ workDays: newDays });
                      }}
                      className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                        staff.workDays[i]
                          ? 'bg-[#00c4cc] text-white'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={12}
                    step={0.5}
                    value={staff.hoursPerDay}
                    onChange={(e) => onUpdate({ hoursPerDay: parseFloat(e.target.value) || 8 })}
                    className="w-16 px-2 py-1 border border-gray-200 rounded text-sm"
                  />
                  <span className="text-sm text-gray-500">時間/日</span>
                </div>
                <span className="text-sm text-gray-500">
                  (週{(staff.workDays.filter(d => d).length * staff.hoursPerDay).toFixed(1)}h)
                </span>
              </div>
            </div>
          )}

          {/* 資格設定 */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">保有資格</label>
            <div className="flex flex-wrap gap-2">
              {QUALIFICATION_OPTIONS.map(opt => (
                <button
                  key={opt.code}
                  onClick={() => {
                    const has = staff.qualifications.includes(opt.code);
                    onUpdate({
                      qualifications: has
                        ? staff.qualifications.filter(q => q !== opt.code)
                        : [...staff.qualifications, opt.code],
                    });
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    staff.qualifications.includes(opt.code)
                      ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-300'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 加算結果カード
function AdditionResultCard({ addition }: { addition: AdditionJudgmentResult }) {
  return (
    <div className={`p-3 rounded-lg border ${
      addition.isEligible
        ? 'bg-green-50 border-green-200'
        : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {addition.isEligible ? (
            <CheckCircle size={16} className="text-green-500" />
          ) : (
            <XCircle size={16} className="text-gray-400" />
          )}
          <span className={`text-sm font-medium ${
            addition.isEligible ? 'text-green-700' : 'text-gray-500'
          }`}>
            {addition.shortName}
          </span>
        </div>
        <span className={`text-sm font-bold ${
          addition.isEligible ? 'text-green-600' : 'text-gray-400'
        }`}>
          {addition.units}単位
        </span>
      </div>
      {!addition.isEligible && (
        <div className="mt-1 text-xs text-gray-500 pl-6">
          {addition.reason}
        </div>
      )}
    </div>
  );
}

// コンプライアンスチェック
function ComplianceCheck({
  label,
  met,
  current,
  required,
}: {
  label: string;
  met: boolean;
  current: string;
  required: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        {met ? (
          <CheckCircle size={14} className="text-green-500" />
        ) : (
          <AlertCircle size={14} className="text-orange-500" />
        )}
        <span className="text-gray-700">{label}</span>
      </div>
      <span className={`text-xs ${met ? 'text-green-600' : 'text-orange-600'}`}>
        {current} / {required}
      </span>
    </div>
  );
}
