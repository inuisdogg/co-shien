/**
 * 初期管理者アカウント作成ページ
 * 施設がまだ登録されていない場合に、最初の管理者アカウントを作成します
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { hashPassword } from '@/utils/password';
import { useAuth } from '@/contexts/AuthContext';

// 静的生成をスキップ（useAuthを使用するため）
export const dynamic = 'force-dynamic';

export default function AdminSetupPage() {
  const { user, isAuthenticated, facility, login } = useAuth();
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [facilityName, setFacilityName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true); // デフォルトで表示
  const [showConfirmPassword, setShowConfirmPassword] = useState(true); // デフォルトで表示
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [setupData, setSetupData] = useState<{ facilityCode: string; email: string; password?: string } | null>(null);
  const [existingUserId, setExistingUserId] = useState<string | null>(null); // 既存ユーザーのID
  const [hasExistingPassword, setHasExistingPassword] = useState(false); // 既にパスワードが設定されているか

  // ログイン済みかどうか（Personal側でログインしている場合）
  const isLoggedInAsPersonal = isAuthenticated && user && !facility;

  // ログイン済みの場合、ユーザー情報を設定
  useEffect(() => {
    if (isAuthenticated && user && !facility) {
      // Personal側でログイン済みの場合
      setAdminName(user.name || '');
      setAdminEmail(user.email || '');
    }
  }, [isAuthenticated, user, facility]);

  // メール認証状態を確認し、Supabase Authセッションからユーザー情報を取得
  useEffect(() => {
    const checkEmailConfirmation = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // Supabase Authを使用している場合、メール認証が完了しているか確認
        if (session?.user && !session.user.email_confirmed_at) {
          // メール認証が完了していない場合、サインアップページにリダイレクト
          router.push('/signup?waiting=true');
          return;
        }
        
        // Supabase Authのセッションがある場合、ユーザー情報を自動入力
        if (session?.user) {
          const userEmail = session.user.email || '';
          const userName = session.user.user_metadata?.name || userEmail.split('@')[0];
          
          // 既にusersテーブルにユーザーが存在するか確認
          const { data: existingUser } = await supabase
            .from('users')
            .select('id, name, email, password_hash')
            .eq('email', userEmail)
            .maybeSingle();
          
          if (existingUser) {
            // 既存ユーザーの場合、情報を自動入力
            setAdminName(existingUser.name || userName);
            setAdminEmail(existingUser.email || userEmail);
            setExistingUserId(existingUser.id);
            // パスワードが既に設定されている場合は、パスワード入力不要
            if (existingUser.password_hash) {
              setHasExistingPassword(true);
            }
          } else {
            // 新規ユーザーの場合でも、セッション情報から自動入力
            setAdminName(userName);
            setAdminEmail(userEmail);
            // Supabase AuthのユーザーIDを使用
            setExistingUserId(session.user.id);
          }
        }
        
        setCheckingAuth(false);
      } catch (error) {
        console.error('認証確認エラー:', error);
        setCheckingAuth(false);
      }
    };

    checkEmailConfirmation();
  }, [router]);

  // セットアップ完了後、自動的にログイン処理を実行
  useEffect(() => {
    if (success && setupData) {
      const autoLogin = async () => {
        // 新規ユーザーの場合、自動的にBiz側にログイン
        // isLoggedInAsPersonalがfalseで、passwordが存在する場合のみ新規ユーザーとして扱う
        if (!isLoggedInAsPersonal && setupData.password && setupData.facilityCode) {
          try {
            console.log('自動ログイン開始:', { facilityCode: setupData.facilityCode, email: setupData.email });
            // Biz側のログイン（facilityCodeを指定）
            await login(setupData.facilityCode, setupData.email, setupData.password);
            console.log('自動ログイン成功');
            // ログイン成功後、Biz側ダッシュボードに遷移
            router.push('/');
          } catch (loginError: any) {
            // ログインエラーは無視（成功画面は表示するが、手動ログインを促す）
            console.error('自動ログインに失敗しました:', loginError);
            setError('自動ログインに失敗しました。手動でログインしてください。');
          }
        } else if (isLoggedInAsPersonal && user && setupData.facilityCode) {
          // 既存ユーザー（Personal側でログイン済み）の場合、施設情報を取得してlocalStorageに保存し、ページをリロード
          try {
            console.log('既存ユーザーの施設情報取得開始:', { facilityCode: setupData.facilityCode });
            // 施設コードから施設情報を取得
            const { data: facilityData, error: facilityError } = await supabase
              .from('facilities')
              .select('*')
              .eq('code', setupData.facilityCode)
              .single();

            if (facilityError || !facilityData) {
              throw new Error('施設情報の取得に失敗しました');
            }

            // 施設設定から施設名を取得
            const { data: facilitySettings } = await supabase
              .from('facility_settings')
              .select('facility_name')
              .eq('facility_id', facilityData.id)
              .single();

            const facilityInfo = {
              id: facilityData.id,
              name: facilitySettings?.facility_name || facilityData.name,
              code: facilityData.code || facilityData.id,
              createdAt: facilityData.created_at,
              updatedAt: facilityData.updated_at,
            };

            // 施設情報をlocalStorageに保存
            localStorage.setItem('facility', JSON.stringify(facilityInfo));
            
            // ユーザー情報のfacility_idを更新
            const updatedUser = {
              ...user,
              facilityId: facilityData.id,
            };
            localStorage.setItem('user', JSON.stringify(updatedUser));

            console.log('施設情報を保存しました。ページをリロードします。');
            // ページをリロードしてAuthContextに施設情報を反映（Biz側ダッシュボードへ）
            window.location.href = '/';
          } catch (error: any) {
            console.error('施設情報の取得に失敗しました:', error);
            setError('施設情報の取得に失敗しました。手動でログインしてください。');
          }
        } else {
          console.log('自動ログインをスキップ:', { isLoggedInAsPersonal, hasPassword: !!setupData.password, hasFacilityCode: !!setupData.facilityCode });
        }
      };

      // 少し待ってから自動ログインを実行（成功画面を表示するため）
      const timer = setTimeout(() => {
        autoLogin();
      }, 1500); // 1.5秒後に自動ログイン（施設IDを確認する時間を確保）

      return () => clearTimeout(timer);
    }
  }, [success, setupData, isLoggedInAsPersonal, login, router, user]);

  // 認証確認中はローディング表示
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00c4cc] mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">確認中...</h2>
          <p className="text-gray-600">認証状態を確認しています</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // バリデーション
      if (!facilityName.trim()) {
        throw new Error('施設名を入力してください');
      }

      // 既存ユーザーの場合（ログイン済み or Supabase Authセッションあり）は、管理者アカウント情報のバリデーションをスキップ
      const isExistingUser = isLoggedInAsPersonal || existingUserId;
      
      if (!isExistingUser) {
        // 新規ユーザー作成の場合のみバリデーション
        if (!adminName.trim()) {
          throw new Error('管理者名を入力してください');
        }
        if (!adminEmail.trim()) {
          throw new Error('メールアドレスを入力してください');
        }
        // メールアドレスの形式チェック
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(adminEmail.trim())) {
          throw new Error('正しいメールアドレスを入力してください');
        }
        if (!password) {
          throw new Error('パスワードを入力してください');
        }
        if (password.length < 6) {
          throw new Error('パスワードは6文字以上で入力してください');
        }
        if (password !== confirmPassword) {
          throw new Error('パスワードが一致しません');
        }
      }

      // 施設コードを自動発番（5桁のランダムな番号、重複チェック付き）
      let facilityCode: string = '';
      let isUnique = false;
      do {
        facilityCode = Math.floor(10000 + Math.random() * 90000).toString().padStart(5, '0');
        // 重複チェック
        const { data: existingFacility } = await supabase
          .from('facilities')
          .select('id')
          .eq('code', facilityCode)
          .single();
        if (!existingFacility) {
          isUnique = true;
        }
      } while (!isUnique);
      
      // 施設IDを生成
      const timestamp = Date.now();
      const facilityId = `facility-${timestamp}`;
      
      // 既存ユーザーの場合、既存のuser_idを使用
      // 新規ユーザーの場合、新しいadminIdを生成
      const adminId = existingUserId || (isLoggedInAsPersonal && user ? user.id : `admin-${facilityId}`);
      const finalAdminName = (isLoggedInAsPersonal && user ? user.name : null) || adminName.trim();
      const finalAdminEmail = (isLoggedInAsPersonal && user ? user.email : null) || adminEmail.trim();

      // 新規ユーザー作成の場合のみパスワードをハッシュ化
      let passwordHash: string | undefined;
      if (!isExistingUser && password) {
        passwordHash = await hashPassword(password);
      }

      // 施設を作成
      const { error: facilityError } = await supabase
        .from('facilities')
        .insert({
          id: facilityId,
          name: facilityName.trim(),
          code: facilityCode,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (facilityError) {
        throw new Error(`施設の作成に失敗しました: ${facilityError.message}`);
      }

      // ============================================
      // 管理者アカウントの作成（1つのID・2つの役割）
      // ============================================
      // 管理者は「施設オーナー（Biz権限）」と「一人のスタッフ（Personal権限）」の
      // 両方の顔を持ちます。
      // - 新規ユーザーの場合: Personal用のアカウントを自動生成
      // - 既存ユーザーの場合: 既存のアカウントにBiz側の所属記録を追加
      //
      // 【将来的な離職時の設計】
      // 管理者が離職した場合：
      // 1. usersテーブル: 個人アカウントとして残る（削除しない）
      // 2. employment_recordsテーブル: end_dateを設定して所属関係を終了
      // 3. staffテーブル: 削除または非アクティブ化（事業所固有の情報のため）
      // これにより、離職後も個人アカウントとしてログイン可能で、
      // 他の事業所への所属やキャリア管理が可能
      // ============================================
      
      // 1. Personal用のアカウント処理（usersテーブル）
      // 管理者は必ずusersテーブルに存在する必要がある（個人アカウントとして）
      if (!isExistingUser) {
        // 新規ユーザー作成の場合: Personal用のアカウントを作成（usersテーブル）
        //    - account_status='active'で有効化済み
        //    - 初期ログイン時にパスワード設定も完了しているため、すぐに利用可能
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: adminId,
            facility_id: facilityId, // 後方互換性のため保持（将来的には削除予定）
            name: finalAdminName,
            login_id: finalAdminEmail, // メールアドレスをログインIDとしても使用
            email: finalAdminEmail,
            role: 'admin',
            password_hash: passwordHash,
            has_account: true,
            account_status: 'active', // パーソナルアカウントとして有効化
            activated_at: new Date().toISOString(), // アクティベーション日時を設定
            permissions: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (userError) {
          console.error('usersテーブルへの挿入エラー:', userError);
          // 施設を削除（ロールバック）
          await supabase.from('facilities').delete().eq('id', facilityId);
          throw new Error(`管理者アカウント（usersテーブル）の作成に失敗しました: ${userError.message}`);
        }
        
        // 挿入が成功したことを確認
        const { data: insertedUser, error: verifyError } = await supabase
          .from('users')
          .select('id')
          .eq('id', adminId)
          .single();
        
        if (verifyError || !insertedUser) {
          console.error('usersテーブルへの挿入確認エラー:', verifyError);
          await supabase.from('facilities').delete().eq('id', facilityId);
          throw new Error(`管理者アカウント（usersテーブル）の作成確認に失敗しました`);
        }
      } else {
        // 既存ユーザーの場合: usersテーブルが存在することを確認し、roleをadminに更新
        const { data: existingUserCheck, error: checkError } = await supabase
          .from('users')
          .select('id')
          .eq('id', adminId)
          .single();
        
        if (checkError || !existingUserCheck) {
          console.error('既存ユーザーの確認エラー:', checkError);
          await supabase.from('facilities').delete().eq('id', facilityId);
          throw new Error(`既存のユーザーアカウントが見つかりません: ${checkError?.message || 'ユーザーが存在しません'}`);
        }
        
        // 既存ユーザーの情報を更新（roleをadminに、facility_idも更新）
        const updateData: any = {
          role: 'admin',
          updated_at: new Date().toISOString(),
        };
        
        // facility_idも更新（後方互換性のため）
        if (facilityId) {
          updateData.facility_id = facilityId;
        }
        
        const { error: userUpdateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', adminId);

        if (userUpdateError) {
          console.error('usersテーブルの更新エラー:', userUpdateError);
          // 施設を削除（ロールバック）
          await supabase.from('facilities').delete().eq('id', facilityId);
          throw new Error(`管理者アカウント（usersテーブル）の更新に失敗しました: ${userUpdateError.message}`);
        }
      }

      // 2. Biz側の所属記録を作成（employment_recordsテーブル）
      //    - 管理者が「施設Aに所属するスタッフ」としてのデータ
      //    - role='管理者'で設定
      //    - これにより、管理者が自分自身を「Biz側のスタッフ一覧」から見ることができる
      const employmentRecordId = `emp-${adminId}`;
      const { error: employmentError } = await supabase
        .from('employment_records')
        .insert({
          id: employmentRecordId,
          user_id: adminId,
          facility_id: facilityId,
          start_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD形式
          end_date: null, // 現在も在籍中
          role: '管理者',
          employment_type: '常勤', // デフォルト値（後で変更可能）
          permissions: {},
          experience_verification_status: 'not_requested',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (employmentError) {
        // ロールバック: ユーザーと施設を削除
        await supabase.from('users').delete().eq('id', adminId);
        await supabase.from('facilities').delete().eq('id', facilityId);
        throw new Error(`管理者の所属記録の作成に失敗しました: ${employmentError.message}`);
      }

      // 3. 管理者のスタッフレコードを作成（staffテーブル - 後方互換性のため）
      //    - 既存のシステムとの互換性を保つため
      //    - user_idでusersテーブルと紐付け
      //    - 注意: staffテーブルは事業所固有の情報のため、離職時は削除される
      //      ただし、usersテーブルとemployment_recordsテーブルは残る
      const staffId = `staff-${adminId}`;
      const { error: staffError } = await supabase
        .from('staff')
        .insert({
          id: staffId,
          facility_id: facilityId,
          name: finalAdminName,
          role: '管理者',
          type: '常勤', // デフォルト値（後で変更可能）
          user_id: adminId, // usersテーブルへの参照
          email: finalAdminEmail,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (staffError) {
        // ロールバック: employment_records, users, facilitiesを削除
        await supabase.from('employment_records').delete().eq('id', employmentRecordId);
        await supabase.from('users').delete().eq('id', adminId);
        await supabase.from('facilities').delete().eq('id', facilityId);
        throw new Error(`管理者のスタッフレコードの作成に失敗しました: ${staffError.message}`);
      }

      // 施設設定を作成
      const { error: settingsError } = await supabase
        .from('facility_settings')
        .insert({
          facility_id: facilityId,
          facility_name: facilityName.trim(),
          regular_holidays: [0], // 日曜日を定休日
          custom_holidays: [],
          business_hours: {
            AM: { start: '09:00', end: '12:00' },
            PM: { start: '13:00', end: '18:00' },
          },
          capacity: {
            AM: 10,
            PM: 10,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (settingsError) {
        console.error('施設設定の作成エラー（無視）:', settingsError);
        // 施設設定のエラーは無視（後で設定可能）
      }

      // 施設IDとログイン情報を保存（成功画面で表示するため）
      const setupInfo = {
        facilityCode,
        email: finalAdminEmail,
        password: !isLoggedInAsPersonal ? password : undefined, // 新規ユーザーの場合のみ
      };
      setSetupData(setupInfo);
      setSuccess(true);
      // 施設コードとログイン情報をlocalStorageに一時保存（ログインページで使用）
      localStorage.setItem('newFacilitySetup', JSON.stringify({
        ...setupInfo,
        savedAt: new Date().toISOString(),
      }));
    } catch (err: any) {
      setError(err.message || '初期設定に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (success && setupData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">初期設定が完了しました</h2>
            <p className="text-gray-600 text-sm mb-6">
              {setupData.password 
                ? '自動的にログインします...' 
                : '施設情報を読み込み中...'}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-6 space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">施設ID</label>
              <div className="flex items-center justify-between bg-white border-2 border-[#00c4cc] rounded-md px-4 py-3">
                <code className="text-lg font-bold text-[#00c4cc] tracking-wider">{setupData.facilityCode}</code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(setupData.facilityCode);
                    alert('施設IDをクリップボードにコピーしました');
                  }}
                  className="ml-2 text-[#00c4cc] hover:text-[#00b0b8]"
                  title="コピー"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">※ この施設IDは大切に保管してください</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">メールアドレス</label>
              <div className="bg-white border border-gray-300 rounded-md px-4 py-3">
                <span className="text-gray-800">{setupData.email}</span>
              </div>
            </div>

            {setupData.password && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">パスワード</label>
                <div className="bg-white border border-gray-300 rounded-md px-4 py-3">
                  <span className="text-gray-800">設定したパスワード</span>
                </div>
              </div>
            )}

            {!setupData.password && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-xs text-blue-800">
                  ※ 既にログインしているアカウントを使用しています。既存のパスワードでログインしてください。
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                // Biz側のログインページに遷移（施設IDとメールアドレスをクエリパラメータで渡す）
                router.push(`/?facilityCode=${setupData.facilityCode}&email=${encodeURIComponent(setupData.email)}`);
              }}
              className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors"
            >
              Biz側にログインする
            </button>
            <button
              type="button"
              onClick={() => {
                // Personal側のトップページ（ログイン画面）に遷移
                window.location.href = 'https://my.co-shien.inu.co.jp/';
              }}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-md transition-colors text-sm"
            >
              Personal側にログインする
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl p-8">
        <div className="text-center mb-8">
          <Image
            src="/logo-cropped-center.png"
            alt="co-shien"
            width={200}
            height={64}
            className="h-16 w-auto mx-auto mb-4"
            priority
          />
          <h1 className="text-2xl font-bold text-gray-800">施設の初回セットアップ</h1>
          <p className="text-gray-600 text-sm mt-2">
            {isLoggedInAsPersonal 
              ? '新しく施設を登録して、Bizモードを有効化します'
              : '施設と管理者アカウントを新規登録します'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* ログイン済みの場合、現在のアカウント情報を表示 */}
          {(isLoggedInAsPersonal || existingUserId) && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md">
              <p className="font-bold mb-1">管理者として登録するアカウント</p>
              <p className="text-sm">
                管理者：<span className="font-semibold">{adminName || user?.name}</span>（{adminEmail || user?.email}）
              </p>
              <p className="text-xs mt-2 text-green-700">
                ※ このアカウントで施設管理者として登録されます。個人のキャリア情報は引き続き管理できます。
              </p>
              {hasExistingPassword && (
                <p className="text-xs mt-1 text-green-700">
                  ※ パスワードは既に設定済みです。施設名のみ入力してください。
                </p>
              )}
            </div>
          )}

          <div className="space-y-4">
            <h3 className="font-bold text-gray-700 border-b border-gray-200 pb-2">施設情報</h3>
            
            <div>
              <label htmlFor="facilityName" className="block text-sm font-bold text-gray-700 mb-2">
                施設名 <span className="text-red-500">*</span>
              </label>
              <input
                id="facilityName"
                type="text"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                placeholder="施設名を入力"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">※ 施設名は後で変更できます。施設コードは自動発番されます。</p>
            </div>
          </div>

          {/* ログイン済み or 既存ユーザーの場合は管理者アカウント情報セクションを非表示 */}
          {!isLoggedInAsPersonal && !existingUserId && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-700 border-b border-gray-200 pb-2">管理者アカウント情報</h3>
              
              {!existingUserId && (
                <>
                  <div>
                    <label htmlFor="adminName" className="block text-sm font-bold text-gray-700 mb-2">
                      管理者名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="adminName"
                      type="text"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                      placeholder="山田 太郎"
                      disabled={loading}
                    />
                    <p className="text-xs text-gray-400 mt-1">※ 本名を入力してください</p>
                  </div>

                  <div>
                    <label htmlFor="adminEmail" className="block text-sm font-bold text-gray-700 mb-2">
                      メールアドレス <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="adminEmail"
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                      placeholder="メールアドレスを入力（例: admin@example.com）"
                      disabled={loading}
                    />
                    <p className="text-xs text-gray-500 mt-1">※ ログイン時に使用するメールアドレスです</p>
                  </div>
                </>
              )}

              {!hasExistingPassword && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-2">
                      パスワード <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                        placeholder="6文字以上"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        disabled={loading}
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
                    <label htmlFor="confirmPassword" className="block text-sm font-bold text-gray-700 mb-2">
                      パスワード（確認） <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent"
                        placeholder="パスワードを再入力"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        disabled={loading}
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
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '作成中...' : '初期設定を完了する'}
          </button>
        </form>
      </div>
    </div>
  );
}

