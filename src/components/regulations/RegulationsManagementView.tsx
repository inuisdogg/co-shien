'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Plus,
  Search,
  Upload,
  Eye,
  Edit3,
  Trash2,
  Send,
  CheckCircle,
  Clock,
  X,
  ChevronDown,
  Users,
  Calendar,
  History,
  Globe,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import RegulationAcknowledgmentPanel from './RegulationAcknowledgmentPanel';

// ---- Local types ----
interface RegulationCategory {
  id: string;
  code: string;
  name: string;
  icon: string;
  displayOrder: number;
}

interface Regulation {
  id: string;
  title: string;
  description: string | null;
  categoryCode: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  version: string | null;
  effectiveDate: string | null;
  isPublished: boolean;
  displayOrder: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  // computed
  ackCount: number;
  totalStaff: number;
}

interface RegulationForm {
  title: string;
  description: string;
  categoryCode: string;
  version: string;
  effectiveDate: string;
  isPublished: boolean;
}

interface VersionHistoryItem {
  id: string;
  title: string;
  version: string | null;
  effectiveDate: string | null;
  createdAt: string;
}

const ACCENT = '#00c4cc';
const ACCENT_HOVER = '#00b0b8';

const RegulationsManagementView: React.FC = () => {
  const { facility, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- State ----
  const [categories, setCategories] = useState<RegulationCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [totalStaff, setTotalStaff] = useState(0);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RegulationForm>({
    title: '',
    description: '',
    categoryCode: '',
    version: '',
    effectiveDate: '',
    isPublished: true,
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Acknowledgment panel
  const [ackPanelRegulation, setAckPanelRegulation] = useState<{ id: string; title: string } | null>(null);

  // Version history panel
  const [versionHistory, setVersionHistory] = useState<VersionHistoryItem[] | null>(null);
  const [versionHistoryTitle, setVersionHistoryTitle] = useState('');

  // ---- Data fetching ----
  const fetchCategories = useCallback(async () => {
    if (!facility?.id) return;
    // Ensure default categories exist
    try {
      await supabase.rpc('insert_default_regulation_categories', { p_facility_id: facility.id });
    } catch {
      // Function may not exist; ignore
    }

    const { data } = await supabase
      .from('regulation_categories')
      .select('*')
      .eq('facility_id', facility.id)
      .order('display_order');

    if (data) {
      setCategories(
        data.map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          icon: c.icon || 'FileText',
          displayOrder: c.display_order,
        }))
      );
      // Set first active category if not set
      if (activeCategory === 'all' && data.length > 0) {
        // keep 'all'
      }
    }
  }, [facility?.id, activeCategory]);

  const fetchRegulations = useCallback(async () => {
    if (!facility?.id) return;
    setLoading(true);
    try {
      // Get total staff count
      const { count: staffCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('facility_id', facility.id)
        .eq('user_type', 'staff');

      const total = staffCount || 0;
      setTotalStaff(total);

      // Get regulations
      let query = supabase
        .from('company_regulations')
        .select('*')
        .eq('facility_id', facility.id)
        .order('display_order')
        .order('created_at', { ascending: false });

      if (activeCategory !== 'all') {
        query = query.eq('category_code', activeCategory);
      }

      const { data: regData } = await query;

      if (!regData) {
        setRegulations([]);
        return;
      }

      // Get acknowledgment counts per regulation
      const regIds = regData.map((r) => r.id);
      let ackCounts = new Map<string, number>();
      if (regIds.length > 0) {
        const { data: ackData } = await supabase
          .from('regulation_acknowledgments')
          .select('regulation_id')
          .in('regulation_id', regIds);

        if (ackData) {
          ackData.forEach((a) => {
            ackCounts.set(a.regulation_id, (ackCounts.get(a.regulation_id) || 0) + 1);
          });
        }
      }

      setRegulations(
        regData.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          categoryCode: r.category_code,
          fileUrl: r.file_url,
          fileName: r.file_name,
          fileSize: r.file_size || 0,
          fileType: r.file_type || 'pdf',
          version: r.version,
          effectiveDate: r.effective_date,
          isPublished: r.is_published ?? true,
          displayOrder: r.display_order || 0,
          viewCount: r.view_count || 0,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          ackCount: ackCounts.get(r.id) || 0,
          totalStaff: total,
        }))
      );
    } catch (err) {
      console.error('Error fetching regulations:', err);
    } finally {
      setLoading(false);
    }
  }, [facility?.id, activeCategory]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchRegulations();
  }, [fetchRegulations]);

  // ---- Filtered list ----
  const filteredRegulations = regulations.filter((r) => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ---- Handlers ----
  const openCreateModal = () => {
    setEditingId(null);
    setForm({
      title: '',
      description: '',
      categoryCode: activeCategory !== 'all' ? activeCategory : (categories[0]?.code || ''),
      version: '',
      effectiveDate: new Date().toISOString().slice(0, 10),
      isPublished: true,
    });
    setFile(null);
    setShowModal(true);
  };

  const openEditModal = (reg: Regulation) => {
    setEditingId(reg.id);
    setForm({
      title: reg.title,
      description: reg.description || '',
      categoryCode: reg.categoryCode,
      version: reg.version || '',
      effectiveDate: reg.effectiveDate || '',
      isPublished: reg.isPublished,
    });
    setFile(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!facility?.id || !form.title.trim()) return;
    setSaving(true);
    try {
      let fileUrl = '';
      let fileName = '';

      if (file) {
        const ext = file.name.split('.').pop() || 'pdf';
        const path = `${facility.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('regulations')
          .upload(path, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          alert('ファイルのアップロードに失敗しました。');
          setSaving(false);
          return;
        }

        const { data: urlData } = supabase.storage.from('regulations').getPublicUrl(path);
        fileUrl = urlData?.publicUrl || path;
        fileName = file.name;
      }

      if (editingId) {
        // Update
        const updateData: Record<string, unknown> = {
          title: form.title,
          description: form.description || null,
          category_code: form.categoryCode,
          version: form.version || null,
          effective_date: form.effectiveDate || null,
          is_published: form.isPublished,
          updated_at: new Date().toISOString(),
        };
        if (fileUrl) {
          updateData.file_url = fileUrl;
          updateData.file_name = fileName;
          updateData.file_size = file?.size || 0;
          updateData.file_type = file?.name.split('.').pop() || 'pdf';
        }
        await supabase.from('company_regulations').update(updateData).eq('id', editingId);
      } else {
        // Create (file is required for new)
        if (!fileUrl) {
          alert('ファイルを選択してください。');
          setSaving(false);
          return;
        }
        await supabase.from('company_regulations').insert({
          facility_id: facility.id,
          title: form.title,
          description: form.description || null,
          category_code: form.categoryCode,
          file_url: fileUrl,
          file_name: fileName,
          file_size: file?.size || 0,
          file_type: file?.name.split('.').pop() || 'pdf',
          version: form.version || null,
          effective_date: form.effectiveDate || null,
          is_published: form.isPublished,
          uploaded_by: user?.id || null,
          uploaded_by_name: user?.name || null,
        });
      }

      setShowModal(false);
      fetchRegulations();
    } catch (err) {
      console.error('Error saving regulation:', err);
      alert('保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この規定を削除してもよろしいですか？')) return;
    await supabase.from('company_regulations').delete().eq('id', id);
    fetchRegulations();
  };

  const handleSendReminder = async (reg: Regulation) => {
    if (!facility?.id) return;
    try {
      // Get staff who haven't acknowledged
      const { data: ackData } = await supabase
        .from('regulation_acknowledgments')
        .select('user_id')
        .eq('regulation_id', reg.id);

      const ackedIds = new Set((ackData || []).map((a) => a.user_id));

      const { data: staffData } = await supabase
        .from('users')
        .select('id')
        .eq('facility_id', facility.id)
        .eq('user_type', 'staff');

      const unacked = (staffData || []).filter((s) => !ackedIds.has(s.id));

      if (unacked.length === 0) {
        alert('全員が確認済みです。');
        return;
      }

      const notifications = unacked.map((s) => ({
        facility_id: facility.id,
        user_id: s.id,
        title: '規定確認のお願い',
        message: `「${reg.title}」の確認をお願いします。`,
        type: 'regulation_reminder',
        is_read: false,
      }));

      await supabase.from('notifications').insert(notifications);
      alert(`${unacked.length}名にリマインダーを送信しました。`);
    } catch (err) {
      console.error('Error sending reminders:', err);
    }
  };

  const showVersionHistory = async (reg: Regulation) => {
    if (!facility?.id) return;
    const { data } = await supabase
      .from('company_regulations')
      .select('id, title, version, effective_date, created_at')
      .eq('facility_id', facility.id)
      .eq('category_code', reg.categoryCode)
      .ilike('title', `%${reg.title.split('（')[0].split('(')[0].trim()}%`)
      .order('created_at', { ascending: false });

    setVersionHistory(
      (data || []).map((d) => ({
        id: d.id,
        title: d.title,
        version: d.version,
        effectiveDate: d.effective_date,
        createdAt: d.created_at,
      }))
    );
    setVersionHistoryTitle(reg.title);
  };

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('ja-JP');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // ---- Category tabs ----
  const allCategories = [{ code: 'all', name: '全て' }, ...categories.map((c) => ({ code: c.code, name: c.name }))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">規定管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">就業規則・各種規定の管理と確認状況の把握</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors hover:opacity-90"
          style={{ backgroundColor: ACCENT }}
        >
          <Plus size={16} />
          規定を追加
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {allCategories.map((cat) => (
          <button
            key={cat.code}
            onClick={() => setActiveCategory(cat.code)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeCategory === cat.code
                ? 'text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
            style={activeCategory === cat.code ? { backgroundColor: ACCENT } : undefined}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="規定名で検索..."
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
        />
      </div>

      {/* Regulation cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${ACCENT} transparent transparent transparent` }} />
        </div>
      ) : filteredRegulations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <FileText size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">
            {search ? '検索条件に一致する規定がありません' : 'まだ規定が登録されていません'}
          </p>
          {!search && (
            <button
              onClick={openCreateModal}
              className="mt-4 text-sm font-medium"
              style={{ color: ACCENT }}
            >
              最初の規定を追加する
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRegulations.map((reg) => {
            const ackPercent = reg.totalStaff > 0 ? (reg.ackCount / reg.totalStaff) * 100 : 0;
            return (
              <div
                key={reg.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-800 text-sm truncate">{reg.title}</h3>
                    {reg.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{reg.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {reg.isPublished ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700">
                        <Globe size={10} /> 公開
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
                        <EyeOff size={10} /> 非公開
                      </span>
                    )}
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                  {reg.version && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                      {reg.version}
                    </span>
                  )}
                  {reg.effectiveDate && (
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {formatDate(reg.effectiveDate)}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Eye size={11} />
                    {reg.viewCount}
                  </span>
                  <span>{reg.fileName} ({formatFileSize(reg.fileSize)})</span>
                </div>

                {/* Acknowledgment progress */}
                <button
                  onClick={() => setAckPanelRegulation({ id: reg.id, title: reg.title })}
                  className="group"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-500 group-hover:text-gray-700">
                      <Users size={12} className="inline mr-1" />
                      {reg.ackCount}/{reg.totalStaff}名確認済
                    </span>
                    <span className="text-gray-400">{ackPercent.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${ackPercent}%`,
                        backgroundColor: ackPercent === 100 ? '#10b981' : ACCENT,
                      }}
                    />
                  </div>
                </button>

                {/* Actions */}
                <div className="flex items-center gap-1 pt-1 border-t border-gray-50">
                  <button
                    onClick={() => window.open(reg.fileUrl, '_blank')}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded"
                    title="ファイルを表示"
                  >
                    <Eye size={13} />
                  </button>
                  <button
                    onClick={() => openEditModal(reg)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded"
                    title="編集"
                  >
                    <Edit3 size={13} />
                  </button>
                  <button
                    onClick={() => showVersionHistory(reg)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded"
                    title="バージョン履歴"
                  >
                    <History size={13} />
                  </button>
                  <button
                    onClick={() => handleSendReminder(reg)}
                    className="flex items-center gap-1 px-2 py-1 text-xs hover:bg-gray-50 rounded"
                    style={{ color: ACCENT }}
                    title="リマインダー送信"
                  >
                    <Send size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(reg.id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded ml-auto"
                    title="削除"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">
                {editingId ? '規定を編集' : '規定を追加'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">タイトル *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                  placeholder="就業規則（本則）"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                  placeholder="この規定の概要"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
                <div className="relative">
                  <select
                    value={form.categoryCode}
                    onChange={(e) => setForm({ ...form, categoryCode: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc] appearance-none"
                  >
                    {categories.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* File */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ファイル {editingId ? '（変更する場合のみ）' : '*'}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.xlsx,.xls"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-3 text-sm border-2 border-dashed border-gray-200 rounded-lg hover:border-gray-300 transition-colors text-gray-500"
                >
                  <Upload size={16} />
                  {file ? file.name : 'PDF/DOCX/XLSXファイルを選択'}
                </button>
              </div>

              {/* Version + Effective date row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">バージョン</label>
                  <input
                    type="text"
                    value={form.version}
                    onChange={(e) => setForm({ ...form, version: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                    placeholder="v1.0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">施行日</label>
                  <input
                    type="date"
                    value={form.effectiveDate}
                    onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                  />
                </div>
              </div>

              {/* Publish toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                  className="sr-only"
                />
                <div
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    form.isPublished ? '' : 'bg-gray-300'
                  }`}
                  style={form.isPublished ? { backgroundColor: ACCENT } : undefined}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      form.isPublished ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </div>
                <span className="text-sm text-gray-700">スタッフに公開する</span>
              </label>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
                className="px-4 py-2 text-sm text-white rounded-lg font-medium transition-colors disabled:opacity-40"
                style={{ backgroundColor: ACCENT }}
              >
                {saving ? '保存中...' : editingId ? '更新' : '作成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Acknowledgment Panel */}
      {ackPanelRegulation && (
        <RegulationAcknowledgmentPanel
          regulationId={ackPanelRegulation.id}
          regulationTitle={ackPanelRegulation.title}
          onClose={() => setAckPanelRegulation(null)}
        />
      )}

      {/* Version history panel */}
      {versionHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-800 text-sm">バージョン履歴</h3>
                <p className="text-xs text-gray-500 truncate max-w-xs">{versionHistoryTitle}</p>
              </div>
              <button onClick={() => setVersionHistory(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="p-4 max-h-60 overflow-y-auto">
              {versionHistory.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">履歴がありません</p>
              ) : (
                <div className="space-y-2">
                  {versionHistory.map((v, i) => (
                    <div
                      key={v.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        i === 0 ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'
                      }`}
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-700">{v.version || '(バージョンなし)'}</span>
                        {i === 0 && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-medium">
                            最新
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {v.effectiveDate ? formatDate(v.effectiveDate) : formatDate(v.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegulationsManagementView;
