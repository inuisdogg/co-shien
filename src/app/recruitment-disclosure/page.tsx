/**
 * 職業紹介事業の情報開示ページ
 * 職業安定法に基づく情報開示
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

export default function RecruitmentDisclosurePage() {
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
          <h1 className="text-3xl font-bold text-gray-800 mb-2">職業紹介事業の情報開示</h1>
          <p className="text-sm text-gray-500 mb-2">職業安定法第32条の16第3項に基づく情報提供</p>
          <p className="text-sm text-gray-500 mb-8">最終更新日: 2024年1月1日</p>

          <div className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">1. 事業概要</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 rounded-lg">
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <th className="bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-700 w-1/3">事業の名称</th>
                      <td className="px-4 py-3 text-sm text-gray-700">Roots（ルーツ）</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <th className="bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-700">運営会社</th>
                      <td className="px-4 py-3 text-sm text-gray-700">株式会社INU</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <th className="bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-700">事業の種類</th>
                      <td className="px-4 py-3 text-sm text-gray-700">有料職業紹介事業（申請準備中）</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <th className="bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-700">許可番号</th>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <span className="inline-block bg-yellow-50 text-yellow-700 text-xs font-medium px-2 py-1 rounded">申請中</span>
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <th className="bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-700">代表者</th>
                      <td className="px-4 py-3 text-sm text-gray-700">代表取締役</td>
                    </tr>
                    <tr>
                      <th className="bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-700">所在地</th>
                      <td className="px-4 py-3 text-sm text-gray-700">※登記情報に準ずる</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">2. 取扱職種の範囲</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                当社は、主に障害福祉サービス事業所（児童発達支援・放課後等デイサービス等）における以下の職種を取り扱います。
              </p>
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">対象職種一覧</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0"></span>
                    <span className="text-gray-700 text-sm">保育士</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0"></span>
                    <span className="text-gray-700 text-sm">児童指導員</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0"></span>
                    <span className="text-gray-700 text-sm">理学療法士（PT）</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0"></span>
                    <span className="text-gray-700 text-sm">作業療法士（OT）</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0"></span>
                    <span className="text-gray-700 text-sm">言語聴覚士（ST）</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0"></span>
                    <span className="text-gray-700 text-sm">看護師</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0"></span>
                    <span className="text-gray-700 text-sm">管理者</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0"></span>
                    <span className="text-gray-700 text-sm">サービス管理責任者</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0"></span>
                    <span className="text-gray-700 text-sm">児童発達支援管理責任者</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0"></span>
                    <span className="text-gray-700 text-sm">相談支援専門員</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0"></span>
                    <span className="text-gray-700 text-sm">社会福祉士</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0"></span>
                    <span className="text-gray-700 text-sm">精神保健福祉士</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0"></span>
                    <span className="text-gray-700 text-sm">臨床心理士・公認心理師</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-gray-400 rounded-full shrink-0"></span>
                    <span className="text-gray-700 text-sm">その他、障害福祉サービスに関連する職種</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-3">
                ※ 取扱地域は日本国内全域とします。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">3. 手数料に関する事項</h2>
              <div className="space-y-4">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <h3 className="font-semibold text-blue-800 mb-2">求職者の皆さまへ</h3>
                  <p className="text-blue-700 text-sm">
                    求職者の方からは、一切の手数料をいただきません。完全無料でご利用いただけます。
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">求人者（事業所）の手数料</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200 rounded-lg">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b border-gray-200">項目</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b border-gray-200">内容</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-200">
                          <td className="px-4 py-3 text-sm text-gray-700 font-medium">掲載料プラン</td>
                          <td className="px-4 py-3 text-sm text-gray-700">月額制（プランにより異なる）</td>
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="px-4 py-3 text-sm text-gray-700 font-medium">成功報酬型</td>
                          <td className="px-4 py-3 text-sm text-gray-700">今後検討予定</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-sm text-gray-700 font-medium">手数料表</td>
                          <td className="px-4 py-3 text-sm text-gray-700">別途お問い合わせください</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    ※ 手数料の詳細については、個別のご契約内容に基づきます。詳しくはお問い合わせください。
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">4. 個人情報の取扱い</h2>
              <p className="text-gray-700 leading-relaxed">
                当社は、職業紹介事業において取得した個人情報を、当社の
                <Link href="/privacy" className="text-indigo-600 hover:underline font-medium">
                  プライバシーポリシー
                </Link>
                に従い適切に取り扱います。
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 mt-3 ml-4">
                <li>求職者の個人情報は、職業紹介の目的以外に使用いたしません</li>
                <li>求職者の同意なく、求人者に対して個人情報を提供いたしません（応募時を除く）</li>
                <li>個人情報の管理にあたっては、漏洩・滅失・き損の防止に適切な措置を講じます</li>
                <li>求職者の個人情報は、求職の取扱いが終了した後も適切に保管し、一定期間経過後に安全に廃棄します</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">5. 苦情の処理に関する事項</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">苦情受付窓口</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 text-sm">
                      <span className="font-semibold">担当部署</span>：職業紹介事業 苦情受付担当<br />
                      <span className="font-semibold">連絡先</span>：support@inu.co.jp<br />
                      <span className="font-semibold">受付時間</span>：平日 10:00〜18:00（土日祝日・年末年始を除く）
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">苦情処理の方法</h3>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>苦情を受け付けた場合、担当者が内容を確認し、速やかに事実関係の調査を行います</li>
                    <li>調査結果に基づき、必要な改善措置を講じます</li>
                    <li>苦情の申出者に対し、処理結果を速やかに通知いたします</li>
                    <li>苦情の内容および処理経過を記録し、再発防止に努めます</li>
                  </ol>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                  <h3 className="font-semibold text-amber-800 mb-2">外部相談窓口</h3>
                  <p className="text-amber-700 text-sm">
                    当社の対応にご不満がある場合は、管轄の公共職業安定所（ハローワーク）または
                    都道府県労働局にご相談いただくことも可能です。
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">6. 返戻金制度</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                当社の職業紹介により就職した求職者が、以下の事由により早期に退職した場合、求人者に対して手数料の一部を返戻する制度を設けています。
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 rounded-lg">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b border-gray-200">退職時期</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b border-gray-200">返戻金の割合</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="px-4 py-3 text-sm text-gray-700">入職後1ヶ月以内の退職</td>
                      <td className="px-4 py-3 text-sm text-gray-700">手数料の80%を返戻</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="px-4 py-3 text-sm text-gray-700">入職後1ヶ月超〜3ヶ月以内の退職</td>
                      <td className="px-4 py-3 text-sm text-gray-700">手数料の50%を返戻</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm text-gray-700">入職後3ヶ月超〜6ヶ月以内の退職</td>
                      <td className="px-4 py-3 text-sm text-gray-700">手数料の20%を返戻</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-gray-600 mt-3">
                ※ 返戻金制度は、成功報酬型の手数料体系を採用した場合に適用されます。掲載料プランには適用されません。<br />
                ※ 退職事由が求人者の責めに帰すべき場合（労働条件の相違等）は、返戻金制度の対象外となります。<br />
                ※ 返戻金の請求は、退職の事実を確認できる書類の提出をもって受け付けます。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-4">7. その他の情報</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>当社は、職業安定法その他の関連法令を遵守し、公正な職業紹介事業の運営に努めます</li>
                <li>求人の申込みを受理した場合、その内容が法令に違反するものでない限り、すべての求人を受理いたします</li>
                <li>求職者に対し、性別、年齢、障害の有無等により不当な差別的取扱いを行いません</li>
                <li>本開示事項は、法令の改正や事業内容の変更等により、予告なく変更する場合があります</li>
              </ul>
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
