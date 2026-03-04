'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Send, Plus, Eye, Edit2, Trash2, CheckCircle, Clock,
  AlertCircle, X, Users, ChevronDown,
} from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'high' | 'normal' | 'low';
  publishedAt: string | null;
  expiresAt: string | null;
  isPublished: boolean;
  readCount: number;
  totalStaff: number;
  createdAt: string;
}

export default function AnnouncementView() {
  const { user: authUser, facility } = useAuth();
  const facilityId = facility?.id || '';

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffCount, setStaffCount] = useState(0);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formPriority, setFormPriority] = useState<'high' | 'normal' | 'low'>('normal');
  const [formExpiresAt, setFormExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    try {
      const { count: sCount } = await supabase
        .from('staff')
        .select('*', { count: 'exact', head: true })
        .eq('facility_id', facilityId);
      setStaffCount(sCount || 0);

      const { data: annData } = await supabase
        .from('facility_announcements')
        .select('*')
        .eq('facility_id', facilityId)
        .order('created_at', { ascending: false });

      if (annData) {
        const mapped: Announcement[] = [];
        for (const a of annData) {
          const { count: readCount } = await supabase
            .from('facility_announcement_reads')
            .select('*', { count: 'exact', head: true })
            .eq('announcement_id', a.id);

          const now = new Date();
          const published = a.published_at ? new Date(a.published_at) <= now : true;
          const expired = a.expires_at ? new Date(a.expires_at) < now : false;

          mapped.push({
            id: a.id,
            title: a.title,
            content: a.content || '',
            priority: a.priority || 'normal',
            publishedAt: a.published_at,
            expiresAt: a.expires_at,
            isPublished: published && !expired,
            readCount: readCount || 0,
            totalStaff: sCount || 0,
            createdAt: a.created_at,
          });
        }
        setAnnouncements(mapped);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async () => {
    if (!formTitle.trim() || !facilityId) return;
    setSubmitting(true);
    try {
      const data: Record<string, unknown> = {
        facility_id: facilityId,
        title: formTitle.trim(),
        content: formContent.trim(),
        priority: formPriority,
        published_at: new Date().toISOString(),
        expires_at: formExpiresAt ? new Date(formExpiresAt).toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      if (editId) {
        await supabase.from('facility_announcements').update(data).eq('id', editId);
      } else {
        data.id = `ann-${Date.now()}`;
        data.created_by = authUser?.id;
        data.created_at = new Date().toISOString();
        await supabase.from('facility_announcements').insert(data);
      }

      resetForm();
      fetchData();
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (ann: Announcement) => {
    setEditId(ann.id);
    setFormTitle(ann.title);
    setFormContent(ann.content);
    setFormPriority(ann.priority);
    setFormExpiresAt(ann.expiresAt ? ann.expiresAt.split('T')[0] : '');
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このお知らせを削除しますか？')) return;
    await supabase.from('facility_announcement_reads').delete().eq('announcement_id', id);
    await supabase.from('facility_announcements').delete().eq('id', id);
    fetchData();
  };

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setFormTitle('');
    setFormContent('');
    setFormPriority('normal');
    setFormExpiresAt('');
  };

  const priorityConfig = {
    high: { label: '重要', color: 'text-red-600 bg-red-50 border-red-200' },
    normal: { label: '通常', color: 'text-blue-600 bg-blue-50 border-blue-200' },
    low: { label: '低', color: 'text-gray-500 bg-gray-50 border-gray-200' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Send className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-gray-800">お知らせ管理</h1>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          新規作成
        </button>
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">公開中</p>
          <p className="text-2xl font-bold text-primary">{announcements.filter(a => a.isPublished).length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">全お知らせ</p>
          <p className="text-2xl font-bold text-gray-800">{announcements.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">スタッフ数</p>
          <p className="text-2xl font-bold text-gray-800">{staffCount}</p>
        </div>
      </div>

      {/* フォーム */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border-2 border-primary p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">{editId ? 'お知らせを編集' : '新しいお知らせ'}</h3>
            <button onClick={resetForm}><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">タイトル <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                placeholder="お知らせのタイトル"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">内容</label>
              <textarea
                value={formContent}
                onChange={e => setFormContent(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                placeholder="お知らせの本文"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">優先度</label>
                <select
                  value={formPriority}
                  onChange={e => setFormPriority(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="high">重要</option>
                  <option value="normal">通常</option>
                  <option value="low">低</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">公開期限（任意）</label>
                <input
                  type="date"
                  value={formExpiresAt}
                  onChange={e => setFormExpiresAt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={resetForm} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">キャンセル</button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !formTitle.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg text-sm disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
                {submitting ? '送信中...' : editId ? '更新' : '公開する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 一覧 */}
      <div className="space-y-3">
        {announcements.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <EmptyState
              icon={<Send className="w-7 h-7 text-gray-400" />}
              title="お知らせはありません"
            />
          </div>
        ) : (
          announcements.map(ann => {
            const pConfig = priorityConfig[ann.priority];
            const readPercent = ann.totalStaff > 0 ? Math.round((ann.readCount / ann.totalStaff) * 100) : 0;
            return (
              <div key={ann.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded border font-bold ${pConfig.color}`}>
                        {pConfig.label}
                      </span>
                      <span className="font-bold text-gray-800">{ann.title}</span>
                      {!ann.isPublished && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">期限切れ</span>
                      )}
                    </div>
                    {ann.content && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{ann.content}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>{new Date(ann.createdAt).toLocaleDateString('ja-JP')}</span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />{ann.readCount}/{ann.totalStaff}名 既読 ({readPercent}%)
                      </span>
                      {ann.expiresAt && (
                        <span>期限: {new Date(ann.expiresAt).toLocaleDateString('ja-JP')}</span>
                      )}
                    </div>
                    {/* 既読プログレスバー */}
                    <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all"
                        style={{ width: `${readPercent}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleEdit(ann)} className="p-2 hover:bg-gray-100 rounded-lg">
                      <Edit2 className="w-4 h-4 text-gray-500" />
                    </button>
                    <button onClick={() => handleDelete(ann.id)} className="p-2 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
