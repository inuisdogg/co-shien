/**
 * 加算一覧（加算カタログ）
 * - kasan.csvに基づく加算マスタの表示
 * - 体制加算と実施加算を分類表示
 * - 取得条件・要件と具体的な内容を詳細表示
 */

'use client';

import React, { useState } from 'react';
import {
  List,
  Users,
  Target,
  DollarSign,
  Truck,
  Heart,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  Info,
  Building,
  ClipboardCheck,
  BookOpen,
} from 'lucide-react';

// 加算データの型定義
interface AdditionData {
  category: '体制' | '実施';
  name: string;
  units: string;
  requirements: string;
  notes: string;
  examples?: string[]; // 具体的な取得事例
}

// kasan.csvに基づく加算データ
const ADDITIONS_DATA: AdditionData[] = [
  // ========== 体制系 ==========
  {
    category: '体制',
    name: '児童指導員等加配加算',
    units: '・常勤専従・経験5年以上：187単位\n・常勤専従・経験5年未満：152単位\n・常勤換算・経験5年以上：123単位\n・常勤換算・経験5年未満：107単位\n・その他従業者：90単位\n(定員10名の場合)',
    requirements: '基本の人員基準に加え、児童指導員等の有資格者やその他の従業者を常勤換算で1人以上配置していること',
    notes: '対象資格：保育士、児童指導員、理学療法士、作業療法士、言語聴覚士、心理担当職員など。経験年数は180日以上/年を1年とする。',
    examples: [
      '定員10名の事業所で、基本配置の2名に加えて保育士資格を持つ常勤スタッフ1名を追加配置 → 常勤専従で算定',
      'パートの児童指導員（週30時間勤務）を2名雇用し、合計で常勤換算1名分を確保 → 常勤換算で算定',
      '5年以上の経験を持つ言語聴覚士を週3日（週24時間）で配置 → 常勤換算・経験5年以上で算定',
    ],
  },
  {
    category: '体制',
    name: '専門的支援体制加算',
    units: '・理学療法士等の配置：123単位/日\n(定員10名の場合)',
    requirements: '基本の人員基準に加え、専門的な支援を提供する体制（理学療法士等）を常勤換算で1人以上配置していること',
    notes: '対象：理学療法士、作業療法士、言語聴覚士、心理担当職員、視覚障害児支援担当職員。5年以上従事した保育士・児童指導員も対象。',
    examples: [
      '作業療法士を週4日勤務（常勤換算0.8）で配置し、感覚統合などの専門的支援を実施',
      '児童発達支援で10年経験のある保育士を常勤配置し、専門的支援の中核を担当',
      '心理担当職員（公認心理師）を常勤で配置し、発達検査やカウンセリングを実施',
    ],
  },
  {
    category: '体制',
    name: '福祉専門職員配置等加算(I)',
    units: '15単位/日',
    requirements: '児童指導員として配置されている常勤従業者のうち、社会福祉士、介護福祉士、精神保健福祉士、公認心理師の割合が35%以上',
    notes: '常勤職員の資格保有率で判定される。',
    examples: [
      '常勤スタッフ3名中、社会福祉士1名＋公認心理師1名を配置（資格保有率66%）→ 算定可',
      '常勤4名のうち、介護福祉士1名＋精神保健福祉士1名を配置（資格保有率50%）→ 算定可',
    ],
  },
  {
    category: '体制',
    name: '福祉専門職員配置等加算(II)',
    units: '10単位/日',
    requirements: '児童指導員として配置されている常勤従業者のうち、社会福祉士等の有資格者の割合が25%以上',
    notes: '(I)の要件に満たない場合の区分。',
    examples: [
      '常勤スタッフ4名中、社会福祉士1名を配置（資格保有率25%）→ (II)で算定',
      '常勤3名中、介護福祉士1名を配置（資格保有率33%だが35%未満）→ (II)で算定',
    ],
  },
  {
    category: '体制',
    name: '福祉専門職員配置等加算(III)',
    units: '6単位/日',
    requirements: '①児童指導員・保育士の常勤割合が75%以上\nまたは\n②常勤の児童指導員・保育士のうち3年以上従事者が30%以上',
    notes: '資格割合ではなく、常勤率や勤続年数で評価される区分。',
    examples: [
      '全スタッフ4名のうち常勤が3名（75%）で、全員が児童指導員または保育士 → ①で算定可',
      '常勤の保育士・児童指導員5名中、3年以上勤続者が2名（40%）→ ②で算定可',
    ],
  },
  {
    category: '体制',
    name: '福祉・介護職員処遇改善加算',
    units: '所定単位数×加算率\n(新加算I～IVにより異なる)\n例：児童発達支援(I) 13.1%',
    requirements: '①キャリアパス要件（任用要件・研修計画・昇給仕組み）\n②月額賃金改善要件\n③職場環境等要件\nこれらを満たし、計画書・実績報告書を提出すること',
    notes: '令和6年度に一本化。加算額はすべて職員の賃金改善に充てる必要がある。',
    examples: [
      '就業規則に昇給基準を明記し、年1回の研修計画を策定して届出 → 新加算(II)を算定',
      '賃金改善計画で月額8,000円のベースアップを実施し、全要件を満たして届出 → 新加算(I)を算定',
    ],
  },
  // ========== 実施系 ==========
  {
    category: '実施',
    name: '専門的支援実施加算',
    units: '150単位/回',
    requirements: '理学療法士等が「専門的支援実施計画」を作成し、個別・集中的な支援を計画的に行うこと（30分以上確保）',
    notes: '月利用日数に応じた算定回数制限あり（児発で月12日未満なら最大4回など）。小集団（5名程度）での実施も可。',
    examples: [
      '言語聴覚士が「発語促進計画」を作成し、週1回40分の個別言語訓練を実施 → 毎回算定可',
      '作業療法士が感覚統合の専門的支援計画を作成し、小集団（3名）で45分のセッションを実施',
      '公認心理師がSST計画を作成し、社会性の発達支援を30分以上実施した日に算定',
    ],
  },
  {
    category: '実施',
    name: '関係機関連携加算(I)',
    units: '250単位/回',
    requirements: '保育所や学校等と連携し、個別支援計画作成等を行った場合',
    notes: '対象機関に医療機関や児童相談所も含まれるようになった。',
    examples: [
      '個別支援計画の更新にあたり、通園先の保育所を訪問して担任と情報共有・協議を実施',
      '小学校入学前に進学先の特別支援コーディネーターとケース会議を開催',
      '主治医のいる病院を訪問し、医療的ケアの内容について個別支援計画に反映',
    ],
  },
  {
    category: '実施',
    name: '関係機関連携加算(II)',
    units: '200単位/回',
    requirements: '保育所や学校等と個別支援計画作成時「以外」で情報連携を行った場合',
    notes: 'オンライン会議も可能だが要旨の記録が必要。',
    examples: [
      '学校の担任から「最近落ち着きがない」と相談があり、オンラインで情報共有・支援方針を協議',
      '保育所の運動会前に、参加方法について担任とZoomで打ち合わせを実施',
      '放課後に学童保育の指導員と電話で行動面の情報共有を行い、記録を作成',
    ],
  },
  {
    category: '実施',
    name: '事業所間連携加算(I)',
    units: '500単位/回（月1回限度）',
    requirements: 'セルフプランで複数事業所を併用する児について、中核となる事業所が会議開催・情報連携・家族助言等を行った場合',
    notes: '令和6年度新設。セルフプランのコーディネート機能強化が目的。',
    examples: [
      'セルフプランで3事業所を併用している児について、当事業所が中核となり合同ケース会議を主催',
      '他事業所での支援内容を保護者から聞き取り、全体の支援方針を調整して家族に助言',
    ],
  },
  {
    category: '実施',
    name: '強度行動障害児支援加算',
    units: '200単位/日\n(開始後90日以内は+500単位)',
    requirements: '強度行動障害支援者養成研修（実践研修）修了者を配置し、対象児（基準20点以上）に支援計画を作成して支援を行うこと',
    notes: '研修修了者が支援計画を作成する必要があるが、直接支援は配置基準上の従業者でも可（自治体による）。',
    examples: [
      '行動障害基準20点の児に対し、研修修了者が「行動支援計画」を作成し、構造化された環境で支援',
      '自傷・他害がある児に対し、研修修了スタッフが計画を作成。支援開始から90日以内は700単位/日を算定',
      'パニック時の対応マニュアルを含む支援計画を作成し、全スタッフで共有して日々の支援を実施',
    ],
  },
  {
    category: '実施',
    name: '個別サポート加算(I)',
    units: '120単位/日',
    requirements: '①重症心身障害児\n②身体障害1・2級\n③療育手帳最重度・重度\n④精神障害1級\nのいずれかに該当する児童への支援',
    notes: '以前の「乳幼児サポート調査票」は廃止され、手帳等の等級や判定に基づくようになった。受給者証への記載が必要。',
    examples: [
      '療育手帳A（重度）を持つ児が利用した日に算定 ※受給者証に「個別サポート(I)」の記載があることを確認',
      '身体障害者手帳1級の肢体不自由児が利用した全日に算定',
      '重症心身障害児として判定されている児の利用日に毎回算定',
    ],
  },
  {
    category: '実施',
    name: '個別サポート加算(II)',
    units: '150単位/日',
    requirements: '要保護・要支援児童に対し、児童相談所等と連携（6ヶ月に1回以上共有）して支援を行った場合',
    notes: '支援内容を個別支援計画に記載し、保護者の同意が必要。連携記録を文書で保管する。',
    examples: [
      '児童相談所から情報提供を受けた要支援児童について、6ヶ月ごとに児相と情報共有を行い、日々の利用で算定',
      '虐待の疑いがあり市の子育て支援課と連携している児について、定期的な情報共有を継続し算定',
    ],
  },
  {
    category: '実施',
    name: '家族支援加算(I)',
    units: '・居宅訪問(1h以上)：300単位\n・居宅訪問(1h未満)：200単位',
    requirements: '入所児童の家族に対し、個別に相談援助等を行った場合',
    notes: 'オンライン実施も可能（単位数は下がる）。原則30分以上、カメラ有りが要件。',
    examples: [
      '自宅での過ごし方について相談があり、家庭訪問して1時間の個別相談を実施 → 300単位',
      '保護者の仕事の都合で来所が難しく、Zoomで45分の個別面談を実施（カメラON）→ オンライン単位で算定',
      '事業所で送迎時に30分以上の個別相談を行い、相談内容と助言を記録',
    ],
  },
  {
    category: '実施',
    name: '家族支援加算(II)',
    units: '・対面：80単位\n・オンライン：60単位',
    requirements: '入所児童の家族に対し、グループでの相談援助等を行った場合',
    notes: 'きょうだいへの支援も含まれる。',
    examples: [
      '月1回の保護者勉強会を開催し、5家族が参加。発達特性の理解について講義と質疑応答を実施',
      'きょうだい児を集めた交流会を開催し、きょうだいならではの悩みを共有するグループワークを実施',
      '偏食についての保護者座談会（オンライン）を開催し、8名が参加 → 参加児童数×60単位',
    ],
  },
  {
    category: '実施',
    name: '子育てサポート加算',
    units: '80単位/回（月4回限度）',
    requirements: '保護者が支援場面を観察・参加する機会を提供し、特性や関わり方の理解を促進する支援を行った場合',
    notes: 'ただのフィードバックのみでは算定不可。場面への参加・観察が必要。',
    examples: [
      '保護者に集団療育場面をマジックミラー越しに観察してもらい、その後スタッフが関わり方を解説',
      '親子同室の個別療育を実施し、お子さんへの声かけの仕方を保護者と一緒に実践',
      '送迎時ではなく、あらかじめ時間を設定して保護者に活動場面を見学してもらい、特性の説明を実施',
    ],
  },
  {
    category: '実施',
    name: '延長支援加算',
    units: '・1h以上2h未満：92単位\n・2h以上：123単位\n・30分以上1h未満：61単位',
    requirements: '営業時間が6時間以上かつ基本の支援時間5時間を超えて、預かりニーズに対応した支援を行った場合',
    notes: '職員2名以上の配置が必要（うち1名は有資格者）。',
    examples: [
      '10時〜16時（6時間）の利用で、保護者の仕事の都合で18時まで延長（2時間延長）→ 123単位',
      '基本時間10時〜15時の児が16時まで利用（1時間延長）→ 92単位',
      '放課後デイで19時閉所のところ、保護者のお迎えが遅れて19時30分まで対応 → 61単位',
    ],
  },
  {
    category: '実施',
    name: '保育・教育等移行支援加算',
    units: '500単位/回',
    requirements: '退所前に移行先との調整（2回限度）、または退所後に訪問相談（1回限度）を行った場合',
    notes: '保育所等への円滑な移行を支援するための加算。',
    examples: [
      '児童発達支援の卒業が近い児について、入園予定の保育所を訪問して引継ぎ会議を実施（1回目）',
      '入園直前に再度保育所を訪問し、具体的な配慮事項を担任に説明（2回目・退所前最後）',
      '保育所に入園して1ヶ月後、園を訪問して適応状況を確認し、園と相談（退所後1回）',
    ],
  },
  {
    category: '実施',
    name: '送迎加算',
    units: '・54単位/片道\n・重症心身障害児：+40単位\n・医療的ケア児：+40単位または+80単位',
    requirements: '居宅等と事業所間の送迎を行った場合',
    notes: '徒歩での付き添いは送迎加算対象外（通所自立支援加算等の対象にはなり得る）。',
    examples: [
      '自宅から事業所まで車で送迎（往復）→ 54単位×2回 = 108単位',
      '学校から事業所まで迎え、事業所から自宅まで送り → 往復で108単位',
      '医療的ケア児（スコア16点以上）の送迎 → 片道94単位（54+40）、往復で188単位',
    ],
  },
  {
    category: '実施',
    name: '欠席時対応加算(I)',
    units: '94単位/回（月4回まで）',
    requirements: '利用予定日の2日前までに急病等でキャンセルの連絡があり、相談援助を行って記録した場合',
    notes: '3日以上前の連絡や、翌日以降の連絡は算定不可。電話対応でも可。',
    examples: [
      '水曜利用予定の児について、月曜に「熱が出た」と連絡あり。電話で体調を確認し次回の調整を相談 → 算定可',
      '金曜利用予定の児について、水曜夜に「インフルエンザになった」と連絡。翌日電話で相談援助 → 算定可',
      '火曜利用予定の児について、月曜朝に急なキャンセル連絡（前日）→ 算定不可（2日前でないため）',
    ],
  },
  {
    category: '実施',
    name: '訪問支援員特別加算',
    units: '・区分I：850単位/日\n・区分II：700単位/日',
    requirements: '保育所等訪問支援において、経験豊富な職員（10年以上等）が支援を行う場合',
    notes: '単なる配置ではなく、当該職員による支援の実施が必要。',
    examples: [
      '障害福祉経験10年以上の作業療法士が保育所を訪問し、感覚面の配慮について助言 → 区分Iで算定',
      '児童指導員として15年勤務したスタッフが小学校を訪問し、担任に支援方法をコンサル',
    ],
  },
];

// カテゴリごとにグループ化
const groupedAdditions = {
  structure: ADDITIONS_DATA.filter(a => a.category === '体制'),
  implementation: ADDITIONS_DATA.filter(a => a.category === '実施'),
};

export default function AdditionCatalogView() {
  const [expandedCategory, setExpandedCategory] = useState<'structure' | 'implementation' | 'all'>('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItem = (name: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(name)) {
        newSet.delete(name);
      } else {
        newSet.add(name);
      }
      return newSet;
    });
  };

  const renderAddition = (addition: AdditionData, index: number) => {
    const isExpanded = expandedItems.has(addition.name);

    return (
      <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleItem(addition.name)}
          className="w-full px-4 py-3 bg-white hover:bg-gray-50 transition-colors flex items-start gap-3 text-left"
        >
          <div className="mt-0.5">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900">{addition.name}</div>
            <div className="text-sm text-gray-500 mt-1 whitespace-pre-line">{addition.units}</div>
          </div>
        </button>

        {isExpanded && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 space-y-4">
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-1 flex items-center gap-1">
                <Target className="w-3 h-3" />
                取得条件・要件
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-line">{addition.requirements}</p>
            </div>
            <div>
              <div className="text-xs font-medium text-amber-600 uppercase mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                注意点・補足
              </div>
              <p className="text-sm text-gray-700">{addition.notes}</p>
            </div>
            {addition.examples && addition.examples.length > 0 && (
              <div>
                <div className="text-xs font-medium text-blue-600 uppercase mb-2 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  取得事例
                </div>
                <ul className="space-y-2">
                  {addition.examples.map((example, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-blue-500 mt-1 text-xs">▸</span>
                      <span className="text-sm text-gray-700">{example}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <List className="w-6 h-6 text-teal-600" />
          <h2 className="text-xl font-bold text-gray-900">加算一覧（カタログ）</h2>
        </div>
        <p className="text-gray-500 text-sm">
          障害児通所支援で算定可能な加算の一覧です。各加算をクリックすると取得条件・要件を確認できます。
        </p>

        {/* カテゴリタブ */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setExpandedCategory('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              expandedCategory === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            すべて ({ADDITIONS_DATA.length})
          </button>
          <button
            onClick={() => setExpandedCategory('structure')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              expandedCategory === 'structure'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <Building className="w-4 h-4" />
            体制 ({groupedAdditions.structure.length})
          </button>
          <button
            onClick={() => setExpandedCategory('implementation')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              expandedCategory === 'implementation'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            実施 ({groupedAdditions.implementation.length})
          </button>
        </div>
      </div>

      {/* 体制加算 */}
      {(expandedCategory === 'all' || expandedCategory === 'structure') && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center gap-3">
            <Building className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="font-bold text-emerald-800">体制加算</h3>
              <p className="text-xs text-emerald-600">スタッフ配置や資格要件に基づく加算（事前届出が必要）</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {groupedAdditions.structure.map((addition, index) => renderAddition(addition, index))}
          </div>
        </div>
      )}

      {/* 実施加算 */}
      {(expandedCategory === 'all' || expandedCategory === 'implementation') && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center gap-3">
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-blue-800">実施加算</h3>
              <p className="text-xs text-blue-600">サービス提供実績に基づく加算（日々の支援内容に応じて算定）</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {groupedAdditions.implementation.map((addition, index) => renderAddition(addition, index))}
          </div>
        </div>
      )}

      {/* 凡例 */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-600">
            <p className="font-medium text-gray-700 mb-2">加算の分類について</p>
            <ul className="space-y-1">
              <li><span className="font-medium text-emerald-700">体制加算</span>：事前に届出を行い、届出期間中は自動的に算定される加算</li>
              <li><span className="font-medium text-blue-700">実施加算</span>：日々の支援内容や実績に応じて算定する加算</li>
            </ul>
            <p className="mt-3 text-xs text-gray-500">
              ※ 単位数は定員や条件により異なる場合があります。詳細は厚生労働省の最新の告示をご確認ください。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
