/**
 * Biz側用：施設の初回セットアップページ
 * 施設IDを発行し、管理者アカウントを作成する
 *
 * ※ Personal側の新規登録は /personal/signup を使用
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

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    agreedToTerms: false,
  });
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // バリデーション
    if (!formData.agreedToTerms) {
      setError('利用規約に同意してください');
      return;
    }

    if (!formData.email) {
      setError('メールアドレスを入力してください');
      return;
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError('正しいメールアドレスを入力してください');
      return;
    }

    setLoading(true);
    try {
      // 重複チェック：メールアドレス
      const { data: existingUserByEmail, error: emailCheckError } = await supabase
        .from('users')
        .select('id, email, name, login_id')
        .eq('email', formData.email.trim().toLowerCase())
        .maybeSingle();

      if (emailCheckError && emailCheckError.code !== 'PGRST116') {
        // PGRST116は「結果が見つからない」エラーなので無視
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

      // Supabase Authでサインアップ（メール認証を有効化、パスワードは後で設定）
      // 一時的なパスワードを生成（メール認証後に設定画面で変更）
      const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
      const redirectUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback?type=business`
        : 'https://Roots.inu.co.jp/auth/callback?type=business';
      
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: tempPassword, // 一時パスワード（メール認証後に設定画面で変更）
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            setup_type: 'facility', // 施設セットアップであることを示す
          }
        }
      });

      if (signUpError) {
        throw new Error(`サインアップエラー: ${signUpError.message}`);
      }

      if (!authData.user) {
        throw new Error('ユーザー作成に失敗しました');
      }

      // メール認証待機ページにリダイレクト
      router.push(`/signup/waiting?email=${encodeURIComponent(formData.email)}`);
    } catch (err: any) {
      setError(err.message || 'アカウント作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
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
                  <h3 className="text-lg font-bold text-gray-800 mb-2">第3条（ユーザーIDおよびパスワードの管理）</h3>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>ユーザーは、自己の責任において、本サービスのユーザーIDおよびパスワードを適切に管理するものとします。</li>
                    <li>ユーザーIDまたはパスワードが第三者に使用されたことによって生じた損害は、当社に故意または重大な過失がある場合を除き、当社は一切の責任を負わないものとします。</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">第4条（禁止事項）</h3>
                  <p className="text-gray-700 leading-relaxed mb-2">ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-700">
                    <li>法令または公序良俗に違反する行為</li>
                    <li>犯罪行為に関連する行為</li>
                    <li>本サービスの内容等、本サービスに含まれる著作権、商標権ほか知的財産権を侵害する行為</li>
                    <li>当社、ほかのユーザー、またはその他第三者のサーバーまたはネットワークの機能を破壊したり、妨害したりする行為</li>
                    <li>本サービスによって得られた情報を商業的に利用する行為</li>
                    <li>当社のサービスの運営を妨害するおそれのある行為</li>
                    <li>不正アクセスをし、またはこれを試みる行為</li>
                    <li>その他、当社が不適切と判断する行為</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">第5条（個人情報の取扱い）</h3>
                  <p className="text-gray-700 leading-relaxed">
                    当社は、本サービスの利用によって取得する個人情報については、当社「プライバシーポリシー」に従い適切に取り扱うものとします。
                  </p>
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
                className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-2 px-4 rounded-md transition-colors"
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
            src="/logo.svg"
            alt="Roots"
            width={200}
            height={64}
            className="h-16 w-auto mx-auto mb-4"
            priority
          />
          <div className="mb-2">
            <span className="inline-block bg-[#00c4cc] text-white text-xs font-bold px-3 py-1 rounded-full">
              Biz（事業所向け）
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">施設の初回セットアップ</h1>
          <p className="text-gray-600 text-sm mt-2">メールアドレスを入力して、施設IDを発行します</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
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
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
              placeholder="メールアドレスを入力"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              メール認証後、施設IDとパスワードを設定します
            </p>
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
                className="text-[#00c4cc] hover:underline"
              >
                利用規約
              </button>
              ・
              <button
                type="button"
                onClick={() => window.open('/privacy', '_blank')}
                className="text-[#00c4cc] hover:underline"
              >
                プライバシーポリシー
              </button>
              に同意します
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '登録中...' : 'アカウントを作成'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">
          <p className="text-center text-sm text-gray-600">
            既にアカウントをお持ちの方は{' '}
            <button
              onClick={() => router.push('/biz')}
              className="text-[#00c4cc] hover:underline font-bold"
            >
              ログイン
            </button>
          </p>
          <p className="text-center text-xs text-gray-400">
            <button
              onClick={() => window.location.href = '/career/login'}
              className="hover:underline"
            >
              Personal側でログイン
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

