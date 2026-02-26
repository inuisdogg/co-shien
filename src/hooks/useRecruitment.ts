/**
 * 求人・人材紹介フック
 * 求人作成、スポットワーク管理、応募管理、成約管理の
 * CRUD操作と状態管理を提供する。
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  JobPosting,
  SpotWorkShift,
  JobApplication,
  Placement,
  ApplicationStatus,
  PaymentStatus,
} from '@/types';

// ------------------------------------------------------------------ mappers

function mapJobPosting(row: Record<string, unknown>): JobPosting {
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
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    facilityName: (row.facility_name as string) || undefined,
    facilityAddress: (row.facility_address as string) || undefined,
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
  // Handle joined user data
  const applicant = row.users as Record<string, unknown> | null;
  const jobPosting = row.job_postings as Record<string, unknown> | null;

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
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    applicantName: applicant ? (applicant.name as string) : undefined,
    applicantEmail: applicant ? (applicant.email as string) : undefined,
    applicantQualifications: applicant
      ? (applicant.qualifications as string[]) || []
      : undefined,
    jobTitle: jobPosting ? (jobPosting.title as string) : undefined,
    jobType: jobPosting ? (jobPosting.job_type as JobApplication['jobType']) : undefined,
  };
}

function mapPlacement(row: Record<string, unknown>): Placement {
  const worker = row.users as Record<string, unknown> | null;

  return {
    id: row.id as string,
    jobApplicationId: row.job_application_id as string,
    facilityId: row.facility_id as string,
    workerUserId: row.worker_user_id as string,
    jobType: row.job_type as Placement['jobType'],
    agreedSalary: Number(row.agreed_salary) || 0,
    feeRate: Number(row.fee_rate) || 0,
    feeAmount: Number(row.fee_amount) || 0,
    stripeInvoiceId: (row.stripe_invoice_id as string) || undefined,
    stripePaymentIntentId: (row.stripe_payment_intent_id as string) || undefined,
    paymentStatus: row.payment_status as PaymentStatus,
    paidAt: (row.paid_at as string) || undefined,
    placementDate: row.placement_date as string,
    notes: (row.notes as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    workerName: worker ? (worker.name as string) : undefined,
  };
}

// ------------------------------------------------------------------ hook

export function useRecruitment() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [spotShifts, setSpotShifts] = useState<SpotWorkShift[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ================================================================
  // Job Postings CRUD
  // ================================================================

  const fetchJobPostings = useCallback(async (fId?: string) => {
    const targetId = fId || facilityId;
    if (!targetId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('job_postings')
        .select('*')
        .eq('facility_id', targetId)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setJobPostings((data || []).map((r: Record<string, unknown>) => mapJobPosting(r)));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch job postings';
      setError(msg);
      console.error('fetchJobPostings error:', msg);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  const createJobPosting = useCallback(async (data: Partial<JobPosting>): Promise<string | null> => {
    if (!facilityId) return null;
    setError(null);
    try {
      const payload = {
        facility_id: facilityId,
        job_type: data.jobType || 'full_time',
        title: data.title || '',
        description: data.description || null,
        required_qualifications: data.requiredQualifications || [],
        preferred_qualifications: data.preferredQualifications || [],
        experience_years_min: data.experienceYearsMin ?? 0,
        employment_type: data.employmentType || null,
        work_location: data.workLocation || null,
        work_hours: data.workHours || null,
        salary_min: data.salaryMin ?? null,
        salary_max: data.salaryMax ?? null,
        salary_type: data.salaryType || null,
        benefits: data.benefits || null,
        annual_salary_estimate: data.annualSalaryEstimate ?? null,
        spots_needed: data.spotsNeeded ?? 1,
        status: data.status || 'draft',
        published_at: data.publishedAt || null,
        closes_at: data.closesAt || null,
      };
      const { data: result, error: err } = await supabase
        .from('job_postings')
        .insert(payload)
        .select()
        .single();
      if (err) throw err;
      const newPosting = mapJobPosting(result);
      setJobPostings(prev => [newPosting, ...prev]);
      return newPosting.id;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create job posting';
      setError(msg);
      console.error('createJobPosting error:', msg);
      return null;
    }
  }, [facilityId]);

  const updateJobPosting = useCallback(async (id: string, data: Partial<JobPosting>) => {
    setError(null);
    try {
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (data.title !== undefined) payload.title = data.title;
      if (data.description !== undefined) payload.description = data.description || null;
      if (data.jobType !== undefined) payload.job_type = data.jobType;
      if (data.requiredQualifications !== undefined) payload.required_qualifications = data.requiredQualifications;
      if (data.preferredQualifications !== undefined) payload.preferred_qualifications = data.preferredQualifications;
      if (data.experienceYearsMin !== undefined) payload.experience_years_min = data.experienceYearsMin;
      if (data.employmentType !== undefined) payload.employment_type = data.employmentType || null;
      if (data.workLocation !== undefined) payload.work_location = data.workLocation || null;
      if (data.workHours !== undefined) payload.work_hours = data.workHours || null;
      if (data.salaryMin !== undefined) payload.salary_min = data.salaryMin ?? null;
      if (data.salaryMax !== undefined) payload.salary_max = data.salaryMax ?? null;
      if (data.salaryType !== undefined) payload.salary_type = data.salaryType || null;
      if (data.benefits !== undefined) payload.benefits = data.benefits || null;
      if (data.annualSalaryEstimate !== undefined) payload.annual_salary_estimate = data.annualSalaryEstimate ?? null;
      if (data.spotsNeeded !== undefined) payload.spots_needed = data.spotsNeeded;
      if (data.status !== undefined) payload.status = data.status;
      if (data.publishedAt !== undefined) payload.published_at = data.publishedAt;
      if (data.closesAt !== undefined) payload.closes_at = data.closesAt || null;

      const { data: result, error: err } = await supabase
        .from('job_postings')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (err) throw err;
      const updated = mapJobPosting(result);
      setJobPostings(prev => prev.map(j => j.id === id ? updated : j));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update job posting';
      setError(msg);
      console.error('updateJobPosting error:', msg);
    }
  }, []);

  const publishJobPosting = useCallback(async (id: string) => {
    setError(null);
    try {
      const { data: result, error: err } = await supabase
        .from('job_postings')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (err) throw err;
      const updated = mapJobPosting(result);
      setJobPostings(prev => prev.map(j => j.id === id ? updated : j));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to publish job posting';
      setError(msg);
      console.error('publishJobPosting error:', msg);
    }
  }, []);

  const closeJobPosting = useCallback(async (id: string) => {
    setError(null);
    try {
      const { data: result, error: err } = await supabase
        .from('job_postings')
        .update({
          status: 'closed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (err) throw err;
      const updated = mapJobPosting(result);
      setJobPostings(prev => prev.map(j => j.id === id ? updated : j));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to close job posting';
      setError(msg);
      console.error('closeJobPosting error:', msg);
    }
  }, []);

  // ================================================================
  // Spot Work Shifts
  // ================================================================

  const fetchSpotShifts = useCallback(async (jobPostingId: string) => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('spot_work_shifts')
        .select('*')
        .eq('job_posting_id', jobPostingId)
        .order('shift_date', { ascending: true });
      if (err) throw err;
      setSpotShifts((data || []).map((r: Record<string, unknown>) => mapSpotShift(r)));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch spot shifts';
      setError(msg);
      console.error('fetchSpotShifts error:', msg);
    }
  }, []);

  const fetchAllSpotShifts = useCallback(async (fId?: string, month?: string) => {
    const targetId = fId || facilityId;
    if (!targetId) return;
    setError(null);
    try {
      // First get all spot-type job postings for the facility
      const { data: postings, error: postErr } = await supabase
        .from('job_postings')
        .select('id')
        .eq('facility_id', targetId)
        .eq('job_type', 'spot');
      if (postErr) throw postErr;
      if (!postings || postings.length === 0) {
        setSpotShifts([]);
        return;
      }

      const postingIds = postings.map((p: Record<string, unknown>) => p.id as string);
      let query = supabase
        .from('spot_work_shifts')
        .select('*')
        .in('job_posting_id', postingIds)
        .order('shift_date', { ascending: true });

      if (month) {
        // month format: "YYYY-MM"
        const startDate = `${month}-01`;
        const [y, m] = month.split('-').map(Number);
        const endDate = new Date(y, m, 0).toISOString().split('T')[0]; // last day of month
        query = query.gte('shift_date', startDate).lte('shift_date', endDate);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setSpotShifts((data || []).map((r: Record<string, unknown>) => mapSpotShift(r)));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch all spot shifts';
      setError(msg);
      console.error('fetchAllSpotShifts error:', msg);
    }
  }, [facilityId]);

  const createSpotShift = useCallback(async (data: Partial<SpotWorkShift>) => {
    setError(null);
    try {
      const payload = {
        job_posting_id: data.jobPostingId,
        shift_date: data.shiftDate,
        start_time: data.startTime,
        end_time: data.endTime,
        role_needed: data.roleNeeded || null,
        hourly_rate: data.hourlyRate ?? null,
        spots_available: data.spotsAvailable ?? 1,
        spots_filled: 0,
        status: 'open',
        notes: data.notes || null,
      };
      const { data: result, error: err } = await supabase
        .from('spot_work_shifts')
        .insert(payload)
        .select()
        .single();
      if (err) throw err;
      const newShift = mapSpotShift(result);
      setSpotShifts(prev => [...prev, newShift].sort((a, b) => a.shiftDate.localeCompare(b.shiftDate)));
      return newShift;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create spot shift';
      setError(msg);
      console.error('createSpotShift error:', msg);
      return null;
    }
  }, []);

  const updateSpotShift = useCallback(async (id: string, data: Partial<SpotWorkShift>) => {
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (data.shiftDate !== undefined) payload.shift_date = data.shiftDate;
      if (data.startTime !== undefined) payload.start_time = data.startTime;
      if (data.endTime !== undefined) payload.end_time = data.endTime;
      if (data.roleNeeded !== undefined) payload.role_needed = data.roleNeeded || null;
      if (data.hourlyRate !== undefined) payload.hourly_rate = data.hourlyRate ?? null;
      if (data.spotsAvailable !== undefined) payload.spots_available = data.spotsAvailable;
      if (data.spotsFilled !== undefined) payload.spots_filled = data.spotsFilled;
      if (data.status !== undefined) payload.status = data.status;
      if (data.notes !== undefined) payload.notes = data.notes || null;

      const { data: result, error: err } = await supabase
        .from('spot_work_shifts')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (err) throw err;
      const updated = mapSpotShift(result);
      setSpotShifts(prev => prev.map(s => s.id === id ? updated : s));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update spot shift';
      setError(msg);
      console.error('updateSpotShift error:', msg);
    }
  }, []);

  const deleteSpotShift = useCallback(async (id: string) => {
    setError(null);
    try {
      const { error: err } = await supabase
        .from('spot_work_shifts')
        .delete()
        .eq('id', id);
      if (err) throw err;
      setSpotShifts(prev => prev.filter(s => s.id !== id));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete spot shift';
      setError(msg);
      console.error('deleteSpotShift error:', msg);
    }
  }, []);

  // ================================================================
  // Applications
  // ================================================================

  const fetchApplications = useCallback(async (
    fId?: string,
    filters?: { status?: string; jobPostingId?: string }
  ) => {
    const targetId = fId || facilityId;
    if (!targetId) return;
    setLoading(true);
    setError(null);
    try {
      // First get all job posting IDs for this facility
      const { data: postings, error: postErr } = await supabase
        .from('job_postings')
        .select('id')
        .eq('facility_id', targetId);
      if (postErr) throw postErr;
      if (!postings || postings.length === 0) {
        setApplications([]);
        setLoading(false);
        return;
      }

      const postingIds = postings.map((p: Record<string, unknown>) => p.id as string);
      let query = supabase
        .from('job_applications')
        .select(`
          *,
          users:applicant_user_id (id, name, email, qualifications),
          job_postings:job_posting_id (id, title, job_type)
        `)
        .in('job_posting_id', postingIds)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.jobPostingId) {
        query = query.eq('job_posting_id', filters.jobPostingId);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setApplications((data || []).map((r: Record<string, unknown>) => mapApplication(r)));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch applications';
      setError(msg);
      console.error('fetchApplications error:', msg);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  const updateApplicationStatus = useCallback(async (
    id: string,
    newStatus: ApplicationStatus,
    notes?: string
  ) => {
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (notes !== undefined) {
        payload.facility_notes = notes;
      }
      if (newStatus === 'hired') {
        payload.hired_at = new Date().toISOString();
      }

      const { data: result, error: err } = await supabase
        .from('job_applications')
        .update(payload)
        .eq('id', id)
        .select(`
          *,
          users:applicant_user_id (id, name, email, qualifications),
          job_postings:job_posting_id (id, title, job_type)
        `)
        .single();
      if (err) throw err;
      const updated = mapApplication(result);
      setApplications(prev => prev.map(a => a.id === id ? updated : a));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update application status';
      setError(msg);
      console.error('updateApplicationStatus error:', msg);
    }
  }, []);

  const hireApplicant = useCallback(async (
    applicationId: string,
    agreedSalary: number,
    startDate: string
  ) => {
    setError(null);
    try {
      const payload = {
        status: 'hired',
        hired_at: new Date().toISOString(),
        agreed_salary: agreedSalary,
        start_date: startDate,
        updated_at: new Date().toISOString(),
      };
      const { data: result, error: err } = await supabase
        .from('job_applications')
        .update(payload)
        .eq('id', applicationId)
        .select(`
          *,
          users:applicant_user_id (id, name, email, qualifications),
          job_postings:job_posting_id (id, title, job_type)
        `)
        .single();
      if (err) throw err;
      const updated = mapApplication(result);
      setApplications(prev => prev.map(a => a.id === applicationId ? updated : a));
      return updated;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to hire applicant';
      setError(msg);
      console.error('hireApplicant error:', msg);
      return null;
    }
  }, []);

  // ================================================================
  // Placements
  // ================================================================

  const createPlacement = useCallback(async (
    applicationId: string,
    salary: number,
    feeRate: number
  ) => {
    if (!facilityId) return null;
    setError(null);
    try {
      // Get the application to find worker and job type
      const { data: app, error: appErr } = await supabase
        .from('job_applications')
        .select(`
          *,
          job_postings:job_posting_id (id, job_type)
        `)
        .eq('id', applicationId)
        .single();
      if (appErr) throw appErr;

      const jobPosting = app.job_postings as Record<string, unknown> | null;
      const jobType = jobPosting ? (jobPosting.job_type as string) : 'full_time';
      const feeAmount = Math.round(salary * feeRate);

      const payload = {
        job_application_id: applicationId,
        facility_id: facilityId,
        worker_user_id: app.applicant_user_id,
        job_type: jobType,
        agreed_salary: salary,
        fee_rate: feeRate,
        fee_amount: feeAmount,
        payment_status: 'pending',
        placement_date: new Date().toISOString().split('T')[0],
      };

      const { data: result, error: err } = await supabase
        .from('placements')
        .insert(payload)
        .select(`
          *,
          users:worker_user_id (id, name)
        `)
        .single();
      if (err) throw err;
      const newPlacement = mapPlacement(result);
      setPlacements(prev => [newPlacement, ...prev]);
      return newPlacement;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create placement';
      setError(msg);
      console.error('createPlacement error:', msg);
      return null;
    }
  }, [facilityId]);

  const fetchPlacements = useCallback(async (fId?: string) => {
    const targetId = fId || facilityId;
    if (!targetId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('placements')
        .select(`
          *,
          users:worker_user_id (id, name)
        `)
        .eq('facility_id', targetId)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setPlacements((data || []).map((r: Record<string, unknown>) => mapPlacement(r)));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch placements';
      setError(msg);
      console.error('fetchPlacements error:', msg);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  const updatePlacementPayment = useCallback(async (
    id: string,
    stripeData: {
      invoiceId?: string;
      paymentIntentId?: string;
      status: PaymentStatus;
    }
  ) => {
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        payment_status: stripeData.status,
        updated_at: new Date().toISOString(),
      };
      if (stripeData.invoiceId) {
        payload.stripe_invoice_id = stripeData.invoiceId;
      }
      if (stripeData.paymentIntentId) {
        payload.stripe_payment_intent_id = stripeData.paymentIntentId;
      }
      if (stripeData.status === 'paid') {
        payload.paid_at = new Date().toISOString();
      }

      const { data: result, error: err } = await supabase
        .from('placements')
        .update(payload)
        .eq('id', id)
        .select(`
          *,
          users:worker_user_id (id, name)
        `)
        .single();
      if (err) throw err;
      const updated = mapPlacement(result);
      setPlacements(prev => prev.map(p => p.id === id ? updated : p));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update placement payment';
      setError(msg);
      console.error('updatePlacementPayment error:', msg);
    }
  }, []);

  return {
    // State
    jobPostings,
    spotShifts,
    applications,
    placements,
    loading,
    error,

    // Job Postings
    fetchJobPostings,
    createJobPosting,
    updateJobPosting,
    publishJobPosting,
    closeJobPosting,

    // Spot Shifts
    fetchSpotShifts,
    fetchAllSpotShifts,
    createSpotShift,
    updateSpotShift,
    deleteSpotShift,

    // Applications
    fetchApplications,
    updateApplicationStatus,
    hireApplicant,

    // Placements
    createPlacement,
    fetchPlacements,
    updatePlacementPayment,
  };
}
