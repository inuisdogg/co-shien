'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import {
  JobPosting,
  SpotWorkShift,
  QUALIFICATION_CODES,
  QualificationCode,
  ApplicationStatus,
} from '@/types';
import { calculateMatchScore } from '@/lib/jobMatcher';
import { geocodeAddress, haversineDistance, PREFECTURE_LIST, FACILITY_TYPES } from '@/lib/geocoding';
import {
  Heart,
  Search,
  MapPin,
  Clock,
  ChevronRight,
  Building2,
  Calendar,
  MessageCircle,
  Send,
  X,
  Star,
  Briefcase,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  ExternalLink,
  Video,
  Banknote,
  ArrowUpDown,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import FacilityReviewSection from '@/components/personal/FacilityReviewSection';

// ================================================================
// Props
// ================================================================

interface JobBrowsingTabProps {
  userId?: string;
}

// ================================================================
// Types (internal)
// ================================================================

type TabKey = 'recommended' | 'full_time' | 'part_time' | 'spot' | 'favorites' | 'applications';

type SortKey = 'recommended' | 'salary_high' | 'salary_low' | 'newest' | 'distance';

type MappedJob = JobPosting & {
  facilityName?: string;
  averageRating?: number;
  reviewCount?: number;
  certificationStatus?: string;
  facilityPhotos?: string[];
};

type MatchInfo = {
  score: number;
  reasons: string[];
};

type ApplicationRow = {
  id: string;
  jobPostingId: string;
  spotShiftId?: string;
  applicantUserId: string;
  status: ApplicationStatus;
  coverMessage?: string;
  interviewDate?: string;
  interviewFormat?: 'in_person' | 'online' | 'phone';
  interviewLocation?: string;
  interviewMeetingUrl?: string;
  createdAt: string;
  updatedAt: string;
  jobTitle?: string;
  jobType?: string;
  facilityName?: string;
  facilityId?: string;
};

type RecruitmentMessage = {
  id: string;
  jobApplicationId: string;
  senderUserId: string;
  senderType: 'applicant' | 'facility';
  content: string;
  readAt?: string;
  createdAt: string;
};

// ================================================================
// Sub-tab config
// ================================================================

const TABS: { key: TabKey; label: string }[] = [
  { key: 'recommended', label: 'おすすめ' },
  { key: 'full_time', label: '正社員' },
  { key: 'part_time', label: 'パート' },
  { key: 'spot', label: 'スポット' },
  { key: 'favorites', label: 'お気に入り' },
  { key: 'applications', label: '応募状況' },
];

// ================================================================
// Helpers
// ================================================================

const JOB_TYPE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  full_time: { label: '正社員', bg: 'bg-indigo-100', text: 'text-indigo-700' },
  part_time: { label: 'パート', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  spot: { label: 'スポット', bg: 'bg-amber-100', text: 'text-amber-700' },
};

const JOB_TYPE_GRADIENT: Record<string, string> = {
  full_time: 'from-indigo-400 to-purple-500',
  part_time: 'from-emerald-400 to-teal-500',
  spot: 'from-amber-400 to-orange-500',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  applied: { label: '応募済み', className: 'bg-blue-100 text-blue-700' },
  screening: { label: '選考中', className: 'bg-yellow-100 text-yellow-700' },
  interview_scheduled: { label: '面接予定', className: 'bg-purple-100 text-purple-700' },
  interviewed: { label: '面接完了', className: 'bg-indigo-100 text-indigo-700' },
  offer_sent: { label: '内定', className: 'bg-green-100 text-green-700' },
  offer_accepted: { label: '内定承諾', className: 'bg-green-100 text-green-700' },
  hired: { label: '採用', className: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: '不採用', className: 'bg-red-100 text-red-700' },
  withdrawn: { label: '辞退', className: 'bg-gray-100 text-gray-600' },
};

const STATUS_TIMELINE_ORDER: ApplicationStatus[] = [
  'applied',
  'screening',
  'interview_scheduled',
  'offer_sent',
  'hired',
];

const STATUS_TIMELINE_LABELS: Record<string, string> = {
  applied: '応募',
  screening: '選考中',
  interview_scheduled: '面接',
  offer_sent: '内定',
  hired: '採用',
};

function formatSalary(min?: number, max?: number, type?: string): string {
  const typeLabel =
    ({ monthly: '月給', hourly: '時給', daily: '日給', annual: '年収' } as Record<string, string>)[
      type || ''
    ] || '';
  if (!min && !max) return '応相談';
  const fmt = (n: number) =>
    n >= 10000 ? `${Math.round(n / 10000)}万` : `${n.toLocaleString()}`;
  if (min && max && min !== max) return `${typeLabel} ${fmt(min)}〜${fmt(max)}円`;
  return `${typeLabel} ${fmt(min || max || 0)}円`;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function qualificationLabel(code: string): string {
  return (QUALIFICATION_CODES as Record<string, string>)[code] || code;
}

/** 給与を年収相当に正規化（ソート用） */
function normalizeSalary(job: MappedJob): number {
  const base = job.salaryMax || job.salaryMin || 0;
  switch (job.salaryType) {
    case 'annual': return base;
    case 'monthly': return base * 12;
    case 'daily': return base * 240;
    case 'hourly': return base * 2000;
    default: return base;
  }
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recommended', label: 'おすすめ順' },
  { key: 'salary_high', label: '給与が高い順' },
  { key: 'salary_low', label: '給与が低い順' },
  { key: 'newest', label: '新着順' },
  { key: 'distance', label: '距離が近い順' },
];

const DAYS_OF_WEEK = ['月', '火', '水', '木', '金', '土', '日'];

/** Top 8 most common qualifications for filter chips */
const FILTER_QUALIFICATION_OPTIONS: { code: string; label: string }[] = [
  { code: 'nursery_teacher', label: '保育士' },
  { code: 'child_instructor', label: '児童指導員' },
  { code: 'pt', label: 'PT' },
  { code: 'ot', label: 'OT' },
  { code: 'st', label: 'ST' },
  { code: 'social_worker', label: '社会福祉士' },
  { code: 'nurse', label: '看護師' },
  { code: 'child_dev_manager', label: '児童発達支援管理責任者' },
];

function mapJob(row: Record<string, unknown>): MappedJob {
  const facility = row.facilities as Record<string, unknown> | null;
  return {
    id: row.id as string,
    facilityId: row.facility_id as string,
    jobType: row.job_type as JobPosting['jobType'],
    title: row.title as string,
    description: (row.description as string) || '',
    requiredQualifications: (row.required_qualifications as string[]) || [],
    preferredQualifications: (row.preferred_qualifications as string[]) || [],
    experienceYearsMin: Number(row.experience_years_min) || 0,
    employmentType: (row.employment_type as string) || undefined,
    workLocation: (row.work_location as string) || undefined,
    workHours: (row.work_hours as string) || undefined,
    salaryMin: row.salary_min != null ? Number(row.salary_min) : undefined,
    salaryMax: row.salary_max != null ? Number(row.salary_max) : undefined,
    salaryType: (row.salary_type as JobPosting['salaryType']) || undefined,
    benefits: (row.benefits as string) || undefined,
    annualSalaryEstimate:
      row.annual_salary_estimate != null ? Number(row.annual_salary_estimate) : undefined,
    spotsNeeded: Number(row.spots_needed) || 1,
    status: row.status as JobPosting['status'],
    publishedAt: (row.published_at as string) || undefined,
    closesAt: (row.closes_at as string) || undefined,
    imageUrl: (row.image_url as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    facilityName: facility?.name as string | undefined,
    averageRating: facility?.average_rating != null ? Number(facility.average_rating) : undefined,
    reviewCount: facility?.review_count != null ? Number(facility.review_count) : undefined,
    certificationStatus: (facility?.certification_status as string) || undefined,
    facilityPhotos: Array.isArray(facility?.photos) ? (facility.photos as string[]) : undefined,
  };
}

function mapApplication(row: Record<string, unknown>): ApplicationRow {
  const jobPosting = row.job_postings as Record<string, unknown> | null;
  const facility = jobPosting
    ? (jobPosting.facilities as Record<string, unknown> | null)
    : null;
  return {
    id: row.id as string,
    jobPostingId: row.job_posting_id as string,
    spotShiftId: (row.spot_shift_id as string) || undefined,
    applicantUserId: row.applicant_user_id as string,
    status: row.status as ApplicationStatus,
    coverMessage: (row.cover_message as string) || undefined,
    interviewDate: (row.interview_date as string) || undefined,
    interviewFormat: (row.interview_format as ApplicationRow['interviewFormat']) || undefined,
    interviewLocation: (row.interview_location as string) || undefined,
    interviewMeetingUrl: (row.interview_meeting_url as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    jobTitle: jobPosting ? (jobPosting.title as string) : undefined,
    jobType: jobPosting ? (jobPosting.job_type as string) : undefined,
    facilityName: facility ? (facility.name as string) : undefined,
    facilityId: jobPosting ? (jobPosting.facility_id as string) : undefined,
  };
}

function mapMessage(row: Record<string, unknown>): RecruitmentMessage {
  return {
    id: row.id as string,
    jobApplicationId: row.job_application_id as string,
    senderUserId: row.sender_user_id as string,
    senderType: row.sender_type as RecruitmentMessage['senderType'],
    content: row.content as string,
    readAt: (row.read_at as string) || undefined,
    createdAt: row.created_at as string,
  };
}

function mapSpotShift(row: Record<string, unknown>): SpotWorkShift {
  return {
    id: row.id as string,
    jobPostingId: row.job_posting_id as string,
    shiftDate: row.shift_date as string,
    startTime: row.start_time as string,
    endTime: row.end_time as string,
    roleNeeded: (row.role_needed as string) || undefined,
    hourlyRate: row.hourly_rate != null ? Number(row.hourly_rate) : undefined,
    spotsAvailable: Number(row.spots_available) || 1,
    spotsFilled: Number(row.spots_filled) || 0,
    status: row.status as SpotWorkShift['status'],
    notes: (row.notes as string) || undefined,
    createdAt: row.created_at as string,
  };
}

// ================================================================
// Main Component
// ================================================================

export default function JobBrowsingTab({ userId }: JobBrowsingTabProps) {
  // ---- State: tabs & search ----
  const [activeTab, setActiveTab] = useState<TabKey>('recommended');
  const [keyword, setKeyword] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('recommended');
  const tabScrollRef = useRef<HTMLDivElement>(null);

  // ---- State: job data ----
  const [allJobs, setAllJobs] = useState<MappedJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  // ---- State: favorites ----
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [togglingFavorite, setTogglingFavorite] = useState<string | null>(null);

  // ---- State: applications ----
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);

  // ---- State: recommended ----
  const [matchScores, setMatchScores] = useState<Map<string, MatchInfo>>(new Map());
  const [userQualifications, setUserQualifications] = useState<string[]>([]);
  const [userExperienceYears, setUserExperienceYears] = useState<number>(0);
  const [loadingRecommended, setLoadingRecommended] = useState(false);

  // ---- State: spot shifts ----
  const [spotShifts, setSpotShifts] = useState<SpotWorkShift[]>([]);

  // ---- State: modals ----
  const [selectedJob, setSelectedJob] = useState<MappedJob | null>(null);
  const [selectedJobShifts, setSelectedJobShifts] = useState<SpotWorkShift[]>([]);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);

  // ---- State: application detail ----
  const [selectedApplication, setSelectedApplication] = useState<ApplicationRow | null>(null);
  const [appMessages, setAppMessages] = useState<RecruitmentMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ---- State: inquiry modal ----
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [sendingInquiry, setSendingInquiry] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState(false);

  // ---- State: apply form work preferences ----
  const [prefDays, setPrefDays] = useState<string[]>([]);
  const [prefHoursPerWeek, setPrefHoursPerWeek] = useState('');
  const [prefStartTime, setPrefStartTime] = useState('');
  const [prefEndTime, setPrefEndTime] = useState('');
  const [prefNotes, setPrefNotes] = useState('');

  // ---- State: unread message badge ----
  const [unreadTotal, setUnreadTotal] = useState(0);

  // ---- State: quick apply ----
  const [quickApplying, setQuickApplying] = useState(false);

  // ---- State: filters ----
  const [showFilters, setShowFilters] = useState(false);
  const [filterPrefecture, setFilterPrefecture] = useState('');
  const [filterSalaryMin, setFilterSalaryMin] = useState('');
  const [filterSalaryMax, setFilterSalaryMax] = useState('');
  const [filterQualifications, setFilterQualifications] = useState<string[]>([]);
  const [filterFacilityType, setFilterFacilityType] = useState('');

  // ---- State: geolocation for distance sort ----
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // ================================================================
  // Data fetching
  // ================================================================

  // Fetch all published jobs
  const fetchJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const { data, error } = await supabase
        .from('job_postings')
        .select('*, facilities(id, name, average_rating, review_count, certification_status, photos)')
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch jobs:', error);
        setAllJobs([]);
        return;
      }
      setAllJobs((data || []).map((r) => mapJob(r as Record<string, unknown>)));
    } catch (err) {
      console.error('Unexpected error fetching jobs:', err);
      setAllJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  // Fetch user favorites
  const fetchFavorites = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('job_favorites')
        .select('job_posting_id')
        .eq('user_id', userId);

      if (error) {
        console.error('Failed to fetch favorites:', error);
        return;
      }
      setFavoriteIds(
        new Set((data || []).map((r: Record<string, unknown>) => r.job_posting_id as string))
      );
    } catch (err) {
      console.error('Unexpected error fetching favorites:', err);
    }
  }, [userId]);

  // Fetch user applications
  const fetchApplications = useCallback(async () => {
    if (!userId) return;
    setLoadingApplications(true);
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select(
          '*, job_postings(id, title, job_type, facility_id, facilities(name))'
        )
        .eq('applicant_user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch applications:', error);
        setApplications([]);
        return;
      }
      setApplications(
        (data || []).map((r) => mapApplication(r as Record<string, unknown>))
      );
    } catch (err) {
      console.error('Unexpected error fetching applications:', err);
      setApplications([]);
    } finally {
      setLoadingApplications(false);
    }
  }, [userId]);

  // Fetch user qualifications & experience for recommendations
  const fetchUserProfile = useCallback(async () => {
    if (!userId) return;
    setLoadingRecommended(true);
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('qualifications')
        .eq('id', userId)
        .single();

      const { data: staffData } = await supabase
        .from('staff')
        .select('years_of_experience')
        .eq('user_id', userId)
        .order('years_of_experience', { ascending: false })
        .limit(1);

      const quals: string[] = userData
        ? Array.isArray(userData.qualifications)
          ? userData.qualifications
          : typeof userData.qualifications === 'string' && userData.qualifications
            ? (userData.qualifications as string).split(',').map((q: string) => q.trim())
            : []
        : [];

      const expYears =
        staffData && staffData.length > 0
          ? Number(staffData[0].years_of_experience) || 0
          : 0;

      setUserQualifications(quals);
      setUserExperienceYears(expYears);
    } catch (err) {
      console.error('Error fetching user profile:', err);
    } finally {
      setLoadingRecommended(false);
    }
  }, [userId]);

  // Fetch spot work shifts for spot jobs
  const fetchSpotShifts = useCallback(async (jobIds: string[]) => {
    if (jobIds.length === 0) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('spot_work_shifts')
        .select('*')
        .in('job_posting_id', jobIds)
        .eq('status', 'open')
        .gte('shift_date', today)
        .order('shift_date', { ascending: true });

      if (error) {
        console.error('Failed to fetch spot shifts:', error);
        return;
      }
      setSpotShifts(
        (data || []).map((r) => mapSpotShift(r as Record<string, unknown>))
      );
    } catch (err) {
      console.error('Unexpected error fetching spot shifts:', err);
    }
  }, []);

  // Fetch unread message counts
  const fetchUnreadCounts = useCallback(async () => {
    if (!userId) return;
    try {
      const { data: appData } = await supabase
        .from('job_applications')
        .select('id')
        .eq('applicant_user_id', userId);

      const appIds = (appData || []).map((a: Record<string, unknown>) => a.id as string);
      if (appIds.length === 0) { setUnreadTotal(0); return; }

      const { data: msgData } = await supabase
        .from('recruitment_messages')
        .select('id')
        .in('job_application_id', appIds)
        .neq('sender_user_id', userId)
        .is('read_at', null);

      setUnreadTotal((msgData || []).length);
    } catch (err) {
      console.error('Error fetching unread counts:', err);
    }
  }, [userId]);

  // Initial load
  useEffect(() => {
    fetchJobs();
    if (userId) {
      fetchFavorites();
      fetchApplications();
      fetchUserProfile();
      fetchUnreadCounts();
    }
  }, [fetchJobs, fetchFavorites, fetchApplications, fetchUserProfile, fetchUnreadCounts, userId]);

  // Request geolocation when distance sort is selected
  useEffect(() => {
    if (sortBy === 'distance' && !userLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          // Fallback: use Tokyo Station as default
          setUserLocation({ lat: 35.6812, lng: 139.7671 });
        }
      );
    }
  }, [sortBy, userLocation]);

  // Fetch spot shifts when jobs are loaded
  useEffect(() => {
    const spotJobIds = allJobs
      .filter((j) => j.jobType === 'spot')
      .map((j) => j.id);
    if (spotJobIds.length > 0) {
      fetchSpotShifts(spotJobIds);
    }
  }, [allJobs, fetchSpotShifts]);

  // Compute match scores
  useEffect(() => {
    if (userQualifications.length === 0 && userExperienceYears === 0) return;
    const scores = new Map<string, MatchInfo>();
    for (const job of allJobs) {
      const { score, reasons } = calculateMatchScore(
        userQualifications,
        userExperienceYears,
        {
          requiredQualifications: job.requiredQualifications,
          preferredQualifications: job.preferredQualifications,
          experienceYearsMin: job.experienceYearsMin,
        }
      );
      if (score > 0) {
        scores.set(job.id, { score, reasons });
      }
    }
    setMatchScores(scores);
  }, [allJobs, userQualifications, userExperienceYears]);

  // ================================================================
  // Filtered & sorted jobs
  // ================================================================

  // Active filter count for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterPrefecture) count++;
    if (filterSalaryMin) count++;
    if (filterSalaryMax) count++;
    if (filterQualifications.length > 0) count++;
    if (filterFacilityType) count++;
    return count;
  }, [filterPrefecture, filterSalaryMin, filterSalaryMax, filterQualifications, filterFacilityType]);

  const clearAllFilters = useCallback(() => {
    setFilterPrefecture('');
    setFilterSalaryMin('');
    setFilterSalaryMax('');
    setFilterQualifications([]);
    setFilterFacilityType('');
  }, []);

  const filteredJobs = useMemo(() => {
    let jobs = [...allJobs];

    // Keyword filter
    if (keyword.trim()) {
      const kw = keyword.toLowerCase();
      jobs = jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(kw) ||
          (j.description || '').toLowerCase().includes(kw) ||
          (j.facilityName || '').toLowerCase().includes(kw) ||
          (j.workLocation || '').toLowerCase().includes(kw)
      );
    }

    // Tab-specific filters
    switch (activeTab) {
      case 'full_time':
        jobs = jobs.filter((j) => j.jobType === 'full_time');
        break;
      case 'part_time':
        jobs = jobs.filter((j) => j.jobType === 'part_time');
        break;
      case 'spot':
        jobs = jobs.filter((j) => j.jobType === 'spot');
        break;
      case 'favorites':
        jobs = jobs.filter((j) => favoriteIds.has(j.id));
        break;
      default:
        break;
    }

    // ---- Advanced filters (applied BEFORE sort) ----

    // Prefecture filter
    if (filterPrefecture) {
      jobs = jobs.filter((j) =>
        (j.workLocation || '').includes(filterPrefecture)
      );
    }

    // Facility type filter
    // TODO: Facility type is on the facility object, not the job posting.
    // Once facility type is available on the joined data, filter here:
    // if (filterFacilityType) {
    //   jobs = jobs.filter((j) => j.facilityType === filterFacilityType);
    // }

    // Salary range filter
    if (filterSalaryMin || filterSalaryMax) {
      jobs = jobs.filter((j) => {
        const normalized = normalizeSalary(j);
        if (normalized === 0) return true; // 応相談 — keep visible

        // Convert filter inputs to annual equivalent for comparison
        // For hourly salary types, use raw values; for monthly/annual use 万円 units
        let filterMinAnnual = 0;
        let filterMaxAnnual = Infinity;

        if (filterSalaryMin) {
          const minVal = parseFloat(filterSalaryMin);
          if (!isNaN(minVal)) {
            // If salary type is hourly, compare directly with hourly rate
            // Otherwise, treat input as 万円 and convert to annual
            if (j.salaryType === 'hourly') {
              filterMinAnnual = minVal * 2000; // approximate annual
            } else {
              filterMinAnnual = minVal * 10000; // 万円 → 円 → annual
            }
          }
        }

        if (filterSalaryMax) {
          const maxVal = parseFloat(filterSalaryMax);
          if (!isNaN(maxVal)) {
            if (j.salaryType === 'hourly') {
              filterMaxAnnual = maxVal * 2000;
            } else {
              filterMaxAnnual = maxVal * 10000;
            }
          }
        }

        return normalized >= filterMinAnnual && normalized <= filterMaxAnnual;
      });
    }

    // Qualifications filter (job must require at least one of the selected qualifications)
    if (filterQualifications.length > 0) {
      jobs = jobs.filter((j) =>
        j.requiredQualifications.some((q) => filterQualifications.includes(q))
      );
    }

    // Sort
    switch (sortBy) {
      case 'recommended':
        jobs.sort((a, b) => {
          const sa = matchScores.get(a.id)?.score || 0;
          const sb = matchScores.get(b.id)?.score || 0;
          return sb - sa;
        });
        break;
      case 'salary_high':
        jobs.sort((a, b) => normalizeSalary(b) - normalizeSalary(a));
        break;
      case 'salary_low':
        jobs.sort((a, b) => {
          const sa = normalizeSalary(a) || Infinity;
          const sb = normalizeSalary(b) || Infinity;
          return sa - sb;
        });
        break;
      case 'newest':
        jobs.sort((a, b) => {
          const da = a.publishedAt || a.createdAt || '';
          const db = b.publishedAt || b.createdAt || '';
          return db.localeCompare(da);
        });
        break;
      case 'distance':
        if (userLocation) {
          jobs.sort((a, b) => {
            const coordA = geocodeAddress(a.workLocation || '');
            const coordB = geocodeAddress(b.workLocation || '');
            const distA = coordA ? haversineDistance(userLocation.lat, userLocation.lng, coordA.lat, coordA.lng) : 9999;
            const distB = coordB ? haversineDistance(userLocation.lat, userLocation.lng, coordB.lat, coordB.lng) : 9999;
            return distA - distB;
          });
        }
        break;
    }

    return jobs;
  }, [allJobs, keyword, activeTab, sortBy, matchScores, favoriteIds, userLocation, filterPrefecture, filterSalaryMin, filterSalaryMax, filterQualifications, filterFacilityType]);

  // ================================================================
  // Actions
  // ================================================================

  const toggleFavorite = useCallback(
    async (jobId: string) => {
      if (!userId) return;
      setTogglingFavorite(jobId);
      try {
        if (favoriteIds.has(jobId)) {
          await supabase
            .from('job_favorites')
            .delete()
            .eq('user_id', userId)
            .eq('job_posting_id', jobId);

          setFavoriteIds((prev) => {
            const next = new Set(prev);
            next.delete(jobId);
            return next;
          });
        } else {
          await supabase.from('job_favorites').insert({
            user_id: userId,
            job_posting_id: jobId,
          });

          setFavoriteIds((prev) => new Set(prev).add(jobId));
        }
      } catch (err) {
        console.error('Error toggling favorite:', err);
      } finally {
        setTogglingFavorite(null);
      }
    },
    [userId, favoriteIds]
  );

  const openJobDetail = useCallback(
    async (job: MappedJob) => {
      setSelectedJob(job);
      // Load shifts if spot
      if (job.jobType === 'spot') {
        try {
          const today = new Date().toISOString().split('T')[0];
          const { data } = await supabase
            .from('spot_work_shifts')
            .select('*')
            .eq('job_posting_id', job.id)
            .eq('status', 'open')
            .gte('shift_date', today)
            .order('shift_date', { ascending: true });

          setSelectedJobShifts(
            (data || []).map((r) => mapSpotShift(r as Record<string, unknown>))
          );
        } catch {
          setSelectedJobShifts([]);
        }
      } else {
        setSelectedJobShifts([]);
      }
    },
    []
  );

  const handleApply = useCallback(async () => {
    if (!userId || !selectedJob) return;
    setApplying(true);
    try {
      const { error } = await supabase.from('job_applications').insert({
        job_posting_id: selectedJob.id,
        applicant_user_id: userId,
        status: 'applied',
        cover_message: applyMessage || null,
        preferred_days: prefDays.length > 0 ? prefDays.join(',') : null,
        preferred_hours_per_week: prefHoursPerWeek ? parseInt(prefHoursPerWeek, 10) : null,
        preferred_start_time: prefStartTime || null,
        preferred_end_time: prefEndTime || null,
        preferred_notes: prefNotes || null,
      });

      if (error) {
        console.error('Failed to submit application:', error);
        return;
      }
      setApplySuccess(true);
      setApplyMessage('');
      setPrefDays([]);
      setPrefHoursPerWeek('');
      setPrefStartTime('');
      setPrefEndTime('');
      setPrefNotes('');
      // Refresh applications
      fetchApplications();
      // Auto-close after brief delay
      setTimeout(() => {
        setShowApplyModal(false);
        setApplySuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Error applying:', err);
    } finally {
      setApplying(false);
    }
  }, [userId, selectedJob, applyMessage, prefDays, prefHoursPerWeek, prefStartTime, prefEndTime, prefNotes, fetchApplications]);

  const openApplicationDetail = useCallback(
    async (app: ApplicationRow) => {
      setSelectedApplication(app);
      setLoadingMessages(true);
      try {
        const { data, error } = await supabase
          .from('recruitment_messages')
          .select('*')
          .eq('job_application_id', app.id)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Failed to fetch messages:', error);
          setAppMessages([]);
          return;
        }
        setAppMessages(
          (data || []).map((r) => mapMessage(r as Record<string, unknown>))
        );

        // Mark messages from others as read
        if (userId) {
          await supabase
            .from('recruitment_messages')
            .update({ read_at: new Date().toISOString() })
            .eq('job_application_id', app.id)
            .neq('sender_user_id', userId)
            .is('read_at', null);

          // Refresh unread counts
          fetchUnreadCounts();
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
        setAppMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    },
    [userId, fetchUnreadCounts]
  );

  const handleSendMessage = useCallback(async () => {
    if (!userId || !selectedApplication || !newMessage.trim()) return;
    setSendingMessage(true);
    try {
      const { data, error } = await supabase
        .from('recruitment_messages')
        .insert({
          job_application_id: selectedApplication.id,
          sender_user_id: userId,
          sender_type: 'applicant',
          content: newMessage.trim(),
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to send message:', error);
        return;
      }
      if (data) {
        setAppMessages((prev) => [
          ...prev,
          mapMessage(data as Record<string, unknown>),
        ]);
      }
      setNewMessage('');
      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSendingMessage(false);
    }
  }, [userId, selectedApplication, newMessage]);

  // Handle inquiry message (問い合わせ)
  const handleInquiry = useCallback(async () => {
    if (!userId || !selectedJob || !inquiryMessage.trim()) return;
    setSendingInquiry(true);
    try {
      // Check if application already exists for this job
      const existingApp = applications.find((a) => a.jobPostingId === selectedJob.id);
      let applicationId = existingApp?.id;

      // If no application exists, create one as an inquiry
      if (!applicationId) {
        const { data: newApp, error: appError } = await supabase
          .from('job_applications')
          .insert({
            job_posting_id: selectedJob.id,
            applicant_user_id: userId,
            status: 'applied',
            cover_message: `【問い合わせ】${inquiryMessage.trim()}`,
          })
          .select()
          .single();

        if (appError || !newApp) {
          console.error('Failed to create application for inquiry:', appError);
          return;
        }
        applicationId = (newApp as Record<string, unknown>).id as string;
        fetchApplications();
      }

      // Send the inquiry as a message
      const { error: msgError } = await supabase
        .from('recruitment_messages')
        .insert({
          job_application_id: applicationId,
          sender_user_id: userId,
          sender_type: 'applicant',
          content: inquiryMessage.trim(),
        });

      if (msgError) {
        console.error('Failed to send inquiry message:', msgError);
        return;
      }

      setInquirySuccess(true);
      setInquiryMessage('');
      setTimeout(() => {
        setShowInquiryModal(false);
        setInquirySuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Error sending inquiry:', err);
    } finally {
      setSendingInquiry(false);
    }
  }, [userId, selectedJob, inquiryMessage, applications, fetchApplications]);

  // Quick apply handler
  const handleQuickApply = useCallback(async () => {
    if (!userId || !selectedJob) return;
    setQuickApplying(true);
    try {
      // 1. Check if user has a saved profile (name)
      const { data: userData, error: userErr } = await supabase
        .from('users')
        .select('name')
        .eq('id', userId)
        .single();

      if (userErr || !userData?.name) {
        alert('プロフィール（氏名）を先に設定してください。');
        setQuickApplying(false);
        return;
      }

      // 2. Fetch saved work preferences from most recent application
      let prefDaysVal: string | null = null;
      let prefHoursVal: number | null = null;
      let prefStartVal: string | null = null;
      let prefEndVal: string | null = null;

      const { data: recentApp } = await supabase
        .from('job_applications')
        .select('preferred_days, preferred_hours_per_week, preferred_start_time, preferred_end_time')
        .eq('applicant_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (recentApp && recentApp.length > 0) {
        const prev = recentApp[0] as Record<string, unknown>;
        prefDaysVal = (prev.preferred_days as string) || null;
        prefHoursVal = prev.preferred_hours_per_week != null ? Number(prev.preferred_hours_per_week) : null;
        prefStartVal = (prev.preferred_start_time as string) || null;
        prefEndVal = (prev.preferred_end_time as string) || null;
      }

      // 3. Submit application with auto-generated cover message
      const payload: Record<string, unknown> = {
        job_posting_id: selectedJob.id,
        applicant_user_id: userId,
        status: 'applied',
        cover_message: 'プロフィールを確認の上、ご検討ください。',
      };
      if (prefDaysVal) payload.preferred_days = prefDaysVal;
      if (prefHoursVal) payload.preferred_hours_per_week = prefHoursVal;
      if (prefStartVal) payload.preferred_start_time = prefStartVal;
      if (prefEndVal) payload.preferred_end_time = prefEndVal;

      const { error } = await supabase.from('job_applications').insert(payload);

      if (error) {
        console.error('Quick apply failed:', error);
        return;
      }

      setApplySuccess(true);
      fetchApplications();
      // Auto-close after brief delay
      setTimeout(() => {
        setApplySuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Error in quick apply:', err);
    } finally {
      setQuickApplying(false);
    }
  }, [userId, selectedJob, fetchApplications]);

  // Check if user already applied
  const hasApplied = useCallback(
    (jobId: string) => {
      return applications.some((a) => a.jobPostingId === jobId);
    },
    [applications]
  );

  // ================================================================
  // Render helpers
  // ================================================================

  const renderJobImage = (job: MappedJob, height: string = 'h-[140px]') => {
    const gradient = JOB_TYPE_GRADIENT[job.jobType] || JOB_TYPE_GRADIENT.full_time;
    const initial = (job.facilityName || job.title || '?')[0];

    if (job.imageUrl) {
      return (
        <div className={`relative w-full ${height} overflow-hidden rounded-t-xl`}>
          <Image
            src={job.imageUrl}
            alt={job.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 400px"
          />
        </div>
      );
    }
    return (
      <div
        className={`relative w-full ${height} overflow-hidden rounded-t-xl bg-gradient-to-br ${gradient} flex items-center justify-center`}
      >
        <span className="text-white text-4xl font-bold opacity-80">{initial}</span>
      </div>
    );
  };

  const renderBadge = (jobType: string) => {
    const badge = JOB_TYPE_BADGE[jobType] || JOB_TYPE_BADGE.full_time;
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.bg} ${badge.text}`}
      >
        {badge.label}
      </span>
    );
  };

  // ================================================================
  // Loading skeleton
  // ================================================================

  const renderSkeleton = () => (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-gray-100 bg-white overflow-hidden"
        >
          <div className="h-[140px] bg-gray-200" />
          <div className="p-4 space-y-3">
            <div className="h-4 w-16 rounded bg-gray-200" />
            <div className="h-5 w-3/4 rounded bg-gray-200" />
            <div className="h-4 w-1/2 rounded bg-gray-100" />
            <div className="h-4 w-1/3 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );

  // ================================================================
  // Job Card
  // ================================================================

  const renderJobCard = (job: MappedJob) => {
    const isFav = favoriteIds.has(job.id);
    const matchInfo = matchScores.get(job.id);
    const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryType);

    return (
      <div
        key={job.id}
        className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
      >
        {/* Image area */}
        <div className="relative">
          {renderJobImage(job)}
          {/* Heart button */}
          {userId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(job.id);
              }}
              disabled={togglingFavorite === job.id}
              className="absolute top-3 right-3 rounded-full bg-white/80 backdrop-blur-sm p-2 shadow-sm hover:bg-white transition-colors"
              aria-label={isFav ? 'お気に入りから削除' : 'お気に入りに追加'}
            >
              <Heart
                className={`h-5 w-5 transition-colors ${
                  isFav ? 'fill-red-500 text-red-500' : 'text-gray-400'
                }`}
              />
            </button>
          )}
        </div>

        {/* Card body */}
        <div className="p-4 space-y-2">
          {/* Badge */}
          <div>{renderBadge(job.jobType)}</div>

          {/* Title */}
          <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">
            {job.title}
          </h3>

          {/* Facility */}
          {job.facilityName && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="line-clamp-1">{job.facilityName}</span>
            </div>
          )}

          {/* Facility rating */}
          {job.averageRating && job.averageRating > 0 && (
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span>{job.averageRating.toFixed(1)}</span>
              {job.reviewCount != null && job.reviewCount > 0 && (
                <span className="text-gray-400">({job.reviewCount}件)</span>
              )}
            </div>
          )}

          {/* Salary */}
          <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
            <Banknote className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <span>{salary}</span>
          </div>

          {/* Location */}
          {job.workLocation && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="line-clamp-1">{job.workLocation}</span>
            </div>
          )}

          {/* Qualifications */}
          {job.requiredQualifications.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {job.requiredQualifications.slice(0, 3).map((q) => (
                <span
                  key={q}
                  className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600"
                >
                  {qualificationLabel(q)}
                </span>
              ))}
              {job.requiredQualifications.length > 3 && (
                <span className="text-[10px] text-gray-400">
                  +{job.requiredQualifications.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Match score (recommended tab only) */}
          {activeTab === 'recommended' && matchInfo && matchInfo.score > 0 && (
            <div className="flex items-center gap-1.5 pt-1">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  matchInfo.score >= 60
                    ? 'bg-emerald-100 text-emerald-700'
                    : matchInfo.score >= 30
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Star className="h-3 w-3" />
                マッチ {matchInfo.score}pt
              </span>
            </div>
          )}

          {/* Detail button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={() => openJobDetail(job)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              詳しく見る
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ================================================================
  // Application Card
  // ================================================================

  const renderApplicationCard = (app: ApplicationRow) => {
    const statusInfo = STATUS_BADGE[app.status] || STATUS_BADGE.applied;

    return (
      <button
        key={app.id}
        onClick={() => openApplicationDetail(app)}
        className="w-full text-left rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
      >
        {/* Top row: status + date */}
        <div className="flex items-center justify-between mb-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${statusInfo.className}`}
          >
            {statusInfo.label}
          </span>
          <span className="text-xs text-gray-400">{formatDate(app.createdAt)}</span>
        </div>

        {/* Title */}
        <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{app.jobTitle || '求人'}</h3>

        {/* Facility */}
        {app.facilityName && (
          <p className="text-xs text-gray-500 mt-1">{app.facilityName}</p>
        )}

        {/* Interview info */}
        {app.interviewDate && (
          <div className="flex items-center gap-1.5 text-xs text-purple-600 mt-2">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              面接: {formatDateTime(app.interviewDate)}
              {app.interviewFormat === 'online' && ' オンライン'}
              {app.interviewFormat === 'in_person' && ` ${app.interviewLocation || '対面'}`}
              {app.interviewFormat === 'phone' && ' 電話'}
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">
            詳細を見る
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </button>
    );
  };

  // ================================================================
  // Job Detail Modal
  // ================================================================

  const renderJobDetailModal = () => {
    if (!selectedJob) return null;
    const job = selectedJob;
    const isFav = favoriteIds.has(job.id);
    const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryType);
    const alreadyApplied = hasApplied(job.id);

    return (
      <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
        {/* Header bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur-sm border-b border-gray-100">
          <button
            onClick={() => {
              setSelectedJob(null);
              setSelectedJobShifts([]);
            }}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            戻る
          </button>
          {userId && (
            <button
              onClick={() => toggleFavorite(job.id)}
              disabled={togglingFavorite === job.id}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <Heart
                className={`h-5 w-5 ${
                  isFav ? 'fill-red-500 text-red-500' : 'text-gray-400'
                }`}
              />
            </button>
          )}
        </div>

        {/* Image header */}
        {renderJobImage(job, 'h-[200px]')}

        {/* Facility photo gallery */}
        {job.facilityPhotos && job.facilityPhotos.length > 0 && (
          <div className="px-4 pt-4">
            <h2 className="text-sm font-bold text-gray-900 mb-2">施設の写真</h2>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {job.facilityPhotos.map((photoUrl, idx) => (
                <div
                  key={idx}
                  className="flex-shrink-0 w-32 h-24 rounded-lg overflow-hidden"
                >
                  <img
                    src={photoUrl}
                    alt={`施設写真 ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-4 py-5 pb-32 space-y-5">
          {/* Badge + Title */}
          <div>
            <div className="mb-2">{renderBadge(job.jobType)}</div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">{job.title}</h1>
            {job.facilityName && (
              <p className="text-sm text-gray-500 mt-1">{job.facilityName}</p>
            )}
          </div>

          <hr className="border-gray-200" />

          {/* Key info */}
          <div className="space-y-3">
            {job.workLocation && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">勤務地</p>
                  <p className="text-sm text-gray-800">{job.workLocation}</p>
                </div>
              </div>
            )}
            {job.workHours && (
              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">勤務時間</p>
                  <p className="text-sm text-gray-800">{job.workHours}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <Banknote className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">給与</p>
                <p className="text-sm text-gray-800 font-medium">{salary}</p>
              </div>
            </div>
            {job.employmentType && (
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">雇用形態</p>
                  <p className="text-sm text-gray-800">{job.employmentType}</p>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {job.description && (
            <div>
              <h2 className="text-sm font-bold text-gray-900 mb-2">仕事内容</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {job.description}
              </p>
            </div>
          )}

          {/* Required qualifications */}
          {job.requiredQualifications.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-gray-900 mb-2">応募要件</h2>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {job.requiredQualifications.map((q) => (
                  <span
                    key={q}
                    className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
                  >
                    {qualificationLabel(q)}
                  </span>
                ))}
              </div>
              {job.experienceYearsMin > 0 && (
                <p className="text-sm text-gray-600">
                  経験: {job.experienceYearsMin}年以上
                </p>
              )}
            </div>
          )}

          {/* Preferred qualifications */}
          {job.preferredQualifications.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-gray-900 mb-2">歓迎条件</h2>
              <div className="flex flex-wrap gap-1.5">
                {job.preferredQualifications.map((q) => (
                  <span
                    key={q}
                    className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
                  >
                    {qualificationLabel(q)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Benefits */}
          {job.benefits && (
            <div>
              <h2 className="text-sm font-bold text-gray-900 mb-2">待遇・福利厚生</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {job.benefits}
              </p>
            </div>
          )}

          {/* Spot shifts */}
          {job.jobType === 'spot' && selectedJobShifts.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-gray-900 mb-3">シフト一覧</h2>
              <div className="space-y-2">
                {selectedJobShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-gray-800">
                        {shift.shiftDate.replace(/-/g, '/')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {shift.startTime?.slice(0, 5)}〜{shift.endTime?.slice(0, 5)}
                        {shift.hourlyRate && (
                          <span className="ml-2 font-medium text-amber-700">
                            時給 {shift.hourlyRate.toLocaleString()}円
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        残り {shift.spotsAvailable - shift.spotsFilled} 枠
                      </p>
                    </div>
                    {userId && !alreadyApplied && (
                      <button
                        onClick={() => setShowApplyModal(true)}
                        className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
                      >
                        応募
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Facility Reviews */}
          <hr className="border-gray-200" />
          <FacilityReviewSection
            facilityId={job.facilityId}
            userId={userId}
            facilityName={job.facilityName}
          />
        </div>

        {/* Fixed bottom bar */}
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 px-4 py-3 flex gap-3">
          <button
            onClick={() => {
              if (userId) {
                setShowInquiryModal(true);
                setInquiryMessage('');
                setInquirySuccess(false);
              }
            }}
            className="flex-1 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            問い合わせ
          </button>
          {alreadyApplied ? (
            <div className="flex-1 rounded-xl bg-gray-100 px-4 py-3 text-sm font-bold text-gray-500 text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              応募済み
            </div>
          ) : applySuccess ? (
            <div className="flex-1 rounded-xl bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-700 text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              応募完了
            </div>
          ) : userId ? (
            <div className="flex-1 flex gap-2">
              <button
                onClick={handleQuickApply}
                disabled={quickApplying}
                className="flex-1 rounded-xl bg-amber-500 px-3 py-3 text-sm font-bold text-white hover:bg-amber-600 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {quickApplying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                <span className="text-xs">ワンクリック応募</span>
              </button>
              <button
                onClick={() => setShowApplyModal(true)}
                className="flex-1 rounded-xl bg-indigo-600 px-3 py-3 text-sm font-bold text-white hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <Briefcase className="h-4 w-4" />
                応募する
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                window.location.href = '/login';
              }}
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 transition-colors"
            >
              ログインして応募
            </button>
          )}
        </div>
      </div>
    );
  };

  // ================================================================
  // Apply Modal
  // ================================================================

  const renderApplyModal = () => {
    if (!showApplyModal || !selectedJob) return null;

    return (
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
        <div
          className="absolute inset-0 bg-black/40"
          onClick={() => {
            if (!applying) {
              setShowApplyModal(false);
              setApplySuccess(false);
            }
          }}
        />
        <div className="relative w-full max-w-md mx-4 mb-0 sm:mb-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="p-6">
          {applySuccess ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-900">応募を送信しました</h3>
              <p className="text-sm text-gray-500 mt-2">
                施設からの連絡をお待ちください
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">応募する</h3>
                <button
                  onClick={() => setShowApplyModal(false)}
                  className="rounded-full p-1 hover:bg-gray-100"
                >
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              <hr className="border-gray-200 mb-4" />

              <div className="space-y-3 mb-4">
                <div>
                  <p className="text-xs text-gray-400">求人</p>
                  <p className="text-sm font-medium text-gray-800">{selectedJob.title}</p>
                </div>
                {selectedJob.facilityName && (
                  <div>
                    <p className="text-xs text-gray-400">施設</p>
                    <p className="text-sm font-medium text-gray-800">
                      {selectedJob.facilityName}
                    </p>
                  </div>
                )}
              </div>

              {/* Work preferences section */}
              <div className="mb-4">
                <h4 className="text-sm font-bold text-gray-900 mb-3">希望条件</h4>
                <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  {/* Preferred days */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      希望曜日
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS_OF_WEEK.map((day) => {
                        const isSelected = prefDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              setPrefDays((prev) =>
                                isSelected
                                  ? prev.filter((d) => d !== day)
                                  : [...prev, day]
                              );
                            }}
                            className={`w-9 h-9 rounded-full text-xs font-bold transition-colors ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-300'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Hours per week */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      希望時間/週
                    </label>
                    <div className="relative w-1/2">
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={prefHoursPerWeek}
                        onChange={(e) => setPrefHoursPerWeek(e.target.value)}
                        placeholder="20"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        時間
                      </span>
                    </div>
                  </div>

                  {/* Preferred time range */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      希望時間帯
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={prefStartTime}
                        onChange={(e) => setPrefStartTime(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                      <span className="text-sm text-gray-400">〜</span>
                      <input
                        type="time"
                        value={prefEndTime}
                        onChange={(e) => setPrefEndTime(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      その他希望・備考
                    </label>
                    <textarea
                      rows={2}
                      value={prefNotes}
                      onChange={(e) => setPrefNotes(e.target.value)}
                      placeholder="例: 子供の送迎があるため16時までに退勤希望"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  カバーメッセージ（任意）
                </label>
                <textarea
                  rows={3}
                  value={applyMessage}
                  onChange={(e) => setApplyMessage(e.target.value)}
                  placeholder="志望動機やアピールポイントを記入してください..."
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowApplyModal(false)}
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleApply}
                  disabled={applying}
                  className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {applying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  応募を送信
                </button>
              </div>
            </>
          )}
          </div>
        </div>
      </div>
    );
  };

  // ================================================================
  // Inquiry Modal
  // ================================================================

  const renderInquiryModal = () => {
    if (!showInquiryModal || !selectedJob) return null;

    return (
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
        <div
          className="absolute inset-0 bg-black/40"
          onClick={() => {
            if (!sendingInquiry) {
              setShowInquiryModal(false);
              setInquirySuccess(false);
            }
          }}
        />
        <div className="relative w-full max-w-md mx-4 mb-0 sm:mb-auto rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-xl">
          {inquirySuccess ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-900">問い合わせを送信しました</h3>
              <p className="text-sm text-gray-500 mt-2">
                施設からの回答を「応募状況」タブでご確認ください
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">問い合わせ</h3>
                <button
                  onClick={() => setShowInquiryModal(false)}
                  className="rounded-full p-1 hover:bg-gray-100"
                >
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              <hr className="border-gray-200 mb-4" />

              <div className="space-y-2 mb-4">
                <div>
                  <p className="text-xs text-gray-400">求人</p>
                  <p className="text-sm font-medium text-gray-800">{selectedJob.title}</p>
                </div>
                {selectedJob.facilityName && (
                  <div>
                    <p className="text-xs text-gray-400">施設</p>
                    <p className="text-sm font-medium text-gray-800">
                      {selectedJob.facilityName}
                    </p>
                  </div>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メッセージ
                </label>
                <textarea
                  rows={4}
                  value={inquiryMessage}
                  onChange={(e) => setInquiryMessage(e.target.value)}
                  placeholder="勤務条件や職場環境について質問してみましょう..."
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowInquiryModal(false)}
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleInquiry}
                  disabled={sendingInquiry || !inquiryMessage.trim()}
                  className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sendingInquiry ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  送信する
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // ================================================================
  // Application Detail Modal
  // ================================================================

  const renderApplicationDetailModal = () => {
    if (!selectedApplication) return null;
    const app = selectedApplication;
    const statusInfo = STATUS_BADGE[app.status] || STATUS_BADGE.applied;

    // Determine timeline progress
    const currentIndex = STATUS_TIMELINE_ORDER.indexOf(app.status as ApplicationStatus);

    const interviewFormatLabel =
      app.interviewFormat === 'online'
        ? 'オンライン'
        : app.interviewFormat === 'in_person'
          ? '対面'
          : app.interviewFormat === 'phone'
            ? '電話'
            : '';

    return (
      <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center px-4 py-3 bg-white/90 backdrop-blur-sm border-b border-gray-100">
          <button
            onClick={() => {
              setSelectedApplication(null);
              setAppMessages([]);
              setNewMessage('');
            }}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            戻る
          </button>
        </div>

        <div className="px-4 py-5 pb-32 space-y-6">
          {/* Status + Title */}
          <div>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${statusInfo.className}`}
            >
              {statusInfo.label}
            </span>
            <h1 className="text-lg font-bold text-gray-900 mt-2">
              {app.jobTitle || '求人'}
            </h1>
            {app.facilityName && (
              <p className="text-sm text-gray-500 mt-1">{app.facilityName}</p>
            )}
          </div>

          {/* Status Timeline */}
          <div>
            <h2 className="text-sm font-bold text-gray-900 mb-3">ステータス</h2>
            <div className="relative pl-6 space-y-4">
              {STATUS_TIMELINE_ORDER.map((step, idx) => {
                const isActive = currentIndex >= idx;
                const isCurrent = app.status === step;
                // For rejected/withdrawn, show differently
                const isTerminal =
                  app.status === 'rejected' || app.status === 'withdrawn';

                return (
                  <div key={step} className="relative flex items-start gap-3">
                    {/* Vertical line */}
                    {idx < STATUS_TIMELINE_ORDER.length - 1 && (
                      <div
                        className={`absolute left-[-16px] top-5 w-0.5 h-6 ${
                          isActive && !isTerminal ? 'bg-indigo-400' : 'bg-gray-200'
                        }`}
                      />
                    )}
                    {/* Dot */}
                    <div
                      className={`absolute left-[-20px] top-1 h-3 w-3 rounded-full border-2 ${
                        isActive && !isTerminal
                          ? isCurrent
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'bg-indigo-400 border-indigo-400'
                          : 'bg-white border-gray-300'
                      }`}
                    />
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          isActive && !isTerminal ? 'text-gray-900' : 'text-gray-400'
                        }`}
                      >
                        {STATUS_TIMELINE_LABELS[step] || step}
                      </p>
                    </div>
                  </div>
                );
              })}
              {/* Show terminal status if applicable */}
              {(app.status === 'rejected' || app.status === 'withdrawn') && (
                <div className="relative flex items-start gap-3">
                  <div className="absolute left-[-20px] top-1 h-3 w-3 rounded-full border-2 bg-red-500 border-red-500" />
                  <p className="text-sm font-medium text-red-600">
                    {STATUS_BADGE[app.status]?.label}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Interview info */}
          {app.interviewDate && (
            <div>
              <h2 className="text-sm font-bold text-gray-900 mb-2">面接情報</h2>
              <div className="rounded-lg bg-purple-50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-purple-800">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDateTime(app.interviewDate)}</span>
                </div>
                {interviewFormatLabel && (
                  <div className="flex items-center gap-2 text-sm text-purple-800">
                    <Video className="h-4 w-4" />
                    <span>{interviewFormatLabel}</span>
                  </div>
                )}
                {app.interviewMeetingUrl && (
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-purple-600" />
                    <a
                      href={app.interviewMeetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-purple-600 underline hover:text-purple-800"
                    >
                      面接URLを開く
                    </a>
                  </div>
                )}
                {app.interviewLocation && (
                  <div className="flex items-center gap-2 text-sm text-purple-800">
                    <MapPin className="h-4 w-4" />
                    <span>{app.interviewLocation}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Messages */}
          <div>
            <h2 className="text-sm font-bold text-gray-900 mb-3">メッセージ</h2>
            {loadingMessages ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              </div>
            ) : appMessages.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-400">
                メッセージはまだありません
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {appMessages.map((msg) => {
                  const isMe = msg.senderType === 'applicant';
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                          isMe
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {!isMe && (
                          <p className="text-[10px] font-medium text-gray-500 mb-0.5">
                            施設
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p
                          className={`text-[10px] mt-1 ${
                            isMe ? 'text-indigo-200' : 'text-gray-400'
                          }`}
                        >
                          {formatTime(msg.createdAt)}
                        </p>
                      </div>
                      {/* Read receipt for sent messages */}
                      {isMe && msg.readAt && (
                        <p className="text-[10px] text-gray-400 mt-0.5 mr-1 self-end">
                          既読
                        </p>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Message input bar */}
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 px-4 py-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="メッセージを入力..."
              className="flex-1 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <button
              onClick={handleSendMessage}
              disabled={sendingMessage || !newMessage.trim()}
              className="rounded-full bg-indigo-600 p-2.5 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40"
            >
              {sendingMessage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ================================================================
  // Main Render
  // ================================================================

  const isJobListTab =
    activeTab === 'recommended' ||
    activeTab === 'full_time' ||
    activeTab === 'part_time' ||
    activeTab === 'spot' ||
    activeTab === 'favorites';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ========== Header: Search ========== */}
      <div className="bg-white border-b border-gray-200 px-4 pt-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="キーワードで求人を検索..."
            className="w-full rounded-full border border-gray-300 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          {keyword && (
            <button
              onClick={() => setKeyword('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* ========== Sub-tabs (horizontal scroll) ========== */}
      <div className="bg-white border-b border-gray-200">
        <div
          ref={tabScrollRef}
          className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-hide"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
                {tab.key === 'applications' && unreadTotal > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
                    {unreadTotal > 99 ? '99+' : unreadTotal}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========== Sort bar + Filter button ========== */}
      {isJobListTab && !loadingJobs && (
        <div className="bg-white border-b border-gray-100">
          <div className="px-4 py-2 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {filteredJobs.length} 件の求人
            </p>
            <div className="flex items-center gap-2">
              {/* Filter toggle button */}
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`relative inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                絞り込み
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Sort dropdown */}
              <div className="relative flex items-center gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="appearance-none bg-transparent text-xs font-medium text-gray-700 pr-5 cursor-pointer focus:outline-none"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronRight className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 rotate-90 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* ========== Collapsible Filter Panel ========== */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              showFilters ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="px-4 pb-4 pt-1 space-y-4 border-t border-gray-100">
              {/* 都道府県 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  都道府県
                </label>
                <select
                  value={filterPrefecture}
                  onChange={(e) => setFilterPrefecture(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">すべて</option>
                  {PREFECTURE_LIST.map((pref) => (
                    <option key={pref.code} value={pref.name}>
                      {pref.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 施設種別 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  施設種別
                </label>
                <select
                  value={filterFacilityType}
                  onChange={(e) => setFilterFacilityType(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">すべて</option>
                  {Object.entries(FACILITY_TYPES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 給与レンジ */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  給与レンジ（万円 ※時給の場合は円）
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={filterSalaryMin}
                    onChange={(e) => setFilterSalaryMin(e.target.value)}
                    placeholder="下限"
                    min="0"
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <span className="text-sm text-gray-400">〜</span>
                  <input
                    type="number"
                    value={filterSalaryMax}
                    onChange={(e) => setFilterSalaryMax(e.target.value)}
                    placeholder="上限"
                    min="0"
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              {/* 必要資格 (multi-select chips) */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  必要資格
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {FILTER_QUALIFICATION_OPTIONS.map((q) => {
                    const isSelected = filterQualifications.includes(q.code);
                    return (
                      <button
                        key={q.code}
                        type="button"
                        onClick={() => {
                          setFilterQualifications((prev) =>
                            isSelected
                              ? prev.filter((c) => c !== q.code)
                              : [...prev, q.code]
                          );
                        }}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {q.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* クリア button */}
              {activeFilterCount > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={clearAllFilters}
                    className="inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    <X className="h-3 w-3" />
                    フィルターをクリア
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== Tab Content ========== */}
      <div className="px-4 py-4">
        {/* Recommended tab: show login teaser if no user */}
        {activeTab === 'recommended' && !userId && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-6 text-center mb-4">
            <Briefcase className="h-10 w-10 text-indigo-300 mx-auto mb-3" />
            <p className="text-sm text-indigo-700 font-medium">
              ログインするとあなたにぴったりの求人が表示されます
            </p>
            <button
              onClick={() => {
                window.location.href = '/login';
              }}
              className="mt-3 inline-flex items-center gap-1 rounded-full bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 transition-colors"
            >
              ログイン
            </button>
          </div>
        )}

        {/* Job list tabs */}
        {isJobListTab && (
          <>
            {loadingJobs || (activeTab === 'recommended' && loadingRecommended) ? (
              renderSkeleton()
            ) : filteredJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 text-center bg-white">
                {activeTab === 'favorites' ? (
                  <>
                    <Heart className="h-10 w-10 text-gray-300 mb-3" />
                    <p className="text-sm font-medium text-gray-500">
                      お気に入りした求人はまだありません
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      気になる求人のハートをタップして保存しましょう
                    </p>
                  </>
                ) : (
                  <>
                    <Briefcase className="h-10 w-10 text-gray-300 mb-3" />
                    <p className="text-sm font-medium text-gray-500">
                      {keyword || activeFilterCount > 0
                        ? '条件に合う求人が見つかりませんでした'
                        : '現在公開中の求人はありません'}
                    </p>
                    {(keyword || activeFilterCount > 0) && (
                      <button
                        onClick={() => {
                          setKeyword('');
                          clearAllFilters();
                        }}
                        className="mt-3 rounded-full border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        検索・フィルターをクリア
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredJobs.map((job) => renderJobCard(job))}
              </div>
            )}
          </>
        )}

        {/* Applications tab */}
        {activeTab === 'applications' && (
          <>
            {!userId ? (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-6 text-center">
                <Briefcase className="h-10 w-10 text-indigo-300 mx-auto mb-3" />
                <p className="text-sm text-indigo-700 font-medium">
                  ログインして応募状況を確認しましょう
                </p>
                <button
                  onClick={() => {
                    window.location.href = '/login';
                  }}
                  className="mt-3 inline-flex items-center gap-1 rounded-full bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 transition-colors"
                >
                  ログイン
                </button>
              </div>
            ) : loadingApplications ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-xl border border-gray-100 bg-white p-4"
                  >
                    <div className="h-4 w-20 rounded bg-gray-200 mb-3" />
                    <div className="h-5 w-3/4 rounded bg-gray-200 mb-2" />
                    <div className="h-4 w-1/2 rounded bg-gray-100" />
                  </div>
                ))}
              </div>
            ) : applications.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 text-center bg-white">
                <Briefcase className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-500">
                  応募した求人はまだありません
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  気になる求人に応募してみましょう
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  {applications.length} 件の応募
                </p>
                {applications.map((app) => renderApplicationCard(app))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ========== Modals ========== */}
      {selectedJob && renderJobDetailModal()}
      {showApplyModal && renderApplyModal()}
      {showInquiryModal && renderInquiryModal()}
      {selectedApplication && renderApplicationDetailModal()}
    </div>
  );
}
