'use client';

import { Star, MessageCircle, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import {
  ExpertProfile,
  EXPERT_PROFESSION_LABELS,
  QUALIFICATION_STATUS_LABELS,
} from '@/types/expert';

type ExpertCardProps = {
  expert: ExpertProfile;
  showFullInfo?: boolean;
};

export default function ExpertCard({ expert, showFullInfo = false }: ExpertCardProps) {
  const primaryColor = expert.pageTheme?.primaryColor || '#10B981';

  return (
    <Link href={`/expert/${expert.id}`}>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
        {/* ヘッダー部分 */}
        <div
          className="h-20 relative"
          style={{
            background: expert.pageTheme?.headerImage
              ? `url(${expert.pageTheme.headerImage}) center/cover`
              : `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}99 100%)`,
          }}
        >
          {/* プロフィール画像 */}
          <div className="absolute -bottom-8 left-4">
            <div
              className="w-16 h-16 rounded-full border-4 border-white bg-white flex items-center justify-center text-2xl font-bold shadow-sm"
              style={{ color: primaryColor }}
            >
              {expert.pageTheme?.profileImage ? (
                <img
                  src={expert.pageTheme.profileImage}
                  alt={expert.displayName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                expert.displayName.charAt(0)
              )}
            </div>
          </div>

          {/* 認証バッジ */}
          {expert.qualificationStatus === 'verified' && (
            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-700">認証済</span>
            </div>
          )}
        </div>

        {/* コンテンツ部分 */}
        <div className="pt-10 px-4 pb-4">
          {/* 名前と職種 */}
          <div className="mb-2">
            <h3 className="font-bold text-gray-900">{expert.displayName}</h3>
            <p className="text-sm text-gray-600">{EXPERT_PROFESSION_LABELS[expert.profession]}</p>
          </div>

          {/* 専門分野タグ */}
          {expert.specialty.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {expert.specialty.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-0.5 text-xs rounded-full"
                  style={{
                    backgroundColor: `${primaryColor}15`,
                    color: primaryColor,
                  }}
                >
                  {tag}
                </span>
              ))}
              {expert.specialty.length > 3 && (
                <span className="px-2 py-0.5 text-xs text-gray-500">
                  +{expert.specialty.length - 3}
                </span>
              )}
            </div>
          )}

          {/* 自己紹介（短縮版） */}
          {showFullInfo && expert.introduction && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {expert.introduction}
            </p>
          )}

          {/* 統計情報 */}
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
            {expert.ratingCount > 0 && (
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="font-medium text-gray-700">{expert.ratingAverage.toFixed(1)}</span>
                <span>({expert.ratingCount})</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <MessageCircle className="w-4 h-4" />
              <span>{expert.totalConsultations}件</span>
            </div>
          </div>

          {/* 料金 */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div>
              <span className="text-xs text-gray-500">相談料金</span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold" style={{ color: primaryColor }}>
                  {expert.pricePerMessage}
                </span>
                <span className="text-sm text-gray-600">pt/回</span>
              </div>
            </div>
            {expert.freeFirstMessage && (
              <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                初回無料
              </span>
            )}
          </div>

          {/* 受付状態 */}
          {!expert.isAcceptingConsultations && (
            <div className="mt-3 flex items-center gap-1 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>現在相談を受け付けていません</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
