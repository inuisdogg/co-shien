'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  CheckCircle,
  Clock,
  XCircle,
  Users,
  Calendar,
  MapPin,
  Download,
  Award,
  ArrowUpDown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import CommitteeView from '@/components/committee/CommitteeView';

type TrainingType = 'internal' | 'external' | 'online' | 'oj_training';
type TrainingCategory = 'mandatory' | 'skill_improvement' | 'safety' | 'welfare' | 'medical' | 'communication';
type TrainingStatus = 'scheduled' | 'completed' | 'cancelled';

interface TrainingRecord {
  id: string;
  facilityId: string;
  trainingName: string;
  trainingType: TrainingType;
  trainingCategory: TrainingCategory;
  trainingDate: string;
  startTime: string | null;
  endTime: string | null;
  durationHours: number | null;
  location: string | null;
  instructorName: string | null;
  instructorAffiliation: string | null;
  participants: any[];
  evaluationMethod: string | null;
  contentSummary: string | null;
  cost: number | null;
  status: TrainingStatus;
  createdAt: string;
  updatedAt: string;
}

const TYPE_LABELS: Record<TrainingType, string> = {
  internal: '社内研修',
  external: '外部研修',
  online: 'オンライン',
  oj_training: 'OJT',
};

const CATEGORY_LABELS: Record<TrainingCategory, string> = {
  mandatory: '法定研修',
  skill_improvement: 'スキル向上',
  safety: '安全管理',
  welfare: '福祉',
  medical: '医療',
  communication: 'コミュニケーション',
};

const CATEGORY_COLORS: Record<TrainingCategory, { color: string; bg: string; border: string }> = {
  mandatory: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  skill_improvement: { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  safety: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  welfare: { color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  medical: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  communication: { color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200' },
};

const STATUS_CONFIG: Record<TrainingStatus, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  scheduled: { label: '予定', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: Clock },
  completed: { label: '完了', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle },
  cancelled: { label: '中止', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200', icon: XCircle },
};

type SortOption = 'newest' | 'oldest';

function mapRow(row: any): TrainingRecord {
  return {
    id: row.id,
    facilityId: row.facility_id,
    trainingName: row.training_name,
    trainingType: row.training_type,
    trainingCategory: row.training_category,
    trainingDate: row.training_date,
    startTime: row.start_time,
    endTime: row.end_time,
    durationHours: row.duration_hours,
    location: row.location,
    instructorName: row.instructor_name,
    instructorAffiliation: row.instructor_affiliation,
    participants: row.participants || [],
    evaluationMethod: row.evaluation_method,
    contentSummary: row.content_summary,
    cost: row.cost,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Build monthly heatmap data
function buildHeatmapData(records: TrainingRecord[]): { month: string; count: number; hours: number }[] {
  const monthMap = new Map<string, { count: number; hours: number }>();
  const now = new Date();
  // Last 12 months
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    monthMap.set(key, { count: 0, hours: 0 });
  }
  records.filter(r => r.status === 'completed').forEach(r => {
    const month = r.trainingDate.slice(0, 7);
    const existing = monthMap.get(month);
    if (existing) {
      existing.count++;
      existing.hours += r.durationHours || 0;
    }
  });
  return Array.from(monthMap.entries()).map(([month, data]) => ({ month, ...data }));
}

function formatMonthLabel(monthStr: string): string {
  const [, m] = monthStr.split('-');
  return `${parseInt(m)}月`;
}

// Skeleton loader
function SkeletonCard() {
  return (
    <div className="p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-gray-200 rounded-lg" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-40" />
          <div className="h-3 bg-gray-100 rounded w-56" />
        </div>
        <div className="h-6 bg-gray-100 rounded-full w-16" />
      </div>
    </div>
  );
}

function TrainingRecordContent() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TrainingStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TrainingType | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  useEffect(() => {
    if (!facilityId) return;
    const fetchRecords = async () => {
      try {
        const { data, error } = await supabase
          .from('training_records')
          .select('*')
          .eq('facility_id', facilityId)
          .order('training_date', { ascending: false });
        if (error) {
          console.error('Error fetching training records:', error);
          return;
        }
        if (data) setRecords(data.map(mapRow));
      } catch (error) {
        console.error('Error in fetchRecords:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, [facilityId]);

  const stats = useMemo(() => {
    const total = records.length;
    const completed = records.filter(r => r.status === 'completed').length;
    const scheduled = records.filter(r => r.status === 'scheduled').length;
    const totalHours = records.filter(r => r.status === 'completed').reduce((sum, r) => sum + (r.durationHours || 0), 0);
    return { total, completed, scheduled, totalHours };
  }, [records]);

  const heatmapData = useMemo(() => buildHeatmapData(records), [records]);
  const maxCount = useMemo(() => Math.max(...heatmapData.map(d => d.count), 1), [heatmapData]);

  const filtered = useMemo(() => {
    let result = records.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (typeFilter !== 'all' && r.trainingType !== typeFilter) return false;
      if (searchTerm && !r.trainingName.includes(searchTerm) && !r.instructorName?.includes(searchTerm)) return false;
      return true;
    });

    if (sortBy === 'oldest') {
      result.sort((a, b) => a.trainingDate.localeCompare(b.trainingDate));
    }

    return result;
  }, [records, statusFilter, typeFilter, searchTerm, sortBy]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-gray-200 rounded animate-pulse" />
          <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
              <div className="h-8 bg-gray-100 rounded w-12" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-[#00c4cc]" />
          <h1 className="text-xl font-bold text-gray-800">研修記録</h1>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            <Download className="w-4 h-4" />
            エクスポート
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors">
            <Plus className="w-4 h-4" />
            記録を追加
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-50 rounded-lg"><BookOpen className="w-5 h-5 text-gray-500" /></div>
            <div>
              <p className="text-sm text-gray-500">研修総数</p>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg"><CheckCircle className="w-5 h-5 text-emerald-600" /></div>
            <div>
              <p className="text-sm text-gray-500">完了済み</p>
              <p className="text-2xl font-bold text-gray-800">{stats.completed}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg"><Clock className="w-5 h-5 text-amber-600" /></div>
            <div>
              <p className="text-sm text-gray-500">予定</p>
              <p className="text-2xl font-bold text-gray-800">{stats.scheduled}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#00c4cc]/10 rounded-lg"><Award className="w-5 h-5 text-[#00c4cc]" /></div>
            <div>
              <p className="text-sm text-gray-500">総研修時間</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalHours}<span className="text-sm font-normal text-gray-400">h</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Training Activity Heatmap */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-sm font-bold text-gray-700 mb-4">研修実施状況（過去12ヶ月）</h2>
        <div className="flex items-end gap-1.5 h-20">
          {heatmapData.map(d => {
            const height = d.count > 0 ? Math.max(20, (d.count / maxCount) * 100) : 4;
            const intensity = d.count === 0 ? 'bg-gray-100' :
              d.count <= 1 ? 'bg-[#00c4cc]/20' :
              d.count <= 2 ? 'bg-[#00c4cc]/40' :
              d.count <= 3 ? 'bg-[#00c4cc]/60' :
              'bg-[#00c4cc]/80';
            return (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full rounded-sm transition-all ${intensity}`}
                  style={{ height: `${height}%` }}
                  title={`${d.month}: ${d.count}件 (${d.hours}h)`}
                />
                <span className="text-[10px] text-gray-400">{formatMonthLabel(d.month)}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
          <span>少ない</span>
          <div className="flex gap-0.5">
            <div className="w-3 h-3 rounded-sm bg-gray-100" />
            <div className="w-3 h-3 rounded-sm bg-[#00c4cc]/20" />
            <div className="w-3 h-3 rounded-sm bg-[#00c4cc]/40" />
            <div className="w-3 h-3 rounded-sm bg-[#00c4cc]/60" />
            <div className="w-3 h-3 rounded-sm bg-[#00c4cc]/80" />
          </div>
          <span>多い</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="研修名・講師名で検索..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
          >
            <option value="all">全ステータス</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
          >
            <option value="all">全タイプ</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
          >
            <option value="newest">新しい順</option>
            <option value="oldest">古い順</option>
          </select>
        </div>
      </div>

      {/* Record List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-50 rounded-full flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 mb-2">
              {records.length === 0 ? '研修記録がまだ登録されていません' : '条件に一致する研修記録がありません'}
            </p>
            {records.length === 0 && (
              <button className="inline-flex items-center gap-2 px-4 py-2 text-sm text-[#00c4cc] border border-[#00c4cc]/30 rounded-lg hover:bg-[#00c4cc]/5 transition-colors mt-2">
                <Plus className="w-4 h-4" />
                記録を追加
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(record => {
              const sc = STATUS_CONFIG[record.status];
              const catColor = CATEGORY_COLORS[record.trainingCategory] || { color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' };
              const StatusIcon = sc.icon;
              return (
                <div key={record.id} className="p-4 hover:bg-gray-50/50 transition-colors group">
                  <div className="flex items-start gap-4">
                    {/* Status icon */}
                    <div className={`p-2.5 rounded-lg ${sc.bg} flex-shrink-0`}>
                      <StatusIcon className={`w-5 h-5 ${sc.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-medium text-gray-800">{record.trainingName}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${catColor.bg} ${catColor.color} ${catColor.border}`}>
                          {CATEGORY_LABELS[record.trainingCategory] || record.trainingCategory}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200">
                          {TYPE_LABELS[record.trainingType]}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {record.trainingDate}
                          {record.startTime && ` ${record.startTime}`}
                          {record.endTime && `〜${record.endTime}`}
                        </span>
                        {record.durationHours && (
                          <span className="font-medium text-gray-500">{record.durationHours}時間</span>
                        )}
                        {record.location && (
                          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{record.location}</span>
                        )}
                        {record.instructorName && (
                          <span>講師: {record.instructorName}{record.instructorAffiliation && ` (${record.instructorAffiliation})`}</span>
                        )}
                        {record.participants.length > 0 && (
                          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{record.participants.length}名参加</span>
                        )}
                      </div>
                      {record.contentSummary && (
                        <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{record.contentSummary}</p>
                      )}
                    </div>

                    {/* Status */}
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${sc.bg} ${sc.color} ${sc.border}`}>
                      <StatusIcon className="w-3 h-3" />
                      {sc.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const TRAINING_TABS = [
  { id: 'training', label: '研修記録' },
  { id: 'committee', label: '委員会' },
] as const;

export default function TrainingRecordView() {
  const [activeTab, setActiveTab] = useState<string>('training');

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6" aria-label="Tabs">
          {TRAINING_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#00c4cc] text-gray-800'
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'training' ? <TrainingRecordContent /> : <CommitteeView />}
    </div>
  );
}
