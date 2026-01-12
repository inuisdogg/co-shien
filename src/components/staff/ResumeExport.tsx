/**
 * 履歴書・職務経歴書 出力コンポーネント
 * プロフィール情報を元にPDFを生成
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Download,
  Camera,
  X,
  Plus,
  Trash2,
  Edit2,
  GraduationCap,
  Briefcase,
  Award,
  User,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Train,
  Clock,
  Heart,
  FileCheck,
  Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// 学歴エントリの型
type EducationEntry = {
  id: string;
  schoolName: string;
  department?: string;
  startDate: string;
  endDate: string;
  graduationType: '卒業' | '中退' | '在学中' | '卒業見込';
};

// 職歴エントリの型
type WorkEntry = {
  id: string;
  companyName: string;
  department?: string;
  position?: string;
  startDate: string;
  endDate?: string;
  jobDescription?: string;
  achievements?: string;
  employmentType: '正社員' | '契約社員' | 'パート・アルバイト' | '派遣社員' | '業務委託';
};

// 資格・免許エントリの型
type LicenseEntry = {
  id: string;
  name: string;
  acquiredDate: string;
  imageUrl?: string;
};

type ResumeData = {
  // 基本情報
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  birthDate: string;
  gender: string;
  email: string;
  phone: string;
  postalCode: string;
  address: string;
  profilePhotoUrl?: string;

  // 通勤情報
  nearestStation?: string;
  commuteTime?: string;

  // 学歴・職歴
  educationHistory: EducationEntry[];
  workHistory: WorkEntry[];

  // 資格・免許
  licensesQualifications: LicenseEntry[];

  // 自己PR等
  motivation?: string;
  personalRequests?: string;
  skillsHobbies?: string;
  healthStatus?: string;

  // 職務経歴書用
  careerSummary?: string;
  applicableSkills?: string;
  selfPromotion?: string;

  // 配偶者・扶養
  hasSpouse?: boolean;
  dependentCount?: number;
};

type ResumeExportProps = {
  userId: string;
  onClose?: () => void;
  embedded?: boolean;
};

export default function ResumeExport({ userId, onClose, embedded = false }: ResumeExportProps) {
  const [resumeData, setResumeData] = useState<ResumeData>({
    lastName: '',
    firstName: '',
    lastNameKana: '',
    firstNameKana: '',
    birthDate: '',
    gender: '',
    email: '',
    phone: '',
    postalCode: '',
    address: '',
    educationHistory: [],
    workHistory: [],
    licensesQualifications: [],
    healthStatus: '良好',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'education' | 'work' | 'license' | 'pr' | 'export'>('basic');
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState<'resume' | 'cv' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLDivElement>(null);

  // データ読み込み
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: userData, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) throw error;

        if (userData) {
          setResumeData({
            lastName: userData.last_name || '',
            firstName: userData.first_name || '',
            lastNameKana: userData.last_name_kana || '',
            firstNameKana: userData.first_name_kana || '',
            birthDate: userData.birth_date || '',
            gender: userData.gender || '',
            email: userData.email || '',
            phone: userData.phone || '',
            postalCode: userData.postal_code || '',
            address: userData.address || '',
            profilePhotoUrl: userData.profile_photo_url || '',
            nearestStation: userData.nearest_station || '',
            commuteTime: userData.commute_time || '',
            educationHistory: userData.education_history || [],
            workHistory: userData.work_history || [],
            licensesQualifications: userData.licenses_qualifications || [],
            motivation: userData.motivation || '',
            personalRequests: userData.personal_requests || '',
            skillsHobbies: userData.skills_hobbies || '',
            healthStatus: userData.health_status || '良好',
            careerSummary: userData.career_summary || '',
            applicableSkills: userData.applicable_skills || '',
            selfPromotion: userData.self_promotion || '',
            hasSpouse: userData.has_spouse || false,
            dependentCount: userData.dependent_count || 0,
          });
        }
      } catch (err) {
        console.error('データ読み込みエラー:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId]);

  // データ保存
  const saveData = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          last_name: resumeData.lastName,
          first_name: resumeData.firstName,
          last_name_kana: resumeData.lastNameKana,
          first_name_kana: resumeData.firstNameKana,
          birth_date: resumeData.birthDate || null,
          gender: resumeData.gender,
          email: resumeData.email,
          phone: resumeData.phone,
          postal_code: resumeData.postalCode,
          address: resumeData.address,
          profile_photo_url: resumeData.profilePhotoUrl,
          nearest_station: resumeData.nearestStation,
          commute_time: resumeData.commuteTime,
          education_history: resumeData.educationHistory,
          work_history: resumeData.workHistory,
          licenses_qualifications: resumeData.licensesQualifications,
          motivation: resumeData.motivation,
          personal_requests: resumeData.personalRequests,
          skills_hobbies: resumeData.skillsHobbies,
          health_status: resumeData.healthStatus,
          career_summary: resumeData.careerSummary,
          applicable_skills: resumeData.applicableSkills,
          self_promotion: resumeData.selfPromotion,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;
      alert('保存しました');
    } catch (err) {
      console.error('保存エラー:', err);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // 写真アップロード
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイルサイズチェック (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('ファイルサイズは5MB以下にしてください');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/profile.${fileExt}`;

      // Supabase Storageにアップロード
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // 公開URLを取得
      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);

      setResumeData(prev => ({ ...prev, profilePhotoUrl: publicUrl }));
    } catch (err) {
      console.error('アップロードエラー:', err);
      alert('写真のアップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  // 学歴追加
  const addEducation = () => {
    const newEntry: EducationEntry = {
      id: crypto.randomUUID(),
      schoolName: '',
      startDate: '',
      endDate: '',
      graduationType: '卒業',
    };
    setResumeData(prev => ({
      ...prev,
      educationHistory: [...prev.educationHistory, newEntry],
    }));
  };

  // 職歴追加
  const addWork = () => {
    const newEntry: WorkEntry = {
      id: crypto.randomUUID(),
      companyName: '',
      startDate: '',
      employmentType: '正社員',
    };
    setResumeData(prev => ({
      ...prev,
      workHistory: [...prev.workHistory, newEntry],
    }));
  };

  // 資格追加
  const addLicense = () => {
    const newEntry: LicenseEntry = {
      id: crypto.randomUUID(),
      name: '',
      acquiredDate: '',
    };
    setResumeData(prev => ({
      ...prev,
      licensesQualifications: [...prev.licensesQualifications, newEntry],
    }));
  };

  // 年齢計算
  const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 0;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // 日付を和暦に変換
  const toJapaneseDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    // 令和変換（2019年5月1日以降）
    if (year >= 2019 && (year > 2019 || month >= 5)) {
      const reiwaYear = year - 2018;
      return `令和${reiwaYear}年${month}月`;
    }
    // 平成変換（1989年1月8日〜2019年4月30日）
    if (year >= 1989) {
      const heiseiYear = year - 1988;
      return `平成${heiseiYear}年${month}月`;
    }
    // 昭和変換
    const showaYear = year - 1925;
    return `昭和${showaYear}年${month}月`;
  };

  // 履歴書PDF生成
  const generateResumePDF = async () => {
    setGenerating('resume');
    try {
      if (!resumeRef.current) {
        throw new Error('履歴書のレンダリングに失敗しました');
      }

      // 一時的に要素を表示
      resumeRef.current.style.display = 'block';

      // html2canvasでレンダリング
      const canvas = await html2canvas(resumeRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      // 非表示に戻す
      resumeRef.current.style.display = 'none';

      // PDFを生成（A4サイズ）
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

      // ダウンロード
      const fileName = `履歴書_${resumeData.lastName}${resumeData.firstName}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('PDF生成エラー:', error);
      alert('PDF生成に失敗しました。もう一度お試しください。');
    } finally {
      setGenerating(null);
    }
  };

  // 職務経歴書PDF生成
  const generateCVPDF = async () => {
    setGenerating('cv');
    try {
      if (!cvRef.current) {
        throw new Error('職務経歴書のレンダリングに失敗しました');
      }

      // 一時的に要素を表示
      cvRef.current.style.display = 'block';

      // html2canvasでレンダリング
      const canvas = await html2canvas(cvRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      // 非表示に戻す
      cvRef.current.style.display = 'none';

      // PDFを生成（A4サイズ）
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

      // ダウンロード
      const fileName = `職務経歴書_${resumeData.lastName}${resumeData.firstName}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('PDF生成エラー:', error);
      alert('PDF生成に失敗しました。もう一度お試しください。');
    } finally {
      setGenerating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]"></div>
      </div>
    );
  }

  const containerClass = embedded
    ? ''
    : 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';

  return (
    <div className={containerClass}>
      <div className={`bg-white rounded-lg shadow-xl ${embedded ? 'w-full' : 'w-full max-w-4xl max-h-[90vh] overflow-hidden'}`}>
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-[#00c4cc] to-[#00b0b8] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6" />
            <h2 className="text-xl font-bold">履歴書・職務経歴書</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={saveData}
              disabled={saving}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-md text-sm font-bold transition-colors"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* タブ */}
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {[
              { id: 'basic', label: '基本情報', icon: User },
              { id: 'education', label: '学歴', icon: GraduationCap },
              { id: 'work', label: '職歴', icon: Briefcase },
              { id: 'license', label: '資格・免許', icon: Award },
              { id: 'pr', label: '自己PR', icon: Heart },
              { id: 'export', label: 'PDF出力', icon: Download },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#00c4cc] text-[#00c4cc]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* コンテンツ */}
        <div className={`p-6 ${embedded ? '' : 'overflow-y-auto max-h-[calc(90vh-140px)]'}`}>
          {/* 基本情報タブ */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              {/* 顔写真 */}
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="relative w-32 h-40 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
                    {resumeData.profilePhotoUrl ? (
                      <img
                        src={resumeData.profilePhotoUrl}
                        alt="プロフィール写真"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <Camera className="w-8 h-8 mb-1" />
                        <span className="text-xs">写真</span>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="absolute bottom-2 right-2 p-1.5 bg-[#00c4cc] text-white rounded-full hover:bg-[#00b0b8] transition-colors shadow-md"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">3×4cm 推奨</p>
                </div>

                {/* 氏名・フリガナ */}
                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">姓</label>
                      <input
                        type="text"
                        value={resumeData.lastName}
                        onChange={(e) => setResumeData(prev => ({ ...prev, lastName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">名</label>
                      <input
                        type="text"
                        value={resumeData.firstName}
                        onChange={(e) => setResumeData(prev => ({ ...prev, firstName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">セイ</label>
                      <input
                        type="text"
                        value={resumeData.lastNameKana}
                        onChange={(e) => setResumeData(prev => ({ ...prev, lastNameKana: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">メイ</label>
                      <input
                        type="text"
                        value={resumeData.firstNameKana}
                        onChange={(e) => setResumeData(prev => ({ ...prev, firstNameKana: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 生年月日・性別 */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    生年月日
                  </label>
                  <input
                    type="date"
                    value={resumeData.birthDate}
                    onChange={(e) => setResumeData(prev => ({ ...prev, birthDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">年齢</label>
                  <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
                    {resumeData.birthDate ? `${calculateAge(resumeData.birthDate)}歳` : '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">性別</label>
                  <select
                    value={resumeData.gender}
                    onChange={(e) => setResumeData(prev => ({ ...prev, gender: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                  >
                    <option value="">選択してください</option>
                    <option value="male">男性</option>
                    <option value="female">女性</option>
                    <option value="other">その他</option>
                  </select>
                </div>
              </div>

              {/* 連絡先 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Phone className="w-4 h-4 inline mr-1" />
                    電話番号
                  </label>
                  <input
                    type="tel"
                    value={resumeData.phone}
                    onChange={(e) => setResumeData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Mail className="w-4 h-4 inline mr-1" />
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={resumeData.email}
                    onChange={(e) => setResumeData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                  />
                </div>
              </div>

              {/* 住所 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  住所
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="郵便番号"
                    value={resumeData.postalCode}
                    onChange={(e) => setResumeData(prev => ({ ...prev, postalCode: e.target.value }))}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                  />
                </div>
                <input
                  type="text"
                  placeholder="住所"
                  value={resumeData.address}
                  onChange={(e) => setResumeData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                />
              </div>

              {/* 通勤情報 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Train className="w-4 h-4 inline mr-1" />
                    最寄り駅
                  </label>
                  <input
                    type="text"
                    value={resumeData.nearestStation || ''}
                    onChange={(e) => setResumeData(prev => ({ ...prev, nearestStation: e.target.value }))}
                    placeholder="例: JR山手線 渋谷駅"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Clock className="w-4 h-4 inline mr-1" />
                    通勤時間
                  </label>
                  <input
                    type="text"
                    value={resumeData.commuteTime || ''}
                    onChange={(e) => setResumeData(prev => ({ ...prev, commuteTime: e.target.value }))}
                    placeholder="例: 約30分"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                  />
                </div>
              </div>

              {/* 配偶者・扶養 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">配偶者</label>
                  <select
                    value={resumeData.hasSpouse ? 'yes' : 'no'}
                    onChange={(e) => setResumeData(prev => ({ ...prev, hasSpouse: e.target.value === 'yes' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                  >
                    <option value="no">無</option>
                    <option value="yes">有</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">扶養家族数</label>
                  <input
                    type="number"
                    min="0"
                    value={resumeData.dependentCount || 0}
                    onChange={(e) => setResumeData(prev => ({ ...prev, dependentCount: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                  />
                </div>
              </div>

              {/* 健康状態 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">健康状態</label>
                <select
                  value={resumeData.healthStatus || '良好'}
                  onChange={(e) => setResumeData(prev => ({ ...prev, healthStatus: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                >
                  <option value="良好">良好</option>
                  <option value="普通">普通</option>
                  <option value="持病あり">持病あり（業務に支障なし）</option>
                </select>
              </div>
            </div>
          )}

          {/* 学歴タブ */}
          {activeTab === 'education' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800">学歴</h3>
                <button
                  onClick={addEducation}
                  className="flex items-center gap-1 px-3 py-2 bg-[#00c4cc] text-white rounded-md hover:bg-[#00b0b8] transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  追加
                </button>
              </div>

              {resumeData.educationHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                  <GraduationCap className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>学歴を追加してください</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {resumeData.educationHistory.map((edu, index) => (
                    <div key={edu.id} className="p-4 border border-gray-200 rounded-lg space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-bold text-gray-500">学歴 {index + 1}</span>
                        <button
                          onClick={() => {
                            setResumeData(prev => ({
                              ...prev,
                              educationHistory: prev.educationHistory.filter(e => e.id !== edu.id),
                            }));
                          }}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">学校名</label>
                        <input
                          type="text"
                          value={edu.schoolName}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            setResumeData(prev => ({
                              ...prev,
                              educationHistory: prev.educationHistory.map(entry =>
                                entry.id === edu.id ? { ...entry, schoolName: newValue } : entry
                              ),
                            }));
                          }}
                          placeholder="例: ○○大学 △△学部"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">入学年月</label>
                          <input
                            type="month"
                            value={edu.startDate}
                            onChange={(e) => {
                              setResumeData(prev => ({
                                ...prev,
                                educationHistory: prev.educationHistory.map(entry =>
                                  entry.id === edu.id ? { ...entry, startDate: e.target.value } : entry
                                ),
                              }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">卒業年月</label>
                          <input
                            type="month"
                            value={edu.endDate}
                            onChange={(e) => {
                              setResumeData(prev => ({
                                ...prev,
                                educationHistory: prev.educationHistory.map(entry =>
                                  entry.id === edu.id ? { ...entry, endDate: e.target.value } : entry
                                ),
                              }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">状態</label>
                          <select
                            value={edu.graduationType}
                            onChange={(e) => {
                              setResumeData(prev => ({
                                ...prev,
                                educationHistory: prev.educationHistory.map(entry =>
                                  entry.id === edu.id ? { ...entry, graduationType: e.target.value as EducationEntry['graduationType'] } : entry
                                ),
                              }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                          >
                            <option value="卒業">卒業</option>
                            <option value="卒業見込">卒業見込</option>
                            <option value="在学中">在学中</option>
                            <option value="中退">中退</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 職歴タブ */}
          {activeTab === 'work' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800">職歴</h3>
                <button
                  onClick={addWork}
                  className="flex items-center gap-1 px-3 py-2 bg-[#00c4cc] text-white rounded-md hover:bg-[#00b0b8] transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  追加
                </button>
              </div>

              {resumeData.workHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                  <Briefcase className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>職歴を追加してください</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {resumeData.workHistory.map((work, index) => (
                    <div key={work.id} className="p-4 border border-gray-200 rounded-lg space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-bold text-gray-500">職歴 {index + 1}</span>
                        <button
                          onClick={() => {
                            setResumeData(prev => ({
                              ...prev,
                              workHistory: prev.workHistory.filter(w => w.id !== work.id),
                            }));
                          }}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">会社名</label>
                          <input
                            type="text"
                            value={work.companyName}
                            onChange={(e) => {
                              setResumeData(prev => ({
                                ...prev,
                                workHistory: prev.workHistory.map(w =>
                                  w.id === work.id ? { ...w, companyName: e.target.value } : w
                                ),
                              }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">雇用形態</label>
                          <select
                            value={work.employmentType}
                            onChange={(e) => {
                              setResumeData(prev => ({
                                ...prev,
                                workHistory: prev.workHistory.map(w =>
                                  w.id === work.id ? { ...w, employmentType: e.target.value as WorkEntry['employmentType'] } : w
                                ),
                              }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                          >
                            <option value="正社員">正社員</option>
                            <option value="契約社員">契約社員</option>
                            <option value="パート・アルバイト">パート・アルバイト</option>
                            <option value="派遣社員">派遣社員</option>
                            <option value="業務委託">業務委託</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">部署</label>
                          <input
                            type="text"
                            value={work.department || ''}
                            onChange={(e) => {
                              setResumeData(prev => ({
                                ...prev,
                                workHistory: prev.workHistory.map(w =>
                                  w.id === work.id ? { ...w, department: e.target.value } : w
                                ),
                              }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">役職</label>
                          <input
                            type="text"
                            value={work.position || ''}
                            onChange={(e) => {
                              setResumeData(prev => ({
                                ...prev,
                                workHistory: prev.workHistory.map(w =>
                                  w.id === work.id ? { ...w, position: e.target.value } : w
                                ),
                              }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">入社年月</label>
                          <input
                            type="month"
                            value={work.startDate}
                            onChange={(e) => {
                              setResumeData(prev => ({
                                ...prev,
                                workHistory: prev.workHistory.map(w =>
                                  w.id === work.id ? { ...w, startDate: e.target.value } : w
                                ),
                              }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">退社年月</label>
                          <input
                            type="month"
                            value={work.endDate || ''}
                            onChange={(e) => {
                              setResumeData(prev => ({
                                ...prev,
                                workHistory: prev.workHistory.map(w =>
                                  w.id === work.id ? { ...w, endDate: e.target.value } : w
                                ),
                              }));
                            }}
                            placeholder="在職中の場合は空欄"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">職務内容</label>
                        <textarea
                          value={work.jobDescription || ''}
                          onChange={(e) => {
                            setResumeData(prev => ({
                              ...prev,
                              workHistory: prev.workHistory.map(w =>
                                w.id === work.id ? { ...w, jobDescription: e.target.value } : w
                              ),
                            }));
                          }}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 資格・免許タブ */}
          {activeTab === 'license' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800">資格・免許</h3>
                <button
                  onClick={addLicense}
                  className="flex items-center gap-1 px-3 py-2 bg-[#00c4cc] text-white rounded-md hover:bg-[#00b0b8] transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  追加
                </button>
              </div>

              {resumeData.licensesQualifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                  <Award className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>資格・免許を追加してください</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {resumeData.licensesQualifications.map((license, index) => (
                    <div key={license.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-sm font-bold text-gray-500">資格 {index + 1}</span>
                        <button
                          onClick={() => {
                            setResumeData(prev => ({
                              ...prev,
                              licensesQualifications: prev.licensesQualifications.filter(l => l.id !== license.id),
                            }));
                          }}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">資格・免許名</label>
                          <input
                            type="text"
                            value={license.name}
                            onChange={(e) => {
                              setResumeData(prev => ({
                                ...prev,
                                licensesQualifications: prev.licensesQualifications.map(l =>
                                  l.id === license.id ? { ...l, name: e.target.value } : l
                                ),
                              }));
                            }}
                            placeholder="例: 保育士"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">取得年月</label>
                          <input
                            type="month"
                            value={license.acquiredDate}
                            onChange={(e) => {
                              setResumeData(prev => ({
                                ...prev,
                                licensesQualifications: prev.licensesQualifications.map(l =>
                                  l.id === license.id ? { ...l, acquiredDate: e.target.value } : l
                                ),
                              }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 自己PRタブ */}
          {activeTab === 'pr' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">志望動機</label>
                <textarea
                  value={resumeData.motivation || ''}
                  onChange={(e) => setResumeData(prev => ({ ...prev, motivation: e.target.value }))}
                  rows={4}
                  placeholder="この職場で働きたい理由を記入してください"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">自己PR</label>
                <textarea
                  value={resumeData.selfPromotion || ''}
                  onChange={(e) => setResumeData(prev => ({ ...prev, selfPromotion: e.target.value }))}
                  rows={4}
                  placeholder="あなたの強みやアピールポイントを記入してください"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">活かせる経験・知識・技術</label>
                <textarea
                  value={resumeData.applicableSkills || ''}
                  onChange={(e) => setResumeData(prev => ({ ...prev, applicableSkills: e.target.value }))}
                  rows={3}
                  placeholder="これまでの経験で活かせるスキルを記入してください"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">特技・趣味</label>
                <textarea
                  value={resumeData.skillsHobbies || ''}
                  onChange={(e) => setResumeData(prev => ({ ...prev, skillsHobbies: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">本人希望記入欄</label>
                <textarea
                  value={resumeData.personalRequests || ''}
                  onChange={(e) => setResumeData(prev => ({ ...prev, personalRequests: e.target.value }))}
                  rows={2}
                  placeholder="勤務時間・勤務地・その他の希望があれば記入してください"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">職務要約（職務経歴書用）</label>
                <textarea
                  value={resumeData.careerSummary || ''}
                  onChange={(e) => setResumeData(prev => ({ ...prev, careerSummary: e.target.value }))}
                  rows={4}
                  placeholder="これまでのキャリアの概要を記入してください"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                />
              </div>
            </div>
          )}

          {/* PDF出力タブ */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-bold text-blue-800 mb-2">PDF出力</h3>
                <p className="text-sm text-blue-700">
                  入力した情報を元に、履歴書・職務経歴書のPDFを生成できます。
                  出力前に各タブの情報が正しく入力されているか確認してください。
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={generateResumePDF}
                  disabled={generating !== null}
                  className="flex flex-col items-center justify-center p-6 border-2 border-[#00c4cc] rounded-lg hover:bg-[#00c4cc]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating === 'resume' ? (
                    <Loader2 className="w-12 h-12 text-[#00c4cc] mb-3 animate-spin" />
                  ) : (
                    <FileText className="w-12 h-12 text-[#00c4cc] mb-3" />
                  )}
                  <span className="text-lg font-bold text-gray-800">履歴書</span>
                  <span className="text-sm text-gray-500 mt-1">
                    {generating === 'resume' ? '生成中...' : 'JIS規格フォーマット'}
                  </span>
                </button>

                <button
                  onClick={generateCVPDF}
                  disabled={generating !== null}
                  className="flex flex-col items-center justify-center p-6 border-2 border-[#00c4cc] rounded-lg hover:bg-[#00c4cc]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating === 'cv' ? (
                    <Loader2 className="w-12 h-12 text-[#00c4cc] mb-3 animate-spin" />
                  ) : (
                    <FileCheck className="w-12 h-12 text-[#00c4cc] mb-3" />
                  )}
                  <span className="text-lg font-bold text-gray-800">職務経歴書</span>
                  <span className="text-sm text-gray-500 mt-1">
                    {generating === 'cv' ? '生成中...' : '一般フォーマット'}
                  </span>
                </button>
              </div>

              {/* 入力状況確認 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-bold text-gray-700 mb-3">入力状況</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${resumeData.lastName && resumeData.firstName ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    <span className="text-gray-600">氏名</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${resumeData.profilePhotoUrl ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    <span className="text-gray-600">顔写真</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${resumeData.address ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    <span className="text-gray-600">住所</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${resumeData.educationHistory.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    <span className="text-gray-600">学歴</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${resumeData.workHistory.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    <span className="text-gray-600">職歴</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${resumeData.licensesQualifications.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    <span className="text-gray-600">資格・免許</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${resumeData.selfPromotion ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    <span className="text-gray-600">自己PR</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${resumeData.motivation ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    <span className="text-gray-600">志望動機</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 履歴書PDFテンプレート（非表示） */}
      <div ref={resumeRef} style={{ display: 'none', width: '794px', padding: '40px', fontFamily: 'sans-serif', backgroundColor: '#fff' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '5px' }}>履 歴 書</h1>
          <p style={{ fontSize: '12px', color: '#666' }}>
            {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}現在
          </p>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', width: '80px', fontSize: '12px' }}>フリガナ</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }} colSpan={3}>
                {resumeData.lastNameKana} {resumeData.firstNameKana}
              </td>
              <td style={{ border: '1px solid #333', width: '120px', textAlign: 'center', verticalAlign: 'middle' }} rowSpan={4}>
                {resumeData.profilePhotoUrl ? (
                  <img src={resumeData.profilePhotoUrl} alt="写真" style={{ width: '100px', height: '130px', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100px', height: '130px', margin: '0 auto', backgroundColor: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#999' }}>
                    写真
                  </div>
                )}
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px' }}>氏名</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '18px', fontWeight: 'bold' }} colSpan={3}>
                {resumeData.lastName} {resumeData.firstName}
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px' }}>生年月日</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }} colSpan={3}>
                {resumeData.birthDate && toJapaneseDate(resumeData.birthDate)}
                {resumeData.birthDate && ` （満${calculateAge(resumeData.birthDate)}歳）`}
                {resumeData.gender && ` ・ ${resumeData.gender}`}
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px' }}>現住所</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }} colSpan={3}>
                〒{resumeData.postalCode}<br />
                {resumeData.address}
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px' }}>電話</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }}>{resumeData.phone}</td>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px', width: '80px' }}>E-mail</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }} colSpan={2}>{resumeData.email}</td>
            </tr>
            {resumeData.nearestStation && (
              <tr>
                <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px' }}>最寄駅</td>
                <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }}>{resumeData.nearestStation}</td>
                <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px' }}>通勤時間</td>
                <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }} colSpan={2}>{resumeData.commuteTime}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* 学歴・職歴 */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', width: '100px', fontSize: '12px' }}>年月</th>
              <th style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px' }}>学歴・職歴</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center', fontSize: '12px' }} colSpan={2}>学歴</td>
            </tr>
            {resumeData.educationHistory.map((edu) => (
              <React.Fragment key={edu.id}>
                <tr>
                  <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px', textAlign: 'center' }}>{toJapaneseDate(edu.startDate)}</td>
                  <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }}>{edu.schoolName}{edu.department && ` ${edu.department}`} 入学</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px', textAlign: 'center' }}>{toJapaneseDate(edu.endDate)}</td>
                  <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }}>{edu.schoolName}{edu.department && ` ${edu.department}`} {edu.graduationType}</td>
                </tr>
              </React.Fragment>
            ))}
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center', fontSize: '12px' }} colSpan={2}>職歴</td>
            </tr>
            {resumeData.workHistory.length === 0 ? (
              <tr>
                <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center', fontSize: '12px' }} colSpan={2}>なし</td>
              </tr>
            ) : (
              resumeData.workHistory.map((work) => (
                <React.Fragment key={work.id}>
                  <tr>
                    <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px', textAlign: 'center' }}>{toJapaneseDate(work.startDate)}</td>
                    <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }}>{work.companyName} 入社{work.employmentType && ` （${work.employmentType}）`}</td>
                  </tr>
                  {work.department && (
                    <tr>
                      <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }}></td>
                      <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }}>{work.department}{work.position && ` ${work.position}`} 配属</td>
                    </tr>
                  )}
                  {work.endDate && (
                    <tr>
                      <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px', textAlign: 'center' }}>{toJapaneseDate(work.endDate)}</td>
                      <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }}>一身上の都合により退職</td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'right', fontSize: '12px' }} colSpan={2}>以上</td>
            </tr>
          </tbody>
        </table>

        {/* 資格・免許 */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', width: '100px', fontSize: '12px' }}>年月</th>
              <th style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px' }}>免許・資格</th>
            </tr>
          </thead>
          <tbody>
            {resumeData.licensesQualifications.length === 0 ? (
              <tr>
                <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center', fontSize: '12px' }} colSpan={2}>特になし</td>
              </tr>
            ) : (
              resumeData.licensesQualifications.map((license) => (
                <tr key={license.id}>
                  <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px', textAlign: 'center' }}>{toJapaneseDate(license.acquiredDate)}</td>
                  <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }}>{license.name} 取得</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* 志望動機・自己PR */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', width: '120px', fontSize: '12px', verticalAlign: 'top' }}>志望動機</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px', minHeight: '60px', whiteSpace: 'pre-wrap' }}>{resumeData.motivation || ''}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px', verticalAlign: 'top' }}>特技・趣味</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px', whiteSpace: 'pre-wrap' }}>{resumeData.skillsHobbies || ''}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px', verticalAlign: 'top' }}>健康状態</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }}>{resumeData.healthStatus || '良好'}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px', verticalAlign: 'top' }}>本人希望</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px', whiteSpace: 'pre-wrap' }}>{resumeData.personalRequests || '貴社規定に従います'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 職務経歴書PDFテンプレート（非表示） */}
      <div ref={cvRef} style={{ display: 'none', width: '794px', padding: '40px', fontFamily: 'sans-serif', backgroundColor: '#fff' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '5px' }}>職 務 経 歴 書</h1>
          <p style={{ fontSize: '12px', color: '#666' }}>
            {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}現在
          </p>
        </div>

        <div style={{ textAlign: 'right', marginBottom: '20px', fontSize: '14px' }}>
          <p>{resumeData.lastName} {resumeData.firstName}</p>
        </div>

        {/* 職務要約 */}
        {resumeData.careerSummary && (
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', borderBottom: '2px solid #333', paddingBottom: '5px', marginBottom: '10px' }}>職務要約</h2>
            <p style={{ fontSize: '12px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{resumeData.careerSummary}</p>
          </div>
        )}

        {/* 職務経歴 */}
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', borderBottom: '2px solid #333', paddingBottom: '5px', marginBottom: '10px' }}>職務経歴</h2>
          {resumeData.workHistory.map((work) => (
            <div key={work.id} style={{ marginBottom: '20px', paddingLeft: '10px', borderLeft: '3px solid #00c4cc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{work.companyName}</span>
                <span style={{ fontSize: '12px', color: '#666' }}>
                  {toJapaneseDate(work.startDate)} ～ {work.endDate ? toJapaneseDate(work.endDate) : '現在'}
                </span>
              </div>
              {work.department && (
                <p style={{ fontSize: '12px', color: '#333', marginBottom: '5px' }}>
                  {work.department}{work.position && ` / ${work.position}`}
                </p>
              )}
              <p style={{ fontSize: '11px', color: '#666', marginBottom: '5px' }}>雇用形態: {work.employmentType}</p>
              {work.jobDescription && (
                <div style={{ marginTop: '10px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '5px' }}>【業務内容】</p>
                  <p style={{ fontSize: '11px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{work.jobDescription}</p>
                </div>
              )}
              {work.achievements && (
                <div style={{ marginTop: '10px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '5px' }}>【実績・成果】</p>
                  <p style={{ fontSize: '11px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{work.achievements}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 活かせる経験・知識・技術 */}
        {resumeData.applicableSkills && (
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', borderBottom: '2px solid #333', paddingBottom: '5px', marginBottom: '10px' }}>活かせる経験・知識・技術</h2>
            <p style={{ fontSize: '12px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{resumeData.applicableSkills}</p>
          </div>
        )}

        {/* 資格・免許 */}
        {resumeData.licensesQualifications.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', borderBottom: '2px solid #333', paddingBottom: '5px', marginBottom: '10px' }}>保有資格</h2>
            <ul style={{ fontSize: '12px', listStyle: 'disc', paddingLeft: '20px' }}>
              {resumeData.licensesQualifications.map((license) => (
                <li key={license.id} style={{ marginBottom: '5px' }}>
                  {license.name} （{toJapaneseDate(license.acquiredDate)} 取得）
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 自己PR */}
        {resumeData.selfPromotion && (
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', borderBottom: '2px solid #333', paddingBottom: '5px', marginBottom: '10px' }}>自己PR</h2>
            <p style={{ fontSize: '12px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{resumeData.selfPromotion}</p>
          </div>
        )}
      </div>
    </div>
  );
}
