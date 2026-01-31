/**
 * 契約内容報告書作成モーダル
 * - 対象月の新規契約・契約変更・契約終了を自動検出
 * - 報告書を作成して行政に提出
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  FileText,
  Users,
  Plus,
  Trash2,
  Send,
  Save,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { GovernmentOrganization, ContractReportItem } from '@/types';

interface ContractReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  facilityId: string;
  userId: string;
  organization: GovernmentOrganization;
  onCreated: () => void;
}

type ReportType = 'new' | 'change' | 'termination';

interface ReportItem {
  id: string;
  childId: string;
  childName: string;
  reportType: ReportType;
  recipientNumber?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  serviceType?: string;
  daysPerMonth?: number;
  changeContent?: string;
  terminationReason?: string;
}

type Step = 1 | 2 | 3;

export default function ContractReportModal({
  isOpen,
  onClose,
  facilityId,
  userId,
  organization,
  onCreated,
}: ContractReportModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 対象期間
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [targetMonth, setTargetMonth] = useState(new Date().getMonth()); // 前月をデフォルト

  // 児童データ
  const [children, setChildren] = useState<{ id: string; name: string; recipientNumber?: string }[]>([]);

  // 報告明細
  const [reportItems, setReportItems] = useState<ReportItem[]>([]);

  // 自動検出結果
  const [detectedItems, setDetectedItems] = useState<ReportItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchChildren();
      // 前月をデフォルトに
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      setTargetYear(lastMonth.getFullYear());
      setTargetMonth(lastMonth.getMonth() + 1);
    }
  }, [isOpen]);

  useEffect(() => {
    if (targetYear && targetMonth) {
      detectContractChanges();
    }
  }, [targetYear, targetMonth]);

  const fetchChildren = async () => {
    const { data } = await supabase
      .from('children')
      .select('id, name, recipient_number')
      .eq('facility_id', facilityId)
      .order('name');

    if (data) {
      setChildren(data.map(c => ({
        id: c.id,
        name: c.name,
        recipientNumber: c.recipient_number,
      })));
    }
  };

  // 契約変更を自動検出
  const detectContractChanges = async () => {
    setLoading(true);
    try {
      const startOfMonth = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
      const endOfMonth = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];

      // 対象月に契約開始・変更・終了があった契約を取得
      const { data: contracts } = await supabase
        .from('contracts')
        .select(`
          *,
          child:child_id (id, name, recipient_number)
        `)
        .eq('facility_id', facilityId)
        .or(`contract_start_date.gte.${startOfMonth},contract_start_date.lte.${endOfMonth},contract_end_date.gte.${startOfMonth},contract_end_date.lte.${endOfMonth},terminated_at.gte.${startOfMonth},terminated_at.lte.${endOfMonth}`);

      const detected: ReportItem[] = [];

      if (contracts) {
        for (const contract of contracts) {
          const startDate = contract.contract_start_date ? new Date(contract.contract_start_date) : null;
          const endDate = contract.contract_end_date ? new Date(contract.contract_end_date) : null;
          const terminatedAt = contract.terminated_at ? new Date(contract.terminated_at) : null;

          const monthStart = new Date(targetYear, targetMonth - 1, 1);
          const monthEnd = new Date(targetYear, targetMonth, 0);

          // 新規契約（対象月に契約開始）
          if (startDate && startDate >= monthStart && startDate <= monthEnd) {
            detected.push({
              id: crypto.randomUUID(),
              childId: contract.child_id,
              childName: contract.child?.name || '',
              reportType: 'new',
              recipientNumber: contract.child?.recipient_number,
              contractStartDate: contract.contract_start_date,
              serviceType: '放課後等デイサービス', // TODO: 契約種別を取得
            });
          }

          // 契約終了（対象月に契約終了または解約）
          if (terminatedAt && terminatedAt >= monthStart && terminatedAt <= monthEnd) {
            detected.push({
              id: crypto.randomUUID(),
              childId: contract.child_id,
              childName: contract.child?.name || '',
              reportType: 'termination',
              recipientNumber: contract.child?.recipient_number,
              contractEndDate: terminatedAt.toISOString().split('T')[0],
              terminationReason: '',
            });
          } else if (endDate && endDate >= monthStart && endDate <= monthEnd) {
            detected.push({
              id: crypto.randomUUID(),
              childId: contract.child_id,
              childName: contract.child?.name || '',
              reportType: 'termination',
              recipientNumber: contract.child?.recipient_number,
              contractEndDate: contract.contract_end_date,
              terminationReason: '',
            });
          }
        }
      }

      setDetectedItems(detected);
      setReportItems(detected);
    } catch (error) {
      console.error('契約変更検出エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  // 手動で明細を追加
  const addItem = () => {
    setReportItems([
      ...reportItems,
      {
        id: crypto.randomUUID(),
        childId: '',
        childName: '',
        reportType: 'new',
      },
    ]);
  };

  // 明細を削除
  const removeItem = (id: string) => {
    setReportItems(reportItems.filter(item => item.id !== id));
  };

  // 明細を更新
  const updateItem = (id: string, field: keyof ReportItem, value: any) => {
    setReportItems(reportItems.map(item => {
      if (item.id !== id) return item;

      // 児童を選択した場合、名前と受給者番号も更新
      if (field === 'childId') {
        const child = children.find(c => c.id === value);
        return {
          ...item,
          childId: value,
          childName: child?.name || '',
          recipientNumber: child?.recipientNumber,
        };
      }

      return { ...item, [field]: value };
    }));
  };

  // 保存（下書き）
  const handleSaveDraft = async () => {
    await saveReport('draft');
  };

  // 提出
  const handleSubmit = async () => {
    await saveReport('submitted');
  };

  const saveReport = async (status: 'draft' | 'submitted') => {
    if (reportItems.length === 0) {
      alert('報告する内容がありません');
      return;
    }

    setSubmitting(true);
    try {
      // カテゴリを取得
      const { data: category } = await supabase
        .from('government_document_categories')
        .select('id')
        .eq('code', 'contract_report')
        .single();

      if (!category) throw new Error('カテゴリが見つかりません');

      // 提出書類を作成
      const { data: submission, error: subError } = await supabase
        .from('government_document_submissions')
        .insert({
          facility_id: facilityId,
          organization_id: organization.id,
          category_id: category.id,
          title: `契約内容報告書（${targetYear}年${targetMonth}月分）`,
          target_period: `${targetYear}年${targetMonth}月`,
          target_year: targetYear,
          target_month: targetMonth,
          status,
          submitted_at: status === 'submitted' ? new Date().toISOString() : null,
          submitted_by: status === 'submitted' ? userId : null,
        })
        .select()
        .single();

      if (subError) throw subError;

      // 明細を作成
      const items = reportItems.map(item => ({
        submission_id: submission.id,
        child_id: item.childId,
        contract_id: null,
        report_type: item.reportType,
        child_name: item.childName,
        recipient_number: item.recipientNumber || null,
        contract_start_date: item.contractStartDate || null,
        contract_end_date: item.contractEndDate || null,
        service_type: item.serviceType || null,
        days_per_month: item.daysPerMonth || null,
        change_content: item.changeContent || null,
        termination_reason: item.terminationReason || null,
      }));

      const { error: itemsError } = await supabase
        .from('contract_report_items')
        .insert(items);

      if (itemsError) throw itemsError;

      // 提出の場合、通知メールを送信
      if (status === 'submitted' && organization.email) {
        // TODO: メール送信API呼び出し
        console.log('通知メール送信先:', organization.email);
      }

      onCreated();
    } catch (error: any) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const getReportTypeLabel = (type: ReportType) => {
    switch (type) {
      case 'new': return '新規契約';
      case 'change': return '契約変更';
      case 'termination': return '契約終了';
    }
  };

  const getReportTypeColor = (type: ReportType) => {
    switch (type) {
      case 'new': return 'bg-green-100 text-green-700';
      case 'change': return 'bg-blue-100 text-blue-700';
      case 'termination': return 'bg-red-100 text-red-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              契約内容報告書の作成
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          {/* ステップインジケーター */}
          <div className="flex items-center justify-between mt-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    currentStep >= step
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {currentStep > step ? <CheckCircle size={16} /> : step}
                </div>
                <span className={`ml-2 text-xs ${currentStep >= step ? 'text-indigo-600 font-medium' : 'text-gray-400'}`}>
                  {step === 1 && '対象期間'}
                  {step === 2 && '報告内容'}
                  {step === 3 && '確認'}
                </span>
                {step < 3 && (
                  <div className={`w-16 h-0.5 ml-2 ${currentStep > step ? 'bg-indigo-500' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* コンテンツ */}
        <div className="p-6 flex-1 overflow-y-auto">
          {/* Step 1: 対象期間 */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <p className="text-sm text-indigo-800">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  報告対象の年月を選択してください。その月に発生した契約の新規・変更・終了を報告します。
                </p>
              </div>

              <div className="flex items-center justify-center gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">年</label>
                  <select
                    className="px-4 py-3 border border-gray-300 rounded-lg text-lg font-bold"
                    value={targetYear}
                    onChange={(e) => setTargetYear(parseInt(e.target.value))}
                  >
                    {[2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>{y}年</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">月</label>
                  <select
                    className="px-4 py-3 border border-gray-300 rounded-lg text-lg font-bold"
                    value={targetMonth}
                    onChange={(e) => setTargetMonth(parseInt(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{m}月</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-center">
                <p className="text-gray-600">提出先</p>
                <p className="font-bold text-lg text-gray-800 mt-1">{organization.name}</p>
                {organization.department && (
                  <p className="text-sm text-gray-500">{organization.department}</p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: 報告内容 */}
          {currentStep === 2 && (
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">契約情報を検索中...</p>
                </div>
              ) : (
                <>
                  {detectedItems.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                      <p className="text-sm text-green-800">
                        <CheckCircle className="w-4 h-4 inline mr-1" />
                        {targetYear}年{targetMonth}月の契約変更を{detectedItems.length}件検出しました
                      </p>
                    </div>
                  )}

                  {reportItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>報告対象がありません</p>
                      <p className="text-sm mt-1">手動で追加するか、対象期間を変更してください</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reportItems.map((item, index) => (
                        <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-bold text-gray-700">報告 {index + 1}</span>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">児童名 *</label>
                              <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                value={item.childId}
                                onChange={(e) => updateItem(item.id, 'childId', e.target.value)}
                              >
                                <option value="">-- 選択 --</option>
                                {children.map(child => (
                                  <option key={child.id} value={child.id}>{child.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">報告種別 *</label>
                              <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                value={item.reportType}
                                onChange={(e) => updateItem(item.id, 'reportType', e.target.value)}
                              >
                                <option value="new">新規契約</option>
                                <option value="change">契約変更</option>
                                <option value="termination">契約終了</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">受給者番号</label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="10桁"
                                value={item.recipientNumber || ''}
                                onChange={(e) => updateItem(item.id, 'recipientNumber', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">サービス種別</label>
                              <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                value={item.serviceType || ''}
                                onChange={(e) => updateItem(item.id, 'serviceType', e.target.value)}
                              >
                                <option value="">-- 選択 --</option>
                                <option value="児童発達支援">児童発達支援</option>
                                <option value="放課後等デイサービス">放課後等デイサービス</option>
                                <option value="保育所等訪問支援">保育所等訪問支援</option>
                              </select>
                            </div>

                            {item.reportType === 'new' && (
                              <>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">契約開始日</label>
                                  <input
                                    type="date"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    value={item.contractStartDate || ''}
                                    onChange={(e) => updateItem(item.id, 'contractStartDate', e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">月間利用日数</label>
                                  <input
                                    type="number"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    placeholder="例: 23"
                                    value={item.daysPerMonth || ''}
                                    onChange={(e) => updateItem(item.id, 'daysPerMonth', parseInt(e.target.value))}
                                  />
                                </div>
                              </>
                            )}

                            {item.reportType === 'change' && (
                              <div className="col-span-2">
                                <label className="block text-xs text-gray-500 mb-1">変更内容</label>
                                <textarea
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  rows={2}
                                  placeholder="変更した内容を記載"
                                  value={item.changeContent || ''}
                                  onChange={(e) => updateItem(item.id, 'changeContent', e.target.value)}
                                />
                              </div>
                            )}

                            {item.reportType === 'termination' && (
                              <>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">契約終了日</label>
                                  <input
                                    type="date"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    value={item.contractEndDate || ''}
                                    onChange={(e) => updateItem(item.id, 'contractEndDate', e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">終了理由</label>
                                  <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    placeholder="例: 小学校卒業のため"
                                    value={item.terminationReason || ''}
                                    onChange={(e) => updateItem(item.id, 'terminationReason', e.target.value)}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={addItem}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    報告を追加
                  </button>
                </>
              )}
            </div>
          )}

          {/* Step 3: 確認 */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-bold text-gray-700 mb-3">報告書概要</h4>
                <dl className="space-y-2 text-sm">
                  <div className="flex">
                    <dt className="w-32 text-gray-500">対象期間</dt>
                    <dd className="text-gray-800 font-medium">{targetYear}年{targetMonth}月</dd>
                  </div>
                  <div className="flex">
                    <dt className="w-32 text-gray-500">提出先</dt>
                    <dd className="text-gray-800">{organization.name}</dd>
                  </div>
                  <div className="flex">
                    <dt className="w-32 text-gray-500">報告件数</dt>
                    <dd className="text-gray-800 font-bold">{reportItems.length}件</dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-gray-700">報告内容</h4>
                {reportItems.map((item, index) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-3 flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${getReportTypeColor(item.reportType)}`}>
                      {getReportTypeLabel(item.reportType)}
                    </span>
                    <span className="font-medium text-gray-800">{item.childName || '（未選択）'}</span>
                    {item.serviceType && (
                      <span className="text-sm text-gray-500">{item.serviceType}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">提出前の確認</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      提出すると{organization.name}に報告書が送信されます。
                      内容に間違いがないか確認してください。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-between flex-shrink-0">
          <button
            onClick={currentStep === 1 ? onClose : () => setCurrentStep((currentStep - 1) as Step)}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-bold flex items-center gap-2"
          >
            {currentStep === 1 ? (
              'キャンセル'
            ) : (
              <>
                <ChevronLeft size={16} />
                戻る
              </>
            )}
          </button>

          <div className="flex gap-3">
            {currentStep === 3 && (
              <button
                onClick={handleSaveDraft}
                disabled={submitting || reportItems.length === 0}
                className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={16} />
                下書き保存
              </button>
            )}

            {currentStep < 3 ? (
              <button
                onClick={() => setCurrentStep((currentStep + 1) as Step)}
                disabled={currentStep === 2 && reportItems.length === 0}
                className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
              >
                次へ
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || reportItems.length === 0}
                className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    送信中...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    提出する
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
