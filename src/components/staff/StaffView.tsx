/**
 * スタッフ・シフト管理ビュー
 */

'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import Image from 'next/image';
import { CalendarCheck, Users, AlertCircle, Plus, Trash2, X, Upload, XCircle, Settings, RotateCw, Mail, Send } from 'lucide-react';
import { Staff, ScheduleItem, UserPermissions, StaffInvitation } from '@/types';
import { useFacilityData } from '@/hooks/useFacilityData';
import { isJapaneseHoliday } from '@/utils/japaneseHolidays';
import { hashPassword } from '@/utils/password';
import { supabase } from '@/lib/supabase';
import { inviteStaff } from '@/utils/staffInvitationService';
import { useAuth } from '@/contexts/AuthContext';
import { getInvitationBaseUrl } from '@/utils/domain';

const StaffView: React.FC = () => {
  const { staff, addStaff, updateStaff, deleteStaff, schedules, children, facilitySettings, saveShifts, fetchShifts } = useFacilityData();
  const { facility } = useAuth();
  const [subTab] = useState<'shift' | 'list'>('shift');
  
  // スタッフを並び順でソート（マネージャー→常勤→非常勤）
  const sortedStaff = useMemo(() => {
    return [...staff].sort((a, b) => {
      // 1. マネージャー優先
      if (a.role === 'マネージャー' && b.role !== 'マネージャー') return -1;
      if (a.role !== 'マネージャー' && b.role === 'マネージャー') return 1;
      // 2. 役職が同じ場合、常勤優先
      if (a.type === '常勤' && b.type === '非常勤') return -1;
      if (a.type === '非常勤' && b.type === '常勤') return 1;
      // 3. それ以外は名前順
      return a.name.localeCompare(b.name, 'ja');
    });
  }, [staff]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  
  // 招待フォーム用の状態
  const [inviteFormData, setInviteFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    role: '一般スタッフ' | 'マネージャー' | '管理者';
    employmentType: '常勤' | '非常勤';
    startDate: string;
    permissions: UserPermissions;
  }>({
    name: '',
    email: '',
    phone: '',
    role: '一般スタッフ',
    employmentType: '常勤',
    startDate: new Date().toISOString().split('T')[0],
    permissions: {
      dashboard: false,
      management: false,
      lead: false,
      schedule: false,
      children: false,
      staff: false,
      facility: false,
    },
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState<Record<string, Record<string, boolean>>>({}); // {staffId: {date: boolean}}
  const [isShiftPatternModalOpen, setIsShiftPatternModalOpen] = useState(false);
  const [shiftPatterns, setShiftPatterns] = useState<Record<string, boolean[]>>({}); // {staffId: [月, 火, 水, 木, 金, 土]}
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [permissions, setPermissions] = useState<UserPermissions>({
    dashboard: false,
    management: false,
    lead: false,
    schedule: false,
    children: false,
    staff: false,
    facility: false,
  });

  // 週間カレンダーの日付を生成
  const weekDates = useMemo(() => {
    const baseDate = new Date(currentDate);
    const currentDay = baseDate.getDay();
    const startOfWeek = new Date(baseDate);
    startOfWeek.setDate(baseDate.getDate() - currentDay + 1); // 月曜日を開始日とする

    // 日付をYYYY-MM-DD形式に変換するヘルパー関数（タイムゾーン問題を回避）
    const formatDate = (date: Date): string => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const dates: Array<{ date: string; label: string; day: string }> = [];
    const days = ['月', '火', '水', '木', '金', '土'];

    for (let i = 0; i < 6; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      dates.push({
        date: formatDate(date),
        label: `${day}(${days[i]})`,
        day: days[i],
      });
    }

    return dates;
  }, [currentDate]);

  // 週を変更
  const changeWeek = (offset: number) => {
    const newDate = new Date(weekDates[0].date);
    newDate.setDate(newDate.getDate() + offset * 7);
    setCurrentDate(newDate);
  };

  // 各日の利用児童数を計算
  const getChildCountByDate = (date: string): number => {
    const uniqueChildren = new Set(
      schedules.filter((s) => s.date === date).map((s) => s.childId)
    );
    return uniqueChildren.size;
  };

  // 休業日かどうかを判定
  const isHoliday = useCallback((dateStr: string): boolean => {
    // 日付を正しくパース（ローカルタイムゾーンで解釈）
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    
    // 期間ごとの定休日設定をチェック
    const holidayPeriods = facilitySettings.holidayPeriods || [];
    let matchedPeriod = null;
    
    for (const period of holidayPeriods) {
      if (!period.startDate) continue; // 開始日が設定されていない場合はスキップ
      
      // 日付文字列を直接比較（タイムゾーン問題を回避）
      const startDateStr = period.startDate;
      const endDateStr = period.endDate || '';
      
      // 期間内かどうかをチェック（文字列比較）
      if (dateStr >= startDateStr && (!endDateStr || dateStr <= endDateStr)) {
        matchedPeriod = period;
        break;
      }
    }
    
    // 期間設定がある場合は、その期間の定休日をチェック
    if (matchedPeriod) {
      if (matchedPeriod.regularHolidays.includes(dayOfWeek)) {
        return true;
      }
    } else {
      // 期間設定がない場合は、デフォルトの定休日をチェック
      if (facilitySettings.regularHolidays.includes(dayOfWeek)) {
        return true;
      }
    }
    
    // カスタム休業日チェック
    if (facilitySettings.customHolidays.includes(dateStr)) {
      return true;
    }
    
    // 祝日チェック（設定されている場合）
    if (facilitySettings.includeHolidays && isJapaneseHoliday(dateStr)) {
      return true;
    }
    
    return false;
  }, [facilitySettings.regularHolidays, facilitySettings.holidayPeriods, facilitySettings.customHolidays, facilitySettings.includeHolidays]);

  // シフトをトグル
  const toggleShift = useCallback((staffId: string, date: string) => {
    console.log('🔄 シフトをトグル:', staffId, date);
    setShifts((prev) => {
      const currentValue = prev[staffId]?.[date] || false;
      const newValue = !currentValue;
      
      const newShifts = {
        ...prev,
        [staffId]: {
          ...(prev[staffId] || {}),
          [date]: newValue,
        },
      };
      console.log('  新しいシフト状態:', newValue, '(スタッフ:', staffId, ', 日付:', date, ')');
      return newShifts;
    });
  }, []);

  // スタッフ追加フォームの状態
  const [formData, setFormData] = useState<Partial<Staff>>({
    name: '',
    nameKana: '',
    role: '一般スタッフ',
    type: '常勤',
    birthDate: '',
    gender: undefined,
    address: '',
    phone: '',
    email: '',
    qualifications: '',
    yearsOfExperience: undefined,
    qualificationCertificate: undefined,
    experienceCertificate: undefined,
    emergencyContact: '',
    emergencyContactPhone: '',
    memo: '',
    monthlySalary: undefined,
    hourlyWage: undefined,
  });

  // 画像プレビュー用の状態
  const [qualificationPreview, setQualificationPreview] = useState<string | null>(null);
  const [experiencePreview, setExperiencePreview] = useState<string | null>(null);
  const qualificationFileInputRef = useRef<HTMLInputElement>(null);
  const experienceFileInputRef = useRef<HTMLInputElement>(null);

  // 画像をBase64に変換
  const handleImageUpload = (
    file: File,
    callback: (base64: string) => void,
    previewCallback: (preview: string) => void
  ) => {
    if (file.size > 5 * 1024 * 1024) {
      alert('画像サイズは5MB以下にしてください');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      callback(base64String);
      previewCallback(base64String);
    };
    reader.readAsDataURL(file);
  };

  // 資格証画像をアップロード
  const handleQualificationUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(
        file,
        (base64) => setFormData({ ...formData, qualificationCertificate: base64 }),
        setQualificationPreview
      );
    }
  };

  // 実務経験証明書画像をアップロード
  const handleExperienceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(
        file,
        (base64) => setFormData({ ...formData, experienceCertificate: base64 }),
        setExperiencePreview
      );
    }
  };

  // 画像を削除
  const removeQualificationImage = () => {
    setFormData({ ...formData, qualificationCertificate: undefined });
    setQualificationPreview(null);
    if (qualificationFileInputRef.current) {
      qualificationFileInputRef.current.value = '';
    }
  };

  const removeExperienceImage = () => {
    setFormData({ ...formData, experienceCertificate: undefined });
    setExperiencePreview(null);
    if (experienceFileInputRef.current) {
      experienceFileInputRef.current.value = '';
    }
  };

  // フォームをリセット
  const resetForm = () => {
    setFormData({
      name: '',
      nameKana: '',
      role: '一般スタッフ',
      type: '常勤',
      birthDate: '',
      gender: undefined,
      address: '',
      phone: '',
      email: '',
      qualifications: '',
      yearsOfExperience: undefined,
      qualificationCertificate: undefined,
      experienceCertificate: undefined,
      emergencyContact: '',
      emergencyContactPhone: '',
      memo: '',
      monthlySalary: undefined,
      hourlyWage: undefined,
    });
    setLoginId('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPermissions({
      dashboard: false,
      management: false,
      lead: false,
      schedule: false,
      children: false,
      staff: false,
      facility: false,
    });
    setQualificationPreview(null);
    setExperiencePreview(null);
    if (qualificationFileInputRef.current) {
      qualificationFileInputRef.current.value = '';
    }
    if (experienceFileInputRef.current) {
      experienceFileInputRef.current.value = '';
    }
  };

  // スタッフを編集開始
  const handleEditStaff = async (staff: Staff) => {
    setEditingStaff(staff);
    setFormData({
      name: staff.name,
      nameKana: staff.nameKana || '',
      role: staff.role,
      type: staff.type,
      birthDate: staff.birthDate || '',
      gender: staff.gender,
      address: staff.address || '',
      phone: staff.phone || '',
      email: staff.email || '',
      qualifications: staff.qualifications || '',
      yearsOfExperience: staff.yearsOfExperience,
      qualificationCertificate: staff.qualificationCertificate,
      experienceCertificate: staff.experienceCertificate,
      emergencyContact: staff.emergencyContact || '',
      emergencyContactPhone: staff.emergencyContactPhone || '',
      memo: staff.memo || '',
      monthlySalary: staff.monthlySalary,
      hourlyWage: staff.hourlyWage,
    });
    setQualificationPreview(staff.qualificationCertificate || null);
    setExperiencePreview(staff.experienceCertificate || null);
    
    // 既存のユーザーアカウント情報を取得
    if (staff.user_id) {
      const { data: userData } = await supabase
        .from('users')
        .select('login_id, permissions')
        .eq('id', staff.user_id)
        .single();
      
      if (userData) {
        setLoginId(userData.login_id || '');
        setPermissions((userData.permissions as UserPermissions) || {
          dashboard: false,
          management: false,
          lead: false,
          schedule: false,
          children: false,
          staff: false,
          facility: false,
        });
      } else {
        // user_idはあるがusersテーブルに存在しない場合
        setLoginId('');
        setPermissions({
          dashboard: false,
          management: false,
          lead: false,
          schedule: false,
          children: false,
          staff: false,
          facility: false,
        });
      }
    } else {
      // user_idがない場合、スタッフ名でusersテーブルを検索（後方互換性）
      const { data: userDataByName } = await supabase
        .from('users')
        .select('login_id, permissions')
        .eq('facility_id', staff.facilityId)
        .eq('name', staff.name)
        .eq('role', 'staff')
        .maybeSingle();
      
      if (userDataByName) {
        setLoginId(userDataByName.login_id || '');
        setPermissions((userDataByName.permissions as UserPermissions) || {
          dashboard: false,
          management: false,
          lead: false,
          schedule: false,
          children: false,
          staff: false,
          facility: false,
        });
      } else {
        setLoginId('');
        setPermissions({
          dashboard: false,
          management: false,
          lead: false,
          schedule: false,
          children: false,
          staff: false,
          facility: false,
        });
      }
    }
    
    setIsEditModalOpen(true);
  };

  // スタッフを更新
  const handleUpdateStaff = async () => {
    if (!editingStaff) return;
    if (!formData.name || !formData.name.trim()) {
      alert('氏名を入力してください');
      return;
    }
    if (!formData.role) {
      alert('役職を選択してください');
      return;
    }
    if (!formData.type) {
      alert('雇用形態を選択してください');
      return;
    }

    // ログインIDとパスワードが入力されている場合は検証
    if (loginId.trim() || password || confirmPassword) {
      if (!loginId.trim()) {
        alert('ログインIDを入力してください');
        return;
      }
      // パスワードが入力されている場合のみ検証
      if (password) {
        if (password.length < 6) {
          alert('パスワードは6文字以上で入力してください');
          return;
        }
        if (password !== confirmPassword) {
          alert('パスワードが一致しません');
          return;
        }
      }
    }

    try {
      const updateData: any = {
        name: formData.name.trim(),
        nameKana: formData.nameKana?.trim() || undefined,
        role: formData.role as Staff['role'],
        type: formData.type as Staff['type'],
        birthDate: formData.birthDate || undefined,
        gender: formData.gender,
        address: formData.address?.trim() || undefined,
        phone: formData.phone?.trim() || undefined,
        email: formData.email?.trim() || undefined,
        qualifications: formData.qualifications?.trim() || undefined,
        yearsOfExperience: formData.yearsOfExperience,
        qualificationCertificate: formData.qualificationCertificate,
        experienceCertificate: formData.experienceCertificate,
        emergencyContact: formData.emergencyContact?.trim() || undefined,
        emergencyContactPhone: formData.emergencyContactPhone?.trim() || undefined,
        memo: formData.memo?.trim() || undefined,
        monthlySalary: formData.monthlySalary,
        hourlyWage: formData.hourlyWage,
      };

      // ログインIDが入力されている場合はusersテーブルにアカウントを作成/更新
      if (loginId.trim()) {
        // 既存のユーザーアカウントを検索（staff.user_idまたはlogin_idで検索）
        let userId: string | null = null;
        
        if (editingStaff.user_id) {
          const { data: existingUserById } = await supabase
            .from('users')
            .select('id')
            .eq('id', editingStaff.user_id)
            .single();
          userId = existingUserById?.id || null;
        }
        
        // user_idで見つからない場合、login_idで検索
        if (!userId) {
          const { data: existingUserByLoginId } = await supabase
            .from('users')
            .select('id')
            .eq('facility_id', editingStaff.facilityId)
            .eq('login_id', loginId.trim())
            .single();
          userId = existingUserByLoginId?.id || null;
        }

        // 新しいIDを生成
        if (!userId) {
          userId = `user-${Date.now()}`;
        }

        const updateData: any = {
          facility_id: editingStaff.facilityId,
          name: editingStaff.name,
          login_id: loginId.trim(),
          email: editingStaff.email || null,
          role: 'staff',
          has_account: true,
          permissions: permissions,
          updated_at: new Date().toISOString(),
        };

        // パスワードが入力されている場合はハッシュ化して設定
        if (password) {
          const passwordHash = await hashPassword(password);
          updateData.password_hash = passwordHash;
        }

        // 既存のアカウントがある場合は更新
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', userId)
          .single();

        if (existingUser) {
          // 既存のアカウントを更新
          const { error: userError } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId);

          if (userError) {
            throw new Error(`アカウントの更新に失敗しました: ${userError.message}`);
          }
        } else {
          // 新しいアカウントを作成
          updateData.id = userId;
          updateData.created_at = new Date().toISOString();
          
          const { error: userError } = await supabase
            .from('users')
            .insert(updateData);

          if (userError) {
            throw new Error(`アカウントの作成に失敗しました: ${userError.message}`);
          }

          // staffテーブルにuser_idを紐付け
          await supabase
            .from('staff')
            .update({ user_id: userId })
            .eq('id', editingStaff.id);
        }
      }

      await updateStaff(editingStaff.id, updateData);

      setIsEditModalOpen(false);
      setEditingStaff(null);
      resetForm();
      alert('スタッフ情報を更新しました');
    } catch (error) {
      console.error('Error updating staff:', error);
      alert('スタッフ情報の更新に失敗しました');
    }
  };

  // スタッフを追加
  const handleAddStaff = async () => {
    if (!formData.name || !formData.name.trim()) {
      alert('氏名を入力してください');
      return;
    }
    if (!formData.role) {
      alert('役職を選択してください');
      return;
    }
    if (!formData.type) {
      alert('雇用形態を選択してください');
      return;
    }

    try {
      await addStaff({
        name: formData.name.trim(),
        nameKana: formData.nameKana?.trim() || undefined,
        role: formData.role as Staff['role'],
        type: formData.type as Staff['type'],
        birthDate: formData.birthDate || undefined,
        gender: formData.gender,
        address: formData.address?.trim() || undefined,
        phone: formData.phone?.trim() || undefined,
        email: formData.email?.trim() || undefined,
        qualifications: formData.qualifications?.trim() || undefined,
        yearsOfExperience: formData.yearsOfExperience,
        qualificationCertificate: formData.qualificationCertificate,
        experienceCertificate: formData.experienceCertificate,
        emergencyContact: formData.emergencyContact?.trim() || undefined,
        emergencyContactPhone: formData.emergencyContactPhone?.trim() || undefined,
        memo: formData.memo?.trim() || undefined,
        monthlySalary: formData.monthlySalary,
        hourlyWage: formData.hourlyWage,
      });

      resetForm();
      setIsAddModalOpen(false);
      alert('スタッフを追加しました');
    } catch (error) {
      console.error('Error adding staff:', error);
      alert('スタッフの追加に失敗しました');
    }
  };

  // スタッフを削除
  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    if (confirm(`${staffName}さんを削除しますか？`)) {
      try {
        await deleteStaff(staffId);
        alert('スタッフを削除しました');
      } catch (error) {
        console.error('Error deleting staff:', error);
        alert('スタッフの削除に失敗しました');
      }
    }
  };

  // 基本シフトパターンモーダルを開く
  const handleOpenShiftPatternModal = () => {
    // 既存のパターンを読み込む
    const patterns: Record<string, boolean[]> = {};
    sortedStaff.forEach((s) => {
      patterns[s.id] = s.defaultShiftPattern || [false, false, false, false, false, false];
    });
    setShiftPatterns(patterns);
    setIsShiftPatternModalOpen(true);
  };

  // シフトパターンを更新
  const handleUpdateShiftPattern = (staffId: string, dayIndex: number) => {
    setShiftPatterns((prev) => {
      const newPattern = [...(prev[staffId] || [false, false, false, false, false, false])];
      newPattern[dayIndex] = !newPattern[dayIndex];
      return {
        ...prev,
        [staffId]: newPattern,
      };
    });
  };

  // シフトパターンを保存
  const handleSaveShiftPatterns = async () => {
    try {
      for (const [staffId, pattern] of Object.entries(shiftPatterns)) {
        await updateStaff(staffId, { defaultShiftPattern: pattern });
      }
      setIsShiftPatternModalOpen(false);
      alert('基本シフトパターンを保存しました');
    } catch (error) {
      console.error('Error saving shift patterns:', error);
      alert('基本シフトパターンの保存に失敗しました');
    }
  };

  // 基本シフトパターンを一括反映
  const handleApplyShiftPatterns = () => {
    const newShifts: Record<string, Record<string, boolean>> = { ...shifts };
    
    sortedStaff.forEach((s) => {
      const pattern = s.defaultShiftPattern || [false, false, false, false, false, false];
      if (!newShifts[s.id]) {
        newShifts[s.id] = {};
      }
      
      weekDates.forEach((d, index) => {
        if (index < pattern.length) {
          // 休業日でない場合のみ適用
          if (!isHoliday(d.date)) {
            newShifts[s.id][d.date] = pattern[index];
          }
        }
      });
    });
    
    setShifts(newShifts);
    alert('基本シフトパターンを一括反映しました');
  };

  // シフトデータを保存
  const handleSaveShifts = async () => {
    try {
      await saveShifts(shifts);
      alert('シフトを保存しました');
    } catch (error) {
      console.error('Error saving shifts:', error);
      alert('シフトの保存に失敗しました。もう一度お試しください。');
    }
  };

  // シフトデータを取得（初回のみ、または週が変更されたときのみ）
  const currentWeekRangeRef = useRef<string>('');
  
  React.useEffect(() => {
    const loadShifts = async () => {
      if (weekDates.length > 0) {
        const startDate = weekDates[0].date;
        const endDate = weekDates[weekDates.length - 1].date;
        const weekRange = `${startDate}_${endDate}`;
        
        // 週が変更された場合のみ取得（refで比較して無限ループを防ぐ）
        if (weekRange !== currentWeekRangeRef.current) {
          console.log('🕐 シフトデータを取得中...', startDate, '～', endDate);
          const fetchedShifts = await fetchShifts(startDate, endDate);
          console.log('✅ シフトデータ取得成功:', Object.keys(fetchedShifts).length, '名分');
          setShifts(fetchedShifts);
          currentWeekRangeRef.current = weekRange;
        }
      }
    };
    loadShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekDates.length > 0 ? `${weekDates[0].date}_${weekDates[weekDates.length - 1].date}` : '']);


  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">シフト管理</h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            配置基準を満たすためのシフト作成を行います。
          </p>
        </div>
      </div>

      {subTab === 'shift' ? (
        /* Shift Management Tab */
        <div className="space-y-6">
          {/* シフト設定カレンダー */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {/* Info Bar: Child Count Check */}
            <div className="bg-[#e0f7fa] p-2 sm:p-3 border-b border-[#b2ebf2] flex items-center space-x-2 text-xs sm:text-sm text-[#006064]">
              <AlertCircle size={14} className="sm:w-[18px] sm:h-[18px] shrink-0" />
              <span className="leading-tight">
                各日の「利用児童数」を確認しながらシフトを配置してください。児童10名につき2名の配置が必要です。
              </span>
            </div>

            {/* 週選択コントロール */}
            <div className="p-3 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gray-50">
              <div className="flex items-center space-x-2 sm:space-x-4">
                <button
                  onClick={() => changeWeek(-1)}
                  className="px-2 py-1 text-gray-600 hover:bg-gray-200 rounded transition-colors text-sm"
                >
                  ←
                </button>
                <h3 className="font-bold text-sm sm:text-base text-gray-800">
                  {weekDates[0].date.split('-')[1]}月 {weekDates[0].date.split('-')[2]}日 ～{' '}
                  {weekDates[5].date.split('-')[1]}月 {weekDates[5].date.split('-')[2]}日
                </h3>
                <button
                  onClick={() => changeWeek(1)}
                  className="px-2 py-1 text-gray-600 hover:bg-gray-200 rounded transition-colors text-sm"
                >
                  →
                </button>
              </div>
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <button
                  onClick={handleOpenShiftPatternModal}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md text-xs sm:text-sm font-bold transition-colors flex items-center justify-center"
                >
                  <Settings size={14} className="mr-1 sm:mr-2 shrink-0" />
                  <span className="hidden sm:inline">基本シフトパターン設定</span>
                  <span className="sm:hidden">パターン設定</span>
                </button>
                <button
                  onClick={handleApplyShiftPatterns}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white rounded-md text-xs sm:text-sm font-bold transition-colors flex items-center justify-center"
                >
                  <RotateCw size={14} className="mr-1 sm:mr-2 shrink-0" />
                  <span className="hidden sm:inline">パターン一括反映</span>
                  <span className="sm:hidden">一括反映</span>
                </button>
                <button
                  onClick={handleSaveShifts}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md text-xs sm:text-sm font-bold transition-colors flex items-center justify-center"
                >
                  <CalendarCheck size={14} className="mr-1 sm:mr-2 shrink-0" />
                  <span className="hidden sm:inline">シフトを保存</span>
                  <span className="sm:hidden">保存</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 border-b border-r border-gray-100 bg-gray-50 min-w-[100px] sm:min-w-[120px] text-gray-500 font-bold text-xs sticky left-0 z-10">
                      スタッフ / 日付
                    </th>
                    {weekDates.map((d) => {
                      const childCount = getChildCountByDate(d.date);
                      const isBusy = childCount >= 8;
                      const isHolidayDay = isHoliday(d.date);

                      return (
                        <th
                          key={d.date}
                          className={`p-1.5 border-b border-r border-gray-100 text-center min-w-[70px] sm:min-w-[85px] ${
                            isHolidayDay
                              ? 'bg-red-50'
                              : isBusy
                              ? 'bg-orange-50'
                              : 'bg-gray-50'
                          }`}
                        >
                          <div className={`font-bold text-xs ${isHolidayDay ? 'text-red-600' : 'text-gray-700'} leading-tight`}>
                            {d.label}
                          </div>
                          {isHolidayDay ? (
                            <div className="text-[9px] mt-0.5 font-normal text-red-600 leading-none">休業</div>
                          ) : (
                            <div className="text-[9px] mt-0.5 font-normal text-gray-500 leading-none">
                              児童:{' '}
                              <span className={`font-bold ${isBusy ? 'text-orange-600' : ''}`}>
                                {childCount}名
                              </span>
                            </div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortedStaff.map((s: Staff) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="p-2 border-b border-r border-gray-100 bg-white sticky left-0 z-10">
                        <div className="font-bold text-gray-800 text-xs leading-tight">{s.name}</div>
                        <div className="text-[9px] text-gray-500 leading-tight">
                          {s.role} ({s.type})
                        </div>
                      </td>
                      {weekDates.map((d) => {
                        const hasShift = shifts[s.id]?.[d.date] || false;
                        const isHolidayDay = isHoliday(d.date);
                        return (
                          <td
                            key={`${s.id}-${d.date}`}
                            className={`p-0.5 border-b border-r border-gray-100 text-center ${
                              isHolidayDay ? 'bg-red-50' : 'bg-white'
                            }`}
                          >
                            {isHolidayDay ? (
                              <div className="w-full py-1 px-0.5 rounded bg-red-100 text-red-600 cursor-not-allowed opacity-60">
                                <div className="text-sm font-bold leading-none">-</div>
                                <div className="text-[8px] mt-0.5 leading-none">休業</div>
                              </div>
                            ) : (
                              <button
                                onClick={() => toggleShift(s.id, d.date)}
                                className={`w-full py-1 px-0.5 rounded transition-all ${
                                  hasShift
                                    ? 'bg-[#00c4cc] text-white hover:bg-[#00b0b8]'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                              >
                                <div className="text-sm font-bold leading-none">{hasShift ? '◯' : '-'}</div>
                                {hasShift && (
                                  <div className="text-[8px] mt-0.5 opacity-90 leading-none">9:00~17:00</div>
                                )}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Total Staff Count Row */}
                  <tr className="bg-gray-50 font-bold text-gray-600">
                    <td className="p-2 border-r border-gray-100 text-[9px] uppercase tracking-wider sticky left-0 z-10">
                      配置人数合計
                    </td>
                    {weekDates.map((d) => {
                      const count = sortedStaff.filter((s) => shifts[s.id]?.[d.date]).length;
                      return (
                        <td
                          key={`total-${d.date}`}
                          className="p-1 border-r border-gray-100 text-center text-[9px] text-gray-400"
                        >
                          {count} 名
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 利用児童カレンダー */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-2 sm:p-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-bold text-sm sm:text-base text-gray-800">利用児童カレンダー</h3>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">各日の利用予定児童数を確認できます</p>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[600px] sm:min-w-[700px]">
                {/* ヘッダー */}
                <div className="flex border-b border-gray-200 sticky top-0 bg-gray-50 z-10">
                  <div className="w-12 sm:w-16 p-1.5 sm:p-2 shrink-0 border-r border-gray-200 text-xs text-center font-bold text-gray-500 flex items-center justify-center">
                    区分
                  </div>
                  {weekDates.map((d, i) => {
                    const isHolidayDay = isHoliday(d.date);
                    const childCount = getChildCountByDate(d.date);
                    const isBusy = childCount >= 8;
                    return (
                      <div
                        key={i}
                        className={`flex-1 p-1.5 sm:p-2 text-center border-r border-gray-200 text-xs sm:text-sm font-bold ${
                          isHolidayDay
                            ? 'text-red-600 bg-red-50'
                            : i >= 5
                            ? 'text-red-500'
                            : 'text-gray-700'
                        } ${isBusy ? 'bg-orange-50' : ''}`}
                      >
                        <div className="leading-tight">{d.date.split('-')[2]} ({d.day})</div>
                        {isHolidayDay ? (
                          <div className="text-[9px] text-red-600 mt-0.5 leading-none">休業</div>
                        ) : (
                          <div className="text-[9px] text-gray-500 mt-0.5 leading-none">
                            利用: {childCount}名
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* 午前行 */}
                <div className="flex border-b border-gray-200 min-h-[80px] sm:min-h-[100px]">
                  <div className="w-12 sm:w-16 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col justify-center text-center p-1">
                    <div className="text-xs font-bold text-gray-600">午前</div>
                    <div className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 leading-none">定員{facilitySettings.capacity.AM}</div>
                  </div>
                  {weekDates.map((d, i) => {
                    const items = schedules.filter((s) => s.date === d.date && s.slot === 'AM');
                    const isHolidayDay = isHoliday(d.date);
                    return (
                      <div
                        key={i}
                        className={`flex-1 p-0.5 sm:p-1 border-r border-gray-100 transition-colors ${
                          isHolidayDay
                            ? 'bg-red-50 cursor-not-allowed opacity-60'
                            : 'bg-white'
                        }`}
                      >
                        {isHolidayDay ? (
                          <div className="text-[9px] sm:text-[10px] text-red-600 text-center mt-1 leading-none">休業</div>
                        ) : (
                          items.map((item) => (
                            <div
                              key={item.id}
                              className="mb-0.5 sm:mb-1 border rounded px-1 sm:px-1.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium shadow-sm bg-[#e0f7fa] border-[#b2ebf2] text-[#006064]"
                            >
                              <div className="font-bold truncate leading-tight">{item.childName}</div>
                              <div className="flex gap-0.5 sm:gap-1 mt-0.5">
                                {item.hasPickup && (
                                  <span className="px-0.5 sm:px-1 rounded-[2px] text-[8px] sm:text-[9px] font-bold border bg-white/80 text-[#006064] border-[#b2ebf2] leading-none">
                                    迎
                                  </span>
                                )}
                                {item.hasDropoff && (
                                  <span className="px-0.5 sm:px-1 rounded-[2px] text-[8px] sm:text-[9px] font-bold border bg-white/80 text-[#006064] border-[#b2ebf2] leading-none">
                                    送
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* 午後行 */}
                <div className="flex min-h-[100px] sm:min-h-[150px]">
                  <div className="w-12 sm:w-16 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col justify-center text-center p-1">
                    <div className="text-xs font-bold text-gray-600">午後</div>
                    <div className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 leading-none">定員{facilitySettings.capacity.PM}</div>
                  </div>
                  {weekDates.map((d, i) => {
                    const items = schedules.filter((s) => s.date === d.date && s.slot === 'PM');
                    const isHolidayDay = isHoliday(d.date);
                    return (
                      <div
                        key={i}
                        className={`flex-1 p-0.5 sm:p-1 border-r border-gray-100 transition-colors ${
                          isHolidayDay
                            ? 'bg-red-50 cursor-not-allowed opacity-60'
                            : 'bg-white'
                        }`}
                      >
                        {isHolidayDay ? (
                          <div className="text-[9px] sm:text-[10px] text-red-600 text-center mt-1 leading-none">休業</div>
                        ) : (
                          items.map((item) => (
                            <div
                              key={item.id}
                              className="mb-0.5 sm:mb-1 border rounded px-1 sm:px-1.5 py-0.5 sm:py-1 text-[10px] sm:text-xs shadow-sm bg-orange-50 border-orange-100 text-orange-900"
                            >
                              <div className="font-bold truncate leading-tight">{item.childName}</div>
                              <div className="flex gap-0.5 sm:gap-1 mt-0.5">
                                {item.hasPickup && (
                                  <span className="px-0.5 sm:px-1 rounded-[2px] text-[8px] sm:text-[9px] font-bold border bg-white/80 text-orange-600 border-orange-100 leading-none">
                                    迎
                                  </span>
                                )}
                                {item.hasDropoff && (
                                  <span className="px-0.5 sm:px-1 rounded-[2px] text-[8px] sm:text-[9px] font-bold border bg-white/80 text-orange-600 border-orange-100 leading-none">
                                    送
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Staff Master List Tab */
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex justify-between mb-4">
            <h3 className="font-bold text-lg text-gray-800">登録スタッフ一覧</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white px-4 py-2 rounded-md text-sm font-bold shadow-sm transition-colors flex items-center"
              >
                <Send size={16} className="mr-2" /> 招待
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-bold shadow-sm transition-colors flex items-center"
              >
                <Plus size={16} className="mr-2" /> 追加
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedStaff.map((s: Staff) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow bg-white"
              >
                <div className="flex items-center space-x-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 border border-gray-200">
                    {s.name[0]}
                  </div>
                  <div className="flex-1">
                    <button
                      onClick={() => handleEditStaff(s)}
                      className="font-bold text-sm text-gray-800 hover:text-[#00c4cc] transition-colors text-left w-full"
                    >
                      {s.name}
                    </button>
                    <div className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded inline-block mt-0.5">
                      {s.role} / {s.type}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteStaff(s.id, s.name)}
                  className="text-gray-300 hover:text-red-500 transition-colors ml-2"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* スタッフ追加モーダル */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-2xl shadow-2xl border border-gray-100 my-8">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="font-bold text-lg text-gray-800 flex items-center">
                <Plus size={20} className="mr-2 text-[#00c4cc]" />
                スタッフ追加
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* 基本情報 */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-gray-700 border-b border-gray-200 pb-2">
                  基本情報
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">
                      氏名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="山田 太郎"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">フリガナ</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                      value={formData.nameKana || ''}
                      onChange={(e) => setFormData({ ...formData, nameKana: e.target.value })}
                      placeholder="ヤマダ タロウ"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">生年月日</label>
                    <input
                      type="date"
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                      value={formData.birthDate || ''}
                      onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">性別</label>
                    <select
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                      value={formData.gender || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          gender: e.target.value as '男性' | '女性' | 'その他' | undefined,
                        })
                      }
                    >
                      <option value="">選択してください</option>
                      <option value="男性">男性</option>
                      <option value="女性">女性</option>
                      <option value="その他">その他</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">経験年数</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                      value={formData.yearsOfExperience || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          yearsOfExperience: e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                      placeholder="5"
                    />
                  </div>
                </div>
              </div>

              {/* 連絡先情報 */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-gray-700 border-b border-gray-200 pb-2">
                  連絡先情報
                </h4>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1.5">住所</label>
                  <input
                    type="text"
                    className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="東京都渋谷区..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">電話番号</label>
                    <input
                      type="tel"
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="03-1234-5678"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">
                      メールアドレス
                    </label>
                    <input
                      type="email"
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="example@email.com"
                    />
                  </div>
                </div>
              </div>

              {/* 緊急連絡先 */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-gray-700 border-b border-gray-200 pb-2">
                  緊急連絡先
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">
                      緊急連絡先氏名
                    </label>
                    <input
                      type="text"
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                      value={formData.emergencyContact || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, emergencyContact: e.target.value })
                      }
                      placeholder="山田 花子"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">
                      緊急連絡先電話番号
                    </label>
                    <input
                      type="tel"
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                      value={formData.emergencyContactPhone || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, emergencyContactPhone: e.target.value })
                      }
                      placeholder="03-1234-5678"
                    />
                  </div>
                </div>
              </div>

              {/* 職務情報 */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-gray-700 border-b border-gray-200 pb-2">
                  職務情報
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">
                      役職 <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                      value={formData.role || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          role: e.target.value as Staff['role'],
                        })
                      }
                    >
                      <option value="一般スタッフ">一般スタッフ</option>
                      <option value="マネージャー">マネージャー</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">
                      雇用形態 <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                      value={formData.type || ''}
                      onChange={(e) => {
                        const newType = e.target.value as Staff['type'];
                        setFormData({
                          ...formData,
                          type: newType,
                          // 雇用形態が変更されたら、もう一方の給与をクリア
                          monthlySalary: newType === '常勤' ? formData.monthlySalary : undefined,
                          hourlyWage: newType === '非常勤' ? formData.hourlyWage : undefined,
                        });
                      }}
                    >
                      <option value="常勤">常勤</option>
                      <option value="非常勤">非常勤</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1.5">資格</label>
                  <input
                    type="text"
                    className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                    value={formData.qualifications || ''}
                    onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
                    placeholder="保育士資格、児童指導員任用資格など"
                  />
                </div>
                {/* 給与 */}
                <div>
                  {formData.type === '常勤' ? (
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1.5">月給</label>
                      <div className="flex items-center">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                          value={formData.monthlySalary || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              monthlySalary: e.target.value ? parseInt(e.target.value) : undefined,
                              hourlyWage: undefined, // 常勤の場合、時給をクリア
                            })
                          }
                          placeholder="300000"
                        />
                        <span className="ml-2 text-sm text-gray-600">円</span>
                      </div>
                    </div>
                  ) : formData.type === '非常勤' ? (
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1.5">時給</label>
                      <div className="flex items-center">
                        <input
                          type="number"
                          min="0"
                          step="10"
                          className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                          value={formData.hourlyWage || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              hourlyWage: e.target.value ? parseInt(e.target.value) : undefined,
                              monthlySalary: undefined, // 非常勤の場合、月給をクリア
                            })
                          }
                          placeholder="1500"
                        />
                        <span className="ml-2 text-sm text-gray-600">円</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* 証明書アップロード */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-gray-700 border-b border-gray-200 pb-2">
                  証明書
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 資格証 */}
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">
                      資格証
                    </label>
                    <div className="space-y-2">
                      {qualificationPreview ? (
                        <div className="relative">
                          <Image
                            src={qualificationPreview}
                            alt="資格証プレビュー"
                            width={400}
                            height={192}
                            className="w-full h-48 object-contain border border-gray-300 rounded-md bg-gray-50"
                            unoptimized
                          />
                          <button
                            type="button"
                            onClick={removeQualificationImage}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                          >
                            <XCircle size={20} />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload size={24} className="text-gray-400 mb-2" />
                            <p className="text-xs text-gray-500">画像をアップロード</p>
                            <p className="text-[10px] text-gray-400 mt-1">PNG, JPG (最大5MB)</p>
                          </div>
                          <input
                            ref={qualificationFileInputRef}
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleQualificationUpload}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* 実務経験証明書 */}
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">
                      実務経験証明書
                    </label>
                    <div className="space-y-2">
                      {experiencePreview ? (
                        <div className="relative">
                          <Image
                            src={experiencePreview}
                            alt="実務経験証明書プレビュー"
                            width={400}
                            height={192}
                            className="w-full h-48 object-contain border border-gray-300 rounded-md bg-gray-50"
                            unoptimized
                          />
                          <button
                            type="button"
                            onClick={removeExperienceImage}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                          >
                            <XCircle size={20} />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload size={24} className="text-gray-400 mb-2" />
                            <p className="text-xs text-gray-500">画像をアップロード</p>
                            <p className="text-[10px] text-gray-400 mt-1">PNG, JPG (最大5MB)</p>
                          </div>
                          <input
                            ref={experienceFileInputRef}
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleExperienceUpload}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 備考 */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-gray-700 border-b border-gray-200 pb-2">
                  備考
                </h4>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1.5">備考</label>
                  <textarea
                    className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc] min-h-[100px] resize-y"
                    value={formData.memo || ''}
                    onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                    placeholder="その他の情報やメモを入力してください"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    resetForm();
                  }}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-md text-sm transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddStaff}
                  className="flex-1 py-2.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-md shadow-md text-sm transition-all"
                >
                  登録する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* スタッフ編集モーダル */}
      {isEditModalOpen && editingStaff && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-2xl shadow-2xl border border-gray-100 my-8">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="font-bold text-lg text-gray-800 flex items-center">
                <Plus size={20} className="mr-2 text-[#00c4cc]" />
                スタッフ編集
              </h3>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingStaff(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* 基本情報 */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-gray-700 border-b border-gray-200 pb-2">
                  基本情報
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">
                      氏名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="山田 太郎"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">フリガナ</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                      value={formData.nameKana || ''}
                      onChange={(e) => setFormData({ ...formData, nameKana: e.target.value })}
                      placeholder="ヤマダ タロウ"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">生年月日</label>
                    <input
                      type="date"
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                      value={formData.birthDate || ''}
                      onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">性別</label>
                    <select
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                      value={formData.gender || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          gender: e.target.value as '男性' | '女性' | 'その他' | undefined,
                        })
                      }
                    >
                      <option value="">選択してください</option>
                      <option value="男性">男性</option>
                      <option value="女性">女性</option>
                      <option value="その他">その他</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">経験年数</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                      value={formData.yearsOfExperience || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          yearsOfExperience: e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                      placeholder="5"
                    />
                  </div>
                </div>
              </div>

              {/* 連絡先情報 */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-gray-700 border-b border-gray-200 pb-2">
                  連絡先情報
                </h4>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1.5">住所</label>
                  <input
                    type="text"
                    className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="東京都渋谷区..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">電話番号</label>
                    <input
                      type="tel"
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="03-1234-5678"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">
                      メールアドレス
                    </label>
                    <input
                      type="email"
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="example@email.com"
                    />
                  </div>
                </div>
              </div>

              {/* 緊急連絡先 */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-gray-700 border-b border-gray-200 pb-2">
                  緊急連絡先
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">
                      緊急連絡先氏名
                    </label>
                    <input
                      type="text"
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                      value={formData.emergencyContact || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, emergencyContact: e.target.value })
                      }
                      placeholder="山田 花子"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">
                      緊急連絡先電話番号
                    </label>
                    <input
                      type="tel"
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                      value={formData.emergencyContactPhone || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, emergencyContactPhone: e.target.value })
                      }
                      placeholder="03-1234-5678"
                    />
                  </div>
                </div>
              </div>

              {/* 職務情報 */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-gray-700 border-b border-gray-200 pb-2">
                  職務情報
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">
                      役職 <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                      value={formData.role || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          role: e.target.value as Staff['role'],
                        })
                      }
                    >
                      <option value="一般スタッフ">一般スタッフ</option>
                      <option value="マネージャー">マネージャー</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">
                      雇用形態 <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                      value={formData.type || ''}
                      onChange={(e) => {
                        const newType = e.target.value as Staff['type'];
                        setFormData({
                          ...formData,
                          type: newType,
                          // 雇用形態が変更されたら、もう一方の給与をクリア
                          monthlySalary: newType === '常勤' ? formData.monthlySalary : undefined,
                          hourlyWage: newType === '非常勤' ? formData.hourlyWage : undefined,
                        });
                      }}
                    >
                      <option value="常勤">常勤</option>
                      <option value="非常勤">非常勤</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1.5">資格</label>
                  <input
                    type="text"
                    className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                    value={formData.qualifications || ''}
                    onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
                    placeholder="保育士資格、児童指導員任用資格など"
                  />
                </div>
                {/* 給与 */}
                <div>
                  {formData.type === '常勤' ? (
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1.5">月給</label>
                      <div className="flex items-center">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                          value={formData.monthlySalary || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              monthlySalary: e.target.value ? parseInt(e.target.value) : undefined,
                              hourlyWage: undefined, // 常勤の場合、時給をクリア
                            })
                          }
                          placeholder="300000"
                        />
                        <span className="ml-2 text-sm text-gray-600">円</span>
                      </div>
                    </div>
                  ) : formData.type === '非常勤' ? (
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1.5">時給</label>
                      <div className="flex items-center">
                        <input
                          type="number"
                          min="0"
                          step="10"
                          className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                          value={formData.hourlyWage || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              hourlyWage: e.target.value ? parseInt(e.target.value) : undefined,
                              monthlySalary: undefined, // 非常勤の場合、月給をクリア
                            })
                          }
                          placeholder="1500"
                        />
                        <span className="ml-2 text-sm text-gray-600">円</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* 証明書アップロード */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-gray-700 border-b border-gray-200 pb-2">
                  証明書
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 資格証 */}
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">
                      資格証
                    </label>
                    <div className="space-y-2">
                      {qualificationPreview ? (
                        <div className="relative">
                          <Image
                            src={qualificationPreview}
                            alt="資格証プレビュー"
                            width={400}
                            height={192}
                            className="w-full h-48 object-contain border border-gray-300 rounded-md bg-gray-50"
                            unoptimized
                          />
                          <button
                            type="button"
                            onClick={removeQualificationImage}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                          >
                            <XCircle size={20} />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload size={24} className="text-gray-400 mb-2" />
                            <p className="text-xs text-gray-500">画像をアップロード</p>
                            <p className="text-[10px] text-gray-400 mt-1">PNG, JPG (最大5MB)</p>
                          </div>
                          <input
                            ref={qualificationFileInputRef}
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleQualificationUpload}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* 実務経験証明書 */}
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">
                      実務経験証明書
                    </label>
                    <div className="space-y-2">
                      {experiencePreview ? (
                        <div className="relative">
                          <Image
                            src={experiencePreview}
                            alt="実務経験証明書プレビュー"
                            width={400}
                            height={192}
                            className="w-full h-48 object-contain border border-gray-300 rounded-md bg-gray-50"
                            unoptimized
                          />
                          <button
                            type="button"
                            onClick={removeExperienceImage}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                          >
                            <XCircle size={20} />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload size={24} className="text-gray-400 mb-2" />
                            <p className="text-xs text-gray-500">画像をアップロード</p>
                            <p className="text-[10px] text-gray-400 mt-1">PNG, JPG (最大5MB)</p>
                          </div>
                          <input
                            ref={experienceFileInputRef}
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleExperienceUpload}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 備考 */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-gray-700 border-b border-gray-200 pb-2">
                  備考
                </h4>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1.5">備考</label>
                  <textarea
                    className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc] min-h-[100px] resize-y"
                    value={formData.memo || ''}
                    onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                    placeholder="その他の情報やメモを入力してください"
                  />
                </div>
              </div>

              {/* アカウント設定 */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-gray-700 border-b border-gray-200 pb-2">
                  アカウント設定
                </h4>
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                  <p className="text-xs text-blue-800">
                    ログインIDとパスワードを設定すると、このスタッフはログインできるようになります。
                    変更する場合は、新しいログインIDとパスワードを入力してください。
                  </p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1.5">
                    ログインID
                  </label>
                  <input
                    type="text"
                    className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="ログインIDを入力"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">
                      パスワード
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 pr-10 text-sm focus:outline-none focus:border-[#00c4cc]"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="6文字以上"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1.5">
                      パスワード（確認）
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 pr-10 text-sm focus:outline-none focus:border-[#00c4cc]"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="パスワードを再入力"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 閲覧権限設定 */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-gray-700 border-b border-gray-200 pb-2">
                  閲覧権限設定
                </h4>
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                  <p className="text-xs text-blue-800">
                    このスタッフが閲覧できるメニューを選択してください。チェックを入れたメニューのみ閲覧可能です。
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center space-x-2 p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.dashboard || false}
                      onChange={(e) => setPermissions({ ...permissions, dashboard: e.target.checked })}
                      className="w-4 h-4 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
                    />
                    <span className="text-sm text-gray-700">ダッシュボード</span>
                  </label>
                  <label className="flex items-center space-x-2 p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.management || false}
                      onChange={(e) => setPermissions({ ...permissions, management: e.target.checked })}
                      className="w-4 h-4 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
                    />
                    <span className="text-sm text-gray-700">経営設定</span>
                  </label>
                  <label className="flex items-center space-x-2 p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.lead || false}
                      onChange={(e) => setPermissions({ ...permissions, lead: e.target.checked })}
                      className="w-4 h-4 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
                    />
                    <span className="text-sm text-gray-700">リード管理</span>
                  </label>
                  <label className="flex items-center space-x-2 p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.schedule || false}
                      onChange={(e) => setPermissions({ ...permissions, schedule: e.target.checked })}
                      className="w-4 h-4 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
                    />
                    <span className="text-sm text-gray-700">利用調整・予約</span>
                  </label>
                  <label className="flex items-center space-x-2 p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.children || false}
                      onChange={(e) => setPermissions({ ...permissions, children: e.target.checked })}
                      className="w-4 h-4 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
                    />
                    <span className="text-sm text-gray-700">児童管理</span>
                  </label>
                  <label className="flex items-center space-x-2 p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.staff || false}
                      onChange={(e) => setPermissions({ ...permissions, staff: e.target.checked })}
                      className="w-4 h-4 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
                    />
                    <span className="text-sm text-gray-700">スタッフ・シフト管理</span>
                  </label>
                  <label className="flex items-center space-x-2 p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.facility || false}
                      onChange={(e) => setPermissions({ ...permissions, facility: e.target.checked })}
                      className="w-4 h-4 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
                    />
                    <span className="text-sm text-gray-700">施設情報</span>
                  </label>
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingStaff(null);
                    resetForm();
                  }}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-md text-sm transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleUpdateStaff}
                  className="flex-1 py-2.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-md shadow-md text-sm transition-all"
                >
                  更新する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 基本シフトパターン設定モーダル */}
      {isShiftPatternModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-4xl shadow-2xl border border-gray-100 my-8">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="font-bold text-lg text-gray-800 flex items-center">
                <Settings size={20} className="mr-2 text-[#00c4cc]" />
                基本シフトパターン設定
              </h3>
              <button
                onClick={() => setIsShiftPatternModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                各スタッフの週の基本シフトパターンを設定します。月～土の6日間について、シフトがある日を選択してください。
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="p-3 border-b border-r border-gray-200 bg-gray-50 text-left font-bold text-gray-700 min-w-[150px]">
                        スタッフ名
                      </th>
                      <th className="p-3 border-b border-r border-gray-200 bg-gray-50 text-center font-bold text-gray-700">
                        月
                      </th>
                      <th className="p-3 border-b border-r border-gray-200 bg-gray-50 text-center font-bold text-gray-700">
                        火
                      </th>
                      <th className="p-3 border-b border-r border-gray-200 bg-gray-50 text-center font-bold text-gray-700">
                        水
                      </th>
                      <th className="p-3 border-b border-r border-gray-200 bg-gray-50 text-center font-bold text-gray-700">
                        木
                      </th>
                      <th className="p-3 border-b border-r border-gray-200 bg-gray-50 text-center font-bold text-gray-700">
                        金
                      </th>
                      <th className="p-3 border-b border-gray-200 bg-gray-50 text-center font-bold text-gray-700">
                        土
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStaff.map((s) => {
                      const pattern = shiftPatterns[s.id] || [false, false, false, false, false, false];
                      return (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="p-3 border-b border-r border-gray-200">
                            <div className="font-bold text-gray-800">{s.name}</div>
                            <div className="text-xs text-gray-500">{s.role} ({s.type})</div>
                          </td>
                          {pattern.map((hasShift, dayIndex) => (
                            <td key={dayIndex} className="p-2 border-b border-r border-gray-200 text-center">
                              <button
                                onClick={() => handleUpdateShiftPattern(s.id, dayIndex)}
                                className={`w-full py-2 px-1 rounded transition-all ${
                                  hasShift
                                    ? 'bg-[#00c4cc] text-white hover:bg-[#00b0b8]'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                              >
                                {hasShift ? '◯' : '-'}
                              </button>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex space-x-3 pt-4 mt-4 border-t border-gray-200">
                <button
                  onClick={() => setIsShiftPatternModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-md text-sm transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveShiftPatterns}
                  className="flex-1 py-2.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-md shadow-md text-sm transition-all"
                >
                  保存する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* スタッフ招待モーダル */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-2xl shadow-2xl border border-gray-100 my-8">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="font-bold text-lg text-gray-800 flex items-center">
                <Send size={20} className="mr-2 text-[#00c4cc]" />
                スタッフ招待
              </h3>
              <button
                onClick={() => {
                  setIsInviteModalOpen(false);
                  setInviteSuccess(false);
                  setInviteToken('');
                  setInviteFormData({
                    name: '',
                    email: '',
                    phone: '',
                    role: '一般スタッフ',
                    employmentType: '常勤',
                    startDate: new Date().toISOString().split('T')[0],
                    permissions: {
                      dashboard: false,
                      management: false,
                      lead: false,
                      schedule: false,
                      children: false,
                      staff: false,
                      facility: false,
                    },
                  });
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {inviteSuccess ? (
                <div className="space-y-4 py-4">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Mail className="w-8 h-8 text-green-600" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-800 mb-2">招待リンクを作成しました</h4>
                    <p className="text-gray-600 text-sm">
                      {facility?.name || '事業所'}からの招待リンクが生成されました。<br />
                      以下のリンクをコピーしてスタッフに送付してください。
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-2">
                        招待リンク
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={`${getInvitationBaseUrl()}/activate?token=${inviteToken}`}
                          className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-mono text-xs"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <button
                          onClick={() => {
                            const link = `${getInvitationBaseUrl()}/activate?token=${inviteToken}`;
                            navigator.clipboard.writeText(link);
                            alert('リンクをコピーしました');
                          }}
                          className="px-4 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white rounded-md text-sm font-bold whitespace-nowrap transition-colors"
                        >
                          コピー
                        </button>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                      <p className="text-xs text-blue-800">
                        <strong>送付方法:</strong> メール、SMS、チャットツールなど、お好みの方法でスタッフにリンクを送付してください。
                      </p>
                    </div>
                  </div>

                  <div className="flex space-x-3 pt-2">
                    <button
                      onClick={() => {
                        setIsInviteModalOpen(false);
                        setInviteSuccess(false);
                        setInviteToken('');
                        setInviteFormData({
                          name: '',
                          email: '',
                          phone: '',
                          role: '一般スタッフ',
                          employmentType: '常勤',
                          startDate: new Date().toISOString().split('T')[0],
                          permissions: {
                            dashboard: false,
                            management: false,
                            lead: false,
                            schedule: false,
                            children: false,
                            staff: false,
                            facility: false,
                          },
                        });
                      }}
                      className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-md text-sm transition-colors"
                    >
                      閉じる
                    </button>
                    <button
                      onClick={() => {
                        setInviteSuccess(false);
                        setInviteToken('');
                        setInviteFormData({
                          name: '',
                          email: '',
                          phone: '',
                          role: '一般スタッフ',
                          employmentType: '常勤',
                          startDate: new Date().toISOString().split('T')[0],
                          permissions: {
                            dashboard: false,
                            management: false,
                            lead: false,
                            schedule: false,
                            children: false,
                            staff: false,
                            facility: false,
                          },
                        });
                      }}
                      className="flex-1 py-2.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-md text-sm transition-colors"
                    >
                      もう1人招待
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                    <p className="text-xs text-blue-800">
                      スタッフを招待すると、招待リンクが自動生成されます。<br />
                      リンクをコピーしてスタッフに送付してください。スタッフがリンクからアカウントを作成し、基本情報を入力すると、自動的に事業所のスタッフとして登録されます。
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-bold text-sm text-gray-700 border-b border-gray-200 pb-2">
                      基本情報
                    </h4>
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1.5">
                        氏名 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                        value={inviteFormData.name}
                        onChange={(e) => setInviteFormData({ ...inviteFormData, name: e.target.value })}
                        placeholder="山田 太郎"
                        disabled={inviteLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-bold text-sm text-gray-700 border-b border-gray-200 pb-2">
                      雇用情報
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1.5">
                          役職 <span className="text-red-500">*</span>
                        </label>
                        <select
                          className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                          value={inviteFormData.role}
                          onChange={(e) => setInviteFormData({ ...inviteFormData, role: e.target.value as any })}
                          disabled={inviteLoading}
                        >
                          <option value="一般スタッフ">一般スタッフ</option>
                          <option value="マネージャー">マネージャー</option>
                          <option value="管理者">管理者</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1.5">
                          雇用形態 <span className="text-red-500">*</span>
                        </label>
                        <select
                          className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                          value={inviteFormData.employmentType}
                          onChange={(e) => setInviteFormData({ ...inviteFormData, employmentType: e.target.value as any })}
                          disabled={inviteLoading}
                        >
                          <option value="常勤">常勤</option>
                          <option value="非常勤">非常勤</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1.5">
                        雇用開始日 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        className="w-full bg-white border border-gray-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:border-[#00c4cc]"
                        value={inviteFormData.startDate}
                        onChange={(e) => setInviteFormData({ ...inviteFormData, startDate: e.target.value })}
                        disabled={inviteLoading}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        この日付からスタッフとして登録されます
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-bold text-sm text-gray-700 border-b border-gray-200 pb-2">
                      閲覧権限設定
                    </h4>
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                      <p className="text-xs text-blue-800">
                        このスタッフが閲覧できるメニューを選択してください。
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex items-center space-x-2 p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inviteFormData.permissions.dashboard || false}
                          onChange={(e) => setInviteFormData({
                            ...inviteFormData,
                            permissions: { ...inviteFormData.permissions, dashboard: e.target.checked }
                          })}
                          className="w-4 h-4 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
                          disabled={inviteLoading}
                        />
                        <span className="text-sm text-gray-700">ダッシュボード</span>
                      </label>
                      <label className="flex items-center space-x-2 p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inviteFormData.permissions.management || false}
                          onChange={(e) => setInviteFormData({
                            ...inviteFormData,
                            permissions: { ...inviteFormData.permissions, management: e.target.checked }
                          })}
                          className="w-4 h-4 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
                          disabled={inviteLoading}
                        />
                        <span className="text-sm text-gray-700">経営設定</span>
                      </label>
                      <label className="flex items-center space-x-2 p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inviteFormData.permissions.lead || false}
                          onChange={(e) => setInviteFormData({
                            ...inviteFormData,
                            permissions: { ...inviteFormData.permissions, lead: e.target.checked }
                          })}
                          className="w-4 h-4 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
                          disabled={inviteLoading}
                        />
                        <span className="text-sm text-gray-700">リード管理</span>
                      </label>
                      <label className="flex items-center space-x-2 p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inviteFormData.permissions.schedule || false}
                          onChange={(e) => setInviteFormData({
                            ...inviteFormData,
                            permissions: { ...inviteFormData.permissions, schedule: e.target.checked }
                          })}
                          className="w-4 h-4 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
                          disabled={inviteLoading}
                        />
                        <span className="text-sm text-gray-700">利用調整・予約</span>
                      </label>
                      <label className="flex items-center space-x-2 p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inviteFormData.permissions.children || false}
                          onChange={(e) => setInviteFormData({
                            ...inviteFormData,
                            permissions: { ...inviteFormData.permissions, children: e.target.checked }
                          })}
                          className="w-4 h-4 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
                          disabled={inviteLoading}
                        />
                        <span className="text-sm text-gray-700">児童管理</span>
                      </label>
                      <label className="flex items-center space-x-2 p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inviteFormData.permissions.staff || false}
                          onChange={(e) => setInviteFormData({
                            ...inviteFormData,
                            permissions: { ...inviteFormData.permissions, staff: e.target.checked }
                          })}
                          className="w-4 h-4 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
                          disabled={inviteLoading}
                        />
                        <span className="text-sm text-gray-700">スタッフ・シフト管理</span>
                      </label>
                      <label className="flex items-center space-x-2 p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inviteFormData.permissions.facility || false}
                          onChange={(e) => setInviteFormData({
                            ...inviteFormData,
                            permissions: { ...inviteFormData.permissions, facility: e.target.checked }
                          })}
                          className="w-4 h-4 text-[#00c4cc] border-gray-300 rounded focus:ring-[#00c4cc]"
                          disabled={inviteLoading}
                        />
                        <span className="text-sm text-gray-700">施設情報</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex space-x-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setIsInviteModalOpen(false);
                        setInviteFormData({
                          name: '',
                          email: '',
                          phone: '',
                          role: '一般スタッフ',
                          employmentType: '常勤',
                          startDate: new Date().toISOString().split('T')[0],
                          permissions: {
                            dashboard: false,
                            management: false,
                            lead: false,
                            schedule: false,
                            children: false,
                            staff: false,
                            facility: false,
                          },
                        });
                      }}
                      className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-md text-sm transition-colors"
                      disabled={inviteLoading}
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={async () => {
                        if (!inviteFormData.name.trim()) {
                          alert('氏名を入力してください');
                          return;
                        }
                        if (!facility?.id) {
                          alert('事業所情報が取得できませんでした');
                          return;
                        }

                        setInviteLoading(true);
                        try {
                          const invitation: StaffInvitation = {
                            facilityId: facility.id,
                            name: inviteFormData.name.trim(),
                            email: undefined,
                            phone: undefined,
                            role: inviteFormData.role,
                            employmentType: inviteFormData.employmentType,
                            startDate: inviteFormData.startDate,
                            permissions: inviteFormData.permissions,
                          };

                          const { invitationToken } = await inviteStaff(
                            facility.id,
                            invitation,
                            false // 即座に所属関係を作成しない
                          );

                          setInviteToken(invitationToken);
                          setInviteSuccess(true);
                        } catch (error: any) {
                          alert(error.message || '招待の送信に失敗しました');
                        } finally {
                          setInviteLoading(false);
                        }
                      }}
                      className="flex-1 py-2.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-md shadow-md text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={inviteLoading}
                    >
                      {inviteLoading ? '作成中...' : '招待リンクを作成'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffView;
