/**
 * スタッフマスタビュー
 * スタッフ管理のメインビューコンポーネント
 * - スタッフ一覧表示
 * - 詳細・編集・招待・有給管理
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Users, AlertCircle } from 'lucide-react';
import { useStaffMaster } from '@/hooks/useStaffMaster';
import { Staff, StaffPersonnelSettings, StaffLeaveSettings } from '@/types';
import StaffListPanel from './StaffListPanel';
import StaffDetailDrawer from './StaffDetailDrawer';
import StaffEditForm from './StaffEditForm';
import StaffInviteModal from './StaffInviteModal';
import StaffLeavePanel from './StaffLeavePanel';

interface StaffWithRelations extends Staff {
  personnelSettings?: StaffPersonnelSettings;
  leaveSettings?: StaffLeaveSettings;
}

const StaffMasterView: React.FC = () => {
  // スタッフデータ管理フック
  const {
    staffList,
    loading,
    error,
    fetchStaffList,
    createStaff,
    updateStaff,
    deleteStaff,
    updateLeaveSettings,
    inviteStaff,
  } = useStaffMaster();

  // UI状態
  const [selectedStaff, setSelectedStaff] = useState<StaffWithRelations | null>(null);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showLeavePanel, setShowLeavePanel] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffWithRelations | null>(null);
  const [leaveStaff, setLeaveStaff] = useState<StaffWithRelations | null>(null);

  // スタッフ選択
  const handleSelectStaff = useCallback((staff: StaffWithRelations) => {
    setSelectedStaff(staff);
    setShowDetailDrawer(true);
  }, []);

  // 詳細ドロワーを閉じる
  const handleCloseDetail = useCallback(() => {
    setShowDetailDrawer(false);
    setTimeout(() => setSelectedStaff(null), 300);
  }, []);

  // 新規追加
  const handleAddStaff = useCallback(() => {
    setEditingStaff(null);
    setShowEditForm(true);
  }, []);

  // 編集開始
  const handleEditStaff = useCallback((staff: StaffWithRelations) => {
    setEditingStaff(staff);
    setShowDetailDrawer(false);
    setShowEditForm(true);
  }, []);

  // 編集フォームを閉じる
  const handleCloseEdit = useCallback(() => {
    setShowEditForm(false);
    setTimeout(() => setEditingStaff(null), 300);
  }, []);

  // 保存（新規・編集）
  const handleSaveStaff = useCallback(
    async (data: Partial<Staff>): Promise<boolean> => {
      if (editingStaff) {
        // 更新
        const success = await updateStaff(editingStaff.id, data);
        return success;
      } else {
        // 新規作成
        const newId = await createStaff(data);
        return !!newId;
      }
    },
    [editingStaff, updateStaff, createStaff]
  );

  // 削除
  const handleDeleteStaff = useCallback(
    async (staff: StaffWithRelations) => {
      const success = await deleteStaff(staff.id);
      if (success) {
        handleCloseDetail();
      }
    },
    [deleteStaff, handleCloseDetail]
  );

  // 招待モーダル
  const handleOpenInvite = useCallback(() => {
    setShowInviteModal(true);
  }, []);

  const handleCloseInvite = useCallback(() => {
    setShowInviteModal(false);
  }, []);

  const handleInviteStaff = useCallback(
    async (email: string, name: string) => {
      return await inviteStaff(email, name);
    },
    [inviteStaff]
  );

  // 有給管理パネル
  const handleOpenLeave = useCallback((staff: StaffWithRelations) => {
    setLeaveStaff(staff);
    setShowDetailDrawer(false);
    setShowLeavePanel(true);
  }, []);

  const handleCloseLeave = useCallback(() => {
    setShowLeavePanel(false);
    setTimeout(() => setLeaveStaff(null), 300);
  }, []);

  const handleSaveLeave = useCallback(
    async (settings: Partial<StaffLeaveSettings>): Promise<boolean> => {
      if (!leaveStaff) return false;
      return await updateLeaveSettings(leaveStaff.id, settings);
    },
    [leaveStaff, updateLeaveSettings]
  );

  // エクスポート
  const handleExport = useCallback(() => {
    // CSVエクスポート実装
    const headers = ['名前', 'ふりがな', '雇用形態', '権限', '資格', '連絡先'];
    const rows = staffList.map((staff) => [
      staff.name,
      staff.nameKana || '',
      staff.type,
      staff.role,
      staff.personnelSettings?.qualifications?.join('・') || '',
      staff.phone || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `スタッフ一覧_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }, [staffList]);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* ヘッダー */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
              <Users size={20} className="text-teal-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">スタッフマスタ</h1>
              <p className="text-sm text-gray-500">
                スタッフの登録・編集・有給管理
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle size={20} className="text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="h-full max-w-4xl">
          <StaffListPanel
            staffList={staffList as StaffWithRelations[]}
            loading={loading}
            selectedStaffId={selectedStaff?.id}
            onSelectStaff={handleSelectStaff}
            onInviteStaff={handleOpenInvite}
            onRefresh={fetchStaffList}
            onExport={handleExport}
          />
        </div>
      </div>

      {/* 詳細ドロワー */}
      <StaffDetailDrawer
        staff={selectedStaff}
        isOpen={showDetailDrawer}
        onClose={handleCloseDetail}
        onEdit={handleEditStaff}
        onDelete={handleDeleteStaff}
        onEditLeave={handleOpenLeave}
      />

      {/* 編集フォーム */}
      <StaffEditForm
        staff={editingStaff}
        isOpen={showEditForm}
        onClose={handleCloseEdit}
        onSave={handleSaveStaff}
        loading={loading}
      />

      {/* 招待モーダル */}
      <StaffInviteModal
        isOpen={showInviteModal}
        onClose={handleCloseInvite}
        onInvite={handleInviteStaff}
        loading={loading}
      />

      {/* 有給管理パネル */}
      {leaveStaff && (
        <StaffLeavePanel
          staff={leaveStaff}
          isOpen={showLeavePanel}
          onClose={handleCloseLeave}
          onSave={handleSaveLeave}
          loading={loading}
        />
      )}
    </div>
  );
};

export default StaffMasterView;
