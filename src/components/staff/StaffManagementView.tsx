/**
 * スタッフ管理ビュー
 * スタッフ一覧、招待リンク作成、スタッフ詳細、勤怠簿一覧
 */

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Users, Plus, Mail, X, Clock, Calendar, User, Phone, MapPin, Briefcase, Award, FileText, QrCode, Download, Upload, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Staff, UserPermissions, StaffInvitation } from '@/types';
import { useFacilityData } from '@/hooks/useFacilityData';
import { inviteStaff } from '@/utils/staffInvitationService';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// 資格リスト（activate/page.tsxから）
const QUALIFICATIONS = [
  '資格無し',
  '保育士',
  '児童指導員任用資格',
  '児童発達支援管理責任者',
  '社会福祉士',
  '精神保健福祉士',
  '介護福祉士',
  '理学療法士（PT）',
  '作業療法士（OT）',
  '言語聴覚士（ST）',
  '臨床心理士',
  '公認心理師',
  '看護師',
  '准看護師',
  'その他'
];

const StaffManagementView: React.FC = () => {
  const { staff, facilitySettings } = useFacilityData();
  const { facility } = useAuth();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteMethod, setInviteMethod] = useState<'link' | 'qr' | 'manual' | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attendanceMonth, setAttendanceMonth] = useState(new Date());
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [publicInviteLink, setPublicInviteLink] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStaffData, setEditingStaffData] = useState<any>(null);
  
  // 手動登録フォーム用の状態
  const [manualFormData, setManualFormData] = useState({
    name: '',
    nameKana: '',
    email: '',
    phone: '',
    birthDate: '',
    gender: '' as '男性' | '女性' | 'その他' | '',
    role: '一般スタッフ' as '一般スタッフ' | 'マネージャー' | '管理者',
    employmentType: '常勤' as '常勤' | '非常勤',
    startDate: new Date().toISOString().split('T')[0],
    // パーソナルキャリア情報と同じ項目
    postalCode: '',
    address: '',
    qualifications: [] as string[],
    qualificationCertificates: [] as { qualification: string; file: File | null; url: string }[],
    workHistory: [] as Array<{
      id: string;
      type: 'employment' | 'education';
      organization: string;
      position?: string;
      startDate: string;
      endDate: string;
      description: string;
    }>,
    // 事業所側から登録する情報
    monthlySalary: undefined as number | undefined,
    hourlyWage: undefined as number | undefined,
    facilityRole: '',
  });

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
                <th className="p-3 text-left font-bold text-gray-700">施設での役割</th>
                <th className="p-3 text-center font-bold text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody>
              {sortedStaff.map((s) => {
                const isShadowAccount = !s.user_id;
                return (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-800">
                    <div className="flex items-center gap-2">
                      {s.name}
                      {isShadowAccount && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded">
                          未確認
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-gray-600">{s.role}</td>
                  <td className="p-3 text-gray-600">{s.type}</td>
                  <td className="p-3 text-gray-600">
                    {s.facilityRole || s.role || '-'}
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
              );
              })}
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
                    <button
                      onClick={() => setInviteMethod('manual')}
                      className="p-6 border-2 border-gray-200 rounded-lg hover:border-orange-600 hover:bg-orange-50 transition-all text-left"
                    >
                      <User size={32} className="text-orange-600 mb-3" />
                      <h4 className="font-bold text-gray-800 mb-2">代わりに情報を入力する（代行登録）</h4>
                      <p className="text-sm text-gray-600">
                        スタッフの代わりに基本情報を入力します。後日スタッフ本人がアカウントを作成できます
                      </p>
                    </button>
                  </div>
                </div>
              ) : inviteMethod === 'manual' ? (
                // 手動登録フォーム
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                    <p className="text-sm text-blue-800">
                      スタッフの基本情報を入力してください。後日、スタッフ本人が同じメールアドレスまたは電話番号でアカウントを作成すると、自動的に紐付けられます。
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      氏名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={manualFormData.name}
                      onChange={(e) => setManualFormData({ ...manualFormData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      placeholder="スタッフの名前"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      フリガナ
                    </label>
                    <input
                      type="text"
                      value={manualFormData.nameKana}
                      onChange={(e) => setManualFormData({ ...manualFormData, nameKana: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      placeholder="フリガナ"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        メールアドレス
                      </label>
                      <input
                        type="email"
                        value={manualFormData.email}
                        onChange={(e) => setManualFormData({ ...manualFormData, email: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                        placeholder="example@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        電話番号
                      </label>
                      <input
                        type="tel"
                        value={manualFormData.phone}
                        onChange={(e) => setManualFormData({ ...manualFormData, phone: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                        placeholder="090-1234-5678"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        生年月日
                      </label>
                      <input
                        type="date"
                        value={manualFormData.birthDate}
                        onChange={(e) => setManualFormData({ ...manualFormData, birthDate: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        性別
                      </label>
                      <select
                        value={manualFormData.gender}
                        onChange={(e) => setManualFormData({ ...manualFormData, gender: e.target.value as any })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      >
                        <option value="">選択してください</option>
                        <option value="男性">男性</option>
                        <option value="女性">女性</option>
                        <option value="その他">その他</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        役職
                      </label>
                      <select
                        value={manualFormData.role}
                        onChange={(e) => setManualFormData({ ...manualFormData, role: e.target.value as any })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      >
                        <option value="一般スタッフ">一般スタッフ</option>
                        <option value="マネージャー">マネージャー</option>
                        <option value="管理者">管理者</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        雇用形態
                      </label>
                      <select
                        value={manualFormData.employmentType}
                        onChange={(e) => setManualFormData({ ...manualFormData, employmentType: e.target.value as any })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      >
                        <option value="常勤">常勤</option>
                        <option value="非常勤">非常勤</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      開始日
                    </label>
                    <input
                      type="date"
                      value={manualFormData.startDate}
                      onChange={(e) => setManualFormData({ ...manualFormData, startDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                    />
                  </div>

                  {/* パーソナルキャリア情報と同じ項目 */}
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <h4 className="font-bold text-gray-800 mb-4">キャリア情報（パーソナルアカウントと同じ項目）</h4>
                    
                    {/* 郵便番号・住所 */}
                    <div className="space-y-3 mb-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                          郵便番号
                        </label>
                        <input
                          type="text"
                          value={manualFormData.postalCode}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '');
                            setManualFormData({ ...manualFormData, postalCode: value });
                          }}
                          placeholder="1234567"
                          maxLength={7}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                          住所
                        </label>
                        <input
                          type="text"
                          value={manualFormData.address}
                          onChange={(e) => setManualFormData({ ...manualFormData, address: e.target.value })}
                          placeholder="都道府県市区町村番地"
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                        />
                      </div>
                    </div>

                    {/* 資格 */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        資格（複数選択可能）
                      </label>
                      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-md">
                        {QUALIFICATIONS.map((qual) => (
                          <button
                            key={qual}
                            type="button"
                            onClick={() => {
                              const isSelected = manualFormData.qualifications.includes(qual);
                              if (qual === '資格無し') {
                                if (isSelected) {
                                  setManualFormData({
                                    ...manualFormData,
                                    qualifications: manualFormData.qualifications.filter(q => q !== '資格無し'),
                                    qualificationCertificates: manualFormData.qualificationCertificates.filter(c => c.qualification !== '資格無し'),
                                  });
                                } else {
                                  setManualFormData({
                                    ...manualFormData,
                                    qualifications: ['資格無し'],
                                    qualificationCertificates: [{ qualification: '資格無し', file: null, url: '' }],
                                  });
                                }
                              } else {
                                const newQualifications = isSelected
                                  ? manualFormData.qualifications.filter(q => q !== qual)
                                  : [...manualFormData.qualifications.filter(q => q !== '資格無し'), qual];
                                const newCertificates = isSelected
                                  ? manualFormData.qualificationCertificates.filter(c => c.qualification !== qual)
                                  : [...manualFormData.qualificationCertificates.filter(c => c.qualification !== '資格無し'), { qualification: qual, file: null, url: '' }];
                                setManualFormData({
                                  ...manualFormData,
                                  qualifications: newQualifications,
                                  qualificationCertificates: newCertificates,
                                });
                              }
                            }}
                            className={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${
                              manualFormData.qualifications.includes(qual)
                                ? 'bg-[#00c4cc] text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {qual}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 資格証の写真 */}
                    {manualFormData.qualifications.filter(q => q !== '資格無し').length > 0 && (
                      <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                          資格証の写真
                        </label>
                        <div className="space-y-2">
                          {manualFormData.qualifications.filter(q => q !== '資格無し').map((qual) => {
                            const cert = manualFormData.qualificationCertificates.find(c => c.qualification === qual);
                            return (
                              <div key={qual} className="border border-gray-200 rounded-md p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-bold text-gray-700">{qual}</span>
                                  {cert?.url && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setManualFormData({
                                          ...manualFormData,
                                          qualificationCertificates: manualFormData.qualificationCertificates.map(c =>
                                            c.qualification === qual ? { ...c, file: null, url: '' } : c
                                          ),
                                        });
                                      }}
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      <X size={16} />
                                    </button>
                                  )}
                                </div>
                                {cert?.url ? (
                                  <img
                                    src={cert.url}
                                    alt={qual}
                                    className="w-full h-32 object-contain border border-gray-300 rounded-md bg-gray-50"
                                  />
                                ) : (
                                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                                    <Upload className="w-6 h-6 text-gray-400 mb-1" />
                                    <span className="text-xs text-gray-500">画像をアップロード</span>
                                    <input
                                      type="file"
                                      className="hidden"
                                      accept="image/*"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const reader = new FileReader();
                                          reader.onloadend = () => {
                                            setManualFormData({
                                              ...manualFormData,
                                              qualificationCertificates: manualFormData.qualificationCertificates.map(c =>
                                                c.qualification === qual ? { ...c, file, url: reader.result as string } : c
                                              ),
                                            });
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                    />
                                  </label>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 職歴・学歴 */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        職歴・学歴
                      </label>
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {manualFormData.workHistory.map((history, index) => (
                          <div key={history.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-700">
                                  {history.type === 'employment' ? '職歴' : '学歴'}
                                </span>
                                <span className="text-xs text-gray-500">#{index + 1}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setManualFormData({
                                    ...manualFormData,
                                    workHistory: manualFormData.workHistory.filter(h => h.id !== history.id),
                                  });
                                }}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={history.organization}
                              onChange={(e) => {
                                setManualFormData({
                                  ...manualFormData,
                                  workHistory: manualFormData.workHistory.map(h =>
                                    h.id === history.id ? { ...h, organization: e.target.value } : h
                                  ),
                                });
                              }}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                              placeholder={history.type === 'employment' ? '事業所名' : '学校名'}
                            />
                            {history.type === 'employment' && (
                              <input
                                type="text"
                                value={history.position || ''}
                                onChange={(e) => {
                                  setManualFormData({
                                    ...manualFormData,
                                    workHistory: manualFormData.workHistory.map(h =>
                                      h.id === history.id ? { ...h, position: e.target.value } : h
                                    ),
                                  });
                                }}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                placeholder="役職・職種"
                              />
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="month"
                                value={history.startDate}
                                onChange={(e) => {
                                  setManualFormData({
                                    ...manualFormData,
                                    workHistory: manualFormData.workHistory.map(h =>
                                      h.id === history.id ? { ...h, startDate: e.target.value } : h
                                    ),
                                  });
                                }}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                placeholder="開始年月"
                              />
                              <input
                                type="month"
                                value={history.endDate}
                                onChange={(e) => {
                                  setManualFormData({
                                    ...manualFormData,
                                    workHistory: manualFormData.workHistory.map(h =>
                                      h.id === history.id ? { ...h, endDate: e.target.value } : h
                                    ),
                                  });
                                }}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                placeholder="終了年月"
                              />
                            </div>
                            <textarea
                              value={history.description}
                              onChange={(e) => {
                                setManualFormData({
                                  ...manualFormData,
                                  workHistory: manualFormData.workHistory.map(h =>
                                    h.id === history.id ? { ...h, description: e.target.value } : h
                                  ),
                                });
                              }}
                              rows={2}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                              placeholder="詳細・備考"
                            />
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const newId = `work_${Date.now()}`;
                              setManualFormData({
                                ...manualFormData,
                                workHistory: [...manualFormData.workHistory, {
                                  id: newId,
                                  type: 'employment',
                                  organization: '',
                                  position: '',
                                  startDate: '',
                                  endDate: '',
                                  description: '',
                                }],
                              });
                            }}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-bold transition-colors"
                          >
                            + 職歴を追加
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const newId = `edu_${Date.now()}`;
                              setManualFormData({
                                ...manualFormData,
                                workHistory: [...manualFormData.workHistory, {
                                  id: newId,
                                  type: 'education',
                                  organization: '',
                                  startDate: '',
                                  endDate: '',
                                  description: '',
                                }],
                              });
                            }}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-bold transition-colors"
                          >
                            + 学歴を追加
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 事業所側から登録する情報 */}
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <h4 className="font-bold text-gray-800 mb-4">事業所側から登録する情報</h4>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                          月給（円）
                        </label>
                        <input
                          type="number"
                          value={manualFormData.monthlySalary || ''}
                          onChange={(e) => setManualFormData({ ...manualFormData, monthlySalary: e.target.value ? parseInt(e.target.value) : undefined })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                          placeholder="300000"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                          時給（円）
                        </label>
                        <input
                          type="number"
                          value={manualFormData.hourlyWage || ''}
                          onChange={(e) => setManualFormData({ ...manualFormData, hourlyWage: e.target.value ? parseInt(e.target.value) : undefined })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                          placeholder="1500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        施設での役割
                      </label>
                      <input
                        type="text"
                        value={manualFormData.facilityRole}
                        onChange={(e) => setManualFormData({ ...manualFormData, facilityRole: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                        placeholder="例: 児童発達支援管理責任者、指導員など"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setInviteMethod(null);
                        setManualFormData({
                          name: '',
                          nameKana: '',
                          email: '',
                          phone: '',
                          birthDate: '',
                          gender: '',
                          role: '一般スタッフ',
                          employmentType: '常勤',
                          startDate: new Date().toISOString().split('T')[0],
                          postalCode: '',
                          address: '',
                          qualifications: [],
                          qualificationCertificates: [],
                          workHistory: [],
                          monthlySalary: undefined,
                          hourlyWage: undefined,
                          facilityRole: '',
                        });
                      }}
                      className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-md text-sm transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={async () => {
                        if (!facility?.id) {
                          alert('施設情報が取得できませんでした');
                          return;
                        }

                        if (!manualFormData.name || (!manualFormData.email && !manualFormData.phone)) {
                          alert('名前とメールアドレスまたは電話番号を入力してください');
                          return;
                        }

                        setInviteLoading(true);
                        try {
                          // 資格証の写真をSupabase Storageにアップロード
                          const uploadedCertificates: { qualification: string; url: string }[] = [];
                          for (const cert of manualFormData.qualificationCertificates) {
                            if (cert.file) {
                              const fileExt = cert.file.name.split('.').pop();
                              const fileName = `${facility.id}/qualifications/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                              const { error: uploadError } = await supabase.storage
                                .from('qualifications')
                                .upload(fileName, cert.file);
                              
                              if (!uploadError) {
                                const { data: urlData } = supabase.storage
                                  .from('qualifications')
                                  .getPublicUrl(fileName);
                                uploadedCertificates.push({
                                  qualification: cert.qualification,
                                  url: urlData.publicUrl,
                                });
                              }
                            } else if (cert.url) {
                              uploadedCertificates.push({
                                qualification: cert.qualification,
                                url: cert.url,
                              });
                            }
                          }

                          // staffテーブルにシャドウアカウントとして登録（user_idはNULL）
                          const { data, error } = await supabase
                            .from('staff')
                            .insert({
                              id: `staff-${Date.now()}`,
                              facility_id: facility.id,
                              name: manualFormData.name,
                              name_kana: manualFormData.nameKana || null,
                              role: manualFormData.role,
                              type: manualFormData.employmentType,
                              birth_date: manualFormData.birthDate || null,
                              gender: manualFormData.gender || null,
                              email: manualFormData.email || null,
                              phone: manualFormData.phone || null,
                              address: manualFormData.address || null,
                              qualifications: manualFormData.qualifications.length > 0 ? manualFormData.qualifications.join(',') : null,
                              monthly_salary: manualFormData.monthlySalary || null,
                              hourly_wage: manualFormData.hourlyWage || null,
                              // 追加情報をJSONBとして保存（memoフィールドに一時的に保存、後で専用フィールドを追加）
                              memo: JSON.stringify({
                                postalCode: manualFormData.postalCode,
                                qualificationCertificates: uploadedCertificates,
                                workHistory: manualFormData.workHistory,
                                facilityRole: manualFormData.facilityRole,
                              }),
                              user_id: null, // シャドウアカウント
                              created_at: new Date().toISOString(),
                              updated_at: new Date().toISOString(),
                            })
                            .select()
                            .single();

                          if (error) {
                            throw new Error(`登録エラー: ${error.message}`);
                          }

                          alert('スタッフを登録しました。後日、スタッフ本人が同じメールアドレスまたは電話番号でアカウントを作成すると、自動的に紐付けられます。');
                          
                          // フォームをリセット
                          setInviteMethod(null);
                          setManualFormData({
                            name: '',
                            nameKana: '',
                            email: '',
                            phone: '',
                            birthDate: '',
                            gender: '',
                            role: '一般スタッフ',
                            employmentType: '常勤',
                            startDate: new Date().toISOString().split('T')[0],
                            postalCode: '',
                            address: '',
                            qualifications: [],
                            qualificationCertificates: [],
                            workHistory: [],
                            monthlySalary: undefined,
                            hourlyWage: undefined,
                            facilityRole: '',
                          });
                          setIsInviteModalOpen(false);
                          
                          // ページをリロードしてスタッフ一覧を更新
                          window.location.reload();
                        } catch (error: any) {
                          alert(`登録エラー: ${error.message || 'Unknown error'}`);
                        } finally {
                          setInviteLoading(false);
                        }
                      }}
                      disabled={inviteLoading}
                      className="flex-1 py-2.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-md text-sm transition-colors disabled:opacity-50"
                    >
                      {inviteLoading ? '登録中...' : '登録する'}
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
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                  <User size={20} className="text-[#00c4cc]" />
                  {selectedStaff.name} さんの詳細情報
                </h3>
                {selectedStaff.user_id && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    本人認証済み
                  </span>
                )}
                {!selectedStaff.user_id && (
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">
                    未確認（代理登録）
                  </span>
                )}
              </div>
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
              {selectedStaff.user_id && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <p className="text-sm text-blue-800">
                    <strong>このスタッフの情報は本人によって管理されています（本人認証済み）</strong><br />
                    個人のマスターデータ（氏名、生年月日、資格、住所など）は本人のみが編集できます。
                    情報に誤りがある場合は、本人に更新をリクエストしてください。
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">
                    <User size={16} />
                    基本情報
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-gray-500">名前:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedStaff.name}</span>
                        {selectedStaff.user_id && (
                          <span className="ml-2 text-xs text-gray-400">（本人管理）</span>
                        )}
                      </div>
                      {selectedStaff.user_id && (
                        <button
                          onClick={() => {
                            // TODO: 本人に情報の更新をリクエストする機能を実装
                            alert('本人に情報の更新をリクエストする機能は今後実装予定です');
                          }}
                          className="px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition-colors"
                        >
                          更新をリクエスト
                        </button>
                      )}
                    </div>
                    {selectedStaff.nameKana && (
                      <div>
                        <span className="text-gray-500">ふりがな:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedStaff.nameKana}</span>
                        {selectedStaff.user_id && (
                          <span className="ml-2 text-xs text-gray-400">（本人管理）</span>
                        )}
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">役職:</span>
                      <span className="ml-2 font-medium text-gray-800">{selectedStaff.role}</span>
                      <span className="ml-2 text-xs text-gray-400">（事業所管理）</span>
                    </div>
                    <div>
                      <span className="text-gray-500">雇用形態:</span>
                      <span className="ml-2 font-medium text-gray-800">{selectedStaff.type}</span>
                      <span className="ml-2 text-xs text-gray-400">（事業所管理）</span>
                    </div>
                    {selectedStaff.birthDate && (
                      <div>
                        <span className="text-gray-500">生年月日:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedStaff.birthDate}</span>
                        {selectedStaff.user_id && (
                          <span className="ml-2 text-xs text-gray-400">（本人管理）</span>
                        )}
                      </div>
                    )}
                    {selectedStaff.gender && (
                      <div>
                        <span className="text-gray-500">性別:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedStaff.gender}</span>
                        {selectedStaff.user_id && (
                          <span className="ml-2 text-xs text-gray-400">（本人管理）</span>
                        )}
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
                        {selectedStaff.user_id && (
                          <span className="ml-2 text-xs text-gray-400">（本人管理）</span>
                        )}
                      </div>
                    )}
                    {selectedStaff.phone && (
                      <div>
                        <span className="text-gray-500">電話:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedStaff.phone}</span>
                        {selectedStaff.user_id && (
                          <span className="ml-2 text-xs text-gray-400">（本人管理）</span>
                        )}
                      </div>
                    )}
                    {selectedStaff.address && (
                      <div>
                        <span className="text-gray-500">住所:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedStaff.address}</span>
                        {selectedStaff.user_id && (
                          <span className="ml-2 text-xs text-gray-400">（本人管理）</span>
                        )}
                      </div>
                    )}
                    {selectedStaff.emergencyContact && (
                      <div>
                        <span className="text-gray-500">緊急連絡先:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedStaff.emergencyContact}</span>
                        {selectedStaff.user_id && (
                          <span className="ml-2 text-xs text-gray-400">（本人管理）</span>
                        )}
                      </div>
                    )}
                    {selectedStaff.emergencyContactPhone && (
                      <div>
                        <span className="text-gray-500">緊急連絡先電話:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedStaff.emergencyContactPhone}</span>
                        {selectedStaff.user_id && (
                          <span className="ml-2 text-xs text-gray-400">（本人管理）</span>
                        )}
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
                        {selectedStaff.user_id && (
                          <span className="ml-2 text-xs text-gray-400">（本人管理）</span>
                        )}
                      </div>
                    )}
                    {selectedStaff.yearsOfExperience !== undefined && (
                      <div>
                        <span className="text-gray-500">経験年数:</span>
                        <span className="ml-2 font-medium text-gray-800">{selectedStaff.yearsOfExperience}年</span>
                        {selectedStaff.user_id && (
                          <span className="ml-2 text-xs text-gray-400">（本人管理）</span>
                        )}
                      </div>
                    )}
                    {selectedStaff.monthlySalary !== undefined && (
                      <div>
                        <span className="text-gray-500">月給:</span>
                        <span className="ml-2 font-medium text-gray-800">¥{selectedStaff.monthlySalary?.toLocaleString()}</span>
                        <span className="ml-2 text-xs text-gray-400">（事業所管理）</span>
                      </div>
                    )}
                    {selectedStaff.hourlyWage !== undefined && (
                      <div>
                        <span className="text-gray-500">時給:</span>
                        <span className="ml-2 font-medium text-gray-800">¥{selectedStaff.hourlyWage?.toLocaleString()}</span>
                        <span className="ml-2 text-xs text-gray-400">（事業所管理）</span>
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

              {/* パーソナルキャリア情報 */}
              {(() => {
                let careerData: any = null;
                try {
                  if (selectedStaff.memo && typeof selectedStaff.memo === 'string') {
                    careerData = JSON.parse(selectedStaff.memo);
                  }
                } catch (e) {
                  // memoがJSONでない場合は無視
                }

                return (
                  <div className="border-t border-gray-200 pt-6 mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-sm text-gray-700 flex items-center gap-2">
                        <Award size={16} />
                        パーソナルキャリア情報
                      </h4>
                      {!selectedStaff.user_id && (
                        <button
                          onClick={() => {
                            setEditingStaffData(selectedStaff);
                            setIsEditModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white rounded-md text-xs font-bold transition-colors"
                        >
                          編集
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      {/* 郵便番号・住所 */}
                      {(careerData?.postalCode || selectedStaff.address) && (
                        <div>
                          <h5 className="text-xs font-bold text-gray-600 mb-2">住所情報</h5>
                          <div className="space-y-1 text-sm">
                            {careerData?.postalCode && (
                              <div>
                                <span className="text-gray-500">郵便番号:</span>
                                <span className="ml-2 font-medium text-gray-800">{careerData.postalCode}</span>
                              </div>
                            )}
                            {selectedStaff.address && (
                              <div>
                                <span className="text-gray-500">住所:</span>
                                <span className="ml-2 font-medium text-gray-800">{selectedStaff.address}</span>
                                {selectedStaff.user_id && (
                                  <span className="ml-2 text-xs text-gray-400">（本人管理）</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 資格 */}
                      {(selectedStaff.qualifications || careerData?.qualificationCertificates) && (
                        <div>
                          <h5 className="text-xs font-bold text-gray-600 mb-2">資格</h5>
                          <div className="space-y-2">
                            {selectedStaff.qualifications && (
                              <div className="flex flex-wrap gap-2">
                                {selectedStaff.qualifications.split(',').map((qual: string, idx: number) => (
                                  <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">
                                    {qual}
                                  </span>
                                ))}
                              </div>
                            )}
                            {careerData?.qualificationCertificates && (
                              <div className="grid grid-cols-2 gap-2">
                                {(careerData.qualificationCertificates || []).map((cert: any, idx: number) => (
                                  <div key={idx} className="border border-gray-200 rounded-md p-2">
                                    <div className="text-xs font-bold text-gray-700 mb-1">{cert.qualification}</div>
                                    {cert.url && (
                                      <img
                                        src={cert.url}
                                        alt={cert.qualification}
                                        className="w-full h-24 object-contain bg-gray-50 rounded"
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 職歴・学歴 */}
                      {careerData?.workHistory && (
                        <div>
                          <h5 className="text-xs font-bold text-gray-600 mb-2">職歴・学歴</h5>
                          <div className="space-y-2">
                            {(careerData?.workHistory || []).map((history: any, idx: number) => (
                              <div key={idx} className="border border-gray-200 rounded-md p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold text-gray-700">
                                    {history.type === 'employment' ? '職歴' : '学歴'}
                                  </span>
                                </div>
                                <div className="text-sm space-y-1">
                                  <div>
                                    <span className="text-gray-500">組織名:</span>
                                    <span className="ml-2 font-medium text-gray-800">{history.organization}</span>
                                  </div>
                                  {history.position && (
                                    <div>
                                      <span className="text-gray-500">役職:</span>
                                      <span className="ml-2 font-medium text-gray-800">{history.position}</span>
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-gray-500">期間:</span>
                                    <span className="ml-2 font-medium text-gray-800">
                                      {history.startDate} ～ {history.endDate || '現在'}
                                    </span>
                                  </div>
                                  {history.description && (
                                    <div>
                                      <span className="text-gray-500">詳細:</span>
                                      <span className="ml-2 font-medium text-gray-800">{history.description}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 施設での役割 */}
                      {careerData?.facilityRole && (
                        <div>
                          <h5 className="text-xs font-bold text-gray-600 mb-2">施設での役割</h5>
                          <div className="text-sm">
                            <span className="font-medium text-gray-800">{careerData.facilityRole}</span>
                            <span className="ml-2 text-xs text-gray-400">（事業所管理）</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
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

      {/* 編集モーダル（代理登録アカウント用） */}
      {isEditModalOpen && editingStaffData && !editingStaffData.user_id && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <User size={20} className="text-[#00c4cc]" />
                {editingStaffData.name} さんの情報を編集
              </h3>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingStaffData(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  代理登録アカウントの情報を編集できます。スタッフ本人がアカウントを作成すると、この情報は本人の管理下に移ります。
                </p>
              </div>
              {/* TODO: 編集フォームを実装（代理登録フォームと同じ構造） */}
              <p className="text-gray-600 text-sm">編集フォームは今後実装予定です。</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagementView;

