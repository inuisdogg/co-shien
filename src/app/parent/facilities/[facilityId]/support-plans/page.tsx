/**
 * 保護者向け個別支援計画閲覧・同意ページ
 * 子どもの支援計画を閲覧し、デジタル同意署名を行う
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Building2, FileText, CheckCircle, Clock,
  AlertCircle, PenTool, Download, ChevronDown, ChevronUp,
  CalendarDays, User,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

export const dynamic = 'force-dynamic';

type SupportPlan = {
  id: string;
  childId: string;
  childName: string;
  planType: string;
  periodStart: string;
  periodEnd: string;
  planCreatedDate: string;
  planCreatorName: string;
  status: string;
  parentAgreed: boolean;
  parentAgreedAt: string | null;
  parentSignerName: string | null;
  planContent: any;
  filePath: string | null;
  fileName: string | null;
};

export default function ParentSupportPlansPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const facilityId = params.facilityId as string;

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [facility, setFacility] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [plans, setPlans] = useState<SupportPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [signingPlan, setSigningPlan] = useState<string | null>(null);
  const [signerName, setSignerName] = useState('');

  // 署名キャンバス
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userStr = localStorage.getItem('user');
        if (!userStr) { router.push('/parent/login'); return; }
        const user = JSON.parse(userStr);
        if (user.userType !== 'client') { router.push('/career'); return; }
        setCurrentUser(user);
        setSignerName(user.name || '');

        const { data: facilityData } = await supabase
          .from('facilities')
          .select('id, name, code')
          .eq('id', facilityId)
          .single();
        setFacility(facilityData);

        // 利用児童
        const { data: contractData } = await supabase
          .from('parent_child_facilities')
          .select('child_id')
          .eq('parent_user_id', user.id)
          .eq('facility_id', facilityId);

        const childIds = (contractData || []).map(c => c.child_id);
        if (childIds.length === 0) { setLoading(false); return; }

        const { data: childData } = await supabase
          .from('children')
          .select('id, name')
          .in('id', childIds);
        setChildren(childData || []);

        // 支援計画
        const { data: planData } = await supabase
          .from('support_plans')
          .select('*')
          .eq('facility_id', facilityId)
          .in('child_id', childIds)
          .in('status', ['active', 'draft'])
          .order('period_start', { ascending: false });

        const childMap = Object.fromEntries((childData || []).map(c => [c.id, c]));
        const mapped: SupportPlan[] = (planData || []).map((p: any) => ({
          id: p.id,
          childId: p.child_id,
          childName: childMap[p.child_id]?.name || '不明',
          planType: p.plan_type || 'initial',
          periodStart: p.period_start || '',
          periodEnd: p.period_end || '',
          planCreatedDate: p.plan_created_date || p.created_at,
          planCreatorName: p.plan_creator_name || '',
          status: p.status,
          parentAgreed: p.parent_agreed || false,
          parentAgreedAt: p.parent_agreed_at,
          parentSignerName: p.parent_signer_name,
          planContent: p.plan_content,
          filePath: p.file_path,
          fileName: p.file_name,
        }));
        setPlans(mapped);
      } catch (err) {
        console.error(err);
        setError('データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [facilityId, router]);

  // 署名処理
  const handleSign = async (planId: string) => {
    if (!signerName.trim()) {
      toast.warning('署名者名を入力してください');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 空白チェック
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hasContent = imageData.data.some((val, idx) => idx % 4 === 3 && val > 0);
    if (!hasContent) {
      toast.warning('署名を手書きしてください');
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('support_plans')
        .update({
          parent_agreed: true,
          parent_agreed_at: new Date().toISOString(),
          parent_signer_name: signerName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId);

      if (updateError) throw updateError;

      setPlans(prev => prev.map(p =>
        p.id === planId
          ? { ...p, parentAgreed: true, parentAgreedAt: new Date().toISOString(), parentSignerName: signerName }
          : p
      ));
      setSigningPlan(null);
    } catch (err) {
      console.error(err);
      toast.error('署名の保存に失敗しました');
    }
  };

  // キャンバス描画
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    setHasDrawnSignature(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#333';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => { setIsDrawing(false); };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnSignature(false);
  };

  const planTypeLabels: Record<string, string> = {
    initial: '初回',
    renewal: '更新',
    modification: '変更',
  };

  const formatDate = (d: string) => {
    if (!d) return '-';
    const date = new Date(d);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const daysUntil = (d: string) => {
    if (!d) return null;
    const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
    return diff;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-orange-50/30">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-orange-50/30">
      {/* ヘッダー */}
      <div className="bg-white border-b border-orange-100 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button onClick={() => router.back()} className="p-1">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-800 truncate">個別支援計画</h1>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {facility?.name || '施設'}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* 同意待ちの計画があれば注意喚起 */}
        {plans.some(p => !p.parentAgreed && p.status === 'active') && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">同意待ちの支援計画があります</p>
              <p className="text-xs text-amber-600 mt-1">内容をご確認のうえ、署名・同意をお願いします。</p>
            </div>
          </div>
        )}

        {plans.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-8 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">支援計画はまだありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map(plan => {
              const isExpanded = expandedPlan === plan.id;
              const remaining = daysUntil(plan.periodEnd);

              return (
                <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-orange-100 overflow-hidden">
                  {/* カードヘッダー */}
                  <button
                    onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-800">{plan.childName}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {planTypeLabels[plan.planType] || plan.planType}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {formatDate(plan.periodStart)} 〜 {formatDate(plan.periodEnd)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {plan.parentAgreed ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-600">
                          <CheckCircle className="w-3 h-3" />同意済
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-600">
                          <PenTool className="w-3 h-3" />同意待ち
                        </span>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>

                  {/* 展開内容 */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 py-4 space-y-4">
                      {/* 計画詳細 */}
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">作成者</span>
                          <span className="text-gray-800">{plan.planCreatorName || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">作成日</span>
                          <span className="text-gray-800">{formatDate(plan.planCreatedDate)}</span>
                        </div>
                        {remaining !== null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">残り期間</span>
                            <span className={remaining <= 30 ? 'text-red-600 font-medium' : remaining <= 90 ? 'text-amber-600' : 'text-gray-800'}>
                              {remaining <= 0 ? '期限切れ' : `残り${remaining}日`}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 計画内容（JSONBから表示） */}
                      {plan.planContent && (
                        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                          <h4 className="text-xs font-medium text-gray-600">計画内容</h4>
                          {plan.planContent.goals && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">目標</p>
                              {Array.isArray(plan.planContent.goals) ? (
                                <ul className="text-sm text-gray-700 space-y-1">
                                  {plan.planContent.goals.map((g: any, i: number) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="text-orange-400 mt-0.5">•</span>
                                      <span>{typeof g === 'string' ? g : g.goal || g.description || JSON.stringify(g)}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-gray-700">{String(plan.planContent.goals)}</p>
                              )}
                            </div>
                          )}
                          {plan.planContent.support_details && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">支援内容</p>
                              <p className="text-sm text-gray-700">{String(plan.planContent.support_details)}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 同意署名 */}
                      {plan.parentAgreed ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                          <p className="text-emerald-700 font-medium flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            同意済み
                          </p>
                          <p className="text-emerald-600 text-xs mt-1">
                            署名者: {plan.parentSignerName || '-'} / {plan.parentAgreedAt ? formatDate(plan.parentAgreedAt) : ''}
                          </p>
                        </div>
                      ) : (
                        <>
                          {signingPlan === plan.id ? (
                            <div className="space-y-3">
                              <div>
                                <label className="text-xs text-gray-600 block mb-1">署名者名</label>
                                <input
                                  type="text"
                                  value={signerName}
                                  onChange={e => setSignerName(e.target.value)}
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                                  placeholder="保護者氏名"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-600 block mb-1">署名（手書き）</label>
                                <div ref={canvasContainerRef} className="relative border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white">
                                  {!hasDrawnSignature && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                      <span className="text-gray-400 text-sm">ここに指でサインしてください</span>
                                    </div>
                                  )}
                                  <canvas
                                    ref={canvasRef}
                                    width={canvasContainerRef.current?.clientWidth || 350}
                                    height={200}
                                    className="w-full touch-none"
                                    style={{ minHeight: '200px' }}
                                    onMouseDown={startDraw}
                                    onMouseMove={draw}
                                    onMouseUp={endDraw}
                                    onMouseLeave={endDraw}
                                    onTouchStart={startDraw}
                                    onTouchMove={draw}
                                    onTouchEnd={endDraw}
                                  />
                                </div>
                                <button onClick={clearCanvas} className="text-xs text-gray-500 mt-1 hover:underline">
                                  クリア
                                </button>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSign(plan.id)}
                                  className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
                                >
                                  同意する
                                </button>
                                <button
                                  onClick={() => setSigningPlan(null)}
                                  className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                                >
                                  キャンセル
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setSigningPlan(plan.id)}
                              className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
                            >
                              <PenTool className="w-4 h-4" />
                              内容を確認して同意する
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 注意事項 */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-xs text-orange-800">
            個別支援計画は、お子様の発達支援の目標と内容をまとめた計画書です。
            内容をよくご確認のうえ、同意の署名をお願いいたします。
            ご質問がございましたら、施設の児童発達支援管理責任者までお問い合わせください。
          </p>
        </div>
      </div>
    </div>
  );
}
