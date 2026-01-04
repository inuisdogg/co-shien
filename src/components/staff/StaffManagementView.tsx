/**
 * スタッフ管理ビュー
 * スタッフ一覧、招待リンク作成、スタッフ詳細、勤怠簿一覧
 */

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Users, Plus, Mail, X, Clock, Calendar, User, Phone, MapPin, Briefcase, Award, FileText, QrCode, Download, Upload, Trash2, Edit } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Staff, UserPermissions, StaffInvitation } from '@/types';
import { useFacilityData } from '@/hooks/useFacilityData';
import { inviteStaff } from '@/utils/staffInvitationService';
import { useAuth } from '@/contexts/AuthContext';
import { getPersonalBaseUrl } from '@/utils/domain';
import { supabase } from '@/lib/supabase';
import { getJapaneseHolidays, isJapaneseHoliday } from '@/utils/japaneseHolidays';

// 型定義
type QualificationCertificate = {
  qualification: string;
  file: File | null;
  url: string;
};

type ExperienceRecord = {
  id: string;
  facilityName: string;
  startDate: string;
  endDate?: string;
};

type EducationHistory = {
  id: string;
  schoolName: string;
  graduationDate: string;
  degree: string;
};

type Dependent = {
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
};

type AttendanceRecord = {
  id: string;
  user_id: string;
  facility_id: string;
  date: string;
  type: 'start' | 'end' | 'break_start' | 'break_end' | 'manual';
  time?: string;
  created_at: string;
};

type CareerData = {
  qualificationCertificates?: QualificationCertificate[];
  experienceRecords?: ExperienceRecord[];
  educationHistory?: EducationHistory[];
  facilityRole?: string;
  [key: string]: unknown;
};

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
  const { facility, isAdmin } = useAuth();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteMethod, setInviteMethod] = useState<'link' | 'qr' | 'manual' | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceMonth, setAttendanceMonth] = useState(new Date());
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [publicInviteLink, setPublicInviteLink] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStaffData, setEditingStaffData] = useState<Staff | null>(null);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    nameKana: string;
    email: string;
    phone: string;
    birthDate: string;
    gender: '男性' | '女性' | 'その他' | '';
    address: string;
    postalCode: string;
    myNumber: string;
    hasSpouse: boolean;
    spouseName: string;
    basicPensionSymbol: string;
    basicPensionNumber: string;
    employmentInsuranceStatus: 'joined' | 'not_joined' | 'first_time';
    employmentInsuranceNumber: string;
    previousRetirementDate: string;
    previousName: string;
    socialInsuranceStatus: 'joined' | 'not_joined';
    hasDependents: boolean;
    dependentCount: number;
    dependents: Dependent[];
    qualifications: string[];
    qualificationCertificates: QualificationCertificate[];
    experienceRecords: ExperienceRecord[];
    educationHistory: EducationHistory[];
    role: '一般スタッフ' | 'マネージャー' | '管理者';
    employmentType: '常勤' | '非常勤';
    startDate: string;
    monthlySalary?: number;
    hourlyWage?: number;
    facilityRole: string;
  } | null>(null);
  
  // 手動登録フォーム用の状態（パーソナルキャリアタブの全項目を含む）
  const [manualFormData, setManualFormData] = useState({
    // 基本情報
    name: '',
    nameKana: '',
    email: '',
    phone: '',
    birthDate: '',
    gender: '' as '男性' | '女性' | 'その他' | '',
    address: '',
    postalCode: '',
    // マイナンバー
    myNumber: '',
    // 配偶者
    hasSpouse: false,
    spouseName: '',
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
    // 資格
    qualifications: [] as string[],
    qualificationCertificates: [] as { qualification: string; file: File | null; url: string }[],
    // 職歴
    experienceRecords: [] as Array<{
      id: string;
      facilityName: string;
      startDate: string;
      endDate?: string;
    }>,
    // 学歴
    educationHistory: [] as Array<{
      id: string;
      schoolName: string;
      graduationDate: string;
      degree: string;
    }>,
    // 事業所側から登録する情報
    role: '一般スタッフ' as '一般スタッフ' | 'マネージャー' | '管理者',
    employmentType: '常勤' as '常勤' | '非常勤',
    startDate: new Date().toISOString().split('T')[0],
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
          // user_careersテーブルから資格・職歴・学歴を取得
          const { data: careerRecords } = await supabase
            .from('user_careers')
            .select('*')
            .eq('user_id', staff.user_id);
          
          // ユーザー情報をスタッフ情報にマージ
          setSelectedStaff({
            ...staff,
            ...userData,
            // パーソナル側のキャリア情報をマージ
            postalCode: userData.postal_code || null,
            myNumber: userData.my_number || null,
            hasSpouse: !!userData.spouse_name,
            spouseName: userData.spouse_name || null,
            basicPensionSymbol: userData.basic_pension_symbol || null,
            basicPensionNumber: userData.basic_pension_number || null,
            employmentInsuranceStatus: userData.employment_insurance_status || 'joined',
            employmentInsuranceNumber: userData.employment_insurance_number || null,
            previousRetirementDate: userData.previous_retirement_date || null,
            previousName: userData.previous_name || null,
            socialInsuranceStatus: userData.social_insurance_status || 'joined',
            hasDependents: userData.has_dependents || false,
            dependentCount: userData.dependent_count || 0,
            dependents: userData.dependents || [],
            // user_careersから取得した情報
            careerRecords: careerRecords || [],
          } as any);
        }
      } catch (error) {
        console.error('ユーザー情報取得エラー:', error);
      }
    }
  };

  // 編集モーダルを開く（代理登録アカウント用、管理者は全スタッフ編集可能）
  const handleOpenEdit = async (staff: Staff) => {
    // 管理者でない場合、パーソナルアカウントに紐づいているスタッフは編集不可
    if (!isAdmin && staff.user_id) {
      alert('パーソナルアカウントに紐づいているスタッフは、Biz側から編集できません。スタッフ本人がパーソナル側で編集してください。');
      return;
    }

    // memoフィールドからJSONデータを取得
    let careerData: CareerData | null = null;
    try {
      if (staff.memo && typeof staff.memo === 'string') {
        careerData = JSON.parse(staff.memo);
      }
    } catch (e) {
      // memoがJSONでない場合は無視
    }

    // employment_recordsからstartDateを取得
    let startDate = new Date().toISOString().split('T')[0]; // デフォルト値：今日の日付
    if (staff.user_id && facility?.id) {
      try {
        const { data: employmentRecord } = await supabase
          .from('employment_records')
          .select('start_date')
          .eq('user_id', staff.user_id)
          .eq('facility_id', facility.id)
          .is('end_date', null)
          .single();
        
        if (employmentRecord?.start_date) {
          startDate = employmentRecord.start_date;
        }
      } catch (error) {
        console.error('雇用記録取得エラー:', error);
        // エラーが発生した場合はデフォルト値を使用
      }
    }

    // 編集用のデータを設定
    const editData = {
      ...staff,
      ...careerData,
      // フォームデータに変換
      nameKana: staff.nameKana || '',
      qualifications: staff.qualifications ? staff.qualifications.split(',') : [],
      qualificationCertificates: (careerData?.qualificationCertificates || []).map((c: QualificationCertificate) => ({
        qualification: c.qualification,
        file: null,
        url: c.url || '',
      })),
      experienceRecords: careerData?.experienceRecords || [],
      educationHistory: careerData?.educationHistory || [],
      monthlySalary: staff.monthlySalary || undefined,
      hourlyWage: staff.hourlyWage || undefined,
      facilityRole: careerData?.facilityRole || '',
      facilityRoles: careerData?.facilityRoles || (careerData?.facilityRole ? careerData.facilityRole.split(',').map((r: string) => r.trim()) : []),
      // employmentTypeとstartDateを追加
      employmentType: staff.type || '常勤',
      startDate: startDate,
    };
    setEditingStaffData(staff);
    setEditFormData(editData);
    setIsEditModalOpen(true);
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
      const staffRecords = records.filter((r: AttendanceRecord) => 
        r.user_id === staff.user_id && 
        r.facility_id === facility?.id
      );
      
      // 月でフィルタリング
      const year = attendanceMonth.getFullYear();
      const month = attendanceMonth.getMonth();
      const filteredRecords = staffRecords.filter((r: AttendanceRecord) => {
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
      if (!facility?.id) {
        throw new Error('施設情報が取得できませんでした');
      }

      const invitation: StaffInvitation = {
        facilityId: facility.id,
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
      const baseUrl = getPersonalBaseUrl();
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
                    {s.facilityRole && s.facilityRole.trim() ? s.facilityRole : 'ー'}
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
                          const baseUrl = getPersonalBaseUrl();
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
                    <h4 className="font-bold text-gray-800 mb-4">基本プロフィール（パーソナルアカウントと同じ項目）</h4>
                    
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
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </div>
                    </div>

                    {/* マイナンバー */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        マイナンバー
                      </label>
                      <input
                        type="text"
                        value={manualFormData.myNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 12);
                          setManualFormData({ ...manualFormData, myNumber: value });
                        }}
                        placeholder="12桁のマイナンバー"
                        maxLength={12}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      />
                    </div>

                    {/* 配偶者 */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        配偶者
                      </label>
                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="hasSpouse"
                              checked={manualFormData.hasSpouse}
                              onChange={() => setManualFormData({ ...manualFormData, hasSpouse: true })}
                              className="w-4 h-4 text-[#00c4cc]"
                            />
                            <span className="text-sm">有</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="hasSpouse"
                              checked={!manualFormData.hasSpouse}
                              onChange={() => setManualFormData({ ...manualFormData, hasSpouse: false, spouseName: '' })}
                              className="w-4 h-4 text-[#00c4cc]"
                            />
                            <span className="text-sm">無</span>
                          </label>
                        </div>
                        {manualFormData.hasSpouse && (
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">配偶者氏名</label>
                            <input
                              type="text"
                              value={manualFormData.spouseName}
                              onChange={(e) => setManualFormData({ ...manualFormData, spouseName: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 基礎年金番号 */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        基礎年金番号
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">記号（4桁）</label>
                          <input
                            type="text"
                            value={manualFormData.basicPensionSymbol}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                              setManualFormData({ ...manualFormData, basicPensionSymbol: value });
                            }}
                            maxLength={4}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">番号（6桁）</label>
                          <input
                            type="text"
                            value={manualFormData.basicPensionNumber}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                              setManualFormData({ ...manualFormData, basicPensionNumber: value });
                            }}
                            maxLength={6}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 雇用保険 */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        雇用保険
                      </label>
                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="employmentInsurance"
                              value="joined"
                              checked={manualFormData.employmentInsuranceStatus === 'joined'}
                              onChange={(e) => setManualFormData({ ...manualFormData, employmentInsuranceStatus: e.target.value as any })}
                              className="w-4 h-4 text-[#00c4cc]"
                            />
                            <span className="text-sm">加入</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="employmentInsurance"
                              value="not_joined"
                              checked={manualFormData.employmentInsuranceStatus === 'not_joined'}
                              onChange={(e) => setManualFormData({ ...manualFormData, employmentInsuranceStatus: e.target.value as any })}
                              className="w-4 h-4 text-[#00c4cc]"
                            />
                            <span className="text-sm">非加入</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="employmentInsurance"
                              value="first_time"
                              checked={manualFormData.employmentInsuranceStatus === 'first_time'}
                              onChange={(e) => setManualFormData({ ...manualFormData, employmentInsuranceStatus: e.target.value as any })}
                              className="w-4 h-4 text-[#00c4cc]"
                            />
                            <span className="text-sm">初めて加入</span>
                          </label>
                        </div>
                        {manualFormData.employmentInsuranceStatus === 'joined' && (
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">雇用保険番号（被保険者番号）</label>
                            <input
                              type="text"
                              value={manualFormData.employmentInsuranceNumber}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^\d-]/g, '');
                                setManualFormData({ ...manualFormData, employmentInsuranceNumber: value });
                              }}
                              placeholder="例: 1234-567890-1"
                              maxLength={13}
                              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                            <p className="text-xs text-gray-500 mt-1">4桁-6桁-1桁の形式で入力してください</p>
                          </div>
                        )}
                        {manualFormData.employmentInsuranceStatus === 'first_time' && (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">前職の名（旧姓の場合）</label>
                              <input
                                type="text"
                                value={manualFormData.previousName}
                                onChange={(e) => setManualFormData({ ...manualFormData, previousName: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">前職の退職日</label>
                              <input
                                type="date"
                                value={manualFormData.previousRetirementDate}
                                onChange={(e) => setManualFormData({ ...manualFormData, previousRetirementDate: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 社会保険 */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        社会保険
                      </label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="socialInsurance"
                            value="joined"
                            checked={manualFormData.socialInsuranceStatus === 'joined'}
                            onChange={(e) => setManualFormData({ ...manualFormData, socialInsuranceStatus: e.target.value as any })}
                            className="w-4 h-4 text-[#00c4cc]"
                          />
                          <span className="text-sm">加入</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="socialInsurance"
                            value="not_joined"
                            checked={manualFormData.socialInsuranceStatus === 'not_joined'}
                            onChange={(e) => setManualFormData({ ...manualFormData, socialInsuranceStatus: e.target.value as any })}
                            className="w-4 h-4 text-[#00c4cc]"
                          />
                          <span className="text-sm">非加入</span>
                        </label>
                      </div>
                    </div>

                    {/* 扶養家族 */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        扶養家族
                      </label>
                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="hasDependents"
                              checked={manualFormData.hasDependents}
                              onChange={() => setManualFormData({ ...manualFormData, hasDependents: true })}
                              className="w-4 h-4 text-[#00c4cc]"
                            />
                            <span className="text-sm">有</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="hasDependents"
                              checked={!manualFormData.hasDependents}
                              onChange={() => setManualFormData({ ...manualFormData, hasDependents: false, dependents: [], dependentCount: 0 })}
                              className="w-4 h-4 text-[#00c4cc]"
                            />
                            <span className="text-sm">無</span>
                          </label>
                        </div>
                        {manualFormData.hasDependents && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">人数</label>
                              <input
                                type="number"
                                min="0"
                                value={manualFormData.dependentCount}
                                onChange={(e) => {
                                  const count = parseInt(e.target.value) || 0;
                                  const currentDependents = manualFormData.dependents;
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
                                  setManualFormData({ ...manualFormData, dependentCount: count, dependents: newDependents });
                                }}
                                className="w-24 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                              />
                              <span className="ml-2 text-sm text-gray-600">人</span>
                            </div>
                            {manualFormData.dependents.map((dependent, index) => (
                              <div key={dependent.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
                                <h5 className="text-sm font-bold text-gray-700">扶養家族 {index + 1}</h5>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">続柄</label>
                                    <input
                                      type="text"
                                      value={dependent.relationship}
                                      onChange={(e) => {
                                        const updated = [...manualFormData.dependents];
                                        updated[index].relationship = e.target.value;
                                        setManualFormData({ ...manualFormData, dependents: updated });
                                      }}
                                      placeholder="例：妻、子"
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">生年月日</label>
                                    <input
                                      type="date"
                                      value={dependent.birthDate}
                                      onChange={(e) => {
                                        const updated = [...manualFormData.dependents];
                                        updated[index].birthDate = e.target.value;
                                        setManualFormData({ ...manualFormData, dependents: updated });
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
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
                                        const updated = [...manualFormData.dependents];
                                        updated[index].furigana = e.target.value;
                                        setManualFormData({ ...manualFormData, dependents: updated });
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">氏名</label>
                                    <input
                                      type="text"
                                      value={dependent.name}
                                      onChange={(e) => {
                                        const updated = [...manualFormData.dependents];
                                        updated[index].name = e.target.value;
                                        setManualFormData({ ...manualFormData, dependents: updated });
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
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
                                          const updated = [...manualFormData.dependents];
                                          updated[index].gender = 'male';
                                          setManualFormData({ ...manualFormData, dependents: updated });
                                        }}
                                        className="w-4 h-4 text-[#00c4cc]"
                                      />
                                      <span className="text-sm">男</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                      <input
                                        type="radio"
                                        name={`dependent-gender-${index}`}
                                        checked={dependent.gender === 'female'}
                                        onChange={() => {
                                          const updated = [...manualFormData.dependents];
                                          updated[index].gender = 'female';
                                          setManualFormData({ ...manualFormData, dependents: updated });
                                        }}
                                        className="w-4 h-4 text-[#00c4cc]"
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
                                        const updated = [...manualFormData.dependents];
                                        updated[index].occupation = e.target.value;
                                        setManualFormData({ ...manualFormData, dependents: updated });
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">収入（年収）</label>
                                    <input
                                      type="text"
                                      value={dependent.annualIncome}
                                      onChange={(e) => {
                                        const updated = [...manualFormData.dependents];
                                        updated[index].annualIncome = e.target.value;
                                        setManualFormData({ ...manualFormData, dependents: updated });
                                      }}
                                      placeholder="円"
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="flex items-center gap-2 mb-2">
                                    <input
                                      type="checkbox"
                                      checked={dependent.notWorking}
                                      onChange={(e) => {
                                        const updated = [...manualFormData.dependents];
                                        updated[index].notWorking = e.target.checked;
                                        setManualFormData({ ...manualFormData, dependents: updated });
                                      }}
                                      className="w-4 h-4 text-[#00c4cc]"
                                    />
                                    <span className="text-xs text-gray-600">働いていない場合</span>
                                  </label>
                                  {dependent.notWorking && (
                                    <select
                                      value={dependent.notWorkingReason}
                                      onChange={(e) => {
                                        const updated = [...manualFormData.dependents];
                                        updated[index].notWorkingReason = e.target.value;
                                        setManualFormData({ ...manualFormData, dependents: updated });
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
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
                                      const updated = [...manualFormData.dependents];
                                      updated[index].myNumber = e.target.value.replace(/\D/g, '').slice(0, 12);
                                      setManualFormData({ ...manualFormData, dependents: updated });
                                    }}
                                    maxLength={12}
                                    placeholder="12桁"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                  />
                                </div>
                                {index > 0 && (
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">別居の場合は住所を明記</label>
                                    <input
                                      type="text"
                                      value={dependent.separateAddress || ''}
                                      onChange={(e) => {
                                        const updated = [...manualFormData.dependents];
                                        updated[index].separateAddress = e.target.value;
                                        setManualFormData({ ...manualFormData, dependents: updated });
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
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

                    {/* 職歴 */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        職歴（実務経験）
                      </label>
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {manualFormData.experienceRecords.map((record, index) => (
                          <div key={record.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-700">職歴</span>
                                <span className="text-xs text-gray-500">#{index + 1}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setManualFormData({
                                    ...manualFormData,
                                    experienceRecords: manualFormData.experienceRecords.filter(r => r.id !== record.id),
                                  });
                                }}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={record.facilityName}
                              onChange={(e) => {
                                setManualFormData({
                                  ...manualFormData,
                                  experienceRecords: manualFormData.experienceRecords.map(r =>
                                    r.id === record.id ? { ...r, facilityName: e.target.value } : r
                                  ),
                                });
                              }}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                              placeholder="事業所名"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="date"
                                value={record.startDate}
                                onChange={(e) => {
                                  setManualFormData({
                                    ...manualFormData,
                                    experienceRecords: manualFormData.experienceRecords.map(r =>
                                      r.id === record.id ? { ...r, startDate: e.target.value } : r
                                    ),
                                  });
                                }}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                placeholder="開始日"
                              />
                              <input
                                type="date"
                                value={record.endDate || ''}
                                onChange={(e) => {
                                  setManualFormData({
                                    ...manualFormData,
                                    experienceRecords: manualFormData.experienceRecords.map(r =>
                                      r.id === record.id ? { ...r, endDate: e.target.value } : r
                                    ),
                                  });
                                }}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                placeholder="終了日（在籍中は空欄）"
                              />
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setManualFormData({
                              ...manualFormData,
                              experienceRecords: [...manualFormData.experienceRecords, {
                                id: Date.now().toString(),
                                facilityName: '',
                                startDate: '',
                                endDate: '',
                              }],
                            });
                          }}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-bold transition-colors"
                        >
                          + 職歴を追加
                        </button>
                      </div>
                    </div>

                    {/* 学歴 */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        学歴
                      </label>
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {manualFormData.educationHistory.map((edu, index) => (
                          <div key={edu.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-700">学歴</span>
                                <span className="text-xs text-gray-500">#{index + 1}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setManualFormData({
                                    ...manualFormData,
                                    educationHistory: manualFormData.educationHistory.filter(e => e.id !== edu.id),
                                  });
                                }}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">学校名</label>
                                <input
                                  type="text"
                                  value={edu.schoolName}
                                  onChange={(e) => {
                                    setManualFormData({
                                      ...manualFormData,
                                      educationHistory: manualFormData.educationHistory.map(item => 
                                        item.id === edu.id ? { ...item, schoolName: e.target.value } : item
                                      ),
                                    });
                                  }}
                                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">卒業年月</label>
                                <input
                                  type="month"
                                  value={edu.graduationDate}
                                  onChange={(e) => {
                                    setManualFormData({
                                      ...manualFormData,
                                      educationHistory: manualFormData.educationHistory.map(item => 
                                        item.id === edu.id ? { ...item, graduationDate: e.target.value } : item
                                      ),
                                    });
                                  }}
                                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">学位・資格</label>
                                <input
                                  type="text"
                                  value={edu.degree}
                                  onChange={(e) => {
                                    setManualFormData({
                                      ...manualFormData,
                                      educationHistory: manualFormData.educationHistory.map(item => 
                                        item.id === edu.id ? { ...item, degree: e.target.value } : item
                                      ),
                                    });
                                  }}
                                  placeholder="例：高等学校卒業"
                                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setManualFormData({
                              ...manualFormData,
                              educationHistory: [...manualFormData.educationHistory, {
                                id: Date.now().toString(),
                                schoolName: '',
                                graduationDate: '',
                                degree: '',
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
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                          address: '',
                          postalCode: '',
                          myNumber: '',
                          hasSpouse: false,
                          spouseName: '',
                          basicPensionSymbol: '',
                          basicPensionNumber: '',
                          employmentInsuranceStatus: 'joined',
                          employmentInsuranceNumber: '',
                          previousRetirementDate: '',
                          previousName: '',
                          socialInsuranceStatus: 'joined',
                          hasDependents: false,
                          dependentCount: 0,
                          dependents: [],
                          qualifications: [],
                          qualificationCertificates: [],
                          experienceRecords: [],
                          educationHistory: [],
                          role: '一般スタッフ',
                          employmentType: '常勤',
                          startDate: new Date().toISOString().split('T')[0],
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

                        if (!manualFormData.name) {
                          alert('名前を入力してください');
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
                                // 基本プロフィール
                                postalCode: manualFormData.postalCode,
                                myNumber: manualFormData.myNumber,
                                hasSpouse: manualFormData.hasSpouse,
                                spouseName: manualFormData.spouseName,
                                basicPensionSymbol: manualFormData.basicPensionSymbol,
                                basicPensionNumber: manualFormData.basicPensionNumber,
                                employmentInsuranceStatus: manualFormData.employmentInsuranceStatus,
                                employmentInsuranceNumber: manualFormData.employmentInsuranceNumber,
                                previousRetirementDate: manualFormData.previousRetirementDate,
                                previousName: manualFormData.previousName,
                                socialInsuranceStatus: manualFormData.socialInsuranceStatus,
                                hasDependents: manualFormData.hasDependents,
                                dependentCount: manualFormData.dependentCount,
                                dependents: manualFormData.dependents,
                                // 資格・職歴・学歴
                                qualificationCertificates: uploadedCertificates,
                                experienceRecords: manualFormData.experienceRecords,
                                educationHistory: manualFormData.educationHistory,
                                // 事業所固有情報
                                facilityRole: (manualFormData.facilityRole || '').trim() || '',
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
                            address: '',
                            postalCode: '',
                            myNumber: '',
                            hasSpouse: false,
                            spouseName: '',
                            basicPensionSymbol: '',
                            basicPensionNumber: '',
                            employmentInsuranceStatus: 'joined',
                            employmentInsuranceNumber: '',
                            previousRetirementDate: '',
                            previousName: '',
                            socialInsuranceStatus: 'joined',
                            hasDependents: false,
                            dependentCount: 0,
                            dependents: [],
                            qualifications: [],
                            qualificationCertificates: [],
                            experienceRecords: [],
                            educationHistory: [],
                            role: '一般スタッフ',
                            employmentType: '常勤',
                            startDate: new Date().toISOString().split('T')[0],
                            monthlySalary: undefined,
                            hourlyWage: undefined,
                            facilityRole: '',
                          });
                          setIsInviteModalOpen(false);
                          setInviteMethod(null);
                          setInviteSuccess(false);
                          setInviteToken('');
                          // スタッフデータを再取得（useFacilityDataが自動的に再取得する）
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
              <div className="flex items-center gap-2">
                {(!selectedStaff.user_id || isAdmin) && (
                  <button
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenEdit(selectedStaff);
                    }}
                    className="px-4 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white rounded-md text-sm font-bold transition-colors flex items-center gap-2"
                  >
                    <Edit size={16} />
                    編集
                  </button>
                )}
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
            </div>
            <div className="p-6 space-y-6">
              {selectedStaff.user_id && (
                <div className="bg-blue-50 border-l-4 border-blue-500 rounded-md p-3">
                  <p className="text-xs text-blue-700">
                    <strong>本人認証済み</strong> - 個人のマスターデータは本人のみが編集できます。
                  </p>
                </div>
              )}

              {(() => {
                let careerData: CareerData | null = null;
                try {
                  if (selectedStaff.memo && typeof selectedStaff.memo === 'string') {
                    careerData = JSON.parse(selectedStaff.memo);
                  }
                } catch (e) {}
                
                const facilityRole = careerData?.facilityRole || selectedStaff.facilityRole;
                const displayData = selectedStaff.user_id ? {
                  postalCode: selectedStaff.postalCode || null,
                  myNumber: selectedStaff.myNumber || null,
                  hasSpouse: selectedStaff.hasSpouse !== undefined ? selectedStaff.hasSpouse : (!!selectedStaff.spouseName),
                  spouseName: selectedStaff.spouseName || null,
                  basicPensionSymbol: selectedStaff.basicPensionSymbol || null,
                  basicPensionNumber: selectedStaff.basicPensionNumber || null,
                  employmentInsuranceStatus: selectedStaff.employmentInsuranceStatus || 'joined',
                  employmentInsuranceNumber: selectedStaff.employmentInsuranceNumber || null,
                  socialInsuranceStatus: selectedStaff.socialInsuranceStatus || 'joined',
                  hasDependents: selectedStaff.hasDependents !== undefined ? selectedStaff.hasDependents : false,
                  dependentCount: selectedStaff.dependentCount || 0,
                } : careerData || {};

                return (
                  <>
                    {/* 基本プロフィール */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                          <User className="w-5 h-5 text-[#8b5cf6]" />
                          基本プロフィール
                        </h2>
                        {(!selectedStaff.user_id || isAdmin) && (
                          <button
                            onClick={() => {
                              setIsDetailModalOpen(false);
                              handleOpenEdit(selectedStaff);
                            }}
                            className="flex items-center gap-1 text-sm text-[#8b5cf6] hover:text-[#7c3aed] font-bold"
                          >
                            <Edit className="w-4 h-4" />
                            編集
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm text-gray-500">氏名:</span>
                          <span className="ml-2 text-sm font-medium text-gray-800">{selectedStaff.name}</span>
                        </div>
                        {selectedStaff.email && (
                          <div>
                            <span className="text-sm text-gray-500">メールアドレス:</span>
                            <span className="ml-2 text-sm font-medium text-gray-800">{selectedStaff.email}</span>
                          </div>
                        )}
                        {selectedStaff.birthDate ? (
                          <div>
                            <span className="text-sm text-gray-500">生年月日:</span>
                            <span className="ml-2 text-sm font-medium text-gray-800">{selectedStaff.birthDate}</span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-sm text-gray-500">生年月日:</span>
                            <span className="ml-2 text-sm text-gray-400">未登録</span>
                          </div>
                        )}
                        {selectedStaff.address ? (
                          <div>
                            <span className="text-sm text-gray-500">住所:</span>
                            <span className="ml-2 text-sm font-medium text-gray-800">{selectedStaff.address}</span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-sm text-gray-500">住所:</span>
                            <span className="ml-2 text-sm text-gray-400">未登録</span>
                          </div>
                        )}
                        {selectedStaff.phone ? (
                          <div>
                            <span className="text-sm text-gray-500">電話番号:</span>
                            <span className="ml-2 text-sm font-medium text-gray-800">{selectedStaff.phone}</span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-sm text-gray-500">電話番号:</span>
                            <span className="ml-2 text-sm text-gray-400">未登録</span>
                          </div>
                        )}
                        {selectedStaff.gender ? (
                          <div>
                            <span className="text-sm text-gray-500">性別:</span>
                            <span className="ml-2 text-sm font-medium text-gray-800">{selectedStaff.gender}</span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-sm text-gray-500">性別:</span>
                            <span className="ml-2 text-sm text-gray-400">未登録</span>
                          </div>
                        )}
                        {displayData?.myNumber ? (
                          <div>
                            <span className="text-sm text-gray-500">マイナンバー:</span>
                            <span className="ml-2 text-sm font-medium text-gray-800">
                              ***-****-{displayData.myNumber.slice(-4)}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-sm text-gray-500">マイナンバー:</span>
                            <span className="ml-2 text-sm text-gray-400">未登録</span>
                          </div>
                        )}
                        <div>
                          <span className="text-sm text-gray-500">配偶者:</span>
                          <span className="ml-2 text-sm font-medium text-gray-800">
                            {displayData?.hasSpouse ? (displayData.spouseName || '氏名未入力') : '無'}
                          </span>
                        </div>
                        {displayData?.basicPensionSymbol && displayData?.basicPensionNumber ? (
                          <div>
                            <span className="text-sm text-gray-500">基礎年金番号:</span>
                            <span className="ml-2 text-sm font-medium text-gray-800">
                              {displayData.basicPensionSymbol}-{displayData.basicPensionNumber}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-sm text-gray-500">基礎年金番号:</span>
                            <span className="ml-2 text-sm text-gray-400">未登録</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 現在の所属事業所での契約内容 */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-[#8b5cf6]" />
                          現在の所属事業所での契約内容
                        </h2>
                        {(!selectedStaff.user_id || isAdmin) && (
                          <button
                            onClick={() => {
                              setIsDetailModalOpen(false);
                              handleOpenEdit(selectedStaff);
                            }}
                            className="flex items-center gap-1 text-sm text-[#8b5cf6] hover:text-[#7c3aed] font-bold"
                          >
                            <Edit className="w-4 h-4" />
                            編集
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedStaff.qualifications && (
                          <div>
                            <span className="text-sm text-gray-500">資格:</span>
                            <span className="ml-2 text-sm font-medium text-gray-800">{selectedStaff.qualifications}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-sm text-gray-500">役職:</span>
                          <span className="ml-2 text-sm font-medium text-gray-800">{selectedStaff.role || '-'}</span>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">雇用形態:</span>
                          <span className="ml-2 text-sm font-medium text-gray-800">{selectedStaff.type || '-'}</span>
                        </div>
                        {facilityRole ? (
                          <div>
                            <span className="text-sm text-gray-500">施設での役割:</span>
                            <span className="ml-2 text-sm font-medium text-gray-800">{facilityRole}</span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-sm text-gray-500">施設での役割:</span>
                            <span className="ml-2 text-sm text-gray-400">未登録</span>
                          </div>
                        )}
                        {selectedStaff.monthlySalary !== undefined && (
                          <div>
                            <span className="text-sm text-gray-500">月給:</span>
                            <span className="ml-2 text-sm font-medium text-gray-800">¥{selectedStaff.monthlySalary?.toLocaleString()}</span>
                          </div>
                        )}
                        {selectedStaff.hourlyWage !== undefined && (
                          <div>
                            <span className="text-sm text-gray-500">時給:</span>
                            <span className="ml-2 text-sm font-medium text-gray-800">¥{selectedStaff.hourlyWage?.toLocaleString()}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-sm text-gray-500">雇用保険:</span>
                          <span className="ml-2 text-sm font-medium text-gray-800">
                            {displayData?.employmentInsuranceStatus === 'joined' ? '加入' :
                             displayData?.employmentInsuranceStatus === 'not_joined' ? '非加入' :
                             displayData?.employmentInsuranceStatus === 'first_time' ? '初めて加入' : '未登録'}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">社会保険:</span>
                          <span className="ml-2 text-sm font-medium text-gray-800">
                            {displayData?.socialInsuranceStatus === 'joined' ? '加入' :
                             displayData?.socialInsuranceStatus === 'not_joined' ? '非加入' : '未登録'}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">扶養家族:</span>
                          <span className="ml-2 text-sm font-medium text-gray-800">
                            {displayData?.hasDependents ? `${displayData.dependentCount || 0}人` : '無'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
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
            <div className="p-6 space-y-6">
              {/* 月選択と統計情報 */}
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                <button
                  onClick={() => changeAttendanceMonth(-1)}
                  className="px-4 py-2 bg-white hover:bg-gray-100 rounded-md text-sm font-bold text-gray-700 shadow-sm transition-colors"
                >
                  ← 前月
                </button>
                <h4 className="font-bold text-lg text-gray-800">
                  {attendanceMonth.getFullYear()}年 {attendanceMonth.getMonth() + 1}月
                </h4>
                <button
                  onClick={() => changeAttendanceMonth(1)}
                  className="px-4 py-2 bg-white hover:bg-gray-100 rounded-md text-sm font-bold text-gray-700 shadow-sm transition-colors"
                >
                  次月 →
                </button>
              </div>

              {/* 統計情報 */}
              {(() => {
                const year = attendanceMonth.getFullYear();
                const month = attendanceMonth.getMonth();
                const records = JSON.parse(localStorage.getItem('attendance_records') || '[]');
                const staffRecords = records.filter((r: AttendanceRecord) => 
                  r.user_id === selectedStaff.user_id && 
                  r.facility_id === facility?.id
                );
                const monthRecords = staffRecords.filter((r: AttendanceRecord) => {
                  const recordDate = new Date(r.date);
                  return recordDate.getFullYear() === year && recordDate.getMonth() === month;
                });

                // 営業日数を計算
                let workingDays = 0;
                const lastDay = new Date(year, month + 1, 0).getDate();
                const regularHolidays = facilitySettings?.regularHolidays || [0];
                const customHolidays = facilitySettings?.customHolidays || [];
                const includeHolidays = facilitySettings?.includeHolidays || false;
                const japaneseHolidays = includeHolidays ? getJapaneseHolidays(year) : [];

                for (let day = 1; day <= lastDay; day++) {
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const date = new Date(year, month, day);
                  const dayOfWeek = date.getDay();
                  
                  if (regularHolidays.includes(dayOfWeek)) continue;
                  if (customHolidays && Array.isArray(customHolidays) && customHolidays.includes(dateStr)) continue;
                  if (japaneseHolidays.includes(dateStr) || isJapaneseHoliday(dateStr)) continue;
                  
                  workingDays++;
                }

                // 規定労働時間（1日8時間 × 営業日数）
                const standardWorkHours = workingDays * 8;
                
                // 実際の労働時間を計算
                let totalWorkMinutes = 0;
                const dailyWorkTimes: { [key: string]: number } = {};
                let paidLeaveDays = 0;

                monthRecords.forEach((record: AttendanceRecord) => {
                  if (record.type === 'manual') {
                    if (record.start_time && record.end_time) {
                      const start = new Date(`${record.date}T${record.start_time}:00`);
                      const end = new Date(`${record.date}T${record.end_time}:00`);
                      const workMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
                      
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
                    const dayRecords = monthRecords.filter((r: any) => r.date === record.date);
                    const startRecord = dayRecords.find((r: any) => r.type === 'start');
                    const endRecord = dayRecords.find((r: any) => r.type === 'end');
                    
                    if (startRecord && endRecord) {
                      const start = new Date(`${record.date}T${startRecord.time}:00`);
                      const end = new Date(`${record.date}T${endRecord.time}:00`);
                      const workMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
                      
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
                  
                  // 有給日数をカウント（暫定：手動記録で勤務時間が0の場合）
                  if (record.type === 'paid_leave' || (record.type === 'manual' && record.leave_type === 'paid_leave')) {
                    paidLeaveDays++;
                  }
                });

                const totalWorkHours = Math.floor(totalWorkMinutes / 60);
                const totalWorkMinutesRemainder = totalWorkMinutes % 60;
                const overtimeHours = Math.max(0, totalWorkHours - standardWorkHours);

                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                      <div className="text-[10px] text-blue-600 font-bold mb-1 uppercase tracking-wide">月間労働時間</div>
                      <div className="text-xl font-bold text-blue-700">
                        {totalWorkHours}<span className="text-sm">時間</span> {totalWorkMinutesRemainder}<span className="text-sm">分</span>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                      <div className="text-[10px] text-orange-600 font-bold mb-1 uppercase tracking-wide">残業時間</div>
                      <div className="text-xl font-bold text-orange-700">
                        {overtimeHours > 0 ? (
                          <>{overtimeHours}<span className="text-sm">時間</span></>
                        ) : (
                          <>0<span className="text-sm">時間</span></>
                        )}
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                      <div className="text-[10px] text-green-600 font-bold mb-1 uppercase tracking-wide">規定労働時間</div>
                      <div className="text-xl font-bold text-green-700">
                        {standardWorkHours}<span className="text-sm">時間</span>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                      <div className="text-[10px] text-purple-600 font-bold mb-1 uppercase tracking-wide">有給使用日数</div>
                      <div className="text-xl font-bold text-purple-700">{paidLeaveDays}<span className="text-sm">日</span></div>
                    </div>
                  </div>
                );
              })()}

              {/* カレンダー表示 */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
                    <div 
                      key={day} 
                      className={`text-center text-xs font-bold py-2 rounded ${
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
                    const year = attendanceMonth.getFullYear();
                    const month = attendanceMonth.getMonth();
                    const firstDay = new Date(year, month, 1);
                    const lastDay = new Date(year, month + 1, 0);
                    const daysInMonth = lastDay.getDate();
                    const startingDayOfWeek = firstDay.getDay();
                    const days = [];

                    for (let i = 0; i < startingDayOfWeek; i++) {
                      days.push(null);
                    }

                    for (let day = 1; day <= daysInMonth; day++) {
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      days.push(dateStr);
                    }

                    const records = JSON.parse(localStorage.getItem('attendance_records') || '[]');
                    const staffRecords = records.filter((r: AttendanceRecord) => 
                      r.user_id === selectedStaff.user_id && 
                      r.facility_id === facility?.id
                    );
                    const { getJapaneseHolidays, isJapaneseHoliday } = require('@/utils/japaneseHolidays');
                    const regularHolidays = facilitySettings?.regularHolidays || [0];
                    const customHolidays = facilitySettings?.customHolidays || [];
                    const includeHolidays = facilitySettings?.includeHolidays || false;
                    const japaneseHolidays = includeHolidays ? getJapaneseHolidays(year) : [];

                    return days.map((dateStr, index) => {
                      if (!dateStr) {
                        return <div key={index} className="aspect-square"></div>;
                      }

                      const [yearStr, monthStr, dayStr] = dateStr.split('-');
                      const date = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr));
                      const dayOfWeek = date.getDay();
                      const today = new Date();
                      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                      const isToday = dateStr === todayStr;
                      
                      const isRegularHoliday = regularHolidays.includes(dayOfWeek);
                      const isCustomHoliday = customHolidays && Array.isArray(customHolidays) && customHolidays.includes(dateStr);
                      const isJapaneseHolidayDay = japaneseHolidays.includes(dateStr) || isJapaneseHoliday(dateStr);
                      const isHoliday = dayOfWeek === 0 || isRegularHoliday || isCustomHoliday || isJapaneseHolidayDay;
                      
                      const dayRecords = staffRecords.filter((r: AttendanceRecord) => r.date === dateStr);
                      const startRecord = dayRecords.find((r: AttendanceRecord) => r.type === 'start' || r.type === 'manual');
                      const endRecord = dayRecords.find((r: AttendanceRecord) => r.type === 'end' || r.type === 'manual');
                      const hasAttendance = startRecord && endRecord;
                      
                      // 勤務時間を計算
                      let workHours = '';
                      if (hasAttendance) {
                        const startTime = startRecord.time || startRecord.start_time;
                        const endTime = endRecord.time || endRecord.end_time;
                        if (startTime && endTime) {
                          const start = new Date(`${dateStr}T${startTime}:00`);
                          const end = new Date(`${dateStr}T${endTime}:00`);
                          const diff = end.getTime() - start.getTime();
                          const hours = Math.floor(diff / (1000 * 60 * 60));
                          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                          workHours = `${hours}h${minutes}m`;
                        }
                      }

                      return (
                        <div
                          key={dateStr}
                          className={`aspect-square border rounded-lg p-1.5 cursor-pointer transition-all ${
                            isToday 
                              ? 'bg-gradient-to-br from-[#00c4cc]/20 to-[#00b0b8]/20 border-[#00c4cc] shadow-md' 
                              : hasAttendance
                              ? 'border-green-300 bg-green-50 hover:border-green-400'
                              : isHoliday
                              ? 'bg-red-50 border-red-200 cursor-not-allowed opacity-60'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className={`text-xs font-bold mb-1 ${
                            isToday ? 'text-[#00c4cc]' : 
                            isHoliday ? 'text-red-600' : 
                            'text-gray-800'
                          }`}>
                            {date.getDate()}
                          </div>
                          {isHoliday && (
                            <div className="text-[9px] text-red-600 text-center leading-none">休</div>
                          )}
                          {hasAttendance && !isHoliday && (
                            <div className="text-[9px] text-green-700 font-bold text-center leading-tight">
                              {workHours}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* 勤怠記録テーブル */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h4 className="font-bold text-gray-800">勤怠記録一覧</h4>
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
                          
                          // 勤務時間を計算
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
                              <td className="p-3 text-gray-600 font-bold">{workHours}</td>
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

      {/* 編集モーダル（代理登録アカウント用、管理者は全スタッフ編集可能） */}
      {isEditModalOpen && editingStaffData && (!editingStaffData.user_id || isAdmin) && (
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
            <div className="p-6 max-h-[80vh] overflow-y-auto">
              {editingStaffData.user_id ? (
                <div className="bg-blue-50 border-l-4 border-blue-500 rounded-md p-4 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <User size={16} className="text-blue-600" />
                    <p className="text-sm font-bold text-blue-800">パーソナルアカウントに紐づいています</p>
                    <span className="ml-auto text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded font-bold">本人管理</span>
                  </div>
                  <p className="text-xs text-blue-700">
                    管理者権限により編集可能です。個人情報は本人管理のため、変更時は注意してください。
                  </p>
                </div>
              ) : (
                <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-md p-4 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <User size={16} className="text-yellow-600" />
                    <p className="text-sm font-bold text-yellow-800">代理登録アカウント</p>
                    <span className="ml-auto text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded font-bold">未確認</span>
                  </div>
                  <p className="text-xs text-yellow-700">
                    スタッフ本人がアカウントを作成すると、パーソナル情報は本人の管理下に移ります。
                  </p>
                </div>
              )}
              {editFormData ? (
                <div className="space-y-6">
                  {/* パーソナル情報（パーソナルアカウントと連動） */}
                  <div className="border-2 border-blue-200 rounded-lg p-5 bg-white">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-blue-200">
                      <User size={18} className="text-blue-600" />
                      <h4 className="font-bold text-lg text-blue-800">パーソナル情報</h4>
                      {editingStaffData.user_id ? (
                        <span className="ml-auto text-xs text-blue-600 bg-blue-100 px-3 py-1.5 rounded-full font-bold border border-blue-300">本人管理</span>
                      ) : (
                        <span className="ml-auto text-xs text-blue-600 bg-blue-100 px-3 py-1.5 rounded-full font-bold border border-blue-300">連動予定</span>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className={`text-xs p-3 rounded border-l-4 ${
                        editingStaffData.user_id 
                          ? 'bg-blue-50 text-blue-800 border-blue-400'
                          : 'bg-blue-50 text-blue-800 border-blue-400'
                      }`}>
                        {editingStaffData.user_id 
                          ? '※ パーソナルアカウントに紐づいています。変更は本人の情報にも反映されます。'
                          : '※ スタッフ本人がアカウントを作成すると、この情報はパーソナルアカウントと連動します。'}
                      </div>

                      {/* 基本情報（名前、ふりがな、生年月日、性別） */}
                      <div className="space-y-4 pb-4 border-b border-blue-200">
                        <h5 className="text-sm font-bold text-gray-700">基本情報</h5>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">
                            氏名 <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={editFormData.name || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">
                            フリガナ
                          </label>
                          <input
                            type="text"
                            value={editFormData.nameKana || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, nameKana: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                              生年月日
                            </label>
                            <input
                              type="date"
                              value={editFormData.birthDate || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, birthDate: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                              性別
                            </label>
                            <select
                              value={editFormData.gender || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value as any })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                              メールアドレス
                            </label>
                            <input
                              type="email"
                              value={editFormData.email || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                              電話番号
                            </label>
                            <input
                              type="tel"
                              value={editFormData.phone || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    
                      {/* 郵便番号・住所 */}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">
                            郵便番号
                          </label>
                          <input
                            type="text"
                            value={editFormData.postalCode || ''}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '');
                              setEditFormData({ ...editFormData, postalCode: value });
                            }}
                            placeholder="1234567"
                            maxLength={7}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">
                            住所
                          </label>
                          <input
                            type="text"
                            value={editFormData.address || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                            placeholder="都道府県市区町村番地"
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                      </div>

                    {/* マイナンバー */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        マイナンバー
                      </label>
                      <input
                        type="text"
                        value={editFormData.myNumber || ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 12);
                          setEditFormData({ ...editFormData, myNumber: value });
                        }}
                        placeholder="12桁のマイナンバー"
                        maxLength={12}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      />
                    </div>

                    {/* 配偶者 */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        配偶者
                      </label>
                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="edit-hasSpouse"
                              checked={editFormData.hasSpouse || false}
                              onChange={() => setEditFormData({ ...editFormData, hasSpouse: true })}
                              className="w-4 h-4 text-[#00c4cc]"
                            />
                            <span className="text-sm">有</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="edit-hasSpouse"
                              checked={!editFormData.hasSpouse}
                              onChange={() => setEditFormData({ ...editFormData, hasSpouse: false, spouseName: '' })}
                              className="w-4 h-4 text-[#00c4cc]"
                            />
                            <span className="text-sm">無</span>
                          </label>
                        </div>
                        {editFormData.hasSpouse && (
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">配偶者氏名</label>
                            <input
                              type="text"
                              value={editFormData.spouseName || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, spouseName: e.target.value })}
                              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 基礎年金番号 */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        基礎年金番号
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">記号（4桁）</label>
                          <input
                            type="text"
                            value={editFormData.basicPensionSymbol || ''}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                              setEditFormData({ ...editFormData, basicPensionSymbol: value });
                            }}
                            maxLength={4}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">番号（6桁）</label>
                          <input
                            type="text"
                            value={editFormData.basicPensionNumber || ''}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                              setEditFormData({ ...editFormData, basicPensionNumber: value });
                            }}
                            maxLength={6}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 雇用保険 */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        雇用保険
                      </label>
                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="edit-employmentInsurance"
                              value="joined"
                              checked={editFormData.employmentInsuranceStatus === 'joined'}
                              onChange={(e) => setEditFormData({ ...editFormData, employmentInsuranceStatus: e.target.value as any })}
                              className="w-4 h-4 text-[#00c4cc]"
                            />
                            <span className="text-sm">加入</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="edit-employmentInsurance"
                              value="not_joined"
                              checked={editFormData.employmentInsuranceStatus === 'not_joined'}
                              onChange={(e) => setEditFormData({ ...editFormData, employmentInsuranceStatus: e.target.value as any })}
                              className="w-4 h-4 text-[#00c4cc]"
                            />
                            <span className="text-sm">非加入</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="edit-employmentInsurance"
                              value="first_time"
                              checked={editFormData.employmentInsuranceStatus === 'first_time'}
                              onChange={(e) => setEditFormData({ ...editFormData, employmentInsuranceStatus: e.target.value as any })}
                              className="w-4 h-4 text-[#00c4cc]"
                            />
                            <span className="text-sm">初めて加入</span>
                          </label>
                        </div>
                        {editFormData.employmentInsuranceStatus === 'joined' && (
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">雇用保険番号（被保険者番号）</label>
                            <input
                              type="text"
                              value={editFormData.employmentInsuranceNumber || ''}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^\d-]/g, '');
                                setEditFormData({ ...editFormData, employmentInsuranceNumber: value });
                              }}
                              placeholder="例: 1234-567890-1"
                              maxLength={13}
                              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                            <p className="text-xs text-gray-500 mt-1">4桁-6桁-1桁の形式で入力してください</p>
                          </div>
                        )}
                        {editFormData.employmentInsuranceStatus === 'first_time' && (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">前職の名（旧姓の場合）</label>
                              <input
                                type="text"
                                value={editFormData.previousName || ''}
                                onChange={(e) => setEditFormData({ ...editFormData, previousName: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">前職の退職日</label>
                              <input
                                type="date"
                                value={editFormData.previousRetirementDate || ''}
                                onChange={(e) => setEditFormData({ ...editFormData, previousRetirementDate: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 社会保険 */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        社会保険
                      </label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="edit-socialInsurance"
                            value="joined"
                            checked={editFormData.socialInsuranceStatus === 'joined'}
                            onChange={(e) => setEditFormData({ ...editFormData, socialInsuranceStatus: e.target.value as any })}
                            className="w-4 h-4 text-[#00c4cc]"
                          />
                          <span className="text-sm">加入</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="edit-socialInsurance"
                            value="not_joined"
                            checked={editFormData.socialInsuranceStatus === 'not_joined'}
                            onChange={(e) => setEditFormData({ ...editFormData, socialInsuranceStatus: e.target.value as any })}
                            className="w-4 h-4 text-[#00c4cc]"
                          />
                          <span className="text-sm">非加入</span>
                        </label>
                      </div>
                    </div>

                    {/* 扶養家族 */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        扶養家族
                      </label>
                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="edit-hasDependents"
                              checked={editFormData.hasDependents || false}
                              onChange={() => setEditFormData({ ...editFormData, hasDependents: true })}
                              className="w-4 h-4 text-[#00c4cc]"
                            />
                            <span className="text-sm">有</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="edit-hasDependents"
                              checked={!editFormData.hasDependents}
                              onChange={() => setEditFormData({ ...editFormData, hasDependents: false, dependents: [], dependentCount: 0 })}
                              className="w-4 h-4 text-[#00c4cc]"
                            />
                            <span className="text-sm">無</span>
                          </label>
                        </div>
                        {editFormData.hasDependents && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">人数</label>
                              <input
                                type="number"
                                min="0"
                                value={editFormData.dependentCount || 0}
                                onChange={(e) => {
                                  const count = parseInt(e.target.value) || 0;
                                  const currentDependents = editFormData.dependents || [];
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
                                  setEditFormData({ ...editFormData, dependentCount: count, dependents: newDependents });
                                }}
                                className="w-24 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                              />
                              <span className="ml-2 text-sm text-gray-600">人</span>
                            </div>
                            {(editFormData.dependents || []).map((dependent: Dependent, index: number) => (
                              <div key={dependent.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
                                <h5 className="text-sm font-bold text-gray-700">扶養家族 {index + 1}</h5>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">続柄</label>
                                    <input
                                      type="text"
                                      value={dependent.relationship || ''}
                                      onChange={(e) => {
                                        const updated = [...(editFormData.dependents || [])];
                                        updated[index].relationship = e.target.value;
                                        setEditFormData({ ...editFormData, dependents: updated });
                                      }}
                                      placeholder="例：妻、子"
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">生年月日</label>
                                    <input
                                      type="date"
                                      value={dependent.birthDate || ''}
                                      onChange={(e) => {
                                        const updated = [...(editFormData.dependents || [])];
                                        updated[index].birthDate = e.target.value;
                                        setEditFormData({ ...editFormData, dependents: updated });
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">フリガナ</label>
                                    <input
                                      type="text"
                                      value={dependent.furigana || ''}
                                      onChange={(e) => {
                                        const updated = [...(editFormData.dependents || [])];
                                        updated[index].furigana = e.target.value;
                                        setEditFormData({ ...editFormData, dependents: updated });
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">氏名</label>
                                    <input
                                      type="text"
                                      value={dependent.name || ''}
                                      onChange={(e) => {
                                        const updated = [...(editFormData.dependents || [])];
                                        updated[index].name = e.target.value;
                                        setEditFormData({ ...editFormData, dependents: updated });
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">性別</label>
                                  <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2">
                                      <input
                                        type="radio"
                                        name={`edit-dependent-gender-${index}`}
                                        checked={dependent.gender === 'male'}
                                        onChange={() => {
                                          const updated = [...(editFormData.dependents || [])];
                                          updated[index].gender = 'male';
                                          setEditFormData({ ...editFormData, dependents: updated });
                                        }}
                                        className="w-4 h-4 text-[#00c4cc]"
                                      />
                                      <span className="text-sm">男</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                      <input
                                        type="radio"
                                        name={`edit-dependent-gender-${index}`}
                                        checked={dependent.gender === 'female'}
                                        onChange={() => {
                                          const updated = [...(editFormData.dependents || [])];
                                          updated[index].gender = 'female';
                                          setEditFormData({ ...editFormData, dependents: updated });
                                        }}
                                        className="w-4 h-4 text-[#00c4cc]"
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
                                      value={dependent.occupation || ''}
                                      onChange={(e) => {
                                        const updated = [...(editFormData.dependents || [])];
                                        updated[index].occupation = e.target.value;
                                        setEditFormData({ ...editFormData, dependents: updated });
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">収入（年収）</label>
                                    <input
                                      type="text"
                                      value={dependent.annualIncome || ''}
                                      onChange={(e) => {
                                        const updated = [...(editFormData.dependents || [])];
                                        updated[index].annualIncome = e.target.value;
                                        setEditFormData({ ...editFormData, dependents: updated });
                                      }}
                                      placeholder="円"
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="flex items-center gap-2 mb-2">
                                    <input
                                      type="checkbox"
                                      checked={dependent.notWorking || false}
                                      onChange={(e) => {
                                        const updated = [...(editFormData.dependents || [])];
                                        updated[index].notWorking = e.target.checked;
                                        setEditFormData({ ...editFormData, dependents: updated });
                                      }}
                                      className="w-4 h-4 text-[#00c4cc]"
                                    />
                                    <span className="text-xs text-gray-600">働いていない場合</span>
                                  </label>
                                  {dependent.notWorking && (
                                    <select
                                      value={dependent.notWorkingReason || ''}
                                      onChange={(e) => {
                                        const updated = [...(editFormData.dependents || [])];
                                        updated[index].notWorkingReason = e.target.value;
                                        setEditFormData({ ...editFormData, dependents: updated });
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
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
                                    value={dependent.myNumber || ''}
                                    onChange={(e) => {
                                      const updated = [...(editFormData.dependents || [])];
                                      updated[index].myNumber = e.target.value.replace(/\D/g, '').slice(0, 12);
                                      setEditFormData({ ...editFormData, dependents: updated });
                                    }}
                                    maxLength={12}
                                    placeholder="12桁"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                  />
                                </div>
                                {index > 0 && (
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">別居の場合は住所を明記</label>
                                    <input
                                      type="text"
                                      value={dependent.separateAddress || ''}
                                      onChange={(e) => {
                                        const updated = [...(editFormData.dependents || [])];
                                        updated[index].separateAddress = e.target.value;
                                        setEditFormData({ ...editFormData, dependents: updated });
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
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
                              const currentQuals = editFormData.qualifications || [];
                              const isSelected = currentQuals.includes(qual);
                              if (qual === '資格無し') {
                                if (isSelected) {
                                  setEditFormData({
                                    ...editFormData,
                                    qualifications: currentQuals.filter((q: string) => q !== '資格無し'),
                                    qualificationCertificates: (editFormData.qualificationCertificates || []).filter((c: QualificationCertificate) => c.qualification !== '資格無し'),
                                  });
                                } else {
                                  setEditFormData({
                                    ...editFormData,
                                    qualifications: ['資格無し'],
                                    qualificationCertificates: [{ qualification: '資格無し', file: null, url: '' }],
                                  });
                                }
                              } else {
                                const newQualifications = isSelected
                                  ? currentQuals.filter((q: string) => q !== qual)
                                  : [...currentQuals.filter((q: string) => q !== '資格無し'), qual];
                                const currentCerts = editFormData.qualificationCertificates || [];
                                const newCertificates = isSelected
                                  ? currentCerts.filter((c: QualificationCertificate) => c.qualification !== qual)
                                  : [...currentCerts.filter((c: QualificationCertificate) => c.qualification !== '資格無し'), { qualification: qual, file: null, url: '' }];
                                setEditFormData({
                                  ...editFormData,
                                  qualifications: newQualifications,
                                  qualificationCertificates: newCertificates,
                                });
                              }
                            }}
                            className={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${
                              (editFormData.qualifications || []).includes(qual)
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
                    {(editFormData.qualifications || []).filter((q: string) => q !== '資格無し').length > 0 && (
                      <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                          資格証の写真
                        </label>
                        <div className="space-y-2">
                          {(editFormData.qualifications || []).filter((q: string) => q !== '資格無し').map((qual: string) => {
                            const cert = (editFormData.qualificationCertificates || []).find((c: QualificationCertificate) => c.qualification === qual);
                            return (
                              <div key={qual} className="border border-gray-200 rounded-md p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-bold text-gray-700">{qual}</span>
                                  {cert?.url && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditFormData({
                                          ...editFormData,
                                          qualificationCertificates: (editFormData.qualificationCertificates || []).map((c: QualificationCertificate) =>
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
                                            setEditFormData({
                                              ...editFormData,
                                              qualificationCertificates: (editFormData.qualificationCertificates || []).map((c: QualificationCertificate) =>
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

                    {/* 職歴 */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        職歴（実務経験）
                      </label>
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {(editFormData.experienceRecords || []).map((record: ExperienceRecord, index: number) => (
                          <div key={record.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-700">職歴</span>
                                <span className="text-xs text-gray-500">#{index + 1}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditFormData({
                                    ...editFormData,
                                    experienceRecords: (editFormData.experienceRecords || []).filter((r: ExperienceRecord) => r.id !== record.id),
                                  });
                                }}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={record.facilityName || ''}
                              onChange={(e) => {
                                setEditFormData({
                                  ...editFormData,
                                  experienceRecords: (editFormData.experienceRecords || []).map((r: ExperienceRecord) =>
                                    r.id === record.id ? { ...r, facilityName: e.target.value } : r
                                  ),
                                });
                              }}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                              placeholder="事業所名"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="date"
                                value={record.startDate || ''}
                                onChange={(e) => {
                                  setEditFormData({
                                    ...editFormData,
                                    experienceRecords: (editFormData.experienceRecords || []).map((r: ExperienceRecord) =>
                                      r.id === record.id ? { ...r, startDate: e.target.value } : r
                                    ),
                                  });
                                }}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                placeholder="開始日"
                              />
                              <input
                                type="date"
                                value={record.endDate || ''}
                                onChange={(e) => {
                                  setEditFormData({
                                    ...editFormData,
                                    experienceRecords: (editFormData.experienceRecords || []).map((r: ExperienceRecord) =>
                                      r.id === record.id ? { ...r, endDate: e.target.value } : r
                                    ),
                                  });
                                }}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                placeholder="終了日（在籍中は空欄）"
                              />
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setEditFormData({
                              ...editFormData,
                              experienceRecords: [...(editFormData.experienceRecords || []), {
                                id: Date.now().toString(),
                                facilityName: '',
                                startDate: '',
                                endDate: '',
                              }],
                            });
                          }}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-bold transition-colors"
                        >
                          + 職歴を追加
                        </button>
                      </div>
                    </div>

                    {/* 学歴 */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        学歴
                      </label>
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {(editFormData.educationHistory || []).map((edu: EducationHistory, index: number) => (
                          <div key={edu.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-700">学歴</span>
                                <span className="text-xs text-gray-500">#{index + 1}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditFormData({
                                    ...editFormData,
                                    educationHistory: (editFormData.educationHistory || []).filter((e: EducationHistory) => e.id !== edu.id),
                                  });
                                }}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">学校名</label>
                                <input
                                  type="text"
                                  value={edu.schoolName || ''}
                                  onChange={(e) => {
                                    setEditFormData({
                                      ...editFormData,
                                      educationHistory: (editFormData.educationHistory || []).map((item: EducationHistory) => 
                                        item.id === edu.id ? { ...item, schoolName: e.target.value } : item
                                      ),
                                    });
                                  }}
                                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">卒業年月</label>
                                <input
                                  type="month"
                                  value={edu.graduationDate || ''}
                                  onChange={(e) => {
                                    setEditFormData({
                                      ...editFormData,
                                      educationHistory: (editFormData.educationHistory || []).map((item: EducationHistory) => 
                                        item.id === edu.id ? { ...item, graduationDate: e.target.value } : item
                                      ),
                                    });
                                  }}
                                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">学位・資格</label>
                                <input
                                  type="text"
                                  value={edu.degree || ''}
                                  onChange={(e) => {
                                    setEditFormData({
                                      ...editFormData,
                                      educationHistory: (editFormData.educationHistory || []).map((item: EducationHistory) => 
                                        item.id === edu.id ? { ...item, degree: e.target.value } : item
                                      ),
                                    });
                                  }}
                                  placeholder="例：高等学校卒業"
                                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setEditFormData({
                              ...editFormData,
                              educationHistory: [...(editFormData.educationHistory || []), {
                                id: Date.now().toString(),
                                schoolName: '',
                                graduationDate: '',
                                degree: '',
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

                  {/* 事業所固有情報（事業所管理） */}
                  <div className="border-2 border-orange-200 rounded-lg p-5 bg-white">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-orange-200">
                      <Briefcase size={18} className="text-orange-600" />
                      <h4 className="font-bold text-lg text-orange-800">事業所固有情報</h4>
                      <span className="ml-auto text-xs text-orange-600 bg-orange-100 px-3 py-1.5 rounded-full font-bold border border-orange-300">事業所で管理</span>
                    </div>
                    <div className="space-y-4">
                      <div className="text-xs text-orange-700 mb-2 bg-orange-50 p-2 rounded">
                        ※ この情報は事業所でのみ管理され、パーソナルアカウントには反映されません。
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">
                            役職
                          </label>
                          <select
                            value={editFormData.role || '一般スタッフ'}
                            onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as any })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
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
                            value={editFormData.employmentType || editFormData.type || '常勤'}
                            onChange={(e) => setEditFormData({ ...editFormData, employmentType: e.target.value as any, type: e.target.value as any })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                          >
                            <option value="常勤">常勤（月給制）</option>
                            <option value="非常勤">非常勤（時給制）</option>
                          </select>
                        </div>
                      </div>

                      {/* 給与（雇用形態に応じて表示） */}
                      {(editFormData.employmentType === '常勤' || editFormData.type === '常勤') ? (
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">
                            月給（円）<span className="text-xs text-gray-500 font-normal ml-2">※ 常勤のため月給制です</span>
                          </label>
                          <input
                            type="number"
                            value={editFormData.monthlySalary || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, monthlySalary: e.target.value ? parseInt(e.target.value) : undefined, hourlyWage: undefined })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                            placeholder="300000"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">
                            時給（円）<span className="text-xs text-gray-500 font-normal ml-2">※ 非常勤のため時給制です</span>
                          </label>
                          <input
                            type="number"
                            value={editFormData.hourlyWage || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, hourlyWage: e.target.value ? parseInt(e.target.value) : undefined, monthlySalary: undefined })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                            placeholder="1500"
                          />
                        </div>
                      )}

                      {/* 施設での役割（チェックボックス） */}
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                          施設での役割 <span className="text-xs text-gray-500 font-normal">（複数選択可）</span>
                        </label>
                        <div className="space-y-2">
                          {['児童発達支援管理責任者', '管理者', '指導員', '機能性担当職員', '訪問支援員'].map((role) => {
                            const facilityRoles = editFormData.facilityRoles || (editFormData.facilityRole ? [editFormData.facilityRole] : []);
                            const isChecked = Array.isArray(facilityRoles) ? facilityRoles.includes(role) : facilityRoles === role;
                            return (
                              <label key={role} className="flex items-center gap-2 cursor-pointer hover:bg-orange-50 p-2 rounded">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const currentRoles = editFormData.facilityRoles || (editFormData.facilityRole ? [editFormData.facilityRole] : []);
                                    const rolesArray = Array.isArray(currentRoles) ? currentRoles : [currentRoles].filter(Boolean);
                                    if (e.target.checked) {
                                      setEditFormData({ 
                                        ...editFormData, 
                                        facilityRoles: [...rolesArray, role],
                                        facilityRole: [...rolesArray, role].join(', ')
                                      });
                                    } else {
                                      const newRoles = rolesArray.filter((r: string) => r !== role);
                                      setEditFormData({ 
                                        ...editFormData, 
                                        facilityRoles: newRoles,
                                        facilityRole: newRoles.length > 0 ? newRoles.join(', ') : ''
                                      });
                                    }
                                  }}
                                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                                />
                                <span className="text-sm text-gray-700">{role}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setIsEditModalOpen(false);
                        setEditingStaffData(null);
                        setEditFormData(null);
                      }}
                      className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-md text-sm transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={async () => {
                        if (!facility?.id || !editingStaffData?.id) {
                          alert('施設情報またはスタッフ情報が取得できませんでした');
                          return;
                        }

                        if (!editFormData.name) {
                          alert('名前を入力してください');
                          return;
                        }

                        setInviteLoading(true);
                        try {
                          // 資格証の写真をSupabase Storageにアップロード
                          const uploadedCertificates: { qualification: string; url: string }[] = [];
                          for (const cert of editFormData.qualificationCertificates || []) {
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

                          // memoフィールドから既存データを取得
                          let existingMemo: Record<string, unknown> = {};
                          try {
                            if (editingStaffData.memo && typeof editingStaffData.memo === 'string') {
                              existingMemo = JSON.parse(editingStaffData.memo);
                            }
                          } catch (e) {
                            // 無視
                          }

                          // staffテーブルを更新
                          const { error } = await supabase
                            .from('staff')
                            .update({
                              name: editFormData.name,
                              name_kana: editFormData.nameKana || null,
                              role: editFormData.role,
                              type: editFormData.employmentType || editFormData.type,
                              birth_date: editFormData.birthDate || null,
                              gender: editFormData.gender || null,
                              email: editFormData.email || null,
                              phone: editFormData.phone || null,
                              address: editFormData.address || null,
                              qualifications: editFormData.qualifications?.length > 0 ? editFormData.qualifications.join(',') : null,
                              monthly_salary: editFormData.monthlySalary || null,
                              hourly_wage: editFormData.hourlyWage || null,
                              memo: JSON.stringify({
                                ...existingMemo,
                                postalCode: editFormData.postalCode || existingMemo.postalCode,
                                myNumber: editFormData.myNumber || existingMemo.myNumber,
                                hasSpouse: editFormData.hasSpouse !== undefined ? editFormData.hasSpouse : existingMemo.hasSpouse,
                                spouseName: editFormData.spouseName || existingMemo.spouseName,
                                basicPensionSymbol: editFormData.basicPensionSymbol || existingMemo.basicPensionSymbol,
                                basicPensionNumber: editFormData.basicPensionNumber || existingMemo.basicPensionNumber,
                                employmentInsuranceStatus: editFormData.employmentInsuranceStatus || existingMemo.employmentInsuranceStatus,
                                employmentInsuranceNumber: editFormData.employmentInsuranceNumber || existingMemo.employmentInsuranceNumber,
                                previousRetirementDate: editFormData.previousRetirementDate || existingMemo.previousRetirementDate,
                                previousName: editFormData.previousName || existingMemo.previousName,
                                socialInsuranceStatus: editFormData.socialInsuranceStatus || existingMemo.socialInsuranceStatus,
                                hasDependents: editFormData.hasDependents !== undefined ? editFormData.hasDependents : existingMemo.hasDependents,
                                dependentCount: editFormData.dependentCount || existingMemo.dependentCount || 0,
                                dependents: editFormData.dependents || existingMemo.dependents || [],
                                qualificationCertificates: uploadedCertificates.length > 0 ? uploadedCertificates : (existingMemo.qualificationCertificates || []),
                                experienceRecords: editFormData.experienceRecords || existingMemo.experienceRecords || [],
                                educationHistory: editFormData.educationHistory || existingMemo.educationHistory || [],
                                facilityRole: (editFormData.facilityRole || '').trim() || (existingMemo.facilityRole || '').trim() || '',
                              }),
                              updated_at: new Date().toISOString(),
                            })
                            .eq('id', editingStaffData.id);

                          if (error) {
                            throw new Error(`更新エラー: ${error.message}`);
                          }

                          alert('スタッフ情報を更新しました。');
                          setIsEditModalOpen(false);
                          setEditingStaffData(null);
                          setEditFormData(null);
                          // スタッフデータを再取得（useFacilityDataが自動的に再取得する）
                        } catch (error: any) {
                          alert(`更新エラー: ${error.message || 'Unknown error'}`);
                        } finally {
                          setInviteLoading(false);
                        }
                      }}
                      disabled={inviteLoading}
                      className="flex-1 py-2.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {inviteLoading ? '更新中...' : '保存'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-600 text-sm">データを読み込んでいます...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagementView;

