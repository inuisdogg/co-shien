'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Award,
  CheckCircle,
  XCircle,
  ChevronRight,
  Plus,
  Edit3,
  Trash2,
  Save,
  X,
  Users,
  BookOpen,
  Calendar,
  TrendingUp,
  AlertCircle,
  FileText,
  Clock,
  Star,
  ArrowUpRight,
  Briefcase,
  GraduationCap,
  Target,
  Info,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useTalentManagement,
  JobGrade,
  TreatmentImprovementPlan,
  CareerPathRequirement,
  WorkplaceEnvironmentItem,
  AdditionLevelStatus,
  ADDITION_RATES,
} from '@/hooks/useTalentManagement';

// ------------------------------------------------------------------ constants

const ACCENT = '#00c4cc';
const ACCENT_HOVER = '#00b0b8';

const TABS = [
  { id: 'treatment', label: '処遇改善加算', icon: Award },
  { id: 'grades', label: '職位・賃金体系', icon: Briefcase },
  { id: 'training', label: '研修計画', icon: GraduationCap },
  { id: 'staff', label: 'スタッフ概要', icon: Users },
  { id: 'schedule', label: '届出スケジュール', icon: Calendar },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** 28 workplace environment items across 6 categories */
const WORKPLACE_ITEMS: Array<{ category: string; itemNumber: number; itemTitle: string }> = [
  // Category 1 - 入職促進
  { category: '入職促進', itemNumber: 1, itemTitle: '経営理念・ケア方針・人材育成方針の明確化' },
  { category: '入職促進', itemNumber: 2, itemTitle: '事業者共同による採用・研修制度の構築' },
  { category: '入職促進', itemNumber: 3, itemTitle: '多様な人材確保の仕組み構築' },
  { category: '入職促進', itemNumber: 4, itemTitle: '職業体験受入れ・職業魅力度向上' },
  // Category 2 - 資質向上
  { category: '資質向上', itemNumber: 5, itemTitle: '資格取得支援・専門研修受講支援' },
  { category: '資質向上', itemNumber: 6, itemTitle: '研修とキャリア段位制度の人事考課連動' },
  { category: '資質向上', itemNumber: 7, itemTitle: 'エルダー・メンター制度導入' },
  { category: '資質向上', itemNumber: 8, itemTitle: 'キャリア面談機会の確保' },
  // Category 3 - 両立支援
  { category: '両立支援', itemNumber: 9, itemTitle: '子育て・介護との両立支援' },
  { category: '両立支援', itemNumber: 10, itemTitle: '勤務シフト柔軟化・短時間正規職員制度' },
  { category: '両立支援', itemNumber: 11, itemTitle: '有給休暇取得目標設定と促進' },
  { category: '両立支援', itemNumber: 12, itemTitle: '業務属人化解消による休暇取得支援' },
  // Category 4 - 健康管理
  { category: '健康管理', itemNumber: 13, itemTitle: '相談窓口設置' },
  { category: '健康管理', itemNumber: 14, itemTitle: '健康診断・ストレスチェック' },
  { category: '健康管理', itemNumber: 15, itemTitle: '腰痛対策研修・技術支援' },
  { category: '健康管理', itemNumber: 16, itemTitle: '事故・トラブル対応マニュアル整備' },
  // Category 5 - 生産性向上
  { category: '生産性向上', itemNumber: 17, itemTitle: '生産性向上ガイドラインに基づく改善活動' },
  { category: '生産性向上', itemNumber: 18, itemTitle: '現場課題の見える化' },
  { category: '生産性向上', itemNumber: 19, itemTitle: '5S活動' },
  { category: '生産性向上', itemNumber: 20, itemTitle: '業務手順書作成・記録様式工夫' },
  { category: '生産性向上', itemNumber: 21, itemTitle: '介護ソフト・情報端末導入' },
  { category: '生産性向上', itemNumber: 22, itemTitle: 'ICT機器導入' },
  { category: '生産性向上', itemNumber: 23, itemTitle: '業務内容明確化・間接業務削減' },
  { category: '生産性向上', itemNumber: 24, itemTitle: '協働化による事務処理集約' },
  // Category 6 - やりがい醸成
  { category: 'やりがい醸成', itemNumber: 25, itemTitle: 'ミーティングによるコミュニケーション円滑化' },
  { category: 'やりがい醸成', itemNumber: 26, itemTitle: '地域交流によるモチベーション向上' },
  { category: 'やりがい醸成', itemNumber: 27, itemTitle: '法人理念の定期学習機会' },
  { category: 'やりがい醸成', itemNumber: 28, itemTitle: '好事例・感謝情報の共有' },
];

const CAREER_PATH_LABELS: Record<string, { label: string; description: string }> = {
  I: { label: 'キャリアパス要件 I', description: '職位・職責・職務内容に応じた任用要件と賃金体系の整備' },
  II: { label: 'キャリアパス要件 II', description: '研修の機会の提供または資質向上のための計画策定・研修実施' },
  III: { label: 'キャリアパス要件 III', description: '経験・資格・評価に基づく昇給の仕組みの整備' },
  IV: { label: 'キャリアパス要件 IV', description: '改善後の年額賃金440万円以上の者が1名以上' },
  V: { label: 'キャリアパス要件 V', description: '福祉専門職員配置等加算の届出' },
};

const FILING_SCHEDULE = [
  { id: 'plan', label: '処遇改善加算計画書', deadline: '4月15日', description: '処遇改善に関する計画書の提出期限', month: 4, day: 15 },
  { id: 'system-apr', label: '体制届（4月）', deadline: '4月15日', description: '加算算定に必要な体制の届出', month: 4, day: 15 },
  { id: 'system-may', label: '体制届（5月）', deadline: '5月15日', description: '体制変更がある場合の届出', month: 5, day: 15 },
  { id: 'system-jun', label: '体制届（6月）', deadline: '6月15日', description: '体制変更がある場合の届出', month: 6, day: 15 },
  { id: 'system-jul', label: '体制届（7月）', deadline: '7月15日', description: '体制変更がある場合の届出', month: 7, day: 15 },
  { id: 'system-aug', label: '体制届（8月）', deadline: '8月15日', description: '体制変更がある場合の届出', month: 8, day: 15 },
  { id: 'system-sep', label: '体制届（9月）', deadline: '9月15日', description: '体制変更がある場合の届出', month: 9, day: 15 },
  { id: 'system-oct', label: '体制届（10月）', deadline: '10月15日', description: '体制変更がある場合の届出', month: 10, day: 15 },
  { id: 'system-nov', label: '体制届（11月）', deadline: '11月15日', description: '体制変更がある場合の届出', month: 11, day: 15 },
  { id: 'system-dec', label: '体制届（12月）', deadline: '12月15日', description: '体制変更がある場合の届出', month: 12, day: 15 },
  { id: 'system-jan', label: '体制届（1月）', deadline: '1月15日', description: '体制変更がある場合の届出', month: 1, day: 15 },
  { id: 'system-feb', label: '体制届（2月）', deadline: '2月15日', description: '体制変更がある場合の届出', month: 2, day: 15 },
  { id: 'system-mar', label: '体制届（3月）', deadline: '3月15日', description: '体制変更がある場合の届出', month: 3, day: 15 },
  { id: 'report', label: '処遇改善実績報告書', deadline: '翌年度7月末', description: '前年度の処遇改善加算の実績報告', month: 7, day: 31 },
];

// ------------------------------------------------------------------ component

interface TalentManagementViewProps {
  facilityId?: string;
}

export default function TalentManagementView({ facilityId: propFacilityId }: TalentManagementViewProps) {
  const { facility } = useAuth();
  const facilityId = propFacilityId || facility?.id || '';
  const [activeTab, setActiveTab] = useState<TabId>('treatment');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">タレントマネジメント</h1>
        <p className="text-sm text-gray-500 mt-1">処遇改善加算の取得・管理、キャリアパス整備、スタッフ育成を一元管理</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? 'border-[#00c4cc] text-[#00c4cc]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'treatment' && <TreatmentImprovementTab facilityId={facilityId} />}
        {activeTab === 'grades' && <JobGradesTab facilityId={facilityId} />}
        {activeTab === 'training' && <TrainingPlanTab facilityId={facilityId} />}
        {activeTab === 'staff' && <StaffOverviewTab facilityId={facilityId} />}
        {activeTab === 'schedule' && <FilingScheduleTab facilityId={facilityId} />}
      </div>
    </div>
  );
}

// ==================================================================
// Tab 1: 処遇改善加算
// ==================================================================

function TreatmentImprovementTab({ facilityId }: { facilityId: string }) {
  const tm = useTalentManagement();
  const [plan, setPlan] = useState<TreatmentImprovementPlan | null>(null);
  const [levelStatus, setLevelStatus] = useState<AdditionLevelStatus | null>(null);
  const [cpRequirements, setCpRequirements] = useState<CareerPathRequirement[]>([]);
  const [wpItems, setWpItems] = useState<WorkplaceEnvironmentItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planForm, setPlanForm] = useState({ additionLevel: 'IV' as string, estimatedAnnualRevenue: '' });

  const currentFiscalYear = new Date().getMonth() < 3 ? new Date().getFullYear() - 1 : new Date().getFullYear();

  const loadData = useCallback(async () => {
    if (!facilityId) return;
    setDataLoading(true);
    const fetchedPlan = await tm.fetchTreatmentPlan(currentFiscalYear);
    setPlan(fetchedPlan);

    if (fetchedPlan) {
      const reqs = await tm.ensureCareerPathRequirements(fetchedPlan.id);
      setCpRequirements(reqs);
      const items = await tm.ensureWorkplaceEnvironmentItems(fetchedPlan.id, WORKPLACE_ITEMS);
      setWpItems(items);
      const status = await tm.getAdditionLevelStatus(fetchedPlan.id);
      setLevelStatus(status);
    }
    setDataLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, currentFiscalYear]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreatePlan = async () => {
    const revenue = parseFloat(planForm.estimatedAnnualRevenue) || 0;
    const rate = ADDITION_RATES[planForm.additionLevel] || 0;
    const saved = await tm.saveTreatmentPlan({
      fiscalYear: currentFiscalYear,
      additionLevel: planForm.additionLevel as 'I' | 'II' | 'III' | 'IV',
      estimatedAnnualRevenue: revenue,
      estimatedAdditionAmount: Math.floor(revenue * rate),
      status: 'draft',
    });
    if (saved) {
      setShowPlanForm(false);
      loadData();
    }
  };

  const handleToggleCpReq = async (req: CareerPathRequirement) => {
    const updated = await tm.updateCareerPathRequirement(req.id, { isMet: !req.isMet });
    if (updated) loadData();
  };

  const handleToggleWpItem = async (item: WorkplaceEnvironmentItem) => {
    const updated = await tm.updateWorkplaceEnvironmentItem(item.id, { isImplemented: !item.isImplemented });
    if (updated) loadData();
  };

  if (dataLoading) {
    return <LoadingSpinner />;
  }

  if (!plan) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Award size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">処遇改善加算計画がありません</h3>
          <p className="text-sm text-gray-500 mb-6">
            {currentFiscalYear}年度の処遇改善加算計画を作成して、要件充足状況の管理を始めましょう。
          </p>
          {showPlanForm ? (
            <div className="max-w-md mx-auto space-y-4 text-left">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">目標加算レベル</label>
                <select
                  value={planForm.additionLevel}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, additionLevel: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                >
                  <option value="I">加算 I（14.1%）</option>
                  <option value="II">加算 II（11.9%）</option>
                  <option value="III">加算 III（8.8%）</option>
                  <option value="IV">加算 IV（6.3%）</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">年間見込収益（円）</label>
                <input
                  type="number"
                  value={planForm.estimatedAnnualRevenue}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, estimatedAnnualRevenue: e.target.value }))}
                  placeholder="例: 30000000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreatePlan}
                  className="flex-1 py-2 rounded-lg text-white text-sm font-medium"
                  style={{ backgroundColor: ACCENT }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = ACCENT_HOVER)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = ACCENT)}
                >
                  作成
                </button>
                <button
                  onClick={() => setShowPlanForm(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowPlanForm(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: ACCENT }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = ACCENT_HOVER)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = ACCENT)}
            >
              <Plus size={16} />
              {currentFiscalYear}年度計画を作成
            </button>
          )}
        </div>
      </div>
    );
  }

  // Group workplace items by category
  const wpByCategory: Record<string, WorkplaceEnvironmentItem[]> = {};
  for (const item of wpItems) {
    if (!wpByCategory[item.category]) wpByCategory[item.category] = [];
    wpByCategory[item.category].push(item);
  }

  const estimatedAmount = plan.estimatedAdditionAmount || 0;
  const additionRate = ADDITION_RATES[plan.additionLevel] || 0;

  return (
    <div className="space-y-6">
      {/* Current Level Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: ACCENT }}>
              {levelStatus?.currentLevel || '-'}
            </div>
            <div>
              <p className="text-xs text-gray-500">現在の適格レベル</p>
              <p className="text-lg font-bold text-gray-800">
                {levelStatus?.currentLevel ? `加算${levelStatus.currentLevel}` : '未適格'}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            目標: 加算{plan.additionLevel}（{(additionRate * 100).toFixed(1)}%）
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">年間見込収益</p>
          <p className="text-xl font-bold text-gray-800">{formatYen(plan.estimatedAnnualRevenue || 0)}</p>
          <p className="text-xs text-gray-400 mt-1">加算率 {(additionRate * 100).toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">見込加算額（年間）</p>
          <p className="text-xl font-bold" style={{ color: ACCENT }}>{formatYen(estimatedAmount)}</p>
          <p className="text-xs text-gray-400 mt-1">月額約 {formatYen(Math.floor(estimatedAmount / 12))}</p>
        </div>
      </div>

      {/* Next level advice */}
      {levelStatus && levelStatus.nextLevelAdvice.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ArrowUpRight size={20} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-2">上位レベルに向けて</p>
              {levelStatus.nextLevelAdvice.map((advice, i) => (
                <p key={i} className="text-sm text-amber-700 mb-1">- {advice}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Career Path Requirements */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">キャリアパス要件</h3>
          <p className="text-xs text-gray-500 mt-1">各要件を充足するとチェックが入ります</p>
        </div>
        <div className="divide-y divide-gray-100">
          {cpRequirements.map((req) => {
            const meta = CAREER_PATH_LABELS[req.requirementLevel];
            return (
              <div key={req.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                <button
                  onClick={() => handleToggleCpReq(req)}
                  className="shrink-0"
                >
                  {req.isMet ? (
                    <CheckCircle size={22} style={{ color: ACCENT }} />
                  ) : (
                    <XCircle size={22} className="text-gray-300" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{meta?.label || req.requirementLevel}</p>
                  <p className="text-xs text-gray-500 truncate">{meta?.description || ''}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Workplace Environment */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-800">職場環境等要件（28項目）</h3>
              <p className="text-xs text-gray-500 mt-1">6カテゴリ中2カテゴリ以上で計6項目以上の取組が必要</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold" style={{ color: ACCENT }}>{wpItems.filter(i => i.isImplemented).length}/28</p>
              <p className="text-xs text-gray-500">実施済</p>
            </div>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {Object.entries(wpByCategory).map(([category, items]) => {
            const implementedInCat = items.filter(i => i.isImplemented).length;
            return (
              <CategoryAccordion
                key={category}
                category={category}
                items={items}
                implementedCount={implementedInCat}
                totalCount={items.length}
                onToggle={handleToggleWpItem}
              />
            );
          })}
        </div>
      </div>

      {/* Deadline Reminders */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Clock size={18} className="text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-800 mb-1">主要な提出期限</p>
            <p className="text-sm text-blue-700">計画書提出: 4月15日 / 実績報告: 翌年度7月末</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryAccordion({
  category,
  items,
  implementedCount,
  totalCount,
  onToggle,
}: {
  category: string;
  items: WorkplaceEnvironmentItem[];
  implementedCount: number;
  totalCount: number;
  onToggle: (item: WorkplaceEnvironmentItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ratio = totalCount > 0 ? (implementedCount / totalCount) * 100 : 0;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <ChevronRight size={16} className={`text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        <span className="text-sm font-medium text-gray-700 flex-1">{category}</span>
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${ratio}%`, backgroundColor: ACCENT }} />
          </div>
          <span className="text-xs text-gray-500 w-10 text-right">{implementedCount}/{totalCount}</span>
        </div>
      </button>
      {expanded && (
        <div className="pl-10 pr-5 pb-3 space-y-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onToggle(item)}
              className="w-full flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 text-left transition-colors"
            >
              {item.isImplemented ? (
                <CheckCircle size={18} style={{ color: ACCENT }} className="shrink-0" />
              ) : (
                <div className="w-[18px] h-[18px] rounded-full border-2 border-gray-300 shrink-0" />
              )}
              <span className={`text-sm ${item.isImplemented ? 'text-gray-700' : 'text-gray-500'}`}>
                {item.itemNumber}. {item.itemTitle}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================================================================
// Tab 2: 職位・賃金体系
// ==================================================================

function JobGradesTab({ facilityId }: { facilityId: string }) {
  const tm = useTalentManagement();
  const [grades, setGrades] = useState<JobGrade[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [editingGrade, setEditingGrade] = useState<Partial<JobGrade> | null>(null);

  const loadGrades = useCallback(async () => {
    setDataLoading(true);
    const data = await tm.fetchJobGrades();
    setGrades(data);
    setDataLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId]);

  useEffect(() => { loadGrades(); }, [loadGrades]);

  const handleSave = async () => {
    if (!editingGrade || !editingGrade.gradeName || editingGrade.gradeLevel == null) return;
    await tm.saveJobGrade(editingGrade as JobGrade & { gradeName: string; gradeLevel: number });
    setEditingGrade(null);
    loadGrades();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('この職位を削除しますか？')) return;
    await tm.deleteJobGrade(id);
    loadGrades();
  };

  if (dataLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Career Ladder Visual */}
      {grades.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-semibold text-gray-800 mb-4">キャリアラダー</h3>
          <div className="flex items-end gap-3 overflow-x-auto pb-2">
            {grades.map((grade, i) => {
              const heightPct = ((i + 1) / grades.length) * 100;
              return (
                <div key={grade.id} className="flex flex-col items-center min-w-[100px]">
                  <div
                    className="w-full rounded-t-lg flex items-end justify-center pb-2 px-2 text-white text-xs font-medium transition-all"
                    style={{
                      backgroundColor: ACCENT,
                      height: `${Math.max(40, heightPct * 1.5)}px`,
                      opacity: 0.5 + (i / grades.length) * 0.5,
                    }}
                  >
                    {grade.gradeName}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Lv.{grade.gradeLevel}</div>
                  {(grade.minSalary != null || grade.maxSalary != null) && (
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {grade.minSalary != null ? `${Math.floor(grade.minSalary / 10000)}万` : '?'}〜{grade.maxSalary != null ? `${Math.floor(grade.maxSalary / 10000)}万` : '?'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Grade Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">職位一覧</h3>
          <button
            onClick={() => setEditingGrade({ gradeLevel: (grades.length + 1), gradeName: '' })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium"
            style={{ backgroundColor: ACCENT }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = ACCENT_HOVER)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = ACCENT)}
          >
            <Plus size={14} /> 追加
          </button>
        </div>

        {/* Edit form */}
        {editingGrade && (
          <div className="p-5 border-b border-gray-100 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">職位名</label>
                <input
                  type="text"
                  value={editingGrade.gradeName || ''}
                  onChange={(e) => setEditingGrade(prev => prev ? { ...prev, gradeName: e.target.value } : prev)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                  placeholder="例: 一般職員"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">等級レベル</label>
                <input
                  type="number"
                  value={editingGrade.gradeLevel ?? ''}
                  onChange={(e) => setEditingGrade(prev => prev ? { ...prev, gradeLevel: parseInt(e.target.value) || 0 } : prev)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">最低月給（円）</label>
                <input
                  type="number"
                  value={editingGrade.minSalary ?? ''}
                  onChange={(e) => setEditingGrade(prev => prev ? { ...prev, minSalary: parseFloat(e.target.value) || null } : prev)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                  placeholder="例: 200000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">最高月給（円）</label>
                <input
                  type="number"
                  value={editingGrade.maxSalary ?? ''}
                  onChange={(e) => setEditingGrade(prev => prev ? { ...prev, maxSalary: parseFloat(e.target.value) || null } : prev)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                  placeholder="例: 300000"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">職責</label>
                <textarea
                  value={editingGrade.responsibilities || ''}
                  onChange={(e) => setEditingGrade(prev => prev ? { ...prev, responsibilities: e.target.value } : prev)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                  placeholder="この職位の職責・業務内容"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">任用要件</label>
                <textarea
                  value={editingGrade.appointmentRequirements || ''}
                  onChange={(e) => setEditingGrade(prev => prev ? { ...prev, appointmentRequirements: e.target.value } : prev)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                  placeholder="必要な資格・経験年数等"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">必要経験年数</label>
                <input
                  type="number"
                  value={editingGrade.requiredExperienceYears ?? ''}
                  onChange={(e) => setEditingGrade(prev => prev ? { ...prev, requiredExperienceYears: parseInt(e.target.value) || null } : prev)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: ACCENT }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = ACCENT_HOVER)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = ACCENT)}
              >
                <Save size={14} /> 保存
              </button>
              <button
                onClick={() => setEditingGrade(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm"
              >
                <X size={14} className="inline mr-1" />キャンセル
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        {grades.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            職位がまだ登録されていません。「追加」ボタンから職位を登録してください。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs">
                  <th className="px-5 py-3 text-left font-medium">等級</th>
                  <th className="px-5 py-3 text-left font-medium">職位名</th>
                  <th className="px-5 py-3 text-left font-medium">月給レンジ</th>
                  <th className="px-5 py-3 text-left font-medium">必要経験</th>
                  <th className="px-5 py-3 text-left font-medium">職責</th>
                  <th className="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {grades.map((grade) => (
                  <tr key={grade.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white" style={{ backgroundColor: ACCENT }}>
                        {grade.gradeLevel}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-800">{grade.gradeName}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {grade.minSalary != null || grade.maxSalary != null
                        ? `${grade.minSalary != null ? formatYen(grade.minSalary) : '?'} 〜 ${grade.maxSalary != null ? formatYen(grade.maxSalary) : '?'}`
                        : '-'}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {grade.requiredExperienceYears != null ? `${grade.requiredExperienceYears}年以上` : '-'}
                    </td>
                    <td className="px-5 py-3 text-gray-500 max-w-xs truncate">{grade.responsibilities || '-'}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditingGrade(grade)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(grade.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================================================================
// Tab 3: 研修計画
// ==================================================================

function TrainingPlanTab({ facilityId }: { facilityId: string }) {
  const { facility } = useAuth();
  const [trainings, setTrainings] = useState<Array<{
    id: string;
    name: string;
    date: string;
    status: string;
    category: string;
    participants: number;
  }>>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrainings = async () => {
      const fid = facilityId || facility?.id;
      if (!fid) { setDataLoading(false); return; }
      setDataLoading(true);
      try {
        const { data, error: err } = await (await import('@/lib/supabase')).supabase
          .from('training_records')
          .select('id, training_name, training_date, status, training_category, participants')
          .eq('facility_id', fid)
          .order('training_date', { ascending: false })
          .limit(50);
        if (err) throw err;
        setTrainings((data || []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: r.training_name as string,
          date: r.training_date as string,
          status: r.status as string,
          category: r.training_category as string,
          participants: Array.isArray(r.participants) ? (r.participants as unknown[]).length : 0,
        })));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setDataLoading(false);
      }
    };
    fetchTrainings();
  }, [facilityId, facility?.id]);

  if (dataLoading) return <LoadingSpinner />;

  const completed = trainings.filter(t => t.status === 'completed').length;
  const scheduled = trainings.filter(t => t.status === 'scheduled').length;
  const currentFY = new Date().getMonth() < 3 ? new Date().getFullYear() - 1 : new Date().getFullYear();

  const CATEGORY_LABELS: Record<string, string> = {
    mandatory: '法定研修',
    skill_improvement: 'スキル向上',
    safety: '安全管理',
    welfare: '福祉',
    medical: '医療',
    communication: 'コミュニケーション',
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">今年度の研修</p>
          <p className="text-2xl font-bold text-gray-800">{trainings.length}<span className="text-sm font-normal text-gray-500 ml-1">件</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">完了</p>
          <p className="text-2xl font-bold" style={{ color: ACCENT }}>{completed}<span className="text-sm font-normal text-gray-500 ml-1">件</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">予定</p>
          <p className="text-2xl font-bold text-amber-600">{scheduled}<span className="text-sm font-normal text-gray-500 ml-1">件</span></p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-800">キャリアパス要件 II 対応</p>
            <p className="text-sm text-blue-700 mt-1">
              研修計画を策定し実施記録を残すことで、処遇改善加算のキャリアパス要件 II を充足できます。
              研修の詳細な登録・管理は「研修・委員会」メニューから行えます。
            </p>
          </div>
        </div>
      </div>

      {/* Trainings list */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">{currentFY}年度 研修一覧</h3>
        </div>
        {error && (
          <div className="p-4 text-sm text-red-600">{error}</div>
        )}
        {trainings.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            研修記録がありません。「研修・委員会」メニューから研修を登録してください。
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {trainings.map((training) => (
              <div key={training.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{training.name}</p>
                  <p className="text-xs text-gray-500">{training.date} / {CATEGORY_LABELS[training.category] || training.category}</p>
                </div>
                <span className="text-xs text-gray-500">{training.participants}名</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  training.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                  training.status === 'scheduled' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-50 text-gray-400'
                }`}>
                  {training.status === 'completed' ? '完了' : training.status === 'scheduled' ? '予定' : '中止'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================================================================
// Tab 4: スタッフ概要
// ==================================================================

function StaffOverviewTab({ facilityId }: { facilityId: string }) {
  const tm = useTalentManagement();
  const [staffList, setStaffList] = useState<Array<{
    userId: string;
    employmentRecordId: string;
    name: string;
    email: string;
    role: string;
    employmentType: string;
    startDate: string;
    tenureDays: number;
    profilePhotoUrl?: string;
  }>>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setDataLoading(true);
      const data = await tm.fetchStaffOverview();
      setStaffList(data);
      setDataLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId]);

  if (dataLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">在籍スタッフ数</p>
          <p className="text-2xl font-bold text-gray-800">{staffList.length}<span className="text-sm font-normal text-gray-500 ml-1">名</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">常勤</p>
          <p className="text-2xl font-bold" style={{ color: ACCENT }}>
            {staffList.filter(s => s.employmentType === '常勤').length}
            <span className="text-sm font-normal text-gray-500 ml-1">名</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">非常勤</p>
          <p className="text-2xl font-bold text-gray-600">
            {staffList.filter(s => s.employmentType !== '常勤').length}
            <span className="text-sm font-normal text-gray-500 ml-1">名</span>
          </p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Target size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">キャリアパス要件 IV 対応</p>
            <p className="text-sm text-amber-700 mt-1">
              改善後の年額賃金440万円以上の職員が1名以上必要です。対象候補者を確認して要件充足を目指しましょう。
            </p>
          </div>
        </div>
      </div>

      {/* Staff table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">スタッフ一覧</h3>
        </div>
        {staffList.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            スタッフデータがありません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs">
                  <th className="px-5 py-3 text-left font-medium">氏名</th>
                  <th className="px-5 py-3 text-left font-medium">役割</th>
                  <th className="px-5 py-3 text-left font-medium">雇用形態</th>
                  <th className="px-5 py-3 text-left font-medium">入職日</th>
                  <th className="px-5 py-3 text-left font-medium">勤続</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staffList.map((staff) => (
                  <tr key={staff.employmentRecordId} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {staff.profilePhotoUrl ? (
                          <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                            <img src={staff.profilePhotoUrl} alt={staff.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: ACCENT }}>
                            {staff.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-800">{staff.name}</p>
                          <p className="text-xs text-gray-400">{staff.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{staff.role}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        staff.employmentType === '常勤' ? 'bg-[#00c4cc]/5 text-[#00c4cc]' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {staff.employmentType}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{staff.startDate || '-'}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {staff.tenureDays > 0 ? (
                        <span>
                          {Math.floor(staff.tenureDays / 365)}年{Math.floor((staff.tenureDays % 365) / 30)}ヶ月
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================================================================
// Tab 5: 届出スケジュール
// ==================================================================

function FilingScheduleTab({ facilityId }: { facilityId: string }) {
  const tm = useTalentManagement();
  const [plan, setPlan] = useState<TreatmentImprovementPlan | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const currentFiscalYear = new Date().getMonth() < 3 ? new Date().getFullYear() - 1 : new Date().getFullYear();

  useEffect(() => {
    const load = async () => {
      if (!facilityId) { setDataLoading(false); return; }
      setDataLoading(true);
      const p = await tm.fetchTreatmentPlan(currentFiscalYear);
      setPlan(p);
      setDataLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, currentFiscalYear]);

  if (dataLoading) return <LoadingSpinner />;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  const getFilingStatus = (item: typeof FILING_SCHEDULE[0]): 'upcoming' | 'past' | 'current' => {
    if (item.id === 'plan' && plan?.planSubmittedAt) return 'past';
    if (item.id === 'report' && plan?.performanceReportSubmittedAt) return 'past';
    if (item.month === currentMonth) return 'current';
    // Simplistic past/future check based on month
    if (item.month < currentMonth) return 'past';
    return 'upcoming';
  };

  // Show key filings
  const keyFilings = FILING_SCHEDULE.filter(f => f.id === 'plan' || f.id === 'report' || f.id === `system-${['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'][currentMonth - 1]}`);
  const allFilings = FILING_SCHEDULE;

  return (
    <div className="space-y-6">
      {/* Key deadlines */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={16} style={{ color: ACCENT }} />
            <p className="text-xs text-gray-500 font-medium">計画書提出</p>
          </div>
          <p className="text-lg font-bold text-gray-800">4月15日</p>
          {plan?.planSubmittedAt ? (
            <p className="text-xs mt-1" style={{ color: ACCENT }}>提出済 ({new Date(plan.planSubmittedAt).toLocaleDateString('ja-JP')})</p>
          ) : (
            <p className="text-xs text-gray-400 mt-1">未提出</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} style={{ color: ACCENT }} />
            <p className="text-xs text-gray-500 font-medium">体制届（今月）</p>
          </div>
          <p className="text-lg font-bold text-gray-800">{currentMonth}月15日</p>
          <p className="text-xs text-gray-400 mt-1">変更がある場合のみ</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} style={{ color: ACCENT }} />
            <p className="text-xs text-gray-500 font-medium">実績報告</p>
          </div>
          <p className="text-lg font-bold text-gray-800">翌年度7月末</p>
          {plan?.performanceReportSubmittedAt ? (
            <p className="text-xs mt-1" style={{ color: ACCENT }}>提出済</p>
          ) : (
            <p className="text-xs text-gray-400 mt-1">未提出</p>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">{currentFiscalYear}年度 届出スケジュール</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {allFilings.map((filing) => {
            const status = getFilingStatus(filing);
            const isCurrent = status === 'current';
            const isPast = status === 'past';
            return (
              <div key={filing.id} className={`flex items-center gap-4 px-5 py-3 ${isCurrent ? 'bg-[#00c4cc]/5' : ''}`}>
                <div className="shrink-0">
                  {isPast ? (
                    <CheckCircle size={18} style={{ color: ACCENT }} />
                  ) : isCurrent ? (
                    <AlertCircle size={18} className="text-amber-500" />
                  ) : (
                    <Clock size={18} className="text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isPast ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{filing.label}</p>
                  <p className="text-xs text-gray-500">{filing.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-medium ${isCurrent ? 'text-amber-600' : 'text-gray-600'}`}>{filing.deadline}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    isPast ? 'bg-gray-100 text-gray-500' :
                    isCurrent ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-50 text-gray-400'
                  }`}>
                    {isPast ? '完了' : isCurrent ? '今月' : '未到来'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ==================================================================
// Shared
// ==================================================================

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${ACCENT} transparent transparent transparent` }} />
    </div>
  );
}

function formatYen(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}億円`;
  }
  if (amount >= 10000) {
    return `${Math.floor(amount / 10000).toLocaleString()}万円`;
  }
  return `${amount.toLocaleString()}円`;
}
