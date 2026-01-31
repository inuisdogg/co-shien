/**
 * 行政連携ポータル（事業所側）
 * - 管轄行政の設定
 * - 書類提出管理
 * - 行政との連絡履歴
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  FileText,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  ChevronRight,
  Mail,
  Settings,
  Download,
  Upload,
  Eye,
  RotateCcw,
  Calendar,
  Search,
  Filter,
  MessageSquare,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  GovernmentOrganization,
  FacilityGovernmentLink,
  GovernmentDocumentSubmission,
  GovernmentDocumentCategory,
  GovernmentMessage,
  DocumentSubmissionStatus,
} from '@/types';
import ContractReportModal from './ContractReportModal';
import WorkScheduleReportView from '@/components/compliance/WorkScheduleReportView';

type TabType = 'submissions' | 'messages' | 'settings' | 'work-schedule';

export default function GovernmentPortalView() {
  const { facility, user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('submissions');
  const [loading, setLoading] = useState(true);

  // データ
  const [jurisdictionOrg, setJurisdictionOrg] = useState<GovernmentOrganization | null>(null);
  const [facilityLinks, setFacilityLinks] = useState<FacilityGovernmentLink[]>([]);
  const [submissions, setSubmissions] = useState<GovernmentDocumentSubmission[]>([]);
  const [categories, setCategories] = useState<GovernmentDocumentCategory[]>([]);
  const [messages, setMessages] = useState<GovernmentMessage[]>([]);
  const [allOrganizations, setAllOrganizations] = useState<GovernmentOrganization[]>([]);

  // モーダル
  const [isContractReportModalOpen, setIsContractReportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DocumentSubmissionStatus | 'all'>('all');

  useEffect(() => {
    if (facility?.id) {
      fetchData();
    }
  }, [facility?.id]);

  const fetchData = async () => {
    if (!facility?.id) return;
    setLoading(true);

    try {
      // 管轄行政を取得
      const { data: links } = await supabase
        .from('facility_government_links')
        .select(`
          *,
          organization:organization_id (*)
        `)
        .eq('facility_id', facility.id);

      if (links && links.length > 0) {
        setFacilityLinks(links.map(l => ({
          ...l,
          organization: l.organization,
        })));
        const jurisdiction = links.find(l => l.link_type === 'jurisdiction');
        if (jurisdiction?.organization) {
          setJurisdictionOrg(jurisdiction.organization);
        }
      }

      // 書類カテゴリを取得
      const { data: cats } = await supabase
        .from('government_document_categories')
        .select('*')
        .eq('is_active', true);
      if (cats) {
        setCategories(cats.map(c => ({
          id: c.id,
          code: c.code,
          name: c.name,
          description: c.description,
          submissionFrequency: c.submission_frequency,
          isActive: c.is_active,
          createdAt: c.created_at,
        })));
      }

      // 提出書類を取得
      const { data: subs } = await supabase
        .from('government_document_submissions')
        .select(`
          *,
          organization:organization_id (*),
          category:category_id (*)
        `)
        .eq('facility_id', facility.id)
        .order('created_at', { ascending: false });

      if (subs) {
        setSubmissions(subs.map(s => ({
          id: s.id,
          facilityId: s.facility_id,
          organizationId: s.organization_id,
          categoryId: s.category_id,
          title: s.title,
          targetPeriod: s.target_period,
          targetYear: s.target_year,
          targetMonth: s.target_month,
          content: s.content,
          fileUrl: s.file_url,
          fileName: s.file_name,
          status: s.status,
          submittedAt: s.submitted_at,
          submittedBy: s.submitted_by,
          receivedAt: s.received_at,
          returnReason: s.return_reason,
          completionNote: s.completion_note,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          organization: s.organization,
          category: s.category,
        })));
      }

      // メッセージを取得
      const { data: msgs } = await supabase
        .from('government_messages')
        .select(`
          *,
          organization:organization_id (*)
        `)
        .eq('facility_id', facility.id)
        .order('sent_at', { ascending: false })
        .limit(50);

      if (msgs) {
        setMessages(msgs.map(m => ({
          id: m.id,
          facilityId: m.facility_id,
          organizationId: m.organization_id,
          direction: m.direction,
          subject: m.subject,
          body: m.body,
          attachments: m.attachments,
          sentAt: m.sent_at,
          readAt: m.read_at,
          createdAt: m.created_at,
          organization: m.organization,
        })));
      }

      // 全行政機関を取得（設定用）
      const { data: orgs } = await supabase
        .from('government_organizations')
        .select('*')
        .order('prefecture', { ascending: true })
        .order('name', { ascending: true });

      if (orgs) {
        setAllOrganizations(orgs);
      }
    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  // ステータスバッジ
  const getStatusBadge = (status: DocumentSubmissionStatus) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            <FileText className="w-3 h-3" />
            下書き
          </span>
        );
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <Send className="w-3 h-3" />
            提出済み
          </span>
        );
      case 'received':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700">
            <CheckCircle className="w-3 h-3" />
            受理済み
          </span>
        );
      case 'returned':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
            <RotateCcw className="w-3 h-3" />
            差戻し
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            完了
          </span>
        );
    }
  };

  // フィルタリングされた提出書類
  const filteredSubmissions = submissions.filter(s =>
    statusFilter === 'all' || s.status === statusFilter
  );

  // 統計
  const stats = {
    total: submissions.length,
    draft: submissions.filter(s => s.status === 'draft').length,
    submitted: submissions.filter(s => s.status === 'submitted').length,
    returned: submissions.filter(s => s.status === 'returned').length,
  };

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
              <Building2 className="w-6 h-6 text-indigo-500" />
              行政連携
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              管轄行政への書類提出・連絡を管理します
            </p>
          </div>
          {jurisdictionOrg && (
            <div className="text-right">
              <p className="text-xs text-gray-500">管轄行政</p>
              <p className="font-bold text-gray-800">{jurisdictionOrg.name}</p>
              {jurisdictionOrg.department && (
                <p className="text-sm text-gray-600">{jurisdictionOrg.department}</p>
              )}
            </div>
          )}
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            <p className="text-xs text-gray-500">総提出数</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-500">{stats.draft}</p>
            <p className="text-xs text-gray-500">下書き</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.submitted}</p>
            <p className="text-xs text-gray-500">提出済み</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-orange-600">{stats.returned}</p>
            <p className="text-xs text-gray-500">差戻し</p>
          </div>
        </div>
      </div>

      {/* タブ */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('submissions')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'submissions'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              書類提出
            </button>
            <button
              onClick={() => setActiveTab('messages')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'messages'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <MessageSquare className="w-4 h-4 inline mr-2" />
              連絡履歴
              {messages.filter(m => !m.readAt && m.direction === 'to_facility').length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                  {messages.filter(m => !m.readAt && m.direction === 'to_facility').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('work-schedule')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'work-schedule'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              勤務体制
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              設定
            </button>
          </nav>
        </div>

        {/* 書類提出タブ */}
        {activeTab === 'submissions' && (
          <div className="p-4">
            {/* アクションバー */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as DocumentSubmissionStatus | 'all')}
                  className="text-sm border border-gray-300 rounded-md px-3 py-1.5"
                >
                  <option value="all">すべてのステータス</option>
                  <option value="draft">下書き</option>
                  <option value="submitted">提出済み</option>
                  <option value="received">受理済み</option>
                  <option value="returned">差戻し</option>
                  <option value="completed">完了</option>
                </select>
              </div>
              <button
                onClick={() => setIsContractReportModalOpen(true)}
                disabled={!jurisdictionOrg}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                契約内容報告書を作成
              </button>
            </div>

            {!jurisdictionOrg && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">管轄行政が設定されていません</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      「設定」タブから管轄の市区町村を登録してください。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 提出書類一覧 */}
            {filteredSubmissions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">提出書類がありません</p>
                <p className="text-sm mt-1">「契約内容報告書を作成」ボタンから新規作成できます</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSubmissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getStatusBadge(submission.status)}
                          <h3 className="font-bold text-gray-800">{submission.title}</h3>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {submission.targetPeriod || `${submission.targetYear}年${submission.targetMonth}月`}
                          </span>
                          <span className="flex items-center gap-1">
                            <Building2 className="w-4 h-4" />
                            {submission.organization?.name}
                          </span>
                        </div>
                        {submission.returnReason && (
                          <div className="mt-2 p-2 bg-orange-50 rounded text-sm text-orange-700">
                            <strong>差戻し理由:</strong> {submission.returnReason}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {submission.status === 'draft' && (
                          <button className="p-2 hover:bg-indigo-50 rounded-lg text-indigo-600">
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 連絡履歴タブ */}
        {activeTab === 'messages' && (
          <div className="p-4">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">連絡履歴がありません</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`border rounded-lg p-4 ${
                      message.direction === 'to_facility'
                        ? 'border-indigo-200 bg-indigo-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {message.direction === 'to_facility' ? (
                          <span className="text-xs font-medium text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
                            行政から
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                            送信済み
                          </span>
                        )}
                        <span className="font-bold text-gray-800">{message.subject}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(message.sentAt).toLocaleString('ja-JP')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{message.body}</p>
                    {message.organization && (
                      <p className="text-xs text-gray-500 mt-2">
                        {message.organization.name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 設定タブ */}
        {/* 勤務体制一覧表タブ */}
        {activeTab === 'work-schedule' && (
          <div className="p-4">
            <WorkScheduleReportView />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="p-4">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-500" />
              管轄行政の設定
            </h3>

            {jurisdictionOrg ? (
              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-800">{jurisdictionOrg.name}</p>
                    {jurisdictionOrg.department && (
                      <p className="text-sm text-gray-600">{jurisdictionOrg.department}</p>
                    )}
                    {jurisdictionOrg.email && (
                      <p className="text-sm text-gray-500 mt-1">
                        <Mail className="w-4 h-4 inline mr-1" />
                        {jurisdictionOrg.email}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setIsSettingsModalOpen(true)}
                    className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
                  >
                    変更
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 mb-4">管轄行政が設定されていません</p>
                <button
                  onClick={() => setIsSettingsModalOpen(true)}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-bold"
                >
                  管轄行政を設定
                </button>
              </div>
            )}

            <div className="mt-6">
              <h4 className="text-sm font-bold text-gray-600 mb-2">提出先メールアドレス</h4>
              <p className="text-sm text-gray-500">
                書類を電子提出する際の送信先です。行政側がco-shien Connectに登録している場合、
                担当者がポータルから直接書類を確認できます。
              </p>
              {jurisdictionOrg?.email && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-mono text-gray-700">{jurisdictionOrg.email}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 契約内容報告書作成モーダル */}
      {isContractReportModalOpen && jurisdictionOrg && (
        <ContractReportModal
          isOpen={isContractReportModalOpen}
          onClose={() => setIsContractReportModalOpen(false)}
          facilityId={facility?.id || ''}
          userId={user?.id || ''}
          organization={jurisdictionOrg}
          onCreated={() => {
            setIsContractReportModalOpen(false);
            fetchData();
          }}
        />
      )}

      {/* 管轄行政設定モーダル */}
      {isSettingsModalOpen && (
        <JurisdictionSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          facilityId={facility?.id || ''}
          organizations={allOrganizations}
          currentOrgId={jurisdictionOrg?.id}
          onSaved={() => {
            setIsSettingsModalOpen(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

// 管轄行政設定モーダル
function JurisdictionSettingsModal({
  isOpen,
  onClose,
  facilityId,
  organizations,
  currentOrgId,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  facilityId: string;
  organizations: GovernmentOrganization[];
  currentOrgId?: string;
  onSaved: () => void;
}) {
  const [selectedOrgId, setSelectedOrgId] = useState(currentOrgId || '');
  const [contactEmail, setContactEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 新規行政機関追加用
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDepartment, setNewOrgDepartment] = useState('');
  const [newOrgPrefecture, setNewOrgPrefecture] = useState('');
  const [newOrgEmail, setNewOrgEmail] = useState('');

  const filteredOrgs = organizations.filter(org =>
    org.name.includes(searchTerm) ||
    org.prefecture?.includes(searchTerm) ||
    org.department?.includes(searchTerm)
  );

  const handleSave = async () => {
    if (!selectedOrgId && !isAddingNew) return;

    setSaving(true);
    try {
      let orgId = selectedOrgId;

      // 新規行政機関を追加する場合
      if (isAddingNew && newOrgName) {
        const { data: newOrg, error: insertError } = await supabase
          .from('government_organizations')
          .insert({
            name: newOrgName,
            department: newOrgDepartment || null,
            prefecture: newOrgPrefecture || null,
            email: newOrgEmail || null,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        orgId = newOrg.id;
      }

      // 既存のリンクを削除
      await supabase
        .from('facility_government_links')
        .delete()
        .eq('facility_id', facilityId)
        .eq('link_type', 'jurisdiction');

      // 新しいリンクを作成
      const { error: linkError } = await supabase
        .from('facility_government_links')
        .insert({
          facility_id: facilityId,
          organization_id: orgId,
          link_type: 'jurisdiction',
          primary_contact_email: contactEmail || null,
        });

      if (linkError) throw linkError;

      onSaved();
    } catch (error: any) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg shadow-2xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="font-bold text-lg text-gray-800">管轄行政の設定</h3>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {!isAddingNew ? (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">
                  行政機関を検索
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="市区町村名で検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                {filteredOrgs.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    該当する行政機関がありません
                  </div>
                ) : (
                  filteredOrgs.map((org) => (
                    <label
                      key={org.id}
                      className={`flex items-center p-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${
                        selectedOrgId === org.id ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="organization"
                        className="mr-3 text-indigo-600"
                        checked={selectedOrgId === org.id}
                        onChange={() => setSelectedOrgId(org.id)}
                      />
                      <div>
                        <p className="font-medium text-gray-800">{org.name}</p>
                        <p className="text-xs text-gray-500">
                          {org.prefecture} {org.department && `/ ${org.department}`}
                        </p>
                      </div>
                    </label>
                  ))
                )}
              </div>

              <button
                onClick={() => setIsAddingNew(true)}
                className="text-sm text-indigo-600 hover:underline"
              >
                + 新しい行政機関を登録
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  市区町村名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="例: 府中市"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">部署名</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="例: 福祉保健部 障害者福祉課"
                  value={newOrgDepartment}
                  onChange={(e) => setNewOrgDepartment(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">都道府県</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="例: 東京都"
                  value={newOrgPrefecture}
                  onChange={(e) => setNewOrgPrefecture(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">メールアドレス</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="例: fukushi@city.fuchu.tokyo.jp"
                  value={newOrgEmail}
                  onChange={(e) => setNewOrgEmail(e.target.value)}
                />
              </div>

              <button
                onClick={() => setIsAddingNew(false)}
                className="text-sm text-gray-500 hover:underline"
              >
                ← 既存の行政機関から選択
              </button>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">
              連絡先メールアドレス（任意）
            </label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="書類提出時の通知先"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              書類を提出した際にこのアドレスに通知メールが送信されます
            </p>
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-bold"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (!selectedOrgId && (!isAddingNew || !newOrgName))}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-bold disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
