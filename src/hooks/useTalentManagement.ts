/**
 * タレントマネジメントフック
 * 処遇改善加算の要件管理、職位・賃金体系、キャリア開発記録の
 * CRUD操作と加算レベル判定ロジックを提供する。
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// ------------------------------------------------------------------ types

export interface JobGrade {
  id: string;
  facilityId: string;
  gradeName: string;
  gradeLevel: number;
  responsibilities: string | null;
  appointmentRequirements: string | null;
  minSalary: number | null;
  maxSalary: number | null;
  requiredExperienceYears: number | null;
  requiredQualifications: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TreatmentImprovementPlan {
  id: string;
  facilityId: string;
  fiscalYear: number;
  additionLevel: 'I' | 'II' | 'III' | 'IV';
  status: 'draft' | 'submitted' | 'approved' | 'active' | 'completed';
  estimatedAnnualRevenue: number | null;
  estimatedAdditionAmount: number | null;
  plannedImprovementTotal: number | null;
  plannedMonthlyImprovement: number | null;
  monthlyRequirementRatio: number | null;
  planSubmittedAt: string | null;
  performanceReportSubmittedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CareerPathRequirement {
  id: string;
  planId: string;
  requirementLevel: 'I' | 'II' | 'III' | 'IV' | 'V';
  isMet: boolean;
  evidenceDescription: string | null;
  documentUrls: string[];
  targetStaffId: string | null;
  annualSalaryAmount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkplaceEnvironmentItem {
  id: string;
  planId: string;
  category: string;
  itemNumber: number;
  itemTitle: string;
  isImplemented: boolean;
  implementationDetails: string | null;
  evidenceNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WageImprovementRecord {
  id: string;
  planId: string;
  userId: string;
  month: number;
  baseSalary: number;
  allowances: number;
  bonus: number;
  totalCompensation: number;
  improvementAmount: number;
  employmentType: string | null;
  fteRatio: number;
  createdAt: string;
  updatedAt: string;
}

export interface CareerDevelopmentRecord {
  id: string;
  userId: string;
  facilityId: string;
  recordType: 'promotion' | 'raise' | 'training' | 'qualification' | 'evaluation' | 'milestone';
  title: string;
  description: string | null;
  recordedDate: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdditionLevelStatus {
  currentLevel: 'I' | 'II' | 'III' | 'IV' | null;
  requirements: {
    careerPathI: boolean;
    careerPathII: boolean;
    careerPathIII: boolean;
    careerPathIV: boolean;
    careerPathV: boolean;
    monthlyWageImprovement: boolean;
    workplaceEnvironment: boolean;
    visibility: boolean;
  };
  qualifiesForI: boolean;
  qualifiesForII: boolean;
  qualifiesForIII: boolean;
  qualifiesForIV: boolean;
  nextLevelAdvice: string[];
}

// ------------------------------------------------------------------ mappers

function mapJobGrade(row: Record<string, unknown>): JobGrade {
  return {
    id: row.id as string,
    facilityId: row.facility_id as string,
    gradeName: row.grade_name as string,
    gradeLevel: row.grade_level as number,
    responsibilities: (row.responsibilities as string) || null,
    appointmentRequirements: (row.appointment_requirements as string) || null,
    minSalary: row.min_salary != null ? Number(row.min_salary) : null,
    maxSalary: row.max_salary != null ? Number(row.max_salary) : null,
    requiredExperienceYears: row.required_experience_years != null ? Number(row.required_experience_years) : null,
    requiredQualifications: (row.required_qualifications as string[]) || [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapPlan(row: Record<string, unknown>): TreatmentImprovementPlan {
  return {
    id: row.id as string,
    facilityId: row.facility_id as string,
    fiscalYear: row.fiscal_year as number,
    additionLevel: row.addition_level as TreatmentImprovementPlan['additionLevel'],
    status: row.status as TreatmentImprovementPlan['status'],
    estimatedAnnualRevenue: row.estimated_annual_revenue != null ? Number(row.estimated_annual_revenue) : null,
    estimatedAdditionAmount: row.estimated_addition_amount != null ? Number(row.estimated_addition_amount) : null,
    plannedImprovementTotal: row.planned_improvement_total != null ? Number(row.planned_improvement_total) : null,
    plannedMonthlyImprovement: row.planned_monthly_improvement != null ? Number(row.planned_monthly_improvement) : null,
    monthlyRequirementRatio: row.monthly_requirement_ratio != null ? Number(row.monthly_requirement_ratio) : null,
    planSubmittedAt: (row.plan_submitted_at as string) || null,
    performanceReportSubmittedAt: (row.performance_report_submitted_at as string) || null,
    notes: (row.notes as string) || null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapCareerPathReq(row: Record<string, unknown>): CareerPathRequirement {
  return {
    id: row.id as string,
    planId: row.plan_id as string,
    requirementLevel: row.requirement_level as CareerPathRequirement['requirementLevel'],
    isMet: row.is_met as boolean,
    evidenceDescription: (row.evidence_description as string) || null,
    documentUrls: (row.document_urls as string[]) || [],
    targetStaffId: (row.target_staff_id as string) || null,
    annualSalaryAmount: row.annual_salary_amount != null ? Number(row.annual_salary_amount) : null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapWorkplaceItem(row: Record<string, unknown>): WorkplaceEnvironmentItem {
  return {
    id: row.id as string,
    planId: row.plan_id as string,
    category: row.category as string,
    itemNumber: row.item_number as number,
    itemTitle: row.item_title as string,
    isImplemented: row.is_implemented as boolean,
    implementationDetails: (row.implementation_details as string) || null,
    evidenceNotes: (row.evidence_notes as string) || null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapWageRecord(row: Record<string, unknown>): WageImprovementRecord {
  return {
    id: row.id as string,
    planId: row.plan_id as string,
    userId: row.user_id as string,
    month: row.month as number,
    baseSalary: Number(row.base_salary) || 0,
    allowances: Number(row.allowances) || 0,
    bonus: Number(row.bonus) || 0,
    totalCompensation: Number(row.total_compensation) || 0,
    improvementAmount: Number(row.improvement_amount) || 0,
    employmentType: (row.employment_type as string) || null,
    fteRatio: Number(row.fte_ratio) || 1.0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapCareerDev(row: Record<string, unknown>): CareerDevelopmentRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    facilityId: row.facility_id as string,
    recordType: row.record_type as CareerDevelopmentRecord['recordType'],
    title: row.title as string,
    description: (row.description as string) || null,
    recordedDate: row.recorded_date as string,
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: row.created_at as string,
  };
}

// ------------------------------------------------------------------ addition rates (2024-06 unified)

/** 加算率テーブル（障害児通所支援: 児童発達支援・放課後等デイサービス） */
export const ADDITION_RATES: Record<string, number> = {
  I: 0.141,
  II: 0.119,
  III: 0.088,
  IV: 0.063,
};

// ------------------------------------------------------------------ hook

export const useTalentManagement = () => {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Job Grades ----

  const fetchJobGrades = useCallback(async (): Promise<JobGrade[]> => {
    if (!facilityId) return [];
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('job_grades')
        .select('*')
        .eq('facility_id', facilityId)
        .order('grade_level', { ascending: true });
      if (err) throw err;
      return (data || []).map(mapJobGrade);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch job grades';
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  const saveJobGrade = useCallback(async (grade: Partial<JobGrade> & { gradeName: string; gradeLevel: number }): Promise<JobGrade | null> => {
    if (!facilityId) return null;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        facility_id: facilityId,
        grade_name: grade.gradeName,
        grade_level: grade.gradeLevel,
        responsibilities: grade.responsibilities || null,
        appointment_requirements: grade.appointmentRequirements || null,
        min_salary: grade.minSalary ?? null,
        max_salary: grade.maxSalary ?? null,
        required_experience_years: grade.requiredExperienceYears ?? null,
        required_qualifications: grade.requiredQualifications || [],
        updated_at: new Date().toISOString(),
      };
      if (grade.id) {
        const { data, error: err } = await supabase
          .from('job_grades')
          .update(payload)
          .eq('id', grade.id)
          .select()
          .single();
        if (err) throw err;
        return mapJobGrade(data);
      } else {
        const { data, error: err } = await supabase
          .from('job_grades')
          .insert({ ...payload, id: crypto.randomUUID() })
          .select()
          .single();
        if (err) throw err;
        return mapJobGrade(data);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save job grade';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  const deleteJobGrade = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('job_grades').delete().eq('id', id);
      if (err) throw err;
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete job grade';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- Treatment Improvement Plans ----

  const fetchTreatmentPlan = useCallback(async (fiscalYear: number): Promise<TreatmentImprovementPlan | null> => {
    if (!facilityId) return null;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('treatment_improvement_plans')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('fiscal_year', fiscalYear)
        .maybeSingle();
      if (err) throw err;
      return data ? mapPlan(data) : null;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch plan';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  const saveTreatmentPlan = useCallback(async (plan: Partial<TreatmentImprovementPlan> & { fiscalYear: number; additionLevel: string }): Promise<TreatmentImprovementPlan | null> => {
    if (!facilityId) return null;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        facility_id: facilityId,
        fiscal_year: plan.fiscalYear,
        addition_level: plan.additionLevel,
        status: plan.status || 'draft',
        estimated_annual_revenue: plan.estimatedAnnualRevenue ?? null,
        estimated_addition_amount: plan.estimatedAdditionAmount ?? null,
        planned_improvement_total: plan.plannedImprovementTotal ?? null,
        planned_monthly_improvement: plan.plannedMonthlyImprovement ?? null,
        monthly_requirement_ratio: plan.monthlyRequirementRatio ?? null,
        plan_submitted_at: plan.planSubmittedAt ?? null,
        performance_report_submitted_at: plan.performanceReportSubmittedAt ?? null,
        notes: plan.notes ?? null,
        updated_at: new Date().toISOString(),
      };
      if (plan.id) {
        const { data, error: err } = await supabase
          .from('treatment_improvement_plans')
          .update(payload)
          .eq('id', plan.id)
          .select()
          .single();
        if (err) throw err;
        return mapPlan(data);
      } else {
        const { data, error: err } = await supabase
          .from('treatment_improvement_plans')
          .insert({ ...payload, id: crypto.randomUUID() })
          .select()
          .single();
        if (err) throw err;
        return mapPlan(data);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save plan';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  // ---- Career Path Requirements ----

  const fetchCareerPathRequirements = useCallback(async (planId: string): Promise<CareerPathRequirement[]> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('career_path_requirements')
        .select('*')
        .eq('plan_id', planId)
        .order('requirement_level');
      if (err) throw err;
      return (data || []).map(mapCareerPathReq);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch requirements';
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const updateCareerPathRequirement = useCallback(async (id: string, updates: Partial<CareerPathRequirement>): Promise<CareerPathRequirement | null> => {
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates.isMet !== undefined) payload.is_met = updates.isMet;
      if (updates.evidenceDescription !== undefined) payload.evidence_description = updates.evidenceDescription;
      if (updates.documentUrls !== undefined) payload.document_urls = updates.documentUrls;
      if (updates.targetStaffId !== undefined) payload.target_staff_id = updates.targetStaffId;
      if (updates.annualSalaryAmount !== undefined) payload.annual_salary_amount = updates.annualSalaryAmount;

      const { data, error: err } = await supabase
        .from('career_path_requirements')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (err) throw err;
      return mapCareerPathReq(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update requirement';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const ensureCareerPathRequirements = useCallback(async (planId: string): Promise<CareerPathRequirement[]> => {
    const existing = await fetchCareerPathRequirements(planId);
    const levels: CareerPathRequirement['requirementLevel'][] = ['I', 'II', 'III', 'IV', 'V'];
    const existingLevels = new Set(existing.map(r => r.requirementLevel));
    const toInsert = levels.filter(l => !existingLevels.has(l));

    if (toInsert.length > 0) {
      const rows = toInsert.map(level => ({
        id: crypto.randomUUID(),
        plan_id: planId,
        requirement_level: level,
        is_met: false,
        evidence_description: null,
        document_urls: [],
        target_staff_id: null,
        annual_salary_amount: null,
      }));
      await supabase.from('career_path_requirements').insert(rows);
      return fetchCareerPathRequirements(planId);
    }
    return existing;
  }, [fetchCareerPathRequirements]);

  // ---- Workplace Environment Items ----

  const fetchWorkplaceEnvironmentItems = useCallback(async (planId: string): Promise<WorkplaceEnvironmentItem[]> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('workplace_environment_items')
        .select('*')
        .eq('plan_id', planId)
        .order('item_number');
      if (err) throw err;
      return (data || []).map(mapWorkplaceItem);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch workplace items';
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const updateWorkplaceEnvironmentItem = useCallback(async (id: string, updates: Partial<WorkplaceEnvironmentItem>): Promise<WorkplaceEnvironmentItem | null> => {
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates.isImplemented !== undefined) payload.is_implemented = updates.isImplemented;
      if (updates.implementationDetails !== undefined) payload.implementation_details = updates.implementationDetails;
      if (updates.evidenceNotes !== undefined) payload.evidence_notes = updates.evidenceNotes;

      const { data, error: err } = await supabase
        .from('workplace_environment_items')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (err) throw err;
      return mapWorkplaceItem(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update workplace item';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const ensureWorkplaceEnvironmentItems = useCallback(async (planId: string, items: Array<{ category: string; itemNumber: number; itemTitle: string }>): Promise<WorkplaceEnvironmentItem[]> => {
    const existing = await fetchWorkplaceEnvironmentItems(planId);
    const existingNumbers = new Set(existing.map(i => i.itemNumber));
    const toInsert = items.filter(i => !existingNumbers.has(i.itemNumber));

    if (toInsert.length > 0) {
      const rows = toInsert.map(item => ({
        id: crypto.randomUUID(),
        plan_id: planId,
        category: item.category,
        item_number: item.itemNumber,
        item_title: item.itemTitle,
        is_implemented: false,
        implementation_details: null,
        evidence_notes: null,
      }));
      await supabase.from('workplace_environment_items').insert(rows);
      return fetchWorkplaceEnvironmentItems(planId);
    }
    return existing;
  }, [fetchWorkplaceEnvironmentItems]);

  // ---- Wage Improvement Records ----

  const fetchWageImprovementRecords = useCallback(async (planId: string): Promise<WageImprovementRecord[]> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('wage_improvement_records')
        .select('*')
        .eq('plan_id', planId)
        .order('month');
      if (err) throw err;
      return (data || []).map(mapWageRecord);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch wage records';
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const saveWageImprovementRecord = useCallback(async (record: Partial<WageImprovementRecord> & { planId: string; userId: string; month: number }): Promise<WageImprovementRecord | null> => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        plan_id: record.planId,
        user_id: record.userId,
        month: record.month,
        base_salary: record.baseSalary ?? 0,
        allowances: record.allowances ?? 0,
        bonus: record.bonus ?? 0,
        total_compensation: record.totalCompensation ?? 0,
        improvement_amount: record.improvementAmount ?? 0,
        employment_type: record.employmentType ?? null,
        fte_ratio: record.fteRatio ?? 1.0,
        updated_at: new Date().toISOString(),
      };
      if (record.id) {
        const { data, error: err } = await supabase
          .from('wage_improvement_records')
          .update(payload)
          .eq('id', record.id)
          .select()
          .single();
        if (err) throw err;
        return mapWageRecord(data);
      } else {
        const { data, error: err } = await supabase
          .from('wage_improvement_records')
          .insert({ ...payload, id: crypto.randomUUID() })
          .select()
          .single();
        if (err) throw err;
        return mapWageRecord(data);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save wage record';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- Career Development Records ----

  const fetchCareerDevelopmentRecords = useCallback(async (userId: string): Promise<CareerDevelopmentRecord[]> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('career_development_records')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_date', { ascending: false });
      if (err) throw err;
      return (data || []).map(mapCareerDev);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch career records';
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const saveCareerDevelopmentRecord = useCallback(async (record: Omit<CareerDevelopmentRecord, 'id' | 'createdAt'>): Promise<CareerDevelopmentRecord | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('career_development_records')
        .insert({
          id: crypto.randomUUID(),
          user_id: record.userId,
          facility_id: record.facilityId,
          record_type: record.recordType,
          title: record.title,
          description: record.description,
          recorded_date: record.recordedDate,
          metadata: record.metadata || {},
        })
        .select()
        .single();
      if (err) throw err;
      return mapCareerDev(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save career record';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- Tenure Calculation ----

  const calculateTenure = useCallback(async (userId: string, targetFacilityId: string): Promise<number> => {
    try {
      const { data, error: err } = await supabase
        .from('employment_records')
        .select('start_date, end_date')
        .eq('user_id', userId)
        .eq('facility_id', targetFacilityId)
        .order('start_date', { ascending: true });
      if (err || !data || data.length === 0) return 0;

      let totalDays = 0;
      const today = new Date();
      for (const rec of data) {
        const start = new Date(rec.start_date);
        const end = rec.end_date ? new Date(rec.end_date) : today;
        const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        totalDays += Math.max(0, diff);
      }
      return totalDays;
    } catch {
      return 0;
    }
  }, []);

  // ---- Addition Level Status ----

  const getAdditionLevelStatus = useCallback(async (planId: string): Promise<AdditionLevelStatus> => {
    const requirements = await fetchCareerPathRequirements(planId);
    const workplaceItems = await fetchWorkplaceEnvironmentItems(planId);

    const reqMap: Record<string, boolean> = {};
    for (const r of requirements) {
      reqMap[r.requirementLevel] = r.isMet;
    }

    // Count implemented workplace items per category
    const implementedCount = workplaceItems.filter(i => i.isImplemented).length;
    // Need at least 1 item per category for at least 2 categories for basic, more for higher
    const categoryCounts: Record<string, number> = {};
    for (const item of workplaceItems) {
      if (item.isImplemented) {
        categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
      }
    }
    const categoriesWithItems = Object.keys(categoryCounts).length;

    const careerPathI = !!reqMap['I'];
    const careerPathII = !!reqMap['II'];
    const careerPathIII = !!reqMap['III'];
    const careerPathIV = !!reqMap['IV'];
    const careerPathV = !!reqMap['V'];
    // Workplace: 6 categories, need at least 2 categories and 6+ items total
    const workplaceEnvironment = categoriesWithItems >= 2 && implementedCount >= 6;
    // Monthly wage improvement: always true for basic check (detailed check in UI)
    const monthlyWageImprovement = true;
    const visibility = true;

    // Level qualification:
    // IV: CP I + II + workplace env
    // III: CP I + II + III + workplace env
    // II: CP I + II + III + IV + workplace env
    // I: CP I + II + III + IV + V + workplace env
    const qualifiesForIV = careerPathI && careerPathII && workplaceEnvironment;
    const qualifiesForIII = qualifiesForIV && careerPathIII;
    const qualifiesForII = qualifiesForIII && careerPathIV;
    const qualifiesForI = qualifiesForII && careerPathV;

    let currentLevel: AdditionLevelStatus['currentLevel'] = null;
    if (qualifiesForI) currentLevel = 'I';
    else if (qualifiesForII) currentLevel = 'II';
    else if (qualifiesForIII) currentLevel = 'III';
    else if (qualifiesForIV) currentLevel = 'IV';

    const nextLevelAdvice: string[] = [];
    if (!currentLevel) {
      if (!careerPathI) nextLevelAdvice.push('キャリアパス要件 I: 職位・職責・職務内容に応じた任用要件と賃金体系の整備が必要です');
      if (!careerPathII) nextLevelAdvice.push('キャリアパス要件 II: 研修の機会の提供または資質向上のための計画策定・実施が必要です');
      if (!workplaceEnvironment) nextLevelAdvice.push('職場環境等要件: 6カテゴリ中2カテゴリ以上で計6項目以上の取組が必要です');
    } else if (currentLevel === 'IV') {
      if (!careerPathIII) nextLevelAdvice.push('加算IIIへ: キャリアパス要件 III（昇給の仕組み）の整備が必要です');
    } else if (currentLevel === 'III') {
      if (!careerPathIV) nextLevelAdvice.push('加算IIへ: キャリアパス要件 IV（年額440万円到達者の配置）が必要です');
    } else if (currentLevel === 'II') {
      if (!careerPathV) nextLevelAdvice.push('加算Iへ: キャリアパス要件 V（福祉専門職員配置加算の届出）が必要です');
    }

    return {
      currentLevel,
      requirements: {
        careerPathI,
        careerPathII,
        careerPathIII,
        careerPathIV,
        careerPathV,
        monthlyWageImprovement,
        workplaceEnvironment,
        visibility,
      },
      qualifiesForI,
      qualifiesForII,
      qualifiesForIII,
      qualifiesForIV,
      nextLevelAdvice,
    };
  }, [fetchCareerPathRequirements, fetchWorkplaceEnvironmentItems]);

  // ---- Staff overview helpers ----

  const fetchStaffOverview = useCallback(async () => {
    if (!facilityId) return [];
    try {
      // Get active employment records
      const { data: empData } = await supabase
        .from('employment_records')
        .select('id, user_id, role, employment_type, start_date')
        .eq('facility_id', facilityId)
        .is('end_date', null);

      if (!empData || empData.length === 0) return [];

      const userIds = empData.map(e => e.user_id).filter(Boolean) as string[];
      if (userIds.length === 0) return [];

      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds);

      const usersMap = new Map((usersData || []).map(u => [u.id, u]));

      return empData.map(emp => {
        const user = usersMap.get(emp.user_id || '');
        const startDate = emp.start_date ? new Date(emp.start_date) : null;
        const tenureDays = startDate ? Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

        return {
          userId: emp.user_id || '',
          employmentRecordId: emp.id,
          name: user?.name || '不明',
          email: user?.email || '',
          role: emp.role || '一般スタッフ',
          employmentType: emp.employment_type || '常勤',
          startDate: emp.start_date || '',
          tenureDays,
        };
      });
    } catch {
      return [];
    }
  }, [facilityId]);

  return {
    loading,
    error,
    // Job Grades
    fetchJobGrades,
    saveJobGrade,
    deleteJobGrade,
    // Treatment Improvement Plans
    fetchTreatmentPlan,
    saveTreatmentPlan,
    // Career Path Requirements
    fetchCareerPathRequirements,
    updateCareerPathRequirement,
    ensureCareerPathRequirements,
    // Workplace Environment
    fetchWorkplaceEnvironmentItems,
    updateWorkplaceEnvironmentItem,
    ensureWorkplaceEnvironmentItems,
    // Wage Improvement
    fetchWageImprovementRecords,
    saveWageImprovementRecord,
    // Career Development
    fetchCareerDevelopmentRecords,
    saveCareerDevelopmentRecord,
    // Calculations
    calculateTenure,
    getAdditionLevelStatus,
    fetchStaffOverview,
    // Constants
    ADDITION_RATES,
  };
};
