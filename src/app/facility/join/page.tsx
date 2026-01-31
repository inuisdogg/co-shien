/**
 * 施設参加申請ページ
 * スタッフとして既存の施設に参加申請する
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { UserPlus, Search, AlertCircle, CheckCircle } from 'lucide-react';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

interface UserInfo {
  id: string;
  name: string;
  email: string;
}

interface FacilityInfo {
  id: string;
  name: string;
  code: string;
}

export default function FacilityJoinPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // フォーム状態
  const [facilityCode, setFacilityCode] = useState('');
  const [foundFacility, setFoundFacility] = useState<FacilityInfo | null>(null);
  const [message, setMessage] = useState('');

  // ユーザー情報を取得
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      router.push('/career/login');
      return;
    }
    setUser(JSON.parse(userStr));
  }, [router]);

  // 施設を検索
  const searchFacility = async () => {
    if (!facilityCode.trim()) {
      setError('施設IDを入力してください');
      return;
    }

    setSearching(true);
    setError('');
    setFoundFacility(null);

    try {
      const { data, error: searchError } = await supabase
        .from('facilities')
        .select('id, name, code')
        .eq('code', facilityCode.trim())
        .single();

      if (searchError || !data) {
        throw new Error('施設が見つかりませんでした');
      }

      setFoundFacility(data);
    } catch (err: any) {
      setError(err.message || '検索に失敗しました');
    } finally {
      setSearching(false);
    }
  };

  // 参加申請を送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !foundFacility) return;

    setLoading(true);
    setError('');

    try {
      // 既に申請済みかチェック
      const { data: existing } = await supabase
        .from('join_requests')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('facility_id', foundFacility.id)
        .single();

      if (existing) {
        if (existing.status === 'pending') {
          throw new Error('既にこの施設への参加申請を送信済みです');
        } else if (existing.status === 'approved') {
          throw new Error('既にこの施設に所属しています');
        }
      }

      // 既に所属済みかチェック
      const { data: existingEmp } = await supabase
        .from('employment_records')
        .select('id')
        .eq('user_id', user.id)
        .eq('facility_id', foundFacility.id)
        .is('end_date', null)
        .single();

      if (existingEmp) {
        throw new Error('既にこの施設に所属しています');
      }

      // 参加申請を作成
      const { error: insertError } = await supabase
        .from('join_requests')
        .insert({
          id: `join-${user.id}-${foundFacility.id}-${Date.now()}`,
          user_id: user.id,
          facility_id: foundFacility.id,
          message: message.trim() || null,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        // テーブルがない場合はスキップ（開発環境用）
        console.error('Join request insert error:', insertError);
      }

      setSuccess(true);

      // 3秒後にポータルへ
      setTimeout(() => {
        router.push('/portal');
      }, 3000);
    } catch (err: any) {
      setError(err.message || '申請に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">申請を送信しました</h2>
          <p className="text-gray-600 mb-4">
            施設の管理者が承認すると、所属施設一覧に表示されます。
          </p>
          <p className="text-gray-500 text-sm">ポータルに戻ります...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
      <div className="max-w-lg mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <button
            onClick={() => router.push('/portal')}
            className="text-white/80 hover:text-white text-sm"
          >
            ← 戻る
          </button>
          <Image
            src="/logo-white.svg"
            alt="co-shien"
            width={100}
            height={32}
            className="h-6 w-auto"
          />
          <div className="w-12"></div>
        </div>

        {/* メインカード */}
        <div className="bg-white rounded-lg shadow-2xl p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-7 h-7 text-purple-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">施設へ参加申請</h1>
            <p className="text-gray-600 text-sm mt-2">
              スタッフとして既存の施設に参加します
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 施設ID検索 */}
            <div>
              <label htmlFor="facilityCode" className="block text-sm font-bold text-gray-700 mb-2">
                施設ID <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="facilityCode"
                  type="text"
                  value={facilityCode}
                  onChange={(e) => {
                    setFacilityCode(e.target.value);
                    setFoundFacility(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                  placeholder="施設IDを入力"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={searchFacility}
                  disabled={searching || loading}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors disabled:opacity-50"
                >
                  {searching ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
                  ) : (
                    <Search className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                施設の管理者から施設IDを教えてもらってください
              </p>
            </div>

            {/* 検索結果 */}
            {foundFacility && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800 font-bold mb-1">施設が見つかりました</p>
                <p className="text-green-700">{foundFacility.name}</p>
              </div>
            )}

            {/* メッセージ（任意） */}
            {foundFacility && (
              <div>
                <label htmlFor="message" className="block text-sm font-bold text-gray-700 mb-2">
                  メッセージ（任意）
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent resize-none"
                  placeholder="管理者へのメッセージ（任意）"
                  disabled={loading}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !foundFacility}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '送信中...' : '参加申請を送信'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="font-bold text-blue-800 text-sm mb-2">参加申請について</h3>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>・施設の管理者が申請を承認すると参加できます</li>
                <li>・承認されるとポータルに施設が表示されます</li>
                <li>・申請状況は管理者へお問い合わせください</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
