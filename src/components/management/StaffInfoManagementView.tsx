/**
 * StaffInfoManagementView - スタッフ情報配信管理
 * 会社全体向けの情報を管理（就業規則・会社書類・お知らせ）
 * ※給与明細・タスクは個別スタッフの詳細画面で管理
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Scale,
  FolderOpen,
  Bell,
  Plus,
  Edit,
  Trash2,
  Download,
  Eye,
  Calendar,
  X,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import FileUploader from '@/components/common/FileUploader';

interface StaffInfoManagementViewProps {
  facilityId: string;
  facilityName?: string;
}

type TabId = 'announcements' | 'work_rules' | 'company_docs';

// お知らせ
interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'high' | 'normal' | 'low';
  publishedAt: string;
  expiresAt?: string;
  isPublished: boolean;
  readCount?: number;
}

// 就業規則
interface WorkRule {
  id: string;
  title: string;
  description: string;
  category: string;
  pdfUrl?: string;
  version: string;
  effectiveDate: string;
  isActive: boolean;
}

// 会社書類
interface CompanyDocument {
  id: string;
  title: string;
  description: string;
  category: string;
  fileUrl: string;
  fileName?: string;
  fileType: string;
  uploadedAt: string;
}

export default function StaffInfoManagementView({ facilityId, facilityName }: StaffInfoManagementViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('announcements');
  const [loading, setLoading] = useState(true);
  const [staffCount, setStaffCount] = useState(0);

  // 各タブのデータ
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [workRules, setWorkRules] = useState<WorkRule[]>([]);
  const [companyDocs, setCompanyDocs] = useState<CompanyDocument[]>([]);

  // モーダル状態
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const tabs = [
    { id: 'announcements' as TabId, label: 'お知らせ', icon: Bell, description: '全スタッフへのお知らせを配信' },
    { id: 'work_rules' as TabId, label: '就業規則', icon: Scale, description: '就業規則・社内規程を登録' },
    { id: 'company_docs' as TabId, label: '会社書類', icon: FolderOpen, description: '各種書類を配布' },
  ];

  useEffect(() => {
    loadStaffCount();
  }, [facilityId]);

  useEffect(() => {
    loadTabData();
  }, [activeTab, facilityId]);

  const loadStaffCount = async () => {
    try {
      const { count } = await supabase
        .from('staff')
        .select('*', { count: 'exact', head: true })
        .eq('facility_id', facilityId)
        .eq('is_active', true);
      setStaffCount(count || 0);
    } catch (err) {
      console.error('スタッフ数取得エラー:', err);
    }
  };

  const loadTabData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'work_rules':
          await loadWorkRules();
          break;
        case 'company_docs':
          await loadCompanyDocs();
          break;
        case 'announcements':
          await loadAnnouncements();
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  const loadWorkRules = async () => {
    const { data, error } = await supabase
      .from('work_rules')
      .select('*')
      .eq('facility_id', facilityId)
      .order('category')
      .order('title');

    if (!error && data) {
      setWorkRules(data.map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description || '',
        category: r.category || '一般',
        pdfUrl: r.pdf_url,
        version: r.version || '1.0',
        effectiveDate: r.effective_date,
        isActive: r.is_active,
      })));
    }
  };

  const loadCompanyDocs = async () => {
    const { data, error } = await supabase
      .from('company_documents')
      .select('*')
      .eq('facility_id', facilityId)
      .order('uploaded_at', { ascending: false });

    if (!error && data) {
      setCompanyDocs(data.map((d: any) => ({
        id: d.id,
        title: d.title,
        description: d.description || '',
        category: d.category || '一般',
        fileUrl: d.file_url,
        fileName: d.file_name,
        fileType: d.file_type || 'pdf',
        uploadedAt: d.uploaded_at,
      })));
    }
  };

  const loadAnnouncements = async () => {
    const { data, error } = await supabase
      .from('facility_announcements')
      .select('*')
      .eq('facility_id', facilityId)
      .order('published_at', { ascending: false });

    if (!error && data) {
      // 既読数を取得
      const announcementIds = data.map((a: any) => a.id);
      const { data: readCounts } = await supabase
        .from('facility_announcement_reads')
        .select('announcement_id')
        .in('announcement_id', announcementIds);

      const readCountMap: Record<string, number> = {};
      readCounts?.forEach((r: any) => {
        readCountMap[r.announcement_id] = (readCountMap[r.announcement_id] || 0) + 1;
      });

      setAnnouncements(data.map((a: any) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        priority: a.priority || 'normal',
        publishedAt: a.published_at,
        expiresAt: a.expires_at,
        isPublished: a.is_published,
        readCount: readCountMap[a.id] || 0,
      })));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('削除してもよろしいですか？')) return;

    const tableMap: Record<TabId, string> = {
      work_rules: 'work_rules',
      company_docs: 'company_documents',
      announcements: 'facility_announcements',
    };

    const { error } = await supabase
      .from(tableMap[activeTab])
      .delete()
      .eq('id', id);

    if (!error) {
      loadTabData();
    } else {
      alert('削除に失敗しました');
    }
  };

  const openEditModal = (item?: any) => {
    setEditingItem(item || null);
    setShowModal(true);
  };

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]" />
        </div>
      );
    }

    switch (activeTab) {
      case 'announcements':
        return <AnnouncementsTab data={announcements} onEdit={openEditModal} onDelete={handleDelete} staffCount={staffCount} />;
      case 'work_rules':
        return <WorkRulesTab data={workRules} onEdit={openEditModal} onDelete={handleDelete} />;
      case 'company_docs':
        return <CompanyDocsTab data={companyDocs} onEdit={openEditModal} onDelete={handleDelete} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">スタッフ情報配信</h1>
          <p className="text-sm text-gray-500 mt-1">全スタッフに配信する情報を管理します</p>
        </div>
        <button
          onClick={() => openEditModal()}
          className="flex items-center gap-2 px-4 py-2 bg-[#00c4cc] text-white font-bold rounded-lg hover:bg-[#00b3b3] transition-colors"
        >
          <Plus className="w-5 h-5" />
          新規作成
        </button>
      </div>

      {/* タブ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 font-bold transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'text-[#00c4cc] border-[#00c4cc] bg-[#00c4cc]/5'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* タブ説明 */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-sm text-gray-600">
            {tabs.find(t => t.id === activeTab)?.description}
          </p>
        </div>

        {/* コンテンツ */}
        <div className="p-6">
          {renderTabContent()}
        </div>
      </div>

      {/* 個別管理への案内 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <p className="font-bold text-blue-800">給与明細・タスクは個別管理</p>
            <p className="text-sm text-blue-700 mt-1">
              給与明細やタスクはスタッフごとに異なるため、「スタッフ管理」画面で各スタッフの詳細を開いて管理してください。
            </p>
          </div>
        </div>
      </div>

      {/* モーダル */}
      {showModal && (
        <EditModal
          tab={activeTab}
          item={editingItem}
          facilityId={facilityId}
          onClose={() => { setShowModal(false); setEditingItem(null); }}
          onSave={() => { setShowModal(false); setEditingItem(null); loadTabData(); }}
        />
      )}
    </div>
  );
}

// お知らせタブ
function AnnouncementsTab({ data, onEdit, onDelete, staffCount }: { data: Announcement[]; onEdit: (item?: Announcement) => void; onDelete: (id: string) => void; staffCount: number }) {
  const priorityConfig = {
    high: { label: '重要', color: 'bg-red-100 text-red-700' },
    normal: { label: '通常', color: 'bg-blue-100 text-blue-700' },
    low: { label: '参考', color: 'bg-gray-100 text-gray-600' },
  };

  return (
    <div className="space-y-4">
      {data.length > 0 ? (
        data.map((item) => (
          <div key={item.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${priorityConfig[item.priority].color}`}>
                    {priorityConfig[item.priority].label}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${item.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                    {item.isPublished ? '公開中' : '下書き'}
                  </span>
                  {item.readCount !== undefined && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {item.readCount}/{staffCount}人が閲覧
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-gray-800">{item.title}</h3>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.content}</p>
                <p className="text-xs text-gray-400 mt-2">
                  公開日: {new Date(item.publishedAt).toLocaleDateString('ja-JP')}
                  {item.expiresAt && ` / 期限: ${new Date(item.expiresAt).toLocaleDateString('ja-JP')}`}
                </p>
              </div>
              <div className="flex items-center gap-1 ml-4">
                <button onClick={() => onEdit(item)} className="p-2 text-gray-400 hover:text-[#00c4cc] rounded-lg hover:bg-white">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(item.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-white">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <EmptyState icon={Bell} message="お知らせはまだありません" />
      )}
    </div>
  );
}

// 就業規則タブ
function WorkRulesTab({ data, onEdit, onDelete }: { data: WorkRule[]; onEdit: (item?: WorkRule) => void; onDelete: (id: string) => void }) {
  const categoryColors: Record<string, string> = {
    '一般': 'bg-blue-100 text-blue-700',
    '勤怠': 'bg-green-100 text-green-700',
    '給与': 'bg-yellow-100 text-yellow-700',
    '福利厚生': 'bg-purple-100 text-purple-700',
    '服務規律': 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-4">
      {data.length > 0 ? (
        data.map((item) => (
          <div key={item.id} className={`bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors ${!item.isActive ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${categoryColors[item.category] || 'bg-gray-100 text-gray-700'}`}>
                    {item.category}
                  </span>
                  <span className="text-xs text-gray-500">Ver.{item.version}</span>
                  {!item.isActive && (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-200 text-gray-500">無効</span>
                  )}
                </div>
                <h3 className="font-bold text-gray-800">{item.title}</h3>
                {item.description && (
                  <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  施行日: {new Date(item.effectiveDate).toLocaleDateString('ja-JP')}
                </p>
              </div>
              <div className="flex items-center gap-1 ml-4">
                {item.pdfUrl && (
                  <a href={item.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-[#00c4cc] rounded-lg hover:bg-white">
                    <Download className="w-4 h-4" />
                  </a>
                )}
                <button onClick={() => onEdit(item)} className="p-2 text-gray-400 hover:text-[#00c4cc] rounded-lg hover:bg-white">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(item.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-white">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <EmptyState icon={Scale} message="就業規則はまだ登録されていません" />
      )}
    </div>
  );
}

// 会社書類タブ
function CompanyDocsTab({ data, onEdit, onDelete }: { data: CompanyDocument[]; onEdit: (item?: CompanyDocument) => void; onDelete: (id: string) => void }) {
  const categoryColors: Record<string, string> = {
    '一般': 'bg-gray-100 text-gray-700',
    '重要': 'bg-red-100 text-red-700',
    '福利厚生': 'bg-green-100 text-green-700',
    '研修': 'bg-blue-100 text-blue-700',
    'その他': 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className="space-y-4">
      {data.length > 0 ? (
        data.map((item) => (
          <div key={item.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${categoryColors[item.category] || 'bg-gray-100 text-gray-700'}`}>
                    {item.category}
                  </span>
                  <span className="text-xs text-gray-500 uppercase">{item.fileType}</span>
                </div>
                <h3 className="font-bold text-gray-800">{item.title}</h3>
                {item.description && (
                  <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                )}
                {item.fileName && (
                  <p className="text-xs text-gray-500 mt-1">{item.fileName}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  アップロード: {new Date(item.uploadedAt).toLocaleDateString('ja-JP')}
                </p>
              </div>
              <div className="flex items-center gap-1 ml-4">
                <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-[#00c4cc] rounded-lg hover:bg-white">
                  <Download className="w-4 h-4" />
                </a>
                <button onClick={() => onEdit(item)} className="p-2 text-gray-400 hover:text-[#00c4cc] rounded-lg hover:bg-white">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(item.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-white">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <EmptyState icon={FolderOpen} message="会社書類はまだアップロードされていません" />
      )}
    </div>
  );
}

// 空状態コンポーネント
function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="text-center py-12">
      <Icon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500">{message}</p>
    </div>
  );
}

// 編集モーダル
function EditModal({
  tab,
  item,
  facilityId,
  onClose,
  onSave,
}: {
  tab: TabId;
  item: any;
  facilityId: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState<any>(item || {});
  const [saving, setSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string } | null>(
    item?.pdfUrl ? { url: item.pdfUrl, name: 'アップロード済みファイル' } :
    item?.fileUrl ? { url: item.fileUrl, name: item.fileName || 'アップロード済みファイル' } :
    null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const tableMap: Record<TabId, string> = {
        work_rules: 'work_rules',
        company_docs: 'company_documents',
        announcements: 'facility_announcements',
      };

      let data: any = { facility_id: facilityId };

      switch (tab) {
        case 'announcements':
          data = {
            ...data,
            title: formData.title,
            content: formData.content,
            priority: formData.priority || 'normal',
            published_at: formData.publishedAt || new Date().toISOString(),
            expires_at: formData.expiresAt || null,
            is_published: formData.isPublished ?? true,
          };
          break;
        case 'work_rules':
          data = {
            ...data,
            title: formData.title,
            description: formData.description,
            category: formData.category || '一般',
            version: formData.version || '1.0',
            effective_date: formData.effectiveDate,
            is_active: formData.isActive ?? true,
            pdf_url: uploadedFile?.url || formData.pdfUrl,
          };
          break;
        case 'company_docs':
          if (!uploadedFile?.url && !formData.fileUrl) {
            alert('ファイルをアップロードしてください');
            setSaving(false);
            return;
          }
          data = {
            ...data,
            title: formData.title,
            description: formData.description,
            category: formData.category || '一般',
            file_url: uploadedFile?.url || formData.fileUrl,
            file_name: uploadedFile?.name || formData.fileName,
            file_type: (uploadedFile?.name || formData.fileName || 'pdf').split('.').pop()?.toLowerCase() || 'pdf',
            uploaded_at: new Date().toISOString(),
          };
          break;
      }

      if (item?.id) {
        const { error } = await supabase
          .from(tableMap[tab])
          .update(data)
          .eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(tableMap[tab])
          .insert(data);
        if (error) throw error;
      }

      onSave();
    } catch (err: any) {
      console.error('保存エラー:', err);
      alert('保存に失敗しました: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const renderForm = () => {
    switch (tab) {
      case 'announcements':
        return (
          <>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">タイトル *</label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">内容 *</label>
              <textarea
                value={formData.content || ''}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={5}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc] resize-none"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">優先度</label>
                <select
                  value={formData.priority || 'normal'}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                >
                  <option value="high">重要</option>
                  <option value="normal">通常</option>
                  <option value="low">参考</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">掲載期限</label>
                <input
                  type="date"
                  value={formData.expiresAt?.split('T')[0] || ''}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPublished"
                checked={formData.isPublished ?? true}
                onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                className="w-4 h-4 text-[#00c4cc] rounded"
              />
              <label htmlFor="isPublished" className="text-sm text-gray-700">公開する</label>
            </div>
          </>
        );

      case 'work_rules':
        return (
          <>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">タイトル *</label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">カテゴリ</label>
                <select
                  value={formData.category || '一般'}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                >
                  <option value="一般">一般</option>
                  <option value="勤怠">勤怠</option>
                  <option value="給与">給与</option>
                  <option value="福利厚生">福利厚生</option>
                  <option value="服務規律">服務規律</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">バージョン</label>
                <input
                  type="text"
                  value={formData.version || '1.0'}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">説明</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc] resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">施行日 *</label>
              <input
                type="date"
                value={formData.effectiveDate?.split('T')[0] || ''}
                onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">PDFファイル</label>
              <FileUploader
                bucket="documents"
                folder={`facilities/${facilityId}/work-rules`}
                accept=".pdf"
                maxSizeMB={20}
                label="就業規則PDFをアップロード"
                currentFile={uploadedFile}
                onUpload={(url, name) => setUploadedFile({ url, name })}
                onRemove={() => setUploadedFile(null)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive ?? true}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-[#00c4cc] rounded"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">有効にする</label>
            </div>
          </>
        );

      case 'company_docs':
        return (
          <>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">タイトル *</label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">カテゴリ</label>
              <select
                value={formData.category || '一般'}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
              >
                <option value="一般">一般</option>
                <option value="重要">重要</option>
                <option value="福利厚生">福利厚生</option>
                <option value="研修">研修</option>
                <option value="その他">その他</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">説明</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc] resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">ファイル *</label>
              <FileUploader
                bucket="documents"
                folder={`facilities/${facilityId}/company-docs`}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                maxSizeMB={20}
                label="書類ファイルをアップロード"
                currentFile={uploadedFile}
                onUpload={(url, name) => setUploadedFile({ url, name })}
                onRemove={() => setUploadedFile(null)}
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  const getModalTitle = () => {
    const titles: Record<TabId, string> = {
      announcements: 'お知らせ',
      work_rules: '就業規則',
      company_docs: '会社書類',
    };
    return `${titles[tab]}を${item ? '編集' : '作成'}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-800">{getModalTitle()}</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {renderForm()}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-100"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 px-4 bg-[#00c4cc] text-white font-bold rounded-lg hover:bg-[#00b3b3] disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
