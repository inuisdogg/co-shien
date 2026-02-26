'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  Download,
  Briefcase,
  Award,
  BookOpen,
  TrendingUp,
  MoreHorizontal,
  Calendar,
  Building2,
  X,
  ChevronRight,
  Clock,
  FileText,
  Star,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────

type Category = 'employment' | 'qualification' | 'training' | 'promotion' | 'other';

interface CareerEntry {
  id: string;
  start_date: string;
  end_date: string;
  category: Category;
  title: string;
  description: string;
  facility: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  Category,
  { label: string; color: string; bgLight: string; borderColor: string; icon: typeof Briefcase }
> = {
  employment: {
    label: '就職・転職',
    color: '#3B82F6',
    bgLight: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: Briefcase,
  },
  qualification: {
    label: '資格取得',
    color: '#10B981',
    bgLight: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    icon: Award,
  },
  training: {
    label: '研修受講',
    color: '#8B5CF6',
    bgLight: 'bg-violet-50',
    borderColor: 'border-violet-200',
    icon: BookOpen,
  },
  promotion: {
    label: '役職変更',
    color: '#F59E0B',
    bgLight: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: TrendingUp,
  },
  other: {
    label: 'その他',
    color: '#6B7280',
    bgLight: 'bg-gray-50',
    borderColor: 'border-gray-200',
    icon: MoreHorizontal,
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function calculateDuration(startDate: string, endDate?: string): string {
  const start = new Date(startDate + '-01');
  const end = endDate ? new Date(endDate + '-01') : new Date();
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  if (months < 0) return '';
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years > 0 && remainingMonths > 0) return `${years}年${remainingMonths}ヶ月`;
  if (years > 0) return `${years}年`;
  if (remainingMonths === 0) return '1ヶ月未満';
  return `${remainingMonths}ヶ月`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '現在';
  const [year, month] = dateStr.split('-');
  return `${year}年${parseInt(month)}月`;
}

function emptyEntry(): Omit<CareerEntry, 'id'> {
  return {
    start_date: '',
    end_date: '',
    category: 'employment',
    title: '',
    description: '',
    facility: '',
  };
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function CareerTimelinePage() {
  const [entries, setEntries] = useState<CareerEntry[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<CareerEntry, 'id'>>(emptyEntry());
  const [userName, setUserName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const timelineRef = useRef<HTMLDivElement>(null);

  // ── Sorted entries (newest first) ──
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.start_date < b.start_date) return 1;
    if (a.start_date > b.start_date) return -1;
    return 0;
  });

  // ── Career Summary Stats ──
  const stats = (() => {
    const facilities = new Set(
      entries.filter((e) => e.facility.trim()).map((e) => e.facility.trim())
    );
    const qualifications = entries.filter((e) => e.category === 'qualification').length;
    const trainings = entries.filter((e) => e.category === 'training').length;

    // Total experience: sum of employment durations
    const employmentEntries = entries.filter((e) => e.category === 'employment');
    let totalMonths = 0;
    employmentEntries.forEach((e) => {
      const start = new Date(e.start_date + '-01');
      const end = e.end_date ? new Date(e.end_date + '-01') : new Date();
      const diff =
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth());
      if (diff > 0) totalMonths += diff;
    });
    const totalYears = Math.floor(totalMonths / 12);
    const remainingMonths = totalMonths % 12;
    let totalExpStr = '';
    if (totalYears > 0 && remainingMonths > 0)
      totalExpStr = `${totalYears}年${remainingMonths}ヶ月`;
    else if (totalYears > 0) totalExpStr = `${totalYears}年`;
    else if (remainingMonths > 0) totalExpStr = `${remainingMonths}ヶ月`;
    else totalExpStr = '−';

    return {
      totalExperience: totalExpStr,
      facilityCount: facilities.size,
      qualificationCount: qualifications,
      trainingCount: trainings,
    };
  })();

  // ── Form Handlers ──

  const openAddModal = useCallback(() => {
    setEditingId(null);
    setForm(emptyEntry());
    setFormErrors({});
    setShowModal(true);
  }, []);

  const openEditModal = useCallback((entry: CareerEntry) => {
    setEditingId(entry.id);
    setForm({
      start_date: entry.start_date,
      end_date: entry.end_date,
      category: entry.category,
      title: entry.title,
      description: entry.description,
      facility: entry.facility,
    });
    setFormErrors({});
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyEntry());
    setFormErrors({});
  }, []);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.start_date) errors.start_date = '開始日を入力してください';
    if (!form.title.trim()) errors.title = 'タイトルを入力してください';
    if (form.end_date && form.end_date < form.start_date) {
      errors.end_date = '終了日は開始日より後にしてください';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = useCallback(() => {
    if (!validateForm()) return;

    if (editingId) {
      setEntries((prev) =>
        prev.map((e) => (e.id === editingId ? { ...e, ...form } : e))
      );
    } else {
      setEntries((prev) => [...prev, { id: generateId(), ...form }]);
    }
    closeModal();
  }, [editingId, form, closeModal]);

  const handleDelete = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // ── PDF Export ──

  const handleExportPDF = useCallback(async () => {
    if (!timelineRef.current || entries.length === 0) return;
    setIsExporting(true);

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const element = timelineRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Title
      pdf.setFontSize(18);
      pdf.setTextColor(67, 56, 202); // indigo-700
      pdf.text('キャリア年表', pdfWidth / 2, 20, { align: 'center' });

      if (userName.trim()) {
        pdf.setFontSize(12);
        pdf.setTextColor(107, 114, 128);
        pdf.text(userName.trim(), pdfWidth / 2, 28, { align: 'center' });
      }

      const topOffset = userName.trim() ? 35 : 28;
      const availableHeight = pdfHeight - topOffset - 10;
      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight <= availableHeight) {
        pdf.addImage(imgData, 'PNG', 10, topOffset, imgWidth, imgHeight);
      } else {
        // Scale to fit page
        const scale = availableHeight / imgHeight;
        const scaledWidth = imgWidth * scale;
        const scaledHeight = imgHeight * scale;
        pdf.addImage(
          imgData,
          'PNG',
          (pdfWidth - scaledWidth) / 2,
          topOffset,
          scaledWidth,
          scaledHeight
        );
      }

      pdf.save('キャリア年表.pdf');
    } catch (err) {
      console.error('PDF export error:', err);
      alert('PDFの書き出しに失敗しました。もう一度お試しください。');
    } finally {
      setIsExporting(false);
    }
  }, [entries, userName]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <a
            href="/tools"
            className="text-lg font-bold tracking-tight text-indigo-700 hover:text-indigo-800 transition-colors"
          >
            Roots Tools
          </a>
          <a
            href="/career"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            Rootsに無料登録
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-7xl px-4 pb-4 pt-8 sm:px-6 sm:pt-12">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100">
            <Calendar className="h-7 w-7 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
            キャリア年表メーカー
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-gray-500 sm:text-lg">
            あなたの保育キャリアを美しいタイムラインで可視化。
            <br className="hidden sm:block" />
            就職活動やキャリアの振り返りにご活用ください。
          </p>
        </div>
      </section>

      {/* ── Main Content ── */}
      <main className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        {/* ── Stats ── */}
        {entries.length > 0 && (
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 animate-in fade-in">
            <StatCard
              icon={<Clock className="h-5 w-5 text-indigo-500" />}
              label="総経験年数"
              value={stats.totalExperience}
            />
            <StatCard
              icon={<Building2 className="h-5 w-5 text-blue-500" />}
              label="施設数"
              value={stats.facilityCount > 0 ? `${stats.facilityCount}施設` : '−'}
            />
            <StatCard
              icon={<Award className="h-5 w-5 text-emerald-500" />}
              label="資格数"
              value={
                stats.qualificationCount > 0 ? `${stats.qualificationCount}件` : '−'
              }
            />
            <StatCard
              icon={<BookOpen className="h-5 w-5 text-violet-500" />}
              label="研修数"
              value={stats.trainingCount > 0 ? `${stats.trainingCount}件` : '−'}
            />
          </div>
        )}

        {/* ── Two-Column Layout ── */}
        <div className="grid gap-8 lg:grid-cols-5">
          {/* ── Left: Entry List + Add Button ── */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">キャリアエントリー</h2>
                <button
                  onClick={openAddModal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  追加
                </button>
              </div>

              {/* User Name Input */}
              <div className="mb-4">
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  お名前（PDF出力用・任意）
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="山田 花子"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
                />
              </div>

              {/* Entry Cards */}
              {entries.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50">
                    <FileText className="h-8 w-8 text-indigo-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">
                    まだエントリーがありません
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    「追加」ボタンからキャリアの歩みを入力しましょう
                  </p>
                  <button
                    onClick={openAddModal}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    最初のエントリーを追加
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedEntries.map((entry) => {
                    const config = CATEGORY_CONFIG[entry.category];
                    const Icon = config.icon;
                    return (
                      <div
                        key={entry.id}
                        className={`group relative rounded-xl border p-3.5 transition-all hover:shadow-md ${config.bgLight} ${config.borderColor}`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: config.color + '18' }}
                          >
                            <Icon
                              className="h-4 w-4"
                              style={{ color: config.color }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                                style={{ backgroundColor: config.color }}
                              >
                                {config.label}
                              </span>
                              {entry.end_date === '' && (
                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                                  現在
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm font-bold text-gray-900 leading-snug">
                              {entry.title}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-500">
                              {formatDate(entry.start_date)} 〜{' '}
                              {entry.end_date
                                ? formatDate(entry.end_date)
                                : '現在に至る'}
                              {entry.start_date && (
                                <span className="ml-1 text-gray-400">
                                  （{calculateDuration(entry.start_date, entry.end_date || undefined)}）
                                </span>
                              )}
                            </p>
                            {entry.facility && (
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                                <Building2 className="h-3 w-3" />
                                {entry.facility}
                              </p>
                            )}
                            {entry.description && (
                              <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                                {entry.description}
                              </p>
                            )}
                          </div>
                          {/* Actions */}
                          <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditModal(entry)}
                              className="rounded-md p-1.5 text-gray-400 hover:bg-white hover:text-indigo-600 transition-colors"
                              title="編集"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className="rounded-md p-1.5 text-gray-400 hover:bg-white hover:text-red-500 transition-colors"
                              title="削除"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* PDF Export Button */}
              {entries.length > 0 && (
                <div className="mt-5 border-t border-gray-100 pt-4">
                  <button
                    onClick={handleExportPDF}
                    disabled={isExporting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    {isExporting
                      ? 'PDF書き出し中...'
                      : 'タイムラインをPDFに保存'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Timeline Preview ── */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-5 text-lg font-bold text-gray-900">
                タイムラインプレビュー
              </h2>

              {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-50 to-violet-50">
                    <Star className="h-10 w-10 text-indigo-200" />
                  </div>
                  <p className="text-center text-sm text-gray-400">
                    左の入力フォームからエントリーを追加すると
                    <br />
                    ここにタイムラインが表示されます
                  </p>
                </div>
              ) : (
                <div ref={timelineRef} className="py-2">
                  {/* Timeline */}
                  <div className="relative">
                    {sortedEntries.map((entry, index) => {
                      const config = CATEGORY_CONFIG[entry.category];
                      const Icon = config.icon;
                      const isLast = index === sortedEntries.length - 1;

                      return (
                        <div key={entry.id} className="relative flex gap-4 pb-8 last:pb-0">
                          {/* ── Left: Date ── */}
                          <div className="w-28 shrink-0 pt-1 text-right">
                            <p className="text-xs font-semibold text-gray-700">
                              {formatDate(entry.start_date)}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              〜{' '}
                              {entry.end_date
                                ? formatDate(entry.end_date)
                                : '現在'}
                            </p>
                            {entry.start_date && (
                              <p className="mt-0.5 text-[10px] font-medium text-gray-400">
                                {calculateDuration(entry.start_date, entry.end_date || undefined)}
                              </p>
                            )}
                          </div>

                          {/* ── Center: Line + Dot ── */}
                          <div className="relative flex flex-col items-center">
                            <div
                              className="z-10 flex h-8 w-8 items-center justify-center rounded-full border-[3px] bg-white shadow-sm"
                              style={{ borderColor: config.color }}
                            >
                              <Icon
                                className="h-3.5 w-3.5"
                                style={{ color: config.color }}
                              />
                            </div>
                            {!isLast && (
                              <div
                                className="w-0.5 flex-1"
                                style={{ backgroundColor: config.color + '30' }}
                              />
                            )}
                          </div>

                          {/* ── Right: Card ── */}
                          <div
                            className={`flex-1 rounded-xl border p-4 transition-shadow hover:shadow-md ${config.bgLight} ${config.borderColor}`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                                style={{ backgroundColor: config.color }}
                              >
                                {config.label}
                              </span>
                              {entry.end_date === '' && (
                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                                  現在に至る
                                </span>
                              )}
                            </div>
                            <h3 className="mt-2 text-sm font-bold text-gray-900">
                              {entry.title}
                            </h3>
                            {entry.facility && (
                              <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                                <Building2 className="h-3 w-3" />
                                {entry.facility}
                              </p>
                            )}
                            {entry.description && (
                              <p className="mt-2 text-xs leading-relaxed text-gray-600">
                                {entry.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── CTA Section ── */}
      <section className="border-t border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-violet-50">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 sm:py-16">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100">
            <Star className="h-6 w-6 text-indigo-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
            Rootsキャリアでもっと便利に
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-gray-500 sm:text-base">
            Rootsキャリアに登録すると、日々の業務がそのままキャリア記録に。
            研修・資格・経験年数を自動蓄積できます。
          </p>
          <a
            href="/career"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 transition-colors"
          >
            Rootsに無料登録
            <ChevronRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center">
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} Roots &mdash; 保育・福祉のキャリアプラットフォーム
          </p>
        </div>
      </footer>

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Modal Content */}
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 fade-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {editingId ? 'エントリーを編集' : '新しいエントリーを追加'}
              </h3>
              <button
                onClick={closeModal}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Category */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  カテゴリ <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(Object.entries(CATEGORY_CONFIG) as [Category, typeof CATEGORY_CONFIG[Category]][]).map(
                    ([key, config]) => {
                      const Icon = config.icon;
                      const isSelected = form.category === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, category: key }))}
                          className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-xs font-medium transition-all ${
                            isSelected
                              ? 'border-current shadow-sm'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                          style={
                            isSelected
                              ? { borderColor: config.color, color: config.color }
                              : undefined
                          }
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {config.label}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    期間（開始） <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="month"
                    value={form.start_date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, start_date: e.target.value }))
                    }
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors ${
                      formErrors.start_date ? 'border-red-300' : 'border-gray-200'
                    }`}
                  />
                  {formErrors.start_date && (
                    <p className="mt-1 text-xs text-red-500">{formErrors.start_date}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    期間（終了）
                  </label>
                  <input
                    type="month"
                    value={form.end_date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, end_date: e.target.value }))
                    }
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors ${
                      formErrors.end_date ? 'border-red-300' : 'border-gray-200'
                    }`}
                  />
                  <p className="mt-1 text-[11px] text-gray-400">
                    空欄で「現在に至る」
                  </p>
                  {formErrors.end_date && (
                    <p className="mt-0.5 text-xs text-red-500">{formErrors.end_date}</p>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  タイトル <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="例：○○保育園 入職、保育士資格取得"
                  className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors ${
                    formErrors.title ? 'border-red-300' : 'border-gray-200'
                  }`}
                />
                {formErrors.title && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.title}</p>
                )}
              </div>

              {/* Facility */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  施設名
                </label>
                <input
                  type="text"
                  value={form.facility}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, facility: e.target.value }))
                  }
                  placeholder="例：社会福祉法人○○会 ○○保育園"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  詳細
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="例：0歳児クラス担任として12名を担当"
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors resize-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
              >
                {editingId ? '更新する' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}
