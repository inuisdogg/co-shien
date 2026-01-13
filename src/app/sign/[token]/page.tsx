'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useParams, useRouter } from 'next/navigation';
import { BUSINESS_TYPES } from '@/types';
import CertificatePdfGenerator from '@/components/personal/CertificatePdfGenerator';

// Supabaseクライアント（公開APIキー使用）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

type WorkExperienceRecord = {
  id: string;
  user_id: string;
  facility_name: string;
  corporate_name?: string;
  corporate_address?: string;
  corporate_phone?: string;
  representative_name?: string;
  contact_email?: string;
  contact_person_name?: string;
  business_type?: number;
  business_type_other?: string;
  start_date: string;
  end_date?: string;
  total_work_days?: number;
  weekly_average_days?: number;
  job_title?: string;
  employment_type?: string;
  job_description?: string;
  status: string;
  signature_token?: string;
  signature_requested_at?: string;
  signed_at?: string;
  signed_pdf_url?: string;
  rejection_reason?: string;
};

type UserInfo = {
  name: string;
  name_kana?: string;
  birth_date?: string;
};

// 角印を生成する関数
const generateStampImage = (text: string): string => {
  const canvas = document.createElement('canvas');
  const size = 200;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 背景を透明に
  ctx.clearRect(0, 0, size, size);

  // 外枠（赤い四角）
  const padding = 8;
  ctx.strokeStyle = '#c41e3a';
  ctx.lineWidth = 6;
  ctx.strokeRect(padding, padding, size - padding * 2, size - padding * 2);

  // 内側の枠
  ctx.lineWidth = 2;
  ctx.strokeRect(padding + 8, padding + 8, size - (padding + 8) * 2, size - (padding + 8) * 2);

  // テキストを縦書きで配置
  ctx.fillStyle = '#c41e3a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const chars = text.split('');
  const maxCharsPerColumn = 5;
  const columns = Math.ceil(chars.length / maxCharsPerColumn);

  // フォントサイズを調整
  let fontSize = 28;
  if (chars.length > 10) fontSize = 24;
  if (chars.length > 15) fontSize = 20;
  if (chars.length > 20) fontSize = 16;

  ctx.font = `bold ${fontSize}px "Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif`;

  const innerSize = size - (padding + 8) * 2 - 20;
  const columnWidth = innerSize / columns;
  const charHeight = innerSize / Math.min(chars.length, maxCharsPerColumn);

  for (let i = 0; i < chars.length; i++) {
    const col = Math.floor(i / maxCharsPerColumn);
    const row = i % maxCharsPerColumn;

    // 右から左に配置（縦書き）
    const x = size / 2 + (columns / 2 - col - 0.5) * columnWidth;
    const y = padding + 20 + (row + 0.5) * Math.min(charHeight, fontSize + 4);

    ctx.fillText(chars[i], x, y);
  }

  return canvas.toDataURL('image/png');
};

export default function SignaturePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [record, setRecord] = useState<WorkExperienceRecord | null>(null);
  const [applicant, setApplicant] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // 署名関連
  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [stampText, setStampText] = useState(''); // 印影用テキスト
  const [stampPreview, setStampPreview] = useState(''); // 印影プレビュー

  // 拒否関連
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // PDF表示関連
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  useEffect(() => {
    if (token) {
      fetchRecord();
    }
  }, [token]);

  // 印影プレビューを更新
  useEffect(() => {
    if (stampText.trim()) {
      const imageUrl = generateStampImage(stampText);
      setStampPreview(imageUrl);
    } else {
      setStampPreview('');
    }
  }, [stampText]);

  // 法人名から初期印影テキストを設定
  useEffect(() => {
    if (record?.corporate_name && !stampText) {
      setStampText(record.corporate_name);
    }
  }, [record]);

  const fetchRecord = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('work_experience_records')
        .select('*')
        .eq('signature_token', token)
        .single();

      if (fetchError || !data) {
        setError('無効なリンクです。リンクの有効期限が切れているか、既に処理済みの可能性があります。');
        setLoading(false);
        return;
      }

      if (data.status === 'signed') {
        setCompleted(true);
        setRecord(data);
        setLoading(false);
        return;
      }

      if (data.status === 'rejected') {
        setError('この証明書発行依頼は既に却下されています。');
        setLoading(false);
        return;
      }

      if (data.status !== 'pending') {
        setError('この証明書発行依頼は処理できません。');
        setLoading(false);
        return;
      }

      setRecord(data);

      const { data: userData } = await supabase
        .from('users')
        .select('name, name_kana, birth_date')
        .eq('id', data.user_id)
        .single();

      if (userData) {
        setApplicant(userData);
      }
    } catch (err) {
      setError('データの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  // 署名を送信
  const handleSubmit = async () => {
    if (!record || !signerName || !stampText) {
      alert('署名者名と印影テキストを入力してください。');
      return;
    }

    setSubmitting(true);

    try {
      // 印影画像を生成
      const stampImageUrl = generateStampImage(stampText);

      const { error: updateError } = await supabase
        .from('work_experience_records')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
          signer_name: signerName,
          signer_title: signerTitle,
          signature_image_url: stampImageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', record.id);

      if (updateError) {
        throw new Error('署名の保存に失敗しました');
      }

      setCompleted(true);
    } catch (err: any) {
      alert(err.message || '処理に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  // 拒否処理
  const handleReject = async () => {
    if (!record || !rejectReason.trim()) {
      alert('拒否理由を入力してください。');
      return;
    }

    setSubmitting(true);

    try {
      const { error: updateError } = await supabase
        .from('work_experience_records')
        .update({
          status: 'rejected',
          rejection_reason: rejectReason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', record.id);

      if (updateError) {
        throw new Error('処理に失敗しました');
      }

      setError('証明書発行依頼を却下しました。');
      setShowRejectDialog(false);
    } catch (err: any) {
      alert(err.message || '処理に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  // 日付フォーマット
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
  };

  // 事業種別名を取得
  const getBusinessTypeName = (typeId: number | undefined) => {
    if (!typeId) return '';
    const bt = BUSINESS_TYPES.find((t) => t.id === typeId);
    return bt?.name || '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">エラー</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (completed) {
    const pdfData = record ? {
      id: record.id,
      facilityName: record.facility_name,
      corporateName: record.corporate_name,
      corporateAddress: record.corporate_address,
      corporatePhone: record.corporate_phone,
      representativeName: record.representative_name,
      businessType: record.business_type,
      businessTypeOther: record.business_type_other,
      startDate: record.start_date,
      endDate: record.end_date,
      totalWorkDays: record.total_work_days,
      weeklyAverageDays: record.weekly_average_days,
      jobTitle: record.job_title,
      employmentType: record.employment_type,
      jobDescription: record.job_description,
      signerName: signerName || (record as any).signer_name,
      signerTitle: signerTitle || (record as any).signer_title,
      signatureImageUrl: stampPreview || (record as any).signature_image_url,
      signedAt: (record as any).signed_at,
      applicant: applicant ? {
        name: applicant.name,
        name_kana: applicant.name_kana,
        birth_date: applicant.birth_date,
      } : undefined,
    } : null;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">署名完了</h2>
          <p className="text-gray-600 mb-4">
            実務経験証明書への署名が完了しました。<br />
            ご協力ありがとうございました。
          </p>

          {pdfData && (
            <button
              onClick={() => setShowPdfPreview(true)}
              className="w-full bg-teal-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 mb-4"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              証明書をPDFでダウンロード
            </button>
          )}

          <p className="text-sm text-gray-500">
            このページを閉じていただいて問題ありません。
          </p>
        </div>

        {showPdfPreview && pdfData && (
          <CertificatePdfGenerator
            data={pdfData}
            onClose={() => setShowPdfPreview(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-t-lg p-6 text-white">
          <h1 className="text-2xl font-bold text-center">実務経験証明書 電子署名</h1>
          <p className="text-center text-teal-100 mt-2">
            下記内容をご確認の上、署名をお願いいたします
          </p>
        </div>

        {/* 証明書プレビュー */}
        <div className="bg-white shadow-lg p-6 md:p-8">
          <h2 className="text-xl font-bold text-center mb-6 border-b pb-4">実務経験証明書</h2>

          {/* 申請者情報 */}
          <div className="mb-6">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center">
              <span className="w-1 h-5 bg-teal-600 mr-2"></span>
              申請者情報
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">氏名</span>
                  <p className="font-medium">{applicant?.name || '---'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">フリガナ</span>
                  <p className="font-medium">{applicant?.name_kana || '---'}</p>
                </div>
                {applicant?.birth_date && (
                  <div>
                    <span className="text-sm text-gray-500">生年月日</span>
                    <p className="font-medium">{formatDate(applicant.birth_date)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 勤務先情報 */}
          <div className="mb-6">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center">
              <span className="w-1 h-5 bg-teal-600 mr-2"></span>
              勤務先情報
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <span className="text-sm text-gray-500">施設・事業所名</span>
                  <p className="font-medium">{record?.facility_name}</p>
                </div>
                {record?.corporate_name && (
                  <div>
                    <span className="text-sm text-gray-500">法人名</span>
                    <p className="font-medium">{record.corporate_name}</p>
                  </div>
                )}
                {record?.business_type && (
                  <div>
                    <span className="text-sm text-gray-500">事業種別</span>
                    <p className="font-medium">
                      {getBusinessTypeName(record.business_type)}
                      {record.business_type === 9 && record.business_type_other && (
                        <span className="text-gray-500 ml-2">({record.business_type_other})</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 勤務期間 */}
          <div className="mb-6">
            <h3 className="font-bold text-gray-700 mb-3 flex items-center">
              <span className="w-1 h-5 bg-teal-600 mr-2"></span>
              勤務期間・業務内容
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">勤務開始日</span>
                  <p className="font-medium">{formatDate(record?.start_date)}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">勤務終了日</span>
                  <p className="font-medium">{record?.end_date ? formatDate(record.end_date) : '現在'}</p>
                </div>
                {record?.total_work_days && (
                  <div>
                    <span className="text-sm text-gray-500">実勤務日数</span>
                    <p className="font-medium">{record.total_work_days}日</p>
                  </div>
                )}
                {record?.weekly_average_days && (
                  <div>
                    <span className="text-sm text-gray-500">週平均勤務日数</span>
                    <p className="font-medium">{record.weekly_average_days}日</p>
                  </div>
                )}
                <div>
                  <span className="text-sm text-gray-500">職名</span>
                  <p className="font-medium">{record?.job_title || '---'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">雇用形態</span>
                  <p className="font-medium">
                    {record?.employment_type === 'fulltime' ? '常勤' : '非常勤'}
                  </p>
                </div>
              </div>
              {record?.job_description && (
                <div className="mt-4">
                  <span className="text-sm text-gray-500">業務内容</span>
                  <p className="font-medium whitespace-pre-wrap">{record.job_description}</p>
                </div>
              )}
            </div>
          </div>

          {/* 電子署名セクション */}
          <div className="mt-8 border-t pt-6">
            <h3 className="font-bold text-gray-700 mb-4 flex items-center">
              <span className="w-1 h-5 bg-teal-600 mr-2"></span>
              電子署名
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  署名者氏名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="山田 太郎"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  役職名
                </label>
                <input
                  type="text"
                  value={signerTitle}
                  onChange={(e) => setSignerTitle(e.target.value)}
                  placeholder="施設長"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* 印影テキスト入力 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                印影テキスト（法人名など） <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={stampText}
                onChange={(e) => setStampText(e.target.value)}
                placeholder="例：社会福祉法人○○福祉会"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                入力した文字から自動的に角印が生成されます
              </p>
            </div>

            {/* 印影プレビュー */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                印影プレビュー
              </label>
              <div className="flex items-center justify-center p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                {stampPreview ? (
                  <div className="text-center">
                    <img
                      src={stampPreview}
                      alt="印影プレビュー"
                      className="w-24 h-24 mx-auto"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      この印影が証明書に押印されます
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">
                    印影テキストを入力するとプレビューが表示されます
                  </p>
                )}
              </div>
            </div>

            {/* ボタン */}
            <div className="flex flex-col md:flex-row gap-3">
              <button
                onClick={handleSubmit}
                disabled={submitting || !signerName || !stampText}
                className="flex-1 bg-teal-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? '処理中...' : '署名して承認する'}
              </button>
              <button
                onClick={() => setShowRejectDialog(true)}
                disabled={submitting}
                className="flex-1 bg-white border border-red-400 text-red-600 py-3 px-6 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                発行を拒否する
              </button>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="bg-gray-100 rounded-b-lg p-4 text-center text-sm text-gray-500">
          <p>co-shien - 児童発達支援管理システム</p>
        </div>
      </div>

      {/* 拒否ダイアログ */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">発行を拒否する</h3>
            <p className="text-sm text-gray-600 mb-4">
              拒否理由を入力してください。申請者に通知されます。
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="例: 在籍記録が確認できませんでした"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent h-32"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowRejectDialog(false)}
                disabled={submitting}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleReject}
                disabled={submitting || !rejectReason.trim()}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? '処理中...' : '拒否する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
