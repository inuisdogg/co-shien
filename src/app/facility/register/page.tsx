/**
 * 施設登録ページ（3ステップウィザード）
 * 招待リンクから施設を登録する
 * Step1: 法人情報 → Step2: 施設情報 → Step3: 確認・完了
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import {
  Upload, X, Building2, FileText, AlertCircle, CheckCircle,
  Briefcase, MapPin, ChevronRight, ChevronLeft, Users, Clock,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface UserInfo {
  id: string;
  name: string;
  email: string;
}

type WizardStep = 1 | 2 | 3;

const SERVICE_CATEGORIES = [
  { key: 'childDevelopmentSupport', label: '児童発達支援', description: '未就学児向け' },
  { key: 'afterSchoolDayService', label: '放課後等デイサービス', description: '就学児向け' },
  { key: 'nurseryVisitSupport', label: '保育所等訪問支援', description: '訪問型' },
  { key: 'homeBasedChildSupport', label: '居宅訪問型児童発達支援', description: '在宅型' },
] as const;

const COMPANY_TYPES = [
  { value: 'corporation', label: '株式会社・有限会社' },
  { value: 'npo', label: 'NPO法人' },
  { value: 'general_association', label: '一般社団法人・一般財団法人' },
  { value: 'social_welfare', label: '社会福祉法人' },
  { value: 'medical', label: '医療法人' },
  { value: 'individual', label: '個人事業主' },
] as const;

export default function FacilityRegisterPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingToken, setLoadingToken] = useState(true);
  const [step, setStep] = useState<WizardStep>(1);

  // 完了画面用
  const [completed, setCompleted] = useState(false);

  // 旧トークン互換
  const [isPreRegistered, setIsPreRegistered] = useState(false);
  const [preRegisteredFacilityId, setPreRegisteredFacilityId] = useState<string | null>(null);

  // Step1: 法人情報
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');

  // Step2: 施設情報
  const [facilityName, setFacilityName] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  const [serviceCategories, setServiceCategories] = useState<Record<string, boolean>>({
    childDevelopmentSupport: false,
    afterSchoolDayService: false,
    nurseryVisitSupport: false,
    homeBasedChildSupport: false,
  });
  const [postalCode, setPostalCode] = useState('');
  const [facilityAddress, setFacilityAddress] = useState('');
  const [capacityAM, setCapacityAM] = useState('');
  const [capacityPM, setCapacityPM] = useState('');
  const [designationFile, setDesignationFile] = useState<File | null>(null);
  const [designationPreview, setDesignationPreview] = useState<string | null>(null);

  // トークン検証
  useEffect(() => {
    const validateToken = async () => {
      const token = searchParams?.get('token');
      if (!token) {
        setLoadingToken(false);
        return;
      }

      try {
        const { data: platformToken } = await supabase
          .from('platform_invitation_tokens')
          .select('id, expires_at, used_at, memo_company_name, memo_contact_name')
          .eq('token', token)
          .maybeSingle();

        if (platformToken) {
          if (new Date(platformToken.expires_at) < new Date()) {
            setError('トークンの有効期限が切れています。管理者に再発行を依頼してください。');
            setLoadingToken(false);
            return;
          }
          if (platformToken.used_at) {
            setError('このトークンは既に使用されています');
            setLoadingToken(false);
            return;
          }
          // メモから法人名を事前入力
          if (platformToken.memo_company_name) {
            setCompanyName(platformToken.memo_company_name);
          }
          setIsPreRegistered(false);
          setLoadingToken(false);
          return;
        }

        // 旧トークンシステム（後方互換）
        const { data: tokenData } = await supabase
          .from('facility_registration_tokens')
          .select('facility_id, expires_at, used_at')
          .eq('token', token)
          .maybeSingle();

        if (!tokenData) {
          setError('無効なトークンです');
          setLoadingToken(false);
          return;
        }
        if (new Date(tokenData.expires_at) < new Date()) {
          setError('トークンの有効期限が切れています');
          setLoadingToken(false);
          return;
        }
        if (tokenData.used_at) {
          setError('このトークンは既に使用されています');
          setLoadingToken(false);
          return;
        }

        const { data: facilityData } = await supabase
          .from('facilities')
          .select('id, name, pre_registered')
          .eq('id', tokenData.facility_id)
          .eq('pre_registered', true)
          .single();

        if (!facilityData) {
          setError('事前登録された施設が見つかりません');
          setLoadingToken(false);
          return;
        }

        setFacilityName(facilityData.name);
        setPreRegisteredFacilityId(facilityData.id);
        setIsPreRegistered(true);
      } catch (err: any) {
        setError(err.message || 'トークンの検証に失敗しました');
      } finally {
        setLoadingToken(false);
      }
    };

    validateToken();
  }, [searchParams]);

  // ユーザー情報
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      const token = searchParams?.get('token');
      router.push(`/career/login${token ? `?redirect=/facility/register?token=${token}` : ''}`);
      return;
    }
    setUser(JSON.parse(userStr));
  }, [router, searchParams]);

  // 郵便番号から住所検索
  const lookupAddress = useCallback(async (code: string) => {
    const cleaned = code.replace(/[^\d]/g, '');
    if (cleaned.length !== 7) return;

    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleaned}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const r = data.results[0];
        setFacilityAddress(`${r.address1}${r.address2}${r.address3}`);
      }
    } catch {
      toast.error('住所の検索に失敗しました');
    }
  }, [toast]);

  const handlePostalCodeChange = (value: string) => {
    const cleaned = value.replace(/[^\d-]/g, '').slice(0, 8);
    setPostalCode(cleaned);
    const digits = cleaned.replace(/-/g, '');
    if (digits.length === 7) {
      lookupAddress(digits);
    }
  };

  // ファイル選択
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('ファイルサイズは5MB以下にしてください');
      return;
    }
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError('画像ファイル（JPG, PNG）またはPDFをアップロードしてください');
      return;
    }
    setDesignationFile(file);
    setError('');
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setDesignationPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setDesignationPreview(null);
    }
  };

  const removeFile = () => {
    setDesignationFile(null);
    setDesignationPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // サービス種別トグル
  const toggleServiceCategory = (key: string) => {
    setServiceCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ステップ1バリデーション
  const validateStep1 = (): boolean => {
    if (!companyName.trim()) {
      setError('法人名を入力してください');
      return false;
    }
    setError('');
    return true;
  };

  // ステップ2バリデーション
  const validateStep2 = (): boolean => {
    if (!facilityName.trim()) {
      setError('施設名を入力してください');
      return false;
    }
    if (businessNumber && !businessNumber.match(/^\d{10}$/)) {
      setError('事業所番号は10桁の数字で入力してください');
      return false;
    }
    const hasService = Object.values(serviceCategories).some((v) => v);
    if (!hasService) {
      setError('サービス種別を1つ以上選択してください');
      return false;
    }
    setError('');
    return true;
  };

  // 次のステップへ
  const goNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  // 前のステップへ
  const goPrev = () => {
    setError('');
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  // 施設申請処理（審査フロー）
  const handleSubmit = async () => {
    if (!user) return;
    setError('');
    setLoading(true);

    try {
      // --- 1. 指定通知書をアップロード（任意） ---
      let designationFileUrl: string | null = null;
      if (designationFile) {
        const fileExt = designationFile.name.split('.').pop();
        const fileName = `applications/${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('facility-documents')
          .upload(fileName, designationFile);
        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error('指定通知書のアップロードに失敗しました');
        } else {
          designationFileUrl = fileName;
        }
      }

      // --- 2. facility_applications に申請を作成 ---
      const { error: appError } = await supabase
        .from('facility_applications')
        .insert({
          user_id: user.id,
          company_name: companyName.trim(),
          company_type: companyType || null,
          representative_name: representativeName.trim() || null,
          company_address: companyAddress.trim() || null,
          company_phone: companyPhone.trim() || null,
          facility_name: facilityName.trim(),
          service_categories: serviceCategories,
          business_number: businessNumber || null,
          postal_code: postalCode ? postalCode.replace(/-/g, '') : null,
          facility_address: facilityAddress.trim() || null,
          capacity_am: capacityAM ? parseInt(capacityAM, 10) : null,
          capacity_pm: capacityPM ? parseInt(capacityPM, 10) : null,
          designation_file_url: designationFileUrl,
          status: 'pending',
        });

      if (appError) {
        throw new Error(`申請の送信に失敗しました: ${appError.message}`);
      }

      // --- 3. トークンを使用済みにする ---
      const token = searchParams?.get('token');
      if (token) {
        await supabase.from('platform_invitation_tokens')
          .update({ used_at: new Date().toISOString() })
          .eq('token', token);
        if (isPreRegistered) {
          await supabase.from('facility_registration_tokens')
            .update({ used_at: new Date().toISOString() })
            .eq('token', token);
        }
      }

      // --- 4. オーナーに通知 ---
      const { data: owners } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'owner');

      if (owners && owners.length > 0) {
        const notifications = owners.map((owner: { id: string }) => ({
          id: `notif-${Date.now()}-${owner.id}`,
          user_id: owner.id,
          title: '新規施設申請',
          message: `${companyName.trim()} の「${facilityName.trim()}」の施設登録申請が届きました`,
          type: 'facility_application',
          is_read: false,
          created_at: new Date().toISOString(),
        }));
        const { error: notifError } = await supabase.from('notifications').insert(notifications);
        if (notifError) {
          console.error('Notification error:', notifError);
          toast.error('管理者への通知送信に失敗しました');
        }
      }

      setCompleted(true);
    } catch (err: any) {
      setError(err.message || '申請の送信に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // --- ローディング画面 ---
  if (loadingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary-dark p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">トークンを確認しています...</p>
        </div>
      </div>
    );
  }

  // --- エラー画面（トークン無効） ---
  if (error && loadingToken === false && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary-dark p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">エラー</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={() => router.push('/')} className="px-6 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            トップへ戻る
          </button>
        </div>
      </div>
    );
  }

  // --- 完了画面（申請受付） ---
  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary-dark p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">申請を受け付けました</h2>
          <p className="text-gray-600 mb-6">
            運営チームが内容を確認し、審査いたします。<br />
            審査完了後、メールでお知らせします。
          </p>

          <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
            <div>
              <p className="text-xs text-gray-500">法人名</p>
              <p className="font-bold text-gray-800">{companyName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">施設名</p>
              <p className="font-bold text-gray-800">{facilityName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">ステータス</p>
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                <Clock className="w-4 h-4" />
                審査中
              </span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
            <p className="text-sm font-bold text-blue-800 mb-2">審査完了までの流れ</p>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>運営チームが申請内容を確認</li>
              <li>承認されると施設アカウントが作成されます</li>
              <li>通知が届いたら施設管理画面をご利用いただけます</li>
            </ol>
          </div>

          <button
            onClick={() => { window.location.href = '/career'; }}
            className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 px-4 rounded-xl transition-colors"
          >
            マイページに戻る
          </button>
        </div>
      </div>
    );
  }

  // --- 申請中画面 ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary-dark p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">申請中...</h2>
          <p className="text-gray-600 text-sm">申請を送信しています</p>
        </div>
      </div>
    );
  }

  // --- メインウィザード ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark p-4">
      <div className="max-w-lg mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <button onClick={() => router.push('/portal')} className="text-white/80 hover:text-white text-sm">
            ← 戻る
          </button>
          <Image src="/logo-white.svg" alt="Roots" width={100} height={32} className="h-6 w-auto" />
          <div className="w-12"></div>
        </div>

        {/* ステップインジケーター */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[
            { num: 1, label: '法人情報' },
            { num: 2, label: '施設情報' },
            { num: 3, label: '確認' },
          ].map(({ num, label }) => (
            <React.Fragment key={num}>
              {num > 1 && <div className={`w-8 h-0.5 ${step >= num ? 'bg-white' : 'bg-white/30'}`} />}
              <div className="flex items-center gap-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step >= num ? 'bg-white text-primary' : 'bg-white/30 text-white'
                }`}>
                  {step > num ? <CheckCircle className="w-4 h-4" /> : num}
                </div>
                <span className={`text-xs ${step >= num ? 'text-white font-bold' : 'text-white/60'}`}>
                  {label}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* メインカード */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* ===== Step 1: 法人情報 ===== */}
          {step === 1 && (
            <div>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Briefcase className="w-7 h-7 text-blue-600" />
                </div>
                <h1 className="text-xl font-bold text-gray-800">法人情報</h1>
                <p className="text-gray-500 text-sm mt-1">運営法人の情報を入力してください</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    法人名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="例: 株式会社ひまわり福祉会"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">法人種別</label>
                  <select
                    value={companyType}
                    onChange={(e) => setCompanyType(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
                  >
                    <option value="">選択してください</option>
                    {COMPANY_TYPES.map((ct) => (
                      <option key={ct.value} value={ct.value}>{ct.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">代表者名</label>
                  <input
                    type="text"
                    value={representativeName}
                    onChange={(e) => setRepresentativeName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="例: 山田太郎"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">法人住所</label>
                  <input
                    type="text"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="例: 東京都渋谷区..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">電話番号</label>
                  <input
                    type="tel"
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="例: 03-1234-5678"
                  />
                </div>
              </div>

              <div className="mt-8">
                <button
                  onClick={goNext}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold py-3 px-4 rounded-xl transition-colors"
                >
                  次へ：施設情報
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ===== Step 2: 施設情報 ===== */}
          {step === 2 && (
            <div>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Building2 className="w-7 h-7 text-primary" />
                </div>
                <h1 className="text-xl font-bold text-gray-800">施設情報</h1>
                <p className="text-gray-500 text-sm mt-1">施設の基本情報を入力してください</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    施設名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={facilityName}
                    onChange={(e) => setFacilityName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="例: ひまわり放課後等デイサービス"
                    disabled={isPreRegistered}
                  />
                </div>

                {/* サービス種別 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    サービス種別 <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    {SERVICE_CATEGORIES.map((cat) => (
                      <label
                        key={cat.key}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          serviceCategories[cat.key]
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={serviceCategories[cat.key]}
                          onChange={() => toggleServiceCategory(cat.key)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary"
                        />
                        <div>
                          <p className="text-sm font-bold text-gray-800">{cat.label}</p>
                          <p className="text-xs text-gray-500">{cat.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    事業所番号（10桁）<span className="text-xs text-gray-400 font-normal ml-1">任意</span>
                  </label>
                  <input
                    type="text"
                    value={businessNumber}
                    onChange={(e) => setBusinessNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono"
                    placeholder="1234567890"
                  />
                  <p className="text-xs text-gray-500 mt-1">指定後に入力可能です</p>
                </div>

                {/* 所在地 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    <MapPin className="w-3.5 h-3.5 inline mr-1" />
                    施設所在地
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => handlePostalCodeChange(e.target.value)}
                      className="w-32 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="〒000-0000"
                    />
                    <span className="text-xs text-gray-500 self-center">→ 自動入力</span>
                  </div>
                  <input
                    type="text"
                    value={facilityAddress}
                    onChange={(e) => setFacilityAddress(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="住所を入力"
                  />
                </div>

                {/* 定員 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    <Users className="w-3.5 h-3.5 inline mr-1" />
                    定員
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">午前（AM）</label>
                      <input
                        type="number"
                        value={capacityAM}
                        onChange={(e) => setCapacityAM(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="10"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">午後（PM）</label>
                      <input
                        type="number"
                        value={capacityPM}
                        onChange={(e) => setCapacityPM(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="10"
                        min="0"
                      />
                    </div>
                  </div>
                </div>

                {/* 指定通知書 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    指定通知書 <span className="text-xs text-gray-400 font-normal ml-1">任意</span>
                  </label>
                  {!designationFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-lg p-5 text-center cursor-pointer hover:border-primary transition-colors"
                    >
                      <Upload className="w-7 h-7 text-gray-400 mx-auto mb-1.5" />
                      <p className="text-gray-600 text-sm">クリックして選択</p>
                      <p className="text-gray-400 text-xs mt-0.5">JPG, PNG, PDF（5MB以下）</p>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-6 h-6 text-primary" />
                          <div>
                            <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">{designationFile.name}</p>
                            <p className="text-xs text-gray-500">{(designationFile.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <button type="button" onClick={removeFile} className="p-1 hover:bg-gray-100 rounded">
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                      {designationPreview && (
                        <img src={designationPreview} alt="Preview" className="mt-2 max-h-24 rounded border" />
                      )}
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileSelect} className="hidden" />
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={goPrev}
                  className="flex items-center justify-center gap-1 px-5 py-3 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  戻る
                </button>
                <button
                  onClick={goNext}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold py-3 px-4 rounded-xl transition-colors"
                >
                  次へ：確認
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ===== Step 3: 確認 ===== */}
          {step === 3 && (
            <div>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-7 h-7 text-green-600" />
                </div>
                <h1 className="text-xl font-bold text-gray-800">入力内容の確認</h1>
                <p className="text-gray-500 text-sm mt-1">内容を確認して申請してください</p>
              </div>

              <div className="space-y-4">
                {/* 法人情報 */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-600 flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4" />法人情報
                    </h3>
                    <button onClick={() => setStep(1)} className="text-xs text-primary hover:underline">
                      編集
                    </button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex">
                      <span className="w-24 text-gray-500 flex-shrink-0">法人名</span>
                      <span className="font-bold text-gray-800">{companyName}</span>
                    </div>
                    {companyType && (
                      <div className="flex">
                        <span className="w-24 text-gray-500 flex-shrink-0">種別</span>
                        <span className="text-gray-800">{COMPANY_TYPES.find((ct) => ct.value === companyType)?.label}</span>
                      </div>
                    )}
                    {representativeName && (
                      <div className="flex">
                        <span className="w-24 text-gray-500 flex-shrink-0">代表者</span>
                        <span className="text-gray-800">{representativeName}</span>
                      </div>
                    )}
                    {companyAddress && (
                      <div className="flex">
                        <span className="w-24 text-gray-500 flex-shrink-0">住所</span>
                        <span className="text-gray-800">{companyAddress}</span>
                      </div>
                    )}
                    {companyPhone && (
                      <div className="flex">
                        <span className="w-24 text-gray-500 flex-shrink-0">電話</span>
                        <span className="text-gray-800">{companyPhone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 施設情報 */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-600 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4" />施設情報
                    </h3>
                    <button onClick={() => setStep(2)} className="text-xs text-primary hover:underline">
                      編集
                    </button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex">
                      <span className="w-24 text-gray-500 flex-shrink-0">施設名</span>
                      <span className="font-bold text-gray-800">{facilityName}</span>
                    </div>
                    <div className="flex">
                      <span className="w-24 text-gray-500 flex-shrink-0">サービス</span>
                      <span className="text-gray-800">
                        {SERVICE_CATEGORIES.filter((c) => serviceCategories[c.key]).map((c) => c.label).join('、')}
                      </span>
                    </div>
                    {businessNumber && (
                      <div className="flex">
                        <span className="w-24 text-gray-500 flex-shrink-0">事業所番号</span>
                        <span className="text-gray-800 font-mono">{businessNumber}</span>
                      </div>
                    )}
                    {facilityAddress && (
                      <div className="flex">
                        <span className="w-24 text-gray-500 flex-shrink-0">所在地</span>
                        <span className="text-gray-800">{postalCode ? `〒${postalCode} ` : ''}{facilityAddress}</span>
                      </div>
                    )}
                    {(capacityAM || capacityPM) && (
                      <div className="flex">
                        <span className="w-24 text-gray-500 flex-shrink-0">定員</span>
                        <span className="text-gray-800">AM {capacityAM || 0}名 / PM {capacityPM || 0}名</span>
                      </div>
                    )}
                    {designationFile && (
                      <div className="flex">
                        <span className="w-24 text-gray-500 flex-shrink-0">指定通知書</span>
                        <span className="text-gray-800">{designationFile.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 申請者情報 */}
                <div className="bg-blue-50 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-blue-700 mb-2">申請者アカウント</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex">
                      <span className="w-24 text-blue-600 flex-shrink-0">申請者名</span>
                      <span className="text-blue-800 font-bold">{user?.name}</span>
                    </div>
                    <div className="flex">
                      <span className="w-24 text-blue-600 flex-shrink-0">メール</span>
                      <span className="text-blue-800">{user?.email}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={goPrev}
                  className="flex items-center justify-center gap-1 px-5 py-3 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  戻る
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
                >
                  {loading ? '申請中...' : '申請する'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
