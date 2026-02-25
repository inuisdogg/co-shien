/**
 * 児童プロファイル登録ページ（利用者向け）
 * 保護者が自分の子供の情報を登録する
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { AlertCircle, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { calculateAgeWithMonths } from '@/utils/ageCalculation';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

type ChildFormData = {
  // 基本情報
  name: string;
  nameKana: string;
  birthDate: string;
  gender: 'male' | 'female' | 'other' | '';
  // 受給者証情報
  beneficiaryNumber: string;
  grantDays: number | '';
  // 連絡先
  address: string;
  phone: string;
  email: string;
  // 医療情報
  doctorName: string;
  doctorClinic: string;
  // 通園情報
  schoolName: string;
  // 特性・メモ
  characteristics: string;
};

export default function ChildRegisterPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    certificate: true,
    contact: false,
    medical: false,
    school: false,
    characteristics: false,
  });

  const [formData, setFormData] = useState<ChildFormData>({
    name: '',
    nameKana: '',
    birthDate: '',
    gender: '',
    beneficiaryNumber: '',
    grantDays: '',
    address: '',
    phone: '',
    email: '',
    doctorName: '',
    doctorClinic: '',
    schoolName: '',
    characteristics: '',
  });

  // ユーザー情報を取得
  useEffect(() => {
    const fetchUser = async () => {
      try {
        // まずlocalStorageのuserデータをチェック（利用者ログインではSupabase Authのセッションがない可能性があるため）
        const userStr = localStorage.getItem('user');
        let userId: string | null = null;
        
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            if (user?.id && user?.userType === 'client') {
              userId = user.id;
            } else if (user?.id && user?.userType !== 'client') {
              // 利用者アカウントでない場合はスタッフダッシュボードへ
              router.push('/career');
              return;
            }
          } catch (e) {
            console.error('localStorage user parse error:', e);
          }
        }

        // Supabase Authのセッションもチェック（メール認証後の場合）
        if (!userId) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            userId = session.user.id;
          }
        }

        // どちらもない場合はログインページへ
        if (!userId) {
          router.push('/parent/login');
          return;
        }

        // usersテーブルからユーザー情報を取得
        const { data: userData, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (error || !userData) {
          router.push('/parent/login');
          return;
        }

        // 利用者アカウントかチェック（重要：スタッフアカウントは絶対に除外）
        if (userData.user_type !== 'client') {
          // スタッフアカウントの場合はスタッフダッシュボードへ
          router.push('/career');
          return;
        }

        setCurrentUser(userData);

        // 保護者の連絡先を初期値として設定
        setFormData(prev => ({
          ...prev,
          phone: userData.phone || '',
          email: userData.email || '',
        }));
      } catch (err: any) {
        console.error('User fetch error:', err);
        router.push('/parent/login');
      }
    };

    fetchUser();
  }, [router]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // バリデーション
    if (!formData.name) {
      setError('児童氏名を入力してください');
      return;
    }

    if (!formData.birthDate) {
      setError('生年月日を入力してください');
      return;
    }

    if (!currentUser) {
      setError('ログイン情報が取得できません');
      return;
    }

    setLoading(true);
    try {
      const childId = `c${Date.now()}`;
      const now = new Date().toISOString();
      const ageInfo = calculateAgeWithMonths(formData.birthDate);

      const { error: insertError } = await supabase
        .from('children')
        .insert({
          id: childId,
          owner_profile_id: currentUser.id, // 保護者と紐付け
          facility_id: null, // 施設未紐付け
          name: formData.name,
          name_kana: formData.nameKana || null,
          birth_date: formData.birthDate,
          age: ageInfo.years,
          gender: formData.gender || null,
          // 保護者情報（ログインユーザーの情報を使用）
          guardian_name: currentUser.name,
          guardian_name_kana: currentUser.last_name_kana && currentUser.first_name_kana
            ? `${currentUser.last_name_kana} ${currentUser.first_name_kana}`
            : null,
          // 受給者証情報
          beneficiary_number: formData.beneficiaryNumber || null,
          grant_days: formData.grantDays || null,
          // 連絡先
          address: formData.address || null,
          phone: formData.phone || null,
          email: formData.email || null,
          // 医療情報
          doctor_name: formData.doctorName || null,
          doctor_clinic: formData.doctorClinic || null,
          // 通園情報
          school_name: formData.schoolName || null,
          // 特性・メモ
          characteristics: formData.characteristics || null,
          // 契約ステータス
          contract_status: 'pre-contract', // 契約前
          // メタデータ
          created_at: now,
          updated_at: now,
        });

      if (insertError) {
        throw new Error(`児童登録エラー: ${insertError.message}`);
      }

      setSuccess(true);

      // 2秒後にダッシュボードにリダイレクト
      setTimeout(() => {
        router.push('/parent');
      }, 2000);
    } catch (err: any) {
      setError(err.message || '児童登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FBBF6A] to-[#F6AD55] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">登録完了</h2>
          <p className="text-gray-600 text-sm">
            お子様の情報を登録しました。<br />
            ダッシュボードに移動します...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/parent')}
            className="text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <Image
            src="/logo.svg"
            alt="Roots"
            width={120}
            height={40}
            className="h-8 w-auto"
          />
          <h1 className="text-lg font-bold text-gray-800">お子様の登録</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 基本情報セクション */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('basic')}
              className="w-full px-4 py-3 flex items-center justify-between bg-[#FEF3E2] text-orange-800 font-bold"
            >
              <span>基本情報</span>
              {expandedSections.basic ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {expandedSections.basic && (
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    児童氏名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F6AD55]"
                    placeholder="山田 花子"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    フリガナ
                  </label>
                  <input
                    type="text"
                    value={formData.nameKana}
                    onChange={(e) => setFormData({ ...formData, nameKana: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F6AD55]"
                    placeholder="ヤマダ ハナコ"
                    disabled={loading}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      生年月日 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.birthDate}
                      onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F6AD55]"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      年齢
                    </label>
                    <div className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
                      {formData.birthDate ? calculateAgeWithMonths(formData.birthDate).display : '-'}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    性別
                  </label>
                  <div className="flex gap-4">
                    {[
                      { value: 'male', label: '男の子' },
                      { value: 'female', label: '女の子' },
                      { value: 'other', label: 'その他' },
                    ].map((option) => (
                      <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="gender"
                          value={option.value}
                          checked={formData.gender === option.value}
                          onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                          className="text-[#F6AD55] focus:ring-[#F6AD55]"
                          disabled={loading}
                        />
                        <span className="text-sm text-gray-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 受給者証情報セクション */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('certificate')}
              className="w-full px-4 py-3 flex items-center justify-between bg-[#FEF3E2] text-orange-800 font-bold"
            >
              <span>受給者証情報</span>
              {expandedSections.certificate ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {expandedSections.certificate && (
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    受給者証番号
                  </label>
                  <input
                    type="text"
                    value={formData.beneficiaryNumber}
                    onChange={(e) => setFormData({ ...formData, beneficiaryNumber: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F6AD55]"
                    placeholder="10桁の番号"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    受給者証をお持ちの場合は番号を入力してください
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    支給日数（月間）
                  </label>
                  <input
                    type="number"
                    value={formData.grantDays}
                    onChange={(e) => setFormData({ ...formData, grantDays: e.target.value ? parseInt(e.target.value) : '' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F6AD55]"
                    placeholder="例: 23"
                    min="0"
                    max="31"
                    disabled={loading}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 連絡先セクション */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('contact')}
              className="w-full px-4 py-3 flex items-center justify-between bg-gray-100 text-gray-800 font-bold"
            >
              <span>連絡先</span>
              {expandedSections.contact ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {expandedSections.contact && (
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    住所
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F6AD55]"
                    placeholder="東京都渋谷区..."
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    電話番号
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F6AD55]"
                    placeholder="090-1234-5678"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F6AD55]"
                    placeholder="example@email.com"
                    disabled={loading}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 医療情報セクション */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('medical')}
              className="w-full px-4 py-3 flex items-center justify-between bg-gray-100 text-gray-800 font-bold"
            >
              <span>医療情報（任意）</span>
              {expandedSections.medical ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {expandedSections.medical && (
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    かかりつけ医名
                  </label>
                  <input
                    type="text"
                    value={formData.doctorName}
                    onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F6AD55]"
                    placeholder="山田 太郎 先生"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    医療機関名
                  </label>
                  <input
                    type="text"
                    value={formData.doctorClinic}
                    onChange={(e) => setFormData({ ...formData, doctorClinic: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F6AD55]"
                    placeholder="〇〇クリニック"
                    disabled={loading}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 通園情報セクション */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('school')}
              className="w-full px-4 py-3 flex items-center justify-between bg-gray-100 text-gray-800 font-bold"
            >
              <span>通園情報（任意）</span>
              {expandedSections.school ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {expandedSections.school && (
              <div className="p-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    通園場所名（学校・幼稚園等）
                  </label>
                  <input
                    type="text"
                    value={formData.schoolName}
                    onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F6AD55]"
                    placeholder="〇〇幼稚園"
                    disabled={loading}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 特性・メモセクション */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('characteristics')}
              className="w-full px-4 py-3 flex items-center justify-between bg-gray-100 text-gray-800 font-bold"
            >
              <span>特性・メモ（任意）</span>
              {expandedSections.characteristics ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {expandedSections.characteristics && (
              <div className="p-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    お子様の特性やアレルギーなど
                  </label>
                  <textarea
                    value={formData.characteristics}
                    onChange={(e) => setFormData({ ...formData, characteristics: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F6AD55]"
                    placeholder="アレルギー、配慮が必要な点、得意なこと、苦手なことなど"
                    disabled={loading}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 送信ボタン */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#F6AD55] hover:bg-[#ED8936] text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '登録中...' : 'お子様を登録する'}
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-gray-500 mt-6">
          登録後、施設との契約手続きを進めることができます
        </p>
      </main>
    </div>
  );
}
