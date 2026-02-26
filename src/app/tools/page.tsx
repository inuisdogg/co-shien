/**
 * Tools Landing Page
 *
 * Standalone marketing page that lists all available free tools
 * for childcare / welfare professionals. Designed to attract
 * organic search traffic and funnel users toward the Roots career platform.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FileText,
  Clock,
  ArrowRight,
  Sparkles,
  Shield,
  Zap,
  ChevronRight,
  Wrench,
  ScrollText,
  Briefcase,
  Lock,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  SEO Metadata                                                       */
/* ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: '保育・福祉の専門職のための無料ツール | Roots',
  description:
    '履歴書・職務経歴書の自動生成、実務経験証明書のデジタル発行、キャリア年表の可視化など、保育士・福祉専門職のキャリアを支える無料ツール集。',
  openGraph: {
    title: '保育・福祉の専門職のための無料ツール | Roots',
    description:
      '履歴書・職務経歴書の自動生成、実務経験証明書のデジタル発行など、保育士・福祉専門職のキャリアを支える無料ツール集。',
    type: 'website',
    locale: 'ja_JP',
    siteName: 'Roots',
  },
  twitter: {
    card: 'summary_large_image',
    title: '保育・福祉の専門職のための無料ツール | Roots',
    description:
      '履歴書・職務経歴書の自動生成、実務経験証明書のデジタル発行。保育士・福祉専門職向け無料ツール。',
  },
};

/* ------------------------------------------------------------------ */
/*  Tool definitions                                                   */
/* ------------------------------------------------------------------ */

interface Tool {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

interface PremiumTool {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  premium?: boolean;
}

const tools: PremiumTool[] = [
  {
    title: '履歴書自動生成',
    description:
      '保育・福祉専門職向けのフォーマットで、入力するだけでJIS規格の履歴書PDFを自動作成。学歴・職歴・資格を整理して出力',
    href: '/tools/resume',
    icon: <ScrollText className="h-7 w-7" />,
    badge: '人気',
  },
  {
    title: '職務経歴書自動生成',
    description:
      '施設ごとの業務内容・実績・スキルを入力して、採用担当者に伝わる職務経歴書PDFを自動作成',
    href: '/tools/cv',
    icon: <Briefcase className="h-7 w-7" />,
    badge: 'NEW',
  },
  {
    title: 'キャリア年表メーカー',
    description:
      '保育・福祉キャリアの経歴を入力して、視覚的なタイムラインを作成。転職や資格取得の記録に',
    href: '/tools/career-timeline',
    icon: <Clock className="h-7 w-7" />,
  },
  {
    title: '実務経験証明書デジタル発行',
    description:
      'キャリア情報から施設ごとの実務経験証明書を自動作成。メールで先方に送付し、クラウドサインで完結',
    href: '/tools/career-certificate',
    icon: <FileText className="h-7 w-7" />,
    premium: true,
    badge: 'Premium',
  },
];

/* ------------------------------------------------------------------ */
/*  Feature items                                                      */
/* ------------------------------------------------------------------ */

interface Feature {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const features: Feature[] = [
  {
    title: '書類作成が一瞬',
    description:
      '履歴書・職務経歴書を入力するだけで自動生成。面倒な書式調整やレイアウト作業は不要です。',
    icon: <Sparkles className="h-6 w-6" />,
  },
  {
    title: '実務経験証明書をデジタル化',
    description:
      'キャリア情報から証明書を自動作成し、メールで送付。クラウドサインで印刷・郵送なしに完結します。',
    icon: <Shield className="h-6 w-6" />,
  },
  {
    title: '専門職特化フォーマット',
    description:
      '保育士・児童指導員・社会福祉士など、福祉専門職の実務に即した項目・レイアウトを採用。',
    icon: <Zap className="h-6 w-6" />,
  },
];

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ============================================================ */}
      {/*  Header                                                      */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-lg transition-transform group-hover:scale-105">
              R
            </div>
            <span className="text-xl font-bold text-gray-900">
              Roots
            </span>
          </Link>

          {/* Nav actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/tools"
              className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
            >
              <Wrench className="h-4 w-4" />
              ツール一覧
            </Link>
            <Link
              href="/career"
              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md active:scale-[0.98]"
            >
              Rootsに登録
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/*  Hero Section                                                */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-24 right-0 h-[500px] w-[500px] rounded-full bg-indigo-50 opacity-60 blur-3xl" />
          <div className="absolute -bottom-32 -left-20 h-[400px] w-[400px] rounded-full bg-purple-50 opacity-50 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-28 lg:px-8">
          <div className="text-center">
            {/* Pill badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
              <Wrench className="h-4 w-4" />
              すべて無料・登録不要
            </div>

            {/* Main heading */}
            <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              <span className="block">保育・福祉の専門職のための</span>
              <span className="mt-2 block bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                無料キャリアツール
              </span>
            </h1>

            {/* Subtext */}
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 sm:text-xl">
              履歴書・職務経歴書の自動生成から実務経験証明書のデジタル発行まで。
              <br className="hidden sm:block" />
              保育士・児童指導員・社会福祉士のキャリア形成をサポートします。
            </p>

            {/* Stats */}
            <div className="mx-auto mt-10 flex max-w-md items-center justify-center gap-8 sm:gap-12">
              <div className="text-center">
                <div className="text-3xl font-extrabold text-indigo-600 sm:text-4xl">
                  {tools.length}
                </div>
                <div className="mt-1 text-sm font-medium text-gray-500">
                  ツール公開中
                </div>
              </div>
              <div className="h-10 w-px bg-gray-200" />
              <div className="text-center">
                <div className="text-3xl font-extrabold text-indigo-600 sm:text-4xl">
                  0円
                </div>
                <div className="mt-1 text-sm font-medium text-gray-500">
                  完全無料
                </div>
              </div>
              <div className="h-10 w-px bg-gray-200" />
              <div className="text-center">
                <div className="text-3xl font-extrabold text-indigo-600 sm:text-4xl">
                  30秒
                </div>
                <div className="mt-1 text-sm font-medium text-gray-500">
                  で書類完成
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Tool Cards Grid                                             */}
      {/* ============================================================ */}
      <section className="relative bg-gray-50/70 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              ツール一覧
            </h2>
            <p className="mt-3 text-gray-600">
              必要なツールを選んで、すぐにお使いいただけます
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
            {tools.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className={`group relative flex flex-col rounded-2xl border p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 ${
                  tool.premium
                    ? 'border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 hover:border-indigo-400 hover:shadow-lg'
                    : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-lg'
                }`}
              >
                {/* Badge */}
                {tool.badge && (
                  <span
                    className={`absolute right-4 top-4 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      tool.badge === 'NEW'
                        ? 'bg-green-100 text-green-700'
                        : tool.badge === 'Premium'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {tool.badge === 'Premium' && <Lock className="inline h-3 w-3 mr-0.5 -mt-0.5" />}
                    {tool.badge}
                  </span>
                )}

                {/* Icon */}
                <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl transition-colors ${
                  tool.premium
                    ? 'bg-indigo-100 text-indigo-700 group-hover:bg-indigo-200'
                    : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100'
                }`}>
                  {tool.icon}
                </div>

                {/* Content */}
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                  {tool.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">
                  {tool.description}
                </p>

                {/* Premium note */}
                {tool.premium && (
                  <p className="mt-2 text-xs text-indigo-500 font-medium">
                    Rootsキャリアアカウント登録で利用可能
                  </p>
                )}

                {/* Action hint */}
                <div className="mt-5 flex items-center gap-1 text-sm font-semibold text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100">
                  {tool.premium ? 'くわしく見る' : 'ツールを使う'}
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Features Section (なぜRootsのツール？)                       */}
      {/* ============================================================ */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              なぜRootsのツール？
            </h2>
            <p className="mt-3 text-gray-600">
              専門職の方が安心して使える理由があります
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  CTA Section                                                 */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 py-20 sm:py-28">
        {/* Decorative circles */}
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-white/5" />

        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            ツールだけじゃない。
            <br />
            あなたのキャリアを丸ごとサポート。
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-indigo-100">
            Rootsは保育・福祉専門職のためのキャリアプラットフォーム。
            経歴管理・スキルの可視化・求人マッチングまで、
            あなたのキャリアを一元管理できます。
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/career"
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-bold text-indigo-700 shadow-lg transition-all hover:bg-gray-50 hover:shadow-xl active:scale-[0.98]"
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

      {/* ============================================================ */}
      {/*  Footer                                                      */}
      {/* ============================================================ */}
      <footer className="border-t border-gray-100 bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">
                R
              </div>
              <span className="text-lg font-bold text-gray-900">
                Roots
              </span>
            </Link>

            {/* Links */}
            <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <Link href="/tools" className="hover:text-indigo-600 transition-colors">
                ツール一覧
              </Link>
              <Link href="/career" className="hover:text-indigo-600 transition-colors">
                キャリアプラットフォーム
              </Link>
              <Link href="/terms" className="hover:text-indigo-600 transition-colors">
                利用規約
              </Link>
            </nav>

            {/* Copyright */}
            <p className="text-sm text-gray-400">
              &copy; {new Date().getFullYear()} Roots
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
