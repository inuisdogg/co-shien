'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Star,
  MapPin,
  Clock,
  CheckCircle2,
  Heart,
  MessageCircle,
  Calendar,
  Baby,
  UserCircle,
  Share2,
  Shield,
  Loader2,
} from 'lucide-react';
import { usePublicSitter } from '@/hooks/useSitter';
import { SITTER_PROFESSION_LABELS, TOKYO_SUBSIDY_RATE } from '@/types/sitter';

export default function SitterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sitterId = params.sitterId as string;

  const { sitter, isLoading, error } = usePublicSitter(sitterId);
  const [isFavorite, setIsFavorite] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
      </div>
    );
  }

  if (error || !sitter) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Baby className="w-16 h-16 text-pink-300 mb-4" />
        <h2 className="text-lg font-bold text-slate-800 mb-2">シッターが見つかりません</h2>
        <p className="text-sm text-slate-500 text-center mb-6">{error}</p>
        <Link
          href="/sitter"
          className="bg-pink-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-pink-600 transition-colors"
        >
          シッター一覧に戻る
        </Link>
      </div>
    );
  }

  const netRate = sitter.subsidyEligible
    ? Math.max(0, sitter.hourlyRate - TOKYO_SUBSIDY_RATE)
    : sitter.hourlyRate;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white border-b border-pink-100 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button onClick={() => router.back()} className="p-2 text-slate-400">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFavorite(!isFavorite)}
              className={`p-2 rounded-full ${isFavorite ? 'text-pink-500' : 'text-slate-400'}`}
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-pink-500' : ''}`} />
            </button>
            <button className="p-2 text-slate-400">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto">
        {/* プロフィールヘッダー */}
        <section className="bg-white border-b border-slate-100 p-6">
          <div className="flex items-start gap-4">
            <div className="w-24 h-24 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
              {sitter.profileImage ? (
                <img
                  src={sitter.profileImage}
                  alt={sitter.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserCircle className="w-12 h-12 text-slate-300" />
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-slate-800">{sitter.displayName}</h1>
              <div className="flex flex-wrap gap-1 mt-2">
                {sitter.professions.map((prof) => (
                  <span
                    key={prof}
                    className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-md"
                  >
                    {SITTER_PROFESSION_LABELS[prof]}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-sm font-bold text-slate-700">
                    {sitter.ratingAverage.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-slate-400">({sitter.ratingCount}件)</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  実績 {sitter.totalBookings}件 / {sitter.totalHours}h
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 補助金対象バッジ */}
        {sitter.subsidyEligible && (
          <section className="bg-emerald-50 border-b border-emerald-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-emerald-500 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-emerald-700">東京都補助金対象シッター</h3>
                <p className="text-[10px] text-emerald-600">
                  1時間あたり最大¥2,500の補助が適用されます
                </p>
              </div>
            </div>
          </section>
        )}

        {/* 料金 */}
        <section className="bg-white border-b border-slate-100 p-6">
          <h2 className="text-sm font-bold text-slate-700 mb-4">料金</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-[10px] text-slate-400 font-bold">時給</p>
              <p className="text-lg font-black text-slate-700">
                ¥{sitter.hourlyRate.toLocaleString()}
              </p>
            </div>
            {sitter.subsidyEligible && (
              <div className="p-4 bg-pink-50 rounded-xl">
                <p className="text-[10px] text-pink-500 font-bold">補助金適用後</p>
                <p className="text-lg font-black text-pink-600">¥{netRate.toLocaleString()}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              最低{sitter.minimumHours}時間〜
            </div>
            {sitter.canTravel && sitter.travelFee > 0 && (
              <div>交通費: ¥{sitter.travelFee.toLocaleString()}</div>
            )}
          </div>
        </section>

        {/* 自己紹介 */}
        {sitter.introduction && (
          <section className="bg-white border-b border-slate-100 p-6">
            <h2 className="text-sm font-bold text-slate-700 mb-3">自己紹介</h2>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
              {sitter.introduction}
            </p>
          </section>
        )}

        {/* 専門分野 */}
        {sitter.specialty.length > 0 && (
          <section className="bg-white border-b border-slate-100 p-6">
            <h2 className="text-sm font-bold text-slate-700 mb-3">得意分野</h2>
            <div className="flex flex-wrap gap-2">
              {sitter.specialty.map((spec) => (
                <span
                  key={spec}
                  className="text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full"
                >
                  {spec}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* 対応エリア */}
        {sitter.serviceAreas.length > 0 && (
          <section className="bg-white border-b border-slate-100 p-6">
            <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              対応エリア
            </h2>
            <div className="flex flex-wrap gap-2">
              {sitter.serviceAreas.map((area) => (
                <span
                  key={area}
                  className="text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded"
                >
                  {area}
                </span>
              ))}
            </div>
            {sitter.canTravel && (
              <p className="text-[10px] text-slate-400 mt-2">
                上記エリア以外もご相談ください
              </p>
            )}
          </section>
        )}

        {/* 資格認定 */}
        <section className="bg-white border-b border-slate-100 p-6">
          <h2 className="text-sm font-bold text-slate-700 mb-3">資格・認定</h2>
          <div className="space-y-2">
            {sitter.isTokyoCertified && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                東京都ベビーシッター利用支援事業 研修修了済み
              </div>
            )}
            {sitter.professions.map((prof) => (
              <div
                key={prof}
                className="flex items-center gap-2 text-xs text-slate-600 font-medium"
              >
                <CheckCircle2 className="w-4 h-4 text-slate-300" />
                {SITTER_PROFESSION_LABELS[prof]}
              </div>
            ))}
          </div>
        </section>

        {/* レビュー（プレースホルダー） */}
        <section className="bg-white border-b border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-700">レビュー</h2>
            <button className="text-[10px] font-bold text-pink-500">すべて見る</button>
          </div>
          {sitter.ratingCount > 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">レビュー機能は準備中です</p>
            </div>
          ) : (
            <div className="text-center py-8">
              <Star className="w-12 h-12 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">まだレビューはありません</p>
            </div>
          )}
        </section>
      </main>

      {/* 固定フッター */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-4 z-50">
        <div className="max-w-md mx-auto flex gap-3">
          <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-pink-200 text-pink-500 font-bold hover:bg-pink-50 transition-colors">
            <MessageCircle className="w-4 h-4" />
            メッセージ
          </button>
          <button className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl bg-pink-500 text-white font-bold hover:bg-pink-600 transition-colors shadow-lg shadow-pink-200">
            <Calendar className="w-4 h-4" />
            予約する
          </button>
        </div>
      </footer>
    </div>
  );
}
