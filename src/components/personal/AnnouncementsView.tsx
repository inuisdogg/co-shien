/**
 * AnnouncementsView - お知らせ表示
 * 施設からのお知らせを確認
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Calendar, ChevronRight, AlertCircle, Info, CheckCircle, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'high' | 'normal' | 'low';
  publishedAt: string;
  expiresAt?: string;
  isRead: boolean;
}

interface AnnouncementsViewProps {
  userId: string;
  facilityId: string;
  facilityName: string;
  onBack: () => void;
}

export default function AnnouncementsView({ userId, facilityId, facilityName, onBack }: AnnouncementsViewProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    loadAnnouncements();
  }, [userId, facilityId]);

  const loadAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('facility_announcements')
        .select('*, facility_announcement_reads!left(read_at)')
        .eq('facility_id', facilityId)
        .eq('is_published', true)
        .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
        .order('priority', { ascending: true })
        .order('published_at', { ascending: false });

      if (error) throw error;

      setAnnouncements((data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        priority: a.priority || 'normal',
        publishedAt: a.published_at,
        expiresAt: a.expires_at,
        isRead: a.facility_announcement_reads?.some((r: any) => r.read_at) || false,
      })));
    } catch (err) {
      console.error('お知らせ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (announcementId: string) => {
    try {
      await supabase
        .from('facility_announcement_reads')
        .upsert({
          announcement_id: announcementId,
          user_id: userId,
          read_at: new Date().toISOString(),
        });

      setAnnouncements(prev => prev.map(a =>
        a.id === announcementId ? { ...a, isRead: true } : a
      ));
    } catch (err) {
      console.error('既読マークエラー:', err);
    }
  };

  const handleSelectAnnouncement = (announcement: Announcement) => {
    if (!announcement.isRead) {
      markAsRead(announcement.id);
    }
    setSelectedAnnouncement({ ...announcement, isRead: true });
  };

  const priorityConfig = {
    high: { label: '重要', color: 'bg-red-100 text-red-700', icon: AlertCircle },
    normal: { label: '通常', color: 'bg-blue-100 text-blue-700', icon: Info },
    low: { label: '参考', color: 'bg-gray-100 text-gray-700', icon: CheckCircle },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#818CF8]" />
      </div>
    );
  }

  if (selectedAnnouncement) {
    const config = priorityConfig[selectedAnnouncement.priority];
    const PriorityIcon = config.icon;

    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedAnnouncement(null)}
          className="flex items-center gap-2 text-[#818CF8] font-bold hover:underline"
        >
          <span>&#8592;</span> 一覧に戻る
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className={`p-2 rounded-lg ${config.color}`}>
              <PriorityIcon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${config.color}`}>
                  {config.label}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-800">{selectedAnnouncement.title}</h2>
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                <Calendar className="w-4 h-4" />
                {new Date(selectedAnnouncement.publishedAt).toLocaleDateString('ja-JP')}
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-700 whitespace-pre-wrap">{selectedAnnouncement.content}</p>
          </div>

          {selectedAnnouncement.expiresAt && (
            <p className="text-sm text-gray-500 mt-4">
              掲載期限: {new Date(selectedAnnouncement.expiresAt).toLocaleDateString('ja-JP')}
            </p>
          )}
        </div>
      </div>
    );
  }

  const unreadCount = announcements.filter(a => !a.isRead).length;

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
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className="w-6 h-6 text-[#818CF8]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">お知らせ</h2>
              <p className="text-sm text-gray-500">{facilityName}</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          {announcements.length > 0 ? (
            <div className="space-y-2">
              {announcements.map((announcement) => {
                const config = priorityConfig[announcement.priority];
                const PriorityIcon = config.icon;

                return (
                  <button
                    key={announcement.id}
                    onClick={() => handleSelectAnnouncement(announcement)}
                    className={`w-full flex items-center justify-between p-4 rounded-lg transition-colors ${
                      announcement.isRead ? 'bg-gray-50 hover:bg-gray-100' : 'bg-blue-50 hover:bg-blue-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.color}`}>
                        <PriorityIcon className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2 mb-1">
                          {!announcement.isRead && (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500 text-white">
                              NEW
                            </span>
                          )}
                        </div>
                        <p className={`font-bold ${announcement.isRead ? 'text-gray-600' : 'text-gray-800'}`}>
                          {announcement.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(announcement.publishedAt).toLocaleDateString('ja-JP')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {announcement.isRead && <Eye className="w-4 h-4 text-gray-400" />}
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">お知らせはありません</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
