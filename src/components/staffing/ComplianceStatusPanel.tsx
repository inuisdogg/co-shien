/**
 * コンプライアンス状況パネル
 * Compliance Status Panel
 *
 * 月間の人員配置コンプライアンス状況をカレンダー形式で表示
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Users,
  Clock,
  Info,
} from 'lucide-react';
import {
  Staff,
  StaffPersonnelSettings,
  ShiftWithPattern,
  DailyStaffingCompliance,
} from '@/types';
import { useStaffingCompliance } from '@/hooks/useStaffingCompliance';

interface ComplianceStatusPanelProps {
  year: number;
  month: number;
  shifts: ShiftWithPattern[];
  staff: Staff[];
  personnelSettings: StaffPersonnelSettings[];
}

const ComplianceStatusPanel: React.FC<ComplianceStatusPanelProps> = ({
  year: initialYear,
  month: initialMonth,
  shifts,
  staff,
  personnelSettings,
}) => {
  const { calculateComplianceForMonth, getMonthlySummary } = useStaffingCompliance();

  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [compliance, setCompliance] = useState<Map<string, DailyStaffingCompliance>>(new Map());

  // 月間コンプライアンスを計算
  useEffect(() => {
    const results = calculateComplianceForMonth(year, month, shifts, staff);
    setCompliance(results);
  }, [year, month, shifts, staff, calculateComplianceForMonth]);

  // 月移動
  const changeMonth = (delta: number) => {
    let newMonth = month + delta;
    let newYear = year;

    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }

    setMonth(newMonth);
    setYear(newYear);
    setSelectedDate(null);
  };

  // カレンダー日付を生成
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days: { date: string; dayOfMonth: number; isCurrentMonth: boolean }[] = [];

    // 前月の日付を埋める
    for (let i = 0; i < startDayOfWeek; i++) {
      const prevDate = new Date(year, month - 1, -startDayOfWeek + i + 1);
      days.push({
        date: prevDate.toISOString().split('T')[0],
        dayOfMonth: prevDate.getDate(),
        isCurrentMonth: false,
      });
    }

    // 当月の日付
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month - 1, i);
      days.push({
        date: date.toISOString().split('T')[0],
        dayOfMonth: i,
        isCurrentMonth: true,
      });
    }

    // 次月の日付を埋める（6週分になるように）
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const nextDate = new Date(year, month, i);
      days.push({
        date: nextDate.toISOString().split('T')[0],
        dayOfMonth: i,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [year, month]);

  // 日付のコンプライアンス状態を取得
  const getComplianceStatus = (date: string) => {
    const dayCompliance = compliance.get(date);
    if (!dayCompliance) return 'unknown';
    return dayCompliance.overallStatus;
  };

  // サマリー計算
  const summary = useMemo(() => {
    let compliant = 0;
    let warning = 0;
    let nonCompliant = 0;

    compliance.forEach((c) => {
      if (c.overallStatus === 'compliant') compliant++;
      else if (c.overallStatus === 'warning') warning++;
      else nonCompliant++;
    });

    return { compliant, warning, nonCompliant, total: compliance.size };
  }, [compliance]);

  // 選択日の詳細
  const selectedCompliance = selectedDate ? compliance.get(selectedDate) : null;

  return (
    <div className="space-y-6">
      {/* 月選択 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => changeMonth(-1)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
            <Calendar size={20} className="text-teal-600" />
            {year}年{month}月
          </h3>
          <button
            onClick={() => changeMonth(1)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <CheckCircle size={20} className="text-green-500" />
            <span className="text-sm text-gray-600">充足</span>
          </div>
          <div className="text-3xl font-bold text-green-600">{summary.compliant}</div>
          <div className="text-xs text-gray-500 mt-1">日</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <AlertTriangle size={20} className="text-yellow-500" />
            <span className="text-sm text-gray-600">注意</span>
          </div>
          <div className="text-3xl font-bold text-yellow-600">{summary.warning}</div>
          <div className="text-xs text-gray-500 mt-1">日</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <XCircle size={20} className="text-red-500" />
            <span className="text-sm text-gray-600">不足</span>
          </div>
          <div className="text-3xl font-bold text-red-600">{summary.nonCompliant}</div>
          <div className="text-xs text-gray-500 mt-1">日</div>
        </div>
      </div>

      {/* カレンダー */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {['日', '月', '火', '水', '木', '金', '土'].map((day, idx) => (
            <div
              key={day}
              className={`py-3 text-center text-sm font-medium ${
                idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-600'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 日付グリッド */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const status = day.isCurrentMonth ? getComplianceStatus(day.date) : 'unknown';
            const isSelected = selectedDate === day.date;
            const isToday = day.date === new Date().toISOString().split('T')[0];

            return (
              <button
                key={idx}
                onClick={() => day.isCurrentMonth && setSelectedDate(day.date)}
                disabled={!day.isCurrentMonth}
                className={`
                  relative h-16 border-b border-r border-gray-100 transition-colors
                  ${day.isCurrentMonth ? 'hover:bg-gray-50' : 'bg-gray-50/50'}
                  ${isSelected ? 'ring-2 ring-inset ring-teal-500' : ''}
                `}
              >
                <div
                  className={`
                    text-sm font-medium mt-1
                    ${!day.isCurrentMonth && 'text-gray-300'}
                    ${day.isCurrentMonth && idx % 7 === 0 && 'text-red-500'}
                    ${day.isCurrentMonth && idx % 7 === 6 && 'text-blue-500'}
                    ${day.isCurrentMonth && idx % 7 !== 0 && idx % 7 !== 6 && 'text-gray-700'}
                  `}
                >
                  {day.dayOfMonth}
                </div>
                {isToday && (
                  <div className="absolute top-1 right-1 w-2 h-2 bg-teal-500 rounded-full" />
                )}
                {day.isCurrentMonth && status !== 'unknown' && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                    {status === 'compliant' && (
                      <div className="w-3 h-3 bg-green-500 rounded-full" />
                    )}
                    {status === 'warning' && (
                      <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                    )}
                    {status === 'non_compliant' && (
                      <div className="w-3 h-3 bg-red-500 rounded-full" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 選択日の詳細 */}
      {selectedDate && selectedCompliance && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h4 className="font-bold text-gray-800">
              {new Date(selectedDate).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short',
              })}
              の配置状況
            </h4>
          </div>
          <div className="p-5 space-y-4">
            {/* ステータス */}
            <div
              className={`flex items-center gap-3 p-4 rounded-lg ${
                selectedCompliance.overallStatus === 'compliant'
                  ? 'bg-green-50 text-green-700'
                  : selectedCompliance.overallStatus === 'warning'
                  ? 'bg-yellow-50 text-yellow-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {selectedCompliance.overallStatus === 'compliant' ? (
                <CheckCircle size={24} />
              ) : selectedCompliance.overallStatus === 'warning' ? (
                <AlertTriangle size={24} />
              ) : (
                <XCircle size={24} />
              )}
              <span className="font-bold">
                {selectedCompliance.overallStatus === 'compliant'
                  ? '人員配置基準を満たしています'
                  : selectedCompliance.overallStatus === 'warning'
                  ? '一部注意事項があります'
                  : '人員配置基準を満たしていません'}
              </span>
            </div>

            {/* 詳細情報 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">配置人数</div>
                <div className="text-xl font-bold text-gray-800">
                  {selectedCompliance.scheduledStaffCount}名
                </div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">常勤換算</div>
                <div className="text-xl font-bold text-gray-800">
                  {selectedCompliance.fteTotal?.toFixed(2) || '0.00'}
                </div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">2名配置</div>
                <div className="text-xl font-bold">
                  {selectedCompliance.hasTwoStaff ? (
                    <CheckCircle className="inline text-green-500" size={24} />
                  ) : (
                    <XCircle className="inline text-red-500" size={24} />
                  )}
                </div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">常勤専従</div>
                <div className="text-xl font-bold">
                  {selectedCompliance.hasFulltimeDedicated ? (
                    <CheckCircle className="inline text-green-500" size={24} />
                  ) : (
                    <XCircle className="inline text-red-500" size={24} />
                  )}
                </div>
              </div>
            </div>

            {/* 警告一覧 */}
            {selectedCompliance.warnings && selectedCompliance.warnings.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-gray-700">警告・注意事項</h5>
                {selectedCompliance.warnings.map((warn, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                      warn.severity === 'error'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-yellow-50 text-yellow-700'
                    }`}
                  >
                    <AlertTriangle size={16} />
                    {warn.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 凡例 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-6 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <span>基準充足</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full" />
            <span>注意あり</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <span>基準不足</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-teal-500 rounded-full" />
            <span>今日</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplianceStatusPanel;
