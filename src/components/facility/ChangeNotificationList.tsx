/**
 * 変更届管理リストコンポーネント
 * 変更届通知の一覧表示・ステータス管理・ドキュメント生成
 */

'use client';

import React, { useState } from 'react';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Download,
  Send,
  Eye,
} from 'lucide-react';
import type { ChangeNotification, ChangeNotificationStatus } from '@/types';
import {
  CHANGE_NOTIFICATION_TYPE_LABELS,
  CHANGE_NOTIFICATION_STATUS_CONFIG,
} from '@/types';
import {
  daysUntilDeadline,
  getDeadlineColor,
  getDeadlineBgColor,
} from '@/hooks/useChangeNotifications';
import { exportChangeNotificationToExcel } from '@/lib/excelEngine';
import { useAuth } from '@/contexts/AuthContext';

interface ChangeNotificationListProps {
  notifications: ChangeNotification[];
  onUpdateStatus: (id: string, status: ChangeNotificationStatus) => Promise<void>;
  onRefetch: () => Promise<void>;
}

export default function ChangeNotificationList({
  notifications,
  onUpdateStatus,
  onRefetch,
}: ChangeNotificationListProps) {
  const { facility } = useAuth();
  const [selectedNotification, setSelectedNotification] = useState<ChangeNotification | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted' | 'completed'>('all');

  const filtered = notifications.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return n.status === 'pending' || n.status === 'in_progress';
    return n.status === filter;
  });

  const handleExport = (notification: ChangeNotification) => {
    exportChangeNotificationToExcel(notification, facility?.name);
  };

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
              <FileText size={20} className="text-[#00c4cc]" />
              変更届管理
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              施設設定の変更に対する届出状況を管理します
            </p>
          </div>
        </div>

        {/* フィルター */}
        <div className="flex gap-2 mt-4">
          {[
            { id: 'all' as const, label: '全て' },
            { id: 'pending' as const, label: '未対応' },
            { id: 'submitted' as const, label: '提出済' },
            { id: 'completed' as const, label: '完了' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                filter === f.id
                  ? 'bg-[#00c4cc] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
              {f.id === 'pending' && notifications.filter(n => n.status === 'pending' || n.status === 'in_progress').length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold text-white bg-red-500 rounded-full">
                  {notifications.filter(n => n.status === 'pending' || n.status === 'in_progress').length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 通知一覧 */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
          <p className="font-medium text-gray-600">
            {filter === 'pending'
              ? '未対応の変更届はありません'
              : '変更届がありません'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            施設設定の変更時に自動的に通知が作成されます
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((notification) => {
            const daysLeft = daysUntilDeadline(notification.deadline);
            const statusConfig = CHANGE_NOTIFICATION_STATUS_CONFIG[notification.status];
            const isSelected = selectedNotification?.id === notification.id;

            return (
              <div
                key={notification.id}
                className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
                  isSelected ? 'border-[#00c4cc] ring-1 ring-[#00c4cc]/20' : 'border-gray-100'
                }`}
              >
                {/* メイン行 */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setSelectedNotification(isSelected ? null : notification)}
                >
                  <div className="flex items-center gap-4">
                    {/* 期限インジケーター */}
                    <div className={`w-12 h-12 rounded-lg border flex flex-col items-center justify-center shrink-0 ${getDeadlineBgColor(daysLeft)}`}>
                      {notification.status === 'completed' || notification.status === 'submitted' ? (
                        <CheckCircle size={20} className="text-green-600" />
                      ) : daysLeft < 0 ? (
                        <>
                          <AlertTriangle size={14} className="text-red-600" />
                          <span className="text-[9px] font-bold text-red-700">超過</span>
                        </>
                      ) : (
                        <>
                          <span className={`text-lg font-bold ${getDeadlineColor(daysLeft)}`}>{daysLeft}</span>
                          <span className={`text-[9px] ${getDeadlineColor(daysLeft)}`}>日</span>
                        </>
                      )}
                    </div>

                    {/* 内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-800">
                          {CHANGE_NOTIFICATION_TYPE_LABELS[notification.changeType]}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusConfig.bg} ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {notification.changeDescription || '変更内容の説明なし'}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                        <span>検出: {new Date(notification.detectedAt).toLocaleDateString('ja-JP')}</span>
                        <span>期限: {new Date(notification.deadline).toLocaleDateString('ja-JP')}</span>
                        {notification.submittedAt && (
                          <span>提出: {new Date(notification.submittedAt).toLocaleDateString('ja-JP')}</span>
                        )}
                      </div>
                    </div>

                    {/* アクション */}
                    <div className="flex items-center gap-2 shrink-0">
                      {notification.status === 'pending' && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExport(notification);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-bold"
                          >
                            <Download size={12} />
                            書類作成
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateStatus(notification.id, 'submitted');
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors font-bold"
                          >
                            <Send size={12} />
                            提出済にする
                          </button>
                        </>
                      )}
                      {notification.status === 'in_progress' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateStatus(notification.id, 'submitted');
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors font-bold"
                        >
                          <Send size={12} />
                          提出済にする
                        </button>
                      )}
                      {notification.status === 'submitted' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateStatus(notification.id, 'completed');
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-bold"
                        >
                          <CheckCircle size={12} />
                          完了にする
                        </button>
                      )}
                      <ChevronRight size={14} className={`text-gray-400 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                </div>

                {/* 詳細 (展開時) */}
                {isSelected && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-gray-600 mb-2">変更前</h4>
                        <pre className="bg-white p-3 rounded-lg border border-gray-200 text-[10px] text-gray-700 overflow-x-auto max-h-40">
                          {JSON.stringify(notification.oldValue, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-600 mb-2">変更後</h4>
                        <pre className="bg-white p-3 rounded-lg border border-gray-200 text-[10px] text-gray-700 overflow-x-auto max-h-40">
                          {JSON.stringify(notification.newValue, null, 2)}
                        </pre>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => handleExport(notification)}
                        className="flex items-center gap-1 px-4 py-2 text-xs bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-bold"
                      >
                        <Download size={14} />
                        変更届をExcel出力
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
