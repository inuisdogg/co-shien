'use client';

import React, { useState } from 'react';
import { Shield, AlertTriangle, Award } from 'lucide-react';
import BcpManagementPanel from './BcpManagementPanel';
import AbusePreventionPanel from './AbusePreventionPanel';
import QualificationManagementPanel from './QualificationManagementPanel';

const ACCENT = '#00c4cc';

type TabId = 'bcp' | 'abuse' | 'qualification';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'bcp', label: 'BCP・防災', icon: Shield },
  { id: 'abuse', label: '虐待防止', icon: AlertTriangle },
  { id: 'qualification', label: '資格管理', icon: Award },
];

const ComplianceView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('bcp');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">コンプライアンス</h1>
        <p className="text-sm text-gray-500 mt-0.5">BCP・防災、虐待防止、資格管理</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0 -mb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-current text-[#00c4cc]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                style={isActive ? { color: ACCENT } : undefined}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'bcp' && <BcpManagementPanel />}
      {activeTab === 'abuse' && <AbusePreventionPanel />}
      {activeTab === 'qualification' && <QualificationManagementPanel />}
    </div>
  );
};

export default ComplianceView;
