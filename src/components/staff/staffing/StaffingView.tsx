/**
 * 人員配置管理ビュー
 * 人員配置状況の確認・管理メインビュー
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Shield,
  Users,
  Settings,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { useStaffMaster } from '@/hooks/useStaffMaster';
import { useAuth } from '@/contexts/AuthContext';
import { useFacilityData } from '@/hooks/useFacilityData';
import { Staff, StaffPersonnelSettings, AdditionStaffRequirement, WorkScheduleReport } from '@/types';
import { calculateStaffStats, StaffWithSettings } from '../shared/StaffSortUtils';
import StaffCard from '../shared/StaffCard';
import PersonnelOverviewPanel from './PersonnelOverviewPanel';
import PersonnelSettingsPanel from './PersonnelSettingsPanel';
import StaffPersonnelList from '@/components/staffing/StaffPersonnelList';
import WorkScheduleExport from '@/components/staffing/WorkScheduleExport';

type ViewTab = 'overview' | 'list' | 'schedule';

const StaffingView: React.FC = () => {
  const { facility } = useAuth();
  const {
    staffList,
    loading,
    error,
    fetchStaffList,
    updatePersonnelSettings,
  } = useStaffMaster();
  const { facilitySettings } = useFacilityData();

  const [activeTab, setActiveTab] = useState<ViewTab>('overview');
  const [editingStaff, setEditingStaff] = useState<StaffWithSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // 現在の年月
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // スタッフリスト（base Staff array）
  const staffBaseList = useMemo(() => staffList.map(s => ({
    id: s.id,
    facilityId: s.facilityId,
    name: s.name,
    nameKana: s.nameKana,
    type: s.type,
    role: s.role,
    phone: s.phone,
    email: s.email,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  } as Staff)), [staffList]);

  // 人員設定リスト
  const personnelSettingsList = useMemo(() =>
    staffList
      .filter((s) => (s as StaffWithSettings).personnelSettings)
      .map((s) => (s as StaffWithSettings).personnelSettings!)
  , [staffList]);

  // 加算人員要件（簡略化版）
  const additionRequirements: AdditionStaffRequirement[] = useMemo(() => [], []);

  // 統計計算
  const stats = useMemo(() => calculateStaffStats(staffList as StaffWithSettings[]), [staffList]);

  // 勤務体制レポート（簡略化版）
  const workScheduleReport: WorkScheduleReport | null = useMemo(() => ({
    id: `report-${year}-${month}`,
    year,
    month,
    facilityId: facility?.id || '',
    staffAssignments: [],
    totalStandardStaff: stats.standard,
    totalAdditionStaff: stats.addition,
    fteTotal: stats.totalFte,
    status: 'draft' as const,
    generatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }), [year, month, facility?.id, stats]);

  // サマリーデータ
  const summary = useMemo(
    () => ({
      totalStaff: stats.total,
      totalFte: stats.totalFte,
      standardStaff: stats.standard,
      additionStaff: stats.addition,
      managers: stats.managers,
      serviceManagers: stats.serviceManagers,
      fulltimeDedicated: stats.fulltimeDedicated,
      fulltimeConcurrent: stats.fulltimeConcurrent,
      parttime: stats.parttime,
    }),
    [stats]
  );

  // 施設設定が完了しているかチェック
  const isSettingsConfigured = useMemo(() => {
    const capacity = facilitySettings?.capacity;
    return capacity && (capacity.AM > 0 || capacity.PM > 0);
  }, [facilitySettings?.capacity]);

  // 施設定員を取得（AM/PMの大きい方を使用）
  const facilityCapacity = useMemo(() => {
    const capacity = facilitySettings?.capacity;
    if (!capacity) return 0;
    return Math.max(capacity.AM || 0, capacity.PM || 0);
  }, [facilitySettings?.capacity]);

  // 配置基準要件（施設設定から定員に基づいて計算）
  // 放課後等デイサービス: 定員10名まで2名以上（うち1名は常勤）、10名を超える場合は5名ごとに1名追加
  const requirements = useMemo(
    () => {
      // 必要従業者数を計算（定員10名まで2名、以降5名ごとに1名追加）
      const requiredStaffCount = facilityCapacity > 0
        ? 2 + Math.max(0, Math.ceil((facilityCapacity - 10) / 5))
        : 2; // デフォルト2名

      return [
        {
          id: 'staff-count',
          name: '従業者の員数',
          required: requiredStaffCount,
          current: stats.standard + stats.addition,
          unit: '名以上',
          status:
            stats.standard + stats.addition >= requiredStaffCount
              ? 'ok'
              : stats.standard + stats.addition >= requiredStaffCount - 1
              ? 'warning'
              : 'critical',
          description: facilityCapacity > 0
            ? `定員${facilityCapacity}名に対する配置基準（児童指導員・保育士等）`
            : '児童指導員・保育士・障害福祉サービス経験者のいずれか',
        },
        {
          id: 'fulltime-dedicated',
          name: '常勤専従',
          required: 1,
          current: stats.fulltimeDedicated,
          unit: '名以上',
          status:
            stats.fulltimeDedicated >= 1
              ? 'ok'
              : stats.fulltimeConcurrent >= 1
              ? 'warning'
              : 'critical',
          description: '1名以上は常勤専従であること',
        },
        {
          id: 'service-manager',
          name: '児童発達支援管理責任者',
          required: 1,
          current: stats.serviceManagers,
          unit: '名',
          status: stats.serviceManagers >= 1 ? 'ok' : 'critical',
          description: '専任かつ常勤であること',
        },
        {
          id: 'manager',
          name: '管理者',
          required: 1,
          current: stats.managers,
          unit: '名',
          status: stats.managers >= 1 ? 'ok' : 'warning',
          description: '管理者の配置（兼務可）',
        },
      ];
    },
    [stats, facilityCapacity]
  );

  // スタッフ設定保存
  const handleSaveSettings = useCallback(
    async (settings: Partial<StaffPersonnelSettings>): Promise<boolean> => {
      if (!editingStaff) return false;
      return await updatePersonnelSettings(editingStaff.id, settings);
    },
    [editingStaff, updatePersonnelSettings]
  );

  // 設定パネルを開く
  const handleOpenSettings = useCallback((staff: StaffWithSettings) => {
    setEditingStaff(staff);
    setShowSettings(true);
  }, []);

  // 設定パネルを閉じる
  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
    setTimeout(() => setEditingStaff(null), 300);
  }, []);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* ヘッダー */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
              <Shield size={20} className="text-teal-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">人員配置管理</h1>
              <p className="text-sm text-gray-500">
                配置基準の確認・人員設定・勤務体制一覧表
              </p>
            </div>
          </div>

          {/* タブ */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'bg-white text-teal-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Shield size={16} />
              概要
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'list'
                  ? 'bg-white text-teal-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Users size={16} />
              人員一覧
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'schedule'
                  ? 'bg-white text-teal-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <FileText size={16} />
              勤務体制一覧表
            </button>
          </div>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle size={20} className="text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-hidden p-6">
        {activeTab === 'overview' && (
          <div className="max-w-4xl space-y-6">
            {/* 定員未設定時のガイダンス */}
            {!isSettingsConfigured && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-800">施設定員が設定されていません</p>
                  <p className="text-xs text-amber-700 mt-1">
                    正確な人員配置基準を計算するには、施設情報から時間枠（定員）を設定してください。
                    現在はデフォルトの基準（2名以上）で表示しています。
                  </p>
                </div>
              </div>
            )}
            {/* 概要パネル */}
            <PersonnelOverviewPanel
              summary={summary}
              requirements={requirements as any}
              serviceType="jidou"
              capacity={10}
            />

            {/* クイック設定リスト */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200">
                <h3 className="font-bold text-gray-800">スタッフ人員設定</h3>
                <p className="text-sm text-gray-500">
                  各スタッフの人員区分・勤務形態を設定
                </p>
              </div>
              <div className="divide-y divide-gray-100">
                {staffList.map((staff) => (
                  <div
                    key={staff.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleOpenSettings(staff as StaffWithSettings)}
                  >
                    <StaffCard
                      staff={staff}
                      personnelSettings={(staff as StaffWithSettings).personnelSettings}
                      onClick={() => handleOpenSettings(staff as StaffWithSettings)}
                      actions={
                        <button className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg">
                          <Settings size={16} />
                        </button>
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'list' && (
          <div className="h-full">
            <StaffPersonnelList
              staff={staffBaseList}
              personnelSettings={personnelSettingsList}
              additionRequirements={additionRequirements}
              onRefresh={fetchStaffList}
            />
          </div>
        )}

        {activeTab === 'schedule' && workScheduleReport && (
          <div className="max-w-4xl">
            <WorkScheduleExport
              report={workScheduleReport}
              facilityName={facility?.name || '施設'}
              year={year}
              month={month}
            />
          </div>
        )}
      </div>

      {/* 人員設定パネル */}
      {editingStaff && (
        <PersonnelSettingsPanel
          staff={editingStaff}
          isOpen={showSettings}
          onClose={handleCloseSettings}
          onSave={handleSaveSettings}
          loading={loading}
        />
      )}
    </div>
  );
};

export default StaffingView;
