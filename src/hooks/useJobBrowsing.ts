/**
 * 求人ブラウジングフック（応募者側）
 * キャリアページからの求人検索、お気に入り、応募、メッセージ機能を提供する。
 * localStorage ベース認証のため useAuth() は使用せず userId をパラメータで受け取る。
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  JobPosting,
  SpotWorkShift,
  JobApplication,
  ApplicationStatus,
  QUALIFICATION_CODES,
} from '@/types';
import { calculateMatchScore, type MatchScore } from '@/lib/jobMatcher';

// ------------------------------------------------------------------ types

export type RecruitmentMessage = {
  id: string;
  jobApplicationId: string;
  senderType: 'facility' | 'applicant';
  senderUserId: string;
  message: string;
  readAt?: string;
  createdAt: string;
};

export type JobPostingWithMatch = JobPosting & {
  matchScore?: number;
  matchReasons?: string[];
  spotShifts?: SpotWorkShift[];
};

// ------------------------------------------------------------------ mappers

function mapJobPosting(row: Record<string, unknown>): JobPostingWithMatch {
  const facility = row.facilities as Record<string, unknown> | null;
  return {
    id: row.id as string,
    facilityId: row.facility_id as string,
    jobType: row.job_type as JobPosting['jobType'],
    title: row.title as string,
    description: (row.description as string) || undefined,
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
    annualSalaryEstimate: row.annual_salary_estimate != null ? Number(row.annual_salary_estimate) : undefined,
    spotsNeeded: Number(row.spots_needed) || 1,
    status: row.status as JobPosting['status'],
    publishedAt: (row.published_at as string) || undefined,
    closesAt: (row.closes_at as string) || undefined,
    imageUrl: (row.image_url as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    facilityName: facility ? (facility.name as string) : (row.facility_name as string) || undefined,
    facilityAddress: facility ? (facility.address as string) : (row.facility_address as string) || undefined,
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

function mapApplication(row: Record<string, unknown>): JobApplication {
  const jobPosting = row.job_postings as Record<string, unknown> | null;
  const facility = row.facilities as Record<string, unknown> | null;

  return {
    id: row.id as string,
    jobPostingId: row.job_posting_id as string,
    spotShiftId: (row.spot_shift_id as string) || undefined,
    applicantUserId: row.applicant_user_id as string,
    status: row.status as ApplicationStatus,
    coverMessage: (row.cover_message as string) || undefined,
    resumeUrl: (row.resume_url as string) || undefined,
    interviewDate: (row.interview_date as string) || undefined,
    interviewNotes: (row.interview_notes as string) || undefined,
    facilityRating: row.facility_rating != null ? Number(row.facility_rating) : undefined,
    facilityNotes: (row.facility_notes as string) || undefined,
    hiredAt: (row.hired_at as string) || undefined,
    startDate: (row.start_date as string) || undefined,
    agreedSalary: row.agreed_salary != null ? Number(row.agreed_salary) : undefined,
    interviewFormat: (row.interview_format as JobApplication['interviewFormat']) || undefined,
    interviewLocation: (row.interview_location as string) || undefined,
    interviewMeetingUrl: (row.interview_meeting_url as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    jobTitle: jobPosting ? (jobPosting.title as string) : undefined,
    jobType: jobPosting ? (jobPosting.job_type as JobApplication['jobType']) : undefined,
    facilityName: facility ? (facility.name as string) : undefined,
  };
}

function mapMessage(row: Record<string, unknown>): RecruitmentMessage {
  return {
    id: row.id as string,
    jobApplicationId: row.job_application_id as string,
    senderType: row.sender_type as 'facility' | 'applicant',
    senderUserId: row.sender_user_id as string,
    message: row.message as string,
    readAt: (row.read_at as string) || undefined,
    createdAt: row.created_at as string,
  };
}

// ------------------------------------------------------------------ hook

export function useJobBrowsing() {
  const [jobs, setJobs] = useState<JobPostingWithMatch[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [myApplications, setMyApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ================================================================
  // 求人一覧（公開中）
  // ================================================================

  const fetchPublishedJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('job_postings')
        .select(`
          *,
          facilities:facility_id (id, name, address)
        `)
        .eq('status', 'published')
        .order('published_at', { ascending: false });
      if (err) throw err;

      const mapped = (data || []).map((r: Record<string, unknown>) => mapJobPosting(r));

      // spot タイプの求人についてシフト情報を取得
      const spotJobIds = mapped.filter(j => j.jobType === 'spot').map(j => j.id);
      let shiftsMap: Record<string, SpotWorkShift[]> = {};

      if (spotJobIds.length > 0) {
        const { data: shiftData, error: shiftErr } = await supabase
          .from('spot_work_shifts')
          .select('*')
          .in('job_posting_id', spotJobIds)
          .eq('status', 'open')
          .order('shift_date', { ascending: true });
        if (shiftErr) throw shiftErr;

        for (const row of (shiftData || []) as Record<string, unknown>[]) {
          const shift = mapSpotShift(row);
          if (!shiftsMap[shift.jobPostingId]) {
            shiftsMap[shift.jobPostingId] = [];
          }
          shiftsMap[shift.jobPostingId].push(shift);
        }
      }

      const jobsWithShifts = mapped.map(j => ({
        ...j,
        spotShifts: shiftsMap[j.id] || undefined,
      }));

      setJobs(jobsWithShifts);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch published jobs';
      setError(msg);
      console.error('fetchPublishedJobs error:', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // ================================================================
  // 求人詳細
  // ================================================================

  const fetchJobDetail = useCallback(async (jobId: string): Promise<JobPostingWithMatch | null> => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('job_postings')
        .select(`
          *,
          facilities:facility_id (id, name, address)
        `)
        .eq('id', jobId)
        .single();
      if (err) throw err;

      const mapped = mapJobPosting(data as Record<string, unknown>);

      // spot タイプの場合はシフト情報も取得
      if (mapped.jobType === 'spot') {
        const { data: shiftData, error: shiftErr } = await supabase
          .from('spot_work_shifts')
          .select('*')
          .eq('job_posting_id', jobId)
          .eq('status', 'open')
          .order('shift_date', { ascending: true });
        if (shiftErr) throw shiftErr;

        mapped.spotShifts = (shiftData || []).map((r: Record<string, unknown>) => mapSpotShift(r));
      }

      return mapped;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch job detail';
      setError(msg);
      console.error('fetchJobDetail error:', msg);
      return null;
    }
  }, []);

  // ================================================================
  // お気に入り
  // ================================================================

  const toggleFavorite = useCallback(async (userId: string, jobPostingId: string) => {
    setError(null);
    try {
      // 既存のお気に入りをチェック
      const { data: existing, error: checkErr } = await supabase
        .from('job_favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('job_posting_id', jobPostingId)
        .maybeSingle();
      if (checkErr) throw checkErr;

      if (existing) {
        // 既に存在する場合は削除
        const { error: delErr } = await supabase
          .from('job_favorites')
          .delete()
          .eq('id', existing.id);
        if (delErr) throw delErr;

        setFavoriteIds(prev => {
          const next = new Set(prev);
          next.delete(jobPostingId);
          return next;
        });
      } else {
        // 存在しない場合は追加
        const { error: insErr } = await supabase
          .from('job_favorites')
          .insert({
            user_id: userId,
            job_posting_id: jobPostingId,
          });
        if (insErr) throw insErr;

        setFavoriteIds(prev => {
          const next = new Set(prev);
          next.add(jobPostingId);
          return next;
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to toggle favorite';
      setError(msg);
      console.error('toggleFavorite error:', msg);
    }
  }, []);

  const fetchFavorites = useCallback(async (userId: string) => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('job_favorites')
        .select('job_posting_id')
        .eq('user_id', userId);
      if (err) throw err;

      const ids = new Set((data || []).map((r: Record<string, unknown>) => r.job_posting_id as string));
      setFavoriteIds(ids);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch favorites';
      setError(msg);
      console.error('fetchFavorites error:', msg);
    }
  }, []);

  // ================================================================
  // 応募
  // ================================================================

  const applyToJob = useCallback(async (
    userId: string,
    jobPostingId: string,
    coverMessage?: string,
    spotShiftId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        job_posting_id: jobPostingId,
        applicant_user_id: userId,
        status: 'applied',
      };
      if (coverMessage) {
        payload.cover_message = coverMessage;
      }
      if (spotShiftId) {
        payload.spot_shift_id = spotShiftId;
      }

      const { error: err } = await supabase
        .from('job_applications')
        .insert(payload);
      if (err) throw err;

      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to apply to job';
      setError(msg);
      console.error('applyToJob error:', msg);
      return { success: false, error: msg };
    }
  }, []);

  // ================================================================
  // 自分の応募一覧
  // ================================================================

  const fetchMyApplications = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('job_applications')
        .select(`
          *,
          job_postings:job_posting_id (id, title, job_type, facility_id,
            facilities:facility_id (id, name)
          )
        `)
        .eq('applicant_user_id', userId)
        .order('created_at', { ascending: false });
      if (err) throw err;

      const mapped = (data || []).map((r: Record<string, unknown>) => {
        const jobPosting = r.job_postings as Record<string, unknown> | null;
        const facility = jobPosting?.facilities as Record<string, unknown> | null;

        return {
          ...mapApplication(r),
          facilityName: facility ? (facility.name as string) : undefined,
        } as JobApplication;
      });

      setMyApplications(mapped);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch my applications';
      setError(msg);
      console.error('fetchMyApplications error:', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // ================================================================
  // メッセージ
  // ================================================================

  const fetchMessages = useCallback(async (applicationId: string): Promise<RecruitmentMessage[]> => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('recruitment_messages')
        .select('*')
        .eq('job_application_id', applicationId)
        .order('created_at', { ascending: true });
      if (err) throw err;

      return (data || []).map((r: Record<string, unknown>) => mapMessage(r));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch messages';
      setError(msg);
      console.error('fetchMessages error:', msg);
      return [];
    }
  }, []);

  const sendMessage = useCallback(async (
    applicationId: string,
    userId: string,
    message: string
  ) => {
    setError(null);
    try {
      const { error: err } = await supabase
        .from('recruitment_messages')
        .insert({
          job_application_id: applicationId,
          sender_type: 'applicant',
          sender_user_id: userId,
          message,
        });
      if (err) throw err;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to send message';
      setError(msg);
      console.error('sendMessage error:', msg);
    }
  }, []);

  // ================================================================
  // おすすめ求人
  // ================================================================

  const getRecommendedJobs = useCallback(async (userId: string): Promise<JobPostingWithMatch[]> => {
    setError(null);
    try {
      // 1. ユーザーの資格情報を取得
      const { data: userData, error: userErr } = await supabase
        .from('users')
        .select('qualifications')
        .eq('id', userId)
        .single();
      if (userErr) throw userErr;

      const userQualifications: string[] = Array.isArray(userData.qualifications)
        ? userData.qualifications
        : typeof userData.qualifications === 'string' && userData.qualifications
          ? (userData.qualifications as string).split(',').map((q: string) => q.trim())
          : [];

      // 2. 経験年数を取得
      const { data: staffData } = await supabase
        .from('staff')
        .select('years_of_experience')
        .eq('user_id', userId)
        .order('years_of_experience', { ascending: false })
        .limit(1);

      const userExperienceYears: number =
        staffData && staffData.length > 0
          ? Number(staffData[0].years_of_experience) || 0
          : 0;

      // 3. 公開中の求人を取得
      const { data: jobData, error: jobErr } = await supabase
        .from('job_postings')
        .select(`
          *,
          facilities:facility_id (id, name, address)
        `)
        .eq('status', 'published');
      if (jobErr) throw jobErr;

      // 4. マッチスコアを計算
      const scored = (jobData || [])
        .map((r: Record<string, unknown>) => {
          const mapped = mapJobPosting(r);
          const { score, reasons } = calculateMatchScore(
            userQualifications,
            userExperienceYears,
            {
              requiredQualifications: mapped.requiredQualifications,
              preferredQualifications: mapped.preferredQualifications,
              experienceYearsMin: mapped.experienceYearsMin,
            }
          );
          return {
            ...mapped,
            matchScore: score,
            matchReasons: reasons,
          };
        })
        .filter(j => j.matchScore! > 0)
        .sort((a, b) => b.matchScore! - a.matchScore!)
        .slice(0, 10);

      return scored;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to get recommended jobs';
      setError(msg);
      console.error('getRecommendedJobs error:', msg);
      return [];
    }
  }, []);

  return {
    // State
    jobs,
    favoriteIds,
    myApplications,
    loading,
    error,

    // 求人
    fetchPublishedJobs,
    fetchJobDetail,

    // お気に入り
    toggleFavorite,
    fetchFavorites,

    // 応募
    applyToJob,
    fetchMyApplications,

    // メッセージ
    fetchMessages,
    sendMessage,

    // おすすめ
    getRecommendedJobs,
  };
}
