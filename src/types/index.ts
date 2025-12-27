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
  role: '保育士' | '児童指導員' | '指導員' | '管理者';
  type: '常勤' | '非常勤';
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

