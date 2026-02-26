'use client';

/**
 * Job Detail Page — 求人詳細
 *
 * Displays full details for a single published job posting, including
 * description, requirements, working conditions, and an apply card.
 * For spot-type jobs, also shows available shifts.
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Clock,
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  Star,
  Briefcase,
  ChevronRight,
  Send,
  UserPlus,
  LogIn,
  Phone,
  AlertCircle,
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
    phone: string | null;
  } | null;
};

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
};

type SimilarJob = {
  id: string;
  title: string;
  job_type: 'full_time' | 'part_time' | 'spot';
  salary_min: number | null;
  salary_max: number | null;
  salary_type: string | null;
  facilities: { name: string } | null;
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

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<JobPosting | null>(null);
  const [shifts, setShifts] = useState<SpotShift[]>([]);
  const [similarJobs, setSimilarJobs] = useState<SimilarJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Apply state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [coverMessage, setCoverMessage] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applyError, setApplyError] = useState('');

  /* ---- Check login ---- */
  useEffect(() => {
    try {
      const user = localStorage.getItem('user');
      setIsLoggedIn(!!user);
    } catch {
      setIsLoggedIn(false);
    }
  }, []);

  /* ---- Fetch job ---- */
  const fetchJob = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('job_postings')
        .select('*, facilities(id, name, address, phone)')
        .eq('id', jobId)
        .eq('status', 'published')
        .single();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setJob(data as JobPosting);

      // If spot job, fetch shifts
      if (data.job_type === 'spot') {
        const today = new Date().toISOString().split('T')[0];
        const { data: shiftData } = await supabase
          .from('spot_work_shifts')
          .select('*')
          .eq('job_posting_id', jobId)
          .eq('status', 'open')
          .gte('shift_date', today)
          .order('shift_date', { ascending: true })
          .limit(20);

        setShifts(shiftData || []);
      }

      // Fetch similar jobs
      const { data: similar } = await supabase
        .from('job_postings')
        .select('id, title, job_type, salary_min, salary_max, salary_type, facilities(name)')
        .eq('status', 'published')
        .neq('id', jobId)
        .limit(4);

      setSimilarJobs((similar as unknown as SimilarJob[]) || []);
    } catch (err) {
      console.error('Unexpected error:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (jobId) fetchJob();
  }, [jobId, fetchJob]);

  /* ---- Apply handler ---- */
  const handleApply = async () => {
    if (!job) return;
    setApplying(true);
    setApplyError('');

    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        router.push(`/career?redirect=/jobs/${jobId}`);
        return;
      }

      const user = JSON.parse(userStr);
      const { error } = await supabase.from('job_applications').insert({
        job_posting_id: job.id,
        applicant_user_id: user.id,
        cover_message: coverMessage || null,
        status: 'submitted',
      });

      if (error) {
        setApplyError('応募に失敗しました。再度お試しください。');
        console.error('Apply error:', error);
      } else {
        setApplied(true);
      }
    } catch (err) {
      setApplyError('予期しないエラーが発生しました。');
      console.error(err);
    } finally {
      setApplying(false);
    }
  };

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-4xl px-4 py-20">
          <div className="animate-pulse space-y-6">
            <div className="h-4 w-20 rounded bg-gray-200" />
            <div className="h-8 w-3/4 rounded bg-gray-200" />
            <div className="h-6 w-1/2 rounded bg-gray-100" />
            <div className="mt-8 space-y-4">
              <div className="h-4 w-full rounded bg-gray-100" />
              <div className="h-4 w-5/6 rounded bg-gray-100" />
              <div className="h-4 w-4/6 rounded bg-gray-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---- Not found ---- */
  if (notFound || !job) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center">
        <Briefcase className="h-16 w-16 text-gray-300" />
        <h1 className="mt-6 text-2xl font-bold text-gray-900">求人が見つかりません</h1>
        <p className="mt-2 text-gray-500">
          この求人は掲載終了したか、URLが間違っている可能性があります。
        </p>
        <Link
          href="/jobs"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" />
          求人一覧に戻る
        </Link>
      </div>
    );
  }

  const typeConf = JOB_TYPE_CONFIG[job.job_type] || JOB_TYPE_CONFIG.full_time;
  const salary = formatSalary(job.salary_min, job.salary_max, job.salary_type);

  /* ================================================================== */
  /*  Render                                                             */
  /* ================================================================== */

  return (
    <div className="min-h-screen bg-gray-50/50">
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
      {/*  Back Link                                                   */}
      {/* ============================================================ */}
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:px-8">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" />
          求人一覧に戻る
        </Link>
      </div>

      {/* ============================================================ */}
      {/*  Job Header                                                  */}
      {/* ============================================================ */}
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              {/* Facility */}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <span className="font-medium">{job.facilities?.name || '施設名未設定'}</span>
              </div>
              {/* Title */}
              <h1 className="mt-3 text-2xl font-extrabold text-gray-900 sm:text-3xl">
                {job.title}
              </h1>
              {/* Meta row */}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${typeConf.color}`}>
                  {typeConf.label}
                </span>
                {salary && (
                  <span className="flex items-center gap-1 text-sm font-semibold text-indigo-600">
                    <Banknote className="h-4 w-4" />
                    {salary}
                  </span>
                )}
                {(job.work_location || job.facilities?.address) && (
                  <span className="flex items-center gap-1 text-sm text-gray-500">
                    <MapPin className="h-4 w-4" />
                    {job.work_location || job.facilities?.address}
                  </span>
                )}
                {job.published_at && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDate(job.published_at)} 掲載
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Two-Column Layout                                           */}
      {/* ============================================================ */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* ---- Left Column (2/3) ---- */}
          <div className="flex-1 space-y-6 lg:max-w-[calc(66.666%-1rem)]">
            {/* 仕事内容 */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                <Briefcase className="h-5 w-5 text-indigo-500" />
                仕事内容
              </h2>
              <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
                {job.description || '詳細は施設にお問い合わせください。'}
              </div>
            </section>

            {/* 応募要件 */}
            {(job.required_qualifications?.length || job.experience_years_min) && (
              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                  <CheckCircle2 className="h-5 w-5 text-indigo-500" />
                  応募要件
                </h2>
                {job.required_qualifications && job.required_qualifications.length > 0 && (
                  <div className="mb-4">
                    <h3 className="mb-2 text-sm font-semibold text-gray-700">必要な資格</h3>
                    <div className="flex flex-wrap gap-2">
                      {job.required_qualifications.map((q) => (
                        <span
                          key={q}
                          className="rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700"
                        >
                          {qualificationLabel(q)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {job.experience_years_min != null && job.experience_years_min > 0 && (
                  <div>
                    <h3 className="mb-1 text-sm font-semibold text-gray-700">経験年数</h3>
                    <p className="text-sm text-gray-600">{job.experience_years_min}年以上</p>
                  </div>
                )}
              </section>
            )}

            {/* 歓迎条件 */}
            {job.preferred_qualifications && job.preferred_qualifications.length > 0 && (
              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                  <Star className="h-5 w-5 text-amber-500" />
                  歓迎条件
                </h2>
                <div className="flex flex-wrap gap-2">
                  {job.preferred_qualifications.map((q) => (
                    <span
                      key={q}
                      className="rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700"
                    >
                      {qualificationLabel(q)}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* 勤務条件 */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                <CalendarDays className="h-5 w-5 text-indigo-500" />
                勤務条件
              </h2>
              <div className="space-y-4">
                {job.work_hours && (
                  <div className="flex gap-4">
                    <span className="w-24 flex-shrink-0 text-sm font-semibold text-gray-500">
                      勤務時間
                    </span>
                    <span className="text-sm text-gray-700">{job.work_hours}</span>
                  </div>
                )}
                {(job.work_location || job.facilities?.address) && (
                  <div className="flex gap-4">
                    <span className="w-24 flex-shrink-0 text-sm font-semibold text-gray-500">
                      勤務地
                    </span>
                    <span className="text-sm text-gray-700">
                      {job.work_location || job.facilities?.address}
                    </span>
                  </div>
                )}
                {salary && (
                  <div className="flex gap-4">
                    <span className="w-24 flex-shrink-0 text-sm font-semibold text-gray-500">
                      給与
                    </span>
                    <span className="text-sm font-medium text-gray-700">{salary}</span>
                  </div>
                )}
                {job.employment_type && (
                  <div className="flex gap-4">
                    <span className="w-24 flex-shrink-0 text-sm font-semibold text-gray-500">
                      雇用形態
                    </span>
                    <span className="text-sm text-gray-700">{job.employment_type}</span>
                  </div>
                )}
                {job.benefits && (
                  <div className="flex gap-4">
                    <span className="w-24 flex-shrink-0 text-sm font-semibold text-gray-500">
                      福利厚生
                    </span>
                    <span className="text-sm text-gray-700 whitespace-pre-wrap">
                      {job.benefits}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* シフト一覧 (spot only) */}
            {job.job_type === 'spot' && shifts.length > 0 && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                  <CalendarDays className="h-5 w-5 text-amber-600" />
                  募集中のシフト
                </h2>
                <div className="space-y-3">
                  {shifts.map((shift) => {
                    const remaining = shift.spots_available - shift.spots_filled;
                    const isUrgent =
                      new Date(shift.shift_date).getTime() - Date.now() <
                      7 * 24 * 60 * 60 * 1000;

                    return (
                      <div
                        key={shift.id}
                        className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">
                              {shift.shift_date.replace(/-/g, '/')}
                            </span>
                            <span className="text-sm text-gray-600">
                              {shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)}
                            </span>
                            {isUrgent && (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                                急募
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                            {shift.role_needed && <span>{shift.role_needed}</span>}
                            {shift.hourly_rate && (
                              <span className="font-semibold text-amber-700">
                                時給 {shift.hourly_rate.toLocaleString()}円
                              </span>
                            )}
                            <span>残り {remaining} 枠</span>
                          </div>
                        </div>
                        <button
                          onClick={handleApply}
                          disabled={remaining <= 0}
                          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                        >
                          {remaining > 0 ? '応募する' : '募集終了'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* ---- Right Column (1/3) ---- */}
          <div className="w-full space-y-6 lg:w-80 lg:flex-shrink-0">
            {/* Apply Card */}
            <div className="sticky top-20 space-y-6">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                {salary && (
                  <div className="mb-4 text-center">
                    <p className="text-sm text-gray-500">給与</p>
                    <p className="mt-1 text-xl font-extrabold text-indigo-600">{salary}</p>
                  </div>
                )}

                {applied ? (
                  <div className="rounded-xl bg-green-50 p-4 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-green-500" />
                    <p className="mt-2 text-sm font-bold text-green-700">応募が完了しました</p>
                    <p className="mt-1 text-xs text-green-600">
                      施設からの連絡をお待ちください。
                    </p>
                  </div>
                ) : isLoggedIn ? (
                  <div>
                    <textarea
                      value={coverMessage}
                      onChange={(e) => setCoverMessage(e.target.value)}
                      placeholder="応募メッセージ（任意）&#10;自己PRや志望動機を記入してください..."
                      rows={4}
                      className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none"
                    />
                    {applyError && (
                      <div className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
                        <AlertCircle className="h-4 w-4" />
                        {applyError}
                      </div>
                    )}
                    <button
                      onClick={handleApply}
                      disabled={applying}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-indigo-300"
                    >
                      <Send className="h-4 w-4" />
                      {applying ? '送信中...' : 'この求人に応募する'}
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="mb-4 text-sm text-gray-600">
                      応募にはRootsアカウントが必要です
                    </p>
                    <Link
                      href={`/career?redirect=/jobs/${jobId}`}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-indigo-700 active:scale-[0.98]"
                    >
                      <UserPlus className="h-4 w-4" />
                      無料で登録して応募
                    </Link>
                    <Link
                      href={`/login?redirect=/jobs/${jobId}`}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <LogIn className="h-4 w-4" />
                      ログインして応募
                    </Link>
                  </div>
                )}
              </div>

              {/* Facility info card */}
              {job.facilities && (
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-3 text-sm font-bold text-gray-900">施設情報</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Building2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                      <span className="text-sm text-gray-700">{job.facilities.name}</span>
                    </div>
                    {job.facilities.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                        <span className="text-sm text-gray-700">{job.facilities.address}</span>
                      </div>
                    )}
                    {job.facilities.phone && (
                      <div className="flex items-start gap-2">
                        <Phone className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                        <span className="text-sm text-gray-700">{job.facilities.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Similar Jobs                                                */}
      {/* ============================================================ */}
      {similarJobs.length > 0 && (
        <section className="border-t border-gray-100 bg-white py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="mb-6 text-xl font-bold text-gray-900">その他の求人</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {similarJobs.map((sj) => {
                const sjType = JOB_TYPE_CONFIG[sj.job_type] || JOB_TYPE_CONFIG.full_time;
                const sjSalary = formatSalary(sj.salary_min, sj.salary_max, sj.salary_type);

                return (
                  <Link
                    key={sj.id}
                    href={`/jobs/${sj.id}`}
                    className="group rounded-xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                  >
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${sjType.color}`}>
                      {sjType.label}
                    </span>
                    <h3 className="mt-2 text-sm font-bold text-gray-900 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                      {sj.title}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">{sj.facilities?.name}</p>
                    {sjSalary && (
                      <p className="mt-2 text-xs font-semibold text-indigo-600">{sjSalary}</p>
                    )}
                    <div className="mt-3 flex items-center gap-1 text-xs font-medium text-indigo-500 opacity-0 transition-opacity group-hover:opacity-100">
                      詳細を見る
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

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
              <Link href="/terms" className="hover:text-indigo-600 transition-colors">
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
