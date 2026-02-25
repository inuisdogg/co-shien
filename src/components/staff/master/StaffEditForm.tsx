/**
 * スタッフ編集フォーム
 * スタッフの新規作成・編集フォームコンポーネント
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  User,
  Phone,
  Mail,
  AlertCircle,
} from 'lucide-react';
import { Staff } from '@/types';

interface StaffEditFormProps {
  staff?: Staff | null; // null = 新規作成
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Staff>) => Promise<boolean>;
  loading?: boolean;
}

const StaffEditForm: React.FC<StaffEditFormProps> = ({
  staff,
  isOpen,
  onClose,
  onSave,
  loading = false,
}) => {
  const isNew = !staff;

  // フォーム状態
  const [formData, setFormData] = useState({
    name: '',
    nameKana: '',
    type: '常勤' as Staff['type'],
    role: '一般スタッフ' as Staff['role'],
    phone: '',
    email: '',
    permissions: {
      facilityManagement: false,
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // staffが変更されたらフォームをリセット
  useEffect(() => {
    if (staff) {
      setFormData({
        name: staff.name || '',
        nameKana: staff.nameKana || '',
        type: staff.type || '常勤',
        role: staff.role || '一般スタッフ',
        phone: staff.phone || '',
        email: staff.email || '',
        permissions: {
          facilityManagement: (staff as any).permissions?.facilityManagement || false,
        },
      });
    } else {
      // 新規作成時はリセット
      setFormData({
        name: '',
        nameKana: '',
        type: '常勤',
        role: '一般スタッフ',
        phone: '',
        email: '',
        permissions: {
          facilityManagement: false,
        },
      });
    }
    setErrors({});
  }, [staff, isOpen]);

  // バリデーション
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '名前を入力してください';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '有効なメールアドレスを入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 保存処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const data: Partial<Staff> & { permissions?: Record<string, boolean> } = {
      name: formData.name.trim(),
      nameKana: formData.nameKana.trim() || undefined,
      type: formData.type,
      role: formData.role,
      phone: formData.phone.trim() || undefined,
      email: formData.email.trim() || undefined,
      permissions: formData.role === '管理者'
        ? { facilityManagement: true } // 管理者は自動的に有効
        : formData.permissions,
    };

    const success = await onSave(data);
    if (success) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* モーダル */}
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">
            {isNew ? 'スタッフを追加' : 'スタッフを編集'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* 基本情報 */}
            <section>
              <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
                <User size={16} />
                基本情報
              </h3>

              <div className="space-y-4">
                {/* 名前 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    名前 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                      errors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="山田 太郎"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle size={14} />
                      {errors.name}
                    </p>
                  )}
                </div>

                {/* かな */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ふりがな
                  </label>
                  <input
                    type="text"
                    value={formData.nameKana}
                    onChange={(e) => setFormData({ ...formData, nameKana: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="やまだ たろう"
                  />
                </div>

                {/* 職種・役割 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      雇用形態
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({ ...formData, type: e.target.value as Staff['type'] })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="常勤">常勤</option>
                      <option value="非常勤">非常勤</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      権限
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) =>
                        setFormData({ ...formData, role: e.target.value as Staff['role'] })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="管理者">管理者</option>
                      <option value="マネージャー">マネージャー</option>
                      <option value="一般スタッフ">一般スタッフ</option>
                    </select>
                  </div>
                </div>

                {/* 施設管理アクセス権（管理者以外に表示） */}
                {formData.role !== '管理者' && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.permissions.facilityManagement}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            permissions: {
                              ...formData.permissions,
                              facilityManagement: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 text-teal-500 border-gray-300 rounded focus:ring-teal-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">施設管理画面へのアクセス</span>
                        <p className="text-xs text-gray-500">有効にすると、キャリアアプリから施設管理画面にアクセスできます</p>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </section>

            {/* 連絡先 */}
            <section>
              <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
                <Phone size={16} />
                連絡先
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    電話番号
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="090-1234-5678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <Mail size={14} />
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="yamada@example.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle size={14} />
                      {errors.email}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* 備考 */}
            <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
              ※ 資格・経験・勤務形態などの詳細は「人員配置管理」で設定できます。
            </p>
          </div>
        </form>

        {/* フッター */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={loading}
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save size={18} />
                  {isNew ? '追加' : '保存'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default StaffEditForm;
