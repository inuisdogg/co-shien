/**
 * 人員配置管理ダッシュボード
 * Staffing Management Dashboard
 *
 * 児発・放デイの人員配置管理メイン画面
 * - 基準人員/加算人員の配置状況
 * - コンプライアンス警告
 * - 管理者・児発管の設定
 * - 勤務体制一覧表へのリンク
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  UserCheck,
  UserPlus,
  Clock,
  AlertTriangle,
  CheckCircle,
  FileText,
  ChevronRight,
  Settings,
  RefreshCw,
  Calendar,
  Shield,
} from 'lucide-react';
import { Staff, StaffPersonnelSettings, ShiftWithPattern, PERSONNEL_TYPE_LABELS, WORK_STYLE_LABELS } from '@/types';
import { useStaffingCompliance } from '@/hooks/useStaffingCompliance';
import { useFacilityData } from '@/hooks/useFacilityData';
import StaffPersonnelList from './StaffPersonnelList';
import ComplianceStatusPanel from './ComplianceStatusPanel';
import ManagerPickerModal from './ManagerPickerModal';

interface StaffingDashboardProps {
  onNavigateToWorkSchedule?: () => void;
}

const StaffingDashboard: React.FC<StaffingDashboardProps> = ({ onNavigateToWorkSchedule }) => {
  const { staff, facilitySettings } = useFacilityData();
  // シフトデータは現状不要（コンプライアンス計算時に別途取得）
  const shifts: ShiftWithPattern[] = [];
  const {
    personnelSettings,
    additionRequirements,
    facilityStaffingSettings,
    fetchPersonnelSettings,
    fetchAdditionRequirements,
    fetchFacilityStaffingSettings,
    saveFacilityStaffingSettings,
    calculateComplianceForDate,
    loading,
    error,
  } = useStaffingCompliance();

  // 表示状態
  const [currentView, setCurrentView] = useState<'overview' | 'personnel' | 'compliance'>('overview');
  const [showManagerPicker, setShowManagerPicker] = useState<'manager' | 'serviceManager' | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  // 初期データ読み込み
  useEffect(() => {
    fetchPersonnelSettings();
    fetchAdditionRequirements();
    fetchFacilityStaffingSettings();
  }, [fetchPersonnelSettings, fetchAdditionRequirements, fetchFacilityStaffingSettings]);

  // 今日のコンプライアンス計算
  const todayCompliance = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return calculateComplianceForDate(today, shifts, staff);
  }, [shifts, staff, calculateComplianceForDate]);

  // サマリー計算
  const summary = useMemo(() => {
    const standardStaff = personnelSettings.filter((p) => p.personnelType === 'standard');
    const additionStaff = personnelSettings.filter((p) => p.personnelType === 'addition');
    const standardWeeklyHours = facilityStaffingSettings?.standardWeeklyHours || 40;

    const totalFTE = personnelSettings.reduce((sum, p) => {
      const hours = p.contractedWeeklyHours || 0;
      return sum + hours / standardWeeklyHours;
    }, 0);

    const fulltimeCount = personnelSettings.filter(
      (p) => p.workStyle === 'fulltime_dedicated' || p.workStyle === 'fulltime_concurrent'
    ).length;

    const manager = personnelSettings.find((p) => p.isManager);
    const serviceManager = personnelSettings.find((p) => p.isServiceManager);

    return {
      totalStaff: personnelSettings.length,
      standardCount: standardStaff.length,
      additionCount: additionStaff.length,
      totalFTE: Math.round(totalFTE * 100) / 100,
      fulltimeCount,
      hasManager: !!manager,
      hasServiceManager: !!serviceManager,
      managerName: manager?.staffName,
      serviceManagerName: serviceManager?.staffName,
    };
  }, [personnelSettings, facilityStaffingSettings]);

  // コンプライアンス警告
  const warnings = useMemo(() => {
    const warns: { type: string; message: string; severity: 'error' | 'warning' }[] = [];

    // 児発管チェック
    if (!summary.hasServiceManager) {
      warns.push({
        type: 'missing_service_manager',
        message: '児童発達支援管理責任者（児発管）が設定されていません',
        severity: 'error',
      });
    }

    // 基準人員チェック（最低2名）
    if (summary.standardCount < 2) {
      warns.push({
        type: 'insufficient_standard_staff',
        message: `基準人員が不足しています（現在${summary.standardCount}名、最低2名必要）`,
        severity: 'error',
      });
    }

    // 常勤専従チェック
    const fulltimeDedicated = personnelSettings.filter((p) => p.workStyle === 'fulltime_dedicated');
    if (fulltimeDedicated.length === 0) {
      warns.push({
        type: 'no_fulltime_dedicated',
        message: '常勤専従のスタッフが配置されていません',
        severity: 'error',
      });
    }

    // 児発管の常勤専従チェック
    const serviceManager = personnelSettings.find((p) => p.isServiceManager);
    if (serviceManager && serviceManager.workStyle !== 'fulltime_dedicated') {
      warns.push({
        type: 'service_manager_not_fulltime',
        message: '児発管は常勤専従である必要があります',
        severity: 'error',
      });
    }

    return warns;
  }, [summary, personnelSettings]);

  // 管理者・児発管の保存
  const handleSaveManager = async (staffId: string, type: 'manager' | 'serviceManager') => {
    if (type === 'manager') {
      await saveFacilityStaffingSettings({ managerStaffId: staffId });
    } else {
      await saveFacilityStaffingSettings({ serviceManagerStaffId: staffId });
    }
    setShowManagerPicker(null);
    fetchPersonnelSettings();
  };

  // ビューに応じた画面切り替え
  const renderContent = () => {
    if (currentView === 'personnel') {
      return (
        <StaffPersonnelList
          staff={staff}
          personnelSettings={personnelSettings}
          additionRequirements={additionRequirements}
          onRefresh={fetchPersonnelSettings}
        />
      );
    }

    if (currentView === 'compliance') {
      return (
        <ComplianceStatusPanel
          year={selectedYear}
          month={selectedMonth}
          shifts={shifts}
          staff={staff}
          personnelSettings={personnelSettings}
        />
      );
    }

    // Overview（概要）
    return (
      <div className="space-y-6">
        {/* 警告セクション */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((warn, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 p-4 rounded-lg border ${
                  warn.severity === 'error'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                }`}
              >
                <AlertTriangle size={20} />
                <span className="font-medium">{warn.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* サマリーカード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <Users size={20} className="text-teal-600" />
              <span className="text-xs text-gray-500">基準人員</span>
            </div>
            <div className="text-3xl font-bold text-gray-800">{summary.standardCount}</div>
            <div className="text-sm text-gray-500 mt-1">名</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <UserPlus size={20} className="text-orange-500" />
              <span className="text-xs text-gray-500">加算人員</span>
            </div>
            <div className="text-3xl font-bold text-gray-800">{summary.additionCount}</div>
            <div className="text-sm text-gray-500 mt-1">名</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <Clock size={20} className="text-purple-500" />
              <span className="text-xs text-gray-500">常勤換算</span>
            </div>
            <div className="text-3xl font-bold text-gray-800">{summary.totalFTE}</div>
            <div className="text-sm text-gray-500 mt-1">人</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <Shield size={20} className={warnings.length === 0 ? 'text-green-500' : 'text-red-500'} />
              <span className="text-xs text-gray-500">基準充足</span>
            </div>
            <div className={`text-3xl font-bold ${warnings.length === 0 ? 'text-green-600' : 'text-red-600'}`}>
              {warnings.length === 0 ? 'OK' : 'NG'}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {warnings.length > 0 ? `${warnings.length}件の警告` : '問題なし'}
            </div>
          </div>
        </div>

        {/* 管理者・児発管セクション */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-gray-800">管理者・児発管</h3>
          </div>
          <div className="p-5 space-y-4">
            {/* 管理者 */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="text-sm text-gray-500">管理者</div>
                <div className="font-bold text-gray-800">
                  {summary.managerName || '未設定'}
                </div>
              </div>
              <button
                onClick={() => setShowManagerPicker('manager')}
                className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {summary.hasManager ? '変更' : '設定'}
              </button>
            </div>

            {/* 児発管 */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="text-sm text-gray-500">児童発達支援管理責任者（児発管）</div>
                <div className="font-bold text-gray-800">
                  {summary.serviceManagerName || '未設定'}
                </div>
                {!summary.hasServiceManager && (
                  <div className="text-xs text-red-600 mt-1">
                    必須：常勤専従で配置する必要があります
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowManagerPicker('serviceManager')}
                className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {summary.hasServiceManager ? '変更' : '設定'}
              </button>
            </div>
          </div>
        </div>

        {/* クイックアクション */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setCurrentView('personnel')}
            className="flex items-center justify-between p-5 bg-white rounded-xl border border-gray-200 hover:border-teal-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-teal-50 rounded-lg group-hover:bg-teal-100 transition-colors">
                <UserCheck size={24} className="text-teal-600" />
              </div>
              <div className="text-left">
                <div className="font-bold text-gray-800">スタッフ人員設定</div>
                <div className="text-sm text-gray-500">基準人員/加算人員の設定</div>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-400 group-hover:text-teal-600 transition-colors" />
          </button>

          <button
            onClick={onNavigateToWorkSchedule}
            className="flex items-center justify-between p-5 bg-white rounded-xl border border-gray-200 hover:border-teal-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition-colors">
                <FileText size={24} className="text-orange-600" />
              </div>
              <div className="text-left">
                <div className="font-bold text-gray-800">勤務体制一覧表</div>
                <div className="text-sm text-gray-500">行政提出用書類の作成</div>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-400 group-hover:text-orange-600 transition-colors" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="text-teal-600" size={24} />
            人員配置管理
          </h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            基準人員・加算人員の配置設定と勤務体制の管理
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchPersonnelSettings();
              fetchFacilityStaffingSettings();
            }}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-teal-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* タブナビゲーション */}
      <div className="bg-white rounded-lg border border-gray-200 p-1 flex gap-1">
        {[
          { id: 'overview', label: '概要', icon: Users },
          { id: 'personnel', label: 'スタッフ設定', icon: UserCheck },
          { id: 'compliance', label: 'コンプライアンス', icon: Shield },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCurrentView(tab.id as typeof currentView)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-medium transition-colors ${
              currentView === tab.id
                ? 'bg-teal-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <tab.icon size={16} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* メインコンテンツ */}
      {renderContent()}

      {/* 管理者・児発管選択モーダル */}
      {showManagerPicker && (
        <ManagerPickerModal
          type={showManagerPicker}
          staff={staff}
          personnelSettings={personnelSettings}
          onSelect={(staffId) => handleSaveManager(staffId, showManagerPicker)}
          onClose={() => setShowManagerPicker(null)}
        />
      )}

      {/* エラー表示 */}
      {error && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg shadow-lg">
          <AlertTriangle size={20} />
          {error}
        </div>
      )}
    </div>
  );
};

export default StaffingDashboard;
