/**
 * プライバシーポリシーページ
 * 株式会社INUが運営するRootsの個人情報保護方針
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          戻る
        </button>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">プライバシーポリシー</h1>
          <p className="text-sm text-gray-500 mb-8">最終更新日: 2024年1月1日</p>

          <div className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">1. 個人情報保護方針</h2>
              <p className="text-gray-700 leading-relaxed">
                株式会社INU（以下「当社」といいます）は、「Roots」サービス（以下「本サービス」といいます）の運営において、
                個人情報の保護に関する法律（以下「個人情報保護法」といいます）その他の関連法令を遵守し、
                以下のプライバシーポリシー（以下「本ポリシー」といいます）に従い、ユーザーの個人情報を適切に取り扱います。
              </p>
              <p className="text-gray-700 leading-relaxed mt-2">
                当社は、個人情報の重要性を認識し、その保護を社会的責務と考え、個人情報に関する法令および社内規程を遵守し、
                本サービスにおける個人情報の取得、利用、管理を適正に行います。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">2. 収集する個人情報</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                当社は、本サービスの提供にあたり、以下の個人情報を収集することがあります。
              </p>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">2.1 アカウント情報</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                    <li>氏名（漢字・フリガナ）</li>
                    <li>メールアドレス</li>
                    <li>電話番号</li>
                    <li>生年月日</li>
                    <li>性別</li>
                    <li>パスワード（暗号化して保存）</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">2.2 職務経歴・資格情報</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                    <li>保有資格（保育士、児童指導員、理学療法士、作業療法士、言語聴覚士等）</li>
                    <li>職務経歴・勤務経験</li>
                    <li>希望勤務条件（勤務地、勤務形態、給与等）</li>
                    <li>自己紹介・スキル情報</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">2.3 位置情報</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                    <li>住所情報（求人検索の距離計算に使用）</li>
                    <li>求人検索時の位置情報（ユーザーの同意がある場合のみ）</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">2.4 利用履歴・閲覧履歴</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                    <li>本サービスの利用履歴</li>
                    <li>求人情報の閲覧履歴・応募履歴</li>
                    <li>ログイン日時・アクセスログ</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">2.5 児童・利用者情報（施設管理者が入力）</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                    <li>利用児童の氏名・生年月日</li>
                    <li>保護者情報</li>
                    <li>個別支援計画に関する情報</li>
                    <li>通所記録・サービス提供記録</li>
                    <li>その他施設運営に必要な情報</li>
                  </ul>
                  <p className="text-sm text-gray-600 mt-2 ml-4">
                    ※ 児童・利用者情報は、施設管理者が保護者の同意のもと入力するものであり、
                    施設との利用契約に基づいて管理されます。
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">3. 利用目的</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                当社は、収集した個人情報を以下の目的で利用いたします。
              </p>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                <li>
                  <span className="font-semibold">サービスの提供・運営</span>
                  <p className="text-gray-600 ml-6 mt-1">
                    本サービスの各種機能の提供、アカウントの管理、本人確認、ユーザーサポートの提供
                  </p>
                </li>
                <li>
                  <span className="font-semibold">求人マッチング・推薦</span>
                  <p className="text-gray-600 ml-6 mt-1">
                    ユーザーの資格・経験・希望条件に基づく求人情報の推薦、施設と求職者のマッチング
                  </p>
                </li>
                <li>
                  <span className="font-semibold">施設管理機能の提供</span>
                  <p className="text-gray-600 ml-6 mt-1">
                    施設の児童管理、スタッフ管理、個別支援計画の作成支援、通所記録管理等の施設運営支援機能の提供
                  </p>
                </li>
                <li>
                  <span className="font-semibold">サービスの改善・分析</span>
                  <p className="text-gray-600 ml-6 mt-1">
                    本サービスの改善、新機能の開発、利用状況の分析・統計
                  </p>
                </li>
                <li>
                  <span className="font-semibold">法令に基づく届出・報告</span>
                  <p className="text-gray-600 ml-6 mt-1">
                    障害福祉サービスに関する行政への届出・報告、職業安定法に基づく報告等、法令により義務付けられた事項への対応
                  </p>
                </li>
                <li>
                  <span className="font-semibold">お知らせ・連絡</span>
                  <p className="text-gray-600 ml-6 mt-1">
                    本サービスに関する重要なお知らせ、メンテナンス情報、規約変更等のご連絡
                  </p>
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">4. 第三者提供</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                当社は、以下の場合を除き、ユーザーの同意なく個人情報を第三者に提供いたしません。
              </p>
              <ol className="list-decimal list-inside space-y-3 text-gray-700">
                <li>
                  <span className="font-semibold">求人応募時の情報提供</span>
                  <p className="text-gray-600 ml-6 mt-1">
                    ユーザーが求人に応募した場合、応募先施設に対してユーザーのプロフィール情報（氏名、資格、職務経歴等）を提供します。
                    この場合、応募行為をもってユーザーの同意があったものとみなします。
                  </p>
                </li>
                <li>
                  <span className="font-semibold">法令に基づく開示</span>
                  <p className="text-gray-600 ml-6 mt-1">
                    法令に基づき開示が求められた場合、裁判所、検察庁、警察等の公的機関から法令に基づく開示要求があった場合
                  </p>
                </li>
                <li>
                  <span className="font-semibold">人の生命、身体または財産の保護</span>
                  <p className="text-gray-600 ml-6 mt-1">
                    人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき
                  </p>
                </li>
                <li>
                  <span className="font-semibold">業務委託</span>
                  <p className="text-gray-600 ml-6 mt-1">
                    利用目的の達成に必要な範囲内において個人情報の取扱いの全部または一部を委託する場合。
                    この場合、委託先に対して必要かつ適切な監督を行います。
                  </p>
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">5. 個人情報の管理</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                当社は、個人情報の漏洩、滅失またはき損の防止その他の個人情報の安全管理のために、以下の措置を講じます。
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>
                  <span className="font-semibold">SSL/TLS暗号化通信</span>：本サービスとの通信はすべてSSL/TLSにより暗号化されます
                </li>
                <li>
                  <span className="font-semibold">データベースのアクセス制御</span>：個人情報を含むデータベースへのアクセスは、業務上必要な者に限定し、適切なアクセス制御を実施します
                </li>
                <li>
                  <span className="font-semibold">パスワードの暗号化保存</span>：ユーザーのパスワードはハッシュ化して保存し、平文での保存は行いません
                </li>
                <li>
                  <span className="font-semibold">従業員の教育・管理</span>：個人情報を取り扱う従業員に対して、個人情報保護に関する教育・研修を実施し、適切な管理を行います
                </li>
                <li>
                  <span className="font-semibold">セキュリティ監査</span>：定期的にセキュリティ対策の見直しを行い、必要に応じて改善措置を講じます
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">6. 個人情報の開示・訂正・削除</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                ユーザーは、当社に対して以下の請求を行うことができます。当社は、本人確認の上、合理的な期間内に対応いたします。
              </p>
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-1">6.1 開示請求</h3>
                  <p className="text-gray-600 text-sm">
                    当社が保有するユーザーの個人情報について、その内容の開示を請求することができます。
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-1">6.2 訂正・削除請求</h3>
                  <p className="text-gray-600 text-sm">
                    当社が保有するユーザーの個人情報に誤りがある場合、その訂正または削除を請求することができます。
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-1">6.3 利用停止請求</h3>
                  <p className="text-gray-600 text-sm">
                    当社が保有するユーザーの個人情報について、その利用の停止または消去を請求することができます。
                    ただし、利用停止により本サービスの全部または一部の提供ができなくなる場合があります。
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-1">6.4 データポータビリティ</h3>
                  <p className="text-gray-600 text-sm">
                    ユーザーは、当社が保有する自己の個人情報について、構造化され、一般的に利用される機械可読性のある形式で
                    受け取る権利を有します。ご希望の場合はお問い合わせ窓口までご連絡ください。
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">7. Cookie・アクセス解析</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                本サービスでは、以下の目的でCookieおよびこれに類する技術を使用することがあります。
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>ユーザーのログイン状態の維持</li>
                <li>ユーザーの設定情報の保存</li>
                <li>本サービスの利用状況の分析（アクセス解析）</li>
                <li>本サービスの品質向上のための統計情報の収集</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-3">
                ユーザーは、ブラウザの設定によりCookieの受け入れを拒否することができますが、
                その場合、本サービスの一部の機能がご利用いただけなくなる場合があります。
              </p>
              <p className="text-gray-700 leading-relaxed mt-2">
                当社は、Google Analyticsなどのアクセス解析ツールを使用する場合があります。
                これらのツールはCookieを使用してユーザーの利用情報を収集しますが、個人を特定する情報は含まれません。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">8. 改定</h2>
              <p className="text-gray-700 leading-relaxed">
                当社は、必要に応じて本ポリシーを改定することがあります。改定した場合には、本サービス上での掲示その他適切な方法により
                ユーザーに通知いたします。改定後のプライバシーポリシーは、本サービス上に掲載した時点から効力を生じるものとします。
              </p>
              <p className="text-gray-700 leading-relaxed mt-2">
                重要な変更がある場合には、本サービス上での目立つ告知またはメールにてお知らせいたします。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">9. お問い合わせ</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                本ポリシーに関するお問い合わせ、個人情報の開示・訂正・削除等のご請求は、以下の窓口までご連絡ください。
              </p>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700">
                  <span className="font-semibold">個人情報管理責任者</span>
                </p>
                <p className="text-gray-700 mt-2">
                  株式会社INU<br />
                  メール: privacy@inu.co.jp<br />
                  ※ お問い合わせの際は、本人確認のためお名前・ご登録のメールアドレスをお知らせください。
                </p>
              </div>
            </section>

            <section className="mt-8 pt-8 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                以上
              </p>
              <p className="text-sm text-gray-600 mt-4">
                株式会社INU
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
