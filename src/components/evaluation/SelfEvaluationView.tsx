/**
 * 自己評価ビュー
 * 事業所自己評価・保護者等向け評価・改善計画・過去の評価を管理
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ClipboardCheck,
  Save,
  ChevronDown,
  Plus,
  Trash2,
  CheckCircle,
  Send,
  FileText,
  BarChart3,
  Eye,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSelfEvaluation } from '@/hooks/useSelfEvaluation';
import type { SelfEvaluation, SelfEvaluationStatus } from '@/types';

// --- 評価タブの定義 ---
type EvaluationTab = 'self' | 'parent' | 'improvement' | 'history';

const EVALUATION_TABS: { id: EvaluationTab; label: string }[] = [
  { id: 'self', label: '事業所自己評価' },
  { id: 'parent', label: '保護者等向け評価' },
  { id: 'improvement', label: '改善計画' },
  { id: 'history', label: '過去の評価' },
];

// --- 事業所自己評価の設問カテゴリ ---
type QuestionCategory = {
  id: string;
  label: string;
  questions: { id: string; text: string }[];
};

const SELF_EVALUATION_CATEGORIES: QuestionCategory[] = [
  {
    id: 'environment',
    label: '環境・体制整備',
    questions: [
      { id: 'env_1', text: '利用定員が指導訓練室等スペースとの関係で適切であるか' },
      { id: 'env_2', text: '職員の配置数は適切であるか' },
      { id: 'env_3', text: '事業所の設備等について、バリアフリー化の配慮が適切になされているか' },
      { id: 'env_4', text: '業務改善を進めるためのPDCAサイクル（目標設定と振り返り）に、広く職員が参画しているか' },
      { id: 'env_5', text: '保護者等向け評価表を活用する等によりアンケート調査を実施して保護者等の意向等を把握し、業務改善につなげているか' },
    ],
  },
  {
    id: 'improvement',
    label: '業務改善',
    questions: [
      { id: 'imp_1', text: '第三者による外部評価を行い、評価結果を業務改善につなげているか' },
      { id: 'imp_2', text: '職員の資質の向上を行うために、研修の機会を確保しているか' },
      { id: 'imp_3', text: 'アセスメントを適切に行い、子どもと保護者のニーズや課題を客観的に分析した上で、個別支援計画を作成しているか' },
      { id: 'imp_4', text: '子どもの適応行動の状況を図るために、標準化されたアセスメントツールを使用しているか' },
      { id: 'imp_5', text: '活動プログラムの立案をチームで行っているか' },
    ],
  },
  {
    id: 'support',
    label: '適切な支援の提供',
    questions: [
      { id: 'sup_1', text: '子どもの状況に応じ、個別活動と集団活動を適宜組み合わせて個別支援計画を作成しているか' },
      { id: 'sup_2', text: '支援開始前には職員間で必ず打合せをし、その日行われる支援の内容や役割分担について確認しているか' },
      { id: 'sup_3', text: '支援終了後には、職員間で必ず打合せをし、その日行われた支援の振り返りを行い、気付いた点等を共有しているか' },
      { id: 'sup_4', text: '日々の支援に関して正しく記録をとることを徹底し、支援の検証・改善につなげているか' },
      { id: 'sup_5', text: '定期的にモニタリングを行い、個別支援計画の見直しの必要性を判断しているか' },
    ],
  },
  {
    id: 'collaboration',
    label: '関係機関や保護者との連携',
    questions: [
      { id: 'col_1', text: '障害児相談支援事業所のサービス担当者会議にその子どもの状況に精通した最もふさわしい者が参画しているか' },
      { id: 'col_2', text: '学校との情報共有（年間計画・行事予定等の交換、子どもの下校時刻の確認等）、連絡調整（送迎時の対応、トラブル発生時の連絡）を適切に行っているか' },
      { id: 'col_3', text: '医療的ケアが必要な子どもを受け入れる場合は、子どもの主治医等と連絡体制を整えているか' },
      { id: 'col_4', text: '就学前に利用していた保育所や幼稚園、認定こども園、児童発達支援事業所等との間で情報共有と相互理解に努めているか' },
      { id: 'col_5', text: '学校を卒業し、放課後等デイサービス事業所から障害福祉サービス事業所等へ移行する場合、それまでの支援内容等についての情報を提供する等しているか' },
    ],
  },
  {
    id: 'parent_explanation',
    label: '保護者への説明等',
    questions: [
      { id: 'par_1', text: '運営規程、支援の内容、利用者負担等について丁寧な説明を行っているか' },
      { id: 'par_2', text: '保護者からの子育ての悩み等に対する相談に適切に応じ、必要な助言と支援を行っているか' },
      { id: 'par_3', text: '父母の会の活動を支援したり、保護者会等を開催する等により、保護者同士の連携を支援しているか' },
      { id: 'par_4', text: '子どもや保護者からの苦情について、対応の体制を整備するとともに、子どもや保護者に周知し、苦情があった場合に迅速かつ適切に対応しているか' },
      { id: 'par_5', text: '定期的に会報等を発行し、活動概要や行事予定、連絡体制等の情報を子どもや保護者に対して発信しているか' },
    ],
  },
];

// --- 保護者等向け評価の設問カテゴリ ---
const PARENT_SURVEY_CATEGORIES: QuestionCategory[] = [
  {
    id: 'p_environment',
    label: '環境・体制整備',
    questions: [
      { id: 'p_env_1', text: '子どもの活動等のスペースが十分に確保されているか' },
      { id: 'p_env_2', text: '職員の配置数や専門性は適切であるか' },
      { id: 'p_env_3', text: '事業所の設備等は、スロープや手すりの設置などバリアフリー化の配慮が適切になされているか' },
      { id: 'p_env_4', text: '子どもと保護者のニーズや課題が客観的に分析された上で、個別支援計画が作成されているか' },
      { id: 'p_env_5', text: '活動プログラムが固定化しないよう工夫されているか' },
    ],
  },
  {
    id: 'p_support',
    label: '適切な支援の提供',
    questions: [
      { id: 'p_sup_1', text: 'お子さまは通所を楽しみにしていますか' },
      { id: 'p_sup_2', text: '事業所の支援に満足していますか' },
      { id: 'p_sup_3', text: '個別支援計画に沿った支援が行われていますか' },
      { id: 'p_sup_4', text: '個別支援計画の説明を受けましたか' },
      { id: 'p_sup_5', text: '事業所内の清掃、整理整頓は行き届いていますか' },
    ],
  },
  {
    id: 'p_communication',
    label: '保護者への説明等',
    questions: [
      { id: 'p_com_1', text: '支援の内容、利用者負担等について丁寧な説明がなされたか' },
      { id: 'p_com_2', text: '日頃からお子さまの状況を保護者に伝え、子育ての悩み等に対する相談に適切に応じ、必要な助言等を行っているか' },
      { id: 'p_com_3', text: '保護者会等を開催する等により、保護者同士の連携が支援されているか' },
      { id: 'p_com_4', text: '子どもや保護者からの苦情について、対応の体制を整備するとともに、苦情があった場合に迅速かつ適切に対応しているか' },
      { id: 'p_com_5', text: '子どもや保護者との意思の疎通や情報伝達のための配慮がなされているか' },
    ],
  },
  {
    id: 'p_safety',
    label: '非常時等の対応',
    questions: [
      { id: 'p_saf_1', text: '緊急時対応マニュアル、防犯マニュアル、感染症対応マニュアルを策定し、保護者に周知・説明されているか' },
      { id: 'p_saf_2', text: '非常災害の発生に備え、定期的に避難、救出、その他必要な訓練が行われているか' },
      { id: 'p_saf_3', text: 'ヒヤリハット事例集を作成して事業所内で共有しているか' },
      { id: 'p_saf_4', text: '虐待を防止するため、職員の研修機会を確保する等、適切な対応をしているか' },
      { id: 'p_saf_5', text: 'どのような場合にやむを得ず身体拘束を行うかについて、組織的に決定し、子どもや保護者に事前に十分に説明し了解を得た上で、個別支援計画に記載しているか' },
    ],
  },
  {
    id: 'p_satisfaction',
    label: '満足度',
    questions: [
      { id: 'p_sat_1', text: '子どもの様子や支援の内容等をまとめた会報等を定期的に発信しているか' },
      { id: 'p_sat_2', text: '個人情報に十分注意しているか' },
      { id: 'p_sat_3', text: '活動の様子が分かる写真等が掲示されているか' },
      { id: 'p_sat_4', text: '第三者による外部評価を実施し、結果を公表しているか' },
      { id: 'p_sat_5', text: '職員の接遇・態度は適切か' },
    ],
  },
];

const RATING_OPTIONS = [
  { value: 1, label: '未実施' },
  { value: 2, label: '一部実施' },
  { value: 3, label: '概ね実施' },
  { value: 4, label: '十分実施' },
];

const STATUS_LABELS: Record<SelfEvaluationStatus, { label: string; color: string; bg: string }> = {
  draft: { label: '下書き', color: 'text-gray-600', bg: 'bg-gray-100' },
  in_progress: { label: '入力中', color: 'text-blue-600', bg: 'bg-blue-100' },
  completed: { label: '完了', color: 'text-green-600', bg: 'bg-green-100' },
  published: { label: '公開済み', color: 'text-purple-600', bg: 'bg-purple-100' },
};

// --- Radar Chart (CSS-only) ---
function RadarChart({ scores, labels }: { scores: number[]; labels: string[] }) {
  const n = scores.length;
  const cx = 100;
  const cy = 100;
  const maxR = 80;
  const levels = 4;

  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  // Polygon points for a given radius
  const polygonPoints = (r: number) =>
    Array.from({ length: n }, (_, i) => {
      const a = angle(i);
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(' ');

  // Data polygon
  const dataPoints = scores.map((s, i) => {
    const r = (s / 4) * maxR;
    const a = angle(i);
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 200" className="w-64 h-64">
        {/* Grid levels */}
        {Array.from({ length: levels }, (_, l) => {
          const r = (maxR * (l + 1)) / levels;
          return (
            <polygon
              key={l}
              points={polygonPoints(r)}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          );
        })}
        {/* Axes */}
        {Array.from({ length: n }, (_, i) => {
          const a = angle(i);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + maxR * Math.cos(a)}
              y2={cy + maxR * Math.sin(a)}
              stroke="#d1d5db"
              strokeWidth="1"
            />
          );
        })}
        {/* Data */}
        <polygon
          points={dataPoints}
          fill="rgba(0,196,204,0.2)"
          stroke="#00c4cc"
          strokeWidth="2"
        />
        {/* Data points */}
        {scores.map((s, i) => {
          const r = (s / 4) * maxR;
          const a = angle(i);
          return (
            <circle
              key={i}
              cx={cx + r * Math.cos(a)}
              cy={cy + r * Math.sin(a)}
              r="3"
              fill="#00c4cc"
            />
          );
        })}
        {/* Labels */}
        {labels.map((label, i) => {
          const a = angle(i);
          const labelR = maxR + 18;
          const x = cx + labelR * Math.cos(a);
          const y = cy + labelR * Math.sin(a);
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="7"
              fill="#374151"
              fontWeight="bold"
            >
              {label.length > 8 ? label.slice(0, 8) + '...' : label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// --- Main Component ---
const SelfEvaluationView: React.FC = () => {
  const { facility } = useAuth();
  const {
    evaluations,
    isLoading,
    fetchEvaluations,
    createEvaluation,
    updateEvaluation,
    publishEvaluation,
  } = useSelfEvaluation();

  const [activeTab, setActiveTab] = useState<EvaluationTab>('self');
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(() => {
    const now = new Date();
    // Fiscal year in Japan starts April 1. Before April, use previous year.
    return now.getMonth() < 3 ? String(now.getFullYear() - 1) : String(now.getFullYear());
  });

  // Form state for the current self-evaluation
  const [responses, setResponses] = useState<Record<string, { rating: number; comment: string }>>({});
  const [currentEvalId, setCurrentEvalId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  // Improvement plan state
  const [improvementPlan, setImprovementPlan] = useState('');
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [newActionItem, setNewActionItem] = useState('');

  // Fiscal year options
  const fiscalYearOptions = useMemo(() => {
    const now = new Date();
    const currentFY = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
    return Array.from({ length: 5 }, (_, i) => String(currentFY - i));
  }, []);

  // Load evaluations
  useEffect(() => {
    if (facility?.id) {
      fetchEvaluations(facility.id);
    }
  }, [facility?.id, fetchEvaluations]);

  // Get the evaluation type based on the active tab
  const getEvalType = useCallback((): 'self' | 'parent_survey' => {
    return activeTab === 'parent' ? 'parent_survey' : 'self';
  }, [activeTab]);

  // Find current evaluation
  const currentEval = useMemo(() => {
    const evalType = activeTab === 'parent' ? 'parent_survey' : 'self';
    return evaluations.find(
      (e) => e.fiscalYear === selectedFiscalYear && e.evaluationType === evalType
    );
  }, [evaluations, selectedFiscalYear, activeTab]);

  // Sync form state with current evaluation
  useEffect(() => {
    if (currentEval) {
      setCurrentEvalId(currentEval.id);
      setResponses(currentEval.responses || {});
      setImprovementPlan(currentEval.improvementPlan || '');
      // Parse action items from improvement plan
      try {
        const stored = currentEval.responses?.actionItems;
        if (Array.isArray(stored)) {
          setActionItems(stored);
        } else {
          setActionItems([]);
        }
      } catch {
        setActionItems([]);
      }
    } else {
      setCurrentEvalId(null);
      setResponses({});
      setImprovementPlan('');
      setActionItems([]);
    }
  }, [currentEval]);

  // Calculate category scores
  const getCategoryScores = useCallback(
    (categories: QuestionCategory[]) => {
      return categories.map((cat) => {
        const questionScores = cat.questions.map((q) => responses[q.id]?.rating || 0);
        const validScores = questionScores.filter((s) => s > 0);
        const avg = validScores.length > 0
          ? validScores.reduce((a, b) => a + b, 0) / validScores.length
          : 0;
        return { categoryId: cat.id, label: cat.label, average: Math.round(avg * 100) / 100 };
      });
    },
    [responses]
  );

  // Handle creating a new evaluation
  const handleCreate = async () => {
    if (!facility?.id) return;
    const evalType = getEvalType();
    const result = await createEvaluation(facility.id, selectedFiscalYear, evalType);
    if (result) {
      setCurrentEvalId(result.id);
    }
  };

  // Handle rating change
  const handleRatingChange = (questionId: string, rating: number) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], rating, comment: prev[questionId]?.comment || '' },
    }));
  };

  // Handle comment change
  const handleCommentChange = (questionId: string, comment: string) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], comment, rating: prev[questionId]?.rating || 0 },
    }));
  };

  // Save draft
  const handleSaveDraft = async () => {
    if (!currentEvalId) return;
    setSavingDraft(true);
    const updatedResponses = { ...responses, actionItems };
    await updateEvaluation(currentEvalId, {
      responses: updatedResponses,
      status: 'in_progress',
      improvementPlan,
    });
    setSavingDraft(false);
    alert('下書きを保存しました');
  };

  // Complete evaluation
  const handleComplete = async () => {
    if (!currentEvalId) return;
    const updatedResponses = { ...responses, actionItems };
    await updateEvaluation(currentEvalId, {
      responses: updatedResponses,
      status: 'completed',
      improvementPlan,
    });
    alert('評価を完了しました');
  };

  // Publish evaluation
  const handlePublish = async () => {
    if (!currentEvalId) return;
    if (!confirm('評価結果を公開します。公開後も編集は可能です。よろしいですか？')) return;
    await publishEvaluation(currentEvalId);
    alert('評価結果を公開しました');
  };

  // Add action item
  const addActionItem = () => {
    if (!newActionItem.trim()) return;
    setActionItems((prev) => [...prev, newActionItem.trim()]);
    setNewActionItem('');
  };

  // Remove action item
  const removeActionItem = (index: number) => {
    setActionItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Get categories based on tab
  const getCategories = () => {
    return activeTab === 'parent' ? PARENT_SURVEY_CATEGORIES : SELF_EVALUATION_CATEGORIES;
  };

  // Weak areas (score < 3)
  const weakAreas = useMemo(() => {
    const categories = activeTab === 'improvement' ? SELF_EVALUATION_CATEGORIES : getCategories();
    const results: { questionId: string; questionText: string; category: string; rating: number }[] = [];

    // Use self evaluation responses for improvement plan
    const selfEval = evaluations.find(
      (e) => e.fiscalYear === selectedFiscalYear && e.evaluationType === 'self'
    );
    const selfResponses = selfEval?.responses || responses;

    categories.forEach((cat) => {
      cat.questions.forEach((q) => {
        const r = selfResponses[q.id]?.rating;
        if (r && r < 3) {
          results.push({ questionId: q.id, questionText: q.text, category: cat.label, rating: r });
        }
      });
    });
    return results;
  }, [evaluations, selectedFiscalYear, responses, activeTab, getCategories]);

  // Render evaluation form (for self and parent tabs)
  const renderEvaluationForm = () => {
    const categories = getCategories();
    const categoryScores = getCategoryScores(categories);

    return (
      <div className="space-y-6">
        {/* Fiscal year selector */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-bold text-gray-700">年度:</label>
              <select
                value={selectedFiscalYear}
                onChange={(e) => setSelectedFiscalYear(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
              >
                {fiscalYearOptions.map((fy) => (
                  <option key={fy} value={fy}>
                    {fy}年度
                  </option>
                ))}
              </select>
            </div>
            {currentEval && (
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_LABELS[currentEval.status].bg} ${STATUS_LABELS[currentEval.status].color}`}
                >
                  {STATUS_LABELS[currentEval.status].label}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Create or edit */}
        {!currentEval ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
            <ClipboardCheck size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">
              {selectedFiscalYear}年度の{activeTab === 'parent' ? '保護者等向け' : '事業所自己'}評価がまだ作成されていません
            </p>
            <button
              onClick={handleCreate}
              disabled={isLoading}
              className="inline-flex items-center gap-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
            >
              <Plus size={16} />
              新規作成
            </button>
          </div>
        ) : (
          <>
            {/* Score Summary with Radar Chart */}
            {categoryScores.some((s) => s.average > 0) && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2 mb-4">
                  <BarChart3 size={20} className="text-[#00c4cc]" />
                  スコア概要
                </h3>
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <RadarChart
                    scores={categoryScores.map((s) => s.average)}
                    labels={categoryScores.map((s) => s.label)}
                  />
                  <div className="flex-1 space-y-2">
                    {categoryScores.map((s) => (
                      <div key={s.categoryId} className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-700 w-40 truncate">
                          {s.label}
                        </span>
                        <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                          <div
                            className="h-full bg-[#00c4cc] rounded-full transition-all duration-500"
                            style={{ width: `${(s.average / 4) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-gray-600 w-10 text-right">
                          {s.average > 0 ? s.average.toFixed(1) : '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Evaluation Questions */}
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-6"
              >
                <h3 className="font-bold text-lg text-gray-800 mb-4">{cat.label}</h3>
                <div className="space-y-6">
                  {cat.questions.map((q, qi) => (
                    <div key={q.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <p className="text-sm text-gray-800 font-medium mb-3">
                        <span className="text-[#00c4cc] font-bold mr-1">{qi + 1}.</span>
                        {q.text}
                      </p>
                      {/* Rating radio buttons */}
                      <div className="flex flex-wrap gap-2 mb-2">
                        {RATING_OPTIONS.map((opt) => (
                          <label
                            key={opt.value}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-all ${
                              responses[q.id]?.rating === opt.value
                                ? 'bg-[#00c4cc]/10 border-[#00c4cc] text-[#00c4cc] font-bold'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`rating-${q.id}`}
                              value={opt.value}
                              checked={responses[q.id]?.rating === opt.value}
                              onChange={() => handleRatingChange(q.id, opt.value)}
                              className="sr-only"
                            />
                            <span>{opt.value}</span>
                            <span className="text-xs">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                      {/* Comment */}
                      <textarea
                        value={responses[q.id]?.comment || ''}
                        onChange={(e) => handleCommentChange(q.id, e.target.value)}
                        placeholder="コメント（任意）"
                        rows={2}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc] resize-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Action buttons */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm rounded-xl border border-gray-100 shadow-lg p-4 z-10">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-xs text-gray-500">変更内容を保存してください</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveDraft}
                    disabled={savingDraft || isLoading}
                    className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <Save size={16} />
                    {savingDraft ? '保存中...' : '下書き保存'}
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={isLoading}
                    className="flex items-center gap-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                  >
                    <CheckCircle size={16} />
                    評価を完了
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // Render improvement plan tab
  const renderImprovementPlan = () => {
    const selfEval = evaluations.find(
      (e) => e.fiscalYear === selectedFiscalYear && e.evaluationType === 'self'
    );

    return (
      <div className="space-y-6">
        {/* Fiscal year selector */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-gray-700">年度:</label>
            <select
              value={selectedFiscalYear}
              onChange={(e) => setSelectedFiscalYear(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
            >
              {fiscalYearOptions.map((fy) => (
                <option key={fy} value={fy}>
                  {fy}年度
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Weak areas */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-bold text-lg text-gray-800 mb-4">
            改善が必要な項目（スコア 3 未満）
          </h3>
          {weakAreas.length === 0 ? (
            <p className="text-sm text-gray-500">
              {selfEval ? '3 未満のスコアの項目はありません。' : '自己評価がまだ作成されていません。先に事業所自己評価を入力してください。'}
            </p>
          ) : (
            <div className="space-y-3">
              {weakAreas.map((area) => (
                <div
                  key={area.questionId}
                  className="border border-amber-200 bg-amber-50 rounded-lg p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-amber-600">{area.category}</span>
                      <p className="text-sm text-gray-800 mt-0.5">{area.questionText}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-amber-700 bg-amber-200 px-2 py-0.5 rounded">
                      {area.rating}/4
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Improvement plan textarea */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-bold text-lg text-gray-800 mb-4">改善計画</h3>
          <textarea
            value={improvementPlan}
            onChange={(e) => setImprovementPlan(e.target.value)}
            placeholder="改善計画を記入してください..."
            rows={6}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc] resize-none"
          />
        </div>

        {/* Action items */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-bold text-lg text-gray-800 mb-4">アクションアイテム</h3>
          <div className="space-y-2 mb-4">
            {actionItems.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5"
              >
                <CheckCircle size={16} className="text-[#00c4cc] shrink-0" />
                <span className="text-sm text-gray-800 flex-1">{item}</span>
                <button
                  onClick={() => removeActionItem(i)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newActionItem}
              onChange={(e) => setNewActionItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addActionItem();
                }
              }}
              placeholder="新しいアクションアイテムを追加..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
            />
            <button
              onClick={addActionItem}
              className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
            >
              追加
            </button>
          </div>
        </div>

        {/* Save / Publish buttons */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm rounded-xl border border-gray-100 shadow-lg p-4 z-10">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs text-gray-500">改善計画を保存・公開できます</p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveDraft}
                disabled={!selfEval || savingDraft || isLoading}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                保存
              </button>
              <button
                onClick={handlePublish}
                disabled={!selfEval || isLoading}
                className="flex items-center gap-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              >
                <Send size={16} />
                公開する
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render history tab
  const renderHistory = () => {
    // Group evaluations by fiscal year
    const grouped = evaluations.reduce<Record<string, SelfEvaluation[]>>((acc, e) => {
      if (!acc[e.fiscalYear]) acc[e.fiscalYear] = [];
      acc[e.fiscalYear].push(e);
      return acc;
    }, {});

    const sortedYears = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    return (
      <div className="space-y-6">
        {sortedYears.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">過去の評価はありません</p>
          </div>
        ) : (
          sortedYears.map((year) => (
            <div key={year} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-lg text-gray-800 mb-4">{year}年度</h3>
              <div className="space-y-3">
                {grouped[year].map((evaluation) => (
                  <div
                    key={evaluation.id}
                    className="flex items-center justify-between border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <ClipboardCheck size={18} className="text-[#00c4cc]" />
                      <div>
                        <p className="text-sm font-bold text-gray-800">
                          {evaluation.evaluationType === 'self'
                            ? '事業所自己評価'
                            : '保護者等向け評価'}
                        </p>
                        <p className="text-xs text-gray-500">
                          作成日: {new Date(evaluation.createdAt).toLocaleDateString('ja-JP')}
                          {evaluation.publishedAt &&
                            ` / 公開日: ${new Date(evaluation.publishedAt).toLocaleDateString('ja-JP')}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_LABELS[evaluation.status].bg} ${STATUS_LABELS[evaluation.status].color}`}
                      >
                        {STATUS_LABELS[evaluation.status].label}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedFiscalYear(evaluation.fiscalYear);
                          setActiveTab(
                            evaluation.evaluationType === 'self' ? 'self' : 'parent'
                          );
                        }}
                        className="text-sm text-[#00c4cc] hover:underline flex items-center gap-1"
                      >
                        <Eye size={14} />
                        表示
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-[#00c4cc]/10 flex items-center justify-center">
            <ClipboardCheck size={18} className="text-[#00c4cc]" />
          </div>
          自己評価
        </h2>
        <p className="text-gray-500 text-sm mt-2">
          事業所の自己評価および保護者等向け評価を作成・管理します
        </p>
      </div>

      {/* Tab navigation */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-1.5">
        <div className="flex gap-1">
          {EVALUATION_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-bold rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'text-white bg-[#00c4cc] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {(activeTab === 'self' || activeTab === 'parent') && renderEvaluationForm()}
      {activeTab === 'improvement' && renderImprovementPlan()}
      {activeTab === 'history' && renderHistory()}
    </div>
  );
};

export default SelfEvaluationView;
