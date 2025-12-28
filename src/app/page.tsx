/**
 * Main Application Page
 */

'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/common/Sidebar';
import Header from '@/components/common/Header';
import DashboardView from '@/components/dashboard/DashboardView';
import ManagementSettingsView from '@/components/management/ManagementSettingsView';
import LeadView from '@/components/lead/LeadView';
import ScheduleView from '@/components/schedule/ScheduleView';
import ChildrenView from '@/components/children/ChildrenView';
import StaffView from '@/components/staff/StaffView';
import FacilitySettingsView from '@/components/facility/FacilitySettingsView';

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'management':
        return <ManagementSettingsView />;
      case 'lead':
        return <LeadView setActiveTab={setActiveTab} />;
      case 'schedule':
        return <ScheduleView />;
      case 'children':
        return <ChildrenView setActiveTab={setActiveTab} />;
      case 'staff':
        return <StaffView />;
      case 'facility':
        return <FacilitySettingsView />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-[#f5f6f8] font-sans text-gray-800">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6 md:p-8">
          <div className="max-w-[1600px] mx-auto h-full flex flex-col">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}

