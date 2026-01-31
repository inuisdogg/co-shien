'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Filter,
  MessageCircle,
  Video,
  Star,
  CheckCircle,
  ChevronRight,
  Calendar,
  Heart,
  Loader2,
} from 'lucide-react';
import { usePublicExperts } from '@/hooks/useExpertProfile';
import {
  ExpertProfession,
  EXPERT_PROFESSION_LABELS,
} from '@/types/expert';

export const dynamic = 'force-dynamic';

// カテゴリ定義
const CATEGORIES = [
  { key: 'all', label: 'すべて' },
  { key: 'ST', label: '言語 (ST)' },
  { key: 'PT', label: '運動 (PT)' },
  { key: 'OT', label: '生活 (OT)' },
  { key: 'psychologist', label: '心理・行動' },
  { key: 'dietitian', label: '食事' },
  { key: 'nurse', label: '看護' },
  { key: 'nursery_teacher', label: '保育' },
];

export default function ExpertClientPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; userType: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const professionFilter = selectedCategory === 'all'
    ? undefined
    : [selectedCategory as ExpertProfession];

  const { experts, isLoading, error } = usePublicExperts({
    profession: professionFilter,
  });

  // ユーザー情報取得
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse user:', e);
      }
    }
  }, []);

  // 検索フィルタリング
  const filteredExperts = experts.filter(expert => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      expert.displayName.toLowerCase().includes(query) ||
      expert.introduction?.toLowerCase().includes(query) ||
      expert.specialty.some(s => s.toLowerCase().includes(query)) ||
      EXPERT_PROFESSION_LABELS[expert.profession].includes(query)
    );
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // 検索は既にリアルタイムでフィルタリングされる
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 md:pb-0">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Star className="text-white w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-800">
              co-shien <span className="text-emerald-600">Expert</span>
            </h1>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/expert" className="text-emerald-600 border-b-2 border-emerald-500 pb-1">
              専門家を探す
            </Link>
            <Link href="/client/consultations" className="hover:text-emerald-600 transition-colors">
              相談履歴
            </Link>
            <Link href="#" className="hover:text-emerald-600 transition-colors">
              お気に入り
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-300 flex items-center justify-center">
                <span className="text-sm font-bold text-slate-600">
                  {user.name?.charAt(0) || 'U'}
                </span>
              </div>
            ) : (
              <Link
                href="/client/login"
                className="text-sm font-medium text-emerald-600 hover:underline"
              >
                ログイン
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* ヒーローセクション */}
        <section className="mb-8 bg-white rounded-2xl p-6 md:p-10 border border-emerald-100 shadow-sm overflow-hidden relative">
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 mb-3 leading-tight">
              お子さまの「育ち」の悩みを、<br />
              <span className="text-emerald-600">プロフェッショナル</span>に相談。
            </h2>
            <p className="text-slate-600 text-sm md:text-base mb-6 leading-relaxed">
              全国のPT・OT・STや心理士が、あなたの育児をオンラインでサポートします。
              まずはメッセージ1通から、気軽に専門的なアドバイスを受け取りましょう。
            </p>
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="悩みや資格名で検索（例：発語、ADHD、ST）"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                />
              </div>
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md shadow-emerald-200 flex items-center justify-center gap-2"
              >
                検索する
              </button>
            </form>
          </div>
          {/* 背景の装飾的な円 */}
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-emerald-50 rounded-full opacity-50 blur-3xl"></div>
        </section>

        {/* カテゴリフィルター */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide">
          <button className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
            <Filter className="w-5 h-5" />
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
                selectedCategory === cat.key
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-600'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-xl">
            {error}
          </div>
        )}

        {/* 専門職カードグリッド */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : filteredExperts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              専門家が見つかりません
            </h3>
            <p className="text-slate-500 text-sm">
              条件を変更して再度お試しください
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
            {filteredExperts.map((expert) => {
              const primaryColor = expert.pageTheme?.primaryColor || '#10B981';

              return (
                <div
                  key={expert.id}
                  className="group bg-white rounded-2xl border border-slate-200 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300 overflow-hidden flex flex-col"
                >
                  <div className="p-5 flex-1">
                    <div className="flex gap-4 mb-4">
                      <div className="relative">
                        {expert.pageTheme?.profileImage ? (
                          <img
                            src={expert.pageTheme.profileImage}
                            alt={expert.displayName}
                            className="w-16 h-16 rounded-2xl object-cover ring-2 ring-slate-100"
                          />
                        ) : (
                          <div
                            className="w-16 h-16 rounded-2xl ring-2 ring-slate-100 flex items-center justify-center text-2xl font-bold"
                            style={{
                              backgroundColor: `${primaryColor}15`,
                              color: primaryColor,
                            }}
                          >
                            {expert.displayName.charAt(0)}
                          </div>
                        )}
                        {expert.isAcceptingConsultations && (
                          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1 mb-0.5">
                          <h3 className="font-bold text-slate-800 tracking-tight">
                            {expert.displayName}
                          </h3>
                          {expert.qualificationStatus === 'verified' && (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 fill-emerald-50" />
                          )}
                        </div>
                        <p className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded inline-block">
                          {EXPERT_PROFESSION_LABELS[expert.profession]}
                        </p>
                        <div className="flex items-center gap-1 mt-1 text-amber-500">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span className="text-xs font-bold text-slate-700">
                            {expert.ratingAverage?.toFixed(1) || '-'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            ({expert.ratingCount || 0})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 専門タグ */}
                    {expert.specialty.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {expert.specialty.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md"
                          >
                            #{tag}
                          </span>
                        ))}
                        {expert.specialty.length > 3 && (
                          <span className="text-[10px] text-slate-400">
                            +{expert.specialty.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* 説明文 */}
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-4">
                      {expert.introduction || '専門的なアドバイスを提供します。'}
                    </p>

                    {/* 料金 */}
                    <div className="grid grid-cols-2 gap-2 mt-auto">
                      <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-bold mb-0.5">
                          メッセージ相談
                        </p>
                        <p className="text-sm font-extrabold text-slate-700">
                          {expert.freeFirstMessage ? (
                            <span className="text-emerald-600">初回無料</span>
                          ) : (
                            <>
                              ¥{(expert.pricePerMessage * 10).toLocaleString()}
                              <span className="text-[10px] font-normal ml-0.5">/回</span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-bold mb-0.5">
                          ビデオ通話
                        </p>
                        <p className="text-sm font-extrabold text-slate-400">
                          Coming Soon
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* フッター */}
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <Link
                      href={`/expert/${expert.id}`}
                      className="text-xs font-bold text-slate-500 hover:text-emerald-600 flex items-center gap-1 group/link"
                    >
                      プロフィール詳細
                      <ChevronRight className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform" />
                    </Link>
                    <Link
                      href={`/expert/${expert.id}/consult`}
                      className="bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-emerald-600 transition-colors flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      相談する
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 下部バナー: 専門家登録への誘導 */}
        <div className="mt-12 bg-slate-900 rounded-2xl p-8 text-white relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold mb-2">専門家として登録を希望される方へ</h3>
              <p className="text-slate-400 text-sm max-w-lg">
                PT・OT・ST、臨床心理士など、あなたの専門知識を必要としている家族がいます。
                スキマ時間を活用して、リモートで支援を届けませんか？
              </p>
            </div>
            <Link
              href="/expert/register"
              className="whitespace-nowrap bg-white text-slate-900 font-bold py-3 px-8 rounded-xl hover:bg-emerald-50 transition-colors"
            >
              Expertとして登録する
            </Link>
          </div>
          {/* 装飾 */}
          <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        </div>
      </main>

      {/* モバイル用ボトムナビ */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50 safe-area-bottom">
        <Link href="/expert" className="flex flex-col items-center gap-1 text-emerald-600">
          <Search className="w-6 h-6" />
          <span className="text-[10px] font-bold">探す</span>
        </Link>
        <Link href="#" className="flex flex-col items-center gap-1 text-slate-400">
          <Calendar className="w-6 h-6" />
          <span className="text-[10px] font-bold">予約</span>
        </Link>
        <Link href="/client/consultations" className="flex flex-col items-center gap-1 text-slate-400">
          <MessageCircle className="w-6 h-6" />
          <span className="text-[10px] font-bold">チャット</span>
        </Link>
        <Link href="#" className="flex flex-col items-center gap-1 text-slate-400">
          <Heart className="w-6 h-6" />
          <span className="text-[10px] font-bold">保存</span>
        </Link>
      </div>
    </div>
  );
}
