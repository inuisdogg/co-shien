/**
 * ダッシュボードビュー
 */

'use client';

import React from 'react';
import { TrendingUp, Bell, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardViewProps {
  setActiveTab: (tab: string) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ setActiveTab }) => {
  const chartData = [
    { name: '1w', v: 4000 },
    { name: '2w', v: 3000 },
    { name: '3w', v: 2000 },
    { name: '4w', v: 2780 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
            今月の売上見込
          </div>
          <div className="text-2xl font-bold text-gray-800">¥1,250,000</div>
          <div className="text-xs text-[#00c4cc] flex items-center mt-2 font-bold">
            <TrendingUp size={14} className="mr-1" /> 対予算 105%
          </div>
        </div>
        <div
          className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
          onClick={() => setActiveTab('schedule')}
        >
          <div className="flex justify-between items-start mb-2">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">
              承認待ちリクエスト
            </div>
            <Bell size={16} className="text-orange-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-orange-500">3件</div>
          <div className="text-xs text-gray-400 mt-2">保護者からの申請</div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
            月間稼働率
          </div>
          <div className="text-2xl font-bold text-gray-800">88.5%</div>
          <div className="text-xs text-gray-400 mt-2">定員充足率</div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
            スタッフ配置
          </div>
          <div className="text-2xl font-bold text-gray-800">充足</div>
          <div className="text-xs text-[#00c4cc] mt-2 font-bold flex items-center">
            <CheckCircle size={12} className="mr-1" /> 基準クリア
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-gray-700">売上・稼働推移</h3>
          <select className="bg-gray-50 border-none text-sm text-gray-600 font-bold rounded px-2 py-1 cursor-pointer hover:bg-gray-100">
            <option>過去30日</option>
          </select>
        </div>
        <div className="h-64 bg-gray-50 rounded border border-dashed border-gray-200 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="v" fill="#00c4cc" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;

