/**
 * シフト確認パネル
 * スタッフのシフト確認状況を表示
 * - 確認/未確認ステータスアイコン
 * - 一括確認ボタン
 * - プログレスバー
 */

'use client';

import React from 'react';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Send,
  RefreshCw,
  Users,
  Eye,
  CheckCheck,
} from 'lucide-react';
import { Staff } from '@/types';

interface StaffConfirmation {
  staff: Staff;
  status: 'pending' | 'viewed' | 'confirmed' | 'rejected';
  viewedAt?: string;
  confirmedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

interface MonthlyScheduleStatus {
  year: number;
  month: number;
  status: 'draft' | 'published' | 'confirmed';
  publishedAt?: string;
  confirmedAt?: string;
}

interface ShiftConfirmationPanelProps {
  scheduleStatus: MonthlyScheduleStatus;
  confirmations: StaffConfirmation[];
  onPublish: () => void;
  onSendReminder: (staffId: string) => void;
  onSendReminderAll: () => void;
  loading?: boolean;
}

const ShiftConfirmationPanel: React.FC<ShiftConfirmationPanelProps> = ({
  scheduleStatus,
  confirmations,
  onPublish,
  onSendReminder,
  onSendReminderAll,
  loading = false,
}) => {
  // 統計計算
  const stats = {
    total: confirmations.length,
    pending: confirmations.filter((c) => c.status === 'pending').length,
    viewed: confirmations.filter((c) => c.status === 'viewed').length,
    confirmed: confirmations.filter((c) => c.status === 'confirmed').length,
    rejected: confirmations.filter((c) => c.status === 'rejected').length,
  };

  const confirmationRate =
    stats.total > 0 ? Math.round((stats.confirmed / stats.total) * 100) : 0;

  // ステータスラベル
  const getStatusLabel = (status: StaffConfirmation['status']) => {
    switch (status) {
      case 'pending':
        return { label: '未確認', icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', indicator: 'bg-yellow-400' };
      case 'viewed':
        return { label: '確認中', icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50', indicator: 'bg-blue-400' };
      case 'confirmed':
        return { label: '承認済', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', indicator: 'bg-green-500' };
      case 'rejected':
        return { label: '要修正', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', indicator: 'bg-red-500' };
      default:
        return { label: status, icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', indicator: 'bg-gray-400' };
    }
  };

  // スケジュールステータスラベル
  const getScheduleStatusLabel = () => {
    switch (scheduleStatus.status) {
      case 'draft':
        return { label: '下書き', color: 'bg-gray-100 text-gray-600' };
      case 'published':
        return { label: '公開中', color: 'bg-[#00c4cc]/10 text-[#00c4cc]' };
      case 'confirmed':
        return { label: '確定済', color: 'bg-green-100 text-green-700' };
      default:
        return { label: scheduleStatus.status, color: 'bg-gray-100 text-gray-600' };
    }
  };

  const scheduleLabel = getScheduleStatusLabel();

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* ヘッダー */}
      <div className="px-5 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00c4cc]/10 flex items-center justify-center">
              <CheckCircle size={20} className="text-[#00c4cc]" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">シフト確認状況</h3>
              <p className="text-sm text-gray-500">
                {scheduleStatus.year}年{scheduleStatus.month}月
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${scheduleLabel.color}`}>
            {scheduleLabel.label}
          </span>
        </div>
      </div>

      {/* サマリー */}
      <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
            <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
            <div className="text-xs text-gray-500">スタッフ</div>
          </div>
          <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
            <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
            <div className="text-xs text-gray-500">承認済</div>
          </div>
          <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
            <div className="text-2xl font-bold text-blue-600">{stats.viewed}</div>
            <div className="text-xs text-gray-500">確認中</div>
          </div>
          <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
            <div className="text-2xl font-bold text-gray-500">{stats.pending}</div>
            <div className="text-xs text-gray-500">未確認</div>
          </div>
        </div>

        {/* プログレスバー */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-gray-600">確認進捗</span>
            <span className="text-sm font-bold text-gray-800">{confirmationRate}%</span>
          </div>
          <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00c4cc] to-green-500 transition-all duration-500 rounded-full"
              style={{ width: `${confirmationRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="px-5 py-3 border-b border-gray-200 flex gap-2 flex-wrap">
        {scheduleStatus.status === 'draft' && (
          <button
            onClick={onPublish}
            disabled={loading}
            className="flex items-center gap-2 min-h-10 px-4 py-2 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-all duration-200 disabled:opacity-50 font-medium"
          >
            {loading ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            シフトを公開
          </button>
        )}

        {scheduleStatus.status === 'published' && stats.pending > 0 && (
          <button
            onClick={onSendReminderAll}
            disabled={loading}
            className="flex items-center gap-2 min-h-10 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all duration-200 disabled:opacity-50 font-medium"
          >
            <Send size={16} />
            未確認者にリマインド ({stats.pending}名)
          </button>
        )}

        {/* 全て確認ボタン */}
        {scheduleStatus.status === 'published' && stats.confirmed < stats.total && (
          <button
            onClick={() => {
              // 未確認のスタッフに対してリマインダーを一括送信
              const pendingStaff = confirmations.filter(c => c.status !== 'confirmed');
              pendingStaff.forEach(c => onSendReminder(c.staff.id));
              alert(`${pendingStaff.length}名のスタッフに確認リマインダーを送信しました`);
            }}
            disabled={loading}
            className="flex items-center gap-2 min-h-10 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 disabled:opacity-50 font-medium"
          >
            <CheckCheck size={16} />
            全て確認
          </button>
        )}

        {stats.rejected > 0 && (
          <span className="flex items-center gap-1 text-sm text-red-600 min-h-10 px-2">
            <AlertCircle size={14} />
            {stats.rejected}件の修正リクエストあり
          </span>
        )}
      </div>

      {/* スタッフリスト */}
      <div className="max-h-96 overflow-y-auto">
        {confirmations.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-500">
            <Users size={32} className="mx-auto mb-2 text-gray-300" />
            <p>スタッフがいません</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {confirmations.map((confirmation) => {
              const statusInfo = getStatusLabel(confirmation.status);
              const StatusIcon = statusInfo.icon;

              return (
                <div
                  key={confirmation.staff.id}
                  className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    {/* 確認インジケータ */}
                    <div className="relative">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] flex items-center justify-center">
                        <span className="text-white text-xs font-bold">
                          {confirmation.staff.name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${statusInfo.indicator}`}
                      />
                    </div>
                    <div>
                      <div className="font-medium text-gray-800 text-sm">
                        {confirmation.staff.name}
                      </div>
                      {confirmation.rejectionReason && (
                        <div className="text-xs text-red-600 mt-0.5">
                          {confirmation.rejectionReason}
                        </div>
                      )}
                      {confirmation.confirmedAt && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {new Date(confirmation.confirmedAt).toLocaleDateString('ja-JP')}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}
                    >
                      <StatusIcon size={12} />
                      {statusInfo.label}
                    </span>

                    {confirmation.status === 'pending' &&
                      scheduleStatus.status === 'published' && (
                        <button
                          onClick={() => onSendReminder(confirmation.staff.id)}
                          className="min-h-10 p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all duration-200"
                          title="リマインド送信"
                        >
                          <Send size={14} />
                        </button>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* フッター */}
      {scheduleStatus.publishedAt && (
        <div className="px-5 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
          公開日時: {new Date(scheduleStatus.publishedAt).toLocaleString('ja-JP')}
        </div>
      )}
    </div>
  );
};

export default ShiftConfirmationPanel;
