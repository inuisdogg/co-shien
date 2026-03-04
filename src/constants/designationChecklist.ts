/**
 * 指定申請書類チェックリスト定数
 * 東京都しおり準拠 — 24種類の書類定義
 */

export type DesignationDocument = {
  number: number;
  name: string;
  description: string;
  linkedFeature?: string;    // Roots内の遷移先タブ/画面名
  linkedTab?: string;        // FacilitySettingsView内のタブID
  uploadable: boolean;       // 直接ファイルアップロード可能か
  managedByRoots: boolean;   // Rootsの既存機能で管理済みか
};

export const DESIGNATION_DOCUMENTS: DesignationDocument[] = [
  {
    number: 1,
    name: '指定申請書',
    description: '事業者の基本情報（法人名、所在地、代表者等）を記載した申請書',
    linkedFeature: '施設設定 > 基本情報',
    linkedTab: 'basic',
    uploadable: true,
    managedByRoots: true,
  },
  {
    number: 2,
    name: '付表（事業所の概要）',
    description: '営業時間、定員、管理者、サービス提供時間等の事業所概要',
    linkedFeature: '施設設定 > 営業・休日',
    linkedTab: 'operation',
    uploadable: true,
    managedByRoots: true,
  },
  {
    number: 3,
    name: '給付費算定に係る届出書',
    description: '各種加算の算定要件を満たしていることを届け出る書類',
    linkedFeature: '加算設定',
    uploadable: true,
    managedByRoots: true,
  },
  {
    number: 4,
    name: '体制等状況一覧表',
    description: '事業所の人員配置・設備等の体制状況を記載した一覧',
    linkedFeature: '施設設定 > 基本情報',
    linkedTab: 'basic',
    uploadable: true,
    managedByRoots: true,
  },
  {
    number: 5,
    name: '各種加算に係る届出書',
    description: '個別の加算ごとの届出書類',
    linkedFeature: '加算設定',
    uploadable: true,
    managedByRoots: true,
  },
  {
    number: 6,
    name: '社会保険・労働保険の加入状況',
    description: '健康保険・厚生年金・雇用保険・労災保険の加入状況を証明する書類',
    linkedFeature: '施設設定 > 指定情報 > 補足情報',
    linkedTab: 'designation',
    uploadable: true,
    managedByRoots: false,
  },
  {
    number: 7,
    name: '登記事項証明書（法人）',
    description: '法人の登記事項証明書（履歴事項全部証明書）',
    uploadable: true,
    managedByRoots: false,
  },
  {
    number: 8,
    name: '賃貸借契約書・平面図・写真',
    description: '事業所の賃貸借契約書、平面図（間取り図）、内外写真',
    linkedFeature: '施設設定 > 基本情報 > 写真管理',
    linkedTab: 'basic',
    uploadable: true,
    managedByRoots: true,
  },
  {
    number: 9,
    name: '備品一覧表',
    description: '事業所に備える設備・備品の一覧表',
    uploadable: true,
    managedByRoots: false,
  },
  {
    number: 10,
    name: '管理者の経歴書',
    description: '管理者の職務経歴・資格等を記載した経歴書',
    linkedFeature: 'スタッフ管理 > 職歴',
    uploadable: true,
    managedByRoots: true,
  },
  {
    number: 11,
    name: '児童発達支援管理責任者の経歴書',
    description: '児発管の職務経歴・資格等を記載した経歴書',
    linkedFeature: 'スタッフ管理 > 職歴',
    uploadable: true,
    managedByRoots: true,
  },
  {
    number: 12,
    name: '児発管 研修修了証・資格証',
    description: '児童発達支援管理責任者研修の修了証明書および関連資格証',
    linkedFeature: 'スタッフ管理 > 資格',
    uploadable: true,
    managedByRoots: true,
  },
  {
    number: 13,
    name: '児発管 実務経験証明書',
    description: '児発管の実務経験年数を証明する書類',
    linkedFeature: 'スタッフ管理 > 職歴',
    uploadable: true,
    managedByRoots: true,
  },
  {
    number: 14,
    name: '勤務体制一覧表',
    description: '従業者の勤務体制（シフト）の一覧表',
    linkedFeature: 'シフト管理',
    uploadable: true,
    managedByRoots: true,
  },
  {
    number: 15,
    name: '保育士等の資格証',
    description: '保育士・児童指導員等の資格証明書',
    linkedFeature: 'スタッフ管理 > 資格',
    uploadable: true,
    managedByRoots: true,
  },
  {
    number: 16,
    name: '運営規程',
    description: '事業所の運営に関する規程（利用定員、営業日、利用料等）',
    linkedFeature: '法人設定 > 規程管理',
    uploadable: true,
    managedByRoots: true,
  },
  {
    number: 17,
    name: '苦情解決の概要',
    description: '苦情受付体制（担当者、受付方法、外部相談窓口等）の概要',
    linkedFeature: '施設設定 > 指定情報 > 補足情報',
    linkedTab: 'designation',
    uploadable: true,
    managedByRoots: false,
  },
  {
    number: 18,
    name: '協力医療機関との契約内容',
    description: '協力医療機関との協力協定書・契約書',
    linkedFeature: '施設設定 > 指定情報 > 協力医療機関',
    linkedTab: 'designation',
    uploadable: true,
    managedByRoots: false,
  },
  {
    number: 19,
    name: '就業規則',
    description: '従業者の就業規則',
    linkedFeature: '法人設定 > 規程管理',
    uploadable: true,
    managedByRoots: true,
  },
  {
    number: 20,
    name: '誓約書',
    description: '欠格事由に該当しない旨の誓約書',
    uploadable: true,
    managedByRoots: false,
  },
  {
    number: 21,
    name: '事業開始届',
    description: '障害児通所支援事業の開始届',
    uploadable: true,
    managedByRoots: false,
  },
  {
    number: 22,
    name: '事業計画書',
    description: '事業の運営方針、サービス内容、人員計画等を記載した計画書',
    uploadable: true,
    managedByRoots: false,
  },
  {
    number: 23,
    name: '収支予算書',
    description: '事業開始後の収支見込みを記載した予算書',
    linkedFeature: '売上管理',
    uploadable: true,
    managedByRoots: false,
  },
  {
    number: 24,
    name: '耐震化についての報告',
    description: '事業所建物の耐震性に関する報告書（建築年、耐震診断結果等）',
    linkedFeature: '施設設定 > 指定情報 > 補足情報',
    linkedTab: 'designation',
    uploadable: true,
    managedByRoots: false,
  },
];

/** ステータスラベルと色の定義 */
export const CHECKLIST_STATUS_CONFIG = {
  not_started: { label: '未着手', color: 'bg-gray-100 text-gray-600' },
  in_progress: { label: '作成中', color: 'bg-blue-100 text-blue-700' },
  uploaded:    { label: 'アップロード済', color: 'bg-orange-100 text-orange-700' },
  verified:    { label: '確認済', color: 'bg-green-100 text-green-700' },
} as const;

export type ChecklistStatus = keyof typeof CHECKLIST_STATUS_CONFIG;
