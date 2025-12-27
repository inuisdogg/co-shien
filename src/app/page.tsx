/**
 * Main Application Page
 */

'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/common/Sidebar';
import Header from '@/components/common/Header';
import DashboardView from '@/components/dashboard/DashboardView';
import ScheduleView from '@/components/schedule/ScheduleView';
import ChildrenView from '@/components/children/ChildrenView';
import StaffView from '@/components/staff/StaffView';
import FinanceView from '@/components/finance/FinanceView';

export default function Home() {
  const [activeTab, setActiveTab] = useState('schedule');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView setActiveTab={setActiveTab} />;
      case 'schedule':
        return <ScheduleView />;
      case 'children':
        return <ChildrenView />;
      case 'staff':
        return <StaffView />;
      case 'finance':
        return <FinanceView />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-[#f5f6f8] font-sans text-gray-800">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6 md:p-8">
          <div className="max-w-[1600px] mx-auto h-full flex flex-col">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}

