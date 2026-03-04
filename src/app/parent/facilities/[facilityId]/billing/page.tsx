/**
 * 保護者向け請求明細ページ
 * 月別の請求明細を確認し、代理受領通知書を印刷できる
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Building2, Calendar, Receipt,
  ChevronLeft, ChevronRight, Download, Printer,
  AlertCircle, CheckCircle, Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { generateProxyReceiptHTML } from '@/lib/regulatoryDocuments';
import type { ProxyReceiptData } from '@/lib/regulatoryDocuments';
import { openPrintWindow } from '@/lib/wordEngine';

export const dynamic = 'force-dynamic';

type BillingRecord = {
  id: string;
  childId: string;
  childName: string;
  yearMonth: string;
  serviceType: string;
  totalUnits: number;
  unitPrice: number;
  totalAmount: number;
  copayAmount: number;
  insuranceAmount: number;
  upperLimitAmount: number;
  usageDays: number;
  status: string;
};

export default function ParentBillingPage() {
  const router = useRouter();
  const params = useParams();
  const facilityId = params.facilityId as string;

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [facility, setFacility] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const yearMonth = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          router.push('/parent/login');
          return;
        }
        const user = JSON.parse(userStr);
        if (user.userType !== 'client') {
          router.push('/career');
          return;
        }
        setCurrentUser(user);

        // 施設情報
        const { data: facilityData } = await supabase
          .from('facilities')
          .select('id, name, code')
          .eq('id', facilityId)
          .single();
        setFacility(facilityData);

        // 利用児童一覧
        const { data: contractData } = await supabase
          .from('parent_child_facilities')
          .select('child_id')
          .eq('parent_user_id', user.id)
          .eq('facility_id', facilityId);

        const childIds = (contractData || []).map(c => c.child_id);
        if (childIds.length > 0) {
          const { data: childData } = await supabase
            .from('children')
            .select('id, name, beneficiary_number, service_type')
            .in('id', childIds);
          setChildren(childData || []);
        }
      } catch (err) {
        console.error('Fetch error:', err);
        setError('データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [facilityId, router]);

  // 請求データ取得
  useEffect(() => {
    const fetchBilling = async () => {
      if (!currentUser || children.length === 0) return;

      const childIds = selectedChildId === 'all'
        ? children.map(c => c.id)
        : [selectedChildId];

      const { data } = await supabase
        .from('billing_records')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('year_month', yearMonth)
        .in('child_id', childIds);

      const childMap = Object.fromEntries(children.map(c => [c.id, c]));

      const records: BillingRecord[] = (data || []).map((r: any) => ({
        id: r.id,
        childId: r.child_id,
        childName: childMap[r.child_id]?.name || '不明',
        yearMonth: r.year_month,
        serviceType: r.service_type || childMap[r.child_id]?.service_type || '児童発達支援',
        totalUnits: r.total_units || 0,
        unitPrice: r.unit_price || 10,
        totalAmount: r.total_amount || 0,
        copayAmount: r.copay_amount || 0,
        insuranceAmount: r.insurance_amount || 0,
        upperLimitAmount: r.upper_limit_amount || 0,
        usageDays: r.usage_days || 0,
        status: r.status || 'draft',
      }));

      setBillingRecords(records);
    };
    fetchBilling();
  }, [currentUser, children, selectedChildId, yearMonth, facilityId]);

  const handlePrevMonth = () => {
    setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handlePrintReceipt = (record: BillingRecord) => {
    if (!facility) return;
    const receiptData: ProxyReceiptData = {
      facilityName: facility.name,
      facilityCode: facility.code || '',
      yearMonth: record.yearMonth,
      childName: record.childName,
      guardianName: currentUser?.name || '',
      beneficiaryNumber: children.find(c => c.id === record.childId)?.beneficiary_number || '',
      serviceType: record.serviceType,
      totalUnits: record.totalUnits,
      unitPrice: record.unitPrice,
      totalAmount: record.totalAmount,
      copayAmount: record.copayAmount,
      insuranceAmount: record.insuranceAmount,
      upperLimitAmount: record.upperLimitAmount,
      usageDays: record.usageDays,
    };
    const html = generateProxyReceiptHTML(receiptData);
    openPrintWindow(html);
  };

  const totalCopay = billingRecords.reduce((sum, r) => sum + r.copayAmount, 0);
  const totalAmount = billingRecords.reduce((sum, r) => sum + r.totalAmount, 0);

  const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
    draft: { label: '作成中', icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100' },
    confirmed: { label: '確定済', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    submitted: { label: '請求済', icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
    paid: { label: '支払済', icon: CheckCircle, color: 'text-emerald-700', bg: 'bg-emerald-100' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-orange-50/30">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-orange-50/30">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-orange-50/30">
      {/* ヘッダー */}
      <div className="bg-white border-b border-orange-100 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button onClick={() => router.back()} className="p-1">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-800 truncate">請求明細</h1>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {facility?.name || '施設'}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* 月選択 */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-orange-100 p-3">
          <button onClick={handlePrevMonth} className="p-1">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-orange-400" />
            <span className="font-bold text-gray-800">
              {selectedMonth.getFullYear()}年{selectedMonth.getMonth() + 1}月
            </span>
          </div>
          <button onClick={handleNextMonth} className="p-1">
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 子ども選択（複数いる場合） */}
        {children.length > 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-3">
            <select
              value={selectedChildId}
              onChange={e => setSelectedChildId(e.target.value)}
              className="w-full text-sm bg-transparent focus:outline-none"
            >
              <option value="all">全員</option>
              {children.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* サマリーカード */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-4">
            <p className="text-xs text-gray-500 mb-1">ご請求額（利用者負担）</p>
            <p className="text-2xl font-bold text-orange-600">
              {totalCopay.toLocaleString()}<span className="text-sm font-normal ml-1">円</span>
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-4">
            <p className="text-xs text-gray-500 mb-1">給付費総額</p>
            <p className="text-2xl font-bold text-gray-700">
              {totalAmount.toLocaleString()}<span className="text-sm font-normal ml-1">円</span>
            </p>
          </div>
        </div>

        {/* 請求明細 */}
        {billingRecords.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-8 text-center">
            <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">この月の請求データはありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {billingRecords.map(record => {
              const st = statusConfig[record.status] || statusConfig.draft;
              const StIcon = st.icon;

              return (
                <div key={record.id} className="bg-white rounded-xl shadow-sm border border-orange-100 overflow-hidden">
                  {/* ヘッダー */}
                  <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-800">{record.childName}</h3>
                      <p className="text-xs text-gray-500">{record.serviceType}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${st.bg} ${st.color}`}>
                      <StIcon className="w-3 h-3" />
                      {st.label}
                    </span>
                  </div>

                  {/* 明細テーブル */}
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">利用日数</span>
                      <span className="text-gray-800 font-medium">{record.usageDays}日</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">総単位数</span>
                      <span className="text-gray-800">{record.totalUnits.toLocaleString()} 単位</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">単位単価</span>
                      <span className="text-gray-800">{record.unitPrice.toFixed(1)} 円</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
                      <span className="text-gray-500">費用総額</span>
                      <span className="text-gray-800">{record.totalAmount.toLocaleString()} 円</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">負担上限月額</span>
                      <span className="text-gray-800">{record.upperLimitAmount.toLocaleString()} 円</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
                      <span className="text-gray-600 font-medium">利用者負担額</span>
                      <span className="text-orange-600 font-bold text-base">{record.copayAmount.toLocaleString()} 円</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">代理受領額</span>
                      <span className="text-gray-700">{record.insuranceAmount.toLocaleString()} 円</span>
                    </div>
                  </div>

                  {/* アクション */}
                  {record.status !== 'draft' && (
                    <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/50">
                      <button
                        onClick={() => handlePrintReceipt(record)}
                        className="flex items-center gap-1.5 text-sm text-orange-600 font-medium hover:underline"
                      >
                        <Printer className="w-4 h-4" />
                        代理受領通知書を印刷
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 注意事項 */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-xs text-orange-800">
            <strong>ご確認ください:</strong> 利用者負担額は、受給者証に記載された負担上限月額の範囲内で計算されています。
            ご不明な点がございましたら、施設までお問い合わせください。
          </p>
        </div>
      </div>
    </div>
  );
}
