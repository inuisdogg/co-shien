'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Award,
  Plus,
  Edit3,
  Trash2,
  X,
  Search,
  AlertCircle,
  Clock,
  CheckCircle,
  Upload,
  ChevronDown,
  Calendar,
  Users,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// ---- Local types ----
interface Qualification {
  id: string;
  userId: string;
  userName: string;
  qualificationName: string;
  qualificationCode: string | null;
  certificateNumber: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  certificateFileUrl: string | null;
  certificateFileName: string | null;
  status: string;
  notes: string | null;
}

interface StaffMember {
  id: string;
  name: string;
}

interface QualificationForm {
  userId: string;
  qualificationName: string;
  qualificationCode: string;
  certificateNumber: string;
  issuedDate: string;
  expiryDate: string;
  notes: string;
}

const ACCENT = '#00c4cc';

const COMMON_QUALIFICATIONS = [
  '保育士',
  '児童発達支援管理責任者',
  '社会福祉士',
  '介護福祉士',
  '理学療法士',
  '作業療法士',
  '言語聴覚士',
  '看護師',
  '強度行動障害支援者',
  '公認心理師',
  '臨床心理士',
  '精神保健福祉士',
];

type ExpiryFilter = 'all' | 'expired' | 'expiring_30' | 'expiring_60' | 'expiring_90' | 'valid';

const QualificationManagementPanel: React.FC = () => {
  const { facility } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>('all');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<QualificationForm>({
    userId: '',
    qualificationName: '',
    qualificationCode: '',
    certificateNumber: '',
    issuedDate: '',
    expiryDate: '',
    notes: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [showQualDropdown, setShowQualDropdown] = useState(false);

  // ---- Fetch ----
  const fetchData = useCallback(async () => {
    if (!facility?.id) return;
    setLoading(true);
    try {
      // Fetch staff
      const { data: staffData } = await supabase
        .from('users')
        .select('id, name, last_name, first_name')
        .eq('user_type', 'staff');

      // Also get staff from employment records for this facility
      const { data: empData } = await supabase
        .from('employment_records')
        .select('user_id')
        .eq('facility_id', facility.id)
        .is('end_date', null);

      const empUserIds = new Set((empData || []).map((e) => e.user_id));

      const allStaff: StaffMember[] = [];
      const seenIds = new Set<string>();

      (staffData || []).forEach((s) => {
        if (!seenIds.has(s.id)) {
          seenIds.add(s.id);
          allStaff.push({
            id: s.id,
            name: s.name || `${s.last_name || ''} ${s.first_name || ''}`.trim() || '(名前なし)',
          });
        }
      });

      // Add any in employment_records not yet in the list
      if (empUserIds.size > 0) {
        const missingIds = [...empUserIds].filter((id) => !seenIds.has(id));
        if (missingIds.length > 0) {
          const { data: moreStaff } = await supabase
            .from('users')
            .select('id, name, last_name, first_name')
            .in('id', missingIds);
          (moreStaff || []).forEach((s) => {
            if (!seenIds.has(s.id)) {
              seenIds.add(s.id);
              allStaff.push({
                id: s.id,
                name: s.name || `${s.last_name || ''} ${s.first_name || ''}`.trim() || '(名前なし)',
              });
            }
          });
        }
      }

      setStaffList(allStaff);

      // Fetch qualifications
      const { data: qualData } = await supabase
        .from('staff_qualifications')
        .select('*')
        .eq('facility_id', facility.id)
        .order('expiry_date', { ascending: true });

      // Build a map for staff names
      const staffMap = new Map(allStaff.map((s) => [s.id, s.name]));

      setQualifications(
        (qualData || []).map((q) => ({
          id: q.id,
          userId: q.user_id,
          userName: staffMap.get(q.user_id) || '(不明)',
          qualificationName: q.qualification_name,
          qualificationCode: q.qualification_code,
          certificateNumber: q.certificate_number,
          issuedDate: q.issued_date,
          expiryDate: q.expiry_date,
          certificateFileUrl: q.certificate_file_url,
          certificateFileName: q.certificate_file_name,
          status: q.status || 'active',
          notes: q.notes,
        }))
      );
    } catch (err) {
      console.error('Error fetching qualifications:', err);
    } finally {
      setLoading(false);
    }
  }, [facility?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- Helpers ----
  const getExpiryStatus = (expiryDate: string | null): 'valid' | 'expiring' | 'expired' | 'none' => {
    if (!expiryDate) return 'none';
    const now = Date.now();
    const expiry = new Date(expiryDate).getTime();
    if (expiry < now) return 'expired';
    if (expiry - now < 90 * 24 * 60 * 60 * 1000) return 'expiring';
    return 'valid';
  };

  const getDaysUntilExpiry = (expiryDate: string | null): number | null => {
    if (!expiryDate) return null;
    return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  };

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('ja-JP');
  };

  // ---- Filter ----
  const filteredQualifications = qualifications.filter((q) => {
    // Search
    if (search) {
      const s = search.toLowerCase();
      if (!q.userName.toLowerCase().includes(s) && !q.qualificationName.toLowerCase().includes(s)) {
        return false;
      }
    }

    // Expiry filter
    if (expiryFilter === 'all') return true;
    const days = getDaysUntilExpiry(q.expiryDate);
    if (expiryFilter === 'expired') return days !== null && days < 0;
    if (expiryFilter === 'expiring_30') return days !== null && days >= 0 && days <= 30;
    if (expiryFilter === 'expiring_60') return days !== null && days >= 0 && days <= 60;
    if (expiryFilter === 'expiring_90') return days !== null && days >= 0 && days <= 90;
    if (expiryFilter === 'valid') return days === null || days > 90;
    return true;
  });

  // ---- Expiry alert counts ----
  const expiredCount = qualifications.filter((q) => {
    const d = getDaysUntilExpiry(q.expiryDate);
    return d !== null && d < 0;
  }).length;

  const expiring30Count = qualifications.filter((q) => {
    const d = getDaysUntilExpiry(q.expiryDate);
    return d !== null && d >= 0 && d <= 30;
  }).length;

  const expiring60Count = qualifications.filter((q) => {
    const d = getDaysUntilExpiry(q.expiryDate);
    return d !== null && d > 30 && d <= 60;
  }).length;

  const expiring90Count = qualifications.filter((q) => {
    const d = getDaysUntilExpiry(q.expiryDate);
    return d !== null && d > 60 && d <= 90;
  }).length;

  // ---- CRUD ----
  const openCreate = () => {
    setEditingId(null);
    setForm({
      userId: staffList[0]?.id || '',
      qualificationName: '',
      qualificationCode: '',
      certificateNumber: '',
      issuedDate: '',
      expiryDate: '',
      notes: '',
    });
    setFile(null);
    setShowModal(true);
  };

  const openEdit = (q: Qualification) => {
    setEditingId(q.id);
    setForm({
      userId: q.userId,
      qualificationName: q.qualificationName,
      qualificationCode: q.qualificationCode || '',
      certificateNumber: q.certificateNumber || '',
      issuedDate: q.issuedDate || '',
      expiryDate: q.expiryDate || '',
      notes: q.notes || '',
    });
    setFile(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!facility?.id || !form.userId || !form.qualificationName.trim()) return;
    setSaving(true);
    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;

      if (file) {
        const path = `${facility.id}/${form.userId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('qualifications')
          .upload(path, file);

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('qualifications').getPublicUrl(path);
          fileUrl = urlData?.publicUrl || path;
          fileName = file.name;
        }
      }

      const payload: Record<string, unknown> = {
        user_id: form.userId,
        facility_id: facility.id,
        qualification_name: form.qualificationName,
        qualification_code: form.qualificationCode || null,
        certificate_number: form.certificateNumber || null,
        issued_date: form.issuedDate || null,
        expiry_date: form.expiryDate || null,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      };

      if (fileUrl) {
        payload.certificate_file_url = fileUrl;
        payload.certificate_file_name = fileName;
      }

      if (editingId) {
        await supabase.from('staff_qualifications').update(payload).eq('id', editingId);
      } else {
        await supabase.from('staff_qualifications').insert(payload);
      }

      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error('Error saving qualification:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この資格情報を削除しますか？')) return;
    await supabase.from('staff_qualifications').delete().eq('id', id);
    fetchData();
  };

  return (
    <div className="space-y-4">
      {/* Expiry alert cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => setExpiryFilter(expiryFilter === 'expired' ? 'all' : 'expired')}
          className={`p-3 rounded-xl border-2 text-left transition-colors ${
            expiryFilter === 'expired' ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-red-600">期限切れ</span>
            <span className="text-lg font-bold text-red-600">{expiredCount}</span>
          </div>
        </button>
        <button
          onClick={() => setExpiryFilter(expiryFilter === 'expiring_30' ? 'all' : 'expiring_30')}
          className={`p-3 rounded-xl border-2 text-left transition-colors ${
            expiryFilter === 'expiring_30' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-600">30日以内</span>
            <span className="text-lg font-bold text-amber-600">{expiring30Count}</span>
          </div>
        </button>
        <button
          onClick={() => setExpiryFilter(expiryFilter === 'expiring_60' ? 'all' : 'expiring_60')}
          className={`p-3 rounded-xl border-2 text-left transition-colors ${
            expiryFilter === 'expiring_60' ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-yellow-600">60日以内</span>
            <span className="text-lg font-bold text-yellow-600">{expiring60Count}</span>
          </div>
        </button>
        <button
          onClick={() => setExpiryFilter(expiryFilter === 'expiring_90' ? 'all' : 'expiring_90')}
          className={`p-3 rounded-xl border-2 text-left transition-colors ${
            expiryFilter === 'expiring_90' ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-600">90日以内</span>
            <span className="text-lg font-bold text-blue-600">{expiring90Count}</span>
          </div>
        </button>
      </div>

      {/* Search + Add */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="スタッフ名・資格名で検索..."
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
          />
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-white text-sm font-medium hover:opacity-90"
          style={{ backgroundColor: ACCENT }}
        >
          <Plus size={16} />
          資格を登録
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${ACCENT} transparent transparent transparent` }} />
        </div>
      ) : filteredQualifications.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <Award size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">
            {search || expiryFilter !== 'all' ? '条件に一致する資格がありません' : '資格が登録されていません'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">スタッフ</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">資格名</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">証明書番号</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">取得日</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">有効期限</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">状態</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredQualifications.map((q) => {
                  const expiryStatus = getExpiryStatus(q.expiryDate);
                  const days = getDaysUntilExpiry(q.expiryDate);

                  return (
                    <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-700">{q.userName}</td>
                      <td className="px-4 py-3">
                        <span className="text-gray-700">{q.qualificationName}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{q.certificateNumber || '-'}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(q.issuedDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`${
                          expiryStatus === 'expired' ? 'text-red-600 font-medium' :
                          expiryStatus === 'expiring' ? 'text-amber-600 font-medium' :
                          'text-gray-500'
                        }`}>
                          {formatDate(q.expiryDate)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {expiryStatus === 'expired' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                            <AlertCircle size={10} /> 期限切れ
                          </span>
                        ) : expiryStatus === 'expiring' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                            <Clock size={10} /> あと{days}日
                          </span>
                        ) : expiryStatus === 'valid' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">
                            <CheckCircle size={10} /> 有効
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">期限なし</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {q.certificateFileUrl && (
                            <button
                              onClick={() => window.open(q.certificateFileUrl!, '_blank')}
                              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
                              title="証明書を表示"
                            >
                              <FileText size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(q)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
                            title="編集"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(q.id)}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"
                            title="削除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">
                {editingId ? '資格を編集' : '資格を登録'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Staff selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">スタッフ *</label>
                <div className="relative">
                  <select
                    value={form.userId}
                    onChange={(e) => setForm({ ...form, userId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc] appearance-none"
                  >
                    <option value="">スタッフを選択</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Qualification name with dropdown suggestions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">資格名 *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.qualificationName}
                    onChange={(e) => {
                      setForm({ ...form, qualificationName: e.target.value });
                      setShowQualDropdown(true);
                    }}
                    onFocus={() => setShowQualDropdown(true)}
                    onBlur={() => setTimeout(() => setShowQualDropdown(false), 200)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                    placeholder="資格名を入力または選択"
                  />
                  {showQualDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
                      {COMMON_QUALIFICATIONS
                        .filter((q) => !form.qualificationName || q.includes(form.qualificationName))
                        .map((q) => (
                          <button
                            key={q}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setForm({ ...form, qualificationName: q });
                              setShowQualDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-700"
                          >
                            {q}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Certificate number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">証明書番号</label>
                <input
                  type="text"
                  value={form.certificateNumber}
                  onChange={(e) => setForm({ ...form, certificateNumber: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                  placeholder="証明書番号"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">取得日</label>
                  <input
                    type="date"
                    value={form.issuedDate}
                    onChange={(e) => setForm({ ...form, issuedDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">有効期限</label>
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                  />
                </div>
              </div>

              {/* Certificate file upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">証明書ファイル</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-3 text-sm border-2 border-dashed border-gray-200 rounded-lg hover:border-gray-300 transition-colors text-gray-500"
                >
                  <Upload size={16} />
                  {file ? file.name : 'PDF/画像ファイルを選択'}
                </button>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00c4cc]/30 focus:border-[#00c4cc]"
                  placeholder="メモ..."
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.userId || !form.qualificationName.trim()}
                className="px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-40"
                style={{ backgroundColor: ACCENT }}
              >
                {saving ? '保存中...' : editingId ? '更新' : '登録'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QualificationManagementPanel;
