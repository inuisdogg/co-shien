/**
 * Public Facility Homepage
 * 施設ホームページ - 公開ページ
 *
 * /facilities/[facilityCode] で施設の公開ページを表示する。
 * SEO最適化済みのサーバーコンポーネント。
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { QUALIFICATION_CODES } from '@/types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type FacilityRow = {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  facility_type?: string | null;
  certification_status?: string | null;
  average_rating?: number | null;
  review_count?: number | null;
  photos?: string[] | null;
};

type FacilitySettingsRow = {
  facility_name?: string | null;
  address?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  regular_holidays?: number[] | null;
  business_hours?: { AM: { start: string; end: string }; PM: { start: string; end: string } } | null;
  flexible_business_hours?: { default: { start: string; end: string }; dayOverrides?: Record<string, { start?: string; end?: string; isClosed?: boolean }> } | null;
  capacity?: { AM: number; PM: number } | null;
  service_categories?: {
    childDevelopmentSupport?: boolean;
    afterSchoolDayService?: boolean;
    nurseryVisitSupport?: boolean;
    homeBasedChildSupport?: boolean;
  } | null;
  homepage_enabled?: boolean | null;
  homepage_tagline?: string | null;
  homepage_description?: string | null;
  homepage_cover_image_url?: string | null;
  homepage_photos?: string[] | null;
  homepage_theme?: string | null;
};

type JobPostingRow = {
  id: string;
  title: string;
  job_type: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_type?: string | null;
  work_location?: string | null;
  published_at?: string | null;
};

type ReviewRow = {
  id: string;
  rating: number;
  title?: string | null;
  pros?: string | null;
  is_anonymous: boolean;
  created_at: string;
  users?: { name?: string | null } | null;
};

type StaffQualification = {
  qualification: string;
  count: number;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

const SALARY_TYPE_LABEL: Record<string, string> = {
  monthly: '月給',
  hourly: '時給',
  daily: '日給',
  annual: '年収',
};

const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  childDevelopmentSupport: '児童発達支援',
  afterSchoolDayService: '放課後等デイサービス',
  nurseryVisitSupport: '保育所等訪問支援',
  homeBasedChildSupport: '居宅訪問型児童発達支援',
};

const FACILITY_TYPE_LABELS: Record<string, string> = {
  child_development_support: '児童発達支援',
  after_school_day: '放課後等デイサービス',
  severe_disability: '重度障害者等包括支援',
  employment_transition: '就労移行支援',
  employment_continuation_a: '就労継続支援A型',
  employment_continuation_b: '就労継続支援B型',
};

function formatSalary(min: number | null | undefined, max: number | null | undefined, type: string | null | undefined): string {
  if (!type) return '';
  const label = SALARY_TYPE_LABEL[type] || '';
  const fmt = (n: number) =>
    type === 'hourly' || type === 'daily'
      ? `${n.toLocaleString()}円`
      : `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万円`;
  if (min && max) return `${label} ${fmt(min)} ~ ${fmt(max)}`;
  if (min) return `${label} ${fmt(min)}~`;
  if (max) return `${label} ~${fmt(max)}`;
  return '';
}

function qualificationLabel(code: string): string {
  return (QUALIFICATION_CODES as Record<string, string>)[code] || code;
}

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  let stars = '';
  for (let i = 0; i < full; i++) stars += '\u2605';
  if (half) stars += '\u2606';
  for (let i = stars.length; i < 5; i++) stars += '\u2606';
  return stars;
}

/* ------------------------------------------------------------------ */
/*  Data Fetching                                                      */
/* ------------------------------------------------------------------ */

async function getFacilityData(code: string) {
  const supabase = createServerSupabase();

  // Fetch facility
  const { data: facility, error: facilityError } = await supabase
    .from('facilities')
    .select('id, name, code, address, lat, lng, facility_type, certification_status, average_rating, review_count, photos')
    .eq('code', code)
    .single();

  if (facilityError || !facility) return null;

  // Fetch facility settings
  const { data: settings } = await supabase
    .from('facility_settings')
    .select('*')
    .eq('facility_id', facility.id)
    .single();

  // Check if homepage is enabled
  if (settings && settings.homepage_enabled === false) return null;

  // Fetch published job postings
  const { data: jobs } = await supabase
    .from('job_postings')
    .select('id, title, job_type, salary_min, salary_max, salary_type, work_location, published_at')
    .eq('facility_id', facility.id)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(6);

  // Fetch approved reviews
  const { data: reviews } = await supabase
    .from('facility_reviews')
    .select('id, rating, title, pros, is_anonymous, created_at, users(name)')
    .eq('facility_id', facility.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(5);

  // Aggregate staff qualifications
  const { data: staffRows } = await supabase
    .from('staff')
    .select('qualifications')
    .eq('facility_id', facility.id);

  const qualMap = new Map<string, number>();
  if (staffRows) {
    for (const row of staffRows) {
      const quals: string[] = Array.isArray(row.qualifications) ? row.qualifications : [];
      for (const q of quals) {
        qualMap.set(q, (qualMap.get(q) || 0) + 1);
      }
    }
  }
  const staffQualifications: StaffQualification[] = Array.from(qualMap.entries())
    .map(([qualification, count]) => ({ qualification, count }))
    .sort((a, b) => b.count - a.count);

  return {
    facility: facility as FacilityRow,
    settings: settings as FacilitySettingsRow | null,
    jobs: (jobs || []) as JobPostingRow[],
    reviews: (reviews || []) as ReviewRow[],
    staffQualifications,
  };
}

/* ------------------------------------------------------------------ */
/*  Metadata Generation                                                */
/* ------------------------------------------------------------------ */

type PageProps = {
  params: Promise<{ code: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const data = await getFacilityData(code);

  if (!data) {
    return { title: '施設が見つかりません | Roots' };
  }

  const facilityName = data.settings?.facility_name || data.facility.name;
  const tagline = data.settings?.homepage_tagline || '';
  const description = data.settings?.homepage_description
    ? data.settings.homepage_description.slice(0, 160)
    : `${facilityName}の施設情報、求人情報、アクセスなど。Rootsで詳細を確認できます。`;

  return {
    title: `${facilityName}${tagline ? ` - ${tagline}` : ''} | Roots`,
    description,
    openGraph: {
      title: `${facilityName}${tagline ? ` - ${tagline}` : ''}`,
      description,
      type: 'website',
      images: data.settings?.homepage_cover_image_url
        ? [{ url: data.settings.homepage_cover_image_url }]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${facilityName}${tagline ? ` - ${tagline}` : ''}`,
      description,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default async function FacilityHomePage({ params }: PageProps) {
  const { code } = await params;
  const data = await getFacilityData(code);

  if (!data) {
    notFound();
  }

  const { facility, settings, jobs, reviews, staffQualifications } = data;
  const facilityName = settings?.facility_name || facility.name;
  const tagline = settings?.homepage_tagline || '';
  const description = settings?.homepage_description || '';
  const coverImage = settings?.homepage_cover_image_url || '';
  const address = settings?.address || facility.address || '';
  const latitude = settings?.latitude || facility.lat;
  const longitude = settings?.longitude || facility.lng;
  const photos = settings?.homepage_photos?.length
    ? settings.homepage_photos
    : facility.photos?.length
      ? facility.photos
      : [];
  const serviceCategories = settings?.service_categories || {};
  const capacity = settings?.capacity;
  const businessHours = settings?.flexible_business_hours || null;
  const regularHolidays = settings?.regular_holidays || [];
  const averageRating = facility.average_rating || 0;
  const reviewCount = facility.review_count || 0;
  const isVerified = facility.certification_status === 'verified';

  // Active service category list
  const activeServices = Object.entries(serviceCategories)
    .filter(([, v]) => v)
    .map(([k]) => SERVICE_CATEGORY_LABELS[k] || k);

  return (
    <div className="min-h-screen bg-white">
      {/* ============================================================ */}
      {/*  Header                                                      */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500 text-white font-bold text-lg transition-transform group-hover:scale-105">
              R
            </div>
            <span className="text-xl font-bold text-gray-900">Roots</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/jobs"
              className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-teal-600 transition-colors"
            >
              求人一覧
            </Link>
            <Link
              href="/career"
              className="inline-flex items-center gap-1.5 rounded-full bg-teal-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-600 hover:shadow-md active:scale-[0.98]"
            >
              Rootsに登録
            </Link>
          </nav>
        </div>
      </header>

      {/* ============================================================ */}
      {/*  Hero Section                                                */}
      {/* ============================================================ */}
      <section
        className="relative overflow-hidden"
        style={{
          background: coverImage
            ? undefined
            : 'linear-gradient(135deg, #0d9488 0%, #14b8a6 50%, #5eead4 100%)',
        }}
      >
        {coverImage && (
          <div className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImage}
              alt={`${facilityName}のカバー画像`}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
          </div>
        )}
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
          <div className="max-w-3xl">
            {isVerified && (
              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-bold text-white">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                認証済み施設
              </span>
            )}
            <h1 className="text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl leading-tight">
              {facilityName}
            </h1>
            {tagline && (
              <p className="mt-4 text-lg text-white/90 sm:text-xl font-medium">
                {tagline}
              </p>
            )}
            {averageRating > 0 && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-yellow-300 text-lg tracking-wider">{renderStars(averageRating)}</span>
                <span className="text-white/80 text-sm font-medium">
                  {averageRating.toFixed(1)} ({reviewCount}件のレビュー)
                </span>
              </div>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#contact"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-teal-700 shadow-lg transition-all hover:bg-gray-50 hover:shadow-xl active:scale-[0.98]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                この施設に問い合わせる
              </a>
              {jobs.length > 0 && (
                <a
                  href="#jobs"
                  className="inline-flex items-center gap-2 rounded-full border-2 border-white/30 bg-white/10 backdrop-blur-sm px-6 py-3 text-sm font-bold text-white transition-all hover:bg-white/20"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  求人を見る ({jobs.length}件)
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Main Content                                                */}
      {/* ============================================================ */}
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-3">
          {/* ---- Left Column (2/3) ---- */}
          <div className="space-y-12 lg:col-span-2">

            {/* About Section */}
            {description && (
              <section>
                <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 mb-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
                    </svg>
                  </span>
                  施設について
                </h2>
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{description}</p>
                  {activeServices.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <h3 className="text-sm font-bold text-gray-600 mb-3">提供サービス</h3>
                      <div className="flex flex-wrap gap-2">
                        {activeServices.map((svc) => (
                          <span
                            key={svc}
                            className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700"
                          >
                            {svc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {capacity && (capacity.AM > 0 || capacity.PM > 0) && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <h3 className="text-sm font-bold text-gray-600 mb-2">定員</h3>
                      <div className="flex gap-6 text-sm text-gray-700">
                        {capacity.AM > 0 && <span>午前: <strong>{capacity.AM}名</strong></span>}
                        {capacity.PM > 0 && <span>午後: <strong>{capacity.PM}名</strong></span>}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Photo Gallery */}
            {photos.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 mb-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                    </svg>
                  </span>
                  施設の写真
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {photos.slice(0, 6).map((photoUrl, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-[4/3] overflow-hidden rounded-xl border border-gray-100 bg-gray-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoUrl}
                        alt={`${facilityName}の写真 ${idx + 1}`}
                        className="h-full w-full object-cover transition-transform hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Service Info / Hours */}
            <section>
              <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 mb-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                営業情報
              </h2>
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                {businessHours && (
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-gray-600 mb-3">営業時間</h3>
                    <div className="space-y-2">
                      {DAY_LABELS.map((label, dayIdx) => {
                        const override = businessHours.dayOverrides?.[String(dayIdx)];
                        const isClosed = regularHolidays.includes(dayIdx) || override?.isClosed;
                        const start = override?.start || businessHours.default.start;
                        const end = override?.end || businessHours.default.end;
                        const isWeekend = dayIdx === 0 || dayIdx === 6;

                        return (
                          <div
                            key={dayIdx}
                            className={`flex items-center justify-between rounded-lg px-4 py-2.5 ${
                              isClosed ? 'bg-gray-50 text-gray-400' : 'bg-white'
                            }`}
                          >
                            <span className={`text-sm font-bold ${isWeekend ? 'text-red-500' : 'text-gray-700'} ${isClosed ? 'text-gray-400' : ''}`}>
                              {label}曜日
                            </span>
                            <span className={`text-sm ${isClosed ? 'text-gray-400' : 'text-gray-700 font-medium'}`}>
                              {isClosed ? '休業' : `${start} - ${end}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {regularHolidays.length > 0 && !businessHours && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-600 mb-3">定休日</h3>
                    <div className="flex flex-wrap gap-2">
                      {regularHolidays.sort().map((day) => (
                        <span
                          key={day}
                          className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600"
                        >
                          {DAY_LABELS[day]}曜日
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Staff Qualifications */}
            {staffQualifications.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 mb-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                  </span>
                  スタッフ体制
                </h2>
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {staffQualifications.map(({ qualification, count }) => (
                      <div
                        key={qualification}
                        className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3"
                      >
                        <span className="text-sm font-medium text-gray-700">
                          {qualificationLabel(qualification)}
                        </span>
                        <span className="text-sm font-bold text-teal-600">
                          {count}名
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Job Openings */}
            {jobs.length > 0 && (
              <section id="jobs">
                <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 mb-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </span>
                  求人情報
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {jobs.map((job) => {
                    const typeLabels: Record<string, { label: string; color: string }> = {
                      full_time: { label: '正社員', color: 'bg-indigo-100 text-indigo-700' },
                      part_time: { label: 'パート', color: 'bg-emerald-100 text-emerald-700' },
                      spot: { label: 'スポット', color: 'bg-amber-100 text-amber-700' },
                    };
                    const typeConf = typeLabels[job.job_type] || typeLabels.full_time;
                    const salary = formatSalary(job.salary_min, job.salary_max, job.salary_type);

                    return (
                      <Link
                        key={job.id}
                        href={`/jobs/${job.id}`}
                        className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md"
                      >
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${typeConf.color}`}>
                          {typeConf.label}
                        </span>
                        <h3 className="mt-2 text-sm font-bold text-gray-900 line-clamp-2 group-hover:text-teal-600 transition-colors">
                          {job.title}
                        </h3>
                        {salary && (
                          <p className="mt-2 text-xs font-semibold text-teal-600">{salary}</p>
                        )}
                        {job.work_location && (
                          <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                            </svg>
                            {job.work_location}
                          </p>
                        )}
                        <div className="mt-3 flex items-center gap-1 text-xs font-medium text-teal-500 opacity-0 transition-opacity group-hover:opacity-100">
                          詳細を見る
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Reviews */}
            {reviews.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 mb-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                  </span>
                  レビュー
                  {averageRating > 0 && (
                    <span className="ml-2 text-sm font-medium text-gray-500">
                      平均 {averageRating.toFixed(1)} / 5.0
                    </span>
                  )}
                </h2>
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <article
                      key={review.id}
                      className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50 text-teal-600 font-bold text-sm">
                            {review.is_anonymous
                              ? '?'
                              : ((review.users as Record<string, string> | null)?.name || '?').charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-800">
                              {review.is_anonymous ? '匿名' : (review.users as Record<string, string> | null)?.name || '匿名'}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(review.created_at).toLocaleDateString('ja-JP')}
                            </p>
                          </div>
                        </div>
                        <span className="text-yellow-500 text-sm tracking-wider">
                          {renderStars(review.rating)}
                        </span>
                      </div>
                      {review.title && (
                        <h3 className="text-sm font-bold text-gray-800 mb-1">{review.title}</h3>
                      )}
                      {review.pros && (
                        <p className="text-sm text-gray-600 leading-relaxed">{review.pros}</p>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ---- Right Column (1/3) ---- */}
          <div className="space-y-6 lg:col-span-1">
            <div className="sticky top-20 space-y-6">

              {/* Contact Card */}
              <div id="contact" className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-4">お問い合わせ</h3>
                <p className="text-sm text-gray-500 mb-4">
                  見学・利用相談など、お気軽にお問い合わせください。
                </p>
                <a
                  href={`mailto:contact@roots-app.jp?subject=${encodeURIComponent(`${facilityName}への問い合わせ`)}`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-teal-600 active:scale-[0.98]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  この施設に問い合わせる
                </a>
              </div>

              {/* Facility Info */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-4">施設情報</h3>
                <div className="space-y-4">
                  {facility.facility_type && (
                    <div className="flex items-start gap-3">
                      <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-500">施設タイプ</p>
                        <p className="text-sm font-medium text-gray-700">
                          {FACILITY_TYPE_LABELS[facility.facility_type] || facility.facility_type}
                        </p>
                      </div>
                    </div>
                  )}
                  {address && (
                    <div className="flex items-start gap-3">
                      <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-500">所在地</p>
                        <p className="text-sm font-medium text-gray-700">{address}</p>
                      </div>
                    </div>
                  )}
                  {isVerified && (
                    <div className="flex items-start gap-3">
                      <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-500">認証</p>
                        <p className="text-sm font-medium text-teal-600">認証済み施設</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Map Section */}
              {address && (
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">アクセス</h3>
                  {latitude && longitude ? (
                    <div className="overflow-hidden rounded-xl">
                      <iframe
                        title={`${facilityName}の地図`}
                        src={`https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`}
                        width="100%"
                        height="250"
                        style={{ border: 0 }}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        className="rounded-xl"
                      />
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl">
                      <iframe
                        title={`${facilityName}の地図`}
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed`}
                        width="100%"
                        height="250"
                        style={{ border: 0 }}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        className="rounded-xl"
                      />
                    </div>
                  )}
                  <p className="mt-3 text-xs text-gray-500">{address}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ============================================================ */}
      {/*  Footer                                                      */}
      {/* ============================================================ */}
      <footer className="border-t border-gray-100 bg-gray-50 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500 text-white font-bold text-sm">
                R
              </div>
              <span className="text-lg font-bold text-gray-900">Roots</span>
            </Link>
            <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <Link href="/jobs" className="hover:text-teal-600 transition-colors">
                求人一覧
              </Link>
              <Link href="/career" className="hover:text-teal-600 transition-colors">
                キャリアプラットフォーム
              </Link>
              <Link href="/terms" className="hover:text-teal-600 transition-colors">
                利用規約
              </Link>
              <Link href="/privacy" className="hover:text-teal-600 transition-colors">
                プライバシーポリシー
              </Link>
            </nav>
            <div className="text-center sm:text-right">
              <p className="text-xs text-gray-400">
                Powered by <span className="font-bold text-teal-500">Roots</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                &copy; {new Date().getFullYear()} Roots Inc.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
