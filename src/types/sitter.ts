/**
 * Sitter領域の型定義
 * 発達支援特化ベビーシッターサービス
 */

// シッターの資格種別
export type SitterProfession =
  | 'PT'              // 理学療法士
  | 'OT'              // 作業療法士
  | 'ST'              // 言語聴覚士
  | 'nursery_teacher' // 保育士
  | 'nurse'           // 看護師
  | 'psychologist'    // 臨床心理士
  | 'dietitian'       // 管理栄養士
  | 'social_worker';  // 社会福祉士

export const SITTER_PROFESSION_LABELS: Record<SitterProfession, string> = {
  PT: '理学療法士 (PT)',
  OT: '作業療法士 (OT)',
  ST: '言語聴覚士 (ST)',
  nursery_teacher: '保育士',
  nurse: '看護師',
  psychologist: '臨床心理士',
  dietitian: '管理栄養士',
  social_worker: '社会福祉士',
};

// 資格認定種別
export type CertificationType =
  | 'tokyo_babysitter_training'
  | 'nursery_teacher'
  | 'nurse'
  | 'pt'
  | 'ot'
  | 'st'
  | 'psychologist'
  | 'first_aid'
  | 'other';

export const CERTIFICATION_LABELS: Record<CertificationType, string> = {
  tokyo_babysitter_training: '東京都ベビーシッター利用支援事業研修',
  nursery_teacher: '保育士資格',
  nurse: '看護師免許',
  pt: '理学療法士免許',
  ot: '作業療法士免許',
  st: '言語聴覚士免許',
  psychologist: '臨床心理士',
  first_aid: '救急救命講習',
  other: 'その他',
};

// 予約状態
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export const BOOKING_STATUS_LABELS: Record<BookingStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: '申請中', color: 'text-amber-600', bgColor: 'bg-amber-50' },
  confirmed: { label: '確定', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  in_progress: { label: '実施中', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  completed: { label: '完了', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  cancelled: { label: 'キャンセル', color: 'text-red-600', bgColor: 'bg-red-50' },
  no_show: { label: '不履行', color: 'text-red-600', bgColor: 'bg-red-50' },
};

// 報告書状態
export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export const REPORT_STATUS_LABELS: Record<ReportStatus, { label: string; color: string; bgColor: string }> = {
  draft: { label: '下書き', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  submitted: { label: '提出済み', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  approved: { label: '承認済み', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  rejected: { label: '差し戻し', color: 'text-red-600', bgColor: 'bg-red-50' },
};

// シッタープロフィール
export type SitterProfile = {
  id: string;
  userId: string;
  displayName: string;
  profileImage?: string;
  introduction?: string;
  professions: SitterProfession[];
  specialty: string[];
  hourlyRate: number;
  minimumHours: number;
  serviceAreas: string[];
  canTravel: boolean;
  travelFee: number;
  isTokyoCertified: boolean;
  subsidyEligible: boolean;
  isPublic: boolean;
  isAcceptingBookings: boolean;
  totalBookings: number;
  totalHours: number;
  ratingAverage: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
};

// シッター資格
export type SitterCertification = {
  id: string;
  sitterId: string;
  certificationType: CertificationType;
  certificationName: string;
  certificationNumber?: string;
  issuedAt?: string;
  expiresAt?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  documentUrl?: string;
  createdAt: string;
};

// シッター空き時間
export type SitterAvailability = {
  id: string;
  sitterId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'booked' | 'blocked';
  bookingId?: string;
  createdAt: string;
  updatedAt: string;
};

// 予約
export type SitterBooking = {
  id: string;
  sitterId: string;
  clientUserId: string;
  childId?: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  actualStartTime?: string;
  actualEndTime?: string;
  locationAddress?: string;
  locationNotes?: string;
  hourlyRate: number;
  estimatedHours: number;
  estimatedTotal: number;
  actualHours?: number;
  actualTotal?: number;
  subsidyEligible: boolean;
  subsidyAmount: number;
  clientPayment?: number;
  status: BookingStatus;
  clientMemo?: string;
  sitterNotes?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  // Join data
  sitterName?: string;
  sitterImage?: string;
  clientName?: string;
  childName?: string;
  childAge?: string;
};

// 活動報告書
export type SitterReport = {
  id: string;
  bookingId: string;
  sitterId: string;
  childCondition?: string;
  activities?: string;
  developmentalNotes?: string;
  mealsProvided?: string;
  specialNotes?: string;
  languageActivities?: string;
  motorActivities?: string;
  socialActivities?: string;
  photos: string[];
  status: ReportStatus;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
};

// レビュー
export type SitterReview = {
  id: string;
  bookingId: string;
  sitterId: string;
  clientUserId: string;
  rating: number;
  comment?: string;
  communicationRating?: number;
  expertiseRating?: number;
  punctualityRating?: number;
  isPublic: boolean;
  createdAt: string;
  // Join data
  clientName?: string;
};

// お気に入り
export type SitterFavorite = {
  id: string;
  clientUserId: string;
  sitterId: string;
  createdAt: string;
};

// メッセージスレッド
export type SitterMessageThread = {
  id: string;
  sitterId: string;
  clientUserId: string;
  bookingId?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  createdAt: string;
  updatedAt: string;
  // Join data
  sitterName?: string;
  sitterImage?: string;
  clientName?: string;
  unreadCount?: number;
};

// メッセージ
export type SitterMessage = {
  id: string;
  threadId: string;
  senderId: string;
  senderType: 'sitter' | 'client';
  message: string;
  attachments: string[];
  isRead: boolean;
  readAt?: string;
  createdAt: string;
};

// フォームデータ
export type SitterProfileFormData = {
  displayName: string;
  profileImage?: string;
  introduction?: string;
  professions: SitterProfession[];
  specialty: string[];
  hourlyRate: number;
  minimumHours: number;
  serviceAreas: string[];
  canTravel: boolean;
  travelFee: number;
  isTokyoCertified: boolean;
  isPublic: boolean;
  isAcceptingBookings: boolean;
};

export type BookingFormData = {
  sitterId: string;
  childId?: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  locationAddress: string;
  locationNotes?: string;
  clientMemo?: string;
};

export type ReportFormData = {
  childCondition?: string;
  activities?: string;
  developmentalNotes?: string;
  mealsProvided?: string;
  specialNotes?: string;
  languageActivities?: string;
  motorActivities?: string;
  socialActivities?: string;
  photos?: string[];
};

// スタッフダッシュボード統計
export type SitterDashboardStats = {
  totalEarnings: number;
  monthlyEarnings: number;
  totalHours: number;
  monthlyHours: number;
  pendingBookings: number;
  confirmedBookings: number;
  pendingReports: number;
  averageRating: number;
  totalReviews: number;
};

// DBマッピング関数
export function mapSitterProfileFromDB(data: Record<string, unknown>): SitterProfile {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    displayName: data.display_name as string,
    profileImage: data.profile_image as string | undefined,
    introduction: data.introduction as string | undefined,
    professions: (data.professions as SitterProfession[]) || [],
    specialty: (data.specialty as string[]) || [],
    hourlyRate: data.hourly_rate as number,
    minimumHours: data.minimum_hours as number,
    serviceAreas: (data.service_areas as string[]) || [],
    canTravel: data.can_travel as boolean,
    travelFee: data.travel_fee as number,
    isTokyoCertified: data.is_tokyo_certified as boolean,
    subsidyEligible: data.subsidy_eligible as boolean,
    isPublic: data.is_public as boolean,
    isAcceptingBookings: data.is_accepting_bookings as boolean,
    totalBookings: data.total_bookings as number,
    totalHours: parseFloat(data.total_hours as string) || 0,
    ratingAverage: parseFloat(data.rating_average as string) || 0,
    ratingCount: data.rating_count as number,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

export function mapSitterBookingFromDB(data: Record<string, unknown>): SitterBooking {
  return {
    id: data.id as string,
    sitterId: data.sitter_id as string,
    clientUserId: data.client_user_id as string,
    childId: data.child_id as string | undefined,
    bookingDate: data.booking_date as string,
    startTime: data.start_time as string,
    endTime: data.end_time as string,
    actualStartTime: data.actual_start_time as string | undefined,
    actualEndTime: data.actual_end_time as string | undefined,
    locationAddress: data.location_address as string | undefined,
    locationNotes: data.location_notes as string | undefined,
    hourlyRate: data.hourly_rate as number,
    estimatedHours: parseFloat(data.estimated_hours as string),
    estimatedTotal: data.estimated_total as number,
    actualHours: data.actual_hours ? parseFloat(data.actual_hours as string) : undefined,
    actualTotal: data.actual_total as number | undefined,
    subsidyEligible: data.subsidy_eligible as boolean,
    subsidyAmount: data.subsidy_amount as number,
    clientPayment: data.client_payment as number | undefined,
    status: data.status as BookingStatus,
    clientMemo: data.client_memo as string | undefined,
    sitterNotes: data.sitter_notes as string | undefined,
    cancelledAt: data.cancelled_at as string | undefined,
    cancelledBy: data.cancelled_by as string | undefined,
    cancellationReason: data.cancellation_reason as string | undefined,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

export function mapSitterReportFromDB(data: Record<string, unknown>): SitterReport {
  return {
    id: data.id as string,
    bookingId: data.booking_id as string,
    sitterId: data.sitter_id as string,
    childCondition: data.child_condition as string | undefined,
    activities: data.activities as string | undefined,
    developmentalNotes: data.developmental_notes as string | undefined,
    mealsProvided: data.meals_provided as string | undefined,
    specialNotes: data.special_notes as string | undefined,
    languageActivities: data.language_activities as string | undefined,
    motorActivities: data.motor_activities as string | undefined,
    socialActivities: data.social_activities as string | undefined,
    photos: (data.photos as string[]) || [],
    status: data.status as ReportStatus,
    submittedAt: data.submitted_at as string | undefined,
    approvedAt: data.approved_at as string | undefined,
    approvedBy: data.approved_by as string | undefined,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

// 東京都補助金額（2024年度）
export const TOKYO_SUBSIDY_RATE = 2500; // 1時間あたり最大2,500円
