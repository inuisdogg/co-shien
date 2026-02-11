/**
 * スタッフソートユーティリティ
 * スタッフ一覧のソート・フィルタリングに使用する共通ロジック
 */

import { Staff, StaffPersonnelSettings } from '@/types';

export type StaffSortField =
  | 'name'
  | 'nameKana'
  | 'type'
  | 'yearsOfExperience'
  | 'createdAt'
  | 'personnelType'
  | 'workStyle';

export type SortDirection = 'asc' | 'desc';

export interface StaffSortConfig {
  field: StaffSortField;
  direction: SortDirection;
}

export interface StaffWithSettings extends Staff {
  personnelSettings?: StaffPersonnelSettings;
}

/**
 * スタッフをソート
 */
export function sortStaff(
  staffList: StaffWithSettings[],
  config: StaffSortConfig
): StaffWithSettings[] {
  const { field, direction } = config;
  const multiplier = direction === 'asc' ? 1 : -1;

  return [...staffList].sort((a, b) => {
    let aValue: string | number | undefined;
    let bValue: string | number | undefined;

    switch (field) {
      case 'name':
        aValue = a.name || '';
        bValue = b.name || '';
        break;
      case 'nameKana':
        aValue = a.nameKana || a.name || '';
        bValue = b.nameKana || b.name || '';
        break;
      case 'type':
        aValue = a.type || '';
        bValue = b.type || '';
        break;
      case 'yearsOfExperience':
        aValue = a.yearsOfExperience ?? 0;
        bValue = b.yearsOfExperience ?? 0;
        break;
      case 'createdAt':
        aValue = a.createdAt || '';
        bValue = b.createdAt || '';
        break;
      case 'personnelType':
        aValue = a.personnelSettings?.personnelType || 'zzz';
        bValue = b.personnelSettings?.personnelType || 'zzz';
        break;
      case 'workStyle':
        aValue = a.personnelSettings?.workStyle || 'zzz';
        bValue = b.personnelSettings?.workStyle || 'zzz';
        break;
      default:
        return 0;
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return aValue.localeCompare(bValue, 'ja') * multiplier;
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return (aValue - bValue) * multiplier;
    }

    return 0;
  });
}

/**
 * スタッフを検索
 */
export function searchStaff(
  staffList: StaffWithSettings[],
  query: string
): StaffWithSettings[] {
  if (!query.trim()) return staffList;

  const normalizedQuery = query.toLowerCase().trim();

  return staffList.filter((staff) => {
    // 名前で検索
    if (staff.name?.toLowerCase().includes(normalizedQuery)) return true;

    // かな名で検索
    if (staff.nameKana?.toLowerCase().includes(normalizedQuery)) return true;

    // 職種で検索
    if (staff.type?.toLowerCase().includes(normalizedQuery)) return true;

    // 資格で検索（personnelSettingsから）
    if (
      staff.personnelSettings?.qualifications?.some((q: string) =>
        q.toLowerCase().includes(normalizedQuery)
      )
    ) {
      return true;
    }

    return false;
  });
}

export type StaffFilterType = 'all' | 'standard' | 'addition' | 'unset' | 'manager' | 'serviceManager';

/**
 * スタッフをフィルタリング
 */
export function filterStaff(
  staffList: StaffWithSettings[],
  filterType: StaffFilterType
): StaffWithSettings[] {
  switch (filterType) {
    case 'all':
      return staffList;
    case 'standard':
      return staffList.filter(
        (s) => s.personnelSettings?.personnelType === 'standard'
      );
    case 'addition':
      return staffList.filter(
        (s) => s.personnelSettings?.personnelType === 'addition'
      );
    case 'unset':
      return staffList.filter((s) => !s.personnelSettings?.personnelType);
    case 'manager':
      return staffList.filter((s) => s.personnelSettings?.isManager);
    case 'serviceManager':
      return staffList.filter((s) => s.personnelSettings?.isServiceManager);
    default:
      return staffList;
  }
}

/**
 * 勤務形態でフィルタリング
 */
export function filterByWorkStyle(
  staffList: StaffWithSettings[],
  workStyle: 'all' | 'fulltime_dedicated' | 'fulltime_concurrent' | 'parttime'
): StaffWithSettings[] {
  if (workStyle === 'all') return staffList;

  return staffList.filter(
    (s) => s.personnelSettings?.workStyle === workStyle
  );
}

/**
 * 複合フィルタ・ソート・検索
 */
export function processStaffList(
  staffList: StaffWithSettings[],
  options: {
    search?: string;
    filterType?: StaffFilterType;
    workStyleFilter?: 'all' | 'fulltime_dedicated' | 'fulltime_concurrent' | 'parttime';
    sort?: StaffSortConfig;
  }
): StaffWithSettings[] {
  let result = [...staffList];

  // 検索
  if (options.search) {
    result = searchStaff(result, options.search);
  }

  // 人員区分フィルタ
  if (options.filterType && options.filterType !== 'all') {
    result = filterStaff(result, options.filterType);
  }

  // 勤務形態フィルタ
  if (options.workStyleFilter && options.workStyleFilter !== 'all') {
    result = filterByWorkStyle(result, options.workStyleFilter);
  }

  // ソート
  if (options.sort) {
    result = sortStaff(result, options.sort);
  }

  return result;
}

/**
 * スタッフ統計を計算
 */
export function calculateStaffStats(staffList: StaffWithSettings[]): {
  total: number;
  standard: number;
  addition: number;
  unset: number;
  fulltimeDedicated: number;
  fulltimeConcurrent: number;
  parttime: number;
  managers: number;
  serviceManagers: number;
  totalFte: number;
} {
  const stats = {
    total: staffList.length,
    standard: 0,
    addition: 0,
    unset: 0,
    fulltimeDedicated: 0,
    fulltimeConcurrent: 0,
    parttime: 0,
    managers: 0,
    serviceManagers: 0,
    totalFte: 0,
  };

  for (const staff of staffList) {
    const ps = staff.personnelSettings;

    // 人員区分
    if (ps?.personnelType === 'standard') {
      stats.standard++;
    } else if (ps?.personnelType === 'addition') {
      stats.addition++;
    } else {
      stats.unset++;
    }

    // 勤務形態
    if (ps?.workStyle === 'fulltime_dedicated') {
      stats.fulltimeDedicated++;
    } else if (ps?.workStyle === 'fulltime_concurrent') {
      stats.fulltimeConcurrent++;
    } else if (ps?.workStyle === 'parttime') {
      stats.parttime++;
    }

    // 役割
    if (ps?.isManager) stats.managers++;
    if (ps?.isServiceManager) stats.serviceManagers++;

    // FTE
    if (ps?.contractedWeeklyHours) {
      stats.totalFte += ps.contractedWeeklyHours / 40;
    }
  }

  // FTEを小数点2桁に丸める
  stats.totalFte = Math.round(stats.totalFte * 100) / 100;

  return stats;
}
