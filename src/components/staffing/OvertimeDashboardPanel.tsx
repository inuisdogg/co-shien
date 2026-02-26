'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AlertTriangle,
  Clock,
  Settings,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// ---- Local types ----

interface StaffMember {
  id: string;
  userId: string;
  name: string;
}

interface MonthlyOvertime {
  userId: string;
  staffName: string;
  monthlyOvertimeMinutes: number;
  annualOvertimeMinutes: number;
}

interface OvertimeAgreement {
  id?: string;
  facilityId: string;
  fiscalYear: number;
  monthlyLimitHours: number;
  annualLimitHours: number;
  specialMonthlyLimit: number;
  specialMonthsLimit: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

// ---- Helpers ----

function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function getCurrentFiscalYear(): number {
  const now = new Date();
  const m = now.getMonth() + 1;
  return m >= 4 ? now.getFullYear() : now.getFullYear() - 1;
}

function getOvertimeColor(ratio: number): string {
  if (ratio >= 1.0) return 'bg-red-500';
  if (ratio >= 0.8) return 'bg-amber-400';
  return 'bg-green-400';
}

function getOvertimeTextColor(ratio: number): string {
  if (ratio >= 1.0) return 'text-red-700';
  if (ratio >= 0.8) return 'text-amber-700';
  return 'text-green-700';
}

// ---- Component ----

export default function OvertimeDashboardPanel() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [overtimeData, setOvertimeData] = useState<MonthlyOvertime[]>([]);
  const [agreement, setAgreement] = useState<OvertimeAgreement>({
    facilityId: '',
    fiscalYear: getCurrentFiscalYear(),
    monthlyLimitHours: 45,
    annualLimitHours: 360,
    specialMonthlyLimit: 100,
    specialMonthsLimit: 6,
    effectiveFrom: `${getCurrentFiscalYear()}-04-01`,
  });
  const [prescribedHours, setPrescribedHours] = useState(8);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [year, month] = useMemo(() => selectedMonth.split('-').map(Number), [selectedMonth]);
  const fiscalYear = useMemo(() => (month >= 4 ? year : year - 1), [year, month]);

  // Fetch data
  useEffect(() => {
    if (!facilityId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch staff
        const { data: staffData } = await supabase
          .from('staff')
          .select('id, name, user_id')
          .eq('facility_id', facilityId);

        const members: StaffMember[] = (staffData || [])
          .filter((s: any) => s.user_id)
          .map((s: any) => ({ id: s.id, userId: s.user_id, name: s.name }));
        setStaffList(members);

        // Fetch prescribed working hours
        const { data: fsData } = await supabase
          .from('facility_settings')
          .select('prescribed_working_hours')
          .eq('facility_id', facilityId)
          .single();

        const dailyPrescribed = fsData?.prescribed_working_hours || 8;
        setPrescribedHours(dailyPrescribed);

        // Fetch overtime agreement
        const { data: agData } = await supabase
          .from('overtime_agreements')
          .select('*')
          .eq('facility_id', facilityId)
          .eq('fiscal_year', fiscalYear)
          .single();

        if (agData) {
          setAgreement({
            id: agData.id,
            facilityId: agData.facility_id,
            fiscalYear: agData.fiscal_year,
            monthlyLimitHours: Number(agData.monthly_limit_hours),
            annualLimitHours: Number(agData.annual_limit_hours),
            specialMonthlyLimit: Number(agData.special_monthly_limit),
            specialMonthsLimit: agData.special_months_limit,
            effectiveFrom: agData.effective_from,
            effectiveTo: agData.effective_to || undefined,
          });
        }

        // Fetch attendance for the selected month
        const daysInMonth = new Date(year, month, 0).getDate();
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`;

        const { data: attData } = await supabase
          .from('attendance_records')
          .select('user_id, date, type, time')
          .eq('facility_id', facilityId)
          .gte('date', startDate)
          .lte('date', endDate);

        // Also fetch annual attendance data for fiscal year total
        const fyStart = `${fiscalYear}-04-01`;
        const fyEnd = `${fiscalYear + 1}-03-31`;

        const { data: annualData } = await supabase
          .from('attendance_records')
          .select('user_id, date, type, time')
          .eq('facility_id', facilityId)
          .gte('date', fyStart)
          .lte('date', fyEnd);

        // Calculate monthly overtime per staff
        const dailyPrescribedMinutes = dailyPrescribed * 60;

        const monthlyOT = calculateOvertimeByUser(attData || [], members, dailyPrescribedMinutes);
        const annualOT = calculateOvertimeByUser(annualData || [], members, dailyPrescribedMinutes);

        const combined: MonthlyOvertime[] = members.map(m => ({
          userId: m.userId,
          staffName: m.name,
          monthlyOvertimeMinutes: monthlyOT.get(m.userId) || 0,
          annualOvertimeMinutes: annualOT.get(m.userId) || 0,
        }));

        setOvertimeData(combined);
      } catch (err) {
        console.error('Error fetching overtime data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [facilityId, year, month, fiscalYear]);

  // Calculate overtime minutes per user from attendance records
  const calculateOvertimeByUser = useCallback(
    (records: any[], members: StaffMember[], dailyPrescribedMinutes: number): Map<string, number> => {
      const result = new Map<string, number>();

      // Group records by user_id + date
      const grouped = new Map<string, any[]>();
      for (const r of records) {
        const key = `${r.user_id}|${r.date}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(r);
      }

      for (const member of members) {
        let totalOT = 0;

        grouped.forEach((dayRecs, key) => {
          if (!key.startsWith(member.userId + '|')) return;

          const getTime = (type: string) => dayRecs.find((r: any) => r.type === type)?.time;
          const startTime = getTime('start');
          const endTime = getTime('end');
          const breakStart = getTime('break_start');
          const breakEnd = getTime('break_end');

          if (startTime && endTime) {
            let workMins = parseTime(endTime) - parseTime(startTime);
            if (breakStart && breakEnd) {
              workMins -= (parseTime(breakEnd) - parseTime(breakStart));
            }
            workMins = Math.max(0, workMins);
            if (workMins > dailyPrescribedMinutes) {
              totalOT += workMins - dailyPrescribedMinutes;
            }
          }
        });

        result.set(member.userId, totalOT);
      }

      return result;
    },
    []
  );

  // Save agreement
  const saveAgreement = async () => {
    if (!facilityId) return;
    setSaving(true);
    try {
      const payload = {
        facility_id: facilityId,
        fiscal_year: fiscalYear,
        monthly_limit_hours: agreement.monthlyLimitHours,
        annual_limit_hours: agreement.annualLimitHours,
        special_monthly_limit: agreement.specialMonthlyLimit,
        special_months_limit: agreement.specialMonthsLimit,
        effective_from: agreement.effectiveFrom,
        effective_to: agreement.effectiveTo || null,
        updated_at: new Date().toISOString(),
      };

      if (agreement.id) {
        await supabase
          .from('overtime_agreements')
          .update(payload)
          .eq('id', agreement.id);
      } else {
        const { data } = await supabase
          .from('overtime_agreements')
          .insert({ ...payload, id: undefined })
          .select('id')
          .single();
        if (data) {
          setAgreement(prev => ({ ...prev, id: data.id }));
        }
      }
      setShowSettings(false);
    } catch (err) {
      console.error('Error saving agreement:', err);
    } finally {
      setSaving(false);
    }
  };

  const changeMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // Sort by monthly overtime descending
  const sortedData = useMemo(
    () => [...overtimeData].sort((a, b) => b.monthlyOvertimeMinutes - a.monthlyOvertimeMinutes),
    [overtimeData]
  );

  const maxBarMinutes = useMemo(() => {
    const maxOT = Math.max(...sortedData.map(d => d.monthlyOvertimeMinutes), 0);
    return Math.max(maxOT, agreement.monthlyLimitHours * 60);
  }, [sortedData, agreement.monthlyLimitHours]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 text-[#00c4cc]" />
          <h1 className="text-xl font-bold text-gray-800">残業・36協定管理</h1>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
        >
          <Settings className="w-4 h-4" />
          36協定設定
        </button>
      </div>

      {/* Month Selector */}
      <div className="flex items-center gap-2">
        <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <input
          type="month"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
        />
        <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded">
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* 36 Agreement Limits Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-3">36協定上限</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-400 text-xs">月間上限</p>
            <p className="font-bold text-gray-800">{agreement.monthlyLimitHours}時間</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">年間上限</p>
            <p className="font-bold text-gray-800">{agreement.annualLimitHours}時間</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">特別条項月間</p>
            <p className="font-bold text-gray-800">{agreement.specialMonthlyLimit}時間</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">特別条項上限月数</p>
            <p className="font-bold text-gray-800">{agreement.specialMonthsLimit}ヶ月</p>
          </div>
        </div>
      </div>

      {/* Monthly Overtime Bar Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">月間残業時間（スタッフ別）</h2>
          <p className="text-xs text-gray-400 mt-1">
            所定労働時間: {prescribedHours}時間/日
          </p>
        </div>

        {sortedData.length === 0 ? (
          <div className="p-8 text-center text-gray-500">スタッフデータがありません</div>
        ) : (
          <div className="p-4 space-y-3">
            {sortedData.map(item => {
              const monthlyHours = item.monthlyOvertimeMinutes / 60;
              const annualHours = item.annualOvertimeMinutes / 60;
              const monthlyRatio = agreement.monthlyLimitHours > 0
                ? monthlyHours / agreement.monthlyLimitHours
                : 0;
              const annualRatio = agreement.annualLimitHours > 0
                ? annualHours / agreement.annualLimitHours
                : 0;
              const barWidth = maxBarMinutes > 0
                ? Math.min((item.monthlyOvertimeMinutes / maxBarMinutes) * 100, 100)
                : 0;
              const limitLinePos = maxBarMinutes > 0
                ? Math.min((agreement.monthlyLimitHours * 60 / maxBarMinutes) * 100, 100)
                : 0;

              return (
                <div key={item.userId} className="flex items-center gap-3">
                  <div className="w-24 text-sm font-medium text-gray-700 truncate shrink-0">
                    {item.staffName}
                  </div>
                  <div className="flex-1 relative">
                    {/* Background */}
                    <div className="h-6 bg-gray-100 rounded-full relative overflow-hidden">
                      {/* Bar */}
                      <div
                        className={`h-full rounded-full transition-all ${getOvertimeColor(monthlyRatio)}`}
                        style={{ width: `${barWidth}%` }}
                      />
                      {/* 45h limit line */}
                      {limitLinePos > 0 && limitLinePos <= 100 && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-red-500"
                          style={{ left: `${limitLinePos}%` }}
                          title={`月間上限 ${agreement.monthlyLimitHours}h`}
                        />
                      )}
                    </div>
                  </div>
                  <div className="w-28 text-right shrink-0">
                    <span className={`text-sm font-bold ${getOvertimeTextColor(monthlyRatio)}`}>
                      {monthlyHours.toFixed(1)}h
                    </span>
                    <span className="text-xs text-gray-400 ml-1">
                      / 年{annualHours.toFixed(0)}h
                    </span>
                  </div>
                  {monthlyRatio >= 0.8 && (
                    <AlertTriangle className={`w-4 h-4 shrink-0 ${monthlyRatio >= 1.0 ? 'text-red-500' : 'text-amber-500'}`} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="px-4 pb-4 flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-400 inline-block" /> 80%未満
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> 80-100%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> 上限超過
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1 h-3 bg-red-500 inline-block" /> 月間上限ライン
          </span>
        </div>
      </div>

      {/* Annual Overview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">年間累計残業（{fiscalYear}年度）</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-gray-600">スタッフ</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">月間残業</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">年間累計</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">年間残り</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedData.map(item => {
                const monthlyH = item.monthlyOvertimeMinutes / 60;
                const annualH = item.annualOvertimeMinutes / 60;
                const remaining = Math.max(0, agreement.annualLimitHours - annualH);
                const annualRatio = agreement.annualLimitHours > 0
                  ? annualH / agreement.annualLimitHours
                  : 0;

                return (
                  <tr key={item.userId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{item.staffName}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-medium ${getOvertimeTextColor(monthlyH / agreement.monthlyLimitHours)}`}>
                        {monthlyH.toFixed(1)}h
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-medium ${getOvertimeTextColor(annualRatio)}`}>
                        {annualH.toFixed(1)}h
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {remaining.toFixed(1)}h
                    </td>
                    <td className="px-4 py-3 text-center">
                      {annualRatio >= 1.0 ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">超過</span>
                      ) : annualRatio >= 0.8 ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">注意</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">正常</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 36 Agreement Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg">36協定設定</h3>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  年度
                </label>
                <p className="text-sm text-gray-800 font-bold">{fiscalYear}年度</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  月間上限時間
                </label>
                <input
                  type="number"
                  value={agreement.monthlyLimitHours}
                  onChange={e => setAgreement(prev => ({ ...prev, monthlyLimitHours: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  step="0.5"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  年間上限時間
                </label>
                <input
                  type="number"
                  value={agreement.annualLimitHours}
                  onChange={e => setAgreement(prev => ({ ...prev, annualLimitHours: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  step="1"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  特別条項月間上限
                </label>
                <input
                  type="number"
                  value={agreement.specialMonthlyLimit}
                  onChange={e => setAgreement(prev => ({ ...prev, specialMonthlyLimit: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  step="0.5"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  特別条項適用可能月数
                </label>
                <input
                  type="number"
                  value={agreement.specialMonthsLimit}
                  onChange={e => setAgreement(prev => ({ ...prev, specialMonthsLimit: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  step="1"
                  min="0"
                  max="12"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  適用開始日
                </label>
                <input
                  type="date"
                  value={agreement.effectiveFrom}
                  onChange={e => setAgreement(prev => ({ ...prev, effectiveFrom: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={saveAgreement}
                disabled={saving}
                className="flex-1 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
