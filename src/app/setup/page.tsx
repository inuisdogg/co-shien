/**
 * セットアップページ（Biz側）
 * メール認証完了後、施設IDを発行してウェルカムメールを送信
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function SetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [facilityCode, setFacilityCode] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    const setupFacility = async () => {
      try {
        setLoading(true);
        setError('');

        // メール認証が完了しているか確認
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session || !session.user) {
          setError('ログインが必要です');
          router.push('/signup');
          return;
        }

        // メール認証が完了しているか確認
        if (!session.user.email_confirmed_at) {
          setError('メール認証が完了していません');
          router.push('/signup?waiting=true');
          return;
        }

        // 既に施設が作成されているか確認
        const { data: existingUser } = await supabase
          .from('users')
          .select('id, email, name, facility_id')
          .eq('email', session.user.email)
          .single();

        if (!existingUser) {
          setError('ユーザー情報が見つかりません');
          return;
        }

        // 既に施設IDが発行されているか確認
        if (existingUser.facility_id) {
          const { data: facility } = await supabase
            .from('facilities')
            .select('code')
            .eq('id', existingUser.facility_id)
            .single();

          if (facility) {
            setFacilityCode(facility.code);
            setEmailSent(true);
            setLoading(false);
            return;
          }
        }

        // 施設IDを生成（5桁のランダムな番号、重複チェック付き）
        let newFacilityCode: string = '';
        let isUnique = false;
        do {
          newFacilityCode = Math.floor(10000 + Math.random() * 90000).toString().padStart(5, '0');
          const { data: existingFacility } = await supabase
            .from('facilities')
            .select('id')
            .eq('code', newFacilityCode)
            .single();
          if (!existingFacility) {
            isUnique = true;
          }
        } while (!isUnique);

        // 施設を作成
        const timestamp = Date.now();
        const facilityId = `facility-${timestamp}`;

        const { error: facilityError } = await supabase
          .from('facilities')
          .insert({
            id: facilityId,
            name: `${existingUser.name}の施設`, // デフォルト名（後で変更可能）
            code: newFacilityCode,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (facilityError) {
          throw new Error(`施設の作成に失敗しました: ${facilityError.message}`);
        }

        // ユーザーのfacility_idを更新
        const { error: userUpdateError } = await supabase
          .from('users')
          .update({
            facility_id: facilityId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingUser.id);

        if (userUpdateError) {
          // 施設を削除（ロールバック）
          await supabase.from('facilities').delete().eq('id', facilityId);
          throw new Error(`ユーザー情報の更新に失敗しました: ${userUpdateError.message}`);
        }

        setFacilityCode(newFacilityCode);

        // ウェルカムメールを送信
        try {
          const response = await fetch('/api/send-welcome-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: existingUser.email,
              name: existingUser.name,
              facilityCode: newFacilityCode,
              type: 'biz',
            }),
          });

          if (!response.ok) {
            console.error('ウェルカムメール送信に失敗しました');
            // メール送信エラーは無視（施設IDは発行済み）
          } else {
            setEmailSent(true);
          }
        } catch (emailError) {
          console.error('ウェルカムメール送信エラー:', emailError);
          // メール送信エラーは無視（施設IDは発行済み）
        }

        setLoading(false);
      } catch (err: any) {
        console.error('Setup error:', err);
        setError(err.message || 'セットアップに失敗しました');
        setLoading(false);
      }
    };

    setupFacility();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00c4cc] mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">セットアップ中...</h2>
          <p className="text-gray-600">施設IDを発行しています</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">エラー</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/signup')}
            className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors"
          >
            サインアップページに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">セットアップ完了</h2>
          <p className="text-gray-600 text-sm mb-6">
            {emailSent 
              ? 'ウェルカムメールを送信しました' 
              : '施設IDが発行されました'}
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">施設ID</label>
            <div className="flex items-center justify-between bg-white border-2 border-[#00c4cc] rounded-md px-4 py-3">
              <code className="text-lg font-bold text-[#00c4cc] tracking-wider">{facilityCode}</code>
              <button
                type="button"
                onClick={() => {
                  if (facilityCode) {
                    navigator.clipboard.writeText(facilityCode);
                    alert('施設IDをクリップボードにコピーしました');
                  }
                }}
                className="ml-2 text-[#00c4cc] hover:text-[#00b0b8]"
                title="コピー"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">※ この施設IDは大切に保管してください</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={async () => {
              // 施設セットアップページにリダイレクト（施設IDとメールアドレスを渡す）
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.user?.email && facilityCode) {
                router.push(`/admin-setup?facilityCode=${facilityCode}&email=${encodeURIComponent(session.user.email)}`);
              } else {
                router.push('/');
              }
            }}
            className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors"
          >
            施設セットアップを続ける
          </button>
        </div>
      </div>
    </div>
  );
}

