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

// 施設情報設定
export type FacilitySettings = {
  id: string;
  facilityId: string; // 施設ID（マルチテナント対応）
  // 営業日設定
  regularHolidays: number[]; // 定休日（0=日, 1=月, ..., 6=土）
  customHolidays: string[]; // カスタム休業日（YYYY-MM-DD形式の配列）
  // 営業時間
  businessHours: {
    AM: { start: string; end: string }; // 例: { start: '09:00', end: '12:00' }
    PM: { start: string; end: string }; // 例: { start: '13:00', end: '18:00' }
  };
  // 受け入れ人数
  capacity: {
    AM: number; // 午前の定員
    PM: number; // 午後の定員
  };
  createdAt: string;
  updatedAt: string;
};

// ユーザーロール
export type UserRole = 'admin' | 'staff';

// ユーザーデータ（認証・認可用）
export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  facilityId: string; // 所属施設ID
  createdAt: string;
  updatedAt: string;
};

// 契約ステータス
export type ContractStatus = 'pre-contract' | 'active' | 'inactive' | 'terminated';

// 児童データ
export type Child = {
  id: string;
  facilityId: string; // 施設ID（マルチテナント対応）
  // 基本情報
  name: string; // 児童名
  age?: number; // 年齢
  // 保護者情報
  guardianName?: string; // 保護者名
  guardianRelationship?: string; // 続柄（例: 母、父、祖母）
  // 受給者証情報
  beneficiaryNumber?: string; // 受給者証番号
  grantDays?: number; // 支給日数
  contractDays?: number; // 契約日数
  // 連絡先
  address?: string; // 住所
  phone?: string; // 電話番号
  email?: string; // メールアドレス
  // 医療情報
  doctorName?: string; // かかりつけ医名
  doctorClinic?: string; // 医療機関名
  // 通園情報
  schoolName?: string; // 通園場所名（学校・幼稚園等）
  // 利用パターン
  pattern?: string; // 基本利用パターン (例: "月・水・金")
  needsPickup: boolean; // お迎え有無
  needsDropoff: boolean; // お送り有無
  pickupLocation?: string; // 乗車地（自由入力）
  dropoffLocation?: string; // 降車地（自由入力）
  // 契約ステータス
  contractStatus: ContractStatus; // 契約ステータス
  contractStartDate?: string; // 契約開始日
  contractEndDate?: string; // 契約終了日
  // メタデータ
  createdAt: string;
  updatedAt: string;
};

// 児童登録フォームデータ（下書き保存用）
export type ChildFormData = Omit<Child, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>;

// スタッフデータ
export type Staff = {
  id: string;
  facilityId: string; // 施設ID（マルチテナント対応）
  name: string;
  nameKana?: string; // フリガナ
  role: '一般スタッフ' | 'マネージャー';
  type: '常勤' | '非常勤';
  // 基本情報
  birthDate?: string; // 生年月日 (YYYY-MM-DD)
  gender?: '男性' | '女性' | 'その他';
  address?: string; // 住所
  phone?: string; // 電話番号
  email?: string; // メールアドレス
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
  createdAt: string;
  updatedAt: string;
};

// スケジュールデータ（利用実績・予定）
export type TimeSlot = 'AM' | 'PM';

export type ScheduleItem = {
  id: number;
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
  id: number;
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
  scheduleId: number; // スケジュールIDへの参照
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

