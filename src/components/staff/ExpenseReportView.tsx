/**
 * スタッフ経費精算ビュー
 * 領収書アップロード、経費申請、申請履歴確認
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Receipt,
  Plus,
  Camera,
  Upload,
  X,
  Check,
  Clock,
  XCircle,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Expense, ExpenseFormData, ExpenseCategory, CategoryClassification } from '@/types/expense';
import { DEFAULT_EXPENSE_CATEGORIES, getCategoryInfo } from '@/constants/expenseCategories';
import { classifyExpense, suggestCategories } from '@/utils/expenseCategoryClassifier';

type Props = {
  userId: string;
  facilityId: string;
  staffId: string;
  staffName: string;
};

export default function ExpenseReportView({ userId, facilityId, staffId, staffName }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewExpenseModal, setShowNewExpenseModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);

  // 経費申請フォーム
  const [formData, setFormData] = useState<ExpenseFormData>({
    title: '',
    amount: 0,
    expenseDate: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [suggestedCategory, setSuggestedCategory] = useState<CategoryClassification | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 経費一覧を取得
  const fetchExpenses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('staff_id', staffId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setExpenses(
        (data || []).map(row => ({
          id: row.id,
          facilityId: row.facility_id,
          staffId: row.staff_id,
          submittedByUserId: row.submitted_by_user_id,
          title: row.title,
          amount: Number(row.amount),
          expenseDate: row.expense_date,
          category: row.category,
          subcategory: row.subcategory,
          description: row.description,
          receiptUrl: row.receipt_url,
          receiptFileName: row.receipt_file_name,
          receiptFileSize: row.receipt_file_size,
          status: row.status,
          approvedBy: row.approved_by,
          approvedAt: row.approved_at,
          rejectionReason: row.rejection_reason,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))
      );
    } catch (err) {
      console.error('経費取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, [facilityId, staffId]);

  // カテゴリを取得
  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .or(`facility_id.is.null,facility_id.eq.${facilityId}`)
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;

      setCategories(
        (data || []).map(row => ({
          id: row.id,
          facilityId: row.facility_id,
          name: row.name,
          parentId: row.parent_id,
          keywords: row.keywords || [],
          icon: row.icon,
          color: row.color,
          isActive: row.is_active,
          displayOrder: row.display_order,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))
      );
    } catch (err) {
      console.error('カテゴリ取得エラー:', err);
    }
  }, [facilityId]);

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
  }, [fetchExpenses, fetchCategories]);

  // 説明文が変更されたらカテゴリを自動推定
  useEffect(() => {
    if (formData.description && formData.description.length > 2) {
      const classification = classifyExpense(formData.description, categories);
      setSuggestedCategory(classification);

      // 自動的にカテゴリを設定（ユーザーが未選択の場合のみ）
      if (!formData.category && classification.confidence > 0.3) {
        setFormData(prev => ({ ...prev, category: classification.categoryId }));
      }
    } else {
      setSuggestedCategory(null);
    }
  }, [formData.description, categories, formData.category]);

  // 領収書ファイル選択
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイルサイズチェック (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('ファイルサイズは10MB以下にしてください');
      return;
    }

    // ファイルタイプチェック
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      alert('画像またはPDFファイルを選択してください');
      return;
    }

    setReceiptFile(file);

    // プレビュー生成
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setReceiptPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setReceiptPreview(null);
    }
  };

  // 経費申請を送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.amount || !formData.category) {
      alert('必須項目を入力してください');
      return;
    }

    setSubmitting(true);

    try {
      let receiptUrl = '';
      let receiptFileName = '';
      let receiptFileSize = 0;

      // 領収書をアップロード
      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${facilityId}/${staffId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('expense-receipts')
          .upload(fileName, receiptFile);

        if (uploadError) {
          console.error('領収書アップロードエラー:', uploadError);
          // アップロード失敗でも続行（任意項目のため）
        } else {
          const { data: urlData } = supabase.storage
            .from('expense-receipts')
            .getPublicUrl(fileName);
          receiptUrl = urlData.publicUrl;
          receiptFileName = receiptFile.name;
          receiptFileSize = receiptFile.size;
        }
      }

      // 経費を登録
      const { error } = await supabase.from('expenses').insert({
        facility_id: facilityId,
        staff_id: staffId,
        submitted_by_user_id: userId,
        title: formData.title,
        amount: formData.amount,
        expense_date: formData.expenseDate,
        category: formData.category,
        subcategory: formData.subcategory,
        description: formData.description,
        receipt_url: receiptUrl || null,
        receipt_file_name: receiptFileName || null,
        receipt_file_size: receiptFileSize || null,
        status: 'pending',
      });

      if (error) throw error;

      // フォームをリセット
      setFormData({
        title: '',
        amount: 0,
        expenseDate: new Date().toISOString().split('T')[0],
        category: '',
        description: '',
      });
      setReceiptFile(null);
      setReceiptPreview(null);
      setSuggestedCategory(null);
      setShowNewExpenseModal(false);

      // 一覧を更新
      fetchExpenses();
    } catch (err) {
      console.error('経費申請エラー:', err);
      alert('経費の申請に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  // ステータスバッジ
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">
            <Clock className="w-3 h-3" />
            承認待ち
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
            <Check className="w-3 h-3" />
            承認済
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">
            <XCircle className="w-3 h-3" />
            却下
          </span>
        );
      default:
        return null;
    }
  };

  // カテゴリ名を取得
  const getCategoryName = (categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    if (category) return category.name;

    const defaultCat = getCategoryInfo(categoryId);
    return defaultCat?.name || categoryId;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#818CF8]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-[#818CF8] to-[#6366F1] rounded-xl p-4 text-white">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Receipt className="w-5 h-5" />
          経費精算
        </h2>
        <p className="text-sm text-white/80 mt-1">
          領収書を撮影して、経費を申請しましょう
        </p>
      </div>

      {/* 新規申請ボタン */}
      <button
        onClick={() => setShowNewExpenseModal(true)}
        className="w-full flex items-center justify-center gap-2 py-4 bg-white border-2 border-dashed border-[#818CF8] rounded-xl text-[#818CF8] font-bold hover:bg-[#818CF8]/5 transition-colors"
      >
        <Plus className="w-5 h-5" />
        新規経費申請
      </button>

      {/* 申請履歴 */}
      <div>
        <h3 className="text-sm font-bold text-gray-600 mb-3">申請履歴</h3>
        {expenses.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-8 text-center">
            <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">まだ経費申請がありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {expenses.map((expense) => (
              <div
                key={expense.id}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-800">{expense.title}</span>
                      {getStatusBadge(expense.status)}
                    </div>
                    <div className="text-sm text-gray-500">
                      <span>{expense.expenseDate}</span>
                      <span className="mx-2">•</span>
                      <span>{getCategoryName(expense.category)}</span>
                    </div>
                    {expense.description && (
                      <p className="text-sm text-gray-600 mt-1">{expense.description}</p>
                    )}
                    {expense.status === 'rejected' && expense.rejectionReason && (
                      <div className="mt-2 p-2 bg-red-50 rounded-lg text-sm text-red-700">
                        却下理由: {expense.rejectionReason}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-800">
                      ¥{expense.amount.toLocaleString()}
                    </div>
                    {expense.receiptUrl && (
                      <button
                        onClick={() => window.open(expense.receiptUrl, '_blank')}
                        className="text-xs text-[#818CF8] hover:underline mt-1"
                      >
                        領収書を見る
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新規経費申請モーダル */}
      {showNewExpenseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">新規経費申請</h3>
              <button
                onClick={() => setShowNewExpenseModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* 領収書アップロード */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  領収書
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {receiptPreview ? (
                  <div className="relative">
                    <img
                      src={receiptPreview}
                      alt="領収書プレビュー"
                      className="w-full h-48 object-contain bg-gray-100 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptFile(null);
                        setReceiptPreview(null);
                      }}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : receiptFile ? (
                  <div className="p-4 bg-gray-100 rounded-lg flex items-center gap-3">
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {receiptFile.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(receiptFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReceiptFile(null)}
                      className="p-1 text-gray-500 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-[#818CF8] hover:bg-[#818CF8]/5 transition-colors"
                  >
                    <Camera className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      タップして領収書を撮影/選択
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      画像またはPDF（10MBまで）
                    </p>
                  </div>
                )}
              </div>

              {/* タイトル */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  経費タイトル <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="例: 電車代、教材購入"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#818CF8]"
                  required
                />
              </div>

              {/* 金額 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  金額 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">¥</span>
                  <input
                    type="number"
                    value={formData.amount || ''}
                    onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#818CF8]"
                    required
                    min="1"
                  />
                </div>
              </div>

              {/* 日付 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  経費発生日 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.expenseDate}
                  onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#818CF8]"
                  required
                />
              </div>

              {/* 用途・説明 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  用途・説明
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="何のための経費か詳しく記入してください"
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#818CF8]"
                />
                {suggestedCategory && suggestedCategory.confidence > 0.3 && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-[#818CF8]">
                    <Sparkles className="w-4 h-4" />
                    <span>
                      「{suggestedCategory.categoryName}」カテゴリが推定されました
                      {suggestedCategory.confidence >= 0.7 && ' (高信頼度)'}
                    </span>
                  </div>
                )}
              </div>

              {/* カテゴリ */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  カテゴリ <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DEFAULT_EXPENSE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, category: cat.id })}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${
                        formData.category === cat.id
                          ? 'border-[#818CF8] bg-[#818CF8]/10'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-bold text-sm text-gray-800">{cat.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 送信ボタン */}
              <button
                type="submit"
                disabled={submitting || !formData.title || !formData.amount || !formData.category}
                className="w-full py-4 bg-[#818CF8] hover:bg-[#6366F1] disabled:bg-gray-300 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    送信中...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    経費を申請する
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
