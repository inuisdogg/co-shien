'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Download,
  Loader2,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  User,
  GraduationCap,
  Briefcase,
  Award,
  Heart,
  FileText,
  Plus,
  X,
  Camera,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ============================================================
// Types
// ============================================================

interface TimeEntry {
  id: string;
  year: string;
  month: string;
  content: string;
}

interface FormData {
  // Section 1 - 基本情報
  name: string;
  name_kana: string;
  birth_date: string;
  gender: string;
  postal_code: string;
  address: string;
  phone: string;
  email: string;
  // Section 5 - 志望動機・自己PR
  motivation: string;
  self_pr: string;
  // Section 6 - 本人希望
  preferences: string;
}

// ============================================================
// Constants
// ============================================================

const YEARS = Array.from({ length: 61 }, (_, i) => String(1970 + i));
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1));

// ============================================================
// Helpers
// ============================================================

const uid = (): string => Math.random().toString(36).slice(2, 10);

const emptyEntry = (): TimeEntry => ({
  id: uid(),
  year: '',
  month: '',
  content: '',
});

/** Format birth_date (YYYY-MM-DD) into Japanese display */
const formatBirthDateJp = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  // Wareki
  if (year > 2019 || (year === 2019 && (month > 4 || (month === 5 && day >= 1)))) {
    const ry = year - 2018;
    return `令和${ry === 1 ? '元' : ry}年${month}月${day}日`;
  }
  if (year >= 1989) {
    const hy = year - 1988;
    return `平成${hy === 1 ? '元' : hy}年${month}月${day}日`;
  }
  if (year >= 1926) {
    const sy = year - 1925;
    return `昭和${sy === 1 ? '元' : sy}年${month}月${day}日`;
  }
  return `${year}年${month}月${day}日`;
};

/** Compute age from birth date */
const computeAge = (dateStr: string): number | null => {
  if (!dateStr) return null;
  const birth = new Date(dateStr);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

/** Format year+month into "YYYY年MM月" */
const formatYearMonth = (year: string, month: string): string => {
  if (!year && !month) return '';
  if (year && month) return `${year}年${month}月`;
  if (year) return `${year}年`;
  return `${month}月`;
};

/** Get today formatted in Japanese */
const todayJp = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  return `${y}年${m}月${d}日 現在`;
};

// ============================================================
// Initial State
// ============================================================

const initialFormData: FormData = {
  name: '',
  name_kana: '',
  birth_date: '',
  gender: '',
  postal_code: '',
  address: '',
  phone: '',
  email: '',
  motivation: '',
  self_pr: '',
  preferences: '',
};

// ============================================================
// Main Page Component
// ============================================================

export default function ResumePage() {
  const [form, setForm] = useState<FormData>(initialFormData);
  const [education, setEducation] = useState<TimeEntry[]>([emptyEntry()]);
  const [work, setWork] = useState<TimeEntry[]>([emptyEntry()]);
  const [licenses, setLicenses] = useState<TimeEntry[]>([emptyEntry()]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const resumeRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ----------------------------------------------------------
  // Form handlers
  // ----------------------------------------------------------

  const handleChange = useCallback(
    (field: keyof FormData) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
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

  const handleRadio = useCallback(
    (field: keyof FormData, value: string) => () => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setGenerated(false);
    },
    [],
  );

  // Dynamic array handlers
  const updateEntry = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<TimeEntry[]>>,
      id: string,
      field: keyof TimeEntry,
      value: string,
    ) => {
      setter((prev) =>
        prev.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry)),
      );
      setGenerated(false);
    },
    [],
  );

  const addEntry = useCallback(
    (setter: React.Dispatch<React.SetStateAction<TimeEntry[]>>) => () => {
      setter((prev) => [...prev, emptyEntry()]);
    },
    [],
  );

  const removeEntry = useCallback(
    (setter: React.Dispatch<React.SetStateAction<TimeEntry[]>>, id: string) => () => {
      setter((prev) => (prev.length <= 1 ? prev : prev.filter((e) => e.id !== id)));
    },
    [],
  );

  // Photo upload handler
  const handlePhotoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        alert('画像ファイルを選択してください');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('ファイルサイズは10MB以下にしてください');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotoUrl(ev.target?.result as string);
        setGenerated(false);
      };
      reader.readAsDataURL(file);
    },
    [],
  );

  const removePhoto = useCallback(() => {
    setPhotoUrl(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
    setGenerated(false);
  }, []);

  // Validation
  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<string, string>> = {};
    if (!form.name.trim()) newErrors.name = '氏名は必須です';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  // ----------------------------------------------------------
  // PDF Generation
  // ----------------------------------------------------------

  const handleGeneratePdf = useCallback(async () => {
    if (!validate()) {
      const firstErrorField = document.querySelector('[data-error="true"]');
      firstErrorField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!resumeRef.current) return;
    setGenerating(true);

    try {
      const canvas = await html2canvas(resumeRef.current, {
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

      const fileName = `履歴書_${form.name || '未入力'}.pdf`;
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

  const inputClass = (field?: string) =>
    `w-full rounded-lg border ${
      field && errors[field] ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-300'
    } px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-colors`;

  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  const requiredBadge = (
    <span className="ml-1 text-xs text-red-500 font-medium">*必須</span>
  );

  const sectionHeader = (icon: React.ReactNode, title: string) => (
    <div className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
      {icon}
      <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
    </div>
  );

  const renderDynamicSection = (
    label: string,
    icon: React.ReactNode,
    entries: TimeEntry[],
    setter: React.Dispatch<React.SetStateAction<TimeEntry[]>>,
    placeholderContent: string,
  ) => (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {sectionHeader(icon, label)}
      <div className="p-5 space-y-4">
        {entries.map((entry, idx) => (
          <div key={entry.id} className="flex gap-2 items-start">
            <div className="flex-1 space-y-2">
              {/* Year + Month selects */}
              <div className="flex gap-2">
                <select
                  value={entry.year}
                  onChange={(e) => updateEntry(setter, entry.id, 'year', e.target.value)}
                  className="w-[110px] rounded-lg border border-gray-300 px-2 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-colors bg-white"
                >
                  <option value="">年</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}年
                    </option>
                  ))}
                </select>
                <select
                  value={entry.month}
                  onChange={(e) => updateEntry(setter, entry.id, 'month', e.target.value)}
                  className="w-[80px] rounded-lg border border-gray-300 px-2 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-colors bg-white"
                >
                  <option value="">月</option>
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}月
                    </option>
                  ))}
                </select>
              </div>
              {/* Content input */}
              <input
                type="text"
                placeholder={placeholderContent}
                value={entry.content}
                onChange={(e) => updateEntry(setter, entry.id, 'content', e.target.value)}
                className={inputClass()}
              />
            </div>
            {/* Remove button */}
            <button
              type="button"
              onClick={removeEntry(setter, entry.id)}
              disabled={entries.length <= 1}
              className="mt-1 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="削除"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        {/* Add button */}
        <button
          type="button"
          onClick={addEntry(setter)}
          className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          追加
        </button>
      </div>
    </section>
  );

  // ----------------------------------------------------------
  // PDF Preview: JIS-style table helpers
  // ----------------------------------------------------------

  const cellStyle = (options?: {
    header?: boolean;
    width?: string;
    align?: string;
    vAlign?: string;
    colSpan?: number;
    noBorderBottom?: boolean;
  }): React.CSSProperties => ({
    padding: '4px 8px',
    border: '1px solid #333',
    fontSize: '11px',
    lineHeight: '1.5',
    verticalAlign: options?.vAlign || 'middle',
    textAlign: (options?.align as React.CSSProperties['textAlign']) || 'left',
    width: options?.width,
    backgroundColor: options?.header ? '#f8f8f5' : undefined,
    fontWeight: options?.header ? 600 : undefined,
    ...(options?.noBorderBottom ? { borderBottom: 'none' } : {}),
  });

  // Combine education and work for the history table
  const allEducation = education.filter((e) => e.content || e.year || e.month);
  const allWork = work.filter((e) => e.content || e.year || e.month);
  const allLicenses = licenses.filter((e) => e.content || e.year || e.month);

  // We need a minimum number of rows for the history table (JIS format typically has ~18 rows)
  const HISTORY_MIN_ROWS = 18;
  const historyRows: { yearMonth: string; content: string; isHeader?: boolean }[] = [];

  // Education header
  historyRows.push({ yearMonth: '', content: '学歴', isHeader: true });
  allEducation.forEach((e) => {
    historyRows.push({ yearMonth: formatYearMonth(e.year, e.month), content: e.content });
  });
  if (allEducation.length === 0) {
    historyRows.push({ yearMonth: '', content: '' });
  }

  // Spacer row
  historyRows.push({ yearMonth: '', content: '' });

  // Work header
  historyRows.push({ yearMonth: '', content: '職歴', isHeader: true });
  allWork.forEach((e) => {
    historyRows.push({ yearMonth: formatYearMonth(e.year, e.month), content: e.content });
  });
  if (allWork.length === 0) {
    historyRows.push({ yearMonth: '', content: '' });
  }

  // "以上" at the end of work
  historyRows.push({ yearMonth: '', content: '' });

  // Pad to minimum
  while (historyRows.length < HISTORY_MIN_ROWS) {
    historyRows.push({ yearMonth: '', content: '' });
  }

  // License rows (minimum 6)
  const LICENSE_MIN_ROWS = 6;
  const licenseRows: { yearMonth: string; content: string }[] = [];
  allLicenses.forEach((e) => {
    licenseRows.push({ yearMonth: formatYearMonth(e.year, e.month), content: e.content });
  });
  while (licenseRows.length < LICENSE_MIN_ROWS) {
    licenseRows.push({ yearMonth: '', content: '' });
  }

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* ====== Header ====== */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a
            href="/tools"
            className="flex items-center gap-2 text-gray-800 hover:text-indigo-600 transition-colors"
          >
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
            履歴書ジェネレーター
          </h1>
          <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
            保育士・児童指導員など福祉専門職の方向け。
            <br className="hidden sm:block" />
            必要事項を入力するだけで、JIS規格の履歴書PDFを無料で作成できます。
          </p>
        </div>
      </section>

      {/* ====== Main content ====== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-8 items-start">
          {/* ---------- Left: Form ---------- */}
          <div className="space-y-6 max-w-2xl">
            {/* Section 1: 基本情報 */}
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {sectionHeader(
                <User className="w-4 h-4 text-indigo-600" />,
                '基本情報',
              )}
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
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.name}
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
                    className={inputClass()}
                  />
                </div>
                {/* 生年月日 */}
                <div>
                  <label className={labelClass}>生年月日</label>
                  <input
                    type="date"
                    value={form.birth_date}
                    onChange={handleChange('birth_date')}
                    className={inputClass()}
                  />
                </div>
                {/* 性別 */}
                <div>
                  <label className={labelClass}>性別</label>
                  <div className="flex gap-4 mt-1">
                    {(['男性', '女性', '回答しない'] as const).map((g) => (
                      <label
                        key={g}
                        className="flex items-center gap-2 cursor-pointer text-sm text-gray-700"
                      >
                        <input
                          type="radio"
                          name="gender"
                          checked={form.gender === g}
                          onChange={handleRadio('gender', g)}
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                        {g}
                      </label>
                    ))}
                  </div>
                </div>
                {/* 郵便番号 */}
                <div>
                  <label className={labelClass}>郵便番号</label>
                  <input
                    type="text"
                    placeholder="123-4567"
                    value={form.postal_code}
                    onChange={handleChange('postal_code')}
                    className={inputClass()}
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
                    className={inputClass()}
                  />
                </div>
                {/* 電話番号 */}
                <div>
                  <label className={labelClass}>電話番号</label>
                  <input
                    type="tel"
                    placeholder="090-1234-5678"
                    value={form.phone}
                    onChange={handleChange('phone')}
                    className={inputClass()}
                  />
                </div>
                {/* メールアドレス */}
                <div>
                  <label className={labelClass}>メールアドレス</label>
                  <input
                    type="email"
                    placeholder="example@email.com"
                    value={form.email}
                    onChange={handleChange('email')}
                    className={inputClass()}
                  />
                </div>
                {/* 顔写真 */}
                <div>
                  <label className={labelClass}>証明写真</label>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    id="photo-upload"
                  />
                  {photoUrl ? (
                    <div className="flex items-start gap-3">
                      <div className="w-[75px] h-[100px] rounded-lg overflow-hidden border border-gray-300 flex-shrink-0">
                        <img
                          src={photoUrl}
                          alt="証明写真"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex flex-col gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          写真を変更
                        </button>
                        <button
                          type="button"
                          onClick={removePhoto}
                          className="text-xs text-red-500 hover:text-red-600 font-medium"
                        >
                          写真を削除
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors text-sm text-gray-500 hover:text-indigo-600 w-full"
                    >
                      <Camera className="w-5 h-5" />
                      <span>カメラで撮影 または 写真を選択</span>
                    </button>
                  )}
                  <p className="mt-1.5 text-xs text-gray-400">
                    スマホのインカメラで撮影、またはギャラリーから選択できます（3×4cm比率で表示）
                  </p>
                </div>
              </div>
            </section>

            {/* Section 2: 学歴 */}
            {renderDynamicSection(
              '学歴',
              <GraduationCap className="w-4 h-4 text-indigo-600" />,
              education,
              setEducation,
              '○○高等学校 卒業',
            )}

            {/* Section 3: 職歴 */}
            {renderDynamicSection(
              '職歴',
              <Briefcase className="w-4 h-4 text-indigo-600" />,
              work,
              setWork,
              '社会福祉法人○○ ○○保育園 入職',
            )}

            {/* Section 4: 免許・資格 */}
            {renderDynamicSection(
              '免許・資格',
              <Award className="w-4 h-4 text-indigo-600" />,
              licenses,
              setLicenses,
              '保育士資格 取得',
            )}

            {/* Section 5: 志望動機・自己PR */}
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {sectionHeader(
                <Heart className="w-4 h-4 text-indigo-600" />,
                '志望動機・自己PR',
              )}
              <div className="p-5 space-y-4">
                <div>
                  <label className={labelClass}>志望動機</label>
                  <textarea
                    rows={4}
                    placeholder="志望動機を入力..."
                    value={form.motivation}
                    onChange={handleChange('motivation')}
                    className={inputClass()}
                  />
                </div>
                <div>
                  <label className={labelClass}>自己PR</label>
                  <textarea
                    rows={4}
                    placeholder="自己PRを入力..."
                    value={form.self_pr}
                    onChange={handleChange('self_pr')}
                    className={inputClass()}
                  />
                </div>
              </div>
            </section>

            {/* Section 6: 本人希望 */}
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {sectionHeader(
                <FileText className="w-4 h-4 text-indigo-600" />,
                '本人希望',
              )}
              <div className="p-5">
                <div>
                  <label className={labelClass}>本人希望記入欄</label>
                  <textarea
                    rows={3}
                    placeholder="勤務地、勤務時間の希望等"
                    value={form.preferences}
                    onChange={handleChange('preferences')}
                    className={inputClass()}
                  />
                </div>
              </div>
            </section>

            {/* Download button (mobile + form area) */}
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
          <div className="xl:sticky xl:top-20">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">プレビュー</h3>
              <button
                onClick={handleGeneratePdf}
                disabled={generating}
                className="hidden xl:inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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
            <div className="bg-gray-100 rounded-xl p-4 overflow-auto max-h-[85vh] border border-gray-200">
              {/* A4 resume preview */}
              <div
                ref={resumeRef}
                className="bg-white mx-auto shadow-sm"
                style={{
                  width: '794px',
                  minHeight: '1123px',
                  padding: '40px 40px 50px 40px',
                  fontFamily:
                    '"Hiragino Mincho ProN", "Yu Mincho", "MS PMincho", "Noto Serif JP", serif',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  color: '#1a1a1a',
                }}
              >
                {/* ---- Title ---- */}
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <h1
                    style={{
                      fontSize: '22px',
                      fontWeight: 'bold',
                      letterSpacing: '0.6em',
                      margin: 0,
                    }}
                  >
                    履 歴 書
                  </h1>
                </div>

                {/* ---- Date line ---- */}
                <div
                  style={{
                    textAlign: 'right',
                    fontSize: '11px',
                    marginBottom: '14px',
                    color: '#333',
                  }}
                >
                  {todayJp()}
                </div>

                {/* ---- Top section: Basic Info + Photo ---- */}
                <div style={{ display: 'flex', gap: '0px', marginBottom: '16px' }}>
                  {/* Left: Basic info table */}
                  <table
                    style={{
                      flex: 1,
                      borderCollapse: 'collapse',
                      tableLayout: 'fixed',
                    }}
                  >
                    <tbody>
                      {/* フリガナ */}
                      <tr>
                        <td
                          style={{
                            ...cellStyle({ header: true, width: '90px' }),
                            fontSize: '9px',
                          }}
                        >
                          フリガナ
                        </td>
                        <td
                          style={{
                            ...cellStyle(),
                            fontSize: '10px',
                            minHeight: '24px',
                          }}
                          colSpan={3}
                        >
                          {form.name_kana}
                        </td>
                      </tr>
                      {/* 氏名 */}
                      <tr>
                        <td
                          style={cellStyle({
                            header: true,
                            width: '90px',
                          })}
                        >
                          氏名
                        </td>
                        <td
                          style={{
                            ...cellStyle(),
                            fontSize: '16px',
                            fontWeight: 'bold',
                            padding: '8px',
                            height: '48px',
                          }}
                          colSpan={3}
                        >
                          {form.name || ''}
                        </td>
                      </tr>
                      {/* 生年月日 */}
                      <tr>
                        <td style={cellStyle({ header: true, width: '90px' })}>
                          生年月日
                        </td>
                        <td style={cellStyle()} colSpan={3}>
                          {form.birth_date ? formatBirthDateJp(form.birth_date) : ''}
                          {computeAge(form.birth_date) !== null &&
                            `  （満 ${computeAge(form.birth_date)} 歳）`}
                        </td>
                      </tr>
                      {/* 性別 */}
                      <tr>
                        <td style={cellStyle({ header: true, width: '90px' })}>
                          性別
                        </td>
                        <td style={cellStyle()} colSpan={3}>
                          {form.gender || ''}
                        </td>
                      </tr>
                      {/* 郵便番号 + 住所 */}
                      <tr>
                        <td style={cellStyle({ header: true, width: '90px' })}>
                          郵便番号
                        </td>
                        <td style={cellStyle()} colSpan={3}>
                          {form.postal_code ? `〒${form.postal_code}` : ''}
                        </td>
                      </tr>
                      <tr>
                        <td style={cellStyle({ header: true, width: '90px' })}>
                          住所
                        </td>
                        <td
                          style={{ ...cellStyle(), minHeight: '36px' }}
                          colSpan={3}
                        >
                          {form.address || ''}
                        </td>
                      </tr>
                      {/* 電話番号 */}
                      <tr>
                        <td style={cellStyle({ header: true, width: '90px' })}>
                          電話番号
                        </td>
                        <td style={cellStyle()} colSpan={3}>
                          {form.phone || ''}
                        </td>
                      </tr>
                      {/* メール */}
                      <tr>
                        <td style={cellStyle({ header: true, width: '90px' })}>
                          メール
                        </td>
                        <td style={cellStyle()} colSpan={3}>
                          {form.email || ''}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Right: Photo */}
                  <div
                    style={{
                      width: '113px',
                      minWidth: '113px',
                      height: '151px',
                      border: '1px solid #333',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: '-1px',
                      backgroundColor: '#fafafa',
                      overflow: 'hidden',
                    }}
                  >
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt="証明写真"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          fontSize: '9px',
                          color: '#999',
                          textAlign: 'center',
                          lineHeight: '1.4',
                        }}
                      >
                        写真
                        <br />
                        (3x4cm)
                      </div>
                    )}
                  </div>
                </div>

                {/* ---- History table (学歴・職歴) ---- */}
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    marginBottom: '16px',
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          ...cellStyle({ header: true, width: '100px', align: 'center' }),
                          fontSize: '11px',
                        }}
                      >
                        年月
                      </th>
                      <th
                        style={{
                          ...cellStyle({ header: true, align: 'center' }),
                          fontSize: '11px',
                        }}
                      >
                        学歴・職歴
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((row, idx) => (
                      <tr key={idx}>
                        <td
                          style={{
                            ...cellStyle({ align: 'center' }),
                            height: '24px',
                          }}
                        >
                          {row.yearMonth}
                        </td>
                        <td
                          style={{
                            ...cellStyle({
                              align: row.isHeader ? 'center' : 'left',
                            }),
                            fontWeight: row.isHeader ? 'bold' : 'normal',
                            height: '24px',
                          }}
                        >
                          {row.content}
                        </td>
                      </tr>
                    ))}
                    {/* "以上" right-aligned in last meaningful row */}
                    <tr>
                      <td style={{ ...cellStyle({ align: 'center' }), height: '24px' }} />
                      <td
                        style={{
                          ...cellStyle({ align: 'right' }),
                          height: '24px',
                          paddingRight: '40px',
                        }}
                      >
                        以上
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* ---- Licenses table (免許・資格) ---- */}
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    marginBottom: '16px',
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          ...cellStyle({ header: true, width: '100px', align: 'center' }),
                          fontSize: '11px',
                        }}
                      >
                        年月
                      </th>
                      <th
                        style={{
                          ...cellStyle({ header: true, align: 'center' }),
                          fontSize: '11px',
                        }}
                      >
                        免許・資格
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {licenseRows.map((row, idx) => (
                      <tr key={idx}>
                        <td
                          style={{
                            ...cellStyle({ align: 'center' }),
                            height: '24px',
                          }}
                        >
                          {row.yearMonth}
                        </td>
                        <td style={{ ...cellStyle(), height: '24px' }}>
                          {row.content}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* ---- Motivation / Self-PR section ---- */}
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    marginBottom: '16px',
                  }}
                >
                  <tbody>
                    <tr>
                      <td
                        style={{
                          ...cellStyle({ header: true, width: '100px', vAlign: 'top' }),
                          fontSize: '11px',
                        }}
                      >
                        志望動機
                      </td>
                      <td
                        style={{
                          ...cellStyle({ vAlign: 'top' }),
                          minHeight: '60px',
                          height: '80px',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {form.motivation || ''}
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          ...cellStyle({ header: true, width: '100px', vAlign: 'top' }),
                          fontSize: '11px',
                        }}
                      >
                        自己PR
                      </td>
                      <td
                        style={{
                          ...cellStyle({ vAlign: 'top' }),
                          minHeight: '60px',
                          height: '80px',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {form.self_pr || ''}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* ---- Preferences section ---- */}
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    marginBottom: '24px',
                  }}
                >
                  <tbody>
                    <tr>
                      <td
                        style={{
                          ...cellStyle({ header: true, width: '100px', vAlign: 'top' }),
                          fontSize: '11px',
                        }}
                      >
                        本人希望記入欄
                      </td>
                      <td
                        style={{
                          ...cellStyle({ vAlign: 'top' }),
                          minHeight: '50px',
                          height: '60px',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {form.preferences || ''}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Footer note */}
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: '9px',
                    color: '#aaa',
                    marginTop: '20px',
                  }}
                >
                  <p>この履歴書は Roots 無料ツールにより作成されました</p>
                  <p style={{ marginTop: '2px' }}>roots-app.jp/tools/resume</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ====== CTA Banner ====== */}
        <section className="mt-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 sm:p-10 text-center text-white shadow-xl">
          <h2 className="text-xl sm:text-2xl font-bold mb-3">
            Rootsに登録すると、キャリアデータから履歴書をワンクリック生成
          </h2>
          <p className="text-indigo-100 text-sm sm:text-base mb-6 max-w-xl mx-auto leading-relaxed">
            Rootsに無料登録すると、キャリアデータを自動蓄積。
            <br />
            履歴書・職務経歴書をワンクリックで生成。研修履歴・資格管理もまとめて管理。
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
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
