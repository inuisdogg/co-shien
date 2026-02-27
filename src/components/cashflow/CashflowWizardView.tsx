'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  TrendingUp,
  Users,
  Building2,
  FileText,
  Wallet,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Printer,
  Copy,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { CashflowEntry, PLStatement } from '@/types';
import { useCashflowManagement, CashflowStatement } from '@/hooks/useCashflowManagement';

// ============================================================
// Helper: format yen
// ============================================================
function formatYen(amount: number): string {
  if (amount < 0) {
    return `-\u00A5${Math.abs(amount).toLocaleString('ja-JP')}`;
  }
  return `\u00A5${amount.toLocaleString('ja-JP')}`;
}

// ============================================================
// Helper: get days in month
// ============================================================
function getDaysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

// ============================================================
// Step definitions
// ============================================================
type WizardStep = {
  id: number;
  key: string;
  label: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  filterFn: (e: CashflowEntry) => boolean;
  hints: Record<string, string>;
};

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 0,
    key: 'income',
    label: '収入',
    subtitle: '今月の収入を入力してください',
    icon: TrendingUp,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    filterFn: (e) => e.category === 'income',
    hints: {
      '介護給付費収入': '国保連からの給付費',
      '利用者負担金': '利用者の自己負担金（上限額管理後）',
      '加算収入': '各種加算の合計額',
      '補助金・助成金': '市区町村からの補助金',
      'その他収入': 'その他の収入',
    },
  },
  {
    id: 1,
    key: 'personnel',
    label: '人件費',
    subtitle: '人件費を入力してください（最大の支出項目です）',
    icon: Users,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    filterFn: (e) => e.category === 'expense' && e.subcategory === 'personnel',
    hints: {
      '給与・賞与': '全職員の給与・賞与の合計',
      '法定福利費': '健康保険・厚生年金・雇用保険・労災保険の事業主負担分',
      '福利厚生費': '慶弔見舞金・健康診断費用など',
      '通勤手当': '全職員の通勤手当合計',
    },
  },
  {
    id: 2,
    key: 'operations',
    label: '事業費',
    subtitle: '施設運営にかかる費用を入力してください',
    icon: Building2,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    filterFn: (e) => e.category === 'expense' && e.subcategory === 'operations',
    hints: {
      '給食費': 'おやつ・給食材料費',
      '教材費': '療育教材・消耗品',
      '水道光熱費': '電気・ガス・水道',
      '賃借料': '施設の家賃・テナント料',
      '保険料': '火災保険・賠償保険など',
      '車両関連費': '送迎車のガソリン代・リース料・保険',
    },
  },
  {
    id: 3,
    key: 'admin',
    label: '事務費',
    subtitle: '事務管理にかかる費用を入力してください',
    icon: FileText,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    filterFn: (e) => e.category === 'expense' && e.subcategory === 'admin',
    hints: {
      '通信費': '電話・インターネット・郵送費',
      '消耗品費': '事務用品・コピー用紙など',
      '修繕費': '施設の修繕・メンテナンス費用',
      '業務委託費': '会計・労務・清掃等の外部委託費用',
      '減価償却費': '設備・車両等の減価償却費',
    },
  },
  {
    id: 4,
    key: 'other',
    label: 'その他',
    subtitle: 'その他の支出を入力してください',
    icon: Wallet,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    filterFn: (e) => e.category === 'expense' && e.subcategory === 'other_expense',
    hints: {
      '借入金返済': '金融機関への毎月の借入金返済額',
      '設備投資': '新規設備の購入・リース開始費用',
      'その他支出': 'その他の支出',
    },
  },
  {
    id: 5,
    key: 'complete',
    label: '完了！',
    subtitle: '入力が完了しました',
    icon: CheckCircle,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    filterFn: () => false,
    hints: {},
  },
];

// ============================================================
// Dashboard tabs
// ============================================================
type DashboardTab = 'overview' | 'pl' | 'cashflow';

// ============================================================
// Main component
// ============================================================
export default function CashflowWizardView() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';
  const {
    entries,
    balance,
    loading,
    saving,
    fetchEntries,
    saveAllEntries,
    deleteEntry,
    fetchBalance,
    saveBalance,
    initializeMonth,
    copyFromPreviousMonth,
    generatePL,
    generateCashflow,
  } = useCashflowManagement();

  // Mode: wizard or dashboard
  const [mode, setMode] = useState<'wizard' | 'dashboard'>('wizard');

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [localEntries, setLocalEntries] = useState<CashflowEntry[]>([]);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // Dashboard state
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('overview');
  const [openingBalanceInput, setOpeningBalanceInput] = useState('0');

  // Month selector
  const now = new Date();
  const [yearMonth, setYearMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );

  // Celebration state
  const [showCelebration, setShowCelebration] = useState(false);

  // Track if data has been loaded
  const dataLoadedRef = useRef(false);

  // ============================================================
  // Data loading
  // ============================================================
  useEffect(() => {
    if (!facilityId || !yearMonth) return;
    dataLoadedRef.current = false;

    const loadData = async () => {
      const fetched = await initializeMonth(facilityId, yearMonth);
      setLocalEntries(fetched);
      const bal = await fetchBalance(facilityId, yearMonth);
      setOpeningBalanceInput(String(bal?.openingBalance || 0));
      dataLoadedRef.current = true;
    };

    loadData();
  }, [facilityId, yearMonth, initializeMonth, fetchBalance, fetchEntries]);

  // Sync localEntries when entries from hook change
  useEffect(() => {
    if (entries.length > 0) {
      setLocalEntries(entries);
    }
  }, [entries]);

  // ============================================================
  // Month navigation
  // ============================================================
  const navigateMonth = useCallback((direction: -1 | 1) => {
    const [y, m] = yearMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + direction, 1);
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    setCurrentStep(0);
  }, [yearMonth]);

  const yearMonthLabel = useMemo(() => {
    const [y, m] = yearMonth.split('-').map(Number);
    return `${y}年${m}月`;
  }, [yearMonth]);

  // ============================================================
  // Entry editing (local state)
  // ============================================================
  const updateLocalAmount = useCallback((id: string, amount: number) => {
    setLocalEntries(prev =>
      prev.map(e => (e.id === id ? { ...e, amount } : e))
    );
  }, []);

  const updateLocalNotes = useCallback((id: string, notes: string) => {
    setLocalEntries(prev =>
      prev.map(e => (e.id === id ? { ...e, notes } : e))
    );
  }, []);

  const toggleNotes = useCallback((id: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Add custom item
  const addCustomItem = useCallback((step: WizardStep) => {
    const category = step.key === 'income' ? 'income' : 'expense';
    let subcategory = step.key;
    if (step.key === 'other') subcategory = 'other_expense';
    if (step.key === 'income') subcategory = 'other';

    // Find max sort order in this group
    const stepEntries = localEntries.filter(step.filterFn);
    const maxSort = stepEntries.length > 0
      ? Math.max(...stepEntries.map(e => e.sortOrder))
      : 0;

    const newEntry: CashflowEntry = {
      id: crypto.randomUUID(),
      facilityId,
      yearMonth,
      category: category as 'income' | 'expense',
      subcategory,
      itemName: '新しい項目',
      amount: 0,
      sortOrder: maxSort + 1,
      isTemplateItem: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setLocalEntries(prev => [...prev, newEntry]);
  }, [facilityId, yearMonth, localEntries]);

  // Delete custom item
  const removeCustomItem = useCallback(async (id: string) => {
    setLocalEntries(prev => prev.filter(e => e.id !== id));
    await deleteEntry(id);
  }, [deleteEntry]);

  // Update custom item name
  const updateItemName = useCallback((id: string, name: string) => {
    setLocalEntries(prev =>
      prev.map(e => (e.id === id ? { ...e, itemName: name } : e))
    );
  }, []);

  // ============================================================
  // Auto-save on step transition
  // ============================================================
  const saveCurrentStepData = useCallback(async () => {
    if (!facilityId || !yearMonth || localEntries.length === 0) return;
    await saveAllEntries(localEntries);
  }, [facilityId, yearMonth, localEntries, saveAllEntries]);

  const goToStep = useCallback(async (step: number) => {
    if (step < 0 || step > WIZARD_STEPS.length - 1) return;
    // Save current data before transitioning
    await saveCurrentStepData();
    setCurrentStep(step);

    // Show celebration on final step
    if (step === WIZARD_STEPS.length - 1) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3000);
    }
  }, [saveCurrentStepData]);

  // ============================================================
  // Copy from previous month
  // ============================================================
  const handleCopyPrevious = useCallback(async () => {
    if (!facilityId || !yearMonth) return;
    if (!confirm('前月のデータを今月にコピーしますか？現在の入力内容は上書きされます。')) return;
    const copied = await copyFromPreviousMonth(facilityId, yearMonth);
    if (copied.length > 0) {
      setLocalEntries(copied);
    } else {
      alert('前月のデータが見つかりませんでした。');
    }
  }, [facilityId, yearMonth, copyFromPreviousMonth]);

  // ============================================================
  // Save opening balance
  // ============================================================
  const handleSaveBalance = useCallback(async () => {
    const amount = parseInt(openingBalanceInput, 10) || 0;
    await saveBalance(facilityId, yearMonth, amount);
  }, [facilityId, yearMonth, openingBalanceInput, saveBalance]);

  // ============================================================
  // P&L and Cashflow generation (memoized)
  // ============================================================
  const pl: PLStatement = useMemo(() => {
    return generatePL(localEntries, yearMonth);
  }, [localEntries, yearMonth, generatePL]);

  const cf: CashflowStatement = useMemo(() => {
    const ob = parseInt(openingBalanceInput, 10) || 0;
    return generateCashflow(pl, ob);
  }, [pl, openingBalanceInput, generateCashflow]);

  // ============================================================
  // Totals for wizard steps
  // ============================================================
  const stepTotals = useMemo(() => {
    return WIZARD_STEPS.map(step => {
      const stepEntries = localEntries.filter(step.filterFn);
      return stepEntries.reduce((sum, e) => sum + e.amount, 0);
    });
  }, [localEntries]);

  const totalIncome = useMemo(() => {
    return localEntries
      .filter(e => e.category === 'income')
      .reduce((sum, e) => sum + e.amount, 0);
  }, [localEntries]);

  const totalExpenses = useMemo(() => {
    return localEntries
      .filter(e => e.category === 'expense')
      .reduce((sum, e) => sum + e.amount, 0);
  }, [localEntries]);

  // ============================================================
  // Print
  // ============================================================
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // ============================================================
  // RENDER
  // ============================================================
  if (loading && localEntries.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-t-transparent border-teal-500 rounded-full animate-spin" />
        <span className="ml-3 text-gray-500">読み込み中...</span>
      </div>
    );
  }

  // ============================================================
  // WIZARD MODE
  // ============================================================
  if (mode === 'wizard') {
    const step = WIZARD_STEPS[currentStep];
    const stepEntries = localEntries.filter(step.filterFn).sort((a, b) => a.sortOrder - b.sortOrder);
    const StepIcon = step.icon;

    return (
      <div className="max-w-3xl mx-auto pb-8 print:hidden">
        {/* Month selector */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">収支管理</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <span className="text-base font-semibold text-gray-700 min-w-[100px] text-center">
              {yearMonthLabel}
            </span>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between relative">
            {/* Progress line */}
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 z-0" />
            <div
              className="absolute top-4 left-0 h-0.5 bg-teal-500 z-0 transition-all duration-500"
              style={{ width: `${(currentStep / (WIZARD_STEPS.length - 1)) * 100}%` }}
            />

            {WIZARD_STEPS.map((s, i) => {
              const isCompleted = i < currentStep;
              const isCurrent = i === currentStep;
              const SIcon = s.icon;
              return (
                <button
                  key={s.key}
                  onClick={() => goToStep(i)}
                  className="relative z-10 flex flex-col items-center gap-1.5 group"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isCompleted
                        ? 'bg-teal-500 text-white'
                        : isCurrent
                        ? 'bg-white border-2 border-teal-500 text-teal-500 shadow-md animate-pulse'
                        : 'bg-white border-2 border-gray-200 text-gray-400'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle size={16} />
                    ) : (
                      <SIcon size={14} />
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-medium whitespace-nowrap ${
                      isCurrent ? 'text-teal-600' : isCompleted ? 'text-teal-500' : 'text-gray-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        {currentStep < WIZARD_STEPS.length - 1 ? (
          <>
            {/* Step header */}
            <div className={`rounded-xl p-5 mb-6 ${step.bgColor} border ${step.borderColor}`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-white/80 ${step.color}`}>
                  <StepIcon size={24} />
                </div>
                <div>
                  <h2 className={`text-lg font-bold ${step.color}`}>
                    {step.label}
                  </h2>
                  <p className="text-sm text-gray-600">{step.subtitle}</p>
                </div>
              </div>
            </div>

            {/* Entry cards */}
            <div className="space-y-3">
              {stepEntries.map(entry => (
                <div
                  key={entry.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {entry.isTemplateItem ? (
                        <p className="font-semibold text-gray-800 text-sm">
                          {entry.itemName}
                        </p>
                      ) : (
                        <input
                          type="text"
                          value={entry.itemName}
                          onChange={e => updateItemName(entry.id, e.target.value)}
                          className="font-semibold text-gray-800 text-sm bg-transparent border-b border-dashed border-gray-300 focus:border-teal-500 outline-none w-full pb-0.5"
                          placeholder="項目名を入力"
                        />
                      )}
                      {step.hints[entry.itemName] && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {step.hints[entry.itemName]}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg font-medium">
                          ¥
                        </span>
                        <input
                          type="number"
                          value={entry.amount || ''}
                          onChange={e => updateLocalAmount(entry.id, parseInt(e.target.value, 10) || 0)}
                          className="w-44 pl-8 pr-3 py-2.5 text-right text-lg font-semibold text-gray-800 bg-gray-50 rounded-lg border border-gray-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 outline-none transition-colors"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                      {!entry.isTemplateItem && (
                        <button
                          onClick={() => removeCustomItem(entry.id)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          title="削除"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Notes toggle */}
                  <div className="mt-2">
                    <button
                      onClick={() => toggleNotes(entry.id)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {expandedNotes.has(entry.id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      メモ
                    </button>
                    {expandedNotes.has(entry.id) && (
                      <textarea
                        value={entry.notes || ''}
                        onChange={e => updateLocalNotes(entry.id, e.target.value)}
                        className="mt-1.5 w-full text-xs text-gray-600 bg-gray-50 rounded-lg border border-gray-200 p-2 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 outline-none resize-none"
                        rows={2}
                        placeholder="メモを入力..."
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add custom item */}
            <button
              onClick={() => addCustomItem(step)}
              className={`mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed ${step.borderColor} ${step.color} hover:bg-white/50 transition-colors text-sm font-medium`}
            >
              <Plus size={16} />
              項目を追加
            </button>

            {/* Running total */}
            <div className={`mt-6 p-4 rounded-xl ${step.bgColor} border ${step.borderColor}`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${step.color}`}>
                  {step.label}合計
                </span>
                <span className={`text-xl font-bold ${step.color}`}>
                  {formatYen(stepTotals[currentStep])}
                </span>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => goToStep(currentStep - 1)}
                disabled={currentStep === 0}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  currentStep === 0
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <ChevronLeft size={16} />
                前へ
              </button>
              <button
                onClick={() => goToStep(currentStep + 1)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium bg-teal-500 text-white hover:bg-teal-600 transition-colors shadow-sm"
              >
                {currentStep === WIZARD_STEPS.length - 2 ? '完了' : '次へ'}
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Saving indicator */}
            {saving && (
              <div className="fixed bottom-4 right-4 bg-teal-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 z-50">
                <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                保存中...
              </div>
            )}
          </>
        ) : (
          /* ============================================================ */
          /* Step 6: Complete */
          /* ============================================================ */
          <div className="relative">
            {/* Celebration animation */}
            {showCelebration && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
                {Array.from({ length: 30 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute animate-bounce"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      animationDelay: `${Math.random() * 1}s`,
                      animationDuration: `${0.5 + Math.random() * 1}s`,
                    }}
                  >
                    <Sparkles
                      size={12 + Math.random() * 16}
                      className={`${
                        ['text-teal-400', 'text-emerald-400', 'text-yellow-400', 'text-blue-400', 'text-pink-400'][
                          Math.floor(Math.random() * 5)
                        ]
                      }`}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-1">入力完了！</h2>
              <p className="text-sm text-gray-500">{yearMonthLabel}の収支データを入力しました</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <p className="text-xs text-emerald-600 font-medium mb-1">収入合計</p>
                <p className="text-lg font-bold text-emerald-700">{formatYen(totalIncome)}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <p className="text-xs text-red-600 font-medium mb-1">支出合計</p>
                <p className="text-lg font-bold text-red-700">{formatYen(totalExpenses)}</p>
              </div>
              <div className={`${totalIncome - totalExpenses >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'} border rounded-xl p-4 text-center`}>
                <p className={`text-xs font-medium mb-1 ${totalIncome - totalExpenses >= 0 ? 'text-blue-600' : 'text-red-600'}`}>損益</p>
                <p className={`text-lg font-bold ${totalIncome - totalExpenses >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                  {formatYen(totalIncome - totalExpenses)}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => goToStep(0)}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
              >
                入力を修正する
              </button>
              <button
                onClick={() => {
                  saveCurrentStepData();
                  setMode('dashboard');
                }}
                className="px-6 py-2.5 rounded-lg text-sm font-medium bg-teal-500 text-white hover:bg-teal-600 transition-colors shadow-sm"
              >
                帳票を確認
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // DASHBOARD MODE
  // ============================================================
  return (
    <div className="max-w-5xl mx-auto pb-8">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 print:mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-800 print:text-lg">収支管理</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors print:hidden"
            >
              <ChevronLeft size={16} className="text-gray-600" />
            </button>
            <span className="text-base font-semibold text-gray-700 min-w-[100px] text-center">
              {yearMonthLabel}
            </span>
            <button
              onClick={() => navigateMonth(1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors print:hidden"
            >
              <ChevronRight size={16} className="text-gray-600" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={() => { setMode('wizard'); setCurrentStep(0); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 transition-colors border border-teal-200"
          >
            <Sparkles size={14} />
            ウィザードで入力
          </button>
          <button
            onClick={handleCopyPrevious}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
          >
            <Copy size={14} />
            前月からコピー
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
          >
            <Printer size={14} />
            PDF出力
          </button>
        </div>
      </div>

      {/* Dashboard tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 print:hidden">
        {([
          { key: 'overview' as DashboardTab, label: '概要' },
          { key: 'pl' as DashboardTab, label: '損益計算書' },
          { key: 'cashflow' as DashboardTab, label: 'キャッシュフロー計算書' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setDashboardTab(tab.key)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              dashboardTab === tab.key
                ? 'bg-white text-teal-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/* OVERVIEW TAB */}
      {/* ============================================================ */}
      {dashboardTab === 'overview' && (
        <div>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <TrendingUp size={16} className="text-emerald-600" />
                </div>
                <span className="text-sm text-gray-500">収入合計</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{formatYen(pl.income.total)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <Wallet size={16} className="text-red-600" />
                </div>
                <span className="text-sm text-gray-500">支出合計</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{formatYen(pl.expenses.total)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  pl.netIncome >= 0 ? 'bg-blue-100' : 'bg-red-100'
                }`}>
                  <CheckCircle size={16} className={pl.netIncome >= 0 ? 'text-blue-600' : 'text-red-600'} />
                </div>
                <span className="text-sm text-gray-500">当月損益</span>
              </div>
              <p className={`text-2xl font-bold ${pl.netIncome >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatYen(pl.netIncome)}
              </p>
            </div>
          </div>

          {/* Expense breakdown donut + bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Expense breakdown (CSS donut) */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-4">支出内訳</h3>
              {pl.expenses.total > 0 ? (
                <div className="flex items-center gap-6">
                  {/* CSS Donut */}
                  <div className="relative w-32 h-32 shrink-0">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      {(() => {
                        const segments = [
                          { value: pl.expenses.personnel.total, color: '#3B82F6', label: '人件費' },
                          { value: pl.expenses.operations.total, color: '#8B5CF6', label: '事業費' },
                          { value: pl.expenses.admin.total, color: '#F97316', label: '事務費' },
                          { value: pl.expenses.other.total, color: '#EF4444', label: 'その他' },
                        ];
                        const total = pl.expenses.total || 1;
                        let offset = 0;
                        return segments.map((seg, i) => {
                          const pct = (seg.value / total) * 100;
                          const dashArray = `${pct} ${100 - pct}`;
                          const el = (
                            <circle
                              key={i}
                              cx="18"
                              cy="18"
                              r="15.9"
                              fill="none"
                              stroke={seg.color}
                              strokeWidth="3.5"
                              strokeDasharray={dashArray}
                              strokeDashoffset={-offset}
                              className="transition-all duration-500"
                            />
                          );
                          offset += pct;
                          return el;
                        });
                      })()}
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400">支出合計</p>
                        <p className="text-xs font-bold text-gray-700">{formatYen(pl.expenses.total)}</p>
                      </div>
                    </div>
                  </div>
                  {/* Legend */}
                  <div className="space-y-2 flex-1">
                    {[
                      { label: '人件費', value: pl.expenses.personnel.total, color: 'bg-blue-500' },
                      { label: '事業費', value: pl.expenses.operations.total, color: 'bg-purple-500' },
                      { label: '事務費', value: pl.expenses.admin.total, color: 'bg-orange-500' },
                      { label: 'その他', value: pl.expenses.other.total, color: 'bg-red-500' },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                          <span className="text-xs text-gray-600">{item.label}</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-700">{formatYen(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">データなし</p>
              )}
            </div>

            {/* Income vs Expense bar comparison */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-4">収入 vs 支出</h3>
              <div className="space-y-4 pt-2">
                {[
                  { label: '収入', value: pl.income.total, color: 'bg-emerald-500', barBg: 'bg-emerald-100' },
                  { label: '支出', value: pl.expenses.total, color: 'bg-red-500', barBg: 'bg-red-100' },
                ].map(bar => {
                  const maxVal = Math.max(pl.income.total, pl.expenses.total) || 1;
                  const pct = (bar.value / maxVal) * 100;
                  return (
                    <div key={bar.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-gray-600">{bar.label}</span>
                        <span className="text-sm font-bold text-gray-700">{formatYen(bar.value)}</span>
                      </div>
                      <div className={`h-6 rounded-full ${bar.barBg} overflow-hidden`}>
                        <div
                          className={`h-full rounded-full ${bar.color} transition-all duration-700`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">差額</span>
                    <span className={`text-sm font-bold ${pl.netIncome >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatYen(pl.netIncome)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* P&L TAB */}
      {/* ============================================================ */}
      {(dashboardTab === 'pl' || typeof window !== 'undefined') && (
        <div className={dashboardTab === 'pl' ? '' : 'hidden print:block'}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:shadow-none print:border-0">
            <div className="p-6 print:p-4">
              <h2 className="text-center text-lg font-bold text-gray-800 mb-1">損益計算書</h2>
              <p className="text-center text-xs text-gray-500 mb-6">
                期間: {(() => {
                  const [y, m] = yearMonth.split('-').map(Number);
                  const days = getDaysInMonth(yearMonth);
                  return `${y}年${m}月1日〜${y}年${m}月${days}日`;
                })()}
              </p>

              <table className="w-full text-sm">
                <tbody>
                  {/* Income section */}
                  <tr>
                    <td colSpan={2} className="py-2 font-bold text-gray-800 text-base">
                      【事業収入の部】
                    </td>
                  </tr>
                  {[
                    { label: '介護給付費収入', value: pl.income.benefits },
                    { label: '利用者負担金', value: pl.income.copay },
                    { label: '加算収入', value: pl.income.additions },
                    { label: '補助金・助成金', value: pl.income.subsidy },
                    { label: 'その他収入', value: pl.income.other },
                  ].map(row => (
                    <tr key={row.label}>
                      <td className="py-1.5 pl-6 text-gray-600">{row.label}</td>
                      <td className="py-1.5 text-right font-mono text-gray-700 w-40">{formatYen(row.value)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} className="py-1">
                      <div className="border-t border-gray-200" />
                    </td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="py-2 pl-6 text-gray-800">事業収入合計</td>
                    <td className="py-2 text-right font-mono text-emerald-700 w-40">{formatYen(pl.income.total)}</td>
                  </tr>

                  {/* Blank row */}
                  <tr><td colSpan={2} className="py-2" /></tr>

                  {/* Expenses section */}
                  <tr>
                    <td colSpan={2} className="py-2 font-bold text-gray-800 text-base">
                      【事業支出の部】
                    </td>
                  </tr>

                  {/* Personnel */}
                  <tr>
                    <td colSpan={2} className="py-1.5 pl-4 font-semibold text-gray-700">
                      (1) 人件費
                    </td>
                  </tr>
                  {[
                    { label: '給与・賞与', value: pl.expenses.personnel.salary },
                    { label: '法定福利費', value: pl.expenses.personnel.socialInsurance },
                    { label: '福利厚生費', value: pl.expenses.personnel.welfare },
                    { label: '通勤手当', value: pl.expenses.personnel.commuting },
                  ].map(row => (
                    <tr key={row.label}>
                      <td className="py-1 pl-10 text-gray-600">{row.label}</td>
                      <td className="py-1 text-right font-mono text-gray-700 w-40">{formatYen(row.value)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} className="py-1 pl-10 pr-0">
                      <div className="border-t border-gray-200" />
                    </td>
                  </tr>
                  <tr className="font-medium">
                    <td className="py-1.5 pl-10 text-gray-700">人件費小計</td>
                    <td className="py-1.5 text-right font-mono text-gray-700 w-40">{formatYen(pl.expenses.personnel.total)}</td>
                  </tr>

                  {/* Operations */}
                  <tr>
                    <td colSpan={2} className="py-1.5 pl-4 font-semibold text-gray-700 pt-3">
                      (2) 事業費
                    </td>
                  </tr>
                  {[
                    { label: '給食費', value: pl.expenses.operations.meals },
                    { label: '教材費', value: pl.expenses.operations.materials },
                    { label: '水道光熱費', value: pl.expenses.operations.utilities },
                    { label: '賃借料', value: pl.expenses.operations.rent },
                    { label: '保険料', value: pl.expenses.operations.insurance },
                    { label: '車両関連費', value: pl.expenses.operations.vehicle },
                  ].map(row => (
                    <tr key={row.label}>
                      <td className="py-1 pl-10 text-gray-600">{row.label}</td>
                      <td className="py-1 text-right font-mono text-gray-700 w-40">{formatYen(row.value)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} className="py-1 pl-10 pr-0">
                      <div className="border-t border-gray-200" />
                    </td>
                  </tr>
                  <tr className="font-medium">
                    <td className="py-1.5 pl-10 text-gray-700">事業費小計</td>
                    <td className="py-1.5 text-right font-mono text-gray-700 w-40">{formatYen(pl.expenses.operations.total)}</td>
                  </tr>

                  {/* Admin */}
                  <tr>
                    <td colSpan={2} className="py-1.5 pl-4 font-semibold text-gray-700 pt-3">
                      (3) 事務費
                    </td>
                  </tr>
                  {[
                    { label: '通信費', value: pl.expenses.admin.communication },
                    { label: '消耗品費', value: pl.expenses.admin.supplies },
                    { label: '修繕費', value: pl.expenses.admin.repairs },
                    { label: '業務委託費', value: pl.expenses.admin.outsourcing },
                    { label: '減価償却費', value: pl.expenses.admin.depreciation },
                  ].map(row => (
                    <tr key={row.label}>
                      <td className="py-1 pl-10 text-gray-600">{row.label}</td>
                      <td className="py-1 text-right font-mono text-gray-700 w-40">{formatYen(row.value)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} className="py-1 pl-10 pr-0">
                      <div className="border-t border-gray-200" />
                    </td>
                  </tr>
                  <tr className="font-medium">
                    <td className="py-1.5 pl-10 text-gray-700">事務費小計</td>
                    <td className="py-1.5 text-right font-mono text-gray-700 w-40">{formatYen(pl.expenses.admin.total)}</td>
                  </tr>

                  {/* Other */}
                  <tr>
                    <td colSpan={2} className="py-1.5 pl-4 font-semibold text-gray-700 pt-3">
                      (4) その他
                    </td>
                  </tr>
                  {[
                    { label: '借入金返済', value: pl.expenses.other.loanRepayment },
                    { label: '設備投資', value: pl.expenses.other.capex },
                    { label: 'その他支出', value: pl.expenses.other.misc },
                  ].map(row => (
                    <tr key={row.label}>
                      <td className="py-1 pl-10 text-gray-600">{row.label}</td>
                      <td className="py-1 text-right font-mono text-gray-700 w-40">{formatYen(row.value)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} className="py-1 pl-10 pr-0">
                      <div className="border-t border-gray-200" />
                    </td>
                  </tr>
                  <tr className="font-medium">
                    <td className="py-1.5 pl-10 text-gray-700">その他小計</td>
                    <td className="py-1.5 text-right font-mono text-gray-700 w-40">{formatYen(pl.expenses.other.total)}</td>
                  </tr>

                  {/* Total expenses */}
                  <tr>
                    <td colSpan={2} className="py-2">
                      <div className="border-t border-gray-300" />
                    </td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="py-2 pl-6 text-gray-800">事業支出合計</td>
                    <td className="py-2 text-right font-mono text-red-700 w-40">{formatYen(pl.expenses.total)}</td>
                  </tr>

                  {/* Net income */}
                  <tr>
                    <td colSpan={2} className="py-2">
                      <div className="border-t-2 border-gray-800" />
                    </td>
                  </tr>
                  <tr className="font-bold text-base">
                    <td className="py-3 pl-6 text-gray-900">当期事業活動収支差額</td>
                    <td className={`py-3 text-right font-mono w-40 ${
                      pl.netIncome >= 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}>
                      {formatYen(pl.netIncome)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CASHFLOW TAB */}
      {/* ============================================================ */}
      {dashboardTab === 'cashflow' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6">
            <h2 className="text-center text-lg font-bold text-gray-800 mb-1">キャッシュフロー計算書</h2>
            <p className="text-center text-xs text-gray-500 mb-6">
              期間: {yearMonthLabel}
            </p>

            <table className="w-full text-sm">
              <tbody>
                {/* Opening balance */}
                <tr>
                  <td className="py-2 font-semibold text-gray-800">前月繰越残高</td>
                  <td className="py-2 text-right w-52">
                    <div className="flex items-center justify-end gap-2 print:hidden">
                      <span className="text-gray-400">¥</span>
                      <input
                        type="number"
                        value={openingBalanceInput}
                        onChange={e => setOpeningBalanceInput(e.target.value)}
                        onBlur={handleSaveBalance}
                        className="w-36 text-right font-mono font-semibold text-gray-700 bg-gray-50 rounded-lg border border-gray-200 px-3 py-1.5 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 outline-none"
                      />
                    </div>
                    <span className="hidden print:inline font-mono font-semibold text-gray-700">
                      {formatYen(parseInt(openingBalanceInput, 10) || 0)}
                    </span>
                  </td>
                </tr>

                <tr><td colSpan={2} className="py-2" /></tr>

                {/* Section I: Operating */}
                <tr>
                  <td colSpan={2} className="py-2 font-bold text-gray-800 text-base">
                    【I 事業活動によるキャッシュフロー】
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 pl-6 text-gray-600">事業収入合計</td>
                  <td className="py-1.5 text-right font-mono text-emerald-700 w-40">{formatYen(pl.income.total)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 pl-6 text-gray-600">人件費支出</td>
                  <td className="py-1.5 text-right font-mono text-red-600 w-40">{formatYen(-pl.expenses.personnel.total)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 pl-6 text-gray-600">事業費支出</td>
                  <td className="py-1.5 text-right font-mono text-red-600 w-40">{formatYen(-pl.expenses.operations.total)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 pl-6 text-gray-600">事務費支出</td>
                  <td className="py-1.5 text-right font-mono text-red-600 w-40">{formatYen(-pl.expenses.admin.total)}</td>
                </tr>
                {pl.expenses.other.misc > 0 && (
                  <tr>
                    <td className="py-1.5 pl-6 text-gray-600">その他支出</td>
                    <td className="py-1.5 text-right font-mono text-red-600 w-40">{formatYen(-pl.expenses.other.misc)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={2} className="py-1 pl-6 pr-0">
                    <div className="border-t border-gray-200" />
                  </td>
                </tr>
                <tr className="font-semibold">
                  <td className="py-2 pl-6 text-gray-800">事業活動CF</td>
                  <td className={`py-2 text-right font-mono w-40 ${cf.operating - pl.expenses.other.misc >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatYen(cf.operating - pl.expenses.other.misc)}
                  </td>
                </tr>

                <tr><td colSpan={2} className="py-2" /></tr>

                {/* Section II: Investing */}
                <tr>
                  <td colSpan={2} className="py-2 font-bold text-gray-800 text-base">
                    【II 施設整備活動によるキャッシュフロー】
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 pl-6 text-gray-600">設備投資</td>
                  <td className="py-1.5 text-right font-mono text-gray-700 w-40">{formatYen(cf.investing)}</td>
                </tr>
                <tr>
                  <td colSpan={2} className="py-1 pl-6 pr-0">
                    <div className="border-t border-gray-200" />
                  </td>
                </tr>
                <tr className="font-semibold">
                  <td className="py-2 pl-6 text-gray-800">施設整備活動CF</td>
                  <td className={`py-2 text-right font-mono w-40 ${cf.investing >= 0 ? 'text-gray-700' : 'text-red-700'}`}>
                    {formatYen(cf.investing)}
                  </td>
                </tr>

                <tr><td colSpan={2} className="py-2" /></tr>

                {/* Section III: Financing */}
                <tr>
                  <td colSpan={2} className="py-2 font-bold text-gray-800 text-base">
                    【III 財務活動によるキャッシュフロー】
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 pl-6 text-gray-600">借入金返済</td>
                  <td className="py-1.5 text-right font-mono text-gray-700 w-40">{formatYen(cf.financing)}</td>
                </tr>
                <tr>
                  <td colSpan={2} className="py-1 pl-6 pr-0">
                    <div className="border-t border-gray-200" />
                  </td>
                </tr>
                <tr className="font-semibold">
                  <td className="py-2 pl-6 text-gray-800">財務活動CF</td>
                  <td className={`py-2 text-right font-mono w-40 ${cf.financing >= 0 ? 'text-gray-700' : 'text-red-700'}`}>
                    {formatYen(cf.financing)}
                  </td>
                </tr>

                {/* Net cashflow */}
                <tr>
                  <td colSpan={2} className="py-3">
                    <div className="border-t-2 border-gray-800" />
                  </td>
                </tr>
                <tr className="font-bold text-base">
                  <td className="py-2 pl-6 text-gray-900">当月キャッシュフロー</td>
                  <td className={`py-2 text-right font-mono w-40 ${cf.netCashflow >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatYen(cf.netCashflow)}
                  </td>
                </tr>
                <tr className="font-bold text-base">
                  <td className="py-2 pl-6 text-gray-900">当月末残高</td>
                  <td className={`py-2 text-right font-mono w-40 ${cf.closingBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatYen(cf.closingBalance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Saving indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-teal-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 z-50 print:hidden">
          <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
          保存中...
        </div>
      )}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .max-w-5xl,
          .max-w-5xl * {
            visibility: visible;
          }
          .max-w-5xl {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
          .hidden.print\\:block {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
