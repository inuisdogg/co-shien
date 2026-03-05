'use client';

/**
 * 扶養内パート年収計算ツール
 *
 * Standalone calculator for part-time childcare/welfare workers to check
 * whether their projected annual income stays within dependent-spouse
 * thresholds (103万/106万/130万/150万/201万 walls). All calculation is
 * client-side; no login or data persistence required.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';
import {
  Calculator,
  ArrowRight,
  Clock,
  CalendarDays,
  Train,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  Lightbulb,
  Wallet,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                  */
/* ------------------------------------------------------------------ */

interface FormState {
  hourlyWage: number;
  daysPerWeek: number;
  hoursPerDay: number;
  weeksPerMonth: number;
  monthlyTransport: number;
}

interface WallInfo {
  name: string;
  amount: number;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const WALLS: WallInfo[] = [
  {
    name: '103万円の壁',
    amount: 1_030_000,
    description: '配偶者控除がなくなり、所得税が発生',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  {
    name: '106万円の壁',
    amount: 1_060_000,
    description: '一定条件で社会保険加入義務（従業員101人以上の企業）',
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
  },
  {
    name: '130万円の壁',
    amount: 1_300_000,
    description: '社会保険の扶養から外れる（国保・年金の負担発生）',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  {
    name: '150万円の壁',
    amount: 1_500_000,
    description: '配偶者特別控除が段階的に減少',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  {
    name: '201万円の壁',
    amount: 2_010_000,
    description: '配偶者特別控除がゼロに',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
];

const DAYS_OPTIONS = [1, 2, 3, 4, 5, 6];

/* ------------------------------------------------------------------ */
/*  Calculation Logic                                                  */
/* ------------------------------------------------------------------ */

function calcMonthlyIncome(form: FormState): number {
  return form.hourlyWage * form.hoursPerDay * form.daysPerWeek * form.weeksPerMonth;
}

function calcAnnualIncome(monthlyIncome: number): number {
  return monthlyIncome * 12;
}

/** Rough take-home estimate */
function calcTakeHome(annualIncome: number): {
  incomeTax: number;
  socialInsurance: number;
  takeHome: number;
} {
  // Simplified: income tax applies above 103万 (taxable = annual - 103万, at ~5%)
  let incomeTax = 0;
  if (annualIncome > 1_030_000) {
    incomeTax = Math.round((annualIncome - 1_030_000) * 0.05);
  }

  // Simplified: social insurance ~15% if above 130万
  let socialInsurance = 0;
  if (annualIncome > 1_300_000) {
    socialInsurance = Math.round(annualIncome * 0.15);
  }

  const takeHome = annualIncome - incomeTax - socialInsurance;
  return { incomeTax, socialInsurance, takeHome };
}

/** Returns 'safe' | 'close' | 'over' */
function wallStatus(
  annualIncome: number,
  wallAmount: number
): 'safe' | 'close' | 'over' {
  if (annualIncome > wallAmount) return 'over';
  if (annualIncome > wallAmount - 100_000) return 'close';
  return 'safe';
}

/** Find optimal working config to stay just under a given wall */
function calcOptimalForWall(
  form: FormState,
  wallAmount: number
): { maxHoursPerDay: number; maxDaysPerWeek: number; maxMonthly: number } | null {
  // Annual target = wallAmount - small buffer
  const targetAnnual = wallAmount - 10_000;
  const targetMonthly = targetAnnual / 12;

  // Solve: hourlyWage * h * d * weeksPerMonth = targetMonthly
  // Keep daysPerWeek fixed, solve for hours
  const optimalHours =
    targetMonthly / (form.hourlyWage * form.daysPerWeek * form.weeksPerMonth);

  if (optimalHours < 1) return null;

  // Also try: keep hours fixed, solve for days
  const optimalDays =
    targetMonthly / (form.hourlyWage * form.hoursPerDay * form.weeksPerMonth);

  return {
    maxHoursPerDay: Math.floor(optimalHours * 10) / 10,
    maxDaysPerWeek: Math.floor(optimalDays * 10) / 10,
    maxMonthly: Math.round(targetMonthly),
  };
}

/* ------------------------------------------------------------------ */
/*  Animated Number Component                                          */
/* ------------------------------------------------------------------ */

function AnimatedYen({
  value,
  className = '',
}: {
  value: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const diff = value - display;
    if (diff === 0) return;

    const steps = 12;
    const stepValue = diff / steps;
    let current = display;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      if (step >= steps) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        current += stepValue;
        setDisplay(Math.round(current));
      }
    }, 25);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={className}>
      {display.toLocaleString('ja-JP')}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Status Badge Component                                             */
/* ------------------------------------------------------------------ */

function StatusBadge({
  status,
  annualIncome,
  wallAmount,
}: {
  status: 'safe' | 'close' | 'over';
  annualIncome: number;
  wallAmount: number;
}) {
  if (status === 'safe') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        <CheckCircle className="h-3.5 w-3.5" />
        超えない
      </span>
    );
  }

  if (status === 'close') {
    const remaining = wallAmount - annualIncome;
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
        <AlertTriangle className="h-3.5 w-3.5" />
        あと{Math.round(remaining / 10_000)}万円で超過
      </span>
    );
  }

  const over = annualIncome - wallAmount;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
      <XCircle className="h-3.5 w-3.5" />
      {Math.round(over / 10_000)}万円超過
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page Component                                                */
/* ------------------------------------------------------------------ */

export default function IncomeCalculatorClient() {
  const [form, setForm] = useState<FormState>({
    hourlyWage: 1200,
    daysPerWeek: 3,
    hoursPerDay: 6,
    weeksPerMonth: 4.33,
    monthlyTransport: 0,
  });

  useEffect(() => { trackEvent('tool_page_view', { tool: 'income-calculator' }); }, []);

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const monthlyIncome = useMemo(() => calcMonthlyIncome(form), [form]);
  const annualIncome = useMemo(() => calcAnnualIncome(monthlyIncome), [monthlyIncome]);

  // Transport is excluded from the 103万 income calculation
  // (non-taxable transport allowance up to 150,000/year)
  // So we use annualIncome (wage only) for wall comparisons
  const annualWithTransport = useMemo(
    () => annualIncome + form.monthlyTransport * 12,
    [annualIncome, form.monthlyTransport]
  );

  const takeHome = useMemo(() => calcTakeHome(annualIncome), [annualIncome]);

  // Find the first wall that is exceeded
  const firstExceededWall = useMemo(() => {
    return WALLS.find((w) => annualIncome > w.amount) ?? null;
  }, [annualIncome]);

  // Find the next wall the user is approaching
  const relevantWall = useMemo(() => {
    // The smallest wall that is NOT yet exceeded
    return WALLS.find((w) => annualIncome <= w.amount) ?? WALLS[WALLS.length - 1];
  }, [annualIncome]);

  const optimalConfig = useMemo(() => {
    return calcOptimalForWall(form, relevantWall.amount);
  }, [form, relevantWall]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ============================================================ */}
      {/*  Header                                                      */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/tools" className="flex items-center gap-2 group">
            <Image src="/logo.svg" alt="Roots" width={80} height={22} className="h-5 w-auto" />
            <span className="text-xl font-bold text-gray-900">
              Roots <span className="text-sm font-medium text-gray-500">Tools</span>
            </span>
          </Link>

          <Link
            href="/career"
            className="inline-flex items-center gap-1.5 rounded-full bg-personal px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-personal-dark hover:shadow-md active:scale-[0.98]"
          >
            Rootsに無料登録
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* ============================================================ */}
      {/*  Hero                                                        */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-personal via-personal-dark to-personal-dark py-12 sm:py-16">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-white/5" />

        <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90">
            <Calculator className="h-4 w-4" />
            無料・登録不要
          </div>
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl">
            扶養内パート年収計算ツール
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-indigo-100 sm:text-lg">
            時給・勤務日数を入力するだけで、103万・130万の壁との比較を自動計算。
            保育士・児童指導員・福祉職のパート年収シミュレーションにご活用ください。
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Main Content: Form + Results                                */}
      {/* ============================================================ */}
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* ------ INPUT FORM (2 cols) ------ */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section: 勤務条件 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-personal">
                  <Clock className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">勤務条件</h2>
              </div>

              <div className="space-y-5">
                {/* 時給 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    時給
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={800}
                      max={5000}
                      step={10}
                      value={form.hourlyWage}
                      onChange={(e) =>
                        updateField('hourlyWage', Math.max(0, Number(e.target.value)))
                      }
                      placeholder="1200"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-12 text-sm text-gray-900 shadow-sm transition-colors focus:border-personal focus:outline-none focus:ring-2 focus:ring-personal/20"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
                      円
                    </span>
                  </div>
                </div>

                {/* 週勤務日数 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    週勤務日数
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {DAYS_OPTIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => updateField('daysPerWeek', d)}
                        className={`rounded-lg border-2 px-2 py-2.5 text-sm font-semibold transition-all ${
                          form.daysPerWeek === d
                            ? 'border-personal bg-indigo-50 text-personal-dark'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {d}日
                      </button>
                    ))}
                  </div>
                </div>

                {/* 1日の勤務時間 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    1日の勤務時間
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={12}
                      step={0.5}
                      value={form.hoursPerDay}
                      onChange={(e) =>
                        updateField('hoursPerDay', Math.max(0, Number(e.target.value)))
                      }
                      placeholder="6"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-16 text-sm text-gray-900 shadow-sm transition-colors focus:border-personal focus:outline-none focus:ring-2 focus:ring-personal/20"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
                      時間
                    </span>
                  </div>
                </div>

                {/* 月の勤務週数 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    月の勤務週数
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={5}
                      step={0.01}
                      value={form.weeksPerMonth}
                      onChange={(e) =>
                        updateField('weeksPerMonth', Math.max(0, Number(e.target.value)))
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-12 text-sm text-gray-900 shadow-sm transition-colors focus:border-personal focus:outline-none focus:ring-2 focus:ring-personal/20"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
                      週
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    ※ 月平均は約4.33週（365日 / 12ヶ月 / 7日）
                  </p>
                </div>
              </div>
            </div>

            {/* Section: 交通費 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Train className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">交通費（月額）</h2>
                <span className="ml-auto text-xs text-gray-400">任意</span>
              </div>

              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={50000}
                  step={1000}
                  value={form.monthlyTransport}
                  onChange={(e) =>
                    updateField('monthlyTransport', Math.max(0, Number(e.target.value)))
                  }
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-16 text-sm text-gray-900 shadow-sm transition-colors focus:border-personal focus:outline-none focus:ring-2 focus:ring-personal/20"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
                  円/月
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                ※ 通勤交通費は月15万円まで非課税のため、103万の壁の計算には含みません
              </p>
            </div>
          </div>

          {/* ------ RESULTS (3 cols) ------ */}
          <div className="lg:col-span-3 space-y-6">
            <div className="lg:sticky lg:top-20 space-y-6">
              {/* Income summary cards */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* 月収見込み */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-personal">
                      <CalendarDays className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-medium text-gray-600">月収見込み</span>
                  </div>
                  <div className="text-2xl font-extrabold text-gray-900">
                    <span className="mr-0.5 text-base font-bold text-gray-500">¥</span>
                    <AnimatedYen value={Math.round(monthlyIncome)} />
                  </div>
                  {form.monthlyTransport > 0 && (
                    <p className="mt-1 text-xs text-gray-400">
                      + 交通費 ¥{form.monthlyTransport.toLocaleString('ja-JP')}/月
                    </p>
                  )}
                </div>

                {/* 年収見込み */}
                <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-personal to-personal-dark p-5 shadow-sm text-white">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
                      <TrendingUp className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-sm font-medium text-indigo-100">年収見込み</span>
                  </div>
                  <div className="text-2xl font-extrabold">
                    <span className="mr-0.5 text-base font-bold text-indigo-100">¥</span>
                    <AnimatedYen value={Math.round(annualIncome)} />
                  </div>
                  {form.monthlyTransport > 0 && (
                    <p className="mt-1 text-xs text-indigo-200">
                      交通費込み: ¥{annualWithTransport.toLocaleString('ja-JP')}/年
                    </p>
                  )}
                </div>
              </div>

              {/* ======================================================== */}
              {/*  壁 comparison section                                    */}
              {/* ======================================================== */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">扶養の壁チェック</h2>
                </div>

                <div className="space-y-3">
                  {WALLS.map((wall) => {
                    const status = wallStatus(annualIncome, wall.amount);
                    return (
                      <div
                        key={wall.name}
                        className={`rounded-xl border-2 p-4 transition-all ${
                          status === 'safe'
                            ? 'border-gray-100 bg-white'
                            : status === 'close'
                              ? `${wall.borderColor} ${wall.bgColor}`
                              : 'border-red-200 bg-red-50'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-sm font-bold ${
                                status === 'over' ? 'text-red-700' : wall.color
                              }`}
                            >
                              {wall.name}
                            </span>
                            <span className="text-xs font-medium text-gray-500">
                              ¥{wall.amount.toLocaleString('ja-JP')}
                            </span>
                          </div>
                          <StatusBadge
                            status={status}
                            annualIncome={annualIncome}
                            wallAmount={wall.amount}
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-gray-500">{wall.description}</p>

                        {/* Visual bar */}
                        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ease-out ${
                              status === 'safe'
                                ? 'bg-emerald-400'
                                : status === 'close'
                                  ? 'bg-amber-400'
                                  : 'bg-red-400'
                            }`}
                            style={{
                              width: `${Math.min((annualIncome / wall.amount) * 100, 100)}%`,
                            }}
                          />
                        </div>
                        <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                          <span>¥0</span>
                          <span>¥{wall.amount.toLocaleString('ja-JP')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ======================================================== */}
              {/*  手取り概算                                               */}
              {/* ======================================================== */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">手取り概算（年額）</h2>
                </div>

                <div className="space-y-3">
                  <div className="flex items-baseline justify-between rounded-xl bg-gray-50 px-4 py-3">
                    <span className="text-sm text-gray-600">年収（給与のみ）</span>
                    <span className="text-sm font-bold text-gray-900">
                      ¥{Math.round(annualIncome).toLocaleString('ja-JP')}
                    </span>
                  </div>

                  {takeHome.incomeTax > 0 && (
                    <div className="flex items-baseline justify-between rounded-xl bg-red-50 px-4 py-3">
                      <span className="text-sm text-red-600">
                        所得税（概算 5%）
                      </span>
                      <span className="text-sm font-bold text-red-700">
                        - ¥{takeHome.incomeTax.toLocaleString('ja-JP')}
                      </span>
                    </div>
                  )}

                  {takeHome.socialInsurance > 0 && (
                    <div className="flex items-baseline justify-between rounded-xl bg-red-50 px-4 py-3">
                      <span className="text-sm text-red-600">
                        社会保険料（概算 15%）
                      </span>
                      <span className="text-sm font-bold text-red-700">
                        - ¥{takeHome.socialInsurance.toLocaleString('ja-JP')}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-3">
                    <div className="flex items-baseline justify-between rounded-xl bg-gradient-to-r from-personal to-personal-dark px-4 py-4 text-white">
                      <span className="text-sm font-semibold text-indigo-100">
                        手取り年収（概算）
                      </span>
                      <span className="text-xl font-extrabold">
                        <span className="mr-0.5 text-sm font-bold text-indigo-100">¥</span>
                        <AnimatedYen value={takeHome.takeHome} />
                      </span>
                    </div>
                  </div>

                  {annualIncome > 1_300_000 && (
                    <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                      <p className="text-xs text-amber-700">
                        130万円を超えると社会保険料が発生し、手取りが大幅に減少する場合があります（いわゆる「130万円の壁」）。
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ======================================================== */}
              {/*  扶養内で最大限稼ぐには                                     */}
              {/* ======================================================== */}
              {optimalConfig && form.hourlyWage > 0 && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-sm font-bold text-emerald-900">
                      {relevantWall.name}以内で最大限稼ぐには
                    </h3>
                  </div>

                  <ul className="space-y-2">
                    {optimalConfig.maxHoursPerDay > 0 &&
                      optimalConfig.maxHoursPerDay <= 12 && (
                        <li className="flex items-start gap-2 text-sm text-emerald-800">
                          <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                          <span>
                            週{form.daysPerWeek}日勤務の場合 →{' '}
                            <strong>1日 {optimalConfig.maxHoursPerDay}時間</strong>以内
                          </span>
                        </li>
                      )}
                    {optimalConfig.maxDaysPerWeek > 0 &&
                      optimalConfig.maxDaysPerWeek <= 6 && (
                        <li className="flex items-start gap-2 text-sm text-emerald-800">
                          <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                          <span>
                            1日{form.hoursPerDay}時間勤務の場合 →{' '}
                            <strong>週{optimalConfig.maxDaysPerWeek}日</strong>以内
                          </span>
                        </li>
                      )}
                    <li className="flex items-start gap-2 text-sm text-emerald-800">
                      <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                      <span>
                        月収目安:{' '}
                        <strong>¥{optimalConfig.maxMonthly.toLocaleString('ja-JP')}</strong>
                        以内
                      </span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ============================================================ */}
      {/*  Disclaimer                                                  */}
      {/* ============================================================ */}
      <section className="border-t border-gray-200 bg-white py-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-start gap-3 rounded-xl bg-gray-50 p-4">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
            <p className="text-xs leading-relaxed text-gray-500">
              ※ この計算はあくまで目安です。実際の税額・社会保険料は、お住まいの地域・家族構成・勤務先の条件等により異なります。詳細は税理士・社会保険労務士にご相談ください。
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  CTA Section                                                 */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-personal via-personal-dark to-personal-dark py-16 sm:py-20">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-white/5" />

        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
            Rootsに登録して、キャリアデータを一元管理
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-indigo-100 sm:text-lg">
            資格・経験年数・研修履歴を記録して、処遇改善や給与交渉に活かしましょう。
            扶養内で効率よく働くためのデータ管理を無料で。
          </p>

          <div className="mt-8">
            <Link
              href="/career"
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-bold text-personal-dark shadow-lg transition-all hover:bg-gray-50 hover:shadow-xl active:scale-[0.98]"
            >
              無料でRootsに登録
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>

          <p className="mt-4 text-sm text-indigo-200">
            無料プランあり・クレジットカード不要
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Footer                                                      */}
      {/* ============================================================ */}
      <footer className="border-t border-gray-100 bg-white py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.svg" alt="Roots" width={80} height={22} className="h-5 w-auto" />
              <span className="text-lg font-bold text-gray-900">Roots</span>
            </Link>

            <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <Link
                href="/tools"
                className="hover:text-personal transition-colors"
              >
                ツール一覧
              </Link>
              <Link
                href="/career"
                className="hover:text-personal transition-colors"
              >
                キャリアプラットフォーム
              </Link>
              <Link
                href="/terms"
                className="hover:text-personal transition-colors"
              >
                利用規約
              </Link>
              <Link
                href="/privacy"
                className="hover:text-personal transition-colors"
              >
                プライバシーポリシー
              </Link>
              <Link
                href="/recruitment-disclosure"
                className="hover:text-personal transition-colors"
              >
                職業紹介事業の情報開示
              </Link>
            </nav>

            <p className="text-sm text-gray-400">
              &copy; {new Date().getFullYear()} Roots
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
