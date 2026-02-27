'use client';

/**
 * JobsPageClient — 求人一覧クライアントコンポーネント
 *
 * Renders hero, filters, job card grid, and CTA banner.
 * All data is fetched client-side from Supabase.
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  MapPin,
  Briefcase,
  Filter,
  X,
  ChevronRight,
  ArrowRight,
  Clock,
  Building2,
  Banknote,
  CalendarDays,
  SlidersHorizontal,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { QUALIFICATION_CODES } from '@/types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type JobPosting = {
  id: string;
  facility_id: string;
  job_type: 'full_time' | 'part_time' | 'spot';
  title: string;
  description: string;
  required_qualifications: string[] | null;
  preferred_qualifications: string[] | null;
  experience_years_min: number | null;
  employment_type: string | null;
  work_location: string | null;
  work_hours: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_type: 'monthly' | 'hourly' | 'daily' | 'annual' | null;
  benefits: string | null;
  annual_salary_estimate: number | null;
  spots_needed: number | null;
  status: string;
  published_at: string | null;
  closes_at: string | null;
  facilities: {
    id: string;
    name: string;
    address: string | null;
  } | null;
  nearest_shift?: {
    shift_date: string;
    start_time: string;
    end_time: string;
    hourly_rate: number | null;
  } | null;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const JOB_TYPE_CONFIG = {
  full_time: { label: '正社員', color: 'bg-indigo-100 text-indigo-700' },
  part_time: { label: 'パート・アルバイト', color: 'bg-emerald-100 text-emerald-700' },
  spot: { label: 'スポット', color: 'bg-amber-100 text-amber-700' },
} as const;

const SALARY_TYPE_LABEL: Record<string, string> = {
  monthly: '月給',
  hourly: '時給',
  daily: '日給',
  annual: '年収',
};

function formatSalary(min: number | null, max: number | null, type: string | null): string {
  if (!type) return '';
  const label = SALARY_TYPE_LABEL[type] || '';
  const fmt = (n: number) =>
    type === 'hourly' || type === 'daily'
      ? `${n.toLocaleString()}円`
      : `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万円`;
  if (min && max) return `${label} ${fmt(min)} 〜 ${fmt(max)}`;
  if (min) return `${label} ${fmt(min)}〜`;
  if (max) return `${label} 〜${fmt(max)}`;
  return '';
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function qualificationLabel(code: string): string {
  return (QUALIFICATION_CODES as Record<string, string>)[code] || code;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function JobsPageClient() {
  const router = useRouter();

  // Data
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [keyword, setKeyword] = useState('');
  const [area, setArea] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedQualifications, setSelectedQualifications] = useState<Set<string>>(new Set());
  const [salaryMin, setSalaryMin] = useState('');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  /* ---- Fetch jobs ---- */
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('job_postings')
        .select('*, facilities(id, name, address)')
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch jobs:', error);
        setJobs([]);
        setLoading(false);
        return;
      }

      const postings: JobPosting[] = data || [];

      // For spot jobs, fetch the nearest open shift
      const spotIds = postings
        .filter((j) => j.job_type === 'spot')
        .map((j) => j.id);

      if (spotIds.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const { data: shifts } = await supabase
          .from('spot_work_shifts')
          .select('job_posting_id, shift_date, start_time, end_time, hourly_rate')
          .in('job_posting_id', spotIds)
          .eq('status', 'open')
          .gte('shift_date', today)
          .order('shift_date', { ascending: true });

        if (shifts) {
          const shiftMap = new Map<string, (typeof shifts)[number]>();
          for (const s of shifts) {
            if (!shiftMap.has(s.job_posting_id)) {
              shiftMap.set(s.job_posting_id, s);
            }
          }
          for (const job of postings) {
            if (job.job_type === 'spot') {
              const nearest = shiftMap.get(job.id);
              job.nearest_shift = nearest || null;
            }
          }
        }
      }

      setJobs(postings);
    } catch (err) {
      console.error('Unexpected error:', err);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  /* ---- Filtered jobs ---- */
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // Keyword
      if (keyword) {
        const kw = keyword.toLowerCase();
        const match =
          job.title.toLowerCase().includes(kw) ||
          (job.description || '').toLowerCase().includes(kw) ||
          (job.facilities?.name || '').toLowerCase().includes(kw);
        if (!match) return false;
      }
      // Area
      if (area) {
        const a = area.toLowerCase();
        const match =
          (job.work_location || '').toLowerCase().includes(a) ||
          (job.facilities?.address || '').toLowerCase().includes(a);
        if (!match) return false;
      }
      // Job type
      if (selectedTypes.size > 0 && !selectedTypes.has(job.job_type)) return false;
      // Qualifications
      if (selectedQualifications.size > 0) {
        const reqQuals = job.required_qualifications || [];
        const hasMatch = reqQuals.some((q) => selectedQualifications.has(q));
        if (!hasMatch) return false;
      }
      // Salary min
      if (salaryMin) {
        const min = parseInt(salaryMin, 10);
        if (!isNaN(min) && (job.salary_max || 0) < min && (job.salary_min || 0) < min) return false;
      }
      return true;
    });
  }, [jobs, keyword, area, selectedTypes, selectedQualifications, salaryMin]);

  const totalPublished = jobs.length;

  /* ---- Toggle helpers ---- */
  const toggleType = (t: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const toggleQual = (q: string) => {
    setSelectedQualifications((prev) => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q);
      else next.add(q);
      return next;
    });
  };

  const clearFilters = () => {
    setKeyword('');
    setArea('');
    setSelectedTypes(new Set());
    setSelectedQualifications(new Set());
    setSalaryMin('');
  };

  const hasActiveFilters =
    keyword || area || selectedTypes.size > 0 || selectedQualifications.size > 0 || salaryMin;

  /* ---- Filter Sidebar Content ---- */
  const FilterContent = () => (
    <div className="space-y-6">
      {/* Job type */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-gray-900">雇用形態</h3>
        <div className="space-y-2">
          {Object.entries(JOB_TYPE_CONFIG).map(([key, { label }]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedTypes.has(key)}
                onChange={() => toggleType(key)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Qualifications */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-gray-900">資格</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {Object.entries(QUALIFICATION_CODES).map(([code, name]) => (
            <label key={code} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedQualifications.has(code)}
                onChange={() => toggleQual(code)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">{name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Salary */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-gray-900">給与（月給下限）</h3>
        <div className="relative">
          <Banknote className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="number"
            value={salaryMin}
            onChange={(e) => setSalaryMin(e.target.value)}
            placeholder="例: 200000"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <p className="mt-1 text-xs text-gray-400">円単位で入力</p>
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
              href="/jobs/spot"
              className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-amber-600 transition-colors"
            >
              <CalendarDays className="h-4 w-4" />
              スポットワーク
            </Link>
            <Link
              href="/tools"
              className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
            >
              ツール
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
      <section className="relative overflow-hidden bg-gradient-to-br from-[#818CF8] to-[#6366F1]">
        <div className="absolute inset-0 -z-0">
          <div className="absolute -top-32 right-0 h-[500px] w-[500px] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-[400px] w-[400px] rounded-full bg-white/5 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-16 sm:px-6 sm:pb-16 sm:pt-20 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              保育・福祉の求人情報
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-indigo-100">
              保育士・児童指導員・社会福祉士の正社員・パート・スポットワーク。
              <br className="hidden sm:block" />
              あなたに合った働き方を見つけよう。
            </p>
          </div>

          {/* Search bar */}
          <div className="mx-auto mt-8 max-w-3xl">
            <div className="flex flex-col gap-3 rounded-2xl bg-white/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:gap-2 sm:rounded-full sm:p-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="キーワード（職種・施設名）"
                  className="w-full rounded-full border-0 bg-transparent py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                />
              </div>
              <div className="hidden sm:block h-8 w-px bg-gray-200" />
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="エリア（市区町村）"
                  className="w-full rounded-full border-0 bg-transparent py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                />
              </div>
              <button
                onClick={() => {/* filters are reactive */}}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-700 active:scale-[0.98]"
              >
                <Search className="h-4 w-4" />
                検索
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Stats Bar                                                   */}
      {/* ============================================================ */}
      <div className="border-b border-gray-100 bg-gray-50/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <p className="text-sm font-medium text-gray-600">
            現在{' '}
            <span className="font-bold text-indigo-600">{totalPublished}</span>{' '}
            件の求人掲載中
            {hasActiveFilters && (
              <span className="ml-2 text-gray-400">
                （{filteredJobs.length} 件表示中）
              </span>
            )}
          </p>
          <button
            onClick={() => setMobileFilterOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            絞り込み
          </button>
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
                  className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                >
                  結果を表示（{filteredJobs.length}件）
                </button>
              </div>
            </div>
          )}

          {/* ---- Job Cards Grid ---- */}
          <div className="flex-1">
            {loading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-2xl border border-gray-100 bg-white p-6"
                  >
                    <div className="h-4 w-24 rounded bg-gray-200" />
                    <div className="mt-3 h-6 w-3/4 rounded bg-gray-200" />
                    <div className="mt-4 h-4 w-1/2 rounded bg-gray-100" />
                    <div className="mt-2 h-4 w-1/3 rounded bg-gray-100" />
                  </div>
                ))}
              </div>
            ) : filteredJobs.length === 0 ? (
              /* ---- Empty State ---- */
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
                <Briefcase className="h-12 w-12 text-gray-300" />
                <h3 className="mt-4 text-lg font-bold text-gray-700">
                  {hasActiveFilters
                    ? '条件に合う求人が見つかりませんでした'
                    : '現在公開中の求人はありません'}
                </h3>
                <p className="mt-2 max-w-sm text-sm text-gray-500">
                  {hasActiveFilters
                    ? 'フィルター条件を変更してお試しください。'
                    : '新しい求人が掲載されるまでお待ちください。Rootsキャリアに登録すると、新着求人の通知を受け取れます。'}
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
            ) : (
              /* ---- Job Cards ---- */
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredJobs.map((job) => {
                  const typeConf = JOB_TYPE_CONFIG[job.job_type] || JOB_TYPE_CONFIG.full_time;
                  const salary = formatSalary(job.salary_min, job.salary_max, job.salary_type);

                  return (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg"
                    >
                      {/* Top row: facility name + badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Building2 className="h-4 w-4 flex-shrink-0" />
                          <span className="line-clamp-1">
                            {job.facilities?.name || '施設名未設定'}
                          </span>
                        </div>
                        <span
                          className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${typeConf.color}`}
                        >
                          {typeConf.label}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="mt-2 text-base font-bold text-gray-900 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                        {job.title}
                      </h3>

                      {/* Salary */}
                      {salary && (
                        <div className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-indigo-600">
                          <Banknote className="h-4 w-4" />
                          {salary}
                        </div>
                      )}

                      {/* Location */}
                      {(job.work_location || job.facilities?.address) && (
                        <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-500">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span className="line-clamp-1">
                            {job.work_location || job.facilities?.address}
                          </span>
                        </div>
                      )}

                      {/* Required qualifications */}
                      {job.required_qualifications && job.required_qualifications.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {job.required_qualifications.slice(0, 3).map((q) => (
                            <span
                              key={q}
                              className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                            >
                              {qualificationLabel(q)}
                            </span>
                          ))}
                          {job.required_qualifications.length > 3 && (
                            <span className="text-xs text-gray-400">
                              +{job.required_qualifications.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Spot work: nearest shift */}
                      {job.job_type === 'spot' && job.nearest_shift && (
                        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                          <CalendarDays className="h-3.5 w-3.5" />
                          直近シフト: {job.nearest_shift.shift_date.replace(/-/g, '/')}{' '}
                          {job.nearest_shift.start_time?.slice(0, 5)}-
                          {job.nearest_shift.end_time?.slice(0, 5)}
                        </div>
                      )}

                      {/* Footer: posted date + arrow */}
                      <div className="mt-auto flex items-center justify-between pt-4">
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(job.published_at)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-400" />
                      </div>
                    </Link>
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
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 py-16 sm:py-20">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-white/5" />

        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
            Rootsキャリアに登録して、
            <br />
            もっと多くの求人にアクセス
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-indigo-100">
            プロフィールを登録すると、非公開求人の紹介やスカウト機能が使えます。
            あなたの経歴に合った求人を自動でマッチング。
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/career"
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-bold text-indigo-700 shadow-lg transition-all hover:bg-gray-50 hover:shadow-xl active:scale-[0.98]"
            >
              無料で登録する
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/jobs/spot"
              className="inline-flex items-center gap-2 rounded-full border-2 border-white/30 px-8 py-3.5 text-base font-semibold text-white transition-all hover:border-white/60 hover:bg-white/10"
            >
              スポットワークを見る
            </Link>
          </div>
          <p className="mt-5 text-sm text-indigo-200">無料プラン・クレジットカード不要</p>
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
              <Link href="/jobs/spot" className="hover:text-indigo-600 transition-colors">
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
