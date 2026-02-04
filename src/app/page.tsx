/**
 * Root Page - co-shien トップページ
 *
 * サービス選択ハブとして機能
 * - キャリアアカウント（スタッフ・専門家）への動線
 * - 利用者（保護者）への動線
 * - オーナー未設定の場合は管理者登録への動線
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Briefcase, Users, Shield, LogIn, UserPlus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function RootPage() {
  const router = useRouter();
  const [ownerSetupNeeded, setOwnerSetupNeeded] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkOwnerSetup = async () => {
      try {
        const { data: config } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'owner_setup_completed')
          .maybeSingle();

        if (!config || config.value !== 'true') {
          setOwnerSetupNeeded(true);
        }
      } catch (err) {
        console.error('Owner setup check error:', err);
      } finally {
        setChecking(false);
      }
    };

    checkOwnerSetup();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#818CF8]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Image
            src="/logo-cropped-center.png"
            alt="co-shien"
            width={160}
            height={50}
            className="h-10 w-auto"
            priority
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/career/login')}
              className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
            >
              <LogIn className="w-4 h-4" />
              ログイン
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* オーナー未設定の警告 */}
        {ownerSetupNeeded && (
          <div className="mb-8 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800">プラットフォーム管理者が未登録です</p>
                <p className="text-sm text-amber-700 mt-1">
                  システム管理者の方は、キャリアアカウントを作成後、
                  <button
                    onClick={() => router.push('/owner-setup')}
                    className="underline font-bold hover:text-amber-900"
                  >
                    こちら
                  </button>
                  からオーナー登録を行ってください。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ヒーローセクション */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            co-shienへようこそ
          </h1>
          <p className="text-gray-600">
            障害児通所支援事業所向け統合管理プラットフォーム
          </p>
        </div>

        {/* アカウント種別選択 */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* キャリアアカウント */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-transparent hover:border-[#818CF8] transition-colors">
            <div className="w-14 h-14 bg-[#818CF8]/10 rounded-full flex items-center justify-center mb-4">
              <Briefcase className="w-7 h-7 text-[#818CF8]" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">キャリアアカウント</h2>
            <p className="text-gray-600 text-sm mb-6">
              スタッフ・専門家の方向け<br />
              施設での勤務管理、シフト確認、資格管理など
            </p>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/career/signup')}
                className="w-full bg-[#818CF8] hover:bg-[#6366F1] text-white font-bold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                新規登録
              </button>
              <button
                onClick={() => router.push('/career/login')}
                className="w-full bg-white border-2 border-[#818CF8] text-[#818CF8] hover:bg-[#818CF8]/5 font-bold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <LogIn className="w-5 h-5" />
                ログイン
              </button>
            </div>
          </div>

          {/* 利用者アカウント */}
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-transparent hover:border-[#F472B6] transition-colors">
            <div className="w-14 h-14 bg-[#F472B6]/10 rounded-full flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-[#F472B6]" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">利用者アカウント</h2>
            <p className="text-gray-600 text-sm mb-6">
              保護者の方向け<br />
              お子様の利用状況確認、連絡帳、予約管理など
            </p>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/parent/signup')}
                className="w-full bg-[#F472B6] hover:bg-[#EC4899] text-white font-bold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                新規登録
              </button>
              <button
                onClick={() => router.push('/parent/login')}
                className="w-full bg-white border-2 border-[#F472B6] text-[#F472B6] hover:bg-[#F472B6]/5 font-bold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <LogIn className="w-5 h-5" />
                ログイン
              </button>
            </div>
          </div>
        </div>

        {/* フッター情報 */}
        <div className="text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} INU Inc. All rights reserved.</p>
        </div>
      </main>
    </div>
  );
}
