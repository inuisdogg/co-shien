'use client';

import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { BUSINESS_TYPES } from '@/types';

type CertificateData = {
  id: string;
  facilityName: string;
  corporateName?: string;
  corporateAddress?: string;
  corporatePhone?: string;
  representativeName?: string;
  businessType?: number;
  businessTypeOther?: string;
  startDate: string;
  endDate?: string;
  totalWorkDays?: number;
  weeklyAverageDays?: number;
  jobTitle?: string;
  employmentType?: string;
  jobDescription?: string;
  signerName?: string;
  signerTitle?: string;
  signatureImageUrl?: string;
  signedAt?: string;
  applicant?: {
    name: string;
    name_kana?: string;
    birth_date?: string;
  };
};

type Props = {
  data: CertificateData;
  onClose?: () => void;
  showDownloadOnly?: boolean;
};

// 日付フォーマット（和暦）
const formatDateJp = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  // 令和変換
  if (year >= 2019) {
    const reiwaYear = year - 2018;
    return `令和${reiwaYear === 1 ? '元' : reiwaYear}年${month}月${day}日`;
  }
  if (year >= 1989) {
    const heiseiYear = year - 1988;
    return `平成${heiseiYear === 1 ? '元' : heiseiYear}年${month}月${day}日`;
  }
  return `${year}年${month}月${day}日`;
};

// 事業種別名を取得
const getBusinessTypeName = (typeId: number | undefined): string => {
  if (!typeId) return '';
  const bt = BUSINESS_TYPES.find((t) => t.id === typeId);
  return bt?.name || '';
};

export default function CertificatePdfGenerator({ data, onClose, showDownloadOnly = false }: Props) {
  const certificateRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    if (!certificateRef.current) return;

    setGenerating(true);

    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

      const prefix = data.signedAt ? '実務経験証明書' : '実務経験証明書_プレビュー';
      const fileName = `${prefix}_${data.applicant?.name || 'unknown'}_${data.facilityName}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF生成に失敗しました');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className={showDownloadOnly ? '' : 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-auto'}>
      <div className={showDownloadOnly ? '' : 'bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto'}>
        {/* ツールバー */}
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center z-10">
          <div>
            <h3 className="font-bold text-lg">実務経験証明書</h3>
            {!data.signedAt && (
              <span className="text-xs text-orange-500">プレビュー</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              disabled={generating}
              className={`${data.signedAt ? 'bg-[#00c4cc] hover:bg-[#00b0b8]' : 'bg-blue-500 hover:bg-blue-600'} text-white px-4 py-2 rounded-lg disabled:bg-gray-300 flex items-center gap-2`}
            >
              {generating ? (
                <>
                  <span className="animate-spin">⏳</span>
                  生成中...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {data.signedAt ? 'PDFダウンロード' : 'PDFプレビュー保存'}
                </>
              )}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
              >
                閉じる
              </button>
            )}
          </div>
        </div>

        {/* 証明書本体（PDF用） */}
        <div className="p-8">
          <div
            ref={certificateRef}
            className="bg-white p-8 border border-gray-300"
            style={{ width: '210mm', minHeight: '297mm', margin: '0 auto' }}
          >
            {/* ヘッダー */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold tracking-wider">実 務 経 験 証 明 書</h1>
            </div>

            {/* 申請者情報 */}
            <div className="mb-8">
              <table className="w-full border-collapse border border-gray-400 text-sm">
                <tbody>
                  <tr>
                    <td className="border border-gray-400 bg-gray-100 px-3 py-2 w-32 font-medium">氏名</td>
                    <td className="border border-gray-400 px-3 py-2">{data.applicant?.name || '---'}</td>
                    <td className="border border-gray-400 bg-gray-100 px-3 py-2 w-32 font-medium">フリガナ</td>
                    <td className="border border-gray-400 px-3 py-2">{data.applicant?.name_kana || '---'}</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-400 bg-gray-100 px-3 py-2 font-medium">生年月日</td>
                    <td className="border border-gray-400 px-3 py-2" colSpan={3}>
                      {data.applicant?.birth_date ? formatDateJp(data.applicant.birth_date) : '---'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 事業者情報 */}
            <div className="mb-8">
              <p className="text-sm mb-2 font-medium">上記の者は、下記の事業所において従事したことを証明します。</p>
              <table className="w-full border-collapse border border-gray-400 text-sm">
                <tbody>
                  <tr>
                    <td className="border border-gray-400 bg-gray-100 px-3 py-2 w-36 font-medium">施設又は事業所名</td>
                    <td className="border border-gray-400 px-3 py-2" colSpan={3}>{data.facilityName}</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-400 bg-gray-100 px-3 py-2 font-medium">法人名</td>
                    <td className="border border-gray-400 px-3 py-2" colSpan={3}>{data.corporateName || '---'}</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-400 bg-gray-100 px-3 py-2 font-medium">事業種別</td>
                    <td className="border border-gray-400 px-3 py-2" colSpan={3}>
                      {data.businessType ? (
                        <>
                          {getBusinessTypeName(data.businessType)}
                          {data.businessType === 9 && data.businessTypeOther && ` (${data.businessTypeOther})`}
                        </>
                      ) : '---'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 業務期間 */}
            <div className="mb-8">
              <table className="w-full border-collapse border border-gray-400 text-sm">
                <tbody>
                  <tr>
                    <td className="border border-gray-400 bg-gray-100 px-3 py-2 w-36 font-medium">業務期間</td>
                    <td className="border border-gray-400 px-3 py-2" colSpan={3}>
                      {formatDateJp(data.startDate)} ～ {data.endDate ? formatDateJp(data.endDate) : '現在'}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-400 bg-gray-100 px-3 py-2 font-medium">実勤務日数</td>
                    <td className="border border-gray-400 px-3 py-2 w-36">
                      {data.totalWorkDays ? `${data.totalWorkDays} 日` : '---'}
                    </td>
                    <td className="border border-gray-400 bg-gray-100 px-3 py-2 font-medium w-36">週平均勤務日数</td>
                    <td className="border border-gray-400 px-3 py-2">
                      {data.weeklyAverageDays ? `${data.weeklyAverageDays} 日` : '---'}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-400 bg-gray-100 px-3 py-2 font-medium">職名</td>
                    <td className="border border-gray-400 px-3 py-2">{data.jobTitle || '---'}</td>
                    <td className="border border-gray-400 bg-gray-100 px-3 py-2 font-medium">雇用形態</td>
                    <td className="border border-gray-400 px-3 py-2">
                      {data.employmentType === 'fulltime' ? '常勤' : '非常勤'}
                    </td>
                  </tr>
                  {data.jobDescription && (
                    <tr>
                      <td className="border border-gray-400 bg-gray-100 px-3 py-2 font-medium">業務内容</td>
                      <td className="border border-gray-400 px-3 py-2" colSpan={3}>
                        <div className="whitespace-pre-wrap">{data.jobDescription}</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 証明日・署名欄 */}
            <div className="mt-12">
              <div className="text-right mb-8">
                <p className="text-sm">
                  証明日: {data.signedAt ? formatDateJp(data.signedAt) : <span className="text-gray-400">（署名後に記載）</span>}
                </p>
              </div>

              <div className="flex justify-end">
                <div className="w-80 text-sm">
                  {data.corporateAddress && (
                    <p className="mb-1">所在地: {data.corporateAddress}</p>
                  )}
                  {data.corporatePhone && (
                    <p className="mb-1">電話番号: {data.corporatePhone}</p>
                  )}
                  <p className="mb-1">法人名: {data.corporateName || data.facilityName}</p>
                  <p className="mb-1">事業所名: {data.facilityName}</p>

                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      {data.signerTitle && (
                        <p className="mb-1">{data.signerTitle}</p>
                      )}
                      <p className="font-medium">{data.representativeName || data.signerName || '（署名者）'}</p>
                    </div>
                    {data.signatureImageUrl ? (
                      <div className="ml-4">
                        <img
                          src={data.signatureImageUrl}
                          alt="署名"
                          className="h-16 w-auto"
                        />
                      </div>
                    ) : (
                      <div className="ml-4 w-24 h-16 border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
                        署名欄
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* フッター */}
            <div className="mt-16 text-xs text-gray-500 text-center">
              {data.signedAt ? (
                <>
                  <p>この証明書は Roots 電子署名システムにより発行されました</p>
                  <p className="mt-1">Document ID: {data.id}</p>
                </>
              ) : (
                <p className="text-orange-500 font-medium">※ プレビュー表示 - 署名後に正式な証明書として発行されます</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
