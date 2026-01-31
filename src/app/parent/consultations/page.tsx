'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  MessageCircle,
  Clock,
  AlertCircle,
  Loader2,
  CheckCircle,
  Sparkles,
  Search,
} from 'lucide-react';
import { useClientConsultations } from '@/hooks/useConsultations';
import {
  EXPERT_PROFESSION_LABELS,
  ConsultationThread,
} from '@/types/expert';

export const dynamic = 'force-dynamic';

export default function ClientConsultationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; userType: string } | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'pending' | 'closed'>('all');

  const { threads, isLoading, error, refresh } = useClientConsultations(user?.id);

  // ユーザー情報取得
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed.userType !== 'client' && parsed.userType !== 'staff') {
          router.push('/parent/login');
          return;
        }
        setUser(parsed);
      } catch (e) {
        router.push('/parent/login');
      }
    } else {
      router.push('/parent/login');
    }
  }, [router]);

  const filteredThreads = threads.filter(thread => {
    if (filterStatus === 'all') return true;
    return thread.status === filterStatus;
  });

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    }
    if (isYesterday) {
      return '昨日';
    }
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  const statusColors = {
    open: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    closed: 'bg-gray-100 text-gray-600',
  };

  const statusLabels = {
    open: '対応中',
    pending: '返信待ち',
    closed: '終了',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/parent/dashboard')}
              className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-lg text-gray-900">相談履歴</h1>
          </div>
        </div>
      </header>

      {/* フィルター */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-[65px] z-40">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-2 overflow-x-auto">
            {(['all', 'open', 'pending', 'closed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
                  filterStatus === status
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? 'すべて' : statusLabels[status]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* コンテンツ */}
      <main className="max-w-2xl mx-auto px-4 py-4">
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">{error}</p>
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {filterStatus === 'all' ? '相談履歴がありません' : `${statusLabels[filterStatus]}の相談がありません`}
            </h3>
            <p className="text-gray-500 mb-4">
              専門家に相談してみましょう
            </p>
            <Link
              href="/expert"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              専門家を探す
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredThreads.map((thread) => {
              const expertProfile = thread.expertProfile as any;
              const primaryColor = expertProfile?.pageTheme?.primaryColor || '#10B981';

              return (
                <Link
                  key={thread.id}
                  href={`/client/consultations/${thread.id}`}
                  className="block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
                      style={{
                        backgroundColor: `${primaryColor}15`,
                        color: primaryColor,
                      }}
                    >
                      {thread.expertName?.charAt(0) || 'E'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="font-medium text-gray-900 truncate">
                          {thread.subject}
                        </h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${statusColors[thread.status]}`}>
                          {statusLabels[thread.status]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-2">
                        {thread.expertName}
                        {expertProfile?.profession && (
                          <span className="text-gray-400"> • {EXPERT_PROFESSION_LABELS[expertProfile.profession as keyof typeof EXPERT_PROFESSION_LABELS]}</span>
                        )}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>{thread.messageCount}件</span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatDate(thread.lastMessageAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* 新規相談ボタン */}
      <div className="fixed bottom-6 right-6 safe-area-bottom">
        <Link
          href="/expert"
          className="flex items-center justify-center w-14 h-14 bg-emerald-500 text-white rounded-full shadow-lg hover:bg-emerald-600 transition-colors"
        >
          <Search className="w-6 h-6" />
        </Link>
      </div>
    </div>
  );
}
