'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Zap,
  FileSearch,
  Shield,
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  Sparkles,
  FileText,
  Users,
  Calculator,
  Receipt,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Edit3,
  Plus,
  Trash2,
  Eye,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useBillingWizard,
  ValidationItem,
  UsageVerificationResult,
  UpperLimitCheckResult,
  MonthlyBillingStatus,
  ChildUsageSummary,
  UpperLimitChildResult,
} from '@/hooks/useBillingWizard';
import { BillingRecord, BillingDetail, BillingStatus } from '@/types';

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
// Helper: income category label
// ============================================================
const INCOME_CATEGORY_LABELS: Record<string, string> = {
  general: '一般2',
  general_low: '一般1',
  low_income: '低所得',
  welfare: '生活保護',
};

function getIncomeCategoryLabel(category?: string): string {
  if (!category) return '未設定';
  return INCOME_CATEGORY_LABELS[category] || category;
}

// ============================================================
// Status config
// ============================================================
const STATUS_CONFIG: Record<BillingStatus, { label: string; color: string; bg: string }> = {
  draft: { label: '下書き', color: 'text-gray-600', bg: 'bg-gray-100' },
  confirmed: { label: '確定', color: 'text-blue-600', bg: 'bg-blue-100' },
  submitted: { label: '提出済', color: 'text-green-600', bg: 'bg-green-100' },
  paid: { label: '入金済', color: 'text-emerald-600', bg: 'bg-emerald-100' },
};

// ============================================================
// Step definitions
// ============================================================
type WizardStepDef = {
  id: number;
  key: string;
  label: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
};

const WIZARD_STEPS: WizardStepDef[] = [
  { id: 0, key: 'month', label: '対象月選択', subtitle: '請求対象の月を選択', icon: Calendar, color: 'text-teal-600', bgColor: 'bg-teal-50', borderColor: 'border-teal-200' },
  { id: 1, key: 'verify', label: '実績確認', subtitle: '利用実績データの確認', icon: ClipboardCheck, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  { id: 2, key: 'generate', label: '請求データ生成', subtitle: '請求データの自動生成', icon: Zap, color: 'text-indigo-600', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200' },
  { id: 3, key: 'review', label: '明細確認・修正', subtitle: '請求明細の確認と修正', icon: FileSearch, color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
  { id: 4, key: 'upperlimit', label: '上限管理確認', subtitle: '利用者負担上限の確認', icon: Shield, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  { id: 5, key: 'export', label: '確定・CSV出力', subtitle: '確定してCSVを出力', icon: Download, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
];

// ============================================================
// SummaryCard
// ============================================================
function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  const colorMap: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
    teal: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', iconBg: 'bg-teal-100' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', iconBg: 'bg-blue-100' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', iconBg: 'bg-indigo-100' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', iconBg: 'bg-emerald-100' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', iconBg: 'bg-amber-100' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', iconBg: 'bg-purple-100' },
    gray: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', iconBg: 'bg-gray-100' },
  };

  const c = colorMap[color] || colorMap.teal;

  return (
    <div className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${c.iconBg}`}>
          <Icon size={14} className={c.text} />
        </div>
        <span className={`text-xs font-medium ${c.text} opacity-80`}>{label}</span>
      </div>
      <div className={`text-lg font-bold ${c.text}`}>{value}</div>
    </div>
  );
}

// ============================================================
// StepIndicator
// ============================================================
function StepIndicator({
  steps,
  currentStep,
  onStepClick,
}: {
  steps: WizardStepDef[];
  currentStep: number;
  onStepClick: (step: number) => void;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between relative">
        {/* Background progress line */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 z-0" />
        {/* Active progress line */}
        <div
          className="absolute top-4 left-0 h-0.5 bg-[#00c4cc] z-0 transition-all duration-500"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((s, i) => {
          const isCompleted = i < currentStep;
          const isCurrent = i === currentStep;
          const SIcon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => {
                if (isCompleted) onStepClick(i);
              }}
              disabled={!isCompleted && !isCurrent}
              className={`relative z-10 flex flex-col items-center gap-1.5 group ${
                isCompleted ? 'cursor-pointer' : isCurrent ? 'cursor-default' : 'cursor-not-allowed'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCompleted
                    ? 'bg-[#00c4cc] text-white'
                    : isCurrent
                    ? 'bg-white border-2 border-[#00c4cc] text-[#00c4cc] shadow-md'
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
                  isCurrent ? 'text-[#00c4cc]' : isCompleted ? 'text-[#00c4cc]' : 'text-gray-400'
                }`}
              >
                {s.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// ValidationPanel
// ============================================================
function ValidationPanel({ validations }: { validations: ValidationItem[] }) {
  const errors = validations.filter((v) => v.severity === 'error');
  const warnings = validations.filter((v) => v.severity === 'warning');
  const infos = validations.filter((v) => v.severity === 'info');

  if (validations.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
        <CheckCircle size={18} className="text-emerald-600 shrink-0" />
        <span className="text-sm text-emerald-700 font-medium">問題は見つかりませんでした</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={16} className="text-red-600" />
            <span className="text-sm font-semibold text-red-700">エラー ({errors.length}件)</span>
          </div>
          <ul className="space-y-1.5">
            {errors.map((v, i) => (
              <li key={i} className="text-sm text-red-600 flex items-start gap-2 pl-6">
                <span className="w-1 h-1 rounded-full bg-red-400 mt-2 shrink-0" />
                {v.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <span className="text-sm font-semibold text-amber-700">警告 ({warnings.length}件)</span>
          </div>
          <ul className="space-y-1.5">
            {warnings.map((v, i) => (
              <li key={i} className="text-sm text-amber-600 flex items-start gap-2 pl-6">
                <span className="w-1 h-1 rounded-full bg-amber-400 mt-2 shrink-0" />
                {v.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {infos.length > 0 && (
        <div className="bg-[#00c4cc]/5 border border-[#00c4cc]/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info size={16} className="text-[#00c4cc]" />
            <span className="text-sm font-semibold text-[#00c4cc]">情報 ({infos.length}件)</span>
          </div>
          <ul className="space-y-1.5">
            {infos.map((v, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-2 pl-6">
                <span className="w-1 h-1 rounded-full bg-gray-400 mt-2 shrink-0" />
                {v.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main component
// ============================================================
export default function BillingWizardView() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const {
    billingRecords,
    billingDetails,
    serviceCodes,
    isLoading,
    error,
    fetchBillingRecords,
    fetchBillingDetails,
    fetchServiceCodes,
    generateMonthlyBilling,
    updateBillingRecord,
    updateBillingDetail,
    confirmBilling,
    exportCSV,
    calculateCopay,
    fetchUsageVerification,
    fetchUpperLimitCheck,
    getMonthlyBillingStatus,
  } = useBillingWizard();

  // ── Mode ──
  const [mode, setMode] = useState<'wizard' | 'dashboard'>('wizard');

  // ── Wizard state ──
  const [currentStep, setCurrentStep] = useState(0);
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // ── Step-specific state ──
  const [verificationResult, setVerificationResult] = useState<UsageVerificationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [generationSummary, setGenerationSummary] = useState<{
    childCount: number;
    totalUnits: number;
    totalAmount: number;
    insuranceAmount: number;
    copayAmount: number;
  } | null>(null);
  const [upperLimitResult, setUpperLimitResult] = useState<UpperLimitCheckResult | null>(null);
  const [expandedChildId, setExpandedChildId] = useState<string | null>(null);
  const [childDetails, setChildDetails] = useState<Record<string, BillingDetail[]>>({});
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [monthlyStatus, setMonthlyStatus] = useState<MonthlyBillingStatus | null>(null);
  const [csvPreview, setCsvPreview] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCheckingUpperLimit, setIsCheckingUpperLimit] = useState(false);

  // ============================================================
  // Month label
  // ============================================================
  const yearMonthLabel = useMemo(() => {
    const [y, m] = yearMonth.split('-').map(Number);
    return `${y}年${m}月`;
  }, [yearMonth]);

  // ============================================================
  // Month navigation
  // ============================================================
  const navigateMonth = useCallback((direction: -1 | 1) => {
    const [y, m] = yearMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + direction, 1);
    const newYM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setYearMonth(newYM);
    setCurrentStep(0);
    setVerificationResult(null);
    setIsGenerated(false);
    setGenerationSummary(null);
    setUpperLimitResult(null);
    setExpandedChildId(null);
    setChildDetails({});
    setIsConfirmed(false);
    setCsvPreview('');
    setMonthlyStatus(null);
  }, [yearMonth]);

  // ============================================================
  // Load monthly status on mount and when yearMonth changes (step 0)
  // ============================================================
  useEffect(() => {
    if (!facilityId || !yearMonth) return;
    const loadStatus = async () => {
      const status = await getMonthlyBillingStatus(facilityId, yearMonth);
      setMonthlyStatus(status);
    };
    loadStatus();
  }, [facilityId, yearMonth, getMonthlyBillingStatus]);

  // ============================================================
  // Auto-fetch on step enter
  // ============================================================
  useEffect(() => {
    if (!facilityId || !yearMonth) return;

    if (currentStep === 1 && !verificationResult && !isVerifying) {
      const loadVerification = async () => {
        setIsVerifying(true);
        const result = await fetchUsageVerification(facilityId, yearMonth);
        setVerificationResult(result);
        setIsVerifying(false);
      };
      loadVerification();
    }

    if (currentStep === 3) {
      fetchBillingRecords(facilityId, yearMonth);
    }

    if (currentStep === 4 && !upperLimitResult && !isCheckingUpperLimit) {
      const loadUpperLimit = async () => {
        setIsCheckingUpperLimit(true);
        const result = await fetchUpperLimitCheck(facilityId, yearMonth);
        setUpperLimitResult(result);
        setIsCheckingUpperLimit(false);
      };
      loadUpperLimit();
    }

    if (currentStep === 5) {
      fetchBillingRecords(facilityId, yearMonth);
    }
  }, [
    currentStep,
    facilityId,
    yearMonth,
    verificationResult,
    upperLimitResult,
    isVerifying,
    isCheckingUpperLimit,
    fetchUsageVerification,
    fetchUpperLimitCheck,
    fetchBillingRecords,
  ]);

  // ============================================================
  // canAdvance per step
  // ============================================================
  const canAdvance = useMemo(() => {
    switch (currentStep) {
      case 0:
        return true;
      case 1: {
        if (!verificationResult) return false;
        const hasBlockingErrors = verificationResult.validations.some(
          (v) => v.severity === 'error'
        );
        return !hasBlockingErrors;
      }
      case 2:
        return isGenerated;
      case 3:
        return true;
      case 4:
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  }, [currentStep, verificationResult, isGenerated]);

  // ============================================================
  // Step navigation
  // ============================================================
  const goToStep = useCallback((step: number) => {
    if (step < 0 || step > WIZARD_STEPS.length - 1) return;
    setCurrentStep(step);
  }, []);

  // ============================================================
  // Step 2: Generate billing
  // ============================================================
  const handleGenerate = useCallback(async () => {
    if (!facilityId) return;
    setIsGenerating(true);
    const records = await generateMonthlyBilling(facilityId, yearMonth);
    setIsGenerating(false);

    if (records.length > 0) {
      const totalUnits = records.reduce((s, r) => s + r.totalUnits, 0);
      const totalAmount = records.reduce((s, r) => s + r.totalAmount, 0);
      const insuranceAmount = records.reduce((s, r) => s + r.insuranceAmount, 0);
      const copayAmount = records.reduce((s, r) => s + r.copayAmount, 0);
      setGenerationSummary({
        childCount: records.length,
        totalUnits,
        totalAmount,
        insuranceAmount,
        copayAmount,
      });
      setIsGenerated(true);
    }
  }, [facilityId, yearMonth, generateMonthlyBilling]);

  // ============================================================
  // Step 3: Expand child details
  // ============================================================
  const handleExpandChild = useCallback(
    async (record: BillingRecord) => {
      if (expandedChildId === record.id) {
        setExpandedChildId(null);
        return;
      }
      setExpandedChildId(record.id);
      if (!childDetails[record.id]) {
        const details = await fetchBillingDetails(record.id);
        setChildDetails((prev) => ({ ...prev, [record.id]: details }));
      }
    },
    [expandedChildId, childDetails, fetchBillingDetails]
  );

  // ============================================================
  // Step 5: Confirm billing
  // ============================================================
  const handleConfirm = useCallback(async () => {
    if (!facilityId) return;
    setIsConfirming(true);
    const ok = await confirmBilling(facilityId, yearMonth);
    if (ok) {
      setIsConfirmed(true);
      await fetchBillingRecords(facilityId, yearMonth);
    }
    setIsConfirming(false);
  }, [facilityId, yearMonth, confirmBilling, fetchBillingRecords]);

  // ============================================================
  // Step 5: Export CSV
  // ============================================================
  const handleExportCSV = useCallback(async () => {
    if (!facilityId) return;
    const csv = await exportCSV(facilityId, yearMonth);
    setCsvPreview(csv);
  }, [facilityId, yearMonth, exportCSV]);

  const handleDownloadCSV = useCallback(() => {
    if (!csvPreview) return;
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvPreview], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `国保連請求_${yearMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 3000);
  }, [csvPreview, yearMonth]);

  // ============================================================
  // Dashboard: Summary computed from billingRecords
  // ============================================================
  const dashboardSummary = useMemo(() => {
    const totalChildren = billingRecords.length;
    const totalUnits = billingRecords.reduce((s, r) => s + r.totalUnits, 0);
    const totalAmount = billingRecords.reduce((s, r) => s + r.totalAmount, 0);
    const totalInsurance = billingRecords.reduce((s, r) => s + r.insuranceAmount, 0);
    const totalCopay = billingRecords.reduce((s, r) => s + r.copayAmount, 0);
    const draftCount = billingRecords.filter((r) => r.status === 'draft').length;
    const confirmedCount = billingRecords.filter((r) => r.status === 'confirmed').length;
    return { totalChildren, totalUnits, totalAmount, totalInsurance, totalCopay, draftCount, confirmedCount };
  }, [billingRecords]);

  // ============================================================
  // Dashboard: Load data
  // ============================================================
  useEffect(() => {
    if (mode === 'dashboard' && facilityId && yearMonth) {
      fetchBillingRecords(facilityId, yearMonth);
    }
  }, [mode, facilityId, yearMonth, fetchBillingRecords]);

  // ============================================================
  // Dashboard: Generate / Confirm / Export handlers
  // ============================================================
  const handleDashboardGenerate = useCallback(async () => {
    if (!facilityId) return;
    setIsGenerating(true);
    await generateMonthlyBilling(facilityId, yearMonth);
    setIsGenerating(false);
    await fetchBillingRecords(facilityId, yearMonth);
  }, [facilityId, yearMonth, generateMonthlyBilling, fetchBillingRecords]);

  const handleDashboardConfirm = useCallback(async () => {
    if (!facilityId) return;
    setIsConfirming(true);
    const ok = await confirmBilling(facilityId, yearMonth);
    if (ok) {
      await fetchBillingRecords(facilityId, yearMonth);
    }
    setIsConfirming(false);
  }, [facilityId, yearMonth, confirmBilling, fetchBillingRecords]);

  const handleDashboardExportCSV = useCallback(async () => {
    if (!facilityId) return;
    const csv = await exportCSV(facilityId, yearMonth);
    if (csv) {
      const bom = '\uFEFF';
      const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `国保連請求_${yearMonth}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [facilityId, yearMonth, exportCSV]);

  // ============================================================
  // Loading state
  // ============================================================
  if (isLoading && billingRecords.length === 0 && mode === 'dashboard') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-t-transparent border-[#00c4cc] rounded-full animate-spin" />
        <span className="ml-3 text-gray-500">読み込み中...</span>
      </div>
    );
  }

  // ============================================================
  // WIZARD MODE
  // ============================================================
  if (mode === 'wizard') {
    const step = WIZARD_STEPS[currentStep];
    const StepIcon = step.icon;

    return (
      <div className="max-w-3xl mx-auto pb-8">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">国保連請求</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setMode('dashboard');
                fetchBillingRecords(facilityId, yearMonth);
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
            >
              ダッシュボード
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <StepIndicator
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          onStepClick={goToStep}
        />

        {/* Step header */}
        <div className={`rounded-xl p-5 mb-6 ${step.bgColor} border ${step.borderColor}`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-white/80 ${step.color}`}>
              <StepIcon size={24} />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${step.color}`}>{step.label}</h2>
              <p className="text-sm text-gray-600">{step.subtitle}</p>
            </div>
          </div>
        </div>

        {/* ============================== */}
        {/* Step 0: Month Selection        */}
        {/* ============================== */}
        {currentStep === 0 && (
          <div className="space-y-6">
            {/* Description */}
            <div className="bg-[#00c4cc]/5 border border-[#00c4cc]/20 rounded-xl p-4">
              <p className="text-sm text-gray-700">
                ステップに沿って進めるだけで請求業務が完了します。まず請求対象の月を選択してください。
              </p>
            </div>

            {/* Month selector */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="p-2.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft size={20} className="text-gray-600" />
                </button>
                <span className="text-2xl font-bold text-gray-800 min-w-[160px] text-center">
                  {yearMonthLabel}
                </span>
                <button
                  onClick={() => navigateMonth(1)}
                  className="p-2.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ChevronRight size={20} className="text-gray-600" />
                </button>
              </div>
            </div>

            {/* Monthly status summary cards */}
            <div className="grid grid-cols-3 gap-4">
              <SummaryCard
                label="利用実績"
                value={monthlyStatus ? `${monthlyStatus.usageRecordCount}件` : '...'}
                icon={ClipboardCheck}
                color="blue"
              />
              <SummaryCard
                label="請求データ"
                value={
                  monthlyStatus
                    ? monthlyStatus.hasRecords
                      ? `${monthlyStatus.draftCount + monthlyStatus.confirmedCount + monthlyStatus.submittedCount + monthlyStatus.paidCount}件`
                      : '未生成'
                    : '...'
                }
                icon={Receipt}
                color="indigo"
              />
              <SummaryCard
                label="ステータス"
                value={
                  monthlyStatus
                    ? monthlyStatus.confirmedCount > 0
                      ? `確定 ${monthlyStatus.confirmedCount}件`
                      : monthlyStatus.draftCount > 0
                      ? `下書き ${monthlyStatus.draftCount}件`
                      : '---'
                    : '...'
                }
                icon={BarChart3}
                color="gray"
              />
            </div>

            {/* Warning if confirmed data exists */}
            {monthlyStatus && monthlyStatus.confirmedCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                <span className="text-sm text-amber-700">
                  既に確定済みデータが{monthlyStatus.confirmedCount}件あります。確定済みデータは上書きされません。
                </span>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-end mt-6">
              <button
                onClick={() => goToStep(1)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium bg-[#00c4cc] text-white hover:bg-[#00b0b8] transition-colors shadow-sm"
              >
                次へ
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ============================== */}
        {/* Step 1: Usage Verification     */}
        {/* ============================== */}
        {currentStep === 1 && (
          <div className="space-y-6">
            {isVerifying ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="text-[#00c4cc] animate-spin" />
                <span className="ml-3 text-gray-500">利用実績を確認中...</span>
              </div>
            ) : verificationResult ? (
              <>
                {/* Completion rate bar */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">入力完了率</span>
                    <span className="text-sm font-bold text-gray-800">
                      {verificationResult.completionRate}%
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00c4cc] rounded-full transition-all duration-700"
                      style={{ width: `${verificationResult.completionRate}%` }}
                    />
                  </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SummaryCard
                    label="利用日数"
                    value={`${verificationResult.recordedDays}日`}
                    icon={Calendar}
                    color="teal"
                  />
                  <SummaryCard
                    label="対象児童"
                    value={`${verificationResult.childCount}名`}
                    icon={Users}
                    color="blue"
                  />
                  <SummaryCard
                    label="除外日数"
                    value={`${verificationResult.excludedDays}日`}
                    icon={XCircle}
                    color="gray"
                  />
                  <SummaryCard
                    label="請求対象"
                    value={`${verificationResult.billingTargetDays}日`}
                    icon={CheckCircle}
                    color="emerald"
                  />
                </div>

                {/* Child summaries table */}
                {verificationResult.childSummaries.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-3 font-medium text-gray-600">児童名</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">利用日数</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">請求対象</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">所得区分</th>
                            <th className="text-center px-4 py-3 font-medium text-gray-600">状態</th>
                          </tr>
                        </thead>
                        <tbody>
                          {verificationResult.childSummaries
                            .filter((c) => c.usageDays > 0)
                            .map((child) => {
                              const hasError = !child.hasIncomeCategory;
                              const hasWarning = child.missingTimes.length > 0 || !child.hasBeneficiaryNumber;
                              return (
                                <tr
                                  key={child.childId}
                                  className={`border-b border-gray-100 ${
                                    hasError ? 'bg-red-50/50' : ''
                                  }`}
                                >
                                  <td className="px-4 py-3 font-medium text-gray-800">
                                    {child.childName}
                                  </td>
                                  <td className="px-4 py-3 text-right text-gray-700">
                                    {child.usageDays}日
                                  </td>
                                  <td className="px-4 py-3 text-right text-gray-700">
                                    {child.billingDays}日
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                        child.hasIncomeCategory
                                          ? 'bg-gray-100 text-gray-700'
                                          : 'bg-red-100 text-red-700'
                                      }`}
                                    >
                                      {getIncomeCategoryLabel(child.incomeCategory)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {hasError ? (
                                      <XCircle size={16} className="text-red-500 mx-auto" />
                                    ) : hasWarning ? (
                                      <AlertTriangle size={16} className="text-amber-500 mx-auto" />
                                    ) : (
                                      <CheckCircle size={16} className="text-emerald-500 mx-auto" />
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Validation panel */}
                <ValidationPanel validations={verificationResult.validations} />
              </>
            ) : null}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => goToStep(0)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft size={16} />
                戻る
              </button>
              <button
                onClick={() => goToStep(2)}
                disabled={!canAdvance}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm ${
                  canAdvance
                    ? 'bg-[#00c4cc] text-white hover:bg-[#00b0b8]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                次へ
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ============================== */}
        {/* Step 2: Generate Billing       */}
        {/* ============================== */}
        {currentStep === 2 && (
          <div className="space-y-6">
            {/* Info box */}
            <div className="bg-[#00c4cc]/5 border border-[#00c4cc]/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info size={18} className="text-[#00c4cc] shrink-0 mt-0.5" />
                <div className="text-sm text-gray-700">
                  <p>利用実績から請求データを自動計算します。</p>
                  <p className="mt-1">既存の下書きデータは上書きされます。確定済みデータには影響しません。</p>
                </div>
              </div>
            </div>

            {/* Generate button / progress / result */}
            {!isGenerated && !isGenerating && (
              <div className="flex justify-center py-8">
                <button
                  onClick={handleGenerate}
                  className="flex items-center gap-3 px-8 py-4 rounded-xl text-base font-semibold bg-[#00c4cc] text-white hover:bg-[#00b0b8] transition-colors shadow-md hover:shadow-lg"
                >
                  <Zap size={20} />
                  請求データを生成する
                </button>
              </div>
            )}

            {isGenerating && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 size={32} className="text-[#00c4cc] animate-spin mb-4" />
                <span className="text-gray-600 font-medium">生成中...</span>
                <span className="text-sm text-gray-400 mt-1">利用実績から請求データを計算しています</span>
              </div>
            )}

            {isGenerated && generationSummary && (
              <div className="space-y-6">
                {/* Success message */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle size={20} className="text-emerald-600 shrink-0" />
                  <span className="text-sm font-medium text-emerald-700">
                    {generationSummary.childCount}名分の請求データを生成しました
                  </span>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <SummaryCard
                    label="対象児童"
                    value={`${generationSummary.childCount}名`}
                    icon={Users}
                    color="teal"
                  />
                  <SummaryCard
                    label="単位数合計"
                    value={generationSummary.totalUnits.toLocaleString()}
                    icon={Calculator}
                    color="blue"
                  />
                  <SummaryCard
                    label="請求額合計"
                    value={formatYen(generationSummary.totalAmount)}
                    icon={Receipt}
                    color="indigo"
                  />
                  <SummaryCard
                    label="保険請求額"
                    value={formatYen(generationSummary.insuranceAmount)}
                    icon={Shield}
                    color="emerald"
                  />
                  <SummaryCard
                    label="利用者負担額"
                    value={formatYen(generationSummary.copayAmount)}
                    icon={Users}
                    color="amber"
                  />
                </div>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                <XCircle size={18} className="text-red-600 shrink-0" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => goToStep(1)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft size={16} />
                戻る
              </button>
              <button
                onClick={() => goToStep(3)}
                disabled={!canAdvance}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm ${
                  canAdvance
                    ? 'bg-[#00c4cc] text-white hover:bg-[#00b0b8]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                次へ
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ============================== */}
        {/* Step 3: Review Details         */}
        {/* ============================== */}
        {currentStep === 3 && (
          <div className="space-y-4">
            {isLoading && billingRecords.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="text-[#00c4cc] animate-spin" />
                <span className="ml-3 text-gray-500">読み込み中...</span>
              </div>
            ) : billingRecords.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FileSearch size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">請求データがありません</p>
                <p className="text-xs mt-1">前のステップで請求データを生成してください</p>
              </div>
            ) : (
              <div className="space-y-3">
                {billingRecords.map((record) => {
                  const st = STATUS_CONFIG[record.status];
                  const isExpanded = expandedChildId === record.id;
                  const details = childDetails[record.id] || [];

                  return (
                    <div
                      key={record.id}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                    >
                      {/* Record header */}
                      <button
                        onClick={() => handleExpandChild(record)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown size={16} className="text-gray-400" />
                          ) : (
                            <ChevronRight size={16} className="text-gray-400" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-800">
                                {record.childName || record.childId}
                              </span>
                              <span className="text-xs text-gray-500">{record.serviceType}</span>
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.color}`}
                              >
                                {st.label}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              単位: {record.totalUnits.toLocaleString()} / 請求: {formatYen(record.totalAmount)} / 負担: {formatYen(record.copayAmount)}
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 p-4 bg-gray-50/30">
                          {details.length === 0 ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 size={18} className="text-[#00c4cc] animate-spin" />
                              <span className="ml-2 text-sm text-gray-500">明細を読み込み中...</span>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    <th className="text-left px-3 py-2 font-medium text-gray-600">日付</th>
                                    <th className="text-left px-3 py-2 font-medium text-gray-600">コード</th>
                                    <th className="text-right px-3 py-2 font-medium text-gray-600">単位数</th>
                                    <th className="text-left px-3 py-2 font-medium text-gray-600">加算</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {details.map((detail) => {
                                    const dateObj = new Date(detail.serviceDate);
                                    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
                                    const dateLabel = `${dateObj.getMonth() + 1}/${dateObj.getDate()} (${dayNames[dateObj.getDay()]})`;
                                    return (
                                      <tr key={detail.id} className="border-b border-gray-100">
                                        <td className="px-3 py-2 text-gray-700">{dateLabel}</td>
                                        <td className="px-3 py-2">
                                          {detail.isAbsence ? (
                                            <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-xs">
                                              {detail.absenceType || '欠席'}
                                            </span>
                                          ) : (
                                            <span className="font-mono text-[#00c4cc]">
                                              {detail.serviceCode || '-'}
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-gray-700">
                                          {detail.unitCount.toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2">
                                          {detail.additions.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                              {detail.additions.map((a, idx) => (
                                                <span
                                                  key={idx}
                                                  className="inline-block px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-xs"
                                                >
                                                  {a.name} +{a.units}
                                                </span>
                                              ))}
                                            </div>
                                          ) : (
                                            <span className="text-gray-300">-</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => goToStep(2)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft size={16} />
                戻る
              </button>
              <button
                onClick={() => goToStep(4)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium bg-[#00c4cc] text-white hover:bg-[#00b0b8] transition-colors shadow-sm"
              >
                次へ
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ============================== */}
        {/* Step 4: Upper Limit Check      */}
        {/* ============================== */}
        {currentStep === 4 && (
          <div className="space-y-6">
            {isCheckingUpperLimit ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="text-[#00c4cc] animate-spin" />
                <span className="ml-3 text-gray-500">上限額を確認中...</span>
              </div>
            ) : upperLimitResult ? (
              <>
                {/* Summary */}
                {upperLimitResult.children.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">{upperLimitResult.children.length}名</span>中
                      <span className="font-semibold text-amber-600 ml-1">
                        {upperLimitResult.children.filter((c) => c.isAtLimit).length}名
                      </span>
                      が上限管理対象
                    </p>
                  </div>
                )}

                {/* Children table */}
                {upperLimitResult.children.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-3 font-medium text-gray-600">児童名</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">所得区分</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">上限月額</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">10%算定</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-600">適用後</th>
                            <th className="text-center px-4 py-3 font-medium text-gray-600">状態</th>
                          </tr>
                        </thead>
                        <tbody>
                          {upperLimitResult.children.map((child) => (
                            <tr
                              key={child.childId}
                              className={`border-b border-gray-100 ${
                                child.isAtLimit ? 'bg-amber-50/50' : ''
                              }`}
                            >
                              <td className="px-4 py-3 font-medium text-gray-800">
                                {child.childName}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {getIncomeCategoryLabel(child.incomeCategory)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-gray-700">
                                {formatYen(child.upperLimitAmount)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-gray-700">
                                {formatYen(child.calculatedCopay)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-medium text-gray-800">
                                {formatYen(child.appliedCopay)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {child.isAtLimit ? (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                    上限適用
                                  </span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                    通常
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Validation panel */}
                <ValidationPanel validations={upperLimitResult.validations} />
              </>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Shield size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">上限管理データがありません</p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => goToStep(3)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft size={16} />
                戻る
              </button>
              <button
                onClick={() => goToStep(5)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium bg-[#00c4cc] text-white hover:bg-[#00b0b8] transition-colors shadow-sm"
              >
                次へ
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ============================== */}
        {/* Step 5: Confirm & CSV Export   */}
        {/* ============================== */}
        {currentStep === 5 && (
          <div className="relative space-y-6">
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
                      className={
                        ['text-teal-400', 'text-emerald-400', 'text-yellow-400', 'text-blue-400', 'text-pink-400'][
                          Math.floor(Math.random() * 5)
                        ]
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Final summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <SummaryCard
                label="対象児童"
                value={`${billingRecords.length}名`}
                icon={Users}
                color="teal"
              />
              <SummaryCard
                label="単位数合計"
                value={billingRecords.reduce((s, r) => s + r.totalUnits, 0).toLocaleString()}
                icon={Calculator}
                color="blue"
              />
              <SummaryCard
                label="請求額合計"
                value={formatYen(billingRecords.reduce((s, r) => s + r.totalAmount, 0))}
                icon={Receipt}
                color="indigo"
              />
              <SummaryCard
                label="保険請求額"
                value={formatYen(billingRecords.reduce((s, r) => s + r.insuranceAmount, 0))}
                icon={Shield}
                color="emerald"
              />
              <SummaryCard
                label="利用者負担額"
                value={formatYen(billingRecords.reduce((s, r) => s + r.copayAmount, 0))}
                icon={Users}
                color="amber"
              />
            </div>

            {/* Step 1: Bulk confirm */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Step 1: 一括確定</h3>
              {isConfirmed ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle size={20} className="text-emerald-600 shrink-0" />
                  <span className="text-sm font-medium text-emerald-700">
                    全{billingRecords.length}件を確定しました
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  {billingRecords.some((r) => r.status === 'draft') && (
                    <p className="text-sm text-gray-600">
                      下書きステータスの請求データ
                      {billingRecords.filter((r) => r.status === 'draft').length}件を一括確定します。
                    </p>
                  )}
                  <button
                    onClick={handleConfirm}
                    disabled={isConfirming || !billingRecords.some((r) => r.status === 'draft')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-colors ${
                      !billingRecords.some((r) => r.status === 'draft')
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : isConfirming
                        ? 'bg-[#00c4cc]/50 text-white cursor-wait'
                        : 'bg-[#00c4cc] text-white hover:bg-[#00b0b8] shadow-sm'
                    }`}
                  >
                    {isConfirming ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        確定中...
                      </>
                    ) : !billingRecords.some((r) => r.status === 'draft') ? (
                      <>
                        <CheckCircle size={16} />
                        確定済み
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} />
                        一括確定
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Step 2: CSV download */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Step 2: CSVダウンロード</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Eye size={14} />
                    プレビュー生成
                  </button>
                  <button
                    onClick={handleDownloadCSV}
                    disabled={!csvPreview}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-colors ${
                      csvPreview
                        ? 'bg-[#00c4cc] text-white hover:bg-[#00b0b8] shadow-sm'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Download size={16} />
                    CSVダウンロード
                  </button>
                </div>

                {/* CSV preview */}
                {csvPreview && (
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText size={12} className="text-gray-500" />
                      <span className="text-xs text-gray-500">CSVプレビュー</span>
                    </div>
                    <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap">
                      {csvPreview}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Completion message */}
            {showCelebration && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-1">請求業務が完了しました!</h3>
                <p className="text-sm text-gray-500">{yearMonthLabel}の国保連請求データを出力しました</p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => goToStep(4)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft size={16} />
                戻る
              </button>
              <button
                onClick={() => {
                  setMode('dashboard');
                  fetchBillingRecords(facilityId, yearMonth);
                }}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium bg-[#00c4cc] text-white hover:bg-[#00b0b8] transition-colors shadow-sm"
              >
                ダッシュボードへ
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-800">国保連請求</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft size={16} className="text-gray-600" />
            </button>
            <span className="text-base font-semibold text-gray-700 min-w-[100px] text-center">
              {yearMonthLabel}
            </span>
            <button
              onClick={() => navigateMonth(1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronRight size={16} className="text-gray-600" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setMode('wizard');
              setCurrentStep(0);
              setVerificationResult(null);
              setIsGenerated(false);
              setGenerationSummary(null);
              setUpperLimitResult(null);
              setExpandedChildId(null);
              setChildDetails({});
              setIsConfirmed(false);
              setCsvPreview('');
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-[#00c4cc] bg-[#00c4cc]/10 hover:bg-[#00c4cc]/20 transition-colors border border-[#00c4cc]/20"
          >
            <Sparkles size={14} />
            ウィザードで請求する
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 mb-6">
          <XCircle size={18} className="text-red-600 shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <SummaryCard
          label="ステータス"
          value={
            dashboardSummary.confirmedCount > 0
              ? `確定 ${dashboardSummary.confirmedCount}件`
              : dashboardSummary.draftCount > 0
              ? `下書き ${dashboardSummary.draftCount}件`
              : `${dashboardSummary.totalChildren}件`
          }
          icon={BarChart3}
          color="teal"
        />
        <SummaryCard
          label="請求額合計"
          value={formatYen(dashboardSummary.totalAmount)}
          icon={Receipt}
          color="indigo"
        />
        <SummaryCard
          label="利用者負担額"
          value={formatYen(dashboardSummary.totalCopay)}
          icon={Users}
          color="amber"
        />
      </div>

      {/* Billing records table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        {isLoading && billingRecords.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-t-transparent border-[#00c4cc] rounded-full animate-spin" />
          </div>
        ) : billingRecords.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Receipt size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">請求データがありません</p>
            <p className="text-xs mt-1">「ウィザードで請求する」ボタンで作成できます</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">児童名</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">種別</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">単位数</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">請求額</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">利用者負担</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">状態</th>
                </tr>
              </thead>
              <tbody>
                {billingRecords.map((record) => {
                  const st = STATUS_CONFIG[record.status];
                  return (
                    <tr
                      key={record.id}
                      className="border-b border-gray-100 hover:bg-[#00c4cc]/5 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {record.childName || record.childId}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {record.serviceType === '児童発達支援' ? '児発' : '放デイ'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">
                        {record.totalUnits.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-800 font-medium">
                        {formatYen(record.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        {formatYen(record.copayAmount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.color}`}
                        >
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dashboard action buttons */}
      {billingRecords.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleDashboardGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Zap size={14} />
            )}
            自動生成
          </button>
          <button
            onClick={handleDashboardConfirm}
            disabled={isConfirming || dashboardSummary.draftCount === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {isConfirming ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CheckCircle size={14} />
            )}
            一括確定
          </button>
          <button
            onClick={handleDashboardExportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#00c4cc] text-white hover:bg-[#00b0b8] transition-colors shadow-sm"
          >
            <Download size={14} />
            CSV出力
          </button>
        </div>
      )}
    </div>
  );
}
