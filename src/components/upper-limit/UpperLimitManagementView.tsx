'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Building2,
  Shield,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  X,
  FileText,
  Download,
  CheckCircle,
  Clock,
  ArrowUpDown,
  Info,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Child, UpperLimitManagement, UpperLimitOtherFacility } from '@/types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// === Constants ===

const INCOME_CATEGORY_UPPER_LIMITS: Record<string, number> = {
  welfare: 0,         // 生活保護
  low_income: 0,      // 低所得
  general_1: 4600,    // 一般1
  general_2: 37200,   // 一般2
};

const INCOME_CATEGORY_LABELS: Record<string, string> = {
  welfare: '生活保護',
  low_income: '低所得',
  general_1: '一般1',
  general_2: '一般2',
};

const MANAGEMENT_TYPE_LABELS: Record<string, string> = {
  none: '管理不要',
  self: '自事業所のみ',
  coordinator: '上限管理事業所',
  managed: '被管理事業所',
};

const MANAGEMENT_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  none: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
  self: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  coordinator: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  managed: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
};

const RESULT_TYPE_LABELS: Record<string, string> = {
  confirmed: '確定',
  adjusted: '調整済',
  pending: '未確定',
};

const RESULT_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  confirmed: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  adjusted: { bg: 'bg-blue-50', text: 'text-blue-700' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700' },
};

// === Helper functions ===

function getUpperLimitByCategory(category?: string): number {
  if (!category) return 0;
  return INCOME_CATEGORY_UPPER_LIMITS[category] ?? 0;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('ja-JP') + '円';
}

function mapRowToUpperLimit(row: any): UpperLimitManagement {
  return {
    id: row.id,
    facilityId: row.facility_id,
    childId: row.child_id,
    yearMonth: row.year_month,
    managementType: row.management_type,
    upperLimitAmount: row.upper_limit_amount,
    selfTotalUnits: row.self_total_units || 0,
    selfCopayAmount: row.self_copay_amount || 0,
    selfUsageDays: row.self_usage_days || 0,
    resultType: row.result_type || undefined,
    adjustedCopayAmount: row.adjusted_copay_amount ?? undefined,
    totalCopayAllFacilities: row.total_copay_all_facilities ?? undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToOtherFacility(row: any): UpperLimitOtherFacility {
  return {
    id: row.id,
    upperLimitId: row.upper_limit_id,
    facilityNumber: row.facility_number || undefined,
    facilityName: row.facility_name,
    totalUnits: row.total_units || 0,
    copayAmount: row.copay_amount || 0,
    usageDays: row.usage_days || 0,
    adjustedCopayAmount: row.adjusted_copay_amount ?? undefined,
    contactPhone: row.contact_phone || undefined,
    contactFax: row.contact_fax || undefined,
  };
}

// === Main Component ===

export default function UpperLimitManagementView() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  // State
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [children, setChildren] = useState<Child[]>([]);
  const [records, setRecords] = useState<UpperLimitManagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfChild, setPdfChild] = useState<Child | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Detail modal state
  const [editData, setEditData] = useState<Partial<UpperLimitManagement>>({});
  const [editOtherFacilities, setEditOtherFacilities] = useState<Partial<UpperLimitOtherFacility>[]>([]);

  // Navigation
  const navigateMonth = (direction: number) => {
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + direction, 1);
    setCurrentMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const displayMonth = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number);
    return `${year}年${month}月`;
  }, [currentMonth]);

  // Fetch children
  useEffect(() => {
    if (!facilityId) return;
    const fetchChildren = async () => {
      const { data, error } = await supabase
        .from('children')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('contract_status', 'active')
        .order('name');
      if (!error && data) {
        setChildren(data.map((row: any) => ({
          id: row.id,
          facilityId: row.facility_id,
          name: row.name,
          nameKana: row.name_kana,
          beneficiaryNumber: row.beneficiary_number,
          income_category: row.income_category,
          contractStatus: row.contract_status,
          grantDays: row.grant_days,
          contractDays: row.contract_days,
          needsPickup: row.needs_pickup || false,
          needsDropoff: row.needs_dropoff || false,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })));
      }
    };
    fetchChildren();
  }, [facilityId]);

  // Fetch upper limit records for current month
  const fetchRecords = useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('upper_limit_management')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('year_month', currentMonth);
      if (!error && data) {
        // Fetch other facilities for each record
        const recordsMapped = data.map(mapRowToUpperLimit);
        const recordIds = recordsMapped.map(r => r.id);

        if (recordIds.length > 0) {
          const { data: otherData } = await supabase
            .from('upper_limit_other_facilities')
            .select('*')
            .in('upper_limit_id', recordIds);

          if (otherData) {
            const otherByRecord: Record<string, UpperLimitOtherFacility[]> = {};
            otherData.forEach((row: any) => {
              const mapped = mapRowToOtherFacility(row);
              if (!otherByRecord[mapped.upperLimitId]) {
                otherByRecord[mapped.upperLimitId] = [];
              }
              otherByRecord[mapped.upperLimitId].push(mapped);
            });
            recordsMapped.forEach(r => {
              r.otherFacilities = otherByRecord[r.id] || [];
            });
          }
        }

        setRecords(recordsMapped);
      }
    } catch (err) {
      console.error('Error fetching upper limit records:', err);
    } finally {
      setLoading(false);
    }
  }, [facilityId, currentMonth]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Auto-calculate usage from usage_records
  const calculateUsageForChild = useCallback(async (childId: string) => {
    if (!facilityId) return { days: 0, units: 0 };
    const [year, month] = currentMonth.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const { data, error } = await supabase
      .from('usage_records')
      .select('date, calculated_time, service_status')
      .eq('facility_id', facilityId)
      .eq('child_id', childId)
      .gte('date', startDate)
      .lte('date', endDate)
      .in('service_status', ['利用', '加算のみ']);

    if (error || !data) return { days: 0, units: 0 };

    // Count unique usage days
    const uniqueDays = new Set(data.filter((r: any) => r.service_status === '利用').map((r: any) => r.date));
    // Sum calculated_time as a proxy for units
    const totalUnits = data.reduce((sum: number, r: any) => sum + (r.calculated_time || 0), 0);

    return { days: uniqueDays.size, units: totalUnits };
  }, [facilityId, currentMonth]);

  // Get record for a child
  const getRecordForChild = (childId: string): UpperLimitManagement | undefined => {
    return records.find(r => r.childId === childId);
  };

  // Stats
  const stats = useMemo(() => {
    const counts = { none: 0, self: 0, coordinator: 0, managed: 0 };
    records.forEach(r => {
      counts[r.managementType] = (counts[r.managementType] || 0) + 1;
    });
    // Children without records count as 'none'
    const childrenWithRecords = new Set(records.map(r => r.childId));
    const childrenWithoutRecords = children.filter(c => !childrenWithRecords.has(c.id)).length;
    counts.none += childrenWithoutRecords;
    return counts;
  }, [records, children]);

  // Open detail modal
  const openDetail = async (child: Child) => {
    setSelectedChild(child);
    const existing = getRecordForChild(child.id);
    const usage = await calculateUsageForChild(child.id);
    const upperLimit = getUpperLimitByCategory(child.income_category);

    if (existing) {
      setEditData({
        ...existing,
        selfUsageDays: existing.selfUsageDays || usage.days,
        selfTotalUnits: existing.selfTotalUnits || usage.units,
      });
      setEditOtherFacilities(existing.otherFacilities || []);
    } else {
      setEditData({
        managementType: 'none',
        upperLimitAmount: upperLimit,
        selfTotalUnits: usage.units,
        selfCopayAmount: 0,
        selfUsageDays: usage.days,
        resultType: 'pending',
        adjustedCopayAmount: undefined,
        totalCopayAllFacilities: undefined,
        notes: '',
      });
      setEditOtherFacilities([]);
    }
    setShowDetailModal(true);
  };

  // Add other facility
  const addOtherFacility = () => {
    setEditOtherFacilities(prev => [...prev, {
      facilityNumber: '',
      facilityName: '',
      totalUnits: 0,
      copayAmount: 0,
      usageDays: 0,
      adjustedCopayAmount: undefined,
      contactPhone: '',
      contactFax: '',
    }]);
  };

  // Remove other facility
  const removeOtherFacility = (index: number) => {
    setEditOtherFacilities(prev => prev.filter((_, i) => i !== index));
  };

  // Update other facility field
  const updateOtherFacility = (index: number, field: string, value: any) => {
    setEditOtherFacilities(prev => prev.map((f, i) => i === index ? { ...f, [field]: value } : f));
  };

  // Calculated totals
  const totalAllCopay = useMemo(() => {
    const selfCopay = editData.selfCopayAmount || 0;
    const otherCopay = editOtherFacilities.reduce((sum, f) => sum + (f.copayAmount || 0), 0);
    return selfCopay + otherCopay;
  }, [editData.selfCopayAmount, editOtherFacilities]);

  const isOverLimit = useMemo(() => {
    return totalAllCopay > (editData.upperLimitAmount || 0) && (editData.upperLimitAmount || 0) > 0;
  }, [totalAllCopay, editData.upperLimitAmount]);

  // Save
  const handleSave = async () => {
    if (!facilityId || !selectedChild) return;
    setSaving(true);
    try {
      const existing = getRecordForChild(selectedChild.id);
      const now = new Date().toISOString();

      const dbData = {
        facility_id: facilityId,
        child_id: selectedChild.id,
        year_month: currentMonth,
        management_type: editData.managementType || 'none',
        upper_limit_amount: editData.upperLimitAmount || 0,
        self_total_units: editData.selfTotalUnits || 0,
        self_copay_amount: editData.selfCopayAmount || 0,
        self_usage_days: editData.selfUsageDays || 0,
        result_type: editData.resultType || 'pending',
        adjusted_copay_amount: editData.adjustedCopayAmount ?? null,
        total_copay_all_facilities: totalAllCopay,
        notes: editData.notes || null,
        updated_at: now,
      };

      let recordId: string;

      if (existing) {
        recordId = existing.id;
        const { error } = await supabase
          .from('upper_limit_management')
          .update(dbData)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        recordId = `ul-${Date.now()}`;
        const { error } = await supabase
          .from('upper_limit_management')
          .insert({ id: recordId, ...dbData, created_at: now });
        if (error) throw error;
      }

      // Handle other facilities
      // Delete existing other facilities
      if (existing) {
        await supabase
          .from('upper_limit_other_facilities')
          .delete()
          .eq('upper_limit_id', recordId);
      }

      // Insert new other facilities
      if (editOtherFacilities.length > 0) {
        const otherRows = editOtherFacilities.map(f => ({
          id: `ulof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          upper_limit_id: recordId,
          facility_number: f.facilityNumber || null,
          facility_name: f.facilityName || '',
          total_units: f.totalUnits || 0,
          copay_amount: f.copayAmount || 0,
          usage_days: f.usageDays || 0,
          adjusted_copay_amount: f.adjustedCopayAmount ?? null,
          contact_phone: f.contactPhone || null,
          contact_fax: f.contactFax || null,
          created_at: now,
        }));
        const { error } = await supabase
          .from('upper_limit_other_facilities')
          .insert(otherRows);
        if (error) throw error;
      }

      await fetchRecords();
      setShowDetailModal(false);
    } catch (err) {
      console.error('Error saving upper limit data:', err);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // PDF Export
  const pdfRef = useRef<HTMLDivElement>(null);

  const openPdfPreview = (child: Child) => {
    setPdfChild(child);
    setShowPdfPreview(true);
  };

  const handlePdfDownload = async () => {
    if (!pdfRef.current) return;
    setGeneratingPdf(true);
    try {
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 5;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

      const childName = pdfChild?.name || 'unknown';
      pdf.save(`上限管理結果票_${childName}_${currentMonth}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF生成に失敗しました');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Get record data for PDF
  const pdfRecord = pdfChild ? getRecordForChild(pdfChild.id) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">上限管理</h1>
          <p className="text-sm text-gray-500 mt-1">利用者負担上限額管理</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <span className="text-base font-semibold text-gray-800 min-w-[120px] text-center">
            {displayMonth}
          </span>
          <button
            onClick={() => navigateMonth(1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight size={18} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { key: 'none', label: '管理不要', icon: Users, color: 'text-gray-500', bg: 'bg-gray-50' },
          { key: 'self', label: '自事業所のみ', icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
          { key: 'coordinator', label: '上限管理事業所', icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { key: 'managed', label: '被管理事業所', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(({ key, label, icon: Icon, color, bg }) => (
          <div key={key} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center`}>
                <Icon size={18} className={color} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{stats[key as keyof typeof stats]}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Children Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">児童名</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">負担上限月額</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">管理区分</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">自事業所負担額</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">全事業所合計</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">調整後負担額</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">状態</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <div className="w-5 h-5 border-2 border-t-transparent border-gray-300 rounded-full animate-spin" />
                      <span className="text-sm">読み込み中...</span>
                    </div>
                  </td>
                </tr>
              ) : children.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                    対象の児童がいません
                  </td>
                </tr>
              ) : (
                children.map(child => {
                  const record = getRecordForChild(child.id);
                  const upperLimit = getUpperLimitByCategory(child.income_category);
                  const mType = record?.managementType || 'none';
                  const mColors = MANAGEMENT_TYPE_COLORS[mType];
                  const resultType = record?.resultType;
                  const rColors = resultType ? RESULT_TYPE_COLORS[resultType] : null;

                  return (
                    <tr
                      key={child.id}
                      onClick={() => openDetail(child)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800 text-sm">{child.name}</div>
                        {child.beneficiaryNumber && (
                          <div className="text-xs text-gray-400">{child.beneficiaryNumber}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {formatCurrency(upperLimit)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${mColors.bg} ${mColors.text} border ${mColors.border}`}>
                          {MANAGEMENT_TYPE_LABELS[mType]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">
                        {record ? formatCurrency(record.selfCopayAmount) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">
                        {record?.totalCopayAllFacilities != null
                          ? formatCurrency(record.totalCopayAllFacilities)
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">
                        {record?.adjustedCopayAmount != null
                          ? formatCurrency(record.adjustedCopayAmount)
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {resultType && rColors ? (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${rColors.bg} ${rColors.text}`}>
                            {resultType === 'confirmed' && <CheckCircle size={12} className="mr-1" />}
                            {resultType === 'adjusted' && <ArrowUpDown size={12} className="mr-1" />}
                            {resultType === 'pending' && <Clock size={12} className="mr-1" />}
                            {RESULT_TYPE_LABELS[resultType]}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {record && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openPdfPreview(child);
                            }}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            title="PDF出力"
                          >
                            <FileText size={16} className="text-gray-500" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedChild && (
        <DetailModal
          child={selectedChild}
          editData={editData}
          setEditData={setEditData}
          editOtherFacilities={editOtherFacilities}
          addOtherFacility={addOtherFacility}
          removeOtherFacility={removeOtherFacility}
          updateOtherFacility={updateOtherFacility}
          totalAllCopay={totalAllCopay}
          isOverLimit={isOverLimit}
          saving={saving}
          onSave={handleSave}
          onClose={() => setShowDetailModal(false)}
          currentMonth={currentMonth}
        />
      )}

      {/* PDF Preview Modal */}
      {showPdfPreview && pdfChild && pdfRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-auto">
            {/* Toolbar */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="font-bold text-gray-800">利用者負担上限額管理結果票</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePdfDownload}
                  disabled={generatingPdf}
                  className="flex items-center gap-2 px-4 py-2 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {generatingPdf ? (
                    <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  PDF保存
                </button>
                <button
                  onClick={() => setShowPdfPreview(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={18} className="text-gray-500" />
                </button>
              </div>
            </div>

            {/* PDF Content */}
            <div className="p-6">
              <PdfContent
                ref={pdfRef}
                child={pdfChild}
                record={pdfRecord}
                currentMonth={currentMonth}
                facilityName={facility?.name || ''}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === Detail Modal Component ===

function DetailModal({
  child,
  editData,
  setEditData,
  editOtherFacilities,
  addOtherFacility,
  removeOtherFacility,
  updateOtherFacility,
  totalAllCopay,
  isOverLimit,
  saving,
  onSave,
  onClose,
  currentMonth,
}: {
  child: Child;
  editData: Partial<UpperLimitManagement>;
  setEditData: React.Dispatch<React.SetStateAction<Partial<UpperLimitManagement>>>;
  editOtherFacilities: Partial<UpperLimitOtherFacility>[];
  addOtherFacility: () => void;
  removeOtherFacility: (index: number) => void;
  updateOtherFacility: (index: number, field: string, value: any) => void;
  totalAllCopay: number;
  isOverLimit: boolean;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
  currentMonth: string;
}) {
  const upperLimit = editData.upperLimitAmount || 0;
  const [year, month] = currentMonth.split('-').map(Number);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="font-bold text-gray-800">上限管理 - {child.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{year}年{month}月</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Child Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">児童名</span>
                <p className="font-medium text-gray-800">{child.name}</p>
              </div>
              <div>
                <span className="text-gray-500">受給者証番号</span>
                <p className="font-medium text-gray-800">{child.beneficiaryNumber || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">所得区分</span>
                <p className="font-medium text-gray-800">
                  {child.income_category ? INCOME_CATEGORY_LABELS[child.income_category] || child.income_category : '未設定'}
                </p>
              </div>
              <div>
                <span className="text-gray-500">負担上限月額</span>
                <p className="font-bold text-[#00c4cc]">{formatCurrency(upperLimit)}</p>
              </div>
            </div>
          </div>

          {/* Management Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">管理区分</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(['none', 'self', 'coordinator', 'managed'] as const).map(type => {
                const colors = MANAGEMENT_TYPE_COLORS[type];
                const isSelected = editData.managementType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setEditData(prev => ({ ...prev, managementType: type }))}
                    className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      isSelected
                        ? `${colors.bg} ${colors.text} ${colors.border} ring-2 ring-offset-1 ring-current`
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {MANAGEMENT_TYPE_LABELS[type]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Self Facility Info */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Building2 size={16} />
              自事業所の情報
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">利用日数</label>
                <input
                  type="number"
                  min={0}
                  value={editData.selfUsageDays || 0}
                  onChange={(e) => setEditData(prev => ({ ...prev, selfUsageDays: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">総単位数</label>
                <input
                  type="number"
                  min={0}
                  value={editData.selfTotalUnits || 0}
                  onChange={(e) => setEditData(prev => ({ ...prev, selfTotalUnits: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">利用者負担額</label>
                <input
                  type="number"
                  min={0}
                  value={editData.selfCopayAmount || 0}
                  onChange={(e) => setEditData(prev => ({ ...prev, selfCopayAmount: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                />
              </div>
            </div>
          </div>

          {/* Other Facilities */}
          {(editData.managementType === 'coordinator' || editData.managementType === 'managed') && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Users size={16} />
                  他事業所の情報
                </h4>
                <button
                  onClick={addOtherFacility}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#00c4cc] bg-[#00c4cc]/5 rounded-lg hover:bg-[#00c4cc]/10 transition-colors"
                >
                  <Plus size={14} />
                  事業所を追加
                </button>
              </div>

              {editOtherFacilities.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-6 bg-gray-50 rounded-lg">
                  他事業所の情報はありません
                </div>
              ) : (
                <div className="space-y-4">
                  {editOtherFacilities.map((facility, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-gray-500">事業所 {index + 1}</span>
                        <button
                          onClick={() => removeOtherFacility(index)}
                          className="p-1 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">事業所名</label>
                          <input
                            type="text"
                            value={facility.facilityName || ''}
                            onChange={(e) => updateOtherFacility(index, 'facilityName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                            placeholder="事業所名"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">事業所番号</label>
                          <input
                            type="text"
                            value={facility.facilityNumber || ''}
                            onChange={(e) => updateOtherFacility(index, 'facilityNumber', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                            placeholder="事業所番号"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">利用日数</label>
                          <input
                            type="number"
                            min={0}
                            value={facility.usageDays || 0}
                            onChange={(e) => updateOtherFacility(index, 'usageDays', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">総単位数</label>
                          <input
                            type="number"
                            min={0}
                            value={facility.totalUnits || 0}
                            onChange={(e) => updateOtherFacility(index, 'totalUnits', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">利用者負担額</label>
                          <input
                            type="number"
                            min={0}
                            value={facility.copayAmount || 0}
                            onChange={(e) => updateOtherFacility(index, 'copayAmount', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">調整後負担額</label>
                          <input
                            type="number"
                            min={0}
                            value={facility.adjustedCopayAmount ?? ''}
                            onChange={(e) => updateOtherFacility(index, 'adjustedCopayAmount', e.target.value ? parseInt(e.target.value) : undefined)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                            placeholder="任意"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">電話番号</label>
                          <input
                            type="tel"
                            value={facility.contactPhone || ''}
                            onChange={(e) => updateOtherFacility(index, 'contactPhone', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                            placeholder="電話番号"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">FAX番号</label>
                          <input
                            type="tel"
                            value={facility.contactFax || ''}
                            onChange={(e) => updateOtherFacility(index, 'contactFax', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                            placeholder="FAX番号"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Totals & Warning */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">自事業所 負担額</span>
              <span className="font-medium text-gray-800">{formatCurrency(editData.selfCopayAmount || 0)}</span>
            </div>
            {editOtherFacilities.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">他事業所 負担額合計</span>
                <span className="font-medium text-gray-800">
                  {formatCurrency(editOtherFacilities.reduce((sum, f) => sum + (f.copayAmount || 0), 0))}
                </span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
              <span className="font-semibold text-gray-700">全事業所合計</span>
              <span className={`text-lg font-bold ${isOverLimit ? 'text-red-600' : 'text-gray-800'}`}>
                {formatCurrency(totalAllCopay)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">負担上限月額</span>
              <span className="font-medium text-[#00c4cc]">{formatCurrency(upperLimit)}</span>
            </div>
            {isOverLimit && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                <AlertTriangle size={16} />
                <span>全事業所合計が負担上限月額を超過しています。調整が必要です。</span>
              </div>
            )}
          </div>

          {/* Adjusted Amount */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">調整後の自事業所負担額</label>
            <input
              type="number"
              min={0}
              value={editData.adjustedCopayAmount ?? ''}
              onChange={(e) => setEditData(prev => ({
                ...prev,
                adjustedCopayAmount: e.target.value ? parseInt(e.target.value) : undefined,
              }))}
              placeholder="調整後の負担額を入力（任意）"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
            />
          </div>

          {/* Result Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">管理結果</label>
            <div className="flex gap-2">
              {(['pending', 'adjusted', 'confirmed'] as const).map(type => {
                const rColors = RESULT_TYPE_COLORS[type];
                const isSelected = editData.resultType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setEditData(prev => ({ ...prev, resultType: type }))}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      isSelected
                        ? `${rColors.bg} ${rColors.text} ring-2 ring-offset-1 ring-current`
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {RESULT_TYPE_LABELS[type]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">備考</label>
            <textarea
              value={editData.notes || ''}
              onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc] resize-none"
              placeholder="備考を入力"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-[#00c4cc] rounded-lg hover:bg-[#00b0b8] transition-colors disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
            ) : (
              <Save size={16} />
            )}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

// === PDF Content Component ===

const PdfContent = React.forwardRef<HTMLDivElement, {
  child: Child;
  record: UpperLimitManagement;
  currentMonth: string;
  facilityName: string;
}>(({ child, record, currentMonth, facilityName }, ref) => {
  const [year, month] = currentMonth.split('-').map(Number);
  const upperLimit = record.upperLimitAmount || 0;
  const otherFacilities = record.otherFacilities || [];

  // All facilities for the table
  const allFacilities = [
    {
      name: facilityName + ' (自事業所)',
      number: '',
      totalUnits: record.selfTotalUnits,
      copayAmount: record.selfCopayAmount,
      adjustedCopayAmount: record.adjustedCopayAmount,
      usageDays: record.selfUsageDays,
    },
    ...otherFacilities.map(f => ({
      name: f.facilityName,
      number: f.facilityNumber || '',
      totalUnits: f.totalUnits,
      copayAmount: f.copayAmount,
      adjustedCopayAmount: f.adjustedCopayAmount,
      usageDays: f.usageDays,
    })),
  ];

  const totalCopay = allFacilities.reduce((s, f) => s + f.copayAmount, 0);
  const totalAdjusted = allFacilities.reduce((s, f) => s + (f.adjustedCopayAmount ?? f.copayAmount), 0);
  const totalUnits = allFacilities.reduce((s, f) => s + f.totalUnits, 0);

  const printDate = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div
      ref={ref}
      style={{
        width: '1050px',
        padding: '32px 40px',
        fontFamily: '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif',
        color: '#1a1a1a',
        backgroundColor: '#ffffff',
      }}
    >
      {/* Title */}
      <h1 style={{ textAlign: 'center', fontSize: '20px', fontWeight: 'bold', marginBottom: '24px', letterSpacing: '4px' }}>
        利用者負担上限額管理結果票
      </h1>

      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '13px' }}>
        <div>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 12px 4px 0', color: '#666', fontWeight: 'bold' }}>対象年月</td>
                <td style={{ padding: '4px 0' }}>{year}年{month}月</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px 4px 0', color: '#666', fontWeight: 'bold' }}>児童氏名</td>
                <td style={{ padding: '4px 0' }}>{child.name}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px 4px 0', color: '#666', fontWeight: 'bold' }}>受給者証番号</td>
                <td style={{ padding: '4px 0' }}>{child.beneficiaryNumber || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 12px 4px 0', color: '#666', fontWeight: 'bold' }}>負担上限月額</td>
                <td style={{ padding: '4px 0', fontWeight: 'bold', color: '#00c4cc' }}>{formatCurrency(upperLimit)}</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px 4px 0', color: '#666', fontWeight: 'bold' }}>所得区分</td>
                <td style={{ padding: '4px 0' }}>
                  {child.income_category ? INCOME_CATEGORY_LABELS[child.income_category] || child.income_category : '-'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '4px 12px 4px 0', color: '#666', fontWeight: 'bold' }}>管理区分</td>
                <td style={{ padding: '4px 0' }}>{MANAGEMENT_TYPE_LABELS[record.managementType]}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '12px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            <th style={{ border: '1px solid #ddd', padding: '8px 10px', textAlign: 'left', fontWeight: 'bold' }}>事業所名</th>
            <th style={{ border: '1px solid #ddd', padding: '8px 10px', textAlign: 'center', fontWeight: 'bold' }}>事業所番号</th>
            <th style={{ border: '1px solid #ddd', padding: '8px 10px', textAlign: 'right', fontWeight: 'bold' }}>利用日数</th>
            <th style={{ border: '1px solid #ddd', padding: '8px 10px', textAlign: 'right', fontWeight: 'bold' }}>総単位数</th>
            <th style={{ border: '1px solid #ddd', padding: '8px 10px', textAlign: 'right', fontWeight: 'bold' }}>利用者負担額</th>
            <th style={{ border: '1px solid #ddd', padding: '8px 10px', textAlign: 'right', fontWeight: 'bold' }}>管理結果後利用者負担額</th>
          </tr>
        </thead>
        <tbody>
          {allFacilities.map((f, i) => (
            <tr key={i}>
              <td style={{ border: '1px solid #ddd', padding: '8px 10px' }}>{f.name}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px 10px', textAlign: 'center' }}>{f.number || '-'}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px 10px', textAlign: 'right' }}>{f.usageDays}日</td>
              <td style={{ border: '1px solid #ddd', padding: '8px 10px', textAlign: 'right' }}>{f.totalUnits.toLocaleString()}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px 10px', textAlign: 'right' }}>{formatCurrency(f.copayAmount)}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px 10px', textAlign: 'right' }}>
                {f.adjustedCopayAmount != null ? formatCurrency(f.adjustedCopayAmount) : formatCurrency(f.copayAmount)}
              </td>
            </tr>
          ))}
          {/* Total row */}
          <tr style={{ backgroundColor: '#f9f9f9', fontWeight: 'bold' }}>
            <td style={{ border: '1px solid #ddd', padding: '8px 10px' }} colSpan={3}>合計</td>
            <td style={{ border: '1px solid #ddd', padding: '8px 10px', textAlign: 'right' }}>{totalUnits.toLocaleString()}</td>
            <td style={{ border: '1px solid #ddd', padding: '8px 10px', textAlign: 'right' }}>{formatCurrency(totalCopay)}</td>
            <td style={{ border: '1px solid #ddd', padding: '8px 10px', textAlign: 'right' }}>{formatCurrency(totalAdjusted)}</td>
          </tr>
        </tbody>
      </table>

      {/* Result */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '16px' }}>
        <div>
          <span style={{ color: '#666', fontWeight: 'bold' }}>管理結果: </span>
          <span style={{ fontWeight: 'bold' }}>
            {record.resultType ? RESULT_TYPE_LABELS[record.resultType] : '-'}
          </span>
        </div>
        <div>
          <span style={{ color: '#666', fontWeight: 'bold' }}>負担上限月額: </span>
          <span style={{ fontWeight: 'bold', color: '#00c4cc' }}>{formatCurrency(upperLimit)}</span>
          <span style={{ margin: '0 12px', color: '#ccc' }}>|</span>
          <span style={{ color: '#666', fontWeight: 'bold' }}>全事業所合計: </span>
          <span style={{ fontWeight: 'bold', color: totalCopay > upperLimit && upperLimit > 0 ? '#dc2626' : '#1a1a1a' }}>
            {formatCurrency(totalCopay)}
          </span>
        </div>
      </div>

      {/* Notes */}
      {record.notes && (
        <div style={{ fontSize: '12px', marginBottom: '16px' }}>
          <span style={{ color: '#666', fontWeight: 'bold' }}>備考: </span>
          <span>{record.notes}</span>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: '1px solid #eee', paddingTop: '12px', fontSize: '11px', color: '#999', display: 'flex', justifyContent: 'space-between' }}>
        <span>上限管理事業所: {facilityName}</span>
        <span>印刷日: {printDate}</span>
      </div>
    </div>
  );
});

PdfContent.displayName = 'PdfContent';
