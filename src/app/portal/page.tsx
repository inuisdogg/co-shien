/**
 * ポータルページ（所属選択）
 * ログイン後、所属施設を選択してBiz/Personalモードへ遷移
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Building2, UserPlus, Plus, LogOut, Briefcase, User } from 'lucide-react';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

interface Facility {
  id: string;
  name: string;
  code: string;
  role: string;
  verification_status?: string;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
}

export default function PortalPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ユーザー情報と所属施設を取得
  useEffect(() => {
    const loadData = async () => {
      try {
        // localStorageからユーザー情報を取得
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          router.push('/career/login');
          return;
        }

        const userData = JSON.parse(userStr);
        setUser(userData);

        // employment_recordsから所属施設を取得
        const { data: employments, error: empError } = await supabase
          .from('employment_records')
          .select(`
            id,
            role,
            facility_id,
            facilities (
              id,
              name,
              code,
              verification_status
            )
          `)
          .eq('user_id', userData.id)
          .is('end_date', null); // 現在も在籍中

        if (empError) {
          console.error('Employment fetch error:', empError);
        }

        if (employments && employments.length > 0) {
          const facilityList = employments
            .filter((emp: any) => emp.facilities)
            .map((emp: any) => ({
              id: emp.facilities.id,
              name: emp.facilities.name,
              code: emp.facilities.code,
              role: emp.role,
              verification_status: emp.facilities.verification_status,
            }));
          setFacilities(facilityList);
        }

        setLoading(false);
      } catch (err: any) {
        console.error('Load error:', err);
        setError('データの読み込みに失敗しました');
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  // 施設を選択してモードに遷移
  const selectFacility = (facility: Facility, mode: 'biz' | 'personal') => {
    // 選択した施設情報をlocalStorageに保存
    localStorage.setItem('selectedFacility', JSON.stringify({
      id: facility.id,
      name: facility.name,
      code: facility.code,
      role: facility.role,
    }));

    if (mode === 'biz') {
      // Bizモードへ（管理者向け）
      window.location.href = `https://biz.co-shien.inu.co.jp/?facilityId=${facility.id}`;
    } else {
      // Personalモードへ（スタッフ向け）
      router.push('/career');
    }
  };

  // ログアウト
  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('selectedFacility');
    router.push('/career/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-8 pt-4">
          <div className="bg-white rounded-lg px-4 py-2">
            <Image
              src="/logo-cropped-center.png"
              alt="co-shien"
              width={200}
              height={64}
              className="h-12 w-auto"
              priority
            />
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-white/80 hover:text-white text-sm"
          >
            <LogOut className="w-4 h-4" />
            ログアウト
          </button>
        </div>

        {/* メインカード */}
        <div className="bg-white rounded-lg shadow-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              ようこそ、{user?.name}さん
            </h1>
            <p className="text-gray-600 text-sm">
              施設を選択するか、新しく登録してください
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6">
              {error}
            </div>
          )}

          {/* 所属施設一覧 */}
          {facilities.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#00c4cc]" />
                所属施設
              </h2>
              <div className="space-y-3">
                {facilities.map((facility) => (
                  <div
                    key={facility.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-[#00c4cc] transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-gray-800">{facility.name}</h3>
                        <p className="text-sm text-gray-500">
                          施設ID: {facility.code} / {facility.role}
                        </p>
                        {facility.verification_status === 'unverified' && (
                          <span className="inline-block mt-1 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                            認証待ち
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(facility.role === '管理者' || facility.role === 'admin') && (
                        <button
                          onClick={() => selectFacility(facility, 'biz')}
                          className="flex-1 flex items-center justify-center gap-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-2 px-4 rounded-md transition-colors text-sm"
                        >
                          <Briefcase className="w-4 h-4" />
                          Bizモード（管理）
                        </button>
                      )}
                      <button
                        onClick={() => selectFacility(facility, 'personal')}
                        className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition-colors text-sm"
                      >
                        <User className="w-4 h-4" />
                        Personalモード
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 施設がない場合 or 追加オプション */}
          <div className={facilities.length > 0 ? 'pt-6 border-t border-gray-200' : ''}>
            {facilities.length === 0 && (
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-600 mb-2">まだ所属している施設がありません</p>
                <p className="text-gray-500 text-sm">
                  施設を新規作成するか、既存の施設に参加申請してください
                </p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => router.push('/facility/register')}
                className="w-full flex items-center justify-center gap-3 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-4 px-6 rounded-md transition-colors"
              >
                <Plus className="w-5 h-5" />
                施設を新規作成（管理者として）
              </button>

              <button
                onClick={() => router.push('/facility/join')}
                className="w-full flex items-center justify-center gap-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 px-6 rounded-md transition-colors"
              >
                <UserPlus className="w-5 h-5" />
                既存施設へ参加申請（スタッフとして）
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
