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
import { Child, ChildFormData, ContractStatus } from '@/types';
import { useFacilityData } from '@/hooks/useFacilityData';
import { saveDraft, getDrafts, deleteDraft, loadDraft } from '@/utils/draftStorage';

const ChildrenView: React.FC = () => {
  const { children, setChildren, addChild } = useFacilityData();
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
    age: undefined,
    guardianName: '',
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
    needsPickup: false,
    needsDropoff: false,
    pickupLocation: '',
    dropoffLocation: '',
    contractStatus: 'pre-contract',
    contractStartDate: '',
    contractEndDate: '',
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
  const handleSubmit = () => {
    if (!formData.name.trim()) {
      alert('児童名を入力してください');
      return;
    }

    // 編集モードの場合は更新
    if (selectedChild) {
      handleUpdateChild();
      return;
    }

    // 新規登録
    addChild(formData);

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
      setFormData({
        name: selectedChild.name,
        age: selectedChild.age,
        guardianName: selectedChild.guardianName,
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
        pattern: selectedChild.pattern,
        needsPickup: selectedChild.needsPickup,
        needsDropoff: selectedChild.needsDropoff,
        pickupLocation: selectedChild.pickupLocation,
        dropoffLocation: selectedChild.dropoffLocation,
        contractStatus: selectedChild.contractStatus,
        contractStartDate: selectedChild.contractStartDate,
        contractEndDate: selectedChild.contractEndDate,
      });
      setIsDetailModalOpen(false);
      setIsModalOpen(true);
    }
  };

  // 児童情報を更新
  const handleUpdateChild = () => {
    if (!selectedChild || !formData.name.trim()) {
      alert('児童名を入力してください');
      return;
    }

    const updatedChild: Child = {
      ...formData,
      id: selectedChild.id,
      facilityId: selectedChild.facilityId,
      createdAt: selectedChild.createdAt,
      updatedAt: new Date().toISOString(),
    };

    setChildren(children.map((c) => (c.id === selectedChild.id ? updatedChild : c)));
    setIsModalOpen(false);
    setFormData(initialFormData);
    setSelectedChild(null);
    alert('児童情報を更新しました');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-800">児童管理</h2>
          <p className="text-gray-500 text-xs mt-1">
            利用児童の台帳管理、受給者証情報の更新を行います。
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white px-4 py-2 rounded-md text-sm font-bold flex items-center shadow-sm transition-all"
        >
          <UserPlus size={16} className="mr-2" />
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
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4">氏名</th>
                <th className="px-6 py-4">年齢</th>
                <th className="px-6 py-4">保護者名</th>
                <th className="px-6 py-4">受給者証番号</th>
                <th className="px-6 py-4">契約ステータス</th>
                <th className="px-6 py-4">契約日数</th>
                <th className="px-6 py-4">送迎</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedChildren.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
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
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleOpenDetail(child)}
                          className="font-bold text-gray-800 group-hover:text-[#00c4cc] hover:underline transition-colors text-left"
                        >
                          {child.name}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {child.age ? `${child.age}歳` : '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {child.guardianName || '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-mono">
                        {child.beneficiaryNumber || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs font-bold ${statusInfo.color}`}
                        >
                          <StatusIcon size={12} />
                          <span>{statusInfo.label}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs border border-gray-200 font-medium">
                          {child.contractDays ? `${child.contractDays}日` : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        <div className="flex space-x-2">
                          {child.needsPickup && (
                            <span className="text-xs bg-[#e0f7fa] text-[#006064] px-2 py-0.5 rounded font-bold">
                              迎
                            </span>
                          )}
                          {child.needsDropoff && (
                            <span className="text-xs bg-[#e0f7fa] text-[#006064] px-2 py-0.5 rounded font-bold">
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
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-6">
                {/* 基本情報セクション */}
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-bold text-sm text-gray-700 mb-4">基本情報</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">
                        児童氏名 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                        placeholder="例: 山田 太郎"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">年齢</label>
                      <input
                        type="number"
                        min="0"
                        max="18"
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                        placeholder="例: 5"
                        value={formData.age || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            age: e.target.value ? parseInt(e.target.value) : undefined,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* 保護者情報セクション */}
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-bold text-sm text-gray-700 mb-4">保護者情報</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">
                        保護者名
                      </label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                        placeholder="例: 山田 花子"
                        value={formData.guardianName}
                        onChange={(e) =>
                          setFormData({ ...formData, guardianName: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">続柄</label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
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
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-bold text-sm text-gray-700 mb-4">受給者証情報</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">
                        受給者証番号
                      </label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc] font-mono"
                        placeholder="10桁の番号"
                        value={formData.beneficiaryNumber}
                        onChange={(e) =>
                          setFormData({ ...formData, beneficiaryNumber: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">
                        支給日数
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
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
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">
                        契約日数
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
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
                  </div>
                </div>

                {/* 連絡先セクション */}
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-bold text-sm text-gray-700 mb-4">連絡先</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">住所</label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                        placeholder="例: 東京都渋谷区..."
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-bold text-sm text-gray-700 mb-4">医療情報</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-bold text-sm text-gray-700 mb-4">通園情報</h4>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">
                      通園場所名
                    </label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                      placeholder="例: 〇〇小学校、〇〇幼稚園"
                      value={formData.schoolName}
                      onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                    />
                  </div>
                </div>

                {/* 利用パターン・送迎セクション */}
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-bold text-sm text-gray-700 mb-4">利用パターン・送迎</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">
                        基本利用パターン
                      </label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                        placeholder="例: 月・水・金"
                        value={formData.pattern}
                        onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                      />
                    </div>
                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200 space-y-4">
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
                          <span className="text-sm text-gray-700 group-hover:text-gray-900 font-bold">
                            お迎え
                          </span>
                        </label>
                        {formData.needsPickup && (
                          <div className="ml-7">
                            <label className="block text-xs font-bold text-gray-500 mb-1.5">
                              乗車地
                            </label>
                            <input
                              type="text"
                              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
                              placeholder="例: 〇〇小学校正門、〇〇幼稚園"
                              value={formData.pickupLocation || ''}
                              onChange={(e) =>
                                setFormData({ ...formData, pickupLocation: e.target.value })
                              }
                            />
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
                          <span className="text-sm text-gray-700 group-hover:text-gray-900 font-bold">
                            お送り
                          </span>
                        </label>
                        {formData.needsDropoff && (
                          <div className="ml-7">
                            <label className="block text-xs font-bold text-gray-500 mb-1.5">
                              降車地
                            </label>
                            <input
                              type="text"
                              className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-[#00c4cc]"
                              placeholder="例: 自宅、〇〇アパート前"
                              value={formData.dropoffLocation || ''}
                              onChange={(e) =>
                                setFormData({ ...formData, dropoffLocation: e.target.value })
                              }
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 契約情報セクション */}
                <div>
                  <h4 className="font-bold text-sm text-gray-700 mb-4">契約情報</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">
                        契約ステータス
                      </label>
                      <select
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                        value={formData.contractStatus}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contractStatus: e.target.value as ContractStatus,
                          })
                        }
                      >
                        <option value="pre-contract">契約前</option>
                        <option value="active">契約中</option>
                        <option value="inactive">休止中</option>
                        <option value="terminated">解約</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">
                        契約開始日
                      </label>
                      <input
                        type="date"
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                        value={formData.contractStartDate}
                        onChange={(e) =>
                          setFormData({ ...formData, contractStartDate: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">
                        契約終了日
                      </label>
                      <input
                        type="date"
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                        value={formData.contractEndDate}
                        onChange={(e) =>
                          setFormData({ ...formData, contractEndDate: e.target.value })
                        }
                      />
                    </div>
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
                      <label className="text-xs font-bold text-gray-500">年齢</label>
                      <p className="text-sm text-gray-800 mt-1">
                        {selectedChild.age ? `${selectedChild.age}歳` : '-'}
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
                            {selectedChild.pickupLocation && (
                              <span className="text-sm text-gray-600">
                                ({selectedChild.pickupLocation})
                              </span>
                            )}
                          </div>
                        )}
                        {selectedChild.needsDropoff && (
                          <div>
                            <span className="text-xs bg-[#e0f7fa] text-[#006064] px-2 py-1 rounded font-bold mr-2">
                              お送り
                            </span>
                            {selectedChild.dropoffLocation && (
                              <span className="text-sm text-gray-600">
                                ({selectedChild.dropoffLocation})
                              </span>
                            )}
                          </div>
                        )}
                        {!selectedChild.needsPickup && !selectedChild.needsDropoff && (
                          <span className="text-sm text-gray-500">送迎なし</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

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
