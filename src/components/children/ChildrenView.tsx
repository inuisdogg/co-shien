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
  Mail,
  BookOpen,
  CalendarDays,
  UserCheck,
  FileWarning,
  Truck,
  MapPin,
  Search,
  Users,
} from 'lucide-react';
import { Child, ChildFormData, ContractStatus, Lead, FacilityIntakeData } from '@/types';
import { useFacilityData } from '@/hooks/useFacilityData';
import { saveDraft, getDrafts, deleteDraft, loadDraft } from '@/utils/draftStorage';
import { calculateAgeWithMonths } from '@/utils/ageCalculation';
import { Target, ChevronRight, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ChildRegistrationWizard from './ChildRegistrationWizard';
import FacilitySettingsEditor from './FacilitySettingsEditor';
import ChildDocumentsManager from './ChildDocumentsManager';
import InvitationModal from '@/components/common/InvitationModal';
import AlertModal from '@/components/common/AlertModal';
import ConfirmModal from '@/components/common/ConfirmModal';

interface ChildrenViewProps {
  setActiveTab?: (tab: string) => void;
}

// 招待枠の型定義
type PendingInvitation = {
  id: string;
  facility_id: string;
  temp_child_name: string;
  temp_child_name_kana?: string;
  email: string;
  invitation_token: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expires_at: string;
  invited_by: string;
  child_id?: string;
  created_at: string;
};

// 児童ごとの招待ステータス
type ChildInvitationStatus = {
  childId: string;
  status: 'pending' | 'accepted' | 'expired' | 'none';
  email?: string;
};

const ChildrenView: React.FC<ChildrenViewProps> = ({ setActiveTab }) => {
  const { facility } = useAuth();
  const { children, addChild, updateChild, getLeadsByChildId, timeSlots, facilitySettings } = useFacilityData();

  // 時間枠の名前を取得
  const slotInfo = useMemo(() => {
    if (timeSlots.length >= 2) {
      const sorted = [...timeSlots].sort((a, b) => a.displayOrder - b.displayOrder);
      return {
        AM: sorted[0]?.name || '午前',
        PM: sorted[1]?.name || '午後',
      };
    } else if (timeSlots.length === 1) {
      return {
        AM: timeSlots[0].name || '終日',
        PM: null,
      };
    }
    return { AM: '午前', PM: '午後' };
  }, [timeSlots]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<'user' | 'facility'>('user');
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [sortStatus, setSortStatus] = useState<ContractStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [drafts, setDrafts] = useState<ChildFormData[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<string | null>(null);
  const [isInvitationModalOpen, setIsInvitationModalOpen] = useState(false);
  const [invitationEmail, setInvitationEmail] = useState('');
  const [sendingInvitation, setSendingInvitation] = useState(false);

  // ウィザード・施設設定用の状態
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<'create' | 'edit'>('create');
  const [isFacilitySettingsOpen, setIsFacilitySettingsOpen] = useState(false);
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false);

  // アラート・確認モーダル用の状態
  const [alertModal, setAlertModal] = useState<{ message: string; type?: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // 招待枠作成モーダル用の状態
  const [isInvitationSlotModalOpen, setIsInvitationSlotModalOpen] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [childInvitationStatuses, setChildInvitationStatuses] = useState<Record<string, ChildInvitationStatus>>({});

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
    pickupAddress: '',
    pickupPostalCode: '',
    dropoffLocation: '',
    dropoffLocationCustom: '',
    dropoffAddress: '',
    dropoffPostalCode: '',
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

  // 招待枠一覧を取得
  useEffect(() => {
    const fetchPendingInvitations = async () => {
      try {
        // 現在のユーザーの施設IDを取得
        const facilityId = localStorage.getItem('selectedFacilityId');
        if (!facilityId) return;

        const { data, error } = await supabase
          .from('contract_invitations')
          .select('*')
          .eq('facility_id', facilityId)
          .eq('status', 'pending')
          .not('temp_child_name', 'is', null)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching pending invitations:', error);
          return;
        }

        setPendingInvitations(data || []);
      } catch (error) {
        console.error('Error fetching pending invitations:', error);
      }
    };

    fetchPendingInvitations();
  }, []);

  // 児童ごとの招待ステータスを取得
  useEffect(() => {
    const fetchChildInvitationStatuses = async () => {
      const facilityId = localStorage.getItem('selectedFacilityId');
      if (!facilityId || children.length === 0) return;

      try {
        const { data, error } = await supabase
          .from('contract_invitations')
          .select('child_id, status, email, expires_at')
          .eq('facility_id', facilityId)
          .in('status', ['pending', 'accepted'])
          .not('child_id', 'is', null)
          .order('created_at', { ascending: false });

        if (error || !data) return;

        const statusMap: Record<string, ChildInvitationStatus> = {};
        for (const inv of data) {
          if (!inv.child_id || statusMap[inv.child_id]) continue;
          const isExpired = inv.status === 'pending' && new Date(inv.expires_at) < new Date();
          statusMap[inv.child_id] = {
            childId: inv.child_id,
            status: isExpired ? 'expired' : (inv.status as 'pending' | 'accepted'),
            email: inv.email,
          };
        }
        setChildInvitationStatuses(statusMap);
      } catch {
        // silently fail
      }
    };

    fetchChildInvitationStatuses();
  }, [children]);

  // 招待送信完了時のコールバック
  const handleInvitationSent = (invitation: any) => {
    setPendingInvitations(prev => [invitation, ...prev]);
    // 児童の招待ステータスも更新
    if (invitation.child_id) {
      setChildInvitationStatuses(prev => ({
        ...prev,
        [invitation.child_id]: {
          childId: invitation.child_id,
          status: 'pending',
          email: invitation.email,
        },
      }));
    }
  };

  // 契約ステータスをインライン更新する関数
  const handleQuickUpdateContractStatus = async (childId: string, newStatus: ContractStatus) => {
    try {
      const { error } = await supabase
        .from('children')
        .update({
          contract_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', childId);

      if (error) throw error;

      // ローカルの状態も更新
      if (selectedChild && selectedChild.id === childId) {
        setSelectedChild({ ...selectedChild, contractStatus: newStatus });
      }

      // リストの再取得（useFacilityDataから）
      window.location.reload(); // 簡易的なリロード
    } catch (error: any) {
      console.error('契約ステータス更新エラー:', error);
      setAlertModal({ message: '契約ステータスの更新に失敗しました: ' + error.message, type: 'error' });
    }
  };

  // 契約日付をインライン更新する関数
  const handleQuickUpdateContractDate = async (childId: string, field: 'contract_start_date' | 'contract_end_date', value: string) => {
    try {
      const { error } = await supabase
        .from('children')
        .update({
          [field]: value || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', childId);

      if (error) throw error;

      // ローカルの状態も更新
      if (selectedChild && selectedChild.id === childId) {
        const updatedChild = { ...selectedChild };
        if (field === 'contract_start_date') {
          updatedChild.contractStartDate = value;
        } else {
          updatedChild.contractEndDate = value;
        }
        setSelectedChild(updatedChild);
      }
    } catch (error: any) {
      console.error('契約日付更新エラー:', error);
      setAlertModal({ message: '契約日付の更新に失敗しました: ' + error.message, type: 'error' });
    }
  };

  // 利用パターンをインライン更新する関数
  const handleQuickUpdatePattern = async (
    childId: string,
    dayIndex: number,
    isChecked: boolean,
    timeSlot: 'AM' | 'PM' | 'AMPM'
  ) => {
    if (!selectedChild) return;

    try {
      const currentDays = selectedChild.patternDays || [];
      const currentTimeSlots = selectedChild.patternTimeSlots || {};

      // 新しいpatternDaysを計算
      let newDays: number[];
      const newTimeSlots = { ...currentTimeSlots };

      if (isChecked) {
        newDays = [...currentDays, dayIndex].sort((a, b) => a - b);
        newTimeSlots[dayIndex] = timeSlot;
      } else {
        newDays = currentDays.filter(d => d !== dayIndex);
        delete newTimeSlots[dayIndex];
      }

      // パターン文字列も更新（後方互換性のため）
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      const pattern = newDays.map(d => dayNames[d]).join('・');

      const { error } = await supabase
        .from('children')
        .update({
          pattern_days: newDays,
          pattern_time_slots: newTimeSlots,
          pattern: pattern,
          updated_at: new Date().toISOString()
        })
        .eq('id', childId)
        .select();

      if (error) throw error;

      // ローカルの状態も更新
      setSelectedChild({
        ...selectedChild,
        patternDays: newDays,
        patternTimeSlots: newTimeSlots,
        pattern: pattern,
      });
    } catch (error: any) {
      console.error('利用パターン更新エラー:', error);
      setAlertModal({ message: '利用パターンの更新に失敗しました: ' + error.message, type: 'error' });
    }
  };

  // 利用パターンの時間帯のみを更新する関数
  const handleQuickUpdateTimeSlot = async (
    childId: string,
    dayIndex: number,
    timeSlot: 'AM' | 'PM' | 'AMPM'
  ) => {
    if (!selectedChild) return;

    try {
      const newTimeSlots = {
        ...selectedChild.patternTimeSlots,
        [dayIndex]: timeSlot,
      };

      const { error } = await supabase
        .from('children')
        .update({
          pattern_time_slots: newTimeSlots,
          updated_at: new Date().toISOString()
        })
        .eq('id', childId);

      if (error) throw error;

      // ローカルの状態も更新
      setSelectedChild({
        ...selectedChild,
        patternTimeSlots: newTimeSlots,
      });
    } catch (error: any) {
      console.error('時間帯更新エラー:', error);
      setAlertModal({ message: '時間帯の更新に失敗しました: ' + error.message, type: 'error' });
    }
  };

  // 送迎設定を更新する関数
  const handleUpdateTransport = async (
    childId: string,
    updates: {
      needsPickup?: boolean;
      needsDropoff?: boolean;
      pickupLocation?: string;
      pickupAddress?: string;
      dropoffLocation?: string;
      dropoffAddress?: string;
    }
  ) => {
    if (!selectedChild) return;

    try {
      const dbUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      };

      if (updates.needsPickup !== undefined) dbUpdates.needs_pickup = updates.needsPickup;
      if (updates.needsDropoff !== undefined) dbUpdates.needs_dropoff = updates.needsDropoff;
      if (updates.pickupLocation !== undefined) dbUpdates.pickup_location = updates.pickupLocation;
      if (updates.pickupAddress !== undefined) dbUpdates.pickup_address = updates.pickupAddress;
      if (updates.dropoffLocation !== undefined) dbUpdates.dropoff_location = updates.dropoffLocation;
      if (updates.dropoffAddress !== undefined) dbUpdates.dropoff_address = updates.dropoffAddress;

      const { error } = await supabase
        .from('children')
        .update(dbUpdates)
        .eq('id', childId);

      if (error) throw error;

      // ローカルの状態も更新
      setSelectedChild({
        ...selectedChild,
        ...updates,
      });
    } catch (error: any) {
      console.error('送迎設定更新エラー:', error);
      setAlertModal({ message: '送迎設定の更新に失敗しました: ' + error.message, type: 'error' });
    }
  };

  // 招待をキャンセルする関数
  const handleCancelInvitation = (invitationId: string) => {
    setConfirmModal({
      message: 'この招待をキャンセルしますか？',
      onConfirm: () => {
        setConfirmModal(null);
        performCancelInvitation(invitationId);
      },
    });
  };

  const performCancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('contract_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId);

      if (error) throw error;

      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      setAlertModal({ message: '招待をキャンセルしました', type: 'success' });
    } catch (error: any) {
      console.error('招待キャンセルエラー:', error);
      setAlertModal({ message: '招待のキャンセルに失敗しました', type: 'error' });
    }
  };

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
      setAlertModal({ message: '児童名を入力してください', type: 'warning' });
      return;
    }
    saveDraft(formData);
    setDrafts(getDrafts());
    setAlertModal({ message: '下書きを保存しました', type: 'success' });
  };

  // フォーム送信
  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setAlertModal({ message: '児童名を入力してください', type: 'warning' });
      return;
    }

    if (!formData.birthDate) {
      setAlertModal({ message: '生年月日を入力してください', type: 'warning' });
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
      setAlertModal({ message: '児童を登録しました', type: 'success' });
    } catch (error) {
      console.error('Error adding child:', error);
      setAlertModal({ message: '児童の登録に失敗しました', type: 'error' });
    }
  };

  // モーダルを開く（従来のフォーム - 下書き用に残す）
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

  // ウィザードを開く（新規登録）
  const handleOpenWizard = () => {
    setSelectedChild(null);
    setWizardMode('create');
    setIsWizardOpen(true);
  };

  // ウィザードを開く（編集）
  const handleEditWithWizard = (child: Child) => {
    setSelectedChild(child);
    setWizardMode('edit');
    setIsWizardOpen(true);
  };

  // ウィザード完了時の処理
  const handleWizardComplete = async (data: ChildFormData) => {
    if (wizardMode === 'create') {
      await addChild(data);
      setAlertModal({ message: '児童を登録しました', type: 'success' });
    } else if (selectedChild) {
      await updateChild({ ...selectedChild, ...data });
      setAlertModal({ message: '児童情報を更新しました', type: 'success' });
    }
    setIsWizardOpen(false);
    setSelectedChild(null);
  };

  // 施設別設定を開く
  const handleOpenFacilitySettings = () => {
    if (selectedChild && facility?.id) {
      setIsFacilitySettingsOpen(true);
    }
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

  // ソート済み児童リスト（検索対応）
  const sortedChildren = useMemo(() => {
    let filtered = children;
    if (sortStatus !== 'all') {
      filtered = children.filter((child) => child.contractStatus === sortStatus);
    }
    // 検索フィルタ
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((child) =>
        child.name.toLowerCase().includes(q) ||
        (child.nameKana && child.nameKana.toLowerCase().includes(q)) ||
        (child.guardianName && child.guardianName.toLowerCase().includes(q)) ||
        (child.beneficiaryNumber && child.beneficiaryNumber.includes(q))
      );
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
  }, [children, sortStatus, searchQuery]);

  // 児童詳細を開く
  const handleOpenDetail = (child: Child) => {
    setSelectedChild(child);
    setIsEditMode(false);
    // デフォルトはユーザー情報タブ
    setDetailTab('user');
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
        pickupAddress: selectedChild.pickupAddress || '',
        pickupPostalCode: selectedChild.pickupPostalCode || '',
        dropoffLocation: selectedChild.dropoffLocation || '',
        dropoffLocationCustom: selectedChild.dropoffLocationCustom || '',
        dropoffAddress: selectedChild.dropoffAddress || '',
        dropoffPostalCode: selectedChild.dropoffPostalCode || '',
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
      {/* ヘッダー: 新規登録ボタンを目立たせる */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">児童管理</h2>
              <p className="text-gray-500 text-xs sm:text-sm mt-1">
                利用児童 <span className="font-bold text-gray-700">{children.length}</span> 名の台帳管理
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => setIsInvitationSlotModalOpen(true)}
                className="bg-white hover:bg-orange-50 text-orange-600 border border-orange-300 px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold flex items-center shadow-sm transition-all flex-1 sm:flex-none justify-center"
              >
                <Mail size={16} className="mr-2 shrink-0" />
                利用者招待
              </button>
              <button
                data-tour="add-child-button"
                onClick={handleOpenWizard}
                className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white px-4 sm:px-6 py-2.5 rounded-lg text-xs sm:text-sm font-bold flex items-center shadow-md hover:shadow-lg transition-all flex-1 sm:flex-none justify-center"
              >
                <UserPlus size={16} className="mr-2 shrink-0" />
                児童を新規登録
              </button>
            </div>
          </div>
        </div>
        {/* 登録方法の案内 - 児童が少ない場合のみ */}
        {children.length < 5 && (
          <div className="bg-gray-50 border-t border-gray-100 px-4 sm:px-6 py-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-6 text-xs text-gray-500">
              <span className="font-medium text-gray-600">利用開始までの流れ:</span>
              <div className="flex items-center gap-2">
                <span className="bg-[#00c4cc] text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">1</span>
                <span>児童を登録</span>
                <span className="text-gray-300 mx-1">&rarr;</span>
                <span className="bg-[#00c4cc] text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">2</span>
                <span>保護者に招待メール</span>
                <span className="text-gray-300 mx-1">&rarr;</span>
                <span className="bg-[#00c4cc] text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">3</span>
                <span>保護者が承認して連携完了</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 招待中の利用者一覧 */}
      {pendingInvitations.length > 0 && (
        <div className="bg-orange-50 rounded-lg border border-orange-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-orange-800 flex items-center">
              <Mail size={16} className="mr-2 text-orange-500" />
              招待中の利用者 ({pendingInvitations.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingInvitations.map((invitation) => {
              const expiresAt = new Date(invitation.expires_at);
              const isExpired = expiresAt < new Date();
              const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

              return (
                <div
                  key={invitation.id}
                  className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                    isExpired
                      ? 'bg-gray-100 border-gray-300'
                      : 'bg-white border-orange-200 hover:bg-orange-50'
                  }`}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="text-orange-600 font-bold text-sm">仮</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-gray-800 truncate">
                        {invitation.temp_child_name}
                        <span className="text-orange-500 text-xs ml-1">（招待中）</span>
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {invitation.email}
                      </div>
                      <div className={`text-xs mt-1 ${isExpired ? 'text-red-500' : 'text-gray-400'}`}>
                        {isExpired ? '期限切れ' : `あと${daysLeft}日で期限切れ`}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancelInvitation(invitation.id)}
                    className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 rounded transition-colors ml-2"
                  >
                    取消
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

      {/* 検索とフィルター */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        {/* 検索 */}
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="児童名、保護者名、受給者証番号で検索..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc] transition-colors"
          />
        </div>

        {/* ステータスタブ */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSortStatus('all')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              sortStatus === 'all'
                ? 'bg-[#00c4cc] text-white shadow-sm'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            全員 ({children.length})
          </button>
          {Object.entries(statusCounts).map(([status, count]) => {
            const statusInfo = getStatusLabel(status as ContractStatus);
            return (
              <button
                key={status}
                onClick={() => setSortStatus(status as ContractStatus)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  sortStatus === status
                    ? `${statusInfo.color} shadow-sm`
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <statusInfo.icon size={14} />
                <span>{statusInfo.label} ({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 児童一覧カード */}
      {sortedChildren.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 sm:p-12 text-center">
          {children.length === 0 ? (
            <>
              <div className="w-20 h-20 bg-[#00c4cc]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users size={36} className="text-[#00c4cc]" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">まだ児童が登録されていません</h3>
              <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                「児童を新規登録」ボタンから最初の児童を登録しましょう。<br />
                登録後、保護者にメールで招待を送ることができます。
              </p>
              <button
                onClick={handleOpenWizard}
                className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white px-6 py-3 rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all inline-flex items-center gap-2"
              >
                <UserPlus size={18} />
                児童を新規登録
              </button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={28} className="text-gray-400" />
              </div>
              <h3 className="text-base font-bold text-gray-700 mb-1">該当する児童が見つかりません</h3>
              <p className="text-sm text-gray-500">検索条件やフィルターを変更してください</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedChildren.map((child: Child) => {
            const statusInfo = getStatusLabel(child.contractStatus);
            const StatusIcon = statusInfo.icon;
            const initials = child.name.slice(0, 2);
            return (
              <button
                key={child.id}
                onClick={() => handleOpenDetail(child)}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md hover:border-[#00c4cc]/30 transition-all text-left group"
              >
                <div className="flex items-start gap-3">
                  {/* アバター */}
                  <div className="w-12 h-12 bg-[#00c4cc]/10 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-[#00c4cc] font-bold text-sm">{initials}</span>
                  </div>

                  {/* 情報 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-800 text-sm truncate group-hover:text-[#00c4cc] transition-colors">
                        {child.name}
                      </h3>
                      {child.ownerProfileId && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                          <UserCheck size={10} />
                          連携
                        </span>
                      )}
                      {!child.ownerProfileId && childInvitationStatuses[child.id] && (
                        <>
                          {childInvitationStatuses[child.id].status === 'pending' && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                              <Mail size={10} />
                              招待中
                            </span>
                          )}
                          {childInvitationStatuses[child.id].status === 'expired' && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium shrink-0">
                              <AlertCircle size={10} />
                              期限切れ
                            </span>
                          )}
                          {childInvitationStatuses[child.id].status === 'accepted' && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                              <CheckCircle size={10} />
                              承認済
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {child.birthDate ? calculateAgeWithMonths(child.birthDate).display : child.age ? `${child.age}歳` : '年齢未登録'}
                      {child.guardianName && ` / ${child.guardianName}`}
                    </p>
                  </div>
                </div>

                {/* 下部情報 */}
                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold ${statusInfo.color}`}
                    >
                      <StatusIcon size={10} />
                      {statusInfo.label}
                    </span>
                    {!child.ownerProfileId && !childInvitationStatuses[child.id] && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[10px] bg-pink-50 text-pink-600 px-1.5 py-0.5 rounded font-medium border border-pink-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsInvitationSlotModalOpen(true);
                        }}
                      >
                        <Mail size={9} />
                        要招待
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {child.beneficiaryNumber && (
                      <span className="text-[10px] text-gray-400 font-mono">{child.beneficiaryNumber}</span>
                    )}
                    {child.contractDays && (
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                        {child.contractDays}日/月
                      </span>
                    )}
                    <div className="flex gap-0.5">
                      {child.needsPickup && (
                        <span className="text-[10px] bg-[#e0f7fa] text-[#006064] px-1 py-0.5 rounded font-bold">迎</span>
                      )}
                      {child.needsDropoff && (
                        <span className="text-[10px] bg-[#e0f7fa] text-[#006064] px-1 py-0.5 rounded font-bold">送</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

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
                      {formData.birthDate && (
                        <p className="text-xs text-gray-500 mt-1">
                          年齢: {calculateAgeWithMonths(formData.birthDate).display}
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
                                    <span className="text-[10px] text-gray-600 ml-0.5">{slotInfo.AM}</span>
                                  </label>
                                  {slotInfo.PM && (
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
                                    <span className="text-[10px] text-gray-600 ml-0.5">{slotInfo.PM}</span>
                                  </label>
                                  )}
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

                            {/* お迎え場所の住所（送迎ルート計算用） */}
                            {formData.pickupLocation && formData.pickupLocation !== '事業所' && (
                              <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                                <label className="block text-xs font-bold text-gray-500 mb-2">
                                  お迎え場所の住所（ルート計算用）
                                </label>
                                {formData.pickupLocation === '自宅' && formData.address ? (
                                  <div>
                                    <p className="text-xs text-gray-600 mb-2">
                                      自宅住所を使用: {formData.address}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => setFormData({
                                        ...formData,
                                        pickupAddress: formData.address || ''
                                      })}
                                      className="text-xs text-[#00c4cc] hover:underline"
                                    >
                                      自宅住所をお迎え場所にコピー
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      className="w-full border border-gray-300 rounded-md p-2 text-xs focus:outline-none focus:border-[#00c4cc]"
                                      placeholder="〒番号（例: 1234567）"
                                      value={formData.pickupPostalCode || ''}
                                      onChange={(e) => setFormData({ ...formData, pickupPostalCode: e.target.value.replace(/-/g, '') })}
                                      maxLength={7}
                                    />
                                    <input
                                      type="text"
                                      className="w-full border border-gray-300 rounded-md p-2 text-xs focus:outline-none focus:border-[#00c4cc]"
                                      placeholder="住所（例: 東京都○○区1-2-3）"
                                      value={formData.pickupAddress || ''}
                                      onChange={(e) => setFormData({ ...formData, pickupAddress: e.target.value })}
                                    />
                                  </div>
                                )}
                              </div>
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

                            {/* お送り場所の住所（送迎ルート計算用） */}
                            {formData.dropoffLocation && formData.dropoffLocation !== '事業所' && (
                              <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                                <label className="block text-xs font-bold text-gray-500 mb-2">
                                  お送り場所の住所（ルート計算用）
                                </label>
                                {formData.dropoffLocation === '自宅' && formData.address ? (
                                  <div>
                                    <p className="text-xs text-gray-600 mb-2">
                                      自宅住所を使用: {formData.address}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => setFormData({
                                        ...formData,
                                        dropoffAddress: formData.address || ''
                                      })}
                                      className="text-xs text-[#00c4cc] hover:underline"
                                    >
                                      自宅住所をお送り場所にコピー
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      className="w-full border border-gray-300 rounded-md p-2 text-xs focus:outline-none focus:border-[#00c4cc]"
                                      placeholder="〒番号（例: 1234567）"
                                      value={formData.dropoffPostalCode || ''}
                                      onChange={(e) => setFormData({ ...formData, dropoffPostalCode: e.target.value.replace(/-/g, '') })}
                                      maxLength={7}
                                    />
                                    <input
                                      type="text"
                                      className="w-full border border-gray-300 rounded-md p-2 text-xs focus:outline-none focus:border-[#00c4cc]"
                                      placeholder="住所（例: 東京都○○区1-2-3）"
                                      value={formData.dropoffAddress || ''}
                                      onChange={(e) => setFormData({ ...formData, dropoffAddress: e.target.value })}
                                    />
                                  </div>
                                )}
                              </div>
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

            {/* タブ切り替え */}
            <div className="border-b border-gray-200 px-6">
              <div className="flex gap-1">
                {/* 詳細情報タブ（常に表示） */}
                <button
                  onClick={() => setDetailTab('user')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    detailTab === 'user'
                      ? 'border-[#00c4cc] text-[#00c4cc]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  詳細情報
                </button>
                <button
                  onClick={() => setDetailTab('facility')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    detailTab === 'facility'
                      ? 'border-[#00c4cc] text-[#00c4cc]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  施設別設定
                </button>
              </div>
            </div>

            {/* 詳細情報 */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-6">
                {/* クイックアクセス */}
                {setActiveTab && detailTab === 'user' && (
                  <div className="border-b border-gray-200 pb-4">
                    <h4 className="font-bold text-sm text-gray-700 mb-3">クイックアクセス</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      <button
                        onClick={() => {
                          setActiveTab('daily-log');
                          setIsDetailModalOpen(false);
                        }}
                        className="flex flex-col items-center p-3 bg-gray-50 hover:bg-[#00c4cc]/10 rounded-lg transition-colors group"
                      >
                        <BookOpen size={24} className="text-gray-400 group-hover:text-[#00c4cc] mb-1" />
                        <span className="text-xs font-medium text-gray-600 group-hover:text-[#00c4cc]">連絡帳</span>
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab('schedule');
                          setIsDetailModalOpen(false);
                        }}
                        className="flex flex-col items-center p-3 bg-gray-50 hover:bg-[#00c4cc]/10 rounded-lg transition-colors group"
                      >
                        <CalendarDays size={24} className="text-gray-400 group-hover:text-[#00c4cc] mb-1" />
                        <span className="text-xs font-medium text-gray-600 group-hover:text-[#00c4cc]">予約</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsDocumentsOpen(true);
                        }}
                        className="flex flex-col items-center p-3 bg-gray-50 hover:bg-[#00c4cc]/10 rounded-lg transition-colors group"
                      >
                        <FileText size={24} className="text-gray-400 group-hover:text-[#00c4cc] mb-1" />
                        <span className="text-xs font-medium text-gray-600 group-hover:text-[#00c4cc]">書類管理</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 利用者情報タブ（デフォルト） */}
                {detailTab === 'user' && (
                  <>
                    {/* データソース表示 */}
                    {selectedChild.ownerProfileId ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center gap-2">
                        <UserCheck size={16} className="text-green-600 flex-shrink-0" />
                        <p className="text-sm text-green-800">
                          <span className="font-bold">利用者アカウント連動</span>
                          <span className="text-green-600 ml-1">- 保護者が登録した情報を表示しています</span>
                        </p>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2">
                        <FileWarning size={16} className="text-amber-600 flex-shrink-0" />
                        <p className="text-sm text-amber-800">
                          <span className="font-bold">施設入力情報</span>
                          <span className="text-amber-600 ml-1">- 施設スタッフが登録した情報を表示しています</span>
                        </p>
                      </div>
                    )}

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
                              ? `${selectedChild.birthDate} (${calculateAgeWithMonths(selectedChild.birthDate).display})`
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
                            'contract-progress': { label: '契約手続き中', color: 'bg-[#00c4cc]/10 text-[#00c4cc]' },
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

                    {/* 利用者アカウントへの招待 */}
                    {selectedChild.ownerProfileId && (
                      <div className="border-t border-gray-200 pt-4 mt-4">
                        <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">
                          <Mail size={14} />
                          利用者アカウントへの招待
                        </h4>
                        <p className="text-xs text-gray-600 mb-3">
                          この児童の保護者アカウントに施設利用の招待を送信できます。
                        </p>
                        <button
                          onClick={async () => {
                            // 保護者のメールアドレスを取得
                            const { data: ownerData } = await supabase
                              .from('users')
                              .select('email')
                              .eq('id', selectedChild.ownerProfileId)
                              .single();
                            if (ownerData?.email) {
                              setInvitationEmail(ownerData.email);
                            }
                            setIsInvitationModalOpen(true);
                          }}
                          className="w-full bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-2 px-4 rounded-md transition-colors text-sm flex items-center justify-center gap-2"
                        >
                          <Mail size={16} />
                          招待を送信
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* 施設別設定タブ */}
                {detailTab === 'facility' && (
                  <>
                    {/* 利用パターン・送迎（編集可能・カレンダー連動） */}
                    <div className="border-b border-gray-200 pb-4">
                      <h4 className="font-bold text-sm text-gray-700 mb-4 flex items-center gap-2">
                        利用パターン・送迎
                        <span className="text-xs font-normal text-gray-400">（カレンダー連動）</span>
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-bold text-gray-500 mb-2 block">基本利用パターン</label>
                          <div className="flex flex-wrap gap-1.5">
                            {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => {
                              const isChecked = selectedChild.patternDays?.includes(index) || false;
                              const timeSlot = selectedChild.patternTimeSlots?.[index] || 'PM';
                              return (
                                <div key={index} className={`flex flex-col items-start p-1.5 border rounded-md min-w-[70px] ${isChecked ? 'border-[#00c4cc] bg-[#e0f7fa]' : 'border-gray-200 hover:bg-gray-50'}`}>
                                  <label className="flex items-center space-x-1 cursor-pointer w-full mb-1">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        handleQuickUpdatePattern(
                                          selectedChild.id,
                                          index,
                                          e.target.checked,
                                          timeSlot as 'AM' | 'PM' | 'AMPM'
                                        );
                                      }}
                                      className="accent-[#00c4cc] w-3 h-3"
                                    />
                                    <span className={`text-xs font-medium ${isChecked ? 'text-[#006064]' : 'text-gray-700'}`}>
                                      {day}
                                    </span>
                                  </label>
                                  {isChecked && (
                                    <div className="flex flex-col items-start space-y-0.5 w-full pl-4">
                                      {(['AM', 'PM', 'AMPM'] as const).map((slot) => (
                                        <label key={slot} className="flex items-center cursor-pointer">
                                          <input
                                            type="radio"
                                            name={`facility-timeSlot-${index}`}
                                            value={slot}
                                            checked={timeSlot === slot}
                                            onChange={() => {
                                              handleQuickUpdateTimeSlot(selectedChild.id, index, slot);
                                            }}
                                            className="accent-[#00c4cc] w-2.5 h-2.5"
                                          />
                                          <span className="text-[10px] text-gray-600 ml-0.5">
                                            {slot === 'AM' ? slotInfo.AM : slot === 'PM' ? (slotInfo.PM || '午後') : '終日'}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {/* 送迎設定（編集可能） */}
                        <div className="bg-gray-50 rounded-lg p-4 mt-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Truck size={16} className="text-[#00c4cc]" />
                            <label className="text-xs font-bold text-gray-700">送迎設定</label>
                          </div>

                          {/* お迎え設定 */}
                          <div className="mb-4">
                            <div className="flex items-center gap-3 mb-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedChild.needsPickup || false}
                                  onChange={(e) => handleUpdateTransport(selectedChild.id, { needsPickup: e.target.checked })}
                                  className="accent-[#00c4cc] w-4 h-4"
                                />
                                <span className="text-sm font-bold text-gray-700">お迎えあり</span>
                              </label>
                            </div>
                            {selectedChild.needsPickup && (
                              <div className="ml-6 space-y-2">
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">乗車地</label>
                                  <select
                                    value={selectedChild.pickupLocation || '自宅'}
                                    onChange={(e) => handleUpdateTransport(selectedChild.id, { pickupLocation: e.target.value })}
                                    className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00c4cc]"
                                  >
                                    <option value="自宅">自宅</option>
                                    <option value="事業所">事業所</option>
                                    <option value="学校">学校</option>
                                    <option value="その他">その他</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">
                                    <MapPin size={12} className="inline mr-1" />
                                    住所（ルート計算用）
                                  </label>
                                  <input
                                    type="text"
                                    value={selectedChild.pickupAddress || ''}
                                    onChange={(e) => handleUpdateTransport(selectedChild.id, { pickupAddress: e.target.value })}
                                    placeholder="例: 東京都府中市○○町1-2-3"
                                    className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00c4cc]"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* お送り設定 */}
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedChild.needsDropoff || false}
                                  onChange={(e) => handleUpdateTransport(selectedChild.id, { needsDropoff: e.target.checked })}
                                  className="accent-[#00c4cc] w-4 h-4"
                                />
                                <span className="text-sm font-bold text-gray-700">お送りあり</span>
                              </label>
                            </div>
                            {selectedChild.needsDropoff && (
                              <div className="ml-6 space-y-2">
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">降車地</label>
                                  <select
                                    value={selectedChild.dropoffLocation || '自宅'}
                                    onChange={(e) => handleUpdateTransport(selectedChild.id, { dropoffLocation: e.target.value })}
                                    className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00c4cc]"
                                  >
                                    <option value="自宅">自宅</option>
                                    <option value="事業所">事業所</option>
                                    <option value="学校">学校</option>
                                    <option value="その他">その他</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">
                                    <MapPin size={12} className="inline mr-1" />
                                    住所（ルート計算用）
                                  </label>
                                  <input
                                    type="text"
                                    value={selectedChild.dropoffAddress || ''}
                                    onChange={(e) => handleUpdateTransport(selectedChild.id, { dropoffAddress: e.target.value })}
                                    placeholder="例: 東京都府中市○○町1-2-3"
                                    className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00c4cc]"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 契約情報 */}
                    <div className="border-b border-gray-200 pb-4">
                      <h4 className="font-bold text-sm text-gray-700 mb-4">契約情報</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs font-bold text-gray-500">契約ステータス</label>
                          <div className="mt-1">
                            <select
                              value={selectedChild.contractStatus}
                              onChange={(e) => handleQuickUpdateContractStatus(selectedChild.id, e.target.value as ContractStatus)}
                              className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00c4cc] focus:border-[#00c4cc]"
                            >
                              <option value="pre-contract">契約前</option>
                              <option value="active">契約中</option>
                              <option value="inactive">休止中</option>
                              <option value="terminated">解約</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500">契約開始日</label>
                          <input
                            type="date"
                            value={selectedChild.contractStartDate || ''}
                            onChange={(e) => handleQuickUpdateContractDate(selectedChild.id, 'contract_start_date', e.target.value)}
                            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 mt-1 focus:outline-none focus:ring-1 focus:ring-[#00c4cc] focus:border-[#00c4cc]"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500">契約終了日</label>
                          <input
                            type="date"
                            value={selectedChild.contractEndDate || ''}
                            onChange={(e) => handleQuickUpdateContractDate(selectedChild.id, 'contract_end_date', e.target.value)}
                            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 mt-1 focus:outline-none focus:ring-1 focus:ring-[#00c4cc] focus:border-[#00c4cc]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* ヒアリング記録（facilityIntakeDataがある場合のみ） */}
                    {selectedChild.facilityIntakeData && (
                      <>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                          <p className="text-sm text-amber-800">
                            以下はヒアリング時に施設が入力した記録です。
                            {selectedChild.facilityIntakeRecordedAt && (
                              <span className="block text-xs text-amber-600 mt-1">
                                記録日時: {new Date(selectedChild.facilityIntakeRecordedAt).toLocaleString('ja-JP')}
                              </span>
                            )}
                          </p>
                        </div>

                        {/* 施設記録：基本情報 */}
                        <div className="border-b border-gray-200 pb-4">
                          <h4 className="font-bold text-sm text-gray-700 mb-4">基本情報（ヒアリング記録）</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-bold text-gray-500">児童氏名</label>
                              <p className="text-sm text-gray-800 mt-1">{selectedChild.facilityIntakeData.name || '-'}</p>
                            </div>
                            <div>
                              <label className="text-xs font-bold text-gray-500">生年月日</label>
                              <p className="text-sm text-gray-800 mt-1">
                                {selectedChild.facilityIntakeData.birthDate
                                  ? `${selectedChild.facilityIntakeData.birthDate} (${calculateAgeWithMonths(selectedChild.facilityIntakeData.birthDate).display})`
                                  : '-'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* 施設記録：保護者情報 */}
                        <div className="border-b border-gray-200 pb-4">
                          <h4 className="font-bold text-sm text-gray-700 mb-4">保護者情報（ヒアリング記録）</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-bold text-gray-500">保護者名</label>
                              <p className="text-sm text-gray-800 mt-1">
                                {selectedChild.facilityIntakeData.guardianName || '-'}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs font-bold text-gray-500">続柄</label>
                              <p className="text-sm text-gray-800 mt-1">
                                {selectedChild.facilityIntakeData.guardianRelationship || '-'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* 施設記録：特性・メモ */}
                        {(selectedChild.facilityIntakeData.characteristics || selectedChild.facilityIntakeData.memo) && (
                          <div>
                            <h4 className="font-bold text-sm text-gray-700 mb-4">特性・メモ（ヒアリング記録）</h4>
                            {selectedChild.facilityIntakeData.characteristics && (
                              <div className="mb-3">
                                <label className="text-xs font-bold text-gray-500">特性</label>
                                <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">
                                  {selectedChild.facilityIntakeData.characteristics}
                                </p>
                              </div>
                            )}
                            {selectedChild.facilityIntakeData.memo && (
                              <div>
                                <label className="text-xs font-bold text-gray-500">スタッフメモ</label>
                                <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">
                                  {selectedChild.facilityIntakeData.memo}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
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

      {/* 招待枠作成モーダル */}
      <InvitationModal
        isOpen={isInvitationSlotModalOpen}
        onClose={() => setIsInvitationSlotModalOpen(false)}
        facilityId={facility?.id || localStorage.getItem('selectedFacilityId') || ''}
        facilityName={facility?.name || '施設'}
        userId={localStorage.getItem('userId') || ''}
        childList={children}
        onInvitationSent={handleInvitationSent}
      />

      {/* 児童登録ウィザード */}
      {isWizardOpen && (
        <ChildRegistrationWizard
          onComplete={handleWizardComplete}
          onCancel={() => {
            setIsWizardOpen(false);
            setSelectedChild(null);
          }}
          initialData={selectedChild ? {
            name: selectedChild.name,
            nameKana: selectedChild.nameKana,
            birthDate: selectedChild.birthDate,
            age: selectedChild.age,
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
            characteristics: selectedChild.characteristics,
            contractStatus: selectedChild.contractStatus,
            contractEndDate: selectedChild.contractEndDate,
          } : undefined}
          mode={wizardMode}
        />
      )}

      {/* 施設別設定エディタ */}
      {isFacilitySettingsOpen && selectedChild && facility?.id && (
        <FacilitySettingsEditor
          childId={selectedChild.id}
          childName={selectedChild.name}
          facilityId={facility.id}
          slotInfo={slotInfo}
          onSave={() => {
            // 必要に応じてデータを再読み込み
          }}
          onClose={() => setIsFacilitySettingsOpen(false)}
        />
      )}

      {/* 書類管理 */}
      {isDocumentsOpen && selectedChild && facility?.id && (
        <ChildDocumentsManager
          childId={selectedChild.id}
          childName={selectedChild.name}
          facilityId={facility.id}
          onClose={() => setIsDocumentsOpen(false)}
        />
      )}
    </div>
  );
};

export default ChildrenView;
