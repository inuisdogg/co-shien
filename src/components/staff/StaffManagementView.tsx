/**
 * スタッフ管理ビュー
 * スタッフ一覧、招待リンク作成、スタッフ詳細、勤怠簿一覧
 */

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Users, Plus, Mail, X, Clock, Calendar, User, Phone, MapPin, Briefcase, Award, FileText, QrCode, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Staff, UserPermissions, StaffInvitation } from '@/types';
import { useFacilityData } from '@/hooks/useFacilityData';
import { inviteStaff } from '@/utils/staffInvitationService';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const StaffManagementView: React.FC = () => {
  const { staff, facilitySettings } = useFacilityData();
  const { facility } = useAuth();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteMethod, setInviteMethod] = useState<'link' | 'qr' | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attendanceMonth, setAttendanceMonth] = useState(new Date());
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [publicInviteLink, setPublicInviteLink] = useState('');

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

  // スタッフを並び順でソート
  const sortedStaff = useMemo(() => {
    return [...staff].sort((a, b) => {
      if (a.role === 'マネージャー' && b.role !== 'マネージャー') return -1;
      if (a.role !== 'マネージャー' && b.role === 'マネージャー') return 1;
      if (a.type === '常勤' && b.type === '非常勤') return -1;
      if (a.type === '非常勤' && b.type === '常勤') return 1;
      return a.name.localeCompare(b.name, 'ja');
    });
  }, [staff]);

  // スタッフ詳細を開く
  const handleOpenDetail = async (staff: Staff) => {
    setSelectedStaff(staff);
    setIsDetailModalOpen(true);
    
    // パーソナル情報を取得（user_idがある場合）
    if (staff.user_id) {
      try {
        const { data: userData, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', staff.user_id)
          .single();
        
        if (!error && userData) {
          // ユーザー情報をスタッフ情報にマージ
          setSelectedStaff({
            ...staff,
            ...userData,
          } as any);
        }
      } catch (error) {
        console.error('ユーザー情報取得エラー:', error);
      }
    }
  };

  // 勤怠簿を開く
  const handleOpenAttendance = async (staff: Staff) => {
    setSelectedStaff(staff);
    setIsAttendanceModalOpen(true);
    await loadAttendanceRecords(staff);
  };

  // 勤怠記録を読み込む
  const loadAttendanceRecords = async (staff: Staff) => {
    try {
      // localStorageから勤怠記録を取得（暫定）
      const records = JSON.parse(localStorage.getItem('attendance_records') || '[]');
      const staffRecords = records.filter((r: any) => 
        r.user_id === staff.user_id && 
        r.facility_id === facility?.id
      );
      
      // 月でフィルタリング
      const year = attendanceMonth.getFullYear();
      const month = attendanceMonth.getMonth();
      const filteredRecords = staffRecords.filter((r: any) => {
        const recordDate = new Date(r.date);
        return recordDate.getFullYear() === year && recordDate.getMonth() === month;
      });
      
      setAttendanceRecords(filteredRecords);
    } catch (error) {
      console.error('勤怠記録読み込みエラー:', error);
      setAttendanceRecords([]);
    }
  };

  // 招待リンクを作成
  const handleCreateInvitation = async () => {
    if (!facility?.id) {
      alert('施設情報が取得できませんでした');
      return;
    }

    if (!inviteFormData.name || (!inviteFormData.email && !inviteFormData.phone)) {
      alert('名前とメールアドレスまたは電話番号を入力してください');
      return;
    }

    setInviteLoading(true);
    setInviteSuccess(false);
    setInviteToken('');

    try {
      const invitation: StaffInvitation = {
        name: inviteFormData.name,
        email: inviteFormData.email || undefined,
        phone: inviteFormData.phone || undefined,
        role: inviteFormData.role,
        employmentType: inviteFormData.employmentType,
        startDate: inviteFormData.startDate,
        permissions: inviteFormData.permissions,
      };

      const result = await inviteStaff(facility.id, invitation, false);
      const invitationToken = result.invitationToken;
      setInviteToken(invitationToken);

      // 招待リンクを生成
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const invitationLink = `${baseUrl}/activate?token=${invitationToken}`;
      
      setInviteSuccess(true);
      
      // クリップボードにコピー
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(invitationLink);
        alert('招待リンクをクリップボードにコピーしました');
      }
    } catch (error: any) {
      console.error('招待エラー:', error);
      alert(`招待リンク作成エラー: ${error.message || 'Unknown error'}`);
    } finally {
      setInviteLoading(false);
    }
  };

  // 月を変更
  const changeAttendanceMonth = (offset: number) => {
    const newDate = new Date(attendanceMonth);
    newDate.setMonth(newDate.getMonth() + offset);
    setAttendanceMonth(newDate);
  };

  useEffect(() => {
    if (isAttendanceModalOpen && selectedStaff) {
      loadAttendanceRecords(selectedStaff);
    }
  }, [attendanceMonth, isAttendanceModalOpen, selectedStaff]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">スタッフ管理</h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            スタッフの一覧、招待、詳細情報、勤怠簿を管理します。
          </p>
        </div>
        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="px-4 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white rounded-md text-sm font-bold transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          <span>招待</span>
        </button>
      </div>

      {/* スタッフ一覧 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-bold text-sm sm:text-base text-gray-800">スタッフ一覧</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-3 text-left font-bold text-gray-700">名前</th>
                <th className="p-3 text-left font-bold text-gray-700">役職</th>
                <th className="p-3 text-left font-bold text-gray-700">雇用形態</th>
                <th className="p-3 text-left font-bold text-gray-700">連絡先</th>
                <th className="p-3 text-center font-bold text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody>
              {sortedStaff.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-800">{s.name}</td>
                  <td className="p-3 text-gray-600">{s.role}</td>
                  <td className="p-3 text-gray-600">{s.type}</td>
                  <td className="p-3 text-gray-600">
                    {s.email || s.phone || '-'}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleOpenDetail(s)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-xs font-bold transition-colors flex items-center gap-1"
                      >
                        <User size={14} />
                        詳細
                      </button>
                      <button
                        onClick={() => handleOpenAttendance(s)}
                        className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-md text-xs font-bold transition-colors flex items-center gap-1"
                      >
                        <Clock size={14} />
                        勤怠
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedStaff.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    スタッフが登録されていません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 招待モーダル */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <Mail size={20} className="text-[#00c4cc]" />
                スタッフを招待
              </h3>
              <button
                onClick={() => {
                  setIsInviteModalOpen(false);
                  setInviteMethod(null);
                  setInviteSuccess(false);
                  setInviteToken('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {!inviteMethod ? (
                // 招待方法を選択
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 mb-4">
                    招待方法を選択してください
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={async () => {
                        setInviteMethod('link');
                        // すぐにリンクを生成
                        if (facility?.id) {
                          try {
                            setInviteLoading(true);
                            // 公開招待用のトークンを生成
                            const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                            const publicToken = btoa(JSON.stringify({ facilityId: facility.id, type: 'public' }));
                            const link = `${baseUrl}/activate?token=${publicToken}`;
                            setInviteToken(publicToken);
                            setInviteSuccess(true);
                            
                            // クリップボードにコピー
                            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                              await navigator.clipboard.writeText(link);
                            }
                          } catch (error: any) {
                            alert(`リンク生成エラー: ${error.message || 'Unknown error'}`);
                          } finally {
                            setInviteLoading(false);
                          }
                        }
                      }}
                      className="p-6 border-2 border-gray-200 rounded-lg hover:border-[#00c4cc] hover:bg-[#00c4cc]/5 transition-all text-left"
                    >
                      <Mail size={32} className="text-[#00c4cc] mb-3" />
                      <h4 className="font-bold text-gray-800 mb-2">リンクで招待</h4>
                      <p className="text-sm text-gray-600">
                        招待リンクを生成して、メールやSMSで送信できます
                      </p>
                    </button>
                    <button
                      onClick={() => {
                        setInviteMethod('qr');
                        // QRコード用のリンクを生成
                        if (facility?.id) {
                          const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                          const publicToken = btoa(JSON.stringify({ facilityId: facility.id, type: 'public' }));
                          const link = `${baseUrl}/activate?token=${publicToken}`;
                          setPublicInviteLink(link);
                          setIsInviteModalOpen(false);
                          setIsQRModalOpen(true);
                        }
                      }}
                      className="p-6 border-2 border-gray-200 rounded-lg hover:border-purple-600 hover:bg-purple-50 transition-all text-left"
                    >
                      <QrCode size={32} className="text-purple-600 mb-3" />
                      <h4 className="font-bold text-gray-800 mb-2">QRコードで招待</h4>
                      <p className="text-sm text-gray-600">
                        QRコードを表示・印刷して、スタッフにスキャンしてもらいます
                      </p>
                    </button>
                  </div>
                </div>
              ) : inviteSuccess ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
                    招待リンクが作成されました！
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      招待リンク
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={typeof window !== 'undefined' ? `${window.location.origin}/activate?token=${inviteToken}` : ''}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
                      />
                      <button
                        onClick={async () => {
                          const link = typeof window !== 'undefined' ? `${window.location.origin}/activate?token=${inviteToken}` : '';
                          if (navigator.clipboard) {
                            await navigator.clipboard.writeText(link);
                            alert('リンクをコピーしました');
                          }
                        }}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-bold"
                      >
                        コピー
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsInviteModalOpen(false);
                      setInviteMethod(null);
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
                    className="w-full py-2.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-md text-sm transition-colors"
                  >
                    閉じる
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* スタッフ詳細モーダル */}
      {isDetailModalOpen && selectedStaff && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <User size={20} className="text-[#00c4cc]" />
                {selectedStaff.name} さんの詳細情報
              </h3>
              <button
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setSelectedStaff(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">
                    <User size={16} />
                    基本情報
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">名前:</span>
                      <span className="ml-2 font-medium text-gray-800">{selectedStaff.name}</span>
                    </div>
                    {selectedStaff.nameKana && (
                      <div>
                        <span className="text-gray-500">ふりがな:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedStaff.nameKana}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">役職:</span>
                      <span className="ml-2 font-medium text-gray-800">{selectedStaff.role}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">雇用形態:</span>
                      <span className="ml-2 font-medium text-gray-800">{selectedStaff.type}</span>
                    </div>
                    {selectedStaff.birthDate && (
                      <div>
                        <span className="text-gray-500">生年月日:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedStaff.birthDate}</span>
                      </div>
                    )}
                    {selectedStaff.gender && (
                      <div>
                        <span className="text-gray-500">性別:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedStaff.gender}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">
                    <Phone size={16} />
                    連絡先
                  </h4>
                  <div className="space-y-2 text-sm">
                    {selectedStaff.email && (
                      <div>
                        <span className="text-gray-500">メール:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedStaff.email}</span>
                      </div>
                    )}
                    {selectedStaff.phone && (
                      <div>
                        <span className="text-gray-500">電話:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedStaff.phone}</span>
                      </div>
                    )}
                    {selectedStaff.address && (
                      <div>
                        <span className="text-gray-500">住所:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedStaff.address}</span>
                      </div>
                    )}
                    {selectedStaff.emergencyContact && (
                      <div>
                        <span className="text-gray-500">緊急連絡先:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedStaff.emergencyContact}</span>
                      </div>
                    )}
                    {selectedStaff.emergencyContactPhone && (
                      <div>
                        <span className="text-gray-500">緊急連絡先電話:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedStaff.emergencyContactPhone}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">
                    <Briefcase size={16} />
                    職務情報
                  </h4>
                  <div className="space-y-2 text-sm">
                    {selectedStaff.qualifications && (
                      <div>
                        <span className="text-gray-500">資格:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedStaff.qualifications}</span>
                      </div>
                    )}
                    {selectedStaff.yearsOfExperience !== undefined && (
                      <div>
                        <span className="text-gray-500">経験年数:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedStaff.yearsOfExperience}年</span>
                      </div>
                    )}
                    {selectedStaff.monthlySalary !== undefined && (
                      <div>
                        <span className="text-gray-500">月給:</span>
                        <span className="ml-2 font-medium text-gray-800">¥{selectedStaff.monthlySalary?.toLocaleString()}</span>
                      </div>
                    )}
                    {selectedStaff.hourlyWage !== undefined && (
                      <div>
                        <span className="text-gray-500">時給:</span>
                        <span className="ml-2 font-medium text-gray-800">¥{selectedStaff.hourlyWage?.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
                {selectedStaff.memo && (
                  <div>
                    <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">
                      <FileText size={16} />
                      メモ
                    </h4>
                    <div className="text-sm text-gray-800 bg-gray-50 p-3 rounded-md">
                      {selectedStaff.memo}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 勤怠簿モーダル */}
      {isAttendanceModalOpen && selectedStaff && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <Clock size={20} className="text-[#00c4cc]" />
                {selectedStaff.name} さんの勤怠簿
              </h3>
              <button
                onClick={() => {
                  setIsAttendanceModalOpen(false);
                  setSelectedStaff(null);
                  setAttendanceRecords([]);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => changeAttendanceMonth(-1)}
                  className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  ←
                </button>
                <h4 className="font-bold text-lg text-gray-800">
                  {attendanceMonth.getFullYear()}年 {attendanceMonth.getMonth() + 1}月
                </h4>
                <button
                  onClick={() => changeAttendanceMonth(1)}
                  className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  →
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-3 text-left font-bold text-gray-700">日付</th>
                      <th className="p-3 text-left font-bold text-gray-700">出勤</th>
                      <th className="p-3 text-left font-bold text-gray-700">休憩開始</th>
                      <th className="p-3 text-left font-bold text-gray-700">休憩終了</th>
                      <th className="p-3 text-left font-bold text-gray-700">退勤</th>
                      <th className="p-3 text-left font-bold text-gray-700">勤務時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords.length > 0 ? (
                      attendanceRecords.map((record, index) => {
                        const startTime = record.time || record.start_time || '';
                        const breakStartTime = record.break_start_time || '';
                        const breakEndTime = record.break_end_time || '';
                        const endTime = record.time || record.end_time || '';
                        
                        // 勤務時間を計算（簡易版）
                        let workHours = '-';
                        if (startTime && endTime) {
                          const start = new Date(`${record.date}T${startTime}`);
                          const end = new Date(`${record.date}T${endTime}`);
                          const diff = end.getTime() - start.getTime();
                          const hours = Math.floor(diff / (1000 * 60 * 60));
                          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                          workHours = `${hours}時間${minutes}分`;
                        }
                        
                        return (
                          <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="p-3 font-medium text-gray-800">{record.date}</td>
                            <td className="p-3 text-gray-600">{startTime || '-'}</td>
                            <td className="p-3 text-gray-600">{breakStartTime || '-'}</td>
                            <td className="p-3 text-gray-600">{breakEndTime || '-'}</td>
                            <td className="p-3 text-gray-600">{endTime || '-'}</td>
                            <td className="p-3 text-gray-600">{workHours}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-500">
                          この月の勤怠記録がありません
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QRコードモーダル（公開招待） */}
      {isQRModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md shadow-2xl border border-gray-100">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <QrCode size={20} className="text-purple-600" />
                招待QRコード
              </h3>
              <button
                onClick={() => setIsQRModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                <p className="text-sm text-blue-800">
                  このQRコードを休憩室などに貼っておくと、スタッフが自分のスマホでスキャンして登録できます。
                </p>
              </div>
              
              <div className="flex flex-col items-center space-y-4">
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                  <QRCodeSVG value={publicInviteLink} size={256} className="qr-code-svg" />
                </div>
                
                <div className="w-full">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    招待リンク
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={publicInviteLink}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
                    />
                    <button
                      onClick={async () => {
                        if (navigator.clipboard) {
                          await navigator.clipboard.writeText(publicInviteLink);
                          alert('リンクをコピーしました');
                        }
                      }}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-bold"
                    >
                      コピー
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    // QRコードを画像としてダウンロード
                    const svgElement = document.querySelector('.qr-code-svg') as SVGElement;
                    if (svgElement) {
                      const svgData = new XMLSerializer().serializeToString(svgElement);
                      const canvas = document.createElement('canvas');
                      const ctx = canvas.getContext('2d');
                      const img = new Image();
                      img.onload = () => {
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx?.drawImage(img, 0, 0);
                        const pngFile = canvas.toDataURL('image/png');
                        const downloadLink = document.createElement('a');
                        downloadLink.download = 'staff-invitation-qr.png';
                        downloadLink.href = pngFile;
                        downloadLink.click();
                      };
                      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                    }
                  }}
                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  QRコードをダウンロード
                </button>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => setIsQRModalOpen(false)}
                  className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-md text-sm transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagementView;

