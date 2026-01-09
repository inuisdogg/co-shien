/**
 * 利用者（保護者）向け新規登録ページ
 * 施設ID不要で利用者アカウントを作成
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

export default function ClientSignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    lastNameKana: '',
    firstNameKana: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreedToTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // バリデーション
    if (formData.password !== formData.confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    if (formData.password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }

    if (!formData.agreedToTerms) {
      setError('利用規約に同意してください');
      return;
    }

    if (!formData.lastName || !formData.firstName) {
      setError('姓と名を入力してください');
      return;
    }

    if (!formData.lastNameKana || !formData.firstNameKana) {
      setError('姓と名のフリガナを入力してください');
      return;
    }

    if (!formData.phone) {
      setError('電話番号を入力してください');
      return;
    }

    if (!formData.email) {
      setError('メールアドレスを入力してください');
      return;
    }

    // 名前を結合（後方互換性のため）
    const fullName = `${formData.lastName} ${formData.firstName}`;

    setLoading(true);
    try {
      // 既存のセッションをクリア
      await supabase.auth.signOut();
      localStorage.removeItem('user');
      localStorage.removeItem('selectedFacility');

      // 重複チェック：メールアドレス
      const { data: existingUserByEmail, error: emailCheckError } = await supabase
        .from('users')
        .select('id, email, name, login_id')
        .eq('email', formData.email.trim().toLowerCase())
        .maybeSingle();

      if (emailCheckError && emailCheckError.code !== 'PGRST116') {
        throw new Error(`ユーザー確認エラー: ${emailCheckError.message}`);
      }

      if (existingUserByEmail) {
        throw new Error('このメールアドレスは既に登録されています');
      }

      // 重複チェック：ログインID（メールアドレスと同じ値）
      const { data: existingUserByLoginId, error: loginIdCheckError } = await supabase
        .from('users')
        .select('id, email, name, login_id')
        .eq('login_id', formData.email.trim().toLowerCase())
        .maybeSingle();

      if (loginIdCheckError && loginIdCheckError.code !== 'PGRST116') {
        throw new Error(`ログインID確認エラー: ${loginIdCheckError.message}`);
      }

      if (existingUserByLoginId) {
        throw new Error('このメールアドレスは既にログインIDとして使用されています');
      }

      // Supabase Authでサインアップ（メール認証を有効化）
      const redirectUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback?type=client`
        : 'https://my.co-shien.inu.co.jp/auth/callback?type=client';

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name: fullName,
            lastName: formData.lastName,
            firstName: formData.firstName,
            userType: 'client',
          }
        }
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered') ||
            signUpError.message.includes('already exists') ||
            signUpError.message.includes('User already registered')) {
          throw new Error('このメールアドレスは既に登録されています');
        }
        throw new Error(`サインアップエラー: ${signUpError.message}`);
      }

      if (!authData.user) {
        throw new Error('ユーザー作成に失敗しました');
      }

      // usersテーブルにユーザー情報を保存
      const { error: userCreateError } = await supabase
        .from('users')
        .upsert({
          id: authData.user.id,
          name: fullName,
          last_name: formData.lastName,
          first_name: formData.firstName,
          last_name_kana: formData.lastNameKana,
          first_name_kana: formData.firstNameKana,
          phone: formData.phone,
          email: formData.email,
          login_id: formData.email,
          user_type: 'client', // 利用者として登録
          role: 'client', // roleもclientに
          account_status: 'pending', // メール認証待ち
          has_account: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        });

      if (userCreateError) {
        console.error('usersテーブルへの保存エラー:', userCreateError);
      }

      // 登録したメールアドレスをlocalStorageに保存
      localStorage.setItem('pending_signup_email', formData.email.trim().toLowerCase());

      // メール認証待機ページにリダイレクト
      router.push(`/client/signup/waiting?email=${encodeURIComponent(formData.email)}`);
    } catch (err: any) {
      setError(err.message || 'アカウント作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-300 to-orange-400 p-4">
      {/* 利用規約モーダル */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">利用規約</h2>
              <button
                onClick={() => setShowTermsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="prose prose-sm max-w-none space-y-4 text-sm">
                <p className="text-gray-500 mb-4">最終更新日: 2024年1月1日</p>

                <section>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">第1条（適用）</h3>
                  <p className="text-gray-700 leading-relaxed">
                    本規約は、株式会社INU（以下「当社」といいます）が提供する「co-shien」サービス（以下「本サービス」といいます）の利用条件を定めるものです。
                    登録ユーザーの皆さま（以下「ユーザー」といいます）には、本規約に従って、本サービスをご利用いただきます。
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">第2条（利用登録）</h3>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>本サービスにおいては、登録希望者が本規約に同意の上、当社の定める方法によって利用登録を申請し、当社がこれを承認することによって、利用登録が完了するものとします。</li>
                    <li>当社は、利用登録の申請者に以下の事由があると判断した場合、利用登録の申請を承認しないことがあり、その理由については一切の開示義務を負わないものとします。
                      <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                        <li>利用登録の申請に際して虚偽の事項を届け出た場合</li>
                        <li>本規約に違反したことがある者からの申請である場合</li>
                        <li>その他、当社が利用登録を相当でないと判断した場合</li>
                      </ul>
                    </li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">第3条（個人情報の取扱い）</h3>
                  <p className="text-gray-700 leading-relaxed">
                    当社は、本サービスの利用によって取得する個人情報については、当社「プライバシーポリシー」に従い適切に取り扱うものとします。
                    お子様の情報については、保護者の同意のもとで管理され、施設との契約に基づいてのみ共有されます。
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">第4条（準拠法・裁判管轄）</h3>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>本規約の解釈にあたっては、日本法を準拠法とします。</li>
                    <li>本サービスに関して紛争が生じた場合には、当社の本店所在地を管轄する裁判所を専属的合意管轄とします。</li>
                  </ol>
                </section>

                <section className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">以上</p>
                  <p className="text-sm text-gray-600 mt-2">株式会社INU</p>
                </section>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowTermsModal(false)}
                className="w-full bg-orange-400 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded-md transition-colors"
              >
                閉じる
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <Image
            src="/logo-cropped-center.png"
            alt="co-shien"
            width={200}
            height={64}
            className="h-16 w-auto mx-auto mb-4"
            priority
          />
          <div className="mb-2">
            <span className="inline-block bg-orange-400 text-white text-xs font-bold px-3 py-1 rounded-full">
              利用者（保護者）向け
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">新規登録</h1>
          <p className="text-gray-600 text-sm mt-2">保護者アカウントを作成してお子様の情報を登録</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="lastName" className="block text-sm font-bold text-gray-700 mb-2">
                姓 <span className="text-red-500">*</span>
              </label>
              <input
                id="lastName"
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                placeholder="山田"
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="firstName" className="block text-sm font-bold text-gray-700 mb-2">
                名 <span className="text-red-500">*</span>
              </label>
              <input
                id="firstName"
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                placeholder="太郎"
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="lastNameKana" className="block text-sm font-bold text-gray-700 mb-2">
                セイ <span className="text-red-500">*</span>
              </label>
              <input
                id="lastNameKana"
                type="text"
                value={formData.lastNameKana}
                onChange={(e) => setFormData({ ...formData, lastNameKana: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                placeholder="ヤマダ"
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="firstNameKana" className="block text-sm font-bold text-gray-700 mb-2">
                メイ <span className="text-red-500">*</span>
              </label>
              <input
                id="firstNameKana"
                type="text"
                value={formData.firstNameKana}
                onChange={(e) => setFormData({ ...formData, firstNameKana: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                placeholder="タロウ"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-bold text-gray-700 mb-2">
              電話番号 <span className="text-red-500">*</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="090-1234-5678"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-2">
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="example@email.com"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              このメールアドレスがログインIDとして使用されます
            </p>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-2">
              パスワード <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="6文字以上"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-bold text-gray-700 mb-2">
              パスワード（確認） <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                minLength={6}
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="パスワードを再入力"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                {showConfirmPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-start">
            <input
              type="checkbox"
              id="terms"
              checked={formData.agreedToTerms}
              onChange={(e) => setFormData({ ...formData, agreedToTerms: e.target.checked })}
              className="mt-1 mr-2"
              disabled={loading}
            />
            <label htmlFor="terms" className="text-sm text-gray-700">
              <button
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="text-orange-400 hover:underline"
              >
                利用規約
              </button>
              に同意します
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-400 hover:bg-orange-500 text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '登録中...' : 'アカウントを作成'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">
          <p className="text-center text-sm text-gray-600">
            既にアカウントをお持ちの方は{' '}
            <button
              onClick={() => router.push('/client/login')}
              className="text-orange-500 hover:underline font-bold"
            >
              ログイン
            </button>
          </p>
          <p className="text-center text-xs text-gray-400">
            <button
              onClick={() => router.push('/personal/signup')}
              className="hover:underline"
            >
              スタッフとして登録する場合はこちら
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
