/**
 * 利用者ダッシュボード
 * 登録済みの児童一覧を表示し、新規登録へのナビゲーションを提供
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Plus, User, Calendar, LogOut, ChevronRight, AlertCircle, Building2, FileText, Clock, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Child } from '@/types';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

export default function ClientDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [usageRecords, setUsageRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // まずlocalStorageのuserデータをチェック（利用者ログインではSupabase Authのセッションがない可能性があるため）
        const userStr = localStorage.getItem('user');
        let userId: string | null = null;
        let userType: string | null = null;
        
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            if (user?.id) {
              userId = user.id;
              userType = user.userType;
              
              // 利用者アカウントでない場合はスタッフダッシュボードへ
              if (userType && userType !== 'client') {
                router.push('/staff-dashboard');
                return;
              }
              
              // 利用者アカウントの場合は、localStorageのデータを信頼して続行
              if (userType === 'client') {
                // usersテーブルからユーザー情報を取得して確認
                const { data: userData, error: userError } = await supabase
                  .from('users')
                  .select('*')
                  .eq('id', userId)
                  .single();

                if (userError || !userData) {
                  router.push('/client/login');
                  return;
                }

                // 利用者アカウントか再確認
                if (userData.user_type !== 'client') {
                  router.push('/staff-dashboard');
                  return;
                }

                setCurrentUser(userData);

                // localStorageのuserデータを更新
                const updatedUser = {
                  id: userData.id,
                  name: userData.name || (userData.last_name && userData.first_name ? `${userData.last_name} ${userData.first_name}` : ''),
                  lastName: userData.last_name,
                  firstName: userData.first_name,
                  email: userData.email,
                  role: userData.role,
                  userType: 'client',
                  account_status: userData.account_status,
                };
                localStorage.setItem('user', JSON.stringify(updatedUser));

                // 登録済みの児童を取得（owner_profile_idで紐付け）
                // まず、userIdで検索を試み、見つからない場合はメールアドレスでusersテーブルから正しいIDを取得
                console.log('児童データ取得開始 - userId:', userId, 'userEmail:', userData.email);
                
                let searchUserId = userId;
                
                // userIdでusersテーブルに存在するか確認
                const { data: userCheckData } = await supabase
                  .from('users')
                  .select('id')
                  .eq('id', userId)
                  .single();
                
                if (!userCheckData) {
                  // userIdが存在しない場合、メールアドレスで検索
                  console.log('userIdが存在しないため、メールアドレスで検索します');
                  const { data: userByEmail } = await supabase
                    .from('users')
                    .select('id')
                    .eq('email', userData.email)
                    .single();
                  
                  if (userByEmail) {
                    searchUserId = userByEmail.id;
                    console.log('メールアドレスで見つかったuserId:', searchUserId);
                  } else {
                    console.error('メールアドレスでユーザーが見つかりませんでした');
                    setLoading(false);
                    return;
                  }
                } else {
                  console.log('userIdが存在します:', searchUserId);
                }
                
                console.log('児童データ検索に使用するuserId:', searchUserId);
                const { data: childrenData, error: childrenError } = await supabase
                  .from('children')
                  .select('*')
                  .eq('owner_profile_id', searchUserId)
                  .order('created_at', { ascending: false });

                console.log('児童データ取得結果:', { childrenData, childrenError, childrenDataLength: childrenData?.length });

                if (childrenError) {
                  console.error('児童データ取得エラー:', childrenError);
                  setChildren([]);
                } else if (childrenData) {
                  if (childrenData.length === 0) {
                    console.log('児童データが空です');
                    setChildren([]);
                  } else {
                    console.log('児童データの詳細:', childrenData);
                    const formattedChildren: Child[] = childrenData.map((c: any) => ({
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
                      beneficiaryCertificateImageUrl: c.beneficiary_certificate_image_url,
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
                    console.log('フォーマット済み児童データ:', formattedChildren);

                    // 児童IDのリストを取得
                    const childIds = formattedChildren.map(c => c.id);
                    console.log('児童IDリスト:', childIds);

                    if (childIds.length > 0) {
                      // 契約情報を取得
                      console.log('契約データ取得開始');
                      const { data: contractsData, error: contractsError } = await supabase
                        .from('contracts')
                        .select(`
                          *,
                          facilities:facility_id (
                            id,
                            name,
                            code
                          )
                        `)
                        .in('child_id', childIds)
                        .order('created_at', { ascending: false });

                      console.log('契約データ取得結果:', { contractsData, contractsError });

                      if (!contractsError && contractsData) {
                        setContracts(contractsData);
                        
                        // 施設情報を取得
                        const facilityIds = [...new Set(contractsData.map((c: any) => c.facility_id))];
                        console.log('施設IDリスト:', facilityIds);
                        if (facilityIds.length > 0) {
                          const { data: facilitiesData, error: facilitiesError } = await supabase
                            .from('facilities')
                            .select('*')
                            .in('id', facilityIds);

                          console.log('施設データ取得結果:', { facilitiesData, facilitiesError });
                          if (!facilitiesError && facilitiesData) {
                            setFacilities(facilitiesData);
                          }
                        }

                        // 実績記録を取得（schedulesテーブルから）
                        const { data: schedulesData, error: schedulesError } = await supabase
                          .from('schedules')
                          .select('*')
                          .in('child_id', childIds)
                          .gte('date', new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).toISOString().split('T')[0])
                          .order('date', { ascending: false })
                          .limit(50);

                        console.log('実績記録データ取得結果:', { schedulesData, schedulesError });
                        if (!schedulesError && schedulesData) {
                          setUsageRecords(schedulesData);
                        }
                      }
                    } else {
                      console.log('児童IDが空のため、契約データを取得しません');
                    }
                  }
                } else {
                  console.log('児童データがnullまたはundefinedです');
                  setChildren([]);
                }

                setLoading(false);
                return;
              }
            }
          } catch (e) {
            console.error('localStorage user parse error:', e);
          }
        }

        // localStorageにuserデータがない場合はログインページへ
        if (!userId) {
          router.push('/client/login');
          return;
        }

        // 利用者アカウントかチェック
        if (userData.user_type !== 'client') {
          router.push('/staff-dashboard');
          return;
        }

        setCurrentUser(userData);

        // 登録済みの児童を取得（owner_profile_idで紐付け）
        console.log('児童データ取得開始（セッション経由） - userId:', session.user.id);
        const { data: childrenData, error: childrenError } = await supabase
          .from('children')
          .select('*')
          .eq('owner_profile_id', session.user.id)
          .order('created_at', { ascending: false });

        console.log('児童データ取得結果（セッション経由）:', { childrenData, childrenError, childrenDataLength: childrenData?.length });

        if (childrenError) {
          console.error('児童データ取得エラー:', childrenError);
          setChildren([]);
        } else if (childrenData && childrenData.length > 0) {
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
          console.log('フォーマット済み児童データ（セッション経由）:', formattedChildren);

          // 児童IDのリストを取得
          const childIds = formattedChildren.map(c => c.id);
          console.log('児童IDリスト（セッション経由）:', childIds);

          if (childIds.length > 0) {
            // 契約情報を取得
            console.log('契約データ取得開始（セッション経由）');
            const { data: contractsData, error: contractsError } = await supabase
              .from('contracts')
              .select(`
                *,
                facilities:facility_id (
                  id,
                  name,
                  code
                )
              `)
              .in('child_id', childIds)
              .order('created_at', { ascending: false });

            console.log('契約データ取得結果（セッション経由）:', { contractsData, contractsError });

            if (!contractsError && contractsData) {
              setContracts(contractsData);
              
              // 施設情報を取得
              const facilityIds = [...new Set(contractsData.map((c: any) => c.facility_id))];
              console.log('施設IDリスト（セッション経由）:', facilityIds);
              if (facilityIds.length > 0) {
                const { data: facilitiesData, error: facilitiesError } = await supabase
                  .from('facilities')
                  .select('*')
                  .in('id', facilityIds);

                console.log('施設データ取得結果（セッション経由）:', { facilitiesData, facilitiesError });
                if (!facilitiesError && facilitiesData) {
                  setFacilities(facilitiesData);
                }
              }

              // 実績記録を取得（schedulesテーブルから）
              const { data: schedulesData, error: schedulesError } = await supabase
                .from('schedules')
                .select('*')
                .in('child_id', childIds)
                .gte('date', new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).toISOString().split('T')[0])
                .order('date', { ascending: false })
                .limit(50);

              console.log('実績記録データ取得結果（セッション経由）:', { schedulesData, schedulesError });
              if (!schedulesError && schedulesData) {
                setUsageRecords(schedulesData);
              }
            }
          } else {
            console.log('児童IDが空のため、契約データを取得しません（セッション経由）');
          }
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
    router.push('/client/login');
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
                      router.push(`/client/children/${child.id}`);
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

        {/* 施設ごとの契約情報 */}
        {contracts.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">契約中の施設</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contracts
                .filter(c => c.status === 'active')
                .map((contract) => {
                  const facility = facilities.find(f => f.id === contract.facility_id) || contract.facilities;
                  const child = children.find(c => c.id === contract.child_id);
                  return (
                    <div
                      key={contract.id}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-orange-200 transition-colors cursor-pointer"
                      onClick={() => child && router.push(`/client/children/${child.id}?facility=${contract.facility_id}`)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-orange-500" />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-800">{facility?.name || '施設名不明'}</h3>
                            {child && (
                              <p className="text-xs text-gray-500 mt-1">{child.name} さん</p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                          契約中
                        </span>
                      </div>
                      <div className="space-y-2 text-sm text-gray-600">
                        {contract.contract_start_date && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>契約開始: {contract.contract_start_date}</span>
                          </div>
                        )}
                        {contract.approved_at && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span>承認済み</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* 最近の利用実績 */}
        {usageRecords.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">最近の利用実績</h2>
              {children.length > 0 && (
                <button
                  onClick={() => router.push(`/client/children/${children[0].id}`)}
                  className="text-sm text-orange-500 hover:text-orange-600 font-bold"
                >
                  詳細を見る →
                </button>
              )}
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="space-y-3">
                {usageRecords.slice(0, 5).map((record) => {
                  const facility = facilities.find(f => f.id === record.facility_id);
                  const child = children.find(c => c.id === record.child_id);
                  return (
                    <div
                      key={record.id}
                      className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          record.service_status === '利用' ? 'bg-green-500' :
                          record.service_status === '欠席(加算なし)' ? 'bg-gray-400' :
                          'bg-yellow-500'
                        }`} />
                        <div>
                          <p className="text-sm font-bold text-gray-800">{record.date}</p>
                          <p className="text-xs text-gray-500">
                            {child?.name} - {facility?.name || '施設名不明'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          record.service_status === '利用' ? 'bg-green-100 text-green-800' :
                          record.service_status === '欠席(加算なし)' ? 'bg-gray-100 text-gray-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {record.service_status}
                        </span>
                        {record.calculated_time > 0 && (
                          <p className="text-xs text-gray-500 mt-1">{record.calculated_time}時間</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* クイックアクション */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => router.push('/client/children/register')}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-left hover:border-orange-200 transition-colors"
          >
            <Plus className="w-8 h-8 text-orange-500 mb-2" />
            <h3 className="font-bold text-gray-800 text-sm">お子様を追加</h3>
            <p className="text-xs text-gray-500 mt-1">新しいお子様を登録</p>
          </button>
          {children.length > 0 && (
            <button
              onClick={() => router.push(`/client/children/${children[0].id}`)}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-left hover:border-orange-200 transition-colors"
            >
              <FileText className="w-8 h-8 text-blue-500 mb-2" />
              <h3 className="font-bold text-gray-800 text-sm">詳細を見る</h3>
              <p className="text-xs text-gray-500 mt-1">お子様の詳細情報</p>
            </button>
          )}
          {children.length > 0 && (
            <button
              onClick={() => router.push(`/client/children/${children[0].id}/usage-request`)}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-left hover:border-orange-200 transition-colors"
            >
              <Calendar className="w-8 h-8 text-purple-500 mb-2" />
              <h3 className="font-bold text-gray-800 text-sm">利用申請</h3>
              <p className="text-xs text-gray-500 mt-1">利用曜日を申請</p>
            </button>
          )}
          <button
            disabled
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-left opacity-50 cursor-not-allowed"
          >
            <Clock className="w-8 h-8 text-gray-400 mb-2" />
            <h3 className="font-bold text-gray-800 text-sm">施設を探す</h3>
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
