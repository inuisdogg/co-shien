'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowRight,
  CheckCircle,
  Clock,
  FileText,
  Users,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Receipt,
  Baby,
  BookOpen,
  Shield,
  BarChart3,
  GraduationCap,
  Bus,
  UserPlus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function FacilityLPClient() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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

  const handleRegister = () => {
    router.push('/career/signup?redirect=/facility/register');
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
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
            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              施設管理
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
              onClick={handleRegister}
              className="text-sm font-bold text-white bg-primary hover:bg-primary-dark px-4 py-2 rounded-lg transition-colors"
            >
              無料で始める
            </button>
          </div>
        </div>
      </header>

      {/* ====== Hero ====== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-white to-primary/3" />
        <div className="relative max-w-6xl mx-auto px-4 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-primary bg-primary/10 px-4 py-1.5 rounded-full mb-6">
              <Shield className="w-4 h-4" />
              完全無料の施設管理システム
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 leading-tight tracking-tight">
              実地指導の監査書類、
              <br />
              <span className="text-primary">ワンクリックで出力。</span>
            </h1>
            <p className="mt-6 text-lg text-gray-500 leading-relaxed max-w-xl">
              勤怠管理、請求業務、児童管理、保護者連携——
              <br className="hidden sm:block" />
              施設運営に必要なすべてを、初期費用・月額費用ゼロで。
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-start gap-4">
              <button
                onClick={handleRegister}
                className="w-full sm:w-auto bg-primary hover:bg-primary-dark text-white font-bold py-4 px-8 rounded-xl text-lg transition-all hover:shadow-lg flex items-center justify-center gap-2"
              >
                無料で施設を登録する
                <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-xs text-gray-400 mt-1 sm:mt-3">
                クレジットカード不要・最短3分で開始
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ====== Numbers ====== */}
      <section className="border-y border-gray-100 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-3 gap-8 text-center">
            {[
              { value: '0円', label: '初期費用・月額費用', sub: '完全無料' },
              { value: '3分', label: '登録完了まで', sub: '最短' },
              { value: '制限なし', label: 'スタッフ登録数', sub: '何名でも' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl sm:text-3xl font-extrabold text-primary">
                  {stat.value}
                </div>
                <div className="text-xs text-gray-400 mt-1">{stat.sub}</div>
                <div className="text-sm text-gray-600 mt-0.5 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== Main Pain Point: 監査対応 ====== */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="md:flex md:items-center md:gap-16">
          <div className="md:flex-1 mb-10 md:mb-0">
            <p className="text-sm font-bold text-primary mb-3">最大の課題を解決</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              実地指導、もう怖くない。
            </h2>
            <p className="text-gray-500 leading-relaxed mb-8">
              運営基準に沿った書類を自動生成。必要書類のチェックリスト化、
              提出期限のリマインダー通知、過去の指摘事項の対応状況記録まで。
              監査対応にかかる業務時間を大幅に削減します。
            </p>
            <div className="space-y-3">
              {[
                '事業所自己評価表',
                '個別支援計画',
                'サービス提供記録',
                '人員配置基準適合表',
                '研修実施記録',
                '苦情解決記録',
              ].map((doc) => (
                <div key={doc} className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-gray-700 text-sm">{doc}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="md:flex-1">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-sm">監査書類セット</div>
                  <div className="text-xs text-gray-400">ワンクリックで一括出力</div>
                </div>
              </div>
              <div className="space-y-2">
                {['事業所自己評価表.pdf', '個別支援計画_一覧.pdf', 'サービス提供記録_2月.pdf', '研修実施記録_年度.pdf', '人員配置表.pdf'].map(
                  (file) => (
                    <div
                      key={file}
                      className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg px-4 py-2.5"
                    >
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700 flex-1">{file}</span>
                      <CheckCircle className="w-4 h-4 text-primary" />
                    </div>
                  )
                )}
              </div>
              <button className="w-full mt-4 py-3 bg-primary text-white font-bold rounded-lg text-sm">
                一括ダウンロード
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ====== All Features Grid ====== */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              施設運営のすべてを、ひとつに。
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              すべての機能が完全無料。施設の規模に関わらず、追加費用は一切かかりません。
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { icon: Clock, name: '勤怠管理', desc: '出退勤・残業・有給管理' },
              { icon: CalendarDays, name: 'シフト管理', desc: 'ドラッグ&ドロップでシフト作成' },
              { icon: Receipt, name: '請求管理', desc: '国保連・利用者請求の自動計算' },
              { icon: Baby, name: '児童管理', desc: '利用者登録・受給者証管理' },
              { icon: ClipboardCheck, name: '個別支援計画', desc: 'テンプレートから計画作成' },
              { icon: BookOpen, name: '連絡帳', desc: '保護者とのデイリー連絡' },
              { icon: Users, name: '人員配置', desc: '基準充足を自動チェック' },
              { icon: BarChart3, name: '経営分析', desc: '稼働率・収支・加算率の可視化' },
              { icon: GraduationCap, name: '研修記録', desc: '受講記録・修了証の管理' },
              { icon: Bus, name: '送迎管理', desc: 'ルート最適化・保護者通知' },
              { icon: Shield, name: 'コンプライアンス', desc: '基準適合チェック' },
              { icon: UserPlus, name: '採用管理', desc: '求人掲載・応募管理' },
            ].map((feature) => (
              <div
                key={feature.name}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <feature.icon className="w-6 h-6 text-primary mb-3" />
                <div className="font-bold text-gray-900 text-sm">{feature.name}</div>
                <div className="text-xs text-gray-400 mt-1">{feature.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== Why Free ====== */}
      <section className="bg-gradient-to-br from-primary to-primary-dark">
        <div className="max-w-6xl mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">
            なぜ、すべて無料なのか。
          </h2>
          <div className="max-w-2xl mx-auto space-y-4 text-white/90 leading-relaxed">
            <p>
              Rootsは、障害福祉で働くすべての人のキャリアプラットフォームです。
            </p>
            <p>
              施設管理システムは、現場の業務負担を減らすために無料で提供しています。
              スタッフの方がRootsを通じて勤怠や研修記録を蓄積することで、
              個人のキャリアデータが自動的に構築されます。
            </p>
            <p className="font-bold text-white">
              施設に追加費用が発生することは、今後もありません。
            </p>
          </div>
          <button
            onClick={() => router.push('/career/lp')}
            className="mt-8 text-sm text-white/70 hover:text-white underline underline-offset-4 transition-colors"
          >
            キャリアアカウントについて詳しく見る
          </button>
        </div>
      </section>

      {/* ====== 3 Steps ====== */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            最短3分で運用開始
          </h2>
          <p className="text-gray-500">簡単3ステップで、今日から施設管理をデジタル化。</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: 1,
              icon: Users,
              title: 'あなたのアカウントを作成',
              desc: 'まずキャリアアカウントを作成します。メールアドレスとパスワードだけで完了。',
              time: '1分',
            },
            {
              step: 2,
              icon: Building2,
              title: '施設情報を登録',
              desc: '法人名・施設名・事業所番号を入力。サービス種別や定員も設定できます。',
              time: '2分',
            },
            {
              step: 3,
              icon: UserPlus,
              title: 'スタッフを招待',
              desc: '招待コードを共有するだけ。スタッフも無料でアカウントを作成できます。',
              time: 'すぐに',
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="relative inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
                <item.icon className="w-7 h-7 text-primary" />
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {item.step}
                </span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              <p className="text-xs text-primary font-bold mt-2">{item.time}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ====== FAQ ====== */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-12">
            よくあるご質問
          </h2>
          <div className="space-y-3">
            {[
              {
                q: '本当に完全無料ですか？隠れた費用はありますか？',
                a: 'はい、完全無料です。初期費用・月額費用ともに無料で、機能制限や追加課金もありません。スタッフの人数制限もなく、すべての機能をそのままご利用いただけます。',
              },
              {
                q: 'なぜ施設登録の前にアカウント作成が必要なのですか？',
                a: 'Rootsでは、すべての利用者がキャリアアカウントを持ちます。施設管理者であるあなたの勤怠・研修記録も自動でキャリアに蓄積されます。まずご自身のアカウントを作成し、その後施設を登録する流れです。',
              },
              {
                q: '既存のシステムからデータ移行はできますか？',
                a: 'CSV一括インポートに対応しています。児童情報、スタッフ情報などを既存システムからエクスポートし、Rootsにインポートすることが可能です。',
              },
              {
                q: 'どのようなサービス種別に対応していますか？',
                a: '児童発達支援、放課後等デイサービス、保育所等訪問支援、居宅訪問型児童発達支援に対応しています。複数の種別を同時に運営している施設にも対応可能です。',
              },
              {
                q: '途中で利用を停止した場合、データはどうなりますか？',
                a: 'スタッフのキャリアデータはスタッフ個人に帰属し、施設を離れても保持されます。施設のデータについても、エクスポート機能で取得可能です。',
              },
            ].map((faq, i) => (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left"
                >
                  <span className="font-bold text-gray-900 text-sm pr-4">{faq.q}</span>
                  {openFaq === i ? (
                    <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4">
                    <p className="text-sm text-gray-500 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== Final CTA ====== */}
      <section className="bg-[#0A2540]">
        <div className="max-w-6xl mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            施設運営の負担を、今日から減らしませんか。
          </h2>
          <p className="text-gray-400 mb-8 max-w-lg mx-auto">
            すべての機能が完全無料。クレジットカード不要で、今すぐ始められます。
          </p>
          <button
            onClick={handleRegister}
            className="bg-primary hover:bg-primary-dark text-white font-bold py-4 px-10 rounded-xl text-lg transition-all hover:shadow-lg inline-flex items-center gap-2"
          >
            無料で施設を登録する
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm">
            <button
              onClick={() => router.push('/career/lp')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              個人でキャリアアカウントを作る
            </button>
            <span className="hidden sm:block text-gray-600">|</span>
            <button
              onClick={() => router.push('/parent/login')}
              className="text-gray-400 hover:text-client transition-colors"
            >
              保護者の方はこちら
            </button>
          </div>
        </div>
      </section>

      {/* ====== Footer ====== */}
      <footer className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Image
            src="/logo.svg"
            alt="Roots"
            width={80}
            height={22}
            className="h-5 w-auto"
          />
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <button onClick={() => router.push('/career/login')} className="hover:text-gray-600 transition-colors">
              ログイン
            </button>
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
