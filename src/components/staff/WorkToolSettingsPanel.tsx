/**
 * WorkToolSettingsPanel - 業務ツール表示設定パネル
 * 施設管理者がスタッフの個人画面に表示するツールを選択
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Loader2,
  Clock,
  FileText,
  Receipt,
  Calendar,
  CalendarDays,
  Bell,
  Briefcase,
  Wallet,
  Scale,
  FolderOpen,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  WorkToolId,
  WORK_TOOLS,
  FacilityWorkToolSettings,
} from '@/types';

// アイコンマッピング
const ICON_MAP: Record<string, React.ElementType> = {
  Clock,
  FileText,
  Receipt,
  Calendar,
  CalendarDays,
  Bell,
  Briefcase,
  Wallet,
  Scale,
  FolderOpen,
};

interface WorkToolSettingsPanelProps {
  facilityId: string;
}

export default function WorkToolSettingsPanel({ facilityId }: WorkToolSettingsPanelProps) {
  const [settings, setSettings] = useState<FacilityWorkToolSettings | null>(null);
  // WORK_TOOLSからデフォルト値を動的に生成
  const defaultEnabledTools = WORK_TOOLS.reduce((acc, tool) => {
    acc[tool.id] = tool.defaultEnabled;
    return acc;
  }, {} as Record<WorkToolId, boolean>);

  const defaultToolOrder = WORK_TOOLS.map(tool => tool.id);

  const [enabledTools, setEnabledTools] = useState<Record<WorkToolId, boolean>>(defaultEnabledTools);
  const [toolOrder, setToolOrder] = useState<WorkToolId[]>(defaultToolOrder);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 設定を取得
  useEffect(() => {
    const fetchSettings = async () => {
      if (!facilityId) return;

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('facility_work_tool_settings')
          .select('*')
          .eq('facility_id', facilityId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching settings:', error);
        }

        if (data) {
          setSettings({
            id: data.id,
            facilityId: data.facility_id,
            enabledTools: data.enabled_tools,
            toolOrder: data.tool_order,
            customSettings: data.custom_settings,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          });
          setEnabledTools(data.enabled_tools);
          setToolOrder(data.tool_order);
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [facilityId]);

  // ツールの有効/無効を切り替え
  const toggleTool = (toolId: WorkToolId) => {
    setEnabledTools(prev => ({
      ...prev,
      [toolId]: !prev[toolId],
    }));
    setHasChanges(true);
  };

  // 設定を保存
  const saveSettings = async () => {
    if (!facilityId) return;

    setIsSaving(true);
    try {
      const upsertData = {
        facility_id: facilityId,
        enabled_tools: enabledTools,
        tool_order: toolOrder,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('facility_work_tool_settings')
        .upsert(upsertData, {
          onConflict: 'facility_id',
        });

      if (error) throw error;

      setHasChanges(false);
      alert('設定を保存しました');
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('設定の保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#00c4cc]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#00c4cc]" />
            業務ツール表示設定
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            スタッフのキャリア画面（自分のページ）に表示するツールを選択してください
          </p>
        </div>
        <button
          onClick={saveSettings}
          disabled={!hasChanges || isSaving}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors
            ${hasChanges
              ? 'bg-[#00c4cc] hover:bg-[#00b0b8] text-white'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          保存する
        </button>
      </div>

      {/* ツール一覧 */}
      <div className="space-y-2">
        {WORK_TOOLS.map(tool => {
          const IconComponent = ICON_MAP[tool.icon] || FileText;
          const isEnabled = enabledTools[tool.id];

          return (
            <div
              key={tool.id}
              className={`
                flex items-center justify-between p-4 rounded-lg border transition-all
                ${isEnabled
                  ? 'bg-white border-[#00c4cc]/30 shadow-sm'
                  : 'bg-gray-50 border-gray-200'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isEnabled ? 'bg-[#00c4cc]/10' : 'bg-gray-100'}`}>
                  <IconComponent className={`w-5 h-5 ${isEnabled ? 'text-[#00c4cc]' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className={`font-medium ${isEnabled ? 'text-gray-800' : 'text-gray-500'}`}>
                    {tool.name}
                  </p>
                  <p className="text-xs text-gray-500">{tool.description}</p>
                </div>
              </div>

              {/* トグルスイッチ */}
              <button
                onClick={() => toggleTool(tool.id)}
                className={`
                  relative w-12 h-6 rounded-full transition-colors
                  ${isEnabled ? 'bg-[#00c4cc]' : 'bg-gray-300'}
                `}
              >
                <span
                  className={`
                    absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
                    ${isEnabled ? 'left-7' : 'left-1'}
                  `}
                />
              </button>
            </div>
          );
        })}
      </div>

      {/* 注意事項 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>注意:</strong> 「打刻（勤怠）」は必須機能のため、常に表示されます。
          設定を変更すると、所属するすべてのスタッフの個人画面に反映されます。
        </p>
      </div>
    </div>
  );
}
