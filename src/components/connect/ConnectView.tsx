/**
 * コネクト（連絡会調整）メインビュー
 * 外部関係者との連絡会日程調整を管理
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Link2,
  Plus,
  Calendar,
  Users,
  CheckCircle,
  Clock,
  XCircle,
  Filter,
  Search,
  ChevronRight,
  Mail,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useFacilityData } from '@/hooks/useFacilityData';
import { ConnectMeeting, ConnectMeetingStatus } from '@/types';
import ConnectCreateModal from './ConnectCreateModal';
import ConnectDetailView from './ConnectDetailView';

type StatusFilter = 'all' | ConnectMeetingStatus;

// DB形式からアプリ形式への変換
function convertMeetingFromDB(row: any): ConnectMeeting & { childName?: string } {
  return {
    id: row.id,
    facilityId: row.facility_id,
    childId: row.child_id,
    title: row.title,
    purpose: row.purpose,
    location: row.location,
    estimatedDuration: row.estimated_duration,
    description: row.description,
    status: row.status,
    confirmedDateOptionId: row.confirmed_date_option_id,
    confirmedAt: row.confirmed_at,
    confirmedBy: row.confirmed_by,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    childName: row.children?.name,
  };
}

export default function ConnectView() {
  const { facility, user } = useAuth();
  const { children } = useFacilityData();
  const [meetings, setMeetings] = useState<(ConnectMeeting & { childName?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

  // 連絡会一覧を取得
  useEffect(() => {
    fetchMeetings();
  }, [facility?.id]);

  const fetchMeetings = async () => {
    if (!facility?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('connect_meetings')
        .select(`
          *,
          children:child_id (
            id,
            name
          )
        `)
        .eq('facility_id', facility.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('連絡会取得エラー:', error);
      } else {
        const convertedMeetings = (data || []).map(convertMeetingFromDB);
        setMeetings(convertedMeetings);
      }
    } catch (err) {
      console.error('連絡会取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  // フィルタリング
  const filteredMeetings = meetings.filter((meeting) => {
    const matchesStatus = statusFilter === 'all' || meeting.status === statusFilter;
    const matchesSearch =
      !searchTerm ||
      meeting.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      meeting.childName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // 統計
  const stats = {
    total: meetings.length,
    scheduling: meetings.filter((m) => m.status === 'scheduling').length,
    confirmed: meetings.filter((m) => m.status === 'confirmed').length,
    completed: meetings.filter((m) => m.status === 'completed').length,
  };

  // ステータス表示
  const getStatusBadge = (status: ConnectMeetingStatus) => {
    switch (status) {
      case 'scheduling':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3" />
            日程調整中
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Calendar className="w-3 h-3" />
            日程確定
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3" />
            開催完了
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            <XCircle className="w-3 h-3" />
            キャンセル
          </span>
        );
      default:
        return null;
    }
  };

  // 詳細ビュー表示時
  if (selectedMeetingId) {
    return (
      <ConnectDetailView
        meetingId={selectedMeetingId}
        onBack={() => {
          setSelectedMeetingId(null);
          fetchMeetings(); // 一覧に戻る時にデータ再取得
        }}
        onUpdate={fetchMeetings}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Link2 className="w-6 h-6 text-cyan-500" />
              コネクト
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              外部関係者（行政・保育園・学校・医療機関等）との連絡会日程を調整します
            </p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            連絡会を作成
          </button>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            <p className="text-xs text-gray-500">総件数</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.scheduling}</p>
            <p className="text-xs text-gray-500">日程調整中</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.confirmed}</p>
            <p className="text-xs text-gray-500">日程確定</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            <p className="text-xs text-gray-500">開催完了</p>
          </div>
        </div>
      </div>

      {/* フィルター・検索 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="all">すべてのステータス</option>
              <option value="scheduling">日程調整中</option>
              <option value="confirmed">日程確定</option>
              <option value="completed">開催完了</option>
              <option value="cancelled">キャンセル</option>
            </select>
          </div>
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="会議名・児童名で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* 連絡会一覧 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {filteredMeetings.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Link2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            {meetings.length === 0 ? (
              <>
                <p className="font-medium">連絡会がありません</p>
                <p className="text-sm mt-1">「連絡会を作成」ボタンから新しい連絡会を作成してください</p>
              </>
            ) : (
              <p className="font-medium">条件に一致する連絡会がありません</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredMeetings.map((meeting) => (
              <div
                key={meeting.id}
                onClick={() => setSelectedMeetingId(meeting.id)}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusBadge(meeting.status)}
                      <h3 className="font-bold text-gray-800">{meeting.title}</h3>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {meeting.childName || '児童未設定'}
                      </span>
                      {meeting.location && (
                        <span>場所: {meeting.location}</span>
                      )}
                      {meeting.estimatedDuration && (
                        <span>所要時間: {meeting.estimatedDuration}分</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      作成日: {new Date(meeting.createdAt).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 連絡会作成モーダル */}
      <ConnectCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        facilityId={facility?.id || ''}
        userId={user?.id || ''}
        childList={children}
        onCreated={() => {
          setIsCreateModalOpen(false);
          fetchMeetings();
        }}
      />
    </div>
  );
}
