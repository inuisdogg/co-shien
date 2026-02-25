/**
 * スタッフ一覧パネル
 * スタッフマスタのメイン一覧表示コンポーネント
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  Users,
  UserCheck,
  UserPlus,
  ChevronDown,
  RefreshCw,
  Download,
  SlidersHorizontal,
} from 'lucide-react';
import StaffCard from '../shared/StaffCard';
import {
  processStaffList,
  calculateStaffStats,
  StaffFilterType,
  StaffSortField,
  SortDirection,
  StaffWithSettings,
} from '../shared/StaffSortUtils';

interface StaffListPanelProps {
  staffList: StaffWithSettings[];
  loading: boolean;
  selectedStaffId?: string;
  onSelectStaff: (staff: StaffWithSettings) => void;
  onInviteStaff: () => void;
  onRefresh: () => void;
  onExport?: () => void;
}

const StaffListPanel: React.FC<StaffListPanelProps> = ({
  staffList,
  loading,
  selectedStaffId,
  onSelectStaff,
  onInviteStaff,
  onRefresh,
  onExport,
}) => {
  // 検索・フィルタ・ソート状態
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<StaffFilterType>('all');
  const [workStyleFilter, setWorkStyleFilter] = useState<
    'all' | 'fulltime_dedicated' | 'fulltime_concurrent' | 'parttime'
  >('all');
  const [sortField, setSortField] = useState<StaffSortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showFilters, setShowFilters] = useState(false);

  // フィルタ・ソート適用
  const filteredStaff = useMemo(() => {
    return processStaffList(staffList, {
      search: searchQuery,
      filterType,
      workStyleFilter,
      sort: { field: sortField, direction: sortDirection },
    });
  }, [staffList, searchQuery, filterType, workStyleFilter, sortField, sortDirection]);

  // 統計情報
  const stats = useMemo(() => calculateStaffStats(staffList), [staffList]);

  // フィルタオプション
  const filterOptions: { value: StaffFilterType; label: string; count: number }[] = [
    { value: 'all', label: 'すべて', count: stats.total },
    { value: 'standard', label: '基準人員', count: stats.standard },
    { value: 'addition', label: '加算人員', count: stats.addition },
    { value: 'unset', label: '未設定', count: stats.unset },
    { value: 'manager', label: '管理者', count: stats.managers },
    { value: 'serviceManager', label: '児発管', count: stats.serviceManagers },
  ];

  // 勤務形態オプション
  const workStyleOptions: {
    value: 'all' | 'fulltime_dedicated' | 'fulltime_concurrent' | 'parttime';
    label: string;
    count: number;
  }[] = [
    { value: 'all', label: 'すべて', count: stats.total },
    { value: 'fulltime_dedicated', label: '常勤専従', count: stats.fulltimeDedicated },
    { value: 'fulltime_concurrent', label: '常勤兼務', count: stats.fulltimeConcurrent },
    { value: 'parttime', label: '非常勤', count: stats.parttime },
  ];

  // ソートオプション
  const sortOptions: { value: StaffSortField; label: string }[] = [
    { value: 'name', label: '名前順' },
    { value: 'nameKana', label: 'かな順' },
    { value: 'type', label: '職種順' },
    { value: 'yearsOfExperience', label: '経験年数順' },
    { value: 'personnelType', label: '人員区分順' },
    { value: 'workStyle', label: '勤務形態順' },
    { value: 'createdAt', label: '登録日順' },
  ];

  // ソートトグル
  const toggleSort = (field: StaffSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200">
      {/* ヘッダー */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-[#00c4cc]" />
            <h2 className="text-lg font-bold text-gray-800">スタッフ一覧</h2>
            <span className="text-sm text-gray-500">({stats.total}名)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="更新"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            {onExport && (
              <button
                onClick={onExport}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="エクスポート"
              >
                <Download size={18} />
              </button>
            )}
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex gap-2 mb-3">
          <button
            data-tour="add-staff-button"
            onClick={onInviteStaff}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] transition-colors text-sm font-medium"
          >
            <UserPlus size={16} />
            スタッフを追加
          </button>
        </div>

        {/* 検索バー */}
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="名前・かな・資格で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc] focus:border-transparent text-sm"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${
              showFilters ? 'bg-[#00c4cc]/10 text-[#00c4cc]' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>

        {/* フィルタ展開エリア */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-3">
            {/* 人員区分フィルタ */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                人員区分
              </label>
              <div className="flex flex-wrap gap-1.5">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFilterType(option.value)}
                    className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                      filterType === option.value
                        ? 'bg-[#00c4cc] text-white'
                        : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {option.label}
                    {option.count > 0 && (
                      <span className="ml-1 opacity-70">({option.count})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 勤務形態フィルタ */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                勤務形態
              </label>
              <div className="flex flex-wrap gap-1.5">
                {workStyleOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setWorkStyleFilter(option.value)}
                    className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                      workStyleFilter === option.value
                        ? 'bg-[#00c4cc] text-white'
                        : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {option.label}
                    {option.count > 0 && (
                      <span className="ml-1 opacity-70">({option.count})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ソート */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                並び順
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as StaffSortField)}
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50"
                >
                  {sortDirection === 'asc' ? '昇順 ↑' : '降順 ↓'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 統計サマリー */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-gray-500">常勤換算:</span>
          <span className="font-bold text-[#00c4cc]">{stats.totalFte.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">基準:</span>
          <span className="font-medium text-gray-700">{stats.standard}名</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">加算:</span>
          <span className="font-medium text-gray-700">{stats.addition}名</span>
        </div>
      </div>

      {/* スタッフリスト */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && staffList.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500">
            <RefreshCw size={20} className="animate-spin mr-2" />
            読み込み中...
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <Users size={32} className="mb-2 text-gray-300" />
            <p className="text-sm">
              {searchQuery || filterType !== 'all' || workStyleFilter !== 'all'
                ? '条件に一致するスタッフがいません'
                : 'スタッフが登録されていません'}
            </p>
            {!searchQuery && filterType === 'all' && (
              <button
                onClick={onInviteStaff}
                className="mt-2 text-sm text-[#00c4cc] hover:text-[#00b0b8]"
              >
                スタッフを追加する
              </button>
            )}
          </div>
        ) : (
          filteredStaff.map((staff) => (
            <StaffCard
              key={staff.id}
              staff={staff}
              personnelSettings={staff.personnelSettings}
              selected={staff.id === selectedStaffId}
              onClick={() => onSelectStaff(staff)}
            />
          ))
        )}
      </div>

      {/* フッター */}
      <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
        {filteredStaff.length !== stats.total && (
          <span>
            {filteredStaff.length}件表示 / 全{stats.total}件
          </span>
        )}
      </div>
    </div>
  );
};

export default StaffListPanel;
