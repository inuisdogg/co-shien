/**
 * WorkRulesView - 就業規則表示
 * 施設の就業規則を確認
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Scale, Download, FileText, ChevronRight, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface WorkRule {
  id: string;
  title: string;
  description: string;
  category: string;
  pdfUrl?: string;
  version: string;
  effectiveDate: string;
  updatedAt: string;
}

interface WorkRulesViewProps {
  facilityId: string;
  facilityName: string;
  onBack: () => void;
}

export default function WorkRulesView({ facilityId, facilityName, onBack }: WorkRulesViewProps) {
  const [rules, setRules] = useState<WorkRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<WorkRule | null>(null);

  useEffect(() => {
    loadRules();
  }, [facilityId]);

  const loadRules = async () => {
    try {
      const { data, error } = await supabase
        .from('work_rules')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('is_active', true)
        .order('category')
        .order('title');

      if (error) throw error;

      setRules((data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description || '',
        category: r.category || '一般',
        pdfUrl: r.pdf_url,
        version: r.version || '1.0',
        effectiveDate: r.effective_date,
        updatedAt: r.updated_at,
      })));
    } catch (err) {
      console.error('就業規則取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  const categoryColors: Record<string, string> = {
    '一般': 'bg-blue-100 text-blue-700',
    '勤怠': 'bg-green-100 text-green-700',
    '給与': 'bg-yellow-100 text-yellow-700',
    '福利厚生': 'bg-purple-100 text-purple-700',
    '服務規律': 'bg-red-100 text-red-700',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#818CF8]" />
      </div>
    );
  }

  if (selectedRule) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedRule(null)}
          className="flex items-center gap-2 text-[#818CF8] font-bold hover:underline"
        >
          <span>&#8592;</span> 一覧に戻る
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className={`inline-block px-2 py-1 rounded text-xs font-bold mb-2 ${categoryColors[selectedRule.category] || 'bg-gray-100 text-gray-700'}`}>
                {selectedRule.category}
              </span>
              <h2 className="text-xl font-bold text-gray-800">{selectedRule.title}</h2>
              <p className="text-sm text-gray-500 mt-1">バージョン {selectedRule.version}</p>
            </div>
            {selectedRule.pdfUrl && (
              <a
                href={selectedRule.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-[#818CF8] text-white rounded-lg hover:bg-[#6366F1]"
              >
                <Download className="w-4 h-4" />
                PDFを開く
              </a>
            )}
          </div>

          {selectedRule.description && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-gray-700 whitespace-pre-wrap">{selectedRule.description}</p>
            </div>
          )}

          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              施行日: {new Date(selectedRule.effectiveDate).toLocaleDateString('ja-JP')}
            </div>
            <div>
              更新日: {new Date(selectedRule.updatedAt).toLocaleDateString('ja-JP')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[#818CF8] font-bold hover:underline"
      >
        <span>&#8592;</span> 業務ツールに戻る
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Scale className="w-6 h-6 text-[#818CF8]" />
            <div>
              <h2 className="text-lg font-bold text-gray-800">就業規則</h2>
              <p className="text-sm text-gray-500">{facilityName}</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          {rules.length > 0 ? (
            <div className="space-y-2">
              {rules.map((rule) => (
                <button
                  key={rule.id}
                  onClick={() => setSelectedRule(rule)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div className="text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${categoryColors[rule.category] || 'bg-gray-100 text-gray-700'}`}>
                          {rule.category}
                        </span>
                      </div>
                      <p className="font-bold text-gray-800">{rule.title}</p>
                      <p className="text-xs text-gray-500">Ver.{rule.version}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Scale className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">就業規則はまだ登録されていません</p>
              <p className="text-sm text-gray-400 mt-1">施設から登録されると、ここに表示されます</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
