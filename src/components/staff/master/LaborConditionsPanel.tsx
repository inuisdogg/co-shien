/**
 * 労働条件通知書パネル
 * スタッフの労働条件通知書（employment_contracts）の作成・閲覧・印刷
 * スライドオーバーパネル（右からスライド）
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Save,
  FileText,
  Printer,
  Plus,
  Trash2,
  ChevronLeft,
  Clock,
  DollarSign,
  Shield,
  AlertCircle,
  Check,
  Loader2,
  Edit2,
  Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

// ============================================
// 型定義
// ============================================

interface LaborConditionsPanelProps {
  staff: { id: string; name: string; user_id?: string };
  facilityId: string;
  facilityName: string;
  isOpen: boolean;
  onClose: () => void;
  onContractSaved?: (contractedWeeklyHours: number) => void;
}

type ContractType = 'indefinite' | 'fixed_term' | 'parttime' | 'temporary';
type WageType = 'monthly' | 'hourly' | 'daily';
type ContractStatus = 'draft' | 'issued' | 'acknowledged' | 'signed' | 'expired' | 'superseded';

interface Allowance {
  id: string;
  name: string;
  amount: number;
}

interface EmploymentContract {
  id: string;
  facility_id: string;
  staff_id: string;
  user_id: string | null;
  contract_type: ContractType;
  contract_start_date: string | null;
  contract_end_date: string | null;
  renewal_clause: string | null;
  work_location: string | null;
  job_description: string | null;
  work_start_time: string | null;
  work_end_time: string | null;
  break_minutes: number | null;
  contracted_weekly_hours: number | null;
  work_days_per_week: number | null;
  wage_type: WageType | null;
  base_salary: number | null;
  allowances: Allowance[] | null;
  total_monthly_salary: number | null;
  hourly_wage: number | null;
  payment_day: number | null;
  social_insurance: string | null;
  employment_insurance: boolean | null;
  workers_comp: boolean | null;
  status: ContractStatus;
  issued_at: string | null;
  acknowledged_at: string | null;
  signed_at: string | null;
  signed_by_staff: boolean | null;
  signed_by_facility: boolean | null;
  notes: string | null;
  document_id: string | null;
  created_at: string;
}

// ============================================
// 定数
// ============================================

const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  indefinite: '期間の定めなし',
  fixed_term: '有期雇用',
  parttime: 'パートタイム',
  temporary: '臨時',
};

const STATUS_STYLES: Record<ContractStatus, { label: string; bg: string; text: string }> = {
  draft: { label: '下書き', bg: 'bg-gray-100', text: 'text-gray-700' },
  issued: { label: '発行済', bg: 'bg-blue-100', text: 'text-blue-700' },
  acknowledged: { label: '確認済', bg: 'bg-indigo-100', text: 'text-indigo-700' },
  signed: { label: '署名済', bg: 'bg-green-100', text: 'text-green-700' },
  expired: { label: '期限切れ', bg: 'bg-red-100', text: 'text-red-700' },
  superseded: { label: '更新済', bg: 'bg-yellow-100', text: 'text-yellow-700' },
};

// ============================================
// フォーム初期値
// ============================================

interface FormData {
  contract_type: ContractType;
  contract_start_date: string;
  contract_end_date: string;
  renewal_clause: string;
  work_location: string;
  job_description: string;
  work_start_time: string;
  work_end_time: string;
  break_minutes: number | '';
  contracted_weekly_hours: number | '';
  work_days_per_week: number | '';
  wage_type: WageType;
  base_salary: number | '';
  allowances: Allowance[];
  payment_day: number | '';
  employment_insurance: boolean;
  workers_comp: boolean;
  social_insurance: boolean;
  notes: string;
}

const createInitialFormData = (facilityName: string): FormData => ({
  contract_type: 'indefinite',
  contract_start_date: new Date().toISOString().split('T')[0],
  contract_end_date: '',
  renewal_clause: '',
  work_location: facilityName,
  job_description: '',
  work_start_time: '09:00',
  work_end_time: '18:00',
  break_minutes: 60,
  contracted_weekly_hours: 40,
  work_days_per_week: 5,
  wage_type: 'monthly',
  base_salary: '',
  allowances: [],
  payment_day: 25,
  employment_insurance: true,
  workers_comp: true,
  social_insurance: true,
  notes: '',
});

// ============================================
// ユーティリティ
// ============================================

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

const formatCurrency = (amount: number | null | undefined): string => {
  if (amount == null) return '-';
  return amount.toLocaleString('ja-JP') + '円';
};

// ============================================
// メインコンポーネント
// ============================================

type ViewMode = 'list' | 'form' | 'preview';

const LaborConditionsPanel: React.FC<LaborConditionsPanelProps> = ({
  staff,
  facilityId,
  facilityName,
  isOpen,
  onClose,
  onContractSaved,
}) => {
  const { toast } = useToast();
  // 状態管理
  const [contracts, setContracts] = useState<EmploymentContract[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingContract, setEditingContract] = useState<EmploymentContract | null>(null);
  const [formData, setFormData] = useState<FormData>(createInitialFormData(facilityName));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // ============================================
  // データ取得
  // ============================================

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employment_contracts')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('staff_id', staff.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContracts(data || []);
    } catch (err) {
      console.error('Failed to fetch contracts:', err);
      toast.error('労働条件通知書の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [facilityId, staff.id]);

  useEffect(() => {
    if (isOpen) {
      fetchContracts();
      setViewMode('list');
      setEditingContract(null);
      setFormData(createInitialFormData(facilityName));
      setErrors({});
      setSaveSuccess(false);
    }
  }, [isOpen, fetchContracts, facilityName]);

  // ============================================
  // フォーム操作
  // ============================================

  const populateFormFromContract = useCallback((contract: EmploymentContract) => {
    setFormData({
      contract_type: contract.contract_type,
      contract_start_date: contract.contract_start_date || '',
      contract_end_date: contract.contract_end_date || '',
      renewal_clause: contract.renewal_clause || '',
      work_location: contract.work_location || facilityName,
      job_description: contract.job_description || '',
      work_start_time: contract.work_start_time || '09:00',
      work_end_time: contract.work_end_time || '18:00',
      break_minutes: contract.break_minutes ?? 60,
      contracted_weekly_hours: contract.contracted_weekly_hours ?? 40,
      work_days_per_week: contract.work_days_per_week ?? 5,
      wage_type: contract.wage_type || 'monthly',
      base_salary: contract.base_salary ?? '',
      allowances: Array.isArray(contract.allowances) ? contract.allowances : [],
      payment_day: contract.payment_day ?? 25,
      employment_insurance: contract.employment_insurance ?? true,
      workers_comp: contract.workers_comp ?? true,
      social_insurance: contract.social_insurance === 'not_enrolled' ? false : true,
      notes: contract.notes || '',
    });
  }, [facilityName]);

  const handleNewContract = useCallback(() => {
    setEditingContract(null);
    setFormData(createInitialFormData(facilityName));
    setErrors({});
    setViewMode('form');
  }, [facilityName]);

  const handleEditContract = useCallback((contract: EmploymentContract) => {
    setEditingContract(contract);
    populateFormFromContract(contract);
    setErrors({});
    setViewMode('form');
  }, [populateFormFromContract]);

  const handleViewContract = useCallback((contract: EmploymentContract) => {
    setEditingContract(contract);
    populateFormFromContract(contract);
    setViewMode('preview');
  }, [populateFormFromContract]);

  // 手当の追加/削除
  const addAllowance = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      allowances: [
        ...prev.allowances,
        { id: crypto.randomUUID(), name: '', amount: 0 },
      ],
    }));
  }, []);

  const removeAllowance = useCallback((id: string) => {
    setFormData(prev => ({
      ...prev,
      allowances: prev.allowances.filter(a => a.id !== id),
    }));
  }, []);

  const updateAllowance = useCallback((id: string, field: 'name' | 'amount', value: string | number) => {
    setFormData(prev => ({
      ...prev,
      allowances: prev.allowances.map(a =>
        a.id === id ? { ...a, [field]: value } : a
      ),
    }));
  }, []);

  // ============================================
  // バリデーション
  // ============================================

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.contract_start_date) {
      newErrors.contract_start_date = '契約開始日を入力してください';
    }

    if (formData.contract_type === 'fixed_term' && !formData.contract_end_date) {
      newErrors.contract_end_date = '有期雇用の場合は契約終了日を入力してください';
    }

    if (!formData.work_location.trim()) {
      newErrors.work_location = '就業場所を入力してください';
    }

    if (!formData.work_start_time) {
      newErrors.work_start_time = '始業時刻を入力してください';
    }

    if (!formData.work_end_time) {
      newErrors.work_end_time = '終業時刻を入力してください';
    }

    if (formData.contracted_weekly_hours === '' || formData.contracted_weekly_hours <= 0) {
      newErrors.contracted_weekly_hours = '週所定労働時間を入力してください';
    }

    if (formData.base_salary === '' || formData.base_salary <= 0) {
      newErrors.base_salary = '基本給を入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // ============================================
  // 保存処理
  // ============================================

  const handleSave = useCallback(async (status: 'draft' | 'issued') => {
    if (!validate()) return;

    // emp- prefix のスタッフには労働条件通知書を作成できない
    if (staff.id.startsWith('emp-')) {
      setErrors({ _general: 'このスタッフの労働条件通知書は編集できません。先にスタッフ情報を登録してください。' });
      return;
    }

    setSaving(true);
    try {
      const totalAllowances = formData.allowances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
      const baseSalary = Number(formData.base_salary) || 0;

      const record = {
        facility_id: facilityId,
        staff_id: staff.id,
        user_id: staff.user_id || null,
        contract_type: formData.contract_type,
        contract_start_date: formData.contract_start_date || null,
        contract_end_date: formData.contract_type === 'fixed_term' ? (formData.contract_end_date || null) : null,
        renewal_clause: formData.contract_type === 'fixed_term' ? (formData.renewal_clause || null) : null,
        work_location: formData.work_location.trim(),
        job_description: formData.job_description.trim() || null,
        work_start_time: formData.work_start_time,
        work_end_time: formData.work_end_time,
        break_minutes: Number(formData.break_minutes) || 0,
        contracted_weekly_hours: Number(formData.contracted_weekly_hours) || 0,
        work_days_per_week: Number(formData.work_days_per_week) || 0,
        wage_type: formData.wage_type,
        base_salary: baseSalary,
        allowances: formData.allowances.length > 0
          ? formData.allowances.map(a => ({ id: a.id, name: a.name, amount: Number(a.amount) || 0 }))
          : null,
        total_monthly_salary: formData.wage_type === 'monthly' ? baseSalary + totalAllowances : null,
        hourly_wage: formData.wage_type === 'hourly' ? baseSalary : null,
        payment_day: Number(formData.payment_day) || null,
        social_insurance: formData.social_insurance ? 'enrolled' : 'not_enrolled',
        employment_insurance: formData.employment_insurance,
        workers_comp: formData.workers_comp,
        status,
        issued_at: status === 'issued'
          ? (editingContract?.issued_at || new Date().toISOString())
          : null,
        notes: formData.notes.trim() || null,
      };

      let error;

      if (editingContract) {
        const result = await supabase
          .from('employment_contracts')
          .update(record)
          .eq('id', editingContract.id);
        error = result.error;
      } else {
        const result = await supabase
          .from('employment_contracts')
          .insert(record);
        error = result.error;
      }

      if (error) throw error;

      // 内部状態を先に更新（コールバック後にアンマウントされる可能性があるため）
      await fetchContracts();
      setViewMode('list');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);

      // 発行済みの場合のみ、親コンポーネントに通知
      const weeklyHours = Number(formData.contracted_weekly_hours) || 0;
      if (onContractSaved && weeklyHours > 0 && status !== 'draft') {
        onContractSaved(weeklyHours);
      }
    } catch (err) {
      console.error('Failed to save contract:', err);
      setErrors({ _general: '保存に失敗しました。もう一度お試しください。' });
    } finally {
      setSaving(false);
    }
  }, [validate, formData, facilityId, staff, editingContract, onContractSaved, fetchContracts]);

  // ============================================
  // 印刷
  // ============================================

  const handlePrint = useCallback(() => {
    // 印刷用のスタイルとコンテンツを新しいウィンドウで開く
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=800,height=1100');
    if (!printWindow) {
      toast.warning('ポップアップがブロックされました。ブラウザの設定でポップアップを許可してください。');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <title>労働条件通知書 - ${staff.name}</title>
        <style>
          @page {
            size: A4;
            margin: 15mm 20mm;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #000;
          }
          .print-container {
            max-width: 700px;
            margin: 0 auto;
          }
          h1 {
            text-align: center;
            font-size: 18pt;
            font-weight: bold;
            margin-bottom: 20px;
            letter-spacing: 4px;
          }
          .date-line {
            text-align: right;
            margin-bottom: 16px;
            font-size: 10pt;
          }
          .recipient {
            margin-bottom: 20px;
            font-size: 12pt;
          }
          .issuer {
            text-align: right;
            margin-bottom: 24px;
            font-size: 10pt;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          th, td {
            border: 1px solid #333;
            padding: 6px 10px;
            text-align: left;
            vertical-align: top;
            font-size: 10pt;
          }
          th {
            background-color: #f5f5f5;
            font-weight: bold;
            width: 160px;
            white-space: nowrap;
          }
          .section-header {
            background-color: #e8e8e8;
            font-weight: bold;
            text-align: center;
            font-size: 10.5pt;
          }
          .note {
            font-size: 9pt;
            color: #555;
            margin-top: 16px;
            line-height: 1.5;
          }
          .signature-area {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
          }
          .signature-box {
            width: 45%;
          }
          .signature-box p {
            margin-bottom: 8px;
            font-size: 10pt;
          }
          .signature-line {
            border-bottom: 1px solid #333;
            height: 40px;
            margin-top: 4px;
          }
          .allowance-item {
            display: inline;
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();

    // レンダリング完了を待ってから印刷ダイアログを開く
    setTimeout(() => {
      printWindow.print();
    }, 300);
  }, [staff.name]);

  // ============================================
  // レンダリング
  // ============================================

  if (!isOpen) return null;

  const totalAllowances = formData.allowances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const computedTotalSalary = (Number(formData.base_salary) || 0) + totalAllowances;

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* スライドオーバーパネル */}
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            {viewMode !== 'list' && (
              <button
                onClick={() => { setViewMode('list'); setErrors({}); }}
                className="min-h-10 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                労働条件通知書
              </h2>
              <p className="text-xs text-gray-500">{staff.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-10 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* 成功メッセージ */}
        {saveSuccess && (
          <div className="mx-6 mt-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
            <Check size={16} />
            保存しました
          </div>
        )}

        {/* 汎用エラー */}
        {errors._general && (
          <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle size={16} />
            {errors._general}
          </div>
        )}

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 size={32} className="text-primary animate-spin" />
            </div>
          ) : viewMode === 'list' ? (
            // ==============================
            // 一覧表示
            // ==============================
            <div className="p-6">
              <button
                onClick={handleNewContract}
                className="w-full mb-6 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-primary hover:text-primary transition-colors"
              >
                <Plus size={18} />
                新しい労働条件通知書を作成
              </button>

              {contracts.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <FileText size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-sm">労働条件通知書はまだありません</p>
                  <p className="text-xs mt-1">上のボタンから新規作成できます</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contracts.map(contract => {
                    const style = STATUS_STYLES[contract.status];
                    return (
                      <div
                        key={contract.id}
                        className="border border-gray-200 rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                              {style.label}
                            </span>
                            <span className="text-sm font-medium text-gray-700">
                              {CONTRACT_TYPE_LABELS[contract.contract_type]}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleViewContract(contract); }}
                              className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="プレビュー"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEditContract(contract); }}
                              className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="編集"
                            >
                              <Edit2 size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 space-y-1">
                          <div className="flex items-center gap-4">
                            <span>
                              契約期間: {formatDate(contract.contract_start_date)}
                              {contract.contract_end_date && ` ~ ${formatDate(contract.contract_end_date)}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            {contract.contracted_weekly_hours != null && (
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                週{contract.contracted_weekly_hours}時間
                              </span>
                            )}
                            {contract.base_salary != null && (
                              <span className="flex items-center gap-1">
                                <DollarSign size={12} />
                                {contract.wage_type === 'monthly' ? '月給' : contract.wage_type === 'hourly' ? '時給' : '日給'}
                                {formatCurrency(contract.base_salary)}
                              </span>
                            )}
                          </div>
                          {contract.issued_at && (
                            <div className="text-gray-400">
                              発行日: {formatDate(contract.issued_at)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : viewMode === 'form' ? (
            // ==============================
            // フォーム
            // ==============================
            <div className="p-6 space-y-6">

              {/* 契約種別 */}
              <section>
                <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                  <FileText size={16} />
                  契約種別
                </h3>
                <div className="flex flex-wrap gap-3">
                  {(['indefinite', 'fixed_term', 'parttime'] as ContractType[]).map(type => (
                    <label
                      key={type}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-all ${
                        formData.contract_type === type
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="contract_type"
                        value={type}
                        checked={formData.contract_type === type}
                        onChange={(e) => setFormData({ ...formData, contract_type: e.target.value as ContractType })}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        formData.contract_type === type
                          ? 'border-primary'
                          : 'border-gray-300'
                      }`}>
                        {formData.contract_type === type && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <span className="text-sm font-medium">{CONTRACT_TYPE_LABELS[type]}</span>
                    </label>
                  ))}
                </div>
              </section>

              {/* 契約期間 */}
              <section>
                <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                  <Clock size={16} />
                  契約期間
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        開始日 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.contract_start_date}
                        onChange={(e) => setFormData({ ...formData, contract_start_date: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                          errors.contract_start_date ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.contract_start_date && (
                        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle size={12} />
                          {errors.contract_start_date}
                        </p>
                      )}
                    </div>
                    {formData.contract_type === 'fixed_term' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          終了日 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={formData.contract_end_date}
                          onChange={(e) => setFormData({ ...formData, contract_end_date: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                            errors.contract_end_date ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {errors.contract_end_date && (
                          <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                            <AlertCircle size={12} />
                            {errors.contract_end_date}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {formData.contract_type === 'fixed_term' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">更新条項</label>
                      <input
                        type="text"
                        value={formData.renewal_clause}
                        onChange={(e) => setFormData({ ...formData, renewal_clause: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="例: 業務量・成績等を考慮し更新する場合がある"
                      />
                    </div>
                  )}
                </div>
              </section>

              {/* 就業場所・業務内容 */}
              <section>
                <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                  <FileText size={16} />
                  就業場所・業務内容
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      就業場所 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.work_location}
                      onChange={(e) => setFormData({ ...formData, work_location: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                        errors.work_location ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.work_location && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle size={12} />
                        {errors.work_location}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">業務内容</label>
                    <textarea
                      value={formData.job_description}
                      onChange={(e) => setFormData({ ...formData, job_description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      rows={3}
                      placeholder="例: 児童発達支援に係る療育支援業務、個別支援計画の作成、保護者対応 等"
                    />
                  </div>
                </div>
              </section>

              {/* 労働時間 */}
              <section>
                <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                  <Clock size={16} />
                  労働時間
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        始業 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={formData.work_start_time}
                        onChange={(e) => setFormData({ ...formData, work_start_time: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                          errors.work_start_time ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        終業 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={formData.work_end_time}
                        onChange={(e) => setFormData({ ...formData, work_end_time: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                          errors.work_end_time ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">休憩時間（分）</label>
                    <input
                      type="number"
                      value={formData.break_minutes}
                      onChange={(e) => setFormData({ ...formData, break_minutes: e.target.value ? Number(e.target.value) : '' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="60"
                      min={0}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        週所定労働時間 <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={formData.contracted_weekly_hours}
                          onChange={(e) => setFormData({ ...formData, contracted_weekly_hours: e.target.value ? Number(e.target.value) : '' })}
                          className={`w-full px-3 py-2 pr-16 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                            errors.contracted_weekly_hours ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="40"
                          min={0}
                          max={60}
                          step={0.5}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">時間/週</span>
                      </div>
                      {errors.contracted_weekly_hours && (
                        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle size={12} />
                          {errors.contracted_weekly_hours}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        人員配置の常勤換算に連動します
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        週所定労働日数
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={formData.work_days_per_week}
                          onChange={(e) => setFormData({ ...formData, work_days_per_week: e.target.value ? Number(e.target.value) : '' })}
                          className="w-full px-3 py-2 pr-14 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="5"
                          min={1}
                          max={7}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">日/週</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* 賃金 */}
              <section>
                <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                  <DollarSign size={16} />
                  賃金
                </h3>
                <div className="space-y-4">
                  {/* 月給/時給/日給 切替 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">賃金形態</label>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit">
                      {([
                        { value: 'monthly' as WageType, label: '月給' },
                        { value: 'hourly' as WageType, label: '時給' },
                        { value: 'daily' as WageType, label: '日給' },
                      ]).map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setFormData({ ...formData, wage_type: value })}
                          className={`px-4 py-2 text-sm font-medium transition-colors ${
                            formData.wage_type === value
                              ? 'bg-primary text-white'
                              : 'bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 基本給 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      基本給 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formData.base_salary}
                        onChange={(e) => setFormData({ ...formData, base_salary: e.target.value ? Number(e.target.value) : '' })}
                        className={`w-full px-3 py-2 pr-16 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                          errors.base_salary ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder={formData.wage_type === 'monthly' ? '250000' : formData.wage_type === 'hourly' ? '1500' : '12000'}
                        min={0}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                        {formData.wage_type === 'monthly' ? '円/月' : formData.wage_type === 'hourly' ? '円/時' : '円/日'}
                      </span>
                    </div>
                    {errors.base_salary && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle size={12} />
                        {errors.base_salary}
                      </p>
                    )}
                  </div>

                  {/* 手当 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">手当</label>
                      <button
                        type="button"
                        onClick={addAllowance}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary-dark transition-colors"
                      >
                        <Plus size={14} />
                        手当を追加
                      </button>
                    </div>
                    {formData.allowances.length > 0 ? (
                      <div className="space-y-2">
                        {formData.allowances.map(allowance => (
                          <div key={allowance.id} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={allowance.name}
                              onChange={(e) => updateAllowance(allowance.id, 'name', e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                              placeholder="手当名（例: 通勤手当）"
                            />
                            <div className="relative w-36">
                              <input
                                type="number"
                                value={allowance.amount || ''}
                                onChange={(e) => updateAllowance(allowance.id, 'amount', Number(e.target.value) || 0)}
                                className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                                placeholder="10000"
                                min={0}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">円</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAllowance(allowance.id)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">手当はまだ追加されていません</p>
                    )}
                  </div>

                  {/* 合計表示（月給の場合） */}
                  {formData.wage_type === 'monthly' && formData.base_salary !== '' && (
                    <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                      <span className="text-sm text-gray-600">月額合計</span>
                      <span className="text-lg font-bold text-gray-800">
                        {formatCurrency(computedTotalSalary)}
                      </span>
                    </div>
                  )}

                  {/* 支払日 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">賃金支払日</label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">毎月</span>
                      <input
                        type="number"
                        value={formData.payment_day}
                        onChange={(e) => setFormData({ ...formData, payment_day: parseInt(e.target.value, 10) || '' })}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-center"
                        min={1} max={31}
                        placeholder="25"
                      />
                      <span className="text-sm text-gray-500">日</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* 保険 */}
              <section>
                <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                  <Shield size={16} />
                  社会保険・労働保険
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.social_insurance}
                      onChange={(e) => setFormData({ ...formData, social_insurance: e.target.checked })}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="text-sm text-gray-700">社会保険（健康保険・厚生年金）</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.employment_insurance}
                      onChange={(e) => setFormData({ ...formData, employment_insurance: e.target.checked })}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="text-sm text-gray-700">雇用保険</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.workers_comp}
                      onChange={(e) => setFormData({ ...formData, workers_comp: e.target.checked })}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="text-sm text-gray-700">労災保険</span>
                  </label>
                </div>
              </section>

              {/* 備考 */}
              <section>
                <h3 className="text-sm font-medium text-gray-500 mb-3">備考</h3>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={3}
                  placeholder="特記事項、試用期間の条件など"
                />
              </section>
            </div>
          ) : (
            // ==============================
            // プレビュー (印刷用)
            // ==============================
            <div className="p-6">
              <div className="mb-4 flex items-center gap-2 text-sm text-gray-500 bg-blue-50 border border-blue-100 px-4 py-2 rounded-lg">
                <Eye size={16} className="text-blue-500" />
                印刷プレビュー &#8212; 「印刷」ボタンで印刷できます
              </div>

              {/* 画面上のプレビュー */}
              <div className="border border-gray-200 rounded-lg p-6 bg-white text-sm leading-relaxed">
                <h1 className="text-center text-xl font-bold tracking-widest mb-4">労働条件通知書</h1>
                <p className="text-right text-xs text-gray-500 mb-3">
                  {editingContract?.issued_at ? formatDate(editingContract.issued_at) : formatDate(new Date().toISOString())}
                </p>
                <p className="mb-1 font-medium">{staff.name} 殿</p>
                <p className="text-right text-xs mb-6">{facilityName}</p>

                <table className="w-full border-collapse text-xs">
                  <tbody>
                    <tr className="border border-gray-300">
                      <td colSpan={2} className="bg-gray-100 font-bold text-center py-1.5 border border-gray-300">契約期間</td>
                    </tr>
                    <tr>
                      <th className="border border-gray-300 bg-gray-50 px-3 py-1.5 text-left w-36">契約種別</th>
                      <td className="border border-gray-300 px-3 py-1.5">{CONTRACT_TYPE_LABELS[formData.contract_type]}</td>
                    </tr>
                    <tr>
                      <th className="border border-gray-300 bg-gray-50 px-3 py-1.5 text-left">期間</th>
                      <td className="border border-gray-300 px-3 py-1.5">
                        {formatDate(formData.contract_start_date)}
                        {formData.contract_type === 'fixed_term' && formData.contract_end_date
                          ? ` ~ ${formatDate(formData.contract_end_date)}`
                          : ''}
                      </td>
                    </tr>
                    {formData.contract_type === 'fixed_term' && formData.renewal_clause && (
                      <tr>
                        <th className="border border-gray-300 bg-gray-50 px-3 py-1.5 text-left">更新</th>
                        <td className="border border-gray-300 px-3 py-1.5">{formData.renewal_clause}</td>
                      </tr>
                    )}

                    <tr className="border border-gray-300">
                      <td colSpan={2} className="bg-gray-100 font-bold text-center py-1.5 border border-gray-300">就業場所・業務内容</td>
                    </tr>
                    <tr>
                      <th className="border border-gray-300 bg-gray-50 px-3 py-1.5 text-left">就業場所</th>
                      <td className="border border-gray-300 px-3 py-1.5">{formData.work_location}</td>
                    </tr>
                    <tr>
                      <th className="border border-gray-300 bg-gray-50 px-3 py-1.5 text-left">業務内容</th>
                      <td className="border border-gray-300 px-3 py-1.5 whitespace-pre-wrap">{formData.job_description || '-'}</td>
                    </tr>

                    <tr className="border border-gray-300">
                      <td colSpan={2} className="bg-gray-100 font-bold text-center py-1.5 border border-gray-300">労働時間</td>
                    </tr>
                    <tr>
                      <th className="border border-gray-300 bg-gray-50 px-3 py-1.5 text-left">始業・終業</th>
                      <td className="border border-gray-300 px-3 py-1.5">
                        {formData.work_start_time} ~ {formData.work_end_time}
                      </td>
                    </tr>
                    <tr>
                      <th className="border border-gray-300 bg-gray-50 px-3 py-1.5 text-left">休憩時間</th>
                      <td className="border border-gray-300 px-3 py-1.5">{formData.break_minutes || 0}分</td>
                    </tr>
                    <tr>
                      <th className="border border-gray-300 bg-gray-50 px-3 py-1.5 text-left">週所定労働時間</th>
                      <td className="border border-gray-300 px-3 py-1.5">{formData.contracted_weekly_hours || 0}時間</td>
                    </tr>
                    <tr>
                      <th className="border border-gray-300 bg-gray-50 px-3 py-1.5 text-left">週所定労働日数</th>
                      <td className="border border-gray-300 px-3 py-1.5">{formData.work_days_per_week || 0}日</td>
                    </tr>

                    <tr className="border border-gray-300">
                      <td colSpan={2} className="bg-gray-100 font-bold text-center py-1.5 border border-gray-300">賃金</td>
                    </tr>
                    <tr>
                      <th className="border border-gray-300 bg-gray-50 px-3 py-1.5 text-left">賃金形態</th>
                      <td className="border border-gray-300 px-3 py-1.5">
                        {formData.wage_type === 'monthly' ? '月給制' : formData.wage_type === 'hourly' ? '時給制' : '日給制'}
                      </td>
                    </tr>
                    <tr>
                      <th className="border border-gray-300 bg-gray-50 px-3 py-1.5 text-left">基本給</th>
                      <td className="border border-gray-300 px-3 py-1.5">{formatCurrency(Number(formData.base_salary) || 0)}</td>
                    </tr>
                    {formData.allowances.length > 0 && (
                      <tr>
                        <th className="border border-gray-300 bg-gray-50 px-3 py-1.5 text-left">手当</th>
                        <td className="border border-gray-300 px-3 py-1.5">
                          {formData.allowances.map((a, i) => (
                            <span key={a.id}>
                              {a.name}: {formatCurrency(Number(a.amount) || 0)}
                              {i < formData.allowances.length - 1 ? '、' : ''}
                            </span>
                          ))}
                        </td>
                      </tr>
                    )}
                    {formData.wage_type === 'monthly' && (
                      <tr>
                        <th className="border border-gray-300 bg-gray-50 px-3 py-1.5 text-left">月額合計</th>
                        <td className="border border-gray-300 px-3 py-1.5 font-medium">{formatCurrency(computedTotalSalary)}</td>
                      </tr>
                    )}
                    <tr>
                      <th className="border border-gray-300 bg-gray-50 px-3 py-1.5 text-left">支払日</th>
                      <td className="border border-gray-300 px-3 py-1.5">{formData.payment_day ? `毎月${formData.payment_day}日` : '-'}</td>
                    </tr>

                    <tr className="border border-gray-300">
                      <td colSpan={2} className="bg-gray-100 font-bold text-center py-1.5 border border-gray-300">社会保険・労働保険</td>
                    </tr>
                    <tr>
                      <th className="border border-gray-300 bg-gray-50 px-3 py-1.5 text-left">加入保険</th>
                      <td className="border border-gray-300 px-3 py-1.5">
                        {[
                          formData.social_insurance && '社会保険',
                          formData.employment_insurance && '雇用保険',
                          formData.workers_comp && '労災保険',
                        ].filter(Boolean).join('、') || 'なし'}
                      </td>
                    </tr>

                    {formData.notes && (
                      <>
                        <tr className="border border-gray-300">
                          <td colSpan={2} className="bg-gray-100 font-bold text-center py-1.5 border border-gray-300">その他</td>
                        </tr>
                        <tr>
                          <th className="border border-gray-300 bg-gray-50 px-3 py-1.5 text-left">備考</th>
                          <td className="border border-gray-300 px-3 py-1.5 whitespace-pre-wrap">{formData.notes}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>

                <div className="mt-8 text-xs text-gray-500">
                  <p>上記の労働条件により雇い入れることを通知します。</p>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-8 text-xs">
                  <div>
                    <p className="text-gray-500 mb-1">事業主（署名/押印）</p>
                    <div className="border-b border-gray-300 h-10" />
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">労働者（署名/押印）</p>
                    <div className="border-b border-gray-300 h-10" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 非表示の印刷用コンテンツ */}
        <div className="hidden">
          <div ref={printRef}>
            <div className="print-container">
              <h1>労働条件通知書</h1>
              <p className="date-line">
                {editingContract?.issued_at ? formatDate(editingContract.issued_at) : formatDate(new Date().toISOString())}
              </p>
              <p className="recipient"><strong>{staff.name}</strong> 殿</p>
              <p className="issuer">{facilityName}</p>

              <table>
                <tbody>
                  <tr><td colSpan={2} className="section-header">契約期間</td></tr>
                  <tr>
                    <th>契約種別</th>
                    <td>{CONTRACT_TYPE_LABELS[formData.contract_type]}</td>
                  </tr>
                  <tr>
                    <th>期間</th>
                    <td>
                      {formatDate(formData.contract_start_date)}
                      {formData.contract_type === 'fixed_term' && formData.contract_end_date
                        ? ` ~ ${formatDate(formData.contract_end_date)}`
                        : ''}
                    </td>
                  </tr>
                  {formData.contract_type === 'fixed_term' && formData.renewal_clause && (
                    <tr>
                      <th>更新条項</th>
                      <td>{formData.renewal_clause}</td>
                    </tr>
                  )}

                  <tr><td colSpan={2} className="section-header">就業場所・業務内容</td></tr>
                  <tr>
                    <th>就業場所</th>
                    <td>{formData.work_location}</td>
                  </tr>
                  <tr>
                    <th>業務内容</th>
                    <td>{formData.job_description || '-'}</td>
                  </tr>

                  <tr><td colSpan={2} className="section-header">労働時間</td></tr>
                  <tr>
                    <th>始業・終業</th>
                    <td>{formData.work_start_time} ~ {formData.work_end_time}</td>
                  </tr>
                  <tr>
                    <th>休憩時間</th>
                    <td>{formData.break_minutes || 0}分</td>
                  </tr>
                  <tr>
                    <th>週所定労働時間</th>
                    <td>{formData.contracted_weekly_hours || 0}時間</td>
                  </tr>
                  <tr>
                    <th>週所定労働日数</th>
                    <td>{formData.work_days_per_week || 0}日</td>
                  </tr>

                  <tr><td colSpan={2} className="section-header">賃金</td></tr>
                  <tr>
                    <th>賃金形態</th>
                    <td>{formData.wage_type === 'monthly' ? '月給制' : formData.wage_type === 'hourly' ? '時給制' : '日給制'}</td>
                  </tr>
                  <tr>
                    <th>基本給</th>
                    <td>{formatCurrency(Number(formData.base_salary) || 0)}</td>
                  </tr>
                  {formData.allowances.length > 0 && (
                    <tr>
                      <th>手当</th>
                      <td>
                        {formData.allowances.map((a, i) => (
                          <span key={a.id} className="allowance-item">
                            {a.name}: {formatCurrency(Number(a.amount) || 0)}
                            {i < formData.allowances.length - 1 ? '、' : ''}
                          </span>
                        ))}
                      </td>
                    </tr>
                  )}
                  {formData.wage_type === 'monthly' && (
                    <tr>
                      <th>月額合計</th>
                      <td><strong>{formatCurrency(computedTotalSalary)}</strong></td>
                    </tr>
                  )}
                  <tr>
                    <th>支払日</th>
                    <td>{formData.payment_day ? `毎月${formData.payment_day}日` : '-'}</td>
                  </tr>

                  <tr><td colSpan={2} className="section-header">社会保険・労働保険</td></tr>
                  <tr>
                    <th>加入保険</th>
                    <td>
                      {[
                        formData.social_insurance && '社会保険（健康保険・厚生年金）',
                        formData.employment_insurance && '雇用保険',
                        formData.workers_comp && '労災保険',
                      ].filter(Boolean).join('、') || 'なし'}
                    </td>
                  </tr>

                  {formData.notes && (
                    <>
                      <tr><td colSpan={2} className="section-header">その他</td></tr>
                      <tr>
                        <th>備考</th>
                        <td>{formData.notes}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>

              <p className="note">上記の労働条件により雇い入れることを通知します。</p>

              <div className="signature-area">
                <div className="signature-box">
                  <p>事業主（署名/押印）</p>
                  <div className="signature-line"></div>
                </div>
                <div className="signature-box">
                  <p>労働者（署名/押印）</p>
                  <div className="signature-line"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* フッター */}
        {viewMode !== 'list' && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setViewMode('list'); setErrors({}); }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors text-sm"
              >
                キャンセル
              </button>

              <div className="flex items-center gap-2">
                {viewMode === 'form' ? (
                  <>
                    <button
                      onClick={() => handleSave('draft')}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      下書き保存
                    </button>
                    <button
                      onClick={() => handleSave('issued')}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <FileText size={16} />
                      )}
                      発行する
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        if (editingContract) handleEditContract(editingContract);
                      }}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                    >
                      <Edit2 size={16} />
                      編集
                    </button>
                    <button
                      onClick={handlePrint}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
                    >
                      <Printer size={16} />
                      印刷
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default LaborConditionsPanel;
