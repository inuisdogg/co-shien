/**
 * 児童詳細ページ
 * 受給者証のアップロード、施設連携、実績記録の確認など
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Upload, Building2, Calendar, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';

// カレンダー表示コンポーネント
function CalendarView({ schedules, contracts, selectedMonth }: { schedules: any[]; contracts: any[]; selectedMonth: Date }) {
  const today = new Date();
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const getScheduleForDate = (date: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    return schedules.filter(s => s.date === dateStr);
  };

  const getFacilityName = (facilityId: string) => {
    return contracts.find(c => c.facility_id === facilityId)?.facilities?.name || '施設名不明';
  };

  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-200">
        {weekDays.map((day, index) => (
          <div
            key={day}
            className={`p-2 text-center text-sm font-bold ${
              index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-gray-700'
            }`}
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: startingDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[80px] border-r border-b border-gray-200"></div>
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const date = i + 1;
          const daySchedules = getScheduleForDate(date);
          const isToday = date === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const dayOfWeek = new Date(year, month, date).getDay();

          return (
            <div
              key={date}
              className={`min-h-[80px] border-r border-b border-gray-200 p-1 ${
                isToday ? 'bg-orange-50' : ''
              } ${dayOfWeek === 0 ? 'bg-red-50' : dayOfWeek === 6 ? 'bg-blue-50' : ''}`}
            >
              <div className={`text-xs font-bold mb-1 ${isToday ? 'text-orange-600' : ''}`}>
                {date}
              </div>
              <div className="space-y-1">
                {daySchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="text-xs bg-orange-100 text-orange-800 px-1 py-0.5 rounded truncate"
                    title={`${schedule.slot === 'AM' ? '午前' : '午後'} - ${getFacilityName(schedule.facility_id)}`}
                  >
                    {schedule.slot === 'AM' ? '午前' : '午後'}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
import { supabase } from '@/lib/supabase';
import type { Child } from '@/types';

export const dynamic = 'force-dynamic';

export default function ChildDetailPage() {
  const router = useRouter();
  const params = useParams();
  const childId = params.id as string;
  
  const [child, setChild] = useState<Child | null>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [usageRecords, setUsageRecords] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'facilities' | 'records' | 'calendar'>('info');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          router.push('/client/login');
          return;
        }

        const user = JSON.parse(userStr);
        if (user.userType !== 'client') {
          router.push('/staff-dashboard');
          return;
        }

        // 児童情報を取得
        const { data: childData, error: childError } = await supabase
          .from('children')
          .select('*')
          .eq('id', childId)
          .eq('owner_profile_id', user.id)
          .single();

        if (childError || !childData) {
          setError('お子様の情報が見つかりません');
          setLoading(false);
          return;
        }

        // キャメルケースに変換
        const formattedChild: Child = {
          id: childData.id,
          facilityId: childData.facility_id,
          ownerProfileId: childData.owner_profile_id,
          name: childData.name,
          nameKana: childData.name_kana,
          age: childData.age,
          birthDate: childData.birth_date,
          guardianName: childData.guardian_name,
          guardianNameKana: childData.guardian_name_kana,
          guardianRelationship: childData.guardian_relationship,
          beneficiaryNumber: childData.beneficiary_number,
          grantDays: childData.grant_days,
          contractDays: childData.contract_days,
          address: childData.address,
          phone: childData.phone,
          email: childData.email,
          doctorName: childData.doctor_name,
          doctorClinic: childData.doctor_clinic,
          schoolName: childData.school_name,
          pattern: childData.pattern,
          patternDays: childData.pattern_days,
          patternTimeSlots: childData.pattern_time_slots,
          needsPickup: childData.needs_pickup || false,
          needsDropoff: childData.needs_dropoff || false,
          pickupLocation: childData.pickup_location,
          pickupLocationCustom: childData.pickup_location_custom,
          dropoffLocation: childData.dropoff_location,
          dropoffLocationCustom: childData.dropoff_location_custom,
          characteristics: childData.characteristics,
          contractStatus: childData.contract_status || 'pre-contract',
          contractStartDate: childData.contract_start_date,
          contractEndDate: childData.contract_end_date,
          registrationType: childData.registration_type,
          plannedContractDays: childData.planned_contract_days,
          plannedUsageStartDate: childData.planned_usage_start_date,
          plannedUsageDays: childData.planned_usage_days,
          createdAt: childData.created_at,
          updatedAt: childData.updated_at,
        };
        setChild(formattedChild);

        // 契約情報を取得
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
          .eq('child_id', childId)
          .order('created_at', { ascending: false });

        if (!contractsError && contractsData) {
          setContracts(contractsData);
          // アクティブな契約がある場合は最初の施設を選択
          const activeContract = contractsData.find((c: any) => c.status === 'active');
          if (activeContract) {
            setSelectedFacility(activeContract.facility_id);
          }
        }

        // 実績記録を取得（アクティブな契約の施設のみ）
        const activeFacilityIds = contractsData
          ?.filter((c: any) => c.status === 'active')
          .map((c: any) => c.facility_id) || [];

        if (activeFacilityIds.length > 0) {
          const { data: recordsData } = await supabase
            .from('usage_records')
            .select('*')
            .eq('child_id', childId)
            .in('facility_id', activeFacilityIds)
            .order('date', { ascending: false })
            .limit(100);

          if (recordsData) {
            setUsageRecords(recordsData);
          }

          // 予定表を取得
          const { data: schedulesData } = await supabase
            .from('schedules')
            .select('*')
            .eq('child_id', childId)
            .in('facility_id', activeFacilityIds)
            .order('date', { ascending: true });

          if (schedulesData) {
            setSchedules(schedulesData);
          }
        }
      } catch (err: any) {
        setError(err.message || 'データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    if (childId) {
      fetchData();
    }
  }, [childId, router]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !child) return;

    // 画像ファイルのみ許可
    if (!file.type.startsWith('image/')) {
      setError('画像ファイルを選択してください');
      return;
    }

    // ファイルサイズチェック（10MB以下）
    if (file.size > 10 * 1024 * 1024) {
      setError('ファイルサイズは10MB以下にしてください');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        router.push('/client/login');
        return;
      }

      const user = JSON.parse(userStr);
      const fileExt = file.name.split('.').pop();
      const fileName = `${child.id}/beneficiary_certificate_${Date.now()}.${fileExt}`;
      const filePath = `beneficiary-certificates/${fileName}`;

      // Supabase Storageにアップロード
      // まず、バケットの存在を確認
      const { data: buckets } = await supabase.storage.listBuckets();
      const documentsBucket = buckets?.find(b => b.name === 'documents');
      
      if (!documentsBucket) {
        // バケットが存在しない場合は作成を試みる（管理者権限が必要）
        const { error: createBucketError } = await supabase.storage.createBucket('documents', {
          public: true,
          fileSizeLimit: 10485760, // 10MB
        });
        
        if (createBucketError) {
          throw new Error('ストレージバケットが設定されていません。管理者に連絡してください。');
        }
      }

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // 公開URLを取得
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      // データベースを更新
      const { error: updateError } = await supabase
        .from('children')
        .update({
          beneficiary_certificate_image_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', child.id);

      if (updateError) {
        throw updateError;
      }

      // ローカル状態を更新
      setChild({
        ...child,
        beneficiaryCertificateImageUrl: publicUrl,
      } as Child);

      alert('受給者証の画像をアップロードしました');
    } catch (err: any) {
      setError(err.message || '画像のアップロードに失敗しました');
    } finally {
      setUploading(false);
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

  if (!child) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">お子様の情報が見つかりません</p>
          <button
            onClick={() => router.push('/client/dashboard')}
            className="bg-orange-400 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded-md"
          >
            ダッシュボードに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <button
            onClick={() => router.push('/client/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>ダッシュボードに戻る</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-800">{child.name}さんの詳細</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6">
            {error}
          </div>
        )}

        {/* タブ */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            {[
              { id: 'info', label: '基本情報', icon: FileText },
              { id: 'facilities', label: '利用施設', icon: Building2 },
              { id: 'records', label: '実績記録', icon: Calendar },
              { id: 'calendar', label: '予定表', icon: Calendar },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-orange-400 text-orange-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-6">
            {/* 基本情報タブ */}
            {activeTab === 'info' && (
              <div className="space-y-6">
                {/* 受給者証アップロード */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    受給者証の最新版
                  </h3>
                  {child.beneficiaryCertificateImageUrl ? (
                    <div className="space-y-3">
                      <div className="relative w-full max-w-md border border-gray-200 rounded-lg overflow-hidden">
                        <img
                          src={child.beneficiaryCertificateImageUrl}
                          alt="受給者証"
                          className="w-full h-auto"
                        />
                      </div>
                      <label className="inline-flex items-center gap-2 bg-orange-400 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded-md transition-colors cursor-pointer">
                        <Upload className="w-4 h-4" />
                        {uploading ? 'アップロード中...' : '画像を更新'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploading}
                          className="hidden"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">
                        受給者証の最新版の画像をアップロードしてください。
                      </p>
                      <label className="inline-flex items-center gap-2 bg-orange-400 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded-md transition-colors cursor-pointer">
                        <Upload className="w-4 h-4" />
                        {uploading ? 'アップロード中...' : '画像をアップロード'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploading}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* 基本情報 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-gray-700">氏名</label>
                    <p className="text-gray-800">{child.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-700">フリガナ</label>
                    <p className="text-gray-800">{child.nameKana || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-700">生年月日</label>
                    <p className="text-gray-800">{child.birthDate || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-700">受給者証番号</label>
                    <p className="text-gray-800">{child.beneficiaryNumber || '-'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 利用施設タブ */}
            {activeTab === 'facilities' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800">利用施設一覧</h3>
                  {contracts.filter(c => c.status === 'active').length > 0 && (
                    <button
                      onClick={() => router.push(`/client/children/${childId}/usage-request`)}
                      className="bg-orange-400 hover:bg-orange-500 text-white text-sm font-bold py-2 px-4 rounded-md transition-colors flex items-center gap-2"
                    >
                      <Calendar className="w-4 h-4" />
                      利用曜日を申請
                    </button>
                  )}
                </div>
                {contracts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Building2 className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>利用施設が登録されていません</p>
                    <p className="text-sm mt-2">施設からの招待をお待ちください</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {contracts.map((contract) => {
                      const facility = contract.facilities;
                      const getStatusIcon = () => {
                        switch (contract.status) {
                          case 'active':
                            return <CheckCircle className="w-5 h-5 text-green-500" />;
                          case 'pending':
                            return <Clock className="w-5 h-5 text-yellow-500" />;
                          case 'rejected':
                            return <XCircle className="w-5 h-5 text-red-500" />;
                          default:
                            return null;
                        }
                      };

                      const getStatusLabel = () => {
                        switch (contract.status) {
                          case 'active':
                            return '契約中';
                          case 'pending':
                            return '承認待ち';
                          case 'rejected':
                            return '却下';
                          case 'terminated':
                            return '解約';
                          default:
                            return contract.status;
                        }
                      };

                      return (
                        <div
                          key={contract.id}
                          className="border border-gray-200 rounded-lg p-4 hover:border-orange-200 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {getStatusIcon()}
                              <div>
                                <h4 className="font-bold text-gray-800">{facility?.name || '施設名不明'}</h4>
                                <p className="text-sm text-gray-500">施設コード: {facility?.code || '-'}</p>
                                {contract.contract_start_date && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    契約開始: {contract.contract_start_date}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              contract.status === 'active' ? 'bg-green-100 text-green-800' :
                              contract.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              contract.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {getStatusLabel()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 実績記録タブ */}
            {activeTab === 'records' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800">利用実績記録</h3>
                  {contracts.filter(c => c.status === 'active').length > 1 && (
                    <select
                      value={selectedFacility || ''}
                      onChange={(e) => setSelectedFacility(e.target.value || null)}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">全ての施設</option>
                      {contracts
                        .filter(c => c.status === 'active')
                        .map((contract) => (
                          <option key={contract.id} value={contract.facility_id}>
                            {contract.facilities?.name || '施設名不明'}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
                {contracts.filter(c => c.status === 'active').length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>契約中の施設がありません</p>
                    <p className="text-sm mt-2">施設と契約すると、実績記録を確認できます</p>
                  </div>
                ) : usageRecords.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>実績記録がありません</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {usageRecords
                      .filter((record) => !selectedFacility || record.facility_id === selectedFacility)
                      .map((record) => (
                        <div
                          key={record.id}
                          className="border border-gray-200 rounded-lg p-4 hover:border-orange-200 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-gray-800">{record.date}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  record.service_status === '利用' ? 'bg-green-100 text-green-800' :
                                  record.service_status === '欠席(加算なし)' ? 'bg-gray-100 text-gray-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {record.service_status}
                                </span>
                              </div>
                              <div className="text-sm text-gray-600 space-y-1">
                                {record.calculated_time > 0 && (
                                  <p>算定時間: {record.calculated_time}時間</p>
                                )}
                                {record.instruction_form && (
                                  <p>指導形態: {record.instruction_form}</p>
                                )}
                                {record.memo && (
                                  <p className="text-xs text-gray-500">備考: {record.memo}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right text-sm text-gray-500">
                              {contracts.find(c => c.facility_id === record.facility_id)?.facilities?.name}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* 予定表タブ */}
            {activeTab === 'calendar' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800">利用予定表</h3>
                  <div className="flex items-center gap-3">
                    {contracts.filter(c => c.status === 'active').length > 1 && (
                      <select
                        value={selectedFacility || ''}
                        onChange={(e) => setSelectedFacility(e.target.value || null)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                      >
                        <option value="">全ての施設</option>
                        {contracts
                          .filter(c => c.status === 'active')
                          .map((contract) => (
                            <option key={contract.id} value={contract.facility_id}>
                              {contract.facilities?.name || '施設名不明'}
                            </option>
                          ))}
                      </select>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const prevMonth = new Date(selectedMonth);
                          prevMonth.setMonth(prevMonth.getMonth() - 1);
                          setSelectedMonth(prevMonth);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-md"
                      >
                        ←
                      </button>
                      <span className="text-sm font-medium min-w-[120px] text-center">
                        {selectedMonth.getFullYear()}年{selectedMonth.getMonth() + 1}月
                      </span>
                      <button
                        onClick={() => {
                          const nextMonth = new Date(selectedMonth);
                          nextMonth.setMonth(nextMonth.getMonth() + 1);
                          setSelectedMonth(nextMonth);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-md"
                      >
                        →
                      </button>
                    </div>
                  </div>
                </div>
                {contracts.filter(c => c.status === 'active').length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>契約中の施設がありません</p>
                    <p className="text-sm mt-2">施設と契約すると、予定表を確認できます</p>
                  </div>
                ) : (
                  <CalendarView
                    schedules={schedules.filter((s) => 
                      (!selectedFacility || s.facility_id === selectedFacility) &&
                      new Date(s.date).getMonth() === selectedMonth.getMonth() &&
                      new Date(s.date).getFullYear() === selectedMonth.getFullYear()
                    )}
                    contracts={contracts.filter(c => c.status === 'active')}
                    selectedMonth={selectedMonth}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

