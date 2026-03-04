/**
 * 旧・初期管理者アカウント作成ページ
 * 施設登録は /facility/register に統合されました
 * このページはリダイレクト + 案内表示のみ
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Building2, ArrowRight, Info } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function AdminSetupPage() {
  const router = useRouter();
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <Image
            src="/logo.svg"
            alt="Roots"
            width={120}
            height={40}
            className="h-8 w-auto mx-auto mb-4"
          />
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">施設の登録方法が変わりました</h1>
          <p className="text-gray-600 text-sm">
            施設の登録はプラットフォーム管理者からの招待リンクを通じて行います。
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => router.push('/admin')}
            className="w-full flex items-center justify-between px-5 py-3.5 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl transition-colors"
          >
            <span>管理者の方はこちら</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => router.push('/career')}
            className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
          >
            <span>スタッフ・キャリアページへ</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => setShowDetail(!showDetail)}
          className="mt-6 w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <Info className="w-4 h-4" />
          登録の流れを確認
        </button>

        {showDetail && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-blue-800 mb-2">施設登録の流れ</h3>
            <ol className="text-sm text-blue-700 space-y-2 list-decimal list-inside">
              <li>プラットフォーム管理者が<strong>招待リンク</strong>を発行</li>
              <li>招待リンクを受け取ったら、リンクを開く</li>
              <li>法人情報と施設情報を入力して登録</li>
              <li>施設管理画面で初期設定を完了</li>
            </ol>
            <p className="text-xs text-blue-600 mt-3">
              招待リンクをお持ちでない場合は、プラットフォーム管理者にお問い合わせください。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
