/**
 * 行政向けポータル（Connect Portal）
 * - メールアドレス + トークンでアクセス
 * - 提出された書類の確認・受理
 * - 連絡会の日程調整
 * - 事業所への連絡
 */

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Building2,
  FileText,
  Calendar,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  Download,
  Send,
  RotateCcw,
  ChevronRight,
  Mail,
  LogOut,
  Users,
  Search,
  Filter,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type TabType = 'documents' | 'meetings' | 'messages';

interface GovAccount {
  id: string;
  email: string;
  name?: string;
  role: string;
  organization: {
    id: string;
    name: string;
    department?: string;
  };
}

interface Submission {
  id: string;
  facilityId: string;
  facilityName: string;
  title: string;
  targetPeriod?: string;
  status: string;
  submittedAt?: string;
  createdAt: string;
  categoryName: string;
}

interface Meeting {
  id: string;
  facilityId: string;
  facilityName: string;
  title: string;
  purpose?: string;
  status: string;
  childName?: string;
  createdAt: string;
}

function PortalContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<GovAccount | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('documents');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (token) {
      verifyToken();
    } else {
      setError('アクセストークンが必要です');
      setLoading(false);
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      // トークンでアカウントを検証
      const { data: accountData, error: accountError } = await supabase
        .from('government_accounts')
        .select(`
          *,
          organization:organization_id (*)
        `)
        .eq('access_token', token)
        .eq('is_active', true)
        .single();

      if (accountError || !accountData) {
        setError('無効なアクセストークンです');
        setLoading(false);
        return;
      }

      // トークンの有効期限チェック
      if (accountData.token_expires_at && new Date(accountData.token_expires_at) < new Date()) {
        setError('アクセストークンの有効期限が切れています');
        setLoading(false);
        return;
      }

      setAccount({
        id: accountData.id,
        email: accountData.email,
        name: accountData.name,
        role: accountData.role,
        organization: accountData.organization,
      });

      // 最終アクセス日時を更新
      await supabase
        .from('government_accounts')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('id', accountData.id);

      // データを取得
      await fetchData(accountData.organization.id);
    } catch (err) {
      console.error('認証エラー:', err);
      setError('認証に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async (organizationId: string) => {
    try {
      // 提出書類を取得
      const { data: subs } = await supabase
        .from('government_document_submissions')
        .select(`
          *,
          facility:facility_id (id, name),
          category:category_id (name)
        `)
        .eq('organization_id', organizationId)
        .neq('status', 'draft')
        .order('submitted_at', { ascending: false });

      if (subs) {
        setSubmissions(subs.map(s => ({
          id: s.id,
          facilityId: s.facility_id,
          facilityName: s.facility?.name || '',
          title: s.title,
          targetPeriod: s.target_period,
          status: s.status,
          submittedAt: s.submitted_at,
          createdAt: s.created_at,
          categoryName: s.category?.name || '',
        })));
      }

      // 連絡会を取得（この行政機関が参加者として招待されているもの）
      const { data: participants } = await supabase
        .from('connect_meeting_participants')
        .select(`
          meeting_id,
          status,
          meeting:meeting_id (
            *,
            facility:facility_id (id, name),
            child:child_id (name)
          )
        `)
        .eq('organization_name', account?.organization?.name || '');

      if (participants) {
        const meetingList: Meeting[] = participants
          .filter((p: any) => p.meeting)
          .map((p: any) => {
            const meeting = p.meeting as any;
            return {
              id: meeting.id,
              facilityId: meeting.facility_id,
              facilityName: meeting.facility?.name || '',
              title: meeting.title,
              purpose: meeting.purpose,
              status: meeting.status,
              childName: meeting.child?.name,
              createdAt: meeting.created_at,
            };
          });
        setMeetings(meetingList);
      }
    } catch (err) {
      console.error('データ取得エラー:', err);
    }
  };

  // 書類を受理
  const handleReceive = async (submissionId: string) => {
    if (!confirm('この書類を受理しますか？')) return;

    try {
      const { error } = await supabase
        .from('government_document_submissions')
        .update({
          status: 'received',
          received_at: new Date().toISOString(),
          received_by: account?.id,
        })
        .eq('id', submissionId);

      if (error) throw error;

      // 一覧を更新
      setSubmissions(submissions.map(s =>
        s.id === submissionId ? { ...s, status: 'received' } : s
      ));
    } catch (err: any) {
      alert('受理に失敗しました: ' + err.message);
    }
  };

  // 書類を差戻し
  const handleReturn = async (submissionId: string) => {
    const reason = prompt('差戻し理由を入力してください:');
    if (!reason) return;

    try {
      const { error } = await supabase
        .from('government_document_submissions')
        .update({
          status: 'returned',
          return_reason: reason,
        })
        .eq('id', submissionId);

      if (error) throw error;

      setSubmissions(submissions.map(s =>
        s.id === submissionId ? { ...s, status: 'returned' } : s
      ));
    } catch (err: any) {
      alert('差戻しに失敗しました: ' + err.message);
    }
  };

  // 完了にする
  const handleComplete = async (submissionId: string) => {
    try {
      const { error } = await supabase
        .from('government_document_submissions')
        .update({
          status: 'completed',
          completion_note: '処理完了',
        })
        .eq('id', submissionId);

      if (error) throw error;

      setSubmissions(submissions.map(s =>
        s.id === submissionId ? { ...s, status: 'completed' } : s
      ));
    } catch (err: any) {
      alert('完了処理に失敗しました: ' + err.message);
    }
  };

  // ステータスバッジ
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <Clock className="w-3 h-3" />
            未処理
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
      default:
        return null;
    }
  };

  // フィルタリング
  const filteredSubmissions = submissions.filter(s =>
    statusFilter === 'all' || s.status === statusFilter
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="text-gray-500 mt-4">認証中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">アクセスエラー</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-sm text-gray-500">
            アクセスリンクが正しいか確認してください。
            問題が続く場合は事業所にお問い合わせください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-indigo-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8" />
              <div>
                <h1 className="text-xl font-bold">co-shien Connect</h1>
                <p className="text-indigo-200 text-sm">行政ポータル</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-medium">{account?.organization?.name}</p>
              <p className="text-indigo-200 text-sm">{account?.name || account?.email}</p>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* 統計カード */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-3xl font-bold text-gray-800">{submissions.length}</p>
            <p className="text-sm text-gray-500">提出書類</p>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow-sm p-4">
            <p className="text-3xl font-bold text-yellow-600">
              {submissions.filter(s => s.status === 'submitted').length}
            </p>
            <p className="text-sm text-gray-500">未処理</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-3xl font-bold text-gray-800">{meetings.length}</p>
            <p className="text-sm text-gray-500">連絡会</p>
          </div>
          <div className="bg-blue-50 rounded-lg shadow-sm p-4">
            <p className="text-3xl font-bold text-blue-600">
              {meetings.filter(m => m.status === 'scheduling').length}
            </p>
            <p className="text-sm text-gray-500">日程調整中</p>
          </div>
        </div>

        {/* タブ */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('documents')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'documents'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                提出書類
                {submissions.filter(s => s.status === 'submitted').length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-500 text-white rounded-full">
                    {submissions.filter(s => s.status === 'submitted').length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('meetings')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'meetings'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Calendar className="w-4 h-4 inline mr-2" />
                連絡会
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
                連絡
              </button>
            </nav>
          </div>

          {/* 提出書類タブ */}
          {activeTab === 'documents' && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1.5"
                  >
                    <option value="all">すべて</option>
                    <option value="submitted">未処理</option>
                    <option value="received">受理済み</option>
                    <option value="returned">差戻し</option>
                    <option value="completed">完了</option>
                  </select>
                </div>
              </div>

              {filteredSubmissions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>提出書類がありません</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSubmissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {getStatusBadge(submission.status)}
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                              {submission.categoryName}
                            </span>
                          </div>
                          <h3 className="font-bold text-gray-800">{submission.title}</h3>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-4 h-4" />
                              {submission.facilityName}
                            </span>
                            {submission.submittedAt && (
                              <span>
                                提出: {new Date(submission.submittedAt).toLocaleDateString('ja-JP')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
                            <Download className="w-4 h-4" />
                          </button>
                          {submission.status === 'submitted' && (
                            <>
                              <button
                                onClick={() => handleReceive(submission.id)}
                                className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-medium"
                              >
                                受理
                              </button>
                              <button
                                onClick={() => handleReturn(submission.id)}
                                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium"
                              >
                                差戻し
                              </button>
                            </>
                          )}
                          {submission.status === 'received' && (
                            <button
                              onClick={() => handleComplete(submission.id)}
                              className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium"
                            >
                              完了
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 連絡会タブ */}
          {activeTab === 'meetings' && (
            <div className="p-4">
              {meetings.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>連絡会がありません</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {meetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              meeting.status === 'scheduling' ? 'bg-yellow-100 text-yellow-700' :
                              meeting.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                              meeting.status === 'completed' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {meeting.status === 'scheduling' ? '日程調整中' :
                               meeting.status === 'confirmed' ? '日程確定' :
                               meeting.status === 'completed' ? '開催完了' : meeting.status}
                            </span>
                          </div>
                          <h3 className="font-bold text-gray-800">{meeting.title}</h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            <span>{meeting.facilityName}</span>
                            {meeting.childName && (
                              <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {meeting.childName}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 連絡タブ */}
          {activeTab === 'messages' && (
            <div className="p-4">
              <div className="text-center py-12 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>事業所への連絡機能は準備中です</p>
                <button className="mt-4 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50" disabled>
                  <Send className="w-4 h-4 inline mr-2" />
                  新規連絡を作成
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* フッター */}
      <footer className="mt-12 py-6 border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>co-shien Connect - 障害児通所支援事業所向け業務支援システム</p>
        </div>
      </footer>
    </div>
  );
}

export default function GovernmentPortalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    }>
      <PortalContent />
    </Suspense>
  );
}
