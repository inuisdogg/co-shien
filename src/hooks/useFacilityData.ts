/**
 * 施設データ管理フック（ファサード）
 *
 * 以前は2,633行のGod Hookだったものをドメイン別フックに分割し、
 * 後方互換性のためにこのファサードで全てを再結合して返す。
 *
 * 個別フック:
 *   - useFacilitySettings: 施設設定・時間枠
 *   - useChildrenData: 児童データ
 *   - useStaffData: スタッフ・シフト
 *   - useScheduleData: スケジュール・一括登録
 *   - useUsageRecords: 利用実績
 *   - useContactLogs: 連絡帳
 *   - useLeadData: リード・経営目標
 */

import { useFacilitySettings } from './useFacilitySettings';
import { useChildrenData } from './useChildrenData';
import { useStaffData } from './useStaffData';
import { useScheduleData } from './useScheduleData';
import { useUsageRecords } from './useUsageRecords';
import { useContactLogs } from './useContactLogs';
import { useLeadData } from './useLeadData';

export const useFacilityData = () => {
  const {
    facilitySettings,
    loadingSettings,
    timeSlots,
    loadingTimeSlots,
    updateFacilitySettings,
    addTimeSlot,
    updateTimeSlot,
    deleteTimeSlot,
  } = useFacilitySettings();

  const {
    children,
    loadingChildren,
    setChildren,
    addChild,
    updateChild,
    deleteChild,
  } = useChildrenData();

  const {
    staff,
    loadingStaff,
    setStaff,
    addStaff,
    updateStaff,
    deleteStaff,
    saveShifts,
    fetchShifts,
  } = useStaffData();

  const {
    schedules,
    requests,
    setSchedules,
    setRequests,
    addSchedule,
    addRequest,
    deleteSchedule,
    moveSchedule,
    updateScheduleTransport,
    bulkRegisterFromPatterns,
    resetDaySchedules,
    resetMonthSchedules,
  } = useScheduleData();

  const {
    usageRecords,
    addUsageRecord,
    updateUsageRecord,
    deleteUsageRecord,
    getUsageRecordByScheduleId,
  } = useUsageRecords();

  const {
    contactLogs,
    addContactLog,
    updateContactLog,
    deleteContactLog,
    getContactLogByScheduleId,
    getContactLogByChildAndDate,
  } = useContactLogs();

  const {
    leads,
    managementTargets,
    addLead,
    updateLead,
    deleteLead,
    getLeadsByChildId,
    addManagementTarget,
    updateManagementTarget,
    deleteManagementTarget,
    getManagementTarget,
  } = useLeadData();

  // Cross-domain wrappers: these functions originally had closure access
  // to children/facilitySettings/getUsageRecordByScheduleId in the monolith.
  // Consumers call them with fewer args, so we inject the dependencies here.
  const wrappedBulkRegister = async (year: number, month: number) => {
    return bulkRegisterFromPatterns(year, month, children, facilitySettings, getUsageRecordByScheduleId);
  };

  const wrappedResetDay = async (date: string) => {
    return resetDaySchedules(date, getUsageRecordByScheduleId);
  };

  const wrappedResetMonth = async (year: number, month: number) => {
    return resetMonthSchedules(year, month, getUsageRecordByScheduleId);
  };

  return {
    // Data
    children,
    staff,
    schedules,
    requests,
    facilitySettings,
    loadingSettings,
    loadingChildren,
    loadingStaff,
    usageRecords,
    contactLogs,
    leads,
    managementTargets,
    timeSlots,
    loadingTimeSlots,

    // Setters
    setChildren,
    setStaff,
    setSchedules,
    setRequests,

    // Children
    addChild,
    updateChild,
    deleteChild,

    // Schedules
    addSchedule,
    addRequest,
    deleteSchedule,
    moveSchedule,
    updateScheduleTransport,
    bulkRegisterFromPatterns: wrappedBulkRegister,
    resetDaySchedules: wrappedResetDay,
    resetMonthSchedules: wrappedResetMonth,

    // Facility Settings
    updateFacilitySettings,
    addTimeSlot,
    updateTimeSlot,
    deleteTimeSlot,

    // Usage Records
    addUsageRecord,
    updateUsageRecord,
    deleteUsageRecord,
    getUsageRecordByScheduleId,

    // Contact Logs
    addContactLog,
    updateContactLog,
    deleteContactLog,
    getContactLogByScheduleId,
    getContactLogByChildAndDate,

    // Leads
    addLead,
    updateLead,
    deleteLead,
    getLeadsByChildId,

    // Staff
    addStaff,
    updateStaff,
    deleteStaff,

    // Management Targets
    addManagementTarget,
    updateManagementTarget,
    deleteManagementTarget,
    getManagementTarget,

    // Shifts
    saveShifts,
    fetchShifts,
  };
};
