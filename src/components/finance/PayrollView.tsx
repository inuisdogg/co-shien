'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calculator,
  Download,
  ChevronLeft,
  ChevronRight,
  Users,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { calculatePayrollSummary } from '@/lib/payrollCalculator';
import type { PayrollInput, PayrollResult, PayrollSummary } from '@/lib/payrollCalculator';

type EmploymentType = 'fulltime' | 'parttime';

type StaffRow = {
  id: string;
  name: string;
  employment_type: EmploymentType;
  user_id: string | null;
};

type PayrollInputRow = PayrollInput & {
  _edited: boolean;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount);
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('ja-JP').format(n);
}

export default function PayrollView() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<PayrollInputRow[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [calculated, setCalculated] = useState(false);

  // Navigate months
  const goToPrevMonth = () => {
    if (month === 1) {
      setYear(y => y - 1);
      setMonth(12);
    } else {
      setMonth(m => m - 1);
    }
    setCalculated(false);
    setSummary(null);
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setYear(y => y + 1);
      setMonth(1);
    } else {
      setMonth(m => m + 1);
    }
    setCalculated(false);
    setSummary(null);
  };

  // Fetch staff and shift data
  const fetchData = useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    setError(null);
    setCalculated(false);
    setSummary(null);

    try {
      // Fetch staff list
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id, name, employment_type, user_id')
        .eq('facility_id', facilityId);

      if (staffError) throw staffError;
      const staffList: StaffRow[] = (staffData || []).map((s: Record<string, unknown>) => ({
        id: s.id as string,
        name: s.name as string,
        employment_type: (s.employment_type as EmploymentType) || 'fulltime',
        user_id: s.user_id as string | null,
      }));

      if (staffList.length === 0) {
        setInputs([]);
        setLoading(false);
        return;
      }

      // Fetch shift data for the selected month to pre-fill days
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      // Get shift counts per user_id for the month
      const userIds = staffList.map(s => s.user_id).filter(Boolean) as string[];
      let shiftCounts: Record<string, { scheduled: number; actual: number; totalHours: number }> = {};

      if (userIds.length > 0) {
        const { data: shiftsData } = await supabase
          .from('shifts')
          .select('user_id, date, start_time, end_time, break_minutes, status')
          .eq('facility_id', facilityId)
          .gte('date', startDate)
          .lte('date', endDate)
          .in('user_id', userIds);

        if (shiftsData) {
          for (const shift of shiftsData) {
            const uid = shift.user_id as string;
            if (!shiftCounts[uid]) {
              shiftCounts[uid] = { scheduled: 0, actual: 0, totalHours: 0 };
            }
            shiftCounts[uid].scheduled += 1;
            // If confirmed or published, count as actual
            if (shift.status === 'confirmed' || shift.status === 'published') {
              shiftCounts[uid].actual += 1;
              // Calculate hours from start_time and end_time
              if (shift.start_time && shift.end_time) {
                const [sh, sm] = (shift.start_time as string).split(':').map(Number);
                const [eh, em] = (shift.end_time as string).split(':').map(Number);
                const totalMinutes = (eh * 60 + em) - (sh * 60 + sm) - (shift.break_minutes as number || 0);
                shiftCounts[uid].totalHours += Math.max(0, totalMinutes / 60);
              }
            }
          }
        }
      }

      // Build PayrollInput rows
      const workingDaysInMonth = lastDay; // simplified: actual business days
      const payrollInputs: PayrollInputRow[] = staffList.map(staff => {
        const sc = staff.user_id ? shiftCounts[staff.user_id] : undefined;
        return {
          staffId: staff.id,
          staffName: staff.name,
          employmentType: staff.employment_type,
          baseSalary: staff.employment_type === 'fulltime' ? 250000 : undefined,
          hourlyWage: staff.employment_type === 'parttime' ? 1200 : undefined,
          scheduledDays: sc?.scheduled || (staff.employment_type === 'fulltime' ? Math.min(22, workingDaysInMonth) : 0),
          actualDays: sc?.actual || 0,
          totalHours: sc ? Math.round(sc.totalHours * 10) / 10 : 0,
          overtimeHours: 0,
          lateNightHours: 0,
          holidayHours: 0,
          paidLeaveDays: 0,
          absentDays: 0,
          commutingAllowance: 0,
          positionAllowance: 0,
          qualificationAllowance: 0,
          otherAllowances: 0,
          _edited: false,
        };
      });

      setInputs(payrollInputs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'データの取得に失敗しました';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [facilityId, year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update a single input field
  const updateInput = (index: number, field: keyof PayrollInput, value: number) => {
    setInputs(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value, _edited: true };
      return next;
    });
    setCalculated(false);
  };

  // Run calculation
  const handleCalculate = () => {
    const cleanInputs: PayrollInput[] = inputs.map(({ _edited, ...rest }) => rest);
    const result = calculatePayrollSummary(year, month, cleanInputs);
    setSummary(result);
    setCalculated(true);
  };

  // CSV export
  const handleExportCSV = () => {
    if (!summary) return;

    const headers = [
      '氏名', '雇用形態', '基本給', '残業手当', '深夜手当', '休日手当',
      '通勤手当', '役職手当', '資格手当', 'その他手当', '総支給額',
      '健康保険', '厚生年金', '雇用保険', '所得税', '住民税', '控除合計', '差引支給額',
    ];

    const rows = summary.staffPayrolls.map(p => [
      p.staffName,
      inputs.find(i => i.staffId === p.staffId)?.employmentType === 'fulltime' ? '常勤' : '非常勤',
      p.basePay,
      p.overtimePay,
      p.lateNightPay,
      p.holidayPay,
      p.commutingAllowance,
      p.positionAllowance,
      p.qualificationAllowance,
      p.otherAllowances,
      p.grossPay,
      p.healthInsurance,
      p.pensionInsurance,
      p.employmentInsurance,
      p.incomeTax,
      p.residentTax,
      p.totalDeductions,
      p.netPay,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_${year}_${String(month).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Find result for a given staffId
  const getResult = (staffId: string): PayrollResult | undefined => {
    return summary?.staffPayrolls.find(p => p.staffId === staffId);
  };

  return (
    <div className="space-y-4">
      {/* Year/Month Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-gray-800 text-lg">給与計算</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-sm font-bold text-gray-800 min-w-[100px] text-center">
            {year}年{month}月
          </span>
          <button
            onClick={goToNextMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCalculate}
            disabled={inputs.length === 0 || loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Calculator className="w-4 h-4" />
            計算実行
          </button>
          {calculated && summary && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <span className="ml-2 text-sm text-gray-500">データを読み込み中...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && inputs.length === 0 && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <EmptyState
            icon={<Users className="w-7 h-7 text-gray-400" />}
            title="スタッフデータがありません"
            description="スタッフを登録してから給与計算を行ってください"
          />
        </div>
      )}

      {/* Staff Payroll Table */}
      {!loading && inputs.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-600 whitespace-nowrap sticky left-0 bg-gray-50 z-10">氏名</th>
                  <th className="text-center p-3 font-medium text-gray-600 whitespace-nowrap">雇用形態</th>
                  <th className="text-right p-3 font-medium text-gray-600 whitespace-nowrap">基本給/時給</th>
                  <th className="text-right p-3 font-medium text-gray-600 whitespace-nowrap">出勤日数</th>
                  <th className="text-right p-3 font-medium text-gray-600 whitespace-nowrap">総労働時間</th>
                  <th className="text-right p-3 font-medium text-gray-600 whitespace-nowrap">残業(h)</th>
                  <th className="text-right p-3 font-medium text-gray-600 whitespace-nowrap">手当計</th>
                  <th className="text-right p-3 font-medium text-gray-600 whitespace-nowrap">総支給額</th>
                  <th className="text-right p-3 font-medium text-gray-600 whitespace-nowrap">控除合計</th>
                  <th className="text-right p-3 font-medium text-gray-600 whitespace-nowrap">差引支給額</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {inputs.map((input, idx) => {
                  const result = getResult(input.staffId);
                  return (
                    <tr key={input.staffId} className="hover:bg-gray-50/50">
                      {/* Name */}
                      <td className="p-3 font-medium text-gray-800 whitespace-nowrap sticky left-0 bg-white z-10">
                        {input.staffName}
                      </td>

                      {/* Employment Type */}
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          input.employmentType === 'fulltime'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          {input.employmentType === 'fulltime' ? '常勤' : '非常勤'}
                        </span>
                      </td>

                      {/* Base Salary / Hourly Rate */}
                      <td className="p-3 text-right">
                        <input
                          type="number"
                          value={input.employmentType === 'fulltime' ? (input.baseSalary || 0) : (input.hourlyWage || 0)}
                          onChange={e => {
                            const val = Number(e.target.value) || 0;
                            if (input.employmentType === 'fulltime') {
                              updateInput(idx, 'baseSalary', val);
                            } else {
                              updateInput(idx, 'hourlyWage', val);
                            }
                          }}
                          className="w-24 text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                      </td>

                      {/* Actual Days */}
                      <td className="p-3 text-right">
                        <input
                          type="number"
                          value={input.actualDays}
                          onChange={e => updateInput(idx, 'actualDays', Number(e.target.value) || 0)}
                          className="w-16 text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                      </td>

                      {/* Total Hours */}
                      <td className="p-3 text-right">
                        <input
                          type="number"
                          step="0.5"
                          value={input.totalHours}
                          onChange={e => updateInput(idx, 'totalHours', Number(e.target.value) || 0)}
                          className="w-16 text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                      </td>

                      {/* Overtime Hours */}
                      <td className="p-3 text-right">
                        <input
                          type="number"
                          step="0.5"
                          value={input.overtimeHours}
                          onChange={e => updateInput(idx, 'overtimeHours', Number(e.target.value) || 0)}
                          className="w-16 text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                      </td>

                      {/* Allowances total */}
                      <td className="p-3 text-right text-gray-600 whitespace-nowrap">
                        {calculated && result
                          ? formatNumber(result.commutingAllowance + result.positionAllowance + result.qualificationAllowance + result.otherAllowances)
                          : '-'}
                      </td>

                      {/* Gross Pay */}
                      <td className="p-3 text-right font-medium text-gray-800 whitespace-nowrap">
                        {calculated && result ? formatCurrency(result.grossPay) : '-'}
                      </td>

                      {/* Total Deductions */}
                      <td className="p-3 text-right text-red-600 whitespace-nowrap">
                        {calculated && result ? formatCurrency(result.totalDeductions) : '-'}
                      </td>

                      {/* Net Pay */}
                      <td className="p-3 text-right font-bold text-gray-800 whitespace-nowrap">
                        {calculated && result ? formatCurrency(result.netPay) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Totals */}
      {calculated && summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">総支給額</p>
            <p className="text-xl font-bold text-gray-800">{formatCurrency(summary.totalGrossPay)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">控除合計</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(summary.totalDeductions)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">差引支給額</p>
            <p className="text-xl font-bold text-gray-800">{formatCurrency(summary.totalNetPay)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">法定福利費込 人件費</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(summary.totalLaborCost)}</p>
          </div>
        </div>
      )}

      {/* Detailed breakdown per staff (collapsed by default) */}
      {calculated && summary && summary.staffPayrolls.length > 0 && (
        <details className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <summary className="p-4 cursor-pointer font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            控除内訳を表示
          </summary>
          <div className="overflow-x-auto border-t border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-600">氏名</th>
                  <th className="text-right p-3 font-medium text-gray-600">健康保険</th>
                  <th className="text-right p-3 font-medium text-gray-600">厚生年金</th>
                  <th className="text-right p-3 font-medium text-gray-600">雇用保険</th>
                  <th className="text-right p-3 font-medium text-gray-600">所得税</th>
                  <th className="text-right p-3 font-medium text-gray-600">住民税</th>
                  <th className="text-right p-3 font-medium text-gray-600 font-bold">控除合計</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {summary.staffPayrolls.map(p => (
                  <tr key={p.staffId} className="hover:bg-gray-50/50">
                    <td className="p-3 font-medium text-gray-800">{p.staffName}</td>
                    <td className="p-3 text-right text-gray-600">{formatNumber(p.healthInsurance)}</td>
                    <td className="p-3 text-right text-gray-600">{formatNumber(p.pensionInsurance)}</td>
                    <td className="p-3 text-right text-gray-600">{formatNumber(p.employmentInsurance)}</td>
                    <td className="p-3 text-right text-gray-600">{formatNumber(p.incomeTax)}</td>
                    <td className="p-3 text-right text-gray-600">{formatNumber(p.residentTax)}</td>
                    <td className="p-3 text-right font-bold text-red-600">{formatCurrency(p.totalDeductions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
