/**
 * 個人スタッフ用ダッシュボード
 * 「自分のキャリアの価値を確認する場所」であり、「今日の業務をスムーズに始めるためのショートカット」
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Briefcase,
  Award,
  Clock,
  FileText,
  Bell,
  Settings,
  LogOut,
  CheckCircle,
  AlertCircle,
  Calendar,
  MapPin,
  User,
  Building2,
  PlayCircle,
  PauseCircle,
  Coffee,
  Edit,
  Upload,
  Camera,
  FileCheck,
  Plus,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { User as UserType, EmploymentRecord, FacilitySettings } from '@/types';
import { getJapaneseHolidays, isJapaneseHoliday } from '@/utils/japaneseHolidays';

export default function StaffDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserType | null>(null);
  const [activeEmployments, setActiveEmployments] = useState<EmploymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFacility, setCurrentFacility] = useState<EmploymentRecord | null>(null);
  const [timeTrackingStatus, setTimeTrackingStatus] = useState<'idle' | 'working' | 'break'>('idle');
  const [activeTab, setActiveTab] = useState<'home' | 'career' | 'work' | 'settings'>('home');
  const [showAttendanceCalendar, setShowAttendanceCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [remainingPaidLeave, setRemainingPaidLeave] = useState(10); // 残有給日数
  const [paidLeaveRequests, setPaidLeaveRequests] = useState<Array<{
    id: string;
    date: string;
    type: 'paid_leave' | 'half_paid_leave' | 'special_leave';
    status: 'pending' | 'approved' | 'rejected';
  }>>([]);
  const [showPaidLeaveModal, setShowPaidLeaveModal] = useState(false);
  const [selectedDateForPaidLeave, setSelectedDateForPaidLeave] = useState<string>('');
  const [paidLeaveFormData, setPaidLeaveFormData] = useState<{
    date: string;
    type: 'paid_leave' | 'half_paid_leave' | 'special_leave';
    reason?: string;
  }>({
    date: '',
    type: 'paid_leave',
    reason: '',
  });
  const [facilitySettings, setFacilitySettings] = useState<FacilitySettings | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<{
    startTime?: string;
    endTime?: string;
    breakStartTime?: string;
    breakEndTime?: string;
    totalWorkMinutes: number;
  }>({ totalWorkMinutes: 0 });
  
  // キャリアタブ用の状態
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    birthDate: '',
    address: '',
    phone: '',
    gender: '',
    education: '',
    hasSpouse: false, // 配偶者の有無
    spouseName: '',
    myNumber: '',
    // 基礎年金番号
    basicPensionSymbol: '',
    basicPensionNumber: '',
    // 雇用保険
    employmentInsuranceStatus: 'joined' as 'joined' | 'not_joined' | 'first_time',
    employmentInsuranceNumber: '',
    previousRetirementDate: '',
    previousName: '',
    // 社会保険
    socialInsuranceStatus: 'joined' as 'joined' | 'not_joined',
    // 扶養家族
    hasDependents: false,
    dependentCount: 0,
    dependents: [] as Array<{
      id: string;
      name: string;
      furigana: string;
      relationship: string;
      birthDate: string;
      gender: 'male' | 'female';
      occupation: string;
      annualIncome: string;
      notWorking: boolean;
      notWorkingReason: string;
      myNumber: string;
      separateAddress?: string;
    }>,
  });
  const [editingAttendanceDate, setEditingAttendanceDate] = useState<string | null>(null);
  const [manualAttendanceData, setManualAttendanceData] = useState<{
    startTime: string;
    endTime: string;
    breakStartTime: string;
    breakEndTime: string;
    reason: string;
  }>({
    startTime: '',
    endTime: '',
    breakStartTime: '12:00',
    breakEndTime: '13:00',
    reason: '',
  });
  const [educationHistory, setEducationHistory] = useState<Array<{
    id: string;
    schoolName: string;
    graduationDate: string;
    degree: string;
  }>>([]);
  const [qualifications, setQualifications] = useState<Array<{
    id: string;
    name: string;
    imageUrl?: string;
    status: 'approved' | 'pending' | 'not_registered';
  }>>([]);
  const [experienceRecords, setExperienceRecords] = useState<Array<{
    id: string;
    facilityName: string;
    startDate: string;
    endDate?: string;
    pdfUrl?: string;
    certificateStatus: 'approved' | 'pending' | 'not_requested';
  }>>([]);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        // セッションからユーザー情報を取得
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
          router.push('/login');
          return;
        }

        const userData = JSON.parse(storedUser);
        setUser(userData);
        setProfileData({
          name: userData.name || '',
          email: userData.email || '',
          birthDate: userData.birth_date || '',
          address: userData.address || '',
          phone: userData.phone || '',
          gender: userData.gender || '',
          education: userData.education || '',
          hasSpouse: !!userData.spouse_name, // 配偶者氏名がある場合はtrue
          spouseName: userData.spouse_name || '',
          myNumber: userData.my_number || '',
          basicPensionSymbol: userData.basic_pension_symbol || '',
          basicPensionNumber: userData.basic_pension_number || '',
          employmentInsuranceStatus: userData.employment_insurance_status || 'joined',
          employmentInsuranceNumber: userData.employment_insurance_number || '',
          previousRetirementDate: userData.previous_retirement_date || '',
          previousName: userData.previous_name || '',
          socialInsuranceStatus: userData.social_insurance_status || 'joined',
          hasDependents: userData.has_dependents || false,
          dependentCount: userData.dependent_count || 0,
          dependents: userData.dependents || [],
        });

        // アクティブな所属関係を取得
        const { data: employments, error } = await supabase
          .from('employment_records')
          .select(`
            *,
            facilities:facility_id (
              id,
              name,
              code
            )
          `)
          .eq('user_id', userData.id)
          .is('end_date', null)
          .order('start_date', { ascending: false });

        if (error) {
          console.error('所属関係取得エラー:', error);
        } else if (employments && employments.length > 0) {
          // SupabaseのJOIN結果を処理
          const processedEmployments = employments.map((emp: any) => ({
            ...emp,
            facilityId: emp.facility_id || emp.facilityId, // スネークケースとキャメルケースの両方に対応
            facilityName: emp.facilities?.name || emp.facilityName,
            facilityCode: emp.facilities?.code || emp.facilityCode,
          }));
          setActiveEmployments(processedEmployments as any);
          setCurrentFacility(processedEmployments[0] as any);
          
          // 施設設定を取得
          // facility_idを取得（スネークケースとキャメルケースの両方に対応）
          const targetFacilityId = processedEmployments[0]?.facility_id || processedEmployments[0]?.facilityId;
          
          console.log('=== 施設設定取得デバッグ ===');
          console.log('processedEmployments[0]:', processedEmployments[0]);
          console.log('targetFacilityId:', targetFacilityId);
          console.log('facility_id (snake_case):', processedEmployments[0]?.facility_id);
          console.log('facilityId (camelCase):', processedEmployments[0]?.facilityId);
          
          if (targetFacilityId) {
            const { data: settingsData, error: settingsError } = await supabase
              .from('facility_settings')
              .select('*')
              .eq('facility_id', targetFacilityId)
              .single();
            
            console.log('施設設定取得結果:', { settingsData, settingsError });
            
            if (!settingsError && settingsData) {
              // デバッグ: 取得したデータを確認
              console.log('施設設定データ:', settingsData);
              console.log('holiday_periods:', settingsData.holiday_periods);
              console.log('custom_holidays:', settingsData.custom_holidays);
              console.log('regular_holidays:', settingsData.regular_holidays);
              
              // holiday_periodsの処理（JSONBとして保存されている）
              // SupabaseクライアントはJSONBを自動的にパースしてくれるが、念のため処理
              let holidayPeriods: any[] = [];
              if (settingsData.holiday_periods) {
                if (Array.isArray(settingsData.holiday_periods)) {
                  // 既に配列として取得できている場合
                  holidayPeriods = settingsData.holiday_periods;
                } else if (typeof settingsData.holiday_periods === 'object' && settingsData.holiday_periods !== null) {
                  // オブジェクトの場合（JSONBがオブジェクトとして返された場合）
                  // これは通常起こらないが、念のため
                  holidayPeriods = [settingsData.holiday_periods];
                } else if (typeof settingsData.holiday_periods === 'string') {
                  // 文字列の場合（JSON文字列として保存されている場合）
                  try {
                    const parsed = JSON.parse(settingsData.holiday_periods);
                    holidayPeriods = Array.isArray(parsed) ? parsed : [];
                  } catch (e) {
                    console.error('holiday_periodsのパースエラー:', e);
                    holidayPeriods = [];
                  }
                }
              }
              
              // custom_holidaysの処理（TEXT[]として保存されている）
              // PostgreSQLの配列型はSupabaseクライアントが自動的に配列として返す
              let customHolidays: string[] = [];
              if (settingsData.custom_holidays) {
                if (Array.isArray(settingsData.custom_holidays)) {
                  // 既に配列として取得できている場合
                  customHolidays = settingsData.custom_holidays.filter((d: any) => d && typeof d === 'string');
                } else if (typeof settingsData.custom_holidays === 'string') {
                  // 文字列の場合（JSON文字列として保存されている場合）
                  try {
                    const parsed = JSON.parse(settingsData.custom_holidays);
                    customHolidays = Array.isArray(parsed) ? parsed.filter((d: any) => d && typeof d === 'string') : [];
                  } catch (e) {
                    console.error('custom_holidaysのパースエラー:', e);
                    customHolidays = [];
                  }
                }
              }
              
              console.log('処理後のholidayPeriods:', holidayPeriods);
              console.log('処理後のcustomHolidays:', customHolidays);
              
              setFacilitySettings({
                id: settingsData.id,
                facilityId: settingsData.facility_id,
                facilityName: settingsData.facility_name || '',
                regularHolidays: settingsData.regular_holidays || [0],
                holidayPeriods: holidayPeriods,
                customHolidays: customHolidays,
                includeHolidays: settingsData.include_holidays || false,
                businessHours: settingsData.business_hours || {
                  AM: { start: '09:00', end: '12:00' },
                  PM: { start: '13:00', end: '18:00' },
                },
                capacity: settingsData.capacity || {
                  AM: 10,
                  PM: 10,
                },
                createdAt: settingsData.created_at || new Date().toISOString(),
                updatedAt: settingsData.updated_at || new Date().toISOString(),
              });
            }
          }
        }
      } catch (err) {
        console.error('データ読み込みエラー:', err);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [router]);

  // 本日の勤怠データを読み込む
  useEffect(() => {
    if (!user || !currentFacility) return;

    const loadTodayAttendance = () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const records = JSON.parse(localStorage.getItem('attendance_records') || '[]');
        const todayRecords = records.filter((r: any) => 
          r.user_id === user.id && 
          r.facility_id === currentFacility?.facilityId &&
          r.date === today
        );

        let startTime: string | undefined;
        let endTime: string | undefined;
        let breakStartTime: string | undefined;
        let breakEndTime: string | undefined;
        let currentStatus: 'idle' | 'working' | 'break' = 'idle';

        // 最新の打刻記録からステータスを判定
        const sortedRecords = todayRecords.sort((a: any, b: any) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        for (const record of sortedRecords) {
          if (record.type === 'start' && !startTime) {
            startTime = record.time;
            currentStatus = 'working';
          } else if (record.type === 'end' && !endTime) {
            endTime = record.time;
            currentStatus = 'idle';
          } else if (record.type === 'break_start' && !breakStartTime) {
            breakStartTime = record.time;
            currentStatus = 'break';
          } else if (record.type === 'break_end' && !breakEndTime) {
            breakEndTime = record.time;
            currentStatus = 'working';
          }
        }

        // 勤務時間を計算
        let totalMinutes = 0;
        if (startTime) {
          const start = new Date(`${today}T${startTime}:00`);
          const end = endTime ? new Date(`${today}T${endTime}:00`) : new Date();
          const workMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
          
          // 休憩時間を差し引く
          if (breakStartTime && breakEndTime) {
            const breakStart = new Date(`${today}T${breakStartTime}:00`);
            const breakEnd = new Date(`${today}T${breakEndTime}:00`);
            const breakMinutes = Math.floor((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60));
            totalMinutes = Math.max(0, workMinutes - breakMinutes);
          } else if (breakStartTime && !breakEndTime) {
            // 休憩中の場合、休憩開始時刻までを計算
            const breakStart = new Date(`${today}T${breakStartTime}:00`);
            const workMinutesBeforeBreak = Math.floor((breakStart.getTime() - start.getTime()) / (1000 * 60));
            totalMinutes = workMinutesBeforeBreak;
          } else {
            totalMinutes = workMinutes;
          }
        }

        setTodayAttendance({
          startTime,
          endTime,
          breakStartTime,
          breakEndTime,
          totalWorkMinutes: totalMinutes,
        });
        setTimeTrackingStatus(currentStatus);
      } catch (err) {
        console.error('勤怠データ読み込みエラー:', err);
      }
    };

    loadTodayAttendance();
    // 定期的に更新（1分ごと）
    const interval = setInterval(loadTodayAttendance, 60000);
    return () => clearInterval(interval);
  }, [user, currentFacility]);

  // ログアウト処理
  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  // 打刻処理
  const handleTimeTracking = async (type: 'start' | 'end' | 'break_start' | 'break_end') => {
    if (!user || !currentFacility) return;
    
    try {
      const now = new Date();
      const timeString = now.toTimeString().slice(0, 5);
      
      // 打刻データを保存（暫定：後でattendance_recordsテーブルを作成）
      // 現時点ではlocalStorageに保存（後でDBに移行）
      const attendanceData = {
        user_id: user.id,
        facility_id: currentFacility.facilityId,
        date: now.toISOString().split('T')[0],
        type,
        time: timeString,
        timestamp: now.toISOString(),
      };
      
      const existingRecords = JSON.parse(localStorage.getItem('attendance_records') || '[]');
      existingRecords.push(attendanceData);
      localStorage.setItem('attendance_records', JSON.stringify(existingRecords));
      
      // ステータス更新
      if (type === 'start') {
        setTimeTrackingStatus('working');
      } else if (type === 'end') {
        setTimeTrackingStatus('idle');
      } else if (type === 'break_start') {
        setTimeTrackingStatus('break');
      } else if (type === 'break_end') {
        setTimeTrackingStatus('working');
      }

      // 本日の勤怠データを再読み込み
      const today = now.toISOString().split('T')[0];
      const records = JSON.parse(localStorage.getItem('attendance_records') || '[]');
      const todayRecords = records.filter((r: any) => 
        r.user_id === user.id && 
        r.facility_id === currentFacility.facilityId &&
        r.date === today
      );

      let startTime: string | undefined;
      let endTime: string | undefined;
      let breakStartTime: string | undefined;
      let breakEndTime: string | undefined;

      for (const record of todayRecords) {
        if (record.type === 'start') startTime = record.time;
        if (record.type === 'end') endTime = record.time;
        if (record.type === 'break_start') breakStartTime = record.time;
        if (record.type === 'break_end') breakEndTime = record.time;
      }

      // 勤務時間を計算
      let totalMinutes = 0;
      if (startTime) {
        const start = new Date(`${today}T${startTime}:00`);
        const end = endTime ? new Date(`${today}T${endTime}:00`) : new Date();
        const workMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
        
        if (breakStartTime && breakEndTime) {
          const breakStart = new Date(`${today}T${breakStartTime}:00`);
          const breakEnd = new Date(`${today}T${breakEndTime}:00`);
          const breakMinutes = Math.floor((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60));
          totalMinutes = Math.max(0, workMinutes - breakMinutes);
        } else if (breakStartTime && !breakEndTime) {
          const breakStart = new Date(`${today}T${breakStartTime}:00`);
          const workMinutesBeforeBreak = Math.floor((breakStart.getTime() - start.getTime()) / (1000 * 60));
          totalMinutes = workMinutesBeforeBreak;
        } else {
          totalMinutes = workMinutes;
        }
      }

      setTodayAttendance({
        startTime,
        endTime,
        breakStartTime,
        breakEndTime,
        totalWorkMinutes: totalMinutes,
      });
      
      // TODO: 後でattendance_recordsテーブルに保存する処理を追加
    } catch (err) {
      console.error('打刻エラー:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー部分（ロゴとPersonalラベル） */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src="/logo-cropped-center.png" alt="co-shien" width={120} height={32} className="h-8 w-auto object-contain" priority />
              <span className="text-xs font-bold px-2 py-1 rounded bg-[#8b5cf6] text-white">
                Personal
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* ① アイデンティティ・エリア */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-[#8b5cf6] rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{user.name}</h1>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
            </div>
          </div>

          {/* 所属情報 */}
          {currentFacility && (
            <div className="bg-[#8b5cf6]/10 rounded-lg p-4 border border-[#8b5cf6]/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#8b5cf6]" />
                  <div>
                    <span className="font-bold text-gray-800 block">
                      {currentFacility.facilityName || '事業所'}
                    </span>
                    <span className="text-sm text-gray-600">
                      {currentFacility.role} / {currentFacility.employmentType}
                    </span>
                  </div>
                </div>
                {activeEmployments.length > 1 && (
                  <button className="text-sm text-[#8b5cf6] hover:underline">
                    切り替え
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 認証バッジ */}
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              本人確認済
            </span>
            {/* 資格認証バッジは後で追加 */}
          </div>
        </div>
      </div>

      {/* タブコンテンツ */}
      {activeTab === 'home' && (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* ① 業務管理ツール（最優先） */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#8b5cf6]" />
            業務管理ツール
          </h2>
          
          <div className="space-y-4">
            {/* 本日の勤務ステータス表示 */}
            <div className="bg-[#8b5cf6]/5 rounded-lg p-4 border border-[#8b5cf6]/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-700">本日の勤務状況</span>
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  timeTrackingStatus === 'idle' 
                    ? 'bg-gray-200 text-gray-700' 
                    : timeTrackingStatus === 'working'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {timeTrackingStatus === 'idle' ? '未出勤' : timeTrackingStatus === 'working' ? '勤務中' : '休憩中'}
                </span>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                {todayAttendance.startTime && (
                  <div className="flex items-center justify-between">
                    <span>始業時刻</span>
                    <span className="font-bold">{todayAttendance.startTime}</span>
                  </div>
                )}
                {todayAttendance.breakStartTime && (
                  <div className="flex items-center justify-between">
                    <span>休憩開始</span>
                    <span className="font-bold">{todayAttendance.breakStartTime}</span>
                  </div>
                )}
                {todayAttendance.breakEndTime && (
                  <div className="flex items-center justify-between">
                    <span>休憩終了</span>
                    <span className="font-bold">{todayAttendance.breakEndTime}</span>
                  </div>
                )}
                {todayAttendance.endTime && (
                  <div className="flex items-center justify-between">
                    <span>退勤時刻</span>
                    <span className="font-bold">{todayAttendance.endTime}</span>
                  </div>
                )}
                {todayAttendance.startTime && (
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 mt-2">
                    <span className="font-bold text-gray-800">本日の勤務時間</span>
                    <span className="font-bold text-[#8b5cf6]">
                      {Math.floor(todayAttendance.totalWorkMinutes / 60)}時間{todayAttendance.totalWorkMinutes % 60}分
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 打刻セクション */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-bold text-gray-700 mb-3">打刻</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => handleTimeTracking('start')}
                  disabled={timeTrackingStatus === 'working' || timeTrackingStatus === 'break' || !!todayAttendance.startTime}
                  className="flex flex-col items-center justify-center p-3 bg-[#8b5cf6]/10 rounded-lg border border-[#8b5cf6]/20 hover:bg-[#8b5cf6]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PlayCircle className="w-6 h-6 text-[#8b5cf6] mb-1" />
                  <span className="text-xs font-bold text-gray-800">始業</span>
                </button>
                <button
                  onClick={() => handleTimeTracking('break_start')}
                  disabled={timeTrackingStatus !== 'working' || !!todayAttendance.breakStartTime}
                  className="flex flex-col items-center justify-center p-3 bg-[#8b5cf6]/10 rounded-lg border border-[#8b5cf6]/20 hover:bg-[#8b5cf6]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Coffee className="w-6 h-6 text-[#8b5cf6] mb-1" />
                  <span className="text-xs font-bold text-gray-800">休憩開始</span>
                </button>
                <button
                  onClick={() => handleTimeTracking('break_end')}
                  disabled={timeTrackingStatus !== 'break' || !todayAttendance.breakStartTime || !!todayAttendance.breakEndTime}
                  className="flex flex-col items-center justify-center p-3 bg-[#8b5cf6]/10 rounded-lg border border-[#8b5cf6]/20 hover:bg-[#8b5cf6]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PlayCircle className="w-6 h-6 text-[#8b5cf6] mb-1" />
                  <span className="text-xs font-bold text-gray-800">休憩終了</span>
                </button>
                <button
                  onClick={() => handleTimeTracking('end')}
                  disabled={timeTrackingStatus === 'idle' || !todayAttendance.startTime || !!todayAttendance.endTime}
                  className="flex flex-col items-center justify-center p-3 bg-[#8b5cf6]/10 rounded-lg border border-[#8b5cf6]/20 hover:bg-[#8b5cf6]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PauseCircle className="w-6 h-6 text-[#8b5cf6] mb-1" />
                  <span className="text-xs font-bold text-gray-800">退勤</span>
                </button>
              </div>
            </div>

            {/* 事業所設定のメニュー */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3">その他の業務ツール</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <button className="flex flex-col items-center justify-center p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                  <FileText className="w-6 h-6 text-gray-600 mb-1" />
                  <span className="text-xs font-bold text-gray-800">日報作成</span>
                </button>
                <button className="flex flex-col items-center justify-center p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                  <FileText className="w-6 h-6 text-gray-600 mb-1" />
                  <span className="text-xs font-bold text-gray-800">書類出力</span>
                </button>
                <button 
                  onClick={() => setShowAttendanceCalendar(true)}
                  className="flex flex-col items-center justify-center p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <Calendar className="w-6 h-6 text-gray-600 mb-1" />
                  <span className="text-xs font-bold text-gray-800">勤怠カレンダー</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ④ 通知・アクションセンター */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#8b5cf6]" />
            通知・アクション
          </h2>
          
          <div className="space-y-3">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-800 mb-1">
                    資格証の有効期限が切れています
                  </p>
                  <p className="text-xs text-gray-600">
                    保育士証の有効期限が2024年3月31日に切れます。再アップロードしてください。
                  </p>
                  <button className="mt-2 text-xs text-[#8b5cf6] hover:underline">
                    確認する →
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-800 mb-1">
                    実務経験の承認依頼が届いています
                  </p>
                  <p className="text-xs text-gray-600">
                    過去の職場（〇〇事業所）から実務経験証明の承認依頼が届いています。
                  </p>
                  <button className="mt-2 text-xs text-[#8b5cf6] hover:underline">
                    確認する →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      )}

      {/* 勤怠カレンダーモーダル */}
      {showAttendanceCalendar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto"
          >
            <div className="bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] p-4 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  勤怠カレンダー
                </h2>
                <button
                  onClick={() => setShowAttendanceCalendar(false)}
                  className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1">

              {/* 月選択と統計情報 */}
              <div className="mb-3 space-y-2">
                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                  <button
                    onClick={() => {
                      const prevMonth = new Date(currentMonth);
                      prevMonth.setMonth(prevMonth.getMonth() - 1);
                      setCurrentMonth(prevMonth);
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-gray-100 rounded-md text-sm font-bold text-gray-700 shadow-sm transition-colors"
                  >
                    ← 前月
                  </button>
                  <h3 className="text-lg font-bold text-gray-800">
                    {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
                  </h3>
                  <button
                    onClick={() => {
                      const nextMonth = new Date(currentMonth);
                      nextMonth.setMonth(nextMonth.getMonth() + 1);
                      setCurrentMonth(nextMonth);
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-gray-100 rounded-md text-sm font-bold text-gray-700 shadow-sm transition-colors"
                  >
                    次月 →
                  </button>
                </div>

                {/* 統計情報 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(() => {
                    // 月間の労働時間を計算
                    const year = currentMonth.getFullYear();
                    const month = currentMonth.getMonth();
                    const records = JSON.parse(localStorage.getItem('attendance_records') || '[]');
                    const monthRecords = records.filter((r: any) => {
                      if (!user || !currentFacility) return false;
                      const recordDate = new Date(r.date);
                      return r.user_id === user.id && 
                             r.facility_id === currentFacility.facilityId &&
                             recordDate.getFullYear() === year &&
                             recordDate.getMonth() === month;
                    });

                    // 営業日数を計算（Biz側の設定から）
                    let workingDays = 0;
                    const lastDay = new Date(year, month + 1, 0).getDate();
                    const regularHolidays = facilitySettings?.regularHolidays || [0];
                    const holidayPeriods = facilitySettings?.holidayPeriods || [];
                    const customHolidays = facilitySettings?.customHolidays || [];
                    const includeHolidays = facilitySettings?.includeHolidays || false;
                    const japaneseHolidays = includeHolidays ? getJapaneseHolidays(year) : [];

                    // 指定された日付の定休日を取得する関数
                    const getRegularHolidaysForDate = (dateStr: string, dayOfWeek: number): number[] => {
                      // 期間指定の定休日をチェック
                      if (holidayPeriods && Array.isArray(holidayPeriods) && holidayPeriods.length > 0) {
                        for (const period of holidayPeriods) {
                          // periodがオブジェクトかどうか確認
                          if (period && typeof period === 'object' && !Array.isArray(period)) {
                            const periodAny = period as any;
                            const periodStart = periodAny.startDate || periodAny.start_date;
                            const periodEnd = periodAny.endDate || periodAny.end_date || '9999-12-31';
                            const periodRegularHolidays = periodAny.regularHolidays || periodAny.regular_holidays || [];
                            
                            if (periodStart && dateStr >= periodStart && dateStr <= periodEnd) {
                              return Array.isArray(periodRegularHolidays) ? periodRegularHolidays : [];
                            }
                          }
                        }
                      }
                      // 期間指定がない場合はデフォルトの定休日を使用
                      return Array.isArray(regularHolidays) ? regularHolidays : [];
                    };

                    for (let day = 1; day <= lastDay; day++) {
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      // 日本時間（JST）で日付を作成（タイムゾーン問題を回避）
                      const date = new Date(year, month, day);
                      const dayOfWeek = date.getDay();
                      
                      // 期間指定の定休日を取得
                      const applicableRegularHolidays = getRegularHolidaysForDate(dateStr, dayOfWeek);
                      
                      // 定休日チェック
                      if (applicableRegularHolidays.includes(dayOfWeek)) continue;
                      // カスタム休業日チェック（日本時間の日付文字列で比較）
                      if (customHolidays && Array.isArray(customHolidays) && customHolidays.includes(dateStr)) {
                        continue;
                      }
                      // 祝日チェック
                      if (japaneseHolidays.includes(dateStr)) continue;
                      
                      workingDays++;
                    }

                    // 規定労働時間（1日8時間 × 営業日数）
                    const standardWorkHours = workingDays * 8;
                    
                    // 実際の労働時間を計算
                    let totalWorkMinutes = 0;
                    const dailyWorkTimes: { [key: string]: number } = {};
                    
                    monthRecords.forEach((record: any) => {
                      if (record.type === 'start' && !dailyWorkTimes[record.date]) {
                        dailyWorkTimes[record.date] = 0;
                      }
                    });

                    // 各日の労働時間を計算
                    monthRecords.forEach((record: any) => {
                      if (record.type === 'manual') {
                        // 手動登録の場合
                        if (record.start_time && record.end_time) {
                          const start = new Date(`${record.date}T${record.start_time}:00`);
                          const end = new Date(`${record.date}T${record.end_time}:00`);
                          const workMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
                          
                          // 休憩時間を差し引く
                          if (record.break_start_time && record.break_end_time) {
                            const breakStart = new Date(`${record.date}T${record.break_start_time}:00`);
                            const breakEnd = new Date(`${record.date}T${record.break_end_time}:00`);
                            const breakMinutes = Math.floor((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60));
                            dailyWorkTimes[record.date] = Math.max(0, workMinutes - breakMinutes);
                          } else {
                            dailyWorkTimes[record.date] = workMinutes;
                          }
                          totalWorkMinutes += dailyWorkTimes[record.date];
                        }
                      } else if (record.type === 'start' && !dailyWorkTimes[record.date]) {
                        // 打刻の場合
                        const dayRecords = monthRecords.filter((r: any) => r.date === record.date);
                        const startRecord = dayRecords.find((r: any) => r.type === 'start');
                        const endRecord = dayRecords.find((r: any) => r.type === 'end');
                        
                        if (startRecord && endRecord) {
                          const start = new Date(`${record.date}T${startRecord.time}:00`);
                          const end = new Date(`${record.date}T${endRecord.time}:00`);
                          const workMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
                          
                          // 休憩時間を差し引く
                          const breakStart = dayRecords.find((r: any) => r.type === 'break_start');
                          const breakEnd = dayRecords.find((r: any) => r.type === 'break_end');
                          if (breakStart && breakEnd) {
                            const breakStartTime = new Date(`${record.date}T${breakStart.time}:00`);
                            const breakEndTime = new Date(`${record.date}T${breakEnd.time}:00`);
                            const breakMinutes = Math.floor((breakEndTime.getTime() - breakStartTime.getTime()) / (1000 * 60));
                            dailyWorkTimes[record.date] = Math.max(0, workMinutes - breakMinutes);
                          } else {
                            dailyWorkTimes[record.date] = workMinutes;
                          }
                          totalWorkMinutes += dailyWorkTimes[record.date];
                        }
                      }
                    });

                    const totalWorkHours = Math.floor(totalWorkMinutes / 60);
                    const totalWorkMinutesRemainder = totalWorkMinutes % 60;
                    const overtimeHours = Math.max(0, totalWorkHours - standardWorkHours);
                    const overtimeMinutes = overtimeHours > 0 ? totalWorkMinutesRemainder : 0;

                    return (
                      <>
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                          <div className="text-[10px] text-blue-600 font-bold mb-1 uppercase tracking-wide">月間労働時間</div>
                          <div className="text-lg font-bold text-blue-700">
                            {totalWorkHours}<span className="text-sm">時間</span> {totalWorkMinutesRemainder}<span className="text-sm">分</span>
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border border-orange-200">
                          <div className="text-[10px] text-orange-600 font-bold mb-1 uppercase tracking-wide">残業時間</div>
                          <div className="text-lg font-bold text-orange-700">
                            {overtimeHours > 0 ? (
                              <>{overtimeHours}<span className="text-sm">時間</span> {overtimeMinutes}<span className="text-sm">分</span></>
                            ) : (
                              <>0<span className="text-sm">時間</span> 0<span className="text-sm">分</span></>
                            )}
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                          <div className="text-[10px] text-green-600 font-bold mb-1 uppercase tracking-wide">規定労働時間</div>
                          <div className="text-lg font-bold text-green-700">
                            {standardWorkHours}<span className="text-sm">時間</span>
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                          <div className="text-[10px] text-purple-600 font-bold mb-1 uppercase tracking-wide">残有給日数</div>
                          <div className="text-lg font-bold text-[#8b5cf6]">{remainingPaidLeave}<span className="text-sm">日</span></div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* カレンダー */}
              <div className="mb-3">
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
                    <div 
                      key={day} 
                      className={`text-center text-xs font-bold py-1.5 rounded ${
                        index === 0 ? 'text-red-500 bg-red-50' :
                        index === 6 ? 'text-blue-500 bg-blue-50' :
                        'text-gray-700 bg-gray-50'
                      }`}
                    >
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {(() => {
                    const year = currentMonth.getFullYear();
                    const month = currentMonth.getMonth();
                    const firstDay = new Date(year, month, 1);
                    const lastDay = new Date(year, month + 1, 0);
                    const daysInMonth = lastDay.getDate();
                    const startingDayOfWeek = firstDay.getDay();
                    const days = [];

                    // 前月の空白セル
                    for (let i = 0; i < startingDayOfWeek; i++) {
                      days.push(null);
                    }

                    // 当月の日付
                    for (let day = 1; day <= daysInMonth; day++) {
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      days.push(dateStr);
                    }

                    return days.map((dateStr, index) => {
                      if (!dateStr) {
                        return <div key={index} className="aspect-square"></div>;
                      }

                      // 日本時間（JST）で日付を作成（タイムゾーン問題を回避）
                      const [yearStr, monthStr, dayStr] = dateStr.split('-');
                      const date = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr));
                      const dayOfWeek = date.getDay();
                      // 今日の日付を日本時間で取得
                      const today = new Date();
                      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                      const isToday = dateStr === todayStr;
                      
                      // 休業日チェック（Biz側の設定から）
                      const regularHolidays = facilitySettings?.regularHolidays || [0];
                      const holidayPeriods = facilitySettings?.holidayPeriods || [];
                      const customHolidays = facilitySettings?.customHolidays || [];
                      const includeHolidays = facilitySettings?.includeHolidays || false;
                      const japaneseHolidaysList = includeHolidays ? getJapaneseHolidays(parseInt(yearStr)) : [];
                      
                      // 期間指定の定休日を取得
                      const getRegularHolidaysForDate = (dateStr: string): number[] => {
                        if (holidayPeriods && Array.isArray(holidayPeriods) && holidayPeriods.length > 0) {
                          for (const period of holidayPeriods) {
                            if (period && typeof period === 'object' && !Array.isArray(period)) {
                              const periodAny = period as any;
                              const periodStart = periodAny.startDate || periodAny.start_date;
                              const periodEnd = periodAny.endDate || periodAny.end_date || '9999-12-31';
                              const periodRegularHolidays = periodAny.regularHolidays || periodAny.regular_holidays || [];
                              
                              if (periodStart && dateStr >= periodStart && dateStr <= periodEnd) {
                                return Array.isArray(periodRegularHolidays) ? periodRegularHolidays : [];
                              }
                            }
                          }
                        }
                        return Array.isArray(regularHolidays) ? regularHolidays : [];
                      };
                      
                      const applicableRegularHolidays = getRegularHolidaysForDate(dateStr);
                      const isRegularHoliday = applicableRegularHolidays.includes(dayOfWeek);
                      const isCustomHoliday = customHolidays && Array.isArray(customHolidays) && customHolidays.includes(dateStr);
                      const isJapaneseHolidayDay = japaneseHolidaysList.includes(dateStr) || isJapaneseHoliday(dateStr);
                      const isHoliday = dayOfWeek === 0 || isRegularHoliday || isCustomHoliday || isJapaneseHolidayDay;
                      
                      return (
                        <div
                          key={dateStr}
                          className={`aspect-square border rounded-lg p-1 cursor-pointer transition-all hover:shadow-sm hover:scale-105 ${
                            isToday 
                              ? 'bg-gradient-to-br from-[#8b5cf6]/20 to-[#7c3aed]/20 border-[#8b5cf6] shadow-md' 
                              : 'border-gray-200 hover:border-[#8b5cf6]/50 bg-white'
                          } ${isHoliday ? 'bg-red-50 border-red-200 cursor-not-allowed opacity-60' : ''}`}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            // 右クリックで有給申請
                            const leaveRequest = paidLeaveRequests.find(r => r.date === dateStr);
                            if (!leaveRequest) {
                              setSelectedDateForPaidLeave(dateStr);
                              setPaidLeaveFormData({
                                date: dateStr,
                                type: 'paid_leave',
                                reason: '',
                              });
                              setShowPaidLeaveModal(true);
                            }
                          }}
                          onClick={() => {
                            // 左クリックで勤怠編集
                            const leaveRequest = paidLeaveRequests.find(r => r.date === dateStr);
                            if (leaveRequest) {
                              // 有給申請済みの場合は有給申請モーダルを開く
                              setSelectedDateForPaidLeave(dateStr);
                              setPaidLeaveFormData({
                                date: dateStr,
                                type: leaveRequest.type,
                                reason: '',
                              });
                              setShowPaidLeaveModal(true);
                            } else {
                              // 勤怠編集モーダルを開く
                              setEditingAttendanceDate(dateStr);
                              // 既存の打刻データを読み込む
                              if (user && currentFacility) {
                                const records = JSON.parse(localStorage.getItem('attendance_records') || '[]');
                                const dayRecords = records.filter((r: any) => 
                                  r.user_id === user.id && 
                                  r.facility_id === currentFacility.facilityId &&
                                  r.date === dateStr
                                );
                                
                                const startRecord = dayRecords.find((r: any) => r.type === 'start');
                                const endRecord = dayRecords.find((r: any) => r.type === 'end');
                                const breakStartRecord = dayRecords.find((r: any) => r.type === 'break_start');
                                const breakEndRecord = dayRecords.find((r: any) => r.type === 'break_end');
                                const manualRecord = dayRecords.find((r: any) => r.type === 'manual');
                                
                                setManualAttendanceData({
                                  startTime: startRecord?.time || manualRecord?.start_time || '',
                                  endTime: endRecord?.time || manualRecord?.end_time || '',
                                  breakStartTime: breakStartRecord?.time || manualRecord?.break_start_time || '12:00',
                                  breakEndTime: breakEndRecord?.time || manualRecord?.break_end_time || '13:00',
                                  reason: manualRecord?.reason || '',
                                });
                              }
                            }
                          }}
                        >
                          <div className={`text-xs font-bold mb-0.5 ${
                            isToday ? 'text-[#8b5cf6]' : 'text-gray-800'
                          }`}>
                            {date.getDate()}
                          </div>
                          {isHoliday && (
                            <div className="text-[9px] text-red-600 text-center mt-1 leading-none">
                              休業日
                            </div>
                          )}
                          <div className="text-[9px] space-y-0.5">
                            {(() => {
                              if (!user || !currentFacility) return null;
                              const records = JSON.parse(localStorage.getItem('attendance_records') || '[]');
                              const dayRecords = records.filter((r: any) => 
                                r.user_id === user.id && 
                                r.facility_id === currentFacility.facilityId &&
                                r.date === dateStr
                              );
                              const leaveRequest = paidLeaveRequests.find(r => r.date === dateStr);
                              
                              if (leaveRequest) {
                                return (
                                  <div className={`text-[10px] font-bold px-1 py-0.5 rounded ${
                                    leaveRequest.status === 'approved' ? 'bg-green-100 text-green-700' :
                                    leaveRequest.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {leaveRequest.type === 'paid_leave' ? '有給' : '半休'}
                                  </div>
                                );
                              }
                              
                              if (dayRecords.length > 0) {
                                const startRecord = dayRecords.find((r: any) => r.type === 'start' || r.type === 'manual');
                                const endRecord = dayRecords.find((r: any) => r.type === 'end' || r.type === 'manual');
                                if (startRecord && endRecord) {
                                  const isManual = startRecord.type === 'manual';
                                  return (
                                    <>
                                      <div className={`text-[10px] font-bold ${
                                        isManual ? 'text-purple-600' : 'text-blue-600'
                                      }`}>
                                        {startRecord.time || startRecord.start_time}〜{endRecord.time || endRecord.end_time}
                                      </div>
                                      {isManual && (
                                        <div className="text-[9px] text-purple-500">手動</div>
                                      )}
                                    </>
                                  );
                                }
                              }
                              
                              // 現在の日付までで未登録の日を表示（日本時間で判定）
                              const today = new Date();
                              const [yearStr, monthStr, dayStr] = dateStr.split('-');
                              const cellDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr));
                              const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                              
                              // 休業日チェック（Biz側の設定から）
                              const regularHolidaysForCheck = facilitySettings?.regularHolidays || [0];
                              const holidayPeriodsForCheck = facilitySettings?.holidayPeriods || [];
                              const customHolidaysForCheck = facilitySettings?.customHolidays || [];
                              const includeHolidaysForCheck = facilitySettings?.includeHolidays || false;
                              const japaneseHolidaysForCheck = includeHolidaysForCheck ? getJapaneseHolidays(parseInt(yearStr)) : [];
                              
                              // 期間指定の定休日を取得
                              const getRegularHolidaysForDateCheck = (dateStr: string): number[] => {
                                if (holidayPeriodsForCheck && Array.isArray(holidayPeriodsForCheck) && holidayPeriodsForCheck.length > 0) {
                                  for (const period of holidayPeriodsForCheck) {
                                    if (period && typeof period === 'object' && !Array.isArray(period)) {
                                      const periodStart = period.startDate;
                                      const periodEnd = period.endDate || '9999-12-31';
                                      const periodRegularHolidays = period.regularHolidays || [];
                                      
                                      if (periodStart && dateStr >= periodStart && dateStr <= periodEnd) {
                                        return Array.isArray(periodRegularHolidays) ? periodRegularHolidays : [];
                                      }
                                    }
                                  }
                                }
                                return Array.isArray(regularHolidaysForCheck) ? regularHolidaysForCheck : [];
                              };
                              
                              const applicableRegularHolidaysForCheck = getRegularHolidaysForDateCheck(dateStr);
                              const isRegularHolidayForCheck = applicableRegularHolidaysForCheck.includes(cellDate.getDay());
                              const isCustomHolidayForCheck = customHolidaysForCheck && customHolidaysForCheck.includes(dateStr);
                              const isJapaneseHolidayForCheck = japaneseHolidaysForCheck.includes(dateStr) || isJapaneseHoliday(dateStr);
                              const isHolidayForCheck = cellDate.getDay() === 0 || isRegularHolidayForCheck || isCustomHolidayForCheck || isJapaneseHolidayForCheck;
                              
                              if (cellDate <= todayDate && !isHolidayForCheck) {
                                // 平日で現在の日付以前の場合、未登録を表示
                                return (
                                  <div className="text-[9px] text-red-500 font-bold">
                                    未登録
                                  </div>
                                );
                              }
                              
                              return null;
                            })()}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* 有給申請ボタンと一覧 */}
              <div className="mb-3 space-y-2">
                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                  <h3 className="text-sm font-bold text-gray-700">有給申請</h3>
                  <button
                    onClick={() => {
                      setSelectedDateForPaidLeave('');
                      setPaidLeaveFormData({
                        date: '',
                        type: 'paid_leave',
                        reason: '',
                      });
                      setShowPaidLeaveModal(true);
                    }}
                    className="px-3 py-1.5 bg-[#8b5cf6] text-white rounded-md hover:bg-[#7c3aed] transition-colors font-bold text-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-3 h-3" />
                    有給申請
                  </button>
                </div>
                {paidLeaveRequests.length > 0 && (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {paidLeaveRequests.map((request) => (
                      <div 
                        key={request.id} 
                        className="flex items-center justify-between bg-white rounded-md p-2 border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedDateForPaidLeave(request.date);
                          setPaidLeaveFormData({
                            date: request.date,
                            type: request.type,
                            reason: '',
                          });
                          setShowPaidLeaveModal(true);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-800">{request.date}</span>
                          <span className="text-[10px] text-gray-500">
                            {request.type === 'paid_leave' ? '有給' : request.type === 'half_paid_leave' ? '半休' : '特別休暇'}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            request.status === 'approved' ? 'bg-green-100 text-green-700' :
                            request.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {request.status === 'approved' ? '承認済み' :
                             request.status === 'pending' ? '申請中' :
                             '却下'}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPaidLeaveRequests(paidLeaveRequests.filter(r => r.id !== request.id));
                          }}
                          className="text-[10px] text-red-500 hover:text-red-700 font-bold px-1"
                        >
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* 勤怠手動入力モーダル */}
      {editingAttendanceDate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                {editingAttendanceDate} の勤怠を編集
              </h3>
              <button
                onClick={() => {
                  setEditingAttendanceDate(null);
                  setManualAttendanceData({
                    startTime: '',
                    endTime: '',
                    breakStartTime: '12:00',
                    breakEndTime: '13:00',
                    reason: '',
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">始業時刻</label>
                  <input
                    type="time"
                    value={manualAttendanceData.startTime}
                    onChange={(e) => setManualAttendanceData({ ...manualAttendanceData, startTime: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">退勤時刻</label>
                  <input
                    type="time"
                    value={manualAttendanceData.endTime}
                    onChange={(e) => setManualAttendanceData({ ...manualAttendanceData, endTime: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">休憩開始</label>
                  <input
                    type="time"
                    value={manualAttendanceData.breakStartTime}
                    onChange={(e) => setManualAttendanceData({ ...manualAttendanceData, breakStartTime: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">休憩終了</label>
                  <input
                    type="time"
                    value={manualAttendanceData.breakEndTime}
                    onChange={(e) => setManualAttendanceData({ ...manualAttendanceData, breakEndTime: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  手動登録の理由 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={manualAttendanceData.reason}
                  onChange={(e) => setManualAttendanceData({ ...manualAttendanceData, reason: e.target.value })}
                  placeholder="例：打刻を忘れたため、出張のためなど"
                  required
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    if (!user || !currentFacility || !manualAttendanceData.reason) {
                      alert('手動登録の理由を入力してください');
                      return;
                    }

                    // 既存の打刻データを削除
                    const records = JSON.parse(localStorage.getItem('attendance_records') || '[]');
                    const filteredRecords = records.filter((r: any) => 
                      !(r.user_id === user.id && 
                        r.facility_id === currentFacility.facilityId &&
                        r.date === editingAttendanceDate)
                    );

                    // 手動登録データを追加
                    const manualRecord = {
                      user_id: user.id,
                      facility_id: currentFacility.facilityId,
                      date: editingAttendanceDate,
                      type: 'manual',
                      start_time: manualAttendanceData.startTime,
                      end_time: manualAttendanceData.endTime,
                      break_start_time: manualAttendanceData.breakStartTime,
                      break_end_time: manualAttendanceData.breakEndTime,
                      reason: manualAttendanceData.reason,
                      timestamp: new Date().toISOString(),
                    };

                    filteredRecords.push(manualRecord);
                    localStorage.setItem('attendance_records', JSON.stringify(filteredRecords));

                    setEditingAttendanceDate(null);
                    setManualAttendanceData({
                      startTime: '',
                      endTime: '',
                      breakStartTime: '12:00',
                      breakEndTime: '13:00',
                      reason: '',
                    });
                  }}
                  className="flex-1 px-4 py-3 bg-[#8b5cf6] text-white rounded-lg hover:bg-[#7c3aed] transition-colors font-bold"
                >
                  保存
                </button>
                <button
                  onClick={() => {
                    setEditingAttendanceDate(null);
                    setManualAttendanceData({
                      startTime: '',
                      endTime: '',
                      breakStartTime: '12:00',
                      breakEndTime: '13:00',
                      reason: '',
                    });
                  }}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-bold"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* 有給申請モーダル */}
      {showPaidLeaveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">有給申請</h3>
              <button
                onClick={() => {
                  setShowPaidLeaveModal(false);
                  setSelectedDateForPaidLeave('');
                  setPaidLeaveFormData({
                    date: '',
                    type: 'paid_leave',
                    reason: '',
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">申請日</label>
                <input
                  type="date"
                  value={paidLeaveFormData.date || selectedDateForPaidLeave}
                  onChange={(e) => {
                    setPaidLeaveFormData({ ...paidLeaveFormData, date: e.target.value });
                    setSelectedDateForPaidLeave(e.target.value);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">休暇種別</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="paidLeaveType"
                      value="paid_leave"
                      checked={paidLeaveFormData.type === 'paid_leave'}
                      onChange={(e) => setPaidLeaveFormData({ ...paidLeaveFormData, type: e.target.value as any })}
                      className="w-4 h-4 text-[#8b5cf6]"
                    />
                    <span className="text-sm font-bold">有給休暇（全日）</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="paidLeaveType"
                      value="half_paid_leave"
                      checked={paidLeaveFormData.type === 'half_paid_leave'}
                      onChange={(e) => setPaidLeaveFormData({ ...paidLeaveFormData, type: e.target.value as any })}
                      className="w-4 h-4 text-[#8b5cf6]"
                    />
                    <span className="text-sm font-bold">有給休暇（半日）</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">申請理由（任意）</label>
                <textarea
                  value={paidLeaveFormData.reason}
                  onChange={(e) => setPaidLeaveFormData({ ...paidLeaveFormData, reason: e.target.value })}
                  placeholder="申請理由を入力してください"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    if (!paidLeaveFormData.date && !selectedDateForPaidLeave) {
                      alert('申請日を選択してください');
                      return;
                    }

                    const date = paidLeaveFormData.date || selectedDateForPaidLeave;
                    const existingRequest = paidLeaveRequests.find(r => r.date === date);
                    if (existingRequest) {
                      // 既存の申請を更新
                      setPaidLeaveRequests(paidLeaveRequests.map(r => 
                        r.id === existingRequest.id 
                          ? { ...r, type: paidLeaveFormData.type }
                          : r
                      ));
                    } else {
                      // 新しい申請を追加
                      setPaidLeaveRequests([...paidLeaveRequests, {
                        id: Date.now().toString(),
                        date: date,
                        type: paidLeaveFormData.type,
                        status: 'pending',
                      }]);
                    }

                    setShowPaidLeaveModal(false);
                    setSelectedDateForPaidLeave('');
                    setPaidLeaveFormData({
                      date: '',
                      type: 'paid_leave',
                      reason: '',
                    });
                  }}
                  className="flex-1 px-4 py-3 bg-[#8b5cf6] text-white rounded-lg hover:bg-[#7c3aed] transition-colors font-bold"
                >
                  申請する
                </button>
                <button
                  onClick={() => {
                    setShowPaidLeaveModal(false);
                    setSelectedDateForPaidLeave('');
                    setPaidLeaveFormData({
                      date: '',
                      type: 'paid_leave',
                      reason: '',
                    });
                  }}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-bold"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {activeTab === 'career' && (
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* A. 基本情報（履歴書） */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <User className="w-5 h-5 text-[#8b5cf6]" />
                基本プロフィール
              </h2>
              {!isEditingProfile && (
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="flex items-center gap-1 text-sm text-[#8b5cf6] hover:text-[#7c3aed] font-bold"
                >
                  <Edit className="w-4 h-4" />
                  編集
                </button>
              )}
            </div>

            {isEditingProfile ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">氏名</label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">メールアドレス（ログインID）</label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                    placeholder="ログインIDとして使用されます"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">生年月日</label>
                  <input
                    type="date"
                    value={profileData.birthDate}
                    onChange={(e) => setProfileData({ ...profileData, birthDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">住所</label>
                  <input
                    type="text"
                    value={profileData.address}
                    onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">電話番号</label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">性別</label>
                  <select
                    value={profileData.gender}
                    onChange={(e) => setProfileData({ ...profileData, gender: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                  >
                    <option value="">選択してください</option>
                    <option value="男性">男性</option>
                    <option value="女性">女性</option>
                    <option value="その他">その他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">マイナンバー</label>
                  <input
                    type="text"
                    value={profileData.myNumber}
                    onChange={(e) => setProfileData({ ...profileData, myNumber: e.target.value })}
                    placeholder="12桁のマイナンバー"
                    maxLength={12}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">配偶者</label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="hasSpouse"
                          checked={profileData.hasSpouse}
                          onChange={(e) => {
                            setProfileData({ 
                              ...profileData, 
                              hasSpouse: true,
                              spouseName: profileData.spouseName || '' // 既存の値があれば保持
                            });
                          }}
                          className="w-4 h-4 text-[#8b5cf6]"
                        />
                        <span className="text-sm">有</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="hasSpouse"
                          checked={!profileData.hasSpouse}
                          onChange={(e) => {
                            setProfileData({ 
                              ...profileData, 
                              hasSpouse: false,
                              spouseName: '' // 無を選択した場合は空にする
                            });
                          }}
                          className="w-4 h-4 text-[#8b5cf6]"
                        />
                        <span className="text-sm">無</span>
                      </label>
                    </div>
                    {profileData.hasSpouse && (
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">配偶者氏名</label>
                        <input
                          type="text"
                          value={profileData.spouseName}
                          onChange={(e) => setProfileData({ ...profileData, spouseName: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">基礎年金番号</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">記号（4桁）</label>
                      <input
                        type="text"
                        value={profileData.basicPensionSymbol}
                        onChange={(e) => setProfileData({ ...profileData, basicPensionSymbol: e.target.value })}
                        maxLength={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">番号（6桁）</label>
                      <input
                        type="text"
                        value={profileData.basicPensionNumber}
                        onChange={(e) => setProfileData({ ...profileData, basicPensionNumber: e.target.value })}
                        maxLength={6}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
                {/* 現在の所属事業所での契約内容 */}
                <div className="mt-6 pt-6 border-t border-gray-300">
                  <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-[#8b5cf6]" />
                    現在の所属事業所での契約内容
                  </h3>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">雇用保険</label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="employmentInsurance"
                          value="joined"
                          checked={profileData.employmentInsuranceStatus === 'joined'}
                          onChange={(e) => setProfileData({ ...profileData, employmentInsuranceStatus: e.target.value as any })}
                          className="w-4 h-4 text-[#8b5cf6]"
                        />
                        <span className="text-sm">加入</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="employmentInsurance"
                          value="not_joined"
                          checked={profileData.employmentInsuranceStatus === 'not_joined'}
                          onChange={(e) => setProfileData({ ...profileData, employmentInsuranceStatus: e.target.value as any })}
                          className="w-4 h-4 text-[#8b5cf6]"
                        />
                        <span className="text-sm">非加入</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="employmentInsurance"
                          value="first_time"
                          checked={profileData.employmentInsuranceStatus === 'first_time'}
                          onChange={(e) => setProfileData({ ...profileData, employmentInsuranceStatus: e.target.value as any })}
                          className="w-4 h-4 text-[#8b5cf6]"
                        />
                        <span className="text-sm">初めて加入</span>
                      </label>
                    </div>
                    {profileData.employmentInsuranceStatus === 'joined' && (
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">雇用保険番号（被保険者番号）</label>
                        <input
                          type="text"
                          value={profileData.employmentInsuranceNumber}
                          onChange={(e) => {
                            // ハイフンを含む形式（4桁-6桁-1桁）を許可
                            const value = e.target.value.replace(/[^\d-]/g, '');
                            setProfileData({ ...profileData, employmentInsuranceNumber: value });
                          }}
                          placeholder="例: 1234-567890-1"
                          maxLength={13}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">4桁-6桁-1桁の形式で入力してください</p>
                      </div>
                    )}
                    {profileData.employmentInsuranceStatus === 'first_time' && (
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">前職の名（旧姓の場合）</label>
                          <input
                            type="text"
                            value={profileData.previousName}
                            onChange={(e) => setProfileData({ ...profileData, previousName: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">前職の退職日</label>
                          <input
                            type="date"
                            value={profileData.previousRetirementDate}
                            onChange={(e) => setProfileData({ ...profileData, previousRetirementDate: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">社会保険</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="socialInsurance"
                        value="joined"
                        checked={profileData.socialInsuranceStatus === 'joined'}
                        onChange={(e) => setProfileData({ ...profileData, socialInsuranceStatus: e.target.value as any })}
                        className="w-4 h-4 text-[#8b5cf6]"
                      />
                      <span className="text-sm">加入</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="socialInsurance"
                        value="not_joined"
                        checked={profileData.socialInsuranceStatus === 'not_joined'}
                        onChange={(e) => setProfileData({ ...profileData, socialInsuranceStatus: e.target.value as any })}
                        className="w-4 h-4 text-[#8b5cf6]"
                      />
                      <span className="text-sm">非加入</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">扶養家族</label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="hasDependents"
                          checked={profileData.hasDependents}
                          onChange={(e) => setProfileData({ ...profileData, hasDependents: true })}
                          className="w-4 h-4 text-[#8b5cf6]"
                        />
                        <span className="text-sm">有</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="hasDependents"
                          checked={!profileData.hasDependents}
                          onChange={(e) => setProfileData({ ...profileData, hasDependents: false, dependents: [] })}
                          className="w-4 h-4 text-[#8b5cf6]"
                        />
                        <span className="text-sm">無</span>
                      </label>
                    </div>
                    {profileData.hasDependents && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">人数</label>
                          <input
                            type="number"
                            min="0"
                            value={profileData.dependentCount}
                            onChange={(e) => {
                              const count = parseInt(e.target.value) || 0;
                              const currentDependents = profileData.dependents;
                              const newDependents = Array.from({ length: count }, (_, i) => 
                                currentDependents[i] || {
                                  id: Date.now().toString() + i,
                                  name: '',
                                  furigana: '',
                                  relationship: '',
                                  birthDate: '',
                                  gender: 'male' as const,
                                  occupation: '',
                                  annualIncome: '',
                                  notWorking: false,
                                  notWorkingReason: '',
                                  myNumber: '',
                                }
                              );
                              setProfileData({ ...profileData, dependentCount: count, dependents: newDependents });
                            }}
                            className="w-24 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                          />
                          <span className="ml-2 text-sm text-gray-600">人</span>
                        </div>
                        {profileData.dependents.map((dependent, index) => (
                          <div key={dependent.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
                            <h4 className="text-sm font-bold text-gray-700">扶養家族 {index + 1}</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">続柄</label>
                                <input
                                  type="text"
                                  value={dependent.relationship}
                                  onChange={(e) => {
                                    const updated = [...profileData.dependents];
                                    updated[index].relationship = e.target.value;
                                    setProfileData({ ...profileData, dependents: updated });
                                  }}
                                  placeholder="例：妻、子"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">生年月日</label>
                                <input
                                  type="date"
                                  value={dependent.birthDate}
                                  onChange={(e) => {
                                    const updated = [...profileData.dependents];
                                    updated[index].birthDate = e.target.value;
                                    setProfileData({ ...profileData, dependents: updated });
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent text-sm"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">フリガナ</label>
                                <input
                                  type="text"
                                  value={dependent.furigana}
                                  onChange={(e) => {
                                    const updated = [...profileData.dependents];
                                    updated[index].furigana = e.target.value;
                                    setProfileData({ ...profileData, dependents: updated });
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">氏名</label>
                                <input
                                  type="text"
                                  value={dependent.name}
                                  onChange={(e) => {
                                    const updated = [...profileData.dependents];
                                    updated[index].name = e.target.value;
                                    setProfileData({ ...profileData, dependents: updated });
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">性別</label>
                              <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`dependent-gender-${index}`}
                                    checked={dependent.gender === 'male'}
                                    onChange={() => {
                                      const updated = [...profileData.dependents];
                                      updated[index].gender = 'male';
                                      setProfileData({ ...profileData, dependents: updated });
                                    }}
                                    className="w-4 h-4 text-[#8b5cf6]"
                                  />
                                  <span className="text-sm">男</span>
                                </label>
                                <label className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`dependent-gender-${index}`}
                                    checked={dependent.gender === 'female'}
                                    onChange={() => {
                                      const updated = [...profileData.dependents];
                                      updated[index].gender = 'female';
                                      setProfileData({ ...profileData, dependents: updated });
                                    }}
                                    className="w-4 h-4 text-[#8b5cf6]"
                                  />
                                  <span className="text-sm">女</span>
                                </label>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">職業</label>
                                <input
                                  type="text"
                                  value={dependent.occupation}
                                  onChange={(e) => {
                                    const updated = [...profileData.dependents];
                                    updated[index].occupation = e.target.value;
                                    setProfileData({ ...profileData, dependents: updated });
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">収入（年収）</label>
                                <input
                                  type="text"
                                  value={dependent.annualIncome}
                                  onChange={(e) => {
                                    const updated = [...profileData.dependents];
                                    updated[index].annualIncome = e.target.value;
                                    setProfileData({ ...profileData, dependents: updated });
                                  }}
                                  placeholder="円"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="flex items-center gap-2 mb-2">
                                <input
                                  type="checkbox"
                                  checked={dependent.notWorking}
                                  onChange={(e) => {
                                    const updated = [...profileData.dependents];
                                    updated[index].notWorking = e.target.checked;
                                    setProfileData({ ...profileData, dependents: updated });
                                  }}
                                  className="w-4 h-4 text-[#8b5cf6]"
                                />
                                <span className="text-xs text-gray-600">働いていない場合</span>
                              </label>
                              {dependent.notWorking && (
                                <select
                                  value={dependent.notWorkingReason}
                                  onChange={(e) => {
                                    const updated = [...profileData.dependents];
                                    updated[index].notWorkingReason = e.target.value;
                                    setProfileData({ ...profileData, dependents: updated });
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent text-sm"
                                >
                                  <option value="">選択してください</option>
                                  <option value="preschooler">未就学児</option>
                                  <option value="elementary">小学生</option>
                                  <option value="junior_high">中学生</option>
                                  <option value="high_school">高校生</option>
                                  <option value="university">大学生</option>
                                  <option value="other">その他</option>
                                </select>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">マイナンバー</label>
                              <input
                                type="text"
                                value={dependent.myNumber}
                                onChange={(e) => {
                                  const updated = [...profileData.dependents];
                                  updated[index].myNumber = e.target.value.replace(/\D/g, '').slice(0, 12);
                                  setProfileData({ ...profileData, dependents: updated });
                                }}
                                maxLength={12}
                                placeholder="12桁"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent text-sm"
                              />
                            </div>
                            {index > 0 && (
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">別居の場合は住所を明記</label>
                                <input
                                  type="text"
                                  value={dependent.separateAddress || ''}
                                  onChange={(e) => {
                                    const updated = [...profileData.dependents];
                                    updated[index].separateAddress = e.target.value;
                                    setProfileData({ ...profileData, dependents: updated });
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent text-sm"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!user) {
                        alert('ユーザー情報が取得できませんでした');
                        return;
                      }

                      try {
                        // Supabaseのusersテーブルを更新
                        // genderが空文字の場合はnullに変換
                        // facility_idは更新しない（既存の値を使用）
                        const updateData: any = {
                          name: profileData.name,
                          email: profileData.email || null,
                          birth_date: profileData.birthDate || null,
                          address: profileData.address || null,
                          phone: profileData.phone || null,
                          gender: profileData.gender || null, // 空文字の場合はnull
                          education: profileData.education || null,
                          spouse_name: profileData.spouseName || null,
                          my_number: profileData.myNumber || null,
                          basic_pension_symbol: profileData.basicPensionSymbol || null,
                          basic_pension_number: profileData.basicPensionNumber || null,
                          employment_insurance_status: profileData.employmentInsuranceStatus,
                          employment_insurance_number: profileData.employmentInsuranceNumber || null,
                          previous_retirement_date: profileData.previousRetirementDate || null,
                          previous_name: profileData.previousName || null,
                          social_insurance_status: profileData.socialInsuranceStatus,
                          has_dependents: profileData.hasDependents,
                          dependent_count: profileData.dependentCount,
                          dependents: profileData.dependents || [],
                          updated_at: new Date().toISOString(),
                        };

                        // facility_idは更新しない（既存の値を使用して制約違反を回避）
                        const { error } = await supabase
                          .from('users')
                          .update(updateData)
                          .eq('id', user.id);

                        if (error) {
                          console.error('プロフィール保存エラー:', error);
                          alert('プロフィールの保存に失敗しました: ' + error.message);
                          return;
                        }

                        // localStorageのユーザー情報も更新
                        const updatedUser = {
                          ...user,
                          name: profileData.name,
                          email: profileData.email,
                          birth_date: profileData.birthDate,
                          address: profileData.address,
                          phone: profileData.phone,
                          gender: profileData.gender,
                          education: profileData.education,
                          spouse_name: profileData.spouseName,
                          my_number: profileData.myNumber,
                          basic_pension_symbol: profileData.basicPensionSymbol,
                          basic_pension_number: profileData.basicPensionNumber,
                          employment_insurance_status: profileData.employmentInsuranceStatus,
                          employment_insurance_number: profileData.employmentInsuranceNumber,
                          previous_retirement_date: profileData.previousRetirementDate,
                          previous_name: profileData.previousName,
                          social_insurance_status: profileData.socialInsuranceStatus,
                          has_dependents: profileData.hasDependents,
                          dependent_count: profileData.dependentCount,
                          dependents: profileData.dependents,
                        };
                        localStorage.setItem('user', JSON.stringify(updatedUser));
                        setUser(updatedUser);

                        setIsEditingProfile(false);
                        alert('プロフィールを保存しました');
                      } catch (err) {
                        console.error('プロフィール保存エラー:', err);
                        alert('プロフィールの保存に失敗しました');
                      }
                    }}
                    className="px-4 py-2 bg-[#8b5cf6] text-white rounded-md hover:bg-[#7c3aed] transition-colors font-bold"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => {
                      // 編集をキャンセルする場合は元のデータを復元
                      const storedUser = localStorage.getItem('user');
                      if (storedUser) {
                        const userData = JSON.parse(storedUser);
                        setProfileData({
                          name: userData.name || '',
                          email: userData.email || '',
                          birthDate: userData.birth_date || '',
                          address: userData.address || '',
                          phone: userData.phone || '',
                          gender: userData.gender || '',
                          education: userData.education || '',
                          hasSpouse: !!userData.spouse_name,
                          spouseName: userData.spouse_name || '',
                          myNumber: userData.my_number || '',
                          basicPensionSymbol: userData.basic_pension_symbol || '',
                          basicPensionNumber: userData.basic_pension_number || '',
                          employmentInsuranceStatus: userData.employment_insurance_status || 'joined',
                          employmentInsuranceNumber: userData.employment_insurance_number || '',
                          previousRetirementDate: userData.previous_retirement_date || '',
                          previousName: userData.previous_name || '',
                          socialInsuranceStatus: userData.social_insurance_status || 'joined',
                          hasDependents: userData.has_dependents || false,
                          dependentCount: userData.dependent_count || 0,
                          dependents: userData.dependents || [],
                        });
                      }
                      setIsEditingProfile(false);
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-bold"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-600 w-24">氏名</span>
                  <span className="text-sm text-gray-800">{profileData.name || '未登録'}</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-600 w-24">メールアドレス</span>
                  <span className="text-sm text-gray-800">{profileData.email || '未登録'}</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-600 w-24">生年月日</span>
                  <span className="text-sm text-gray-800">{profileData.birthDate || '未登録'}</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-600 w-24">住所</span>
                  <span className="text-sm text-gray-800">{profileData.address || '未登録'}</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-600 w-24">電話番号</span>
                  <span className="text-sm text-gray-800">{profileData.phone || '未登録'}</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-600 w-24">性別</span>
                  <span className="text-sm text-gray-800">{profileData.gender || '未登録'}</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-600 w-24">マイナンバー</span>
                  <span className="text-sm text-gray-800">{profileData.myNumber ? '***-****-' + profileData.myNumber.slice(-4) : '未登録'}</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-600 w-24">配偶者</span>
                  <span className="text-sm text-gray-800">
                    {profileData.hasSpouse ? (profileData.spouseName || '氏名未入力') : '無'}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-600 w-24">基礎年金番号</span>
                  <span className="text-sm text-gray-800">
                    {profileData.basicPensionSymbol && profileData.basicPensionNumber
                      ? `${profileData.basicPensionSymbol}-${profileData.basicPensionNumber}`
                      : '未登録'}
                  </span>
                </div>
                {/* 現在の所属事業所での契約内容 */}
                <div className="mt-6 pt-6 border-t border-gray-300">
                  <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-[#8b5cf6]" />
                    現在の所属事業所での契約内容
                  </h3>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-600 w-32">雇用保険</span>
                  <span className="text-sm text-gray-800">
                    {profileData.employmentInsuranceStatus === 'joined' ? '加入' :
                     profileData.employmentInsuranceStatus === 'not_joined' ? '非加入' :
                     profileData.employmentInsuranceStatus === 'first_time' ? '初めて加入' : '未登録'}
                  </span>
                </div>
                {profileData.employmentInsuranceStatus === 'joined' && profileData.employmentInsuranceNumber && (
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-bold text-gray-600 w-32">雇用保険番号</span>
                    <span className="text-sm text-gray-800">{profileData.employmentInsuranceNumber}</span>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-600 w-32">社会保険</span>
                  <span className="text-sm text-gray-800">
                    {profileData.socialInsuranceStatus === 'joined' ? '加入' :
                     profileData.socialInsuranceStatus === 'not_joined' ? '非加入' : '未登録'}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-600 w-24">扶養家族</span>
                  <span className="text-sm text-gray-800">
                    {profileData.hasDependents ? `${profileData.dependentCount}人` : '無'}
                  </span>
                </div>
              </div>
            )}

            {/* 実務経験のサマリー */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-bold text-gray-700 mb-3">実務経験のサマリー</h3>
              <div className="bg-[#8b5cf6]/5 rounded-lg p-4 border border-[#8b5cf6]/20">
                <div className="text-sm text-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <span>所属企業別</span>
                    <span className="font-bold text-gray-800">{experienceRecords.length}件</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>累計経験</span>
                    <span className="font-bold text-[#8b5cf6]">計算中...</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* B. 資格証（カメラアップロード） */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-[#8b5cf6]" />
              保有資格
            </h2>

            <div className="space-y-4">
              {qualifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Award className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm mb-4">登録されている資格がありません</p>
                  <button
                    onClick={() => {
                      setQualifications([...qualifications, {
                        id: Date.now().toString(),
                        name: '',
                        status: 'not_registered',
                      }]);
                    }}
                    className="px-4 py-2 bg-[#8b5cf6] text-white rounded-md hover:bg-[#7c3aed] transition-colors font-bold text-sm flex items-center gap-2 mx-auto"
                  >
                    <Plus className="w-4 h-4" />
                    資格を追加
                  </button>
                </div>
              ) : (
                qualifications.map((qual) => (
                  <div key={qual.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={qual.name}
                          onChange={(e) => {
                            setQualifications(qualifications.map(q => 
                              q.id === qual.id ? { ...q, name: e.target.value } : q
                            ));
                          }}
                          placeholder="資格名を入力（例：保育士、社会福祉士）"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent text-sm"
                        />
                      </div>
                      <button
                        onClick={() => {
                          setQualifications(qualifications.filter(q => q.id !== qual.id));
                        }}
                        className="ml-2 text-gray-400 hover:text-red-500"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex-1">
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setQualifications(qualifications.map(q => 
                                  q.id === qual.id ? { ...q, imageUrl: reader.result as string, status: 'pending' } : q
                                ));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer text-sm font-bold text-gray-700">
                          <Camera className="w-4 h-4" />
                          {qual.imageUrl ? '画像を変更' : '資格証をアップロード'}
                        </div>
                      </label>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        qual.status === 'approved' 
                          ? 'bg-green-100 text-green-700'
                          : qual.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {qual.status === 'approved' ? '承認済み' : qual.status === 'pending' ? '確認中' : '未登録'}
                      </span>
                    </div>
                    {qual.imageUrl && (
                      <div className="mt-3">
                        <Image src={qual.imageUrl} alt={qual.name} width={400} height={128} className="max-w-full h-32 object-contain border border-gray-200 rounded" unoptimized />
                      </div>
                    )}
                  </div>
                ))
              )}
              {qualifications.length > 0 && (
                <button
                  onClick={() => {
                    setQualifications([...qualifications, {
                      id: Date.now().toString(),
                      name: '',
                      status: 'not_registered',
                    }]);
                  }}
                  className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md hover:border-[#8b5cf6] hover:bg-[#8b5cf6]/5 transition-colors text-sm font-bold text-gray-600 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  資格を追加
                </button>
              )}
            </div>
          </motion.div>

          {/* C. 職歴（実務経験証明書） */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-[#8b5cf6]" />
              職歴
            </h2>

            <div className="space-y-4">
              {experienceRecords.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm mb-4">職歴が登録されていません</p>
                  <button
                    onClick={() => {
                      setExperienceRecords([...experienceRecords, {
                        id: Date.now().toString(),
                        facilityName: '',
                        startDate: '',
                        endDate: '',
                        certificateStatus: 'not_requested',
                      }]);
                    }}
                    className="px-4 py-2 bg-[#8b5cf6] text-white rounded-md hover:bg-[#7c3aed] transition-colors font-bold text-sm flex items-center gap-2 mx-auto"
                  >
                    <Plus className="w-4 h-4" />
                    職歴を追加
                  </button>
                </div>
              ) : (
                experienceRecords.map((record) => (
                  <div key={record.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="mb-2">
                            <label className="block text-xs font-bold text-gray-700 mb-1">事業所名</label>
                            <input
                              type="text"
                              value={record.facilityName}
                              onChange={(e) => {
                                setExperienceRecords(experienceRecords.map(r => 
                                  r.id === record.id ? { ...r, facilityName: e.target.value } : r
                                ));
                              }}
                              placeholder="事業所名を入力"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent text-sm"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">開始日</label>
                              <input
                                type="date"
                                value={record.startDate}
                                onChange={(e) => {
                                  setExperienceRecords(experienceRecords.map(r => 
                                    r.id === record.id ? { ...r, startDate: e.target.value } : r
                                  ));
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">終了日</label>
                              <input
                                type="date"
                                value={record.endDate || ''}
                                onChange={(e) => {
                                  setExperienceRecords(experienceRecords.map(r => 
                                    r.id === record.id ? { ...r, endDate: e.target.value } : r
                                  ));
                                }}
                                placeholder="在籍中は空欄"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent text-sm"
                              />
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setExperienceRecords(experienceRecords.filter(r => r.id !== record.id));
                          }}
                          className="ml-2 text-gray-400 hover:text-red-500"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      
                      {/* 実務経験証明書の取得状況 */}
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-700">実務経験証明書</span>
                          <span className={`text-xs font-bold px-2 py-1 rounded ${
                            record.certificateStatus === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : record.certificateStatus === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {record.certificateStatus === 'approved' ? '取得済み' : record.certificateStatus === 'pending' ? '申請中' : '未取得'}
                          </span>
                        </div>
                        {record.certificateStatus === 'not_requested' && (
                          <button
                            onClick={() => {
                              // 実務経験証明を依頼する処理
                              setExperienceRecords(experienceRecords.map(r => 
                                r.id === record.id ? { ...r, certificateStatus: 'pending' } : r
                              ));
                            }}
                            className="w-full mt-2 px-3 py-2 bg-[#8b5cf6] text-white rounded-md hover:bg-[#7c3aed] transition-colors text-xs font-bold flex items-center justify-center gap-2"
                          >
                            <FileCheck className="w-3 h-3" />
                            実務経験証明を依頼する
                          </button>
                        )}
                        {record.pdfUrl && (
                          <div className="mt-2 text-xs text-[#8b5cf6] font-bold">
                            ✓ PDFがアップロードされています
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {experienceRecords.length > 0 && (
                <button
                  onClick={() => {
                    setExperienceRecords([...experienceRecords, {
                      id: Date.now().toString(),
                      facilityName: '',
                      startDate: '',
                      endDate: '',
                      certificateStatus: 'not_requested',
                    }]);
                  }}
                  className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md hover:border-[#8b5cf6] hover:bg-[#8b5cf6]/5 transition-colors text-sm font-bold text-gray-600 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  職歴を追加
                </button>
              )}
            </div>
          </motion.div>

          {/* 学歴 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#8b5cf6]" />
              学歴
            </h2>

            <div className="space-y-4">
              {educationHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm mb-4">登録されている学歴がありません</p>
                  <button
                    onClick={() => {
                      setEducationHistory([...educationHistory, {
                        id: Date.now().toString(),
                        schoolName: '',
                        graduationDate: '',
                        degree: '',
                      }]);
                    }}
                    className="px-4 py-2 bg-[#8b5cf6] text-white rounded-md hover:bg-[#7c3aed] transition-colors font-bold text-sm flex items-center gap-2 mx-auto"
                  >
                    <Plus className="w-4 h-4" />
                    学歴を追加
                  </button>
                </div>
              ) : (
                educationHistory.map((edu) => (
                  <div key={edu.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">学校名</label>
                        <input
                          type="text"
                          value={edu.schoolName}
                          onChange={(e) => {
                            setEducationHistory(educationHistory.map(item => 
                              item.id === edu.id ? { ...item, schoolName: e.target.value } : item
                            ));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">卒業年月</label>
                        <input
                          type="month"
                          value={edu.graduationDate}
                          onChange={(e) => {
                            setEducationHistory(educationHistory.map(item => 
                              item.id === edu.id ? { ...item, graduationDate: e.target.value } : item
                            ));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">学位・資格</label>
                        <input
                          type="text"
                          value={edu.degree}
                          onChange={(e) => {
                            setEducationHistory(educationHistory.map(item => 
                              item.id === edu.id ? { ...item, degree: e.target.value } : item
                            ));
                          }}
                          placeholder="例：高等学校卒業"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent text-sm"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEducationHistory(educationHistory.filter(e => e.id !== edu.id));
                      }}
                      className="text-xs text-red-500 hover:text-red-700 font-bold"
                    >
                      削除
                    </button>
                  </div>
                ))
              )}
              {educationHistory.length > 0 && (
                <button
                  onClick={() => {
                    setEducationHistory([...educationHistory, {
                      id: Date.now().toString(),
                      schoolName: '',
                      graduationDate: '',
                      degree: '',
                    }]);
                  }}
                  className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md hover:border-[#8b5cf6] hover:bg-[#8b5cf6]/5 transition-colors text-sm font-bold text-gray-600 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  学歴を追加
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {activeTab === 'work' && (
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">業務</h2>
          <p className="text-gray-600">業務管理ツールは後で実装します</p>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">設定</h2>
          <p className="text-gray-600">設定機能は後で実装します</p>
        </div>
      )}

      {/* タブバー（画面下部） */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-around py-2">
            <button 
              onClick={() => setActiveTab('home')}
              className={`flex flex-col items-center gap-1 p-2 transition-colors ${
                activeTab === 'home' ? 'text-[#8b5cf6]' : 'text-gray-600 hover:text-[#8b5cf6]'
              }`}
            >
              <Briefcase className="w-6 h-6" />
              <span className="text-xs font-bold">ホーム</span>
            </button>
            <button 
              onClick={() => setActiveTab('career')}
              className={`flex flex-col items-center gap-1 p-2 transition-colors ${
                activeTab === 'career' ? 'text-[#8b5cf6]' : 'text-gray-600 hover:text-[#8b5cf6]'
              }`}
            >
              <Award className="w-6 h-6" />
              <span className="text-xs font-bold">キャリア</span>
            </button>
            <button 
              onClick={() => setActiveTab('work')}
              className={`flex flex-col items-center gap-1 p-2 transition-colors ${
                activeTab === 'work' ? 'text-[#8b5cf6]' : 'text-gray-600 hover:text-[#8b5cf6]'
              }`}
            >
              <FileText className="w-6 h-6" />
              <span className="text-xs font-bold">業務</span>
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center gap-1 p-2 transition-colors ${
                activeTab === 'settings' ? 'text-[#8b5cf6]' : 'text-gray-600 hover:text-[#8b5cf6]'
              }`}
            >
              <Settings className="w-6 h-6" />
              <span className="text-xs font-bold">設定</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
