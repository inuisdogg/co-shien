/**
 * Auth-aware CTA section for the Tools page.
 * Shows personalized greeting for logged-in users, registration CTA otherwise.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Wrench } from 'lucide-react';

export default function ToolsAuthCTA() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setIsLoggedIn(true);
        setUserName(user.name || user.lastName || '');
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Logged-in users: show a shorter, personalized section
  if (isLoggedIn) {
    return (
      <section className="relative overflow-hidden bg-gradient-to-br from-personal via-personal-dark to-indigo-700 py-16 sm:py-20">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-white/5" />

        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white">
            <Wrench className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
            {userName ? `${userName}さん、` : ''}ツールをご活用ください
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-indigo-200">
            Rootsアカウントにログイン済みです。すべてのツールをご利用いただけます。
          </p>

          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/career"
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-bold text-personal-dark shadow-lg transition-all hover:bg-gray-50 hover:shadow-xl active:scale-[0.98]"
            >
              マイページへ
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // Not logged in: show the full registration CTA
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-personal via-personal-dark to-indigo-700 py-20 sm:py-28">
      <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
      <div className="absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-white/5" />

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
          ツールだけじゃない。
          <br />
          あなたのキャリアを丸ごとサポート。
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-indigo-200">
          Rootsは保育・福祉専門職のためのキャリアプラットフォーム。
          経歴管理・スキルの可視化・求人マッチングまで、
          あなたのキャリアを一元管理できます。
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/career"
            className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-bold text-personal-dark shadow-lg transition-all hover:bg-gray-50 hover:shadow-xl active:scale-[0.98]"
          >
            無料でRootsに登録
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            href="/tools"
            className="inline-flex items-center gap-2 rounded-full border-2 border-white/30 px-8 py-3.5 text-base font-semibold text-white transition-all hover:border-white/60 hover:bg-white/10"
          >
            ツール一覧に戻る
          </Link>
        </div>

        <p className="mt-6 text-sm text-indigo-200">
          無料プランあり・クレジットカード不要
        </p>
      </div>
    </section>
  );
}
