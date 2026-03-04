'use client';

import React, { useState, useCallback } from 'react';
import { Shield, ShieldCheck, ShieldOff, ChevronDown, Info } from 'lucide-react';
import { UserPermissions, PermissionKey, PERMISSION_CATEGORIES, PERMISSION_LABELS } from '@/types';

interface PermissionEditorProps {
  permissions: UserPermissions;
  onChange: (permissions: UserPermissions) => void;
  /** Read-only display mode */
  readOnly?: boolean;
  /** Staff role for preset suggestions */
  role?: string;
}

// Preset role templates
const ROLE_PRESETS: Record<string, { label: string; description: string; permissions: PermissionKey[] }> = {
  fullAccess: {
    label: 'フルアクセス',
    description: '管理者・マネージャー向け。全機能にアクセス可能',
    permissions: Object.values(PERMISSION_CATEGORIES).flat() as PermissionKey[],
  },
  careStaff: {
    label: '支援スタッフ',
    description: '児童支援に必要な機能のみ',
    permissions: ['schedule', 'children', 'dailyLog', 'supportPlan', 'chat', 'transport', 'connect'],
  },
  officeStaff: {
    label: '事務スタッフ',
    description: '事務・経理に必要な機能',
    permissions: ['schedule', 'children', 'staff', 'shift', 'dashboard', 'documents', 'cashFlow', 'incident'],
  },
  limitedStaff: {
    label: '最小限',
    description: '出勤・日誌のみ',
    permissions: ['schedule', 'dailyLog', 'chat'],
  },
};

// Permission category icons and colors
const CATEGORY_STYLES: Record<string, { color: string; bg: string }> = {
  '利用者管理': { color: 'text-blue-600', bg: 'bg-blue-50' },
  '日誌・記録': { color: 'text-emerald-600', bg: 'bg-emerald-50' },
  'スタッフ管理': { color: 'text-purple-600', bg: 'bg-purple-50' },
  '運営管理': { color: 'text-amber-600', bg: 'bg-amber-50' },
  '売上・経営管理': { color: 'text-red-600', bg: 'bg-red-50' },
  '採用': { color: 'text-indigo-600', bg: 'bg-indigo-50' },
  '設定': { color: 'text-gray-600', bg: 'bg-gray-50' },
  'キャリアアプリ': { color: 'text-teal-600', bg: 'bg-teal-50' },
};

export default function PermissionEditor({
  permissions,
  onChange,
  readOnly = false,
  role,
}: PermissionEditorProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(Object.keys(PERMISSION_CATEGORIES)));

  const togglePermission = useCallback((key: PermissionKey) => {
    if (readOnly) return;
    const updated = { ...permissions, [key]: !permissions[key] };
    onChange(updated);
  }, [permissions, onChange, readOnly]);

  const toggleCategory = useCallback((categoryKeys: PermissionKey[], enable: boolean) => {
    if (readOnly) return;
    const updated = { ...permissions };
    categoryKeys.forEach(key => { updated[key] = enable; });
    onChange(updated);
  }, [permissions, onChange, readOnly]);

  const applyPreset = useCallback((presetId: string) => {
    if (readOnly) return;
    const preset = ROLE_PRESETS[presetId];
    if (!preset) return;
    const updated: UserPermissions = {};
    // Clear all permissions first
    (Object.keys(PERMISSION_LABELS) as PermissionKey[]).forEach(key => { updated[key] = false; });
    // Enable preset permissions
    preset.permissions.forEach(key => { updated[key] = true; });
    onChange(updated);
  }, [onChange, readOnly]);

  const enabledCount = (Object.keys(permissions) as PermissionKey[]).filter(k => permissions[k]).length;
  const totalCount = Object.keys(PERMISSION_LABELS).length;

  const toggleExpandCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            アクセス権限
          </span>
          <span className="text-xs text-gray-400">
            {enabledCount}/{totalCount} 有効
          </span>
        </div>
        {/* Quick visual indicator */}
        <div className="flex gap-0.5">
          {(Object.keys(PERMISSION_LABELS) as PermissionKey[]).map(key => (
            <div
              key={key}
              className={`w-1.5 h-4 rounded-sm ${permissions[key] ? 'bg-primary' : 'bg-gray-200'}`}
              title={`${PERMISSION_LABELS[key]}: ${permissions[key] ? 'ON' : 'OFF'}`}
            />
          ))}
        </div>
      </div>

      {/* Preset quick buttons (edit mode only) */}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(ROLE_PRESETS).map(([id, preset]) => (
            <button
              key={id}
              onClick={() => applyPreset(id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-primary/30 transition-colors"
              title={preset.description}
            >
              {id === 'fullAccess' ? (
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              ) : id === 'limitedStaff' ? (
                <ShieldOff className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <Shield className="w-3.5 h-3.5 text-gray-500" />
              )}
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {/* Permission categories */}
      <div className="space-y-2">
        {Object.entries(PERMISSION_CATEGORIES).map(([category, keys]) => {
          const style = CATEGORY_STYLES[category] || { color: 'text-gray-600', bg: 'bg-gray-50' };
          const catEnabled = keys.filter(k => permissions[k]).length;
          const isExpanded = expandedCategories.has(category);
          const allEnabled = catEnabled === keys.length;

          return (
            <div key={category} className="border border-gray-100 rounded-xl overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => toggleExpandCategory(category)}
                className={`w-full flex items-center justify-between px-3 py-2.5 ${style.bg} hover:opacity-90 transition-colors`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${style.color}`}>{category}</span>
                  <span className="text-[10px] text-gray-400">
                    {catEnabled}/{keys.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!readOnly && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCategory(keys as PermissionKey[], !allEnabled);
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        allEnabled
                          ? 'bg-primary/10 text-primary'
                          : 'bg-gray-200 text-gray-500 hover:bg-primary/10 hover:text-primary'
                      } transition-colors`}
                    >
                      {allEnabled ? '全OFF' : '全ON'}
                    </button>
                  )}
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                  />
                </div>
              </button>

              {/* Permission toggles */}
              {isExpanded && (
                <div className="px-3 py-2 space-y-1 bg-white">
                  {(keys as PermissionKey[]).map(key => (
                    <label
                      key={key}
                      className={`flex items-center justify-between py-1.5 px-2 rounded-lg ${
                        readOnly ? '' : 'hover:bg-gray-50 cursor-pointer'
                      } transition-colors`}
                    >
                      <span className="text-xs text-gray-700">{PERMISSION_LABELS[key]}</span>
                      {readOnly ? (
                        <span className={`text-xs font-medium ${permissions[key] ? 'text-primary' : 'text-gray-300'}`}>
                          {permissions[key] ? 'ON' : 'OFF'}
                        </span>
                      ) : (
                        <button
                          onClick={() => togglePermission(key)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            permissions[key] ? 'bg-primary' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                              permissions[key] ? 'translate-x-4' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Help text */}
      {!readOnly && (
        <div className="flex items-start gap-2 px-3 py-2 bg-info-light rounded-lg">
          <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600">
            管理者・マネージャーは自動的に全機能にアクセスできます。権限設定は一般スタッフに対してのみ適用されます。
          </p>
        </div>
      )}
    </div>
  );
}
