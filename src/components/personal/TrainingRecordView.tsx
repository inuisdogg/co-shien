/**
 * TrainingRecordView - 研修記録
 * 研修履歴の管理・確認
 */

'use client';

import React, { useState, useEffect } from 'react';
import { GraduationCap, Calendar, ChevronRight, Clock, Award, CheckCircle, Circle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface TrainingRecord {
  id: string;
  title: string;
  description: string;
  category: string;
  trainingDate: string;
  duration: number; // 時間
  status: 'scheduled' | 'completed' | 'cancelled';
  certificate?: string;
  notes?: string;
}

interface TrainingRecordViewProps {
  userId: string;
  facilityId: string;
  facilityName: string;
  onBack: () => void;
}

export default function TrainingRecordView({ userId, facilityId, facilityName, onBack }: TrainingRecordViewProps) {
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<TrainingRecord | null>(null);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'completed'>('all');

  useEffect(() => {
    loadRecords();
  }, [userId, facilityId]);

  const loadRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('training_records')
        .select('*')
        .eq('user_id', userId)
        .eq('facility_id', facilityId)
        .order('training_date', { ascending: false });

      if (error) throw error;

      setRecords((data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description || '',
        category: r.category || '一般研修',
        trainingDate: r.training_date,
        duration: r.duration || 0,
        status: r.status || 'scheduled',
        certificate: r.certificate_url,
        notes: r.notes,
      })));
    } catch (err) {
      console.error('研修記録取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  const statusConfig = {
    scheduled: { label: '予定', color: 'bg-blue-100 text-blue-700', icon: Circle },
    completed: { label: '完了', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    cancelled: { label: '中止', color: 'bg-gray-100 text-gray-500', icon: Circle },
  };

  const categoryColors: Record<string, string> = {
    '一般研修': 'bg-blue-100 text-blue-700',
    '専門研修': 'bg-purple-100 text-purple-700',
    '安全研修': 'bg-red-100 text-red-700',
    '法定研修': 'bg-green-100 text-green-700',
    '外部研修': 'bg-yellow-100 text-yellow-700',
  };

  const filteredRecords = records.filter(r => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const totalHours = records.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.duration, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#818CF8]" />
      </div>
    );
  }

  if (selectedRecord) {
    const config = statusConfig[selectedRecord.status];
    const StatusIcon = config.icon;

    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedRecord(null)}
          className="flex items-center gap-2 text-[#818CF8] font-bold hover:underline"
        >
          <span>&#8592;</span> 一覧に戻る
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${categoryColors[selectedRecord.category] || 'bg-gray-100 text-gray-700'}`}>
                  {selectedRecord.category}
                </span>
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${config.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {config.label}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-800">{selectedRecord.title}</h2>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {new Date(selectedRecord.trainingDate).toLocaleDateString('ja-JP')}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {selectedRecord.duration}時間
              </div>
            </div>

            {selectedRecord.description && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-bold text-gray-700 mb-2">研修内容</p>
                <p className="text-gray-600 whitespace-pre-wrap">{selectedRecord.description}</p>
              </div>
            )}

            {selectedRecord.notes && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-bold text-gray-700 mb-2">メモ・感想</p>
                <p className="text-gray-600 whitespace-pre-wrap">{selectedRecord.notes}</p>
              </div>
            )}

            {selectedRecord.certificate && (
              <div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg">
                <Award className="w-5 h-5 text-green-600" />
                <span className="text-green-700 font-bold">修了証あり</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[#818CF8] font-bold hover:underline"
      >
        <span>&#8592;</span> 業務ツールに戻る
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-6 h-6 text-[#818CF8]" />
              <div>
                <h2 className="text-lg font-bold text-gray-800">研修記録</h2>
                <p className="text-sm text-gray-500">{facilityName}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[#818CF8]">{totalHours}h</p>
              <p className="text-xs text-gray-500">累計研修時間</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="flex gap-2">
            {(['all', 'scheduled', 'completed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-sm font-bold transition-colors ${
                  filter === f ? 'bg-[#818CF8] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f === 'all' ? 'すべて' : f === 'scheduled' ? '予定' : '完了'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {filteredRecords.length > 0 ? (
            <div className="space-y-2">
              {filteredRecords.map((record) => {
                const config = statusConfig[record.status];
                const StatusIcon = config.icon;

                return (
                  <button
                    key={record.id}
                    onClick={() => setSelectedRecord(record)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <GraduationCap className="w-5 h-5 text-gray-400" />
                      <div className="text-left">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${categoryColors[record.category] || 'bg-gray-100 text-gray-700'}`}>
                            {record.category}
                          </span>
                          <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${config.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {config.label}
                          </span>
                        </div>
                        <p className="font-bold text-gray-800">{record.title}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(record.trainingDate).toLocaleDateString('ja-JP')} / {record.duration}時間
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">研修記録はありません</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
