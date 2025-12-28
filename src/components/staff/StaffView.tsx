/**
 * スタッフ・シフト管理ビュー
 */

'use client';

import React, { useState, useMemo, useRef } from 'react';
import { CalendarCheck, Users, AlertCircle, Plus, Trash2, X, Upload, XCircle } from 'lucide-react';
import { Staff, ScheduleItem } from '@/types';
import { useFacilityData } from '@/hooks/useFacilityData';

const StaffView: React.FC = () => {
  const { staff, addStaff, updateStaff, deleteStaff, schedules, children, facilitySettings } = useFacilityData();
  const [subTab, setSubTab] = useState<'shift' | 'list'>('shift');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState<Record<string, Record<string, boolean>>>({}); // {staffId: {date: boolean}}

  // 週間カレンダーの日付を生成
  const weekDates = useMemo(() => {
    const baseDate = new Date(currentDate);
    const currentDay = baseDate.getDay();
    const startOfWeek = new Date(baseDate);
    startOfWeek.setDate(baseDate.getDate() - currentDay + 1); // 月曜日を開始日とする

    const dates: Array<{ date: string; label: string; day: string }> = [];
    const days = ['月', '火', '水', '木', '金', '土'];

    for (let i = 0; i < 6; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      dates.push({
        date: date.toISOString().split('T')[0],
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
  const isHoliday = (dateStr: string): boolean => {
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    
    // 定休日チェック
    if (facilitySettings.regularHolidays.includes(dayOfWeek)) {
      return true;
    }
    
    // カスタム休業日チェック
    if (facilitySettings.customHolidays.includes(dateStr)) {
      return true;
    }
    
    return false;
  };

  // シフトをトグル
  const toggleShift = (staffId: string, date: string) => {
    setShifts((prev) => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        [date]: !prev[staffId]?.[date],
      },
    }));
  };

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
  const handleEditStaff = (staff: Staff) => {
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

    try {
      await updateStaff(editingStaff.id, {
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


  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-800">勤怠・シフト管理</h2>
          <p className="text-gray-500 text-xs mt-1">
            スタッフのマスタ管理と、配置基準を満たすためのシフト作成を行います。
          </p>
        </div>
        <div className="bg-gray-100 p-1 rounded-md flex">
          <button
            onClick={() => setSubTab('shift')}
            className={`px-4 py-2 text-sm font-bold rounded transition-all flex items-center ${
              subTab === 'shift'
                ? 'bg-white text-[#00c4cc] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CalendarCheck size={16} className="mr-2" />
            シフト管理
          </button>
          <button
            onClick={() => setSubTab('list')}
            className={`px-4 py-2 text-sm font-bold rounded transition-all flex items-center ${
              subTab === 'list'
                ? 'bg-white text-[#00c4cc] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users size={16} className="mr-2" />
            スタッフ登録
          </button>
        </div>
      </div>

      {subTab === 'shift' ? (
        /* Shift Management Tab */
        <div className="space-y-6">
          {/* シフト設定カレンダー */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {/* Info Bar: Child Count Check */}
            <div className="bg-[#e0f7fa] p-4 border-b border-[#b2ebf2] flex items-center space-x-2 text-sm text-[#006064]">
              <AlertCircle size={18} />
              <span>
                各日の「利用児童数」を確認しながらシフトを配置してください。児童10名につき2名の配置が必要です。
              </span>
            </div>

            {/* 週選択コントロール */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => changeWeek(-1)}
                  className="px-3 py-1 text-gray-600 hover:bg-gray-200 rounded transition-colors"
                >
                  ←
                </button>
                <h3 className="font-bold text-lg text-gray-800">
                  {weekDates[0].date.split('-')[1]}月 {weekDates[0].date.split('-')[2]}日 ～{' '}
                  {weekDates[5].date.split('-')[1]}月 {weekDates[5].date.split('-')[2]}日
                </h3>
                <button
                  onClick={() => changeWeek(1)}
                  className="px-3 py-1 text-gray-600 hover:bg-gray-200 rounded transition-colors"
                >
                  →
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr>
                    <th className="p-3 border-b border-r border-gray-100 bg-gray-50 min-w-[150px] text-gray-500 font-bold">
                      スタッフ / 日付
                    </th>
                    {weekDates.map((d) => {
                      const childCount = getChildCountByDate(d.date);
                      const isBusy = childCount >= 8;

                      return (
                        <th
                          key={d.date}
                          className={`p-2 border-b border-r border-gray-100 text-center min-w-[100px] ${
                            isBusy ? 'bg-orange-50' : 'bg-gray-50'
                          }`}
                        >
                          <div className="font-bold text-gray-700">{d.label}</div>
                          <div className="text-[10px] mt-1 font-normal text-gray-500">
                            児童:{' '}
                            <span className={`font-bold ${isBusy ? 'text-orange-600' : ''}`}>
                              {childCount}名
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s: Staff) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="p-3 border-b border-r border-gray-100 bg-white">
                        <div className="font-bold text-gray-800">{s.name}</div>
                        <div className="text-[10px] text-gray-500">
                          {s.role} ({s.type})
                        </div>
                      </td>
                      {weekDates.map((d) => {
                        const hasShift = shifts[s.id]?.[d.date] || false;
                        return (
                          <td
                            key={`${s.id}-${d.date}`}
                            className="p-1 border-b border-r border-gray-100 text-center bg-white"
                          >
                            <button
                              onClick={() => toggleShift(s.id, d.date)}
                              className={`w-full py-2 px-1 rounded transition-all ${
                                hasShift
                                  ? 'bg-[#00c4cc] text-white hover:bg-[#00b0b8]'
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                              }`}
                            >
                              <div className="text-lg font-bold">{hasShift ? '◯' : '-'}</div>
                              {hasShift && (
                                <div className="text-[9px] mt-0.5 opacity-90">9:00~17:00</div>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Total Staff Count Row */}
                  <tr className="bg-gray-50 font-bold text-gray-600">
                    <td className="p-3 border-r border-gray-100 text-xs uppercase tracking-wider">
                      配置人数合計
                    </td>
                    {weekDates.map((d) => {
                      const count = staff.filter((s) => shifts[s.id]?.[d.date]).length;
                      return (
                        <td
                          key={`total-${d.date}`}
                          className="p-2 border-r border-gray-100 text-center text-xs text-gray-400"
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
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800">利用児童カレンダー</h3>
              <p className="text-xs text-gray-500 mt-1">各日の利用予定児童数を確認できます</p>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                {/* ヘッダー */}
                <div className="flex border-b border-gray-200 sticky top-0 bg-gray-50 z-10">
                  <div className="w-16 p-2 shrink-0 border-r border-gray-200 text-xs text-center font-bold text-gray-500 flex items-center justify-center">
                    区分
                  </div>
                  {weekDates.map((d, i) => {
                    const isHolidayDay = isHoliday(d.date);
                    const childCount = getChildCountByDate(d.date);
                    const isBusy = childCount >= 8;
                    return (
                      <div
                        key={i}
                        className={`flex-1 p-2 text-center border-r border-gray-200 text-sm font-bold ${
                          isHolidayDay
                            ? 'text-red-600 bg-red-50'
                            : i >= 5
                            ? 'text-red-500'
                            : 'text-gray-700'
                        } ${isBusy ? 'bg-orange-50' : ''}`}
                      >
                        <div>{d.date.split('-')[2]} ({d.day})</div>
                        {isHolidayDay ? (
                          <div className="text-[9px] text-red-600 mt-0.5">休業</div>
                        ) : (
                          <div className="text-[9px] text-gray-500 mt-0.5">
                            利用: {childCount}名
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* 午前行 */}
                <div className="flex border-b border-gray-200 min-h-[120px]">
                  <div className="w-16 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col justify-center text-center p-1">
                    <div className="text-xs font-bold text-gray-600">午前</div>
                    <div className="text-[10px] text-gray-400 mt-1">定員{facilitySettings.capacity.AM}</div>
                  </div>
                  {weekDates.map((d, i) => {
                    const items = schedules.filter((s) => s.date === d.date && s.slot === 'AM');
                    const isHolidayDay = isHoliday(d.date);
                    return (
                      <div
                        key={i}
                        className={`flex-1 p-1 border-r border-gray-100 transition-colors ${
                          isHolidayDay
                            ? 'bg-red-50 cursor-not-allowed opacity-60'
                            : 'bg-white'
                        }`}
                      >
                        {isHolidayDay ? (
                          <div className="text-[10px] text-red-600 text-center mt-2">休業</div>
                        ) : (
                          items.map((item) => (
                            <div
                              key={item.id}
                              className="mb-1 border rounded px-2 py-1.5 text-xs font-medium shadow-sm bg-[#e0f7fa] border-[#b2ebf2] text-[#006064]"
                            >
                              <div className="font-bold truncate">{item.childName}</div>
                              <div className="flex gap-1 mt-1">
                                {item.hasPickup && (
                                  <span className="px-1 rounded-[2px] text-[9px] font-bold border bg-white/80 text-[#006064] border-[#b2ebf2]">
                                    迎
                                  </span>
                                )}
                                {item.hasDropoff && (
                                  <span className="px-1 rounded-[2px] text-[9px] font-bold border bg-white/80 text-[#006064] border-[#b2ebf2]">
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
                <div className="flex min-h-[200px]">
                  <div className="w-16 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col justify-center text-center p-1">
                    <div className="text-xs font-bold text-gray-600">午後</div>
                    <div className="text-[10px] text-gray-400 mt-1">定員{facilitySettings.capacity.PM}</div>
                  </div>
                  {weekDates.map((d, i) => {
                    const items = schedules.filter((s) => s.date === d.date && s.slot === 'PM');
                    const isHolidayDay = isHoliday(d.date);
                    return (
                      <div
                        key={i}
                        className={`flex-1 p-1 border-r border-gray-100 transition-colors ${
                          isHolidayDay
                            ? 'bg-red-50 cursor-not-allowed opacity-60'
                            : 'bg-white'
                        }`}
                      >
                        {isHolidayDay ? (
                          <div className="text-[10px] text-red-600 text-center mt-2">休業</div>
                        ) : (
                          items.map((item) => (
                            <div
                              key={item.id}
                              className="mb-1 border rounded px-2 py-1.5 text-xs shadow-sm bg-orange-50 border-orange-100 text-orange-900"
                            >
                              <div className="font-bold truncate text-[11px]">{item.childName}</div>
                              <div className="flex gap-1 mt-1">
                                {item.hasPickup && (
                                  <span className="px-1 rounded-[2px] text-[9px] font-bold border bg-white/80 text-orange-600 border-orange-100">
                                    迎
                                  </span>
                                )}
                                {item.hasDropoff && (
                                  <span className="px-1 rounded-[2px] text-[9px] font-bold border bg-white/80 text-orange-600 border-orange-100">
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
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-bold shadow-sm transition-colors flex items-center"
            >
              <Plus size={16} className="mr-2" /> 追加
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff.map((s: Staff) => (
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
                          <img
                            src={qualificationPreview}
                            alt="資格証プレビュー"
                            className="w-full h-48 object-contain border border-gray-300 rounded-md bg-gray-50"
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
                          <img
                            src={experiencePreview}
                            alt="実務経験証明書プレビュー"
                            className="w-full h-48 object-contain border border-gray-300 rounded-md bg-gray-50"
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
                          <img
                            src={qualificationPreview}
                            alt="資格証プレビュー"
                            className="w-full h-48 object-contain border border-gray-300 rounded-md bg-gray-50"
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
                          <img
                            src={experiencePreview}
                            alt="実務経験証明書プレビュー"
                            className="w-full h-48 object-contain border border-gray-300 rounded-md bg-gray-50"
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
    </div>
  );
};

export default StaffView;
