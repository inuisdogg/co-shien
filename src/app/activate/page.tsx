/**
 * 招待リンクからのアカウント有効化・キャリア情報入力ページ
 * 画面A: アカウント作成（パスワード設定）
 * 画面B: 一問一答ステップフォーム（キャリア情報入力）
 */

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  X, 
  CheckCircle, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  MapPin,
  Award,
  Camera,
  Briefcase,
  Plus,
  Trash2
} from 'lucide-react';
import { activateAccount } from '@/utils/staffInvitationService';
import { supabase } from '@/lib/supabase';
import { hashPassword } from '@/utils/password';
import { UserPermissions } from '@/types';

// 静的生成をスキップ（useSearchParamsを使用するため）
export const dynamic = 'force-dynamic';

// 資格の選択肢（児童発達支援・放課後等デイサービス関連）
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

interface WorkHistory {
  id: string;
  type: 'employment' | 'education';
  organization: string;
  position?: string;
  startDate: string;
  endDate: string;
  description: string;
}

interface CareerFormData {
  // ステップB-1: 生年月日
  birthDate: string;
  
  // ステップB-2: 住所
  postalCode: string;
  address: string;
  
  // ステップB-3: 資格
  qualifications: string[];
  customQualification: string;
  qualificationSearch: string;
  
  // ステップB-4: 資格証の写真
  qualificationCertificates: { qualification: string; file: File | null; url: string }[];
  
  // ステップB-5: 職歴・学歴
  workHistory: WorkHistory[];
}

function ActivatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  // 画面状態管理
  const [screen, setScreen] = useState<'checking' | 'welcome' | 'login' | 'register' | 'B' | 'complete'>('checking');
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // 招待情報
  const [facilityName, setFacilityName] = useState('');
  const [invitedName, setInvitedName] = useState('');
  const [invitedEmail, setInvitedEmail] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [invitedRole, setInvitedRole] = useState<string>('');
  const [existingUser, setExistingUser] = useState<any>(null);
  const [isExistingAccount, setIsExistingAccount] = useState(false);
  const [shadowStaff, setShadowStaff] = useState<any>(null);
  
  // ログインフォーム
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });

  // 画面A: アカウント作成フォーム
  const [accountForm, setAccountForm] = useState({
    lastName: '',
    firstName: '',
    lastNameKana: '',
    firstNameKana: '',
    birthDate: '',
    gender: '' as 'male' | 'female' | 'other' | '',
    email: '',
    password: '',
    confirmPassword: '',
    agreedToTerms: false,
    phone: '', // 電話番号（オプション）
  });
  
  // 画面B: キャリア情報フォーム
  const [careerForm, setCareerForm] = useState<CareerFormData>({
    birthDate: '',
    postalCode: '',
    address: '',
    qualifications: [],
    customQualification: '',
    qualificationSearch: '',
    qualificationCertificates: [],
    workHistory: [],
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // 生年月日の年・月・日
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');

  // 生年月日を年・月・日に分割
  const parseBirthDate = (dateString: string) => {
    if (!dateString) return { year: '', month: '', day: '' };
    const [year, month, day] = dateString.split('-');
    return { year: year || '', month: month || '', day: day || '' };
  };

  // 既存の生年月日がある場合は初期値として設定
  useEffect(() => {
    if (careerForm.birthDate) {
      const parts = parseBirthDate(careerForm.birthDate);
      setBirthYear(parts.year);
      setBirthMonth(parts.month);
      setBirthDay(parts.day);
    }
  }, [careerForm.birthDate]);

  // ステップBの定義（生年月日は画面Aで入力済みのため削除）
  const steps = [
    { id: 'address', label: '住所', icon: MapPin },
    { id: 'qualifications', label: '資格', icon: Award },
    { id: 'certificates', label: '資格証', icon: Camera },
    { id: 'workHistory', label: '職歴・学歴', icon: Briefcase },
  ];

  // トークンから招待情報を取得（ユニバーサル・ゲート）
  useEffect(() => {
    // 開発モード: 環境変数で有効化
    const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
    
    // デバッグモード: URLパラメータでステップを指定できる
    const debugStep = searchParams.get('debugStep');
    const debugScreen = searchParams.get('debugScreen');
    
    // デバッグモードのチェックを最初に行う
    if (debugStep !== null && debugScreen === 'B') {
      setScreen('B');
      setCurrentStep(parseInt(debugStep) || 0);
      setFacilityName('テスト事業所');
      setFacilityId('test-facility-id');
      setUserId('test-user-id');
      setInvitedName('テストユーザー');
      setInvitedEmail('test@example.com');
      setError(''); // エラーをクリア
      return;
    }

    // 開発モードでトークンがない場合、テスト事業所情報を設定
    if (isDevMode && !token) {
      setFacilityName(process.env.NEXT_PUBLIC_DEV_FACILITY_NAME || 'テスト事業所');
      setFacilityId(process.env.NEXT_PUBLIC_DEV_FACILITY_ID || 'dev-facility-id');
      setScreen('welcome');
      setError(''); // エラーをクリア
      return;
    }

    // デバッグモードでない場合のみ通常の処理を実行
    if (!token) {
      setError('招待リンクが無効です');
      setScreen('welcome');
      return;
    }

    const verifyToken = async () => {
      try {
        setScreen('checking');
        setError('');
        
        // トークンをデコード
        let tokenData: any;
        try {
          const decoded = atob(token);
          tokenData = JSON.parse(decoded);
        } catch (decodeError) {
          throw new Error('招待リンクの形式が正しくありません');
        }
        
        let fid: string;
        let uid: string | null = null;

        // 公開招待トークンの場合
        if (tokenData.type === 'public' && tokenData.facilityId) {
          fid = tokenData.facilityId;
        } else if (tokenData.facilityId && tokenData.userId) {
          // 特定招待トークンの場合
          fid = tokenData.facilityId;
          uid = tokenData.userId;
        } else if (tokenData.facilityId) {
          // facilityIdのみの場合も公開招待として扱う
          fid = tokenData.facilityId;
        } else {
          throw new Error('無効なリンクです');
        }

        // 事業所情報を取得
        const { data: facility, error: facilityError } = await supabase
          .from('facilities')
          .select('name')
          .eq('id', fid)
          .single();

        if (facilityError || !facility) {
          throw new Error('事業所情報が見つかりません');
        }

        setFacilityName(facility.name);
        setFacilityId(fid);

        // 特定招待の場合、ユーザー情報を取得
        if (uid) {
          const { data: invitedUser, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', uid)
            .single();

          if (!userError && invitedUser) {
            setInvitedName(invitedUser.name);
            setInvitedEmail(invitedUser.email || '');
            setUserId(uid);
            const invitationRole = (invitedUser as any).invitation_role || '一般スタッフ';
            setInvitedRole(invitationRole);
          }
        }

        // welcome画面へ
        setScreen('welcome');
      } catch (err: any) {
        console.error('Token verification error:', err);
        setError(err.message || 'リンクの検証に失敗しました');
        // エラー画面を表示するため、checkingのままにしない
        setScreen('welcome');
      }
    };

    verifyToken();
  }, [token]);

  // 画面A: アカウント作成
  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 開発モード: 必須チェックをスキップ
    const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

    if (accountForm.password !== accountForm.confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    if (accountForm.password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }

    if (!accountForm.agreedToTerms && !isDevMode) {
      setError('利用規約に同意してください');
      return;
    }

    if (!facilityId) {
      setError('事業所情報が不正です');
      return;
    }

    // 開発モードでない場合のみ必須チェック
    if (!isDevMode) {
      // バリデーション
      if (!accountForm.lastName || !accountForm.firstName) {
        setError('姓と名を入力してください');
        return;
      }

      if (!accountForm.lastNameKana || !accountForm.firstNameKana) {
        setError('姓と名のフリガナを入力してください');
        return;
      }

      if (!accountForm.birthDate) {
        setError('生年月日を入力してください');
        return;
      }

      if (!accountForm.gender) {
        setError('性別を選択してください');
        return;
      }

      if (!accountForm.email) {
        setError('メールアドレスを入力してください');
        return;
      }

      // 生年月日の形式チェック
      const birthDateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!birthDateRegex.test(accountForm.birthDate)) {
        setError('生年月日はYYYY-MM-DD形式で入力してください');
        return;
      }

      // 生年月日の妥当性チェック（未来の日付でないか）
      const birthDateObj = new Date(accountForm.birthDate);
      const today = new Date();
      if (birthDateObj > today) {
        setError('生年月日は未来の日付にできません');
        return;
      }
    }

    // 名前を結合（後方互換性のため）
    // 開発モードで空の場合はデフォルト値を設定
    const fullName = accountForm.lastName && accountForm.firstName
      ? `${accountForm.lastName} ${accountForm.firstName}`
      : (isDevMode ? '開発テストユーザー' : '');
    const fullNameKana = accountForm.lastNameKana && accountForm.firstNameKana
      ? `${accountForm.lastNameKana} ${accountForm.firstNameKana}`
      : (isDevMode ? 'カイハツテスト' : '');

    setLoading(true);
    try {
      // シャドウアカウント（staffテーブルにuser_idがNULLで存在するもの）を検索
      let shadowStaff: any = null;
      if (accountForm.email) {
        const { data: staffByEmail } = await supabase
          .from('staff')
          .select('*')
          .eq('facility_id', facilityId)
          .eq('email', accountForm.email)
          .is('user_id', null)
          .single();
        
        if (staffByEmail) {
          shadowStaff = staffByEmail;
        }
      }
      
      if (!shadowStaff && accountForm.phone) {
        const { data: staffByPhone } = await supabase
          .from('staff')
          .select('*')
          .eq('facility_id', facilityId)
          .eq('phone', accountForm.phone)
          .is('user_id', null)
          .single();
        
        if (staffByPhone) {
          shadowStaff = staffByPhone;
        }
      }

      // パスワードをハッシュ化
      const passwordHash = await hashPassword(accountForm.password);

      // 公開招待の場合、新規ユーザーを作成
      if (!userId) {
        // UUIDを生成
        const generateUUID = () => {
          if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
          }
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
        };

        const newUserId = generateUUID();
        const newUser: any = {
          id: newUserId,
          name: fullName || '開発テストユーザー', // 後方互換性のため
          last_name: accountForm.lastName || '開発',
          first_name: accountForm.firstName || 'テスト',
          last_name_kana: accountForm.lastNameKana || 'カイハツ',
          first_name_kana: accountForm.firstNameKana || 'テスト',
          name_kana: fullNameKana || 'カイハツテスト', // 後方互換性のため
          birth_date: accountForm.birthDate || new Date('1990-01-01').toISOString().split('T')[0],
          gender: accountForm.gender || 'other',
          email: accountForm.email || `dev-${newUserId}@example.com`,
          password_hash: passwordHash,
          account_status: 'active',
          activated_at: new Date().toISOString(),
          has_account: true,
          role: 'staff',
          // facility_idは設定しない（usersテーブルは施設に依存しない）
        };

        const { data: createdUser, error: createError } = await supabase
          .from('users')
          .insert(newUser)
          .select()
          .single();

        if (createError || !createdUser) {
          throw new Error(`アカウント作成エラー: ${createError?.message || 'Unknown error'}`);
        }

        setUserId(newUserId);
        setInvitedName(fullName);
        setInvitedEmail(accountForm.email);

        // シャドウアカウントが見つかった場合、マージする
        if (shadowStaff) {
          // staffテーブルのuser_idを更新
          const { error: updateStaffError } = await supabase
            .from('staff')
            .update({ user_id: newUserId })
            .eq('id', shadowStaff.id);

          if (updateStaffError) {
            console.error('シャドウアカウントのマージエラー:', updateStaffError);
            // エラーでも続行
          }

          // シャドウアカウントの情報をusersテーブルに反映
          const updateUserData: any = {};
          if (shadowStaff.birth_date && !createdUser.birth_date) {
            updateUserData.birth_date = shadowStaff.birth_date;
          }
          if (shadowStaff.gender && !createdUser.gender) {
            updateUserData.gender = shadowStaff.gender;
          }
          if (shadowStaff.address && !createdUser.address) {
            updateUserData.address = shadowStaff.address;
          }
          if (shadowStaff.phone && !createdUser.phone) {
            updateUserData.phone = shadowStaff.phone;
          }

          if (Object.keys(updateUserData).length > 0) {
            await supabase
              .from('users')
              .update(updateUserData)
              .eq('id', newUserId);
          }

          // employment_recordsを作成（シャドウアカウントの情報を使用）
          const { error: employmentError } = await supabase
            .from('employment_records')
            .insert({
              user_id: newUserId,
              facility_id: facilityId,
              start_date: shadowStaff.created_at ? shadowStaff.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
              role: shadowStaff.role || '一般スタッフ',
              employment_type: shadowStaff.type || '常勤',
              permissions: {},
              experience_verification_status: 'not_requested',
            });

          if (employmentError) {
            console.error('employment_records作成エラー:', employmentError);
            // エラーでも続行
          }
        }
        
        // アカウント作成成功 → 画面Bへ
        setScreen('B');
        return;
      }

      // 特定招待の場合（既存のユーザーを更新）
      const updateData: any = {
        password_hash: passwordHash,
        account_status: 'active',
        activated_at: new Date().toISOString(),
        has_account: true,
        email: accountForm.email || null,
      };
      
      // 姓名を更新
      if (accountForm.lastName && accountForm.firstName) {
        updateData.last_name = accountForm.lastName;
        updateData.first_name = accountForm.firstName;
        updateData.name = fullName; // 後方互換性のため
      }
      
      if (accountForm.lastNameKana && accountForm.firstNameKana) {
        updateData.last_name_kana = accountForm.lastNameKana;
        updateData.first_name_kana = accountForm.firstNameKana;
        updateData.name_kana = fullNameKana; // 後方互換性のため
      }

      // 生年月日と性別を更新
      if (accountForm.birthDate) {
        updateData.birth_date = accountForm.birthDate;
      }
      if (accountForm.gender) {
        updateData.gender = accountForm.gender;
      }

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (updateError || !updatedUser) {
        throw new Error(`アカウント有効化エラー: ${updateError?.message || 'Unknown error'}`);
      }

      // アカウント作成成功 → 画面Bへ
      setScreen('B');
    } catch (err: any) {
      setError(err.message || 'アカウント作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 郵便番号から住所を検索（簡易版）
  const searchAddressByPostalCode = async (postalCode: string) => {
    // 実際の実装では、郵便番号APIを使用
    // ここでは簡易的な実装
    if (postalCode.length === 7) {
      // 郵便番号APIを呼び出す（例: https://zipcloud.ibsnet.co.jp/api/search）
      try {
        const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${postalCode}`);
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const result = data.results[0];
          setCareerForm(prev => ({
            ...prev,
            address: `${result.address1}${result.address2}${result.address3}`,
          }));
        }
      } catch (err) {
        console.error('郵便番号検索エラー:', err);
      }
    }
  };

  // 資格証のアップロード
  const handleQualificationUpload = async (qualification: string, file: File) => {
    if (!userId) return;

    try {
      // Supabase Storageにアップロード
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${qualification}_${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('qualification-certificates')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 公開URLを取得
      const { data: { publicUrl } } = supabase.storage
        .from('qualification-certificates')
        .getPublicUrl(fileName);

      // フォームに追加
      setCareerForm(prev => {
        const existing = prev.qualificationCertificates.find(c => c.qualification === qualification);
        if (existing) {
          return {
            ...prev,
            qualificationCertificates: prev.qualificationCertificates.map(c =>
              c.qualification === qualification
                ? { ...c, file, url: publicUrl }
                : c
            ),
          };
        } else {
          return {
            ...prev,
            qualificationCertificates: [...prev.qualificationCertificates, { qualification, file, url: publicUrl }],
          };
        }
      });
    } catch (err: any) {
      setError(`アップロードエラー: ${err.message}`);
    }
  };

  // 画面B: キャリア情報の保存
  const handleCareerSubmit = async () => {
    if (!facilityId) {
      setError('事業所情報が不正です');
      return;
    }

    if (!userId) {
      setError('ユーザー情報が不正です');
      return;
    }

    // 名前を結合（後方互換性のため）
    const fullName = `${accountForm.lastName} ${accountForm.firstName}`;

    setLoading(true);
    try {
      // 1. ユーザー情報から招待時の雇用情報を取得（公開招待の場合はデフォルト値を使用）
      let invitationStartDate = new Date().toISOString().split('T')[0];
      let role = '一般スタッフ';
      let employmentType = '常勤';
      let permissions: UserPermissions = {};

      if (userId) {
        const { data: userInfo, error: userInfoError } = await supabase
          .from('users')
          .select('invitation_start_date, invitation_role, invitation_employment_type, invitation_permissions')
          .eq('id', userId)
          .single();

        if (!userInfoError && userInfo) {
          // 招待時の雇用情報があればそれを使用
          invitationStartDate = userInfo?.invitation_start_date || invitationStartDate;
          role = userInfo?.invitation_role || invitedRole || role;
          employmentType = userInfo?.invitation_employment_type || employmentType;
          permissions = userInfo?.invitation_permissions || permissions;
        }
      }

      // 2. employment_recordsテーブルに所属関係を作成
      const { data: employmentRecord, error: employmentError } = await supabase
        .from('employment_records')
        .insert({
          user_id: userId,
          facility_id: facilityId,
          start_date: invitationStartDate,
          role: role,
          employment_type: employmentType,
          permissions: permissions,
          experience_verification_status: 'not_requested',
        })
        .select()
        .single();

      if (employmentError) {
        throw new Error(`所属関係作成エラー: ${employmentError.message}`);
      }

      // 2. user_careersテーブルに資格情報を保存
      if (careerForm.qualifications.length > 0 && !careerForm.qualifications.includes('資格無し')) {
        const careerRecords = careerForm.qualifications.map(qualification => {
          const certificate = careerForm.qualificationCertificates.find(c => c.qualification === qualification);
          return {
            user_id: userId,
            qualification_name: qualification,
            certificate_url: certificate?.url || null,
          };
        });

        const { error: careerError } = await supabase
          .from('user_careers')
          .upsert(careerRecords, { onConflict: 'id' });

        if (careerError) {
          console.error('資格情報保存エラー:', careerError);
          // エラーでも続行
        }
      }

      // 2-2. 職歴・学歴をuser_careersテーブルにJSONBとして保存（暫定）
      if (careerForm.workHistory.length > 0) {
        const workHistoryRecord = {
          user_id: userId,
          qualification_name: '職歴・学歴',
          work_history: careerForm.workHistory,
        };

        const { error: workHistoryError } = await supabase
          .from('user_careers')
          .upsert(workHistoryRecord, { onConflict: 'id' });

        if (workHistoryError) {
          console.error('職歴・学歴保存エラー:', workHistoryError);
          // エラーでも続行
        }
      }

      // 3. usersテーブルに基本情報を更新
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({
          phone: accountForm.email, // 電話番号は別途入力が必要な場合は追加
        })
        .eq('id', userId);

      if (userUpdateError) {
        console.error('ユーザー情報更新エラー:', userUpdateError);
      }

      // 4. staffテーブルにレコードを作成（後方互換性のため）
      if (employmentRecord) {
        const staffData = {
          id: `staff_${userId}_${facilityId}`,
          facility_id: facilityId,
          name: fullName,
          role: invitedRole === '管理者' ? 'マネージャー' : '一般スタッフ',
          type: '常勤',
          user_id: userId,
          birth_date: accountForm.birthDate || null,
          address: careerForm.address || null,
        };

        const { error: staffError } = await supabase
          .from('staff')
          .upsert(staffData, { onConflict: 'id' });

        if (staffError) {
          console.error('スタッフ情報保存エラー:', staffError);
        }
      }

      // 完了画面へ
      setScreen('complete');
    } catch (err: any) {
      setError(err.message || '情報の保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // ステップBの次のステップへ
  const handleNextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // 最後のステップ → 保存処理
      handleCareerSubmit();
    }
  };

  // ステップBの前のステップへ
  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // ログイン処理
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!loginForm.email || !loginForm.password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }

    if (!facilityId) {
      setError('事業所情報が不正です');
      return;
    }

    setLoading(true);
    try {
      // メールアドレスでユーザーを検索
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', loginForm.email)
        .eq('account_status', 'active')
        .single();

      if (userError || !user) {
        throw new Error('メールアドレスまたはパスワードが正しくありません');
      }

      // パスワードを検証
      const { verifyPassword } = await import('@/utils/password');
      const isValid = await verifyPassword(loginForm.password, user.password_hash || '');
      
      if (!isValid) {
        throw new Error('メールアドレスまたはパスワードが正しくありません');
      }

      // 既にこの事業所に所属しているかチェック
      const { data: existingEmployment } = await supabase
        .from('employment_records')
        .select('id')
        .eq('user_id', user.id)
        .eq('facility_id', facilityId)
        .is('end_date', null)
        .single();

      if (existingEmployment) {
        // 既に所属している場合は完了画面へ
        setScreen('complete');
        return;
      }

      // 招待時の雇用情報を取得
      let invitationStartDate = new Date().toISOString().split('T')[0];
      let role = '一般スタッフ';
      let employmentType = '常勤';
      let permissions: UserPermissions = {};

      if (userId) {
        const { data: userInfo } = await supabase
          .from('users')
          .select('invitation_start_date, invitation_role, invitation_employment_type, invitation_permissions')
          .eq('id', userId)
          .single();

        if (userInfo) {
          invitationStartDate = userInfo?.invitation_start_date || invitationStartDate;
          role = userInfo?.invitation_role || role;
          employmentType = userInfo?.invitation_employment_type || employmentType;
          permissions = userInfo?.invitation_permissions || permissions;
        }
      }

      // employment_recordsテーブルに所属関係を作成
      const { error: employmentError } = await supabase
        .from('employment_records')
        .insert({
          user_id: user.id,
          facility_id: facilityId,
          start_date: invitationStartDate,
          role: role,
          employment_type: employmentType,
          permissions: permissions,
          experience_verification_status: 'not_requested',
        });

      if (employmentError) {
        throw new Error(`所属関係作成エラー: ${employmentError.message}`);
      }

      // 完了画面へ
      setScreen('complete');
    } catch (err: any) {
      setError(err.message || 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 既存アカウントチェック
  const checkExistingAccount = async (email: string) => {
    if (!email) return false;

    try {
      const { data: user } = await supabase
        .from('users')
        .select('id, email, account_status')
        .eq('email', email)
        .eq('account_status', 'active')
        .single();

      return !!user;
    } catch {
      return false;
    }
  };

  // 生年月日の年・月・日を生成
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  // エラー表示
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">エラー</h1>
          <p className="text-gray-600">招待リンクが無効です</p>
        </div>
      </div>
    );
  }

  // チェック中画面
  if (screen === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00c4cc] mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">確認中...</h1>
          <p className="text-gray-600">あなたのアカウント情報を確認しています</p>
        </div>
      </div>
    );
  }

  // 年・月・日から日付文字列を生成
  const updateBirthDate = (year: string, month: string, day: string) => {
    setBirthYear(year);
    setBirthMonth(month);
    setBirthDay(day);
    
    if (year && month && day) {
      const monthPadded = month.padStart(2, '0');
      const dayPadded = day.padStart(2, '0');
      setCareerForm(prev => ({ ...prev, birthDate: `${year}-${monthPadded}-${dayPadded}` }));
    } else {
      setCareerForm(prev => ({ ...prev, birthDate: '' }));
    }
  };

  return (
    <div className={`min-h-screen p-4 ${screen === 'register' ? 'bg-gradient-to-br from-[#00c4cc] to-[#00b0b8]' : 'bg-white'}`}>
      {/* 利用規約モーダル */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">利用規約</h2>
              <button
                onClick={() => setShowTermsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="prose prose-sm max-w-none space-y-4 text-sm">
                <p className="text-gray-500 mb-4">最終更新日: 2024年1月1日</p>
                
                <section>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">第1条（適用）</h3>
                  <p className="text-gray-700 leading-relaxed">
                    本規約は、株式会社INU（以下「当社」といいます）が提供する「co-shien」サービス（以下「本サービス」といいます）の利用条件を定めるものです。
                    登録ユーザーの皆さま（以下「ユーザー」といいます）には、本規約に従って、本サービスをご利用いただきます。
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">第2条（利用登録）</h3>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>本サービスにおいては、登録希望者が本規約に同意の上、当社の定める方法によって利用登録を申請し、当社がこれを承認することによって、利用登録が完了するものとします。</li>
                    <li>当社は、利用登録の申請者に以下の事由があると判断した場合、利用登録の申請を承認しないことがあり、その理由については一切の開示義務を負わないものとします。
                      <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                        <li>利用登録の申請に際して虚偽の事項を届け出た場合</li>
                        <li>本規約に違反したことがある者からの申請である場合</li>
                        <li>その他、当社が利用登録を相当でないと判断した場合</li>
                      </ul>
                    </li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">第3条（ユーザーIDおよびパスワードの管理）</h3>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>ユーザーは、自己の責任において、本サービスのユーザーIDおよびパスワードを適切に管理するものとします。</li>
                    <li>ユーザーIDまたはパスワードが第三者に使用されたことによって生じた損害は、当社に故意または重大な過失がある場合を除き、当社は一切の責任を負わないものとします。</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">第4条（禁止事項）</h3>
                  <p className="text-gray-700 leading-relaxed mb-2">ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-700">
                    <li>法令または公序良俗に違反する行為</li>
                    <li>犯罪行為に関連する行為</li>
                    <li>本サービスの内容等、本サービスに含まれる著作権、商標権ほか知的財産権を侵害する行為</li>
                    <li>当社、ほかのユーザー、またはその他第三者のサーバーまたはネットワークの機能を破壊したり、妨害したりする行為</li>
                    <li>本サービスによって得られた情報を商業的に利用する行為</li>
                    <li>当社のサービスの運営を妨害するおそれのある行為</li>
                    <li>不正アクセスをし、またはこれを試みる行為</li>
                    <li>その他、当社が不適切と判断する行為</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">第5条（個人情報の取扱い）</h3>
                  <p className="text-gray-700 leading-relaxed">
                    当社は、本サービスの利用によって取得する個人情報については、当社「プライバシーポリシー」に従い適切に取り扱うものとします。
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">第6条（準拠法・裁判管轄）</h3>
                  <ol className="list-decimal list-inside space-y-2 text-gray-700">
                    <li>本規約の解釈にあたっては、日本法を準拠法とします。</li>
                    <li>本サービスに関して紛争が生じた場合には、当社の本店所在地を管轄する裁判所を専属的合意管轄とします。</li>
                  </ol>
                </section>

                <section className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">以上</p>
                  <p className="text-sm text-gray-600 mt-2">株式会社INU</p>
                </section>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowTermsModal(false)}
                className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-2 px-4 rounded-md transition-colors"
              >
                閉じる
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {/* Welcome画面 */}
          {screen === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-lg shadow-2xl p-8"
            >
              <div className="text-center mb-8">
                <Image
                  src="/logo-cropped-center.png"
                  alt="co-shien"
                  width={200}
                  height={64}
                  className="h-16 w-auto mx-auto mb-4"
                  priority
                />
                <h1 className="text-2xl font-bold text-gray-800 mb-2">
                  pocopocoに招待されました！
                </h1>
                <p className="text-gray-600 text-sm">
                  {facilityName ? `${facilityName}から招待が届いています` : '招待が届いています'}
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={async () => {
                    // 既存アカウントがあるかチェック（メールアドレス入力画面に遷移）
                    setScreen('login');
                  }}
                  className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors"
                >
                  既にアカウントをお持ちの方
                </button>
                <button
                  onClick={() => setScreen('register')}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-md transition-colors"
                >
                  新規アカウントを作成
                </button>
              </div>
            </motion.div>
          )}

          {/* ログイン画面 */}
          {screen === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white rounded-lg shadow-2xl p-8"
            >
              <div className="text-center mb-8">
                <Image
                  src="/logo-cropped-center.png"
                  alt="co-shien"
                  width={200}
                  height={64}
                  className="h-16 w-auto mx-auto mb-4"
                  priority
                />
                <h1 className="text-2xl font-bold text-gray-800 mb-2">
                  ログイン
                </h1>
                <p className="text-gray-600 text-sm">
                  {facilityName}への招待を承認します
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    メールアドレス <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                    placeholder="example@email.com"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    パスワード <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      required
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      placeholder="パスワードを入力"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setScreen('welcome')}
                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-md text-sm transition-colors"
                  >
                    戻る
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-md text-sm transition-colors disabled:opacity-50"
                  >
                    {loading ? 'ログイン中...' : 'ログイン'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* 新規登録画面（アカウント作成フォーム） */}
          {screen === 'register' && (
            <motion.div
              key="screenA"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white rounded-lg shadow-2xl p-8"
            >
              <div className="text-center mb-8">
                <Image
                  src="/logo-cropped-center.png"
                  alt="co-shien"
                  width={200}
                  height={64}
                  className="h-16 w-auto mx-auto mb-4"
                  priority
                />
                <h1 className="text-2xl font-bold text-gray-800 mb-2">
                  アカウントを作成
                </h1>
                <p className="text-gray-600 text-sm">
                  {facilityName}でスタッフとして登録するために、アカウントを作成してください
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </div>
              )}

              <form onSubmit={handleAccountSubmit} className="space-y-6">
                {/* 開発モード: テストデータ一括入力ボタン */}
                {process.env.NEXT_PUBLIC_DEV_MODE === 'true' && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <button
                      type="button"
                      onClick={() => {
                        // テストデータを一括入力
                        const testData = {
                          lastName: '山田',
                          firstName: '太郎',
                          lastNameKana: 'ヤマダ',
                          firstNameKana: 'タロウ',
                          birthDate: '1990-01-01',
                          gender: 'male' as const,
                          email: `test-${Date.now()}@example.com`,
                          password: 'test123',
                          confirmPassword: 'test123',
                          agreedToTerms: true,
                        };
                        setAccountForm(prev => ({ ...prev, ...testData }));
                        setError(''); // エラーをクリア
                      }}
                      className="w-full px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-md text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      テストデータを入力（開発モード）
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      姓 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={accountForm.lastName}
                      onChange={(e) => setAccountForm(prev => ({ ...prev, lastName: e.target.value }))}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                      placeholder="姓を入力"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={accountForm.firstName}
                      onChange={(e) => setAccountForm(prev => ({ ...prev, firstName: e.target.value }))}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                      placeholder="名を入力"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      姓（フリガナ） <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={accountForm.lastNameKana}
                      onChange={(e) => setAccountForm(prev => ({ ...prev, lastNameKana: e.target.value }))}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                      placeholder="セイを入力"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      名（フリガナ） <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={accountForm.firstNameKana}
                      onChange={(e) => setAccountForm(prev => ({ ...prev, firstNameKana: e.target.value }))}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                      placeholder="メイを入力"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    生年月日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={accountForm.birthDate}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, birthDate: e.target.value }))}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    性別 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={accountForm.gender}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, gender: e.target.value as 'male' | 'female' | 'other' }))}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                    disabled={loading}
                  >
                    <option value="">選択してください</option>
                    <option value="male">男性</option>
                    <option value="female">女性</option>
                    <option value="other">その他</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    メールアドレス <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={accountForm.email}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, email: e.target.value }))}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    このメールアドレスがログインIDとして使用されます
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    パスワード <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={accountForm.password}
                      onChange={(e) => setAccountForm(prev => ({ ...prev, password: e.target.value }))}
                      required
                      minLength={6}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      placeholder="6文字以上で入力"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    パスワード（確認） <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={accountForm.confirmPassword}
                      onChange={(e) => setAccountForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      required
                      minLength={6}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      placeholder="パスワードを再入力"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={accountForm.agreedToTerms}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, agreedToTerms: e.target.checked }))}
                    className="mt-1 mr-2"
                    disabled={loading}
                  />
                  <label htmlFor="terms" className="text-sm text-gray-700">
                    <button
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className="text-[#00c4cc] hover:underline"
                    >
                      利用規約
                    </button>
                    に同意します
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setScreen('welcome')}
                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-md text-sm transition-colors"
                  >
                    戻る
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? '作成中...' : 'アカウントを作成して次へ'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* 画面B: キャリア情報入力（ステップフォーム） */}
          {screen === 'B' && (
            <motion.div
              key="screenB"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white rounded-lg shadow-2xl overflow-hidden"
            >
              {/* ヘッダー */}
              <div className="bg-gradient-to-r from-[#00c4cc] to-[#00b0b8] p-6 text-white">
                <h2 className="text-xl font-bold mb-2">あなたのキャリアを登録しましょう</h2>
                <p className="text-sm opacity-90">
                  ここから登録する情報は、別の職場に行ってもあなたの資産として持ち運べます
                </p>
              </div>

              {/* 進捗バー */}
              <div className="px-6 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">
                    ステップ {currentStep + 1} / {steps.length}
                  </span>
                  <span className="text-xs text-gray-500">
                    {Math.round(((currentStep + 1) / steps.length) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <motion.div
                    className="bg-[#00c4cc] h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* エラー表示 */}
              {error && (
                <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </div>
              )}

              {/* ステップコンテンツ */}
              <div className="p-6 min-h-[400px]">
                <AnimatePresence mode="wait">
                  {/* ステップB-1: 住所 */}
                  {currentStep === 0 && (
                    <motion.div
                      key="address"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-[#00c4cc] rounded-full flex items-center justify-center">
                          <MapPin className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">現在のお住まいはどこですか？</h3>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">郵便番号</label>
                        <input
                          type="text"
                          value={careerForm.postalCode}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '');
                            setCareerForm(prev => ({ ...prev, postalCode: value }));
                            if (value.length === 7) {
                              searchAddressByPostalCode(value);
                            }
                          }}
                          placeholder="1234567"
                          maxLength={7}
                          className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">住所</label>
                        <input
                          type="text"
                          value={careerForm.address}
                          onChange={(e) => setCareerForm(prev => ({ ...prev, address: e.target.value }))}
                          placeholder="都道府県市区町村番地"
                          className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* ステップB-2: 資格 */}
                  {currentStep === 1 && (
                    <motion.div
                      key="qualifications"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-[#00c4cc] rounded-full flex items-center justify-center">
                          <Award className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">お持ちの資格を選んでください</h3>
                          <p className="text-sm text-gray-500">複数選択可能です</p>
                        </div>
                      </div>
                      
                      {/* 資格検索 */}
                      <div className="mb-4">
                        <input
                          type="text"
                          value={careerForm.qualificationSearch}
                          onChange={(e) => setCareerForm(prev => ({ ...prev, qualificationSearch: e.target.value }))}
                          placeholder="資格を検索..."
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                        />
                      </div>

                      {/* 資格選択ボタン */}
                      <div className="flex flex-wrap gap-3 mb-4">
                        {QUALIFICATIONS
                          .filter(qual => 
                            qual.toLowerCase().includes(careerForm.qualificationSearch.toLowerCase()) ||
                            careerForm.qualificationSearch === ''
                          )
                          .map((qual) => (
                            <button
                              key={qual}
                              type="button"
                              onClick={() => {
                                setCareerForm(prev => {
                                  const isSelected = prev.qualifications.includes(qual);
                                  
                                  // 「資格無し」が選択された場合、他の資格をすべて削除
                                  if (qual === '資格無し') {
                                    if (isSelected) {
                                      // 既に選択されている場合は削除
                                      return {
                                        ...prev,
                                        qualifications: prev.qualifications.filter(q => q !== '資格無し'),
                                        qualificationCertificates: prev.qualificationCertificates.filter(c => c.qualification !== '資格無し'),
                                      };
                                    } else {
                                      // 新しく選択された場合は他の資格をすべて削除
                                      return {
                                        ...prev,
                                        qualifications: ['資格無し'],
                                        qualificationCertificates: [{ qualification: '資格無し', file: null, url: '' }],
                                      };
                                    }
                                  }
                                  
                                  // その他の資格が選択された場合、「資格無し」を削除
                                  const newQualifications = isSelected
                                    ? prev.qualifications.filter(q => q !== qual)
                                    : [...prev.qualifications.filter(q => q !== '資格無し'), qual];
                                  
                                  return {
                                    ...prev,
                                    qualifications: newQualifications,
                                    // 資格証の配列も更新
                                    qualificationCertificates: isSelected
                                      ? prev.qualificationCertificates.filter(c => c.qualification !== qual)
                                      : [...prev.qualificationCertificates.filter(c => c.qualification !== '資格無し'), { qualification: qual, file: null, url: '' }],
                                  };
                                });
                              }}
                              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                                careerForm.qualifications.includes(qual)
                                  ? 'bg-[#00c4cc] text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {qual}
                            </button>
                          ))}
                      </div>

                      {/* カスタム資格入力 */}
                      <div className="border-t border-gray-200 pt-4">
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                          その他の資格を入力
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={careerForm.customQualification}
                            onChange={(e) => setCareerForm(prev => ({ ...prev, customQualification: e.target.value }))}
                            placeholder="資格名を入力"
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (careerForm.customQualification.trim()) {
                                setCareerForm(prev => {
                                  const newQual = prev.customQualification.trim();
                                  if (prev.qualifications.includes(newQual)) return prev;
                                  return {
                                    ...prev,
                                    qualifications: [...prev.qualifications.filter(q => q !== '資格無し'), newQual],
                                    customQualification: '',
                                    qualificationCertificates: [...prev.qualificationCertificates, { qualification: newQual, file: null, url: '' }],
                                  };
                                });
                              }
                            }}
                            className="px-4 py-2 bg-[#00c4cc] text-white rounded-md hover:bg-[#00b0b8] transition-colors"
                          >
                            追加
                          </button>
                        </div>
                      </div>

                      {/* 選択された資格の表示 */}
                      {careerForm.qualifications.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-bold text-gray-700 mb-2">選択された資格:</p>
                          <div className="flex flex-wrap gap-2">
                            {careerForm.qualifications.map((qual) => (
                              <span
                                key={qual}
                                className="px-3 py-1 bg-[#00c4cc] text-white rounded-full text-sm"
                              >
                                {qual}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ステップB-3: 資格証の写真 */}
                  {currentStep === 2 && (
                    <motion.div
                      key="certificates"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-[#00c4cc] rounded-full flex items-center justify-center">
                          <Camera className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">資格証の写真はありますか？</h3>
                          <p className="text-sm text-gray-500">後から追加することもできます</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {careerForm.qualifications.filter(q => q !== '資格無し').map((qual) => {
                          const certificate = careerForm.qualificationCertificates.find(c => c.qualification === qual);
                          return (
                            <div key={qual} className="border border-gray-200 rounded-lg p-4">
                              <label className="block text-sm font-bold text-gray-700 mb-2">{qual}</label>
                              {certificate?.url ? (
                                <div className="relative">
                                  <Image
                                    src={certificate.url}
                                    alt={qual}
                                    width={400}
                                    height={192}
                                    className="w-full h-48 object-contain border border-gray-300 rounded-md bg-gray-50"
                                    unoptimized
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCareerForm(prev => ({
                                        ...prev,
                                        qualificationCertificates: prev.qualificationCertificates.filter(
                                          c => c.qualification !== qual
                                        ),
                                      }));
                                    }}
                                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                                  <span className="text-sm text-gray-500">画像をアップロード</span>
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        handleQualificationUpload(qual, file);
                                      }
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {careerForm.qualifications.filter(q => q !== '資格無し').length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-8">
                          資格を選択すると、ここにアップロードできます
                        </p>
                      )}
                    </motion.div>
                  )}

                  {/* ステップB-4: 職歴・学歴 */}
                  {currentStep === 3 && (
                    <motion.div
                      key="workHistory"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-[#00c4cc] rounded-full flex items-center justify-center">
                          <Briefcase className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">職歴・学歴を入力してください</h3>
                          <p className="text-sm text-gray-500">過去の職歴や学歴をすべて記載できます</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {careerForm.workHistory.map((history, index) => (
                          <div key={history.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-700">
                                  {history.type === 'employment' ? '職歴' : '学歴'}
                                </span>
                                <span className="text-xs text-gray-500">#{index + 1}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setCareerForm(prev => ({
                                    ...prev,
                                    workHistory: prev.workHistory.filter(h => h.id !== history.id),
                                  }));
                                }}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">
                                {history.type === 'employment' ? '勤務先・事業所名' : '学校名'}
                              </label>
                              <input
                                type="text"
                                value={history.organization}
                                onChange={(e) => {
                                  setCareerForm(prev => ({
                                    ...prev,
                                    workHistory: prev.workHistory.map(h =>
                                      h.id === history.id ? { ...h, organization: e.target.value } : h
                                    ),
                                  }));
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                                placeholder={history.type === 'employment' ? '事業所名を入力' : '学校名を入力'}
                              />
                            </div>

                            {history.type === 'employment' && (
                              <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">役職・職種</label>
                                <input
                                  type="text"
                                  value={history.position || ''}
                                  onChange={(e) => {
                                    setCareerForm(prev => ({
                                      ...prev,
                                      workHistory: prev.workHistory.map(h =>
                                        h.id === history.id ? { ...h, position: e.target.value } : h
                                      ),
                                    }));
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                                  placeholder="役職・職種を入力"
                                />
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">開始年月</label>
                                <input
                                  type="month"
                                  value={history.startDate}
                                  onChange={(e) => {
                                    setCareerForm(prev => ({
                                      ...prev,
                                      workHistory: prev.workHistory.map(h =>
                                        h.id === history.id ? { ...h, startDate: e.target.value } : h
                                      ),
                                    }));
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">終了年月</label>
                                <input
                                  type="month"
                                  value={history.endDate}
                                  onChange={(e) => {
                                    setCareerForm(prev => ({
                                      ...prev,
                                      workHistory: prev.workHistory.map(h =>
                                        h.id === history.id ? { ...h, endDate: e.target.value } : h
                                      ),
                                    }));
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">詳細・備考</label>
                              <textarea
                                value={history.description}
                                onChange={(e) => {
                                  setCareerForm(prev => ({
                                    ...prev,
                                    workHistory: prev.workHistory.map(h =>
                                      h.id === history.id ? { ...h, description: e.target.value } : h
                                    ),
                                  }));
                                }}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                                placeholder="詳細や備考を入力（任意）"
                              />
                            </div>
                          </div>
                        ))}

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const newId = `work_${Date.now()}`;
                              setCareerForm(prev => ({
                                ...prev,
                                workHistory: [...prev.workHistory, {
                                  id: newId,
                                  type: 'employment',
                                  organization: '',
                                  position: '',
                                  startDate: '',
                                  endDate: '',
                                  description: '',
                                }],
                              }));
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            職歴を追加
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const newId = `edu_${Date.now()}`;
                              setCareerForm(prev => ({
                                ...prev,
                                workHistory: [...prev.workHistory, {
                                  id: newId,
                                  type: 'education',
                                  organization: '',
                                  startDate: '',
                                  endDate: '',
                                  description: '',
                                }],
                              }));
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            学歴を追加
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* フッター（ナビゲーションボタン） */}
              <div className="border-t border-gray-200 p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    disabled={currentStep === 0}
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    戻る
                  </button>
                  <div className="flex gap-2">
                    {/* 「後で入力する」ボタンを表示 */}
                    {(
                      <button
                        type="button"
                        onClick={handleNextStep}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        後で入力する
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleNextStep}
                      disabled={loading}
                      className="flex items-center gap-2 px-4 py-2 bg-[#00c4cc] text-white rounded-md hover:bg-[#00b0b8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {currentStep === steps.length - 1 ? '完了' : '次へ'}
                      {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 完了画面 */}
          {screen === 'complete' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-lg shadow-2xl p-8 text-center"
            >
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-800 mb-2">登録完了！</h1>
              <p className="text-gray-600 mb-6">
                {facilityName}との連携を開始しました
              </p>
              <button
                onClick={() => router.push('/staff-dashboard')}
                className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors"
              >
                ダッシュボードへ
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8]">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00c4cc] mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    }>
      <ActivatePageContent />
    </Suspense>
  );
}
