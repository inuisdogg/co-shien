/**
 * 経費カテゴリ定義
 */

// デフォルトカテゴリID
export const DEFAULT_CATEGORY_IDS = {
  TRANSPORT: 'cat-transport',
  SUPPLIES: 'cat-supplies',
  FOOD: 'cat-food',
  TELECOM: 'cat-telecom',
  UTILITIES: 'cat-utilities',
  REPAIR: 'cat-repair',
  TRAINING: 'cat-training',
  OTHER: 'cat-other',
} as const;

// カテゴリ情報
export type ExpenseCategoryInfo = {
  id: string;
  name: string;
  keywords: string[];
  icon: string;
  color: string;
  tailwindBg: string;
  tailwindText: string;
};

// デフォルトカテゴリ一覧
export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategoryInfo[] = [
  {
    id: DEFAULT_CATEGORY_IDS.TRANSPORT,
    name: '交通費',
    keywords: ['交通', '電車', 'バス', 'タクシー', 'ガソリン', '駐車', '高速', '切符', 'Suica', 'PASMO', 'ICOCA'],
    icon: 'Car',
    color: 'blue',
    tailwindBg: 'bg-blue-100',
    tailwindText: 'text-blue-700',
  },
  {
    id: DEFAULT_CATEGORY_IDS.SUPPLIES,
    name: '消耗品費',
    keywords: ['文房具', 'コピー', '用紙', '教材', '消毒', '衛生', 'マスク', 'ボールペン', 'ノート', 'ファイル', '事務用品', 'クレヨン', '画用紙'],
    icon: 'Package',
    color: 'green',
    tailwindBg: 'bg-green-100',
    tailwindText: 'text-green-700',
  },
  {
    id: DEFAULT_CATEGORY_IDS.FOOD,
    name: '食費',
    keywords: ['食事', '弁当', 'おやつ', '飲料', '給食', '昼食', '夕食', 'ジュース', 'お菓子', '食材'],
    icon: 'Utensils',
    color: 'orange',
    tailwindBg: 'bg-orange-100',
    tailwindText: 'text-orange-700',
  },
  {
    id: DEFAULT_CATEGORY_IDS.TELECOM,
    name: '通信費',
    keywords: ['電話', '通信', 'Wi-Fi', 'インターネット', '携帯', 'スマホ', 'SIM', 'プロバイダ'],
    icon: 'Phone',
    color: 'purple',
    tailwindBg: 'bg-purple-100',
    tailwindText: 'text-purple-700',
  },
  {
    id: DEFAULT_CATEGORY_IDS.UTILITIES,
    name: '水道光熱費',
    keywords: ['電気', 'ガス', '水道', '光熱', '暖房', '冷房', 'エアコン'],
    icon: 'Zap',
    color: 'yellow',
    tailwindBg: 'bg-yellow-100',
    tailwindText: 'text-yellow-700',
  },
  {
    id: DEFAULT_CATEGORY_IDS.REPAIR,
    name: '修繕費',
    keywords: ['修理', '修繕', 'メンテナンス', '補修', '工事', '点検'],
    icon: 'Wrench',
    color: 'red',
    tailwindBg: 'bg-red-100',
    tailwindText: 'text-red-700',
  },
  {
    id: DEFAULT_CATEGORY_IDS.TRAINING,
    name: '研修費',
    keywords: ['研修', '資格', 'セミナー', '講習', '受講', '勉強会', '学会', '書籍', '参考書'],
    icon: 'GraduationCap',
    color: 'indigo',
    tailwindBg: 'bg-indigo-100',
    tailwindText: 'text-indigo-700',
  },
  {
    id: DEFAULT_CATEGORY_IDS.OTHER,
    name: 'その他',
    keywords: [],
    icon: 'MoreHorizontal',
    color: 'gray',
    tailwindBg: 'bg-gray-100',
    tailwindText: 'text-gray-700',
  },
];

// カテゴリIDから情報を取得
export const getCategoryInfo = (categoryId: string): ExpenseCategoryInfo | undefined => {
  return DEFAULT_EXPENSE_CATEGORIES.find(c => c.id === categoryId);
};

// カテゴリ名からIDを取得
export const getCategoryIdByName = (name: string): string | undefined => {
  return DEFAULT_EXPENSE_CATEGORIES.find(c => c.name === name)?.id;
};
