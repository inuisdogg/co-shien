/**
 * 収支管理ビュー
 */

'use client';

import React from 'react';
import { PieChart } from 'lucide-react';

const FinanceView: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-96 text-gray-400 bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="text-center">
        <PieChart size={48} className="mx-auto mb-2 text-gray-200" />
        <p className="font-medium">収支管理画面</p>
        <p className="text-xs mt-1">売上や人件費の概算をここに表示します</p>
      </div>
    </div>
  );
};

export default FinanceView;

