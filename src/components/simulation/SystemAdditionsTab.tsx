'use client';

import React from 'react';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  Award,
  ChevronRight,
} from 'lucide-react';
import { StaffForJudgment, AdditionJudgmentResult } from '@/utils/additionJudgment';
import { SimulationResult } from '@/hooks/useAdditionSimulator';
import { WORK_STYLE_LABELS, PERSONNEL_TYPE_LABELS } from '@/types';

interface Props {
  staff: StaffForJudgment[];
  simulationResult: SimulationResult | null;
}

export default function SystemAdditionsTab({ staff, simulationResult }: Props) {
  if (!simulationResult) {
    return (
      <div className="text-center py-8 text-gray-500">
        データを読み込み中...
      </div>
    );
  }

  // グループ別に加算を整理
  const groupedAdditions = groupAdditionsByGroup(simulationResult.systemAdditions);

  return (
    <div className="space-y-6">
      {/* スタッフ配置状況 */}
      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Users size={20} className="text-[#00c4cc]" />
          現在のスタッフ配置
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {staff.map(s => (
            <StaffCard key={s.id} staff={s} />
          ))}
          {staff.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-400">
              スタッフデータがありません
            </div>
          )}
        </div>
      </div>

      {/* FTEサマリー */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">常勤換算（FTE）サマリー</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FTESummaryItem
            label="全スタッフ"
            value={staff.reduce((sum, s) => sum + s.fte, 0)}
            total={staff.length}
          />
          <FTESummaryItem
            label="基準人員"
            value={staff.filter(s => s.personnelType === 'standard').reduce((sum, s) => sum + s.fte, 0)}
            total={staff.filter(s => s.personnelType === 'standard').length}
          />
          <FTESummaryItem
            label="加算人員"
            value={staff.filter(s => s.personnelType === 'addition').reduce((sum, s) => sum + s.fte, 0)}
            total={staff.filter(s => s.personnelType === 'addition').length}
          />
          <FTESummaryItem
            label="専門職"
            value={staff.filter(s =>
              s.qualifications.some(q => ['PT', 'OT', 'ST', 'PSYCHOLOGIST', '理学療法士', '作業療法士', '言語聴覚士', '公認心理師'].includes(q))
            ).reduce((sum, s) => sum + s.fte, 0)}
            total={staff.filter(s =>
              s.qualifications.some(q => ['PT', 'OT', 'ST', 'PSYCHOLOGIST', '理学療法士', '作業療法士', '言語聴覚士', '公認心理師'].includes(q))
            ).length}
          />
        </div>
      </div>

      {/* 体制加算一覧 */}
      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Award size={20} className="text-[#00c4cc]" />
          体制加算の判定結果
        </h3>

        {Object.entries(groupedAdditions).map(([groupName, additions]) => (
          <div key={groupName} className="mb-6">
            <h4 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
              <ChevronRight size={16} />
              {getGroupDisplayName(groupName)}
              {groupName !== 'other' && (
                <span className="text-xs text-gray-400">（排他グループ）</span>
              )}
            </h4>
            <div className="space-y-2">
              {additions.map(addition => (
                <AdditionCard key={addition.code} addition={addition} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// スタッフカード
function StaffCard({ staff }: { staff: StaffForJudgment }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-800">{staff.name}</span>
        <span className={`text-xs px-2 py-0.5 rounded ${
          staff.personnelType === 'standard'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-green-100 text-green-700'
        }`}>
          {PERSONNEL_TYPE_LABELS[staff.personnelType]}
        </span>
      </div>
      <div className="text-xs text-gray-500 space-y-1">
        <div className="flex justify-between">
          <span>勤務形態:</span>
          <span className="text-gray-700">{WORK_STYLE_LABELS[staff.workStyle]}</span>
        </div>
        <div className="flex justify-between">
          <span>FTE:</span>
          <span className="text-gray-700 font-medium">{staff.fte.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>経験年数:</span>
          <span className="text-gray-700">{staff.yearsOfExperience}年</span>
        </div>
        {staff.qualifications.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {staff.qualifications.slice(0, 3).map((q, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                {q}
              </span>
            ))}
            {staff.qualifications.length > 3 && (
              <span className="text-[10px] text-gray-400">+{staff.qualifications.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// FTEサマリーアイテム
function FTESummaryItem({ label, value, total }: { label: string; value: number; total: number }) {
  return (
    <div className="text-center">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-lg font-bold text-gray-800">{value.toFixed(2)}</div>
      <div className="text-xs text-gray-400">{total}名</div>
    </div>
  );
}

// 加算カード
function AdditionCard({ addition }: { addition: AdditionJudgmentResult }) {
  const getStatusConfig = () => {
    if (addition.isCurrent) {
      return {
        icon: CheckCircle,
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        iconColor: 'text-green-500',
        label: '取得中',
        labelBg: 'bg-green-100 text-green-700',
      };
    }
    if (addition.isEligible) {
      return {
        icon: AlertCircle,
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        iconColor: 'text-blue-500',
        label: '取得可能',
        labelBg: 'bg-blue-100 text-blue-700',
      };
    }
    return {
      icon: XCircle,
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      iconColor: 'text-gray-400',
      label: '未充足',
      labelBg: 'bg-gray-100 text-gray-500',
    };
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  return (
    <div className={`rounded-lg border p-4 ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <StatusIcon size={20} className={`mt-0.5 ${config.iconColor}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-800">{addition.shortName}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${config.labelBg}`}>
                {config.label}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">{addition.name}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-gray-800">{addition.units}</div>
          <div className="text-xs text-gray-500">単位/日</div>
        </div>
      </div>

      {/* 要件の充足状況 */}
      <div className="mt-3 space-y-1">
        {addition.requirements.map((req, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              {req.met ? (
                <CheckCircle size={12} className="text-green-500" />
              ) : (
                <XCircle size={12} className="text-red-400" />
              )}
              <span className="text-gray-600">{req.name}</span>
            </div>
            <span className={req.met ? 'text-green-600' : 'text-red-500'}>
              {req.current} / {req.required}
            </span>
          </div>
        ))}
      </div>

      {/* 理由 */}
      <div className="mt-2 text-xs text-gray-500 italic">
        {addition.reason}
      </div>
    </div>
  );
}

// ヘルパー関数
function groupAdditionsByGroup(additions: AdditionJudgmentResult[]): Record<string, AdditionJudgmentResult[]> {
  const groups: Record<string, AdditionJudgmentResult[]> = {};

  additions.forEach(addition => {
    const group = addition.exclusiveGroup || 'other';
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(addition);
  });

  // 優先度順にソート
  Object.values(groups).forEach(group => {
    group.sort((a, b) => a.priority - b.priority);
  });

  return groups;
}

function getGroupDisplayName(groupKey: string): string {
  const names: Record<string, string> = {
    staff_allocation: '児童指導員等加配加算',
    welfare_professional: '福祉専門職員配置等加算',
    other: 'その他の体制加算',
  };
  return names[groupKey] || groupKey;
}
