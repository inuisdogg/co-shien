/**
 * ログインID忘れページ
 * OTP認証を使用してログインIDを安全に確認
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Mail, Calendar, CheckCircle, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Step = 'search' | 'otp' | 'result';
type SearchType = 'email' | 'name_birthday';

export default function ForgotLoginIdPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('search');
  const [searchType, setSearchType] = useState<SearchType>('email');

  // フォームデータ
  const [email, setEmail] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // 状態
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [loginId, setLoginId] = useState<string | null>(null);

  // ステップ1: ユーザー検索とOTP送信
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchType,
          email: searchType === 'email' ? email : undefined,
          lastName: searchType === 'name_birthday' ? lastName : undefined,
          firstName: searchType === 'name_birthday' ? firstName : undefined,
          birthDate: searchType === 'name_birthday' ? birthDate : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '検索に失敗しました');
      }

      setMaskedEmail(data.maskedEmail);
      setUserId(data.userId);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // ステップ2: OTP検証
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          code: otpCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '認証に失敗しました');
      }

      setLoginId(data.loginId);
      setStep('result');
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // OTP再送信
  const handleResendOtp = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchType,
          email: searchType === 'email' ? email : undefined,
          lastName: searchType === 'name_birthday' ? lastName : undefined,
          firstName: searchType === 'name_birthday' ? firstName : undefined,
          birthDate: searchType === 'name_birthday' ? birthDate : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '再送信に失敗しました');
      }

      setError('');
      alert('認証コードを再送信しました');
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
        <button
          onClick={() => {
            if (step === 'otp') {
              setStep('search');
              setOtpCode('');
              setError('');
            } else {
              router.back();
            }
          }}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft size={20} />
          <span className="text-sm">{step === 'otp' ? '戻る' : '戻る'}</span>
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#00c4cc]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-[#00c4cc]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">ログインIDを忘れた場合</h1>
          <p className="text-gray-600 text-sm mt-2">
            {step === 'search' && '登録情報を入力してください'}
            {step === 'otp' && '認証コードを入力してください'}
            {step === 'result' && 'ログインIDが見つかりました'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ステップ1: ユーザー検索 */}
        {step === 'search' && (
          <form onSubmit={handleSearchSubmit} className="space-y-6">
            {/* 検索方法の選択 */}
            <div className="space-y-3">
              <label className="block text-sm font-bold text-gray-700">
                確認方法を選択
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSearchType('email')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-md border-2 transition-colors ${
                    searchType === 'email'
                      ? 'border-[#00c4cc] bg-[#00c4cc]/10 text-[#00c4cc]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Mail size={20} />
                  <span className="text-sm font-medium">メールアドレス</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSearchType('name_birthday')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-md border-2 transition-colors ${
                    searchType === 'name_birthday'
                      ? 'border-[#00c4cc] bg-[#00c4cc]/10 text-[#00c4cc]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Calendar size={20} />
                  <span className="text-sm font-medium">氏名＋生年月日</span>
                </button>
              </div>
            </div>

            {/* メールアドレスで検索 */}
            {searchType === 'email' && (
              <div>
                <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-2">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                  placeholder="登録時のメールアドレスを入力"
                  disabled={loading}
                />
              </div>
            )}

            {/* 氏名＋生年月日で検索 */}
            {searchType === 'name_birthday' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-bold text-gray-700 mb-2">
                      姓 <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                      placeholder="姓を入力"
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
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                      placeholder="名を入力"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="birthDate" className="block text-sm font-bold text-gray-700 mb-2">
                    生年月日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="birthDate"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                    disabled={loading}
                  />
                </div>
              </>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-xs text-blue-800">
                入力された情報に一致するアカウントが見つかった場合、登録されているメールアドレス宛に認証コードを送信します。
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '検索中...' : '認証コードを送信'}
            </button>
          </form>
        )}

        {/* ステップ2: OTP入力 */}
        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit} className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
              <p className="text-sm text-green-800">
                <span className="font-bold">{maskedEmail}</span> 宛に認証コードを送信しました。
              </p>
            </div>

            <div>
              <label htmlFor="otpCode" className="block text-sm font-bold text-gray-700 mb-2">
                認証コード（6桁） <span className="text-red-500">*</span>
              </label>
              <input
                id="otpCode"
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                required
                maxLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent text-center text-2xl tracking-widest font-mono"
                placeholder="000000"
                disabled={loading}
                autoComplete="one-time-code"
              />
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading}
                className="text-sm text-[#00c4cc] hover:underline disabled:opacity-50"
              >
                認証コードを再送信
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '認証中...' : '認証する'}
            </button>

            <p className="text-xs text-gray-500 text-center">
              認証コードは10分間有効です
            </p>
          </form>
        )}

        {/* ステップ3: 結果表示 */}
        {step === 'result' && loginId && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="font-bold text-green-800">ログインIDが見つかりました</p>
              </div>
              <div className="bg-white p-4 rounded border border-green-300">
                <p className="text-xs text-gray-500 mb-1">あなたのログインID</p>
                <p className="text-lg font-bold text-gray-800 break-all">{loginId}</p>
              </div>
            </div>

            <button
              onClick={() => router.push('/login')}
              className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors"
            >
              ログイン画面へ
            </button>

            <button
              onClick={() => {
                setStep('search');
                setEmail('');
                setLastName('');
                setFirstName('');
                setBirthDate('');
                setOtpCode('');
                setLoginId(null);
                setUserId('');
                setMaskedEmail('');
                setError('');
              }}
              className="w-full border border-gray-300 text-gray-700 font-bold py-3 px-4 rounded-md transition-colors hover:bg-gray-50"
            >
              別のアカウントを確認
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
