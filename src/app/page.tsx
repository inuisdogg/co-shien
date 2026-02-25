/**
 * Root Page - Roots トップページ
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
import { Briefcase, Users, Shield, LogIn, UserPlus, Building2, ArrowRight } from 'lucide-react';

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#00c4cc] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50">
      {/* ヘッダー */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Image
            src="/logo.svg"
            alt="Roots"
            width={140}
            height={44}
            className="h-10 w-auto"
            priority
          />
          <button
            onClick={() => router.push('/career/login')}
            className="text-sm text-gray-600 hover:text-[#00c4cc] flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            ログイン
          </button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-5xl mx-auto px-4 py-16">
        {/* オーナー未設定の警告 */}
        {ownerSetupNeeded && (
          <div className="mb-10 bg-amber-50 border border-amber-200 rounded-xl p-4">
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
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">
            Rootsへようこそ
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            障害児通所支援事業所向け統合管理プラットフォーム
          </p>
        </div>

        {/* 3 Entry Point Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {/* 施設管理者 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:border-[#00c4cc]/30 transition-all group">
            <div className="w-14 h-14 bg-[#00c4cc]/10 rounded-xl flex items-center justify-center mb-5">
              <Building2 className="w-7 h-7 text-[#00c4cc]" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">施設管理者</h2>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              施設の運営管理、スタッフ・児童管理、経営分析、コンプライアンス管理など
            </p>
            <div className="space-y-2.5">
              <button
                onClick={() => router.push('/career/signup')}
                className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 min-w-[120px]"
              >
                <UserPlus className="w-4 h-4" />
                新規登録
              </button>
              <button
                onClick={() => router.push('/career/login')}
                className="w-full bg-white border border-gray-200 text-gray-700 hover:border-[#00c4cc] hover:text-[#00c4cc] font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 min-w-[120px]"
              >
                <LogIn className="w-4 h-4" />
                ログイン
              </button>
            </div>
          </div>

          {/* スタッフ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:border-[#818CF8]/30 transition-all group">
            <div className="w-14 h-14 bg-[#818CF8]/10 rounded-xl flex items-center justify-center mb-5">
              <Briefcase className="w-7 h-7 text-[#818CF8]" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">スタッフ</h2>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              勤務管理、シフト確認、資格管理、キャリア記録、研修管理など
            </p>
            <div className="space-y-2.5">
              <button
                onClick={() => router.push('/career/signup')}
                className="w-full bg-[#818CF8] hover:bg-[#6366F1] text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 min-w-[120px]"
              >
                <UserPlus className="w-4 h-4" />
                新規登録
              </button>
              <button
                onClick={() => router.push('/career/login')}
                className="w-full bg-white border border-gray-200 text-gray-700 hover:border-[#818CF8] hover:text-[#818CF8] font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 min-w-[120px]"
              >
                <LogIn className="w-4 h-4" />
                ログイン
              </button>
            </div>
          </div>

          {/* 保護者 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:border-[#F472B6]/30 transition-all group">
            <div className="w-14 h-14 bg-[#F472B6]/10 rounded-xl flex items-center justify-center mb-5">
              <Users className="w-7 h-7 text-[#F472B6]" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">保護者</h2>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              お子様の利用状況確認、連絡帳、予約管理、支援計画の閲覧など
            </p>
            <div className="space-y-2.5">
              <button
                onClick={() => router.push('/parent/signup')}
                className="w-full bg-[#F472B6] hover:bg-[#EC4899] text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 min-w-[120px]"
              >
                <UserPlus className="w-4 h-4" />
                新規登録
              </button>
              <button
                onClick={() => router.push('/parent/login')}
                className="w-full bg-white border border-gray-200 text-gray-700 hover:border-[#F472B6] hover:text-[#F472B6] font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 min-w-[120px]"
              >
                <LogIn className="w-4 h-4" />
                ログイン
              </button>
            </div>
          </div>
        </div>

        {/* フッター情報 */}
        <div className="text-center text-sm text-gray-400">
          <p>&copy; {new Date().getFullYear()} INU Inc. All rights reserved.</p>
        </div>
      </main>
    </div>
  );
}
