/**
 * 利用者ダッシュボード
 * 登録済みの児童一覧を表示し、新規登録へのナビゲーションを提供
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Plus, User, Calendar, LogOut, ChevronRight, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Child } from '@/types';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

export default function ClientDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push('/login');
          return;
        }

        // usersテーブルからユーザー情報を取得
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userError || !userData) {
          router.push('/login');
          return;
        }

        // 利用者アカウントかチェック
        if (userData.user_type !== 'client') {
          router.push('/staff-dashboard');
          return;
        }

        setCurrentUser(userData);

        // 登録済みの児童を取得（owner_profile_idで紐付け）
        const { data: childrenData, error: childrenError } = await supabase
          .from('children')
          .select('*')
          .eq('owner_profile_id', session.user.id)
          .order('created_at', { ascending: false });

        if (childrenError) {
          console.error('児童データ取得エラー:', childrenError);
        } else {
          // キャメルケースに変換
          const formattedChildren: Child[] = (childrenData || []).map((c: any) => ({
            id: c.id,
            facilityId: c.facility_id,
            ownerProfileId: c.owner_profile_id,
            name: c.name,
            nameKana: c.name_kana,
            age: c.age,
            birthDate: c.birth_date,
            guardianName: c.guardian_name,
            guardianNameKana: c.guardian_name_kana,
            guardianRelationship: c.guardian_relationship,
            beneficiaryNumber: c.beneficiary_number,
            grantDays: c.grant_days,
            contractDays: c.contract_days,
            address: c.address,
            phone: c.phone,
            email: c.email,
            doctorName: c.doctor_name,
            doctorClinic: c.doctor_clinic,
            schoolName: c.school_name,
            pattern: c.pattern,
            patternDays: c.pattern_days,
            patternTimeSlots: c.pattern_time_slots,
            needsPickup: c.needs_pickup || false,
            needsDropoff: c.needs_dropoff || false,
            pickupLocation: c.pickup_location,
            pickupLocationCustom: c.pickup_location_custom,
            dropoffLocation: c.dropoff_location,
            dropoffLocationCustom: c.dropoff_location_custom,
            characteristics: c.characteristics,
            contractStatus: c.contract_status || 'pre-contract',
            contractStartDate: c.contract_start_date,
            contractEndDate: c.contract_end_date,
            registrationType: c.registration_type,
            plannedContractDays: c.planned_contract_days,
            plannedUsageStartDate: c.planned_usage_start_date,
            plannedUsageDays: c.planned_usage_days,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
          }));
          setChildren(formattedChildren);
        }
      } catch (err: any) {
        setError(err.message || 'データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('user');
    localStorage.removeItem('selectedFacility');
    router.push('/login');
  };

  // 年齢を計算
  const calculateAge = (birthDate?: string): number | null => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // 契約ステータスのラベルを取得
  const getContractStatusLabel = (status: string) => {
    switch (status) {
      case 'pre-contract':
        return { label: '契約前', color: 'bg-yellow-100 text-yellow-800' };
      case 'active':
        return { label: '契約中', color: 'bg-green-100 text-green-800' };
      case 'inactive':
        return { label: '休止中', color: 'bg-gray-100 text-gray-800' };
      case 'terminated':
        return { label: '解約', color: 'bg-red-100 text-red-800' };
      default:
        return { label: '不明', color: 'bg-gray-100 text-gray-800' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-cropped-center.png"
              alt="co-shien"
              width={120}
              height={40}
              className="h-8 w-auto"
            />
            <span className="inline-block bg-orange-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              利用者
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden sm:block">
              {currentUser?.name}さん
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-gray-600 hover:text-gray-800 text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* ウェルカムメッセージ */}
        <div className="bg-gradient-to-r from-orange-300 to-orange-400 rounded-lg p-6 text-gray-800 mb-6">
          <h1 className="text-2xl font-bold mb-2">ようこそ、{currentUser?.lastName || currentUser?.name}さん</h1>
          <p className="text-gray-700 text-sm">
            お子様の情報を管理し、施設との連携を行うことができます。
          </p>
        </div>

        {/* 児童登録セクション */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">登録済みのお子様</h2>
            <button
              onClick={() => router.push('/client/children/register')}
              className="flex items-center gap-2 bg-orange-400 hover:bg-orange-500 text-white text-sm font-bold py-2 px-4 rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              お子様を追加
            </button>
          </div>

          {children.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">お子様が登録されていません</h3>
              <p className="text-gray-600 text-sm mb-4">
                「お子様を追加」ボタンから、お子様の情報を登録してください。
              </p>
              <button
                onClick={() => router.push('/client/children/register')}
                className="inline-flex items-center gap-2 bg-orange-400 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded-md transition-colors"
              >
                <Plus className="w-4 h-4" />
                お子様を登録する
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {children.map((child) => {
                const status = getContractStatusLabel(child.contractStatus);
                const age = calculateAge(child.birthDate);

                return (
                  <div
                    key={child.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-orange-200 transition-colors cursor-pointer"
                    onClick={() => {
                      // TODO: 児童詳細ページへ遷移
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-orange-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-800">{child.name}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                            {age !== null && <span>{age}歳</span>}
                            {child.birthDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {child.birthDate}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>

                    {/* 施設未紐付けの場合の案内 */}
                    {!child.facilityId && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500">
                          施設と連携するには、施設からの招待または利用申請が必要です。
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* クイックアクション */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => router.push('/client/children/register')}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-left hover:border-orange-200 transition-colors"
          >
            <Plus className="w-8 h-8 text-orange-500 mb-2" />
            <h3 className="font-bold text-gray-800">お子様を追加</h3>
            <p className="text-xs text-gray-500 mt-1">新しいお子様を登録</p>
          </button>
          <button
            disabled
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-left opacity-50 cursor-not-allowed"
          >
            <Calendar className="w-8 h-8 text-gray-400 mb-2" />
            <h3 className="font-bold text-gray-800">施設を探す</h3>
            <p className="text-xs text-gray-500 mt-1">近日公開予定</p>
          </button>
        </div>

        {/* フッター */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">
            co-shien 利用者向けサービス
          </p>
        </div>
      </main>
    </div>
  );
}
