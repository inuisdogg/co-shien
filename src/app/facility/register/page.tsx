/**
 * 施設登録ページ
 * 管理者として新しい施設を登録する
 * - トークンがある場合: 事前登録された施設の作成を完了
 * - トークンがない場合: 通常の施設登録
 * - 事業所番号（10桁）必須
 * - 指定通知書の画像アップロード必須
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Upload, X, Building2, FileText, AlertCircle } from 'lucide-react';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

interface UserInfo {
  id: string;
  name: string;
  email: string;
}

export default function FacilityRegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPreRegistered, setIsPreRegistered] = useState(false);
  const [preRegisteredFacilityId, setPreRegisteredFacilityId] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(true);

  // フォーム状態
  const [facilityName, setFacilityName] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  const [designationFile, setDesignationFile] = useState<File | null>(null);
  const [designationPreview, setDesignationPreview] = useState<string | null>(null);

  // トークンを検証
  useEffect(() => {
    const validateToken = async () => {
      const token = searchParams?.get('token');
      if (!token) {
        setLoadingToken(false);
        return;
      }

      try {
        // 1. まず新しいplatform_invitation_tokensテーブルをチェック
        const { data: platformToken, error: platformError } = await supabase
          .from('platform_invitation_tokens')
          .select('id, expires_at, used_at')
          .eq('token', token)
          .maybeSingle();

        if (platformToken) {
          // 有効期限チェック
          if (new Date(platformToken.expires_at) < new Date()) {
            setError('トークンの有効期限が切れています');
            setLoadingToken(false);
            return;
          }

          // 使用済みチェック
          if (platformToken.used_at) {
            setError('このトークンは既に使用されています');
            setLoadingToken(false);
            return;
          }

          // 新しいトークンの場合は事前登録なし（ユーザーが施設情報を入力）
          setIsPreRegistered(false);
          setLoadingToken(false);
          return;
        }

        // 2. 旧facility_registration_tokensテーブルをチェック（後方互換性）
        const { data: tokenData, error: tokenError } = await supabase
          .from('facility_registration_tokens')
          .select('facility_id, expires_at, used_at')
          .eq('token', token)
          .maybeSingle();

        if (tokenError || !tokenData) {
          setError('無効なトークンです');
          setLoadingToken(false);
          return;
        }

        // 有効期限チェック
        if (new Date(tokenData.expires_at) < new Date()) {
          setError('トークンの有効期限が切れています');
          setLoadingToken(false);
          return;
        }

        // 使用済みチェック
        if (tokenData.used_at) {
          setError('このトークンは既に使用されています');
          setLoadingToken(false);
          return;
        }

        // 事前登録された施設情報を取得
        const { data: facilityData, error: facilityError } = await supabase
          .from('facilities')
          .select('id, name, pre_registered')
          .eq('id', tokenData.facility_id)
          .eq('pre_registered', true)
          .single();

        if (facilityError || !facilityData) {
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

  // ユーザー情報を取得
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      router.push('/career/login');
      return;
    }
    setUser(JSON.parse(userStr));
  }, [router]);

  // ファイル選択処理
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイルサイズチェック（5MB以下）
    if (file.size > 5 * 1024 * 1024) {
      setError('ファイルサイズは5MB以下にしてください');
      return;
    }

    // ファイル形式チェック
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError('画像ファイル（JPG, PNG）またはPDFをアップロードしてください');
      return;
    }

    setDesignationFile(file);
    setError('');

    // プレビュー生成（画像の場合のみ）
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setDesignationPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setDesignationPreview(null);
    }
  };

  // ファイル削除
  const removeFile = () => {
    setDesignationFile(null);
    setDesignationPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 施設登録処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setLoading(true);

    try {
      // バリデーション
      if (!facilityName.trim()) {
        throw new Error('施設名を入力してください');
      }

      // 事業所番号が入力された場合のみバリデーション
      if (businessNumber && !businessNumber.match(/^\d{10}$/)) {
        throw new Error('事業所番号は10桁の数字で入力してください');
      }

      // 事業所番号の重複チェック（入力された場合のみ）
      if (businessNumber) {
        const { data: existingFacility } = await supabase
          .from('facilities')
          .select('id')
          .eq('business_number', businessNumber)
          .single();

        if (existingFacility) {
          throw new Error('この事業所番号は既に登録されています');
        }
      }

      let facilityId: string;
      let newFacilityCode: string;

      if (isPreRegistered && preRegisteredFacilityId) {
        // 事前登録された施設の場合
        facilityId = preRegisteredFacilityId;

        // 施設コードを自動発番（5桁）
        let isUnique = false;
        do {
          newFacilityCode = Math.floor(10000 + Math.random() * 90000).toString();
          const { data: existing } = await supabase
            .from('facilities')
            .select('id')
            .eq('code', newFacilityCode)
            .single();
          if (!existing) {
            isUnique = true;
          }
        } while (!isUnique);

        // 指定通知書のアップロード（アップロードされた場合のみ）
        let fileName: string | null = null;
        if (designationFile) {
          const fileExt = designationFile.name.split('.').pop();
          fileName = `${facilityId}/designation.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('facility-documents')
            .upload(fileName, designationFile);

          if (uploadError) {
            console.error('Upload error:', uploadError);
            // ストレージがない場合はスキップ（開発環境用）
          }
        }

        // 施設を更新（事前登録から通常登録へ）
        const updateData: any = {
          name: facilityName.trim(),
          code: newFacilityCode,
          verification_status: 'unverified',
          pre_registered: false,
          updated_at: new Date().toISOString(),
        };

        // 事業所番号と指定通知書は入力された場合のみ更新
        if (businessNumber && businessNumber.match(/^\d{10}$/)) {
          updateData.business_number = businessNumber;
        }
        if (fileName) {
          updateData.designation_document_path = fileName;
        }

        const { error: facilityError } = await supabase
          .from('facilities')
          .update(updateData)
          .eq('id', facilityId);

        if (facilityError) {
          throw new Error(`施設の更新に失敗しました: ${facilityError.message}`);
        }
      } else {
        // 通常の施設登録
        // 施設コードを自動発番（5桁）
        let isUnique = false;
        do {
          newFacilityCode = Math.floor(10000 + Math.random() * 90000).toString();
          const { data: existing } = await supabase
            .from('facilities')
            .select('id')
            .eq('code', newFacilityCode)
            .single();
          if (!existing) {
            isUnique = true;
          }
        } while (!isUnique);

        // 施設IDを生成
        const timestamp = Date.now();
        facilityId = `facility-${timestamp}`;

        // 指定通知書をSupabase Storageにアップロード（ファイルがある場合のみ）
        let fileName: string | undefined;
        if (designationFile) {
          const fileExt = designationFile.name.split('.').pop();
          fileName = `${facilityId}/designation.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('facility-documents')
            .upload(fileName, designationFile);

          if (uploadError) {
            console.error('Upload error:', uploadError);
            // ストレージがない場合はスキップ（開発環境用）
          }
        }

        // 施設を作成
        const { error: facilityError } = await supabase
          .from('facilities')
          .insert({
            id: facilityId,
            name: facilityName.trim(),
            code: newFacilityCode,
            business_number: businessNumber || null,
            designation_document_path: fileName || null,
            verification_status: 'unverified',
            pre_registered: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (facilityError) {
          throw new Error(`施設の作成に失敗しました: ${facilityError.message}`);
        }
      }

      // 施設設定を作成（存在しない場合のみ）
      const { data: existingSettings } = await supabase
        .from('facility_settings')
        .select('id')
        .eq('facility_id', facilityId)
        .single();

      if (!existingSettings) {
        await supabase
          .from('facility_settings')
          .insert({
            facility_id: facilityId,
            facility_name: facilityName.trim(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
      } else {
        // 既存の設定を更新
        await supabase
          .from('facility_settings')
          .update({
            facility_name: facilityName.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('facility_id', facilityId);
      }

      // employment_recordsに管理者として登録
      const { error: empError } = await supabase
        .from('employment_records')
        .insert({
          id: `emp-${user.id}-${facilityId}`,
          user_id: user.id,
          facility_id: facilityId,
          start_date: new Date().toISOString().split('T')[0],
          role: '管理者',
          employment_type: '常勤',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (empError) {
        console.error('Employment record error:', empError);
      }

      // 施設情報を取得してlocalStorageに保存
      const { data: facilityData, error: facilityDataError } = await supabase
        .from('facilities')
        .select('id, name, code, created_at, updated_at')
        .eq('id', facilityId)
        .single();

      if (facilityData && !facilityDataError) {
        const { data: facilitySettings } = await supabase
          .from('facility_settings')
          .select('facility_name')
          .eq('facility_id', facilityId)
          .single();

        const facilityInfo = {
          id: facilityData.id,
          name: facilitySettings?.facility_name || facilityData.name,
          code: facilityData.code || facilityData.id,
          createdAt: facilityData.created_at || new Date().toISOString(),
          updatedAt: facilityData.updated_at || new Date().toISOString(),
        };

        localStorage.setItem('selectedFacility', JSON.stringify(facilityInfo));
        
        // ユーザー情報も更新
        const updatedUser = {
          ...user,
          facilityId: facilityData.id,
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));

        // トークンを使用済みにする（トークン経由の場合）
        const token = searchParams?.get('token');
        if (token) {
          // 新しいplatform_invitation_tokensテーブル
          await supabase
            .from('platform_invitation_tokens')
            .update({
              used_at: new Date().toISOString(),
              used_by_facility_id: facilityId,
            })
            .eq('token', token);

          // 旧facility_registration_tokensテーブル（後方互換性）
          if (isPreRegistered && preRegisteredFacilityId) {
            await supabase
              .from('facility_registration_tokens')
              .update({ used_at: new Date().toISOString() })
              .eq('token', token);
          }
        }

        // Bizダッシュボードに直接リダイレクト（完了画面を表示しない）
        window.location.href = `/business?facilityId=${facilityId}`;
      } else {
        // 施設情報が取得できない場合はエラー
        console.error('施設情報の取得に失敗:', facilityDataError);
        throw new Error('施設情報の取得に失敗しました');
      }
    } catch (err: any) {
      setError(err.message || '施設登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (loadingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00c4cc] mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">読み込み中...</h2>
          <p className="text-gray-600 text-sm">トークンを確認しています</p>
        </div>
      </div>
    );
  }

  // ローディング中（登録処理中）の表示
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00c4cc] mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">登録中...</h2>
          <p className="text-gray-600 text-sm">施設を登録しています</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] p-4">
      <div className="max-w-lg mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <button
            onClick={() => router.push('/portal')}
            className="text-white/80 hover:text-white text-sm"
          >
            ← 戻る
          </button>
          <Image
            src="/logo-white.svg"
            alt="Roots"
            width={100}
            height={32}
            className="h-6 w-auto"
          />
          <div className="w-12"></div>
        </div>

        {/* メインカード */}
        <div className="bg-white rounded-lg shadow-2xl p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-[#00c4cc]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7 text-[#00c4cc]" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">
              {isPreRegistered ? '施設登録を完了' : '施設を新規登録'}
            </h1>
            <p className="text-gray-600 text-sm mt-2">
              {isPreRegistered 
                ? '事前登録された施設の登録を完了します'
                : '管理者として新しい施設を登録します'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-6 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 施設名 */}
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
                placeholder="例: ○○放課後等デイサービス"
                disabled={loading || isPreRegistered}
              />
              {isPreRegistered && (
                <p className="text-xs text-gray-500 mt-1">
                  ※ 施設名は事前登録時に設定されています
                </p>
              )}
            </div>

            {/* 事業所番号（任意） */}
            <div>
              <label htmlFor="businessNumber" className="block text-sm font-bold text-gray-700 mb-2">
                事業所番号（10桁） <span className="text-xs text-gray-400 font-normal">任意</span>
              </label>
              <input
                id="businessNumber"
                type="text"
                value={businessNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setBusinessNumber(val);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent font-mono"
                placeholder="1234567890"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                指定通知書に記載されている10桁の番号（指定後に入力可能）
              </p>
            </div>

            {/* 指定通知書アップロード（任意） */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                指定通知書 <span className="text-xs text-gray-400 font-normal">任意</span>
              </label>

              {!designationFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-[#00c4cc] transition-colors"
                >
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 text-sm">
                    クリックしてファイルを選択
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    JPG, PNG, PDF（5MB以下）
                  </p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-[#00c4cc]" />
                      <div>
                        <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">
                          {designationFile.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(designationFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                  {designationPreview && (
                    <img
                      src={designationPreview}
                      alt="Preview"
                      className="mt-3 max-h-32 rounded border"
                    />
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <p className="text-xs text-gray-500 mt-1">
                行政から交付された指定通知書の画像またはPDF（指定後に入力可能）
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-sm text-blue-800">
                事業所番号・指定通知書は<strong>任意</strong>です。<br />
                指定前の事業所でも登録できます。指定後に追加してください。
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '登録中...' : '施設を登録する'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="font-bold text-blue-800 text-sm mb-2">認証について</h3>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>・登録直後は「認証待ち」状態となります</li>
                <li>・運営による確認後、すべての機能が利用可能になります</li>
                <li>・行政提出資料の出力は認証完了後に可能です</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
