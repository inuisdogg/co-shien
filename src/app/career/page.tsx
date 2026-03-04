/**
 * 個人ダッシュボード
 * 「自分のキャリアの価値を確認する場所」であり、「今日の業務をスムーズに始めるためのショートカット」
 */

'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

import {
  Briefcase,
  Award,
  Clock,
  FileText,
  Bell,
  Settings,
  LogOut,
  CheckCircle,
  AlertCircle,
  Calendar,
  MapPin,
  User,
  Building2,
  PlayCircle,
  PauseCircle,
  Coffee,
  Edit,
  Upload,
  Camera,
  FileCheck,
  Plus,
  X,
  MessageSquare,
  Users,
  ClipboardList,
  Megaphone,
  Search,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { User as UserType, EmploymentRecord, FacilitySettings, WorkToolId, QUALIFICATION_CODES, type QualificationCode } from '@/types';
import JobBrowsingTab from '@/components/personal/JobBrowsingTab';
import ProfileEditSection from '@/components/personal/ProfileEditSection';
import type { ProfileData } from '@/components/personal/ProfileEditSection';
import { getJapaneseHolidays, isJapaneseHoliday } from '@/utils/japaneseHolidays';
import { slotDisplayName, resolveTimeSlots } from '@/utils/slotResolver';
import { getBizBaseUrl } from '@/utils/domain';
import { Shield, Download, Loader2, Eye, TrendingUp, GraduationCap, Hash, ChevronDown, ChevronUp, FolderOpen, Fingerprint, Trash2, Bus, UserCheck } from 'lucide-react';
import WorkExperienceForm from '@/components/personal/WorkExperienceForm';
import AttendanceCalendar from '@/components/personal/AttendanceCalendar';
import ShiftConfirmationView from '@/components/personal/ShiftConfirmationView';
import ShiftAvailabilityForm from '@/components/personal/ShiftAvailabilityForm';
import TransportStatusWidget from '@/components/transport/TransportStatusWidget';
import ScoutInboxSection from '@/components/personal/ScoutInboxSection';
import { usePersonalData, type FacilityWorkData } from '@/hooks/usePersonalData';
import { useCareerAccumulation } from '@/hooks/useCareerAccumulation';
import type { CareerTimelineEvent } from '@/hooks/useCareerAccumulation';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from '@/components/ui/Toast';

const DEFAULT_SLOTS = resolveTimeSlots([]);

// 運営管理画面へのアクセスリンクコンポーネント
function PasskeySection({ userId, userEmail }: { userId?: string; userEmail?: string }) {
  const [passkeys, setPasskeys] = useState<Array<{ id: string; device_name: string; created_at: string; last_used_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [supported, setSupported] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      setSupported(true);
    }
    fetchPasskeys();
  }, [userId]);

  const fetchPasskeys = async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('passkeys')
        .select('id, device_name, created_at, last_used_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setPasskeys(data || []);
    } catch {}
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!userId || !userEmail) return;
    setRegistering(true);
    setMessage('');
    try {
      const { startRegistration } = await import('@simplewebauthn/browser');
      const beginRes = await fetch('/api/passkey/register/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: userEmail, userId }),
      });
      if (!beginRes.ok) throw new Error('登録を開始できませんでした');
      const options = await beginRes.json();
      const credential = await startRegistration({ optionsJSON: options });
      const finishRes = await fetch('/api/passkey/register/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, loginId: userEmail, userId }),
      });
      if (!finishRes.ok) throw new Error('登録に失敗しました');
      setMessage('パスキーを登録しました');
      fetchPasskeys();
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setMessage('登録がキャンセルされました');
      } else {
        setMessage(err.message || '登録に失敗しました');
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async (passkeyId: string) => {
    if (!confirm('このパスキーを削除しますか？')) return;
    await supabase.from('passkeys').delete().eq('id', passkeyId);
    fetchPasskeys();
  };

  if (!supported) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
      <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
        <Fingerprint className="w-5 h-5 text-personal" />
        パスキー（生体認証）
      </h3>
      <p className="text-xs text-gray-500 mb-3">Face ID・指紋認証でパスワードなしログインできます</p>

      {message && (
        <div className={`text-sm px-3 py-2 rounded-lg mb-3 ${message.includes('失敗') || message.includes('キャンセル') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-personal border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {passkeys.length > 0 && (
            <div className="space-y-2 mb-3">
              {passkeys.map(pk => (
                <div key={pk.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-bold text-gray-700">{pk.device_name || 'デバイス'}</p>
                    <p className="text-xs text-gray-400">
                      登録: {new Date(pk.created_at).toLocaleDateString('ja-JP')}
                      {pk.last_used_at && ` ・ 最終使用: ${new Date(pk.last_used_at).toLocaleDateString('ja-JP')}`}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(pk.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={handleRegister}
            disabled={registering}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-personal hover:bg-personal-dark text-white font-bold rounded-lg transition-colors text-sm disabled:opacity-50"
          >
            {registering ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                登録中...
              </>
            ) : (
              <>
                <Fingerprint className="w-4 h-4" />
                {passkeys.length > 0 ? '別のデバイスを追加' : 'パスキーを登録'}
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}

function AdminAccessLink({ userId }: { userId?: string }) {
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPermission = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('admin_permissions')
          .select('id')
          .eq('user_id', userId)
          .eq('permission_type', 'facility_creation')
          .single();

        if (!error && data) {
          setHasPermission(true);
        }
      } catch (err) {
        console.error('権限確認エラー:', err);
      } finally {
        setLoading(false);
      }
    };

    checkPermission();
  }, [userId]);

  if (loading || !hasPermission) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-personal to-personal-dark rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white">運営管理</h3>
            <p className="text-white/70 text-xs">施設の追加・システム設定</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/admin')}
          className="flex items-center gap-2 py-2 px-4 bg-white hover:bg-gray-100 text-personal font-bold rounded-lg transition-colors text-sm"
        >
          <Shield className="w-4 h-4" />
          開く
        </button>
      </div>
    </div>
  );
}

// ========== スタッフ書類閲覧セクション ==========
function StaffDocumentsSection({ userId, facilities }: { userId: string; facilities: FacilityWorkData[] }) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [docSearch, setDocSearch] = useState('');
  const [docSortDesc, setDocSortDesc] = useState(true);
  const [docCategory, setDocCategory] = useState<'all' | 'salary' | 'contract' | 'other'>('all');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const DOC_TYPES: Record<string, string> = {
    payslip: '給与明細',
    employment_contract: '雇用契約書',
    withholding_tax: '源泉徴収票',
    wage_notice: '賃金通知書',
    social_insurance: '社会保険関連',
    year_end_adjustment: '年末調整',
    other: 'その他',
  };

  const DOC_ICONS: Record<string, string> = {
    payslip: '💰', employment_contract: '📝', withholding_tax: '🧾',
    wage_notice: '💵', social_insurance: '🏥', year_end_adjustment: '📋', other: '📄',
  };

  const SALARY_TYPES = ['payslip', 'withholding_tax', 'wage_notice', 'year_end_adjustment'];
  const CONTRACT_TYPES = ['employment_contract', 'social_insurance'];

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'salary': return '給与関係';
      case 'contract': return '雇用契約関係';
      case 'other': return 'その他';
      default: return '';
    }
  };

  const getDocCategory = (docType: string): string => {
    if (SALARY_TYPES.includes(docType)) return 'salary';
    if (CONTRACT_TYPES.includes(docType)) return 'contract';
    return 'other';
  };

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('staff_documents')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!cancelled && data) {
          const facilityMap = new Map(facilities.map(f => [f.facilityId, f.facilityName]));
          setDocuments(data.map((d: any) => ({
            ...d,
            facilityName: facilityMap.get(d.facility_id) || '不明な施設',
          })));
        }
      } catch (err) {
        // silently ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [userId, facilities]);

  const handleView = async (doc: any) => {
    // 既読にする
    if (!doc.is_read) {
      await supabase
        .from('staff_documents')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', doc.id);
      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, is_read: true, read_at: new Date().toISOString() } : d));
    }
    // ダウンロード
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.file_url, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Filter by search term
  let filtered = documents;
  if (docSearch.trim()) {
    const kw = docSearch.toLowerCase();
    filtered = filtered.filter(d =>
      (d.title || '').toLowerCase().includes(kw) ||
      (DOC_TYPES[d.document_type] || d.document_type || '').toLowerCase().includes(kw) ||
      (d.facilityName || '').toLowerCase().includes(kw)
    );
  }

  // Filter by category
  if (docCategory !== 'all') {
    filtered = filtered.filter(d => getDocCategory(d.document_type) === docCategory);
  }

  // Sort
  filtered = [...filtered].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return docSortDesc ? dateB - dateA : dateA - dateB;
  });

  // Group by category for display
  const groupedDocs = filtered.reduce<Record<string, any[]>>((acc, doc) => {
    const cat = getDocCategory(doc.document_type);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  const unreadCount = documents.filter(d => !d.is_read).length;
  const categoryOrder = ['salary', 'contract', 'other'] as const;

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-personal" /></div>;
  }

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <div className="bg-personal/10 border border-personal/30 rounded-xl px-4 py-3 flex items-center gap-2">
          <Bell className="w-5 h-5 text-personal" />
          <span className="text-sm font-bold text-personal">{unreadCount}件の未読書類があります</span>
        </div>
      )}

      {/* 検索 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={docSearch}
          onChange={(e) => setDocSearch(e.target.value)}
          placeholder="書類名・種類で検索..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-personal/30 focus:border-personal bg-white"
        />
        {docSearch && (
          <button onClick={() => setDocSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* カテゴリフィルター + ソート */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', 'salary', 'contract', 'other'] as const).map((cat) => {
            const count = cat === 'all'
              ? documents.length
              : documents.filter(d => getDocCategory(d.document_type) === cat).length;
            const label = cat === 'all' ? 'すべて' : getCategoryLabel(cat);
            return (
              <button
                key={cat}
                onClick={() => setDocCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                  docCategory === cat ? 'bg-personal text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setDocSortDesc(!docSortDesc)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex-shrink-0"
        >
          {docSortDesc ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          {docSortDesc ? '新しい順' : '古い順'}
        </button>
      </div>

      {/* 書類一覧（カテゴリ別） */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">{docSearch ? '検索結果が見つかりません' : '書類はまだありません'}</p>
          <p className="text-gray-400 text-xs mt-1">{docSearch ? '別のキーワードで検索してみてください' : '施設から書類が配布されるとここに表示されます'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categoryOrder.map((cat) => {
            const docs = groupedDocs[cat];
            if (!docs || docs.length === 0) return null;
            const isCollapsed = collapsedCategories.has(cat);
            return (
              <div key={cat} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-personal" />
                    <span className="text-sm font-bold text-gray-800">{getCategoryLabel(cat)}</span>
                    <span className="text-xs text-gray-400">({docs.length})</span>
                  </div>
                  {isCollapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
                </button>
                {!isCollapsed && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {docs.map((doc: any) => (
                      <button
                        key={doc.id}
                        onClick={() => handleView(doc)}
                        className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-2xl flex-shrink-0">{DOC_ICONS[doc.document_type] || '📄'}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-800 truncate">{doc.title}</span>
                              {!doc.is_read && (
                                <span className="flex-shrink-0 w-2 h-2 bg-personal rounded-full" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                              <span>{doc.facilityName}</span>
                              <span>{DOC_TYPES[doc.document_type] || doc.document_type}</span>
                              {doc.target_year && <span>{doc.target_year}年{doc.target_month}月</span>}
                            </div>
                          </div>
                          <Download className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ========== 規定確認セクション ==========
function CareerRegulationSection({ userId, activeEmployments }: { userId?: string; activeEmployments: EmploymentRecord[] }) {
  const [regulations, setRegulations] = useState<{ id: string; title: string; facilityId: string; facilityName: string; acknowledged: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || activeEmployments.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const fetchRegulations = async () => {
      setLoading(true);
      try {
        const facilityIds = activeEmployments.map(e => e.facilityId).filter(Boolean);
        if (facilityIds.length === 0) { if (!cancelled) setLoading(false); return; }

        const { data: regs } = await supabase
          .from('company_regulations')
          .select('id, title, facility_id')
          .in('facility_id', facilityIds)
          .eq('is_published', true);

        if (!regs || regs.length === 0) { if (!cancelled) { setRegulations([]); setLoading(false); } return; }

        const { data: acks } = await supabase
          .from('regulation_acknowledgments')
          .select('regulation_id')
          .eq('user_id', userId)
          .in('facility_id', facilityIds);

        const ackedIds = new Set((acks ?? []).map((a: any) => a.regulation_id));

        const result = regs.map((r: any) => {
          const emp = activeEmployments.find(e => e.facilityId === r.facility_id);
          return {
            id: r.id,
            title: r.title,
            facilityId: r.facility_id,
            facilityName: emp?.facilityName || '施設',
            acknowledged: ackedIds.has(r.id),
          };
        });
        if (!cancelled) setRegulations(result);
      } catch (e) {
        // silently ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchRegulations();
    return () => { cancelled = true; };
  }, [userId, activeEmployments]);

  const handleAcknowledge = async (regId: string, facilityId: string) => {
    if (!userId) return;
    setAcknowledging(regId);
    try {
      await supabase.from('regulation_acknowledgments').insert({
        regulation_id: regId,
        user_id: userId,
        facility_id: facilityId,
        acknowledged_at: new Date().toISOString(),
      });
      setRegulations(prev => prev.map(r => r.id === regId ? { ...r, acknowledged: true } : r));
    } catch (e) {
      // silently ignore
    } finally {
      setAcknowledging(null);
    }
  };

  const unacknowledged = regulations.filter(r => !r.acknowledged);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-personal" />
          <h2 className="text-lg font-bold text-gray-800">規定確認</h2>
        </div>
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-personal" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
    >
      <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5 text-personal" />
        規定確認
        {unacknowledged.length > 0 && (
          <span className="bg-personal text-white text-xs px-2 py-0.5 rounded-full font-bold">
            {unacknowledged.length}
          </span>
        )}
      </h2>
      {unacknowledged.length === 0 ? (
        <div className="text-center py-6">
          <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
          <p className="text-sm text-gray-500">全ての規定を確認済みです</p>
        </div>
      ) : (
        <div className="space-y-3">
          {unacknowledged.map((reg) => (
            <div
              key={reg.id}
              className="flex items-center justify-between p-3 bg-personal/5 border border-personal/20 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{reg.title}</p>
                <p className="text-xs text-gray-500">{reg.facilityName}</p>
              </div>
              <button
                onClick={() => handleAcknowledge(reg.id, reg.facilityId)}
                disabled={acknowledging === reg.id}
                className="ml-3 px-4 py-2 bg-personal text-white text-xs font-bold rounded-lg hover:bg-personal-dark transition-colors disabled:opacity-50 shrink-0"
              >
                {acknowledging === reg.id ? '処理中...' : '確認する'}
              </button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ========== 資格期限通知セクション ==========
function CareerQualificationAlerts({ userId, activeEmployments }: { userId?: string; activeEmployments: EmploymentRecord[] }) {
  const [qualifications, setQualifications] = useState<{ id: string; name: string; expiryDate: string; daysLeft: number; status: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || activeEmployments.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const fetchQualifications = async () => {
      setLoading(true);
      try {
        const facilityIds = activeEmployments.map(e => e.facilityId).filter(Boolean);
        if (facilityIds.length === 0) { if (!cancelled) setLoading(false); return; }

        const { data } = await supabase
          .from('staff_qualifications')
          .select('id, qualification_name, expiry_date, status')
          .eq('user_id', userId)
          .in('facility_id', facilityIds)
          .not('expiry_date', 'is', null)
          .order('expiry_date', { ascending: true });

        if (!cancelled && data) {
          const todayMs = new Date().setHours(0, 0, 0, 0);
          setQualifications(
            data.map((q: any) => {
              const daysLeft = Math.ceil((new Date(q.expiry_date).getTime() - todayMs) / (1000 * 60 * 60 * 24));
              return {
                id: q.id,
                name: q.qualification_name,
                expiryDate: q.expiry_date,
                daysLeft,
                status: q.status,
              };
            })
          );
        }
      } catch (e) {
        // silently ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchQualifications();
    return () => { cancelled = true; };
  }, [userId, activeEmployments]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-personal" />
          <h2 className="text-lg font-bold text-gray-800">資格期限通知</h2>
        </div>
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-personal" />
        </div>
      </div>
    );
  }

  const alertQuals = qualifications.filter(q => q.daysLeft <= 90);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
    >
      <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Award className="w-5 h-5 text-personal" />
        資格期限通知
      </h2>
      {qualifications.length === 0 ? (
        <div className="text-center py-6">
          <Award className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500">登録された資格はありません</p>
        </div>
      ) : alertQuals.length === 0 ? (
        <div className="text-center py-6">
          <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
          <p className="text-sm text-gray-500">期限が近い資格はありません</p>
          <p className="text-xs text-gray-400 mt-1">登録資格数: {qualifications.length}件</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alertQuals.map((q) => (
            <div
              key={q.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                q.daysLeft <= 0
                  ? 'bg-red-50 border-red-200'
                  : q.daysLeft <= 30
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-yellow-50 border-yellow-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  q.daysLeft <= 0 ? 'bg-red-100' : q.daysLeft <= 30 ? 'bg-amber-100' : 'bg-yellow-100'
                }`}>
                  <AlertCircle className={`w-4 h-4 ${
                    q.daysLeft <= 0 ? 'text-red-600' : q.daysLeft <= 30 ? 'text-amber-600' : 'text-yellow-600'
                  }`} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{q.name}</p>
                  <p className="text-xs text-gray-500">
                    有効期限: {new Date(q.expiryDate).toLocaleDateString('ja-JP')}
                  </p>
                </div>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded ${
                q.daysLeft <= 0
                  ? 'bg-red-100 text-red-700'
                  : q.daysLeft <= 30
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {q.daysLeft <= 0 ? '期限切れ' : `あと${q.daysLeft}日`}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ========== 有給残日数表示セクション ==========
function CareerPaidLeaveBalance({ userId, activeEmployments }: { userId?: string; activeEmployments: EmploymentRecord[] }) {
  const [balances, setBalances] = useState<{ facilityName: string; totalDays: number; usedDays: number; remainingDays: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || activeEmployments.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const fetchBalances = async () => {
      setLoading(true);
      try {
        const facilityIds = activeEmployments.map(e => e.facilityId).filter(Boolean);
        if (facilityIds.length === 0) { if (!cancelled) setLoading(false); return; }

        const { data } = await supabase
          .from('paid_leave_balances')
          .select('facility_id, total_days, used_days, remaining_days')
          .eq('user_id', userId)
          .in('facility_id', facilityIds);

        if (!cancelled && data) {
          setBalances(
            data.map((b: any) => {
              const emp = activeEmployments.find(e => e.facilityId === b.facility_id);
              return {
                facilityName: emp?.facilityName || '施設',
                totalDays: b.total_days ?? 0,
                usedDays: b.used_days ?? 0,
                remainingDays: b.remaining_days ?? (b.total_days ?? 0) - (b.used_days ?? 0),
              };
            })
          );
        }
      } catch (e) {
        // silently ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchBalances();
    return () => { cancelled = true; };
  }, [userId, activeEmployments]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-personal" />
          <h2 className="text-lg font-bold text-gray-800">有給残日数</h2>
        </div>
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-personal" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
    >
      <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-personal" />
        有給残日数
      </h2>
      {balances.length === 0 ? (
        <div className="text-center py-6">
          <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500">有給休暇データがありません</p>
          <p className="text-xs text-gray-400 mt-1">施設側で有給管理が設定されると表示されます</p>
        </div>
      ) : (
        <div className="space-y-4">
          {balances.map((b, i) => {
            const usageRate = b.totalDays > 0 ? (b.usedDays / b.totalDays) * 100 : 0;
            return (
              <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-gray-800">{b.facilityName}</span>
                  <span className="text-xs text-gray-500">{b.usedDays}日消化 / {b.totalDays}日付与</span>
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl font-bold text-personal">{b.remainingDays}</span>
                  <span className="text-sm text-gray-500">日残り</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-personal h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(usageRate, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400">消化率: {usageRate.toFixed(0)}%</span>
                  {b.usedDays < 5 && (
                    <span className="text-xs text-amber-600 font-medium">
                      年5日以上の取得が必要です
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// RecommendedJobsSection は JobBrowsingTab に移行済み

// 時間帯に応じた挨拶を返すヘルパー
function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour <= 10) return 'おはようございます';
  if (hour >= 11 && hour <= 17) return 'お疲れさまです';
  return 'お疲れさまです。今日も一日ありがとうございました';
}

// リアルタイム経過時間表示コンポーネント
function WorkedTimeDisplay({ clockIn, clockOut, status }: { clockIn?: string; clockOut?: string; status: string }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!clockIn) return;

    const calcElapsed = () => {
      const start = new Date(clockIn).getTime();
      const end = clockOut ? new Date(clockOut).getTime() : Date.now();
      const diffMin = Math.floor((end - start) / 60000);
      const h = Math.floor(diffMin / 60);
      const m = diffMin % 60;
      return `${h}時間${m}分`;
    };

    setElapsed(calcElapsed());

    if (status === 'working' || status === 'on_break') {
      const timer = setInterval(() => setElapsed(calcElapsed()), 60000);
      return () => clearInterval(timer);
    }
    return undefined;
  }, [clockIn, clockOut, status]);

  if (!clockIn || !elapsed) return null;

  const label = status === 'completed' ? '勤務時間' : '経過';

  return (
    <span className="text-xs text-teal-700 font-medium ml-2">
      {label}: {elapsed}
    </span>
  );
}

export default function PersonalDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<UserType | null>(null);
  const [activeEmployments, setActiveEmployments] = useState<EmploymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [currentFacility, setCurrentFacility] = useState<EmploymentRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'work' | 'career' | 'docs' | 'settings'>('home');


  // 通知・アクション用の状態
  interface PersonalNotification {
    id: string;
    type: 'qualification_expiry' | 'experience_request' | 'facility_announcement' | 'leave_response' | 'expense_response';
    title: string;
    message: string;
    priority: 'high' | 'medium' | 'low';
    actionUrl?: string;
    actionLabel?: string;
    facilityId?: string;
    facilityName?: string;
    isRead: boolean;
    createdAt: string;
  }
  const [notifications, setNotifications] = useState<PersonalNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);

  // usePersonalData フック
  const {
    facilities: personalFacilities,
    isLoading: personalDataLoading,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    refresh: refreshPersonalData,
  } = usePersonalData();

  // キャリア自動蓄積フック
  const {
    tenureList,
    totalAttendanceDays,
    totalTrainingHours,
    qualificationsCount,
    timelineEvents,
    annualSummaries,
    isLoading: careerAccumulationLoading,
  } = useCareerAccumulation(user?.id || '');

  const [showAttendanceCalendar, setShowAttendanceCalendar] = useState(false);
  const [showShiftConfirmation, setShowShiftConfirmation] = useState(false);
  const [shiftConfirmationFacilityId, setShiftConfirmationFacilityId] = useState<string | null>(null);
  const [showShiftAvailabilityForm, setShowShiftAvailabilityForm] = useState(false);
  const [shiftAvailabilityFacility, setShiftAvailabilityFacility] = useState<{ id: string; name: string } | null>(null);
  const [facilitySettings, setFacilitySettings] = useState<Partial<FacilitySettings> | null>(null);

  // 管理画面アクセス権限の判定
  const bizAccessFacility = useMemo(() => {
    return activeEmployments.find((emp: any) =>
      emp.isMaster === true ||
      emp.role === '管理者' ||
      emp.role === 'マネージャー'
    ) || null;
  }, [activeEmployments]);
  const hasBizAccess = !!bizAccessFacility;

  // 管理画面への遷移（facilityIdクエリパラメータで施設指定）
  const navigateToBusiness = () => {
    if (!bizAccessFacility) return;
    const fid = (bizAccessFacility as any).facility_id || (bizAccessFacility as any).facilityId;
    if (!fid) return;
    router.push(`/business?facilityId=${fid}`);
  };

  // 本日の利用予定児童（業務タブ用）
  const [todaySchedules, setTodaySchedules] = useState<Record<string, { childId: string; childName: string; slot: string }[]>>({});
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  // 施設お知らせ（業務タブ用）
  const [facilityAnnouncements, setFacilityAnnouncements] = useState<Record<string, { id: string; title: string; message: string; createdAt: string }[]>>({});

  // ホームタブ: 施設アコーディオン開閉状態
  const [expandedFacilities, setExpandedFacilities] = useState<Set<string>>(new Set());

  // ホームタブ: 今日のシフト（施設ごと: 誰が出勤予定か）
  const [todayStaffShifts, setTodayStaffShifts] = useState<Record<string, { staffId: string; staffName: string; startTime: string | null; endTime: string | null; patternName: string | null }[]>>({});

  // ホームタブ: 今日の送迎担当（施設ごと）
  const [todayTransport, setTodayTransport] = useState<Record<string, { id: string; mode: 'pickup' | 'dropoff'; driverName: string | null; attendantName: string | null; status: string }[]>>({});

  // キャリアタブ用の状態
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    lastName: '',
    firstName: '',
    nameKana: '',
    lastNameKana: '',
    firstNameKana: '',
    email: '',
    birthDate: '',
    address: '',
    phone: '',
    gender: '',
    education: '',
    hasSpouse: false, // 配偶者の有無
    spouseName: '',
    myNumber: '',
    // 基礎年金番号
    basicPensionSymbol: '',
    basicPensionNumber: '',
    // 雇用保険
    employmentInsuranceStatus: 'not_joined' as 'joined' | 'not_joined' | 'first_time',
    employmentInsuranceNumber: '',
    previousRetirementDate: '',
    previousName: '',
    // 社会保険
    socialInsuranceStatus: 'not_joined' as 'joined' | 'not_joined',
    // 扶養家族
    hasDependents: false,
    dependentCount: 0,
    dependents: [] as Array<{
      id: string;
      name: string;
      furigana: string;
      relationship: string;
      birthDate: string;
      gender: 'male' | 'female';
      occupation: string;
      annualIncome: string;
      notWorking: boolean;
      notWorkingReason: string;
      myNumber: string;
      separateAddress?: string;
    }>,
  });
  const [educationHistory, setEducationHistory] = useState<Array<{
    id: string;
    schoolName: string;
    graduationDate: string;
    degree: string;
  }>>([]);
  const [qualifications, setQualifications] = useState<Array<{
    id: string;
    name: string;
    imageUrl?: string;
    status: 'approved' | 'pending' | 'not_registered';
  }>>([]);
  const [experienceRecords, setExperienceRecords] = useState<Array<{
    id: string;
    facilityName: string;
    startDate: string;
    endDate?: string;
    pdfUrl?: string;
    certificateStatus: 'approved' | 'pending' | 'not_requested';
  }>>([]);
  const [generatingPDF, setGeneratingPDF] = useState<'resume' | 'cv' | null>(null);
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [usePhotoInResume, setUsePhotoInResume] = useState(true);
  const [resumeEditData, setResumeEditData] = useState({
    nearestStation: '',
    commuteTime: '',
    motivation: '',
    personalRequests: '貴社規定に従います',
    healthStatus: '良好',
  });
  const [editingField, setEditingField] = useState<string | null>(null);
  const resumeRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const enrollmentCertRef = useRef<HTMLDivElement>(null);
  const trainingHistoryRef = useRef<HTMLDivElement>(null);
  const resumeFileInputRef = useRef<HTMLInputElement>(null);

  // 履歴書アップロード用の状態
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadedResumes, setUploadedResumes] = useState<Array<{
    id: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    uploadType: string;
    createdAt: string;
  }>>([]);
  const [showResumeUploadConfirm, setShowResumeUploadConfirm] = useState(false);
  const [lastUploadedFileName, setLastUploadedFileName] = useState('');

  // キャリア自動蓄積データ
  const [showAnnualDetails, setShowAnnualDetails] = useState(false);
  const [showFullTimeline, setShowFullTimeline] = useState(false);
  const [generatingExport, setGeneratingExport] = useState<string | null>(null);

  // 日付を和暦に変換
  const toJapaneseDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    if (year >= 2019 && (year > 2019 || month >= 5)) {
      return `令和${year - 2018}年${month}月`;
    }
    if (year >= 1989) {
      return `平成${year - 1988}年${month}月`;
    }
    return `昭和${year - 1925}年${month}月`;
  };

  // 年齢計算
  const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 0;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // 履歴書PDF生成
  const generateResumePDF = async () => {
    setGeneratingPDF('resume');
    try {
      if (!resumeRef.current) throw new Error('PDF生成に失敗しました');
      resumeRef.current.style.display = 'block';
      const canvas = await html2canvas(resumeRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      resumeRef.current.style.display = 'none';
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      pdf.addImage(imgData, 'PNG', imgX, 0, imgWidth * ratio, imgHeight * ratio);
      const fileName = `履歴書_${profileData.name}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('PDF生成エラー:', error);
      toast.error('PDF生成に失敗しました');
    } finally {
      setGeneratingPDF(null);
    }
  };

  // 職務経歴書PDF生成
  const generateCVPDF = async () => {
    setGeneratingPDF('cv');
    try {
      if (!cvRef.current) throw new Error('PDF生成に失敗しました');
      cvRef.current.style.display = 'block';
      const canvas = await html2canvas(cvRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      cvRef.current.style.display = 'none';
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      pdf.addImage(imgData, 'PNG', imgX, 0, imgWidth * ratio, imgHeight * ratio);
      const fileName = `職務経歴書_${profileData.name}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('PDF生成エラー:', error);
      toast.error('PDF生成に失敗しました');
    } finally {
      setGeneratingPDF(null);
    }
  };

  // 顔写真アップロード
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/profile-photo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);

      setProfilePhotoUrl(publicUrl);

      // DBに保存
      await supabase
        .from('users')
        .update({ profile_photo_url: publicUrl })
        .eq('id', user.id);

    } catch (error) {
      console.error('写真アップロードエラー:', error);
      toast.error('写真のアップロードに失敗しました');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // 既存の履歴書をアップロード
  const handleResumeFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingResume(true);
    try {
      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${user.id}/resumes/${timestamp}_${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      // DBに記録を保存
      const { data: insertData, error: insertError } = await supabase
        .from('resume_uploads')
        .insert({
          user_id: user.id,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          upload_type: 'resume',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // アップロード一覧を更新
      setUploadedResumes(prev => [{
        id: insertData.id,
        fileName: file.name,
        filePath: filePath,
        fileSize: file.size,
        uploadType: 'resume',
        createdAt: insertData.created_at,
      }, ...prev]);

      setLastUploadedFileName(file.name);
      setShowResumeUploadConfirm(true);
    } catch (error) {
      console.error('履歴書アップロードエラー:', error);
      toast.error('履歴書のアップロードに失敗しました');
    } finally {
      setUploadingResume(false);
      // inputをリセット
      if (resumeFileInputRef.current) {
        resumeFileInputRef.current.value = '';
      }
    }
  };

  // アップロード済み履歴書を取得
  const loadUploadedResumes = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('resume_uploads')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setUploadedResumes(data.map((r: any) => ({
          id: r.id,
          fileName: r.file_name,
          filePath: r.file_path,
          fileSize: r.file_size || 0,
          uploadType: r.upload_type || 'resume',
          createdAt: r.created_at,
        })));
      }
    } catch (err) {
      console.error('アップロード済み履歴書取得エラー:', err);
    }
  };

  // プレビューからPDF生成
  const generateFromPreview = async () => {
    setGeneratingPDF('resume');
    try {
      if (!resumeRef.current) throw new Error('PDF生成に失敗しました');
      resumeRef.current.style.display = 'block';
      const canvas = await html2canvas(resumeRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      resumeRef.current.style.display = 'none';
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      pdf.addImage(imgData, 'PNG', imgX, 0, imgWidth * ratio, imgHeight * ratio);
      const fileName = `履歴書_${profileData.name}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      setShowResumePreview(false);
    } catch (error) {
      console.error('PDF生成エラー:', error);
      toast.error('PDF生成に失敗しました');
    } finally {
      setGeneratingPDF(null);
    }
  };

  // 在籍証明書PDF生成
  const generateEnrollmentCertPDF = async () => {
    setGeneratingExport('enrollment');
    try {
      if (!enrollmentCertRef.current) throw new Error('PDF生成に失敗しました');
      enrollmentCertRef.current.style.display = 'block';
      const canvas = await html2canvas(enrollmentCertRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      enrollmentCertRef.current.style.display = 'none';
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      pdf.addImage(imgData, 'PNG', imgX, 0, imgWidth * ratio, imgHeight * ratio);
      const fileName = `在籍証明書_${profileData.name}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('PDF生成エラー:', error);
      toast.error('PDF生成に失敗しました');
    } finally {
      setGeneratingExport(null);
    }
  };

  // 研修受講履歴PDF生成
  const generateTrainingHistoryPDF = async () => {
    setGeneratingExport('training');
    try {
      if (!trainingHistoryRef.current) throw new Error('PDF生成に失敗しました');
      trainingHistoryRef.current.style.display = 'block';
      const canvas = await html2canvas(trainingHistoryRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      trainingHistoryRef.current.style.display = 'none';
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      pdf.addImage(imgData, 'PNG', imgX, 0, imgWidth * ratio, imgHeight * ratio);
      const fileName = `研修受講履歴_${profileData.name}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('PDF生成エラー:', error);
      toast.error('PDF生成に失敗しました');
    } finally {
      setGeneratingExport(null);
    }
  };

  useEffect(() => {
    const loadUserData = async () => {
      try {
        // セッションからユーザー情報を取得
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
          setIsRedirecting(true);
          router.replace('/login');
          return;
        }

        const userData = JSON.parse(storedUser);

        // 利用者（クライアント）の場合は利用者ダッシュボードへリダイレクト
        if (userData.userType === 'client') {
          setIsRedirecting(true);
          router.replace('/parent');
          return;
        }

        // データベースから最新のユーザー情報を取得（lastName、firstNameを取得するため）
        const { data: latestUserData, error: userFetchError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userData.id)
          .single();

        if (!userFetchError && latestUserData) {
          // 最新のユーザー情報でlocalStorageを更新
          const updatedUser = {
            ...userData,
            name: latestUserData.name || (latestUserData.last_name && latestUserData.first_name ? `${latestUserData.last_name} ${latestUserData.first_name}` : userData.name),
            lastName: latestUserData.last_name || userData.lastName,
            firstName: latestUserData.first_name || userData.firstName,
            birthDate: latestUserData.birth_date || userData.birthDate,
            gender: latestUserData.gender || userData.gender,
          };
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));

          // 顔写真URL読み込み
          if (latestUserData.profile_photo_url) {
            setProfilePhotoUrl(latestUserData.profile_photo_url);
          }
          
          setProfileData({
            name: updatedUser.name || '',
            lastName: latestUserData.last_name || '',
            firstName: latestUserData.first_name || '',
            nameKana: latestUserData.name_kana || '',
            lastNameKana: latestUserData.last_name_kana || '',
            firstNameKana: latestUserData.first_name_kana || '',
            email: updatedUser.email || '',
            birthDate: updatedUser.birthDate || '',
            address: userData.address || '',
            phone: userData.phone || '',
            gender: updatedUser.gender || '',
            education: userData.education || '',
            hasSpouse: !!userData.spouse_name, // 配偶者氏名がある場合はtrue
            spouseName: userData.spouse_name || '',
            myNumber: userData.my_number || '',
            basicPensionSymbol: userData.basic_pension_symbol || '',
            basicPensionNumber: userData.basic_pension_number || '',
            employmentInsuranceStatus: userData.employment_insurance_status || 'not_joined',
            employmentInsuranceNumber: userData.employment_insurance_number || '',
            previousRetirementDate: userData.previous_retirement_date || '',
            previousName: userData.previous_name || '',
            socialInsuranceStatus: userData.social_insurance_status || 'not_joined',
            hasDependents: userData.has_dependents || false,
            dependentCount: userData.dependent_count || 0,
            dependents: userData.dependents || [],
          });
        } else {
          // データベースから取得できない場合は、localStorageの情報を使用
          setUser(userData);
          setProfileData({
            name: userData.name || '',
            lastName: userData.lastName || userData.last_name || '',
            firstName: userData.firstName || userData.first_name || '',
            nameKana: userData.nameKana || userData.name_kana || '',
            lastNameKana: userData.lastNameKana || userData.last_name_kana || '',
            firstNameKana: userData.firstNameKana || userData.first_name_kana || '',
            email: userData.email || '',
            birthDate: userData.birthDate || userData.birth_date || '',
            address: userData.address || '',
            phone: userData.phone || '',
            gender: userData.gender || '',
            education: userData.education || '',
            hasSpouse: !!userData.spouse_name, // 配偶者氏名がある場合はtrue
            spouseName: userData.spouse_name || '',
            myNumber: userData.my_number || '',
            basicPensionSymbol: userData.basic_pension_symbol || '',
            basicPensionNumber: userData.basic_pension_number || '',
            employmentInsuranceStatus: userData.employment_insurance_status || 'not_joined',
            employmentInsuranceNumber: userData.employment_insurance_number || '',
            previousRetirementDate: userData.previous_retirement_date || '',
            previousName: userData.previous_name || '',
            socialInsuranceStatus: userData.social_insurance_status || 'not_joined',
            hasDependents: userData.has_dependents || false,
            dependentCount: userData.dependent_count || 0,
            dependents: userData.dependents || [],
          });
        }

        // アクティブな所属関係を取得
        const { data: employments, error } = await supabase
          .from('employment_records')
          .select(`
            *,
            facilities:facility_id (
              id,
              name,
              code,
              owner_user_id
            )
          `)
          .eq('user_id', userData.id)
          .is('end_date', null)
          .order('start_date', { ascending: false });

        if (error) {
          console.error('所属関係取得エラー:', error);
        } else if (employments && employments.length > 0) {
          // SupabaseのJOIN結果を処理
          const processedEmployments = employments.map((emp: any) => ({
            ...emp,
            facilityId: emp.facility_id || emp.facilityId, // スネークケースとキャメルケースの両方に対応
            facilityName: emp.facilities?.name || emp.facilityName,
            facilityCode: emp.facilities?.code || emp.facilityCode,
            isMaster: emp.facilities?.owner_user_id === userData.id, // マスター管理者かどうか
          }));
          setActiveEmployments(processedEmployments as any);
          setCurrentFacility(processedEmployments[0] as any);
          
          // 施設設定を取得
          // facility_idを取得（スネークケースとキャメルケースの両方に対応）
          const targetFacilityId = processedEmployments[0]?.facility_id || processedEmployments[0]?.facilityId;
          
          if (targetFacilityId) {
            const { data: settingsData, error: settingsError } = await supabase
              .from('facility_settings')
              .select('*')
              .eq('facility_id', targetFacilityId)
              .single();
            
            if (!settingsError && settingsData) {
              // holiday_periodsの処理（JSONBとして保存されている）
              // SupabaseクライアントはJSONBを自動的にパースしてくれるが、念のため処理
              let holidayPeriods: any[] = [];
              if (settingsData.holiday_periods) {
                if (Array.isArray(settingsData.holiday_periods)) {
                  // 既に配列として取得できている場合
                  holidayPeriods = settingsData.holiday_periods;
                } else if (typeof settingsData.holiday_periods === 'object' && settingsData.holiday_periods !== null) {
                  // オブジェクトの場合（JSONBがオブジェクトとして返された場合）
                  // これは通常起こらないが、念のため
                  holidayPeriods = [settingsData.holiday_periods];
                } else if (typeof settingsData.holiday_periods === 'string') {
                  // 文字列の場合（JSON文字列として保存されている場合）
                  try {
                    const parsed = JSON.parse(settingsData.holiday_periods);
                    holidayPeriods = Array.isArray(parsed) ? parsed : [];
                  } catch (e) {
                    console.error('holiday_periodsのパースエラー:', e);
                    holidayPeriods = [];
                  }
                }
              }
              
              // custom_holidaysの処理（TEXT[]として保存されている）
              // PostgreSQLの配列型はSupabaseクライアントが自動的に配列として返す
              let customHolidays: string[] = [];
              if (settingsData.custom_holidays) {
                if (Array.isArray(settingsData.custom_holidays)) {
                  // 既に配列として取得できている場合
                  customHolidays = settingsData.custom_holidays.filter((d: any) => d && typeof d === 'string');
                } else if (typeof settingsData.custom_holidays === 'string') {
                  // 文字列の場合（JSON文字列として保存されている場合）
                  try {
                    const parsed = JSON.parse(settingsData.custom_holidays);
                    customHolidays = Array.isArray(parsed) ? parsed.filter((d: any) => d && typeof d === 'string') : [];
                  } catch (e) {
                    console.error('custom_holidaysのパースエラー:', e);
                    customHolidays = [];
                  }
                }
              }
              
              setFacilitySettings({
                id: settingsData.id,
                facilityId: settingsData.facility_id,
                facilityName: settingsData.facility_name || '',
                regularHolidays: settingsData.regular_holidays || [0],
                holidayPeriods: holidayPeriods,
                customHolidays: customHolidays,
                includeHolidays: settingsData.include_holidays || false,
                businessHours: settingsData.business_hours || {
                  AM: { start: '09:00', end: '12:00' },
                  PM: { start: '13:00', end: '18:00' },
                },
                capacity: settingsData.capacity || {
                  AM: 0, // 未設定時は0
                  PM: 0,
                },
                createdAt: settingsData.created_at || new Date().toISOString(),
                updatedAt: settingsData.updated_at || new Date().toISOString(),
              });
            }
          }
        }
      } catch (err) {
        console.error('データ読み込みエラー:', err);
        setIsRedirecting(true);
        router.replace('/login');
      } finally {
        if (!isRedirecting) {
          setLoading(false);
        }
      }
    };

    loadUserData();
  }, [router, isRedirecting]);

  // アップロード済み履歴書を取得
  useEffect(() => {
    if (user?.id) {
      loadUploadedResumes();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // 通知・アクションを取得
  useEffect(() => {
    if (!user?.id) {
      setLoadingNotifications(false);
      return;
    }

    const fetchNotifications = async () => {
      setLoadingNotifications(true);
      const allNotifications: PersonalNotification[] = [];

      try {
        // 1. ユーザーに紐づく通知を取得（notificationsテーブルから）
        const facilityIds = activeEmployments.map(emp => emp.facilityId).filter(Boolean);

        if (facilityIds.length > 0) {
          const { data: notifData, error: notifError } = await supabase
            .from('notifications')
            .select('*')
            .in('facility_id', facilityIds)
            .or(`user_id.eq.${user.id},user_id.is.null`)
            .eq('is_read', false)
            .order('created_at', { ascending: false })
            .limit(10);

          if (!notifError && notifData) {
            notifData.forEach((n: any) => {
              const facility = activeEmployments.find(emp => emp.facilityId === n.facility_id);
              allNotifications.push({
                id: n.id,
                type: n.type as any || 'facility_announcement',
                title: n.title,
                message: n.message,
                priority: 'medium',
                facilityId: n.facility_id,
                facilityName: facility?.facilityName || '',
                isRead: n.is_read,
                createdAt: n.created_at,
              });
            });
          }
        }

        // 2. 実務経験証明の依頼をチェック（他の施設からの依頼）
        // experience_verification_statusが'requested'のemployment_recordsを探す
        // 注: これは自分が依頼を受けているケースではなく、
        //     自分の実務経験証明が承認待ちかどうかをチェック
        const { data: expData, error: expError } = await supabase
          .from('employment_records')
          .select('*, facilities:facility_id(name)')
          .eq('user_id', user.id)
          .eq('experience_verification_status', 'requested');

        if (!expError && expData && expData.length > 0) {
          expData.forEach((emp: any) => {
            allNotifications.push({
              id: `exp-${emp.id}`,
              type: 'experience_request',
              title: '実務経験証明の承認待ち',
              message: `${emp.facilities?.name || '施設'}での実務経験証明が承認待ちです。`,
              priority: 'medium',
              facilityId: emp.facility_id,
              facilityName: emp.facilities?.name || '',
              isRead: false,
              createdAt: emp.experience_verification_requested_at || emp.created_at,
            });
          });
        }

        setNotifications(allNotifications);
      } catch (err) {
        console.error('通知取得エラー:', err);
      } finally {
        setLoadingNotifications(false);
      }
    };

    fetchNotifications();
  }, [user?.id, activeEmployments]);

  // ホームタブ：本日の利用予定児童とお知らせを取得
  useEffect(() => {
    if ((activeTab !== 'home' && activeTab !== 'work') || personalFacilities.length === 0) return;

    const fetchTodaySchedulesAndAnnouncements = async () => {
      setLoadingSchedules(true);
      const today = new Date().toISOString().split('T')[0];
      const facilityIds = personalFacilities.map(f => f.facilityId);

      try {
        // 本日のスケジュールを取得
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('schedules')
          .select('child_id, child_name, slot, facility_id')
          .in('facility_id', facilityIds)
          .eq('date', today);

        if (!scheduleError && scheduleData) {
          const grouped: Record<string, { childId: string; childName: string; slot: string }[]> = {};
          scheduleData.forEach((s: any) => {
            if (!grouped[s.facility_id]) grouped[s.facility_id] = [];
            grouped[s.facility_id].push({
              childId: s.child_id,
              childName: s.child_name,
              slot: s.slot,
            });
          });
          setTodaySchedules(grouped);
        }

        // 施設お知らせを取得（notificationsテーブルから施設全体向け）
        if (facilityIds.length > 0) {
          const { data: announcementData, error: announcementError } = await supabase
            .from('notifications')
            .select('id, title, message, created_at, facility_id')
            .in('facility_id', facilityIds)
            .is('user_id', null)
            .order('created_at', { ascending: false })
            .limit(5);

          if (!announcementError && announcementData) {
            const grouped: Record<string, { id: string; title: string; message: string; createdAt: string }[]> = {};
            announcementData.forEach((a: any) => {
              if (!grouped[a.facility_id]) grouped[a.facility_id] = [];
              grouped[a.facility_id].push({
                id: a.id,
                title: a.title,
                message: a.message,
                createdAt: a.created_at,
              });
            });
            setFacilityAnnouncements(grouped);
          }
        }
      } catch (err) {
        console.error('業務データ取得エラー:', err);
      } finally {
        setLoadingSchedules(false);
      }
    };

    fetchTodaySchedulesAndAnnouncements();
  }, [activeTab, personalFacilities]);

  // ホームタブ: 今日のシフト担当 + 送迎担当を取得
  useEffect(() => {
    if ((activeTab !== 'home' && activeTab !== 'work') || personalFacilities.length === 0) return;
    let cancelled = false;

    const fetchTodayShiftsAndTransport = async () => {
      const today = new Date().toISOString().split('T')[0];
      const facilityIds = personalFacilities.map(f => f.facilityId);

      try {
        // 今日のシフトを取得（全スタッフ）
        const { data: shiftData } = await supabase
          .from('shifts')
          .select('staff_id, facility_id, start_time, end_time, has_shift, shift_pattern_id, shift_patterns(name)')
          .in('facility_id', facilityIds)
          .eq('date', today)
          .eq('has_shift', true);

        if (!cancelled && shiftData) {
          // staff_id → 名前を解決
          const staffIds = [...new Set(shiftData.map((s: any) => s.staff_id).filter(Boolean))];
          const normalIds = staffIds.filter(id => !id.startsWith('emp-'));
          const empIds = staffIds.filter(id => id.startsWith('emp-')).map(id => id.replace('emp-', ''));
          const nameMap: Record<string, string> = {};

          if (normalIds.length > 0) {
            const { data: staffRows } = await supabase.from('staff').select('id, name').in('id', normalIds);
            staffRows?.forEach((s: any) => { nameMap[s.id] = s.name; });
          }
          if (empIds.length > 0) {
            const { data: empRows } = await supabase
              .from('employment_records')
              .select('id, users!inner(last_name, first_name)')
              .in('id', empIds);
            empRows?.forEach((r: any) => {
              nameMap[`emp-${r.id}`] = `${r.users?.last_name || ''}${r.users?.first_name || ''}`;
            });
          }

          const grouped: Record<string, typeof todayStaffShifts[string]> = {};
          shiftData.forEach((s: any) => {
            if (!grouped[s.facility_id]) grouped[s.facility_id] = [];
            grouped[s.facility_id].push({
              staffId: s.staff_id,
              staffName: nameMap[s.staff_id] || s.staff_id,
              startTime: s.start_time || null,
              endTime: s.end_time || null,
              patternName: (s.shift_patterns as any)?.name || null,
            });
          });
          if (!cancelled) setTodayStaffShifts(grouped);
        }

        // 今日の送迎セッションを取得
        const { data: transportData } = await supabase
          .from('transport_sessions')
          .select('id, mode, status, driver_staff_id, attendant_staff_id')
          .in('facility_id', facilityIds)
          .eq('date', today)
          .in('status', ['preparing', 'active', 'completed']);

        if (!cancelled && transportData && transportData.length > 0) {
          // ドライバー・添乗員の名前を解決
          const allIds = [...new Set([
            ...transportData.map((t: any) => t.driver_staff_id),
            ...transportData.map((t: any) => t.attendant_staff_id),
          ].filter(Boolean))];
          const tNormalIds = allIds.filter(id => !id.startsWith('emp-'));
          const tEmpIds = allIds.filter(id => id.startsWith('emp-')).map(id => id.replace('emp-', ''));
          const tNameMap: Record<string, string> = {};

          if (tNormalIds.length > 0) {
            const { data: staffRows } = await supabase.from('staff').select('id, name').in('id', tNormalIds);
            staffRows?.forEach((s: any) => { tNameMap[s.id] = s.name; });
          }
          if (tEmpIds.length > 0) {
            const { data: empRows } = await supabase
              .from('employment_records')
              .select('id, users!inner(last_name, first_name)')
              .in('id', tEmpIds);
            empRows?.forEach((r: any) => {
              tNameMap[`emp-${r.id}`] = `${r.users?.last_name || ''}${r.users?.first_name || ''}`;
            });
          }

          // 施設IDを取得するために再度クエリ（transport_sessionsにfacility_idあり）
          const { data: transportWithFacility } = await supabase
            .from('transport_sessions')
            .select('id, mode, status, driver_staff_id, attendant_staff_id, facility_id')
            .in('facility_id', facilityIds)
            .eq('date', today)
            .in('status', ['preparing', 'active', 'completed']);

          if (!cancelled && transportWithFacility) {
            const grouped: Record<string, typeof todayTransport[string]> = {};
            transportWithFacility.forEach((t: any) => {
              if (!grouped[t.facility_id]) grouped[t.facility_id] = [];
              grouped[t.facility_id].push({
                id: t.id,
                mode: t.mode,
                driverName: t.driver_staff_id ? (tNameMap[t.driver_staff_id] || null) : null,
                attendantName: t.attendant_staff_id ? (tNameMap[t.attendant_staff_id] || null) : null,
                status: t.status,
              });
            });
            if (!cancelled) setTodayTransport(grouped);
          }
        }
      } catch (err) {
        console.error('シフト・送迎データ取得エラー:', err);
      }
    };

    fetchTodayShiftsAndTransport();
    return () => { cancelled = true; };
  }, [activeTab, personalFacilities]);

  // 施設アコーディオン開閉（初期: 最初の施設を開く）
  useEffect(() => {
    if (personalFacilities.length > 0 && expandedFacilities.size === 0) {
      setExpandedFacilities(new Set([personalFacilities[0].facilityId]));
    }
  }, [personalFacilities]);

  const toggleFacilityExpand = (facilityId: string) => {
    setExpandedFacilities(prev => {
      const next = new Set(prev);
      if (next.has(facilityId)) next.delete(facilityId);
      else next.add(facilityId);
      return next;
    });
  };

  // ログアウト処理
  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/career/login');
  };

  // リダイレクト中は何も表示しない
  if (isRedirecting) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-personal" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー部分（ロゴとCareerラベル） */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src="/logo.svg" alt="Roots" width={120} height={32} className="h-8 w-auto object-contain" priority />
              <span className="text-xs font-bold px-2 py-1 rounded bg-personal text-white">
                キャリア
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* ① アイデンティティ・エリア */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              {/* 顔写真 - クリックでアップロード */}
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-personal hover:border-personal-dark transition-colors group"
              >
                {profilePhotoUrl ? (
                  <img src={profilePhotoUrl} alt="プロフィール写真" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-personal flex items-center justify-center">
                    <User className="w-8 h-8 text-white" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploadingPhoto ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 text-white" />
                  )}
                </div>
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <div>
                <p className="text-xs text-gray-400">{getTimeGreeting()}</p>
                <h1 className="text-2xl font-bold text-gray-800">
                  {user.lastName && user.firstName
                    ? `${user.lastName} ${user.firstName}`
                    : user.name || user.email}
                </h1>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
            </div>
          </div>

          {/* 認証バッジ */}
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              本人確認済
            </span>
            {/* 資格認証バッジは後で追加 */}
          </div>
        </div>
      </div>

      {/* タブコンテンツ */}
      {activeTab === 'home' && (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4 pb-24">
        {/* 日付 */}
        <h2 className="text-lg font-bold text-gray-800">
          {new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
        </h2>

        {/* オーナー */}
        {user?.role === 'owner' && (
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-4 text-white flex items-center gap-3">
            <Shield className="w-5 h-5" />
            <span className="flex-1 font-bold text-sm">プラットフォーム管理</span>
            <button onClick={() => router.push('/admin')} className="bg-white/20 hover:bg-white/30 text-sm font-bold px-3 py-1.5 rounded-lg transition-colors">管理画面</button>
          </div>
        )}
        <AdminAccessLink userId={user?.id} />

        {/* 通知 */}
        {!loadingNotifications && notifications.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <Bell className="w-4 h-4 text-red-500" />
            <span className="text-sm font-bold text-red-700">{notifications.length}件の通知</span>
          </div>
        )}

        {/* 所属施設 — タップで業務タブへ */}
        {personalFacilities.length > 0 ? personalFacilities.map((facility) => {
          const status = facility.todayAttendance?.status || 'not_started';
          return (
            <motion.div
              key={`home-${facility.facilityId}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setActiveTab('work')}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 cursor-pointer hover:border-personal/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-teal-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate">{facility.facilityName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-personal/10 text-personal">
                      {facility.employmentRecord.role || 'スタッフ'}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      status === 'completed' ? 'bg-gray-200 text-gray-600' :
                      status === 'working' ? 'bg-teal-100 text-teal-700' :
                      status === 'on_break' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {status === 'completed' ? '退勤済' : status === 'working' ? '勤務中' : status === 'on_break' ? '休憩中' : '未出勤'}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
              </div>
            </motion.div>
          );
        }) : (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">所属施設がありません</p>
          </div>
        )}
      </div>
      )}

      {/* 勤怠カレンダーモーダル */}
      {showAttendanceCalendar && currentFacility && user && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="max-w-4xl w-full max-h-[95vh] overflow-y-auto">
            <AttendanceCalendar
              userId={user.id}
              facilityId={currentFacility.facilityId}
              facilityName={currentFacility.facilityName || '施設'}
              facilitySettings={facilitySettings}
              onClose={() => setShowAttendanceCalendar(false)}
            />
          </div>
        </div>
      )}

      {/* シフト確認モーダル */}
      {showShiftConfirmation && shiftConfirmationFacilityId && user && (() => {
        const facilityData = personalFacilities.find(f => f.facilityId === shiftConfirmationFacilityId);
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full max-h-[95vh] overflow-y-auto bg-white rounded-xl">
              <ShiftConfirmationView
                userId={user.id}
                facilityId={shiftConfirmationFacilityId}
                facilityName={facilityData?.facilityName || '施設'}
                onClose={() => {
                  setShowShiftConfirmation(false);
                  setShiftConfirmationFacilityId(null);
                }}
              />
            </div>
          </div>
        );
      })()}

      {/* 希望シフト提出モーダル */}
      {showShiftAvailabilityForm && shiftAvailabilityFacility && user && (
        <ShiftAvailabilityForm
          userId={user.id}
          facilityId={shiftAvailabilityFacility.id}
          facilityName={shiftAvailabilityFacility.name}
          onClose={() => {
            setShowShiftAvailabilityForm(false);
            setShiftAvailabilityFacility(null);
          }}
        />
      )}

      {activeTab === 'work' && (
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4 pb-24">
          {/* 施設アコーディオン */}
          {personalFacilities.length > 0 ? personalFacilities.map((facility) => {
            const isExpanded = expandedFacilities.has(facility.facilityId);
            const attendance = facility.todayAttendance;
            const status = attendance?.status || 'not_started';
            const schedules = todaySchedules[facility.facilityId] || [];
            const shifts = todayStaffShifts[facility.facilityId] || [];
            const transports = todayTransport[facility.facilityId] || [];
            const role = facility.employmentRecord.role || 'スタッフ';
            const canManage = role === '管理者' || role === 'マネージャー';

            return (
              <motion.div
                key={`work-${facility.facilityId}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
              >
                {/* ヘッダー（タップで開閉） */}
                <button
                  onClick={() => toggleFacilityExpand(facility.facilityId)}
                  className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 truncate">{facility.facilityName}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-personal/10 text-personal shrink-0">{role}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        status === 'completed' ? 'bg-gray-200 text-gray-600' :
                        status === 'working' ? 'bg-teal-100 text-teal-700' :
                        status === 'on_break' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {status === 'completed' ? '退勤済' : status === 'working' ? '勤務中' : status === 'on_break' ? '休憩中' : '未出勤'}
                      </span>
                      {attendance?.startTime && (
                        <span className="text-[11px] text-gray-400">{attendance.startTime}{attendance.endTime && ` → ${attendance.endTime}`}</span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />}
                </button>

                {/* 展開コンテンツ */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {/* 出勤・退勤ボタン */}
                    <div className="px-4 py-3 bg-gradient-to-r from-teal-50/50 to-cyan-50/50">
                      {status === 'not_started' && (
                        <button onClick={() => clockIn(facility.facilityId)} className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
                          <PlayCircle className="w-4 h-4" /> 出勤する
                        </button>
                      )}
                      {status === 'working' && (
                        <div className="flex gap-2">
                          <button onClick={() => startBreak(facility.facilityId)} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
                            <Coffee className="w-4 h-4" /> 休憩
                          </button>
                          <button onClick={() => clockOut(facility.facilityId)} className="flex-1 py-2.5 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg text-sm transition-colors">退勤する</button>
                        </div>
                      )}
                      {status === 'on_break' && (
                        <button onClick={() => endBreak(facility.facilityId)} className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-sm transition-colors">休憩終了</button>
                      )}
                      {status === 'completed' && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">お疲れさまでした</span>
                          {attendance?.startTime && (
                            <WorkedTimeDisplay clockIn={attendance.startTime} clockOut={attendance.endTime} status={status} />
                          )}
                        </div>
                      )}
                      {status === 'working' && attendance?.startTime && (
                        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                          <span>出勤: {attendance.startTime}</span>
                          <WorkedTimeDisplay clockIn={attendance.startTime} clockOut={attendance.endTime} status={status} />
                        </div>
                      )}
                    </div>

                    {/* アクションボタン */}
                    <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-100">
                      <button
                        onClick={() => { setShiftConfirmationFacilityId(facility.facilityId); setShowShiftConfirmation(true); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs font-bold text-gray-700 transition-colors"
                      >
                        <ClipboardList className="w-3.5 h-3.5" /> シフト確認
                      </button>
                      <button
                        onClick={() => { setCurrentFacility(facility.employmentRecord); setShowAttendanceCalendar(true); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs font-bold text-gray-700 transition-colors"
                      >
                        <Calendar className="w-3.5 h-3.5" /> 勤怠
                      </button>
                      {canManage && (
                        <button
                          onClick={() => {
                            localStorage.setItem('selectedFacility', JSON.stringify({ id: facility.facilityId, name: facility.facilityName, code: facility.facilityCode, role }));
                            localStorage.setItem('facility', JSON.stringify({ id: facility.facilityId, name: facility.facilityName, code: facility.facilityCode, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
                            window.location.href = `/business?facilityId=${facility.facilityId}`;
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-personal/10 hover:bg-personal/20 rounded-lg text-xs font-bold text-personal transition-colors"
                        >
                          <Briefcase className="w-3.5 h-3.5" /> 管理画面
                        </button>
                      )}
                    </div>

                    {/* 今日のシフト */}
                    {shifts.length > 0 && (
                      <div className="px-4 py-3 border-b border-gray-100">
                        <h4 className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" /> 本日の出勤スタッフ（{shifts.length}名）
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {shifts.map((s) => (
                            <span key={s.staffId} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-lg text-xs text-gray-700">
                              <UserCheck className="w-3 h-3 text-teal-500" />
                              {s.staffName}
                              {s.startTime && <span className="text-gray-400">{s.startTime.slice(0, 5)}{s.endTime && `~${s.endTime.slice(0, 5)}`}</span>}
                              {!s.startTime && s.patternName && <span className="text-gray-400">{s.patternName}</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 送迎 */}
                    {transports.length > 0 && (
                      <div className="px-4 py-3 border-b border-gray-100">
                        <h4 className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1.5">
                          <Bus className="w-3.5 h-3.5" /> 送迎
                        </h4>
                        <div className="space-y-1.5">
                          {transports.map((t) => (
                            <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg text-xs">
                              <span className={`font-bold px-1.5 py-0.5 rounded ${t.mode === 'pickup' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                {t.mode === 'pickup' ? '迎え' : '送り'}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded ${t.status === 'active' ? 'bg-green-100 text-green-700' : t.status === 'completed' ? 'bg-gray-200 text-gray-600' : 'bg-yellow-100 text-yellow-700'}`}>
                                {t.status === 'active' ? '進行中' : t.status === 'completed' ? '完了' : '準備中'}
                              </span>
                              {t.driverName && <span className="text-gray-700">運転: <b>{t.driverName}</b></span>}
                              {t.attendantName && <span className="text-gray-700">添乗: <b>{t.attendantName}</b></span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 利用予定児童 */}
                    {schedules.length > 0 && (
                      <div className="px-4 py-3">
                        <h4 className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" /> 利用予定（{schedules.length}名）
                        </h4>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {schedules.map((child: any, idx: number) => (
                            <div key={`${child.childId}-${child.slot}-${idx}`} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50">
                              <span className="text-xs text-gray-800">{child.childName}</span>
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{slotDisplayName(DEFAULT_SLOTS, child.slot)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          }) : (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">所属施設がありません</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'career' && (
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

          {/* ===== キャリアサマリー ===== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-personal" />
              キャリアサマリー
            </h2>
            <p className="text-xs text-gray-500 mb-4">出勤・研修・資格データから自動で集計されます</p>

            {careerAccumulationLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-personal" />
              </div>
            ) : (
              <>
                {/* 統計カード */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {/* 在籍日数 */}
                  <div className="bg-personal/5 border border-personal/20 rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Calendar className="w-5 h-5 text-personal" />
                    </div>
                    <p className="text-2xl font-bold text-personal">
                      {tenureList.length > 0 ? tenureList[0].totalDays.toLocaleString() : 0}
                    </p>
                    <p className="text-xs text-gray-600 font-bold mt-1">在籍日数</p>
                    {tenureList.length > 0 && tenureList[0].totalDays > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {tenureList[0].years > 0 && `${tenureList[0].years}年`}
                        {tenureList[0].months > 0 && `${tenureList[0].months}ヶ月`}
                        {tenureList[0].days > 0 && `${tenureList[0].days}日`}
                      </p>
                    )}
                  </div>

                  {/* 総出勤日数 */}
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                      {totalAttendanceDays.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-600 font-bold mt-1">総出勤日数</p>
                    <p className="text-xs text-gray-400 mt-0.5">自動カウント</p>
                  </div>

                  {/* 総研修時間 */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <GraduationCap className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-2xl font-bold text-blue-600">
                      {totalTrainingHours.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-600 font-bold mt-1">総研修時間</p>
                    <p className="text-xs text-gray-400 mt-0.5">時間</p>
                  </div>

                  {/* 保有資格数 */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Award className="w-5 h-5 text-amber-600" />
                    </div>
                    <p className="text-2xl font-bold text-amber-600">
                      {qualificationsCount + qualifications.length}
                    </p>
                    <p className="text-xs text-gray-600 font-bold mt-1">保有資格数</p>
                    <p className="text-xs text-gray-400 mt-0.5">件</p>
                  </div>
                </div>

                {/* キャリアタイムライン */}
                {timelineEvents.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-personal" />
                      キャリアタイムライン
                    </h3>
                    <div className="relative pl-6 border-l-2 border-personal/30">
                      {(showFullTimeline ? timelineEvents : timelineEvents.slice(0, 5)).map((event: CareerTimelineEvent) => {
                        const getEventStyle = () => {
                          switch (event.type) {
                            case 'employment_start':
                              return { dotColor: 'bg-personal', icon: Building2, label: '入社' };
                            case 'employment_end':
                              return { dotColor: 'bg-gray-400', icon: Building2, label: '退社' };
                            case 'qualification':
                              return { dotColor: 'bg-amber-500', icon: Award, label: '資格' };
                            case 'training':
                              return { dotColor: 'bg-blue-500', icon: GraduationCap, label: '研修' };
                            case 'certificate_issued':
                              return { dotColor: 'bg-green-500', icon: FileCheck, label: '証明書' };
                            case 'role_change':
                              return { dotColor: 'bg-purple-500', icon: TrendingUp, label: '昇進' };
                            default:
                              return { dotColor: 'bg-gray-400', icon: Clock, label: '' };
                          }
                        };
                        const style = getEventStyle();
                        const EventIcon = style.icon;

                        return (
                          <div key={event.id} className="relative mb-4 last:mb-0">
                            <div className={`absolute -left-[25px] w-3 h-3 rounded-full ${style.dotColor} border-2 border-white`} />
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                              <div className="flex items-center gap-2 mb-1">
                                <EventIcon className="w-3.5 h-3.5 text-gray-500" />
                                <span className="text-xs text-gray-400">
                                  {new Date(event.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })}
                                </span>
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                  event.type === 'employment_start' ? 'bg-personal/10 text-personal' :
                                  event.type === 'qualification' ? 'bg-amber-100 text-amber-700' :
                                  event.type === 'training' ? 'bg-blue-100 text-blue-700' :
                                  event.type === 'certificate_issued' ? 'bg-green-100 text-green-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {style.label}
                                </span>
                              </div>
                              <p className="text-sm font-bold text-gray-800">{event.title}</p>
                              <p className="text-xs text-gray-500">{event.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {timelineEvents.length > 5 && (
                      <button
                        onClick={() => setShowFullTimeline(!showFullTimeline)}
                        className="mt-3 flex items-center gap-1 text-sm text-personal hover:text-personal-dark font-bold mx-auto"
                      >
                        {showFullTimeline ? (
                          <>
                            <ChevronUp className="w-4 h-4" />
                            閉じる
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4" />
                            すべて表示（{timelineEvents.length}件）
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* 年度別サマリー */}
                {annualSummaries.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowAnnualDetails(!showAnnualDetails)}
                      className="w-full flex items-center justify-between text-sm font-bold text-gray-700 mb-3 hover:text-personal transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-personal" />
                        年度別キャリアサマリー
                      </span>
                      {showAnnualDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {showAnnualDetails && (
                      <div className="space-y-2">
                        {annualSummaries.map((summary) => (
                          <div key={summary.year} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-bold text-gray-800">{summary.year}年</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                              <div className="flex items-center gap-1">
                                <CheckCircle className="w-3 h-3 text-green-500" />
                                <span className="text-gray-600">出勤:</span>
                                <span className="font-bold text-gray-800">{summary.attendanceDays}日</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <GraduationCap className="w-3 h-3 text-blue-500" />
                                <span className="text-gray-600">研修:</span>
                                <span className="font-bold text-gray-800">{summary.trainingHours}時間</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Award className="w-3 h-3 text-amber-500" />
                                <span className="text-gray-600">新規資格:</span>
                                <span className="font-bold text-gray-800">{summary.newQualifications}件</span>
                              </div>
                              {summary.roleChanges.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3 text-personal" />
                                  <span className="text-gray-600">役職:</span>
                                  <span className="font-bold text-gray-800 truncate">{summary.roleChanges[0]}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </motion.div>

          {/* ===== 書類ワンクリック出力 ===== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
              <Download className="w-5 h-5 text-personal" />
              書類ワンクリック出力
            </h2>
            <p className="text-xs text-gray-500 mb-4">蓄積されたキャリアデータから各種書類をPDFで出力できます</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* 履歴書 */}
              <button
                onClick={() => setShowResumePreview(true)}
                className="flex items-center gap-3 p-4 bg-personal/5 border border-personal/20 rounded-xl hover:bg-personal/10 transition-colors text-left group"
              >
                <div className="w-10 h-10 bg-personal rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800 group-hover:text-personal">履歴書</p>
                  <p className="text-xs text-gray-500">プレビュー・編集してPDF出力</p>
                </div>
              </button>

              {/* 職務経歴書 */}
              <button
                onClick={generateCVPDF}
                disabled={generatingPDF !== null}
                className="flex items-center gap-3 p-4 bg-personal/5 border border-personal/20 rounded-xl hover:bg-personal/10 transition-colors text-left group disabled:opacity-50"
              >
                <div className="w-10 h-10 bg-personal rounded-lg flex items-center justify-center flex-shrink-0">
                  {generatingPDF === 'cv' ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Briefcase className="w-5 h-5 text-white" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800 group-hover:text-personal">職務経歴書</p>
                  <p className="text-xs text-gray-500">職歴・資格から自動生成</p>
                </div>
              </button>

              {/* 実務経験証明書 */}
              <button
                onClick={() => {
                  const workExpSection = document.getElementById('work-experience-section');
                  if (workExpSection) workExpSection.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors text-left group"
              >
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800 group-hover:text-green-700">実務経験証明書</p>
                  <p className="text-xs text-gray-500">下部の職歴セクションから依頼</p>
                </div>
              </button>

              {/* 在籍証明書 */}
              <button
                onClick={generateEnrollmentCertPDF}
                disabled={generatingExport !== null}
                className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors text-left group disabled:opacity-50"
              >
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  {generatingExport === 'enrollment' ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Building2 className="w-5 h-5 text-white" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800 group-hover:text-blue-700">在籍証明書</p>
                  <p className="text-xs text-gray-500">現在の所属情報をPDF出力</p>
                </div>
              </button>

              {/* 研修受講履歴 */}
              <button
                onClick={generateTrainingHistoryPDF}
                disabled={generatingExport !== null}
                className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors text-left group disabled:opacity-50"
              >
                <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  {generatingExport === 'training' ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <GraduationCap className="w-5 h-5 text-white" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800 group-hover:text-amber-700">研修受講履歴</p>
                  <p className="text-xs text-gray-500">研修記録の一覧をPDF出力</p>
                </div>
              </button>
            </div>
          </motion.div>

          {/* ===== 既存の履歴書アップロード ===== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
              <Upload className="w-5 h-5 text-personal" />
              既存の履歴書をアップロード
            </h2>
            <p className="text-xs text-gray-500 mb-4">お手持ちの履歴書PDFをアップロードして保管できます</p>

            {/* アップロードエリア */}
            <div
              onClick={() => resumeFileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 hover:border-personal rounded-xl p-6 text-center cursor-pointer transition-colors group"
            >
              {uploadingResume ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-personal animate-spin" />
                  <p className="text-sm text-gray-600">アップロード中...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-personal/10 rounded-full flex items-center justify-center group-hover:bg-personal/20 transition-colors">
                    <Upload className="w-6 h-6 text-personal" />
                  </div>
                  <p className="text-sm font-bold text-gray-700">クリックしてファイルを選択</p>
                  <p className="text-xs text-gray-400">PDF, 画像ファイル対応</p>
                </div>
              )}
            </div>
            <input
              ref={resumeFileInputRef}
              type="file"
              accept=".pdf,image/*"
              onChange={handleResumeFileUpload}
              className="hidden"
            />

            {/* アップロード済みファイル一覧 */}
            {uploadedResumes.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-bold text-gray-700">アップロード済み</h3>
                {uploadedResumes.map((resume) => (
                  <div key={resume.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-5 h-5 text-personal flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{resume.fileName}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(resume.createdAt).toLocaleDateString('ja-JP')} ・ {(resume.fileSize / 1024).toFixed(0)}KB
                        </p>
                      </div>
                    </div>
                    <a
                      href="#"
                      onClick={async (e) => {
                        e.preventDefault();
                        const { data } = supabase.storage
                          .from('documents')
                          .getPublicUrl(resume.filePath);
                        if (data?.publicUrl) {
                          window.open(data.publicUrl, '_blank');
                        }
                      }}
                      className="text-xs text-personal hover:text-personal-dark font-bold flex-shrink-0"
                    >
                      <Eye className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* アップロード完了確認モーダル */}
          {showResumeUploadConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">アップロード完了</h3>
                    <p className="text-xs text-gray-500">{lastUploadedFileName}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  履歴書がアップロードされました。キャリアタブの基本プロフィールを更新して、履歴書の情報を反映しましょう。
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowResumeUploadConfirm(false)}
                    className="flex-1 py-2 px-4 bg-personal text-white font-bold rounded-lg hover:bg-personal-dark transition-colors text-sm"
                  >
                    プロフィールを編集
                  </button>
                  <button
                    onClick={() => setShowResumeUploadConfirm(false)}
                    className="py-2 px-4 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                  >
                    閉じる
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* A. 基本情報（履歴書） */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <User className="w-5 h-5 text-personal" />
                基本プロフィール
              </h2>
              {!isEditingProfile && (
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="flex items-center gap-1 text-sm text-personal hover:text-personal-dark font-bold"
                >
                  <Edit className="w-4 h-4" />
                  編集
                </button>
              )}
            </div>

            {isEditingProfile ? (
              <ProfileEditSection
                profileData={profileData as ProfileData}
                onProfileDataChange={setProfileData as (data: ProfileData) => void}
                onSave={async () => {
                  if (!user) {
                    toast.error('ユーザー情報が取得できませんでした');
                    return;
                  }
                  try {
                    const updateData: any = {
                      name: profileData.name,
                      last_name: profileData.lastName || null,
                      first_name: profileData.firstName || null,
                      name_kana: profileData.nameKana || null,
                      last_name_kana: profileData.lastNameKana || null,
                      first_name_kana: profileData.firstNameKana || null,
                      email: profileData.email || null,
                      birth_date: profileData.birthDate || null,
                      address: profileData.address || null,
                      phone: profileData.phone || null,
                      gender: profileData.gender || null,
                      education: profileData.education || null,
                      spouse_name: profileData.spouseName || null,
                      my_number: profileData.myNumber || null,
                      basic_pension_symbol: profileData.basicPensionSymbol || null,
                      basic_pension_number: profileData.basicPensionNumber || null,
                      employment_insurance_status: profileData.employmentInsuranceStatus,
                      employment_insurance_number: profileData.employmentInsuranceNumber || null,
                      previous_retirement_date: profileData.previousRetirementDate || null,
                      previous_name: profileData.previousName || null,
                      social_insurance_status: profileData.socialInsuranceStatus,
                      has_dependents: profileData.hasDependents,
                      dependent_count: profileData.dependentCount,
                      dependents: profileData.dependents || [],
                      updated_at: new Date().toISOString(),
                    };
                    const { error } = await supabase
                      .from('users')
                      .update(updateData)
                      .eq('id', user.id);
                    if (error) {
                      console.error('プロフィール保存エラー:', error);
                      toast.error('プロフィールの保存に失敗しました: ' + error.message);
                      return;
                    }
                    const updatedUser: UserType = {
                      ...user,
                      name: profileData.name,
                      email: profileData.email,
                      birthDate: profileData.birthDate,
                      phone: profileData.phone,
                      gender: (profileData.gender === 'male' || profileData.gender === 'female' || profileData.gender === 'other')
                        ? profileData.gender
                        : undefined,
                    };
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                    setUser(updatedUser);
                    setIsEditingProfile(false);
                    toast.success('プロフィールを保存しました');
                  } catch (err) {
                    console.error('プロフィール保存エラー:', err);
                    toast.error('プロフィールの保存に失敗しました');
                  }
                }}
                onCancel={() => {
                  const storedUser = localStorage.getItem('user');
                  if (storedUser) {
                    const userData = JSON.parse(storedUser);
                    setProfileData({
                      name: userData.name || '',
                      lastName: userData.lastName || userData.last_name || '',
                      firstName: userData.firstName || userData.first_name || '',
                      nameKana: userData.nameKana || userData.name_kana || '',
                      lastNameKana: userData.lastNameKana || userData.last_name_kana || '',
                      firstNameKana: userData.firstNameKana || userData.first_name_kana || '',
                      email: userData.email || '',
                      birthDate: userData.birth_date || '',
                      address: userData.address || '',
                      phone: userData.phone || '',
                      gender: userData.gender || '',
                      education: userData.education || '',
                      hasSpouse: !!userData.spouse_name,
                      spouseName: userData.spouse_name || '',
                      myNumber: userData.my_number || '',
                      basicPensionSymbol: userData.basic_pension_symbol || '',
                      basicPensionNumber: userData.basic_pension_number || '',
                      employmentInsuranceStatus: userData.employment_insurance_status || 'joined',
                      employmentInsuranceNumber: userData.employment_insurance_number || '',
                      previousRetirementDate: userData.previous_retirement_date || '',
                      previousName: userData.previous_name || '',
                      socialInsuranceStatus: userData.social_insurance_status || 'joined',
                      hasDependents: userData.has_dependents || false,
                      dependentCount: userData.dependent_count || 0,
                      dependents: userData.dependents || [],
                    });
                  }
                  setIsEditingProfile(false);
                }}
              />
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-600 w-24">氏名</span>
                  <span className="text-sm text-gray-800">{profileData.name || '未登録'}</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-600 w-24">メールアドレス</span>
                  <span className="text-sm text-gray-800">{profileData.email || '未登録'}</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-600 w-24">生年月日</span>
                  <span className="text-sm text-gray-800">{profileData.birthDate || '未登録'}</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-600 w-24">住所</span>
                  <span className="text-sm text-gray-800">{profileData.address || '未登録'}</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-600 w-24">電話番号</span>
                  <span className="text-sm text-gray-800">{profileData.phone || '未登録'}</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-600 w-24">性別</span>
                  <span className="text-sm text-gray-800">
                    {profileData.gender === 'male' ? '男' :
                     profileData.gender === 'female' ? '女' :
                     profileData.gender === 'other' ? 'その他' :
                     profileData.gender === '男性' ? '男' :
                     profileData.gender === '女性' ? '女' :
                     profileData.gender === 'その他' ? 'その他' :
                     profileData.gender || '未登録'}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-600 w-24">マイナンバー</span>
                  <span className="text-sm text-gray-800">{profileData.myNumber ? '***-****-' + profileData.myNumber.slice(-4) : '未登録'}</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-600 w-24">配偶者</span>
                  <span className="text-sm text-gray-800">
                    {profileData.hasSpouse ? (profileData.spouseName || '氏名未入力') : '無'}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-gray-600 w-24">基礎年金番号</span>
                  <span className="text-sm text-gray-800">
                    {profileData.basicPensionSymbol && profileData.basicPensionNumber
                      ? `${profileData.basicPensionSymbol}-${profileData.basicPensionNumber}`
                      : '未登録'}
                  </span>
                </div>
                {/* 現在の所属事業所での契約内容（施設所属時のみ表示） */}
                {personalFacilities.length > 0 ? (
                  <>
                    <div className="mt-6 pt-6 border-t border-gray-300">
                      <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-personal" />
                        現在の所属事業所での契約内容
                      </h3>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-bold text-gray-600 w-32">雇用保険</span>
                      <span className="text-sm text-gray-800">
                        {profileData.employmentInsuranceStatus === 'joined' ? '加入' :
                         profileData.employmentInsuranceStatus === 'not_joined' ? '非加入' :
                         profileData.employmentInsuranceStatus === 'first_time' ? '初めて加入' : '未登録'}
                      </span>
                    </div>
                    {profileData.employmentInsuranceStatus === 'joined' && profileData.employmentInsuranceNumber && (
                      <div className="flex items-start gap-3">
                        <span className="text-sm font-bold text-gray-600 w-32">雇用保険番号</span>
                        <span className="text-sm text-gray-800">{profileData.employmentInsuranceNumber}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-bold text-gray-600 w-32">社会保険</span>
                      <span className="text-sm text-gray-800">
                        {profileData.socialInsuranceStatus === 'joined' ? '加入' :
                         profileData.socialInsuranceStatus === 'not_joined' ? '非加入' : '未登録'}
                      </span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-bold text-gray-600 w-24">扶養家族</span>
                      <span className="text-sm text-gray-800">
                        {profileData.hasDependents ? `${profileData.dependentCount}人` : '無'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="mt-6 pt-6 border-t border-gray-300">
                    <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-gray-400" />
                      雇用・保険情報
                    </h3>
                    <p className="text-sm text-gray-500">
                      施設に所属すると、雇用形態に応じて雇用保険・社会保険の情報が表示されます。
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 実務経験のサマリー */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-bold text-gray-700 mb-3">実務経験のサマリー</h3>
              <div className="bg-personal/5 rounded-lg p-4 border border-personal/20">
                <div className="text-sm text-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <span>所属企業別</span>
                    <span className="font-bold text-gray-800">{experienceRecords.length}件</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>累計経験</span>
                    <span className="font-bold text-personal">計算中...</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* B. 資格証（カメラアップロード） */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-personal" />
              保有資格
            </h2>

            <div className="space-y-4">
              {qualifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Award className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm mb-4">登録されている資格がありません</p>
                  <button
                    onClick={() => {
                      setQualifications([...qualifications, {
                        id: Date.now().toString(),
                        name: '',
                        status: 'not_registered',
                      }]);
                    }}
                    className="px-4 py-2 bg-personal text-white rounded-md hover:bg-personal-dark transition-colors font-bold text-sm flex items-center gap-2 mx-auto"
                  >
                    <Plus className="w-4 h-4" />
                    資格を追加
                  </button>
                </div>
              ) : (
                qualifications.map((qual) => (
                  <div key={qual.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={qual.name}
                          onChange={(e) => {
                            setQualifications(qualifications.map(q => 
                              q.id === qual.id ? { ...q, name: e.target.value } : q
                            ));
                          }}
                          placeholder="資格名を入力（例：保育士、社会福祉士）"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-personal focus:border-transparent text-sm"
                        />
                      </div>
                      <button
                        onClick={() => {
                          setQualifications(qualifications.filter(q => q.id !== qual.id));
                        }}
                        className="ml-2 text-gray-400 hover:text-red-500"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex-1">
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setQualifications(qualifications.map(q => 
                                  q.id === qual.id ? { ...q, imageUrl: reader.result as string, status: 'pending' } : q
                                ));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer text-sm font-bold text-gray-700">
                          <Camera className="w-4 h-4" />
                          {qual.imageUrl ? '画像を変更' : '資格証をアップロード'}
                        </div>
                      </label>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        qual.status === 'approved' 
                          ? 'bg-green-100 text-green-700'
                          : qual.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {qual.status === 'approved' ? '承認済み' : qual.status === 'pending' ? '確認中' : '未登録'}
                      </span>
                    </div>
                    {qual.imageUrl && (
                      <div className="mt-3">
                        <Image src={qual.imageUrl} alt={qual.name} width={400} height={128} className="max-w-full h-32 object-contain border border-gray-200 rounded" unoptimized />
                      </div>
                    )}
                  </div>
                ))
              )}
              {qualifications.length > 0 && (
                <button
                  onClick={() => {
                    setQualifications([...qualifications, {
                      id: Date.now().toString(),
                      name: '',
                      status: 'not_registered',
                    }]);
                  }}
                  className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md hover:border-personal hover:bg-personal/5 transition-colors text-sm font-bold text-gray-600 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  資格を追加
                </button>
              )}
            </div>
          </motion.div>

          {/* C. 職歴（実務経験証明書） */}
          <motion.div
            id="work-experience-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-personal" />
              職歴（実務経験証明書）
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              実務経験証明書の発行依頼に必要な情報を入力できます。発行依頼ボタンから過去の勤務先にメールで依頼を送信できます。
            </p>
            <WorkExperienceForm
              userId={user?.id || ''}
              userName={user?.name || ''}
            />
          </motion.div>

          {/* 学歴 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-personal" />
              学歴
            </h2>

            <div className="space-y-4">
              {educationHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm mb-4">登録されている学歴がありません</p>
                  <button
                    onClick={() => {
                      setEducationHistory([...educationHistory, {
                        id: Date.now().toString(),
                        schoolName: '',
                        graduationDate: '',
                        degree: '',
                      }]);
                    }}
                    className="px-4 py-2 bg-personal text-white rounded-md hover:bg-personal-dark transition-colors font-bold text-sm flex items-center gap-2 mx-auto"
                  >
                    <Plus className="w-4 h-4" />
                    学歴を追加
                  </button>
                </div>
              ) : (
                educationHistory.map((edu) => (
                  <div key={edu.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">学校名</label>
                        <input
                          type="text"
                          value={edu.schoolName}
                          onChange={(e) => {
                            setEducationHistory(educationHistory.map(item => 
                              item.id === edu.id ? { ...item, schoolName: e.target.value } : item
                            ));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-personal focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">卒業年月</label>
                        <input
                          type="month"
                          value={edu.graduationDate}
                          onChange={(e) => {
                            setEducationHistory(educationHistory.map(item => 
                              item.id === edu.id ? { ...item, graduationDate: e.target.value } : item
                            ));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-personal focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">学位・資格</label>
                        <input
                          type="text"
                          value={edu.degree}
                          onChange={(e) => {
                            setEducationHistory(educationHistory.map(item => 
                              item.id === edu.id ? { ...item, degree: e.target.value } : item
                            ));
                          }}
                          placeholder="例：高等学校卒業"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-personal focus:border-transparent text-sm"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEducationHistory(educationHistory.filter(e => e.id !== edu.id));
                      }}
                      className="text-xs text-red-500 hover:text-red-700 font-bold"
                    >
                      削除
                    </button>
                  </div>
                ))
              )}
              {educationHistory.length > 0 && (
                <button
                  onClick={() => {
                    setEducationHistory([...educationHistory, {
                      id: Date.now().toString(),
                      schoolName: '',
                      graduationDate: '',
                      degree: '',
                    }]);
                  }}
                  className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md hover:border-personal hover:bg-personal/5 transition-colors text-sm font-bold text-gray-600 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  学歴を追加
                </button>
              )}
            </div>
          </motion.div>

          {/* ========== スカウト ========== */}
          <ScoutInboxSection userId={user?.id} />

          {/* ========== 規定確認セクション ========== */}
          <CareerRegulationSection userId={user?.id} activeEmployments={activeEmployments} />

          {/* ========== 資格期限通知セクション ========== */}
          <CareerQualificationAlerts userId={user?.id} activeEmployments={activeEmployments} />

          {/* ========== 有給残日数表示セクション ========== */}
          <CareerPaidLeaveBalance userId={user?.id} activeEmployments={activeEmployments} />

          {/* ========== 求人への誘導 ========== */}
          <div className="mt-6">
            <button
              onClick={() => setActiveTab('work')}
              className="w-full bg-gradient-to-r from-personal/10 to-personal-dark/10 border border-personal/20 rounded-xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 bg-personal rounded-lg flex items-center justify-center shrink-0">
                <Search className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-gray-800">求人を探す</p>
                <p className="text-xs text-gray-500">あなたにぴったりの求人をチェック</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      )}

      {activeTab === 'docs' && (
        <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <FileText className="w-5 h-5 text-personal" />
            書類
          </h2>
          <StaffDocumentsSection userId={user?.id || ''} facilities={personalFacilities} />
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
          <h2 className="text-xl font-bold text-gray-800 mb-6">設定</h2>

          {/* アカウント設定 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-personal" />
              アカウント
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">名前</span>
                <span className="font-bold text-gray-800">{user?.name || '未設定'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">メール</span>
                <span className="font-bold text-gray-800">{user?.email || '未設定'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">ログインID</span>
                <span className="font-bold text-gray-800">{user?.loginId || '未設定'}</span>
              </div>
            </div>
          </div>

          {/* パスキー管理 */}
          <PasskeySection userId={user?.id} userEmail={user?.email} />

          {/* 運営管理画面へのアクセス（施設発行権限がある場合のみ） */}
          <AdminAccessLink userId={user?.id} />

          {/* ログアウト */}
          <button
            onClick={() => {
              localStorage.removeItem('user');
              localStorage.removeItem('selectedFacility');
              router.push('/career/login');
            }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            ログアウト
          </button>
        </div>
      )}

      {/* タブバー（画面下部） */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg" style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}>
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-around py-2" role="tablist" aria-label="メインナビゲーション">
            <button
              role="tab"
              aria-selected={activeTab === 'home'}
              onClick={() => setActiveTab('home')}
              className={`flex flex-col items-center gap-1 p-2 transition-colors ${
                activeTab === 'home' ? 'text-personal' : 'text-gray-600 hover:text-personal'
              }`}
            >
              <Briefcase className="w-6 h-6" />
              <span className="text-xs font-bold">ホーム</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'work'}
              onClick={() => setActiveTab('work')}
              className={`flex flex-col items-center gap-1 p-2 transition-colors ${
                activeTab === 'work' ? 'text-personal' : 'text-gray-600 hover:text-personal'
              }`}
            >
              <ClipboardList className="w-6 h-6" />
              <span className="text-xs font-bold">業務</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'career'}
              onClick={() => setActiveTab('career')}
              className={`flex flex-col items-center gap-1 p-2 transition-colors ${
                activeTab === 'career' ? 'text-personal' : 'text-gray-600 hover:text-personal'
              }`}
            >
              <Award className="w-6 h-6" />
              <span className="text-xs font-bold">キャリア</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'docs'}
              onClick={() => setActiveTab('docs')}
              className={`flex flex-col items-center gap-1 p-2 transition-colors relative ${
                activeTab === 'docs' ? 'text-personal' : 'text-gray-600 hover:text-personal'
              }`}
            >
              <FolderOpen className="w-6 h-6" />
              <span className="text-xs font-bold">書類</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center gap-1 p-2 transition-colors ${
                activeTab === 'settings' ? 'text-personal' : 'text-gray-600 hover:text-personal'
              }`}
            >
              <Settings className="w-6 h-6" />
              <span className="text-xs font-bold">設定</span>
            </button>
          </div>
        </div>
      </div>

      {/* 履歴書プレビューモーダル */}
      {showResumePreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
          >
            {/* ヘッダー */}
            <div className="bg-gradient-to-r from-personal to-personal-dark text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6" />
                <h2 className="text-xl font-bold">履歴書プレビュー</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={generateFromPreview}
                  disabled={generatingPDF === 'resume'}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-personal font-bold rounded-md hover:bg-white/90 transition-colors disabled:opacity-50"
                >
                  {generatingPDF === 'resume' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                  PDF出力
                </button>
                <button
                  onClick={() => setShowResumePreview(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* プレビュー内容 */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {/* 顔写真オプション */}
              <div className="mb-4 p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-gray-300">
                    {profilePhotoUrl ? (
                      <img src={profilePhotoUrl} alt="顔写真" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-gray-700">顔写真</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usePhotoInResume}
                    onChange={(e) => setUsePhotoInResume(e.target.checked)}
                    className="w-4 h-4 rounded text-personal focus:ring-personal"
                  />
                  <span className="text-sm text-gray-700">履歴書に掲載する</span>
                </label>
              </div>

              <p className="text-sm text-gray-500 mb-4">※ 各項目をクリックして編集できます（提出先に応じて調整してください）</p>

              {/* 履歴書形式のプレビュー */}
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <table className="w-full border-collapse">
                  <tbody>
                    {/* 氏名 */}
                    <tr>
                      <td className="border border-gray-300 p-3 bg-gray-100 w-24 text-sm font-bold">氏名</td>
                      <td className="border border-gray-300 p-3 text-lg font-bold" colSpan={3}>
                        {profileData.name || '（未入力）'}
                      </td>
                    </tr>
                    {/* 生年月日 */}
                    <tr>
                      <td className="border border-gray-300 p-3 bg-gray-100 text-sm font-bold">生年月日</td>
                      <td className="border border-gray-300 p-3 text-sm" colSpan={3}>
                        {profileData.birthDate ? `${toJapaneseDate(profileData.birthDate)} （満${calculateAge(profileData.birthDate)}歳）` : '（未入力）'}
                        {profileData.gender && ` ・ ${profileData.gender}`}
                      </td>
                    </tr>
                    {/* 住所 */}
                    <tr>
                      <td className="border border-gray-300 p-3 bg-gray-100 text-sm font-bold">現住所</td>
                      <td className="border border-gray-300 p-3 text-sm" colSpan={3}>
                        {profileData.address || '（未入力）'}
                      </td>
                    </tr>
                    {/* 連絡先 */}
                    <tr>
                      <td className="border border-gray-300 p-3 bg-gray-100 text-sm font-bold">電話</td>
                      <td className="border border-gray-300 p-3 text-sm">{profileData.phone || '（未入力）'}</td>
                      <td className="border border-gray-300 p-3 bg-gray-100 text-sm font-bold w-24">E-mail</td>
                      <td className="border border-gray-300 p-3 text-sm">{profileData.email || '（未入力）'}</td>
                    </tr>
                    {/* 通勤情報（編集可能） */}
                    <tr>
                      <td className="border border-gray-300 p-3 bg-gray-100 text-sm font-bold">最寄駅</td>
                      <td
                        className="border border-gray-300 p-3 text-sm cursor-pointer hover:bg-blue-50"
                        onClick={() => setEditingField('nearestStation')}
                      >
                        {editingField === 'nearestStation' ? (
                          <input
                            type="text"
                            value={resumeEditData.nearestStation}
                            onChange={(e) => setResumeEditData({ ...resumeEditData, nearestStation: e.target.value })}
                            onBlur={() => setEditingField(null)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                            autoFocus
                            className="w-full px-2 py-1 border border-personal rounded focus:outline-none"
                            placeholder="例: 渋谷駅"
                          />
                        ) : (
                          <span className={resumeEditData.nearestStation ? '' : 'text-gray-400'}>
                            {resumeEditData.nearestStation || 'クリックして入力'}
                          </span>
                        )}
                      </td>
                      <td className="border border-gray-300 p-3 bg-gray-100 text-sm font-bold">通勤時間</td>
                      <td
                        className="border border-gray-300 p-3 text-sm cursor-pointer hover:bg-blue-50"
                        onClick={() => setEditingField('commuteTime')}
                      >
                        {editingField === 'commuteTime' ? (
                          <input
                            type="text"
                            value={resumeEditData.commuteTime}
                            onChange={(e) => setResumeEditData({ ...resumeEditData, commuteTime: e.target.value })}
                            onBlur={() => setEditingField(null)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                            autoFocus
                            className="w-full px-2 py-1 border border-personal rounded focus:outline-none"
                            placeholder="例: 約30分"
                          />
                        ) : (
                          <span className={resumeEditData.commuteTime ? '' : 'text-gray-400'}>
                            {resumeEditData.commuteTime || 'クリックして入力'}
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* 学歴・職歴 */}
                <div className="p-3 border-t border-gray-300">
                  <h3 className="font-bold text-sm mb-2">学歴・職歴</h3>
                  <div className="text-sm space-y-1">
                    <p className="font-bold text-center text-gray-600">学歴</p>
                    {educationHistory.length === 0 ? (
                      <p className="text-gray-400 text-center">（学歴が登録されていません）</p>
                    ) : (
                      educationHistory.map((edu) => (
                        <p key={edu.id}>{toJapaneseDate(edu.graduationDate)}　{edu.schoolName} {edu.degree}</p>
                      ))
                    )}
                    <p className="font-bold text-center text-gray-600 mt-2">職歴</p>
                    {experienceRecords.length === 0 ? (
                      <p className="text-gray-400 text-center">（職歴が登録されていません）</p>
                    ) : (
                      experienceRecords.map((exp) => (
                        <div key={exp.id}>
                          <p>{toJapaneseDate(exp.startDate)}　{exp.facilityName} 入社</p>
                          {exp.endDate && <p>{toJapaneseDate(exp.endDate)}　一身上の都合により退職</p>}
                        </div>
                      ))
                    )}
                    <p className="text-right">以上</p>
                  </div>
                </div>

                {/* 資格・免許 */}
                <div className="p-3 border-t border-gray-300">
                  <h3 className="font-bold text-sm mb-2">資格・免許</h3>
                  <div className="text-sm">
                    {qualifications.length === 0 ? (
                      <p className="text-gray-400">（資格が登録されていません）</p>
                    ) : (
                      qualifications.map((qual) => (
                        <p key={qual.id}>{qual.name}</p>
                      ))
                    )}
                  </div>
                </div>

                {/* 志望動機（編集可能） */}
                <div className="p-3 border-t border-gray-300">
                  <h3 className="font-bold text-sm mb-2">志望動機</h3>
                  <div
                    className="text-sm cursor-pointer hover:bg-blue-50 p-2 rounded min-h-[60px]"
                    onClick={() => setEditingField('motivation')}
                  >
                    {editingField === 'motivation' ? (
                      <textarea
                        value={resumeEditData.motivation}
                        onChange={(e) => setResumeEditData({ ...resumeEditData, motivation: e.target.value })}
                        onBlur={() => setEditingField(null)}
                        autoFocus
                        rows={3}
                        className="w-full px-2 py-1 border border-personal rounded focus:outline-none resize-none"
                        placeholder="志望動機を入力してください"
                      />
                    ) : (
                      <span className={resumeEditData.motivation ? 'whitespace-pre-wrap' : 'text-gray-400'}>
                        {resumeEditData.motivation || 'クリックして入力（提出先に応じて記入）'}
                      </span>
                    )}
                  </div>
                </div>

                {/* 本人希望（編集可能） */}
                <div className="p-3 border-t border-gray-300">
                  <h3 className="font-bold text-sm mb-2">本人希望記入欄</h3>
                  <div
                    className="text-sm cursor-pointer hover:bg-blue-50 p-2 rounded"
                    onClick={() => setEditingField('personalRequests')}
                  >
                    {editingField === 'personalRequests' ? (
                      <textarea
                        value={resumeEditData.personalRequests}
                        onChange={(e) => setResumeEditData({ ...resumeEditData, personalRequests: e.target.value })}
                        onBlur={() => setEditingField(null)}
                        autoFocus
                        rows={2}
                        className="w-full px-2 py-1 border border-personal rounded focus:outline-none resize-none"
                      />
                    ) : (
                      <span className="whitespace-pre-wrap">{resumeEditData.personalRequests}</span>
                    )}
                  </div>
                </div>

                {/* 健康状態（編集可能） */}
                <div className="p-3 border-t border-gray-300">
                  <h3 className="font-bold text-sm mb-2">健康状態</h3>
                  <div
                    className="text-sm cursor-pointer hover:bg-blue-50 p-2 rounded"
                    onClick={() => setEditingField('healthStatus')}
                  >
                    {editingField === 'healthStatus' ? (
                      <input
                        type="text"
                        value={resumeEditData.healthStatus}
                        onChange={(e) => setResumeEditData({ ...resumeEditData, healthStatus: e.target.value })}
                        onBlur={() => setEditingField(null)}
                        onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                        autoFocus
                        className="w-full px-2 py-1 border border-personal rounded focus:outline-none"
                      />
                    ) : (
                      <span>{resumeEditData.healthStatus}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* 履歴書PDFテンプレート（非表示） */}
      <div ref={resumeRef} style={{ display: 'none', width: '794px', padding: '40px', fontFamily: 'sans-serif', backgroundColor: '#fff' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '5px' }}>履 歴 書</h1>
          <p style={{ fontSize: '12px', color: '#666' }}>
            {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}現在
          </p>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', width: '80px', fontSize: '12px' }}>氏名</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '18px', fontWeight: 'bold' }} colSpan={2}>
                {profileData.name}
              </td>
              <td style={{ border: '1px solid #333', width: '100px', textAlign: 'center', verticalAlign: 'middle' }} rowSpan={4}>
                {usePhotoInResume && profilePhotoUrl ? (
                  <img src={profilePhotoUrl} alt="写真" style={{ width: '80px', height: '100px', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '80px', height: '100px', margin: '0 auto', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#999' }}>
                    写真
                  </div>
                )}
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px' }}>生年月日</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }} colSpan={2}>
                {profileData.birthDate && toJapaneseDate(profileData.birthDate)}
                {profileData.birthDate && ` （満${calculateAge(profileData.birthDate)}歳）`}
                {profileData.gender && ` ・ ${profileData.gender}`}
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px' }}>現住所</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }} colSpan={2}>
                {profileData.address}
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px' }}>電話</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }} colSpan={2}>{profileData.phone}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px' }}>E-mail</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }} colSpan={3}>{profileData.email}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px' }}>最寄駅</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }}>{resumeEditData.nearestStation || '-'}</td>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px', width: '80px' }}>通勤時間</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }}>{resumeEditData.commuteTime || '-'}</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px' }}>配偶者</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }}>{profileData.hasSpouse ? 'あり' : 'なし'}</td>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px' }}>扶養家族</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }}>{profileData.dependentCount}人</td>
            </tr>
          </tbody>
        </table>

        {/* 学歴・職歴 */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', width: '100px', fontSize: '12px' }}>年月</th>
              <th style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px' }}>学歴・職歴</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center', fontSize: '12px' }} colSpan={2}>学歴</td>
            </tr>
            {educationHistory.map((edu) => (
              <tr key={edu.id}>
                <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px', textAlign: 'center' }}>{toJapaneseDate(edu.graduationDate)}</td>
                <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }}>{edu.schoolName} {edu.degree}</td>
              </tr>
            ))}
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center', fontSize: '12px' }} colSpan={2}>職歴</td>
            </tr>
            {experienceRecords.length === 0 ? (
              <tr>
                <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center', fontSize: '12px' }} colSpan={2}>なし</td>
              </tr>
            ) : (
              experienceRecords.map((exp) => (
                <React.Fragment key={exp.id}>
                  <tr>
                    <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px', textAlign: 'center' }}>{toJapaneseDate(exp.startDate)}</td>
                    <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }}>{exp.facilityName} 入社</td>
                  </tr>
                  {exp.endDate && (
                    <tr>
                      <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px', textAlign: 'center' }}>{toJapaneseDate(exp.endDate)}</td>
                      <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }}>一身上の都合により退職</td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'right', fontSize: '12px' }} colSpan={2}>以上</td>
            </tr>
          </tbody>
        </table>

        {/* 資格・免許 */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px' }}>免許・資格</th>
            </tr>
          </thead>
          <tbody>
            {qualifications.length === 0 ? (
              <tr>
                <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center', fontSize: '12px' }}>特になし</td>
              </tr>
            ) : (
              qualifications.map((qual) => (
                <tr key={qual.id}>
                  <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }}>{qual.name}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* 志望動機・本人希望・健康状態 */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', width: '120px', fontSize: '12px', verticalAlign: 'top' }}>志望動機</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px', minHeight: '60px', whiteSpace: 'pre-wrap' }}>
                {resumeEditData.motivation || ''}
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px', verticalAlign: 'top' }}>本人希望</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                {resumeEditData.personalRequests}
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px' }}>健康状態</td>
              <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }}>{resumeEditData.healthStatus}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 職務経歴書PDFテンプレート（非表示） */}
      <div ref={cvRef} style={{ display: 'none', width: '794px', padding: '40px', fontFamily: 'sans-serif', backgroundColor: '#fff' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '5px' }}>職 務 経 歴 書</h1>
          <p style={{ fontSize: '12px', color: '#666' }}>
            {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}現在
          </p>
        </div>

        <div style={{ textAlign: 'right', marginBottom: '20px', fontSize: '14px' }}>
          <p>{profileData.name}</p>
        </div>

        {/* 職務経歴 */}
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', borderBottom: '2px solid #333', paddingBottom: '5px', marginBottom: '15px' }}>職務経歴</h2>
          {experienceRecords.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#666' }}>職歴なし</p>
          ) : (
            experienceRecords.map((exp) => (
              <div key={exp.id} style={{ marginBottom: '20px', paddingLeft: '10px', borderLeft: '3px solid #818CF8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{exp.facilityName}</span>
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    {toJapaneseDate(exp.startDate)} ～ {exp.endDate ? toJapaneseDate(exp.endDate) : '現在'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 保有資格 */}
        {qualifications.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', borderBottom: '2px solid #333', paddingBottom: '5px', marginBottom: '15px' }}>保有資格</h2>
            <ul style={{ fontSize: '12px', listStyle: 'disc', paddingLeft: '20px' }}>
              {qualifications.map((qual) => (
                <li key={qual.id} style={{ marginBottom: '5px' }}>{qual.name}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 在籍証明書PDFテンプレート（非表示） */}
      <div ref={enrollmentCertRef} style={{ display: 'none', width: '794px', padding: '60px', fontFamily: 'sans-serif', backgroundColor: '#fff' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '10px', letterSpacing: '8px' }}>在 籍 証 明 書</h1>
          <p style={{ fontSize: '12px', color: '#666' }}>
            {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}発行
          </p>
        </div>

        <div style={{ marginBottom: '40px', lineHeight: '2' }}>
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '14px', marginBottom: '10px' }}>下記の者が当施設に在籍していることを証明します。</p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #333', padding: '12px', backgroundColor: '#f5f5f5', width: '120px', fontSize: '13px', fontWeight: 'bold' }}>氏名</td>
                <td style={{ border: '1px solid #333', padding: '12px', fontSize: '16px', fontWeight: 'bold' }}>{profileData.name}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: '12px', backgroundColor: '#f5f5f5', fontSize: '13px', fontWeight: 'bold' }}>生年月日</td>
                <td style={{ border: '1px solid #333', padding: '12px', fontSize: '13px' }}>
                  {profileData.birthDate ? toJapaneseDate(profileData.birthDate) : '-'}
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: '12px', backgroundColor: '#f5f5f5', fontSize: '13px', fontWeight: 'bold' }}>現住所</td>
                <td style={{ border: '1px solid #333', padding: '12px', fontSize: '13px' }}>{profileData.address || '-'}</td>
              </tr>
              {personalFacilities.length > 0 && (
                <>
                  <tr>
                    <td style={{ border: '1px solid #333', padding: '12px', backgroundColor: '#f5f5f5', fontSize: '13px', fontWeight: 'bold' }}>所属施設</td>
                    <td style={{ border: '1px solid #333', padding: '12px', fontSize: '13px' }}>{personalFacilities[0].facilityName}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #333', padding: '12px', backgroundColor: '#f5f5f5', fontSize: '13px', fontWeight: 'bold' }}>役職</td>
                    <td style={{ border: '1px solid #333', padding: '12px', fontSize: '13px' }}>{personalFacilities[0].employmentRecord.role || 'スタッフ'}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #333', padding: '12px', backgroundColor: '#f5f5f5', fontSize: '13px', fontWeight: 'bold' }}>雇用形態</td>
                    <td style={{ border: '1px solid #333', padding: '12px', fontSize: '13px' }}>{personalFacilities[0].employmentRecord.employmentType || '常勤'}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #333', padding: '12px', backgroundColor: '#f5f5f5', fontSize: '13px', fontWeight: 'bold' }}>在籍開始日</td>
                    <td style={{ border: '1px solid #333', padding: '12px', fontSize: '13px' }}>{personalFacilities[0].employmentRecord.startDate ? toJapaneseDate(personalFacilities[0].employmentRecord.startDate) : '-'}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>

          <p style={{ fontSize: '13px', textAlign: 'center', marginBottom: '40px' }}>
            上記の通り証明いたします。
          </p>

          <div style={{ textAlign: 'right', marginTop: '60px' }}>
            {personalFacilities.length > 0 && (
              <p style={{ fontSize: '13px', marginBottom: '5px' }}>{personalFacilities[0].facilityName}</p>
            )}
            <p style={{ fontSize: '11px', color: '#666' }}>※ 本証明書はRootsキャリアシステムにより自動発行されたものです</p>
          </div>
        </div>
      </div>

      {/* 研修受講履歴PDFテンプレート（非表示） */}
      <div ref={trainingHistoryRef} style={{ display: 'none', width: '794px', padding: '40px', fontFamily: 'sans-serif', backgroundColor: '#fff' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '5px', letterSpacing: '4px' }}>研修受講履歴</h1>
          <p style={{ fontSize: '12px', color: '#666' }}>
            {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}現在
          </p>
        </div>

        <div style={{ textAlign: 'right', marginBottom: '20px', fontSize: '14px' }}>
          <p>氏名: {profileData.name}</p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', padding: '10px', backgroundColor: '#f0f0ff', borderRadius: '4px' }}>
            <span style={{ fontSize: '13px' }}>総研修時間: <strong>{totalTrainingHours}時間</strong></span>
            <span style={{ fontSize: '13px' }}>研修数: <strong>{timelineEvents.filter(e => e.type === 'training').length}件</strong></span>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px', width: '100px' }}>受講日</th>
              <th style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px' }}>研修名</th>
              <th style={{ border: '1px solid #333', padding: '8px', backgroundColor: '#f5f5f5', fontSize: '12px', width: '80px' }}>詳細</th>
            </tr>
          </thead>
          <tbody>
            {timelineEvents.filter(e => e.type === 'training').length === 0 ? (
              <tr>
                <td style={{ border: '1px solid #333', padding: '8px', textAlign: 'center', fontSize: '12px' }} colSpan={3}>研修受講記録はありません</td>
              </tr>
            ) : (
              timelineEvents.filter(e => e.type === 'training').map((event) => (
                <tr key={event.id}>
                  <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px', textAlign: 'center' }}>
                    {new Date(event.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }}>{event.title.replace('研修完了: ', '')}</td>
                  <td style={{ border: '1px solid #333', padding: '8px', fontSize: '12px' }}>{event.description}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div style={{ marginTop: '30px', textAlign: 'right', fontSize: '11px', color: '#666' }}>
          <p>※ 本書はRootsキャリアシステムに登録された研修記録に基づき自動生成されたものです</p>
        </div>
      </div>
    </div>
  );
}
