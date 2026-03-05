'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Download,
  Loader2,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  FileText,
  Building2,
  User,
  CalendarDays,
  PenLine,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useToast } from '@/components/ui/Toast';
import { trackEvent } from '@/lib/analytics';

// ============================================================
// Types
// ============================================================

interface FormData {
  documentType: '退職届' | '退職願';
  name: string;
  department: string;
  facilityName: string;
  representativeName: string;
  resignationDate: string;
  submissionDate: string;
  reason: string;
  customReason: boolean;
}

// ============================================================
// Helpers
// ============================================================

/** Get today as YYYY-MM-DD */
const todayISO = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Convert YYYY-MM-DD to 令和○年○月○日 */
const toWareki = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  if (year > 2019 || (year === 2019 && (month > 4 || (month === 5 && day >= 1)))) {
    const ry = year - 2018;
    return `令和${ry === 1 ? '元' : ry}年${month}月${day}日`;
  }
  if (year >= 1989) {
    const hy = year - 1988;
    return `平成${hy === 1 ? '元' : hy}年${month}月${day}日`;
  }
  return `${year}年${month}月${day}日`;
};

// ============================================================
// Initial State
// ============================================================

const initialFormData: FormData = {
  documentType: '退職届',
  name: '',
  department: '',
  facilityName: '',
  representativeName: '',
  resignationDate: '',
  submissionDate: todayISO(),
  reason: '一身上の都合',
  customReason: false,
};

// ============================================================
// Main Component
// ============================================================

const DRAFT_KEY = 'roots_tool_resignation_draft';

export default function ResignationClient() {
  const { toast } = useToast();

  // ── Restore draft from localStorage on mount ──
  const [hasDraft, setHasDraft] = useState(false);
  const initialState = useRef<{ form: FormData } | null>(null);

  if (initialState.current === null) {
    let restored = false;
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(DRAFT_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.form) {
          initialState.current = {
            form: { ...initialFormData, ...parsed.form },
          };
          restored = true;
        }
      }
    } catch {
      // localStorage not available or corrupted
    }
    if (!restored) {
      initialState.current = {
        form: initialFormData,
      };
    }
  }

  const [form, setForm] = useState<FormData>(initialState.current!.form);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Check if draft existed on mount ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setHasDraft(true);
    } catch {
      // ignore
    }
  }, []);

  // ── Auto-save to localStorage (debounced 3s) ──
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        const data = JSON.stringify({ form });
        localStorage.setItem(DRAFT_KEY, data);
      } catch {
        // localStorage full or not available
      }
    }, 3000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [form]);

  // ── Clear draft ──
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    setHasDraft(false);
  }, []);

  // ----------------------------------------------------------
  // Form handlers
  // ----------------------------------------------------------

  const handleChange = useCallback(
    (field: keyof FormData) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

  const handleDocumentType = useCallback(
    (value: '退職届' | '退職願') => () => {
      setForm((prev) => ({ ...prev, documentType: value }));
      setGenerated(false);
    },
    [],
  );

  const handleCustomReasonToggle = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      customReason: !prev.customReason,
      reason: !prev.customReason ? prev.reason : '一身上の都合',
    }));
    setGenerated(false);
  }, []);

  // Validation
  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<string, string>> = {};
    if (!form.name.trim()) newErrors.name = '氏名は必須です';
    if (!form.facilityName.trim()) newErrors.facilityName = '施設名・法人名は必須です';
    if (!form.representativeName.trim())
      newErrors.representativeName = '代表者名は必須です';
    if (!form.resignationDate) newErrors.resignationDate = '退職希望日は必須です';
    if (!form.submissionDate) newErrors.submissionDate = '提出日は必須です';
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

    if (!previewRef.current) return;
    setGenerating(true);

    try {
      const canvas = await html2canvas(previewRef.current, {
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

      const fileName = `${form.documentType}_${form.name || '未入力'}.pdf`;
      pdf.save(fileName);
      setGenerated(true);
      trackEvent('tool_pdf_generated', { tool: 'resignation' });
      toast.success('PDFをダウンロードしました');
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('PDF生成に失敗しました。もう一度お試しください。');
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
    } px-3 py-2.5 text-sm focus:border-personal focus:ring-2 focus:ring-indigo-100 outline-none transition-colors`;

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

  // ----------------------------------------------------------
  // Preview computed values
  // ----------------------------------------------------------

  const resignationDateWareki = toWareki(form.resignationDate);
  const submissionDateWareki = toWareki(form.submissionDate);

  const documentBody =
    form.documentType === '退職届'
      ? `私儀、このたび${form.reason}により、${resignationDateWareki || '令和　年　月　日'}をもちまして退職いたしたく、ここにお届けいたします。`
      : `私儀、このたび${form.reason}により、${resignationDateWareki || '令和　年　月　日'}をもちまして退職いたしたく、ここにお願い申し上げます。`;

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
            className="flex items-center gap-2 text-gray-800 hover:text-personal transition-colors"
          >
            <FileText className="w-5 h-5 text-personal" />
            <span className="font-semibold text-sm">Roots Tools</span>
          </a>
          <a
            href="/career"
            className="inline-flex items-center gap-1.5 bg-personal hover:bg-personal-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Rootsに無料登録
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      </header>

      {/* ====== Hero ====== */}
      <section className="py-10 sm:py-14 text-center px-4">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-personal-dark text-xs font-medium px-3 py-1.5 rounded-full mb-4">
            <FileText className="w-3.5 h-3.5" />
            無料ツール
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            退職届・退職願ジェネレーター
          </h1>
          <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
            保育士・幼稚園教諭・児童指導員など福祉専門職の方向け。
            <br className="hidden sm:block" />
            必要事項を入力するだけで、正式な退職届・退職願のPDFを無料で作成できます。
          </p>
        </div>
      </section>

      {/* ====== Main content ====== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-8 items-start">
          {/* ---------- Left: Form ---------- */}
          <div className="space-y-6 max-w-2xl">
            {/* Draft indicator */}
            {hasDraft && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center justify-between text-sm">
                <span className="text-amber-700">下書きが自動保存されています</span>
                <button
                  onClick={clearDraft}
                  className="text-amber-600 hover:text-amber-800 text-xs underline"
                >
                  下書きを削除
                </button>
              </div>
            )}

            {/* Section 1: 書類の種類 */}
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {sectionHeader(
                <PenLine className="w-4 h-4 text-personal" />,
                '書類の種類',
              )}
              <div className="p-5 space-y-4">
                <div>
                  <label className={labelClass}>種類{requiredBadge}</label>
                  <div className="flex gap-4 mt-1">
                    {(['退職届', '退職願'] as const).map((type) => (
                      <label
                        key={type}
                        className="flex items-center gap-2 cursor-pointer text-sm text-gray-700"
                      >
                        <input
                          type="radio"
                          name="documentType"
                          checked={form.documentType === type}
                          onChange={handleDocumentType(type)}
                          className="w-4 h-4 text-personal focus:ring-personal border-gray-300"
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                    <span className="font-medium">退職届</span>
                    ：退職を通告する書類（撤回不可）。
                    <span className="font-medium ml-2">退職願</span>
                    ：退職を願い出る書類（承認前なら撤回可能）。
                  </p>
                </div>
              </div>
            </section>

            {/* Section 2: 宛先情報 */}
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {sectionHeader(
                <Building2 className="w-4 h-4 text-personal" />,
                '宛先情報',
              )}
              <div className="p-5 space-y-4">
                {/* 施設名・法人名 */}
                <div data-error={!!errors.facilityName || undefined}>
                  <label className={labelClass}>
                    施設名・法人名{requiredBadge}
                  </label>
                  <input
                    type="text"
                    placeholder="社会福祉法人○○会 ○○保育園"
                    value={form.facilityName}
                    onChange={handleChange('facilityName')}
                    className={inputClass('facilityName')}
                  />
                  {errors.facilityName && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.facilityName}
                    </p>
                  )}
                </div>
                {/* 代表者名 */}
                <div data-error={!!errors.representativeName || undefined}>
                  <label className={labelClass}>
                    代表者名{requiredBadge}
                  </label>
                  <input
                    type="text"
                    placeholder="理事長 山田太郎"
                    value={form.representativeName}
                    onChange={handleChange('representativeName')}
                    className={inputClass('representativeName')}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    役職と氏名を入力してください（例：理事長 山田太郎、園長 鈴木花子）
                  </p>
                  {errors.representativeName && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.representativeName}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Section 3: 届出者情報 */}
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {sectionHeader(
                <User className="w-4 h-4 text-personal" />,
                '届出者情報',
              )}
              <div className="p-5 space-y-4">
                {/* 氏名 */}
                <div data-error={!!errors.name || undefined}>
                  <label className={labelClass}>
                    氏名{requiredBadge}
                  </label>
                  <input
                    type="text"
                    placeholder="山田 花子"
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
                {/* 所属部署 */}
                <div>
                  <label className={labelClass}>所属部署（任意）</label>
                  <input
                    type="text"
                    placeholder="ひまわり組"
                    value={form.department}
                    onChange={handleChange('department')}
                    className={inputClass()}
                  />
                </div>
              </div>
            </section>

            {/* Section 4: 退職に関する情報 */}
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {sectionHeader(
                <CalendarDays className="w-4 h-4 text-personal" />,
                '退職に関する情報',
              )}
              <div className="p-5 space-y-4">
                {/* 退職希望日 */}
                <div data-error={!!errors.resignationDate || undefined}>
                  <label className={labelClass}>
                    退職希望日{requiredBadge}
                  </label>
                  <input
                    type="date"
                    value={form.resignationDate}
                    onChange={handleChange('resignationDate')}
                    className={inputClass('resignationDate')}
                  />
                  {errors.resignationDate && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.resignationDate}
                    </p>
                  )}
                </div>
                {/* 提出日 */}
                <div data-error={!!errors.submissionDate || undefined}>
                  <label className={labelClass}>
                    提出日{requiredBadge}
                  </label>
                  <input
                    type="date"
                    value={form.submissionDate}
                    onChange={handleChange('submissionDate')}
                    className={inputClass('submissionDate')}
                  />
                  {errors.submissionDate && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.submissionDate}
                    </p>
                  )}
                </div>
                {/* 退職理由 */}
                <div>
                  <label className={labelClass}>退職理由</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={form.customReason}
                        onChange={handleCustomReasonToggle}
                        className="w-4 h-4 rounded text-personal focus:ring-personal border-gray-300"
                      />
                      理由をカスタマイズする
                    </label>
                    {form.customReason ? (
                      <textarea
                        rows={2}
                        placeholder="退職理由を入力"
                        value={form.reason}
                        onChange={handleChange('reason')}
                        className={inputClass()}
                      />
                    ) : (
                      <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                        一身上の都合
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      一般的には「一身上の都合」で問題ありません。会社都合退職の場合は理由をカスタマイズしてください。
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Download button (mobile + form area) */}
            <button
              onClick={handleGeneratePdf}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 bg-personal hover:bg-personal-dark disabled:bg-indigo-300 text-white font-semibold py-3.5 rounded-xl transition-colors shadow-lg shadow-indigo-200"
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
                className="hidden xl:inline-flex items-center gap-1.5 bg-personal hover:bg-personal-dark disabled:bg-indigo-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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
              {/* A4 resignation letter preview */}
              <div
                ref={previewRef}
                className="bg-white mx-auto shadow-sm"
                style={{
                  width: '794px',
                  minHeight: '1123px',
                  padding: '80px 80px 80px 80px',
                  fontFamily:
                    '"Hiragino Mincho ProN", "Yu Mincho", "MS PMincho", "Noto Serif JP", serif',
                  fontSize: '14px',
                  lineHeight: '2.0',
                  color: '#1a1a1a',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* ---- Title ---- */}
                <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                  <h1
                    style={{
                      fontSize: '28px',
                      fontWeight: 'bold',
                      letterSpacing: '0.8em',
                      margin: 0,
                    }}
                  >
                    {form.documentType === '退職届' ? '退 職 届' : '退 職 願'}
                  </h1>
                </div>

                {/* ---- Addressee ---- */}
                <div style={{ marginBottom: '40px' }}>
                  <p style={{ fontSize: '15px', marginBottom: '4px' }}>
                    {form.facilityName || '○○法人 ○○施設'}
                  </p>
                  <p style={{ fontSize: '15px' }}>
                    {form.representativeName
                      ? `${form.representativeName} 殿`
                      : '代表者 ○○ 殿'}
                  </p>
                </div>

                {/* ---- Body ---- */}
                <div style={{ marginBottom: '50px', textIndent: '1em' }}>
                  <p style={{ fontSize: '14px', lineHeight: '2.2' }}>{documentBody}</p>
                </div>

                {/* ---- Date + Signature (pushed to bottom-right) ---- */}
                <div style={{ marginTop: 'auto' }}>
                  {/* Submission date */}
                  <div style={{ textAlign: 'right', marginBottom: '40px' }}>
                    <p style={{ fontSize: '14px' }}>
                      {submissionDateWareki || '令和　年　月　日'}
                    </p>
                  </div>

                  {/* Affiliation + name */}
                  <div style={{ textAlign: 'right', marginBottom: '8px' }}>
                    {form.department && (
                      <p style={{ fontSize: '13px', marginBottom: '4px' }}>
                        所属: {form.department}
                      </p>
                    )}
                    <p style={{ fontSize: '16px', fontWeight: 500 }}>
                      氏名: {form.name || '○○ ○○'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ====== CTA Banner ====== */}
        <section className="mt-16 bg-gradient-to-r from-personal to-personal-dark rounded-2xl p-8 sm:p-10 text-center text-white shadow-xl">
          <h2 className="text-xl sm:text-2xl font-bold mb-3">
            次のキャリアをRootsで見つけよう
          </h2>
          <p className="text-indigo-100 text-sm sm:text-base mb-6 max-w-xl mx-auto leading-relaxed">
            Rootsに無料登録すると、保育・福祉業界の求人情報にアクセスできます。
            <br />
            履歴書・職務経歴書の作成ツールや、研修履歴・資格管理もまとめて利用可能。
          </p>
          <a
            href="/career"
            className="inline-flex items-center gap-2 bg-white text-personal-dark font-semibold px-6 py-3 rounded-xl hover:bg-indigo-50 transition-colors shadow-lg"
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
