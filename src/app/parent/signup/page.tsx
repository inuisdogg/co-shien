/**
 * 利用者（保護者）向け新規登録ページ
 * 施設ID不要で利用者アカウントを作成
 */

'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { hashPassword } from '@/utils/password';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

export default function ClientSignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect');
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateEmail = (value: string) => {
    if (!value) return 'メールアドレスを入力してください';
    if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/.test(value)) return '有効なメールアドレスを入力してください';
    return '';
  };

  const validatePassword = (value: string) => {
    if (!value) return 'パスワードを入力してください';
    if (value.length < 8) return 'パスワードは8文字以上で入力してください';
    return '';
  };

  const handleFieldBlur = (field: string, errorMsg: string) => {
    setFieldErrors(prev => {
      if (errorMsg) return { ...prev, [field]: errorMsg };
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // 全フィールドのバリデーションを一括チェック
    const errors: Record<string, string> = {};
    if (!formData.lastName.trim() || !formData.firstName.trim()) errors.name = '姓と名を入力してください';
    if (!formData.lastNameKana.trim() || !formData.firstNameKana.trim()) errors.kana = 'フリガナを入力してください';
    if (!formData.phone.trim()) errors.phone = '電話番号を入力してください';
    if (!formData.email.trim()) errors.email = 'メールアドレスを入力してください';
    if (formData.password.length < 8) errors.password = 'パスワードは8文字以上で入力してください';
    if (formData.password !== formData.confirmPassword) errors.confirmPassword = 'パスワードが一致しません';
    if (!formData.agreedToTerms) errors.terms = '利用規約に同意してください';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('入力内容に不備があります。各項目をご確認ください。');
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
        ? `${window.location.origin}/auth/callback?type=parent`
        : 'https://roots.inu.co.jp/auth/callback?type=parent';

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

      // パスワードをハッシュ化
      const passwordHash = await hashPassword(formData.password);

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
          password_hash: passwordHash,
          user_type: 'client',
          role: 'client',
          account_status: 'pending',
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

      // リダイレクト先がある場合はlocalStorageに保存（メール認証後に使用）
      if (redirectPath) {
        localStorage.setItem('post_signup_redirect', redirectPath);
      }

      // メール認証待機ページにリダイレクト
      router.push(`/parent/signup/waiting?email=${encodeURIComponent(formData.email)}`);
    } catch (err: any) {
      setError(err.message || 'アカウント作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-client-light p-4">
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
                <p className="text-gray-500 mb-4">最終更新日: 2026年3月1日</p>

                <section>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">第1条（適用）</h3>
                  <p className="text-gray-700 leading-relaxed">
                    本規約は、株式会社INU（以下「当社」といいます）が提供する「Roots」サービス（以下「本サービス」といいます）の利用条件を定めるものです。
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
                    当社は、本サービスの利用によって取得する個人情報については、日本国の個人情報保護法（APPI）に準拠し、当社「プライバシーポリシー」に従い適切に取り扱うものとします。
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700 mt-2">
                    <li>お子様の情報（氏名、生年月日、受給者証情報、健康情報等）については、保護者の同意のもとで管理され、利用契約を結んだ施設との間でのみ共有されます。</li>
                    <li>当社は、ユーザーの個人情報を利用契約の終了後も法令で定める期間保存する場合があります。保存期間経過後は速やかに削除します。</li>
                    <li>ユーザーは、当社が保有する自己の個人情報の開示、訂正、削除を請求することができます。請求は本サービス内の設定画面またはお問い合わせフォームより行うことができます。</li>
                    <li>当社は、ユーザーの同意なく個人情報を第三者に提供することはありません。ただし、法令に基づく場合を除きます。</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">第4条（サービスの提供・中断）</h3>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>当社は、システムの保守、天災、その他やむを得ない事由により、事前の通知なくサービスの全部または一部を一時的に中断することがあります。</li>
                    <li>当社は、サービス中断に起因するユーザーの損害について、当社に故意または重過失がある場合を除き、責任を負わないものとします。</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">第5条（退会・アカウント削除）</h3>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>ユーザーは、本サービス内の設定画面またはお問い合わせにより、いつでもアカウントの削除を申請できます。</li>
                    <li>アカウント削除後、当社はユーザーの個人情報を法令で定める保存義務期間を除き、速やかに削除します。</li>
                    <li>アカウント削除に伴い、当該ユーザーに紐づく利用実績データは施設側で引き続き保管される場合があります。</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">第6条（準拠法・裁判管轄）</h3>
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
                className="w-full bg-client hover:bg-client-dark text-white font-bold py-2 px-4 rounded-md transition-colors"
              >
                閉じる
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <Image
            src="/logo.svg"
            alt="Roots"
            width={160}
            height={52}
            className="h-12 w-auto mx-auto mb-6"
            priority
          />
          <div className="mb-3">
            <span className="inline-block bg-client text-white text-xs font-bold px-3 py-1.5 rounded-full">
              保護者の方はこちら
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">アカウント作成</h1>
          <p className="text-gray-500 text-sm mt-2">
            お子様の通所施設との連携のため、<br className="sm:hidden" />保護者アカウントを作成します
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">入力内容をご確認ください</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* お名前セクション */}
          <div className={`bg-gray-50/50 rounded-xl p-4 border ${fieldErrors.name ? 'border-red-400' : 'border-gray-100'}`}>
            <p className="text-xs font-bold text-gray-500 mb-3">お名前</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="lastName" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  姓 <span className="text-red-500">*</span>
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                  className={`w-full px-4 py-3 border ${fieldErrors.name ? 'border-red-400' : 'border-gray-200'} rounded-lg focus:outline-none focus:ring-2 focus:ring-client/30 focus:border-client text-base`}
                  placeholder="山田"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="firstName" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  名 <span className="text-red-500">*</span>
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                  className={`w-full px-4 py-3 border ${fieldErrors.name ? 'border-red-400' : 'border-gray-200'} rounded-lg focus:outline-none focus:ring-2 focus:ring-client/30 focus:border-client text-base`}
                  placeholder="太郎"
                  disabled={loading}
                />
              </div>
            </div>
            {fieldErrors.name && <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>}

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label htmlFor="lastNameKana" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  セイ <span className="text-red-500">*</span>
                </label>
                <input
                  id="lastNameKana"
                  type="text"
                  value={formData.lastNameKana}
                  onChange={(e) => setFormData({ ...formData, lastNameKana: e.target.value })}
                  required
                  className={`w-full px-4 py-3 border ${fieldErrors.kana ? 'border-red-400' : 'border-gray-200'} rounded-lg focus:outline-none focus:ring-2 focus:ring-client/30 focus:border-client text-base`}
                  placeholder="ヤマダ"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="firstNameKana" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  メイ <span className="text-red-500">*</span>
                </label>
                <input
                  id="firstNameKana"
                  type="text"
                  value={formData.firstNameKana}
                  onChange={(e) => setFormData({ ...formData, firstNameKana: e.target.value })}
                  required
                  className={`w-full px-4 py-3 border ${fieldErrors.kana ? 'border-red-400' : 'border-gray-200'} rounded-lg focus:outline-none focus:ring-2 focus:ring-client/30 focus:border-client text-base`}
                  placeholder="タロウ"
                  disabled={loading}
                />
              </div>
            </div>
            {fieldErrors.kana && <p className="text-xs text-red-500 mt-1">{fieldErrors.kana}</p>}
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-1.5">
              電話番号 <span className="text-red-500">*</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
              className={`w-full px-4 py-3 border ${fieldErrors.phone ? 'border-red-400' : 'border-gray-200'} rounded-lg focus:outline-none focus:ring-2 focus:ring-client/30 focus:border-client text-base`}
              placeholder="090-1234-5678"
              disabled={loading}
            />
            {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => { setFormData({ ...formData, email: e.target.value }); if (fieldErrors.email) handleFieldBlur('email', ''); }}
              onBlur={() => handleFieldBlur('email', validateEmail(formData.email))}
              required
              className={`w-full px-4 py-3 border ${fieldErrors.email ? 'border-red-400' : 'border-gray-200'} rounded-lg focus:outline-none focus:ring-2 focus:ring-client/30 focus:border-client text-base`}
              autoComplete="email"
              placeholder="example@email.com"
              disabled={loading}
            />
            {fieldErrors.email ? <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p> : <p className="text-xs text-gray-400 mt-1.5">このメールアドレスがログインIDになります</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1.5">
              パスワード <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => { setFormData({ ...formData, password: e.target.value }); if (fieldErrors.password) handleFieldBlur('password', ''); }}
                onBlur={() => handleFieldBlur('password', validatePassword(formData.password))}
                required
                minLength={8}
                autoComplete="new-password"
                className={`w-full px-4 py-3 pr-12 border ${fieldErrors.password ? 'border-red-400' : 'border-gray-200'} rounded-lg focus:outline-none focus:ring-2 focus:ring-client/30 focus:border-client text-base`}
                placeholder="8文字以上のパスワード"
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
            {fieldErrors.password && <p className="text-xs text-red-500 mt-1">{fieldErrors.password}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-1.5">
              パスワード（確認） <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                minLength={8}
                className={`w-full px-4 py-3 pr-12 border ${fieldErrors.confirmPassword ? 'border-red-400' : 'border-gray-200'} rounded-lg focus:outline-none focus:ring-2 focus:ring-client/30 focus:border-client text-base`}
                placeholder="もう一度パスワードを入力"
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
            {fieldErrors.confirmPassword && <p className="text-xs text-red-500 mt-1">{fieldErrors.confirmPassword}</p>}
          </div>

          <div className={`flex items-center min-h-[44px] bg-gray-50 rounded-lg p-3 border ${fieldErrors.terms ? 'border-red-400' : 'border-gray-100'}`}>
            <input
              type="checkbox"
              id="terms"
              checked={formData.agreedToTerms}
              onChange={(e) => setFormData({ ...formData, agreedToTerms: e.target.checked })}
              className="w-5 h-5 mr-3 accent-client cursor-pointer"
              disabled={loading}
            />
            <label htmlFor="terms" className="text-sm text-gray-700">
              <button
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="text-client hover:underline font-medium"
              >
                利用規約
              </button>
              ・
              <button
                type="button"
                onClick={() => window.open('/privacy', '_blank')}
                className="text-client hover:underline font-medium"
              >
                プライバシーポリシー
              </button>
              に同意します
            </label>
          </div>
          {fieldErrors.terms && <p className="text-xs text-red-500 mt-1">{fieldErrors.terms}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-client hover:bg-client-dark text-white font-bold py-3.5 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg text-base"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                登録中...
              </span>
            ) : 'アカウントを作成する'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">
          <p className="text-center text-sm text-gray-600">
            既にアカウントをお持ちの方は{' '}
            <button
              onClick={() => router.push('/parent/login')}
              className="text-client hover:underline font-bold"
            >
              ログイン
            </button>
          </p>
          <p className="text-center text-xs text-gray-400">
            <button
              onClick={() => router.push('/career/signup')}
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
