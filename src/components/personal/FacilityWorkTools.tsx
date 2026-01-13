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
  FileOutput,
  Calendar,
  CalendarDays,
  GraduationCap,
  Bell,
  CheckSquare,
  PlayCircle,
  PauseCircle,
  Coffee,
  LogOut,
  Briefcase,
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
  FileOutput,
  Calendar,
  CalendarDays,
  GraduationCap,
  Bell,
  CheckSquare,
};

interface FacilityWorkToolsProps {
  facilities: FacilityWorkData[];
  onClockIn: (facilityId: string) => Promise<void>;
  onClockOut: (facilityId: string) => Promise<void>;
  onStartBreak: (facilityId: string) => Promise<void>;
  onEndBreak: (facilityId: string) => Promise<void>;
  onToolClick: (facilityId: string, toolId: WorkToolId) => void;
  onBizDashboardClick?: (facilityId: string) => void;
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

  const buttonBase = "flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed";

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
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
          <div>始業: <span className="font-medium text-gray-800">{attendance.startTime}</span></div>
          {attendance.breakStartTime && (
            <div>休憩: <span className="font-medium text-gray-800">{attendance.breakStartTime}</span></div>
          )}
          {attendance.breakEndTime && (
            <div>戻り: <span className="font-medium text-gray-800">{attendance.breakEndTime}</span></div>
          )}
          {attendance.endTime && (
            <div>退勤: <span className="font-medium text-gray-800">{attendance.endTime}</span></div>
          )}
        </div>
      )}

      {/* 打刻ボタン */}
      <div className="grid grid-cols-2 gap-2">
        {/* 始業ボタン */}
        <button
          onClick={() => handleAction(() => onClockIn(facilityId))}
          disabled={isProcessing || status !== 'not_started'}
          className={`${buttonBase} ${
            status === 'not_started'
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          <PlayCircle className="w-5 h-5" />
          始業
        </button>

        {/* 休憩開始ボタン */}
        <button
          onClick={() => handleAction(() => onStartBreak(facilityId))}
          disabled={isProcessing || status !== 'working'}
          className={`${buttonBase} ${
            status === 'working'
              ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          <Coffee className="w-5 h-5" />
          休憩
        </button>

        {/* 休憩終了ボタン */}
        <button
          onClick={() => handleAction(() => onEndBreak(facilityId))}
          disabled={isProcessing || status !== 'on_break'}
          className={`${buttonBase} ${
            status === 'on_break'
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          <PauseCircle className="w-5 h-5" />
          戻り
        </button>

        {/* 退勤ボタン */}
        <button
          onClick={() => handleAction(() => onClockOut(facilityId))}
          disabled={isProcessing || (status !== 'working' && status !== 'on_break')}
          className={`${buttonBase} ${
            status === 'working' || status === 'on_break'
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          <LogOut className="w-5 h-5" />
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
}: {
  facilityId: string;
  settings: FacilityWorkToolSettings | null;
  onToolClick: (facilityId: string, toolId: WorkToolId) => void;
}) {
  // 有効なツールを取得
  const enabledTools = WORK_TOOLS.filter(tool => {
    if (!settings) {
      // 設定がない場合はデフォルトで全て表示
      return true;
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
        return (
          <button
            key={tool.id}
            onClick={() => onToolClick(facilityId, tool.id)}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200"
          >
            <IconComponent className="w-6 h-6 text-[#8b5cf6]" />
            <span className="text-xs font-medium text-gray-700 text-center leading-tight">
              {tool.name.replace('（', '\n（')}
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
  onBizDashboardClick,
  isLoading,
}: FacilityWorkToolsProps) {
  // 最初の施設をデフォルトで開く
  const [expandedFacilityId, setExpandedFacilityId] = useState<string | null>(
    facilities.length > 0 ? facilities[0].facilityId : null
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8b5cf6]" />
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
                <Building2 className="w-5 h-5 text-[#8b5cf6]" />
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
                    {/* Bizダッシュボードへの遷移ボタン */}
                    {onBizDashboardClick && (
                      (() => {
                        const permissions = facility.employmentRecord.permissions;
                        const hasAccess =
                          facility.employmentRecord.role === '管理者' ||
                          (permissions && Object.values(permissions).some(v => v === true));

                        if (!hasAccess) return null;

                        return (
                          <button
                            onClick={() => onBizDashboardClick(facility.facilityId)}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold rounded-lg transition-colors"
                          >
                            <Briefcase className="w-5 h-5" />
                            Bizダッシュボードを開く
                          </button>
                        );
                      })()
                    )}

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
