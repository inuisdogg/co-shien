/**
 * FacilityWorkTools - 施設別業務ツールアコーディオン
 * 各施設の業務管理ツールをアコーディオン形式で表示
 */

'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Building2,
  Clock,
  FileText,
  Receipt,
  Calendar,
  CalendarDays,
  Bell,
  PlayCircle,
  PauseCircle,
  Coffee,
  LogOut,
  Briefcase,
  Wallet,
  Scale,
  FolderOpen,
  Library,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  WorkToolId,
  WORK_TOOLS,
  WorkStatus,
  WORK_STATUS_LABELS,
  AttendanceDailySummary,
  FacilityWorkToolSettings,
} from '@/types';
import { FacilityWorkData } from '@/hooks/usePersonalData';

// アイコンマッピング
const ICON_MAP: Record<string, React.ElementType> = {
  Clock,
  FileText,
  Receipt,
  Calendar,
  CalendarDays,
  Bell,
  Briefcase,
  Wallet,
  Scale,
  FolderOpen,
  Library,
};

interface FacilityWorkToolsProps {
  facilities: FacilityWorkData[];
  onClockIn: (facilityId: string) => Promise<void>;
  onClockOut: (facilityId: string) => Promise<void>;
  onStartBreak: (facilityId: string) => Promise<void>;
  onEndBreak: (facilityId: string) => Promise<void>;
  onToolClick: (facilityId: string, toolId: WorkToolId) => void;
  isLoading?: boolean;
}

// 打刻ボタン
function TimeTrackingButtons({
  facilityId,
  attendance,
  onClockIn,
  onClockOut,
  onStartBreak,
  onEndBreak,
}: {
  facilityId: string;
  attendance: AttendanceDailySummary | null;
  onClockIn: (facilityId: string) => Promise<void>;
  onClockOut: (facilityId: string) => Promise<void>;
  onStartBreak: (facilityId: string) => Promise<void>;
  onEndBreak: (facilityId: string) => Promise<void>;
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const status = attendance?.status || 'not_started';

  const handleAction = async (action: () => Promise<void>) => {
    setIsProcessing(true);
    try {
      await action();
    } catch (error) {
      console.error('打刻エラー:', error);
      alert(`打刻に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // co-shienカラーベースのボタンスタイル
  const buttonBase = "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed";

  // アクティブ時のスタイル（co-shienティール系）
  const activeStyles = {
    start: 'bg-[#00c4cc] hover:bg-[#00b0b8] text-white shadow-md',
    break: 'bg-[#00a3aa] hover:bg-[#009299] text-white shadow-md',
    resume: 'bg-[#00c4cc] hover:bg-[#00b0b8] text-white shadow-md',
    end: 'bg-[#008b92] hover:bg-[#007a80] text-white shadow-md',
  };

  const inactiveStyle = 'bg-gray-100 text-gray-400 border border-gray-200';

  return (
    <div className="space-y-3">
      {/* 現在の勤務状況 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">本日の勤務状況:</span>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${WORK_STATUS_LABELS[status].color}`}>
          {WORK_STATUS_LABELS[status].label}
        </span>
      </div>

      {/* 打刻時間表示 */}
      {attendance?.startTime && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 bg-white/50 rounded-lg px-3 py-2">
          <div>始業: <span className="font-bold text-[#00c4cc]">{attendance.startTime.slice(0, 5)}</span></div>
          {attendance.breakStartTime && (
            <div>休憩: <span className="font-bold text-[#00a3aa]">{attendance.breakStartTime.slice(0, 5)}</span></div>
          )}
          {attendance.breakEndTime && (
            <div>戻り: <span className="font-bold text-[#00c4cc]">{attendance.breakEndTime.slice(0, 5)}</span></div>
          )}
          {attendance.endTime && (
            <div>退勤: <span className="font-bold text-[#008b92]">{attendance.endTime.slice(0, 5)}</span></div>
          )}
        </div>
      )}

      {/* 打刻ボタン - 横一列 */}
      <div className="flex gap-2">
        {/* 始業ボタン */}
        <button
          onClick={() => handleAction(() => onClockIn(facilityId))}
          disabled={isProcessing || status !== 'not_started'}
          className={`${buttonBase} ${
            status === 'not_started' ? activeStyles.start : inactiveStyle
          }`}
        >
          <PlayCircle className="w-4 h-4" />
          始業
        </button>

        {/* 休憩開始ボタン */}
        <button
          onClick={() => handleAction(() => onStartBreak(facilityId))}
          disabled={isProcessing || status !== 'working'}
          className={`${buttonBase} ${
            status === 'working' ? activeStyles.break : inactiveStyle
          }`}
        >
          <Coffee className="w-4 h-4" />
          休憩
        </button>

        {/* 休憩終了ボタン */}
        <button
          onClick={() => handleAction(() => onEndBreak(facilityId))}
          disabled={isProcessing || status !== 'on_break'}
          className={`${buttonBase} ${
            status === 'on_break' ? activeStyles.resume : inactiveStyle
          }`}
        >
          <PauseCircle className="w-4 h-4" />
          戻り
        </button>

        {/* 退勤ボタン */}
        <button
          onClick={() => handleAction(() => onClockOut(facilityId))}
          disabled={isProcessing || (status !== 'working' && status !== 'on_break')}
          className={`${buttonBase} ${
            status === 'working' || status === 'on_break' ? activeStyles.end : inactiveStyle
          }`}
        >
          <LogOut className="w-4 h-4" />
          退勤
        </button>
      </div>
    </div>
  );
}

// 業務ツールグリッド
function WorkToolGrid({
  facilityId,
  settings,
  onToolClick,
  hasBizAccess,
}: {
  facilityId: string;
  settings: FacilityWorkToolSettings | null;
  onToolClick: (facilityId: string, toolId: WorkToolId) => void;
  hasBizAccess: boolean;
}) {
  // 有効なツールを取得（打刻は別セクションなので除外）
  const enabledTools = WORK_TOOLS.filter(tool => {
    // 打刻は別セクションで表示するので除外
    if (tool.id === 'time_tracking') return false;
    // Bizダッシュボードは常に表示（権限チェックはクリック時に行う）
    if (tool.id === 'biz_dashboard') return true;

    if (!settings) {
      // 設定がない場合はデフォルト設定を使用
      return tool.defaultEnabled;
    }
    // 設定にキーがない場合（新しく追加されたツール）はデフォルト設定を使用
    if (settings.enabledTools[tool.id] === undefined) {
      return tool.defaultEnabled;
    }
    return settings.enabledTools[tool.id];
  });

  // ツール順序でソート
  const sortedTools = settings?.toolOrder
    ? enabledTools.sort((a, b) => {
        const aIndex = settings.toolOrder.indexOf(a.id);
        const bIndex = settings.toolOrder.indexOf(b.id);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      })
    : enabledTools;

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
      {sortedTools.map(tool => {
        const IconComponent = ICON_MAP[tool.icon] || FileText;
        // Bizダッシュボードは特別なスタイル
        const isBizDashboard = tool.id === 'biz_dashboard';
        return (
          <button
            key={tool.id}
            onClick={() => onToolClick(facilityId, tool.id)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors border ${
              isBizDashboard
                ? 'bg-[#00c4cc]/10 hover:bg-[#00c4cc]/20 border-[#00c4cc]/30'
                : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
            }`}
          >
            <IconComponent className={`w-6 h-6 ${isBizDashboard ? 'text-[#00c4cc]' : 'text-[#818CF8]'}`} />
            <span className="text-xs font-medium text-gray-700 text-center leading-tight">
              {tool.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function FacilityWorkTools({
  facilities,
  onClockIn,
  onClockOut,
  onStartBreak,
  onEndBreak,
  onToolClick,
  isLoading,
}: FacilityWorkToolsProps) {
  // 最初の施設をデフォルトで開く
  const [expandedFacilityId, setExpandedFacilityId] = useState<string | null>(
    facilities.length > 0 ? facilities[0].facilityId : null
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#818CF8]" />
      </div>
    );
  }

  if (facilities.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <p className="text-gray-500 text-center">所属施設がありません</p>
      </div>
    );
  }

  const toggleFacility = (facilityId: string) => {
    setExpandedFacilityId(prev => prev === facilityId ? null : facilityId);
  };

  return (
    <div className="space-y-3">
      {facilities.map((facility) => {
        const isExpanded = expandedFacilityId === facility.facilityId;
        const status = facility.todayAttendance?.status || 'not_started';

        return (
          <div
            key={facility.facilityId}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
          >
            {/* ヘッダー（クリックで開閉） */}
            <button
              onClick={() => toggleFacility(facility.facilityId)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-[#818CF8]" />
                <div className="text-left">
                  <p className="font-bold text-gray-800">{facility.facilityName}</p>
                  <p className="text-xs text-gray-500">{facility.employmentRecord.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* 勤務ステータスバッジ */}
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${WORK_STATUS_LABELS[status].color}`}>
                  {WORK_STATUS_LABELS[status].label}
                </span>
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>

            {/* コンテンツ（アコーディオン） */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-4">
                    {/* 打刻セクション */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <TimeTrackingButtons
                        facilityId={facility.facilityId}
                        attendance={facility.todayAttendance}
                        onClockIn={onClockIn}
                        onClockOut={onClockOut}
                        onStartBreak={onStartBreak}
                        onEndBreak={onEndBreak}
                      />
                    </div>

                    {/* 区切り線 */}
                    <div className="border-t border-gray-200" />

                    {/* 業務ツールグリッド */}
                    <WorkToolGrid
                      facilityId={facility.facilityId}
                      settings={facility.workToolSettings}
                      onToolClick={onToolClick}
                      hasBizAccess={
                        facility.employmentRecord.role === '管理者' ||
                        Boolean(facility.employmentRecord.permissions &&
                         Object.values(facility.employmentRecord.permissions).some(v => v === true))
                      }
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
