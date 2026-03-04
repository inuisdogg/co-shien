/**
 * キャリアアカウント LP - /career/lp
 * 個人の専門職向けのランディングページ
 *
 * ターゲット: 障害福祉の専門職（保育士、児発管、PT/OT/ST等）
 * 主要訴求: キャリアデータの蓄積・ポータビリティ、履歴書/証明書ワンクリック発行
 * CTA先: /career/signup
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowRight,
  FileText,
  Award,
  Clock,
  TrendingUp,
  CheckCircle,
  ChevronRight,
  Calculator,
  Sparkles,
  Building2,
  LogIn,
  Briefcase,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function CareerLPPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.userType === 'client' || user.userType === 'parent') {
          window.location.href = '/parent';
          return;
        }
        window.location.href = '/career';
        return;
      } catch {}
    }
    setChecking(false);
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-personal border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ====== Header ====== */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.svg"
              alt="Roots"
              width={103}
              height={28}
              className="h-7 w-auto cursor-pointer"
              onClick={() => router.push('/')}
              priority
            />
            <span className="text-xs font-bold text-personal bg-personal/10 px-2 py-0.5 rounded-full">
              キャリア
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/career/login')}
              className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors px-3 py-2 hidden sm:block"
            >
              ログイン
            </button>
            <button
              onClick={() => router.push('/career/signup')}
              className="text-sm font-bold text-white bg-personal hover:bg-personal-dark px-4 py-2 rounded-lg transition-colors"
            >
              無料で始める
            </button>
          </div>
        </div>
      </header>

      {/* ====== Hero ====== */}
      <section className="max-w-6xl mx-auto px-4 pt-20 pb-16 text-center">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-personal bg-personal/10 border border-personal/20 rounded-full px-4 py-1.5 mb-8">
          <Sparkles className="w-3.5 h-3.5" />
          障害福祉に特化した唯一のキャリアプラットフォーム
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-6 tracking-tight">
          あなたのキャリアは、<br className="hidden sm:block" />
          施設に縛られない。
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          勤怠・研修・資格が自動でキャリアに蓄積。転職しても経歴が引き継がれる。<br className="hidden md:block" />
          あなただけのキャリア台帳を、無料で。
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => router.push('/career/signup')}
            className="w-full sm:w-auto bg-personal hover:bg-personal-dark text-white font-bold py-3.5 px-8 rounded-xl transition-colors flex items-center justify-center gap-2 text-base"
          >
            無料でキャリアアカウントを作る
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-4 text-sm text-gray-400">
          <button
            onClick={() => router.push('/facility')}
            className="hover:text-primary transition-colors"
          >
            施設管理者の方: 無料の施設管理システムはこちら
          </button>
        </p>
      </section>

      {/* ====== 4 Pillars ====== */}
      <section className="bg-[#F5F3FF]/50 border-y border-personal/10">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              施設が変わっても、キャリアは続く
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Rootsのキャリアアカウントは施設とは独立した、あなた個人のもの。
              蓄積されたデータはどこへ行っても消えません。
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Clock,
                title: '勤怠が自動で蓄積',
                desc: '出勤・退勤・休憩の記録がキャリアデータとして自動蓄積。勤務時間の累積も計算',
              },
              {
                icon: Award,
                title: '研修・資格を一元管理',
                desc: '強度行動障害研修、サビ管研修など。施設をまたいで取得資格を管理',
              },
              {
                icon: TrendingUp,
                title: '経歴を可視化',
                desc: 'キャリアタイムラインで、いつ・どこで・何をしたかが一目瞭然',
              },
              {
                icon: FileText,
                title: '証明書をワンクリック',
                desc: '実務経験証明書・職務経歴書・履歴書をいつでもPDF出力',
              },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-personal/10 rounded-lg flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-personal" />
                </div>
                <h3 className="font-bold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== Free Tools ====== */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            アカウントがなくても使える無料ツール
          </h2>
          <p className="text-gray-500">
            アカウントを作成すると、データが保存されいつでも再編集できます。
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: FileText,
              title: '履歴書自動生成',
              desc: 'フォームに入力するだけで、障害福祉業界に最適化された履歴書をPDF出力',
              href: '/tools/resume',
            },
            {
              icon: Briefcase,
              title: '職務経歴書作成',
              desc: '施設名・役職・業務内容を入力して、プロフェッショナルな職務経歴書を作成',
              href: '/tools/cv',
            },
            {
              icon: Calculator,
              title: '給与シミュレーター',
              desc: '資格・経験年数・地域から、障害福祉業界の適正給与を算出',
              href: '/tools/salary-simulator',
            },
          ].map((tool) => (
            <div
              key={tool.title}
              onClick={() => router.push(tool.href)}
              className="group bg-gray-50 hover:bg-white rounded-2xl border border-gray-100 hover:border-personal/30 p-8 cursor-pointer transition-all hover:shadow-lg"
            >
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform border border-gray-100">
                <tool.icon className="w-6 h-6 text-personal" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{tool.title}</h3>
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">{tool.desc}</p>
              <span className="text-sm font-medium text-personal flex items-center gap-1 group-hover:gap-2 transition-all">
                使ってみる <ChevronRight className="w-4 h-4" />
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ====== Portability ====== */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <div className="md:flex md:items-center md:gap-16">
            <div className="md:flex-1 mb-10 md:mb-0">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                施設が変わっても、<br />データは消えない。
              </h2>
              <p className="text-gray-500 mb-8 leading-relaxed">
                従来、施設を辞めると勤怠記録も研修記録も施設に残ったまま。
                Rootsなら、すべてのキャリアデータはあなた個人に紐づきます。
                転職しても、独立しても、あなたの積み上げは消えません。
              </p>
              <div className="space-y-3">
                {[
                  '勤怠データはあなたのアカウントに蓄積',
                  '研修・資格の取得記録は施設をまたいで保持',
                  '実務経験証明書はいつでも自分で発行',
                  '転職時のキャリア証明がスムーズに',
                ].map((point) => (
                  <div key={point} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-personal flex-shrink-0" />
                    <span className="text-gray-700 text-sm">{point}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="md:flex-1">
              {/* Timeline visualization */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <p className="text-xs font-bold text-gray-400 mb-4">キャリアタイムライン</p>
                <div className="space-y-4">
                  {[
                    { facility: 'ひまわり発達支援', period: '2020.04 - 2022.03', role: '児童指導員' },
                    { facility: 'さくら放課後デイ', period: '2022.04 - 2024.12', role: '児童発達支援管理責任者' },
                    { facility: 'あおぞら療育', period: '2025.01 - 現在', role: '管理者' },
                  ].map((entry, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${i === 2 ? 'bg-personal' : 'bg-gray-300'}`} />
                        {i < 2 && <div className="w-0.5 flex-1 bg-gray-200" />}
                      </div>
                      <div className="pb-4">
                        <p className="font-bold text-gray-900 text-sm">{entry.facility}</p>
                        <p className="text-xs text-gray-400">{entry.period}</p>
                        <p className="text-xs text-personal font-medium">{entry.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                  <p className="text-xs text-gray-400">すべてのキャリアデータが一元管理されます</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== For those whose facility doesn't use Roots ====== */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 md:p-12">
          <div className="md:flex md:items-center md:gap-12">
            <div className="md:flex-1 mb-6 md:mb-0">
              <p className="text-sm font-bold text-primary mb-2">お勤め先がRootsを使っていない方へ</p>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                個人でもキャリアアカウントは作れます。
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                手動で経歴・資格を登録し、証明書の発行が可能です。
                もし、お勤め先にRootsを導入いただければ、
                勤怠・研修記録が自動でキャリアに蓄積されるようになります。
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push('/career/signup')}
                className="bg-personal hover:bg-personal-dark text-white font-bold py-3 px-6 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                個人でアカウントを作る
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => router.push('/facility')}
                className="bg-white border border-primary text-primary hover:bg-primary/5 font-bold py-3 px-6 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Building2 className="w-4 h-4" />
                施設管理システム（無料）を見る
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ====== CTA ====== */}
      <section className="bg-gradient-to-br from-personal to-personal-dark">
        <div className="max-w-6xl mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            キャリアの蓄積を、今日から始めよう。
          </h2>
          <p className="text-indigo-200 mb-8 max-w-lg mx-auto">
            アカウント作成は無料。あなたのキャリアデータを、あなたの手に。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => router.push('/career/signup')}
              className="w-full sm:w-auto bg-white text-personal hover:bg-gray-100 font-bold py-3.5 px-8 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              無料でアカウントを作る
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.push('/career/login')}
              className="w-full sm:w-auto bg-transparent border border-white/30 text-white hover:border-white hover:bg-white/10 font-bold py-3.5 px-8 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              ログイン
            </button>
          </div>
          <div className="mt-6">
            <button
              onClick={() => router.push('/facility')}
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              施設管理者の方: 施設管理システム（無料）はこちら
            </button>
          </div>
        </div>
      </section>

      {/* ====== Footer ====== */}
      <footer className="bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <Image src="/logo.svg" alt="Roots" width={80} height={22} className="h-5 w-auto opacity-50" />
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <button onClick={() => router.push('/facility')} className="hover:text-primary transition-colors">
                  施設管理システム
                </button>
                <span>|</span>
                <button onClick={() => router.push('/parent/login')} className="hover:text-client transition-colors">
                  保護者の方
                </button>
                <span>|</span>
                <button onClick={() => router.push('/terms')} className="hover:text-gray-600 transition-colors">
                  利用規約
                </button>
                <span>|</span>
                <button onClick={() => router.push('/privacy')} className="hover:text-gray-600 transition-colors">
                  プライバシーポリシー
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              &copy; {new Date().getFullYear()} INU Inc.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
