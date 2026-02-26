/**
 * 施設情報設定ビュー
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Settings, Save, Calendar, Clock, Users, Building2, Plus, Trash2, History, X, MapPin, Truck, Briefcase, UserCheck, AlertTriangle, FileText, ChevronRight, Bell } from 'lucide-react';
import { FacilitySettings, HolidayPeriod, BusinessHoursPeriod, FacilitySettingsHistory, ChangeNotification, CHANGE_NOTIFICATION_TYPE_LABELS, CHANGE_NOTIFICATION_STATUS_CONFIG } from '@/types';
import { useFacilityData } from '@/hooks/useFacilityData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getJapaneseHolidays } from '@/utils/japaneseHolidays';
import { useChangeNotifications, detectSettingsChanges, daysUntilDeadline, getDeadlineColor, getDeadlineBgColor } from '@/hooks/useChangeNotifications';
import ChangeNotificationList from './ChangeNotificationList';
import OperationsReviewWizard from './OperationsReviewWizard';
// タブの種類
type SettingsTab = 'basic' | 'operation' | 'change_notifications';

const SETTINGS_TABS: { id: SettingsTab; label: string; icon: 'building' | 'clock' | 'bell' }[] = [
  { id: 'basic', label: '基本情報', icon: 'building' },
  { id: 'operation', label: '営業・休日', icon: 'clock' },
  { id: 'change_notifications', label: '変更届', icon: 'bell' },
];

const FacilitySettingsView: React.FC = () => {
  const { facilitySettings, updateFacilitySettings, timeSlots, addTimeSlot, updateTimeSlot, deleteTimeSlot } = useFacilityData();
  const { facility } = useAuth();
  const {
    pendingNotifications,
    pendingCount,
    createNotificationsFromChanges,
    updateStatus: updateNotificationStatus,
    notifications: allNotifications,
    refetch: refetchNotifications,
  } = useChangeNotifications();
  const [currentFacilityCode, setCurrentFacilityCode] = useState<string>('');
  const [activeTab, setActiveTab] = useState<SettingsTab>('basic');
  const [showChangeWarning, setShowChangeWarning] = useState(false);
  const [detectedChanges, setDetectedChanges] = useState<{ type: import('@/types').ChangeNotificationType; description: string; oldValue: any; newValue: any }[]>([]);
  const [showPostSaveAlert, setShowPostSaveAlert] = useState(false);
  const settingsSnapshotRef = useRef<FacilitySettings>(facilitySettings);

  // 最新の施設コードを取得
  useEffect(() => {
    const fetchFacilityCode = async () => {
      if (facility?.id) {
        const { data, error } = await supabase
          .from('facilities')
          .select('code')
          .eq('id', facility.id)
          .single();

        if (!error && data) {
          setCurrentFacilityCode(data.code || '');
        }
      }
    };

    fetchFacilityCode();
  }, [facility?.id]);

  const [settings, setSettings] = useState<FacilitySettings>(facilitySettings);
  const [newHoliday, setNewHoliday] = useState('');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyType, setHistoryType] = useState<'business_hours' | 'holidays' | 'all'>('all');
  const [historyData, setHistoryData] = useState<FacilitySettingsHistory[]>([]);
  const [isAddingTimeSlot, setIsAddingTimeSlot] = useState(false);
  const [newTimeSlot, setNewTimeSlot] = useState({ name: '', startTime: '09:00', endTime: '12:00', capacity: 10 });
  const [editingTimeSlotId, setEditingTimeSlotId] = useState<string | null>(null);
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [showOperationsWizard, setShowOperationsWizard] = useState(false);

  // 郵便番号から住所を検索
  const lookupAddress = async () => {
    const postalCode = settings.postalCode?.replace(/-/g, '');
    if (!postalCode || postalCode.length !== 7) {
      alert('7桁の郵便番号を入力してください');
      return;
    }

    setIsAddressLoading(true);
    try {
      const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${postalCode}`);
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        const fullAddress = `${result.address1}${result.address2}${result.address3}`;
        setSettings({
          ...settings,
          address: fullAddress,
        });
      } else {
        alert('住所が見つかりませんでした');
      }
    } catch (error) {
      console.error('Error looking up address:', error);
      alert('住所検索に失敗しました');
    } finally {
      setIsAddressLoading(false);
    }
  };

  // facilitySettingsが更新されたらローカル状態も更新
  useEffect(() => {
    setSettings(facilitySettings);
    settingsSnapshotRef.current = facilitySettings;
  }, [facilitySettings]);

  const weekDays = [
    { value: 0, label: '日' },
    { value: 1, label: '月' },
    { value: 2, label: '火' },
    { value: 3, label: '水' },
    { value: 4, label: '木' },
    { value: 5, label: '金' },
    { value: 6, label: '土' },
  ];

  const handleSave = async () => {
    // Check for changes that require notification
    const changes = detectSettingsChanges(settingsSnapshotRef.current, settings);

    if (changes.length > 0) {
      setDetectedChanges(changes);
      setShowChangeWarning(true);
      return;
    }

    await performSave();
  };

  const performSave = async () => {
    try {
      await updateFacilitySettings(settings, '施設情報を更新しました');

      // If there were detected changes, create notifications
      if (detectedChanges.length > 0) {
        await createNotificationsFromChanges(detectedChanges);
        setDetectedChanges([]);
        setShowPostSaveAlert(true);
      } else {
        alert('施設情報を保存しました');
      }
    } catch (error: any) {
      console.error('Error saving facility settings:', error);
      alert(`施設情報の保存に失敗しました: ${error.message || '不明なエラー'}`);
    }
  };

  const handleConfirmSaveWithNotification = async () => {
    setShowChangeWarning(false);
    await performSave();
  };

  // 履歴を取得
  const fetchHistory = async (type: 'business_hours' | 'holidays' | 'all' = 'all') => {
    if (!facility?.id) return;
    
    try {
      let query = supabase
        .from('facility_settings_history')
        .select('*')
        .eq('facility_id', facility.id)
        .order('changed_at', { ascending: false })
        .limit(50);
      
      if (type !== 'all') {
        query = query.eq('change_type', type);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching history:', error);
        return;
      }
      
      if (data) {
        setHistoryData(data.map((row: any) => ({
          id: row.id,
          facilityId: row.facility_id,
          changeType: row.change_type,
          oldValue: row.old_value,
          newValue: row.new_value,
          changedBy: row.changed_by,
          changedAt: row.changed_at,
          description: row.description,
        })));
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  // 履歴モーダルを開く
  const openHistoryModal = async (type: 'business_hours' | 'holidays' | 'all' = 'all') => {
    setHistoryType(type);
    setIsHistoryModalOpen(true);
    await fetchHistory(type);
  };

  // 期間ごとの営業時間設定を追加
  const addBusinessHoursPeriod = () => {
    const newPeriod: BusinessHoursPeriod = {
      id: `period-${Date.now()}`,
      startDate: '',
      endDate: '',
      businessHours: {
        AM: { start: '09:00', end: '12:00' },
        PM: { start: '13:00', end: '18:00' },
      },
    };
    setSettings({
      ...settings,
      businessHoursPeriods: [...(settings.businessHoursPeriods || []), newPeriod],
    });
  };

  // 期間ごとの営業時間設定を更新
  const updateBusinessHoursPeriod = (periodId: string, updates: Partial<BusinessHoursPeriod>) => {
    setSettings({
      ...settings,
      businessHoursPeriods: (settings.businessHoursPeriods || []).map((period) =>
        period.id === periodId ? { ...period, ...updates } : period
      ),
    });
  };

  // 期間ごとの営業時間設定を削除
  const removeBusinessHoursPeriod = (periodId: string) => {
    setSettings({
      ...settings,
      businessHoursPeriods: (settings.businessHoursPeriods || []).filter(
        (period) => period.id !== periodId
      ),
    });
  };

  const toggleRegularHoliday = (day: number) => {
    const newHolidays = settings.regularHolidays.includes(day)
      ? settings.regularHolidays.filter((d) => d !== day)
      : [...settings.regularHolidays, day];
    setSettings({ ...settings, regularHolidays: newHolidays });
  };

  const toggleIncludeHolidays = () => {
    const newIncludeHolidays = !settings.includeHolidays;
    
    // includeHolidaysフラグを切り替えるだけ
    // isHoliday関数でincludeHolidaysがtrueの場合、isJapaneseHolidayで判定されるため、
    // customHolidaysに追加する必要はない
    setSettings({ 
      ...settings, 
      includeHolidays: newIncludeHolidays,
    });
  };

  const addCustomHoliday = () => {
    if (newHoliday && !settings.customHolidays.includes(newHoliday)) {
      setSettings({
        ...settings,
        customHolidays: [...settings.customHolidays, newHoliday],
      });
      setNewHoliday('');
    }
  };

  const removeCustomHoliday = (date: string) => {
    setSettings({
      ...settings,
      customHolidays: settings.customHolidays.filter((d) => d !== date),
    });
  };

  // 期間ごとの定休日設定を追加
  const addHolidayPeriod = () => {
    const newPeriod: HolidayPeriod = {
      id: `period-${Date.now()}`,
      startDate: '',
      endDate: '',
      regularHolidays: [],
    };
    setSettings({
      ...settings,
      holidayPeriods: [...(settings.holidayPeriods || []), newPeriod],
    });
  };

  // 期間ごとの定休日設定を更新
  const updateHolidayPeriod = (periodId: string, updates: Partial<HolidayPeriod>) => {
    setSettings({
      ...settings,
      holidayPeriods: (settings.holidayPeriods || []).map((period) =>
        period.id === periodId ? { ...period, ...updates } : period
      ),
    });
  };

  // 期間ごとの定休日設定を削除
  const removeHolidayPeriod = (periodId: string) => {
    setSettings({
      ...settings,
      holidayPeriods: (settings.holidayPeriods || []).filter((period) => period.id !== periodId),
    });
  };

  // 期間内の定休日を切り替え
  const togglePeriodHoliday = (periodId: string, day: number) => {
    const period = (settings.holidayPeriods || []).find((p) => p.id === periodId);
    if (!period) return;

    const newHolidays = period.regularHolidays.includes(day)
      ? period.regularHolidays.filter((d) => d !== day)
      : [...period.regularHolidays, day];
    
    updateHolidayPeriod(periodId, { regularHolidays: newHolidays });
  };


  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* ヘッダー */}
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-[#00c4cc]/10 flex items-center justify-center">
                <Settings size={18} className="text-[#00c4cc]" />
              </div>
              施設情報設定
            </h2>
            <p className="text-gray-500 text-sm mt-2">
              定休日、営業時間、受け入れ人数などの施設情報を設定します
            </p>
          </div>
          <button
            onClick={() => setShowOperationsWizard(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#00c4cc] text-white rounded-xl text-sm font-bold hover:bg-[#00b0b8] transition-colors shadow-sm shrink-0"
          >
            <FileText size={16} />
            来月の運営確認
          </button>
        </div>
      </div>

      {/* 変更届アラートバナー */}
      {pendingCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle size={16} className="text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-red-800">変更届の提出が必要です</p>
            <div className="space-y-1 mt-1">
              {pendingNotifications.slice(0, 3).map((n) => {
                const daysLeft = daysUntilDeadline(n.deadline);
                return (
                  <p key={n.id} className="text-xs text-red-700">
                    {CHANGE_NOTIFICATION_TYPE_LABELS[n.changeType]}
                    {' - '}
                    <span className={`font-bold ${getDeadlineColor(daysLeft)}`}>
                      {daysLeft < 0 ? `期限超過（${Math.abs(daysLeft)}日）` : `期限まであと${daysLeft}日（${new Date(n.deadline).toLocaleDateString('ja-JP')}）`}
                    </span>
                  </p>
                );
              })}
            </div>
            <button
              onClick={() => setActiveTab('change_notifications')}
              className="mt-2 text-xs font-bold text-red-700 hover:text-red-900 flex items-center gap-1"
            >
              変更届の管理へ <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* タブナビゲーション */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-1.5">
        <div className="flex gap-1">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              data-tour={tab.id === 'operation' ? 'operation-tab' : undefined}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-bold rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'text-white bg-[#00c4cc] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.icon === 'building' ? <Building2 size={16} /> : tab.icon === 'clock' ? <Clock size={16} /> : <Bell size={16} />}
              {tab.label}
              {tab.id === 'change_notifications' && pendingCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* タブコンテンツ */}
      <div className="space-y-6">
        {/* ========== 基本情報タブ ========== */}
        {activeTab === 'basic' && (
          <>
            {/* 施設名設定 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
          <Building2 size={20} className="mr-2 text-[#00c4cc]" />
          施設名設定
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              施設ID
            </label>
            <div className="bg-gray-50 border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 font-mono">
              {currentFacilityCode || facility?.code || '未設定'}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              この施設IDはログイン時に使用します
            </p>
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              施設名
            </label>
            <input
              type="text"
              data-tour="facility-name"
              value={settings.facilityName || ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  facilityName: e.target.value,
                })
              }
              placeholder="施設名を入力してください"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
            />
            <p className="text-xs text-gray-500 mt-1">
              この施設名はサイドバーの下部に表示されます
            </p>
          </div>
        </div>
      </div>

      {/* 施設住所設定 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
          <MapPin size={20} className="mr-2 text-[#00c4cc]" />
          施設住所設定
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          送迎ルート計算時の起点・終点として使用されます。
        </p>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              郵便番号
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.postalCode || ''}
                onChange={(e) => {
                  // ハイフンを自動的に除去して保存
                  const value = e.target.value.replace(/-/g, '');
                  setSettings({
                    ...settings,
                    postalCode: value,
                  });
                }}
                placeholder="1234567"
                maxLength={7}
                className="w-32 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
              />
              <button
                onClick={lookupAddress}
                disabled={isAddressLoading}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-bold transition-colors disabled:opacity-50"
              >
                {isAddressLoading ? '検索中...' : '住所検索'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              郵便番号を入力して「住所検索」をクリックすると、住所が自動入力されます
            </p>
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              住所
            </label>
            <input
              type="text"
              value={settings.address || ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  address: e.target.value,
                })
              }
              placeholder="東京都○○区1-2-3 ビル名"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
            />
          </div>
        </div>
      </div>

      {/* 送迎設定 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
          <Truck size={20} className="mr-2 text-[#00c4cc]" />
          送迎設定
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          1回の送迎で乗車できる最大人数を設定します。送迎ルート計算時に使用されます。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              お迎え可能人数
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={20}
                value={settings.transportCapacity?.pickup ?? 4}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    transportCapacity: {
                      ...(settings.transportCapacity || { pickup: 4, dropoff: 4 }),
                      pickup: parseInt(e.target.value) || 4,
                    },
                  })
                }
                className="w-20 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
              />
              <span className="text-sm text-gray-600">名</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              朝のお迎え時に1回で乗車できる最大人数
            </p>
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              お送り可能人数
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={20}
                value={settings.transportCapacity?.dropoff ?? 4}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    transportCapacity: {
                      ...(settings.transportCapacity || { pickup: 4, dropoff: 4 }),
                      dropoff: parseInt(e.target.value) || 4,
                    },
                  })
                }
                className="w-20 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
              />
              <span className="text-sm text-gray-600">名</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              帰りのお送り時に1回で乗車できる最大人数
            </p>
          </div>
        </div>
      </div>

      {/* 事業区分設定 */}
      <div data-tour="service-categories" className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
          <Building2 size={20} className="mr-2 text-[#00c4cc]" />
          事業区分
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          この施設が提供するサービスの種類を選択してください。多機能型施設の場合は複数選択できます。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.serviceCategories?.childDevelopmentSupport || false}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  serviceCategories: {
                    ...settings.serviceCategories,
                    childDevelopmentSupport: e.target.checked,
                    afterSchoolDayService: settings.serviceCategories?.afterSchoolDayService || false,
                    nurseryVisitSupport: settings.serviceCategories?.nurseryVisitSupport || false,
                    homeBasedChildSupport: settings.serviceCategories?.homeBasedChildSupport || false,
                  },
                })
              }
              className="w-5 h-5 mt-0.5 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
            />
            <div>
              <span className="font-bold text-gray-800">児童発達支援</span>
              <p className="text-xs text-gray-500 mt-1">未就学児を対象とした発達支援サービス</p>
            </div>
          </label>
          <label className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.serviceCategories?.afterSchoolDayService || false}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  serviceCategories: {
                    ...settings.serviceCategories,
                    childDevelopmentSupport: settings.serviceCategories?.childDevelopmentSupport || false,
                    afterSchoolDayService: e.target.checked,
                    nurseryVisitSupport: settings.serviceCategories?.nurseryVisitSupport || false,
                    homeBasedChildSupport: settings.serviceCategories?.homeBasedChildSupport || false,
                  },
                })
              }
              className="w-5 h-5 mt-0.5 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
            />
            <div>
              <span className="font-bold text-gray-800">放課後等デイサービス</span>
              <p className="text-xs text-gray-500 mt-1">就学児を対象とした放課後支援サービス</p>
            </div>
          </label>
          <label className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.serviceCategories?.nurseryVisitSupport || false}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  serviceCategories: {
                    ...settings.serviceCategories,
                    childDevelopmentSupport: settings.serviceCategories?.childDevelopmentSupport || false,
                    afterSchoolDayService: settings.serviceCategories?.afterSchoolDayService || false,
                    nurseryVisitSupport: e.target.checked,
                    homeBasedChildSupport: settings.serviceCategories?.homeBasedChildSupport || false,
                  },
                })
              }
              className="w-5 h-5 mt-0.5 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
            />
            <div>
              <span className="font-bold text-gray-800">保育所等訪問支援</span>
              <p className="text-xs text-gray-500 mt-1">保育所・学校等への訪問による支援サービス</p>
            </div>
          </label>
          <label className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.serviceCategories?.homeBasedChildSupport || false}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  serviceCategories: {
                    ...settings.serviceCategories,
                    childDevelopmentSupport: settings.serviceCategories?.childDevelopmentSupport || false,
                    afterSchoolDayService: settings.serviceCategories?.afterSchoolDayService || false,
                    nurseryVisitSupport: settings.serviceCategories?.nurseryVisitSupport || false,
                    homeBasedChildSupport: e.target.checked,
                  },
                })
              }
              className="w-5 h-5 mt-0.5 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
            />
            <div>
              <span className="font-bold text-gray-800">居宅訪問型児童発達支援</span>
              <p className="text-xs text-gray-500 mt-1">自宅への訪問による発達支援サービス</p>
            </div>
          </label>
        </div>
      </div>

            {/* 勤怠設定 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
                <UserCheck size={20} className="mr-2 text-[#00c4cc]" />
                勤怠設定
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                スタッフの勤怠管理に使用する設定です。
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-2">
                    1日の所定労働時間
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={12}
                      step={0.5}
                      value={(settings.prescribedWorkingHours ?? 480) / 60}
                      onChange={(e) => {
                        const hours = parseFloat(e.target.value) || 8;
                        setSettings({
                          ...settings,
                          prescribedWorkingHours: Math.round(hours * 60),
                        });
                      }}
                      className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                    />
                    <span className="text-sm text-gray-600">時間</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    勤怠カレンダーで月間の所定労働時間を計算する際に使用されます（例: 7時間の場合、22日勤務で154時間）
                  </p>
                </div>
              </div>
            </div>

            {/* 基本情報の保存ボタン */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm rounded-xl border border-gray-100 shadow-lg p-4 z-10">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">変更内容を保存してください</p>
                <button
                  data-tour="save-basic-button"
                  onClick={handleSave}
                  className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white h-10 px-6 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all min-w-[120px] justify-center"
                >
                  <Save size={16} />
                  基本情報を保存
                </button>
              </div>
            </div>
          </>
        )}

        {/* ========== 営業・休日タブ ========== */}
        {activeTab === 'operation' && (
          <>
            {/* 定休日設定 */}
            <div data-tour="regular-holidays" className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-gray-800 flex items-center">
                  <Calendar size={20} className="mr-2 text-[#00c4cc]" />
                  定休日設定
          </h3>
          <button
            onClick={() => openHistoryModal('holidays')}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100"
          >
            <History size={14} />
            変更履歴を見る
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-3">
              デフォルトの週次定休日（期間指定がない場合）
            </label>
            <div className="flex flex-wrap gap-2">
              {weekDays.map((day) => (
                <button
                  key={day.value}
                  onClick={() => toggleRegularHoliday(day.value)}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${
                    settings.regularHolidays.includes(day.value)
                      ? 'bg-red-100 text-red-700 border-2 border-red-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold text-gray-700 block">
                期間ごとの定休日設定
              </label>
              <button
                onClick={addHolidayPeriod}
                className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center transition-colors"
              >
                <Plus size={14} className="mr-1" />
                期間を追加
              </button>
            </div>
            <div className="space-y-4">
              {(settings.holidayPeriods || []).map((period) => (
                <div
                  key={period.id}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-gray-600">期間設定</span>
                    <button
                      onClick={() => removeHolidayPeriod(period.id)}
                      className="text-red-600 hover:text-red-800 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">
                        開始日
                      </label>
                      <input
                        type="date"
                        value={period.startDate}
                        onChange={(e) =>
                          updateHolidayPeriod(period.id, { startDate: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">
                        終了日（空欄の場合は無期限）
                      </label>
                      <input
                        type="date"
                        value={period.endDate}
                        onChange={(e) =>
                          updateHolidayPeriod(period.id, { endDate: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-2">
                      この期間の定休日
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {weekDays.map((day) => (
                        <button
                          key={day.value}
                          onClick={() => togglePeriodHoliday(period.id, day.value)}
                          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                            period.regularHolidays.includes(day.value)
                              ? 'bg-red-100 text-red-700 border-2 border-red-300'
                              : 'bg-white text-gray-700 hover:bg-gray-100 border-2 border-transparent'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {(settings.holidayPeriods || []).length === 0 && (
                <p className="text-xs text-gray-500 text-center py-4">
                  期間ごとの定休日設定がありません。期間を追加して設定してください。
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-gray-700 block mb-3">
              祝日設定
            </label>
            <div className="mb-4">
              <button
                onClick={toggleIncludeHolidays}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${
                  settings.includeHolidays
                    ? 'bg-red-100 text-red-700 border-2 border-red-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent'
                }`}
              >
                祝日を休業日に含める
              </button>
              <p className="text-xs text-gray-500 mt-2">
                選択すると、一般的な祝日が自動的に休業日として追加されます
              </p>
            </div>
            <label className="text-sm font-bold text-gray-700 block mb-3">
              カスタム休業日（追加の休業日など）
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="date"
                value={newHoliday}
                onChange={(e) => setNewHoliday(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
              />
              <button
                onClick={addCustomHoliday}
                className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white px-4 py-2 rounded-md text-sm font-bold transition-colors"
              >
                追加
              </button>
            </div>
            {settings.customHolidays.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {settings.customHolidays.map((date) => (
                  <div
                    key={date}
                    className="bg-red-50 border border-red-200 rounded-md px-3 py-1.5 flex items-center space-x-2"
                  >
                    <span className="text-sm text-red-700 font-bold">{date}</span>
                    <button
                      onClick={() => removeCustomHoliday(date)}
                      className="text-red-600 hover:text-red-800 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 営業時間・サービス提供時間設定 */}
      <div data-tour="business-hours" className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-gray-800 flex items-center">
            <Clock size={20} className="mr-2 text-[#00c4cc]" />
            営業時間・サービス提供時間
          </h3>
          <button
            onClick={() => openHistoryModal('business_hours')}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100"
          >
            <History size={14} />
            変更履歴
          </button>
        </div>

        {/* コンパクトな曜日別設定 */}
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 0].map((dayValue) => {
            const day = weekDays.find(d => d.value === dayValue)!;
            const dayOverride = settings.flexibleBusinessHours?.dayOverrides?.[dayValue];
            const isClosed = dayOverride?.isClosed || false;
            const startTime = dayOverride?.start || settings.flexibleBusinessHours?.default?.start || '09:00';
            const endTime = dayOverride?.end || settings.flexibleBusinessHours?.default?.end || '18:00';

            return (
              <div
                key={dayValue}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  isClosed ? 'bg-gray-50 border-gray-200' : 'bg-[#00c4cc]/5 border-[#00c4cc]/20'
                }`}
              >
                {/* 曜日 */}
                <div className={`w-8 text-center font-bold ${
                  dayValue === 0 ? 'text-red-500' : dayValue === 6 ? 'text-blue-500' : 'text-gray-700'
                }`}>
                  {day.label}
                </div>

                {/* 営業/休業トグル */}
                <button
                  onClick={() => {
                    const newOverrides = { ...(settings.flexibleBusinessHours?.dayOverrides || {}) };
                    if (isClosed) {
                      newOverrides[dayValue] = {
                        start: settings.flexibleBusinessHours?.default?.start || '09:00',
                        end: settings.flexibleBusinessHours?.default?.end || '18:00',
                        isClosed: false,
                      };
                    } else {
                      newOverrides[dayValue] = { isClosed: true };
                    }
                    setSettings({
                      ...settings,
                      flexibleBusinessHours: {
                        ...settings.flexibleBusinessHours,
                        default: settings.flexibleBusinessHours?.default || { start: '09:00', end: '18:00' },
                        dayOverrides: newOverrides,
                      },
                    });
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                    isClosed
                      ? 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                      : 'bg-[#00c4cc] text-white hover:bg-[#00b0b8]'
                  }`}
                >
                  {isClosed ? '休業' : '営業'}
                </button>

                {/* 時間設定 - セレクトボックス */}
                {!isClosed && (
                  <div className="flex items-center gap-2 flex-1">
                    <select
                      value={startTime}
                      onChange={(e) => {
                        const newOverrides = { ...(settings.flexibleBusinessHours?.dayOverrides || {}) };
                        newOverrides[dayValue] = {
                          start: e.target.value,
                          end: dayOverride?.end || settings.flexibleBusinessHours?.default?.end || '18:00',
                          isClosed: false,
                        };
                        setSettings({
                          ...settings,
                          flexibleBusinessHours: {
                            ...settings.flexibleBusinessHours,
                            default: settings.flexibleBusinessHours?.default || { start: '09:00', end: '18:00' },
                            dayOverrides: newOverrides,
                          },
                        });
                      }}
                      className="border border-gray-200 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-[#00c4cc] cursor-pointer"
                    >
                      {Array.from({ length: 34 }, (_, i) => {
                        const h = Math.floor(i / 2) + 6;
                        const m = (i % 2) * 30;
                        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                        return <option key={time} value={time}>{time}</option>;
                      })}
                    </select>
                    <span className="text-gray-400">〜</span>
                    <select
                      value={endTime}
                      onChange={(e) => {
                        const newOverrides = { ...(settings.flexibleBusinessHours?.dayOverrides || {}) };
                        newOverrides[dayValue] = {
                          start: dayOverride?.start || settings.flexibleBusinessHours?.default?.start || '09:00',
                          end: e.target.value,
                          isClosed: false,
                        };
                        setSettings({
                          ...settings,
                          flexibleBusinessHours: {
                            ...settings.flexibleBusinessHours,
                            default: settings.flexibleBusinessHours?.default || { start: '09:00', end: '18:00' },
                            dayOverrides: newOverrides,
                          },
                        });
                      }}
                      className="border border-gray-200 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-[#00c4cc] cursor-pointer"
                    >
                      {Array.from({ length: 34 }, (_, i) => {
                        const h = Math.floor(i / 2) + 6;
                        const m = (i % 2) * 30;
                        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                        return <option key={time} value={time}>{time}</option>;
                      })}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-500 mt-4">
          サービス提供時間は通常、営業時間と同じです。異なる場合は別途お問い合わせください。
        </p>
      </div>

      {/* 時間枠設定 */}
      <div data-tour="timeslot-section" className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
          <Clock size={20} className="mr-2 text-[#00c4cc]" />
          利用時間枠設定
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          午前・午後以外の時間枠も設定できます。放課後デイなど複数の時間区分がある施設向けの設定です。
        </p>

        {/* 既存の時間枠一覧 */}
        <div className="space-y-3 mb-4">
          {timeSlots.map((slot) => (
            <div
              key={slot.id}
              className="border border-gray-200 rounded-lg p-4 bg-gray-50"
            >
              {editingTimeSlotId === slot.id ? (
                // 編集モード
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">枠名</label>
                      <input
                        type="text"
                        value={slot.name}
                        onChange={(e) => updateTimeSlot(slot.id, { name: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">開始時間</label>
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateTimeSlot(slot.id, { startTime: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">終了時間</label>
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateTimeSlot(slot.id, { endTime: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">定員</label>
                      <input
                        type="number"
                        min="1"
                        value={slot.capacity}
                        onChange={(e) => updateTimeSlot(slot.id, { capacity: parseInt(e.target.value) || 10 })}
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingTimeSlotId(null)}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                      完了
                    </button>
                  </div>
                </div>
              ) : (
                // 表示モード
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-gray-800">{slot.name}</span>
                    <span className="text-sm text-gray-500">
                      {slot.startTime} - {slot.endTime}
                    </span>
                    <span className="text-sm text-gray-500">
                      定員: {slot.capacity}名
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingTimeSlotId(slot.id)}
                      className="text-sm text-[#00c4cc] hover:underline"
                    >
                      編集
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`「${slot.name}」を削除しますか？`)) {
                          await deleteTimeSlot(slot.id);
                        }
                      }}
                      className="text-sm text-red-500 hover:underline"
                    >
                      削除
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 新規追加フォーム */}
        {isAddingTimeSlot ? (
          <div className="border border-[#00c4cc] rounded-lg p-4 bg-[#00c4cc]/5">
            <h4 className="font-bold text-sm text-gray-700 mb-3">新しい時間枠を追加</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">枠名</label>
                <input
                  type="text"
                  value={newTimeSlot.name}
                  onChange={(e) => setNewTimeSlot({ ...newTimeSlot, name: e.target.value })}
                  placeholder="例: 放課後"
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">開始時間</label>
                <input
                  type="time"
                  value={newTimeSlot.startTime}
                  onChange={(e) => setNewTimeSlot({ ...newTimeSlot, startTime: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">終了時間</label>
                <input
                  type="time"
                  value={newTimeSlot.endTime}
                  onChange={(e) => setNewTimeSlot({ ...newTimeSlot, endTime: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">定員</label>
                <input
                  type="number"
                  min="1"
                  value={newTimeSlot.capacity}
                  onChange={(e) => setNewTimeSlot({ ...newTimeSlot, capacity: parseInt(e.target.value) || 10 })}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setIsAddingTimeSlot(false);
                  setNewTimeSlot({ name: '', startTime: '09:00', endTime: '12:00', capacity: 10 });
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={async () => {
                  if (!newTimeSlot.name.trim()) {
                    alert('枠名を入力してください');
                    return;
                  }
                  try {
                    await addTimeSlot({
                      name: newTimeSlot.name,
                      startTime: newTimeSlot.startTime,
                      endTime: newTimeSlot.endTime,
                      capacity: newTimeSlot.capacity,
                      displayOrder: timeSlots.length + 1,
                    });
                    setIsAddingTimeSlot(false);
                    setNewTimeSlot({ name: '', startTime: '09:00', endTime: '12:00', capacity: 10 });
                  } catch (error) {
                    alert('時間枠の追加に失敗しました');
                  }
                }}
                className="px-4 py-2 text-sm bg-[#00c4cc] text-white rounded font-bold hover:bg-[#00b0b8] transition-colors"
              >
                追加
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingTimeSlot(true)}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-[#00c4cc] hover:text-[#00c4cc] transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            時間枠を追加
          </button>
        )}
      </div>

            {/* 営業設定の保存ボタン */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm rounded-xl border border-gray-100 shadow-lg p-4 z-10">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">変更内容を保存してください</p>
                <button
                  data-tour="save-operation-button"
                  onClick={handleSave}
                  className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white h-10 px-6 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all min-w-[120px] justify-center"
                >
                  <Save size={16} />
                  営業設定を保存
                </button>
              </div>
            </div>
          </>
        )}

        {/* ========== 変更届タブ ========== */}
        {activeTab === 'change_notifications' && (
          <ChangeNotificationList
            notifications={allNotifications}
            onUpdateStatus={updateNotificationStatus}
            onRefetch={refetchNotifications}
          />
        )}
      </div>

      {/* 変更警告ダイアログ */}
      {showChangeWarning && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">変更届の提出が必要です</h3>
                  <p className="text-sm text-gray-500">この変更には行政への届出が必要です</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {detectedChanges.map((change, i) => (
                <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm font-bold text-amber-800">
                    {CHANGE_NOTIFICATION_TYPE_LABELS[change.type as keyof typeof CHANGE_NOTIFICATION_TYPE_LABELS] || change.type}
                  </p>
                  <p className="text-xs text-amber-700 mt-1">{change.description}</p>
                </div>
              ))}
              <p className="text-xs text-gray-500">
                保存すると、変更届の管理画面に提出期限付きの通知が自動作成されます。
              </p>
            </div>
            <div className="p-5 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowChangeWarning(false);
                  setDetectedChanges([]);
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmSaveWithNotification}
                className="px-6 py-2 text-sm bg-[#00c4cc] text-white rounded-lg font-bold hover:bg-[#00b0b8] transition-colors"
              >
                保存して変更届を作成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 保存後アラート */}
      {showPostSaveAlert && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <FileText size={24} className="text-green-600" />
              </div>
              <h3 className="font-bold text-lg text-gray-800 mb-2">施設情報を保存しました</h3>
              <p className="text-sm text-gray-500 mb-4">
                変更届の通知が作成されました。期限内に届出を完了してください。
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowPostSaveAlert(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  閉じる
                </button>
                <button
                  onClick={() => {
                    setShowPostSaveAlert(false);
                    setActiveTab('change_notifications');
                  }}
                  className="px-6 py-2 text-sm bg-[#00c4cc] text-white rounded-lg font-bold hover:bg-[#00b0b8] transition-colors flex items-center gap-2"
                >
                  <FileText size={14} />
                  変更届を管理
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 月次運営確認ウィザード */}
      <OperationsReviewWizard
        isOpen={showOperationsWizard}
        onClose={() => setShowOperationsWizard(false)}
        onComplete={() => {
          refetchNotifications();
        }}
      />

      {/* 履歴モーダル */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[80vh] overflow-hidden shadow-2xl border border-gray-100">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800">変更履歴</h3>
              <div className="flex items-center gap-2">
                <select
                  value={historyType}
                  onChange={(e) => {
                    const type = e.target.value as 'business_hours' | 'holidays' | 'all';
                    setHistoryType(type);
                    fetchHistory(type);
                  }}
                  className="text-xs border border-gray-300 rounded-md px-2 py-1"
                >
                  <option value="all">全て</option>
                  <option value="business_hours">営業時間</option>
                  <option value="holidays">定休日</option>
                </select>
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-4">
              {historyData.length === 0 ? (
                <div className="text-center text-gray-500 py-8">履歴がありません</div>
              ) : (
                <div className="space-y-4">
                  {historyData.map((history) => (
                    <div
                      key={history.id}
                      className="border border-gray-200 rounded-md p-4 bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-600">
                            {history.changeType === 'business_hours'
                              ? '営業時間'
                              : history.changeType === 'holidays'
                              ? '定休日'
                              : '全て'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(history.changedAt).toLocaleString('ja-JP')}
                          </span>
                        </div>
                      </div>
                      {history.description && (
                        <p className="text-xs text-gray-600 mb-2">{history.description}</p>
                      )}
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <div className="font-bold text-gray-700 mb-1">変更前</div>
                          <pre className="bg-white p-2 rounded border border-gray-200 overflow-x-auto text-[10px]">
                            {JSON.stringify(history.oldValue, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <div className="font-bold text-gray-700 mb-1">変更後</div>
                          <pre className="bg-white p-2 rounded border border-gray-200 overflow-x-auto text-[10px]">
                            {JSON.stringify(history.newValue, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacilitySettingsView;

