/**
 * WorkExperienceForm - 職歴入力フォーム（実務経験証明書対応）
 * 実務経験証明書の発行依頼に必要な情報を入力
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Building2,
  Calendar,
  Mail,
  Phone,
  User,
  FileCheck,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Send,
  Edit3,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Download,
  Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import {
  WorkExperienceRecord,
  WorkExperienceStatus,
  BUSINESS_TYPES,
  generateCertificateRequestEmail,
} from '@/types';
import CertificatePdfGenerator from './CertificatePdfGenerator';

interface WorkExperienceFormProps {
  userId: string;
  userName: string;
  onUpdate?: () => void;
}

// ステータスのラベルとスタイル
const STATUS_CONFIG: Record<WorkExperienceStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: '下書き', color: 'bg-gray-100 text-gray-700', icon: Edit3 },
  pending: { label: '承認待ち', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  signed: { label: '署名済み', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: '却下', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

// 空のレコードを作成
const createEmptyRecord = (userId: string): Partial<WorkExperienceRecord> => ({
  userId,
  facilityName: '',
  corporateName: '',
  corporateAddress: '',
  corporatePhone: '',
  representativeName: '',
  contactEmail: '',
  contactPersonName: '',
  businessType: undefined,
  businessTypeOther: '',
  startDate: '',
  endDate: '',
  totalWorkDays: undefined,
  weeklyAverageDays: undefined,
  jobTitle: '',
  employmentType: 'fulltime',
  jobDescription: '',
  status: 'draft',
});

export default function WorkExperienceForm({
  userId,
  userName,
  onUpdate,
}: WorkExperienceFormProps) {
  const [records, setRecords] = useState<WorkExperienceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // メールプレビューモーダル
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailPreviewRecord, setEmailPreviewRecord] = useState<WorkExperienceRecord | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // PDF表示モーダル
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewRecord, setPdfPreviewRecord] = useState<WorkExperienceRecord | null>(null);

  // データ取得
  useEffect(() => {
    fetchRecords();
  }, [userId]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('work_experience_records')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: false });

      if (error) throw error;

      const mapped: WorkExperienceRecord[] = (data || []).map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        facilityName: r.facility_name || '',
        corporateName: r.corporate_name || '',
        corporateAddress: r.corporate_address || '',
        corporatePhone: r.corporate_phone || '',
        representativeName: r.representative_name || '',
        contactEmail: r.contact_email || '',
        contactPersonName: r.contact_person_name || '',
        businessType: r.business_type,
        businessTypeOther: r.business_type_other || '',
        startDate: r.start_date || '',
        endDate: r.end_date || '',
        totalWorkDays: r.total_work_days,
        weeklyAverageDays: r.weekly_average_days,
        jobTitle: r.job_title || '',
        employmentType: r.employment_type || 'fulltime',
        jobDescription: r.job_description || '',
        status: r.status || 'draft',
        signatureToken: r.signature_token,
        signatureRequestedAt: r.signature_requested_at,
        signedAt: r.signed_at,
        signedPdfUrl: r.signed_pdf_url,
        rejectionReason: r.rejection_reason,
        emailSubject: r.email_subject,
        emailBody: r.email_body,
        signatureImageUrl: r.signature_image_url,
        sealImageUrl: r.seal_image_url,
        signerName: r.signer_name,
        signerTitle: r.signer_title,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      setRecords(mapped);
    } catch (err) {
      console.error('職歴データの取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  // 新規追加
  const handleAdd = async () => {
    const newRecord = createEmptyRecord(userId);

    try {
      const { data, error } = await supabase
        .from('work_experience_records')
        .insert({
          user_id: userId,
          facility_name: '',
          start_date: new Date().toISOString().split('T')[0],
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;

      await fetchRecords();
      setExpandedId(data.id);
    } catch (err) {
      console.error('職歴の追加エラー:', err);
      alert('職歴の追加に失敗しました');
    }
  };

  // 保存
  const handleSave = async (record: WorkExperienceRecord) => {
    setSavingId(record.id);
    try {
      const { error } = await supabase
        .from('work_experience_records')
        .update({
          facility_name: record.facilityName,
          corporate_name: record.corporateName,
          corporate_address: record.corporateAddress,
          corporate_phone: record.corporatePhone,
          representative_name: record.representativeName,
          contact_email: record.contactEmail,
          contact_person_name: record.contactPersonName,
          business_type: record.businessType,
          business_type_other: record.businessTypeOther,
          start_date: record.startDate || null,
          end_date: record.endDate || null,
          total_work_days: record.totalWorkDays,
          weekly_average_days: record.weeklyAverageDays,
          job_title: record.jobTitle,
          employment_type: record.employmentType,
          job_description: record.jobDescription,
          updated_at: new Date().toISOString(),
        })
        .eq('id', record.id);

      if (error) throw error;
      onUpdate?.();
    } catch (err) {
      console.error('保存エラー:', err);
      alert('保存に失敗しました');
    } finally {
      setSavingId(null);
    }
  };

  // 削除
  const handleDelete = async (id: string) => {
    if (!confirm('この職歴を削除しますか？')) return;

    try {
      const { error } = await supabase
        .from('work_experience_records')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setRecords(records.filter(r => r.id !== id));
      onUpdate?.();
    } catch (err) {
      console.error('削除エラー:', err);
      alert('削除に失敗しました');
    }
  };

  // フィールド更新
  const updateRecord = (id: string, updates: Partial<WorkExperienceRecord>) => {
    setRecords(records.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  // メールプレビューを開く
  const openEmailPreview = (record: WorkExperienceRecord) => {
    const email = generateCertificateRequestEmail(
      userName,
      record.facilityName,
      record.contactPersonName || '',
      record.startDate,
      record.endDate
    );
    setEmailSubject(record.emailSubject || email.subject);
    setEmailBody(record.emailBody || email.body);
    setEmailPreviewRecord(record);
    setShowEmailPreview(true);
  };

  // 発行依頼を送信
  const sendCertificateRequest = async () => {
    if (!emailPreviewRecord) return;
    if (!emailPreviewRecord.contactEmail) {
      alert('送信先メールアドレスを入力してください');
      return;
    }

    setSendingEmail(true);
    try {
      // トークン生成
      const token = crypto.randomUUID();
      const signUrl = `${window.location.origin}/sign/${token}`;

      // メール本文にリンクを追加
      const bodyWithLink = `${emailBody}

━━━━━━━━━━━━━━━━━━━━━━
▼ 電子署名はこちらから
${signUrl}
━━━━━━━━━━━━━━━━━━━━━━

※このリンクは本メールの受信者専用です。
※リンクの有効期限は30日間です。`;

      // DBを更新
      const { error: updateError } = await supabase
        .from('work_experience_records')
        .update({
          status: 'pending',
          signature_token: token,
          signature_requested_at: new Date().toISOString(),
          email_subject: emailSubject,
          email_body: emailBody,
          updated_at: new Date().toISOString(),
        })
        .eq('id', emailPreviewRecord.id);

      if (updateError) throw updateError;

      // メール送信API呼び出し
      const response = await fetch('/api/send-certificate-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailPreviewRecord.contactEmail,
          subject: emailSubject,
          body: bodyWithLink,
          recordId: emailPreviewRecord.id,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'メール送信に失敗しました');
      }

      // 開発モードの場合は署名URLを表示
      if (responseData.devMode) {
        alert(`【開発モード】メール送信はスキップされました。\n\n署名URL:\n${responseData.signatureUrl}\n\nこのURLをブラウザで開いて署名をテストできます。`);
      } else {
        alert('発行依頼を送信しました');
      }

      setShowEmailPreview(false);
      await fetchRecords();
    } catch (err) {
      console.error('送信エラー:', err);
      alert(`送信に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`);
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#818CF8]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {records.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm mb-4">職歴が登録されていません</p>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-[#818CF8] text-white rounded-md hover:bg-[#6366F1] transition-colors font-bold text-sm flex items-center gap-2 mx-auto"
          >
            <Plus className="w-4 h-4" />
            職歴を追加
          </button>
        </div>
      ) : (
        <>
          {records.map((record) => {
            const isExpanded = expandedId === record.id;
            const statusConfig = STATUS_CONFIG[record.status];
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={record.id}
                className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden"
              >
                {/* ヘッダー */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : record.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-[#818CF8]" />
                      <div>
                        <p className="font-bold text-gray-800">
                          {record.facilityName || '（施設名未入力）'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {record.startDate && (
                            <>
                              {record.startDate}
                              {record.endDate ? ` 〜 ${record.endDate}` : ' 〜 現在'}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded ${statusConfig.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* 詳細フォーム */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-4 border-t border-gray-200 pt-4">
                        {/* 施設情報 */}
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            施設・法人情報
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-gray-600 mb-1">
                                施設又は事業所名 <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={record.facilityName}
                                onChange={(e) => updateRecord(record.id, { facilityName: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#818CF8] focus:border-transparent"
                                placeholder="例：認定こども園 ○○園"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-600 mb-1">法人名</label>
                              <input
                                type="text"
                                value={record.corporateName || ''}
                                onChange={(e) => updateRecord(record.id, { corporateName: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#818CF8] focus:border-transparent"
                                placeholder="例：社会福祉法人○○会"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-bold text-gray-600 mb-1">法人所在地</label>
                              <input
                                type="text"
                                value={record.corporateAddress || ''}
                                onChange={(e) => updateRecord(record.id, { corporateAddress: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#818CF8] focus:border-transparent"
                                placeholder="例：〒000-0000 東京都○○区..."
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-600 mb-1">代表者氏名</label>
                              <input
                                type="text"
                                value={record.representativeName || ''}
                                onChange={(e) => updateRecord(record.id, { representativeName: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#818CF8] focus:border-transparent"
                                placeholder="例：理事長 山田太郎"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-600 mb-1">電話番号</label>
                              <input
                                type="tel"
                                value={record.corporatePhone || ''}
                                onChange={(e) => updateRecord(record.id, { corporatePhone: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#818CF8] focus:border-transparent"
                                placeholder="例：03-0000-0000"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 発行依頼先 */}
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            発行依頼先（メール送信用）
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-gray-600 mb-1">
                                担当者名（宛名）
                              </label>
                              <input
                                type="text"
                                value={record.contactPersonName || ''}
                                onChange={(e) => updateRecord(record.id, { contactPersonName: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#818CF8] focus:border-transparent"
                                placeholder="例：人事部 鈴木様"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-600 mb-1">
                                メールアドレス <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="email"
                                value={record.contactEmail || ''}
                                onChange={(e) => updateRecord(record.id, { contactEmail: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#818CF8] focus:border-transparent"
                                placeholder="例：jinji@example.com"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 事業種別 */}
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <h4 className="text-sm font-bold text-gray-700 mb-3">事業種別</h4>
                          <select
                            value={record.businessType || ''}
                            onChange={(e) => updateRecord(record.id, { businessType: e.target.value ? parseInt(e.target.value) : undefined })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#818CF8] focus:border-transparent"
                          >
                            <option value="">選択してください</option>
                            {BUSINESS_TYPES.map((bt) => (
                              <option key={bt.id} value={bt.id}>
                                ({bt.id}) {bt.name}
                              </option>
                            ))}
                          </select>
                          {record.businessType && (
                            <p className="text-xs text-gray-500 mt-2">
                              {BUSINESS_TYPES.find(bt => bt.id === record.businessType)?.description}
                            </p>
                          )}
                          {record.businessType === 9 && (
                            <input
                              type="text"
                              value={record.businessTypeOther || ''}
                              onChange={(e) => updateRecord(record.id, { businessTypeOther: e.target.value })}
                              className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#818CF8] focus:border-transparent"
                              placeholder="その他の内容を入力"
                            />
                          )}
                        </div>

                        {/* 業務期間 */}
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            業務期間
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-gray-600 mb-1">
                                開始日 <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="date"
                                value={record.startDate}
                                onChange={(e) => updateRecord(record.id, { startDate: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#818CF8] focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-600 mb-1">終了日</label>
                              <input
                                type="date"
                                value={record.endDate || ''}
                                onChange={(e) => updateRecord(record.id, { endDate: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#818CF8] focus:border-transparent"
                                placeholder="在籍中は空欄"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-600 mb-1">実勤務日数</label>
                              <input
                                type="number"
                                value={record.totalWorkDays || ''}
                                onChange={(e) => updateRecord(record.id, { totalWorkDays: e.target.value ? parseInt(e.target.value) : undefined })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#818CF8] focus:border-transparent"
                                placeholder="例：470"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-600 mb-1">週平均日数</label>
                              <input
                                type="number"
                                step="0.5"
                                value={record.weeklyAverageDays || ''}
                                onChange={(e) => updateRecord(record.id, { weeklyAverageDays: e.target.value ? parseFloat(e.target.value) : undefined })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#818CF8] focus:border-transparent"
                                placeholder="例：5"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 業務内容 */}
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <Briefcase className="w-4 h-4" />
                            業務内容
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                            <div>
                              <label className="block text-xs font-bold text-gray-600 mb-1">職名</label>
                              <input
                                type="text"
                                value={record.jobTitle || ''}
                                onChange={(e) => updateRecord(record.id, { jobTitle: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#818CF8] focus:border-transparent"
                                placeholder="例：保育士、児童指導員"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-600 mb-1">雇用形態</label>
                              <div className="flex gap-4 mt-2">
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="radio"
                                    name={`employment-${record.id}`}
                                    checked={record.employmentType === 'fulltime'}
                                    onChange={() => updateRecord(record.id, { employmentType: 'fulltime' })}
                                    className="text-[#818CF8]"
                                  />
                                  常勤
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="radio"
                                    name={`employment-${record.id}`}
                                    checked={record.employmentType === 'parttime'}
                                    onChange={() => updateRecord(record.id, { employmentType: 'parttime' })}
                                    className="text-[#818CF8]"
                                  />
                                  非常勤
                                </label>
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">業務内容詳細</label>
                            <textarea
                              value={record.jobDescription || ''}
                              onChange={(e) => updateRecord(record.id, { jobDescription: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#818CF8] focus:border-transparent"
                              rows={3}
                              placeholder="例：園児に対する直接支援（食事、排泄、着脱の介助、遊びの支援など）"
                            />
                          </div>
                        </div>

                        {/* アクションボタン */}
                        <div className="flex items-center justify-between pt-2">
                          <button
                            onClick={() => handleDelete(record.id)}
                            className="text-sm text-red-500 hover:text-red-700 font-bold"
                          >
                            削除
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSave(record)}
                              disabled={savingId === record.id}
                              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-sm font-bold transition-colors flex items-center gap-2"
                            >
                              {savingId === record.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                '保存'
                              )}
                            </button>
                            {record.status === 'draft' && (
                              <>
                                <button
                                  onClick={() => {
                                    handleSave(record);
                                    setPdfPreviewRecord(record);
                                    setShowPdfPreview(true);
                                  }}
                                  disabled={!record.facilityName || !record.startDate}
                                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md text-sm font-bold transition-colors flex items-center gap-2"
                                >
                                  <Eye className="w-4 h-4" />
                                  プレビュー
                                </button>
                                <button
                                  onClick={() => {
                                    handleSave(record);
                                    openEmailPreview(record);
                                  }}
                                  disabled={!record.facilityName || !record.contactEmail}
                                  className="px-4 py-2 bg-[#818CF8] hover:bg-[#6366F1] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md text-sm font-bold transition-colors flex items-center gap-2"
                                >
                                  <Send className="w-4 h-4" />
                                  発行依頼
                                </button>
                              </>
                            )}
                            {record.status === 'pending' && (
                              <button
                                onClick={() => {
                                  setPdfPreviewRecord(record);
                                  setShowPdfPreview(true);
                                }}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-bold transition-colors flex items-center gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                プレビュー
                              </button>
                            )}
                            {record.status === 'signed' && (
                              <button
                                onClick={() => {
                                  setPdfPreviewRecord(record);
                                  setShowPdfPreview(true);
                                }}
                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm font-bold transition-colors flex items-center gap-2"
                              >
                                <Download className="w-4 h-4" />
                                証明書をダウンロード
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* 追加ボタン */}
          <button
            onClick={handleAdd}
            className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#818CF8] hover:bg-[#818CF8]/5 transition-colors text-sm font-bold text-gray-600 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            職歴を追加
          </button>
        </>
      )}

      {/* メールプレビューモーダル */}
      <AnimatePresence>
        {showEmailPreview && emailPreviewRecord && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
            >
              <div className="bg-[#818CF8] text-white px-6 py-4 flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  発行依頼メールのプレビュー
                </h3>
                <button
                  onClick={() => setShowEmailPreview(false)}
                  className="text-white/80 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-200px)]">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">宛先</label>
                  <p className="px-3 py-2 bg-gray-100 rounded-md text-sm">
                    {emailPreviewRecord.contactEmail}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">件名</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#818CF8] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">本文</label>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#818CF8] focus:border-transparent font-mono"
                    rows={15}
                  />
                </div>

                <p className="text-xs text-gray-500">
                  ※電子署名用のリンクは送信時に自動で追加されます
                </p>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowEmailPreview(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-bold text-sm"
                >
                  キャンセル
                </button>
                <button
                  onClick={sendCertificateRequest}
                  disabled={sendingEmail}
                  className="px-6 py-2 bg-[#818CF8] hover:bg-[#6366F1] disabled:bg-gray-400 text-white rounded-md font-bold text-sm flex items-center gap-2 transition-colors"
                >
                  {sendingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      送信中...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      送信する
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PDF生成モーダル */}
      {showPdfPreview && pdfPreviewRecord && (
        <CertificatePdfGenerator
          data={{
            id: pdfPreviewRecord.id,
            facilityName: pdfPreviewRecord.facilityName,
            corporateName: pdfPreviewRecord.corporateName,
            corporateAddress: pdfPreviewRecord.corporateAddress,
            corporatePhone: pdfPreviewRecord.corporatePhone,
            representativeName: pdfPreviewRecord.representativeName,
            businessType: pdfPreviewRecord.businessType,
            businessTypeOther: pdfPreviewRecord.businessTypeOther,
            startDate: pdfPreviewRecord.startDate,
            endDate: pdfPreviewRecord.endDate,
            totalWorkDays: pdfPreviewRecord.totalWorkDays,
            weeklyAverageDays: pdfPreviewRecord.weeklyAverageDays,
            jobTitle: pdfPreviewRecord.jobTitle,
            employmentType: pdfPreviewRecord.employmentType,
            jobDescription: pdfPreviewRecord.jobDescription,
            signerName: pdfPreviewRecord.signerName,
            signerTitle: pdfPreviewRecord.signerTitle,
            signatureImageUrl: pdfPreviewRecord.signatureImageUrl,
            signedAt: pdfPreviewRecord.signedAt,
            applicant: {
              name: userName,
            },
          }}
          onClose={() => {
            setShowPdfPreview(false);
            setPdfPreviewRecord(null);
          }}
        />
      )}
    </div>
  );
}
