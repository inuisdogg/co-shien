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

// 期間ごとの営業時間設定
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
  // 営業時間
  businessHours: {
    AM: { start: string; end: string }; // 例: { start: '09:00', end: '12:00' }
    PM: { start: string; end: string }; // 例: { start: '13:00', end: '18:00' }
  };
  businessHoursPeriods?: BusinessHoursPeriod[]; // 期間ごとの営業時間設定
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
  createdAt: string;
  updatedAt: string;
};

// ユーザー種別（スタッフ/利用者の区別）
export type UserType = 'staff' | 'client';

// ユーザーロール
export type UserRole = 'admin' | 'manager' | 'staff' | 'client';

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

  // 設定
  facility?: boolean;         // 施設情報
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
  '設定': ['facility'] as PermissionKey[],
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
  facility: '施設情報',
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
  | 'contract'           // 契約書
  | 'assessment'         // アセスメントシート
  | 'support_plan'       // 個別支援計画書
  | 'beneficiary_cert'   // 受給者証
  | 'medical_cert'       // 診断書・医療証明
  | 'insurance_card'     // 保険証
  | 'emergency_contact'  // 緊急連絡先
  | 'photo_consent'      // 写真掲載同意書
  | 'other';             // その他

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
  beneficiary_cert: '受給者証',
  medical_cert: '診断書・医療証明',
  insurance_card: '保険証',
  emergency_contact: '緊急連絡先',
  photo_consent: '写真掲載同意書',
  other: 'その他',
};

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
  nameKana?: string; // フリガナ
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
  emergencyContact?: string; // 緊急連絡先
  emergencyContactPhone?: string; // 緊急連絡先電話番号
  memo?: string; // 備考
  // 給与
  monthlySalary?: number; // 月給（常勤の場合）
  hourlyWage?: number; // 時給（非常勤の場合）
  // 基本シフトパターン（週の曜日ごとのシフト有無、月～土の6日分）
  defaultShiftPattern?: boolean[]; // [月, 火, 水, 木, 金, 土]の順（true=シフトあり、false=シフトなし）
  createdAt: string;
  updatedAt: string;
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

// 業務ツールID
export type WorkToolId =
  | 'time_tracking'      // 打刻（勤怠）
  | 'daily_report'       // 日報作成
  | 'expense'            // 経費精算
  | 'document_output'    // 書類出力
  | 'attendance_calendar'// 勤怠カレンダー
  | 'shift_view'         // シフト確認
  | 'training_record'    // 研修記録
  | 'announcements'      // お知らせ
  | 'task_management';   // タスク管理

// 業務ツール定義
export type WorkToolDefinition = {
  id: WorkToolId;
  name: string;
  icon: string; // Lucide icon name
  description: string;
};

// 業務ツール一覧
export const WORK_TOOLS: WorkToolDefinition[] = [
  { id: 'time_tracking', name: '打刻（勤怠）', icon: 'Clock', description: '始業・終業・休憩の打刻' },
  { id: 'daily_report', name: '日報作成', icon: 'FileText', description: '日報の作成・提出' },
  { id: 'expense', name: '経費精算', icon: 'Receipt', description: '経費の申請・管理' },
  { id: 'document_output', name: '書類出力', icon: 'FileOutput', description: '各種書類の出力' },
  { id: 'attendance_calendar', name: '勤怠カレンダー', icon: 'Calendar', description: '勤怠状況の確認' },
  { id: 'shift_view', name: 'シフト確認', icon: 'CalendarDays', description: 'シフト表の確認' },
  { id: 'training_record', name: '研修記録', icon: 'GraduationCap', description: '研修履歴の管理' },
  { id: 'announcements', name: 'お知らせ', icon: 'Bell', description: '施設からのお知らせ' },
  { id: 'task_management', name: 'タスク管理', icon: 'CheckSquare', description: 'タスクの管理' },
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

