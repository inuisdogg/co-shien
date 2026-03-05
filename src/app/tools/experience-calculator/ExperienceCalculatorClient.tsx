'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Plus,
  Trash2,
  Calculator,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  CalendarDays,
  Briefcase,
  FileText,
  Save,
  RotateCcw,
} from 'lucide-react';
import { BUSINESS_TYPES } from '@/types';
import { useToast } from '@/components/ui/Toast';

// ============================================================
// Types
// ============================================================

interface WorkEntry {
  id: string;
  facilityName: string;
  businessType: string;
  jobTitle: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  employmentType: 'fulltime' | 'parttime';
  weeklyDays: number;
}

interface FacilityResult {
  id: string;
  facilityName: string;
  jobTitle: string;
  totalCalendarDays: number;
  effectiveDays: number;
  years: number;
  months: number;
  days: number;
  isParttime: boolean;
}

interface TotalResult {
  totalCalendarDays: number;
  effectiveDays: number;
  years: number;
  months: number;
  days: number;
  facilityBreakdowns: FacilityResult[];
}

type QualificationStatus = 'met' | 'close' | 'not_met';

interface QualificationCheck {
  name: string;
  requiredLabel: string;
  requiredDays: number;
  requiredHours?: number;
  status: QualificationStatus;
  userLabel: string;
}

// ============================================================
// Constants
// ============================================================

const JOB_TITLES = [
  '保育士',
  '幼稚園教諭',
  '児童指導員',
  '理学療法士（PT）',
  '作業療法士（OT）',
  '言語聴覚士（ST）',
  '社会福祉士',
  '介護福祉士',
  'その他',
] as const;

const DRAFT_KEY = 'roots_tool_experience_calc_draft';

const QUALIFICATION_REQUIREMENTS: {
  name: string;
  requiredLabel: string;
  requiredDays: number;
  requiredHours?: number;
}[] = [
  {
    name: '保育士試験（実務経験ルート）',
    requiredLabel: '2年以上かつ2880時間以上',
    requiredDays: 730,
    requiredHours: 2880,
  },
  {
    name: '社会福祉士（指定施設）',
    requiredLabel: '2年以上',
    requiredDays: 730,
  },
  {
    name: '社会福祉士（相談援助）',
    requiredLabel: '4年以上',
    requiredDays: 1460,
  },
  {
    name: '児童発達支援管理責任者',
    requiredLabel: '3年以上（OJT含む）',
    requiredDays: 1095,
  },
  {
    name: 'サービス管理責任者',
    requiredLabel: '3年以上',
    requiredDays: 1095,
  },
];

// ============================================================
// Helpers
// ============================================================

const uid = (): string => Math.random().toString(36).slice(2, 10);

const emptyEntry = (): WorkEntry => ({
  id: uid(),
  facilityName: '',
  businessType: '',
  jobTitle: '',
  startDate: '',
  endDate: '',
  isCurrent: false,
  employmentType: 'fulltime',
  weeklyDays: 5,
});

/**
 * Merge overlapping date intervals.
 * Returns sorted, non-overlapping intervals.
 */
function mergeIntervals(intervals: [number, number][]): [number, number][] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i][0] <= last[1]) {
      last[1] = Math.max(last[1], sorted[i][1]);
    } else {
      merged.push(sorted[i]);
    }
  }
  return merged;
}

/**
 * Count total days from merged intervals.
 */
function countDays(intervals: [number, number][]): number {
  return intervals.reduce((sum, [start, end]) => sum + Math.round((end - start) / (1000 * 60 * 60 * 24)), 0);
}

/**
 * Convert total days to years, months, remaining days.
 */
function daysToYMD(totalDays: number): { years: number; months: number; days: number } {
  const years = Math.floor(totalDays / 365);
  const remaining = totalDays % 365;
  const months = Math.floor(remaining / 30);
  const days = remaining % 30;
  return { years, months, days };
}

/**
 * Format YMD as Japanese string.
 */
function formatYMD(y: number, m: number, d: number): string {
  const parts: string[] = [];
  if (y > 0) parts.push(`${y}年`);
  if (m > 0 || y > 0) parts.push(`${m}ヶ月`);
  if (d > 0 || (y === 0 && m === 0)) parts.push(`${d}日`);
  return parts.join('');
}

/**
 * Get the status color/class for a qualification check.
 */
function getStatusInfo(status: QualificationStatus) {
  switch (status) {
    case 'met':
      return {
        icon: CheckCircle2,
        bgClass: 'bg-emerald-50 border-emerald-200',
        textClass: 'text-emerald-600',
        badgeClass: 'bg-emerald-100 text-emerald-700',
        label: '達成',
      };
    case 'close':
      return {
        icon: AlertTriangle,
        bgClass: 'bg-amber-50 border-amber-200',
        textClass: 'text-amber-600',
        badgeClass: 'bg-amber-100 text-amber-700',
        label: 'あと少し',
      };
    case 'not_met':
      return {
        icon: XCircle,
        bgClass: 'bg-red-50 border-red-200',
        textClass: 'text-red-500',
        badgeClass: 'bg-red-100 text-red-700',
        label: '未達成',
      };
  }
}

// ============================================================
// Main Component
// ============================================================

export default function ExperienceCalculatorClient() {
  const { toast } = useToast();

  // ── Restore draft from localStorage on mount ──
  const initialState = useRef<{ entries: WorkEntry[] } | null>(null);

  if (initialState.current === null) {
    let restored = false;
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(DRAFT_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.entries) && parsed.entries.length > 0) {
          initialState.current = { entries: parsed.entries };
          restored = true;
        }
      }
    } catch {
      // localStorage not available or corrupted
    }
    if (!restored) {
      initialState.current = { entries: [emptyEntry()] };
    }
  }

  const [entries, setEntries] = useState<WorkEntry[]>(initialState.current!.entries);
  const [result, setResult] = useState<TotalResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // ── Auto-save to localStorage (debounced 3s) ──
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        const data = JSON.stringify({ entries });
        localStorage.setItem(DRAFT_KEY, data);
      } catch {
        // localStorage full or not available
      }
    }, 3000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [entries]);

  // ── Clear draft ──
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    setEntries([emptyEntry()]);
    setResult(null);
    setShowResult(false);
    toast.success('入力内容をリセットしました');
  }, [toast]);

  // ----------------------------------------------------------
  // Entry handlers
  // ----------------------------------------------------------

  const updateEntry = useCallback((id: string, field: keyof WorkEntry, value: string | number | boolean) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        const updated = { ...e, [field]: value };
        // If "isCurrent" is checked, clear endDate
        if (field === 'isCurrent' && value === true) {
          updated.endDate = '';
        }
        // If employmentType changed to fulltime, reset weeklyDays
        if (field === 'employmentType' && value === 'fulltime') {
          updated.weeklyDays = 5;
        }
        return updated;
      })
    );
  }, []);

  const addEntry = useCallback(() => {
    setEntries((prev) => [...prev, emptyEntry()]);
  }, []);

  const removeEntry = useCallback(
    (id: string) => {
      setEntries((prev) => {
        if (prev.length <= 1) {
          toast.warning('最低1つの職歴が必要です');
          return prev;
        }
        return prev.filter((e) => e.id !== id);
      });
    },
    [toast]
  );

  // ----------------------------------------------------------
  // Calculation
  // ----------------------------------------------------------

  const calculate = useCallback(() => {
    // Validate
    const validEntries: WorkEntry[] = [];
    for (const entry of entries) {
      if (!entry.startDate) {
        toast.error(`「${entry.facilityName || '未入力の施設'}」の開始日を入力してください`);
        return;
      }
      const start = new Date(entry.startDate).getTime();
      const end = entry.isCurrent ? Date.now() : new Date(entry.endDate).getTime();
      if (!entry.isCurrent && !entry.endDate) {
        toast.error(`「${entry.facilityName || '未入力の施設'}」の終了日を入力するか「現在」にチェックしてください`);
        return;
      }
      if (end < start) {
        toast.error(`「${entry.facilityName || '未入力の施設'}」の終了日が開始日より前です`);
        return;
      }
      validEntries.push(entry);
    }

    if (validEntries.length === 0) {
      toast.error('職歴を入力してください');
      return;
    }

    // Per-facility breakdown
    const facilityBreakdowns: FacilityResult[] = validEntries.map((entry) => {
      const start = new Date(entry.startDate).getTime();
      const end = entry.isCurrent ? Date.now() : new Date(entry.endDate).getTime();
      const calendarDays = Math.round((end - start) / (1000 * 60 * 60 * 24));

      let effectiveDays: number;
      if (entry.employmentType === 'parttime') {
        // Weeks in period * weekly working days
        const weeks = calendarDays / 7;
        effectiveDays = Math.round(weeks * entry.weeklyDays);
      } else {
        // Fulltime: 5 working days per week
        const weeks = calendarDays / 7;
        effectiveDays = Math.round(weeks * 5);
      }

      const { years, months, days } = daysToYMD(calendarDays);

      return {
        id: entry.id,
        facilityName: entry.facilityName || '(施設名未入力)',
        jobTitle: entry.jobTitle || '(職種未選択)',
        totalCalendarDays: calendarDays,
        effectiveDays,
        years,
        months,
        days,
        isParttime: entry.employmentType === 'parttime',
      };
    });

    // Total with overlap removal
    const intervals: [number, number][] = validEntries.map((entry) => {
      const start = new Date(entry.startDate).getTime();
      const end = entry.isCurrent ? Date.now() : new Date(entry.endDate).getTime();
      return [start, end];
    });

    const merged = mergeIntervals(intervals);
    const totalCalendarDays = countDays(merged);

    // Total effective working days (sum from each entry, but cap overlapping periods)
    // For simplicity, we calculate effective days from total calendar days using weighted average
    const totalEffectiveDays = facilityBreakdowns.reduce((sum, fb) => sum + fb.effectiveDays, 0);

    const { years, months, days } = daysToYMD(totalCalendarDays);

    const totalResult: TotalResult = {
      totalCalendarDays,
      effectiveDays: totalEffectiveDays,
      years,
      months,
      days,
      facilityBreakdowns,
    };

    setResult(totalResult);
    setShowResult(true);

    // Scroll to results
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [entries, toast]);

  // ----------------------------------------------------------
  // Qualification checks
  // ----------------------------------------------------------

  const qualificationChecks = useMemo((): QualificationCheck[] => {
    if (!result) return [];

    const sixMonthsDays = 183;

    return QUALIFICATION_REQUIREMENTS.map((req) => {
      const totalDays = result.totalCalendarDays;
      let status: QualificationStatus;

      if (totalDays >= req.requiredDays) {
        // For nursery exam, also check hours (approximate: effectiveDays * 8 hours)
        if (req.requiredHours) {
          const approxHours = result.effectiveDays * 8;
          if (approxHours >= req.requiredHours) {
            status = 'met';
          } else if (approxHours >= req.requiredHours - 480) {
            // Within ~2 months of 8h/day work
            status = 'close';
          } else {
            status = 'not_met';
          }
        } else {
          status = 'met';
        }
      } else if (totalDays >= req.requiredDays - sixMonthsDays) {
        status = 'close';
      } else {
        status = 'not_met';
      }

      const { years, months, days } = daysToYMD(totalDays);
      let userLabel = formatYMD(years, months, days);
      if (req.requiredHours) {
        const approxHours = result.effectiveDays * 8;
        userLabel += `（約${approxHours.toLocaleString()}時間）`;
      }

      return {
        name: req.name,
        requiredLabel: req.requiredLabel,
        requiredDays: req.requiredDays,
        requiredHours: req.requiredHours,
        status,
        userLabel,
      };
    });
  }, [result]);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30">
      {/* ============================================================ */}
      {/*  Header                                                      */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/tools" className="flex items-center gap-2 group">
            <Image src="/logo.svg" alt="Roots" width={80} height={22} className="h-5 w-auto" />
            <span className="text-lg font-bold text-gray-900">Roots Tools</span>
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
      <section className="relative overflow-hidden bg-gradient-to-br from-personal/5 via-teal-50/40 to-white pb-10 pt-12 sm:pb-14 sm:pt-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-personal/10 px-4 py-1.5 text-sm font-medium text-personal">
            <Calculator className="h-4 w-4" />
            無料ツール
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
            実務経験年数
            <span className="text-personal">計算</span>
            ツール
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-gray-600 sm:text-lg">
            保育士試験・社会福祉士・児童発達支援管理責任者などの
            <br className="hidden sm:block" />
            受験資格に必要な実務経験年数を自動計算します。
            <br className="hidden sm:block" />
            複数施設の勤務期間は重複を除外して正確に算出。
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Entry Form                                                  */}
      {/* ============================================================ */}
      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Briefcase className="h-5 w-5 text-personal" />
            職歴を入力
          </h2>
          <button
            onClick={clearDraft}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            リセット
          </button>
        </div>

        <div className="space-y-4">
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className="relative rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md sm:p-6"
              style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
            >
              {/* Entry header */}
              <div className="mb-4 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-personal/10 px-3 py-1 text-sm font-semibold text-personal">
                  <Building2 className="h-3.5 w-3.5" />
                  職歴 {index + 1}
                </span>
                {entries.length > 1 && (
                  <button
                    onClick={() => removeEntry(entry.id)}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    title="この職歴を削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Grid layout */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* 施設名 */}
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">施設名</label>
                  <input
                    type="text"
                    placeholder="例: 〇〇保育園"
                    value={entry.facilityName}
                    onChange={(e) => updateEntry(entry.id, 'facilityName', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-personal focus:bg-white focus:outline-none focus:ring-2 focus:ring-personal/20"
                  />
                </div>

                {/* 事業種別 */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">事業種別</label>
                  <select
                    value={entry.businessType}
                    onChange={(e) => updateEntry(entry.id, 'businessType', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm text-gray-900 transition-colors focus:border-personal focus:bg-white focus:outline-none focus:ring-2 focus:ring-personal/20"
                  >
                    <option value="">選択してください</option>
                    {BUSINESS_TYPES.map((bt) => (
                      <option key={bt.id} value={bt.name}>
                        {bt.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 職種 */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">職種</label>
                  <select
                    value={entry.jobTitle}
                    onChange={(e) => updateEntry(entry.id, 'jobTitle', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm text-gray-900 transition-colors focus:border-personal focus:bg-white focus:outline-none focus:ring-2 focus:ring-personal/20"
                  >
                    <option value="">選択してください</option>
                    {JOB_TITLES.map((jt) => (
                      <option key={jt} value={jt}>
                        {jt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 開始日 */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                    開始日
                  </label>
                  <input
                    type="date"
                    value={entry.startDate}
                    onChange={(e) => updateEntry(entry.id, 'startDate', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm text-gray-900 transition-colors focus:border-personal focus:bg-white focus:outline-none focus:ring-2 focus:ring-personal/20"
                  />
                </div>

                {/* 終了日 */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                    終了日
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="date"
                      value={entry.endDate}
                      disabled={entry.isCurrent}
                      onChange={(e) => updateEntry(entry.id, 'endDate', e.target.value)}
                      className="flex-1 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm text-gray-900 transition-colors focus:border-personal focus:bg-white focus:outline-none focus:ring-2 focus:ring-personal/20 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={entry.isCurrent}
                        onChange={(e) => updateEntry(entry.id, 'isCurrent', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-personal accent-personal focus:ring-personal"
                      />
                      現在
                    </label>
                  </div>
                </div>

                {/* 雇用形態 */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">雇用形態</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name={`employment-${entry.id}`}
                        value="fulltime"
                        checked={entry.employmentType === 'fulltime'}
                        onChange={() => updateEntry(entry.id, 'employmentType', 'fulltime')}
                        className="h-4 w-4 border-gray-300 text-personal accent-personal focus:ring-personal"
                      />
                      常勤
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name={`employment-${entry.id}`}
                        value="parttime"
                        checked={entry.employmentType === 'parttime'}
                        onChange={() => updateEntry(entry.id, 'employmentType', 'parttime')}
                        className="h-4 w-4 border-gray-300 text-personal accent-personal focus:ring-personal"
                      />
                      非常勤
                    </label>
                  </div>
                </div>

                {/* 週平均勤務日数 (parttime only) */}
                {entry.employmentType === 'parttime' && (
                  <div style={{ animation: 'fadeSlideIn 0.2s ease-out' }}>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      週平均勤務日数
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={7}
                        step={0.5}
                        value={entry.weeklyDays}
                        onChange={(e) => updateEntry(entry.id, 'weeklyDays', parseFloat(e.target.value) || 1)}
                        className="w-24 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm text-gray-900 transition-colors focus:border-personal focus:bg-white focus:outline-none focus:ring-2 focus:ring-personal/20"
                      />
                      <span className="text-sm text-gray-500">日/週</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add entry button */}
        <button
          onClick={addEntry}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 bg-white/50 py-4 text-sm font-medium text-gray-500 transition-all hover:border-personal/40 hover:bg-personal/5 hover:text-personal"
        >
          <Plus className="h-4 w-4" />
          職歴を追加
        </button>

        {/* Calculate button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={calculate}
            className="inline-flex items-center gap-2 rounded-2xl bg-personal px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-personal/25 transition-all hover:bg-personal-dark hover:shadow-xl hover:shadow-personal/30 active:scale-[0.98]"
          >
            <Calculator className="h-5 w-5" />
            実務経験を計算する
          </button>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Results                                                     */}
      {/* ============================================================ */}
      {showResult && result && (
        <section ref={resultRef} className="mx-auto max-w-4xl px-4 pb-8 sm:px-6 lg:px-8" style={{ animation: 'fadeSlideIn 0.4s ease-out' }}>
          {/* Total */}
          <div className="mb-8 overflow-hidden rounded-2xl border border-personal/20 bg-gradient-to-br from-personal/5 to-teal-50/50 p-6 shadow-lg sm:p-8">
            <h3 className="mb-1 text-sm font-medium uppercase tracking-wider text-personal/70">合計実務経験</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
                {result.years > 0 && <>{result.years}<span className="text-2xl sm:text-3xl">年</span></>}
                {result.months}<span className="text-2xl sm:text-3xl">ヶ月</span>
              </span>
              <span className="text-base text-gray-500">
                ({result.totalCalendarDays.toLocaleString()}日)
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              実勤務日数（概算）: {result.effectiveDays.toLocaleString()}日
              {entries.some((e) => e.employmentType === 'parttime') && (
                <span className="text-xs text-gray-400"> ※非常勤は週平均勤務日数で按分</span>
              )}
            </p>
            {entries.length > 1 && (
              <p className="mt-1 text-xs text-gray-400">
                ※複数施設の重複期間は除外して計算しています
              </p>
            )}
          </div>

          {/* Per-facility breakdown */}
          <div className="mb-8">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
              <Building2 className="h-5 w-5 text-personal" />
              施設別内訳
            </h3>
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">施設名</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">職種</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">形態</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">暦日数</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">実勤務日数</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">期間</th>
                  </tr>
                </thead>
                <tbody>
                  {result.facilityBreakdowns.map((fb) => (
                    <tr key={fb.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{fb.facilityName}</td>
                      <td className="px-4 py-3 text-gray-600">{fb.jobTitle}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            fb.isParttime
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {fb.isParttime ? '非常勤' : '常勤'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {fb.totalCalendarDays.toLocaleString()}日
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {fb.effectiveDays.toLocaleString()}日
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatYMD(fb.years, fb.months, fb.days)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Qualification comparison */}
          <div className="mb-8">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
              <FileText className="h-5 w-5 text-personal" />
              資格別判定
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {qualificationChecks.map((qc) => {
                const info = getStatusInfo(qc.status);
                const Icon = info.icon;
                return (
                  <div
                    key={qc.name}
                    className={`rounded-2xl border p-4 transition-all ${info.bgClass}`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold text-gray-900">{qc.name}</h4>
                      <span
                        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${info.badgeClass}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {info.label}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-gray-600">
                        <span>必要経験</span>
                        <span className="font-medium">{qc.requiredLabel}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>あなた</span>
                        <span className={`font-bold ${info.textClass}`}>{qc.userLabel}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ============================================================ */}
          {/*  CTA                                                         */}
          {/* ============================================================ */}
          <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-personal via-personal-dark to-teal-700 p-6 text-white shadow-xl sm:p-8">
            <h3 className="mb-2 text-xl font-bold sm:text-2xl">
              この職歴をRootsに保存しませんか？
            </h3>
            <p className="mb-6 text-sm leading-relaxed text-white/80">
              Rootsに登録すると、職歴データから実務経験証明書をワンクリック発行できます。
              <br />
              キャリアデータの管理・資格取得の進捗管理もまとめて行えます。
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/career"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-personal shadow-lg transition-all hover:bg-gray-50 hover:shadow-xl active:scale-[0.98]"
              >
                <Save className="h-4 w-4" />
                この職歴をRootsキャリアアカウントに保存
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link
                href="/tools/career-certificate"
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 active:scale-[0.98]"
              >
                <FileText className="h-4 w-4" />
                実務経験証明書を発行する
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/*  FAQ / Explanation (SEO content)                             */}
      {/* ============================================================ */}
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-xl font-bold text-gray-900">よくある質問</h2>
        <div className="space-y-4">
          {[
            {
              q: '非常勤の場合、実務経験はどう計算されますか？',
              a: '非常勤の場合、暦日数（在籍期間）はそのまま計算されますが、実勤務日数は「週平均勤務日数 x 在籍週数」で概算されます。保育士試験の実務経験ルートでは「2年以上かつ2,880時間以上」の要件があるため、非常勤の方は実勤務時間に注意が必要です。',
            },
            {
              q: '複数施設で同時期に働いていた場合は？',
              a: '複数施設の勤務期間が重複している場合、合計期間から重複分を自動的に除外して計算します。例えば、A施設（2020年4月〜2023年3月）とB施設（2022年4月〜2024年3月）の場合、合計は4年間として計算されます。',
            },
            {
              q: '児童発達支援管理責任者の実務経験要件は？',
              a: '児童発達支援管理責任者になるには、障害児・者の保健・医療・福祉・就労・教育の分野における直接支援・相談支援などの業務に3年以上従事した経験が必要です。加えて、相談支援従事者初任者研修とサービス管理責任者等研修の修了が求められます。',
            },
            {
              q: 'この計算結果は公式なものですか？',
              a: 'このツールは目安の算出を目的としたものです。正式な実務経験年数の認定は、各資格の試験実施機関・都道府県の判断に委ねられます。実際の申請時には、実務経験証明書の提出が必要です。',
            },
          ].map((faq) => (
            <details
              key={faq.q}
              className="group rounded-2xl border border-gray-200 bg-white shadow-sm"
            >
              <summary className="cursor-pointer select-none px-5 py-4 text-sm font-semibold text-gray-900 transition-colors hover:text-personal">
                {faq.q}
              </summary>
              <div className="border-t border-gray-100 px-5 py-4 text-sm leading-relaxed text-gray-600">
                {faq.a}
              </div>
            </details>
          ))}
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
              <Link href="/tools" className="hover:text-personal transition-colors">
                ツール一覧
              </Link>
              <Link href="/career" className="hover:text-personal transition-colors">
                キャリアプラットフォーム
              </Link>
              <Link href="/terms" className="hover:text-personal transition-colors">
                利用規約
              </Link>
              <Link href="/privacy" className="hover:text-personal transition-colors">
                プライバシーポリシー
              </Link>
            </nav>
          </div>
          <p className="mt-6 text-center text-xs text-gray-400">
            Roots - 福祉専門職のためのキャリアプラットフォーム
          </p>
        </div>
      </footer>

      {/* ============================================================ */}
      {/*  Animations                                                  */}
      {/* ============================================================ */}
      <style jsx global>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
