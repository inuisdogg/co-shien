/**
 * 利用実績登録フォーム
 */

'use client';

import React, { useState, useEffect } from 'react';
import { X, HelpCircle } from 'lucide-react';
import { UsageRecordFormData, UsageRecord, ScheduleItem } from '@/types';

interface UsageRecordFormProps {
  scheduleItem: ScheduleItem;
  initialData?: UsageRecord | Partial<UsageRecordFormData>;
  onClose: () => void;
  onSave: (data: UsageRecordFormData) => void;
  onDelete?: () => void;
}

const UsageRecordForm: React.FC<UsageRecordFormProps> = ({
  scheduleItem,
  initialData,
  onClose,
  onSave,
  onDelete,
}) => {
  const [formData, setFormData] = useState<UsageRecordFormData>(() => ({
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
    ...initialData,
  }));

  // initialDataが変更されたときにフォームデータを更新
  useEffect(() => {
    if (initialData) {
      // UsageRecord型の場合はid, facilityId, createdAt, updatedAtを除外
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

  // 加算項目のリスト
  const addonOptions = [
    '家族支援加算(I)(個別)',
    '家族支援加算(II)(グループ)',
    '強度行動障害児支援加算',
    '延長支援加算',
    '医療連携体制加算((VI)以外)',
    '医療連携体制加算(VI)単位数',
    '関係機関連携加算(I)',
    '関係機関連携加算(II)',
    '関係機関連携加算(III)',
    '関係機関連携加算(IV)',
    '個別サポート加算(I)',
    '個別サポート加算(II)',
    '集中的支援加算',
    '人工内耳装用児支援加算',
    '視覚・聴覚・言語機能障害児支援加算',
    '入浴支援加算',
    '専門的支援実施加算',
    '事業所間連携加算(I)',
    '事業所間連携加算(II)',
    '子育てサポート加算',
    '保育・教育等移行支援加算(退所前)',
  ];

  // 時間区分のオプション
  const timeCategoryOptions = [
    '区分1 (1時間30分以下)',
    '区分2 (1時間30分超3時間以下)',
    '区分3 (3時間超4時間以下)',
    '区分4 (4時間超)',
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

  // 計画時間をクリア
  const clearPlannedTime = () => {
    setFormData((prev) => ({
      ...prev,
      plannedStartTime: '',
      plannedEndTime: '',
    }));
  };

  // 加算項目のトグル
  const toggleAddonItem = (item: string) => {
    setFormData((prev) => ({
      ...prev,
      addonItems: prev.addonItems.includes(item)
        ? prev.addonItems.filter((i) => i !== item)
        : [...prev.addonItems, item],
    }));
  };

  // フォーム送信
  const handleSubmit = () => {
    onSave(formData);
  };

  // 日付をYYYY/MM/DD形式に変換
  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${year}/${month}/${day}`;
  };

  const memoCharCount = (formData.memo || '').length;
  const remarksCharCount = (formData.recordSheetRemarks || '').length;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg w-full max-w-6xl my-8 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0 z-10">
          <div className="flex items-center space-x-2">
            <h3 className="font-bold text-lg text-gray-800 flex items-center">
              利用実績編集
            </h3>
            <HelpCircle size={16} className="text-gray-400" />
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-xs text-gray-600">
              [事業所] pocopoco(児発)
            </div>
            <div className="text-xs text-gray-600">
              [職員] 畠昂哉 (オーナー)
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 grid grid-cols-2 gap-6">
          {/* 左カラム */}
          <div className="space-y-4">
            {/* 日付 */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">日付</label>
              <input
                type="date"
                className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                value={formData.date}
                onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
              />
            </div>

            {/* サービス提供の状況 */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">サービス提供の状況</label>
              <select
                className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                value={formData.serviceStatus}
                onChange={(e) => setFormData((prev) => ({ ...prev, serviceStatus: e.target.value as any }))}
              >
                <option value="利用">利用</option>
                <option value="欠席(加算なし)">欠席(加算なし)</option>
                <option value="加算のみ">加算のみ</option>
              </select>
            </div>

            {/* 提供形態 */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">提供形態</label>
              <select
                className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                value={formData.provisionForm || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, provisionForm: e.target.value }))}
              >
                <option value="">選択してください</option>
                <option value="個別">個別</option>
                <option value="小集団">小集団</option>
                <option value="集団">集団</option>
              </select>
            </div>

            {/* 計画時間 */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5 flex items-center">
                計画時間
                <HelpCircle size={14} className="ml-1 text-gray-400" />
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="time"
                  className="flex-1 bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                  value={formData.plannedStartTime || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, plannedStartTime: e.target.value }))}
                  step={formData.plannedTimeOneMinuteInterval ? 60 : undefined}
                />
                <span className="text-gray-500">~</span>
                <input
                  type="time"
                  className="flex-1 bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                  value={formData.plannedEndTime || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, plannedEndTime: e.target.value }))}
                  step={formData.plannedTimeOneMinuteInterval ? 60 : undefined}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <button
                  onClick={clearPlannedTime}
                  className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 border border-gray-300 rounded"
                >
                  クリア
                </button>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.plannedTimeOneMinuteInterval}
                    onChange={(e) => setFormData((prev) => ({ ...prev, plannedTimeOneMinuteInterval: e.target.checked }))}
                    className="accent-[#00c4cc]"
                  />
                  <span className="text-xs text-gray-700">1分間隔で入力する</span>
                </label>
              </div>
            </div>

            {/* 開始終了時間 */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">開始終了時間</label>
              <div className="flex items-center space-x-2">
                <input
                  type="time"
                  className="flex-1 bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                  value={formData.actualStartTime || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, actualStartTime: e.target.value }))}
                  step={formData.actualTimeOneMinuteInterval ? 60 : undefined}
                />
                <span className="text-gray-500">~</span>
                <input
                  type="time"
                  className="flex-1 bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                  value={formData.actualEndTime || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, actualEndTime: e.target.value }))}
                  step={formData.actualTimeOneMinuteInterval ? 60 : undefined}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <button
                  onClick={reflectPlannedTime}
                  className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 border border-gray-300 rounded"
                >
                  計画時間を反映
                </button>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.actualTimeOneMinuteInterval}
                    onChange={(e) => setFormData((prev) => ({ ...prev, actualTimeOneMinuteInterval: e.target.checked }))}
                    className="accent-[#00c4cc]"
                  />
                  <span className="text-xs text-gray-700">1分間隔で入力する</span>
                </label>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                ※実績記録票に記載する実利用時間です。
              </p>
            </div>

            {/* 算定時間数 */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5 flex items-center">
                算定時間数
                <HelpCircle size={14} className="ml-1 text-gray-400" />
              </label>
              <div className="flex items-center space-x-2">
                <select
                  className="flex-1 bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                  value={formData.calculatedTimeMethod}
                  onChange={(e) => setFormData((prev) => ({ ...prev, calculatedTimeMethod: e.target.value as any }))}
                >
                  <option value="計画時間から算出">計画時間から算出</option>
                  <option value="開始終了時間から算出">開始終了時間から算出</option>
                  <option value="手動入力">手動入力</option>
                </select>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className="w-20 bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                  value={formData.calculatedTime}
                  onChange={(e) => setFormData((prev) => ({ ...prev, calculatedTime: parseFloat(e.target.value) || 0 }))}
                  disabled={formData.calculatedTimeMethod !== '手動入力'}
                />
              </div>
            </div>

            {/* 時間区分 */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">時間区分</label>
              <select
                className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                value={formData.timeCategory || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, timeCategory: e.target.value }))}
              >
                <option value="">選択してください</option>
                {timeCategoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {/* 送迎迎え */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">送迎迎え</label>
              <select
                className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                value={formData.pickup}
                onChange={(e) => setFormData((prev) => ({ ...prev, pickup: e.target.value as any }))}
              >
                <option value="なし">なし</option>
                <option value="あり">あり</option>
              </select>
              <label className="flex items-center space-x-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.pickupSamePremises}
                  onChange={(e) => setFormData((prev) => ({ ...prev, pickupSamePremises: e.target.checked }))}
                  className="accent-[#00c4cc]"
                />
                <span className="text-xs text-gray-700">同一敷地内</span>
              </label>
            </div>

            {/* 送迎送り */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">送迎送り</label>
              <select
                className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                value={formData.dropoff}
                onChange={(e) => setFormData((prev) => ({ ...prev, dropoff: e.target.value as any }))}
              >
                <option value="なし">なし</option>
                <option value="あり">あり</option>
              </select>
              <label className="flex items-center space-x-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.dropoffSamePremises}
                  onChange={(e) => setFormData((prev) => ({ ...prev, dropoffSamePremises: e.target.checked }))}
                  className="accent-[#00c4cc]"
                />
                <span className="text-xs text-gray-700">同一敷地内</span>
              </label>
            </div>

            {/* 部屋 */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">部屋</label>
              <select
                className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                value={formData.room || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, room: e.target.value }))}
              >
                <option value="">未選択</option>
                <option value="部屋1">部屋1</option>
                <option value="部屋2">部屋2</option>
                <option value="部屋3">部屋3</option>
              </select>
            </div>

            {/* 指導形態 */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">指導形態</label>
              <select
                className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                value={formData.instructionForm || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, instructionForm: e.target.value }))}
              >
                <option value="小集団">小集団</option>
                <option value="個別">個別</option>
                <option value="集団">集団</option>
              </select>
            </div>

            {/* 請求対象 */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">請求対象</label>
              <select
                className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                value={formData.billingTarget}
                onChange={(e) => setFormData((prev) => ({ ...prev, billingTarget: e.target.value as any }))}
              >
                <option value="請求する">請求する</option>
                <option value="請求しない">請求しない</option>
              </select>
              <p className="text-[10px] text-gray-500 mt-1">
                実績を残したまま国保連・市町村への請求の対象から外したい場合は「請求しない」を選択してください。
              </p>
            </div>

            {/* 自費項目 */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">自費項目</label>
              {formData.serviceStatus === '加算のみ' ? (
                <p className="text-xs text-gray-500">
                  サービス提供の状況が「加算のみ」時、設定できません。
                </p>
              ) : (
                <select
                  className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                  value={formData.selfPayItem || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, selfPayItem: e.target.value }))}
                >
                  <option value="">選択してください</option>
                  <option value="自費項目1">自費項目1</option>
                  <option value="自費項目2">自費項目2</option>
                </select>
              )}
            </div>
          </div>

          {/* 右カラム */}
          <div className="space-y-4">
            {/* メモ */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">メモ</label>
              <div className="text-xs text-gray-500 mb-1 text-right">
                {memoCharCount}/2000
              </div>
              <textarea
                className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc] h-32 resize-none"
                placeholder="自由に記録する事ができます"
                value={formData.memo || ''}
                onChange={(e) => {
                  if (e.target.value.length <= 2000) {
                    setFormData((prev) => ({ ...prev, memo: e.target.value }));
                  }
                }}
                maxLength={2000}
              />
              <div className="text-xs text-gray-500 mt-1 text-right">
                0/2000
              </div>
            </div>

            {/* 実績記録票備考 */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">実績記録票備考</label>
              <label className="text-xs text-gray-700 block mb-1">備考</label>
              <textarea
                className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc] h-20 resize-none"
                value={formData.recordSheetRemarks || ''}
                onChange={(e) => {
                  if (e.target.value.length <= 50) {
                    setFormData((prev) => ({ ...prev, recordSheetRemarks: e.target.value }));
                  }
                }}
                maxLength={50}
              />
              <div className="text-xs text-gray-500 mt-1 text-right">
                {remarksCharCount}/50
              </div>
            </div>

            {/* 加算情報 */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">加算情報</label>
              {formData.serviceStatus === '欠席(加算なし)' ? (
                <p className="text-xs text-gray-500">
                  サービス提供の状況が「欠席(加算なし)」時、無効になります。
                </p>
              ) : (
                <div className="border border-gray-300 rounded-md p-3 max-h-64 overflow-y-auto">
                  <label className="flex items-center space-x-2 mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addonOptions.every((item) => formData.addonItems.includes(item))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData((prev) => ({ ...prev, addonItems: [...addonOptions] }));
                        } else {
                          setFormData((prev) => ({ ...prev, addonItems: [] }));
                        }
                      }}
                      className="accent-[#00c4cc]"
                    />
                    <span className="text-xs text-gray-700">選択してください</span>
                  </label>
                  <div className="space-y-1">
                    {addonOptions.map((item) => (
                      <label key={item} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.addonItems.includes(item)}
                          onChange={() => toggleAddonItem(item)}
                          className="accent-[#00c4cc]"
                        />
                        <span className="text-xs text-gray-700">{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-gray-200 flex justify-between items-center bg-white sticky bottom-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-md text-sm transition-colors"
          >
            閉じる
          </button>
          <div className="flex space-x-3">
            {onDelete && (
              <button
                onClick={onDelete}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-md text-sm transition-colors"
              >
                削除する
              </button>
            )}
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-md text-sm transition-colors"
            >
              保存する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageRecordForm;

