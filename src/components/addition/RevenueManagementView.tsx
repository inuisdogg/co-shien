'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import AdditionSettingsView from './AdditionSettingsView';

// Heavy simulation components - dynamic imports for performance
const AdditionSimulatorView = dynamic(
  () => import('@/components/simulation/AdditionSimulatorView'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-t-transparent border-gray-500 rounded-full animate-spin" />
      </div>
    ),
  }
);

const StaffPlanningSimulator = dynamic(
  () => import('@/components/simulation/StaffPlanningSimulator'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-t-transparent border-gray-500 rounded-full animate-spin" />
      </div>
    ),
  }
);

const REVENUE_TABS = [
  { id: 'addition-settings', label: '加算設定' },
  { id: 'revenue-simulation', label: '収益シミュレーション' },
  { id: 'staff-planning', label: '採用計画' },
] as const;

type TabId = (typeof REVENUE_TABS)[number]['id'];

export default function RevenueManagementView() {
  const [activeTab, setActiveTab] = useState<TabId>('addition-settings');

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6" aria-label="Tabs">
          {REVENUE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-gray-800 text-gray-800'
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'addition-settings' && <AdditionSettingsView />}
      {activeTab === 'revenue-simulation' && <AdditionSimulatorView />}
      {activeTab === 'staff-planning' && <StaffPlanningSimulator />}
    </div>
  );
}
