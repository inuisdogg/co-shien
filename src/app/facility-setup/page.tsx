/**
 * 施設初期設定 - アカウント確認画面
 * 個人アカウントの有無を確認し、適切なフローに誘導します
 *
 * 動線：
 * - アカウントあり → Personal側でログイン後、/admin-setup へ
 * - アカウントなし → /admin-setup で新規作成
 */

'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

export default function FacilitySetupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
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
            <span className="inline-block px-3 py-1 bg-[#00c4cc] text-white text-xs font-bold rounded-full mb-2">
              Biz（事業所向け）
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">施設の初回セットアップ</h1>
          <p className="text-gray-600 text-sm mt-2">Personal側のアカウントをお持ちですか？</p>
        </div>

        <div className="space-y-3">
          <a
            href="https://my.co-shien.inu.co.jp/?redirect=https://biz.co-shien.inu.co.jp/admin-setup"
            className="block w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors text-center"
          >
            はい、アカウントを持っています
            <br />
            <span className="text-sm font-normal">Personal側でログインして施設を登録</span>
          </a>

          <Link
            href="/admin-setup"
            className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 px-4 rounded-md transition-colors text-center"
          >
            いいえ、アカウントを持っていません
            <br />
            <span className="text-sm font-normal">施設と管理者アカウントを同時に作成</span>
          </Link>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            トップページに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

