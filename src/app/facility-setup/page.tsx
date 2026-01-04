/**
 * 施設初期設定 - アカウント確認画面
 * 個人アカウントの有無を確認し、適切なフローに誘導します
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function FacilitySetupPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <img
            src="/logo-cropped-center.png"
            alt="co-shien"
            className="h-16 w-auto mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-800">施設の初回セットアップ</h1>
          <p className="text-gray-600 text-sm mt-2">まず、個人アカウントの有無を確認します</p>
        </div>

        <div className="space-y-3">
          <Link
            href="/login?redirect=/admin-setup&mode=facility-setup"
            className="block w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors text-center"
          >
            はい、アカウントを持っています
            <br />
            <span className="text-sm font-normal">ログインして施設を登録</span>
          </Link>

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

