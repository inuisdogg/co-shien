/**
 * 連絡帳履歴ページ（利用者側）
 * 署名待ち / 履歴 タブ切り替え
 * 署名機能付き
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Building2, Calendar, XCircle, Send, CheckCircle,
  AlertCircle, Clock, User, MessageSquare, Heart, Loader2,
  BookOpen, PenLine, ChevronRight, Smile, Frown, Meh
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type ContactLog = {
  id: string;
  facility_id: string;
  child_id: string;
  date: string;
  slot?: string;
  activities?: string;
  health_status?: string;
  mood?: string;
  appetite?: string;
  meal_main?: boolean;
  meal_side?: boolean;
  meal_notes?: string;
  staff_comment?: string;
  parent_message?: string;
  parent_reply?: string;
  parent_reply_at?: string;
  status?: string;
  is_signed: boolean;
  signed_at?: string;
  signed_by_user_id?: string;
  parent_signer_name?: string;
  created_at: string;
};

export default function ContactBookPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const facilityId = params.facilityId as string;
  const childIdParam = searchParams.get('child');

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [facility, setFacility] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [contactLogs, setContactLogs] = useState<ContactLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'unsigned' | 'history'>('unsigned');

  // 署名モーダル
  const [signingLog, setSigningLog] = useState<ContactLog | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          router.push('/parent/login');
          return;
        }

        const user = JSON.parse(userStr);
        if (user.userType !== 'client') {
          router.push('/career');
          return;
        }

        setCurrentUser(user);
        setSignerName(user.name || `${user.lastName || ''} ${user.firstName || ''}`.trim());

        // 施設情報を取得
        const { data: facilityData } = await supabase
          .from('facilities')
          .select('*')
          .eq('id', facilityId)
          .single();

        if (facilityData) {
          setFacility(facilityData);
        }

        // 自分の児童を取得
        const { data: childrenData } = await supabase
          .from('children')
          .select('*')
          .eq('owner_profile_id', user.id);

        if (childrenData && childrenData.length > 0) {
          // この施設との契約を持つ児童をフィルタ
          const childIds = childrenData.map((c: any) => c.id);

          // 方法1: children.facility_idで関連チェック
          const relatedChildren = childrenData.filter((c: any) => c.facility_id === facilityId);

          // 方法2: contractsテーブルで確認
          const { data: contractsData } = await supabase
            .from('contracts')
            .select('child_id')
            .in('child_id', childIds)
            .eq('facility_id', facilityId)
            .eq('status', 'active');

          const contractedChildIds = contractsData?.map((c: any) => c.child_id) || [];
          const allRelatedChildIds = new Set([
            ...relatedChildren.map((c: any) => c.id),
            ...contractedChildIds
          ]);

          const filteredChildren = childrenData.filter((c: any) => allRelatedChildIds.has(c.id));
          setChildren(filteredChildren.length > 0 ? filteredChildren : childrenData);

          // 選択する児童を決定
          if (childIdParam && allRelatedChildIds.has(childIdParam)) {
            setSelectedChildId(childIdParam);
          } else if (filteredChildren.length > 0) {
            setSelectedChildId(filteredChildren[0].id);
          } else if (childrenData.length > 0) {
            setSelectedChildId(childrenData[0].id);
          }
        }
      } catch (err: any) {
        setError(err.message || 'データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [facilityId, childIdParam, router]);

  // 連絡帳データを取得
  const fetchContactLogs = useCallback(async () => {
    if (!selectedChildId || !facilityId) return;

    const { data, error: fetchError } = await supabase
      .from('contact_logs')
      .select('*')
      .eq('child_id', selectedChildId)
      .eq('facility_id', facilityId)
      .order('date', { ascending: false })
      .limit(50);

    if (fetchError) {
      console.error('Contact logs fetch error:', fetchError);
    } else if (data) {
      setContactLogs(data);
    }
  }, [selectedChildId, facilityId]);

  useEffect(() => {
    fetchContactLogs();
  }, [fetchContactLogs]);

  // 署名処理
  const handleSign = async () => {
    if (!signingLog || !signerName.trim()) return;

    setSigning(true);
    try {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('contact_logs')
        .update({
          is_signed: true,
          signed_at: now,
          signed_by_user_id: currentUser?.id,
          parent_signer_name: signerName.trim(),
          status: 'signed',
        })
        .eq('id', signingLog.id);

      if (updateError) throw updateError;

      // ローカルの状態を更新
      setContactLogs(prev => prev.map(log =>
        log.id === signingLog.id
          ? { ...log, is_signed: true, signed_at: now, parent_signer_name: signerName.trim(), status: 'signed' }
          : log
      ));
      setSigningLog(null);
    } catch (err: any) {
      setError(err.message || '署名に失敗しました');
    } finally {
      setSigning(false);
    }
  };

  const unsignedLogs = contactLogs.filter(log => !log.is_signed && log.status === 'submitted');
  const historyLogs = contactLogs;

  const healthStatusLabel = (status?: string) => {
    switch (status) {
      case 'excellent': return '元気';
      case 'good': return '良好';
      case 'fair': return '普通';
      case 'poor': return '体調不良';
      default: return '-';
    }
  };

  const healthStatusColor = (status?: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'fair': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-400';
    }
  };

  const moodIcon = (mood?: string) => {
    switch (mood) {
      case 'very_happy':
      case 'happy':
        return <Smile className="w-4 h-4 text-green-500" />;
      case 'neutral':
        return <Meh className="w-4 h-4 text-yellow-500" />;
      case 'sad':
      case 'upset':
        return <Frown className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const selectedChild = children.find(c => c.id === selectedChildId);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <div className="animate-pulse flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full" />
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-32" />
                <div className="h-3 bg-gray-200 rounded w-20" />
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-white rounded-xl" />
            <div className="h-40 bg-white rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/parent/facilities/${facilityId}?child=${selectedChildId}`)}
              className="text-gray-500 hover:text-gray-700 p-1 -ml-1"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="w-10 h-10 bg-[#F472B6]/10 rounded-full flex items-center justify-center shrink-0">
              <BookOpen size={20} className="text-[#F472B6]" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-gray-800 text-sm truncate">
                連絡帳 - {facility?.name || '施設'}
              </h1>
              {selectedChild && (
                <p className="text-xs text-gray-500">{selectedChild.name}さん</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* 児童選択 */}
        {children.length > 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
            <div className="flex gap-2 flex-wrap">
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setSelectedChildId(child.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
                    selectedChildId === child.id
                      ? 'border-[#F472B6] bg-[#F472B6]/10 text-[#EC4899]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <User size={14} />
                  {child.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* タブ */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('unsigned')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold border-b-2 transition-colors ${
                activeTab === 'unsigned'
                  ? 'border-[#F472B6] text-[#EC4899] bg-pink-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <PenLine className="w-4 h-4" />
              署名待ち
              {unsignedLogs.length > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {unsignedLogs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold border-b-2 transition-colors ${
                activeTab === 'history'
                  ? 'border-[#F472B6] text-[#EC4899] bg-pink-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calendar className="w-4 h-4" />
              履歴
            </button>
          </div>

          <div className="p-4">
            {/* 署名待ちタブ */}
            {activeTab === 'unsigned' && (
              <div>
                {unsignedLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">署名待ちの連絡帳はありません</p>
                    <p className="text-sm text-gray-400 mt-1">全て署名済みです</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {unsignedLogs.map((log) => (
                      <div key={log.id} className="border border-[#F472B6]/30 bg-pink-50/50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-800">{log.date}</span>
                            {log.slot && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                {log.slot === 'AM' ? '午前' : '午後'}
                              </span>
                            )}
                          </div>
                          <span className="text-xs bg-[#F472B6] text-white px-2 py-0.5 rounded-full font-bold">
                            署名待ち
                          </span>
                        </div>

                        {/* 活動内容 */}
                        {log.activities && (
                          <div className="mb-2">
                            <p className="text-xs font-bold text-gray-500 mb-1">活動内容</p>
                            <p className="text-sm text-gray-700 bg-white rounded-lg p-2">{log.activities}</p>
                          </div>
                        )}

                        {/* 体調・様子 */}
                        <div className="flex items-center gap-4 mb-2">
                          {log.health_status && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">体調:</span>
                              <span className={`text-xs font-bold ${healthStatusColor(log.health_status)}`}>
                                {healthStatusLabel(log.health_status)}
                              </span>
                            </div>
                          )}
                          {log.mood && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">機嫌:</span>
                              {moodIcon(log.mood)}
                            </div>
                          )}
                        </div>

                        {/* スタッフコメント */}
                        {log.staff_comment && (
                          <div className="mb-3">
                            <p className="text-xs font-bold text-gray-500 mb-1">スタッフからのコメント</p>
                            <p className="text-sm text-gray-700 bg-white rounded-lg p-2 border-l-4 border-[#F472B6]">
                              {log.staff_comment}
                            </p>
                          </div>
                        )}

                        {/* 署名ボタン */}
                        <button
                          onClick={() => setSigningLog(log)}
                          className="w-full mt-2 py-2.5 bg-[#F472B6] hover:bg-[#EC4899] text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
                        >
                          <PenLine className="w-4 h-4" />
                          署名する
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 履歴タブ */}
            {activeTab === 'history' && (
              <div>
                {historyLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">連絡帳の履歴がありません</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historyLogs.map((log) => (
                      <div key={log.id} className={`border rounded-xl p-4 ${
                        log.is_signed ? 'border-gray-100 bg-white' : 'border-yellow-200 bg-yellow-50/50'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-800">{log.date}</span>
                            {log.slot && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                {log.slot === 'AM' ? '午前' : '午後'}
                              </span>
                            )}
                          </div>
                          {log.is_signed ? (
                            <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" />
                              署名済み {log.signed_at && `(${new Date(log.signed_at).toLocaleDateString('ja-JP')} ${new Date(log.signed_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })})`}
                            </span>
                          ) : log.status === 'submitted' ? (
                            <button
                              onClick={() => setSigningLog(log)}
                              className="text-xs bg-[#F472B6] text-white px-2 py-1 rounded-full font-bold hover:bg-[#EC4899]"
                            >
                              署名する
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">下書き</span>
                          )}
                        </div>

                        {log.activities && (
                          <p className="text-sm text-gray-700 mb-1">
                            <span className="text-xs text-gray-500">活動: </span>
                            {log.activities.length > 60 ? `${log.activities.substring(0, 60)}...` : log.activities}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          {log.health_status && (
                            <span className={healthStatusColor(log.health_status)}>
                              {healthStatusLabel(log.health_status)}
                            </span>
                          )}
                          {log.mood && moodIcon(log.mood)}
                          {log.staff_comment && (
                            <span className="text-gray-400">コメントあり</span>
                          )}
                        </div>

                        {log.is_signed && log.parent_signer_name && (
                          <p className="text-xs text-gray-400 mt-2">
                            署名者: {log.parent_signer_name}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 署名モーダル */}
      {signingLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-xl">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">連絡帳に署名</h3>
              <p className="text-sm text-gray-500 mt-1">
                {signingLog.date}の連絡帳を確認しました。
              </p>
            </div>
            <div className="p-4 space-y-4">
              {/* ログの概要 */}
              <div className="bg-gray-50 rounded-xl p-3">
                {signingLog.activities && (
                  <p className="text-sm text-gray-700 mb-1"><span className="font-bold">活動:</span> {signingLog.activities}</p>
                )}
                {signingLog.staff_comment && (
                  <p className="text-sm text-gray-700"><span className="font-bold">コメント:</span> {signingLog.staff_comment}</p>
                )}
              </div>

              {/* 署名者名 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">署名者名</label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F472B6]/30 focus:border-[#F472B6] text-base"
                  placeholder="保護者名を入力"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex gap-2">
              <button
                onClick={() => setSigningLog(null)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSign}
                disabled={signing || !signerName.trim()}
                className="flex-1 py-3 bg-[#F472B6] hover:bg-[#EC4899] text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {signing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PenLine className="w-4 h-4" />
                )}
                署名する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
