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
  Filter,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

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

const STATUS_CONFIG: Record<TrainingStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  scheduled: { label: '予定', color: 'text-blue-600', bg: 'bg-blue-100', icon: Clock },
  completed: { label: '完了', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle },
  cancelled: { label: '中止', color: 'text-red-600', bg: 'bg-red-100', icon: XCircle },
};

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

export default function TrainingRecordView() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TrainingStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TrainingType | 'all'>('all');

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

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (typeFilter !== 'all' && r.trainingType !== typeFilter) return false;
      if (searchTerm && !r.trainingName.includes(searchTerm) && !r.instructorName?.includes(searchTerm)) return false;
      return true;
    });
  }, [records, statusFilter, typeFilter, searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BookOpen className="w-6 h-6 text-cyan-500" />
        <h1 className="text-xl font-bold text-gray-800">研修記録</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">研修総数</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">完了済み</p>
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">予定</p>
          <p className="text-2xl font-bold text-blue-600">{stats.scheduled}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">総研修時間</p>
          <p className="text-2xl font-bold text-cyan-600">{stats.totalHours}h</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="研修名・講師名で検索..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="all">全ステータス</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="all">全タイプ</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Record List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {records.length === 0 ? '研修記録がまだ登録されていません' : '条件に一致する研修記録がありません'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(record => {
              const sc = STATUS_CONFIG[record.status];
              const StatusIcon = sc.icon;
              return (
                <div key={record.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800">{record.trainingName}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          {TYPE_LABELS[record.trainingType]}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          {CATEGORY_LABELS[record.trainingCategory] || record.trainingCategory}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-gray-500">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{record.trainingDate}</span>
                        {record.durationHours && <span>{record.durationHours}時間</span>}
                        {record.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{record.location}</span>}
                        {record.instructorName && <span>講師: {record.instructorName}</span>}
                        {record.participants.length > 0 && (
                          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{record.participants.length}名</span>
                        )}
                      </div>
                      {record.contentSummary && (
                        <p className="text-sm text-gray-400 mt-1 line-clamp-1">{record.contentSummary}</p>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${sc.bg} ${sc.color}`}>
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
