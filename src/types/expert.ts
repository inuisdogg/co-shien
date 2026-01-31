/**
 * Expert領域 - 型定義
 * 福祉専門職がオンラインで相談サービスを提供するプラットフォーム
 */

// ========================================
// 専門職種
// ========================================

export type ExpertProfession =
  | 'PT'              // 理学療法士
  | 'OT'              // 作業療法士
  | 'ST'              // 言語聴覚士
  | 'psychologist'    // 心理士
  | 'nursery_teacher' // 保育士
  | 'nurse'           // 看護師
  | 'dietitian'       // 管理栄養士
  | 'social_worker';  // 社会福祉士

export const EXPERT_PROFESSION_LABELS: Record<ExpertProfession, string> = {
  PT: '理学療法士',
  OT: '作業療法士',
  ST: '言語聴覚士',
  psychologist: '心理士',
  nursery_teacher: '保育士',
  nurse: '看護師',
  dietitian: '管理栄養士',
  social_worker: '社会福祉士',
};

export const EXPERT_PROFESSION_ICONS: Record<ExpertProfession, string> = {
  PT: 'Activity',        // 運動・リハビリ
  OT: 'Hand',            // 作業療法
  ST: 'MessageCircle',   // 言語・コミュニケーション
  psychologist: 'Brain', // 心理
  nursery_teacher: 'Baby', // 保育
  nurse: 'Heart',        // 看護
  dietitian: 'Apple',    // 栄養
  social_worker: 'Users', // 福祉
};

// 専門分野タグ（フリー入力も可）
export const COMMON_SPECIALTY_TAGS = [
  '発達障害',
  '自閉スペクトラム症',
  'ADHD',
  '学習障害',
  '運動発達',
  '言語発達',
  '食事・栄養',
  '睡眠',
  '行動問題',
  '兄弟関係',
  '就学相談',
  '療育',
  '感覚過敏',
  'コミュニケーション',
  '社会性',
  '情緒',
  '不登校',
  '親子関係',
  'きょうだい児支援',
] as const;

// ========================================
// 資格確認ステータス
// ========================================

export type QualificationStatus = 'pending' | 'verified' | 'rejected';

export const QUALIFICATION_STATUS_LABELS: Record<QualificationStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: '確認中', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  verified: { label: '認証済', color: 'text-green-700', bgColor: 'bg-green-100' },
  rejected: { label: '未承認', color: 'text-red-700', bgColor: 'bg-red-100' },
};

// ========================================
// ページテーマ設定
// ========================================

export type BackgroundStyle = 'simple' | 'gradient' | 'pattern' | 'image';

export type ExpertPageTheme = {
  primaryColor: string;        // デフォルト #10B981
  backgroundStyle: BackgroundStyle;
  headerImage?: string;        // ヘッダー画像URL
  profileImage?: string;       // プロフィール画像URL
  customCss?: string;          // カスタムCSS（将来実装）
};

export const DEFAULT_EXPERT_THEME: ExpertPageTheme = {
  primaryColor: '#10B981',
  backgroundStyle: 'simple',
  headerImage: undefined,
  profileImage: undefined,
  customCss: undefined,
};

// ========================================
// エキスパートプロフィール
// ========================================

export type ExpertProfile = {
  id: string;
  userId: string;

  // 基本情報
  displayName: string;
  profession: ExpertProfession;
  specialty: string[];
  introduction?: string;
  experienceYears?: number;

  // 資格情報
  qualificationStatus: QualificationStatus;
  qualificationDocuments: string[];
  qualificationVerifiedAt?: string;
  qualificationVerifiedBy?: string;

  // カスタマイズ設定
  pageTheme: ExpertPageTheme;

  // 料金設定
  pricePerMessage: number;
  freeFirstMessage: boolean;

  // 公開設定
  isPublic: boolean;
  isAcceptingConsultations: boolean;

  // 統計
  totalConsultations: number;
  totalColumns: number;
  ratingAverage: number;
  ratingCount: number;

  createdAt: string;
  updatedAt: string;
};

// エキスパートプロフィール作成用フォームデータ
export type ExpertProfileFormData = Omit<
  ExpertProfile,
  'id' | 'userId' | 'qualificationStatus' | 'qualificationVerifiedAt' | 'qualificationVerifiedBy' |
  'totalConsultations' | 'totalColumns' | 'ratingAverage' | 'ratingCount' | 'createdAt' | 'updatedAt'
>;

// ========================================
// 料金設定
// ========================================

export type PricingType = 'message' | 'video_30min' | 'video_60min';

export const PRICING_TYPE_LABELS: Record<PricingType, string> = {
  message: 'テキスト相談',
  video_30min: 'ビデオ通話 30分',
  video_60min: 'ビデオ通話 60分',
};

export type ExpertPricing = {
  id: string;
  expertId: string;
  pricingType: PricingType;
  price: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

// ========================================
// コラム
// ========================================

export type ExpertColumn = {
  id: string;
  expertId: string;

  title: string;
  content: string;           // Markdown形式
  thumbnailUrl?: string;
  tags: string[];

  isPublished: boolean;
  isPremium: boolean;        // サブスク限定
  publishedAt?: string;

  viewCount: number;
  likeCount: number;

  createdAt: string;
  updatedAt: string;

  // 拡張（JOINで取得）
  expertProfile?: ExpertProfile;
  isLikedByCurrentUser?: boolean;
};

export type ExpertColumnFormData = Omit<
  ExpertColumn,
  'id' | 'expertId' | 'viewCount' | 'likeCount' | 'createdAt' | 'updatedAt' | 'expertProfile' | 'isLikedByCurrentUser'
>;

// ========================================
// ポイント管理
// ========================================

export type UserPoints = {
  id: string;
  userId: string;
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  createdAt: string;
  updatedAt: string;
};

export type PointTransactionType =
  | 'purchase'   // ポイント購入
  | 'consume'    // ポイント消費
  | 'refund'     // 返金
  | 'bonus'      // ボーナス付与
  | 'expire';    // 期限切れ

export const POINT_TRANSACTION_TYPE_LABELS: Record<PointTransactionType, string> = {
  purchase: 'ポイント購入',
  consume: 'ポイント消費',
  refund: '返金',
  bonus: 'ボーナス',
  expire: '期限切れ',
};

export type PointTransaction = {
  id: string;
  userId: string;
  transactionType: PointTransactionType;
  amount: number;               // 正数=増加、負数=減少
  balanceAfter: number;
  relatedConsultationId?: string;
  relatedOrderId?: string;
  description?: string;
  createdAt: string;
};

// ポイントパック（購入時）
export type PointPackage = {
  id: string;
  points: number;
  price: number;               // 円
  bonusPoints: number;         // ボーナスポイント
  label: string;
  isPopular?: boolean;
};

export const POINT_PACKAGES: PointPackage[] = [
  { id: 'pack_500', points: 500, price: 500, bonusPoints: 0, label: '500pt' },
  { id: 'pack_1000', points: 1000, price: 980, bonusPoints: 50, label: '1,000pt', isPopular: true },
  { id: 'pack_3000', points: 3000, price: 2800, bonusPoints: 200, label: '3,000pt' },
  { id: 'pack_5000', points: 5000, price: 4500, bonusPoints: 500, label: '5,000pt' },
];

// ========================================
// サブスクリプション
// ========================================

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired';

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, { label: string; color: string; bgColor: string }> = {
  active: { label: '購読中', color: 'text-green-700', bgColor: 'bg-green-100' },
  cancelled: { label: 'キャンセル', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  expired: { label: '期限切れ', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

export type ExpertSubscription = {
  id: string;
  userId: string;
  expertId: string;

  status: SubscriptionStatus;
  startedAt: string;
  expiresAt: string;
  cancelledAt?: string;

  monthlyPrice: number;

  priorityConsultation: boolean;    // 優先相談権
  premiumContentAccess: boolean;    // プレミアムコラム閲覧

  createdAt: string;
  updatedAt: string;

  // 拡張（JOINで取得）
  expertProfile?: ExpertProfile;
};

// ========================================
// 相談スレッド
// ========================================

export type ConsultationStatus = 'open' | 'pending' | 'closed';

export const CONSULTATION_STATUS_LABELS: Record<ConsultationStatus, { label: string; color: string; bgColor: string }> = {
  open: { label: '対応中', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  pending: { label: '返信待ち', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  closed: { label: '終了', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

// 相談カテゴリ
export const CONSULTATION_CATEGORIES = [
  '発達相談',
  '行動相談',
  '食事・栄養',
  '睡眠',
  '就学相談',
  '療育相談',
  'きょうだい児',
  '親子関係',
  'その他',
] as const;

export type ConsultationThread = {
  id: string;
  expertId: string;
  clientUserId: string;

  status: ConsultationStatus;

  subject: string;
  childAge?: string;              // 対象のお子様の年齢
  consultationType: string[];     // 相談カテゴリ

  messageCount: number;
  lastMessageAt?: string;

  rating?: number;                // 1-5
  ratingComment?: string;
  ratedAt?: string;

  createdAt: string;
  updatedAt: string;

  // 拡張（JOINで取得）
  expertName?: string;
  clientName?: string;
  expertProfile?: ExpertProfile;
  latestMessage?: ConsultationMessage;
  unreadCount?: number;
};

export type ConsultationThreadFormData = {
  expertId: string;
  subject: string;
  childAge?: string;
  consultationType: string[];
  initialMessage: string;
};

// ========================================
// 相談メッセージ
// ========================================

export type MessageSenderType = 'expert' | 'client';

export type ConsultationMessage = {
  id: string;
  threadId: string;

  senderId: string;
  senderType: MessageSenderType;

  message: string;
  attachments: string[];

  pointsConsumed: number;         // このメッセージ閲覧に消費したポイント
  isRead: boolean;
  readAt?: string;

  createdAt: string;
  updatedAt: string;

  // 拡張
  senderName?: string;
  senderProfileImage?: string;
};

// ========================================
// コラムいいね
// ========================================

export type ColumnLike = {
  id: string;
  columnId: string;
  userId: string;
  createdAt: string;
};

// ========================================
// エキスパート検索
// ========================================

export type ExpertSearchFilters = {
  profession?: ExpertProfession[];
  specialty?: string[];
  priceRange?: {
    min?: number;
    max?: number;
  };
  freeFirstMessage?: boolean;
  isAcceptingConsultations?: boolean;
  sortBy?: 'rating' | 'consultations' | 'price_low' | 'price_high' | 'newest';
};

export type ExpertSearchResult = ExpertProfile & {
  matchScore?: number;            // マッチング時のスコア
};

// ========================================
// 通知
// ========================================

export type ExpertNotificationType =
  | 'new_consultation'           // 新規相談
  | 'new_message'                // 新規メッセージ
  | 'new_subscription'           // 新規サブスク
  | 'consultation_rated'         // 相談評価
  | 'qualification_verified'     // 資格認証完了
  | 'qualification_rejected';    // 資格認証却下

export type ExpertNotification = {
  id: string;
  expertId: string;
  type: ExpertNotificationType;
  title: string;
  message: string;
  relatedThreadId?: string;
  relatedUserId?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
};

// ========================================
// ダッシュボード統計
// ========================================

export type ExpertDashboardStats = {
  // 相談
  totalConsultations: number;
  openConsultations: number;
  unreadMessages: number;

  // 収益（モック）
  monthlyRevenue: number;
  totalRevenue: number;

  // コラム
  totalColumns: number;
  totalColumnViews: number;
  totalColumnLikes: number;

  // サブスク
  activeSubscribers: number;

  // 評価
  averageRating: number;
  totalRatings: number;
};

// ========================================
// ユーティリティ型
// ========================================

// エキスパートカード表示用
export type ExpertCardData = Pick<
  ExpertProfile,
  'id' | 'displayName' | 'profession' | 'specialty' | 'introduction' |
  'pricePerMessage' | 'freeFirstMessage' | 'ratingAverage' | 'ratingCount' |
  'totalConsultations' | 'pageTheme' | 'qualificationStatus' | 'isAcceptingConsultations'
>;

// DB→フロント変換用ヘルパー
export function mapExpertProfileFromDB(row: Record<string, unknown>): ExpertProfile {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    displayName: row.display_name as string,
    profession: row.profession as ExpertProfession,
    specialty: (row.specialty as string[]) || [],
    introduction: row.introduction as string | undefined,
    experienceYears: row.experience_years as number | undefined,
    qualificationStatus: row.qualification_status as QualificationStatus,
    qualificationDocuments: (row.qualification_documents as string[]) || [],
    qualificationVerifiedAt: row.qualification_verified_at as string | undefined,
    qualificationVerifiedBy: row.qualification_verified_by as string | undefined,
    pageTheme: (row.page_theme as ExpertPageTheme) || DEFAULT_EXPERT_THEME,
    pricePerMessage: row.price_per_message as number,
    freeFirstMessage: row.free_first_message as boolean,
    isPublic: row.is_public as boolean,
    isAcceptingConsultations: row.is_accepting_consultations as boolean,
    totalConsultations: row.total_consultations as number,
    totalColumns: row.total_columns as number,
    ratingAverage: row.rating_average as number,
    ratingCount: row.rating_count as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function mapConsultationThreadFromDB(row: Record<string, unknown>): ConsultationThread {
  return {
    id: row.id as string,
    expertId: row.expert_id as string,
    clientUserId: row.client_user_id as string,
    status: row.status as ConsultationStatus,
    subject: row.subject as string,
    childAge: row.child_age as string | undefined,
    consultationType: (row.consultation_type as string[]) || [],
    messageCount: row.message_count as number,
    lastMessageAt: row.last_message_at as string | undefined,
    rating: row.rating as number | undefined,
    ratingComment: row.rating_comment as string | undefined,
    ratedAt: row.rated_at as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function mapConsultationMessageFromDB(row: Record<string, unknown>): ConsultationMessage {
  return {
    id: row.id as string,
    threadId: row.thread_id as string,
    senderId: row.sender_id as string,
    senderType: row.sender_type as MessageSenderType,
    message: row.message as string,
    attachments: (row.attachments as string[]) || [],
    pointsConsumed: row.points_consumed as number,
    isRead: row.is_read as boolean,
    readAt: row.read_at as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
