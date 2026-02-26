/**
 * 実務経験証明書デジタル発行 — プレミアム機能紹介ページ
 *
 * キャリアアカウント登録を促すランディングページ。
 * デジタル証明書ワークフローの説明 + CTAでキャリア登録へ誘導。
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FileText,
  ArrowRight,
  CheckCircle,
  Mail,
  PenTool,
  CloudLightning,
  Building2,
  User,
  Send,
  Shield,
  Clock,
  Smartphone,
  ChevronRight,
} from 'lucide-react';

export const metadata: Metadata = {
  title: '実務経験証明書デジタル発行 | Roots',
  description:
    'キャリア情報から実務経験証明書を自動作成。メールで先方に送付し、クラウドサインで完結。印刷・郵送不要のデジタルワークフロー。',
  openGraph: {
    title: '実務経験証明書デジタル発行 | Roots',
    description:
      '実務経験証明書の作成・送付・署名をすべてオンラインで完結。保育・福祉専門職のためのデジタルツール。',
    type: 'website',
    locale: 'ja_JP',
    siteName: 'Roots',
  },
};

const steps = [
  {
    number: '01',
    icon: <User className="h-6 w-6" />,
    title: 'キャリア情報を登録',
    description:
      'Rootsキャリアアカウントに、過去の勤務先・在籍期間・職種・業務内容を入力。一度登録すれば何度でも使えます。',
    color: 'bg-blue-500',
  },
  {
    number: '02',
    icon: <FileText className="h-6 w-6" />,
    title: '証明書を自動生成',
    description:
      '登録したキャリア情報から、施設ごと・法人ごとに実務経験証明書を自動作成。プレビューで内容を確認できます。',
    color: 'bg-indigo-500',
  },
  {
    number: '03',
    icon: <Mail className="h-6 w-6" />,
    title: 'あなたのアドレスから送信',
    description:
      '内容に問題がなければ、ツール上からあなた自身のメールアドレスで先方（元勤務先の担当者）にメール送付。テンプレート文言付き。',
    color: 'bg-purple-500',
  },
  {
    number: '04',
    icon: <PenTool className="h-6 w-6" />,
    title: 'クラウドサインで署名',
    description:
      '先方がメールを受信し、内容を確認。問題なければクラウドサインで法人印に相当するデジタル署名を付与して完了。',
    color: 'bg-emerald-500',
  },
];

const benefits = [
  {
    icon: <CloudLightning className="h-5 w-5" />,
    title: '印刷・郵送が不要',
    description: 'すべてオンラインで完結。紙を印刷して送る手間がゼロに。',
  },
  {
    icon: <Clock className="h-5 w-5" />,
    title: '最短即日で完了',
    description: '先方の確認・署名もデジタルなので、最短でその日のうちに署名済み証明書を取得。',
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: '改ざん防止のデジタル証明',
    description: 'クラウドサインによる電子署名で、証明書の真正性を担保。',
  },
  {
    icon: <Smartphone className="h-5 w-5" />,
    title: 'いつでもアクセス',
    description: '署名済み証明書はクラウド上に保管。必要なときにいつでもダウンロード。',
  },
];

export default function CareerCertificatePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/tools" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-lg transition-transform group-hover:scale-105">
              R
            </div>
            <span className="text-xl font-bold text-gray-900">Roots Tools</span>
          </Link>
          <Link
            href="/career"
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md active:scale-[0.98]"
          >
            無料で登録
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-24 right-0 h-[500px] w-[500px] rounded-full bg-indigo-50 opacity-60 blur-3xl" />
          <div className="absolute -bottom-32 -left-20 h-[400px] w-[400px] rounded-full bg-purple-50 opacity-50 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-12 pt-16 sm:px-6 sm:pb-20 sm:pt-24 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
              <PenTool className="h-4 w-4" />
              Rootsキャリア Premium
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
              実務経験証明書を
              <span className="mt-1 block bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                デジタルで発行・署名
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-gray-600 sm:text-lg">
              もう紙を印刷して郵送する必要はありません。
              <br className="hidden sm:block" />
              キャリア情報から証明書を自動作成し、メールで送付。
              <br className="hidden sm:block" />
              先方のクラウドサインで法人印の代わりにデジタル署名。すべてオンラインで完結します。
            </p>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/career"
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-8 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:bg-indigo-700 hover:shadow-xl active:scale-[0.98]"
              >
                Rootsキャリアに無料登録
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-8 py-3.5 text-base font-semibold text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50"
              >
                仕組みを見る
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Before/After comparison */}
      <section className="border-y border-gray-100 bg-gray-50/50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-2xl font-bold text-gray-900 sm:text-3xl">
            従来の方法 vs Roots
          </h2>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Before */}
            <div className="rounded-2xl border border-red-200 bg-white p-6 sm:p-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-600">
                従来の方法
              </div>
              <ul className="space-y-3 text-sm text-gray-600">
                {[
                  '証明書のテンプレートを探してWordで作成',
                  '在籍期間・業務内容を手動で入力',
                  '印刷して封筒に入れて郵送',
                  '先方に届くまで数日〜1週間待ち',
                  '先方が確認して法人印を押印',
                  '署名済み証明書を返送してもらう',
                  '合計: 2〜4週間',
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-500">
                      {i + 1}
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            {/* After */}
            <div className="rounded-2xl border-2 border-indigo-300 bg-white p-6 shadow-lg sm:p-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-600">
                <CloudLightning className="h-3.5 w-3.5" />
                Rootsなら
              </div>
              <ul className="space-y-3 text-sm text-gray-600">
                {[
                  'キャリア情報から証明書を自動生成',
                  'プレビューで内容を確認',
                  'ツール上からメールで先方に送信',
                  '先方がクラウドサインでデジタル署名',
                  '署名済み証明書をクラウドに保管',
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-500" />
                    <span className="font-medium">{text}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-lg bg-indigo-50 p-3 text-center">
                <span className="text-lg font-extrabold text-indigo-600">最短即日</span>
                <span className="ml-1 text-sm text-indigo-500">で署名済み証明書を取得</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works - Step by step */}
      <section id="how-it-works" className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              4ステップで完了
            </h2>
            <p className="mt-3 text-gray-600">
              すべてオンラインで、あなた自身の操作で完結します
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <div key={step.number} className="relative">
                {/* Connector line (hidden on last item and mobile) */}
                {i < steps.length - 1 && (
                  <div className="absolute right-0 top-10 hidden h-0.5 w-8 bg-gray-200 lg:block" style={{ right: '-1rem' }} />
                )}
                <div className="text-center">
                  <div
                    className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg ${step.color}`}
                  >
                    {step.icon}
                  </div>
                  <div className="mb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Step {step.number}
                  </div>
                  <h3 className="text-base font-bold text-gray-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Certificate preview mockup */}
      <section className="border-y border-gray-100 bg-gray-50/50 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left: Description */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                正式な証明書フォーマット
              </h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                Rootsで生成される実務経験証明書は、資格申請や転職に必要な正式フォーマットに準拠。
                証明対象者情報、勤務先情報、在職期間・業務内容、証明者欄を含む標準的な書式です。
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  '施設名・法人名・所在地を自動記入',
                  '在職期間・職種・業務内容を正確に記載',
                  '証明者（施設長等）の署名欄付き',
                  '電子署名で法人印の代わりに',
                  'PDF形式でダウンロード・印刷も可能',
                ].map((text) => (
                  <li key={text} className="flex items-center gap-3 text-sm text-gray-700">
                    <CheckCircle className="h-4 w-4 flex-shrink-0 text-indigo-500" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: Mockup */}
            <div className="flex justify-center">
              <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
                <div
                  className="rounded-lg border border-gray-100 bg-gray-50 p-5"
                  style={{
                    fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", serif',
                    fontSize: '11px',
                    lineHeight: '1.8',
                  }}
                >
                  <div className="text-center mb-3">
                    <div className="font-bold text-sm tracking-[0.3em]">実 務 経 験 証 明 書</div>
                  </div>
                  <div className="text-[10px] text-gray-500 mb-2">
                    下記の者が当施設において勤務したことを証明します。
                  </div>
                  <div className="border border-gray-300 mb-2">
                    <div className="flex border-b border-gray-300">
                      <div className="bg-gray-100 px-2 py-1 w-16 text-[9px] font-bold border-r border-gray-300">氏名</div>
                      <div className="px-2 py-1 flex-1 text-[10px]">田中 花子</div>
                    </div>
                    <div className="flex">
                      <div className="bg-gray-100 px-2 py-1 w-16 text-[9px] font-bold border-r border-gray-300">在職期間</div>
                      <div className="px-2 py-1 flex-1 text-[10px]">2019年4月 〜 2023年3月</div>
                    </div>
                  </div>
                  <div className="flex justify-end items-end gap-3 mt-4">
                    <div className="text-[9px] text-right">
                      <div>社会福祉法人○○</div>
                      <div>施設長 鈴木 太郎</div>
                    </div>
                    <div className="w-8 h-8 rounded-full border-2 border-indigo-400 flex items-center justify-center">
                      <PenTool className="w-3 h-3 text-indigo-500" />
                    </div>
                  </div>
                  <div className="text-center mt-3 text-[8px] text-indigo-500 font-medium">
                    電子署名済み
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-2xl font-bold text-gray-900 sm:text-3xl">
            デジタル発行のメリット
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="rounded-2xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  {benefit.icon}
                </div>
                <h3 className="font-bold text-gray-900">{benefit.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Email workflow detail */}
      <section className="border-y border-gray-100 bg-gray-50/50 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-4 text-center text-2xl font-bold text-gray-900 sm:text-3xl">
            あなた自身が送る、だから安心
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-gray-600">
            Rootsが代行するのではなく、あなた自身のメールアドレスから送信。
            先方から見ても、あなたからの正式な依頼として届きます。
          </p>

          <div className="space-y-6">
            {/* Sender */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-gray-900">あなた（送信者）</div>
                  <div className="mt-1 text-sm text-gray-500">tanaka.hanako@example.com</div>
                  <div className="mt-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                    <div className="font-bold text-gray-800 mb-1">件名: 実務経験証明書のご確認のお願い</div>
                    <p className="text-gray-600 text-xs leading-relaxed">
                      お世話になっております。田中花子と申します。<br />
                      貴施設に在籍していた際の実務経験証明書を作成いたしましたので、<br />
                      内容をご確認の上、電子署名をお願いできますでしょうか。<br />
                      下記のリンクから証明書の確認・署名が可能です。
                    </p>
                    <div className="mt-3 inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white">
                      <Send className="h-3 w-3" />
                      証明書を確認・署名する
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                <ArrowRight className="h-5 w-5 text-indigo-600 rotate-90" />
              </div>
            </div>

            {/* Receiver */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <Building2 className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-gray-900">元勤務先の担当者（署名者）</div>
                  <div className="mt-1 text-sm text-gray-500">suzuki@hoikuen-example.jp</div>
                  <div className="mt-3 text-sm text-gray-600">
                    メールを受信 → 証明書の内容を確認 → クラウドサインで電子署名 → 完了
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 py-20 sm:py-28">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-white/5" />

        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            実務経験証明書の発行を
            <br />
            デジタルで簡単に
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-indigo-100">
            Rootsキャリアアカウントに無料登録して、
            キャリア情報の管理から証明書のデジタル発行まで、
            すべてをオンラインで完結させましょう。
          </p>

          <div className="mt-10">
            <Link
              href="/career"
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-bold text-indigo-700 shadow-lg transition-all hover:bg-gray-50 hover:shadow-xl active:scale-[0.98]"
            >
              Rootsキャリアに無料登録
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>

          <p className="mt-6 text-sm text-indigo-200">
            無料プランあり・クレジットカード不要
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">
                R
              </div>
              <span className="text-lg font-bold text-gray-900">Roots</span>
            </Link>
            <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <Link href="/tools" className="hover:text-indigo-600 transition-colors">
                ツール一覧
              </Link>
              <Link href="/career" className="hover:text-indigo-600 transition-colors">
                キャリアプラットフォーム
              </Link>
            </nav>
            <p className="text-sm text-gray-400">
              &copy; {new Date().getFullYear()} Roots
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
