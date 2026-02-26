'use client';

/**
 * 処遇改善加算シミュレーター
 *
 * Standalone calculator page for childcare/welfare professionals to estimate
 * their 処遇改善加算 (treatment improvement subsidy) based on experience,
 * qualifications, and training history. All calculation is client-side.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Calculator,
  ArrowRight,
  Wrench,
  User,
  Award,
  GraduationCap,
  TrendingUp,
  Lightbulb,
  CheckCircle,
  ChevronRight,
  Info,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                  */
/* ------------------------------------------------------------------ */

type FacilityType =
  | '児童発達支援'
  | '放課後等デイサービス'
  | '保育所'
  | '認定こども園'
  | '障害者支援施設';

type EmploymentType = '常勤' | '非常勤';

type RoleType =
  | '一般職員'
  | '職務分野別リーダー'
  | '専門リーダー'
  | '副主任'
  | '主任'
  | '管理者';

interface FormState {
  yearsExperience: number;
  facilityType: FacilityType;
  employmentType: EmploymentType;
  baseSalary: number;
  qualifications: string[];
  leaderTraining: boolean;
  specialistTraining: boolean;
  managementTraining: boolean;
  role: RoleType;
}

interface CalculationResult {
  kasanI: number;
  kasanII: number;
  kasanIII: number;
  total: number;
  annual: number;
  estimatedMonthlySalary: number;
}

const FACILITY_OPTIONS: FacilityType[] = [
  '児童発達支援',
  '放課後等デイサービス',
  '保育所',
  '認定こども園',
  '障害者支援施設',
];

const EMPLOYMENT_OPTIONS: EmploymentType[] = ['常勤', '非常勤'];

const ROLE_OPTIONS: RoleType[] = [
  '一般職員',
  '職務分野別リーダー',
  '専門リーダー',
  '副主任',
  '主任',
  '管理者',
];

const QUALIFICATION_OPTIONS = [
  '保育士',
  '社会福祉士',
  '介護福祉士',
  '児童発達支援管理責任者',
  'サービス管理責任者',
  '相談支援専門員',
  '理学療法士/作業療法士/言語聴覚士',
  '看護師',
];

/* ------------------------------------------------------------------ */
/*  Calculation Logic                                                  */
/* ------------------------------------------------------------------ */

function calculate(form: FormState): CalculationResult {
  const empFactor = form.employmentType === '常勤' ? 1.0 : 0.6;

  // --- 処遇改善加算I ---
  const expYearsCapped = Math.min(form.yearsExperience, 10);
  const expAmount = expYearsCapped * 6000;
  const qualCount = Math.min(form.qualifications.length, 3);
  const qualAmount = qualCount * 5000;
  const kasanI = Math.round((expAmount + qualAmount) * empFactor);

  // --- 処遇改善加算II ---
  let kasanII = 0;
  switch (form.role) {
    case '職務分野別リーダー':
      if (form.leaderTraining) kasanII = 5000;
      break;
    case '専門リーダー':
      if (form.specialistTraining) kasanII = 20000;
      break;
    case '副主任':
      if (form.managementTraining) kasanII = 40000;
      break;
    case '主任':
    case '管理者':
      kasanII = 40000;
      break;
    default:
      kasanII = 0;
  }

  // --- 処遇改善加算III (ベースアップ) ---
  const kasanIII = form.employmentType === '常勤' ? 9000 : 5400;

  const total = kasanI + kasanII + kasanIII;
  const annual = total * 12;
  const estimatedMonthlySalary = form.baseSalary * 10000 + total;

  return { kasanI, kasanII, kasanIII, total, annual, estimatedMonthlySalary };
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
    // We intentionally only react to `value` changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={className}>
      {display.toLocaleString('ja-JP')}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Career Advice                                                      */
/* ------------------------------------------------------------------ */

function getAdvice(form: FormState, result: CalculationResult): string[] {
  const advice: string[] = [];

  if (form.qualifications.length === 0) {
    advice.push(
      '資格取得で月額最大15,000円アップの可能性があります'
    );
  } else if (form.qualifications.length < 3) {
    advice.push(
      `現在${form.qualifications.length}つの資格を保有。あと${3 - form.qualifications.length}つの追加資格で加算額がさらにアップします`
    );
  }

  if (!form.leaderTraining && !form.specialistTraining && !form.managementTraining) {
    advice.push(
      '研修受講でさらなる処遇改善の対象になります'
    );
  }

  if (form.yearsExperience < 10) {
    advice.push(
      `経験年数に応じて加算額が増加します（現在${form.yearsExperience}年→10年で最大60,000円/月）`
    );
  }

  if (form.role === '一般職員') {
    advice.push(
      '職務分野別リーダー以上の役職に就くと、処遇改善加算IIの対象となります'
    );
  }

  if (
    form.role === '職務分野別リーダー' &&
    !form.leaderTraining
  ) {
    advice.push(
      '職務分野別リーダー研修を修了すると、月額5,000円の加算が受けられます'
    );
  }

  if (form.role === '専門リーダー' && !form.specialistTraining) {
    advice.push(
      '専門リーダー研修を修了すると、月額20,000円の加算が受けられます'
    );
  }

  if (form.role === '副主任' && !form.managementTraining) {
    advice.push(
      'マネジメント研修を修了すると、月額40,000円の加算が受けられます'
    );
  }

  return advice;
}

/* ------------------------------------------------------------------ */
/*  Main Page Component                                                */
/* ------------------------------------------------------------------ */

export default function SalarySimulatorPage() {
  const [form, setForm] = useState<FormState>({
    yearsExperience: 3,
    facilityType: '保育所',
    employmentType: '常勤',
    baseSalary: 20,
    qualifications: [],
    leaderTraining: false,
    specialistTraining: false,
    managementTraining: false,
    role: '一般職員',
  });

  const result = useMemo(() => calculate(form), [form]);
  const advice = useMemo(() => getAdvice(form, result), [form, result]);

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const toggleQualification = useCallback((q: string) => {
    setForm((prev) => {
      const has = prev.qualifications.includes(q);
      return {
        ...prev,
        qualifications: has
          ? prev.qualifications.filter((x) => x !== q)
          : [...prev.qualifications, q],
      };
    });
  }, []);

  // Bar chart max for scaling
  const barMax = Math.max(result.kasanI, result.kasanII, result.kasanIII, 1);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ============================================================ */}
      {/*  Header                                                      */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/tools" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-lg transition-transform group-hover:scale-105">
              R
            </div>
            <span className="text-xl font-bold text-gray-900">
              Roots <span className="text-sm font-medium text-gray-500">Tools</span>
            </span>
          </Link>

          <Link
            href="/career"
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md active:scale-[0.98]"
          >
            Rootsに無料登録
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* ============================================================ */}
      {/*  Hero                                                        */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 py-12 sm:py-16">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-white/5" />

        <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90">
            <Calculator className="h-4 w-4" />
            無料・登録不要
          </div>
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl">
            処遇改善加算シミュレーター
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-indigo-100 sm:text-lg">
            経験年数・資格・研修実績を入力するだけで、処遇改善加算の概算額をリアルタイムで計算します。
            キャリアアップの参考にご活用ください。
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Main Content: Form + Results                                */}
      {/* ============================================================ */}
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* ------ FORM (3 cols) ------ */}
          <div className="lg:col-span-3 space-y-6">
            {/* Section 1: 基本情報 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <User className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">基本情報</h2>
              </div>

              <div className="space-y-5">
                {/* 経験年数 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    経験年数
                    <span className="ml-2 inline-flex min-w-[3rem] items-center justify-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-sm font-bold text-indigo-700">
                      {form.yearsExperience}年
                    </span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={form.yearsExperience}
                    onChange={(e) =>
                      updateField('yearsExperience', Number(e.target.value))
                    }
                    className="w-full h-2 rounded-full appearance-none bg-gray-200 accent-indigo-600 cursor-pointer"
                  />
                  <div className="mt-1 flex justify-between text-xs text-gray-400">
                    <span>0年</span>
                    <span>10年</span>
                    <span>20年</span>
                    <span>30年</span>
                    <span>40年</span>
                  </div>
                </div>

                {/* 施設種別 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    施設種別
                  </label>
                  <select
                    value={form.facilityType}
                    onChange={(e) =>
                      updateField('facilityType', e.target.value as FacilityType)
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {FACILITY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 雇用形態 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    雇用形態
                  </label>
                  <div className="flex gap-3">
                    {EMPLOYMENT_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => updateField('employmentType', opt)}
                        className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition-all ${
                          form.employmentType === opt
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 基本月給 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    現在の基本月給（税込）
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={10}
                      max={100}
                      step={0.5}
                      value={form.baseSalary}
                      onChange={(e) =>
                        updateField(
                          'baseSalary',
                          Math.max(0, Number(e.target.value))
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-12 text-sm text-gray-900 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
                      万円
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: 資格情報 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                  <Award className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">資格情報</h2>
                <span className="ml-auto text-xs text-gray-400">
                  加算対象: 最大3資格
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {QUALIFICATION_OPTIONS.map((q) => {
                  const checked = form.qualifications.includes(q);
                  return (
                    <label
                      key={q}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-sm transition-all ${
                        checked
                          ? 'border-purple-500 bg-purple-50 text-purple-800'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleQualification(q)}
                        className="h-4 w-4 rounded border-gray-300 text-purple-600 accent-purple-600"
                      />
                      <span className="font-medium">{q}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Section 3: 研修・キャリアパス */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">
                  研修・キャリアパス
                </h2>
              </div>

              <div className="space-y-4">
                {/* Training toggles */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">修了済み研修</p>
                  {(
                    [
                      {
                        key: 'leaderTraining' as const,
                        label: '職務分野別リーダー研修',
                      },
                      {
                        key: 'specialistTraining' as const,
                        label: '専門リーダー研修',
                      },
                      {
                        key: 'managementTraining' as const,
                        label: 'マネジメント研修',
                      },
                    ] as const
                  ).map((t) => {
                    const checked = form[t.key];
                    return (
                      <label
                        key={t.key}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-sm transition-all ${
                          checked
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => updateField(t.key, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-emerald-600 accent-emerald-600"
                        />
                        <span className="font-medium">{t.label}</span>
                        {checked && (
                          <CheckCircle className="ml-auto h-4 w-4 text-emerald-500" />
                        )}
                      </label>
                    );
                  })}
                </div>

                {/* 役職 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    現在の役職
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) =>
                      updateField('role', e.target.value as RoleType)
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ------ RESULTS (2 cols) ------ */}
          <div className="lg:col-span-2 space-y-6">
            {/* Sticky wrapper on desktop */}
            <div className="lg:sticky lg:top-20 space-y-6">
              {/* Main results card */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">
                    シミュレーション結果
                  </h2>
                </div>

                {/* Breakdown items */}
                <div className="space-y-4">
                  {/* 加算I */}
                  <div className="rounded-xl bg-gray-50 p-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium text-gray-600">
                        処遇改善加算I
                      </span>
                      <span className="text-lg font-bold text-gray-900">
                        <AnimatedYen value={result.kasanI} />
                        <span className="ml-0.5 text-sm font-medium text-gray-500">
                          円/月
                        </span>
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      経験年数・資格に基づく加算
                    </p>
                  </div>

                  {/* 加算II */}
                  <div className="rounded-xl bg-gray-50 p-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium text-gray-600">
                        処遇改善加算II
                      </span>
                      <span className="text-lg font-bold text-gray-900">
                        <AnimatedYen value={result.kasanII} />
                        <span className="ml-0.5 text-sm font-medium text-gray-500">
                          円/月
                        </span>
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      役職・研修に基づく加算
                    </p>
                  </div>

                  {/* 加算III */}
                  <div className="rounded-xl bg-gray-50 p-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium text-gray-600">
                        処遇改善加算III
                      </span>
                      <span className="text-lg font-bold text-gray-900">
                        <AnimatedYen value={result.kasanIII} />
                        <span className="ml-0.5 text-sm font-medium text-gray-500">
                          円/月
                        </span>
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      ベースアップ加算
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="my-5 border-t border-gray-200" />

                {/* Total */}
                <div className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 p-5 text-white">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-indigo-100">
                      加算合計
                    </span>
                    <span className="text-2xl font-extrabold">
                      <span className="mr-0.5 text-base font-bold">¥</span>
                      <AnimatedYen value={result.total} />
                      <span className="ml-1 text-sm font-semibold text-indigo-100">
                        /月
                      </span>
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between border-t border-white/20 pt-3">
                    <span className="text-sm font-medium text-indigo-100">
                      年間概算
                    </span>
                    <span className="text-lg font-bold">
                      <span className="mr-0.5 text-xs font-bold">¥</span>
                      <AnimatedYen value={result.annual} />
                      <span className="ml-1 text-xs font-semibold text-indigo-100">
                        /年
                      </span>
                    </span>
                  </div>

                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-sm font-medium text-indigo-100">
                      想定月収
                    </span>
                    <span className="text-lg font-bold">
                      <span className="mr-0.5 text-xs font-bold">¥</span>
                      <AnimatedYen value={result.estimatedMonthlySalary} />
                      <span className="ml-1 text-xs font-semibold text-indigo-100">
                        /月
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Bar chart */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-sm font-bold text-gray-900">
                  加算内訳（月額）
                </h3>
                <div className="space-y-3">
                  {[
                    {
                      label: '加算I',
                      value: result.kasanI,
                      color: 'bg-indigo-500',
                      bgColor: 'bg-indigo-100',
                    },
                    {
                      label: '加算II',
                      value: result.kasanII,
                      color: 'bg-purple-500',
                      bgColor: 'bg-purple-100',
                    },
                    {
                      label: '加算III',
                      value: result.kasanIII,
                      color: 'bg-emerald-500',
                      bgColor: 'bg-emerald-100',
                    },
                  ].map((bar) => (
                    <div key={bar.label}>
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-xs font-medium text-gray-600">
                          {bar.label}
                        </span>
                        <span className="text-xs font-bold text-gray-900">
                          {bar.value.toLocaleString('ja-JP')}円
                        </span>
                      </div>
                      <div
                        className={`h-3 w-full overflow-hidden rounded-full ${bar.bgColor}`}
                      >
                        <div
                          className={`h-full rounded-full ${bar.color} transition-all duration-500 ease-out`}
                          style={{
                            width: `${barMax > 0 ? (bar.value / barMax) * 100 : 0}%`,
                            minWidth: bar.value > 0 ? '4px' : '0px',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Career advice */}
              {advice.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-amber-600" />
                    <h3 className="text-sm font-bold text-amber-900">
                      キャリアアドバイス
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {advice.map((a, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-amber-800"
                      >
                        <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                        <span>{a}</span>
                      </li>
                    ))}
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
              ※本シミュレーションは概算であり、実際の加算額は施設の種別、地域区分、配分方法等により異なります。正確な金額は所属施設にお問い合わせください。
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  CTA Section                                                 */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 py-16 sm:py-20">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-white/5" />

        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
            処遇改善の対象、逃していませんか？
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-indigo-100 sm:text-lg">
            Rootsキャリアに登録すると、経験年数・研修・資格をすべて自動記録。
            処遇改善の対象を逃しません。
          </p>

          <div className="mt-8">
            <Link
              href="/career"
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-bold text-indigo-700 shadow-lg transition-all hover:bg-gray-50 hover:shadow-xl active:scale-[0.98]"
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">
                R
              </div>
              <span className="text-lg font-bold text-gray-900">Roots</span>
            </Link>

            <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <Link
                href="/tools"
                className="hover:text-indigo-600 transition-colors"
              >
                ツール一覧
              </Link>
              <Link
                href="/career"
                className="hover:text-indigo-600 transition-colors"
              >
                キャリアプラットフォーム
              </Link>
              <Link
                href="/terms"
                className="hover:text-indigo-600 transition-colors"
              >
                利用規約
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
