'use client';

import React from 'react';
import {
  Lightbulb,
  UserPlus,
  ArrowUpCircle,
  GraduationCap,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';

type Suggestion = {
  type: 'hire' | 'upgrade' | 'training';
  title: string;
  description: string;
  estimatedImpact: number;
  requirements: string[];
  priority: 'high' | 'medium' | 'low';
};

interface Props {
  suggestions: Suggestion[];
}

export default function OptimizationTab({ suggestions }: Props) {
  if (suggestions.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-800 mb-2">
          最適化済み
        </h3>
        <p className="text-gray-500">
          現在の配置で取得可能な加算を最大限活用しています。
        </p>
      </div>
    );
  }

  // 優先度別にグループ化
  const highPriority = suggestions.filter(s => s.priority === 'high');
  const mediumPriority = suggestions.filter(s => s.priority === 'medium');
  const lowPriority = suggestions.filter(s => s.priority === 'low');

  // 合計インパクト
  const totalImpact = suggestions.reduce((sum, s) => sum + s.estimatedImpact, 0);

  return (
    <div className="space-y-6">
      {/* サマリー */}
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-4 border border-yellow-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Lightbulb size={24} className="text-yellow-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-800">
                {suggestions.length}件の改善提案があります
              </h3>
              <p className="text-sm text-gray-600">
                すべて実施した場合の月間収益増加見込み
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-yellow-600">
              +¥{totalImpact.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">/月</div>
          </div>
        </div>
      </div>

      {/* 高優先度 */}
      {highPriority.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            すぐに対応可能
          </h3>
          <div className="space-y-3">
            {highPriority.map((suggestion, index) => (
              <SuggestionCard key={index} suggestion={suggestion} />
            ))}
          </div>
        </div>
      )}

      {/* 中優先度 */}
      {mediumPriority.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Info size={16} className="text-yellow-500" />
            検討をお勧め
          </h3>
          <div className="space-y-3">
            {mediumPriority.map((suggestion, index) => (
              <SuggestionCard key={index} suggestion={suggestion} />
            ))}
          </div>
        </div>
      )}

      {/* 低優先度 */}
      {lowPriority.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Info size={16} className="text-gray-400" />
            中長期的な検討
          </h3>
          <div className="space-y-3">
            {lowPriority.map((suggestion, index) => (
              <SuggestionCard key={index} suggestion={suggestion} />
            ))}
          </div>
        </div>
      )}

      {/* 注意事項 */}
      <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-500">
        <p className="font-medium text-gray-600 mb-1">ご注意</p>
        <ul className="list-disc list-inside space-y-1">
          <li>上記は概算であり、実際の収益は利用状況や地域区分により変動します</li>
          <li>加算の取得には届出や要件の継続的な充足が必要です</li>
          <li>人員の採用・配置変更は労働法規や就業規則に従って行ってください</li>
        </ul>
      </div>
    </div>
  );
}

// 提案カード
function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  const getTypeConfig = () => {
    switch (suggestion.type) {
      case 'hire':
        return {
          icon: UserPlus,
          color: 'text-blue-500',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          label: '採用',
        };
      case 'upgrade':
        return {
          icon: ArrowUpCircle,
          color: 'text-green-500',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          label: '変更',
        };
      case 'training':
        return {
          icon: GraduationCap,
          color: 'text-purple-500',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          label: '育成',
        };
    }
  };

  const config = getTypeConfig();
  const TypeIcon = config.icon;

  const getPriorityBadge = () => {
    switch (suggestion.priority) {
      case 'high':
        return 'bg-red-100 text-red-700';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700';
      case 'low':
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className={`rounded-lg border p-4 ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${config.bgColor}`}>
          <TypeIcon size={20} className={config.color} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-800">{suggestion.title}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${getPriorityBadge()}`}>
              {suggestion.priority === 'high' ? '高' : suggestion.priority === 'medium' ? '中' : '低'}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${config.bgColor} ${config.color}`}>
              {config.label}
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-2">{suggestion.description}</p>

          {/* 必要な要件 */}
          {suggestion.requirements.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-gray-500 mb-1">必要な対応:</div>
              <ul className="text-xs text-gray-600 space-y-0.5">
                {suggestion.requirements.map((req, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <CheckCircle size={10} className="text-gray-400" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* インパクト */}
          <div className="flex items-center gap-2 bg-white/50 rounded px-3 py-2">
            <TrendingUp size={16} className="text-green-500" />
            <span className="text-sm text-gray-600">月間収益増加見込み:</span>
            <span className="font-bold text-green-600">
              +¥{suggestion.estimatedImpact.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
