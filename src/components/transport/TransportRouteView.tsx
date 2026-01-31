/**
 * 送迎ルート管理画面
 * 日別の送迎ルートを計算・表示
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  MapPin,
  Clock,
  Navigation,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  GripVertical,
  AlertCircle,
  CheckCircle,
  Route,
  User,
  Users,
  Check,
} from 'lucide-react';
import { useFacilityData } from '@/hooks/useFacilityData';
import { useAuth } from '@/contexts/AuthContext';
import { Child, ScheduleItem, DailyTransportAssignment, TransportCompletionRecord, Staff } from '@/types';
import { supabase } from '@/lib/supabase';
import {
  calculateOptimizedRoute,
  calculateCustomRoute,
  geocodeAddress,
  formatDistance,
  formatDuration,
  calculateArrivalTimes,
  LatLng,
  RouteResult,
} from '@/utils/googleMaps';

interface TransportChild {
  child: Child;
  address: string;
  location?: LatLng;
  isGeocoded: boolean;
}

interface RouteData {
  children: TransportChild[];
  route: RouteResult | null;
  isOptimized: boolean;
  departureTime: string;
}

export default function TransportRouteView() {
  const { children, facilitySettings, schedules, staff } = useFacilityData();
  const { facility } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [pickupData, setPickupData] = useState<RouteData>({
    children: [],
    route: null,
    isOptimized: true,
    departureTime: '08:30',
  });
  const [dropoffData, setDropoffData] = useState<RouteData>({
    children: [],
    route: null,
    isOptimized: true,
    departureTime: '16:30',
  });
  const [isCalculating, setIsCalculating] = useState(false);
  const [facilityLocation, setFacilityLocation] = useState<LatLng | null>(null);

  // 送迎担当者
  const [transportAssignment, setTransportAssignment] = useState<{
    driverStaffId: string;
    driverName: string;
    attendantStaffId: string;
    attendantName: string;
  } | null>(null);

  // 送迎完了チェック記録
  const [completionRecords, setCompletionRecords] = useState<Record<string, {
    pickupCompleted: boolean;
    dropoffCompleted: boolean;
  }>>({});

  // 施設の座標を取得
  useEffect(() => {
    const getFacilityLocation = async () => {
      if (facilitySettings.latitude && facilitySettings.longitude) {
        setFacilityLocation({
          lat: facilitySettings.latitude,
          lng: facilitySettings.longitude,
        });
      } else if (facilitySettings.address) {
        const location = await geocodeAddress(facilitySettings.address);
        setFacilityLocation(location);
      }
    };
    getFacilityLocation();
  }, [facilitySettings]);

  // 送迎担当者と完了記録を取得
  useEffect(() => {
    const fetchTransportData = async () => {
      if (!facility?.id) return;

      // 送迎担当者を取得
      const { data: assignmentData } = await supabase
        .from('daily_transport_assignments')
        .select('*, driver:staff!driver_staff_id(id, name), attendant:staff!attendant_staff_id(id, name)')
        .eq('facility_id', facility.id)
        .eq('date', selectedDate)
        .single();

      if (assignmentData) {
        setTransportAssignment({
          driverStaffId: assignmentData.driver_staff_id,
          driverName: (assignmentData.driver as any)?.name || '未設定',
          attendantStaffId: assignmentData.attendant_staff_id,
          attendantName: (assignmentData.attendant as any)?.name || '未設定',
        });
      } else {
        setTransportAssignment(null);
      }

      // 完了記録を取得
      const { data: completionData } = await supabase
        .from('transport_completion_records')
        .select('*')
        .eq('facility_id', facility.id)
        .eq('date', selectedDate);

      if (completionData) {
        const records: Record<string, { pickupCompleted: boolean; dropoffCompleted: boolean }> = {};
        completionData.forEach((row: any) => {
          records[row.child_id] = {
            pickupCompleted: row.pickup_completed || false,
            dropoffCompleted: row.dropoff_completed || false,
          };
        });
        setCompletionRecords(records);
      }
    };

    fetchTransportData();
  }, [facility?.id, selectedDate]);

  // 送迎完了をトグル
  const toggleCompletion = async (childId: string, scheduleId: string, type: 'pickup' | 'dropoff') => {
    if (!facility?.id) return;

    const currentRecord = completionRecords[childId] || { pickupCompleted: false, dropoffCompleted: false };
    const newValue = type === 'pickup' ? !currentRecord.pickupCompleted : !currentRecord.dropoffCompleted;

    try {
      const updateData: any = {
        facility_id: facility.id,
        date: selectedDate,
        schedule_id: scheduleId,
        child_id: childId,
        updated_at: new Date().toISOString(),
      };

      if (type === 'pickup') {
        updateData.pickup_completed = newValue;
        if (newValue) {
          updateData.pickup_completed_at = new Date().toISOString();
        }
      } else {
        updateData.dropoff_completed = newValue;
        if (newValue) {
          updateData.dropoff_completed_at = new Date().toISOString();
        }
      }

      const { error } = await supabase
        .from('transport_completion_records')
        .upsert(updateData, { onConflict: 'facility_id,date,schedule_id' });

      if (error) throw error;

      setCompletionRecords(prev => ({
        ...prev,
        [childId]: {
          ...prev[childId],
          [type === 'pickup' ? 'pickupCompleted' : 'dropoffCompleted']: newValue,
        },
      }));
    } catch (error) {
      console.error('完了チェックの更新に失敗:', error);
      alert('完了チェックの更新に失敗しました');
    }
  };

  // 選択日に送迎が必要な児童を抽出
  const transportChildren = useMemo(() => {
    const daySchedules = schedules.filter((s) => s.date === selectedDate);

    const pickupList: TransportChild[] = [];
    const dropoffList: TransportChild[] = [];

    daySchedules.forEach((schedule) => {
      const child = children.find((c) => c.id === schedule.childId);
      if (!child) return;

      // お迎えが必要
      if (child.needsPickup && child.pickupLocation !== '事業所') {
        const address = child.pickupAddress || child.address || '';
        if (address) {
          pickupList.push({
            child,
            address,
            isGeocoded: false,
          });
        }
      }

      // お送りが必要
      if (child.needsDropoff && child.dropoffLocation !== '事業所') {
        const address = child.dropoffAddress || child.address || '';
        if (address) {
          dropoffList.push({
            child,
            address,
            isGeocoded: false,
          });
        }
      }
    });

    return { pickupList, dropoffList };
  }, [selectedDate, schedules, children]);

  // 住所をジオコーディングしてルート計算
  const calculateRoutes = async () => {
    if (!facilityLocation) {
      alert('施設の住所が設定されていません。施設設定から住所を登録してください。');
      return;
    }

    setIsCalculating(true);

    try {
      // お迎えルートの計算
      const pickupWithLocations = await Promise.all(
        transportChildren.pickupList.map(async (tc) => {
          if (tc.child.pickupLatitude && tc.child.pickupLongitude) {
            return {
              ...tc,
              location: { lat: tc.child.pickupLatitude, lng: tc.child.pickupLongitude },
              isGeocoded: true,
            };
          }
          const location = await geocodeAddress(tc.address);
          return { ...tc, location: location || undefined, isGeocoded: !!location };
        })
      );

      const validPickup = pickupWithLocations.filter((tc) => tc.location);
      let pickupRoute: RouteResult | null = null;

      if (validPickup.length > 0) {
        pickupRoute = await calculateOptimizedRoute(
          facilityLocation,
          validPickup.map((tc) => ({
            location: tc.location!,
            childId: tc.child.id,
            childName: tc.child.name,
          })),
          facilityLocation
        );

        // 最適化された順序で並び替え
        if (pickupRoute && pickupRoute.waypointOrder.length > 0) {
          const reordered = pickupRoute.waypointOrder.map((i) => validPickup[i]);
          setPickupData({
            children: reordered,
            route: pickupRoute,
            isOptimized: true,
            departureTime: pickupData.departureTime,
          });
        } else {
          setPickupData({
            children: validPickup,
            route: pickupRoute,
            isOptimized: true,
            departureTime: pickupData.departureTime,
          });
        }
      } else {
        setPickupData({
          children: pickupWithLocations,
          route: null,
          isOptimized: true,
          departureTime: pickupData.departureTime,
        });
      }

      // お送りルートの計算
      const dropoffWithLocations = await Promise.all(
        transportChildren.dropoffList.map(async (tc) => {
          if (tc.child.dropoffLatitude && tc.child.dropoffLongitude) {
            return {
              ...tc,
              location: { lat: tc.child.dropoffLatitude, lng: tc.child.dropoffLongitude },
              isGeocoded: true,
            };
          }
          const location = await geocodeAddress(tc.address);
          return { ...tc, location: location || undefined, isGeocoded: !!location };
        })
      );

      const validDropoff = dropoffWithLocations.filter((tc) => tc.location);
      let dropoffRoute: RouteResult | null = null;

      if (validDropoff.length > 0) {
        dropoffRoute = await calculateOptimizedRoute(
          facilityLocation,
          validDropoff.map((tc) => ({
            location: tc.location!,
            childId: tc.child.id,
            childName: tc.child.name,
          })),
          facilityLocation
        );

        if (dropoffRoute && dropoffRoute.waypointOrder.length > 0) {
          const reordered = dropoffRoute.waypointOrder.map((i) => validDropoff[i]);
          setDropoffData({
            children: reordered,
            route: dropoffRoute,
            isOptimized: true,
            departureTime: dropoffData.departureTime,
          });
        } else {
          setDropoffData({
            children: validDropoff,
            route: dropoffRoute,
            isOptimized: true,
            departureTime: dropoffData.departureTime,
          });
        }
      } else {
        setDropoffData({
          children: dropoffWithLocations,
          route: null,
          isOptimized: true,
          departureTime: dropoffData.departureTime,
        });
      }
    } catch (error) {
      console.error('Route calculation error:', error);
      alert('ルート計算中にエラーが発生しました');
    } finally {
      setIsCalculating(false);
    }
  };

  // 日付変更
  const changeDate = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  // 曜日を取得
  const getDayOfWeek = (dateStr: string) => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const date = new Date(dateStr);
    return days[date.getDay()];
  };

  // ドラッグ&ドロップによる順序変更
  const handleDragStart = (e: React.DragEvent, index: number, type: 'pickup' | 'dropoff') => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ index, type }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number, type: 'pickup' | 'dropoff') => {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    if (data.type !== type) return;

    const sourceIndex = data.index;
    if (sourceIndex === targetIndex) return;

    const routeData = type === 'pickup' ? pickupData : dropoffData;
    const setRouteData = type === 'pickup' ? setPickupData : setDropoffData;

    // 順序を入れ替え
    const newChildren = [...routeData.children];
    const [removed] = newChildren.splice(sourceIndex, 1);
    newChildren.splice(targetIndex, 0, removed);

    // カスタム順でルート再計算
    if (facilityLocation) {
      setIsCalculating(true);
      try {
        const validChildren = newChildren.filter((tc) => tc.location);
        const newRoute = await calculateCustomRoute(
          facilityLocation,
          validChildren.map((tc) => ({
            location: tc.location!,
            childId: tc.child.id,
            childName: tc.child.name,
          })),
          facilityLocation
        );

        setRouteData({
          children: newChildren,
          route: newRoute,
          isOptimized: false,
          departureTime: routeData.departureTime,
        });
      } finally {
        setIsCalculating(false);
      }
    }
  };

  // ルートセクションをレンダリング
  const renderRouteSection = (
    title: string,
    icon: React.ReactNode,
    data: RouteData,
    setData: React.Dispatch<React.SetStateAction<RouteData>>,
    type: 'pickup' | 'dropoff'
  ) => {
    const arrivalTimes = data.route
      ? calculateArrivalTimes(data.departureTime, data.route.legs)
      : [];

    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <h3 className="font-bold text-gray-800">
                {title}（{data.children.length}名）
              </h3>
              {data.isOptimized ? (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  最短ルート
                </span>
              ) : (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                  カスタム順
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>出発:</span>
                <input
                  type="time"
                  value={data.departureTime}
                  onChange={(e) =>
                    setData({ ...data, departureTime: e.target.value })
                  }
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                />
              </div>
            </div>
          </div>
          {data.route && (
            <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Route className="w-4 h-4" />
                総距離: <strong>{formatDistance(data.route.totalDistance)}</strong>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                所要時間: <strong>{formatDuration(data.route.totalDuration)}</strong>
              </span>
            </div>
          )}
        </div>

        <div className="p-4">
          {data.children.length === 0 ? (
            <p className="text-center text-gray-500 py-4">
              {title === 'お迎え' ? 'お迎え' : 'お送り'}が必要な児童はいません
            </p>
          ) : (
            <div className="space-y-2">
              {/* 出発地点 */}
              <div className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg">
                <div className="w-6 h-6 bg-[#00c4cc] rounded-full flex items-center justify-center text-white text-xs font-bold">
                  S
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-700">施設（出発）</p>
                  <p className="text-xs text-gray-500">{facilitySettings.address || '住所未設定'}</p>
                </div>
                <span className="text-xs text-gray-500">{data.departureTime}</span>
              </div>

              {/* 各地点 */}
              {data.children.map((tc, index) => {
                const schedule = schedules.find(s => s.date === selectedDate && s.childId === tc.child.id);
                const isCompleted = type === 'pickup'
                  ? completionRecords[tc.child.id]?.pickupCompleted
                  : completionRecords[tc.child.id]?.dropoffCompleted;

                return (
                  <div
                    key={tc.child.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index, type)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index, type)}
                    className={`flex items-center gap-3 py-2 px-3 rounded-lg border cursor-move transition-colors ${
                      isCompleted
                        ? 'bg-green-50 border-green-300'
                        : tc.isGeocoded
                        ? 'bg-white border-gray-200 hover:border-[#00c4cc]'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    {/* 完了チェックボックス */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (schedule) {
                          toggleCompletion(tc.child.id, schedule.id, type);
                        }
                      }}
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                        isCompleted
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {isCompleted && <Check className="w-4 h-4" />}
                    </button>
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${isCompleted ? 'text-green-700 line-through' : 'text-gray-800'}`}>
                        {tc.child.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{tc.address}</p>
                      {!tc.isGeocoded && (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          住所が正しく認識できません
                        </p>
                      )}
                    </div>
                    {data.route && data.route.legs[index] && (
                      <div className="text-right">
                        <p className="text-xs font-bold text-[#00c4cc]">
                          {arrivalTimes[index]}着
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {formatDistance(data.route.legs[index].distance)}
                        </p>
                      </div>
                    )}
                    {isCompleted && (
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                    )}
                  </div>
                );
              })}

              {/* 到着地点 */}
              <div className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg">
                <div className="w-6 h-6 bg-[#00c4cc] rounded-full flex items-center justify-center text-white text-xs font-bold">
                  G
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-700">施設（到着）</p>
                  <p className="text-xs text-gray-500">{facilitySettings.address || '住所未設定'}</p>
                </div>
                {arrivalTimes.length > 0 && (
                  <span className="text-xs font-bold text-[#00c4cc]">
                    {arrivalTimes[arrivalTimes.length - 1]}着
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ヘッダー */}
      <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
              <Truck size={24} className="mr-2 text-[#00c4cc]" />
              送迎ルート管理
            </h2>
            <p className="text-gray-500 text-xs mt-1">
              日別の送迎ルートを計算・管理します。ドラッグ&ドロップで順序を変更できます。
            </p>
          </div>

          {/* 日付選択 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="text-center min-w-[140px]">
              <p className="text-lg font-bold text-gray-800">
                {selectedDate.split('-')[1]}/{selectedDate.split('-')[2]}
                <span className="ml-1 text-sm">({getDayOfWeek(selectedDate)})</span>
              </p>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs text-gray-500 border-none bg-transparent cursor-pointer hover:underline"
              />
            </div>
            <button
              onClick={() => changeDate(1)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* 本日の送迎担当者 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#00c4cc]" />
          本日の送迎担当者
        </h3>
        {transportAssignment ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <div className="text-xs font-bold text-blue-700 mb-1">運転手</div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-bold text-gray-800">{transportAssignment.driverName}</span>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <div className="text-xs font-bold text-green-700 mb-1">添乗員</div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-green-600" />
                <span className="text-sm font-bold text-gray-800">{transportAssignment.attendantName}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <span className="text-sm text-yellow-700">
              送迎担当者が未設定です。シフト管理画面から設定してください。
            </span>
          </div>
        )}
      </div>

      {/* 施設情報確認 */}
      {!facilitySettings.address && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-yellow-800">施設住所が設定されていません</p>
            <p className="text-xs text-yellow-700 mt-1">
              送迎ルートを計算するには、施設設定から施設の住所を登録してください。
            </p>
          </div>
        </div>
      )}

      {/* ルート計算ボタン */}
      <div className="flex justify-center">
        <button
          onClick={calculateRoutes}
          disabled={isCalculating || !facilitySettings.address}
          className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCalculating ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              計算中...
            </>
          ) : (
            <>
              <Navigation className="w-5 h-5" />
              ルートを計算
            </>
          )}
        </button>
      </div>

      {/* お迎えルート */}
      {renderRouteSection(
        'お迎え',
        <MapPin className="w-5 h-5 text-blue-500" />,
        pickupData,
        setPickupData,
        'pickup'
      )}

      {/* お送りルート */}
      {renderRouteSection(
        'お送り',
        <MapPin className="w-5 h-5 text-orange-500" />,
        dropoffData,
        setDropoffData,
        'dropoff'
      )}

      {/* 注意事項 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-bold text-gray-700 mb-2">使い方</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>・「ルートを計算」をクリックすると、最短ルートが自動計算されます</li>
          <li>・各地点をドラッグ&ドロップで順序を変更できます</li>
          <li>・順序を変更すると「カスタム順」に切り替わり、指定した順序でルートが計算されます</li>
          <li>・送迎場所の住所は、児童管理から各児童の送迎設定で登録できます</li>
        </ul>
      </div>
    </div>
  );
}
