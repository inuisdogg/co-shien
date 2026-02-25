/**
 * 利用実績登録フォーム
 * DailyLogViewのモーダル内で使用するフォームコンポーネント
 * 実施加算の詳細記録に対応
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Car,
  FileText,
  Plus,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
  Check,
  ClipboardCheck,
  AlertTriangle,
  Users,
  Target,
  Heart,
  Truck,
  MessageSquare,
} from 'lucide-react';
import { UsageRecordFormData, UsageRecord, ScheduleItem } from '@/types';

interface UsageRecordFormProps {
  scheduleItem: ScheduleItem;
  initialData?: UsageRecord | Partial<UsageRecordFormData>;
  onSave: (data: UsageRecordFormData) => void;
  onDelete?: () => void;
  onCopyPrevious?: () => Partial<UsageRecordFormData> | undefined;
}

// 実施加算の定義（詳細記録が必要なもの）
interface ImplementationAddition {
  id: string;
  name: string;
  units: string;
  icon: React.ElementType;
  color: string;
  requiredFields: {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'select' | 'time' | 'date';
    placeholder?: string;
    options?: string[];
    required?: boolean;
  }[];
  notes: string;
}

const IMPLEMENTATION_ADDITIONS: ImplementationAddition[] = [
  {
    id: 'specialist_support',
    name: '専門的支援実施加算',
    units: '150単位/回',
    icon: Target,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
    requiredFields: [
      { id: 'plan_name', label: '専門的支援実施計画', type: 'text', placeholder: '計画名を入力', required: true },
      { id: 'support_content', label: '支援内容', type: 'textarea', placeholder: '実施した専門的支援の内容を記載', required: true },
      { id: 'duration', label: '実施時間', type: 'select', options: ['30分以上1時間未満', '1時間以上'], required: true },
      { id: 'staff_name', label: '実施職員', type: 'text', placeholder: '担当職員名（PT/OT/ST等）', required: true },
    ],
    notes: '理学療法士等が計画的に個別・集中的な支援を30分以上実施した場合に算定',
  },
  {
    id: 'cooperation_1',
    name: '関係機関連携加算(I)',
    units: '250単位/回',
    icon: Users,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    requiredFields: [
      { id: 'institution', label: '連携機関', type: 'text', placeholder: '保育所、学校名など', required: true },
      { id: 'meeting_date', label: '連携日', type: 'date', required: true },
      { id: 'content', label: '連携内容', type: 'textarea', placeholder: '情報共有・協議した内容', required: true },
      { id: 'plan_updated', label: '個別支援計画への反映', type: 'select', options: ['反映済み', '反映予定', '該当なし'] },
    ],
    notes: '保育所や学校等と連携し、個別支援計画作成等を行った場合',
  },
  {
    id: 'cooperation_2',
    name: '関係機関連携加算(II)',
    units: '200単位/回',
    icon: Users,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    requiredFields: [
      { id: 'institution', label: '連携機関', type: 'text', placeholder: '保育所、学校名など', required: true },
      { id: 'meeting_date', label: '連携日', type: 'date', required: true },
      { id: 'content', label: '連携内容', type: 'textarea', placeholder: '情報連携の内容（オンライン可）', required: true },
    ],
    notes: '保育所や学校等と個別支援計画作成時「以外」で情報連携を行った場合',
  },
  {
    id: 'behavior_support',
    name: '強度行動障害児支援加算',
    units: '200単位/日（開始90日は+500）',
    icon: AlertTriangle,
    color: 'text-orange-600 bg-orange-50 border-orange-200',
    requiredFields: [
      { id: 'support_plan', label: '支援計画', type: 'text', placeholder: '計画名を入力', required: true },
      { id: 'support_content', label: '支援内容', type: 'textarea', placeholder: '実施した支援の具体的内容', required: true },
      { id: 'staff_name', label: '担当職員', type: 'text', placeholder: '研修修了者名', required: true },
      { id: 'start_date', label: '支援開始日', type: 'date' },
    ],
    notes: '強度行動障害支援者養成研修修了者が支援計画を作成して支援を実施',
  },
  {
    id: 'individual_support_1',
    name: '個別サポート加算(I)',
    units: '120単位/日',
    icon: Heart,
    color: 'text-pink-600 bg-pink-50 border-pink-200',
    requiredFields: [
      { id: 'category', label: '該当区分', type: 'select', options: ['重症心身障害児', '身体障害1・2級', '療育手帳最重度・重度', '精神障害1級'], required: true },
      { id: 'support_content', label: '支援内容', type: 'textarea', placeholder: '実施した支援の内容' },
    ],
    notes: '重症心身障害児、身体障害1・2級等の児童への支援。受給者証への記載が必要。',
  },
  {
    id: 'individual_support_2',
    name: '個別サポート加算(II)',
    units: '150単位/日',
    icon: Heart,
    color: 'text-pink-600 bg-pink-50 border-pink-200',
    requiredFields: [
      { id: 'cooperation_org', label: '連携機関', type: 'text', placeholder: '児童相談所等', required: true },
      { id: 'last_share_date', label: '直近の情報共有日', type: 'date', required: true },
      { id: 'support_content', label: '支援内容', type: 'textarea', placeholder: '要保護・要支援児童への支援内容', required: true },
    ],
    notes: '要保護・要支援児童に対し、児童相談所等と6ヶ月に1回以上連携して支援',
  },
  {
    id: 'family_support_1',
    name: '家族支援加算(I)',
    units: '200-300単位',
    icon: MessageSquare,
    color: 'text-[#00c4cc] bg-[#00c4cc]/5 border-[#00c4cc]/20',
    requiredFields: [
      { id: 'support_type', label: '支援形態', type: 'select', options: ['居宅訪問(1h以上)', '居宅訪問(1h未満)', 'オンライン'], required: true },
      { id: 'content', label: '相談援助内容', type: 'textarea', placeholder: '実施した相談援助の内容', required: true },
      { id: 'duration', label: '実施時間', type: 'text', placeholder: '例: 45分' },
    ],
    notes: '入所児童の家族に対し、個別に相談援助等を行った場合',
  },
  {
    id: 'family_support_2',
    name: '家族支援加算(II)',
    units: '60-80単位',
    icon: MessageSquare,
    color: 'text-[#00c4cc] bg-[#00c4cc]/5 border-[#00c4cc]/20',
    requiredFields: [
      { id: 'support_type', label: '実施形態', type: 'select', options: ['対面', 'オンライン'], required: true },
      { id: 'participant_count', label: '参加家族数', type: 'text', placeholder: '例: 5家族' },
      { id: 'content', label: 'グループ支援内容', type: 'textarea', placeholder: '実施したグループ支援の内容', required: true },
    ],
    notes: '入所児童の家族に対し、グループでの相談援助等を行った場合',
  },
  {
    id: 'childcare_support',
    name: '子育てサポート加算',
    units: '80単位/回（月4回）',
    icon: Users,
    color: 'text-green-600 bg-green-50 border-green-200',
    requiredFields: [
      { id: 'observation_scene', label: '観察・参加場面', type: 'text', placeholder: '例: 集団療育場面', required: true },
      { id: 'content', label: '支援内容', type: 'textarea', placeholder: '保護者への説明・支援内容', required: true },
    ],
    notes: '保護者が支援場面を観察・参加する機会を提供。ただのフィードバックのみでは算定不可。',
  },
  {
    id: 'extension_support',
    name: '延長支援加算',
    units: '61-123単位',
    icon: Clock,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    requiredFields: [
      { id: 'extension_time', label: '延長区分', type: 'select', options: ['30分以上1時間未満（61単位）', '1時間以上2時間未満（92単位）', '2時間以上（123単位）'], required: true },
      { id: 'reason', label: '延長理由', type: 'textarea', placeholder: '預かりニーズの内容' },
    ],
    notes: '基本の支援時間5時間を超えて預かりニーズに対応した場合。職員2名以上配置必要。',
  },
  {
    id: 'transport',
    name: '送迎加算',
    units: '54単位/片道',
    icon: Truck,
    color: 'text-gray-600 bg-gray-50 border-gray-200',
    requiredFields: [
      { id: 'type', label: '送迎種別', type: 'select', options: ['迎えのみ', '送りのみ', '往復'], required: true },
      { id: 'special', label: '加算区分', type: 'select', options: ['通常', '重症心身障害児(+40)', '医療的ケア児(+40)', '医療的ケア児(+80)'] },
    ],
    notes: '居宅等と事業所間の送迎を行った場合',
  },
  {
    id: 'transition_support',
    name: '保育・教育等移行支援加算',
    units: '500単位/回',
    icon: Target,
    color: 'text-[#00c4cc] bg-[#00c4cc]/5 border-[#00c4cc]/20',
    requiredFields: [
      { id: 'type', label: '支援種別', type: 'select', options: ['退所前調整（2回まで）', '退所後訪問相談（1回）'], required: true },
      { id: 'destination', label: '移行先', type: 'text', placeholder: '保育所、学校名など', required: true },
      { id: 'content', label: '支援内容', type: 'textarea', placeholder: '調整・相談の内容', required: true },
    ],
    notes: '保育所等への円滑な移行を支援するための加算',
  },
  {
    id: 'absence_response',
    name: '欠席時対応加算(I)',
    units: '94単位/回（月4回）',
    icon: MessageSquare,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    requiredFields: [
      { id: 'contact_date', label: '連絡日', type: 'date', required: true },
      { id: 'reason', label: '欠席理由', type: 'text', placeholder: '急病等', required: true },
      { id: 'consultation', label: '相談援助内容', type: 'textarea', placeholder: '電話等で行った相談援助の内容', required: true },
    ],
    notes: '利用予定日の2日前までにキャンセル連絡があり、相談援助を行って記録した場合',
  },
];

// 実施加算の詳細データ型
interface AdditionDetail {
  additionId: string;
  fields: Record<string, string>;
}

interface ExtendedFormData extends UsageRecordFormData {
  additionDetails?: AdditionDetail[];
}

const UsageRecordForm: React.FC<UsageRecordFormProps> = ({
  scheduleItem,
  initialData,
  onSave,
  onDelete,
  onCopyPrevious,
}) => {
  const [formData, setFormData] = useState<ExtendedFormData>(() => ({
    scheduleId: scheduleItem.id,
    childId: scheduleItem.childId,
    childName: scheduleItem.childName,
    date: scheduleItem.date,
    serviceStatus: '利用',
    provisionForm: '',
    plannedStartTime: '',
    plannedEndTime: '',
    plannedTimeOneMinuteInterval: false,
    actualStartTime: '',
    actualEndTime: '',
    actualTimeOneMinuteInterval: false,
    calculatedTime: 0,
    calculatedTimeMethod: '計画時間から算出',
    timeCategory: '',
    pickup: scheduleItem.hasPickup ? 'あり' : 'なし',
    pickupSamePremises: false,
    dropoff: scheduleItem.hasDropoff ? 'あり' : 'なし',
    dropoffSamePremises: false,
    room: '',
    instructionForm: '小集団',
    billingTarget: '請求する',
    selfPayItem: '',
    memo: '',
    recordSheetRemarks: '',
    addonItems: [],
    additionDetails: [],
    ...initialData,
  }));

  const [showAddonSection, setShowAddonSection] = useState(false);
  const [expandedAdditions, setExpandedAdditions] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [activeStep, setActiveStep] = useState(1);

  // ステップ定義
  const steps = [
    { id: 1, label: '出欠確認', icon: ClipboardCheck },
    { id: 2, label: 'サービス内容', icon: Clock },
    { id: 3, label: '加算記録', icon: Plus },
    { id: 4, label: '備考', icon: FileText },
  ];

  // 前回のコピー
  const handleCopyPrevious = () => {
    if (onCopyPrevious) {
      const previousData = onCopyPrevious();
      if (previousData) {
        setFormData((prev) => ({
          ...prev,
          ...previousData,
          scheduleId: scheduleItem.id,
          childId: scheduleItem.childId,
          childName: scheduleItem.childName,
          date: scheduleItem.date,
        }));
      }
    }
  };

  // initialDataが変更されたときにフォームデータを更新
  useEffect(() => {
    if (initialData) {
      const { id, facilityId, createdAt, updatedAt, ...recordData } = initialData as UsageRecord;
      setFormData((prev) => ({
        ...prev,
        ...recordData,
        scheduleId: scheduleItem.id,
        childId: scheduleItem.childId,
        childName: scheduleItem.childName,
        date: scheduleItem.date,
      }));
    }
  }, [initialData, scheduleItem]);

  // 時間区分のオプション
  const timeCategoryOptions = [
    { value: '区分1', label: '区分1 (1時間30分以下)' },
    { value: '区分2', label: '区分2 (1時間30分超〜3時間以下)' },
    { value: '区分3', label: '区分3 (3時間超〜4時間以下)' },
    { value: '区分4', label: '区分4 (4時間超)' },
  ];

  // 計画時間から算定時間数を計算
  useEffect(() => {
    if (formData.calculatedTimeMethod === '計画時間から算出' && formData.plannedStartTime && formData.plannedEndTime) {
      const start = new Date(`2000-01-01T${formData.plannedStartTime}:00`);
      const end = new Date(`2000-01-01T${formData.plannedEndTime}:00`);
      const diffMs = end.getTime() - start.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      setFormData((prev) => ({ ...prev, calculatedTime: Math.max(0, diffHours) }));
    }
  }, [formData.plannedStartTime, formData.plannedEndTime, formData.calculatedTimeMethod]);

  // 開始終了時間から算定時間数を計算
  useEffect(() => {
    if (formData.calculatedTimeMethod === '開始終了時間から算出' && formData.actualStartTime && formData.actualEndTime) {
      const start = new Date(`2000-01-01T${formData.actualStartTime}:00`);
      const end = new Date(`2000-01-01T${formData.actualEndTime}:00`);
      const diffMs = end.getTime() - start.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      setFormData((prev) => ({ ...prev, calculatedTime: Math.max(0, diffHours) }));
    }
  }, [formData.actualStartTime, formData.actualEndTime, formData.calculatedTimeMethod]);

  // 計画時間を開始終了時間に反映
  const reflectPlannedTime = () => {
    if (formData.plannedStartTime && formData.plannedEndTime) {
      setFormData((prev) => ({
        ...prev,
        actualStartTime: prev.plannedStartTime,
        actualEndTime: prev.plannedEndTime,
      }));
    }
  };

  // 加算項目のトグル
  const toggleAddition = (additionId: string) => {
    setFormData((prev) => {
      const isSelected = prev.addonItems.includes(additionId);
      const newAddonItems = isSelected
        ? prev.addonItems.filter((i) => i !== additionId)
        : [...prev.addonItems, additionId];

      // 詳細データも更新
      const newDetails = isSelected
        ? prev.additionDetails?.filter((d) => d.additionId !== additionId) || []
        : [...(prev.additionDetails || []), { additionId, fields: {} }];

      // 選択時は展開
      if (!isSelected) {
        setExpandedAdditions((prev) => new Set([...prev, additionId]));
      }

      return {
        ...prev,
        addonItems: newAddonItems,
        additionDetails: newDetails,
      };
    });
  };

  // 加算詳細フィールドの更新
  const updateAdditionField = (additionId: string, fieldId: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      additionDetails: prev.additionDetails?.map((d) =>
        d.additionId === additionId ? { ...d, fields: { ...d.fields, [fieldId]: value } } : d
      ) || [],
    }));
  };

  // 加算の展開トグル
  const toggleExpand = (additionId: string) => {
    setExpandedAdditions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(additionId)) {
        newSet.delete(additionId);
      } else {
        newSet.add(additionId);
      }
      return newSet;
    });
  };

  // 加算詳細データを取得
  const getAdditionDetail = (additionId: string): Record<string, string> => {
    return formData.additionDetails?.find((d) => d.additionId === additionId)?.fields || {};
  };

  // フォーム送信
  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー: 日付と児童名 */}
      <div className="bg-gradient-to-r from-[#00c4cc]/10 to-white px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800">{scheduleItem.childName}</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {(() => {
                const [y, m, d] = scheduleItem.date.split('-').map(Number);
                const date = new Date(y, m - 1, d);
                const days = ['日', '月', '火', '水', '木', '金', '土'];
                return `${y}年${m}月${d}日(${days[date.getDay()]})`;
              })()}
              {' '}
              {scheduleItem.slot === 'AM' ? '午前' : '午後'}
            </p>
          </div>
          {onCopyPrevious && !initialData && (
            <button
              type="button"
              onClick={handleCopyPrevious}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#00c4cc] bg-[#00c4cc]/10 hover:bg-[#00c4cc]/20 rounded-lg transition-colors border border-[#00c4cc]/20"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              前回のコピー
            </button>
          )}
        </div>
      </div>

      {/* ステップナビゲーション */}
      <div className="px-6 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-1">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <React.Fragment key={step.id}>
                {index > 0 && <div className="flex-shrink-0 w-4 h-px bg-gray-300 mx-0.5" />}
                <button
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    activeStep === step.id
                      ? 'bg-[#00c4cc] text-white shadow-sm'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.id}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ステップコンテンツ */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
        {/* ステップ1: 出欠確認 */}
        {activeStep === 1 && (
          <>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">
                サービス提供の状況
              </label>
              <div className="flex gap-2">
                {['利用', '欠席(加算なし)', '加算のみ'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, serviceStatus: status as any }))}
                    className={`flex-1 h-12 px-4 rounded-xl text-sm font-medium transition-all ${
                      formData.serviceStatus === status
                        ? 'bg-[#00c4cc] text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* 送迎セクション */}
            <div className="bg-gray-50 rounded-xl p-5 space-y-4 border border-gray-100">
              <div className="flex items-center gap-2 text-gray-700">
                <Car className="w-5 h-5 text-[#00c4cc]" />
                <span className="font-bold">送迎</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">迎え</label>
                  <div className="flex gap-2">
                    {['あり', 'なし'].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, pickup: value as any }))}
                        className={`flex-1 h-12 rounded-xl text-sm font-medium transition-all ${
                          formData.pickup === value
                            ? 'bg-[#00c4cc] text-white'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                  {formData.pickup === 'あり' && (
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.pickupSamePremises}
                        onChange={(e) => setFormData((prev) => ({ ...prev, pickupSamePremises: e.target.checked }))}
                        className="w-4 h-4 text-[#00c4cc] rounded border-gray-300"
                      />
                      <span className="text-xs text-gray-600">同一敷地内</span>
                    </label>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">送り</label>
                  <div className="flex gap-2">
                    {['あり', 'なし'].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, dropoff: value as any }))}
                        className={`flex-1 h-12 rounded-xl text-sm font-medium transition-all ${
                          formData.dropoff === value
                            ? 'bg-[#00c4cc] text-white'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                  {formData.dropoff === 'あり' && (
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.dropoffSamePremises}
                        onChange={(e) => setFormData((prev) => ({ ...prev, dropoffSamePremises: e.target.checked }))}
                        className="w-4 h-4 text-[#00c4cc] rounded border-gray-300"
                      />
                      <span className="text-xs text-gray-600">同一敷地内</span>
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" onClick={() => setActiveStep(2)} className="px-6 py-2.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white text-sm font-bold rounded-lg transition-colors">次へ →</button>
            </div>
          </>
        )}

        {/* ステップ2: サービス内容 */}
        {activeStep === 2 && (
          <>
            <div className="bg-gray-50 rounded-xl p-5 space-y-5 border border-gray-100">
              <div className="flex items-center gap-2 text-gray-700">
                <Clock className="w-5 h-5 text-[#00c4cc]" />
                <span className="font-bold">時間設定</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">計画時間</label>
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    className="flex-1 h-12 px-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc] text-base"
                    value={formData.plannedStartTime || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, plannedStartTime: e.target.value }))}
                  />
                  <span className="text-gray-400 text-lg">〜</span>
                  <input
                    type="time"
                    className="flex-1 h-12 px-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc] text-base"
                    value={formData.plannedEndTime || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, plannedEndTime: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-600">実績時間</label>
                  <button type="button" onClick={reflectPlannedTime} className="text-xs text-[#00c4cc] hover:underline font-medium">計画時間を反映</button>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    className="flex-1 h-12 px-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc] text-base"
                    value={formData.actualStartTime || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, actualStartTime: e.target.value }))}
                  />
                  <span className="text-gray-400 text-lg">〜</span>
                  <input
                    type="time"
                    className="flex-1 h-12 px-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc] text-base"
                    value={formData.actualEndTime || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, actualEndTime: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">時間区分</label>
                <div className="grid grid-cols-2 gap-2">
                  {timeCategoryOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, timeCategory: option.value }))}
                      className={`h-12 px-3 rounded-xl text-xs font-medium transition-all text-left ${
                        formData.timeCategory === option.value
                          ? 'bg-[#00c4cc]/10 text-[#00c4cc] border-2 border-[#00c4cc]'
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 提供形態・指導形態 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">提供形態</label>
                <div className="grid grid-cols-3 gap-2">
                  {['個別', '小集団', '集団'].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, provisionForm: value }))}
                      className={`h-12 rounded-xl text-sm font-medium transition-all ${
                        formData.provisionForm === value
                          ? 'bg-[#00c4cc]/10 text-[#00c4cc] border-2 border-[#00c4cc]'
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">指導形態</label>
                <div className="grid grid-cols-3 gap-2">
                  {['個別', '小集団', '集団'].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, instructionForm: value }))}
                      className={`h-12 rounded-xl text-sm font-medium transition-all ${
                        formData.instructionForm === value
                          ? 'bg-[#00c4cc]/10 text-[#00c4cc] border-2 border-[#00c4cc]'
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button type="button" onClick={() => setActiveStep(1)} className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 text-sm font-bold rounded-lg transition-colors">← 戻る</button>
              <button type="button" onClick={() => setActiveStep(3)} className="px-6 py-2.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white text-sm font-bold rounded-lg transition-colors">次へ →</button>
            </div>
          </>
        )}

        {/* ステップ3: 加算記録 */}
        {activeStep === 3 && (
          <>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between bg-white">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-[#00c4cc]" />
                  <span className="font-bold text-gray-700">実施加算</span>
                  {formData.addonItems.length > 0 && (
                    <span className="px-2 py-0.5 bg-[#00c4cc]/10 text-[#00c4cc] text-xs rounded-full font-bold">
                      {formData.addonItems.length}件選択中
                    </span>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200">
                {formData.serviceStatus === '欠席(加算なし)' ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    サービス提供の状況が「欠席(加算なし)」のため、加算を選択できません
                  </p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {IMPLEMENTATION_ADDITIONS.map((addition) => {
                      const Icon = addition.icon;
                      const isSelected = formData.addonItems.includes(addition.id);
                      const isExpanded = expandedAdditions.has(addition.id);
                      const detail = getAdditionDetail(addition.id);

                      return (
                        <div key={addition.id} className={isSelected ? 'bg-gray-50' : ''}>
                          <div className="px-4 py-3 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => toggleAddition(addition.id)}
                              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all flex-shrink-0 ${
                                isSelected ? 'bg-[#00c4cc] text-white' : 'border-2 border-gray-300 hover:border-gray-400'
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => isSelected && toggleExpand(addition.id)}
                              className="flex-1 flex items-center gap-3 text-left"
                              disabled={!isSelected}
                            >
                              <div className={`p-1.5 rounded-lg ${addition.color}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1">
                                <div className={`font-medium text-sm ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
                                  {addition.name}
                                </div>
                                <div className="text-xs text-gray-400">{addition.units}</div>
                              </div>
                              {isSelected && (
                                isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                          </div>

                          {isSelected && isExpanded && (
                            <div className="px-4 pb-4 space-y-3">
                              <div className="ml-9 p-4 bg-white rounded-xl border border-gray-200 space-y-3">
                                <div className="text-xs text-amber-600 flex items-start gap-1.5 pb-3 border-b border-gray-100">
                                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                  <span>{addition.notes}</span>
                                </div>
                                {addition.requiredFields.map((field) => (
                                  <div key={field.id}>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                      {field.label}
                                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                                    </label>
                                    {field.type === 'textarea' ? (
                                      <textarea
                                        className="w-full h-12 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc] resize-none"
                                        rows={2}
                                        placeholder={field.placeholder}
                                        value={detail[field.id] || ''}
                                        onChange={(e) => updateAdditionField(addition.id, field.id, e.target.value)}
                                      />
                                    ) : field.type === 'select' ? (
                                      <select
                                        className="w-full h-12 px-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                                        value={detail[field.id] || ''}
                                        onChange={(e) => updateAdditionField(addition.id, field.id, e.target.value)}
                                      >
                                        <option value="">選択してください</option>
                                        {field.options?.map((opt) => (
                                          <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input
                                        type={field.type}
                                        className="w-full h-12 px-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc]"
                                        placeholder={field.placeholder}
                                        value={detail[field.id] || ''}
                                        onChange={(e) => updateAdditionField(addition.id, field.id, e.target.value)}
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between">
              <button type="button" onClick={() => setActiveStep(2)} className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 text-sm font-bold rounded-lg transition-colors">← 戻る</button>
              <button type="button" onClick={() => setActiveStep(4)} className="px-6 py-2.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white text-sm font-bold rounded-lg transition-colors">次へ →</button>
            </div>
          </>
        )}

        {/* ステップ4: 備考 */}
        {activeStep === 4 && (
          <>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">メモ</label>
              <textarea
                className="w-full h-24 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00c4cc]/20 focus:border-[#00c4cc] text-sm resize-none"
                placeholder="自由にメモを記録できます"
                value={formData.memo || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, memo: e.target.value }))}
                maxLength={2000}
              />
              <div className="text-xs text-gray-400 text-right mt-1">
                {(formData.memo || '').length}/2000
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">請求対象</label>
              <div className="flex gap-2">
                {['請求する', '請求しない'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, billingTarget: value as any }))}
                    className={`flex-1 h-12 rounded-xl text-sm font-medium transition-all ${
                      formData.billingTarget === value
                        ? value === '請求する' ? 'bg-[#00c4cc] text-white' : 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              {formData.billingTarget === '請求しない' && (
                <p className="text-xs text-orange-600 mt-2">
                  ※実績を残したまま国保連・市町村への請求の対象から外します
                </p>
              )}
            </div>

            {/* 確認サマリー */}
            <div className="bg-gray-50 rounded-xl p-5 space-y-3 border border-gray-100">
              <h4 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00c4cc]" />
                入力内容の確認
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 text-xs">サービス状況</span>
                  <p className="font-medium text-gray-800">{formData.serviceStatus}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">時間区分</span>
                  <p className="font-medium text-gray-800">{formData.timeCategory || '未設定'}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">実績時間</span>
                  <p className="font-medium text-gray-800">
                    {formData.actualStartTime && formData.actualEndTime
                      ? `${formData.actualStartTime} 〜 ${formData.actualEndTime}`
                      : '未入力'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">送迎</span>
                  <p className="font-medium text-gray-800">迎え:{formData.pickup} / 送り:{formData.dropoff}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">提供形態</span>
                  <p className="font-medium text-gray-800">{formData.provisionForm || '未設定'}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">加算</span>
                  <p className="font-medium text-gray-800">{formData.addonItems.length > 0 ? `${formData.addonItems.length}件` : 'なし'}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button type="button" onClick={() => setActiveStep(3)} className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 text-sm font-bold rounded-lg transition-colors">← 戻る</button>
            </div>
          </>
        )}
      </div>

      {/* スティッキー保存ボタン */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between shadow-lg">
        {onDelete && initialData && (
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-sm font-medium">削除</span>
          </button>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="flex items-center gap-2 px-8 py-3 bg-[#00c4cc] hover:bg-[#00b0b8] text-white rounded-xl transition-colors disabled:opacity-50 shadow-md active:shadow-sm"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span className="text-sm font-bold">保存する</span>
        </button>
      </div>
    </div>
  );
};

export default UsageRecordForm;
