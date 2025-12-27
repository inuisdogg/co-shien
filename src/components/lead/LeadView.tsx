/**
 * リード管理ビュー（カンバンスタイル）
 */

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  X,
  Edit,
  Trash2,
  User,
  Phone,
  Mail,
  Calendar,
  FileText,
  ChevronRight,
  MoreVertical,
  CheckCircle,
} from 'lucide-react';
import { Lead, LeadStatus, LeadFormData, Child, PreferenceOption } from '@/types';
import { useFacilityData } from '@/hooks/useFacilityData';

interface LeadViewProps {
  setActiveTab?: (tab: string) => void;
}

const LeadView: React.FC<LeadViewProps> = ({ setActiveTab }) => {
  const { leads, children, addLead, updateLead, deleteLead } = useFacilityData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedChildForDetail, setSelectedChildForDetail] = useState<Child | null>(null);
  const [isChildDetailModalOpen, setIsChildDetailModalOpen] = useState(false);
  const [actionMenuLeadId, setActionMenuLeadId] = useState<string | null>(null);
  const [isStatusChangeModalOpen, setIsStatusChangeModalOpen] = useState(false);
  const [leadForStatusChange, setLeadForStatusChange] = useState<Lead | null>(null);

  // 曜日の配列
  const daysOfWeek = ['月', '火', '水', '木', '金', '土', '日'];

  // フォームの初期値
  const initialFormData: LeadFormData = {
    name: '',
    childName: '',
    status: 'new-inquiry',
    phone: '',
    email: '',
    address: '',
    expectedStartDate: '',
    preferredDays: [],
    pickupOption: 'required',
    inquirySource: undefined,
    inquirySourceDetail: '',
    childIds: [],
    memo: '',
  };

  const [formData, setFormData] = useState<LeadFormData>(initialFormData);

  // ステータスごとにリードを分類
  const leadsByStatus = useMemo(() => {
    const statusOrder: LeadStatus[] = ['new-inquiry', 'visit-scheduled', 'considering', 'waiting-benefit', 'contract-progress', 'contracted', 'lost'];
    const grouped: Record<LeadStatus, Lead[]> = {
      'new-inquiry': [],
      'visit-scheduled': [],
      'considering': [],
      'waiting-benefit': [],
      'contract-progress': [],
      'contracted': [],
      'lost': [],
    };

    leads.forEach((lead) => {
      grouped[lead.status].push(lead);
    });

    // 各ステータス内で作成日時でソート
    statusOrder.forEach((status) => {
      grouped[status].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });

    return grouped;
  }, [leads]);

  // ステータスラベル
  const getStatusLabel = (status: LeadStatus) => {
    const labels = {
      'new-inquiry': { label: '新規問い合わせ', color: 'bg-blue-100 text-blue-700' },
      'visit-scheduled': { label: '見学/面談予定', color: 'bg-yellow-100 text-yellow-700' },
      'considering': { label: '検討中', color: 'bg-orange-100 text-orange-700' },
      'waiting-benefit': { label: '受給者証待ち', color: 'bg-purple-100 text-purple-700' },
      'contract-progress': { label: '契約手続き中', color: 'bg-cyan-100 text-cyan-700' },
      'contracted': { label: '契約済み', color: 'bg-green-100 text-green-700' },
      'lost': { label: '失注', color: 'bg-red-100 text-red-700' },
    };
    return labels[status];
  };

  // モーダルを開く
  const handleOpenModal = (lead?: Lead) => {
    if (lead) {
      setSelectedLead(lead);
      setFormData({
        name: lead.name,
        childName: lead.childName || '',
        status: lead.status,
        phone: lead.phone || '',
        email: lead.email || '',
        address: lead.address || '',
        expectedStartDate: lead.expectedStartDate || '',
        preferredDays: lead.preferredDays || [],
        pickupOption: lead.pickupOption || 'required',
        inquirySource: lead.inquirySource,
        inquirySourceDetail: lead.inquirySourceDetail || '',
        childIds: lead.childIds,
        memo: lead.memo || '',
      });
    } else {
      setSelectedLead(null);
      setFormData(initialFormData);
    }
    setIsModalOpen(true);
  };

  // モーダルを閉じる
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedLead(null);
    setFormData(initialFormData);
  };

  // フォーム送信
  const handleSubmit = () => {
    if (!formData.name.trim()) {
      alert('リード名を入力してください');
      return;
    }

    if (selectedLead) {
      updateLead(selectedLead.id, formData);
    } else {
      addLead(formData);
    }

    handleCloseModal();
    alert(selectedLead ? 'リードを更新しました' : 'リードを登録しました');
  };

  // ステータス変更
  const handleStatusChange = (leadId: string, newStatus: LeadStatus) => {
    updateLead(leadId, { status: newStatus });
  };

  // リード削除
  const handleDeleteLead = (leadId: string) => {
    if (confirm('このリードを削除しますか？')) {
      deleteLead(leadId);
    }
  };

  // 児童詳細を開く
  const handleOpenChildDetail = (childId: string) => {
    const child = children.find((c) => c.id === childId);
    if (child) {
      setSelectedChildForDetail(child);
      setIsChildDetailModalOpen(true);
    }
  };

  // 児童管理画面に移動
  const handleGoToChildren = (childId?: string) => {
    if (setActiveTab) {
      setActiveTab('children');
    }
  };

  // 関連児童を取得
  const getRelatedChildren = (childIds: string[]) => {
    return children.filter((c) => childIds.includes(c.id));
  };

  // 背景クリックでメニューを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionMenuLeadId) {
        setActionMenuLeadId(null);
      }
    };
    if (actionMenuLeadId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [actionMenuLeadId]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ヘッダー */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-800">リード管理</h2>
          <p className="text-gray-500 text-xs mt-1">
            問い合わせから契約までのリードをカンバン形式で管理します。
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white px-4 py-2 rounded-md text-sm font-bold flex items-center shadow-sm transition-all"
        >
          <Plus size={16} className="mr-2" />
          新規リード登録
        </button>
      </div>

      {/* カンバンボード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
        {(['new-inquiry', 'visit-scheduled', 'considering', 'waiting-benefit', 'contract-progress', 'contracted', 'lost'] as LeadStatus[]).map((status) => {
          const statusInfo = getStatusLabel(status);
          const statusLeads = leadsByStatus[status];

          return (
            <div key={status} className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded text-xs font-bold ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                  <span className="text-xs text-gray-500 font-bold">({statusLeads.length})</span>
                </div>
              </div>

              <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                {statusLeads.length === 0 ? (
                  <div className="text-center text-gray-400 text-xs py-8">
                    リードがありません
                  </div>
                ) : (
                  statusLeads.map((lead) => {
                    const relatedChildren = getRelatedChildren(lead.childIds);
                    const preferredDaysText = lead.preferredDays && lead.preferredDays.length > 0
                      ? lead.preferredDays.join('・')
                      : '';
                    return (
                      <div
                        key={lead.id}
                        className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow relative"
                      >
                        {/* アクションメニュー */}
                        {actionMenuLeadId === lead.id && (
                          <div 
                            className="absolute top-2 right-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[140px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                handleOpenModal(lead);
                                setActionMenuLeadId(null);
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center space-x-2"
                            >
                              <Edit size={12} />
                              <span>情報編集</span>
                            </button>
                            <button
                              onClick={() => {
                                setLeadForStatusChange(lead);
                                setIsStatusChangeModalOpen(true);
                                setActionMenuLeadId(null);
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center space-x-2"
                            >
                              <CheckCircle size={12} />
                              <span>ステータス変更</span>
                            </button>
                            <button
                              onClick={() => {
                                handleDeleteLead(lead.id);
                                setActionMenuLeadId(null);
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center space-x-2 text-red-600"
                            >
                              <Trash2 size={12} />
                              <span>削除</span>
                            </button>
                          </div>
                        )}

                        {/* 1行目: 名前とアクションボタン */}
                        <div className="flex items-center justify-between mb-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionMenuLeadId(actionMenuLeadId === lead.id ? null : lead.id);
                            }}
                            className="flex-1 text-left font-bold text-sm text-gray-800 hover:text-[#00c4cc] transition-colors"
                          >
                            {lead.name}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionMenuLeadId(actionMenuLeadId === lead.id ? null : lead.id);
                            }}
                            className="text-gray-400 hover:text-gray-600 transition-colors ml-2"
                          >
                            <MoreVertical size={16} />
                          </button>
                        </div>

                        {/* 2行目: 利用希望日と送迎 */}
                        <div className="flex items-center justify-between text-xs mb-2">
                          <div className="flex-1">
                            {preferredDaysText && (
                              <span className="text-gray-700 font-bold">{preferredDaysText}</span>
                            )}
                            {!preferredDaysText && (
                              <span className="text-gray-400">利用希望日未設定</span>
                            )}
                          </div>
                          <div className="ml-2">
                            {lead.pickupOption && (
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                lead.pickupOption === 'required' ? 'bg-red-100 text-red-700' :
                                lead.pickupOption === 'preferred' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {lead.pickupOption === 'required' ? '送迎必須' :
                                 lead.pickupOption === 'preferred' ? '送迎希望' : '送迎不要'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 関連児童（折りたたみ可能） */}
                        {relatedChildren.length > 0 && (
                          <div className="border-t border-gray-200 pt-2 mt-2">
                            <div className="text-xs font-bold text-gray-500 mb-1">関連児童: {relatedChildren.length}名</div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* リード登録・編集モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] shadow-2xl border border-gray-100 my-8">
            {/* ヘッダー */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-gray-800">
                  {selectedLead ? 'リード編集' : '新規リード登録'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* フォーム本体 */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-6">
                {/* 基本情報 */}
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-bold text-sm text-gray-700 mb-4">基本情報</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">
                        リード名 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc] focus:ring-1 focus:ring-[#00c4cc]"
                        placeholder="例: 田中 花子"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">児童名</label>
                      <input
                        type="text"
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                        placeholder="例: 田中 太郎"
                        value={formData.childName}
                        onChange={(e) => setFormData({ ...formData, childName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">ステータス</label>
                        <select
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as LeadStatus })}
                      >
                        <option value="new-inquiry">新規問い合わせ</option>
                        <option value="visit-scheduled">見学/面談予定</option>
                        <option value="considering">検討中</option>
                        <option value="waiting-benefit">受給者証待ち</option>
                        <option value="contract-progress">契約手続き中</option>
                        <option value="contracted">契約済み</option>
                        <option value="lost">失注</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 連絡先 */}
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-bold text-sm text-gray-700 mb-4">連絡先</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">電話番号</label>
                      <input
                        type="tel"
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                        placeholder="例: 03-1234-5678"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">メールアドレス</label>
                      <input
                        type="email"
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                        placeholder="example@email.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
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
                  </div>
                </div>

                {/* 見込み情報 */}
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-bold text-sm text-gray-700 mb-4">見込み情報</h4>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">見込み開始日</label>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                      value={formData.expectedStartDate}
                      onChange={(e) => setFormData({ ...formData, expectedStartDate: e.target.value })}
                    />
                  </div>
                </div>

                {/* 問い合わせ経路 */}
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-bold text-sm text-gray-700 mb-4">問い合わせ経路</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">経路</label>
                      <select
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                        value={formData.inquirySource || ''}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          inquirySource: e.target.value ? (e.target.value as 'devnavi' | 'homepage' | 'support-office' | 'other') : undefined,
                          inquirySourceDetail: e.target.value !== 'support-office' && e.target.value !== 'other' ? '' : formData.inquirySourceDetail
                        })}
                      >
                        <option value="">選択してください</option>
                        <option value="devnavi">発達ナビ</option>
                        <option value="homepage">ホームページ</option>
                        <option value="support-office">相談支援事業所</option>
                        <option value="other">その他</option>
                      </select>
                    </div>
                    {(formData.inquirySource === 'support-office' || formData.inquirySource === 'other') && (
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">
                          {formData.inquirySource === 'support-office' ? '相談支援事業所名' : '詳細'}
                        </label>
                        <input
                          type="text"
                          className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                          placeholder={formData.inquirySource === 'support-office' ? '例: 〇〇相談支援事業所' : '詳細を入力'}
                          value={formData.inquirySourceDetail}
                          onChange={(e) => setFormData({ ...formData, inquirySourceDetail: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 利用希望 */}
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-bold text-sm text-gray-700 mb-4">利用希望</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2">利用希望曜日</label>
                      <div className="flex flex-wrap gap-2">
                        {daysOfWeek.map((day) => (
                          <label
                            key={day}
                            className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={formData.preferredDays?.includes(day) || false}
                              onChange={(e) => {
                                const currentDays = formData.preferredDays || [];
                                if (e.target.checked) {
                                  setFormData({ ...formData, preferredDays: [...currentDays, day] });
                                } else {
                                  setFormData({ ...formData, preferredDays: currentDays.filter((d) => d !== day) });
                                }
                              }}
                              className="accent-[#00c4cc]"
                            />
                            <span className="text-sm text-gray-700 font-bold">{day}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">送迎</label>
                      <select
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                        value={formData.pickupOption}
                        onChange={(e) => setFormData({ ...formData, pickupOption: e.target.value as PreferenceOption })}
                      >
                        <option value="required">必須</option>
                        <option value="preferred">あれば使いたい</option>
                        <option value="not-needed">不要</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 関連児童 */}
                <div className="border-b border-gray-200 pb-4">
                  <h4 className="font-bold text-sm text-gray-700 mb-4">関連児童</h4>
                  <div className="space-y-2">
                    {children.length === 0 ? (
                      <p className="text-xs text-gray-500">登録されている児童がありません</p>
                    ) : (
                      children.map((child) => (
                        <label
                          key={child.id}
                          className="flex items-center space-x-2 p-2 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formData.childIds.includes(child.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  childIds: [...formData.childIds, child.id],
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  childIds: formData.childIds.filter((id) => id !== child.id),
                                });
                              }
                            }}
                            className="accent-[#00c4cc]"
                          />
                          <span className="text-sm text-gray-700 font-bold">{child.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                  <button
                    onClick={() => handleGoToChildren()}
                    className="mt-2 text-xs text-[#00c4cc] hover:text-[#00b0b8] font-bold flex items-center"
                  >
                    児童管理で新規登録
                    <ChevronRight size={12} className="ml-1" />
                  </button>
                </div>

                {/* メモ */}
                <div>
                  <h4 className="font-bold text-sm text-gray-700 mb-4">メモ</h4>
                  <textarea
                    className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc] h-24 resize-none"
                    placeholder="メモを入力..."
                    value={formData.memo}
                    onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* フッター */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
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
                {selectedLead ? '更新' : '登録'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ステータス変更モーダル */}
      {isStatusChangeModalOpen && leadForStatusChange && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md shadow-2xl border border-gray-100">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
              <h3 className="font-bold text-lg text-gray-800">ステータス変更</h3>
              <button
                onClick={() => {
                  setIsStatusChangeModalOpen(false);
                  setLeadForStatusChange(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">リード名: <span className="font-bold text-gray-800">{leadForStatusChange.name}</span></p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">新しいステータス</label>
                <select
                  className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:outline-none focus:border-[#00c4cc]"
                  value={leadForStatusChange.status}
                  onChange={(e) => {
                    handleStatusChange(leadForStatusChange.id, e.target.value as LeadStatus);
                    setIsStatusChangeModalOpen(false);
                    setLeadForStatusChange(null);
                  }}
                >
                  <option value="new-inquiry">新規問い合わせ</option>
                  <option value="visit-scheduled">見学/面談予定</option>
                  <option value="considering">検討中</option>
                  <option value="waiting-benefit">受給者証待ち</option>
                  <option value="contract-progress">契約手続き中</option>
                  <option value="contracted">契約済み</option>
                  <option value="lost">失注</option>
                </select>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setIsStatusChangeModalOpen(false);
                  setLeadForStatusChange(null);
                }}
                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md text-sm font-bold transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 児童詳細モーダル */}
      {isChildDetailModalOpen && selectedChildForDetail && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] shadow-2xl border border-gray-100 my-8">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
              <h3 className="font-bold text-lg text-gray-800">児童詳細情報</h3>
              <button
                onClick={() => setIsChildDetailModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500">児童名</label>
                  <p className="text-sm text-gray-800 mt-1 font-bold">{selectedChildForDetail.name}</p>
                </div>
                {selectedChildForDetail.age && (
                  <div>
                    <label className="text-xs font-bold text-gray-500">年齢</label>
                    <p className="text-sm text-gray-800 mt-1">{selectedChildForDetail.age}歳</p>
                  </div>
                )}
                {selectedChildForDetail.guardianName && (
                  <div>
                    <label className="text-xs font-bold text-gray-500">保護者名</label>
                    <p className="text-sm text-gray-800 mt-1">{selectedChildForDetail.guardianName}</p>
                  </div>
                )}
                {selectedChildForDetail.phone && (
                  <div>
                    <label className="text-xs font-bold text-gray-500">電話番号</label>
                    <p className="text-sm text-gray-800 mt-1">{selectedChildForDetail.phone}</p>
                  </div>
                )}
                {selectedChildForDetail.email && (
                  <div>
                    <label className="text-xs font-bold text-gray-500">メールアドレス</label>
                    <p className="text-sm text-gray-800 mt-1">{selectedChildForDetail.email}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={() => setIsChildDetailModalOpen(false)}
                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md text-sm font-bold transition-colors"
              >
                閉じる
              </button>
              <button
                onClick={() => {
                  setIsChildDetailModalOpen(false);
                  handleGoToChildren(selectedChildForDetail.id);
                }}
                className="px-6 py-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white rounded-md text-sm font-bold shadow-md transition-colors"
              >
                児童管理で詳細確認
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadView;

