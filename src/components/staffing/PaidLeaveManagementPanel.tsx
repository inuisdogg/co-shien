'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Plus,
  Download,
  AlertTriangle,
  X,
  Check,
  FileText,
  ChevronLeft,
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  calculateEntitlement,
  calculateExpiryDate,
  calculateNextGrantDate,
  getCurrentFiscalYear,
  formatDays,
} from '@/lib/paidLeaveCalculator';

// ---- Local types ----

interface StaffMember {
  id: string;
  userId: string;
  name: string;
  hireDate?: string;
  employmentType?: string;
}

interface LeaveBalance {
  id: string;
  userId: string;
  facilityId: string;
  fiscalYear: number;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  grantedDate?: string;
  expiresDate?: string;
}

interface LeaveRequest {
  id: string;
  userId: string;
  requestType: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  status: string;
  createdAt: string;
}

interface LedgerEntry {
  date: string;
  type: 'grant' | 'usage';
  days: number;
  balance: number;
  description: string;
}

// ---- Component ----

export default function PaidLeaveManagementPanel() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [granting, setGranting] = useState(false);
  const [ledgerStaff, setLedgerStaff] = useState<StaffMember | null>(null);

  const fiscalYear = useMemo(() => getCurrentFiscalYear(), []);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    try {
      // Fetch staff with employment records for hire_date
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, name, user_id')
        .eq('facility_id', facilityId);

      const userIds = (staffData || []).filter((s: any) => s.user_id).map((s: any) => s.user_id);

      // Fetch employment records for hire dates
      let empRecords: any[] = [];
      if (userIds.length > 0) {
        const { data: empData } = await supabase
          .from('employment_records')
          .select('user_id, hire_date, employment_type')
          .eq('facility_id', facilityId)
          .in('user_id', userIds);
        empRecords = empData || [];
      }

      const empMap = new Map<string, { hireDate?: string; employmentType?: string }>();
      for (const e of empRecords) {
        empMap.set(e.user_id, {
          hireDate: e.hire_date,
          employmentType: e.employment_type,
        });
      }

      const members: StaffMember[] = (staffData || [])
        .filter((s: any) => s.user_id)
        .map((s: any) => ({
          id: s.id,
          userId: s.user_id,
          name: s.name,
          hireDate: empMap.get(s.user_id)?.hireDate,
          employmentType: empMap.get(s.user_id)?.employmentType,
        }));
      setStaffList(members);

      // Fetch paid leave balances
      if (userIds.length > 0) {
        const { data: balData } = await supabase
          .from('paid_leave_balances')
          .select('*')
          .eq('facility_id', facilityId)
          .in('user_id', userIds);

        setBalances(
          (balData || []).map((b: any) => ({
            id: b.id,
            userId: b.user_id,
            facilityId: b.facility_id,
            fiscalYear: b.fiscal_year,
            totalDays: Number(b.total_days),
            usedDays: Number(b.used_days),
            remainingDays: Number(b.remaining_days),
            grantedDate: b.granted_date,
            expiresDate: b.expires_date,
          }))
        );

        // Fetch leave requests for the fiscal year
        const fyStart = `${fiscalYear}-04-01`;
        const fyEnd = `${fiscalYear + 1}-03-31`;

        const { data: reqData } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('facility_id', facilityId)
          .in('user_id', userIds)
          .gte('start_date', fyStart)
          .lte('start_date', fyEnd)
          .order('start_date');

        setRequests(
          (reqData || []).map((r: any) => ({
            id: r.id,
            userId: r.user_id,
            requestType: r.request_type,
            startDate: r.start_date,
            endDate: r.end_date,
            daysCount: Number(r.days_count),
            status: r.status,
            createdAt: r.created_at,
          }))
        );
      }
    } catch (err) {
      console.error('Error fetching paid leave data:', err);
    } finally {
      setLoading(false);
    }
  }, [facilityId, fiscalYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate staff overview rows
  const staffOverview = useMemo(() => {
    return staffList.map(staff => {
      const staffBalances = balances.filter(b => b.userId === staff.userId);
      const currentBalance = staffBalances.find(b => b.fiscalYear === fiscalYear);
      const prevBalance = staffBalances.find(b => b.fiscalYear === fiscalYear - 1);

      // Total remaining across fiscal years (current + carryover)
      const totalRemaining = staffBalances
        .filter(b => {
          if (!b.expiresDate) return true;
          return new Date(b.expiresDate) > new Date();
        })
        .reduce((sum, b) => sum + b.remainingDays, 0);

      // Used days in current fiscal year
      const usedThisFY = requests
        .filter(r =>
          r.userId === staff.userId &&
          r.status === 'approved' &&
          ['paid_leave', 'half_day_am', 'half_day_pm'].includes(r.requestType)
        )
        .reduce((sum, r) => sum + r.daysCount, 0);

      // Entitlement based on hire date
      const entitlement = staff.hireDate
        ? calculateEntitlement(
            staff.hireDate,
            staff.employmentType === 'parttime' ? 'parttime' : 'fulltime'
          )
        : 0;

      const nextGrantDate = staff.hireDate ? calculateNextGrantDate(staff.hireDate) : undefined;

      // Legal requirement: at least 5 days used per fiscal year
      const needsAlert = currentBalance
        ? (currentBalance.totalDays >= 10 && usedThisFY < 5)
        : false;

      return {
        ...staff,
        totalDays: currentBalance?.totalDays || 0,
        usedDays: currentBalance?.usedDays || 0,
        remainingDays: totalRemaining,
        expiresDate: currentBalance?.expiresDate,
        grantedDate: currentBalance?.grantedDate,
        entitlement,
        nextGrantDate,
        usedThisFY,
        needsAlert,
        hasBalance: !!currentBalance,
      };
    });
  }, [staffList, balances, requests, fiscalYear]);

  // Grant paid leave
  const grantLeave = async () => {
    if (!facilityId || selectedStaffIds.length === 0) return;
    setGranting(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      for (const staffId of selectedStaffIds) {
        const staff = staffList.find(s => s.id === staffId);
        if (!staff) continue;

        const entitlement = staff.hireDate
          ? calculateEntitlement(
              staff.hireDate,
              staff.employmentType === 'parttime' ? 'parttime' : 'fulltime'
            )
          : 10; // default 10 days

        const expiryDate = calculateExpiryDate(today);

        await supabase.from('paid_leave_balances').upsert(
          {
            user_id: staff.userId,
            facility_id: facilityId,
            fiscal_year: fiscalYear,
            total_days: entitlement,
            used_days: 0,
            granted_date: today,
            expires_date: expiryDate,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,facility_id,fiscal_year' }
        );
      }

      setShowGrantModal(false);
      setSelectedStaffIds([]);
      await fetchData();
    } catch (err) {
      console.error('Error granting leave:', err);
    } finally {
      setGranting(false);
    }
  };

  // Build ledger entries for a specific staff member
  const ledgerEntries = useMemo((): LedgerEntry[] => {
    if (!ledgerStaff) return [];

    const entries: LedgerEntry[] = [];
    const staffBalanceList = balances
      .filter(b => b.userId === ledgerStaff.userId)
      .sort((a, b) => a.fiscalYear - b.fiscalYear);

    let runningBalance = 0;

    for (const bal of staffBalanceList) {
      runningBalance += bal.totalDays;
      entries.push({
        date: bal.grantedDate || `${bal.fiscalYear}-04-01`,
        type: 'grant',
        days: bal.totalDays,
        balance: runningBalance,
        description: `${bal.fiscalYear}年度付与`,
      });
    }

    // Add approved usage from leave_requests
    const staffRequests = requests
      .filter(
        r =>
          r.userId === ledgerStaff.userId &&
          r.status === 'approved' &&
          ['paid_leave', 'half_day_am', 'half_day_pm'].includes(r.requestType)
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    for (const req of staffRequests) {
      runningBalance -= req.daysCount;
      const typeLabel =
        req.requestType === 'half_day_am' ? '午前半休' :
        req.requestType === 'half_day_pm' ? '午後半休' : '有給休暇';
      entries.push({
        date: req.startDate,
        type: 'usage',
        days: req.daysCount,
        balance: Math.max(0, runningBalance),
        description: `${typeLabel} (${req.startDate}${req.startDate !== req.endDate ? ` - ${req.endDate}` : ''})`,
      });
    }

    // Sort chronologically
    entries.sort((a, b) => a.date.localeCompare(b.date));
    return entries;
  }, [ledgerStaff, balances, requests]);

  // CSV export
  const exportCSV = useCallback(() => {
    const header = 'スタッフ名,付与日,付与日数,取得日,取得日数,残日数\n';
    const rows: string[] = [];

    for (const staff of staffOverview) {
      const staffBalanceList = balances
        .filter(b => b.userId === staff.userId)
        .sort((a, b) => a.fiscalYear - b.fiscalYear);

      const staffRequests = requests
        .filter(
          r =>
            r.userId === staff.userId &&
            r.status === 'approved' &&
            ['paid_leave', 'half_day_am', 'half_day_pm'].includes(r.requestType)
        )
        .sort((a, b) => a.startDate.localeCompare(b.startDate));

      // Grant rows
      let bal = 0;
      for (const b of staffBalanceList) {
        bal += b.totalDays;
        rows.push(`${staff.name},${b.grantedDate || ''},${b.totalDays},,,${bal}`);
      }

      // Usage rows
      for (const req of staffRequests) {
        bal -= req.daysCount;
        rows.push(`${staff.name},,,${req.startDate},${req.daysCount},${Math.max(0, bal)}`);
      }
    }

    const csv = '\uFEFF' + header + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `有給管理簿_${fiscalYear}年度.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [staffOverview, balances, requests, fiscalYear]);

  // Excel export
  const exportExcel = useCallback(async () => {
    try {
      const XLSX = await import('xlsx');
      const data: unknown[][] = [
        ['スタッフ名', '付与日', '付与日数', '取得日', '取得日数', '残日数'],
      ];

      for (const staff of staffOverview) {
        const staffBalanceList = balances
          .filter(b => b.userId === staff.userId)
          .sort((a, b) => a.fiscalYear - b.fiscalYear);

        const staffRequests = requests
          .filter(
            r =>
              r.userId === staff.userId &&
              r.status === 'approved' &&
              ['paid_leave', 'half_day_am', 'half_day_pm'].includes(r.requestType)
          )
          .sort((a, b) => a.startDate.localeCompare(b.startDate));

        let bal = 0;
        for (const b of staffBalanceList) {
          bal += b.totalDays;
          data.push([staff.name, b.grantedDate || '', b.totalDays, '', '', bal]);
        }
        for (const req of staffRequests) {
          bal -= req.daysCount;
          data.push([staff.name, '', '', req.startDate, req.daysCount, Math.max(0, bal)]);
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(data);
      // Auto-fit columns
      const colWidths = data[0].map((_, ci) => {
        let maxLen = 10;
        for (const row of data) {
          const cell = row[ci];
          if (cell != null) {
            const str = String(cell);
            let len = 0;
            for (const ch of str) {
              len += ch.charCodeAt(0) > 0xff ? 2 : 1;
            }
            if (len > maxLen) maxLen = len;
          }
        }
        return { wch: Math.min(maxLen + 2, 40) };
      });
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '有給管理簿');

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `有給管理簿_${fiscalYear}年度.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Excel export error:', err);
      // Fallback to CSV
      exportCSV();
    }
  }, [staffOverview, balances, requests, fiscalYear, exportCSV]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]" />
      </div>
    );
  }

  // Ledger view for a specific staff member
  if (ledgerStaff) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLedgerStaff(null)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <FileText className="w-6 h-6 text-[#00c4cc]" />
          <h1 className="text-xl font-bold text-gray-800">
            有給管理簿 - {ledgerStaff.name}
          </h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-800">付与・取得履歴</h2>
            <div className="flex gap-2">
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
              <button
                onClick={exportExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Excel
              </button>
            </div>
          </div>

          {ledgerEntries.length === 0 ? (
            <div className="p-8 text-center text-gray-500">履歴がありません</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-gray-600">日付</th>
                    <th className="px-4 py-3 text-center font-bold text-gray-600">種別</th>
                    <th className="px-4 py-3 text-center font-bold text-gray-600">日数</th>
                    <th className="px-4 py-3 text-center font-bold text-gray-600">残日数</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-600">備考</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ledgerEntries.map((entry, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-800">{entry.date}</td>
                      <td className="px-4 py-3 text-center">
                        {entry.type === 'grant' ? (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">付与</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">取得</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-medium">
                        {entry.type === 'grant' ? `+${formatDays(entry.days)}` : `-${formatDays(entry.days)}`}
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-gray-800">
                        {formatDays(entry.balance)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{entry.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Count staff needing 5-day alert
  const alertCount = staffOverview.filter(s => s.needsAlert).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-[#00c4cc]" />
          <h1 className="text-xl font-bold text-gray-800">有給休暇管理</h1>
          <span className="text-sm text-gray-400">{fiscalYear}年度</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={() => {
              setSelectedStaffIds([]);
              setShowGrantModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            有給付与
          </button>
        </div>
      </div>

      {/* 5-day alert */}
      {alertCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">年5日取得義務アラート</p>
            <p className="text-xs text-amber-700 mt-1">
              {alertCount}名のスタッフが年5日の有給取得義務を満たしていません。
              年次有給休暇が10日以上付与されたスタッフには、年5日の取得が法律で義務付けられています。
            </p>
          </div>
        </div>
      )}

      {/* Staff Overview Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-400" />
            スタッフ有給休暇一覧
          </h2>
        </div>

        {staffOverview.length === 0 ? (
          <div className="p-8 text-center text-gray-500">スタッフが登録されていません</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-gray-600">スタッフ</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600">入社日</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600">法定付与</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600">付与日数</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600">使用日数</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600">残日数</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600">有効期限</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600">5日取得</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staffOverview.map(staff => {
                  const isLowRemaining = staff.remainingDays > 0 && staff.remainingDays < 5;
                  return (
                    <tr key={staff.id} className={`hover:bg-gray-50 ${staff.needsAlert ? 'bg-amber-50/50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-bold text-gray-600">{staff.name.charAt(0)}</span>
                          </div>
                          <span className="font-medium text-gray-800">{staff.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {staff.hireDate || '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {staff.entitlement > 0 ? formatDays(staff.entitlement) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-gray-800">
                        {staff.hasBalance ? formatDays(staff.totalDays) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {staff.hasBalance ? formatDays(staff.usedDays) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${isLowRemaining ? 'text-red-600' : 'text-gray-800'}`}>
                          {staff.hasBalance ? formatDays(staff.remainingDays) : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 text-xs">
                        {staff.expiresDate || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {staff.needsAlert ? (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                            {formatDays(staff.usedThisFY)} / 5日
                          </span>
                        ) : staff.totalDays >= 10 ? (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                            <Check className="w-3 h-3 inline" /> 達成
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setLedgerStaff(staff)}
                          className="text-xs text-[#00c4cc] hover:text-[#00b0b8] font-medium"
                        >
                          管理簿
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Grant Modal */}
      {showGrantModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg">有給休暇付与</h3>
              <button onClick={() => setShowGrantModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              付与するスタッフを選択してください。入社日から法定付与日数が自動計算されます。
            </p>

            <div className="space-y-2 mb-4 max-h-[40vh] overflow-y-auto">
              {staffList.map(staff => {
                const isSelected = selectedStaffIds.includes(staff.id);
                const entitlement = staff.hireDate
                  ? calculateEntitlement(
                      staff.hireDate,
                      staff.employmentType === 'parttime' ? 'parttime' : 'fulltime'
                    )
                  : 10;
                const existingBalance = balances.find(
                  b => b.userId === staff.userId && b.fiscalYear === fiscalYear
                );

                return (
                  <label
                    key={staff.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected ? 'border-[#00c4cc] bg-[#00c4cc]/5' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setSelectedStaffIds(prev =>
                          prev.includes(staff.id)
                            ? prev.filter(id => id !== staff.id)
                            : [...prev, staff.id]
                        );
                      }}
                      className="rounded border-gray-300 text-[#00c4cc] focus:ring-[#00c4cc]"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{staff.name}</p>
                      <p className="text-xs text-gray-400">
                        入社日: {staff.hireDate || '未登録'}
                        {' / '}
                        法定付与: {formatDays(entitlement)}
                        {existingBalance && (
                          <span className="text-amber-600 ml-2">
                            (今年度付与済: {formatDays(existingBalance.totalDays)})
                          </span>
                        )}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 mb-4">
              <p>付与日: 本日</p>
              <p>有効期限: 付与日から2年間</p>
              <p>選択中: {selectedStaffIds.length}名</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowGrantModal(false)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={grantLeave}
                disabled={granting || selectedStaffIds.length === 0}
                className="flex-1 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {granting ? '付与中...' : `${selectedStaffIds.length}名に付与`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
