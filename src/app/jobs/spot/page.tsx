'use client';

/**
 * Spot Work Page — スポットワーク専用
 *
 * Dedicated page for browsing spot (one-off shift) work opportunities.
 * Supports calendar and list views, date-range / rate filtering, and
 * highlights urgent shifts within the next 7 days.
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowLeft,
  CalendarDays,
  List,
  LayoutGrid,
  MapPin,
  Clock,
  Banknote,
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Briefcase,
  AlertTriangle,
  SlidersHorizontal,
  UserPlus,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { QUALIFICATION_CODES } from '@/types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SpotShift = {
  id: string;
  job_posting_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  role_needed: string | null;
  hourly_rate: number | null;
  spots_available: number;
  spots_filled: number;
  status: string;
  job_postings: {
    id: string;
    title: string;
    facility_id: string;
    required_qualifications: string[] | null;
    facilities: {
      id: string;
      name: string;
      address: string | null;
    } | null;
  } | null;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function qualificationLabel(code: string): string {
  return (QUALIFICATION_CODES as Record<string, string>)[code] || code;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a: string, b: string): boolean {
  return a === b;
}

function formatDateJP(iso: string): string {
  const d = new Date(iso);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getMonth() + 1}/${d.getDate()}（${days[d.getDay()]}）`;
}

const MONTH_NAMES = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SpotWorkPage() {
  const router = useRouter();

  // Data
  const [shifts, setShifts] = useState<SpotShift[]>([]);
  const [loading, setLoading] = useState(true);

  // View
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');

  // Calendar state
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Filters
  const [rateMin, setRateMin] = useState('');
  const [selectedQualifications, setSelectedQualifications] = useState<Set<string>>(new Set());
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  /* ---- Fetch ---- */
  const fetchShifts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('spot_work_shifts')
        .select(
          '*, job_postings(id, title, facility_id, required_qualifications, facilities(id, name, address))'
        )
        .eq('status', 'open')
        .gte('shift_date', todayStr)
        .order('shift_date', { ascending: true });

      if (error) {
        console.error('Failed to fetch shifts:', error);
        setShifts([]);
      } else {
        setShifts((data as SpotShift[]) || []);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  /* ---- Filtered shifts ---- */
  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      // Rate min
      if (rateMin) {
        const min = parseInt(rateMin, 10);
        if (!isNaN(min) && (s.hourly_rate || 0) < min) return false;
      }
      // Qualifications
      if (selectedQualifications.size > 0) {
        const reqQuals = s.job_postings?.required_qualifications || [];
        const hasMatch = reqQuals.some((q) => selectedQualifications.has(q));
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [shifts, rateMin, selectedQualifications]);

  /* ---- Calendar helpers ---- */
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, SpotShift[]>();
    for (const s of filteredShifts) {
      const existing = map.get(s.shift_date) || [];
      existing.push(s);
      map.set(s.shift_date, existing);
    }
    return map;
  }, [filteredShifts]);

  const shiftsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return shiftsByDate.get(selectedDate) || [];
  }, [selectedDate, shiftsByDate]);

  // Group list view by day
  const groupedByDay = useMemo(() => {
    const groups: { date: string; shifts: SpotShift[] }[] = [];
    let currentDate = '';
    let currentGroup: SpotShift[] = [];

    for (const s of filteredShifts) {
      if (s.shift_date !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, shifts: currentGroup });
        }
        currentDate = s.shift_date;
        currentGroup = [s];
      } else {
        currentGroup.push(s);
      }
    }
    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, shifts: currentGroup });
    }
    return groups;
  }, [filteredShifts]);

  /* ---- Navigation ---- */
  const prevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(calYear - 1);
    } else {
      setCalMonth(calMonth - 1);
    }
  };

  const nextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(calYear + 1);
    } else {
      setCalMonth(calMonth + 1);
    }
  };

  /* ---- Toggle helpers ---- */
  const toggleQual = (q: string) => {
    setSelectedQualifications((prev) => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q);
      else next.add(q);
      return next;
    });
  };

  const clearFilters = () => {
    setRateMin('');
    setSelectedQualifications(new Set());
  };

  const hasActiveFilters = rateMin || selectedQualifications.size > 0;

  /* ---- Is urgent (within 7 days) ---- */
  const isUrgent = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - today.getTime();
    return diff >= 0 && diff < 7 * 24 * 60 * 60 * 1000;
  };

  /* ---- Shift Card ---- */
  const ShiftCard = ({ shift }: { shift: SpotShift }) => {
    const remaining = shift.spots_available - shift.spots_filled;
    const urgent = isUrgent(shift.shift_date);

    return (
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-amber-200 hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-gray-900">
              {shift.shift_date.replace(/-/g, '/')}
            </span>
            <span className="flex items-center gap-1 text-sm text-gray-600">
              <Clock className="h-3.5 w-3.5" />
              {shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)}
            </span>
            {urgent && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                <AlertTriangle className="h-3 w-3" />
                急募
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-sm text-gray-500">
            <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="line-clamp-1">
              {shift.job_postings?.facilities?.name || '施設名未設定'}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
            {shift.role_needed && (
              <span className="text-gray-600">{shift.role_needed}</span>
            )}
            {shift.hourly_rate && (
              <span className="font-semibold text-amber-700">
                <Banknote className="mr-0.5 inline h-3.5 w-3.5" />
                時給 {shift.hourly_rate.toLocaleString()}円
              </span>
            )}
            <span className="text-gray-400">残り {remaining} 枠</span>
          </div>
          {shift.job_postings?.facilities?.address && (
            <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
              <MapPin className="h-3 w-3" />
              {shift.job_postings.facilities.address}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/jobs/${shift.job_posting_id}`}
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            詳細
          </Link>
          <button
            onClick={() => {
              try {
                const user = localStorage.getItem('user');
                if (!user) {
                  router.push(`/career?redirect=/jobs/${shift.job_posting_id}`);
                  return;
                }
                router.push(`/jobs/${shift.job_posting_id}`);
              } catch {
                router.push(`/jobs/${shift.job_posting_id}`);
              }
            }}
            disabled={remaining <= 0}
            className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
          >
            {remaining > 0 ? '応募する' : '募集終了'}
          </button>
        </div>
      </div>
    );
  };

  /* ---- Filter Content ---- */
  const FilterContent = () => (
    <div className="space-y-6">
      {/* Hourly rate */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-gray-900">時給（下限）</h3>
        <div className="relative">
          <Banknote className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="number"
            value={rateMin}
            onChange={(e) => setRateMin(e.target.value)}
            placeholder="例: 1200"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
          />
        </div>
        <p className="mt-1 text-xs text-gray-400">円単位で入力</p>
      </div>

      {/* Qualifications */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-gray-900">資格</h3>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {Object.entries(QUALIFICATION_CODES).map(([code, name]) => (
            <label key={code} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedQualifications.has(code)}
                onChange={() => toggleQual(code)}
                className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm text-gray-700">{name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Clear */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          フィルターをクリア
        </button>
      )}
    </div>
  );

  /* ---- Calendar Renderer ---- */
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(calYear, calMonth);
    const firstDay = getFirstDayOfMonth(calYear, calMonth);
    const cells: React.ReactNode[] = [];

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="h-12 sm:h-16" />);
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const hasShifts = shiftsByDate.has(dateStr);
      const isSelected = selectedDate === dateStr;
      const isPast = dateStr < todayStr;
      const isToday = dateStr === todayStr;
      const shiftCount = shiftsByDate.get(dateStr)?.length || 0;

      cells.push(
        <button
          key={day}
          onClick={() => hasShifts && !isPast ? setSelectedDate(dateStr) : undefined}
          disabled={isPast || !hasShifts}
          className={`relative flex h-12 flex-col items-center justify-center rounded-lg text-sm font-medium transition-all sm:h-16 ${
            isSelected
              ? 'bg-amber-500 text-white shadow-md'
              : isToday
                ? 'bg-amber-50 text-amber-700 ring-2 ring-amber-300'
                : hasShifts && !isPast
                  ? 'cursor-pointer bg-white text-gray-900 hover:bg-amber-50 hover:text-amber-700'
                  : isPast
                    ? 'cursor-not-allowed text-gray-300'
                    : 'text-gray-400'
          }`}
        >
          {day}
          {hasShifts && !isPast && (
            <span
              className={`mt-0.5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                isSelected ? 'text-amber-100' : 'text-amber-500'
              }`}
            >
              {shiftCount}件
            </span>
          )}
        </button>
      );
    }

    return cells;
  };

  /* ================================================================== */
  /*  Render                                                             */
  /* ================================================================== */

  return (
    <div className="min-h-screen bg-white">
      {/* ============================================================ */}
      {/*  Header                                                      */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-lg transition-transform group-hover:scale-105">
              R
            </div>
            <span className="text-xl font-bold text-gray-900">Roots</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/jobs"
              className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
            >
              <Briefcase className="h-4 w-4" />
              求人一覧
            </Link>
            <Link
              href="/career"
              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md active:scale-[0.98]"
            >
              Rootsに登録
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/*  Hero                                                        */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-400 to-orange-500">
        <div className="absolute inset-0 -z-0">
          <div className="absolute -top-32 right-0 h-[500px] w-[500px] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-[400px] w-[400px] rounded-full bg-white/5 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-16 sm:px-6 sm:pb-16 sm:pt-20 lg:px-8">
          <div className="text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-sm font-medium text-white backdrop-blur">
              <CalendarDays className="h-4 w-4" />
              自分のペースで働ける
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              スポットワーク
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-amber-50">
              空いた日に、好きな施設で働こう。
              <br className="hidden sm:block" />
              1日単位・時間単位で自由にシフトを選べます。
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Controls Bar                                                */}
      {/* ============================================================ */}
      <div className="border-b border-gray-100 bg-gray-50/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <p className="text-sm font-medium text-gray-600">
            <span className="font-bold text-amber-600">{filteredShifts.length}</span> 件のシフト募集中
          </p>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="hidden items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5 sm:flex">
              <button
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                リスト
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'calendar'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                カレンダー
              </button>
            </div>
            {/* Mobile filter */}
            <button
              onClick={() => setMobileFilterOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
              絞り込み
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Main Content                                                */}
      {/* ============================================================ */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-8">
          {/* ---- Filter Sidebar (Desktop) ---- */}
          <aside className="hidden w-64 flex-shrink-0 lg:block">
            <div className="sticky top-20 rounded-2xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <h2 className="text-sm font-bold text-gray-900">絞り込み条件</h2>
              </div>
              <FilterContent />
            </div>
          </aside>

          {/* ---- Mobile Filter Overlay ---- */}
          {mobileFilterOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div
                className="absolute inset-0 bg-black/30"
                onClick={() => setMobileFilterOpen(false)}
              />
              <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900">絞り込み条件</h2>
                  <button
                    onClick={() => setMobileFilterOpen(false)}
                    className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <FilterContent />
                <button
                  onClick={() => setMobileFilterOpen(false)}
                  className="mt-6 w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
                >
                  結果を表示（{filteredShifts.length}件）
                </button>
              </div>
            </div>
          )}

          {/* ---- Content Area ---- */}
          <div className="flex-1">
            {loading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-xl border border-gray-100 bg-white p-5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-24 rounded bg-gray-200" />
                      <div className="h-4 w-20 rounded bg-gray-200" />
                    </div>
                    <div className="mt-3 h-4 w-1/2 rounded bg-gray-100" />
                    <div className="mt-2 h-4 w-1/3 rounded bg-gray-100" />
                  </div>
                ))}
              </div>
            ) : filteredShifts.length === 0 ? (
              /* ---- Empty State ---- */
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
                <CalendarDays className="h-12 w-12 text-gray-300" />
                <h3 className="mt-4 text-lg font-bold text-gray-700">
                  {hasActiveFilters
                    ? '条件に合うシフトが見つかりませんでした'
                    : '現在募集中のスポットシフトはありません'}
                </h3>
                <p className="mt-2 max-w-sm text-sm text-gray-500">
                  {hasActiveFilters
                    ? 'フィルター条件を変更してお試しください。'
                    : '新しいシフトが掲載されるまでお待ちください。'}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-4 rounded-full border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    フィルターをクリア
                  </button>
                )}
              </div>
            ) : viewMode === 'calendar' ? (
              /* ---- Calendar View ---- */
              <div>
                {/* Calendar header */}
                <div className="mb-4 flex items-center justify-between">
                  <button
                    onClick={prevMonth}
                    className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <h2 className="text-lg font-bold text-gray-900">
                    {calYear}年 {MONTH_NAMES[calMonth]}
                  </h2>
                  <button
                    onClick={nextMonth}
                    className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

                {/* Day headers */}
                <div className="mb-2 grid grid-cols-7 text-center">
                  {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
                    <div key={d} className="py-2 text-xs font-bold text-gray-400">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1 rounded-xl border border-gray-200 bg-gray-50 p-2">
                  {renderCalendar()}
                </div>

                {/* Selected date shifts */}
                {selectedDate && (
                  <div className="mt-6">
                    <h3 className="mb-3 text-base font-bold text-gray-900">
                      {formatDateJP(selectedDate)} のシフト
                    </h3>
                    {shiftsForSelectedDate.length === 0 ? (
                      <p className="text-sm text-gray-500">この日のシフトはありません。</p>
                    ) : (
                      <div className="space-y-3">
                        {shiftsForSelectedDate.map((s) => (
                          <ShiftCard key={s.id} shift={s} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* ---- List View ---- */
              <div className="space-y-6">
                {groupedByDay.map(({ date, shifts: dayShifts }) => {
                  const urgent = isUrgent(date);

                  return (
                    <div key={date}>
                      <div className="mb-3 flex items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-900">{formatDateJP(date)}</h3>
                        {urgent && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                            <AlertTriangle className="h-3 w-3" />
                            1週間以内
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{dayShifts.length}件</span>
                      </div>
                      <div className="space-y-3">
                        {dayShifts.map((s) => (
                          <ShiftCard key={s.id} shift={s} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  CTA Banner                                                  */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 py-16 sm:py-20">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-white/5" />

        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
            Rootsキャリアに登録して、
            <br />
            スポットワークにすぐ応募
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-amber-50">
            プロフィールを一度登録すれば、ワンクリックでシフトに応募できます。
            資格や経験に合ったシフトを自動でおすすめします。
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/career"
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-bold text-amber-700 shadow-lg transition-all hover:bg-gray-50 hover:shadow-xl active:scale-[0.98]"
            >
              <UserPlus className="h-5 w-5" />
              無料で登録する
            </Link>
            <Link
              href="/jobs"
              className="inline-flex items-center gap-2 rounded-full border-2 border-white/30 px-8 py-3.5 text-base font-semibold text-white transition-all hover:border-white/60 hover:bg-white/10"
            >
              正社員・パートの求人を見る
            </Link>
          </div>
          <p className="mt-5 text-sm text-amber-100">無料プラン・クレジットカード不要</p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Footer                                                      */}
      {/* ============================================================ */}
      <footer className="border-t border-gray-100 bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">
                R
              </div>
              <span className="text-lg font-bold text-gray-900">Roots</span>
            </Link>
            <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <Link href="/jobs" className="hover:text-indigo-600 transition-colors">
                求人一覧
              </Link>
              <Link href="/jobs/spot" className="hover:text-amber-600 transition-colors">
                スポットワーク
              </Link>
              <Link href="/career" className="hover:text-indigo-600 transition-colors">
                キャリアプラットフォーム
              </Link>
              <Link href="/tools" className="hover:text-indigo-600 transition-colors">
                無料ツール
              </Link>
              <Link href="/terms" className="hover:text-indigo-600 transition-colors">
                利用規約
              </Link>
              <Link href="/privacy" className="hover:text-indigo-600 transition-colors">
                プライバシーポリシー
              </Link>
              <Link href="/recruitment-disclosure" className="hover:text-indigo-600 transition-colors">
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
