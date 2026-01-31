/**
 * 勤務体制一覧表ビュー
 * Work Schedule Report View
 *
 * 月次の勤務体制一覧表を生成・管理するビュー
 * 東京都様式に準拠した出力形式
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  Save,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Users,
  Clock,
  Award,
  CheckCircle,
  AlertCircle,
  Send,
  Edit,
} from 'lucide-react';
import {
  WorkScheduleReport,
  WorkScheduleStaffAssignment,
  PERSONNEL_TYPE_LABELS,
  WORK_STYLE_LABELS,
  QUALIFICATION_CODES,
} from '@/types';
import { useStaffingCompliance } from '@/hooks/useStaffingCompliance';
import { useFacilityData } from '@/hooks/useFacilityData';

const WorkScheduleReportView: React.FC = () => {
  const { staff, facilitySettings } = useFacilityData();
  const {
    personnelSettings,
    facilityStaffingSettings,
    workScheduleReports,
    fetchPersonnelSettings,
    fetchFacilityStaffingSettings,
    fetchWorkScheduleReports,
    generateWorkScheduleReport,
    saveWorkScheduleReport,
    loading,
    error,
  } = useStaffingCompliance();

  // 年月選択
  const [displayYear, setDisplayYear] = useState(new Date().getFullYear());
  const [displayMonth, setDisplayMonth] = useState(new Date().getMonth() + 1);

  // レポート状態
  const [currentReport, setCurrentReport] = useState<WorkScheduleReport | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // データ読み込み
  useEffect(() => {
    fetchPersonnelSettings();
    fetchFacilityStaffingSettings();
  }, [fetchPersonnelSettings, fetchFacilityStaffingSettings]);

  useEffect(() => {
    fetchWorkScheduleReports(displayYear, displayMonth);
  }, [displayYear, displayMonth, fetchWorkScheduleReports]);

  // 既存レポートがあれば読み込み
  useEffect(() => {
    if (workScheduleReports.length > 0) {
      setCurrentReport(workScheduleReports[0]);
    } else {
      setCurrentReport(null);
    }
  }, [workScheduleReports]);

  // 月移動
  const changeMonth = (delta: number) => {
    let newMonth = displayMonth + delta;
    let newYear = displayYear;

    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }

    setDisplayMonth(newMonth);
    setDisplayYear(newYear);
  };

  // レポート生成
  const handleGenerate = async () => {
    const report = await generateWorkScheduleReport(displayYear, displayMonth);
    if (report) {
      setCurrentReport(report);
      setIsEditing(true);
    }
  };

  // レポート保存
  const handleSave = async () => {
    if (!currentReport) return;

    try {
      await saveWorkScheduleReport(currentReport);
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // error is handled by hook
    }
  };

  // CSV出力
  const handleExportCSV = () => {
    if (!currentReport) return;

    const headers = [
      '氏名',
      '人員区分',
      '勤務形態',
      '資格',
      '経験年数',
      '週労働時間',
      '常勤換算',
      '配置加算',
      '役割',
    ];

    const rows = currentReport.staffAssignments.map((s) => [
      s.name,
      PERSONNEL_TYPE_LABELS[s.personnelType],
      WORK_STYLE_LABELS[s.workStyle],
      s.qualifications.map((q) => QUALIFICATION_CODES[q as keyof typeof QUALIFICATION_CODES] || q).join('/'),
      s.yearsOfExperience?.toString() || '',
      s.weeklyHours.toString(),
      s.fte.toFixed(2),
      s.assignedAdditions.join('/'),
      s.role || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `勤務体制一覧表_${displayYear}年${displayMonth}月.csv`;
    link.click();
  };

  // 集計
  const standardStaff = currentReport?.staffAssignments.filter((s) => s.personnelType === 'standard') || [];
  const additionStaff = currentReport?.staffAssignments.filter((s) => s.personnelType === 'addition') || [];
  const totalFTE = currentReport?.staffAssignments.reduce((sum, s) => sum + s.fte, 0) || 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="text-teal-600" size={24} />
            勤務体制一覧表
          </h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            行政提出用の勤務体制一覧表を作成・管理します
          </p>
        </div>
      </div>

      {/* 月選択 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => changeMonth(-1)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h3 className="font-bold text-lg text-gray-800">
              {displayYear}年{displayMonth}月
            </h3>
            <button
              onClick={() => changeMonth(1)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {currentReport ? (
              <>
                <span
                  className={`px-2 py-1 text-xs font-bold rounded ${
                    currentReport.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : currentReport.status === 'submitted'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {currentReport.status === 'approved'
                    ? '承認済'
                    : currentReport.status === 'submitted'
                    ? '提出済'
                    : '下書き'}
                </span>
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md text-sm font-bold flex items-center gap-1"
                >
                  <Download size={14} />
                  CSV出力
                </button>
              </>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold flex items-center gap-2"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                一覧表を作成
              </button>
            )}
          </div>
        </div>
      </div>

      {/* サマリーカード */}
      {currentReport && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-gray-800">
              {currentReport.staffAssignments.length}
            </div>
            <div className="text-xs text-gray-500 flex items-center justify-center gap-1 mt-1">
              <Users size={12} />
              総スタッフ数
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-teal-600">{standardStaff.length}</div>
            <div className="text-xs text-gray-500 mt-1">基準人員</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{additionStaff.length}</div>
            <div className="text-xs text-gray-500 mt-1">加算人員</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{totalFTE.toFixed(2)}</div>
            <div className="text-xs text-gray-500 flex items-center justify-center gap-1 mt-1">
              <Clock size={12} />
              常勤換算合計
            </div>
          </div>
        </div>
      )}

      {/* 一覧表 */}
      {currentReport && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h4 className="font-bold text-gray-800">スタッフ配置一覧</h4>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded flex items-center gap-1"
              >
                <Edit size={14} />
                編集
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-xs">
                  <th className="px-4 py-3 text-left">氏名</th>
                  <th className="px-4 py-3 text-center">人員区分</th>
                  <th className="px-4 py-3 text-center">勤務形態</th>
                  <th className="px-4 py-3 text-left">資格</th>
                  <th className="px-4 py-3 text-center">経験年数</th>
                  <th className="px-4 py-3 text-center">週労働時間</th>
                  <th className="px-4 py-3 text-center">常勤換算</th>
                  <th className="px-4 py-3 text-left">配置加算</th>
                  <th className="px-4 py-3 text-center">役割</th>
                </tr>
              </thead>
              <tbody>
                {currentReport.staffAssignments.map((assignment, idx) => (
                  <tr
                    key={assignment.staffId}
                    className={`border-t border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    <td className="px-4 py-3 font-medium">{assignment.name}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          assignment.personnelType === 'standard'
                            ? 'bg-teal-100 text-teal-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {PERSONNEL_TYPE_LABELS[assignment.personnelType]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {WORK_STYLE_LABELS[assignment.workStyle]}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {assignment.qualifications.slice(0, 3).map((qual, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
                          >
                            {QUALIFICATION_CODES[qual as keyof typeof QUALIFICATION_CODES] || qual}
                          </span>
                        ))}
                        {assignment.qualifications.length > 3 && (
                          <span className="text-xs text-gray-400">
                            +{assignment.qualifications.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {assignment.yearsOfExperience ? `${assignment.yearsOfExperience}年` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center font-mono">
                      {assignment.weeklyHours}h
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold">
                      {assignment.fte.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {assignment.assignedAdditions.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {assignment.assignedAdditions.map((code, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-xs"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {assignment.role ? (
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            assignment.role === '児発管'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {assignment.role}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 編集モード時のアクション */}
          {isEditing && (
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={16} />
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* レポートがない場合 */}
      {!currentReport && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-600 mb-2">
            {displayYear}年{displayMonth}月の勤務体制一覧表がありません
          </h3>
          <p className="text-gray-500 text-sm mb-6">
            「一覧表を作成」ボタンを押して、現在のスタッフ人員設定から一覧表を生成してください。
          </p>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold inline-flex items-center gap-2"
          >
            <RefreshCw size={18} />
            一覧表を作成
          </button>
        </div>
      )}

      {/* 説明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-bold text-blue-800 mb-2">勤務体制一覧表について</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>
            ・勤務体制一覧表は、事業所のスタッフ配置状況を行政機関に届け出るための書類です。
          </li>
          <li>
            ・「基準人員」と「加算人員」の区分、各スタッフの勤務形態、資格、常勤換算値などを記載します。
          </li>
          <li>
            ・CSV出力機能を使って、Excel等で編集・印刷することもできます。
          </li>
        </ul>
      </div>

      {/* 成功メッセージ */}
      {saveSuccess && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle size={20} />
          保存しました
        </div>
      )}

      {/* エラーメッセージ */}
      {error && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-4">
          <AlertCircle size={20} />
          {error}
        </div>
      )}
    </div>
  );
};

export default WorkScheduleReportView;
