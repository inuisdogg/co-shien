/**
 * 書類タイプ設定
 * 38種の運営指導必要書類の更新サイクルを定義
 */

// 更新サイクルタイプ
export type UpdateCycleType =
  | 'static'    // 初回のみ（変更時更新）
  | 'event'     // イベント発生時（入社時、契約時など）
  | 'daily'     // 毎日
  | 'monthly'   // 毎月
  | 'quarterly' // 四半期
  | 'biannual'  // 半年
  | 'yearly'    // 年1回
  | 'biennial'  // 年2回
  | 'custom';   // カスタム間隔

// 書類タイプ設定
export type DocumentTypeConfig = {
  id: string;                          // 書類ID
  documentType: string;                // DBのdocument_type値
  displayName: string;                 // 表示名
  category: string;                    // カテゴリ
  updateCycleType: UpdateCycleType;    // 更新サイクル
  updateIntervalDays?: number;         // 更新間隔（日数）
  updateMonths?: number[];             // 更新月（4月=4, 1月=1など）
  triggerEntity?: 'staff' | 'child';   // イベント駆動の場合のエンティティ
  triggerDescription?: string;         // イベント説明
  entityType: 'facility' | 'staff' | 'child'; // 書類の対象
  alertDaysWarning: number;            // 警告アラート（30日前）
  alertDaysUrgent: number;             // 緊急アラート（7日前）
};

// 38種の書類設定
export const DOCUMENT_TYPE_CONFIGS: DocumentTypeConfig[] = [
  // ============================================
  // 【事前提出書類】4件
  // ============================================
  {
    id: 'pre_1',
    documentType: 'self_inspection',
    displayName: '自己点検表',
    category: '事前提出書類',
    updateCycleType: 'yearly',
    updateMonths: [3], // 3月
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'pre_2',
    documentType: 'staff_schedule',
    displayName: '勤務体制一覧表',
    category: '事前提出書類',
    updateCycleType: 'monthly',
    updateIntervalDays: 30,
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'pre_3',
    documentType: 'addition_checklist',
    displayName: '加算算定点検表',
    category: '事前提出書類',
    updateCycleType: 'yearly',
    updateMonths: [3], // 3月
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'pre_4',
    documentType: 'user_list',
    displayName: '利用者一覧表',
    category: '事前提出書類',
    updateCycleType: 'monthly',
    updateIntervalDays: 30,
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },

  // ============================================
  // 【従業員関係】9件
  // ============================================
  {
    id: 'emp_1',
    documentType: 'employment_contract',
    displayName: '雇用契約書・辞令',
    category: '従業員関係',
    updateCycleType: 'event',
    triggerEntity: 'staff',
    triggerDescription: '入社時に作成',
    entityType: 'staff',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'emp_2',
    documentType: 'resume',
    displayName: '履歴書',
    category: '従業員関係',
    updateCycleType: 'event',
    triggerEntity: 'staff',
    triggerDescription: '入社時に提出',
    entityType: 'staff',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'emp_3',
    documentType: 'worker_roster',
    displayName: '労働者名簿',
    category: '従業員関係',
    updateCycleType: 'static',
    triggerDescription: '変更時更新',
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'emp_4',
    documentType: 'wage_document',
    displayName: '賃金関係書類',
    category: '従業員関係',
    updateCycleType: 'monthly',
    updateIntervalDays: 30,
    entityType: 'staff',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'emp_5',
    documentType: 'confidentiality_agreement',
    displayName: '守秘義務・機密保持誓約書',
    category: '従業員関係',
    updateCycleType: 'event',
    triggerEntity: 'staff',
    triggerDescription: '入社時に提出',
    entityType: 'staff',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'emp_6',
    documentType: 'health_checkup',
    displayName: '健康診断書',
    category: '従業員関係',
    updateCycleType: 'yearly',
    updateMonths: [4], // 4月
    entityType: 'staff',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'emp_7',
    documentType: 'work_schedule',
    displayName: '勤務形態一覧表',
    category: '従業員関係',
    updateCycleType: 'monthly',
    updateIntervalDays: 30,
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'emp_8',
    documentType: 'attendance_record',
    displayName: '出勤簿・タイムカード',
    category: '従業員関係',
    updateCycleType: 'monthly',
    updateIntervalDays: 30,
    entityType: 'staff',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'emp_9',
    documentType: 'qualification_cert',
    displayName: '資格証明書',
    category: '従業員関係',
    updateCycleType: 'event',
    triggerEntity: 'staff',
    triggerDescription: '入社時・取得時に提出',
    entityType: 'staff',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },

  // ============================================
  // 【運営関係】12件
  // ============================================
  {
    id: 'ops_1',
    documentType: 'designation_application',
    displayName: '指定申請関係書類',
    category: '運営関係',
    updateCycleType: 'static',
    triggerDescription: '変更時更新',
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'ops_2',
    documentType: 'floor_plan',
    displayName: '平面図',
    category: '運営関係',
    updateCycleType: 'static',
    triggerDescription: '変更時更新',
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'ops_3',
    documentType: 'equipment_ledger',
    displayName: '設備・備品台帳',
    category: '運営関係',
    updateCycleType: 'static',
    triggerDescription: '随時更新',
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'ops_4',
    documentType: 'addition_notification',
    displayName: '加算届出',
    category: '運営関係',
    updateCycleType: 'yearly',
    updateMonths: [3], // 3月
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'ops_5',
    documentType: 'operation_regulation',
    displayName: '運営規定',
    category: '運営関係',
    updateCycleType: 'static',
    triggerDescription: '変更時更新',
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'ops_6',
    documentType: 'important_explanation',
    displayName: '重要事項説明書',
    category: '運営関係',
    updateCycleType: 'static',
    triggerDescription: '変更時更新',
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'ops_7',
    documentType: 'service_contract',
    displayName: 'サービス利用契約書',
    category: '運営関係',
    updateCycleType: 'event',
    triggerEntity: 'child',
    triggerDescription: '利用開始時に締結',
    entityType: 'child',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'ops_8',
    documentType: 'addition_requirement',
    displayName: '加算算定要件書類',
    category: '運営関係',
    updateCycleType: 'yearly',
    updateMonths: [3], // 3月
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'ops_9',
    documentType: 'employment_regulation',
    displayName: '就業規則・給与規則',
    category: '運営関係',
    updateCycleType: 'static',
    triggerDescription: '変更時更新',
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'ops_10',
    documentType: 'committee_minutes',
    displayName: '委員会議事録',
    category: '運営関係',
    updateCycleType: 'quarterly',
    updateMonths: [4, 7, 10, 1], // 4月, 7月, 10月, 1月
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'ops_11',
    documentType: 'liability_insurance',
    displayName: '賠償責任保険証券',
    category: '運営関係',
    updateCycleType: 'yearly',
    updateMonths: [4], // 4月
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'ops_12',
    documentType: 'business_management',
    displayName: '業務管理体制届',
    category: '運営関係',
    updateCycleType: 'static',
    triggerDescription: '変更時更新',
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },

  // ============================================
  // 【記録関係】8件
  // ============================================
  {
    id: 'rec_1',
    documentType: 'billing_document',
    displayName: '国保連請求関係書類',
    category: '記録関係',
    updateCycleType: 'monthly',
    updateIntervalDays: 30,
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'rec_2',
    documentType: 'receipt',
    displayName: '領収書',
    category: '記録関係',
    updateCycleType: 'monthly',
    updateIntervalDays: 30,
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'rec_3',
    documentType: 'community_activity',
    displayName: '地域交流記録',
    category: '記録関係',
    updateCycleType: 'event',
    triggerDescription: '活動実施ごとに記録',
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'rec_4',
    documentType: 'incident_report',
    displayName: '苦情・事故・ヒヤリハット記録',
    category: '記録関係',
    updateCycleType: 'event',
    triggerDescription: '発生時に記録',
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'rec_5',
    documentType: 'training_record',
    displayName: '職員研修記録',
    category: '記録関係',
    updateCycleType: 'event',
    triggerDescription: '研修実施ごとに記録',
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'rec_6',
    documentType: 'restraint_record',
    displayName: '身体拘束・虐待記録',
    category: '記録関係',
    updateCycleType: 'event',
    triggerDescription: '発生時に記録',
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'rec_7',
    documentType: 'evacuation_drill',
    displayName: '消防計画・避難訓練記録',
    category: '記録関係',
    updateCycleType: 'biennial',
    updateMonths: [6, 12], // 6月, 12月
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'rec_8',
    documentType: 'accounting_document',
    displayName: '会計関係書類',
    category: '記録関係',
    updateCycleType: 'yearly',
    updateMonths: [3], // 3月
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },

  // ============================================
  // 【利用者支援関連】5件
  // ============================================
  {
    id: 'usr_1',
    documentType: 'privacy_consent',
    displayName: '個人情報取扱同意書',
    category: '利用者支援関連',
    updateCycleType: 'event',
    triggerEntity: 'child',
    triggerDescription: '利用開始時に取得',
    entityType: 'child',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'usr_2',
    documentType: 'support_plan',
    displayName: '個別支援計画書',
    category: '利用者支援関連',
    updateCycleType: 'biannual',
    updateMonths: [4, 10], // 4月, 10月
    updateIntervalDays: 180,
    entityType: 'child',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'usr_3',
    documentType: 'admission_record',
    displayName: '入退所記録',
    category: '利用者支援関連',
    updateCycleType: 'event',
    triggerEntity: 'child',
    triggerDescription: '入退所時に記録',
    entityType: 'child',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'usr_4',
    documentType: 'user_count',
    displayName: '利用者・入所者数書類',
    category: '利用者支援関連',
    updateCycleType: 'monthly',
    updateIntervalDays: 30,
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'usr_5',
    documentType: 'daily_record',
    displayName: '実施記録・業務日誌',
    category: '利用者支援関連',
    updateCycleType: 'daily',
    updateIntervalDays: 1,
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },

  // ============================================
  // 【その他】3件
  // ============================================
  {
    id: 'oth_1',
    documentType: 'medication_ledger',
    displayName: '医薬品台帳',
    category: 'その他',
    updateCycleType: 'static',
    triggerDescription: '随時更新',
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'oth_2',
    documentType: 'hygiene_record',
    displayName: '衛生管理記録',
    category: 'その他',
    updateCycleType: 'daily',
    updateIntervalDays: 1,
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
  {
    id: 'oth_3',
    documentType: 'meal_record',
    displayName: '食事提供記録',
    category: 'その他',
    updateCycleType: 'daily',
    updateIntervalDays: 1,
    entityType: 'facility',
    alertDaysWarning: 30,
    alertDaysUrgent: 7,
  },
];

// カテゴリ一覧
export const DOCUMENT_CATEGORIES = [
  { id: 'pre', name: '事前提出書類', color: 'bg-blue-500' },
  { id: 'emp', name: '従業員関係', color: 'bg-green-500' },
  { id: 'ops', name: '運営関係', color: 'bg-purple-500' },
  { id: 'rec', name: '記録関係', color: 'bg-orange-500' },
  { id: 'usr', name: '利用者支援関連', color: 'bg-pink-500' },
  { id: 'oth', name: 'その他', color: 'bg-gray-500' },
];

// 更新サイクルラベル
export const UPDATE_CYCLE_LABELS: Record<UpdateCycleType, string> = {
  static: '初回',
  event: '随時',
  daily: '毎日',
  monthly: '毎月',
  quarterly: '四半期',
  biannual: '6ヶ月',
  yearly: '年1回',
  biennial: '年2回',
  custom: 'カスタム',
};

// カテゴリ別に書類を取得
export const getDocumentsByCategory = (category: string): DocumentTypeConfig[] => {
  return DOCUMENT_TYPE_CONFIGS.filter(config => config.category === category);
};

// 更新サイクル別に書類を取得
export const getDocumentsByUpdateCycle = (cycleType: UpdateCycleType): DocumentTypeConfig[] => {
  return DOCUMENT_TYPE_CONFIGS.filter(config => config.updateCycleType === cycleType);
};

// 書類IDから設定を取得
export const getDocumentConfigById = (id: string): DocumentTypeConfig | undefined => {
  return DOCUMENT_TYPE_CONFIGS.find(config => config.id === id);
};

// 書類タイプから設定を取得
export const getDocumentConfigByType = (documentType: string): DocumentTypeConfig | undefined => {
  return DOCUMENT_TYPE_CONFIGS.find(config => config.documentType === documentType);
};
