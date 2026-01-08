/**
 * 児童管理ビュー
 * 詳細な登録フォーム、下書き保存、契約ステータス管理に対応
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  UserPlus,
  MoreHorizontal,
  Save,
  FileText,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  Edit,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Child, ChildFormData, ContractStatus, Lead } from '@/types';
import { useFacilityData } from '@/hooks/useFacilityData';
import { saveDraft, getDrafts, deleteDraft, loadDraft } from '@/utils/draftStorage';
import { Target, ChevronRight } from 'lucide-react';

interface ChildrenViewProps {
  setActiveTab?: (tab: string) => void;
}

const ChildrenView: React.FC<ChildrenViewProps> = ({ setActiveTab }) => {
  const { children, addChild, updateChild, getLeadsByChildId } = useFacilityData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [sortStatus, setSortStatus] = useState<ContractStatus | 'all'>('all');
  const [drafts, setDrafts] = useState<ChildFormData[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<string | null>(null);

  // フォームの初期値
  const initialFormData: ChildFormData = {
    name: '',
    nameKana: '',
    age: undefined,
    birthDate: '',
    guardianName: '',
    guardianNameKana: '',
    guardianRelationship: '',
    beneficiaryNumber: '',
    grantDays: undefined,
    contractDays: undefined,
    address: '',
    phone: '',
    email: '',
    doctorName: '',
    doctorClinic: '',
    schoolName: '',
    pattern: '',
    patternDays: [],
    patternTimeSlots: {},
    needsPickup: false,
    needsDropoff: false,
    pickupLocation: '',
    pickupLocationCustom: '',
    dropoffLocation: '',
    dropoffLocationCustom: '',
    characteristics: '',
    contractStatus: 'pre-contract',
    contractStartDate: '',
    contractEndDate: '',
    registrationType: 'post-contract',
    plannedContractDays: undefined,
    plannedUsageStartDate: '',
    plannedUsageDays: undefined,
  };

  const [formData, setFormData] = useState<ChildFormData>(initialFormData);

  // 下書き一覧を読み込む
  useEffect(() => {
    setDrafts(getDrafts());
  }, []);

  // 下書きを読み込む
  const handleLoadDraft = (childName: string) => {
    const draft = loadDraft(childName);
    if (draft) {
      setFormData(draft);
      setSelectedDraft(childName);
      if (!isModalOpen) {
        setIsModalOpen(true);
      }
    }
  };

  // 下書きを削除
  const handleDeleteDraft = (childName: string) => {
    deleteDraft(childName);
    setDrafts(getDrafts());
    if (selectedDraft === childName) {
      setFormData(initialFormData);
      setSelectedDraft(null);
    }
  };

  // 下書き保存
  const handleSaveDraft = () => {
    if (!formData.name.trim()) {
      alert('児童名を入力してください');
      return;
    }
    saveDraft(formData);
    setDrafts(getDrafts());
    alert('下書きを保存しました');
  };

  // フォーム送信
  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert('児童名を入力してください');
      return;
    }

    // 編集モードの場合は更新
    if (selectedChild) {
      await handleUpdateChild();
      return;
    }

    try {
      // 新規登録
      await addChild(formData);

      // 下書きを削除
      if (formData.name) {
        deleteDraft(formData.name);
        setDrafts(getDrafts());
      }

      setIsModalOpen(false);
      setFormData(initialFormData);
      setSelectedDraft(null);
      setSelectedChild(null);
      alert('児童を登録しました');
    } catch (error) {
      console.error('Error adding child:', error);
      alert('児童の登録に失敗しました');
    }
  };

  // モーダルを開く
  const handleOpenModal = () => {
    setFormData(initialFormData);
    setSelectedDraft(null);
    setSelectedChild(null);
    setDrafts(getDrafts()); // 下書き一覧を再読み込み
    setIsModalOpen(true);
  };

  // モーダルを閉じる
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData(initialFormData);
    setSelectedDraft(null);
    setSelectedChild(null);
  };

  // 契約ステータスの表示ラベル
  const getStatusLabel = (status: ContractStatus) => {
    const statusMap = {
      'pre-contract': { label: '契約前', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
      active: { label: '契約中', color: 'bg-green-100 text-green-700', icon: CheckCircle },
      inactive: { label: '休止中', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
      terminated: { label: '解約', color: 'bg-red-100 text-red-700', icon: X },
    };
    return statusMap[status];
  };

  // 契約ステータスごとの人数を計算
  const statusCounts = useMemo(() => {
    const counts: Record<ContractStatus, number> = {
      'pre-contract': 0,
      active: 0,
      inactive: 0,
      terminated: 0,
    };
    children.forEach((child) => {
      counts[child.contractStatus]++;
    });
    return counts;
  }, [children]);

  // ソート済み児童リスト
  const sortedChildren = useMemo(() => {
    let filtered = children;
    if (sortStatus !== 'all') {
      filtered = children.filter((child) => child.contractStatus === sortStatus);
    }
    return [...filtered].sort((a, b) => {
      // 契約ステータスでソート（契約中 > 契約前 > 休止中 > 解約）
      const statusOrder: Record<ContractStatus, number> = {
        active: 1,
        'pre-contract': 2,
        inactive: 3,
        terminated: 4,
      };
      return statusOrder[a.contractStatus] - statusOrder[b.contractStatus];
    });
  }, [children, sortStatus]);

  // 児童詳細を開く
  const handleOpenDetail = (child: Child) => {
    setSelectedChild(child);
    setIsEditMode(false);
    setIsDetailModalOpen(true);
  };

  // 編集モードに切り替え
  const handleEditChild = () => {
    if (selectedChild) {
      // パターン文字列から曜日配列を生成（既存データの互換性のため）
      let patternDays: number[] = [];
      if (selectedChild.patternDays) {
        patternDays = selectedChild.patternDays;
      } else if (selectedChild.pattern) {
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        const patternParts = selectedChild.pattern.split(/[・、,]/);
        patternDays = patternParts
          .map(part => dayNames.indexOf(part.trim()))
          .filter(index => index !== -1);
      }
      
      setFormData({
        name: selectedChild.name,
        nameKana: selectedChild.nameKana,
        age: selectedChild.age,
        birthDate: selectedChild.birthDate || '',
        guardianName: selectedChild.guardianName,
        guardianNameKana: selectedChild.guardianNameKana,
        guardianRelationship: selectedChild.guardianRelationship,
        beneficiaryNumber: selectedChild.beneficiaryNumber,
        grantDays: selectedChild.grantDays,
        contractDays: selectedChild.contractDays,
        address: selectedChild.address,
        phone: selectedChild.phone,
        email: selectedChild.email,
        doctorName: selectedChild.doctorName,
        doctorClinic: selectedChild.doctorClinic,
        schoolName: selectedChild.schoolName,
        pattern: selectedChild.pattern || '',
        patternDays: patternDays,
        patternTimeSlots: selectedChild.patternTimeSlots || {},
        needsPickup: selectedChild.needsPickup,
        needsDropoff: selectedChild.needsDropoff,
        pickupLocation: selectedChild.pickupLocation || '',
        pickupLocationCustom: selectedChild.pickupLocationCustom || '',
        dropoffLocation: selectedChild.dropoffLocation || '',
        dropoffLocationCustom: selectedChild.dropoffLocationCustom || '',
        characteristics: selectedChild.characteristics || '',
        contractStatus: selectedChild.contractStatus,
        contractStartDate: selectedChild.contractStartDate,
        contractEndDate: selectedChild.contractEndDate,
        registrationType: selectedChild.registrationType || 'post-contract',
        plannedContractDays: selectedChild.plannedContractDays,
        plannedUsageStartDate: selectedChild.plannedUsageStartDate,
        plannedUsageDays: selectedChild.plannedUsageDays,
      });
      setIsDetailModalOpen(false);
      setIsModalOpen(true);
    }
  };

  // 児童情報を更新
  const handleUpdateChild = async () => {
    if (!selectedChild || !formData.name.trim()) {
      alert('児童名を入力してください');
      return;
    }

    try {
      const updatedChild: Child = {
        ...formData,
        id: selectedChild.id,
        facilityId: selectedChild.facilityId,
        createdAt: selectedChild.createdAt,
        updatedAt: new Date().toISOString(),
      };

      await updateChild(updatedChild);
      setIsModalOpen(false);
      setFormData(initialFormData);
      setSelectedChild(null);
      alert('児童情報を更新しました');
    } catch (error) {
      console.error('Error updating child:', error);
      alert('児童情報の更新に失敗しました');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">児童管理</h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            利用児童の台帳管理、受給者証情報の更新を行います。
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-bold flex items-center shadow-sm transition-all w-full sm:w-auto justify-center"
        >
          <UserPlus size={16} className="mr-2 shrink-0" />
          新規児童登録
        </button>
      </div>

      {/* 下書き一覧 */}
      {drafts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-700 flex items-center">
              <FileText size={16} className="mr-2 text-gray-500" />
              下書き保存 ({drafts.length})
            </h3>
            <button
              onClick={handleOpenModal}
              className="text-xs text-[#00c4cc] hover:text-[#00b0b8] font-bold"
            >
              新規登録で続きを入力
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {drafts.map((draft) => {
              return (
                <div
                  key={draft.name}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <FileText size={16} className="text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-gray-800 truncate">
                        {draft.name}
                      </div>
                      {draft.guardianName && (
                        <div className="text-xs text-gray-500 truncate">
                          保護者: {draft.guardianName}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-2">
                    <button
                      onClick={() => handleLoadDraft(draft.name)}
                      className="text-[#00c4cc] hover:text-[#00b0b8] text-xs font-bold px-2 py-1 rounded transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDeleteDraft(draft.name)}
                      className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 rounded transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 契約ステータスフィルターと人数表示 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-700">契約ステータスで絞り込み</h3>
          <div className="flex items-center space-x-4 text-xs text-gray-600">
            <span>契約前: <span className="font-bold text-yellow-700">{statusCounts['pre-contract']}名</span></span>
            <span>契約中: <span className="font-bold text-green-700">{statusCounts.active}名</span></span>
            <span>休止中: <span className="font-bold text-orange-700">{statusCounts.inactive}名</span></span>
            <span>解約: <span className="font-bold text-red-700">{statusCounts.terminated}名</span></span>
            <span className="ml-2">合計: <span className="font-bold text-gray-800">{children.length}名</span></span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSortStatus('all')}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-colors ${
              sortStatus === 'all'
                ? 'bg-[#00c4cc] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            すべて ({children.length})
          </button>
          {Object.entries(statusCounts).map(([status, count]) => {
            const statusInfo = getStatusLabel(status as ContractStatus);
            return (
              <button
                key={status}
                onClick={() => setSortStatus(status as ContractStatus)}
                className={`px-4 py-2 text-xs font-bold rounded-md transition-colors flex items-center space-x-1 ${
                  sortStatus === status
                    ? `${statusInfo.color} border-2 border-current`
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <statusInfo.icon size={14} />
                <span>{statusInfo.label} ({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 児童一覧テーブル */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-3 sm:px-6 py-3 sm:py-4">氏名</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4">年齢</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">保護者名</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 hidden md:table-cell">受給者証番号</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4">契約ステータス</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4">契約日数</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4">送迎</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedChildren.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 sm:px-6 py-6 sm:py-8 text-center text-gray-400 text-xs sm:text-sm">
                    {sortStatus === 'all'
                      ? '登録されている児童はいません'
                      : '該当する児童はいません'}
                  </td>
                </tr>
              ) : (
                sortedChildren.map((child: Child) => {
                  const statusInfo = getStatusLabel(child.contractStatus);
                  const StatusIcon = statusInfo.icon;
                  return (
                    <tr
                      key={child.id}
                      className="hover:bg-[#f0fdfe] transition-colors group"
                    >
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <button
                          onClick={() => handleOpenDetail(child)}
                          className="font-bold text-gray-800 group-hover:text-[#00c4cc] hover:underline transition-colors text-left text-xs sm:text-sm"
                        >
                          {child.name}
                        </button>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-gray-600 text-xs sm:text-sm">
                        {child.age ? `${child.age}歳` : '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-gray-600 text-xs sm:text-sm hidden sm:table-cell">
                        {child.guardianName || '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-gray-600 font-mono text-xs sm:text-sm hidden md:table-cell">
                        {child.beneficiaryNumber || '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <span
                          className={`inline-flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold ${statusInfo.color}`}
                        >
                          <StatusIcon size={10} className="sm:w-3 sm:h-3" />
                          <span>{statusInfo.label}</span>
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <span className="bg-gray-100 text-gray-600 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs border border-gray-200 font-medium">
                          {child.contractDays ? `${child.contractDays}日` : '-'}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-gray-600">
                        <div className="flex space-x-1 sm:space-x-2">
                          {child.needsPickup && (
                            <span className="text-[10px] sm:text-xs bg-[#e0f7fa] text-[#006064] px-1.5 sm:px-2 py-0.5 rounded font-bold">
                              迎
                            </span>
                          )}
                          {child.needsDropoff && (
                            <span className="text-[10px] sm:text-xs bg-[#e0f7fa] text-[#006064] px-1.5 sm:px-2 py-0.5 rounded font-bold">
                              送
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 登録モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] shadow-2xl border border-gray-100 my-8">
            {/* ヘッダー */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-lg text-gray-800">
                  {selectedChild ? '児童情報編集' : '新規児童登録'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              {/* 下書き選択UI */}
              {drafts.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <FileText size={16} className="text-blue-600" />
                      <span className="text-xs font-bold text-blue-800">
                        下書きから選択 ({drafts.length}件)
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {drafts.map((draft) => (
                      <button
                        key={draft.name}
                        onClick={() => handleLoadDraft(draft.name)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                          selectedDraft === draft.name
                            ? 'bg-[#00c4cc] text-white'
                            : 'bg-white text-blue-700 border border-blue-300 hover:bg-blue-100'
                        }`}
                      >
                        {draft.name}
                        {draft.guardianName && ` (${draft.guardianName})`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* フォーム本体 */}
            <div className="p-4 md:p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-4 md:space-y-5">
                {/* 契約ステータスセクション */}
                <div className="border-b border-gray-200 pb-3 md:pb-4">
                  <h4 className="font-bold text-xs md:text-sm text-gray-700 mb-3">契約ステータス</h4>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'pre-contract', label: '契約前', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
                      { value: 'active', label: '契約中', color: 'bg-green-100 text-green-700 border-green-300' },
                      { value: 'inactive', label: '休止中', color: 'bg-orange-100 text-orange-700 border-orange-300' },
                      { value: 'terminated', label: '解約', color: 'bg-red-100 text-red-700 border-red-300' },
                    ].map((status) => (
                      <button
                        key={status.value}
                        onClick={() =>
                          setFormData({
                            ...formData,
                            contractStatus: status.value as ContractStatus,
                          })
                        }
                        className={`px-4 py-2 text-xs md:text-sm font-bold rounded-md transition-colors border-2 ${
                          formData.contractStatus === status.value
                            ? status.color
                            : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 基本情報セクション */}
                <div className="border-b border-gray-200 pb-3 md:pb-4">
                  <h4 className="font-bold text-xs md:text-sm text-gray-700 mb-3">基本情報</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        児童氏名 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md p-2 text-xs md:text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                        placeholder="例: 山田 太郎"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        フリガナ
                      </label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md p-2 text-xs md:text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                        placeholder="例: ヤマダ タロウ"
                        value={formData.nameKana || ''}
                        onChange={(e) => setFormData({ ...formData, nameKana: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        生年月日 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        className="w-full border border-gray-300 rounded-md p-2 text-xs md:text-sm focus:outline-none focus:border-[#00c4cc]"
                        value={formData.birthDate || ''}
                        onChange={(e) => {
                          const birthDate = e.target.value;
                          // 年齢を自動計算
                          let age: number | undefined = undefined;
                          let contractEndDate: string = '';
                          
                          if (birthDate) {
                            const birth = new Date(birthDate + 'T00:00:00');
                            const today = new Date();
                            age = today.getFullYear() - birth.getFullYear();
                            const monthDiff = today.getMonth() - birth.getMonth();
                            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                              age--;
                            }
                            
                            // 利用終了日を計算（満6歳に達した日以後の最初の3月31日まで）
                            // 満6歳になる日を計算
                            const sixYearsOldDate = new Date(birth);
                            sixYearsOldDate.setFullYear(birth.getFullYear() + 6);
                            
                            // 満6歳になる日が3月31日以前なら、その年の3月31日
                            // 満6歳になる日が4月1日以降なら、翌年の3月31日
                            const sixYearsOldYear = sixYearsOldDate.getFullYear();
                            const sixYearsOldMonth = sixYearsOldDate.getMonth() + 1; // 1-12
                            const sixYearsOldDay = sixYearsOldDate.getDate();
                            
                            // 満6歳になる日が3月31日以前または4月1日の場合、その年の3月31日
                            // 満6歳になる日が4月2日以降の場合、翌年の3月31日
                            let endYear: number;
                            if (sixYearsOldMonth < 4 || (sixYearsOldMonth === 4 && sixYearsOldDay === 1)) {
                              endYear = sixYearsOldYear;
                            } else {
                              endYear = sixYearsOldYear + 1;
                            }
                            
                            // 日付文字列を直接構築（タイムゾーン問題を回避）
                            contractEndDate = `${endYear}-03-31`;
                          }
                          
                          setFormData({
                            ...formData,
                            birthDate,
                            age,
                            contractEndDate,
                          });
                        }}
                      />
                      {formData.birthDate && formData.age !== undefined && (
                        <p className="text-xs text-gray-500 mt-1">
                          年齢: {formData.age}歳
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 保護者情報セクション */}
                <div className="border-b border-gray-200 pb-3 md:pb-4">
                  <h4 className="font-bold text-xs md:text-sm text-gray-700 mb-3">保護者情報</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        保護者名
                      </label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md p-2 text-xs md:text-sm focus:outline-none focus:border-[#00c4cc]"
                        placeholder="例: 山田 花子"
                        value={formData.guardianName}
                        onChange={(e) =>
                          setFormData({ ...formData, guardianName: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        フリガナ
                      </label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md p-2 text-xs md:text-sm focus:outline-none focus:border-[#00c4cc]"
                        placeholder="例: ヤマダ ハナコ"
                        value={formData.guardianNameKana || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, guardianNameKana: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">続柄</label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md p-2 text-xs md:text-sm focus:outline-none focus:border-[#00c4cc]"
                        placeholder="例: 母、父、祖母"
                        value={formData.guardianRelationship}
                        onChange={(e) =>
                          setFormData({ ...formData, guardianRelationship: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* 受給者証情報セクション */}
                <div className="border-b border-gray-200 pb-3 md:pb-4">
                  <h4 className="font-bold text-xs md:text-sm text-gray-700 mb-3">受給者証情報</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        受給者証番号
                      </label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md p-2 text-xs md:text-sm focus:outline-none focus:border-[#00c4cc] font-mono"
                        placeholder="10桁の番号"
                        value={formData.beneficiaryNumber}
                        onChange={(e) =>
                          setFormData({ ...formData, beneficiaryNumber: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        支給日数
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="w-full border border-gray-300 rounded-md p-2 text-xs md:text-sm focus:outline-none focus:border-[#00c4cc]"
                        placeholder="例: 10"
                        value={formData.grantDays || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            grantDays: e.target.value ? parseInt(e.target.value) : undefined,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        契約日数（実績）
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="w-full border border-gray-300 rounded-md p-2 text-xs md:text-sm focus:outline-none focus:border-[#00c4cc]"
                        placeholder="例: 8"
                        value={formData.contractDays || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contractDays: e.target.value ? parseInt(e.target.value) : undefined,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        契約日数（予定）
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="w-full border border-gray-300 rounded-md p-2 text-xs md:text-sm focus:outline-none focus:border-[#00c4cc]"
                        placeholder="例: 10"
                        value={formData.plannedContractDays || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            plannedContractDays: e.target.value ? parseInt(e.target.value) : undefined,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* 利用パターン・送迎セクション */}
                <div className="border-b border-gray-200 pb-3 md:pb-4">
                  <h4 className="font-bold text-xs md:text-sm text-gray-700 mb-3">利用パターン・送迎</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2">
                        基本利用パターン
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => {
                          const isChecked = formData.patternDays?.includes(index) || false;
                          const timeSlot = formData.patternTimeSlots?.[index] || 'PM';
                          return (
                            <div key={index} className="flex flex-col items-start p-1.5 border border-gray-200 rounded-md hover:bg-gray-50 min-w-[80px]">
                              <label className="flex items-center space-x-1 cursor-pointer w-full mb-1">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const currentDays = formData.patternDays || [];
                                    const newDays = e.target.checked
                                      ? [...currentDays, index]
                                      : currentDays.filter(d => d !== index);
                                    
                                    // パターン文字列も更新（後方互換性のため）
                                    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
                                    const pattern = newDays.sort((a, b) => a - b).map(d => dayNames[d]).join('・');
                                    
                                    // 時間帯設定も更新
                                    const newTimeSlots = { ...formData.patternTimeSlots };
                                    if (e.target.checked) {
                                      newTimeSlots[index] = timeSlot;
                                    } else {
                                      delete newTimeSlots[index];
                                    }
                                    
                                    setFormData({
                                      ...formData,
                                      patternDays: newDays,
                                      pattern: pattern || '',
                                      patternTimeSlots: newTimeSlots,
                                    });
                                  }}
                                  className="accent-[#00c4cc] w-3 h-3"
                                />
                                <span className="text-xs text-gray-700 font-medium">
                                  {day}
                                </span>
                              </label>
                              {isChecked && (
                                <div className="flex flex-col items-start space-y-0.5 w-full">
                                  <label className="flex items-center cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`timeSlot-${index}`}
                                      value="AM"
                                      checked={timeSlot === 'AM'}
                                      onChange={(e) => {
                                        setFormData({
                                          ...formData,
                                          patternTimeSlots: {
                                            ...formData.patternTimeSlots,
                                            [index]: 'AM',
                                          },
                                        });
                                      }}
                                      className="accent-[#00c4cc] w-2.5 h-2.5"
                                    />
                                    <span className="text-[10px] text-gray-600 ml-0.5">午前</span>
                                  </label>
                                  <label className="flex items-center cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`timeSlot-${index}`}
                                      value="PM"
                                      checked={timeSlot === 'PM'}
                                      onChange={(e) => {
                                        setFormData({
                                          ...formData,
                                          patternTimeSlots: {
                                            ...formData.patternTimeSlots,
                                            [index]: 'PM',
                                          },
                                        });
                                      }}
                                      className="accent-[#00c4cc] w-2.5 h-2.5"
                                    />
                                    <span className="text-[10px] text-gray-600 ml-0.5">午後</span>
                                  </label>
                                  <label className="flex items-center cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`timeSlot-${index}`}
                                      value="AMPM"
                                      checked={timeSlot === 'AMPM'}
                                      onChange={(e) => {
                                        setFormData({
                                          ...formData,
                                          patternTimeSlots: {
                                            ...formData.patternTimeSlots,
                                            [index]: 'AMPM',
                                          },
                                        });
                                      }}
                                      className="accent-[#00c4cc] w-2.5 h-2.5"
                                    />
                                    <span className="text-[10px] text-gray-600 ml-0.5">終日</span>
                                  </label>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="bg-gray-50 p-3 md:p-4 rounded-md border border-gray-200 space-y-3">
                      <label className="text-xs font-bold text-gray-500 block">送迎オプション</label>
                      
                      {/* お迎え */}
                      <div className="space-y-2">
                        <label className="flex items-center space-x-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={formData.needsPickup}
                            onChange={(e) =>
                              setFormData({ ...formData, needsPickup: e.target.checked })
                            }
                            className="accent-[#00c4cc] w-4 h-4"
                          />
                          <span className="text-xs md:text-sm text-gray-700 group-hover:text-gray-900 font-bold">
                            お迎え
                          </span>
                        </label>
                        {formData.needsPickup && (
                          <div className="ml-7 space-y-2">
                            <label className="block text-xs font-bold text-gray-500 mb-1">
                              乗車地
                            </label>
                            <select
                              className="w-full border border-gray-300 rounded-md p-2 text-xs md:text-sm focus:outline-none focus:border-[#00c4cc]"
                              value={formData.pickupLocation || ''}
                              onChange={(e) =>
                                setFormData({ ...formData, pickupLocation: e.target.value, pickupLocationCustom: '' })
                              }
                            >
                              <option value="">選択してください</option>
                              <option value="事業所">事業所</option>
                              <option value="自宅">自宅</option>
                              <option value="その他">その他（自由記入）</option>
                            </select>
                            {formData.pickupLocation === 'その他' && (
                              <input
                                type="text"
                                className="w-full border border-gray-300 rounded-md p-2 text-xs md:text-sm focus:outline-none focus:border-[#00c4cc]"
                                placeholder="例: 保育所、待ち合わせ場所（駅）など"
                                value={formData.pickupLocationCustom || ''}
                                onChange={(e) =>
                                  setFormData({ ...formData, pickupLocationCustom: e.target.value })
                                }
                              />
                            )}
                            {formData.pickupLocation && formData.pickupLocation !== 'その他' && (
                              <p className="text-[10px] text-gray-500">
                                選択: {formData.pickupLocation}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* お送り */}
                      <div className="space-y-2">
                        <label className="flex items-center space-x-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={formData.needsDropoff}
                            onChange={(e) =>
                              setFormData({ ...formData, needsDropoff: e.target.checked })
                            }
                            className="accent-[#00c4cc] w-4 h-4"
                          />
                          <span className="text-xs md:text-sm text-gray-700 group-hover:text-gray-900 font-bold">
                            お送り
                          </span>
                        </label>
                        {formData.needsDropoff && (
                          <div className="ml-7 space-y-2">
                            <label className="block text-xs font-bold text-gray-500 mb-1">
                              降車地
                            </label>
                            <select
                              className="w-full border border-gray-300 rounded-md p-2 text-xs md:text-sm focus:outline-none focus:border-[#00c4cc]"
                              value={formData.dropoffLocation || ''}
                              onChange={(e) =>
                                setFormData({ ...formData, dropoffLocation: e.target.value, dropoffLocationCustom: '' })
                              }
                            >
                              <option value="">選択してください</option>
                              <option value="事業所">事業所</option>
                              <option value="自宅">自宅</option>
                              <option value="その他">その他（自由記入）</option>
                            </select>
                            {formData.dropoffLocation === 'その他' && (
                              <input
                                type="text"
                                className="w-full border border-gray-300 rounded-md p-2 text-xs md:text-sm focus:outline-none focus:border-[#00c4cc]"
                                placeholder="例: 保育所、待ち合わせ場所（駅）など"
                                value={formData.dropoffLocationCustom || ''}
                                onChange={(e) =>
                                  setFormData({ ...formData, dropoffLocationCustom: e.target.value })
                                }
                              />
                            )}
                            {formData.dropoffLocation && formData.dropoffLocation !== 'その他' && (
                              <p className="text-[10px] text-gray-500">
                                選択: {formData.dropoffLocation}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 連絡先セクション */}
                <div className="border-b border-gray-200 pb-3 md:pb-4">
                  <h4 className="font-bold text-xs md:text-sm text-gray-700 mb-3">連絡先</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">住所</label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md p-2 text-xs md:text-sm focus:outline-none focus:border-[#00c4cc]"
                        placeholder="例: 東京都渋谷区..."
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">
                          電話番号
                        </label>
                        <input
                          type="tel"
                          className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                          placeholder="例: 03-1234-5678"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">
                          メールアドレス
                        </label>
                        <input
                          type="email"
                          className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                          placeholder="example@email.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 医療情報セクション */}
                <div className="border-b border-gray-200 pb-3 md:pb-4">
                  <h4 className="font-bold text-xs md:text-sm text-gray-700 mb-3">医療情報</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">
                        かかりつけ医名
                      </label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                        placeholder="例: 田中 太郎"
                        value={formData.doctorName}
                        onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">
                        医療機関名
                      </label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                        placeholder="例: 〇〇クリニック"
                        value={formData.doctorClinic}
                        onChange={(e) => setFormData({ ...formData, doctorClinic: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* 通園情報セクション */}
                <div className="border-b border-gray-200 pb-3 md:pb-4">
                  <h4 className="font-bold text-xs md:text-sm text-gray-700 mb-3">通園情報</h4>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">
                      通園場所名
                    </label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-md p-2 text-xs md:text-sm focus:outline-none focus:border-[#00c4cc]"
                      placeholder="例: 〇〇小学校、〇〇幼稚園"
                      value={formData.schoolName}
                      onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                    />
                  </div>
                </div>

                {/* 契約情報セクション */}
                <div className="border-b border-gray-200 pb-3 md:pb-4">
                  <h4 className="font-bold text-xs md:text-sm text-gray-700 mb-3">契約情報</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        契約開始予定日
                      </label>
                      <input
                        type="date"
                        className="w-full border border-gray-300 rounded-md p-2 text-xs md:text-sm focus:outline-none focus:border-[#00c4cc]"
                        value={formData.plannedUsageStartDate || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            plannedUsageStartDate: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        契約開始日
                      </label>
                      <input
                        type="date"
                        className="w-full border border-gray-300 rounded-md p-2 text-xs md:text-sm focus:outline-none focus:border-[#00c4cc]"
                        value={formData.contractStartDate}
                        onChange={(e) =>
                          setFormData({ ...formData, contractStartDate: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">
                        契約終了日
                      </label>
                      <input
                        type="date"
                        className={`w-full border border-gray-300 rounded-md p-2 text-xs md:text-sm focus:outline-none focus:border-[#00c4cc] ${
                          formData.birthDate ? 'bg-gray-50' : ''
                        }`}
                        value={formData.contractEndDate}
                        onChange={(e) =>
                          setFormData({ ...formData, contractEndDate: e.target.value })
                        }
                        readOnly={!!formData.birthDate}
                      />
                      {formData.birthDate && (
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          生年月日から自動計算
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 特性・メモセクション */}
                <div>
                  <h4 className="font-bold text-xs md:text-sm text-gray-700 mb-3">特性・メモ</h4>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">
                      特性・メモ
                    </label>
                    <textarea
                      rows={3}
                      className="w-full border border-gray-300 rounded-md p-2 text-xs md:text-sm focus:outline-none focus:border-[#00c4cc]"
                      placeholder="児童の特性、配慮事項、その他のメモを記入してください"
                      value={formData.characteristics || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, characteristics: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* フッター */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-between items-center">
              <button
                onClick={handleSaveDraft}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-bold transition-colors"
              >
                <Save size={16} />
                <span>下書き保存</span>
              </button>
              <div className="flex space-x-3">
                <button
                  onClick={handleCloseModal}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md text-sm font-bold transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white rounded-md text-sm font-bold shadow-md transition-colors"
                >
                  {selectedChild ? '更新' : '登録'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 児童詳細表示モーダル */}
      {isDetailModalOpen && selectedChild && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] shadow-2xl border border-gray-100 my-8">
            {/* ヘッダー */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
              <h3 className="font-bold text-lg text-gray-800">児童詳細情報</h3>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* 詳細情報 */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-6">
                {/* 基本情報 */}
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-bold text-sm text-gray-700 mb-4">基本情報</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500">児童氏名</label>
                      <p className="text-sm text-gray-800 mt-1">{selectedChild.name}</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500">生年月日</label>
                      <p className="text-sm text-gray-800 mt-1">
                        {selectedChild.birthDate 
                          ? `${selectedChild.birthDate} ${selectedChild.age ? `(${selectedChild.age}歳)` : ''}`
                          : selectedChild.age ? `${selectedChild.age}歳` : '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 保護者情報 */}
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-bold text-sm text-gray-700 mb-4">保護者情報</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500">保護者名</label>
                      <p className="text-sm text-gray-800 mt-1">
                        {selectedChild.guardianName || '-'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500">続柄</label>
                      <p className="text-sm text-gray-800 mt-1">
                        {selectedChild.guardianRelationship || '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 受給者証情報 */}
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-bold text-sm text-gray-700 mb-4">受給者証情報</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500">受給者証番号</label>
                      <p className="text-sm text-gray-800 mt-1 font-mono">
                        {selectedChild.beneficiaryNumber || '-'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500">支給日数</label>
                      <p className="text-sm text-gray-800 mt-1">
                        {selectedChild.grantDays ? `${selectedChild.grantDays}日` : '-'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500">契約日数</label>
                      <p className="text-sm text-gray-800 mt-1">
                        {selectedChild.contractDays ? `${selectedChild.contractDays}日` : '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 連絡先 */}
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-bold text-sm text-gray-700 mb-4">連絡先</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500">住所</label>
                      <p className="text-sm text-gray-800 mt-1">
                        {selectedChild.address || '-'}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-500">電話番号</label>
                        <p className="text-sm text-gray-800 mt-1">
                          {selectedChild.phone || '-'}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500">メールアドレス</label>
                        <p className="text-sm text-gray-800 mt-1">
                          {selectedChild.email || '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 医療情報 */}
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-bold text-sm text-gray-700 mb-4">医療情報</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500">かかりつけ医名</label>
                      <p className="text-sm text-gray-800 mt-1">
                        {selectedChild.doctorName || '-'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500">医療機関名</label>
                      <p className="text-sm text-gray-800 mt-1">
                        {selectedChild.doctorClinic || '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 通園情報 */}
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-bold text-sm text-gray-700 mb-4">通園情報</h4>
                  <div>
                    <label className="text-xs font-bold text-gray-500">通園場所名</label>
                    <p className="text-sm text-gray-800 mt-1">
                      {selectedChild.schoolName || '-'}
                    </p>
                  </div>
                </div>

                {/* 利用パターン・送迎 */}
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-bold text-sm text-gray-700 mb-4">利用パターン・送迎</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500">基本利用パターン</label>
                      <p className="text-sm text-gray-800 mt-1">
                        {selectedChild.pattern || '-'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500">送迎</label>
                      <div className="mt-2 space-y-2">
                        {selectedChild.needsPickup && (
                          <div>
                            <span className="text-xs bg-[#e0f7fa] text-[#006064] px-2 py-1 rounded font-bold mr-2">
                              お迎え
                            </span>
                            <span className="text-sm text-gray-600">
                              {selectedChild.pickupLocation === 'その他' 
                                ? selectedChild.pickupLocationCustom || '（未入力）'
                                : selectedChild.pickupLocation || '（未入力）'}
                            </span>
                          </div>
                        )}
                        {selectedChild.needsDropoff && (
                          <div>
                            <span className="text-xs bg-[#e0f7fa] text-[#006064] px-2 py-1 rounded font-bold mr-2">
                              お送り
                            </span>
                            <span className="text-sm text-gray-600">
                              {selectedChild.dropoffLocation === 'その他'
                                ? selectedChild.dropoffLocationCustom || '（未入力）'
                                : selectedChild.dropoffLocation || '（未入力）'}
                            </span>
                          </div>
                        )}
                        {!selectedChild.needsPickup && !selectedChild.needsDropoff && (
                          <span className="text-sm text-gray-500">送迎なし</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 特性・メモ */}
                {selectedChild.characteristics && (
                  <div className="border-b border-gray-200 pb-4">
                    <h4 className="font-bold text-sm text-gray-700 mb-4">特性・メモ</h4>
                    <div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {selectedChild.characteristics}
                      </p>
                    </div>
                  </div>
                )}

                {/* リード案件 */}
                {(() => {
                  const relatedLeads = getLeadsByChildId(selectedChild.id);
                  if (relatedLeads.length > 0) {
                    const getStatusLabel = (status: string) => {
                      const labels: Record<string, { label: string; color: string }> = {
                        'new-inquiry': { label: '新規問い合わせ', color: 'bg-blue-100 text-blue-700' },
                        'visit-scheduled': { label: '見学/面談予定', color: 'bg-yellow-100 text-yellow-700' },
                        'considering': { label: '検討中', color: 'bg-orange-100 text-orange-700' },
                        'waiting-benefit': { label: '受給者証待ち', color: 'bg-purple-100 text-purple-700' },
                        'contract-progress': { label: '契約手続き中', color: 'bg-cyan-100 text-cyan-700' },
                        'contracted': { label: '契約済み', color: 'bg-green-100 text-green-700' },
                        'lost': { label: '失注', color: 'bg-red-100 text-red-700' },
                      };
                      return labels[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
                    };
                    return (
                      <div className="border-b border-gray-200 pb-4">
                        <h4 className="font-bold text-sm text-gray-700 mb-4 flex items-center">
                          <Target size={14} className="mr-2" />
                          関連リード案件
                        </h4>
                        <div className="space-y-2">
                          {relatedLeads.map((lead) => {
                            const statusInfo = getStatusLabel(lead.status);
                            return (
                              <button
                                key={lead.id}
                                onClick={() => {
                                  setIsDetailModalOpen(false);
                                  if (setActiveTab) {
                                    setActiveTab('lead');
                                  }
                                }}
                                className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors group"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="font-bold text-sm text-gray-800 mb-1">{lead.name}</div>
                                    <div className="flex items-center space-x-2">
                                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusInfo.color}`}>
                                        {statusInfo.label}
                                      </span>
                                    </div>
                                  </div>
                                  <ChevronRight size={16} className="text-gray-400 group-hover:text-[#00c4cc]" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* 契約情報 */}
                <div>
                  <h4 className="font-bold text-sm text-gray-700 mb-4">契約情報</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500">契約ステータス</label>
                      <div className="mt-1">
                        {(() => {
                          const statusInfo = getStatusLabel(selectedChild.contractStatus);
                          const StatusIcon = statusInfo.icon;
                          return (
                            <span
                              className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs font-bold ${statusInfo.color}`}
                            >
                              <StatusIcon size={12} />
                              <span>{statusInfo.label}</span>
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500">契約開始日</label>
                      <p className="text-sm text-gray-800 mt-1">
                        {selectedChild.contractStartDate || '-'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500">契約終了日</label>
                      <p className="text-sm text-gray-800 mt-1">
                        {selectedChild.contractEndDate || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* フッター */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md text-sm font-bold transition-colors"
              >
                閉じる
              </button>
              <button
                onClick={handleEditChild}
                className="px-6 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white rounded-md text-sm font-bold shadow-md transition-colors flex items-center space-x-2"
              >
                <Edit size={16} />
                <span>編集</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChildrenView;
