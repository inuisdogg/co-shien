'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MessageCircle,
  FileText,
  Settings,
  User,
  TrendingUp,
  Star,
  Users,
  ChevronRight,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  Loader2,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Wallet,
  PenLine,
} from 'lucide-react';
import { useExpertProfile } from '@/hooks/useExpertProfile';
import { useExpertConsultations } from '@/hooks/useConsultations';
import {
  EXPERT_PROFESSION_LABELS,
  QUALIFICATION_STATUS_LABELS,
  CONSULTATION_STATUS_LABELS,
} from '@/types/expert';

export const dynamic = 'force-dynamic';

type Tab = 'home' | 'consultations' | 'columns' | 'settings';

export default function ExpertDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('home');

  const { profile, isLoading, error, stats, loadStats, updateProfile } = useExpertProfile(user?.id);
  const { threads, isLoading: threadsLoading } = useExpertConsultations(profile?.id);

  // ユーザー情報取得
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed.userType !== 'staff') {
          router.push('/career');
          return;
        }
        setUser(parsed);
      } catch (e) {
        router.push('/career/login');
      }
    } else {
      router.push('/career/login');
    }
  }, [router]);

  // 統計読み込み
  useEffect(() => {
    if (profile) {
      loadStats();
    }
  }, [profile, loadStats]);

  // Expert未登録の場合は登録へ
  useEffect(() => {
    if (!isLoading && !profile && user) {
      router.push('/expert/register');
    }
  }, [isLoading, profile, user, router]);

  const togglePublic = async () => {
    if (!profile) return;
    await updateProfile({ isPublic: !profile.isPublic });
  };

  const toggleAccepting = async () => {
    if (!profile) return;
    await updateProfile({ isAcceptingConsultations: !profile.isAcceptingConsultations });
  };

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  const openThreads = threads.filter(t => t.status === 'open');
  const unreadCount = openThreads.reduce((acc, t) => acc + (t.unreadCount || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900">Expert管理</h1>
                <p className="text-xs text-gray-500">{profile.displayName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* 認証ステータス */}
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  QUALIFICATION_STATUS_LABELS[profile.qualificationStatus].bgColor
                } ${QUALIFICATION_STATUS_LABELS[profile.qualificationStatus].color}`}
              >
                {profile.qualificationStatus === 'verified' && <CheckCircle className="w-3 h-3 inline mr-1" />}
                {QUALIFICATION_STATUS_LABELS[profile.qualificationStatus].label}
              </span>
              <Link
                href={`/expert/${profile.id}`}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              >
                <ExternalLink className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* エラー表示 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* ホームタブ */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* 公開設定 */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">公開設定</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">プロフィール公開</p>
                    <p className="text-sm text-gray-500">一覧に表示されます</p>
                  </div>
                  <button onClick={togglePublic}>
                    {profile.isPublic ? (
                      <ToggleRight className="w-10 h-6 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-10 h-6 text-gray-400" />
                    )}
                  </button>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">相談受付</p>
                    <p className="text-sm text-gray-500">新規相談を受け付けます</p>
                  </div>
                  <button onClick={toggleAccepting}>
                    {profile.isAcceptingConsultations ? (
                      <ToggleRight className="w-10 h-6 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-10 h-6 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* 統計カード */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm text-gray-500">相談中</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.openConsultations || 0}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm text-gray-500">評価</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {profile.ratingAverage > 0 ? profile.ratingAverage.toFixed(1) : '-'}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  <span className="text-sm text-gray-500">購読者</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.activeSubscribers || 0}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-5 h-5 text-purple-500" />
                  <span className="text-sm text-gray-500">コラム閲覧</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.totalColumnViews || 0}
                </p>
              </div>
            </div>

            {/* クイックアクション */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">クイックアクション</h2>
              </div>
              <div className="divide-y divide-gray-100">
                <Link
                  href="/expert/dashboard/profile"
                  className="flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">プロフィール編集</p>
                      <p className="text-sm text-gray-500">自己紹介や専門分野を編集</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </Link>
                <Link
                  href="/expert/dashboard/columns/new"
                  className="flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <PenLine className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">コラムを書く</p>
                      <p className="text-sm text-gray-500">専門知識を発信</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </Link>
                <Link
                  href="/expert/dashboard/settings"
                  className="flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Settings className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">ページカスタマイズ</p>
                      <p className="text-sm text-gray-500">デザインや料金を設定</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </Link>
              </div>
            </div>

            {/* 最新の相談 */}
            {openThreads.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-bold text-gray-900">進行中の相談</h2>
                  <button
                    onClick={() => setActiveTab('consultations')}
                    className="text-sm text-emerald-600"
                  >
                    すべて見る
                  </button>
                </div>
                <div className="divide-y divide-gray-100">
                  {openThreads.slice(0, 3).map((thread) => (
                    <Link
                      key={thread.id}
                      href={`/expert/dashboard/consultations/${thread.id}`}
                      className="flex items-center justify-between p-4 hover:bg-gray-50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {thread.subject}
                        </p>
                        <p className="text-sm text-gray-500">
                          {thread.clientName || '相談者'}
                        </p>
                      </div>
                      {thread.unreadCount && thread.unreadCount > 0 && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-medium rounded-full">
                          {thread.unreadCount}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 相談タブ */}
        {activeTab === 'consultations' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">相談一覧</h2>
            {threadsLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
              </div>
            ) : threads.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl">
                <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">まだ相談がありません</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden divide-y divide-gray-100">
                {threads.map((thread) => (
                  <Link
                    key={thread.id}
                    href={`/expert/dashboard/consultations/${thread.id}`}
                    className="block p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {thread.subject}
                        </p>
                        <p className="text-sm text-gray-500">
                          {thread.clientName || '相談者'} • {thread.childAge && `${thread.childAge}歳`}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          CONSULTATION_STATUS_LABELS[thread.status].bgColor
                        } ${CONSULTATION_STATUS_LABELS[thread.status].color}`}
                      >
                        {CONSULTATION_STATUS_LABELS[thread.status].label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{thread.messageCount}件のメッセージ</span>
                      {thread.lastMessageAt && (
                        <span>
                          最終更新: {new Date(thread.lastMessageAt).toLocaleDateString('ja-JP')}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* コラムタブ */}
        {activeTab === 'columns' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">コラム</h2>
              <Link
                href="/expert/dashboard/columns/new"
                className="px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600"
              >
                新規作成
              </Link>
            </div>
            <div className="text-center py-12 bg-white rounded-xl">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">まだコラムがありません</p>
              <Link
                href="/expert/dashboard/columns/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600"
              >
                <PenLine className="w-4 h-4" />
                最初のコラムを書く
              </Link>
            </div>
          </div>
        )}

        {/* 設定タブ */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">設定</h2>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden divide-y divide-gray-100">
              <Link
                href="/expert/dashboard/profile"
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-900">プロフィール編集</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </Link>
              <Link
                href="/expert/dashboard/pricing"
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <Wallet className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-900">料金設定</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </Link>
              <Link
                href="/expert/dashboard/settings"
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-900">ページカスタマイズ</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* ボトムナビ */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-area-bottom">
        <div className="max-w-4xl mx-auto flex items-center justify-around py-2">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 px-4 py-2 ${
              activeTab === 'home' ? 'text-emerald-600' : 'text-gray-400'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs">ホーム</span>
          </button>
          <button
            onClick={() => setActiveTab('consultations')}
            className={`flex flex-col items-center gap-1 px-4 py-2 relative ${
              activeTab === 'consultations' ? 'text-emerald-600' : 'text-gray-400'
            }`}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-xs">相談</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-2 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('columns')}
            className={`flex flex-col items-center gap-1 px-4 py-2 ${
              activeTab === 'columns' ? 'text-emerald-600' : 'text-gray-400'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-xs">コラム</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1 px-4 py-2 ${
              activeTab === 'settings' ? 'text-emerald-600' : 'text-gray-400'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-xs">設定</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
