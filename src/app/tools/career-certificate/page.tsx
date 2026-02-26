'use client';

import { useRef, useState, useCallback } from 'react';
import {
  FileText,
  Download,
  Loader2,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  User,
  Building2,
  Briefcase,
  Stamp,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ============================================================
// Types
// ============================================================

type FormData = {
  // Section 1 - 証明対象者
  name: string;
  name_kana: string;
  birth_date: string;
  address: string;
  // Section 2 - 勤務先
  facility_name: string;
  facility_type: string;
  facility_address: string;
  facility_phone: string;
  // Section 3 - 勤務期間・内容
  start_date: string;
  end_date: string;
  job_title: string;
  employment_type: string;
  duties: string;
  total_days: string;
  // Section 4 - 証明者
  certifier_name: string;
  certifier_title: string;
  certification_date: string;
};

// ============================================================
// Constants
// ============================================================

const FACILITY_TYPES = [
  '児童発達支援',
  '放課後等デイサービス',
  '保育所',
  '認定こども園',
  '障害者支援施設',
  'その他',
];

const JOB_TITLES = [
  '保育士',
  '児童発達支援管理責任者',
  '児童指導員',
  '指導員',
  'サービス管理責任者',
  '相談支援専門員',
  '看護師',
  '理学療法士',
  '作業療法士',
  '言語聴覚士',
  'その他',
];

const EMPLOYMENT_TYPES = ['常勤', '非常勤', 'パート・アルバイト'];

// ============================================================
// Helpers
// ============================================================

/** Format a date string (YYYY-MM-DD) into Japanese era format (和暦) */
const formatDateJp = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  if (year > 2019 || (year === 2019 && (month > 5 || (month === 5 && day >= 1)))) {
    const reiwaYear = year - 2018;
    return `令和${reiwaYear === 1 ? '元' : reiwaYear}年${month}月${day}日`;
  }
  if (year >= 1989) {
    const heiseiYear = year - 1988;
    return `平成${heiseiYear === 1 ? '元' : heiseiYear}年${month}月${day}日`;
  }
  return `${year}年${month}月${day}日`;
};

/** Compute duration string between two dates, e.g. "3年2ヶ月" */
const computeDuration = (startStr: string, endStr: string | undefined): string => {
  if (!startStr) return '';
  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : new Date();
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  if (months < 0) {
    years--;
    months += 12;
  }
  const parts: string[] = [];
  if (years > 0) parts.push(`${years}年`);
  if (months > 0) parts.push(`${months}ヶ月`);
  return parts.length > 0 ? parts.join('') : '1ヶ月未満';
};

/** Get today in YYYY-MM-DD format */
const todayStr = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ============================================================
// Initial Form State
// ============================================================

const initialFormData: FormData = {
  name: '',
  name_kana: '',
  birth_date: '',
  address: '',
  facility_name: '',
  facility_type: '',
  facility_address: '',
  facility_phone: '',
  start_date: '',
  end_date: '',
  job_title: '',
  employment_type: '常勤',
  duties: '',
  total_days: '',
  certifier_name: '',
  certifier_title: '施設長',
  certification_date: todayStr(),
};

// ============================================================
// Main Page Component
// ============================================================

export default function CareerCertificatePage() {
  const [form, setForm] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const certificateRef = useRef<HTMLDivElement>(null);

  // ----------------------------------------------------------
  // Form handlers
  // ----------------------------------------------------------

  const handleChange = useCallback(
    (field: keyof FormData) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        // Clear the error for the field being edited
        setErrors((prev) => {
          if (prev[field]) {
            const next = { ...prev };
            delete next[field];
            return next;
          }
          return prev;
        });
        setGenerated(false);
      },
    [],
  );

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim()) newErrors.name = '氏名は必須です';
    if (!form.facility_name.trim()) newErrors.facility_name = '施設・事業所名は必須です';
    if (!form.start_date) newErrors.start_date = '在職期間（開始）は必須です';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  // ----------------------------------------------------------
  // PDF generation
  // ----------------------------------------------------------

  const handleGeneratePdf = useCallback(async () => {
    if (!validate()) {
      // Scroll to first error
      const firstErrorField = document.querySelector('[data-error="true"]');
      firstErrorField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

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

      const fileName = `実務経験証明書_${form.name || '未入力'}_${form.facility_name || '未入力'}.pdf`;
      pdf.save(fileName);
      setGenerated(true);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF生成に失敗しました。もう一度お試しください。');
    } finally {
      setGenerating(false);
    }
  }, [form, validate]);

  // ----------------------------------------------------------
  // Render helpers
  // ----------------------------------------------------------

  const inputClass = (field: keyof FormData) =>
    `w-full rounded-lg border ${
      errors[field] ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-300'
    } px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-colors`;

  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  const requiredBadge = (
    <span className="ml-1 text-xs text-red-500 font-medium">*必須</span>
  );

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* ====== Header ====== */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="/tools" className="flex items-center gap-2 text-gray-800 hover:text-indigo-600 transition-colors">
            <FileText className="w-5 h-5 text-indigo-600" />
            <span className="font-semibold text-sm">Roots Tools</span>
          </a>
          <a
            href="/career"
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Rootsに無料登録
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      </header>

      {/* ====== Hero ====== */}
      <section className="py-10 sm:py-14 text-center px-4">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
            <FileText className="w-3.5 h-3.5" />
            無料ツール
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            実務経験証明書ジェネレーター
          </h1>
          <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
            保育士・児童指導員など福祉専門職の方向け。
            <br className="hidden sm:block" />
            必要事項を入力するだけで、正式な実務経験証明書PDFを無料で作成できます。
          </p>
        </div>
      </section>

      {/* ====== Main content (form + preview side by side on desktop) ====== */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* ---------- Left: Form ---------- */}
          <div className="space-y-6">
            {/* Section 1 */}
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
                <User className="w-4.5 h-4.5 text-indigo-600" />
                <h2 className="text-sm font-semibold text-gray-800">
                  証明対象者（あなた）の情報
                </h2>
              </div>
              <div className="p-5 space-y-4">
                {/* 氏名 */}
                <div data-error={!!errors.name || undefined}>
                  <label className={labelClass}>
                    氏名{requiredBadge}
                  </label>
                  <input
                    type="text"
                    placeholder="山田 太郎"
                    value={form.name}
                    onChange={handleChange('name')}
                    className={inputClass('name')}
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />{errors.name}
                    </p>
                  )}
                </div>
                {/* フリガナ */}
                <div>
                  <label className={labelClass}>フリガナ</label>
                  <input
                    type="text"
                    placeholder="ヤマダ タロウ"
                    value={form.name_kana}
                    onChange={handleChange('name_kana')}
                    className={inputClass('name_kana')}
                  />
                </div>
                {/* 生年月日 */}
                <div>
                  <label className={labelClass}>生年月日</label>
                  <input
                    type="date"
                    value={form.birth_date}
                    onChange={handleChange('birth_date')}
                    className={inputClass('birth_date')}
                  />
                </div>
                {/* 住所 */}
                <div>
                  <label className={labelClass}>住所</label>
                  <input
                    type="text"
                    placeholder="東京都渋谷区..."
                    value={form.address}
                    onChange={handleChange('address')}
                    className={inputClass('address')}
                  />
                </div>
              </div>
            </section>

            {/* Section 2 */}
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
                <Building2 className="w-4.5 h-4.5 text-indigo-600" />
                <h2 className="text-sm font-semibold text-gray-800">勤務先の情報</h2>
              </div>
              <div className="p-5 space-y-4">
                {/* 施設・事業所名 */}
                <div data-error={!!errors.facility_name || undefined}>
                  <label className={labelClass}>
                    施設・事業所名{requiredBadge}
                  </label>
                  <input
                    type="text"
                    placeholder="○○児童発達支援センター"
                    value={form.facility_name}
                    onChange={handleChange('facility_name')}
                    className={inputClass('facility_name')}
                  />
                  {errors.facility_name && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />{errors.facility_name}
                    </p>
                  )}
                </div>
                {/* 施設種別 */}
                <div>
                  <label className={labelClass}>施設種別</label>
                  <select
                    value={form.facility_type}
                    onChange={handleChange('facility_type')}
                    className={inputClass('facility_type')}
                  >
                    <option value="">選択してください</option>
                    {FACILITY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                {/* 所在地 */}
                <div>
                  <label className={labelClass}>所在地</label>
                  <input
                    type="text"
                    placeholder="東京都新宿区..."
                    value={form.facility_address}
                    onChange={handleChange('facility_address')}
                    className={inputClass('facility_address')}
                  />
                </div>
                {/* 電話番号 */}
                <div>
                  <label className={labelClass}>電話番号</label>
                  <input
                    type="tel"
                    placeholder="03-1234-5678"
                    value={form.facility_phone}
                    onChange={handleChange('facility_phone')}
                    className={inputClass('facility_phone')}
                  />
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
                <Briefcase className="w-4.5 h-4.5 text-indigo-600" />
                <h2 className="text-sm font-semibold text-gray-800">勤務期間・内容</h2>
              </div>
              <div className="p-5 space-y-4">
                {/* 在職期間 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div data-error={!!errors.start_date || undefined}>
                    <label className={labelClass}>
                      在職期間（開始）{requiredBadge}
                    </label>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={handleChange('start_date')}
                      className={inputClass('start_date')}
                    />
                    {errors.start_date && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />{errors.start_date}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>在職期間（終了）</label>
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={handleChange('end_date')}
                      className={inputClass('end_date')}
                    />
                    <p className="mt-1 text-xs text-gray-400">空欄の場合「現在」となります</p>
                  </div>
                </div>
                {/* 職種 */}
                <div>
                  <label className={labelClass}>職種</label>
                  <select
                    value={form.job_title}
                    onChange={handleChange('job_title')}
                    className={inputClass('job_title')}
                  >
                    <option value="">選択してください</option>
                    {JOB_TITLES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                {/* 雇用形態 */}
                <div>
                  <label className={labelClass}>雇用形態</label>
                  <select
                    value={form.employment_type}
                    onChange={handleChange('employment_type')}
                    className={inputClass('employment_type')}
                  >
                    {EMPLOYMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                {/* 主な業務内容 */}
                <div>
                  <label className={labelClass}>主な業務内容</label>
                  <textarea
                    rows={3}
                    placeholder="児童の個別支援計画の作成、療育活動の企画・実施、保護者対応..."
                    value={form.duties}
                    onChange={handleChange('duties')}
                    className={inputClass('duties')}
                  />
                </div>
                {/* 総従事日数 */}
                <div>
                  <label className={labelClass}>総従事日数（任意）</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      placeholder="例: 720"
                      value={form.total_days}
                      onChange={handleChange('total_days')}
                      className={`${inputClass('total_days')} max-w-[160px]`}
                    />
                    <span className="text-sm text-gray-500">日</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
                <Stamp className="w-4.5 h-4.5 text-indigo-600" />
                <h2 className="text-sm font-semibold text-gray-800">証明者の情報</h2>
              </div>
              <div className="p-5 space-y-4">
                {/* 証明者氏名 */}
                <div>
                  <label className={labelClass}>証明者氏名（施設長名等）</label>
                  <input
                    type="text"
                    placeholder="鈴木 一郎"
                    value={form.certifier_name}
                    onChange={handleChange('certifier_name')}
                    className={inputClass('certifier_name')}
                  />
                </div>
                {/* 証明者役職 */}
                <div>
                  <label className={labelClass}>証明者役職</label>
                  <input
                    type="text"
                    placeholder="施設長"
                    value={form.certifier_title}
                    onChange={handleChange('certifier_title')}
                    className={inputClass('certifier_title')}
                  />
                </div>
                {/* 証明日 */}
                <div>
                  <label className={labelClass}>証明日</label>
                  <input
                    type="date"
                    value={form.certification_date}
                    onChange={handleChange('certification_date')}
                    className={inputClass('certification_date')}
                  />
                </div>
              </div>
            </section>

            {/* Download button (mobile: visible; desktop: also shown here for convenience) */}
            <button
              onClick={handleGeneratePdf}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-3.5 rounded-xl transition-colors shadow-lg shadow-indigo-200"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  PDF生成中...
                </>
              ) : generated ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  ダウンロード完了 - もう一度ダウンロード
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  PDFをダウンロード
                </>
              )}
            </button>
          </div>

          {/* ---------- Right: Preview ---------- */}
          <div className="lg:sticky lg:top-20">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">プレビュー</h3>
              <button
                onClick={handleGeneratePdf}
                disabled={generating}
                className="hidden lg:inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    PDFをダウンロード
                  </>
                )}
              </button>
            </div>

            {/* Scrollable preview container */}
            <div className="bg-gray-100 rounded-xl p-4 overflow-auto max-h-[80vh] border border-gray-200">
              {/* Hidden-for-PDF + visible-for-preview certificate */}
              <div
                ref={certificateRef}
                className="bg-white mx-auto shadow-sm"
                style={{
                  width: '794px', // A4 at 96dpi
                  minHeight: '1123px',
                  padding: '60px 60px 80px 60px',
                  fontFamily:
                    '"Hiragino Mincho ProN", "Yu Mincho", "MS PMincho", "Noto Serif JP", serif',
                  fontSize: '14px',
                  lineHeight: '1.8',
                  color: '#1a1a1a',
                }}
              >
                {/* Title */}
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                  <h1
                    style={{
                      fontSize: '24px',
                      fontWeight: 'bold',
                      letterSpacing: '0.5em',
                      margin: 0,
                    }}
                  >
                    実 務 経 験 証 明 書
                  </h1>
                </div>

                {/* Intro text */}
                <p style={{ marginBottom: '30px', fontSize: '14px' }}>
                  下記の者が、当施設において以下のとおり勤務したことを証明します。
                </p>

                {/* Section: 証明対象者 */}
                <div style={{ marginBottom: '28px' }}>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 'bold',
                      marginBottom: '12px',
                      borderBottom: '2px solid #1a1a1a',
                      paddingBottom: '4px',
                    }}
                  >
                    【証明対象者】
                  </div>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '13px',
                    }}
                  >
                    <tbody>
                      <tr>
                        <td
                          style={{
                            width: '130px',
                            padding: '6px 12px',
                            backgroundColor: '#f5f5f0',
                            border: '1px solid #ccc',
                            fontWeight: 600,
                          }}
                        >
                          氏名
                        </td>
                        <td
                          style={{
                            padding: '6px 12px',
                            border: '1px solid #ccc',
                          }}
                        >
                          {form.name || '---'}
                        </td>
                        <td
                          style={{
                            width: '130px',
                            padding: '6px 12px',
                            backgroundColor: '#f5f5f0',
                            border: '1px solid #ccc',
                            fontWeight: 600,
                          }}
                        >
                          フリガナ
                        </td>
                        <td
                          style={{
                            padding: '6px 12px',
                            border: '1px solid #ccc',
                          }}
                        >
                          {form.name_kana || '---'}
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#f5f5f0',
                            border: '1px solid #ccc',
                            fontWeight: 600,
                          }}
                        >
                          生年月日
                        </td>
                        <td
                          style={{ padding: '6px 12px', border: '1px solid #ccc' }}
                          colSpan={3}
                        >
                          {form.birth_date ? formatDateJp(form.birth_date) : '---'}
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#f5f5f0',
                            border: '1px solid #ccc',
                            fontWeight: 600,
                          }}
                        >
                          住所
                        </td>
                        <td
                          style={{ padding: '6px 12px', border: '1px solid #ccc' }}
                          colSpan={3}
                        >
                          {form.address || '---'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Section: 勤務先 */}
                <div style={{ marginBottom: '28px' }}>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 'bold',
                      marginBottom: '12px',
                      borderBottom: '2px solid #1a1a1a',
                      paddingBottom: '4px',
                    }}
                  >
                    【勤務先】
                  </div>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '13px',
                    }}
                  >
                    <tbody>
                      <tr>
                        <td
                          style={{
                            width: '130px',
                            padding: '6px 12px',
                            backgroundColor: '#f5f5f0',
                            border: '1px solid #ccc',
                            fontWeight: 600,
                          }}
                        >
                          施設・事業所名
                        </td>
                        <td
                          style={{ padding: '6px 12px', border: '1px solid #ccc' }}
                          colSpan={3}
                        >
                          {form.facility_name || '---'}
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#f5f5f0',
                            border: '1px solid #ccc',
                            fontWeight: 600,
                          }}
                        >
                          施設種別
                        </td>
                        <td
                          style={{ padding: '6px 12px', border: '1px solid #ccc' }}
                          colSpan={3}
                        >
                          {form.facility_type || '---'}
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#f5f5f0',
                            border: '1px solid #ccc',
                            fontWeight: 600,
                          }}
                        >
                          所在地
                        </td>
                        <td
                          style={{ padding: '6px 12px', border: '1px solid #ccc' }}
                          colSpan={3}
                        >
                          {form.facility_address || '---'}
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#f5f5f0',
                            border: '1px solid #ccc',
                            fontWeight: 600,
                          }}
                        >
                          電話番号
                        </td>
                        <td
                          style={{ padding: '6px 12px', border: '1px solid #ccc' }}
                          colSpan={3}
                        >
                          {form.facility_phone || '---'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Section: 勤務内容 */}
                <div style={{ marginBottom: '28px' }}>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 'bold',
                      marginBottom: '12px',
                      borderBottom: '2px solid #1a1a1a',
                      paddingBottom: '4px',
                    }}
                  >
                    【勤務内容】
                  </div>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '13px',
                    }}
                  >
                    <tbody>
                      <tr>
                        <td
                          style={{
                            width: '130px',
                            padding: '6px 12px',
                            backgroundColor: '#f5f5f0',
                            border: '1px solid #ccc',
                            fontWeight: 600,
                          }}
                        >
                          在職期間
                        </td>
                        <td
                          style={{ padding: '6px 12px', border: '1px solid #ccc' }}
                          colSpan={3}
                        >
                          {form.start_date ? formatDateJp(form.start_date) : '---'}
                          {' ～ '}
                          {form.end_date ? formatDateJp(form.end_date) : '現在'}
                          {form.start_date && (
                            <span style={{ marginLeft: '12px', color: '#555' }}>
                              （{computeDuration(form.start_date, form.end_date || undefined)}）
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#f5f5f0',
                            border: '1px solid #ccc',
                            fontWeight: 600,
                          }}
                        >
                          職種
                        </td>
                        <td
                          style={{ padding: '6px 12px', border: '1px solid #ccc' }}
                        >
                          {form.job_title || '---'}
                        </td>
                        <td
                          style={{
                            width: '130px',
                            padding: '6px 12px',
                            backgroundColor: '#f5f5f0',
                            border: '1px solid #ccc',
                            fontWeight: 600,
                          }}
                        >
                          雇用形態
                        </td>
                        <td
                          style={{ padding: '6px 12px', border: '1px solid #ccc' }}
                        >
                          {form.employment_type || '---'}
                        </td>
                      </tr>
                      <tr>
                        <td
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#f5f5f0',
                            border: '1px solid #ccc',
                            fontWeight: 600,
                            verticalAlign: 'top',
                          }}
                        >
                          主な業務内容
                        </td>
                        <td
                          style={{
                            padding: '6px 12px',
                            border: '1px solid #ccc',
                            whiteSpace: 'pre-wrap',
                          }}
                          colSpan={3}
                        >
                          {form.duties || '---'}
                        </td>
                      </tr>
                      {form.total_days && (
                        <tr>
                          <td
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#f5f5f0',
                              border: '1px solid #ccc',
                              fontWeight: 600,
                            }}
                          >
                            総従事日数
                          </td>
                          <td
                            style={{ padding: '6px 12px', border: '1px solid #ccc' }}
                            colSpan={3}
                          >
                            {form.total_days} 日
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Certification date + signer block */}
                <div style={{ marginTop: '50px' }}>
                  <div style={{ textAlign: 'right', marginBottom: '40px', fontSize: '14px' }}>
                    {form.certification_date
                      ? formatDateJp(form.certification_date)
                      : formatDateJp(todayStr())}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ width: '380px', fontSize: '13px', lineHeight: '2.2' }}>
                      {form.facility_address && (
                        <div>
                          <span style={{ fontWeight: 600 }}>所在地：</span>
                          {form.facility_address}
                        </div>
                      )}
                      <div>
                        <span style={{ fontWeight: 600 }}>施設・事業所名：</span>
                        {form.facility_name || '---'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px' }}>
                        <div>
                          {form.certifier_title && (
                            <div>
                              <span style={{ fontWeight: 600 }}>役職：</span>
                              {form.certifier_title}
                            </div>
                          )}
                          <div>
                            <span style={{ fontWeight: 600 }}>証明者氏名：</span>
                            {form.certifier_name || '---'}
                          </div>
                        </div>
                        <div
                          style={{
                            width: '60px',
                            height: '60px',
                            border: '2px solid #ccc',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            color: '#999',
                            flexShrink: 0,
                            marginLeft: '20px',
                          }}
                        >
                          印
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer note */}
                <div
                  style={{
                    marginTop: '60px',
                    textAlign: 'center',
                    fontSize: '10px',
                    color: '#999',
                  }}
                >
                  <p>この証明書は Roots 無料ツールにより作成されました</p>
                  <p style={{ marginTop: '2px' }}>
                    roots-app.jp/tools/career-certificate
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ====== CTA Banner ====== */}
        <section className="mt-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 sm:p-10 text-center text-white shadow-xl">
          <h2 className="text-xl sm:text-2xl font-bold mb-3">
            Rootsに登録して、キャリアをもっと便利に
          </h2>
          <p className="text-indigo-100 text-sm sm:text-base mb-6 max-w-xl mx-auto leading-relaxed">
            Rootsに無料登録すると、キャリアデータを自動蓄積。
            <br />
            証明書もワンクリックで発行できます。研修履歴・資格管理もまとめて管理。
          </p>
          <a
            href="/career"
            className="inline-flex items-center gap-2 bg-white text-indigo-700 font-semibold px-6 py-3 rounded-xl hover:bg-indigo-50 transition-colors shadow-lg"
          >
            Rootsに無料登録する
            <ChevronRight className="w-5 h-5" />
          </a>
        </section>
      </main>

      {/* ====== Footer ====== */}
      <footer className="border-t border-gray-200 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <p>Roots - 福祉専門職のためのキャリアプラットフォーム</p>
          <div className="flex items-center gap-4">
            <a href="/tools" className="hover:text-gray-600 transition-colors">
              ツール一覧
            </a>
            <a href="/career" className="hover:text-gray-600 transition-colors">
              Rootsに登録
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
