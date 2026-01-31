/**
 * CompanyDocumentsSettings - 会社書類・規則管理
 * 施設設定の一部として、就業規則・会社書類・お知らせを管理
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
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import FileUploader from '@/components/common/FileUploader';

interface CompanyDocumentsSettingsProps {
  facilityId: string;
}

type SectionId = 'announcements' | 'work_rules' | 'company_docs';

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

export default function CompanyDocumentsSettings({ facilityId }: CompanyDocumentsSettingsProps) {
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(new Set(['announcements']));
  const [loading, setLoading] = useState<SectionId | null>(null);
  const [staffCount, setStaffCount] = useState(0);

  // データ
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [workRules, setWorkRules] = useState<WorkRule[]>([]);
  const [companyDocs, setCompanyDocs] = useState<CompanyDocument[]>([]);

  // モーダル
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<SectionId>('announcements');
  const [editingItem, setEditingItem] = useState<any>(null);

  const sections = [
    { id: 'announcements' as SectionId, label: 'お知らせ', icon: Bell, description: '全スタッフへのお知らせを配信' },
    { id: 'work_rules' as SectionId, label: '就業規則', icon: Scale, description: '就業規則・社内規程を登録' },
    { id: 'company_docs' as SectionId, label: '会社書類', icon: FolderOpen, description: '各種書類を配布' },
  ];

  useEffect(() => {
    loadStaffCount();
    loadAllData();
  }, [facilityId]);

  const loadStaffCount = async () => {
    const { count } = await supabase
      .from('employment_records')
      .select('*', { count: 'exact', head: true })
      .eq('facility_id', facilityId)
      .is('end_date', null);
    setStaffCount(count || 0);
  };

  const loadAllData = async () => {
    await Promise.all([loadAnnouncements(), loadWorkRules(), loadCompanyDocs()]);
  };

  const loadAnnouncements = async () => {
    const { data } = await supabase
      .from('facility_announcements')
      .select('*')
      .eq('facility_id', facilityId)
      .order('published_at', { ascending: false });

    if (data) {
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

  const loadWorkRules = async () => {
    const { data } = await supabase
      .from('work_rules')
      .select('*')
      .eq('facility_id', facilityId)
      .order('category')
      .order('title');

    if (data) {
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
    const { data } = await supabase
      .from('company_documents')
      .select('*')
      .eq('facility_id', facilityId)
      .order('uploaded_at', { ascending: false });

    if (data) {
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

  const toggleSection = (sectionId: SectionId) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(sectionId)) {
      newSet.delete(sectionId);
    } else {
      newSet.add(sectionId);
    }
    setExpandedSections(newSet);
  };

  const handleDelete = async (sectionId: SectionId, id: string) => {
    if (!confirm('削除してもよろしいですか？')) return;

    const tableMap: Record<SectionId, string> = {
      announcements: 'facility_announcements',
      work_rules: 'work_rules',
      company_docs: 'company_documents',
    };

    const { error } = await supabase.from(tableMap[sectionId]).delete().eq('id', id);
    if (!error) {
      if (sectionId === 'announcements') loadAnnouncements();
      else if (sectionId === 'work_rules') loadWorkRules();
      else loadCompanyDocs();
    }
  };

  const openModal = (sectionId: SectionId, item?: any) => {
    setModalType(sectionId);
    setEditingItem(item || null);
    setShowModal(true);
  };

  const priorityConfig = {
    high: { label: '重要', color: 'bg-red-100 text-red-700' },
    normal: { label: '通常', color: 'bg-blue-100 text-blue-700' },
    low: { label: '参考', color: 'bg-gray-100 text-gray-600' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Scale size={20} className="text-[#00c4cc]" />
        <h3 className="font-bold text-lg text-gray-800">会社書類・規則管理</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        全スタッフに配信する就業規則、会社書類、お知らせを管理します。
      </p>

      {sections.map((section) => {
        const Icon = section.icon;
        const isExpanded = expandedSections.has(section.id);
        const data = section.id === 'announcements' ? announcements
          : section.id === 'work_rules' ? workRules
          : companyDocs;

        return (
          <div key={section.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-[#00c4cc]" />
                <div className="text-left">
                  <span className="font-bold text-gray-800">{section.label}</span>
                  <span className="ml-2 text-sm text-gray-500">({data.length}件)</span>
                </div>
              </div>
              {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            {isExpanded && (
              <div className="p-4 border-t border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-gray-600">{section.description}</p>
                  <button
                    onClick={() => openModal(section.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#00c4cc] text-white text-sm font-bold rounded-lg hover:bg-[#00b3b3]"
                  >
                    <Plus className="w-4 h-4" />
                    追加
                  </button>
                </div>

                {data.length === 0 ? (
                  <p className="text-center text-gray-400 py-6">データがありません</p>
                ) : (
                  <div className="space-y-2">
                    {section.id === 'announcements' && announcements.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${priorityConfig[item.priority].color}`}>
                              {priorityConfig[item.priority].label}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${item.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                              {item.isPublished ? '公開中' : '下書き'}
                            </span>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {item.readCount}/{staffCount}人
                            </span>
                          </div>
                          <p className="font-medium text-gray-800 text-sm">{item.title}</p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openModal('announcements', item)} className="p-2 text-gray-400 hover:text-[#00c4cc]">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete('announcements', item.id)} className="p-2 text-gray-400 hover:text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {section.id === 'work_rules' && workRules.map((item) => (
                      <div key={item.id} className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg ${!item.isActive ? 'opacity-60' : ''}`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">{item.category}</span>
                            <span className="text-xs text-gray-500">Ver.{item.version}</span>
                          </div>
                          <p className="font-medium text-gray-800 text-sm">{item.title}</p>
                        </div>
                        <div className="flex gap-1">
                          {item.pdfUrl && (
                            <a href={item.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-[#00c4cc]">
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          <button onClick={() => openModal('work_rules', item)} className="p-2 text-gray-400 hover:text-[#00c4cc]">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete('work_rules', item.id)} className="p-2 text-gray-400 hover:text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {section.id === 'company_docs' && companyDocs.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-700">{item.category}</span>
                            <span className="text-xs text-gray-500 uppercase">{item.fileType}</span>
                          </div>
                          <p className="font-medium text-gray-800 text-sm">{item.title}</p>
                        </div>
                        <div className="flex gap-1">
                          <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-[#00c4cc]">
                            <Download className="w-4 h-4" />
                          </a>
                          <button onClick={() => openModal('company_docs', item)} className="p-2 text-gray-400 hover:text-[#00c4cc]">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete('company_docs', item.id)} className="p-2 text-gray-400 hover:text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {showModal && (
        <EditModal
          type={modalType}
          item={editingItem}
          facilityId={facilityId}
          onClose={() => { setShowModal(false); setEditingItem(null); }}
          onSave={() => {
            setShowModal(false);
            setEditingItem(null);
            if (modalType === 'announcements') loadAnnouncements();
            else if (modalType === 'work_rules') loadWorkRules();
            else loadCompanyDocs();
          }}
        />
      )}
    </div>
  );
}

function EditModal({
  type,
  item,
  facilityId,
  onClose,
  onSave,
}: {
  type: SectionId;
  item: any;
  facilityId: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState<any>(item || {});
  const [saving, setSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string } | null>(
    item?.pdfUrl ? { url: item.pdfUrl, name: 'アップロード済み' } :
    item?.fileUrl ? { url: item.fileUrl, name: item.fileName || 'アップロード済み' } : null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const tableMap: Record<SectionId, string> = {
        announcements: 'facility_announcements',
        work_rules: 'work_rules',
        company_docs: 'company_documents',
      };

      let data: any = { facility_id: facilityId };

      if (type === 'announcements') {
        data = { ...data, title: formData.title, content: formData.content, priority: formData.priority || 'normal', published_at: formData.publishedAt || new Date().toISOString(), expires_at: formData.expiresAt || null, is_published: formData.isPublished ?? true };
      } else if (type === 'work_rules') {
        data = { ...data, title: formData.title, description: formData.description, category: formData.category || '一般', version: formData.version || '1.0', effective_date: formData.effectiveDate, is_active: formData.isActive ?? true, pdf_url: uploadedFile?.url || formData.pdfUrl };
      } else {
        if (!uploadedFile?.url && !formData.fileUrl) {
          alert('ファイルをアップロードしてください');
          setSaving(false);
          return;
        }
        data = { ...data, title: formData.title, description: formData.description, category: formData.category || '一般', file_url: uploadedFile?.url || formData.fileUrl, file_name: uploadedFile?.name || formData.fileName, file_type: (uploadedFile?.name || formData.fileName || 'pdf').split('.').pop()?.toLowerCase() || 'pdf', uploaded_at: new Date().toISOString() };
      }

      if (item?.id) {
        await supabase.from(tableMap[type]).update(data).eq('id', item.id);
      } else {
        await supabase.from(tableMap[type]).insert(data);
      }
      onSave();
    } catch (err: any) {
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const titles = { announcements: 'お知らせ', work_rules: '就業規則', company_docs: '会社書類' };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-bold">{titles[type]}を{item ? '編集' : '作成'}</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">タイトル *</label>
            <input type="text" value={formData.title || ''} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required />
          </div>

          {type === 'announcements' && (
            <>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">内容 *</label>
                <textarea value={formData.content || ''} onChange={(e) => setFormData({ ...formData, content: e.target.value })} rows={4} className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">優先度</label>
                  <select value={formData.priority || 'normal'} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                    <option value="high">重要</option>
                    <option value="normal">通常</option>
                    <option value="low">参考</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">掲載期限</label>
                  <input type="date" value={formData.expiresAt?.split('T')[0] || ''} onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.isPublished ?? true} onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })} className="w-4 h-4" />
                <span className="text-sm text-gray-700">公開する</span>
              </label>
            </>
          )}

          {type === 'work_rules' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">カテゴリ</label>
                  <select value={formData.category || '一般'} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                    <option value="一般">一般</option>
                    <option value="勤怠">勤怠</option>
                    <option value="給与">給与</option>
                    <option value="福利厚生">福利厚生</option>
                    <option value="服務規律">服務規律</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">バージョン</label>
                  <input type="text" value={formData.version || '1.0'} onChange={(e) => setFormData({ ...formData, version: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">施行日 *</label>
                <input type="date" value={formData.effectiveDate?.split('T')[0] || ''} onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">PDFファイル</label>
                <FileUploader bucket="documents" folder={`facilities/${facilityId}/work-rules`} accept=".pdf" maxSizeMB={20} label="就業規則PDFをアップロード" currentFile={uploadedFile} onUpload={(url, name) => setUploadedFile({ url, name })} onRemove={() => setUploadedFile(null)} />
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={formData.isActive ?? true} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="w-4 h-4" />
                <span className="text-sm text-gray-700">有効にする</span>
              </label>
            </>
          )}

          {type === 'company_docs' && (
            <>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">カテゴリ</label>
                <select value={formData.category || '一般'} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                  <option value="一般">一般</option>
                  <option value="重要">重要</option>
                  <option value="福利厚生">福利厚生</option>
                  <option value="研修">研修</option>
                  <option value="その他">その他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">説明</label>
                <textarea value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">ファイル *</label>
                <FileUploader bucket="documents" folder={`facilities/${facilityId}/company-docs`} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" maxSizeMB={20} label="書類ファイルをアップロード" currentFile={uploadedFile} onUpload={(url, name) => setUploadedFile({ url, name })} onRemove={() => setUploadedFile(null)} />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-100">キャンセル</button>
            <button type="submit" disabled={saving} className="flex-1 py-3 px-4 bg-[#00c4cc] text-white font-bold rounded-lg hover:bg-[#00b3b3] disabled:opacity-50">{saving ? '保存中...' : '保存'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
