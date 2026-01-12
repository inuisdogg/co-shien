/**
 * --- Type Definitions ---
 * マルチテナント対応の型定義
 */

// 施設（テナント）データ
export type Facility = {
  id: string;
  name: string;
  code: string; // 施設コード
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

// 権限設定（マネージャーとスタッフ用）
export type UserPermissions = {
  dashboard?: boolean;
  management?: boolean;
  lead?: boolean;
  schedule?: boolean;
  children?: boolean;
  staff?: boolean;
  facility?: boolean;
};

// アカウントステータス
export type AccountStatus = 'pending' | 'active' | 'suspended';

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

