/**
 * Root Page - ゲートウェイ（振り分けページ）
 *
 * - ログイン済みユーザー → 各ダッシュボードへリダイレクト
 * - 未ログインユーザー → 施設LP / キャリアLP への振り分け
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import {
  Shield,
  ArrowRight,
  Building2,
  Award,
  Users,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function RootPage() {
  const router = useRouter();
  const [ownerSetupNeeded, setOwnerSetupNeeded] = useState(false);
  const [checking, setChecking] = useState(true);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.userType === 'client' || user.userType === 'parent') {
          router.push('/parent');
          return;
        }
        router.push('/career');
        return;
      } catch {
        localStorage.removeItem('user');
      }
    }

    const timeout = setTimeout(() => {
      if (!cancelled) setTimedOut(true);
    }, 10000);

    const checkOwnerSetup = async () => {
      try {
        const { data: config } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'owner_setup_completed')
          .maybeSingle();

        if (!cancelled) {
          if (!config || config.value !== 'true') {
            setOwnerSetupNeeded(true);
          }
        }
      } catch (err) {
        console.error('Owner setup check error:', err);
      } finally {
        if (!cancelled) {
          setChecking(false);
          clearTimeout(timeout);
        }
      }
    };

    checkOwnerSetup();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-800 border-t-transparent mx-auto" />
          {timedOut && (
            <p className="mt-4 text-sm text-gray-500">
              接続に時間がかかっています。ネットワーク環境をご確認ください。
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ====== Header ====== */}
      <header className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Image
            src="/logo.svg"
            alt="Roots"
            width={103}
            height={28}
            className="h-7 w-auto"
            priority
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/parent/login')}
              className="text-xs font-medium text-client hover:text-client-dark transition-colors px-2 py-1.5"
            >
              保護者の方
            </button>
            <button
              onClick={() => router.push('/career/login')}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-2"
            >
              ログイン
            </button>
          </div>
        </div>
      </header>

      {/* ====== Owner Setup Warning ====== */}
      {ownerSetupNeeded && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
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
        </div>
      )}

      {/* ====== Main Content ====== */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-3xl mx-auto w-full py-20 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 leading-tight tracking-tight mb-4">
            障害福祉の現場と、<br className="hidden sm:block" />
            そこで働く人を、<br className="hidden sm:block" />
            ひとつのプラットフォームで。
          </h1>
          <p className="text-gray-500 mb-12 text-lg">
            施設運営も、キャリア管理も。すべて無料。
          </p>

          {/* 2つの入口 */}
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {/* 施設管理 */}
            <button
              onClick={() => router.push('/facility')}
              className="group bg-white border-2 border-gray-200 hover:border-primary rounded-2xl p-6 text-left transition-all hover:shadow-lg"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">施設を無料で運営する</h2>
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                勤怠・請求・監査書類——施設運営のすべてを完全無料で。
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-primary group-hover:gap-2 transition-all">
                詳しく見る <ArrowRight className="w-4 h-4" />
              </span>
            </button>

            {/* キャリア */}
            <button
              onClick={() => router.push('/career/lp')}
              className="group bg-white border-2 border-gray-200 hover:border-personal rounded-2xl p-6 text-left transition-all hover:shadow-lg"
            >
              <div className="w-12 h-12 bg-personal/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Award className="w-6 h-6 text-personal" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">キャリアアカウントを作る</h2>
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                履歴書・証明書の自動作成。転職してもキャリアデータが消えない。
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-personal group-hover:gap-2 transition-all">
                詳しく見る <ArrowRight className="w-4 h-4" />
              </span>
            </button>
          </div>

          {/* 保護者リンク */}
          <p className="mt-8 text-sm text-gray-400">
            <button
              onClick={() => router.push('/parent/login')}
              className="hover:text-client transition-colors"
            >
              保護者の方はこちら
            </button>
          </p>
        </div>
      </main>

      {/* ====== Footer ====== */}
      <footer className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Image src="/logo.svg" alt="Roots" width={80} height={22} className="h-4 w-auto opacity-40" />
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <button onClick={() => router.push('/terms')} className="hover:text-gray-600 transition-colors">
              利用規約
            </button>
            <button onClick={() => router.push('/privacy')} className="hover:text-gray-600 transition-colors">
              プライバシーポリシー
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
