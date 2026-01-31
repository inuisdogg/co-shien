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
  User,
  Search,
  Filter,
} from 'lucide-react';
import { useExpertConsultations } from '@/hooks/useConsultations';
import { useExpertProfile } from '@/hooks/useExpertProfile';
import { ConsultationThread } from '@/types/expert';

export const dynamic = 'force-dynamic';

export default function ExpertConsultationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'pending' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { profile, isLoading: profileLoading } = useExpertProfile(user?.id);
  const { threads, isLoading: threadsLoading, error } = useExpertConsultations(profile?.id);

  // ユーザー情報取得
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        router.push('/career/login');
      }
    } else {
      router.push('/career/login');
    }
  }, [router]);

  const filteredThreads = threads.filter(thread => {
    if (filterStatus !== 'all' && thread.status !== filterStatus) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        thread.subject.toLowerCase().includes(query) ||
        thread.clientName?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const formatDate = (dateStr: string | null) => {
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

  const isLoading = profileLoading || threadsLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/expert/dashboard')}
                className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h1 className="font-bold text-lg text-gray-900">相談一覧</h1>
            </div>
            <span className="text-sm text-gray-500">
              {filteredThreads.length}件
            </span>
          </div>
        </div>
      </header>

      {/* 検索・フィルター */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-[65px] z-40">
        <div className="max-w-2xl mx-auto space-y-3">
          {/* 検索 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="件名・クライアント名で検索..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* フィルター */}
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
              {filterStatus === 'all' ? '相談がありません' : `${statusLabels[filterStatus]}の相談がありません`}
            </h3>
            <p className="text-gray-500">
              新しい相談が届くとここに表示されます
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredThreads.map((thread) => (
              <Link
                key={thread.id}
                href={`/expert/dashboard/consultations/${thread.id}`}
                className="block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-gray-400" />
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
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-gray-600">{thread.clientName || '匿名'}</span>
                      {thread.childAge && (
                        <span className="text-xs text-gray-400">• {thread.childAge}</span>
                      )}
                    </div>
                    {thread.consultationType && thread.consultationType.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {thread.consultationType.slice(0, 3).map((cat, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded"
                          >
                            {cat}
                          </span>
                        ))}
                        {thread.consultationType.length > 3 && (
                          <span className="text-xs text-gray-400">
                            +{thread.consultationType.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>{thread.messageCount}件のメッセージ</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {formatDate(thread.lastMessageAt || thread.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
