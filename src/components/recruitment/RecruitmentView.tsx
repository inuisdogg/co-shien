'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Briefcase,
  Clock,
  Search,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Star,
  Users,
  FileText,
  DollarSign,
  Calendar,
  MapPin,
  CheckCircle,
  XCircle,
  ArrowRight,
  Loader2,
  Download,
  CreditCard,
  Eye,
  Edit3,
  Trash2,
  Copy,
  Send,
  BarChart3,
  MessageCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRecruitment } from '@/hooks/useRecruitment';
import {
  JobPosting,
  SpotWorkShift,
  JobApplication,
  Placement,
  JobType,
  JobStatus,
  ApplicationStatus,
  PaymentStatus,
  SalaryType,
  QUALIFICATION_CODES,
  QualificationCode,
} from '@/types';
import jsPDF from 'jspdf';
import InterviewScheduler from '@/components/recruitment/InterviewScheduler';
import RecruitmentAnalyticsView from '@/components/recruitment/RecruitmentAnalyticsView';

// ================================================================
// Constants & Labels
// ================================================================

const JOB_TYPE_LABELS: Record<JobType, string> = {
  full_time: '正社員',
  part_time: 'パート',
  spot: 'スポット',
};

const JOB_TYPE_COLORS: Record<JobType, { bg: string; text: string }> = {
  full_time: { bg: 'bg-blue-100', text: 'text-blue-700' },
  part_time: { bg: 'bg-green-100', text: 'text-green-700' },
  spot: { bg: 'bg-orange-100', text: 'text-orange-700' },
};

const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: '下書き',
  published: '公開中',
  closed: '締切',
  filled: '充足',
};

const JOB_STATUS_COLORS: Record<JobStatus, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-600' },
  published: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  closed: { bg: 'bg-red-100', text: 'text-red-600' },
  filled: { bg: 'bg-blue-100', text: 'text-blue-700' },
};

const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: '応募',
  screening: '選考中',
  interview_scheduled: '面接予定',
  interviewed: '面接済',
  offer_sent: '内定通知',
  offer_accepted: '内定承諾',
  hired: '採用',
  rejected: '不採用',
  withdrawn: '辞退',
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: '未請求',
  invoiced: '請求済',
  paid: '入金済',
  overdue: '延滞',
  refunded: '返金',
  cancelled: 'キャンセル',
};

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-600' },
  invoiced: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  paid: { bg: 'bg-green-100', text: 'text-green-700' },
  overdue: { bg: 'bg-red-100', text: 'text-red-600' },
  refunded: { bg: 'bg-purple-100', text: 'text-purple-700' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500' },
};

const SALARY_TYPE_LABELS: Record<SalaryType, string> = {
  monthly: '月給',
  hourly: '時給',
  daily: '日給',
  annual: '年俸',
};

const SPOT_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  open: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  filled: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-600', dot: 'bg-red-500' },
  completed: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
};

// Kanban pipeline columns
const KANBAN_COLUMNS: { key: string; label: string; statuses: ApplicationStatus[] }[] = [
  { key: 'applied', label: '応募', statuses: ['applied'] },
  { key: 'screening', label: '選考中', statuses: ['screening'] },
  { key: 'interview', label: '面接', statuses: ['interview_scheduled', 'interviewed'] },
  { key: 'offer', label: '内定', statuses: ['offer_sent', 'offer_accepted'] },
  { key: 'hired', label: '採用', statuses: ['hired'] },
];

// Tab definitions
type TabKey = 'postings' | 'spot' | 'applications' | 'placements' | 'analytics';
const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'postings', label: '求人管理', icon: Briefcase },
  { key: 'spot', label: 'スポットワーク', icon: Clock },
  { key: 'applications', label: '応募管理', icon: Users },
  { key: 'placements', label: '成約・請求', icon: DollarSign },
  { key: 'analytics', label: '分析', icon: BarChart3 },
];

// Qualification options for multi-select
const QUALIFICATION_OPTIONS = Object.entries(QUALIFICATION_CODES).map(([code, label]) => ({
  code: code as QualificationCode,
  label: label as string,
}));

// ================================================================
// Helper Functions
// ================================================================

function formatCurrency(amount: number): string {
  return amount.toLocaleString('ja-JP') + '円';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function formatSalaryRange(posting: JobPosting): string {
  const typeLabel = posting.salaryType ? SALARY_TYPE_LABELS[posting.salaryType] : '';
  if (posting.salaryMin && posting.salaryMax) {
    return `${typeLabel} ${formatCurrency(posting.salaryMin)} ~ ${formatCurrency(posting.salaryMax)}`;
  }
  if (posting.salaryMin) return `${typeLabel} ${formatCurrency(posting.salaryMin)} ~`;
  if (posting.salaryMax) return `${typeLabel} ~ ${formatCurrency(posting.salaryMax)}`;
  return '-';
}

function calculateFee(jobType: JobType, salary: number, hourlyRate?: number, hours?: number): { rate: number; amount: number } {
  switch (jobType) {
    case 'full_time':
      return { rate: 0.30, amount: Math.round(salary * 0.30) };
    case 'part_time':
      return { rate: 1.0, amount: Math.round(salary * 1.0) };
    case 'spot': {
      const spotFee = hourlyRate && hours ? Math.round(hourlyRate * hours * 0.10) : Math.round(salary * 0.10);
      return { rate: 0.10, amount: spotFee };
    }
    default:
      return { rate: 0, amount: 0 };
  }
}

// ================================================================
// Initial form state for job posting wizard
// ================================================================

interface JobPostingFormData {
  jobType: JobType;
  title: string;
  description: string;
  spotsNeeded: number;
  requiredQualifications: string[];
  preferredQualifications: string[];
  experienceYearsMin: number;
  salaryType: SalaryType;
  salaryMin: string;
  salaryMax: string;
  workHours: string;
  benefits: string;
  employmentType: string;
  annualSalaryEstimate: string;
  workLocation: string;
  closesAt: string;
}

const INITIAL_FORM: JobPostingFormData = {
  jobType: 'full_time',
  title: '',
  description: '',
  spotsNeeded: 1,
  requiredQualifications: [],
  preferredQualifications: [],
  experienceYearsMin: 0,
  salaryType: 'monthly',
  salaryMin: '',
  salaryMax: '',
  workHours: '',
  benefits: '',
  employmentType: '',
  annualSalaryEstimate: '',
  workLocation: '',
  closesAt: '',
};

// ================================================================
// Main Component
// ================================================================

export default function RecruitmentView() {
  const { facility, user } = useAuth();
  const facilityId = facility?.id || '';

  const {
    jobPostings,
    spotShifts,
    applications,
    placements,
    loading,
    error,
    fetchJobPostings,
    createJobPosting,
    updateJobPosting,
    publishJobPosting,
    closeJobPosting,
    fetchAllSpotShifts,
    createSpotShift,
    updateSpotShift,
    deleteSpotShift,
    fetchApplications,
    updateApplicationStatus,
    hireApplicant,
    createPlacement,
    fetchPlacements,
    updatePlacementPayment,
  } = useRecruitment();

  // ---- Global UI state ----
  const [activeTab, setActiveTab] = useState<TabKey>('postings');

  // ---- Tab 1: Postings state ----
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState<JobPostingFormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [postingTypeFilter, setPostingTypeFilter] = useState<JobType | 'all'>('all');
  const [postingStatusFilter, setPostingStatusFilter] = useState<JobStatus | 'all'>('all');
  const [postingSearch, setPostingSearch] = useState('');

  // ---- Tab 2: Spot Work state ----
  const [spotMonth, setSpotMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedSpotDate, setSelectedSpotDate] = useState<string | null>(null);
  const [showAddShift, setShowAddShift] = useState(false);
  const [shiftForm, setShiftForm] = useState({
    date: '',
    startTime: '09:00',
    endTime: '17:00',
    roleNeeded: '',
    hourlyRate: '',
    spotsAvailable: '1',
    notes: '',
    bulkCreate: false,
    bulkDates: [] as string[],
  });
  const [spotJobPostingId, setSpotJobPostingId] = useState<string>('');

  // ---- Tab 3: Applications state ----
  const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null);
  const [showApplicationDetail, setShowApplicationDetail] = useState(false);
  const [interviewNotesEdit, setInterviewNotesEdit] = useState('');
  const [ratingEdit, setRatingEdit] = useState(0);
  const [hireModalApp, setHireModalApp] = useState<JobApplication | null>(null);
  const [hireSalary, setHireSalary] = useState('');
  const [hireStartDate, setHireStartDate] = useState('');

  // ---- Messaging state ----
  const [appMessages, setAppMessages] = useState<{ id: string; senderType: string; content: string; createdAt: string }[]>([]);
  const [facilityReply, setFacilityReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // ---- Interview Scheduler state ----
  const [showInterviewScheduler, setShowInterviewScheduler] = useState(false);
  const [schedulerAppId, setSchedulerAppId] = useState('');
  const [schedulerAppName, setSchedulerAppName] = useState('');

  // ---- Tab 4: Placements state ----
  // (uses placements from hook)

  // ---- Certification state ----
  const [facilityCertificationStatus, setFacilityCertificationStatus] = useState<string>('unverified');

  // ---- Unread message counts state ----
  const [unreadByApp, setUnreadByApp] = useState<Record<string, number>>({});

  // ---- Data fetching ----
  useEffect(() => {
    if (!facilityId) return;
    fetchJobPostings();
    fetchApplications();
    fetchPlacements();

    // 施設の認証ステータスを取得
    (async () => {
      const { data } = await supabase
        .from('facilities')
        .select('certification_status')
        .eq('id', facilityId)
        .single();
      if (data?.certification_status) {
        setFacilityCertificationStatus(data.certification_status);
      }
    })();
  }, [facilityId, fetchJobPostings, fetchApplications, fetchPlacements]);

  // Fetch unread message counts for applications
  useEffect(() => {
    if (!user?.id || applications.length === 0) return;
    (async () => {
      try {
        const appIds = applications.map(a => a.id);
        const { data: msgData } = await supabase
          .from('recruitment_messages')
          .select('id, job_application_id')
          .in('job_application_id', appIds)
          .neq('sender_user_id', user.id)
          .is('read_at', null);

        const counts: Record<string, number> = {};
        for (const msg of (msgData || []) as Record<string, unknown>[]) {
          const appId = msg.job_application_id as string;
          counts[appId] = (counts[appId] || 0) + 1;
        }
        setUnreadByApp(counts);
      } catch { /* ignore */ }
    })();
  }, [user?.id, applications]);

  useEffect(() => {
    if (activeTab === 'spot' && facilityId) {
      fetchAllSpotShifts(facilityId, spotMonth);
    }
  }, [activeTab, facilityId, spotMonth, fetchAllSpotShifts]);

  // ---- Find spot job postings for dropdown ----
  const spotJobPostings = useMemo(
    () => jobPostings.filter(j => j.jobType === 'spot' && (j.status === 'published' || j.status === 'draft')),
    [jobPostings]
  );

  useEffect(() => {
    if (spotJobPostings.length > 0 && !spotJobPostingId) {
      setSpotJobPostingId(spotJobPostings[0].id);
    }
  }, [spotJobPostings, spotJobPostingId]);

  // ================================================================
  // Tab 1: Job Postings - Stats & Filtering
  // ================================================================

  const postingStats = useMemo(() => {
    const published = jobPostings.filter(j => j.status === 'published').length;
    const draft = jobPostings.filter(j => j.status === 'draft').length;
    const totalApplications = applications.length;
    const totalPlacements = placements.length;
    return { published, draft, totalApplications, totalPlacements };
  }, [jobPostings, applications, placements]);

  const filteredPostings = useMemo(() => {
    let result = jobPostings;
    if (postingTypeFilter !== 'all') {
      result = result.filter(j => j.jobType === postingTypeFilter);
    }
    if (postingStatusFilter !== 'all') {
      result = result.filter(j => j.status === postingStatusFilter);
    }
    if (postingSearch.trim()) {
      const q = postingSearch.toLowerCase();
      result = result.filter(j => j.title.toLowerCase().includes(q));
    }
    return result;
  }, [jobPostings, postingTypeFilter, postingStatusFilter, postingSearch]);

  // Count applications per posting
  const applicationCountByPosting = useMemo(() => {
    const counts: Record<string, number> = {};
    applications.forEach(a => {
      counts[a.jobPostingId] = (counts[a.jobPostingId] || 0) + 1;
    });
    return counts;
  }, [applications]);

  // ================================================================
  // Tab 1: Create Job Posting Wizard
  // ================================================================

  const handleCreateSubmit = useCallback(async (publish: boolean) => {
    setSaving(true);
    try {
      const id = await createJobPosting({
        jobType: formData.jobType,
        title: formData.title,
        description: formData.description || undefined,
        spotsNeeded: formData.spotsNeeded,
        requiredQualifications: formData.requiredQualifications,
        preferredQualifications: formData.preferredQualifications,
        experienceYearsMin: formData.experienceYearsMin,
        salaryType: formData.salaryType,
        salaryMin: formData.salaryMin ? Number(formData.salaryMin) : undefined,
        salaryMax: formData.salaryMax ? Number(formData.salaryMax) : undefined,
        workHours: formData.workHours || undefined,
        benefits: formData.benefits || undefined,
        employmentType: formData.employmentType || undefined,
        annualSalaryEstimate: formData.annualSalaryEstimate ? Number(formData.annualSalaryEstimate) : undefined,
        workLocation: formData.workLocation || undefined,
        closesAt: formData.closesAt || undefined,
        status: publish ? 'published' : 'draft',
        publishedAt: publish ? new Date().toISOString() : undefined,
      });
      if (id) {
        setShowCreateModal(false);
        setCreateStep(1);
        setFormData(INITIAL_FORM);
      }
    } finally {
      setSaving(false);
    }
  }, [formData, createJobPosting]);

  const toggleQualification = (code: string, field: 'requiredQualifications' | 'preferredQualifications') => {
    setFormData(prev => {
      const current = prev[field];
      const updated = current.includes(code)
        ? current.filter(c => c !== code)
        : [...current, code];
      return { ...prev, [field]: updated };
    });
  };

  // ================================================================
  // Tab 2: Spot Work Calendar
  // ================================================================

  const calendarDays = useMemo(() => {
    const [y, m] = spotMonth.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1).getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const days: { date: string; day: number; isCurrentMonth: boolean }[] = [];

    // Padding before first day
    for (let i = 0; i < firstDay; i++) {
      const prevDate = new Date(y, m - 1, -firstDay + i + 1);
      days.push({
        date: prevDate.toISOString().split('T')[0],
        day: prevDate.getDate(),
        isCurrentMonth: false,
      });
    }
    // Days of month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ date, day: d, isCurrentMonth: true });
    }
    // Padding after last day
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const nextDate = new Date(y, m, i);
        days.push({
          date: nextDate.toISOString().split('T')[0],
          day: nextDate.getDate(),
          isCurrentMonth: false,
        });
      }
    }
    return days;
  }, [spotMonth]);

  const shiftsByDate = useMemo(() => {
    const map: Record<string, SpotWorkShift[]> = {};
    spotShifts.forEach(s => {
      if (!map[s.shiftDate]) map[s.shiftDate] = [];
      map[s.shiftDate].push(s);
    });
    return map;
  }, [spotShifts]);

  const navigateMonth = (direction: number) => {
    const [y, m] = spotMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + direction, 1);
    setSpotMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const displayMonth = useMemo(() => {
    const [y, m] = spotMonth.split('-').map(Number);
    return `${y}年${m}月`;
  }, [spotMonth]);

  const selectedDateShifts = useMemo(() => {
    if (!selectedSpotDate) return spotShifts;
    return shiftsByDate[selectedSpotDate] || [];
  }, [selectedSpotDate, shiftsByDate, spotShifts]);

  const handleAddShift = useCallback(async () => {
    if (!spotJobPostingId) return;
    setSaving(true);
    try {
      const dates = shiftForm.bulkCreate && shiftForm.bulkDates.length > 0
        ? shiftForm.bulkDates
        : [shiftForm.date];

      for (const date of dates) {
        await createSpotShift({
          jobPostingId: spotJobPostingId,
          shiftDate: date,
          startTime: shiftForm.startTime,
          endTime: shiftForm.endTime,
          roleNeeded: shiftForm.roleNeeded || undefined,
          hourlyRate: shiftForm.hourlyRate ? Number(shiftForm.hourlyRate) : undefined,
          spotsAvailable: Number(shiftForm.spotsAvailable) || 1,
          notes: shiftForm.notes || undefined,
        });
      }
      setShowAddShift(false);
      setShiftForm({
        date: '',
        startTime: '09:00',
        endTime: '17:00',
        roleNeeded: '',
        hourlyRate: '',
        spotsAvailable: '1',
        notes: '',
        bulkCreate: false,
        bulkDates: [],
      });
      // Refetch
      fetchAllSpotShifts(facilityId, spotMonth);
    } finally {
      setSaving(false);
    }
  }, [spotJobPostingId, shiftForm, createSpotShift, fetchAllSpotShifts, facilityId, spotMonth]);

  // ================================================================
  // Tab 3: Applications Kanban
  // ================================================================

  const kanbanData = useMemo(() => {
    return KANBAN_COLUMNS.map(col => ({
      ...col,
      items: applications.filter(a => col.statuses.includes(a.status)),
    }));
  }, [applications]);

  const handleStatusChange = useCallback(async (app: JobApplication, newStatus: ApplicationStatus) => {
    await updateApplicationStatus(app.id, newStatus);
  }, [updateApplicationStatus]);

  const handleOpenHireModal = (app: JobApplication) => {
    setHireModalApp(app);
    setHireSalary(app.agreedSalary?.toString() || '');
    setHireStartDate(app.startDate || new Date().toISOString().split('T')[0]);
  };

  const handleHireConfirm = useCallback(async () => {
    if (!hireModalApp || !hireSalary) return;
    setSaving(true);
    try {
      const result = await hireApplicant(hireModalApp.id, Number(hireSalary), hireStartDate);
      if (result) {
        // Create placement
        const jt = result.jobType || 'full_time';
        const { rate } = calculateFee(jt, Number(hireSalary));
        await createPlacement(result.id, Number(hireSalary), rate);
        setHireModalApp(null);
        fetchPlacements();
      }
    } finally {
      setSaving(false);
    }
  }, [hireModalApp, hireSalary, hireStartDate, hireApplicant, createPlacement, fetchPlacements]);

  // ================================================================
  // Tab 4: Placements & Billing
  // ================================================================

  const placementStats = useMemo(() => {
    const total = placements.length;
    const pending = placements.filter(p => p.paymentStatus === 'pending').length;
    const invoiced = placements.filter(p => p.paymentStatus === 'invoiced').length;
    const paid = placements.filter(p => p.paymentStatus === 'paid').length;
    return { total, pending, invoiced, paid };
  }, [placements]);

  const handlePayment = useCallback(async (placement: Placement) => {
    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placementId: placement.id,
          amount: placement.feeAmount,
          description: `人材紹介手数料 - ${placement.workerName || ''}`,
        }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      console.error('Payment error:', e);
    }
  }, []);

  const handleGenerateInvoicePdf = useCallback((placement: Placement) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.text('請求書', 105, 30, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`発行日: ${formatDate(new Date().toISOString())}`, 150, 45);

    // Facility info
    doc.setFontSize(12);
    doc.text(`請求先: ${facility?.name || ''}`, 20, 60);

    // Line
    doc.setDrawColor(0, 196, 204);
    doc.setLineWidth(0.5);
    doc.line(20, 70, 190, 70);

    // Details
    doc.setFontSize(10);
    let y = 85;
    doc.text('項目', 20, y);
    doc.text('内容', 80, y);
    doc.text('金額', 160, y);

    y += 5;
    doc.line(20, y, 190, y);

    y += 10;
    doc.text('人材紹介手数料', 20, y);
    doc.text(placement.workerName || '-', 80, y);
    doc.text(formatCurrency(placement.feeAmount), 160, y);

    y += 10;
    doc.text(`  雇用形態: ${JOB_TYPE_LABELS[placement.jobType]}`, 20, y);

    y += 8;
    doc.text(`  合意給与: ${formatCurrency(placement.agreedSalary)}`, 20, y);

    y += 8;
    doc.text(`  手数料率: ${(placement.feeRate * 100).toFixed(0)}%`, 20, y);

    y += 15;
    doc.line(20, y, 190, y);

    y += 10;
    doc.setFontSize(14);
    doc.text(`合計: ${formatCurrency(placement.feeAmount)}`, 160, y, { align: 'right' });

    // Footer
    doc.setFontSize(8);
    doc.text('* この請求書は自動生成されたものです', 20, 270);

    doc.save(`invoice_${placement.id.slice(0, 8)}.pdf`);
  }, [facility?.name]);

  // ================================================================
  // Render: Loading
  // ================================================================

  if (loading && jobPostings.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]" />
      </div>
    );
  }

  // ================================================================
  // Render: Tab Navigation
  // ================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Briefcase className="w-6 h-6 text-[#00c4cc]" />
          <h1 className="text-xl font-bold text-gray-800">採用・人材紹介</h1>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors flex-1 justify-center ${
                isActive
                  ? 'bg-white text-[#00c4cc] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* ============================================================ */}
      {/* Tab 1: Job Postings */}
      {/* ============================================================ */}
      {activeTab === 'postings' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: '公開中', value: postingStats.published, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Send },
              { label: '下書き', value: postingStats.draft, color: 'text-gray-600', bg: 'bg-gray-50', icon: FileText },
              { label: '総応募', value: postingStats.totalApplications, color: 'text-blue-600', bg: 'bg-blue-50', icon: Users },
              { label: '成約数', value: postingStats.totalPlacements, color: 'text-[#00c4cc]', bg: 'bg-teal-50', icon: CheckCircle },
            ].map(stat => {
              const SIcon = stat.icon;
              return (
                <div key={stat.label} className={`${stat.bg} rounded-xl p-4 border border-gray-100`}>
                  <div className="flex items-center gap-2 mb-1">
                    <SIcon className={`w-4 h-4 ${stat.color}`} />
                    <span className="text-xs text-gray-500">{stat.label}</span>
                  </div>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              );
            })}
          </div>

          {/* Filters & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={postingTypeFilter}
              onChange={e => setPostingTypeFilter(e.target.value as JobType | 'all')}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
            >
              <option value="all">全種別</option>
              <option value="full_time">正社員</option>
              <option value="part_time">パート</option>
              <option value="spot">スポット</option>
            </select>
            <select
              value={postingStatusFilter}
              onChange={e => setPostingStatusFilter(e.target.value as JobStatus | 'all')}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
            >
              <option value="all">全ステータス</option>
              <option value="draft">下書き</option>
              <option value="published">公開中</option>
              <option value="closed">締切</option>
              <option value="filled">充足</option>
            </select>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={postingSearch}
                onChange={e => setPostingSearch(e.target.value)}
                placeholder="求人タイトルで検索..."
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
              />
            </div>
            <button
              onClick={() => { setShowCreateModal(true); setCreateStep(1); setFormData(INITIAL_FORM); }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white text-sm font-medium rounded-lg transition-colors shadow-sm ml-auto"
            >
              <Plus className="w-4 h-4" />
              新規求人
            </button>
          </div>

          {/* Job Postings Table */}
          {filteredPostings.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">求人がありません</p>
              <button
                onClick={() => { setShowCreateModal(true); setCreateStep(1); setFormData(INITIAL_FORM); }}
                className="mt-3 text-sm text-[#00c4cc] hover:underline"
              >
                求人を作成する
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">タイトル</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">種別</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">給与</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">応募数</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">ステータス</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPostings.map(posting => {
                      const typeColor = JOB_TYPE_COLORS[posting.jobType];
                      const statusColor = JOB_STATUS_COLORS[posting.status];
                      return (
                        <tr key={posting.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">{posting.title}</p>
                            <p className="text-xs text-gray-400 mt-0.5">作成: {formatDate(posting.createdAt)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${typeColor.bg} ${typeColor.text}`}>
                              {JOB_TYPE_LABELS[posting.jobType]}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                            {formatSalaryRange(posting)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-semibold text-gray-700">{applicationCountByPosting[posting.id] || 0}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor.bg} ${statusColor.text}`}>
                              {JOB_STATUS_LABELS[posting.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {posting.status === 'draft' && (
                                <button
                                  onClick={() => publishJobPosting(posting.id)}
                                  className="p-1.5 text-[#00c4cc] hover:bg-teal-50 rounded-lg transition-colors"
                                  title="公開する"
                                >
                                  <Send className="w-4 h-4" />
                                </button>
                              )}
                              {posting.status === 'published' && (
                                <button
                                  onClick={() => closeJobPosting(posting.id)}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="締め切る"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setFormData({
                                    jobType: posting.jobType,
                                    title: posting.title,
                                    description: posting.description || '',
                                    spotsNeeded: posting.spotsNeeded,
                                    requiredQualifications: posting.requiredQualifications,
                                    preferredQualifications: posting.preferredQualifications,
                                    experienceYearsMin: posting.experienceYearsMin,
                                    salaryType: posting.salaryType || 'monthly',
                                    salaryMin: posting.salaryMin?.toString() || '',
                                    salaryMax: posting.salaryMax?.toString() || '',
                                    workHours: posting.workHours || '',
                                    benefits: posting.benefits || '',
                                    employmentType: posting.employmentType || '',
                                    annualSalaryEstimate: posting.annualSalaryEstimate?.toString() || '',
                                    workLocation: posting.workLocation || '',
                                    closesAt: posting.closesAt || '',
                                  });
                                  setShowCreateModal(true);
                                  setCreateStep(1);
                                }}
                                className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                                title="編集"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Create/Edit Modal (3-step wizard) */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">新規求人作成</h2>
                    <p className="text-sm text-gray-400 mt-0.5">ステップ {createStep} / 3</p>
                  </div>
                  <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-2 px-6 py-3 bg-gray-50">
                  {[1, 2, 3].map(step => (
                    <div key={step} className="flex items-center gap-2 flex-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        step <= createStep ? 'bg-[#00c4cc] text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {step}
                      </div>
                      <span className="text-xs text-gray-500 hidden sm:inline">
                        {step === 1 ? '基本情報' : step === 2 ? '条件' : '確認'}
                      </span>
                      {step < 3 && <div className="flex-1 h-px bg-gray-200" />}
                    </div>
                  ))}
                </div>

                {/* Step 1: Basic Info */}
                {createStep === 1 && (
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">雇用形態</label>
                      <div className="flex gap-3">
                        {(['full_time', 'part_time', 'spot'] as JobType[]).map(jt => (
                          <label
                            key={jt}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-xl cursor-pointer transition-colors ${
                              formData.jobType === jt
                                ? 'border-[#00c4cc] bg-teal-50 text-[#00c4cc]'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name="jobType"
                              value={jt}
                              checked={formData.jobType === jt}
                              onChange={() => setFormData(prev => ({ ...prev, jobType: jt }))}
                              className="sr-only"
                            />
                            <span className="text-sm font-medium">{JOB_TYPE_LABELS[jt]}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">求人タイトル</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="例: 児童発達支援管理責任者（正社員）"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">業務内容・説明</label>
                      <textarea
                        value={formData.description}
                        onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows={4}
                        placeholder="業務内容、施設の特徴、求める人物像など..."
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">募集人数</label>
                      <input
                        type="number"
                        min={1}
                        value={formData.spotsNeeded}
                        onChange={e => setFormData(prev => ({ ...prev, spotsNeeded: Number(e.target.value) || 1 }))}
                        className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => setCreateStep(2)}
                        disabled={!formData.title}
                        className="inline-flex items-center gap-2 px-6 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        次へ
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Conditions */}
                {createStep === 2 && (
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">必須資格</label>
                      <div className="flex flex-wrap gap-2">
                        {QUALIFICATION_OPTIONS.map(q => (
                          <button
                            key={q.code}
                            onClick={() => toggleQualification(q.code, 'requiredQualifications')}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              formData.requiredQualifications.includes(q.code)
                                ? 'border-[#00c4cc] bg-teal-50 text-[#00c4cc]'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">歓迎資格</label>
                      <div className="flex flex-wrap gap-2">
                        {QUALIFICATION_OPTIONS.map(q => (
                          <button
                            key={q.code}
                            onClick={() => toggleQualification(q.code, 'preferredQualifications')}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              formData.preferredQualifications.includes(q.code)
                                ? 'border-blue-400 bg-blue-50 text-blue-600'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">最低経験年数</label>
                        <input
                          type="number"
                          min={0}
                          value={formData.experienceYearsMin}
                          onChange={e => setFormData(prev => ({ ...prev, experienceYearsMin: Number(e.target.value) || 0 }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">雇用区分</label>
                        <input
                          type="text"
                          value={formData.employmentType}
                          onChange={e => setFormData(prev => ({ ...prev, employmentType: e.target.value }))}
                          placeholder="例: 常勤、非常勤"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">給与タイプ</label>
                        <select
                          value={formData.salaryType}
                          onChange={e => setFormData(prev => ({ ...prev, salaryType: e.target.value as SalaryType }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                        >
                          {Object.entries(SALARY_TYPE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">最低給与</label>
                        <input
                          type="number"
                          value={formData.salaryMin}
                          onChange={e => setFormData(prev => ({ ...prev, salaryMin: e.target.value }))}
                          placeholder="例: 250000"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">最高給与</label>
                        <input
                          type="number"
                          value={formData.salaryMax}
                          onChange={e => setFormData(prev => ({ ...prev, salaryMax: e.target.value }))}
                          placeholder="例: 350000"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                        />
                      </div>
                    </div>

                    {formData.jobType === 'full_time' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                          想定年収（手数料計算用: 30%）
                        </label>
                        <input
                          type="number"
                          value={formData.annualSalaryEstimate}
                          onChange={e => setFormData(prev => ({ ...prev, annualSalaryEstimate: e.target.value }))}
                          placeholder="例: 4000000"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                        />
                        {formData.annualSalaryEstimate && (
                          <p className="text-xs text-gray-400 mt-1">
                            紹介手数料（概算）: {formatCurrency(Math.round(Number(formData.annualSalaryEstimate) * 0.30))}
                          </p>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">勤務時間</label>
                      <input
                        type="text"
                        value={formData.workHours}
                        onChange={e => setFormData(prev => ({ ...prev, workHours: e.target.value }))}
                        placeholder="例: 9:00~18:00（休憩60分）"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">福利厚生</label>
                      <textarea
                        value={formData.benefits}
                        onChange={e => setFormData(prev => ({ ...prev, benefits: e.target.value }))}
                        rows={2}
                        placeholder="例: 社会保険完備、交通費支給、研修制度あり..."
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] resize-none"
                      />
                    </div>

                    <div className="flex justify-between pt-2">
                      <button
                        onClick={() => setCreateStep(1)}
                        className="inline-flex items-center gap-2 px-6 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        戻る
                      </button>
                      <button
                        onClick={() => setCreateStep(3)}
                        className="inline-flex items-center gap-2 px-6 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        次へ
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Confirmation */}
                {createStep === 3 && (
                  <div className="p-6 space-y-4">
                    <h3 className="text-base font-bold text-gray-800 mb-2">内容確認</h3>
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        <div>
                          <span className="text-gray-500">雇用形態:</span>
                          <span className="ml-2 font-medium">{JOB_TYPE_LABELS[formData.jobType]}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">募集人数:</span>
                          <span className="ml-2 font-medium">{formData.spotsNeeded}名</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500">タイトル:</span>
                          <span className="ml-2 font-medium">{formData.title}</span>
                        </div>
                        {formData.description && (
                          <div className="col-span-2">
                            <span className="text-gray-500">説明:</span>
                            <p className="mt-1 text-gray-700 whitespace-pre-wrap text-xs">{formData.description}</p>
                          </div>
                        )}
                        {formData.requiredQualifications.length > 0 && (
                          <div className="col-span-2">
                            <span className="text-gray-500">必須資格:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {formData.requiredQualifications.map(q => (
                                <span key={q} className="px-2 py-0.5 bg-teal-50 text-[#00c4cc] rounded-full text-xs">
                                  {QUALIFICATION_CODES[q as QualificationCode] || q}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">給与:</span>
                          <span className="ml-2 font-medium">
                            {SALARY_TYPE_LABELS[formData.salaryType]}
                            {formData.salaryMin && ` ${Number(formData.salaryMin).toLocaleString()}円`}
                            {formData.salaryMin && formData.salaryMax && ' ~'}
                            {formData.salaryMax && ` ${Number(formData.salaryMax).toLocaleString()}円`}
                          </span>
                        </div>
                        {formData.experienceYearsMin > 0 && (
                          <div>
                            <span className="text-gray-500">経験:</span>
                            <span className="ml-2 font-medium">{formData.experienceYearsMin}年以上</span>
                          </div>
                        )}
                        {formData.workHours && (
                          <div>
                            <span className="text-gray-500">勤務時間:</span>
                            <span className="ml-2 font-medium">{formData.workHours}</span>
                          </div>
                        )}
                        {formData.annualSalaryEstimate && formData.jobType === 'full_time' && (
                          <div>
                            <span className="text-gray-500">想定年収:</span>
                            <span className="ml-2 font-medium">{Number(formData.annualSalaryEstimate).toLocaleString()}円</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between pt-2">
                      <button
                        onClick={() => setCreateStep(2)}
                        className="inline-flex items-center gap-2 px-6 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        戻る
                      </button>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleCreateSubmit(false)}
                          disabled={saving}
                          className="inline-flex items-center gap-2 px-6 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                          下書き保存
                        </button>
                        <button
                          onClick={() => handleCreateSubmit(true)}
                          disabled={saving}
                          className="inline-flex items-center gap-2 px-6 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                          <Send className="w-4 h-4" />
                          公開する
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* Tab 2: Spot Work */}
      {/* ============================================================ */}
      {activeTab === 'spot' && (
        <div className="space-y-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h2 className="text-lg font-bold text-gray-800">{displayMonth}</h2>
              <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              {spotJobPostings.length > 0 && (
                <select
                  value={spotJobPostingId}
                  onChange={e => setSpotJobPostingId(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                >
                  {spotJobPostings.map(jp => (
                    <option key={jp.id} value={jp.id}>{jp.title}</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => {
                  setShowAddShift(true);
                  setShiftForm(prev => ({ ...prev, date: selectedSpotDate || '' }));
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                シフト追加
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
              {['日', '月', '火', '水', '木', '金', '土'].map(d => (
                <div key={d} className="px-2 py-2 text-center text-xs font-medium text-gray-500">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                const shifts = shiftsByDate[day.date] || [];
                const isSelected = selectedSpotDate === day.date;
                const isToday = day.date === new Date().toISOString().split('T')[0];
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedSpotDate(isSelected ? null : day.date)}
                    className={`min-h-[72px] p-1.5 border-b border-r border-gray-100 text-left transition-colors ${
                      !day.isCurrentMonth ? 'bg-gray-50 text-gray-300' : ''
                    } ${isSelected ? 'bg-teal-50 ring-2 ring-[#00c4cc] ring-inset' : 'hover:bg-gray-50'}
                    ${isToday && !isSelected ? 'bg-blue-50' : ''}`}
                  >
                    <span className={`text-xs font-medium ${isToday ? 'text-[#00c4cc] font-bold' : ''}`}>
                      {day.day}
                    </span>
                    <div className="flex flex-wrap gap-0.5 mt-1">
                      {shifts.slice(0, 3).map(s => {
                        const sc = SPOT_STATUS_COLORS[s.status] || SPOT_STATUS_COLORS.open;
                        return (
                          <div key={s.id} className={`w-2 h-2 rounded-full ${sc.dot}`} title={`${s.startTime}-${s.endTime}`} />
                        );
                      })}
                      {shifts.length > 3 && (
                        <span className="text-[10px] text-gray-400">+{shifts.length - 3}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Shift List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">
              {selectedSpotDate ? `${formatDate(selectedSpotDate)} のシフト` : '今後のシフト'}
            </h3>
            {selectedDateShifts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">シフトがありません</p>
            ) : (
              <div className="space-y-2">
                {selectedDateShifts.map(shift => {
                  const sc = SPOT_STATUS_COLORS[shift.status] || SPOT_STATUS_COLORS.open;
                  return (
                    <div key={shift.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${sc.dot}`} />
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {shift.startTime} - {shift.endTime}
                          </p>
                          <p className="text-xs text-gray-500">
                            {shift.roleNeeded || 'スタッフ'} | {shift.hourlyRate ? `${formatCurrency(shift.hourlyRate)}/h` : '-'}
                            {' | '}{shift.spotsFilled}/{shift.spotsAvailable}名
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                          {shift.status === 'open' ? '募集中' : shift.status === 'filled' ? '充足' : shift.status === 'cancelled' ? '中止' : '完了'}
                        </span>
                        <button
                          onClick={() => deleteSpotShift(shift.id)}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Shift Modal */}
          {showAddShift && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800">シフト追加</h2>
                  <button onClick={() => setShowAddShift(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">日付</label>
                    <input
                      type="date"
                      value={shiftForm.date}
                      onChange={e => setShiftForm(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">開始時間</label>
                      <input
                        type="time"
                        value={shiftForm.startTime}
                        onChange={e => setShiftForm(prev => ({ ...prev, startTime: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">終了時間</label>
                      <input
                        type="time"
                        value={shiftForm.endTime}
                        onChange={e => setShiftForm(prev => ({ ...prev, endTime: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">必要な役割</label>
                    <input
                      type="text"
                      value={shiftForm.roleNeeded}
                      onChange={e => setShiftForm(prev => ({ ...prev, roleNeeded: e.target.value }))}
                      placeholder="例: 保育士、児童指導員"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">時給</label>
                      <input
                        type="number"
                        value={shiftForm.hourlyRate}
                        onChange={e => setShiftForm(prev => ({ ...prev, hourlyRate: e.target.value }))}
                        placeholder="例: 1500"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">募集人数</label>
                      <input
                        type="number"
                        min={1}
                        value={shiftForm.spotsAvailable}
                        onChange={e => setShiftForm(prev => ({ ...prev, spotsAvailable: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">備考</label>
                    <textarea
                      value={shiftForm.notes}
                      onChange={e => setShiftForm(prev => ({ ...prev, notes: e.target.value }))}
                      rows={2}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] resize-none"
                    />
                  </div>

                  {/* Bulk create */}
                  <div className="border-t border-gray-100 pt-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shiftForm.bulkCreate}
                        onChange={e => setShiftForm(prev => ({ ...prev, bulkCreate: e.target.checked, bulkDates: [] }))}
                        className="rounded border-gray-300 text-[#00c4cc] focus:ring-[#00c4cc]"
                      />
                      <span className="text-sm text-gray-600">同じ枠を複数日に作成</span>
                    </label>
                    {shiftForm.bulkCreate && (
                      <div className="mt-2">
                        <label className="block text-xs text-gray-500 mb-1">追加日を選択（複数可）</label>
                        <input
                          type="date"
                          onChange={e => {
                            const val = e.target.value;
                            if (val && !shiftForm.bulkDates.includes(val)) {
                              setShiftForm(prev => ({ ...prev, bulkDates: [...prev.bulkDates, val].sort() }));
                            }
                          }}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                        />
                        {shiftForm.bulkDates.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {shiftForm.bulkDates.map(d => (
                              <span
                                key={d}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 text-[#00c4cc] rounded-full text-xs"
                              >
                                {formatDate(d)}
                                <button
                                  onClick={() => setShiftForm(prev => ({ ...prev, bulkDates: prev.bulkDates.filter(bd => bd !== d) }))}
                                  className="hover:text-red-500"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => setShowAddShift(false)}
                      className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleAddShift}
                      disabled={saving || (!shiftForm.date && !shiftForm.bulkCreate) || (shiftForm.bulkCreate && shiftForm.bulkDates.length === 0)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                      追加
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* Tab 3: Applications (Kanban) */}
      {/* ============================================================ */}
      {activeTab === 'applications' && (
        <div className="space-y-6">
          {/* Kanban Board */}
          <div className="flex gap-4 overflow-x-auto pb-4">
            {kanbanData.map(col => (
              <div key={col.key} className="flex-shrink-0 w-64">
                <div className="bg-gray-100 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-700">{col.label}</h3>
                    <span className="bg-white px-2 py-0.5 rounded-full text-xs font-medium text-gray-500">
                      {col.items.length}
                    </span>
                  </div>
                  <div className="space-y-2 min-h-[200px]">
                    {col.items.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-8">なし</p>
                    )}
                    {col.items.map(app => (
                      <button
                        key={app.id}
                        onClick={async () => {
                          setSelectedApplication(app);
                          setShowApplicationDetail(true);
                          setInterviewNotesEdit(app.interviewNotes || '');
                          setRatingEdit(app.facilityRating || 0);
                          // Fetch messages for this application
                          setLoadingMessages(true);
                          setAppMessages([]);
                          try {
                            const { supabase: sb } = await import('@/lib/supabase');
                            const { data: msgs } = await sb
                              .from('recruitment_messages')
                              .select('id, sender_type, sender_user_id, content, created_at')
                              .eq('job_application_id', app.id)
                              .order('created_at', { ascending: true });
                            setAppMessages((msgs || []).map((m: Record<string, unknown>) => ({
                              id: m.id as string,
                              senderType: m.sender_type as string,
                              content: m.content as string,
                              createdAt: m.created_at as string,
                            })));
                            // Mark applicant messages as read
                            if (user?.id) {
                              await sb
                                .from('recruitment_messages')
                                .update({ read_at: new Date().toISOString() })
                                .eq('job_application_id', app.id)
                                .neq('sender_user_id', user.id)
                                .is('read_at', null);
                              // Clear unread badge for this application
                              setUnreadByApp(prev => {
                                const next = { ...prev };
                                delete next[app.id];
                                return next;
                              });
                            }
                          } catch { /* ignore */ }
                          setLoadingMessages(false);
                        }}
                        className="w-full bg-white rounded-lg p-3 shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow relative"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {app.applicantName || '名前未設定'}
                          </p>
                          {(unreadByApp[app.id] || 0) > 0 && (
                            <span className="inline-flex items-center gap-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 ml-1 shrink-0">
                              <MessageCircle className="w-2.5 h-2.5" />
                              {unreadByApp[app.id]}
                            </span>
                          )}
                        </div>
                        {app.applicantQualifications && app.applicantQualifications.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {app.applicantQualifications.slice(0, 2).map(q => (
                              <span key={q} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px]">
                                {QUALIFICATION_CODES[q as QualificationCode] || q}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-gray-400">{formatDate(app.createdAt)}</span>
                          {app.jobTitle && (
                            <span className="text-[10px] text-gray-500 truncate max-w-[100px]">{app.jobTitle}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Application Detail Modal */}
          {showApplicationDetail && selectedApplication && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-800">応募詳細</h2>
                    {facilityCertificationStatus === 'verified' && (
                      <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        認証済み
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => { setShowApplicationDetail(false); setSelectedApplication(null); }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  {/* Applicant Info */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <h3 className="text-sm font-bold text-gray-700">応募者情報</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">氏名:</span>
                        <span className="ml-1 font-medium">{selectedApplication.applicantName || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">メール:</span>
                        <span className="ml-1 font-medium text-xs">{selectedApplication.applicantEmail || '-'}</span>
                      </div>
                    </div>
                    {selectedApplication.applicantQualifications && selectedApplication.applicantQualifications.length > 0 && (
                      <div>
                        <span className="text-xs text-gray-500">資格:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedApplication.applicantQualifications.map(q => (
                            <span key={q} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs">
                              {QUALIFICATION_CODES[q as QualificationCode] || q}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Job Info */}
                  <div className="text-sm">
                    <span className="text-gray-500">求人:</span>
                    <span className="ml-1 font-medium">{selectedApplication.jobTitle || '-'}</span>
                    {selectedApplication.jobType && (
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${JOB_TYPE_COLORS[selectedApplication.jobType].bg} ${JOB_TYPE_COLORS[selectedApplication.jobType].text}`}>
                        {JOB_TYPE_LABELS[selectedApplication.jobType]}
                      </span>
                    )}
                  </div>

                  {/* Cover Message */}
                  {selectedApplication.coverMessage && (
                    <div>
                      <h3 className="text-sm font-bold text-gray-700 mb-1">志望動機</h3>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">
                        {selectedApplication.coverMessage}
                      </p>
                    </div>
                  )}

                  {/* Applicant Work Preferences */}
                  {(selectedApplication.preferredDays || selectedApplication.preferredHoursPerWeek || selectedApplication.preferredStartTime || selectedApplication.preferredNotes) && (
                    <div>
                      <h3 className="text-sm font-bold text-gray-700 mb-2">応募者の希望条件</h3>
                      <div className="bg-indigo-50 rounded-xl p-4 space-y-2 text-sm">
                        {selectedApplication.preferredDays && (
                          <div className="flex items-start gap-2">
                            <span className="text-gray-500 shrink-0">希望曜日:</span>
                            <div className="flex flex-wrap gap-1">
                              {selectedApplication.preferredDays.split(',').map(day => (
                                <span key={day} className="px-2 py-0.5 bg-white rounded-full text-xs font-medium text-indigo-700 border border-indigo-200">
                                  {day}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {selectedApplication.preferredHoursPerWeek && (
                          <div>
                            <span className="text-gray-500">希望時間/週:</span>
                            <span className="ml-1 font-medium">{selectedApplication.preferredHoursPerWeek}時間</span>
                          </div>
                        )}
                        {(selectedApplication.preferredStartTime || selectedApplication.preferredEndTime) && (
                          <div>
                            <span className="text-gray-500">希望時間帯:</span>
                            <span className="ml-1 font-medium">
                              {selectedApplication.preferredStartTime || '--:--'} 〜 {selectedApplication.preferredEndTime || '--:--'}
                            </span>
                          </div>
                        )}
                        {selectedApplication.preferredNotes && (
                          <div>
                            <span className="text-gray-500">その他希望:</span>
                            <p className="mt-0.5 text-gray-700 whitespace-pre-wrap">{selectedApplication.preferredNotes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Interview Notes */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-1">面接メモ</h3>
                    <textarea
                      value={interviewNotesEdit}
                      onChange={e => setInterviewNotesEdit(e.target.value)}
                      rows={3}
                      placeholder="面接の所感やメモを記入..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc] resize-none"
                    />
                  </div>

                  {/* Rating */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-1">評価</h3>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          onClick={() => setRatingEdit(star)}
                          className="p-0.5"
                        >
                          <Star
                            className={`w-6 h-6 ${star <= ratingEdit ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                          />
                        </button>
                      ))}
                      <span className="ml-2 text-sm text-gray-500">{ratingEdit > 0 ? `${ratingEdit}/5` : '-'}</span>
                    </div>
                  </div>

                  {/* Messages */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2">メッセージ</h3>
                    {loadingMessages ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      </div>
                    ) : appMessages.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">メッセージはまだありません</p>
                    ) : (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto bg-gray-50 rounded-lg p-3">
                        {appMessages.map(msg => {
                          const isFacility = msg.senderType === 'facility';
                          return (
                            <div key={msg.id} className={`flex ${isFacility ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${isFacility ? 'bg-[#00c4cc] text-white' : 'bg-white text-gray-800 border border-gray-200'}`}>
                                {!isFacility && <p className="text-[10px] text-gray-500 mb-0.5">応募者</p>}
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                <p className={`text-[10px] mt-0.5 ${isFacility ? 'text-white/70' : 'text-gray-400'}`}>
                                  {new Date(msg.createdAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Reply input */}
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={facilityReply}
                        onChange={e => setFacilityReply(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && !e.shiftKey && facilityReply.trim() && selectedApplication) {
                            e.preventDefault();
                            setSendingReply(true);
                            try {
                              const { supabase: sb } = await import('@/lib/supabase');
                              const { data: newMsg } = await sb
                                .from('recruitment_messages')
                                .insert({
                                  job_application_id: selectedApplication.id,
                                  sender_user_id: user?.id || '',
                                  sender_type: 'facility',
                                  content: facilityReply.trim(),
                                })
                                .select()
                                .single();
                              if (newMsg) {
                                setAppMessages(prev => [...prev, {
                                  id: (newMsg as Record<string, unknown>).id as string,
                                  senderType: 'facility',
                                  content: facilityReply.trim(),
                                  createdAt: (newMsg as Record<string, unknown>).created_at as string,
                                }]);
                              }
                              setFacilityReply('');
                            } catch { /* ignore */ }
                            setSendingReply(false);
                          }
                        }}
                        placeholder="返信を入力..."
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      />
                      <button
                        onClick={async () => {
                          if (!facilityReply.trim() || !selectedApplication) return;
                          setSendingReply(true);
                          try {
                            const { supabase: sb } = await import('@/lib/supabase');
                            const { data: newMsg } = await sb
                              .from('recruitment_messages')
                              .insert({
                                job_application_id: selectedApplication.id,
                                sender_user_id: user?.id || '',
                                sender_type: 'facility',
                                content: facilityReply.trim(),
                              })
                              .select()
                              .single();
                            if (newMsg) {
                              setAppMessages(prev => [...prev, {
                                id: (newMsg as Record<string, unknown>).id as string,
                                senderType: 'facility',
                                content: facilityReply.trim(),
                                createdAt: (newMsg as Record<string, unknown>).created_at as string,
                              }]);
                            }
                            setFacilityReply('');
                          } catch { /* ignore */ }
                          setSendingReply(false);
                        }}
                        disabled={sendingReply || !facilityReply.trim()}
                        className="px-3 py-1.5 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors disabled:opacity-40"
                      >
                        {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-1">
                      現在のステータス: {APPLICATION_STATUS_LABELS[selectedApplication.status]}
                    </h3>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                    {/* Save notes/rating */}
                    <button
                      onClick={async () => {
                        await updateApplicationStatus(selectedApplication.id, selectedApplication.status, interviewNotesEdit);
                        // also update rating
                        const { error: rErr } = await (await import('@/lib/supabase')).supabase
                          .from('job_applications')
                          .update({
                            interview_notes: interviewNotesEdit,
                            facility_rating: ratingEdit || null,
                            updated_at: new Date().toISOString(),
                          })
                          .eq('id', selectedApplication.id);
                        if (!rErr) {
                          fetchApplications();
                        }
                        setShowApplicationDetail(false);
                      }}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      メモ保存
                    </button>

                    {/* スカウト送信 */}
                    <button
                      onClick={() => {
                        const subject = prompt('スカウトの件名を入力:');
                        if (!subject) return;
                        const message = prompt('スカウトメッセージを入力:');
                        if (!message) return;
                        supabase.from('scout_messages').insert({
                          facility_id: facilityId,
                          sender_user_id: user?.id || '',
                          target_user_id: selectedApplication.applicantUserId,
                          job_posting_id: selectedApplication.jobPostingId,
                          subject,
                          message,
                        }).then(() => {
                          alert('スカウトを送信しました');
                        });
                      }}
                      className="px-3 py-1.5 bg-purple-500 text-white text-xs font-medium rounded-lg hover:bg-purple-600 transition-colors"
                    >
                      スカウト送信
                    </button>

                    {/* 面接日程を提案 */}
                    {(selectedApplication.status === 'interview_scheduled' || selectedApplication.status === 'screening') && (
                      <button
                        onClick={() => {
                          setSchedulerAppId(selectedApplication.id);
                          setSchedulerAppName(selectedApplication.applicantName || '応募者');
                          setShowInterviewScheduler(true);
                          setShowApplicationDetail(false);
                        }}
                        className="px-3 py-1.5 bg-purple-500 text-white text-xs font-medium rounded-lg hover:bg-purple-600 transition-colors"
                      >
                        面接日程を提案
                      </button>
                    )}

                    {/* Status progression buttons */}
                    {selectedApplication.status === 'applied' && (
                      <button
                        onClick={() => { handleStatusChange(selectedApplication, 'screening'); setShowApplicationDetail(false); }}
                        className="px-3 py-1.5 bg-[#00c4cc] text-white text-xs font-medium rounded-lg hover:bg-[#00b0b8] transition-colors"
                      >
                        選考開始
                      </button>
                    )}
                    {selectedApplication.status === 'screening' && (
                      <button
                        onClick={() => { handleStatusChange(selectedApplication, 'interview_scheduled'); setShowApplicationDetail(false); }}
                        className="px-3 py-1.5 bg-[#00c4cc] text-white text-xs font-medium rounded-lg hover:bg-[#00b0b8] transition-colors"
                      >
                        面接設定
                      </button>
                    )}
                    {(selectedApplication.status === 'interview_scheduled' || selectedApplication.status === 'interviewed') && (
                      <button
                        onClick={() => { handleStatusChange(selectedApplication, 'offer_sent'); setShowApplicationDetail(false); }}
                        className="px-3 py-1.5 bg-[#00c4cc] text-white text-xs font-medium rounded-lg hover:bg-[#00b0b8] transition-colors"
                      >
                        内定通知
                      </button>
                    )}
                    {(selectedApplication.status === 'offer_sent' || selectedApplication.status === 'offer_accepted') && (
                      <button
                        onClick={() => {
                          setShowApplicationDetail(false);
                          handleOpenHireModal(selectedApplication);
                        }}
                        className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-medium rounded-lg hover:bg-emerald-600 transition-colors"
                      >
                        採用確定
                      </button>
                    )}

                    {/* Reject / Withdraw */}
                    {selectedApplication.status !== 'hired' && selectedApplication.status !== 'rejected' && selectedApplication.status !== 'withdrawn' && (
                      <>
                        <button
                          onClick={() => { handleStatusChange(selectedApplication, 'rejected'); setShowApplicationDetail(false); }}
                          className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 transition-colors"
                        >
                          不採用
                        </button>
                        <button
                          onClick={() => { handleStatusChange(selectedApplication, 'withdrawn'); setShowApplicationDetail(false); }}
                          className="px-3 py-1.5 bg-gray-50 text-gray-500 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          辞退
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Hire Modal */}
          {hireModalApp && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800">採用確定</h2>
                  <button onClick={() => setHireModalApp(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm font-medium text-gray-800">{hireModalApp.applicantName || '-'}</p>
                    <p className="text-xs text-gray-500 mt-1">求人: {hireModalApp.jobTitle || '-'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">合意給与（円）</label>
                    <input
                      type="number"
                      value={hireSalary}
                      onChange={e => setHireSalary(e.target.value)}
                      placeholder="例: 300000"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                    />
                    {hireSalary && hireModalApp.jobType && (
                      <div className="mt-2 bg-teal-50 rounded-lg p-3">
                        <p className="text-xs text-gray-600">
                          紹介手数料（自動計算）:
                        </p>
                        <p className="text-sm font-bold text-[#00c4cc]">
                          {(() => {
                            const { rate, amount } = calculateFee(hireModalApp.jobType || 'full_time', Number(hireSalary));
                            return `${formatCurrency(amount)} (${(rate * 100).toFixed(0)}%)`;
                          })()}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">入社予定日</label>
                    <input
                      type="date"
                      value={hireStartDate}
                      onChange={e => setHireStartDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => setHireModalApp(null)}
                      className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleHireConfirm}
                      disabled={saving || !hireSalary}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                      <CheckCircle className="w-4 h-4" />
                      採用確定
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* Tab 4: Placements & Billing */}
      {/* ============================================================ */}
      {activeTab === 'placements' && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: '総成約数', value: placementStats.total, color: 'text-[#00c4cc]', bg: 'bg-teal-50', icon: CheckCircle },
              { label: '未請求', value: placementStats.pending, color: 'text-gray-600', bg: 'bg-gray-50', icon: Clock },
              { label: '請求済', value: placementStats.invoiced, color: 'text-yellow-600', bg: 'bg-yellow-50', icon: FileText },
              { label: '入金済', value: placementStats.paid, color: 'text-green-600', bg: 'bg-green-50', icon: DollarSign },
            ].map(stat => {
              const SIcon = stat.icon;
              return (
                <div key={stat.label} className={`${stat.bg} rounded-xl p-4 border border-gray-100`}>
                  <div className="flex items-center gap-2 mb-1">
                    <SIcon className={`w-4 h-4 ${stat.color}`} />
                    <span className="text-xs text-gray-500">{stat.label}</span>
                  </div>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              );
            })}
          </div>

          {/* Placements Table */}
          {placements.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">成約がありません</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">ワーカー</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">種別</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">合意給与</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600 hidden md:table-cell">手数料率</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">手数料</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">支払状況</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {placements.map(p => {
                      const typeColor = JOB_TYPE_COLORS[p.jobType];
                      const payColor = PAYMENT_STATUS_COLORS[p.paymentStatus];
                      return (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">{p.workerName || '-'}</p>
                            <p className="text-xs text-gray-400">{formatDate(p.placementDate)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${typeColor.bg} ${typeColor.text}`}>
                              {JOB_TYPE_LABELS[p.jobType]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-700">
                            {formatCurrency(p.agreedSalary)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">
                            {(p.feeRate * 100).toFixed(0)}%
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-[#00c4cc]">
                            {formatCurrency(p.feeAmount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${payColor.bg} ${payColor.text}`}>
                              {PAYMENT_STATUS_LABELS[p.paymentStatus]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {p.paymentStatus === 'pending' && (
                                <button
                                  onClick={() => handlePayment(p)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#00c4cc] hover:bg-[#00b0b8] text-white text-xs font-medium rounded-lg transition-colors"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  支払い
                                </button>
                              )}
                              <button
                                onClick={() => handleGenerateInvoicePdf(p)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="請求書PDF"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Fee Calculation Legend */}
              <div className="p-4 bg-gray-50 border-t border-gray-200">
                <h4 className="text-xs font-bold text-gray-600 mb-2">手数料計算</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">正社員</span>
                    <span>合意年収 x 30%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">パート</span>
                    <span>月給 x 1ヶ月分 (100%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-medium">スポット</span>
                    <span>(時給 x 時間) x 10%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* Tab 5: Analytics */}
      {/* ============================================================ */}
      {activeTab === 'analytics' && facilityId && (
        <RecruitmentAnalyticsView facilityId={facilityId} />
      )}

      {/* Interview Scheduler Modal */}
      {showInterviewScheduler && (
        <InterviewScheduler
          applicationId={schedulerAppId}
          applicantName={schedulerAppName}
          onClose={() => setShowInterviewScheduler(false)}
          facilityUserId={user?.id || ''}
        />
      )}
    </div>
  );
}
