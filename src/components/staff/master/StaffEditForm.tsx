/**
 * スタッフ編集フォーム
 * スタッフの新規作成・編集フォームコンポーネント
 * 新規作成時は「代理アカウント作成」モードで、usersテーブル + staff + employment_recordsを一括作成
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
  Link2,
  Copy,
  Check,
  Briefcase,
  Calendar,
  Award,
  DollarSign,
} from 'lucide-react';
import { Staff } from '@/types';
import { parseQualifications } from '@/utils/qualifications';
import { isValidEmail } from '@/utils/validation';
import { useToast } from '@/components/ui/Toast';

interface StaffEditFormProps {
  staff?: Staff | null; // null = 新規作成
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Staff>) => Promise<boolean>;
  onProxyCreate?: (data: ProxyFormData) => Promise<{ token: string; url: string } | null>;
  loading?: boolean;
}

// 代理作成用のデータ型
export interface ProxyFormData {
  name: string;
  nameKana: string;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  type: '常勤' | '非常勤';
  role: '一般スタッフ' | 'マネージャー' | '管理者';
  phone: string;
  email: string;
  birthDate: string;
  gender: 'male' | 'female' | 'other' | '';
  qualifications: string;
  facilityRole: string;
  position: string;
  department: string;
  monthlySalary: number | '';
  hourlyWage: number | '';
  startDate: string;
  memo: string;
  permissions: {
    facilityManagement: boolean;
  };
}

const StaffEditForm: React.FC<StaffEditFormProps> = ({
  staff,
  isOpen,
  onClose,
  onSave,
  onProxyCreate,
  loading = false,
}) => {
  const isNew = !staff;
  const { toast } = useToast();

  // フォーム状態
  const [formData, setFormData] = useState<ProxyFormData>({
    name: '',
    nameKana: '',
    lastName: '',
    firstName: '',
    lastNameKana: '',
    firstNameKana: '',
    type: '常勤',
    role: '一般スタッフ',
    phone: '',
    email: '',
    birthDate: '',
    gender: '',
    qualifications: '',
    facilityRole: '',
    position: '',
    department: '',
    monthlySalary: '',
    hourlyWage: '',
    startDate: new Date().toISOString().split('T')[0],
    memo: '',
    permissions: {
      facilityManagement: false,
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [inviteResult, setInviteResult] = useState<{ token: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // staffが変更されたらフォームをリセット
  useEffect(() => {
    if (staff) {
      setFormData({
        name: staff.name || '',
        nameKana: staff.nameKana || '',
        lastName: staff.lastName || '',
        firstName: staff.firstName || '',
        lastNameKana: staff.lastNameKana || '',
        firstNameKana: staff.firstNameKana || '',
        type: staff.type || '常勤',
        role: staff.role || '一般スタッフ',
        phone: staff.phone || '',
        email: staff.email || '',
        birthDate: (staff as any).birthDate || '',
        gender: '',
        qualifications: Array.isArray(staff.qualifications) ? staff.qualifications.join(', ') : (staff.qualifications || ''),
        facilityRole: staff.facilityRole || '',
        position: staff.position || '',
        department: staff.department || '',
        monthlySalary: staff.monthlySalary || '',
        hourlyWage: staff.hourlyWage || '',
        startDate: '',
        memo: staff.memo || '',
        permissions: {
          facilityManagement: (staff as any).permissions?.facilityManagement || false,
        },
      });
    } else {
      // 新規作成時はリセット
      setFormData({
        name: '',
        nameKana: '',
        lastName: '',
        firstName: '',
        lastNameKana: '',
        firstNameKana: '',
        type: '常勤',
        role: '一般スタッフ',
        phone: '',
        email: '',
        birthDate: '',
        gender: '',
        qualifications: '',
        facilityRole: '',
        position: '',
        department: '',
        monthlySalary: '',
        hourlyWage: '',
        startDate: new Date().toISOString().split('T')[0],
        memo: '',
        permissions: {
          facilityManagement: false,
        },
      });
    }
    setErrors({});
    setInviteResult(null);
    setCopied(false);
  }, [staff, isOpen]);

  // 姓名が変更されたら名前を自動更新
  useEffect(() => {
    if (isNew && formData.lastName && formData.firstName) {
      setFormData(prev => ({
        ...prev,
        name: `${prev.lastName} ${prev.firstName}`,
      }));
    }
  }, [formData.lastName, formData.firstName, isNew]);

  // カナが変更されたらnameKanaを自動更新
  useEffect(() => {
    if (isNew && formData.lastNameKana && formData.firstNameKana) {
      setFormData(prev => ({
        ...prev,
        nameKana: `${prev.lastNameKana} ${prev.firstNameKana}`,
      }));
    }
  }, [formData.lastNameKana, formData.firstNameKana, isNew]);

  // バリデーション
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (isNew) {
      if (!formData.lastName.trim()) {
        newErrors.lastName = '姓を入力してください';
      }
      if (!formData.firstName.trim()) {
        newErrors.firstName = '名を入力してください';
      }
      if (!formData.startDate) {
        newErrors.startDate = '入社日を入力してください';
      }
    } else {
      if (!formData.name.trim()) {
        newErrors.name = '名前を入力してください';
      }
    }

    if (formData.email && !isValidEmail(formData.email)) {
      newErrors.email = '有効なメールアドレスを入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 保存処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (isNew && onProxyCreate) {
      // 新規作成 → 代理アカウント作成
      const result = await onProxyCreate(formData);
      if (result) {
        setInviteResult(result);
      }
    } else {
      // 既存編集
      const data: Partial<Staff> & { permissions?: Record<string, boolean> } = {
        name: formData.name.trim(),
        nameKana: formData.nameKana.trim() || undefined,
        type: formData.type,
        role: formData.role,
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        qualifications: formData.qualifications.trim() ? parseQualifications(formData.qualifications) : undefined,
        facilityRole: formData.facilityRole.trim() || undefined,
        position: formData.position.trim() || undefined,
        department: formData.department.trim() || undefined,
        monthlySalary: formData.monthlySalary ? Number(formData.monthlySalary) : undefined,
        hourlyWage: formData.hourlyWage ? Number(formData.hourlyWage) : undefined,
        memo: formData.memo.trim() || undefined,
        permissions: formData.role === '管理者'
          ? { facilityManagement: true }
          : formData.permissions,
      };
      const success = await onSave(data);
      if (success) {
        onClose();
      }
    }
  };

  // URLコピー
  const handleCopyUrl = async () => {
    if (!inviteResult) return;
    try {
      await navigator.clipboard.writeText(inviteResult.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('URLのコピーに失敗しました');
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <User size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                {isNew ? 'スタッフを代理登録' : 'スタッフを編集'}
              </h2>
              {isNew && (
                <p className="text-xs text-gray-500">職員情報を入力してアカウントを代理作成します</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-10 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200"
          >
            <X size={20} />
          </button>
        </div>

        {inviteResult ? (
          // 作成成功 → アクティベーションリンク表示
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                代理アカウントを作成しました
              </h3>
              <p className="text-gray-600 text-sm mb-6">
                <span className="font-medium">{formData.name}</span>さんの
                アカウントを作成しました。以下のリンクを本人に共有して、
                パスワードを設定してもらってください。
              </p>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  <Link2 size={14} className="inline mr-1" />
                  アクティベーションURL（30日間有効）
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inviteResult.url}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-600 truncate"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                      copied
                        ? 'bg-green-100 text-green-700'
                        : 'bg-primary text-white hover:bg-primary-dark'
                    }`}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'コピー済み' : 'コピー'}
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-6">
                本人がリンクを開いてパスワードを設定すると、
                アカウントが有効化されてログインできるようになります。
              </p>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    setInviteResult(null);
                    setFormData(prev => ({
                      ...prev,
                      name: '', nameKana: '', lastName: '', firstName: '',
                      lastNameKana: '', firstNameKana: '',
                      phone: '', email: '', birthDate: '', gender: '',
                      qualifications: '', facilityRole: '', position: '', department: '',
                      monthlySalary: '', hourlyWage: '', memo: '',
                    }));
                  }}
                  className="text-sm text-primary hover:text-primary-dark"
                >
                  別のスタッフを登録
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
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
                    {isNew ? (
                      <>
                        {/* 姓名（新規時） */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              姓 <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={formData.lastName}
                              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                                errors.lastName ? 'border-red-500' : 'border-gray-300'
                              }`}
                              placeholder="山田"
                            />
                            {errors.lastName && (
                              <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                                <AlertCircle size={14} />
                                {errors.lastName}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              名 <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={formData.firstName}
                              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                                errors.firstName ? 'border-red-500' : 'border-gray-300'
                              }`}
                              placeholder="太郎"
                            />
                            {errors.firstName && (
                              <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                                <AlertCircle size={14} />
                                {errors.firstName}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* フリガナ */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">セイ</label>
                            <input
                              type="text"
                              value={formData.lastNameKana}
                              onChange={(e) => setFormData({ ...formData, lastNameKana: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                              placeholder="ヤマダ"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">メイ</label>
                            <input
                              type="text"
                              value={formData.firstNameKana}
                              onChange={(e) => setFormData({ ...formData, firstNameKana: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                              placeholder="タロウ"
                            />
                          </div>
                        </div>

                        {/* 生年月日・性別 */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">生年月日</label>
                            <input
                              type="date"
                              value={formData.birthDate}
                              onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">性別</label>
                            <select
                              value={formData.gender}
                              onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              <option value="">選択してください</option>
                              <option value="female">女性</option>
                              <option value="male">男性</option>
                              <option value="other">その他</option>
                            </select>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* 名前（編集時） */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            名前 <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
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
                          <label className="block text-sm font-medium text-gray-700 mb-1">ふりがな</label>
                          <input
                            type="text"
                            value={formData.nameKana}
                            onChange={(e) => setFormData({ ...formData, nameKana: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="やまだ たろう"
                          />
                        </div>
                      </>
                    )}

                    {/* 雇用形態・権限 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">雇用形態</label>
                        <select
                          value={formData.type}
                          onChange={(e) => setFormData({ ...formData, type: e.target.value as Staff['type'] })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="常勤">常勤</option>
                          <option value="非常勤">非常勤</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">権限</label>
                        <select
                          value={formData.role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value as Staff['role'] })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="管理者">管理者</option>
                          <option value="マネージャー">マネージャー</option>
                          <option value="一般スタッフ">一般スタッフ</option>
                        </select>
                      </div>
                    </div>

                    {/* 施設管理アクセス権 */}
                    {formData.role !== '管理者' && (
                      <div className="p-3 bg-gray-50 rounded-lg">
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
                            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
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

                {/* 雇用・職務情報 */}
                <section>
                  <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
                    <Briefcase size={16} />
                    雇用・職務情報
                  </h3>

                  <div className="space-y-4">
                    {/* 入社日（新規作成時のみ） */}
                    {isNew && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          <Calendar size={14} className="inline mr-1" />
                          入社日 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                            errors.startDate ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {errors.startDate && (
                          <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                            <AlertCircle size={14} />
                            {errors.startDate}
                          </p>
                        )}
                      </div>
                    )}

                    {/* 施設での役割 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">施設での役割</label>
                      <input
                        type="text"
                        value={formData.facilityRole}
                        onChange={(e) => setFormData({ ...formData, facilityRole: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="例: 児童発達支援管理責任者, 保育士, 指導員"
                      />
                    </div>

                    {/* 役職・部門 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">役職</label>
                        <input
                          type="text"
                          value={formData.position}
                          onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="例: 施設長, 主任, リーダー"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">部門・チーム</label>
                        <input
                          type="text"
                          value={formData.department}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="例: 療育チーム, 事務, 送迎"
                        />
                      </div>
                    </div>

                    {/* 資格 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Award size={14} className="inline mr-1" />
                        資格
                      </label>
                      <input
                        type="text"
                        value={formData.qualifications}
                        onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="例: 保育士, 理学療法士（カンマ区切りで複数入力可）"
                      />
                    </div>

                    {/* 給与 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <DollarSign size={14} className="inline mr-1" />
                        {formData.type === '常勤' ? '月給' : '時給'}
                      </label>
                      {formData.type === '常勤' ? (
                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            max={2000000}
                            value={formData.monthlySalary}
                            onChange={(e) => setFormData({ ...formData, monthlySalary: e.target.value ? Number(e.target.value) : '' })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="250000"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">円/月</span>
                        </div>
                      ) : (
                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            max={10000}
                            value={formData.hourlyWage}
                            onChange={(e) => setFormData({ ...formData, hourlyWage: e.target.value ? Number(e.target.value) : '' })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="1500"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">円/時</span>
                        </div>
                      )}
                    </div>

                    {/* 備考 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                      <textarea
                        value={formData.memo}
                        onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                        rows={2}
                        placeholder="給与内訳、特記事項など"
                      />
                    </div>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
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
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
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

                {/* 代理作成の説明 */}
                {isNew && (
                  <div className="text-sm text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <p className="font-medium text-blue-700 mb-1">代理アカウント作成について</p>
                    <p className="text-blue-600 text-xs">
                      登録後にアクティベーションURLが発行されます。
                      URLを本人に共有し、パスワードを設定してもらうとアカウントが有効化されます。
                      有効化前でもスタッフ一覧には表示されます。
                    </p>
                  </div>
                )}
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
                  className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {isNew ? '作成中...' : '保存中...'}
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      {isNew ? '代理登録' : '保存'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default StaffEditForm;
