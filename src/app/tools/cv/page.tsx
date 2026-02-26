'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Plus,
  Trash2,
  Download,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  FileText,
  Award,
  User,
  Sparkles,
  Loader2,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface WorkEntry {
  id: string;
  company_name: string;
  facility_type: string;
  start_year: string;
  start_month: string;
  end_year: string;
  end_month: string;
  employment_type: string;
  job_title: string;
  duties: string;
  collapsed: boolean;
}

interface Qualification {
  id: string;
  year: string;
  month: string;
  name: string;
}

interface CvFormData {
  name: string;
  creation_date: string;
  summary: string;
  work_entries: WorkEntry[];
  qualifications: Qualification[];
  skills: string;
  self_pr: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const FACILITY_TYPES = [
  '児童発達支援',
  '放課後等デイサービス',
  '保育所',
  '認定こども園',
  '障害者支援施設',
  'その他',
];

const EMPLOYMENT_TYPES = ['正社員(常勤)', '契約社員', 'パート・アルバイト'];

const YEARS = Array.from({ length: 61 }, (_, i) => String(1970 + i));
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1));

// ─── Helpers ────────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateJP(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

function createEmptyWork(): WorkEntry {
  return {
    id: generateId(),
    company_name: '',
    facility_type: FACILITY_TYPES[0],
    start_year: '',
    start_month: '',
    end_year: '',
    end_month: '',
    employment_type: EMPLOYMENT_TYPES[0],
    job_title: '',
    duties: '',
    collapsed: false,
  };
}

function createEmptyQualification(): Qualification {
  return {
    id: generateId(),
    year: '',
    month: '',
    name: '',
  };
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function CvGeneratorPage() {
  const [formData, setFormData] = useState<CvFormData>({
    name: '',
    creation_date: todayString(),
    summary: '',
    work_entries: [createEmptyWork()],
    qualifications: [createEmptyQualification()],
    skills: '',
    self_pr: '',
  });

  const [isExporting, setIsExporting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // ── Field updaters ──

  const updateField = useCallback(
    <K extends keyof CvFormData>(key: K, value: CvFormData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateWorkEntry = useCallback(
    (id: string, field: keyof WorkEntry, value: string | boolean) => {
      setFormData((prev) => ({
        ...prev,
        work_entries: prev.work_entries.map((w) =>
          w.id === id ? { ...w, [field]: value } : w
        ),
      }));
    },
    []
  );

  const addWorkEntry = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      work_entries: [...prev.work_entries, createEmptyWork()],
    }));
  }, []);

  const removeWorkEntry = useCallback((id: string) => {
    setFormData((prev) => ({
      ...prev,
      work_entries: prev.work_entries.filter((w) => w.id !== id),
    }));
  }, []);

  const toggleWorkCollapse = useCallback((id: string) => {
    setFormData((prev) => ({
      ...prev,
      work_entries: prev.work_entries.map((w) =>
        w.id === id ? { ...w, collapsed: !w.collapsed } : w
      ),
    }));
  }, []);

  const updateQualification = useCallback(
    (id: string, field: keyof Qualification, value: string) => {
      setFormData((prev) => ({
        ...prev,
        qualifications: prev.qualifications.map((q) =>
          q.id === id ? { ...q, [field]: value } : q
        ),
      }));
    },
    []
  );

  const addQualification = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      qualifications: [...prev.qualifications, createEmptyQualification()],
    }));
  }, []);

  const removeQualification = useCallback((id: string) => {
    setFormData((prev) => ({
      ...prev,
      qualifications: prev.qualifications.filter((q) => q.id !== id),
    }));
  }, []);

  // ── PDF Export ──

  const handleExportPDF = useCallback(async () => {
    if (!previewRef.current) return;
    if (!formData.name.trim()) {
      alert('氏名を入力してください。');
      return;
    }
    setIsExporting(true);

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const element = previewRef.current;

      // Capture the preview element at high resolution
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: element.scrollWidth,
        height: element.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const margin = 5;
      const usableWidth = pdfWidth - margin * 2;
      const imgAspect = canvas.height / canvas.width;
      const imgWidthMM = usableWidth;
      const imgHeightMM = usableWidth * imgAspect;

      // Multi-page handling
      if (imgHeightMM <= pdfHeight - margin * 2) {
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidthMM, imgHeightMM);
      } else {
        const usablePageHeight = pdfHeight - margin * 2;
        let remainingHeight = imgHeightMM;
        let srcY = 0;
        let page = 0;

        while (remainingHeight > 0) {
          if (page > 0) pdf.addPage();

          const sliceHeight = Math.min(usablePageHeight, remainingHeight);
          const sliceRatio = sliceHeight / imgHeightMM;
          const srcHeight = canvas.height * sliceRatio;

          // Create a slice canvas
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = srcHeight;
          const ctx = sliceCanvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            ctx.drawImage(
              canvas,
              0,
              srcY,
              canvas.width,
              srcHeight,
              0,
              0,
              canvas.width,
              srcHeight
            );
          }

          const sliceData = sliceCanvas.toDataURL('image/png');
          pdf.addImage(sliceData, 'PNG', margin, margin, imgWidthMM, sliceHeight);

          srcY += srcHeight;
          remainingHeight -= sliceHeight;
          page++;
        }
      }

      pdf.save('職務経歴書.pdf');
    } catch (err) {
      console.error('PDF export error:', err);
      alert('PDFの書き出しに失敗しました。もう一度お試しください。');
    } finally {
      setIsExporting(false);
    }
  }, [formData.name]);

  // ── Sorted qualifications for display ──

  const sortedQualifications = [...formData.qualifications]
    .filter((q) => q.year && q.name.trim())
    .sort((a, b) => {
      const aVal = parseInt(a.year) * 100 + parseInt(a.month || '0');
      const bVal = parseInt(b.year) * 100 + parseInt(b.month || '0');
      return aVal - bVal;
    });

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/tools"
            className="text-lg font-bold tracking-tight text-indigo-700 hover:text-indigo-800 transition-colors"
          >
            Roots Tools
          </Link>
          <Link
            href="/career"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            Rootsに無料登録
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-7xl px-4 pb-4 pt-8 sm:px-6 sm:pt-12">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100">
            <Briefcase className="h-7 w-7 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
            職務経歴書 自動生成
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-gray-500 sm:text-lg">
            保育・福祉専門職向けのフォーマットで、
            <br className="hidden sm:block" />
            職務経歴書PDFを無料で作成できます。
          </p>
        </div>
      </section>

      {/* ── Main ── */}
      <main className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* ── Left Column: Form ── */}
          <div className="space-y-6 lg:col-span-3">
            {/* ──── Section 1: 基本情報 ──── */}
            <FormSection icon={<User className="h-5 w-5" />} title="基本情報">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    氏名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="山田 花子"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    作成日
                  </label>
                  <input
                    type="date"
                    value={formData.creation_date}
                    onChange={(e) => updateField('creation_date', e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
                  />
                </div>
              </div>
            </FormSection>

            {/* ──── Section 2: 職務要約 ──── */}
            <FormSection icon={<FileText className="h-5 w-5" />} title="職務要約">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  職務要約
                </label>
                <textarea
                  value={formData.summary}
                  onChange={(e) => updateField('summary', e.target.value)}
                  placeholder="保育・福祉分野で○年の実務経験があります。○○を中心に..."
                  rows={4}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors resize-none"
                />
              </div>
            </FormSection>

            {/* ──── Section 3: 職務経歴 ──── */}
            <FormSection icon={<Briefcase className="h-5 w-5" />} title="職務経歴">
              <div className="space-y-4">
                {formData.work_entries.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                  >
                    {/* Card Header */}
                    <div
                      className="flex items-center justify-between bg-gray-50 px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => toggleWorkCollapse(entry.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-semibold text-gray-800 truncate">
                          {entry.company_name || '(勤務先を入力)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {formData.work_entries.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeWorkEntry(entry.id);
                            }}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            title="削除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        {entry.collapsed ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronUp className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Card Body */}
                    {!entry.collapsed && (
                      <div className="space-y-4 p-4">
                        {/* 勤務先名 */}
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            勤務先名 <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={entry.company_name}
                            onChange={(e) =>
                              updateWorkEntry(entry.id, 'company_name', e.target.value)
                            }
                            placeholder="社会福祉法人○○ ○○保育園"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
                          />
                        </div>

                        {/* 施設種別 & 雇用形態 */}
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                              施設種別
                            </label>
                            <select
                              value={entry.facility_type}
                              onChange={(e) =>
                                updateWorkEntry(entry.id, 'facility_type', e.target.value)
                              }
                              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors bg-white"
                            >
                              {FACILITY_TYPES.map((ft) => (
                                <option key={ft} value={ft}>
                                  {ft}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                              雇用形態
                            </label>
                            <select
                              value={entry.employment_type}
                              onChange={(e) =>
                                updateWorkEntry(entry.id, 'employment_type', e.target.value)
                              }
                              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors bg-white"
                            >
                              {EMPLOYMENT_TYPES.map((et) => (
                                <option key={et} value={et}>
                                  {et}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* 在籍期間 */}
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            在籍期間
                          </label>
                          <div className="flex flex-wrap items-center gap-2">
                            <YearMonthSelect
                              yearValue={entry.start_year}
                              monthValue={entry.start_month}
                              onYearChange={(v) =>
                                updateWorkEntry(entry.id, 'start_year', v)
                              }
                              onMonthChange={(v) =>
                                updateWorkEntry(entry.id, 'start_month', v)
                              }
                              yearPlaceholder="開始年"
                              monthPlaceholder="月"
                            />
                            <span className="text-gray-400 text-sm">〜</span>
                            <YearMonthSelect
                              yearValue={entry.end_year}
                              monthValue={entry.end_month}
                              onYearChange={(v) =>
                                updateWorkEntry(entry.id, 'end_year', v)
                              }
                              onMonthChange={(v) =>
                                updateWorkEntry(entry.id, 'end_month', v)
                              }
                              yearPlaceholder="終了年"
                              monthPlaceholder="月"
                            />
                            <span className="text-xs text-gray-400">
                              (空欄 = 現在)
                            </span>
                          </div>
                        </div>

                        {/* 職種・役職 */}
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            職種・役職
                          </label>
                          <input
                            type="text"
                            value={entry.job_title}
                            onChange={(e) =>
                              updateWorkEntry(entry.id, 'job_title', e.target.value)
                            }
                            placeholder="保育士、児童発達支援管理責任者 など"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
                          />
                        </div>

                        {/* 担当業務・実績 */}
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            担当業務・実績
                          </label>
                          <textarea
                            value={entry.duties}
                            onChange={(e) =>
                              updateWorkEntry(entry.id, 'duties', e.target.value)
                            }
                            placeholder={`・0〜2歳児クラス担任（12名）\n・個別支援計画の作成・実施\n・保護者面談の実施（月4回）\n・新人職員の指導・育成`}
                            rows={5}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors resize-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <button
                  onClick={addWorkEntry}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 px-4 py-3 text-sm font-semibold text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  職歴を追加
                </button>
              </div>
            </FormSection>

            {/* ──── Section 4: 保有資格・免許 ──── */}
            <FormSection icon={<Award className="h-5 w-5" />} title="保有資格・免許">
              <div className="space-y-3">
                {formData.qualifications.map((qual, idx) => (
                  <div
                    key={qual.id}
                    className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <YearMonthSelect
                        yearValue={qual.year}
                        monthValue={qual.month}
                        onYearChange={(v) =>
                          updateQualification(qual.id, 'year', v)
                        }
                        onMonthChange={(v) =>
                          updateQualification(qual.id, 'month', v)
                        }
                        yearPlaceholder="取得年"
                        monthPlaceholder="月"
                      />
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <label className="mb-1 block text-xs font-medium text-gray-500">
                        資格名
                      </label>
                      <input
                        type="text"
                        value={qual.name}
                        onChange={(e) =>
                          updateQualification(qual.id, 'name', e.target.value)
                        }
                        placeholder="保育士、社会福祉士 など"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
                      />
                    </div>
                    {formData.qualifications.length > 1 && (
                      <button
                        onClick={() => removeQualification(qual.id)}
                        className="rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="削除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  onClick={addQualification}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 px-4 py-3 text-sm font-semibold text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  資格を追加
                </button>
              </div>
            </FormSection>

            {/* ──── Section 5: スキル・得意分野 ──── */}
            <FormSection icon={<Sparkles className="h-5 w-5" />} title="スキル・得意分野">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  スキル
                </label>
                <textarea
                  value={formData.skills}
                  onChange={(e) => updateField('skills', e.target.value)}
                  placeholder={`・児童発達支援\n・感覚統合療法\n・保護者支援・相談対応\n・ICT活用（タブレット療育）`}
                  rows={4}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors resize-none"
                />
              </div>
            </FormSection>

            {/* ──── Section 6: 自己PR ──── */}
            <FormSection icon={<FileText className="h-5 w-5" />} title="自己PR">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  自己PR
                </label>
                <textarea
                  value={formData.self_pr}
                  onChange={(e) => updateField('self_pr', e.target.value)}
                  placeholder="これまでの経験で培ったスキルや強み、今後の目標などをご記入ください。"
                  rows={5}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors resize-none"
                />
              </div>
            </FormSection>

            {/* ── Download Button (mobile) ── */}
            <div className="lg:hidden">
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-4 text-base font-bold text-white shadow-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {isExporting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
                {isExporting ? 'PDF生成中...' : 'PDFをダウンロード'}
              </button>
            </div>

            {/* ── CTA ── */}
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 flex-shrink-0">
                  <Sparkles className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900">
                    Rootsに登録すると、日々の業務記録から職務経歴書を自動生成
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    毎日の保育記録や活動ログから、担当業務・実績を自動で整理。
                    転職時に一から書き直す手間がなくなります。
                  </p>
                  <Link
                    href="/career"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
                  >
                    Rootsに無料登録
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right Column: Preview + Download ── */}
          <div className="lg:col-span-2">
            <div className="sticky top-20 space-y-4">
              {/* Download Button (desktop) */}
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="hidden lg:flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-bold text-white shadow-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {isExporting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Download className="h-5 w-5" />
                )}
                {isExporting ? 'PDF生成中...' : 'PDFをダウンロード'}
              </button>

              {/* A4 Preview */}
              <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                <p className="mb-2 text-center text-xs font-medium text-gray-400">
                  プレビュー
                </p>
                <div className="overflow-y-auto max-h-[80vh] rounded-lg border border-gray-100">
                  <div
                    ref={previewRef}
                    className="bg-white"
                    style={{
                      width: '595px',
                      minHeight: '842px',
                      padding: '40px 45px',
                      fontFamily:
                        '"Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "MS PMincho", serif',
                      fontSize: '11px',
                      lineHeight: '1.7',
                      color: '#1a1a1a',
                      transform: 'scale(0.47)',
                      transformOrigin: 'top left',
                    }}
                  >
                    <PreviewContent
                      formData={formData}
                      sortedQualifications={sortedQualifications}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════════

/** Year-Month select combo */
function YearMonthSelect({
  yearValue,
  monthValue,
  onYearChange,
  onMonthChange,
  yearPlaceholder,
  monthPlaceholder,
}: {
  yearValue: string;
  monthValue: string;
  onYearChange: (v: string) => void;
  onMonthChange: (v: string) => void;
  yearPlaceholder: string;
  monthPlaceholder: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <select
        value={yearValue}
        onChange={(e) => onYearChange(e.target.value)}
        className="rounded-lg border border-gray-200 px-2 py-2 text-sm text-gray-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors bg-white"
      >
        <option value="">{yearPlaceholder}</option>
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}年
          </option>
        ))}
      </select>
      <select
        value={monthValue}
        onChange={(e) => onMonthChange(e.target.value)}
        className="rounded-lg border border-gray-200 px-2 py-2 text-sm text-gray-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors bg-white"
      >
        <option value="">{monthPlaceholder}</option>
        {MONTHS.map((m) => (
          <option key={m} value={m}>
            {m}月
          </option>
        ))}
      </select>
    </div>
  );
}

/** Card wrapper for form sections */
function FormSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-indigo-600">{icon}</span>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

/** Preview content rendered inside the A4 box */
function PreviewContent({
  formData,
  sortedQualifications,
}: {
  formData: CvFormData;
  sortedQualifications: Qualification[];
}) {
  const workPeriodStr = (entry: WorkEntry) => {
    const start =
      entry.start_year && entry.start_month
        ? `${entry.start_year}年${entry.start_month}月`
        : entry.start_year
          ? `${entry.start_year}年`
          : '';
    if (!start) return '';
    const end =
      entry.end_year && entry.end_month
        ? `${entry.end_year}年${entry.end_month}月`
        : entry.end_year
          ? `${entry.end_year}年`
          : '現在';
    return `${start} 〜 ${end}`;
  };

  return (
    <>
      {/* Title */}
      <h1
        style={{
          textAlign: 'center',
          fontSize: '20px',
          fontWeight: 'bold',
          letterSpacing: '0.6em',
          marginBottom: '8px',
        }}
      >
        職 務 経 歴 書
      </h1>

      {/* Date */}
      {formData.creation_date && (
        <p style={{ textAlign: 'right', fontSize: '10px', marginBottom: '2px' }}>
          {formatDateJP(formData.creation_date)}
        </p>
      )}

      {/* Name */}
      {formData.name && (
        <p
          style={{
            textAlign: 'right',
            fontSize: '12px',
            fontWeight: 'bold',
            marginBottom: '20px',
          }}
        >
          氏名：{formData.name}
        </p>
      )}

      {/* 職務要約 */}
      {formData.summary.trim() && (
        <div style={{ marginBottom: '18px' }}>
          <SectionHeader>職務要約</SectionHeader>
          <p
            style={{
              whiteSpace: 'pre-wrap',
              fontSize: '11px',
              lineHeight: '1.8',
              paddingLeft: '4px',
            }}
          >
            {formData.summary}
          </p>
        </div>
      )}

      {/* 職務経歴 */}
      {formData.work_entries.some((w) => w.company_name.trim()) && (
        <div style={{ marginBottom: '18px' }}>
          <SectionHeader>職務経歴</SectionHeader>
          {formData.work_entries
            .filter((w) => w.company_name.trim())
            .map((entry, idx) => (
              <div
                key={entry.id}
                style={{
                  marginBottom: '14px',
                  paddingLeft: '4px',
                }}
              >
                {/* Company header */}
                <p
                  style={{
                    fontSize: '12px',
                    fontWeight: 'bold',
                    marginBottom: '2px',
                    borderBottom: '1px solid #d1d5db',
                    paddingBottom: '2px',
                  }}
                >
                  {entry.company_name}
                  {entry.facility_type && (
                    <span
                      style={{
                        fontWeight: 'normal',
                        fontSize: '10px',
                        marginLeft: '8px',
                        color: '#6b7280',
                      }}
                    >
                      ({entry.facility_type})
                    </span>
                  )}
                </p>

                {/* Period & employment type */}
                <p style={{ fontSize: '10px', color: '#4b5563', marginBottom: '2px' }}>
                  {workPeriodStr(entry)}
                  {entry.employment_type && (
                    <span style={{ marginLeft: '12px' }}>
                      {entry.employment_type}
                    </span>
                  )}
                </p>

                {/* Job title */}
                {entry.job_title && (
                  <p
                    style={{
                      fontSize: '11px',
                      fontWeight: 'bold',
                      marginBottom: '4px',
                    }}
                  >
                    {entry.job_title}
                  </p>
                )}

                {/* Duties */}
                {entry.duties.trim() && (
                  <div style={{ paddingLeft: '8px', fontSize: '10.5px' }}>
                    <p style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '10px' }}>
                      担当業務：
                    </p>
                    {entry.duties.split('\n').map((line, i) => (
                      <p key={i} style={{ lineHeight: '1.7', margin: 0 }}>
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* 保有資格・免許 */}
      {sortedQualifications.length > 0 && (
        <div style={{ marginBottom: '18px' }}>
          <SectionHeader>保有資格・免許</SectionHeader>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '10.5px',
              marginLeft: '4px',
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: 'left',
                    borderBottom: '1px solid #d1d5db',
                    paddingBottom: '3px',
                    width: '100px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    color: '#374151',
                  }}
                >
                  取得年月
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    borderBottom: '1px solid #d1d5db',
                    paddingBottom: '3px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    color: '#374151',
                  }}
                >
                  資格・免許名
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedQualifications.map((q) => (
                <tr key={q.id}>
                  <td
                    style={{
                      paddingTop: '3px',
                      paddingBottom: '3px',
                      borderBottom: '1px solid #e5e7eb',
                      color: '#4b5563',
                    }}
                  >
                    {q.year}年{q.month && `${q.month}月`}
                  </td>
                  <td
                    style={{
                      paddingTop: '3px',
                      paddingBottom: '3px',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    {q.name}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* スキル・得意分野 */}
      {formData.skills.trim() && (
        <div style={{ marginBottom: '18px' }}>
          <SectionHeader>スキル・得意分野</SectionHeader>
          <div style={{ paddingLeft: '4px', fontSize: '10.5px' }}>
            {formData.skills.split('\n').map((line, i) => (
              <p key={i} style={{ lineHeight: '1.7', margin: 0 }}>
                {line}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 自己PR */}
      {formData.self_pr.trim() && (
        <div style={{ marginBottom: '18px' }}>
          <SectionHeader>自己PR</SectionHeader>
          <p
            style={{
              whiteSpace: 'pre-wrap',
              fontSize: '11px',
              lineHeight: '1.8',
              paddingLeft: '4px',
            }}
          >
            {formData.self_pr}
          </p>
        </div>
      )}
    </>
  );
}

/** Section header in the preview, e.g. 【職務要約】 */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: '12px',
        fontWeight: 'bold',
        marginBottom: '6px',
        paddingBottom: '3px',
        borderBottom: '2px solid #1a1a1a',
      }}
    >
      【{children}】
    </p>
  );
}
