/**
 * 業務日誌管理コンポーネント
 * 日々の支援記録・活動記録を入力・管理
 * 運営指導で必要な「サービス提供に関する実施記録」の元データ
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit,
  Save,
  X,
  Cloud,
  Sun,
  CloudRain,
  Snowflake,
  Users,
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  Download,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { generateDailyLogPdf, formatDate as pdfFormatDate } from '@/utils/pdfExport';

// 日誌データの型定義
type DailyLog = {
  id: string;
  facilityId: string;
  date: string;
  logType: 'facility' | 'child';
  childId?: string;
  staffId?: string;
  staffName?: string;
  weather?: string;
  temperature?: number;
  attendanceSummary?: {
    present: number;
    absent: number;
    total: number;
  };
  morningActivities?: string;
  afternoonActivities?: string;
  activities?: Array<{
    time: string;
    content: string;
    participants?: string[];
  }>;
  // 児童個別記録用フィールド
  mood?: string;
  healthCondition?: string;
  mealStatus?: string;
  supportContent?: string;
  progressNotes?: string;
  specialNotes?: string;
  incidents?: string;
  communicationNotes?: string;
  status: 'draft' | 'submitted' | 'approved';
  createdAt: string;
  updatedAt: string;
};

// 児童の型定義
type Child = {
  id: string;
  name: string;
};

// DBのsnake_caseからcamelCaseに変換
const mapDbToLog = (row: any): DailyLog => ({
  id: row.id,
  facilityId: row.facility_id,
  date: row.date,
  logType: row.log_type,
  childId: row.child_id,
  staffId: row.staff_id,
  staffName: row.staff_name,
  weather: row.weather,
  temperature: row.temperature,
  attendanceSummary: row.attendance_summary,
  morningActivities: row.morning_activities,
  afternoonActivities: row.afternoon_activities,
  activities: row.activities,
  specialNotes: row.special_notes,
  incidents: row.incidents,
  communicationNotes: row.communication_notes,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// 天気アイコン
const weatherOptions = [
  { value: 'sunny', label: '晴れ', icon: Sun },
  { value: 'cloudy', label: '曇り', icon: Cloud },
  { value: 'rainy', label: '雨', icon: CloudRain },
  { value: 'snowy', label: '雪', icon: Snowflake },
];

export default function DailyLogView() {
  const { user, facility } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'facility' | 'child'>('facility');
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  // 施設日誌のフォーム状態
  const [facilityLog, setFacilityLog] = useState<Partial<DailyLog>>({
    weather: 'sunny',
    temperature: undefined,
    attendanceSummary: { present: 0, absent: 0, total: 0 },
    morningActivities: '',
    afternoonActivities: '',
    specialNotes: '',
    incidents: '',
    communicationNotes: '',
  });

  // 児童個別記録のフォーム状態
  const [childLogs, setChildLogs] = useState<Record<string, Partial<DailyLog>>>({});

  // 日付フォーマット
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const formatDisplayDate = (date: Date): string => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日(${days[date.getDay()]})`;
  };

  // 日付移動
  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  // データ取得
  const fetchData = useCallback(async () => {
    if (!facility?.id) return;

    setLoading(true);
    try {
      const dateStr = formatDate(selectedDate);

      // 日誌を取得
      const { data: logsData, error: logsError } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('facility_id', facility.id)
        .eq('date', dateStr);

      if (logsError) throw logsError;

      if (logsData) {
        const mappedLogs = logsData.map(mapDbToLog);
        setLogs(mappedLogs);

        // 施設日誌をフォームにセット
        const existingFacilityLog = mappedLogs.find(l => l.logType === 'facility');
        if (existingFacilityLog) {
          setFacilityLog(existingFacilityLog);
        } else {
          setFacilityLog({
            weather: 'sunny',
            temperature: undefined,
            attendanceSummary: { present: 0, absent: 0, total: 0 },
            morningActivities: '',
            afternoonActivities: '',
            specialNotes: '',
            incidents: '',
            communicationNotes: '',
          });
        }

        // 児童個別記録をフォームにセット
        const childLogsMap: Record<string, Partial<DailyLog>> = {};
        mappedLogs.filter(l => l.logType === 'child').forEach(log => {
          if (log.childId) {
            childLogsMap[log.childId] = log;
          }
        });
        setChildLogs(childLogsMap);
      }

      // 児童一覧を取得
      const { data: childrenData } = await supabase
        .from('children')
        .select('id, name')
        .eq('facility_id', facility.id)
        .order('name');

      if (childrenData) {
        setChildren(childrenData);
      }
    } catch (err) {
      console.error('データ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, [facility?.id, selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 施設日誌を保存
  const saveFacilityLog = async () => {
    if (!facility?.id || !user?.id) return;

    setSaving(true);
    try {
      const dateStr = formatDate(selectedDate);
      const existingLog = logs.find(l => l.logType === 'facility');

      const logData = {
        facility_id: facility.id,
        date: dateStr,
        log_type: 'facility',
        staff_id: user.id,
        staff_name: user.name || '',
        weather: facilityLog.weather,
        temperature: facilityLog.temperature,
        attendance_summary: facilityLog.attendanceSummary,
        morning_activities: facilityLog.morningActivities,
        afternoon_activities: facilityLog.afternoonActivities,
        special_notes: facilityLog.specialNotes,
        incidents: facilityLog.incidents,
        communication_notes: facilityLog.communicationNotes,
        status: 'draft',
        updated_at: new Date().toISOString(),
      };

      if (existingLog) {
        const { error } = await supabase
          .from('daily_logs')
          .update(logData)
          .eq('id', existingLog.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('daily_logs')
          .insert(logData);
        if (error) throw error;
      }

      await fetchData();
      setIsEditing(false);
    } catch (err) {
      console.error('保存エラー:', err);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // 児童個別記録を保存
  const saveChildLog = async (childId: string) => {
    if (!facility?.id || !user?.id) return;

    setSaving(true);
    try {
      const dateStr = formatDate(selectedDate);
      const existingLog = logs.find(l => l.logType === 'child' && l.childId === childId);
      const childLog = childLogs[childId] || {};

      const logData = {
        facility_id: facility.id,
        date: dateStr,
        log_type: 'child',
        child_id: childId,
        staff_id: user.id,
        staff_name: user.name || '',
        mood: (childLog as any).mood,
        health_condition: (childLog as any).healthCondition,
        meal_status: (childLog as any).mealStatus,
        support_content: (childLog as any).supportContent,
        progress_notes: (childLog as any).progressNotes,
        special_notes: childLog.specialNotes,
        status: 'draft',
        updated_at: new Date().toISOString(),
      };

      if (existingLog) {
        const { error } = await supabase
          .from('daily_logs')
          .update(logData)
          .eq('id', existingLog.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('daily_logs')
          .insert(logData);
        if (error) throw error;
      }

      await fetchData();
    } catch (err) {
      console.error('保存エラー:', err);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // 出欠情報を更新
  const updateAttendance = (field: 'present' | 'absent', value: number) => {
    const current = facilityLog.attendanceSummary || { present: 0, absent: 0, total: 0 };
    const newSummary = {
      ...current,
      [field]: value,
      total: field === 'present' ? value + current.absent : current.present + value,
    };
    setFacilityLog({ ...facilityLog, attendanceSummary: newSummary });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]"></div>
      </div>
    );
  }

  const existingFacilityLog = logs.find(l => l.logType === 'facility');

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-[#00c4cc]" />
            業務日誌
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            日々の支援記録・活動記録を入力します
          </p>
        </div>
        <button
          onClick={() => {
            const pdf = generateDailyLogPdf(
              {
                date: formatDate(selectedDate),
                weather: facilityLog.weather,
                temperature: facilityLog.temperature,
                attendanceSummary: facilityLog.attendanceSummary ? {
                  scheduled: facilityLog.attendanceSummary.total,
                  actual: facilityLog.attendanceSummary.present,
                  absent: facilityLog.attendanceSummary.absent,
                } : undefined,
                activities: [
                  ...(facilityLog.morningActivities ? [{ time: '午前', activity: facilityLog.morningActivities }] : []),
                  ...(facilityLog.afternoonActivities ? [{ time: '午後', activity: facilityLog.afternoonActivities }] : []),
                ],
                specialNotes: facilityLog.specialNotes,
                safetyCheck: true,
              },
              { name: facility?.name || '施設名', code: facility?.code }
            );
            pdf.save(`業務日誌_${formatDate(selectedDate)}.pdf`);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          PDF出力
        </button>
      </div>

      {/* 日付ナビゲーション */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateDate('prev')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-[#00c4cc]" />
            <span className="text-lg font-bold text-gray-800">
              {formatDisplayDate(selectedDate)}
            </span>
            <input
              type="date"
              value={formatDate(selectedDate)}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={() => navigateDate('next')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={formatDate(selectedDate) >= formatDate(new Date())}
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* タブ切り替え */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('facility')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'facility'
                ? 'bg-[#00c4cc] text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FileText className="w-4 h-4" />
              施設日誌
              {existingFacilityLog && (
                <CheckCircle className="w-4 h-4" />
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('child')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'child'
                ? 'bg-[#00c4cc] text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Users className="w-4 h-4" />
              児童個別記録
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                {logs.filter(l => l.logType === 'child').length}/{children.length}
              </span>
            </div>
          </button>
        </div>

        <div className="p-6">
          {/* 施設日誌タブ */}
          {activeTab === 'facility' && (
            <div className="space-y-6">
              {/* 基本情報 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 天気 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    天気
                  </label>
                  <div className="flex gap-2">
                    {weatherOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.value}
                          onClick={() => setFacilityLog({ ...facilityLog, weather: option.value })}
                          className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${
                            facilityLog.weather === option.value
                              ? 'border-[#00c4cc] bg-[#00c4cc]/10'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Icon className={`w-5 h-5 ${
                            facilityLog.weather === option.value ? 'text-[#00c4cc]' : 'text-gray-500'
                          }`} />
                          <span className="text-xs">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 気温 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    気温 (℃)
                  </label>
                  <input
                    type="number"
                    value={facilityLog.temperature || ''}
                    onChange={(e) => setFacilityLog({ ...facilityLog, temperature: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                    placeholder="例: 25"
                  />
                </div>

                {/* 出欠 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    出欠状況
                  </label>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">出席</span>
                      <input
                        type="number"
                        min="0"
                        value={facilityLog.attendanceSummary?.present || 0}
                        onChange={(e) => updateAttendance('present', Number(e.target.value))}
                        className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-center"
                      />
                      <span className="text-sm text-gray-500">名</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">欠席</span>
                      <input
                        type="number"
                        min="0"
                        value={facilityLog.attendanceSummary?.absent || 0}
                        onChange={(e) => updateAttendance('absent', Number(e.target.value))}
                        className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-center"
                      />
                      <span className="text-sm text-gray-500">名</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 活動内容 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    午前の活動
                  </label>
                  <textarea
                    value={facilityLog.morningActivities || ''}
                    onChange={(e) => setFacilityLog({ ...facilityLog, morningActivities: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 min-h-[120px]"
                    placeholder="午前中に行った活動を記入..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    午後の活動
                  </label>
                  <textarea
                    value={facilityLog.afternoonActivities || ''}
                    onChange={(e) => setFacilityLog({ ...facilityLog, afternoonActivities: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 min-h-[120px]"
                    placeholder="午後に行った活動を記入..."
                  />
                </div>
              </div>

              {/* 特記事項 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  特記事項
                </label>
                <textarea
                  value={facilityLog.specialNotes || ''}
                  onChange={(e) => setFacilityLog({ ...facilityLog, specialNotes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 min-h-[100px]"
                  placeholder="特記事項があれば記入..."
                />
              </div>

              {/* ヒヤリハット */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                    ヒヤリハット・事故等
                  </span>
                </label>
                <textarea
                  value={facilityLog.incidents || ''}
                  onChange={(e) => setFacilityLog({ ...facilityLog, incidents: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 min-h-[80px]"
                  placeholder="ヒヤリハットや事故があれば記入..."
                />
              </div>

              {/* 保護者連絡事項 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  保護者連絡事項
                </label>
                <textarea
                  value={facilityLog.communicationNotes || ''}
                  onChange={(e) => setFacilityLog({ ...facilityLog, communicationNotes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 min-h-[80px]"
                  placeholder="保護者への連絡事項を記入..."
                />
              </div>

              {/* 保存ボタン */}
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={saveFacilityLog}
                  disabled={saving}
                  className="flex items-center gap-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-2.5 px-6 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? '保存中...' : '保存する'}
                </button>
              </div>

              {/* 最終更新情報 */}
              {existingFacilityLog && (
                <div className="text-sm text-gray-500 text-right">
                  最終更新: {new Date(existingFacilityLog.updatedAt).toLocaleString('ja-JP')}
                  {existingFacilityLog.staffName && ` by ${existingFacilityLog.staffName}`}
                </div>
              )}
            </div>
          )}

          {/* 児童個別記録タブ */}
          {activeTab === 'child' && (
            <div className="space-y-4">
              {children.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>登録されている児童がいません</p>
                </div>
              ) : (
                <>
                  {/* 児童選択 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {children.map((child) => {
                      const hasLog = logs.some(l => l.logType === 'child' && l.childId === child.id);
                      return (
                        <button
                          key={child.id}
                          onClick={() => setSelectedChildId(child.id)}
                          className={`p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                            selectedChildId === child.id
                              ? 'border-[#00c4cc] bg-[#00c4cc]/10 text-[#00c4cc]'
                              : hasLog
                                ? 'border-green-300 bg-green-50 text-green-700'
                                : 'border-gray-200 hover:border-gray-300 text-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1">
                            {hasLog && <CheckCircle className="w-3 h-3" />}
                            {child.name}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* 選択した児童の記録フォーム */}
                  {selectedChildId && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-bold text-gray-800 mb-4">
                        {children.find(c => c.id === selectedChildId)?.name} さんの記録
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            機嫌・様子
                          </label>
                          <select
                            value={(childLogs[selectedChildId] as any)?.mood || ''}
                            onChange={(e) => setChildLogs({
                              ...childLogs,
                              [selectedChildId]: { ...childLogs[selectedChildId], mood: e.target.value }
                            })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                          >
                            <option value="">選択してください</option>
                            <option value="good">良い</option>
                            <option value="normal">普通</option>
                            <option value="bad">あまり良くない</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            体調
                          </label>
                          <select
                            value={(childLogs[selectedChildId] as any)?.healthCondition || ''}
                            onChange={(e) => setChildLogs({
                              ...childLogs,
                              [selectedChildId]: { ...childLogs[selectedChildId], healthCondition: e.target.value }
                            })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                          >
                            <option value="">選択してください</option>
                            <option value="good">良好</option>
                            <option value="normal">普通</option>
                            <option value="poor">不調気味</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            食事の様子
                          </label>
                          <select
                            value={(childLogs[selectedChildId] as any)?.mealStatus || ''}
                            onChange={(e) => setChildLogs({
                              ...childLogs,
                              [selectedChildId]: { ...childLogs[selectedChildId], mealStatus: e.target.value }
                            })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5"
                          >
                            <option value="">選択してください</option>
                            <option value="complete">完食</option>
                            <option value="mostly">ほぼ完食</option>
                            <option value="half">半分程度</option>
                            <option value="little">少量</option>
                            <option value="none">食べられなかった</option>
                          </select>
                        </div>
                      </div>
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          支援内容・活動の様子
                        </label>
                        <textarea
                          value={(childLogs[selectedChildId] as any)?.supportContent || ''}
                          onChange={(e) => setChildLogs({
                            ...childLogs,
                            [selectedChildId]: { ...childLogs[selectedChildId], supportContent: e.target.value }
                          })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 min-h-[100px]"
                          placeholder="本日の支援内容や活動の様子を記入..."
                        />
                      </div>
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          特記事項
                        </label>
                        <textarea
                          value={childLogs[selectedChildId]?.specialNotes || ''}
                          onChange={(e) => setChildLogs({
                            ...childLogs,
                            [selectedChildId]: { ...childLogs[selectedChildId], specialNotes: e.target.value }
                          })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 min-h-[80px]"
                          placeholder="特記事項があれば記入..."
                        />
                      </div>
                      <div className="flex justify-end mt-4">
                        <button
                          onClick={() => saveChildLog(selectedChildId)}
                          disabled={saving}
                          className="flex items-center gap-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                          {saving ? '保存中...' : '保存'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
