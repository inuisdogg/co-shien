/**
 * --- Type Definitions ---
 * マルチテナント対応の型定義
 */

// 施設（テナント）データ
export type Facility = {
  id: string;
  name: string;
  code: string; // 施設コード
  ownerUserId?: string; // マスター管理者（施設オーナー）のユーザーID
  createdAt: string;
  updatedAt: string;
};

// 期間ごとの定休日設定
export type HolidayPeriod = {
  id: string; // 期間ID
  startDate: string; // 開始日（YYYY-MM-DD形式）
  endDate: string; // 終了日（YYYY-MM-DD形式、空文字の場合は無期限）
  regularHolidays: number[]; // 定休日（0=日, 1=月, ..., 6=土）
};

// 曜日別の時間設定
export type DayOfWeekHours = {
  start?: string;     // HH:mm（isClosed時は未設定可）
  end?: string;       // HH:mm（isClosed時は未設定可）
  isClosed?: boolean; // 閉所の場合true
};

// 柔軟な営業時間設定（曜日別対応）
export type FlexibleHours = {
  default: { start: string; end: string };  // デフォルトの営業時間
  dayOverrides?: Partial<Record<number, DayOfWeekHours>>;  // 曜日別の例外設定（0=日, 1=月, ..., 6=土）
};

// 期間ごとの営業時間設定（後方互換性のため保持）
export type BusinessHoursPeriod = {
  id: string; // 期間ID
  startDate: string; // 開始日（YYYY-MM-DD形式）
  endDate: string; // 終了日（YYYY-MM-DD形式、空文字の場合は無期限）
  businessHours: {
    AM: { start: string; end: string };
    PM: { start: string; end: string };
  };
};

// 施設設定の変更履歴
export type FacilitySettingsHistory = {
  id: string;
  facilityId: string;
  changeType: 'business_hours' | 'holidays' | 'capacity' | 'all'; // 変更タイプ
  oldValue: any; // 変更前の値（JSON）
  newValue: any; // 変更後の値（JSON）
  changedBy: string; // 変更者（user_id）
  changedAt: string; // 変更日時
  description?: string; // 変更説明
};

// 施設情報設定
export type FacilitySettings = {
  id: string;
  facilityId: string; // 施設ID（マルチテナント対応）
  facilityName?: string; // 施設名
  // 施設住所（送迎の起点/終点）
  address?: string; // 施設住所
  postalCode?: string; // 郵便番号
  latitude?: number; // 緯度（Google Maps用）
  longitude?: number; // 経度（Google Maps用）
  // 営業日設定
  regularHolidays: number[]; // デフォルトの定休日（0=日, 1=月, ..., 6=土）
  holidayPeriods?: HolidayPeriod[]; // 期間ごとの定休日設定
  customHolidays: string[]; // カスタム休業日（YYYY-MM-DD形式の配列）
  includeHolidays?: boolean; // 祝日を休業日に含めるかどうか
  // 営業時間（運営規定用）- 旧形式（後方互換性のため保持）
  businessHours: {
    AM: { start: string; end: string }; // 例: { start: '09:00', end: '12:00' }
    PM: { start: string; end: string }; // 例: { start: '13:00', end: '18:00' }
  };
  businessHoursPeriods?: BusinessHoursPeriod[]; // 期間ごとの営業時間設定（後方互換性のため保持）
  // 営業時間（新形式：曜日別対応）
  flexibleBusinessHours?: FlexibleHours;
  // サービス提供時間（運営規定用：職員が配置されサービス提供可能な時間）- 旧形式
  serviceHours?: {
    AM: { start: string; end: string };
    PM: { start: string; end: string };
  };
  // サービス提供時間（新形式：曜日別対応）
  flexibleServiceHours?: FlexibleHours;
  // 事業区分（多機能型施設対応）
  serviceCategories?: {
    childDevelopmentSupport: boolean;      // 児童発達支援
    afterSchoolDayService: boolean;        // 放課後等デイサービス
    nurseryVisitSupport: boolean;          // 保育所等訪問支援
    homeBasedChildSupport: boolean;        // 居宅訪問型児童発達支援
  };
  // 受け入れ人数
  capacity: {
    AM: number; // 午前の定員
    PM: number; // 午後の定員
  };
  // 送迎設定
  transportCapacity?: {
    pickup: number; // お迎え可能人数（デフォルト: 4）
    dropoff: number; // お送り可能人数（デフォルト: 4）
  };
  // 勤怠設定
  prescribedWorkingHours?: number; // 1日の所定労働時間（分単位、例: 420 = 7時間）
  // ホームページ設定
  homepageEnabled?: boolean; // ホームページ公開フラグ
  homepageTagline?: string; // キャッチコピー（最大100文字）
  homepageDescription?: string; // 施設紹介文
  homepageCoverImageUrl?: string; // カバー画像URL
  homepagePhotos?: string[]; // フォトギャラリーURL配列
  homepageTheme?: string; // テーマカラー（デフォルト: 'teal'）
  createdAt: string;
  updatedAt: string;
};

// ユーザー種別（スタッフ/利用者の区別）
export type UserType = 'staff' | 'client';

// ユーザーロール
export type UserRole = 'admin' | 'manager' | 'staff' | 'client' | 'owner';

// 権限設定（マネージャーとスタッフ用）- 各メニュー項目ごとに設定可能
export type UserPermissions = {
  // 利用者管理
  schedule?: boolean;         // 利用調整・予約
  children?: boolean;         // 児童管理
  transport?: boolean;        // 送迎ルート
  chat?: boolean;             // チャット
  connect?: boolean;          // コネクト
  clientInvitation?: boolean; // 利用者招待
  lead?: boolean;             // リード管理

  // 日誌・記録
  dailyLog?: boolean;         // 業務日誌
  supportPlan?: boolean;      // 個別支援計画
  incident?: boolean;         // 苦情・事故報告

  // スタッフ管理
  staff?: boolean;            // スタッフ管理
  shift?: boolean;            // シフト管理
  training?: boolean;         // 研修記録

  // 運営管理
  auditPreparation?: boolean; // 運営指導準備
  committee?: boolean;        // 委員会管理
  documents?: boolean;        // 書類管理

  // 売上・経営管理
  dashboard?: boolean;        // ダッシュボード
  profitLoss?: boolean;       // 損益計算書
  cashFlow?: boolean;         // キャッシュフロー
  expenseManagement?: boolean;// 経費管理
  management?: boolean;       // 経営設定

  // 採用
  recruitment?: boolean;      // 採用・求人管理

  // 設定
  facility?: boolean;         // 施設情報

  // キャリアアプリからのアクセス権
  facilityManagement?: boolean; // 施設管理画面へのアクセス
};

// 権限キーの型
export type PermissionKey = keyof UserPermissions;

// 権限カテゴリー定義
export const PERMISSION_CATEGORIES = {
  '利用者管理': ['schedule', 'children', 'transport', 'chat', 'connect', 'clientInvitation', 'lead'] as PermissionKey[],
  '日誌・記録': ['dailyLog', 'supportPlan', 'incident'] as PermissionKey[],
  'スタッフ管理': ['staff', 'shift', 'training'] as PermissionKey[],
  '運営管理': ['auditPreparation', 'committee', 'documents'] as PermissionKey[],
  '売上・経営管理': ['dashboard', 'profitLoss', 'cashFlow', 'expenseManagement', 'management'] as PermissionKey[],
  '採用': ['recruitment'] as PermissionKey[],
  '設定': ['facility'] as PermissionKey[],
  'キャリアアプリ': ['facilityManagement'] as PermissionKey[],
} as const;

// 権限ラベル
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  schedule: '利用調整・予約',
  children: '児童管理',
  transport: '送迎ルート',
  chat: 'チャット',
  connect: 'コネクト',
  clientInvitation: '利用者招待',
  lead: 'リード管理',
  dailyLog: '業務日誌',
  supportPlan: '個別支援計画',
  incident: '苦情・事故報告',
  staff: 'スタッフ管理',
  shift: 'シフト管理',
  training: '研修記録',
  auditPreparation: '運営指導準備',
  committee: '委員会管理',
  documents: '書類管理',
  dashboard: 'ダッシュボード',
  profitLoss: '損益計算書',
  cashFlow: 'キャッシュフロー',
  expenseManagement: '経費管理',
  management: '経営設定',
  recruitment: '採用・求人管理',
  facility: '施設情報',
  facilityManagement: '施設管理画面アクセス',
};

// アカウントステータス
export type AccountStatus = 'pending' | 'active' | 'suspended';

// アカウントステータスのラベルと色
export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: '招待中', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  active: { label: '連携中', color: 'text-green-700', bgColor: 'bg-green-100' },
  suspended: { label: '停止中', color: 'text-red-700', bgColor: 'bg-red-100' },
};

// ユーザーデータ（個人アカウント - 施設に依存しない）
export type User = {
  id: string;
  email: string;
  name: string; // 後方互換性のため残す（姓+名の結合）
  lastName?: string; // 姓
  firstName?: string; // 名
  lastNameKana?: string; // 姓（フリガナ）
  firstNameKana?: string; // 名（フリガナ）
  birthDate?: string; // 生年月日（YYYY-MM-DD形式）
  gender?: 'male' | 'female' | 'other'; // 性別
  phone?: string;
  loginId?: string; // ログイン用ID
  userType: UserType; // ユーザー種別（staff=スタッフ, client=利用者）
  role: UserRole; // ユーザーロール
  facilityId: string; // 施設ID（空文字列の場合は個人アカウント）
  permissions?: UserPermissions; // 権限設定
  accountStatus: AccountStatus; // アカウントステータス
  invitedByFacilityId?: string; // 招待した事業所ID
  invitedAt?: string; // 招待日時
  activatedAt?: string; // アクティベーション日時
  createdAt: string;
  updatedAt: string;
};

// 所属関係の役割
export type EmploymentRole = '一般スタッフ' | 'マネージャー' | '管理者';

// 雇用形態
export type EmploymentType = '常勤' | '非常勤';

// 実務経験証明ステータス
export type ExperienceVerificationStatus = 
  | 'not_requested'  // 未申請
  | 'requested'       // 申請中
  | 'approved'        // 承認済み
  | 'rejected'        // 却下
  | 'expired';        // 期限切れ

// 所属関係（EmploymentRecord）
export type EmploymentRecord = {
  id: string;
  userId: string; // ユーザーID
  facilityId: string; // 事業所ID
  // 所属期間
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD（NULLの場合は現在も在籍中）
  // 役割・職位
  role: EmploymentRole;
  employmentType: EmploymentType;
  // 権限設定（この事業所での権限）
  permissions?: UserPermissions;
  // 実務経験証明のステータス
  experienceVerificationStatus: ExperienceVerificationStatus;
  experienceVerificationRequestedAt?: string;
  experienceVerificationApprovedAt?: string;
  experienceVerificationApprovedBy?: string; // 承認者のuser_id
  // メタデータ
  createdAt: string;
  updatedAt: string;
  // 拡張情報（JOINで取得）
  facilityName?: string;
  facilityCode?: string;
  userName?: string;
};

// 実務経験証明依頼ステータス
export type VerificationRequestStatus = 
  | 'pending'    // 申請中
  | 'approved'   // 承認済み
  | 'rejected'   // 却下
  | 'expired';   // 期限切れ

// 実務経験証明依頼（ExperienceVerificationRequest）
export type ExperienceVerificationRequest = {
  id: string;
  // 申請者（スタッフ）
  requesterUserId: string;
  // 対象の所属記録
  employmentRecordId: string;
  // 承認者（元職場の管理者）
  approverFacilityId: string;
  approverUserId?: string; // 承認者のuser_id（承認時に設定）
  // 申請内容
  requestedPeriodStart: string; // YYYY-MM-DD
  requestedPeriodEnd?: string; // YYYY-MM-DD
  requestedRole?: string; // 申請時の役割
  // ステータス
  status: VerificationRequestStatus;
  // メッセージ
  requestMessage?: string; // 申請者からのメッセージ
  responseMessage?: string; // 承認者からのメッセージ
  rejectionReason?: string; // 却下理由
  // デジタル署名
  digitalSignature?: string; // 承認者のデジタル署名（ハッシュ）
  signedAt?: string;
  // メタデータ
  createdAt: string;
  updatedAt: string;
  expiresAt: string; // 期限
  // 拡張情報（JOINで取得）
  requesterName?: string;
  facilityName?: string;
  approverName?: string;
};

// 個人キャリアデータ（資格、認証済み職歴など）
export type UserCareer = {
  id: string;
  userId: string;
  // 資格情報
  qualificationName: string;
  qualificationType?: string; // 例: "国家資格", "民間資格"
  issuedBy?: string; // 発行機関
  issuedDate?: string; // YYYY-MM-DD
  expiryDate?: string; // YYYY-MM-DD（有効期限）
  certificateUrl?: string; // 資格証のURL（ストレージ）
  // 認証済み職歴（employment_recordsから承認済みのものを参照）
  verifiedEmploymentRecordId?: string;
  // メタデータ
  createdAt: string;
  updatedAt: string;
};

// 招待データ（事業所がスタッフを招待する際のデータ）
export type StaffInvitation = {
  id?: string;
  facilityId: string;
  name: string;
  email?: string;
  phone?: string;
  role: EmploymentRole;
  employmentType: EmploymentType;
  startDate: string; // YYYY-MM-DD
  permissions?: UserPermissions;
};

// 契約ステータス
export type ContractStatus = 'pre-contract' | 'active' | 'inactive' | 'terminated';

// 児童データ
export type Child = {
  id: string;
  facilityId?: string; // 施設ID（マルチテナント対応、利用者登録の場合はnull）
  ownerProfileId?: string; // 所有者（保護者）のユーザーID（利用者登録の場合に設定）
  // 基本情報
  name: string; // 児童名
  nameKana?: string; // 児童名（フリガナ）
  age?: number; // 年齢（自動計算）
  birthDate?: string; // 生年月日 (YYYY-MM-DD)
  // 保護者情報
  guardianName?: string; // 保護者名
  guardianNameKana?: string; // 保護者名（フリガナ）
  guardianRelationship?: string; // 続柄（例: 母、父、祖母）
  // 受給者証情報
  beneficiaryNumber?: string; // 受給者証番号
  beneficiaryCertificateImageUrl?: string; // 受給者証の最新版画像URL
  grantDays?: number; // 支給日数
  contractDays?: number; // 契約日数
  // 連絡先
  postalCode?: string; // 郵便番号（ハイフンなし7桁）
  address?: string; // 住所
  phone?: string; // 電話番号
  email?: string; // メールアドレス（保護者メールアドレス）
  // 医療情報
  doctorName?: string; // かかりつけ医名
  doctorClinic?: string; // 医療機関名
  // 通園情報
  schoolName?: string; // 通園場所名（学校・幼稚園等）
  // 利用パターン
  pattern?: string; // 基本利用パターン (例: "月・水・金") - 後方互換性のため保持
  patternDays?: number[]; // 基本利用パターン（曜日の配列: 0=日, 1=月, ..., 6=土）
  patternTimeSlots?: Record<number, 'AM' | 'PM' | 'AMPM'>; // 曜日ごとの時間帯設定（0=日, 1=月, ..., 6=土）
  needsPickup: boolean; // お迎え有無
  needsDropoff: boolean; // お送り有無
  pickupLocation?: string; // 乗車地（選択肢：事業所/自宅/その他）
  pickupLocationCustom?: string; // 乗車地（自由記入）
  pickupAddress?: string; // お迎え場所の住所（ルート計算用）
  pickupPostalCode?: string; // お迎え場所の郵便番号
  pickupLatitude?: number; // お迎え場所の緯度（Google Maps用）
  pickupLongitude?: number; // お迎え場所の経度（Google Maps用）
  dropoffLocation?: string; // 降車地（選択肢：事業所/自宅/その他）
  dropoffLocationCustom?: string; // 降車地（自由記入）
  dropoffAddress?: string; // お送り場所の住所（ルート計算用）
  dropoffPostalCode?: string; // お送り場所の郵便番号
  dropoffLatitude?: number; // お送り場所の緯度（Google Maps用）
  dropoffLongitude?: number; // お送り場所の経度（Google Maps用）
  // 特性・メモ
  characteristics?: string; // 特性・メモ
  // 加算判定用フィールド
  medical_care_score?: number; // 医療的ケア判定スコア
  behavior_disorder_score?: number; // 強度行動障害判定スコア
  care_needs_category?: string; // ケアニーズ判定結果
  is_protected_child?: boolean; // 要保護・要支援児童フラグ
  income_category?: string; // 世帯所得区分（general/low_income/welfare）
  // 契約ステータス
  contractStatus: ContractStatus; // 契約ステータス
  contractStartDate?: string; // 契約開始日
  contractEndDate?: string; // 契約終了日
  // 登録タイプ（契約前/契約後）
  registrationType?: 'pre-contract' | 'post-contract'; // 登録タイプ
  // 契約前登録用の情報
  plannedContractDays?: number; // 契約予定日数（月間）
  plannedUsageStartDate?: string; // 利用開始予定日
  plannedUsageDays?: number; // 利用予定日数（総日数）
  // メタデータ
  createdAt: string;
  updatedAt: string;
  // 施設記録（連携前の施設側ヒアリング情報）
  facilityIntakeData?: FacilityIntakeData;
  facilityIntakeRecordedAt?: string;
  facilityIntakeRecordedBy?: string;
};

// 施設側ヒアリング記録（連携前の情報を保持）
export type FacilityIntakeData = {
  name?: string;
  nameKana?: string;
  birthDate?: string;
  guardianName?: string;
  guardianNameKana?: string;
  guardianRelationship?: string;
  beneficiaryNumber?: string;
  grantDays?: number;
  contractDays?: number;
  address?: string;
  phone?: string;
  email?: string;
  doctorName?: string;
  doctorClinic?: string;
  schoolName?: string;
  pattern?: string;
  patternDays?: number[];
  needsPickup?: boolean;
  needsDropoff?: boolean;
  pickupLocation?: string;
  dropoffLocation?: string;
  characteristics?: string;
  memo?: string; // 施設スタッフのメモ
};

// 児童登録フォームデータ（下書き保存用）
export type ChildFormData = Omit<Child, 'id' | 'facilityId' | 'createdAt' | 'updatedAt' | 'facilityIntakeData' | 'facilityIntakeRecordedAt' | 'facilityIntakeRecordedBy'>;

// 施設別児童設定（施設固有の情報）
export type FacilityChildrenSettings = {
  id: string;
  facilityId: string;
  childId: string;
  // 利用パターン
  patternDays?: number[];
  patternTimeSlots?: Record<number, 'AM' | 'PM' | 'AMPM'>;
  // 送迎設定
  needsPickup: boolean;
  needsDropoff: boolean;
  pickupLocation?: string;
  dropoffLocation?: string;
  // 契約情報
  contractDays?: number;
  contractStartDate?: string;
  contractEndDate?: string;
  // 担当職員
  assignedStaffIds?: string[];
  // 加算設定
  defaultAddonItems?: string[];
  // メタデータ
  createdAt: string;
  updatedAt: string;
};

// 書類タイプ
export type DocumentType =
  | 'contract'             // 契約書
  | 'assessment'           // アセスメントシート
  | 'support_plan'         // 個別支援計画書
  | 'special_support_plan' // 専門的支援計画書
  | 'beneficiary_cert'     // 受給者証
  | 'medical_cert'         // 診断書・医療証明
  | 'insurance_card'       // 保険証
  | 'emergency_contact'    // 緊急連絡先
  | 'photo_consent'        // 写真掲載同意書
  | 'other';               // その他

// 書類ステータス
export type DocumentStatus =
  | 'required'    // 必要（未提出）
  | 'submitted'   // 提出済み（確認中）
  | 'approved'    // 承認済み
  | 'expired'     // 期限切れ
  | 'rejected';   // 差し戻し

// 児童書類
export type ChildDocument = {
  id: string;
  facilityId: string;
  childId: string;
  documentType: DocumentType;
  documentName: string;
  description?: string;
  status: DocumentStatus;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  dueDate?: string;
  expiryDate?: string;
  submittedAt?: string;
  submittedBy?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

// 書類テンプレート
export type DocumentTemplate = {
  id: string;
  facilityId: string;
  documentType: DocumentType;
  documentName: string;
  description?: string;
  isRequired: boolean;
  defaultDueDays?: number;
  createdAt: string;
  updatedAt: string;
};

// 書類タイプのラベル
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  contract: '契約書',
  assessment: 'アセスメントシート',
  support_plan: '個別支援計画書',
  special_support_plan: '専門的支援計画書',
  beneficiary_cert: '受給者証',
  medical_cert: '診断書・医療証明',
  insurance_card: '保険証',
  emergency_contact: '緊急連絡先',
  photo_consent: '写真掲載同意書',
  other: 'その他',
};

// 書類カテゴリ（グループ化用）
export const DOCUMENT_CATEGORIES = [
  {
    id: 'support_plan',
    label: '個別支援計画',
    types: ['support_plan'] as DocumentType[],
    icon: 'ClipboardList',
  },
  {
    id: 'special_support_plan',
    label: '専門的支援計画',
    types: ['special_support_plan'] as DocumentType[],
    icon: 'ClipboardList',
  },
  {
    id: 'beneficiary_cert',
    label: '受給者証',
    types: ['beneficiary_cert'] as DocumentType[],
    icon: 'FileCheck',
  },
  {
    id: 'assessment',
    label: 'アセスメントシート',
    types: ['assessment'] as DocumentType[],
    icon: 'FileSearch',
  },
  {
    id: 'contracts',
    label: '契約・同意書',
    types: ['contract', 'photo_consent', 'emergency_contact', 'medical_cert', 'insurance_card'] as DocumentType[],
    icon: 'FileSignature',
  },
  {
    id: 'other',
    label: 'その他',
    types: ['other'] as DocumentType[],
    icon: 'File',
  },
] as const;

// 書類カテゴリIDの型
export type DocumentCategoryId = typeof DOCUMENT_CATEGORIES[number]['id'];

// 書類ステータスのラベル
export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, { label: string; color: string }> = {
  required: { label: '未提出', color: 'bg-orange-100 text-orange-700' },
  submitted: { label: '確認中', color: 'bg-blue-100 text-blue-700' },
  approved: { label: '承認済', color: 'bg-green-100 text-green-700' },
  expired: { label: '期限切', color: 'bg-red-100 text-red-700' },
  rejected: { label: '差戻し', color: 'bg-red-100 text-red-700' },
};

// スタッフデータ（後方互換性のため保持、将来的にはEmploymentRecordに統合）
export type Staff = {
  id: string;
  facilityId: string; // 施設ID（マルチテナント対応）
  name: string;
  lastName?: string; // 姓
  firstName?: string; // 名
  nameKana?: string; // フリガナ
  lastNameKana?: string; // 姓（カナ）
  firstNameKana?: string; // 名（カナ）
  role: '一般スタッフ' | 'マネージャー' | '管理者';
  type: '常勤' | '非常勤';
  facilityRole?: string; // 施設での役割（児童発達管理責任者、指導員など）
  user_id?: string; // ユーザーアカウントID（usersテーブルへの参照）
  accountStatus?: AccountStatus; // アカウントステータス（招待中/連携中/停止中）
  permissions?: UserPermissions; // ダッシュボード権限（employment_recordsから取得）
  hasDashboardAccess?: boolean; // ダッシュボード権限があるかどうか
  isMaster?: boolean; // マスター管理者（施設オーナー）かどうか
  // 基本情報
  birthDate?: string; // 生年月日 (YYYY-MM-DD)
  gender?: '男性' | '女性' | 'その他';
  address?: string; // 住所
  phone?: string; // 電話番号
  email?: string; // メールアドレス
  // 個人情報（usersテーブルから取得）
  postalCode?: string | null; // 郵便番号
  myNumber?: string | null; // マイナンバー
  hasSpouse?: boolean; // 配偶者の有無
  spouseName?: string | null; // 配偶者氏名
  basicPensionSymbol?: string | null; // 基礎年金番号（記号）
  basicPensionNumber?: string | null; // 基礎年金番号（番号）
  employmentInsuranceStatus?: string | null; // 雇用保険の加入状況
  employmentInsuranceNumber?: string | null; // 雇用保険被保険者番号
  previousRetirementDate?: string | null; // 前職退職日
  previousName?: string | null; // 旧姓
  socialInsuranceStatus?: string | null; // 社会保険の加入状況
  hasDependents?: boolean; // 扶養家族の有無
  dependentCount?: number; // 扶養家族数
  dependents?: Array<{ name: string; relationship: string; birthDate: string; myNumber: string }> | null; // 扶養家族情報
  // 資格・経験
  qualifications?: string; // 資格（複数可、カンマ区切りなど）
  yearsOfExperience?: number; // 経験年数
  qualificationCertificate?: string; // 資格証画像（Base64またはURL）
  experienceCertificate?: string; // 実務経験証明書画像（Base64またはURL）
  // その他
  profilePhotoUrl?: string; // プロフィール写真URL
  emergencyContact?: string; // 緊急連絡先
  emergencyContactPhone?: string; // 緊急連絡先電話番号
  memo?: string; // 備考
  // 給与
  monthlySalary?: number; // 月給（常勤の場合）
  hourlyWage?: number; // 時給（非常勤の場合）
  // 基本シフトパターン（週の曜日ごとのシフト有無、月～土の6日分）
  defaultShiftPattern?: boolean[]; // [月, 火, 水, 木, 金, 土]の順（true=シフトあり、false=シフトなし）
  // デフォルト勤務パターン（シフト自動入力用）
  defaultWorkPattern?: DefaultWorkPattern;
  createdAt: string;
  updatedAt: string;
};

// デフォルト勤務パターン
export type DefaultWorkPattern = {
  days: number[];           // 勤務曜日 (0=日, 1=月, ..., 6=土)
  type: 'full' | 'am' | 'pm'; // 勤務タイプ
  startTime?: string;       // 開始時刻 (HH:mm)
  endTime?: string;         // 終了時刻 (HH:mm)
  patternId?: string;       // デフォルトのシフトパターンID
  label?: string;           // 表示用ラベル（例: "月-金 Full"）
};

// スケジュールデータ（利用実績・予定）
export type TimeSlot = 'AM' | 'PM';

export type ScheduleItem = {
  id: string; // データベース保存に対応するためstring型に変更
  facilityId: string; // 施設ID（マルチテナント対応）
  date: string; // YYYY-MM-DD
  childId: string; // Link to Child
  childName: string; // Denormalized for display ease
  slot: TimeSlot;
  hasPickup: boolean;
  hasDropoff: boolean;
  staffId?: string; // Link to Staff (送迎担当など)
  createdAt: string;
  updatedAt: string;
};

// 予約リクエスト（保護者からの申請）
export type BookingRequest = {
  id: string; // データベース保存に対応するためstring型に変更
  facilityId: string; // 施設ID（マルチテナント対応）
  childName: string;
  date: string;
  time: string;
  type: '追加希望' | '欠席連絡';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
};

// シフトデータ
export type Shift = {
  id: string;
  facilityId: string; // 施設ID（マルチテナント対応）
  date: string;
  staffId: string;
  staffName: string;
  shiftType: '早番' | '遅番' | '日勤' | '休み';
  createdAt: string;
  updatedAt: string;
};

// 利用実績データ
export type UsageRecord = {
  id: string;
  facilityId: string; // 施設ID（マルチテナント対応）
  scheduleId: string; // スケジュールIDへの参照（データベース保存に対応するためstring型に変更）
  childId: string; // 児童ID
  childName: string; // 児童名（非正規化）
  date: string; // YYYY-MM-DD
  // サービス提供の状況
  serviceStatus: '利用' | '欠席(加算なし)' | '加算のみ';
  // 提供形態
  provisionForm?: string;
  // 計画時間
  plannedStartTime?: string; // HH:mm
  plannedEndTime?: string; // HH:mm
  plannedTimeOneMinuteInterval: boolean; // 1分間隔で入力する
  // 開始終了時間
  actualStartTime?: string; // HH:mm
  actualEndTime?: string; // HH:mm
  actualTimeOneMinuteInterval: boolean; // 1分間隔で入力する
  // 算定時間数
  calculatedTime: number; // 時間数
  calculatedTimeMethod: '計画時間から算出' | '開始終了時間から算出' | '手動入力';
  // 時間区分
  timeCategory?: string; // 例: "区分2 (1時間30分超3時間以下)"
  // 送迎迎え
  pickup: 'なし' | 'あり';
  pickupSamePremises: boolean; // 同一敷地内
  // 送迎送り
  dropoff: 'なし' | 'あり';
  dropoffSamePremises: boolean; // 同一敷地内
  // 部屋
  room?: string;
  // 指導形態
  instructionForm?: string; // 例: "小集団"
  // 請求対象
  billingTarget: '請求する' | '請求しない';
  // 自費項目
  selfPayItem?: string;
  // 支援記録（フリーフォーマット）
  supportRecord?: string; // 支援内容の詳細記録
  supportGoal?: string; // 本日の支援目標
  childCondition?: string; // 児童の様子・状態
  specialNotes?: string; // 特記事項・引継ぎ事項
  // メモ
  memo?: string; // 最大2000文字
  // 実績記録票備考
  recordSheetRemarks?: string; // 最大50文字
  // 加算情報
  addonItems: string[]; // 選択された加算項目の配列
  // メタデータ
  createdAt: string;
  updatedAt: string;
};

// 利用実績フォームデータ
export type UsageRecordFormData = Omit<UsageRecord, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>;

// 上限管理
export type UpperLimitManagement = {
  id: string;
  facilityId: string;
  childId: string;
  yearMonth: string; // YYYY-MM
  managementType: 'none' | 'self' | 'coordinator' | 'managed';
  upperLimitAmount: number;
  selfTotalUnits: number;
  selfCopayAmount: number;
  selfUsageDays: number;
  resultType?: 'confirmed' | 'adjusted' | 'pending';
  adjustedCopayAmount?: number;
  totalCopayAllFacilities?: number;
  notes?: string;
  otherFacilities?: UpperLimitOtherFacility[];
  childName?: string; // JOIN用
  createdAt: string;
  updatedAt: string;
};

export type UpperLimitOtherFacility = {
  id: string;
  upperLimitId: string;
  facilityNumber?: string;
  facilityName: string;
  totalUnits: number;
  copayAmount: number;
  usageDays: number;
  adjustedCopayAmount?: number;
  contactPhone?: string;
  contactFax?: string;
};

// 連絡帳
export type ContactLog = {
  id: string;
  facilityId: string;
  childId: string;
  scheduleId?: string;
  date: string; // YYYY-MM-DD
  slot?: 'AM' | 'PM';

  // 活動内容
  activities?: string;

  // 体調・様子
  healthStatus?: 'excellent' | 'good' | 'fair' | 'poor';
  mood?: 'very_happy' | 'happy' | 'neutral' | 'sad' | 'upset';
  appetite?: 'excellent' | 'good' | 'fair' | 'poor' | 'none';

  // 食事
  mealMain?: boolean;
  mealSide?: boolean;
  mealNotes?: string;

  // 排泄
  toiletCount?: number;
  toiletNotes?: string;

  // 睡眠（お昼寝）
  napStartTime?: string;
  napEndTime?: string;
  napNotes?: string;

  // スタッフからのコメント
  staffComment?: string;
  staffUserId?: string;

  // 保護者への連絡事項
  parentMessage?: string;

  // 保護者からの返信
  parentReply?: string;
  parentReplyAt?: string;

  // ワークフローステータス
  status?: 'draft' | 'submitted' | 'signed';

  // サイン関連
  isSigned?: boolean;
  signedAt?: string;
  signedByUserId?: string;
  signatureData?: string;
  parentSignerName?: string;

  // メタデータ
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

// 連絡帳フォームデータ
export type ContactLogFormData = Omit<ContactLog, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>;

// リードステータス
export type LeadStatus = 'new-inquiry' | 'visit-scheduled' | 'considering' | 'waiting-benefit' | 'contract-progress' | 'contracted' | 'lost';

// 希望オプション
export type PreferenceOption = 'required' | 'preferred' | 'not-needed';

// リードデータ
export type Lead = {
  id: string;
  facilityId: string; // 施設ID（マルチテナント対応）
  // 基本情報
  name: string; // リード名（保護者名や案件名）
  childName?: string; // 児童名
  status: LeadStatus; // リードステータス
  // 連絡先
  phone?: string;
  email?: string;
  address?: string;
  // 見込み情報
  expectedStartDate?: string; // 見込み開始日
  // 利用希望
  preferredDays?: string[]; // 利用希望曜日（例: ["月", "水", "金"]）
  pickupOption?: PreferenceOption; // 送迎の必須度
  // 問い合わせ経路
  inquirySource?: 'devnavi' | 'homepage' | 'support-office' | 'other'; // 問い合わせ経路
  inquirySourceDetail?: string; // 問い合わせ経路の詳細（相談支援事業所名やその他の内容）
  // 関連児童ID
  childIds: string[]; // 関連する児童IDの配列
  // メモ
  memo?: string;
  // メタデータ
  createdAt: string;
  updatedAt: string;
};

// リードフォームデータ
export type LeadFormData = Omit<Lead, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>;

// 人件費設定（スタッフごと）
export type StaffSalary = {
  staffId: string;
  staffName: string;
  monthlySalary?: number; // 月給（常勤の場合）
  hourlyWage?: number; // 時給（非常勤の場合）
  workingHours?: number; // 月間労働時間（非常勤の場合）
  totalAmount: number; // 合計金額（自動計算）
};

// 固定費項目
export type FixedCostItem = {
  id: string;
  category: string; // カテゴリ（家賃、光熱費、保険料など）
  name: string; // 項目名
  amount: number; // 金額
  memo?: string; // メモ
};

// 変動費項目
export type VariableCostItem = {
  id: string;
  category: string; // カテゴリ（材料費、消耗品費など）
  name: string; // 項目名
  amount: number; // 金額
  memo?: string; // メモ
};

// 月ごとの経営目標設定
export type ManagementTarget = {
  id: string;
  facilityId: string; // 施設ID（マルチテナント対応）
  year: number; // 年
  month: number; // 月（1-12）
  // コスト設定（詳細）
  staffSalaries: StaffSalary[]; // 人件費（スタッフごと）
  fixedCostItems: FixedCostItem[]; // 固定費項目（家賃、光熱費など）
  variableCostItems: VariableCostItem[]; // 変動費項目
  // 計算された合計（自動計算）
  totalFixedCost: number; // 固定費合計
  totalVariableCost: number; // 変動費合計
  // 目標設定
  targetRevenue: number; // 売上目標（円）
  targetOccupancyRate: number; // 稼働率目標（%）
  // 単価設定
  dailyPricePerChild: number; // 児童一人当たりの1日あたりの単価（円）
  // メタデータ
  createdAt: string;
  updatedAt: string;
};

// 経営目標フォームデータ
export type ManagementTargetFormData = Omit<ManagementTarget, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>;

// チャットメッセージ（保護者と施設スタッフ間のコミュニケーション）
export type ChatMessage = {
  id: string;
  facilityId: string; // 施設ID
  clientUserId: string; // 保護者（クライアント）のユーザーID
  senderId: string; // 送信者のユーザーID
  senderType: 'staff' | 'client'; // 送信者種別
  senderName: string; // 送信者の表示名
  message: string; // メッセージ本文
  isRead: boolean; // 既読フラグ
  readAt?: string; // 既読日時
  createdAt: string;
  updatedAt: string;
};

// ==========================================
// コネクト（連絡会調整）機能
// ==========================================

// 連絡会ステータス
export type ConnectMeetingStatus = 'scheduling' | 'confirmed' | 'completed' | 'cancelled';

// 参加者ステータス
export type ConnectParticipantStatus = 'pending' | 'responded' | 'declined';

// 日程回答タイプ
export type ConnectResponseType = 'available' | 'maybe' | 'unavailable';

// 連絡会メインデータ
export type ConnectMeeting = {
  id: string;
  facilityId: string; // 施設ID
  childId: string; // 対象児童ID
  // 会議情報
  title: string; // 会議名
  purpose?: string; // 目的
  location?: string; // 場所
  estimatedDuration?: number; // 所要時間（分）
  description?: string; // 詳細説明
  // ステータス
  status: ConnectMeetingStatus;
  // 確定日程
  confirmedDateOptionId?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  // メタデータ
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // 拡張情報（JOINで取得）
  childName?: string;
  dateOptions?: ConnectMeetingDateOption[];
  participants?: ConnectMeetingParticipant[];
};

// 日程候補
export type ConnectMeetingDateOption = {
  id: string;
  meetingId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime?: string; // HH:mm
  // 集計
  availableCount: number;
  maybeCount: number;
  unavailableCount: number;
  // メタデータ
  createdAt: string;
  updatedAt: string;
  // 拡張情報（JOINで取得）
  responses?: ConnectMeetingResponse[];
};

// 参加依頼先
export type ConnectMeetingParticipant = {
  id: string;
  meetingId: string;
  // 組織情報
  organizationName: string; // 組織名（行政、保育園、学校など）
  representativeEmail: string; // 担当者メールアドレス
  representativeName?: string; // 担当者名
  // アクセストークン
  accessToken: string;
  tokenExpiresAt: string;
  // ステータス
  status: ConnectParticipantStatus;
  // 回答情報
  respondedAt?: string;
  responderName?: string;
  attendeeCount?: number;
  attendeeNames?: string;
  comment?: string;
  // メール送信履歴
  invitationSentAt?: string;
  reminderSentAt?: string;
  confirmationSentAt?: string;
  // メタデータ
  createdAt: string;
  updatedAt: string;
  // 拡張情報（JOINで取得）
  responses?: ConnectMeetingResponse[];
};

// 日程回答
export type ConnectMeetingResponse = {
  id: string;
  participantId: string;
  dateOptionId: string;
  response: ConnectResponseType;
  createdAt: string;
  updatedAt: string;
};

// コネクト作成フォームデータ
export type ConnectMeetingFormData = {
  childId: string;
  title: string;
  purpose?: string;
  location?: string;
  estimatedDuration?: number;
  description?: string;
  dateOptions: Array<{
    date: string;
    startTime: string;
    endTime?: string;
  }>;
  participants: Array<{
    organizationName: string;
    representativeEmail: string;
    representativeName?: string;
  }>;
};

// 連絡会議 拡張型
export type ConnectMeetingAgendaItem = {
  title: string;
  description?: string;
  order: number;
};

export type ConnectMeetingDecision = {
  title: string;
  description?: string;
  assignee?: string;
};

export type ConnectMeetingActionItem = {
  task: string;
  assignee?: string;
  dueDate?: string;
  status: 'pending' | 'done';
};

// ==========================================
// 施設別時間枠設定
// ==========================================

// 施設別時間枠
export type FacilityTimeSlot = {
  id: string;
  facilityId: string;
  name: string; // "午前", "午後", "放課後" など
  startTime: string; // HH:mm形式
  endTime: string; // HH:mm形式
  capacity: number; // 定員
  displayOrder: number; // 表示順
  createdAt: string;
  updatedAt: string;
};

// ==========================================
// 業務ツール設定
// ==========================================

// 業務ツールID（キャリア画面で表示するツール）
export type WorkToolId =
  | 'time_tracking'       // 打刻（勤怠）
  | 'attendance_calendar' // 勤怠カレンダー（休暇申請も含む）
  | 'shift_view'          // シフト確認
  | 'expense'             // 経費精算
  | 'payslip'             // 給与明細
  | 'knowledge_base'      // ナレッジベース（社内Wiki）
  | 'biz_dashboard';      // Bizダッシュボード

// 業務ツール定義
export type WorkToolDefinition = {
  id: WorkToolId;
  name: string;
  icon: string; // Lucide icon name
  description: string;
  defaultEnabled: boolean; // デフォルトで有効か
};

// 業務ツール一覧（キャリア画面に表示する機能）
// ※日報、書類出力、研修記録等はビジネス管理画面から利用可能
export const WORK_TOOLS: WorkToolDefinition[] = [
  { id: 'time_tracking', name: '打刻', icon: 'Clock', description: '始業・終業・休憩の打刻', defaultEnabled: true },
  { id: 'attendance_calendar', name: '勤怠カレンダー', icon: 'Calendar', description: '勤怠実績・休暇申請', defaultEnabled: true },
  { id: 'shift_view', name: 'シフト確認', icon: 'CalendarDays', description: 'シフト表の確認', defaultEnabled: true },
  { id: 'expense', name: '経費精算', icon: 'Receipt', description: '経費の申請・管理', defaultEnabled: true },
  { id: 'payslip', name: '給与明細', icon: 'Wallet', description: '給与明細・書類の確認', defaultEnabled: true },
  { id: 'knowledge_base', name: 'ナレッジ', icon: 'Library', description: '就業規則・マニュアル・ノウハウ', defaultEnabled: true },
  { id: 'biz_dashboard', name: 'ビジネス管理画面', icon: 'Briefcase', description: '施設管理画面を開く', defaultEnabled: true },
];

// 施設業務ツール設定
export type FacilityWorkToolSettings = {
  id: string;
  facilityId: string;
  enabledTools: Record<WorkToolId, boolean>;
  toolOrder: WorkToolId[];
  customSettings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

// ==========================================
// 打刻・勤怠管理
// ==========================================

// 打刻タイプ
export type AttendanceType = 'start' | 'end' | 'break_start' | 'break_end';

// 勤務ステータス
export type WorkStatus = 'not_started' | 'working' | 'on_break' | 'completed';

// 打刻記録
export type AttendanceRecord = {
  id: string;
  userId: string;
  facilityId: string;
  date: string; // YYYY-MM-DD
  type: AttendanceType;
  time: string; // HH:mm
  recordedAt: string; // ISO timestamp
  isManualCorrection: boolean;
  correctionReason?: string;
  correctedBy?: string;
  locationLat?: number;
  locationLng?: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

// 日次勤怠サマリー
export type AttendanceDailySummary = {
  userId: string;
  facilityId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  breakStartTime?: string;
  breakEndTime?: string;
  status: WorkStatus;
};

// 打刻タイプのラベル
export const ATTENDANCE_TYPE_LABELS: Record<AttendanceType, string> = {
  start: '始業',
  end: '退勤',
  break_start: '休憩開始',
  break_end: '休憩終了',
};

// 勤務ステータスのラベル
export const WORK_STATUS_LABELS: Record<WorkStatus, { label: string; color: string }> = {
  not_started: { label: '未出勤', color: 'bg-gray-100 text-gray-600' },
  working: { label: '勤務中', color: 'bg-green-100 text-green-700' },
  on_break: { label: '休憩中', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: '退勤済', color: 'bg-blue-100 text-blue-700' },
};

// ==========================================
// 通知機能
// ==========================================

// 通知タイプ
export type NotificationType =
  | 'staff_activated'      // スタッフがアカウントを有効化
  | 'permission_granted'   // 権限が付与された
  | 'permission_revoked'   // 権限が取り消された
  | 'general';             // 一般的な通知

// 通知データ
export type Notification = {
  id: string;
  facilityId: string;
  userId?: string;           // 通知対象のユーザー（NULL=施設全体）
  type: NotificationType;
  title: string;
  message: string;
  relatedUserId?: string;    // 関連するユーザー
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
  // 拡張情報（JOINで取得）
  relatedUserName?: string;
};

// ===== 実務経験証明書関連 =====

// 実務経験証明書のステータス
export type WorkExperienceStatus = 'draft' | 'pending' | 'signed' | 'rejected';

// 事業種別
export const BUSINESS_TYPES = [
  { id: 1, name: '障害児入所施設等', description: '障害児入所施設、乳児院、児童家庭支援センター、児童養護施設、障害者支援施設' },
  { id: 2, name: '認可保育園等', description: '認可保育園、幼保連携型認定保育園、地域型認定保育園' },
  { id: 3, name: '学校・幼稚園等', description: '学校、幼稚園、幼稚園型認定保育園、事業所内保育事業、居宅訪問型保育事業、家庭的保育事業' },
  { id: 4, name: '障害通所支援等', description: '障害通所支援事業、放課後児童健全育成事業' },
  { id: 5, name: '小規模保育等', description: '小規模保育事業、病児保育事業、地域子育て支援拠点事業、子育て援助活動支援事業' },
  { id: 6, name: '障害福祉サービス', description: '障害福祉サービス事業（生活介護、共同生活援助、居宅介護、就労継続支援など）' },
  { id: 7, name: '老人福祉施設等', description: '老人福祉施設、老人居宅介護、老人通所介護、地域包括支援センター、更生施設' },
  { id: 8, name: '相談支援事業等', description: '障害児（者）相談支援事業、児童相談所、地域生活支援事業、障害者就業支援センター' },
  { id: 9, name: 'その他', description: 'その他' },
  { id: 10, name: '認可外保育園等', description: '認可外保育園、企業主導型保育事業' },
] as const;

// 実務経験記録（実務経験証明書発行用）
export type WorkExperienceRecord = {
  id: string;
  userId: string;

  // 施設・法人情報
  facilityName: string;           // 施設又は事業所名
  corporateName?: string;         // 法人名
  corporateAddress?: string;      // 法人所在地
  corporatePhone?: string;        // 電話番号
  representativeName?: string;    // 代表者氏名
  contactEmail?: string;          // 発行依頼送信先メール
  contactPersonName?: string;     // 担当者名（宛名用）

  // 事業種別（1〜10）
  businessType?: number;
  businessTypeOther?: string;     // その他の場合の記載

  // 業務期間
  startDate: string;
  endDate?: string;
  totalWorkDays?: number;         // 実勤務日数
  weeklyAverageDays?: number;     // 週平均勤務日数

  // 業務内容
  jobTitle?: string;              // 職名（保育士、児童指導員など）
  employmentType?: 'fulltime' | 'parttime'; // 常勤/非常勤
  jobDescription?: string;        // 業務内容詳細

  // 証明書ステータス
  status: WorkExperienceStatus;
  signatureToken?: string;        // 電子署名用トークン
  signatureRequestedAt?: string;
  signedAt?: string;
  signedPdfUrl?: string;
  rejectionReason?: string;

  // メール関連
  emailSubject?: string;          // カスタマイズされたメール件名
  emailBody?: string;             // カスタマイズされたメール本文

  // 署名データ
  signatureImageUrl?: string;     // 署名画像URL
  sealImageUrl?: string;          // 印影画像URL
  signerName?: string;            // 署名者名
  signerTitle?: string;           // 署名者役職

  createdAt: string;
  updatedAt: string;
};

// 発行依頼メールのデフォルトテンプレート生成
export const generateCertificateRequestEmail = (
  applicantName: string,
  facilityName: string,
  contactPersonName: string,
  startDate: string,
  endDate?: string
): { subject: string; body: string } => {
  const periodStr = endDate
    ? `${startDate}〜${endDate}`
    : `${startDate}〜現在`;

  return {
    subject: `【実務経験証明書発行のお願い】${applicantName}`,
    body: `${contactPersonName || '担当者'} 様

お世話になっております。
${applicantName}と申します。

この度、資格取得のため実務経験証明書が必要となり、
ご連絡させていただきました。

貴施設「${facilityName}」にて勤務しておりました期間
（${periodStr}）の実務経験証明書の発行をお願いできますでしょうか。

下記リンクより、証明書の内容をご確認いただき、
電子署名をお願いできれば幸いです。

ご多忙のところ恐れ入りますが、
何卒よろしくお願い申し上げます。

────────────────────────
${applicantName}
────────────────────────`,
  };
};

// ==========================================
// シフト管理システム
// ==========================================

// シフトパターン（施設ごとに定義）
export type ShiftPattern = {
  id: string;
  facilityId: string;
  name: string;           // '早番', '遅番', '日勤' など
  shortName?: string;     // '早', '遅', '日' など（カレンダー表示用）
  startTime?: string;     // 開始時刻 (HH:mm)
  endTime?: string;       // 終了時刻 (HH:mm)
  breakMinutes: number;   // 休憩時間（分）
  color: string;          // 表示色
  displayOrder: number;   // 表示順
  isDayOff: boolean;      // 休日パターンかどうか
  isActive: boolean;      // 有効フラグ
  createdAt: string;
  updatedAt: string;
};

// 月間シフトスケジュールステータス
export type MonthlyShiftStatus = 'draft' | 'published' | 'confirmed';

// 月間シフトスケジュール
export type MonthlyShiftSchedule = {
  id: string;
  facilityId: string;
  year: number;
  month: number;
  status: MonthlyShiftStatus;
  publishedAt?: string;   // 公開日時
  confirmedAt?: string;   // 確定日時
  republishedAt?: string; // 最終再周知日時
  republishCount?: number; // 再周知回数
  createdAt: string;
  updatedAt: string;
};

// シフト確認ステータス
export type ShiftConfirmationStatus = 'pending' | 'confirmed' | 'needs_discussion';

// シフト確認（スタッフの回答）
export type ShiftConfirmation = {
  id: string;
  shiftId: string;
  userId: string;
  status: ShiftConfirmationStatus;
  comment?: string;           // 相談内容
  respondedAt?: string;       // 回答日時
  resolvedAt?: string;        // 相談解決日時
  resolutionNote?: string;    // 解決メモ
  requiresReconfirm?: boolean; // 再確認が必要か
  previousShiftPatternId?: string; // 変更前のシフトパターンID
  version?: number;           // 確認バージョン
  createdAt: string;
  updatedAt: string;
  // 拡張情報（JOINで取得）
  userName?: string;
  shiftDate?: string;
};

// スタッフ別休暇設定
export type StaffLeaveSettings = {
  id: string;
  facilityId: string;
  userId: string;
  // 有給休暇
  paidLeaveEnabled: boolean;
  paidLeaveDays: number;
  // 代休
  substituteLeaveEnabled: boolean;
  substituteLeaveDays: number;
  // メモ
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // 拡張情報（JOINで取得）
  userName?: string;
};

// 拡張シフト型（パターン情報付き）
export type ShiftWithPattern = {
  id: string;
  facilityId: string;
  staffId: string;
  date: string;
  hasShift: boolean;
  shiftPatternId?: string;
  monthlyScheduleId?: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  createdAt: string;
  updatedAt: string;
  // 拡張情報（JOINで取得）
  staffName?: string;
  shiftPattern?: ShiftPattern;
  confirmation?: ShiftConfirmation;
};

// シフト確認ステータスのラベル
export const SHIFT_CONFIRMATION_STATUS_LABELS: Record<ShiftConfirmationStatus, { label: string; color: string }> = {
  pending: { label: '未回答', color: 'bg-gray-100 text-gray-600' },
  confirmed: { label: 'OK', color: 'bg-green-100 text-green-700' },
  needs_discussion: { label: '相談したい', color: 'bg-orange-100 text-orange-700' },
};

// 月間シフトステータスのラベル
export const MONTHLY_SHIFT_STATUS_LABELS: Record<MonthlyShiftStatus, { label: string; color: string }> = {
  draft: { label: '作成中', color: 'bg-gray-100 text-gray-600' },
  published: { label: '公開中', color: 'bg-blue-100 text-blue-700' },
  confirmed: { label: '確定', color: 'bg-green-100 text-green-700' },
};

// 休暇申請タイプ（leave_requests用）
export type LeaveRequestType = 'paid_leave' | 'half_day_am' | 'half_day_pm' | 'special_leave' | 'sick_leave' | 'absence';

// 休暇申請タイプのラベル
export const LEAVE_REQUEST_TYPE_LABELS: Record<LeaveRequestType, string> = {
  paid_leave: '有給休暇',
  half_day_am: '午前半休',
  half_day_pm: '午後半休',
  special_leave: '特別休暇',
  sick_leave: '病欠',
  absence: '欠勤',
};

// 休暇申請（簡略版 - 有給/欠勤/代休）
export type LeaveRequest = {
  id: string;
  userId: string;
  facilityId: string;
  requestType: LeaveRequestType;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  // 拡張情報（JOINで取得）
  userName?: string;
  approverName?: string;
};

// ==========================================
// 希望シフト提出
// ==========================================

// 希望シフト提出
export type ShiftAvailabilitySubmission = {
  id: string;
  facilityId: string;
  userId: string;
  year: number;
  month: number;
  availableDates: string[];  // 出勤可能日の配列 ['2026-02-01', '2026-02-03', ...]
  notes?: string;            // 備考
  submittedAt?: string;      // 提出日時（NULLの場合は下書き）
  createdAt: string;
  updatedAt: string;
  // 拡張情報（JOINで取得）
  userName?: string;
};

// 希望提出締切設定
export type ShiftAvailabilityDeadline = {
  id: string;
  facilityId: string;
  year: number;
  month: number;
  deadlineDate: string;      // 締切日 (YYYY-MM-DD)
  isOpen: boolean;           // 提出受付中かどうか
  createdAt: string;
  updatedAt: string;
};

// スタッフ別希望提出状況（ダッシュボード用）
export type StaffAvailabilityStatus = {
  staffId: string;
  staffName: string;
  userId?: string;
  submitted: boolean;
  submittedAt?: string;
  availableDates: string[];
  notes?: string;
};

// ============================================
// 送迎担当者・完了チェック関連の型定義
// ============================================

// 日別送迎担当者割り当て
export type DailyTransportAssignment = {
  id: string;
  facilityId: string;
  date: string;               // YYYY-MM-DD
  // レガシー（送迎共通）
  driverStaffId?: string;
  attendantStaffId?: string;
  // 迎え担当
  pickupDriverStaffId?: string;
  pickupAttendantStaffId?: string;
  // 送り担当
  dropoffDriverStaffId?: string;
  dropoffAttendantStaffId?: string;
  // 追加情報
  vehicleInfo?: string;
  pickupTime?: string;
  dropoffTime?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // JOIN情報
  driverName?: string;
  attendantName?: string;
  pickupDriverName?: string;
  pickupAttendantName?: string;
  dropoffDriverName?: string;
  dropoffAttendantName?: string;
};

// 送迎完了チェック記録
export type TransportCompletionRecord = {
  id: string;
  facilityId: string;
  date: string;               // YYYY-MM-DD
  scheduleId: string;
  childId: string;
  // お迎え完了
  pickupCompleted: boolean;
  pickupCompletedAt?: string;
  pickupCompletedBy?: string;
  pickupNotes?: string;
  // お送り完了
  dropoffCompleted: boolean;
  dropoffCompletedAt?: string;
  dropoffCompletedBy?: string;
  dropoffNotes?: string;
  createdAt: string;
  updatedAt: string;
  // 拡張情報（JOINで取得）
  childName?: string;
};

// ============================================
// 行政連携関連の型定義
// ============================================

// 行政機関
export type GovernmentOrganization = {
  id: string;
  name: string;
  department?: string;
  prefecture?: string;
  municipalityCode?: string;
  address?: string;
  phone?: string;
  fax?: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
};

// 行政アカウント
export type GovernmentAccount = {
  id: string;
  organizationId: string;
  email: string;
  name?: string;
  role: 'staff' | 'admin';
  accessToken?: string;
  tokenExpiresAt?: string;
  lastAccessedAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // 参照データ
  organization?: GovernmentOrganization;
};

// 事業所と行政の紐付け
export type FacilityGovernmentLink = {
  id: string;
  facilityId: string;
  organizationId: string;
  linkType: 'jurisdiction' | 'other';
  primaryContactEmail?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // 参照データ
  organization?: GovernmentOrganization;
};

// 書類カテゴリ
export type GovernmentDocumentCategory = {
  id: string;
  code: string;
  name: string;
  description?: string;
  submissionFrequency?: 'monthly' | 'quarterly' | 'annually' | 'as_needed';
  requiredFields?: Record<string, any>;
  templateUrl?: string;
  isActive: boolean;
  createdAt: string;
};

// 書類提出ステータス
export type DocumentSubmissionStatus = 'draft' | 'submitted' | 'received' | 'returned' | 'completed';

// 書類提出
export type GovernmentDocumentSubmission = {
  id: string;
  facilityId: string;
  organizationId: string;
  categoryId: string;
  title: string;
  targetPeriod?: string;
  targetYear?: number;
  targetMonth?: number;
  content?: Record<string, any>;
  fileUrl?: string;
  fileName?: string;
  status: DocumentSubmissionStatus;
  submittedAt?: string;
  submittedBy?: string;
  receivedAt?: string;
  receivedBy?: string;
  returnReason?: string;
  completionNote?: string;
  createdAt: string;
  updatedAt: string;
  // 参照データ
  organization?: GovernmentOrganization;
  category?: GovernmentDocumentCategory;
};

// 契約内容報告書の明細
export type ContractReportItem = {
  id: string;
  submissionId: string;
  childId: string;
  contractId?: string;
  reportType: 'new' | 'change' | 'termination';
  childName: string;
  childBirthday?: string;
  recipientNumber?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  serviceType?: string;
  daysPerMonth?: number;
  changeContent?: string;
  terminationReason?: string;
  createdAt: string;
};

// 行政⇔事業所メッセージ
export type GovernmentMessage = {
  id: string;
  facilityId: string;
  organizationId: string;
  relatedSubmissionId?: string;
  relatedMeetingId?: string;
  direction: 'to_facility' | 'to_government';
  subject: string;
  body: string;
  attachments?: { name: string; url: string; type?: string }[];
  sentByUserId?: string;
  sentByGovAccountId?: string;
  sentAt: string;
  readAt?: string;
  readBy?: string;
  createdAt: string;
  // 参照データ
  organization?: GovernmentOrganization;
};

// ============================================
// 個別支援計画PDF管理
// ============================================

export type SupportPlanFileStatus = 'draft' | 'active' | 'completed' | 'archived';
export type SupportPlanType = 'initial' | 'renewal' | 'modification';

// 5領域（発達支援の基本領域）
export type DevelopmentalDomain =
  | 'health_daily_life'        // 健康・生活
  | 'movement_sensory'         // 運動・感覚
  | 'cognition_behavior'       // 認知・行動
  | 'language_communication'   // 言語・コミュニケーション
  | 'human_relations_social';  // 人間関係・社会性

// アセスメント（5領域ごとの現在の発達状況）
export type DomainAssessment = {
  domain: DevelopmentalDomain;
  currentLevel: string; // 現在の発達状況
};

// 短期目標
export type ShortTermGoal = {
  id: string;
  goalText: string;           // 目標内容
  domains: DevelopmentalDomain[]; // 関連する5領域
  supportContent: string;     // 支援内容の詳細
  achievementCriteria: string; // 達成基準
  responsibleStaff: string;   // 担当者
  // 評価
  midEvaluation?: string;     // 中間評価
  midEvaluationLevel?: 'achieved' | 'progressing' | 'unchanged' | 'regressed';
  finalEvaluation?: string;   // 期末評価
  finalEvaluationLevel?: 'achieved' | 'progressing' | 'unchanged' | 'regressed';
};

// 個別支援計画の詳細コンテンツ（JSONB格納）
export type SupportPlanContent = {
  // ヘッダー情報
  guardianName?: string;         // 保護者氏名
  beneficiaryNumber?: string;    // 受給者証番号
  planStartDate?: string;        // 計画開始日
  planEndDate?: string;          // 計画終了日
  managerName?: string;          // 児童発達支援管理責任者名
  monitoringDate?: string;       // モニタリング予定日

  // アセスメント
  disabilityStatus?: string;     // 障害の状況
  childWishes?: string;          // 本人の希望・興味
  familyWishes?: string;         // 家族の希望
  domainAssessments?: DomainAssessment[]; // 5領域ごとの発達状況

  // 支援目標
  overallPolicy?: string;        // 総合的な援助の方針
  longTermGoal?: string;         // 長期目標（1年）
  shortTermGoals?: ShortTermGoal[]; // 短期目標（3-6ヶ月）

  // 家族支援
  familySupportContent?: string;       // 家族支援の内容
  interAgencyCoordination?: string;    // 関係機関連携の内容

  // 評価
  midEvaluationDate?: string;          // 中間評価日
  midEvaluationOverallNotes?: string;  // 中間評価全体メモ
  finalEvaluationDate?: string;        // 期末評価日
  finalEvaluationOverallNotes?: string; // 期末評価全体メモ
  nextPlanRecommendations?: string;    // 次期計画への提言
};

export type SupportPlanFile = {
  id: string;
  facilityId: string;
  childId: string;
  planType: SupportPlanType;
  periodStart: string;
  periodEnd: string;
  planCreatedDate: string;
  planCreatorName?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  parentAgreed: boolean;
  parentAgreedAt?: string;
  parentSignerName?: string;
  midEvaluationDate?: string;
  midEvaluationNote?: string;
  finalEvaluationDate?: string;
  finalEvaluationNote?: string;
  status: SupportPlanFileStatus;
  nextRenewalDate?: string;
  renewalReminderSent: boolean;
  notes?: string;
  planContent?: SupportPlanContent; // 詳細コンテンツ（JSONB）
  uploadedBy?: string;
  uploadedAt?: string;
  createdAt: string;
  updatedAt: string;
  // 参照データ
  child?: { id: string; name: string };
};

// ============================================
// 人員配置コンプライアンス管理
// Personnel Staffing Compliance
// ============================================

// 人員区分 (Personnel Classification)
export type PersonnelType = 'standard' | 'addition';

// 人員区分ラベル
export const PERSONNEL_TYPE_LABELS: Record<PersonnelType, string> = {
  standard: '基準人員',
  addition: '加算人員',
};

// 勤務形態 (Work Style)
export type WorkStyle = 'fulltime_dedicated' | 'fulltime_concurrent' | 'parttime';

// 勤務形態ラベル
export const WORK_STYLE_LABELS: Record<WorkStyle, string> = {
  fulltime_dedicated: '常勤専従',
  fulltime_concurrent: '常勤兼務',
  parttime: '非常勤',
};

// コンプライアンス状態 (Compliance Status)
export type ComplianceStatus = 'compliant' | 'warning' | 'non_compliant';

// コンプライアンス状態表示設定
export const COMPLIANCE_STATUS_CONFIG: Record<ComplianceStatus, { label: string; color: string; bgColor: string; icon: string }> = {
  compliant: { label: '充足', color: 'text-green-600', bgColor: 'bg-green-50', icon: '○' },
  warning: { label: '注意', color: 'text-yellow-600', bgColor: 'bg-yellow-50', icon: '△' },
  non_compliant: { label: '不足', color: 'text-red-600', bgColor: 'bg-red-50', icon: '×' },
};

// スタッフ人員設定 (Staff Personnel Settings)
export type StaffPersonnelSettings = {
  id: string;
  facilityId: string;
  staffId: string;
  personnelType: PersonnelType;
  workStyle: WorkStyle;
  isManager: boolean;           // 管理者フラグ
  isServiceManager: boolean;    // 児発管フラグ
  managerConcurrentRole?: string; // 管理者の兼務役割
  contractedWeeklyHours?: number; // 週所定労働時間
  assignedAdditionCodes?: string[]; // 配置先加算コード
  effectiveFrom: string;
  effectiveTo?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // 結合データ (JOIN)
  staffName?: string;
  qualifications?: string[];
  yearsOfExperience?: number;
};

// コンプライアンス警告タイプ
export type ComplianceWarningType =
  | 'staffing_shortage'      // 基準人員不足
  | 'fte_insufficient'       // 常勤換算不足
  | 'manager_absent'         // 管理者不在
  | 'service_manager_absent' // 児発管不在
  | 'fulltime_dedicated_absent' // 常勤専従不在
  | 'addition_requirement';  // 加算要件不足

// コンプライアンス警告
export type ComplianceWarning = {
  type: ComplianceWarningType;
  message: string;
  severity: 'error' | 'warning' | 'info';
  relatedAdditionCode?: string;
};

// スタッフコンプライアンス内訳
export type StaffComplianceBreakdown = {
  staffId: string;
  name: string;
  personnelType: PersonnelType;
  workStyle: WorkStyle;
  scheduledHours: number;    // その日のシフト時間
  fte: number;               // 常勤換算値
  qualifications?: string[];
  assignedAdditions?: string[];
  isManager?: boolean;
  isServiceManager?: boolean;
};

// 日次人員配置コンプライアンス
export type DailyStaffingCompliance = {
  id: string;
  facilityId: string;
  date: string;
  overallStatus: ComplianceStatus;
  // 基準人員チェック
  hasTwoStaff: boolean;              // 2名配置済み
  hasFulltimeDedicated: boolean;     // 常勤専従1名配置済み
  hasSecondStaff: boolean;           // 2人目充足
  fteTotal: number;                  // 常勤換算合計
  // 管理者・児発管チェック
  hasManager: boolean;
  hasServiceManager: boolean;
  // 人数内訳
  scheduledStaffCount: number;       // シフト登録スタッフ総数
  standardStaffCount: number;        // 基準人員数
  additionStaffCount: number;        // 加算人員数
  // 詳細
  additionCompliance: Record<string, { met: boolean; reason: string }>;
  staffBreakdown: StaffComplianceBreakdown[];
  warnings: ComplianceWarning[];
  // メタデータ
  calculatedAt: string;
  calculatedBy?: string;
};

// 加算スタッフ要件
export type AdditionStaffRequirement = {
  id: string;
  additionCode: string;
  requiredQualifications?: string[];
  anyQualification: boolean;         // いずれかの資格でOK
  minYearsExperience?: number;       // 最低経験年数
  requiredWorkStyle?: WorkStyle;     // 必要な勤務形態
  minFte?: number;                   // 最低FTE
  minStaffCount: number;             // 最低人数
  additionalConditions?: Record<string, unknown>;
  description?: string;
};

// 勤務体制一覧表ステータス
export type WorkScheduleReportStatus = 'draft' | 'submitted' | 'approved';

// 勤務体制一覧表のスタッフ配置エントリ
export type WorkScheduleStaffAssignment = {
  staffId: string;
  name: string;
  personnelType: PersonnelType;
  workStyle: WorkStyle;
  qualifications: string[];
  yearsOfExperience?: number;
  weeklyHours: number;
  fte: number;
  assignedAdditions: string[];
  role?: string;  // 児発管, 管理者 等
};

// 勤務体制一覧表
export type WorkScheduleReport = {
  id: string;
  facilityId: string;
  year: number;
  month: number;
  staffAssignments: WorkScheduleStaffAssignment[];
  totalStandardStaff: number;
  totalAdditionStaff: number;
  fteTotal: number;
  status: WorkScheduleReportStatus;
  generatedAt?: string;
  submittedAt?: string;
  submittedTo?: string;            // 提出先
  approvedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

// 施設設定の人員関連拡張 (FacilitySettingsの拡張)
export type FacilityStaffingSettings = {
  standardWeeklyHours: number;      // 週あたり所定労働時間（常勤の基準）
  managerStaffId?: string;          // 管理者のスタッフID
  serviceManagerStaffId?: string;   // 児発管のスタッフID
};

// 資格コード定義
export const QUALIFICATION_CODES = {
  PT: '理学療法士',
  OT: '作業療法士',
  ST: '言語聴覚士',
  PSYCHOLOGIST: '公認心理師',
  CLINICAL_PSYCHOLOGIST: '臨床心理士',
  VISION_TRAINER: '視能訓練士',
  NURSE: '看護師',
  ASSOCIATE_NURSE: '准看護師',
  PUBLIC_HEALTH_NURSE: '保健師',
  NURSERY_TEACHER: '保育士',
  CHILD_INSTRUCTOR: '児童指導員',
  CHILD_DEVELOPMENT_MANAGER: '児童発達支援管理責任者',
  SERVICE_MANAGER: 'サービス管理責任者',
  CONSULTATION_SPECIALIST: '相談支援専門員',
  SOCIAL_WORKER: '社会福祉士',
  PSYCHIATRIC_SOCIAL_WORKER: '精神保健福祉士',
  CARE_WORKER: '介護福祉士',
  DIETITIAN: '管理栄養士',
  NUTRITIONIST: '栄養士',
  JUDO_THERAPIST: '柔道整復師',
  ORTHOPTIST: '視能訓練士',
  PROSTHETIST: '義肢装具士',
  MUSIC_THERAPIST: '音楽療法士',
  BEHAVIOR_SUPPORT_SPECIALIST: '強度行動障害支援者',
  MEDICAL_CARE_CHILD_SUPPORT: '医療的ケア児支援者',
  DEVELOPMENT_DISORDER_SV: '発達障害支援スーパーバイザー',
  DRIVERS_LICENSE: '普通自動車運転免許',
  // Legacy alias (kept for backward compatibility)
  PSYCH_WELFARE_WORKER: '精神保健福祉士',
} as const;

export type QualificationCode = keyof typeof QUALIFICATION_CODES;

// ==========================================
// ナレッジベース（社内Wiki）
// ==========================================

// ナレッジカテゴリコード
export type KnowledgeCategoryCode = 'labor' | 'manual' | 'facility' | 'knowhow' | 'qa' | 'other';

// デフォルトカテゴリ定義
export const DEFAULT_KNOWLEDGE_CATEGORIES: {
  code: KnowledgeCategoryCode;
  name: string;
  icon: string;
  color: string;
}[] = [
  { code: 'labor', name: '労務・制度', icon: 'Scale', color: '#3B82F6' },
  { code: 'manual', name: '業務マニュアル', icon: 'BookOpen', color: '#10B981' },
  { code: 'facility', name: '施設情報', icon: 'Building2', color: '#8B5CF6' },
  { code: 'knowhow', name: '療育ノウハウ', icon: 'Lightbulb', color: '#F59E0B' },
  { code: 'qa', name: 'Q&A', icon: 'HelpCircle', color: '#EC4899' },
  { code: 'other', name: 'その他', icon: 'FileText', color: '#6B7280' },
];

// ナレッジカテゴリ
export type KnowledgeCategory = {
  id: string;
  facilityId: string;
  code: string;
  name: string;
  icon: string;
  color: string;
  displayOrder: number;
  isDefault: boolean;
  createdAt: string;
};

// 添付ファイル
export type KnowledgeAttachment = {
  url: string;
  name: string;
  type: string;
  size: number;
};

// ナレッジ記事
export type KnowledgeArticle = {
  id: string;
  facilityId: string;

  // コンテンツ
  title: string;
  content: string;           // Markdown形式
  summary?: string;

  // 分類
  category: string;
  tags: string[];

  // 権限・公開設定
  isAdminLocked: boolean;    // true: 管理者のみ編集可能
  isPublished: boolean;
  isPinned: boolean;

  // 添付ファイル
  attachments: KnowledgeAttachment[];

  // 作成者情報
  authorId?: string;
  authorName?: string;
  lastEditorId?: string;
  lastEditorName?: string;

  // 統計
  viewCount: number;

  // タイムスタンプ
  createdAt: string;
  updatedAt: string;
};

// 記事作成/更新用
export type KnowledgeArticleInput = {
  title: string;
  content: string;
  summary?: string;
  category: string;
  tags?: string[];
  isAdminLocked?: boolean;
  isPublished?: boolean;
  isPinned?: boolean;
  attachments?: KnowledgeAttachment[];
};

// =============================================
// 公式規定・制度（Company Regulations）
// =============================================

// 規定カテゴリ
export type RegulationCategory = {
  id: string;
  facilityId: string;
  code: string;           // 'employment_rules', 'salary', 'benefits', 'safety', 'other'
  name: string;           // '就業規則', '賃金・報酬', '福利厚生', '安全衛生', 'その他'
  icon?: string;          // Lucide icon name
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

// デフォルト規定カテゴリ
export const DEFAULT_REGULATION_CATEGORIES: Omit<RegulationCategory, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>[] = [
  { code: 'employment_rules', name: '就業規則', icon: 'FileText', displayOrder: 1 },
  { code: 'salary', name: '賃金・報酬', icon: 'Wallet', displayOrder: 2 },
  { code: 'benefits', name: '福利厚生', icon: 'Heart', displayOrder: 3 },
  { code: 'safety', name: '安全衛生', icon: 'Shield', displayOrder: 4 },
  { code: 'other', name: 'その他規定', icon: 'FolderOpen', displayOrder: 5 },
];

// 公式規定文書
export type CompanyRegulation = {
  id: string;
  facilityId: string;

  // 基本情報
  title: string;
  description?: string;
  categoryCode: string;

  // ファイル情報
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;

  // PDF検索用テキスト
  extractedText?: string;

  // メタデータ
  version?: string;
  effectiveDate?: string;
  revisionDate?: string;

  // 表示設定
  isPublished: boolean;
  displayOrder: number;

  // 監査情報
  uploadedBy?: string;
  uploadedByName?: string;
  viewCount: number;

  // タイムスタンプ
  createdAt: string;
  updatedAt: string;
};

// 変更届通知タイプ
export type ChangeNotificationType =
  | 'business_hours'    // 営業日/営業時間の変更
  | 'manager'           // 管理者の変更
  | 'service_manager'   // 児童発達支援管理責任者の変更
  | 'capacity'          // 定員の変更
  | 'facility_name'     // 事業所名称の変更
  | 'address'           // 事業所所在地の変更
  | 'equipment'         // 設備の変更
  | 'subsidy';          // 加算の追加・変更

// 変更届通知ステータス
export type ChangeNotificationStatus = 'pending' | 'in_progress' | 'submitted' | 'completed';

// 変更届通知
export type ChangeNotification = {
  id: string;
  facilityId: string;
  changeType: ChangeNotificationType;
  changeDescription?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  detectedAt: string;
  deadline: string;
  status: ChangeNotificationStatus;
  submittedAt?: string;
  relatedDocuments?: unknown[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

// 変更届タイプのラベル定義
export const CHANGE_NOTIFICATION_TYPE_LABELS: Record<ChangeNotificationType, string> = {
  business_hours: '営業日/営業時間の変更',
  manager: '管理者の変更',
  service_manager: '児童発達支援管理責任者の変更',
  capacity: '定員の変更',
  facility_name: '事業所名称の変更',
  address: '事業所所在地の変更',
  equipment: '設備の変更',
  subsidy: '加算の追加・変更',
};

// 変更届ステータスのラベル定義
export const CHANGE_NOTIFICATION_STATUS_CONFIG: Record<ChangeNotificationStatus, { label: string; color: string; bg: string }> = {
  pending: { label: '未対応', color: 'text-red-600', bg: 'bg-red-100' },
  in_progress: { label: '作成中', color: 'text-amber-600', bg: 'bg-amber-100' },
  submitted: { label: '提出済', color: 'text-blue-600', bg: 'bg-blue-100' },
  completed: { label: '完了', color: 'text-green-600', bg: 'bg-green-100' },
};

// 月次運営確認レビュー
export type OperationsReview = {
  id: string;
  facilityId: string;
  reviewMonth: string; // '2026-03'
  responses: OperationsReviewResponses;
  changesDetected: OperationsReviewChange[];
  completedAt?: string;
  createdBy?: string;
  createdAt: string;
};

export type OperationsReviewResponses = {
  staff?: {
    hasChange: boolean;
    changeType?: 'increase' | 'decrease';
    count?: number;
    positions?: string[];
  };
  subsidies?: {
    hasChange: boolean;
    additions?: string[];
    removals?: string[];
  };
  businessHours?: {
    hasChange: boolean;
    details?: string;
  };
  capacity?: {
    hasChange: boolean;
    newCapacityAM?: number;
    newCapacityPM?: number;
  };
  other?: {
    hasChange: boolean;
    details?: string;
  };
};

export type OperationsReviewChange = {
  type: ChangeNotificationType;
  description: string;
  deadline: string;
  requiredDocuments: string[];
};

// 規定文書作成/更新用
export type CompanyRegulationInput = {
  title: string;
  description?: string;
  categoryCode: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
  version?: string;
  effectiveDate?: string;
  revisionDate?: string;
  isPublished?: boolean;
  displayOrder?: number;
};

// ========== 労務管理・コンプライアンス関連 ==========

// 36協定（時間外労働協定）
export interface OvertimeAgreement {
  id: string;
  facility_id: string;
  fiscal_year: number;
  monthly_limit_hours: number;
  annual_limit_hours: number;
  special_monthly_limit: number;
  special_months_limit: number;
  effective_from: string;
  effective_to?: string;
  created_at: string;
  updated_at: string;
}

// 規定確認記録
export interface RegulationAcknowledgment {
  id: string;
  regulation_id: string;
  user_id: string;
  facility_id: string;
  acknowledged_at: string;
  created_at: string;
}

// BCP計画
export interface BcpPlan {
  id: string;
  facility_id: string;
  plan_type: string;
  title: string;
  content: Record<string, unknown>;
  version?: string;
  status: string;
  last_reviewed_at?: string;
  next_review_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// BCP緊急連絡先
export interface BcpEmergencyContact {
  id: string;
  facility_id: string;
  bcp_plan_id?: string;
  contact_name: string;
  role?: string;
  phone?: string;
  email?: string;
  priority: number;
  created_at: string;
}

// 虐待防止記録
export interface AbusePreventionRecord {
  id: string;
  facility_id: string;
  record_type: string;
  title: string;
  content: Record<string, unknown>;
  date?: string;
  participants: unknown[];
  status: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// スタッフ資格管理
export interface StaffQualification {
  id: string;
  user_id: string;
  facility_id: string;
  qualification_name: string;
  qualification_code?: string;
  certificate_number?: string;
  issued_date?: string;
  expiry_date?: string;
  certificate_file_url?: string;
  certificate_file_name?: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ==========================================
// 求人・人材紹介
// ==========================================

export type JobType = 'full_time' | 'part_time' | 'spot';
export type JobStatus = 'draft' | 'published' | 'closed' | 'filled';
export type SalaryType = 'monthly' | 'hourly' | 'daily' | 'annual';
export type ApplicationStatus = 'applied' | 'screening' | 'interview_scheduled' | 'interviewed' | 'offer_sent' | 'offer_accepted' | 'hired' | 'rejected' | 'withdrawn';
export type PaymentStatus = 'pending' | 'invoiced' | 'paid' | 'overdue' | 'refunded' | 'cancelled';

export type JobPosting = {
  id: string;
  facilityId: string;
  jobType: JobType;
  title: string;
  description?: string;
  requiredQualifications: string[];
  preferredQualifications: string[];
  experienceYearsMin: number;
  employmentType?: string;
  workLocation?: string;
  workHours?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryType?: SalaryType;
  benefits?: string;
  annualSalaryEstimate?: number;
  spotsNeeded: number;
  status: JobStatus;
  publishedAt?: string;
  closesAt?: string;
  createdAt: string;
  updatedAt: string;
  facilityName?: string;
  facilityAddress?: string;
  imageUrl?: string;
};

export type SpotWorkShift = {
  id: string;
  jobPostingId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded?: string;
  hourlyRate?: number;
  spotsAvailable: number;
  spotsFilled: number;
  status: 'open' | 'filled' | 'cancelled' | 'completed';
  notes?: string;
  createdAt: string;
};

export type JobApplication = {
  id: string;
  jobPostingId: string;
  spotShiftId?: string;
  applicantUserId: string;
  status: ApplicationStatus;
  coverMessage?: string;
  resumeUrl?: string;
  interviewDate?: string;
  interviewNotes?: string;
  interviewFormat?: 'in_person' | 'online' | 'phone';
  interviewLocation?: string;
  interviewMeetingUrl?: string;
  facilityRating?: number;
  facilityNotes?: string;
  hiredAt?: string;
  startDate?: string;
  agreedSalary?: number;
  createdAt: string;
  updatedAt: string;
  applicantName?: string;
  applicantEmail?: string;
  applicantQualifications?: string[];
  jobTitle?: string;
  jobType?: JobType;
  facilityName?: string;
  // 応募者希望条件
  preferredDays?: string;
  preferredHoursPerWeek?: number;
  preferredHourlyRate?: number;
  preferredStartTime?: string;
  preferredEndTime?: string;
  preferredNotes?: string;
};

export type Placement = {
  id: string;
  jobApplicationId: string;
  facilityId: string;
  workerUserId: string;
  jobType: JobType;
  agreedSalary: number;
  feeRate: number;
  feeAmount: number;
  stripeInvoiceId?: string;
  stripePaymentIntentId?: string;
  paymentStatus: PaymentStatus;
  paidAt?: string;
  placementDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  workerName?: string;
  facilityName?: string;
};

export type JobFavorite = {
  id: string;
  userId: string;
  jobPostingId: string;
  createdAt: string;
};

// ==========================================
// 施設タイプ・レビュー・スカウト・面接・通知
// ==========================================

export type FacilityType =
  | 'child_development_support'
  | 'after_school_day'
  | 'severe_disability'
  | 'employment_transition'
  | 'employment_continuation_a'
  | 'employment_continuation_b'
  | 'residential'
  | 'home_care'
  | 'group_home'
  | 'consultation_support';

export type CertificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export type FacilityReview = {
  id: string;
  facilityId: string;
  userId: string;
  jobApplicationId?: string;
  rating: number;
  workLifeBalance?: number;
  staffRelations?: number;
  growthOpportunity?: number;
  management?: number;
  title?: string;
  pros?: string;
  cons?: string;
  isAnonymous: boolean;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
  // joined
  userName?: string;
};

export type ScoutMessage = {
  id: string;
  facilityId: string;
  senderUserId: string;
  targetUserId: string;
  jobPostingId?: string;
  subject: string;
  message: string;
  status: 'sent' | 'read' | 'replied' | 'declined';
  readAt?: string;
  repliedAt?: string;
  createdAt: string;
  // joined
  facilityName?: string;
  jobTitle?: string;
  senderName?: string;
};

export type InterviewSlot = {
  id: string;
  jobApplicationId: string;
  proposedBy: 'facility' | 'applicant';
  proposedDatetime: string;
  durationMinutes: number;
  format: 'in_person' | 'online' | 'phone';
  location?: string;
  meetingUrl?: string;
  status: 'proposed' | 'accepted' | 'declined' | 'cancelled';
  notes?: string;
  createdAt: string;
};

export type AppNotification = {
  id: string;
  userId: string;
  type: 'new_application' | 'application_status' | 'new_message' | 'scout' | 'interview_proposed' | 'interview_confirmed' | 'new_review' | 'job_match';
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
};

export type NotificationPreferences = {
  id: string;
  userId: string;
  emailNewApplication: boolean;
  emailNewMessage: boolean;
  emailStatusChange: boolean;
  emailScout: boolean;
  emailJobMatch: boolean;
  pushEnabled: boolean;
  pushNewApplication: boolean;
  pushNewMessage: boolean;
  pushStatusChange: boolean;
  pushScout: boolean;
  pushJobMatch: boolean;
  createdAt: string;
  updatedAt: string;
};

// キャッシュフロー管理
export interface CashflowEntry {
  id: string;
  facilityId: string;
  yearMonth: string;
  category: 'income' | 'expense';
  subcategory: string;
  itemName: string;
  amount: number;
  sortOrder: number;
  notes?: string;
  isTemplateItem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CashflowBalance {
  id: string;
  facilityId: string;
  yearMonth: string;
  openingBalance: number;
}

export interface PLStatement {
  yearMonth: string;
  income: {
    benefits: number;       // 介護給付費収入
    copay: number;          // 利用者負担金
    additions: number;      // 加算収入
    subsidy: number;        // 補助金・助成金
    other: number;          // その他収入
    total: number;
  };
  expenses: {
    personnel: {
      salary: number;       // 給与・賞与
      socialInsurance: number; // 法定福利費
      welfare: number;      // 福利厚生費
      commuting: number;    // 通勤手当
      total: number;
    };
    operations: {
      meals: number;        // 給食費
      materials: number;    // 教材費
      utilities: number;    // 水道光熱費
      rent: number;         // 賃借料
      insurance: number;    // 保険料
      vehicle: number;      // 車両関連費
      total: number;
    };
    admin: {
      communication: number; // 通信費
      supplies: number;      // 消耗品費
      repairs: number;       // 修繕費
      outsourcing: number;   // 業務委託費
      depreciation: number;  // 減価償却費
      total: number;
    };
    other: {
      loanRepayment: number; // 借入金返済
      capex: number;         // 設備投資
      misc: number;          // その他
      total: number;
    };
    total: number;
  };
  netIncome: number;
}

// 自己評価の種別
export type SelfEvaluationType = 'self' | 'parent_survey';

// 自己評価のステータス
export type SelfEvaluationStatus = 'draft' | 'in_progress' | 'completed' | 'published';

// 自己評価データ
export type SelfEvaluation = {
  id: string;
  facilityId: string;
  fiscalYear: string; // e.g. "2025"
  evaluationType: SelfEvaluationType;
  status: SelfEvaluationStatus;
  responses: Record<string, any>;
  summary?: string;
  improvementPlan?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

// ==========================================
// 国保連請求（Billing）
// ==========================================

// 請求ステータス
export type BillingStatus = 'draft' | 'confirmed' | 'submitted' | 'paid';

// 月次請求レコード
export type BillingRecord = {
  id: string;
  facilityId: string;
  childId: string;
  yearMonth: string; // YYYY-MM
  serviceType: string; // 児童発達支援 / 放課後等デイサービス
  totalUnits: number;
  unitPrice: number;
  totalAmount: number;
  copayAmount: number;       // 利用者負担額
  insuranceAmount: number;   // 給付費（保険請求額）
  upperLimitAmount: number;  // 上限月額
  status: BillingStatus;
  submittedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // JOINで取得
  childName?: string;
};

// 請求明細（日別）
export type BillingDetail = {
  id: string;
  billingRecordId: string;
  serviceDate: string; // YYYY-MM-DD
  serviceCode?: string;
  unitCount: number;
  isAbsence: boolean;
  absenceType?: string;
  additions: BillingAddition[];
  createdAt: string;
};

// 加算項目
export type BillingAddition = {
  code: string;
  name: string;
  units: number;
};

// サービスコードマスタ
export type ServiceCode = {
  id: string;
  code: string;
  name: string;
  category: string;
  baseUnits: number;
  description?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  createdAt: string;
};

// ─── プラットフォーム管理 型定義 ───

// 法人（拡張）
export type CompanyExtended = {
  id: string;
  name: string;
  companyType: 'corporation' | 'npo' | 'individual' | 'independent';
  franchiseBrand?: string;
  contactPersonName?: string;
  contactPersonEmail?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  contractAmount?: number;
  contractTier: 'basic' | 'standard' | 'premium';
  monthlyFee?: number;
  contractStatus: 'negotiating' | 'active' | 'suspended' | 'terminated';
  address?: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // 集計値（JOINで取得）
  facilityCount?: number;
  totalRevenue?: number;
  totalStaff?: number;
  totalChildren?: number;
};

// プラットフォーム統計
export type PlatformStats = {
  totalCompanies: number;
  totalFacilities: number;
  totalStaff: number;
  totalChildren: number;
  totalMonthlyRevenue: number;
  averageUtilizationRate: number;
  // 前月比
  companyGrowth: number;
  facilityGrowth: number;
  staffGrowth: number;
  childrenGrowth: number;
  revenueGrowth: number;
};

// 施設サマリー（一覧用）
export type FacilitySummary = {
  id: string;
  name: string;
  code: string;
  companyId?: string;
  companyName?: string;
  franchiseOrIndependent?: string;
  prefectureCode?: string;
  cityCode?: string;
  preRegistered: boolean;
  verificationStatus?: string;
  certificationStatus?: string;
  averageRating?: number;
  reviewCount?: number;
  platformNotes?: string;
  capacityTotal?: number;
  serviceCategory?: string;
  createdAt: string;
  // 集計値
  staffCount: number;
  childrenCount: number;
  monthlyRevenue: number;
  utilizationRate: number;
  additionCount: number;
};

// 施設ディープビュー
export type FacilityDeepView = {
  facility: FacilitySummary;
  // 売上
  billingRecords: {
    childName: string;
    serviceType: string;
    totalUnits: number;
    totalAmount: number;
    copayAmount: number;
    insuranceAmount: number;
    status: string;
  }[];
  revenueBreakdown: {
    baseRevenue: number;
    additionRevenue: number;
    totalRevenue: number;
    copayTotal: number;
  };
  // スタッフ
  staffList: {
    id: string;
    name: string;
    role: string;
    employmentType: string;
    qualifications: string[];
    startDate: string;
  }[];
  staffComposition: {
    fulltime: number;
    parttime: number;
    qualified: number;
    total: number;
    fte: number; // 常勤換算
  };
  // 児童
  childrenList: {
    id: string;
    name: string;
    contractStatus: string;
    grantDays?: number;
    usageDaysThisMonth: number;
  }[];
  // 加算
  activeAdditions: {
    code: string;
    name: string;
    units: number;
    isActive: boolean;
  }[];
  additionOpportunities: {
    name: string;
    estimatedRevenue: number;
    gapDescription: string;
  }[];
  // 利用率
  utilizationDetails: {
    totalCapacityDays: number;
    actualUsageDays: number;
    rate: number;
  };
};

// ベンチマークデータ
export type BenchmarkMetric = {
  metricName: string;
  metricLabel: string;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  meanValue: number;
  stdDev: number;
  sampleSize: number;
};

// 施設ベンチマーク結果
export type FacilityBenchmark = {
  facilityId: string;
  facilityName: string;
  companyName?: string;
  value: number;
  percentile: number;
  deviationScore: number; // 偏差値
  rank: number;
};

// 戦略インサイト
export type StrategicInsight = {
  id: string;
  facilityId: string;
  facilityName: string;
  companyName?: string;
  type: 'addition_opportunity' | 'growth_potential' | 'risk_alert';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  estimatedImpact?: number; // 推定インパクト（円/月）
  metadata?: Record<string, unknown>;
};

// ベンチマーク指標キー
export type BenchmarkMetricKey =
  | 'revenue_per_child'
  | 'staff_child_ratio'
  | 'utilization_rate'
  | 'addition_count'
  | 'profit_margin'
  | 'staff_retention'
  | 'average_rating';

