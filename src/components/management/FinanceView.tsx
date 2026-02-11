/**
 * 財務管理ビュー
 * 損益計算書・キャッシュフロー・経費管理を統合
 */

'use client';

import React, { useState } from 'react';
import {
  FileText,
  Wallet,
  Receipt,
} from 'lucide-react';
import ProfitLossView from './ProfitLossView';
import CashFlowView from './CashFlowView';
import ExpenseManagementView from './ExpenseManagementView';

type TabType = 'profit-loss' | 'cash-flow' | 'expense';

type Props = {
  facilityId: string;
  userId: string;
  userName: string;
};

export default function FinanceView({ facilityId, userId, userName }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('profit-loss');

  const tabs = [
    { id: 'profit-loss' as TabType, label: '損益計算書', icon: FileText },
    { id: 'cash-flow' as TabType, label: 'キャッシュフロー', icon: Wallet },
    { id: 'expense' as TabType, label: '経費管理', icon: Receipt },
  ];

  return (
    <div className="space-y-4">
      {/* タブ */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-teal-500 text-teal-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* コンテンツ */}
      {activeTab === 'profit-loss' && (
        <ProfitLossView facilityId={facilityId} />
      )}
      {activeTab === 'cash-flow' && (
        <CashFlowView facilityId={facilityId} />
      )}
      {activeTab === 'expense' && (
        <ExpenseManagementView
          facilityId={facilityId}
          approverId={userId}
          approverName={userName}
        />
      )}
    </div>
  );
}
