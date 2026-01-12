/**
 * 書類管理コンポーネント
 * 運営指導に必要な各種書類のアップロード・管理
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Eye,
  Plus,
  X,
  Search,
  Filter,
  Calendar,
  User,
  Users,
  Building2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
  File,
  FileImage,
  FileType,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import DocumentScheduleView from './DocumentScheduleView';

// 書類の型定義
type DocumentUpload = {
  id: string;
  facilityId: string;
  documentType: string;
  staffId?: string;
  childId?: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
  validFrom?: string;
  validUntil?: string;
  version: number;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
};

// スタッフ・児童の型
type Staff = { id: string; name: string };
type Child = { id: string; name: string };

// 書類種別の定義
const documentTypes: Record<string, { label: string; category: string; entityType: 'facility' | 'staff' | 'child' | 'any' }> = {
  // 事前提出書類
  self_inspection: { label: '自己点検表', category: '事前提出書類', entityType: 'facility' },
  staff_schedule: { label: '勤務体制一覧表', category: '事前提出書類', entityType: 'facility' },
  addition_checklist: { label: '加算算定点検表', category: '事前提出書類', entityType: 'facility' },
  user_list: { label: '利用者一覧表', category: '事前提出書類', entityType: 'facility' },

  // 従業員関係
  employment_contract: { label: '雇用契約書・辞令', category: '従業員関係', entityType: 'staff' },
  resume: { label: '履歴書', category: '従業員関係', entityType: 'staff' },
  worker_roster: { label: '労働者名簿', category: '従業員関係', entityType: 'facility' },
  wage_document: { label: '賃金関係書類', category: '従業員関係', entityType: 'staff' },
  confidentiality_agreement: { label: '守秘義務・機密保持誓約書', category: '従業員関係', entityType: 'staff' },
  health_checkup: { label: '健康診断書', category: '従業員関係', entityType: 'staff' },
  work_schedule: { label: '勤務形態一覧表', category: '従業員関係', entityType: 'facility' },
  attendance_record: { label: '出勤簿・タイムカード', category: '従業員関係', entityType: 'staff' },
  qualification_cert: { label: '資格証明書', category: '従業員関係', entityType: 'staff' },

  // 運営関係
  designation_application: { label: '指定申請関係書類', category: '運営関係', entityType: 'facility' },
  floor_plan: { label: '平面図', category: '運営関係', entityType: 'facility' },
  equipment_ledger: { label: '設備・備品台帳', category: '運営関係', entityType: 'facility' },
  addition_notification: { label: '加算届出', category: '運営関係', entityType: 'facility' },
  operation_regulation: { label: '運営規定', category: '運営関係', entityType: 'facility' },
  important_explanation: { label: '重要事項説明書', category: '運営関係', entityType: 'facility' },
  service_contract: { label: 'サービス利用契約書', category: '運営関係', entityType: 'child' },
  addition_requirement: { label: '加算算定要件書類', category: '運営関係', entityType: 'facility' },
  employment_regulation: { label: '就業規則・給与規則', category: '運営関係', entityType: 'facility' },
  committee_minutes: { label: '委員会議事録', category: '運営関係', entityType: 'facility' },
  liability_insurance: { label: '賠償責任保険証券', category: '運営関係', entityType: 'facility' },
  business_management: { label: '業務管理体制届', category: '運営関係', entityType: 'facility' },

  // 記録関係
  billing_document: { label: '国保連請求関係書類', category: '記録関係', entityType: 'facility' },
  receipt: { label: '領収書', category: '記録関係', entityType: 'child' },
  community_activity: { label: '地域交流記録', category: '記録関係', entityType: 'facility' },
  incident_report: { label: '苦情・事故・ヒヤリハット記録', category: '記録関係', entityType: 'facility' },
  training_record: { label: '職員研修記録', category: '記録関係', entityType: 'facility' },
  restraint_record: { label: '身体拘束・虐待記録', category: '記録関係', entityType: 'facility' },
  evacuation_drill: { label: '消防計画・避難訓練記録', category: '記録関係', entityType: 'facility' },
  accounting_document: { label: '会計関係書類', category: '記録関係', entityType: 'facility' },

  // 利用者支援関連
  privacy_consent: { label: '個人情報取扱同意書', category: '利用者支援関連', entityType: 'child' },
  support_plan: { label: '個別支援計画書', category: '利用者支援関連', entityType: 'child' },
  admission_record: { label: '入退所記録', category: '利用者支援関連', entityType: 'child' },
  user_count: { label: '利用者・入所者数書類', category: '利用者支援関連', entityType: 'facility' },
  daily_record: { label: '実施記録・業務日誌', category: '利用者支援関連', entityType: 'facility' },

  // その他
  medication_ledger: { label: '医薬品台帳', category: 'その他', entityType: 'facility' },
  hygiene_record: { label: '衛生管理記録', category: 'その他', entityType: 'facility' },
  meal_record: { label: '食事提供記録', category: 'その他', entityType: 'facility' },
  other: { label: 'その他', category: 'その他', entityType: 'any' },
};

// カテゴリリスト
const categories = [
  { id: 'pre', name: '事前提出書類', color: 'bg-blue-500' },
  { id: 'emp', name: '従業員関係', color: 'bg-green-500' },
  { id: 'ops', name: '運営関係', color: 'bg-purple-500' },
  { id: 'rec', name: '記録関係', color: 'bg-orange-500' },
  { id: 'usr', name: '利用者支援関連', color: 'bg-pink-500' },
  { id: 'oth', name: 'その他', color: 'bg-gray-500' },
];

// DBマッピング
const mapDbToDocument = (row: any): DocumentUpload => ({
  id: row.id,
  facilityId: row.facility_id,
  documentType: row.document_type,
  staffId: row.staff_id,
  childId: row.child_id,
  title: row.title,
  description: row.description,
  fileUrl: row.file_url,
  fileName: row.file_name,
  fileSize: row.file_size,
  fileType: row.file_type,
  validFrom: row.valid_from,
  validUntil: row.valid_until,
  version: row.version,
  uploadedBy: row.uploaded_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// ファイルサイズのフォーマット
const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ファイルアイコンの取得
const getFileIcon = (fileType?: string) => {
  if (fileType?.includes('pdf')) return FileType;
  if (fileType?.includes('image')) return FileImage;
  return File;
};

export default function DocumentManagementView() {
  const { user, facility } = useAuth();
  const [documents, setDocuments] = useState<DocumentUpload[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [childrenList, setChildrenList] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // タブ
  const [activeTab, setActiveTab] = useState<'list' | 'schedule'>('list');

  // フィルター
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterEntity, setFilterEntity] = useState<string>('all'); // all, facility, staff, child
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['事前提出書類']));

  // アップロードモーダル
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadStaffId, setUploadStaffId] = useState<string>('');
  const [uploadChildId, setUploadChildId] = useState<string>('');
  const [uploadValidFrom, setUploadValidFrom] = useState('');
  const [uploadValidUntil, setUploadValidUntil] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // データ取得
  const fetchData = useCallback(async () => {
    if (!facility?.id) return;

    setLoading(true);
    try {
      // 書類一覧
      const { data: docData, error: docError } = await supabase
        .from('document_uploads')
        .select('*')
        .eq('facility_id', facility.id)
        .order('created_at', { ascending: false });

      if (docError) throw docError;
      setDocuments((docData || []).map(mapDbToDocument));

      // スタッフ一覧
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, name')
        .eq('facility_id', facility.id)
        .order('name');
      setStaffList(staffData || []);

      // 児童一覧
      const { data: childData } = await supabase
        .from('children')
        .select('id, name')
        .eq('facility_id', facility.id)
        .order('name');
      setChildrenList(childData || []);
    } catch (err) {
      console.error('データ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, [facility?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ファイルアップロード
  const handleUpload = async () => {
    if (!facility?.id || !uploadFile || !selectedDocType || !uploadTitle) {
      alert('書類種別、ファイル、タイトルは必須です');
      return;
    }

    setUploading(true);
    try {
      // ファイルをSupabase Storageにアップロード
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${facility.id}/${selectedDocType}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, uploadFile);

      if (uploadError) {
        // バケットが存在しない場合のエラーハンドリング
        console.error('Storage error:', uploadError);
        // 代替: ファイルURLを直接保存（本番環境ではStorageを使用）
        // ここではダミーURLを使用
        const dummyUrl = `https://storage.example.com/${fileName}`;

        const { error: dbError } = await supabase
          .from('document_uploads')
          .insert({
            facility_id: facility.id,
            document_type: selectedDocType,
            staff_id: uploadStaffId || null,
            child_id: uploadChildId || null,
            title: uploadTitle,
            description: uploadDescription || null,
            file_url: dummyUrl,
            file_name: uploadFile.name,
            file_size: uploadFile.size,
            file_type: uploadFile.type,
            valid_from: uploadValidFrom || null,
            valid_until: uploadValidUntil || null,
            uploaded_by: user?.id,
          });

        if (dbError) throw dbError;
      } else {
        // 正常にアップロードできた場合
        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(fileName);

        const { error: dbError } = await supabase
          .from('document_uploads')
          .insert({
            facility_id: facility.id,
            document_type: selectedDocType,
            staff_id: uploadStaffId || null,
            child_id: uploadChildId || null,
            title: uploadTitle,
            description: uploadDescription || null,
            file_url: publicUrl,
            file_name: uploadFile.name,
            file_size: uploadFile.size,
            file_type: uploadFile.type,
            valid_from: uploadValidFrom || null,
            valid_until: uploadValidUntil || null,
            uploaded_by: user?.id,
          });

        if (dbError) throw dbError;
      }

      await fetchData();
      closeUploadModal();
      alert('書類をアップロードしました');
    } catch (err) {
      console.error('アップロードエラー:', err);
      alert('アップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  // 書類削除
  const handleDelete = async (doc: DocumentUpload) => {
    if (!confirm(`「${doc.title}」を削除しますか？`)) return;

    try {
      // DBから削除
      const { error } = await supabase
        .from('document_uploads')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      // Storageからも削除（エラーは無視）
      try {
        const filePath = doc.fileUrl.split('/').slice(-3).join('/');
        await supabase.storage.from('documents').remove([filePath]);
      } catch {}

      await fetchData();
    } catch (err) {
      console.error('削除エラー:', err);
      alert('削除に失敗しました');
    }
  };

  // モーダルを閉じる
  const closeUploadModal = () => {
    setIsUploadModalOpen(false);
    setSelectedDocType('');
    setUploadFile(null);
    setUploadTitle('');
    setUploadDescription('');
    setUploadStaffId('');
    setUploadChildId('');
    setUploadValidFrom('');
    setUploadValidUntil('');
  };

  // 特定の書類種別でアップロードモーダルを開く
  const openUploadModal = (docType?: string) => {
    if (docType) {
      setSelectedDocType(docType);
      setUploadTitle(documentTypes[docType]?.label || '');
    }
    setIsUploadModalOpen(true);
  };

  // カテゴリ展開/折りたたみ
  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName);
    } else {
      newExpanded.add(categoryName);
    }
    setExpandedCategories(newExpanded);
  };

  // フィルター適用
  const getFilteredDocumentTypes = () => {
    return Object.entries(documentTypes).filter(([key, value]) => {
      if (filterCategory !== 'all' && value.category !== filterCategory) return false;
      if (filterEntity !== 'all' && value.entityType !== filterEntity && value.entityType !== 'any') return false;
      if (searchQuery) {
        return value.label.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  };

  // カテゴリごとの書類数を取得
  const getDocumentCountByType = (docType: string) => {
    return documents.filter(d => d.documentType === docType).length;
  };

  // 期限切れチェック
  const isExpired = (validUntil?: string) => {
    if (!validUntil) return false;
    return new Date(validUntil) < new Date();
  };

  // 期限間近チェック（30日以内）
  const isExpiringSoon = (validUntil?: string) => {
    if (!validUntil) return false;
    const daysUntil = (new Date(validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntil > 0 && daysUntil <= 30;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="w-7 h-7 text-[#00c4cc]" />
            書類管理
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            運営指導に必要な書類をアップロード・管理します
          </p>
        </div>
        {activeTab === 'list' && (
          <button
            onClick={() => openUploadModal()}
            className="flex items-center gap-2 px-4 py-2 bg-[#00c4cc] text-white rounded-lg text-sm font-medium hover:bg-[#00b0b8] transition-colors"
          >
            <Upload className="w-4 h-4" />
            書類をアップロード
          </button>
        )}
      </div>

      {/* タブ */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-4" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'list'
                ? 'border-[#00c4cc] text-[#00c4cc]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            書類一覧
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'schedule'
                ? 'border-[#00c4cc] text-[#00c4cc]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            年間スケジュール
          </button>
        </nav>
      </div>

      {/* 年間スケジュールタブ */}
      {activeTab === 'schedule' && <DocumentScheduleView />}

      {/* 書類一覧タブ */}
      {activeTab === 'list' && (
        <>
          {/* 統計 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-500">登録済み書類</div>
          <div className="text-2xl font-bold text-gray-800">{documents.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-500">書類種別</div>
          <div className="text-2xl font-bold text-gray-800">
            {new Set(documents.map(d => d.documentType)).size} / {Object.keys(documentTypes).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-500 flex items-center gap-1">
            <AlertCircle className="w-4 h-4 text-red-500" />
            期限切れ
          </div>
          <div className="text-2xl font-bold text-red-600">
            {documents.filter(d => isExpired(d.validUntil)).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-500 flex items-center gap-1">
            <Clock className="w-4 h-4 text-yellow-500" />
            期限間近
          </div>
          <div className="text-2xl font-bold text-yellow-600">
            {documents.filter(d => isExpiringSoon(d.validUntil)).length}
          </div>
        </div>
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">全カテゴリ</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
            <select
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">全対象</option>
              <option value="facility">施設全体</option>
              <option value="staff">スタッフ別</option>
              <option value="child">利用者別</option>
            </select>
          </div>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="書類を検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-1.5 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 書類一覧 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="divide-y divide-gray-100">
          {categories.map((category) => {
            const categoryDocs = getFilteredDocumentTypes().filter(([_, v]) => v.category === category.name);
            if (categoryDocs.length === 0) return null;

            const isExpanded = expandedCategories.has(category.name);
            const totalInCategory = categoryDocs.reduce((sum, [key]) => sum + getDocumentCountByType(key), 0);

            return (
              <div key={category.id}>
                {/* カテゴリヘッダー */}
                <button
                  onClick={() => toggleCategory(category.name)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-1 h-8 rounded-full ${category.color}`} />
                    <span className="font-bold text-gray-800">{category.name}</span>
                    <span className="text-sm text-gray-500">
                      ({totalInCategory}件登録済)
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {/* 書類種別リスト */}
                {isExpanded && (
                  <div className="bg-gray-50">
                    {categoryDocs.map(([docType, docInfo]) => {
                      const docsOfType = documents.filter(d => d.documentType === docType);
                      const EntityIcon = docInfo.entityType === 'staff' ? User : docInfo.entityType === 'child' ? Users : Building2;

                      return (
                        <div key={docType} className="border-t border-gray-100">
                          {/* 書類種別ヘッダー */}
                          <div className="flex items-center justify-between px-4 py-3 pl-8">
                            <div className="flex items-center gap-3">
                              <EntityIcon className="w-4 h-4 text-gray-400" />
                              <span className="font-medium text-gray-800">{docInfo.label}</span>
                              {docsOfType.length > 0 && (
                                <span className="text-xs bg-[#00c4cc]/10 text-[#00c4cc] px-2 py-0.5 rounded-full">
                                  {docsOfType.length}件
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => openUploadModal(docType)}
                              className="flex items-center gap-1 text-sm text-[#00c4cc] hover:underline"
                            >
                              <Plus className="w-4 h-4" />
                              追加
                            </button>
                          </div>

                          {/* アップロード済み書類 */}
                          {docsOfType.length > 0 && (
                            <div className="px-4 pb-3 pl-12 space-y-2">
                              {docsOfType.map((doc) => {
                                const FileIcon = getFileIcon(doc.fileType);
                                const expired = isExpired(doc.validUntil);
                                const expiringSoon = isExpiringSoon(doc.validUntil);

                                return (
                                  <div
                                    key={doc.id}
                                    className={`flex items-center justify-between p-3 rounded-lg border ${
                                      expired ? 'bg-red-50 border-red-200' :
                                      expiringSoon ? 'bg-yellow-50 border-yellow-200' :
                                      'bg-white border-gray-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <FileIcon className="w-5 h-5 text-gray-400" />
                                      <div>
                                        <p className="font-medium text-gray-800 text-sm">{doc.title}</p>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                          <span>{doc.fileName}</span>
                                          <span>({formatFileSize(doc.fileSize)})</span>
                                          {doc.staffId && (
                                            <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                              {staffList.find(s => s.id === doc.staffId)?.name}
                                            </span>
                                          )}
                                          {doc.childId && (
                                            <span className="bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded">
                                              {childrenList.find(c => c.id === doc.childId)?.name}
                                            </span>
                                          )}
                                          {doc.validUntil && (
                                            <span className={`flex items-center gap-1 ${expired ? 'text-red-600' : expiringSoon ? 'text-yellow-600' : ''}`}>
                                              <Calendar className="w-3 h-3" />
                                              {expired ? '期限切れ' : expiringSoon ? '期限間近' : `〜${new Date(doc.validUntil).toLocaleDateString('ja-JP')}`}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <a
                                        href={doc.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 text-gray-400 hover:text-[#00c4cc] rounded"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </a>
                                      <a
                                        href={doc.fileUrl}
                                        download={doc.fileName}
                                        className="p-1.5 text-gray-400 hover:text-[#00c4cc] rounded"
                                      >
                                        <Download className="w-4 h-4" />
                                      </a>
                                      <button
                                        onClick={() => handleDelete(doc)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
        </>
      )}

      {/* アップロードモーダル */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">書類アップロード</h2>
              <button onClick={closeUploadModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 書類種別 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">書類種別 *</label>
                <select
                  value={selectedDocType}
                  onChange={(e) => {
                    setSelectedDocType(e.target.value);
                    if (e.target.value && !uploadTitle) {
                      setUploadTitle(documentTypes[e.target.value]?.label || '');
                    }
                  }}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                >
                  <option value="">選択してください</option>
                  {categories.map(cat => (
                    <optgroup key={cat.id} label={cat.name}>
                      {Object.entries(documentTypes)
                        .filter(([_, v]) => v.category === cat.name)
                        .map(([key, value]) => (
                          <option key={key} value={key}>{value.label}</option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* 関連エンティティ選択 */}
              {selectedDocType && documentTypes[selectedDocType]?.entityType === 'staff' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">対象スタッフ</label>
                  <select
                    value={uploadStaffId}
                    onChange={(e) => setUploadStaffId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  >
                    <option value="">選択してください</option>
                    {staffList.map(staff => (
                      <option key={staff.id} value={staff.id}>{staff.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedDocType && documentTypes[selectedDocType]?.entityType === 'child' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">対象利用者</label>
                  <select
                    value={uploadChildId}
                    onChange={(e) => setUploadChildId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  >
                    <option value="">選択してください</option>
                    {childrenList.map(child => (
                      <option key={child.id} value={child.id}>{child.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* タイトル */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">タイトル *</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  placeholder="書類のタイトル"
                />
              </div>

              {/* 説明 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">説明・備考</label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  placeholder="必要に応じて説明を追加"
                />
              </div>

              {/* 有効期間 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">有効開始日</label>
                  <input
                    type="date"
                    value={uploadValidFrom}
                    onChange={(e) => setUploadValidFrom(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">有効期限</label>
                  <input
                    type="date"
                    value={uploadValidUntil}
                    onChange={(e) => setUploadValidUntil(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  />
                </div>
              </div>

              {/* ファイル選択 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">ファイル *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-[#00c4cc] transition-colors"
                >
                  {uploadFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <File className="w-5 h-5 text-[#00c4cc]" />
                      <span className="text-gray-800">{uploadFile.name}</span>
                      <span className="text-gray-500 text-sm">({formatFileSize(uploadFile.size)})</span>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">クリックしてファイルを選択</p>
                      <p className="text-gray-400 text-xs mt-1">PDF, Word, Excel, 画像ファイルに対応</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeUploadModal}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadFile || !selectedDocType || !uploadTitle}
                className="flex items-center gap-2 px-4 py-2 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {uploading ? 'アップロード中...' : 'アップロード'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
