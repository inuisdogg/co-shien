/**
 * 研修記録管理コンポーネント
 * 運営指導で必須の「人材育成」「研修実施」関連書類
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  Plus,
  Edit,
  Save,
  X,
  Calendar,
  Clock,
  MapPin,
  Users,
  FileText,
  CheckCircle,
  Download,
  Filter,
  Search,
  User,
  ExternalLink,
  Video,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PdfDocument, formatDate, toJapaneseEra } from '@/utils/pdfExport';

// 研修記録の型定義
type TrainingRecord = {
  id: string;
  facilityId: string;
  title: string;
  trainingType: 'internal' | 'external' | 'online' | 'oj_training';
  category?: string;
  trainingDate: string;
  startTime?: string;
  endTime?: string;
  durationHours?: number;
  location?: string;
  onlineUrl?: string;
  instructorName?: string;
  instructorAffiliation?: string;
  instructorQualification?: string;
  description?: string;
  objectives?: string;
  content?: string;
  materialsUsed?: string;
  participants?: Array<{ staffId: string; name: string; attended: boolean; notes?: string }>;
  participantCount?: number;
  evaluationMethod?: string;
  overallFeedback?: string;
  improvementPoints?: string;
  nextTrainingSuggestions?: string;
  attachments?: Array<{ name: string; url: string; type: string }>;
  certificateUrl?: string;
  cost?: number;
  costBreakdown?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

// スタッフの型定義
type Staff = {
  id: string;
  name: string;
  user_id?: string;
};

// DBのsnake_caseからcamelCaseに変換
const mapDbToRecord = (row: any): TrainingRecord => ({
  id: row.id,
  facilityId: row.facility_id,
  title: row.title,
  trainingType: row.training_type,
  category: row.category,
  trainingDate: row.training_date,
  startTime: row.start_time,
  endTime: row.end_time,
  durationHours: row.duration_hours,
  location: row.location,
  onlineUrl: row.online_url,
  instructorName: row.instructor_name,
  instructorAffiliation: row.instructor_affiliation,
  instructorQualification: row.instructor_qualification,
  description: row.description,
  objectives: row.objectives,
  content: row.content,
  materialsUsed: row.materials_used,
  participants: row.participants,
  participantCount: row.participant_count,
  evaluationMethod: row.evaluation_method,
  overallFeedback: row.overall_feedback,
  improvementPoints: row.improvement_points,
  nextTrainingSuggestions: row.next_training_suggestions,
  attachments: row.attachments,
  certificateUrl: row.certificate_url,
  cost: row.cost,
  costBreakdown: row.cost_breakdown,
  status: row.status,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// camelCaseからsnake_caseに変換
const mapRecordToDb = (record: Partial<TrainingRecord>) => ({
  facility_id: record.facilityId,
  title: record.title,
  training_type: record.trainingType,
  category: record.category,
  training_date: record.trainingDate,
  start_time: record.startTime,
  end_time: record.endTime,
  duration_hours: record.durationHours,
  location: record.location,
  online_url: record.onlineUrl,
  instructor_name: record.instructorName,
  instructor_affiliation: record.instructorAffiliation,
  instructor_qualification: record.instructorQualification,
  description: record.description,
  objectives: record.objectives,
  content: record.content,
  materials_used: record.materialsUsed,
  participants: record.participants,
  participant_count: record.participantCount,
  evaluation_method: record.evaluationMethod,
  overall_feedback: record.overallFeedback,
  improvement_points: record.improvementPoints,
  next_training_suggestions: record.nextTrainingSuggestions,
  attachments: record.attachments,
  certificate_url: record.certificateUrl,
  cost: record.cost,
  cost_breakdown: record.costBreakdown,
  status: record.status,
  created_by: record.createdBy,
});

// 研修種別
const trainingTypes = {
  internal: { label: '施設内研修', color: 'bg-blue-100 text-blue-700', icon: Users },
  external: { label: '外部研修', color: 'bg-green-100 text-green-700', icon: ExternalLink },
  online: { label: 'オンライン研修', color: 'bg-purple-100 text-purple-700', icon: Video },
  oj_training: { label: 'OJT', color: 'bg-orange-100 text-orange-700', icon: User },
};

// カテゴリ
const categories = {
  mandatory: { label: '法定研修', color: 'bg-red-100 text-red-700' },
  skill_improvement: { label: 'スキルアップ', color: 'bg-blue-100 text-blue-700' },
  safety: { label: '安全管理', color: 'bg-yellow-100 text-yellow-700' },
  welfare: { label: '福祉制度', color: 'bg-green-100 text-green-700' },
  medical: { label: '医療的ケア', color: 'bg-pink-100 text-pink-700' },
  communication: { label: 'コミュニケーション', color: 'bg-indigo-100 text-indigo-700' },
  other: { label: 'その他', color: 'bg-gray-100 text-gray-700' },
};

// ステータス
const statusLabels = {
  scheduled: { label: '予定', color: 'bg-blue-100 text-blue-700' },
  completed: { label: '完了', color: 'bg-green-100 text-green-700' },
  cancelled: { label: '中止', color: 'bg-gray-100 text-gray-500' },
};

export default function TrainingRecordView() {
  const { user, facility } = useAuth();
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<TrainingRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // フィルター
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // フォーム状態
  const [formData, setFormData] = useState<Partial<TrainingRecord>>({
    trainingType: 'internal',
    title: '',
    trainingDate: new Date().toISOString().split('T')[0],
    category: 'skill_improvement',
    status: 'scheduled',
    participants: [],
  });

  // データ取得
  const fetchData = useCallback(async () => {
    if (!facility?.id) return;

    setLoading(true);
    try {
      // 研修記録を取得
      const { data: recordData, error: recordError } = await supabase
        .from('training_records')
        .select('*')
        .eq('facility_id', facility.id)
        .order('training_date', { ascending: false });

      if (recordError) throw recordError;
      setRecords((recordData || []).map(mapDbToRecord));

      // スタッフ一覧を取得
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id, name, user_id')
        .eq('facility_id', facility.id)
        .order('name');

      if (staffError) throw staffError;
      setStaffList(staffData || []);
    } catch (err) {
      console.error('データ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, [facility?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 保存処理
  const handleSave = async () => {
    if (!facility?.id || !formData.title || !formData.trainingDate) {
      alert('研修名と開催日は必須です');
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        ...mapRecordToDb(formData),
        facility_id: facility.id,
        created_by: user?.id,
        participant_count: formData.participants?.length || 0,
      };

      if (selectedRecord && isEditing) {
        // 更新
        const { error } = await supabase
          .from('training_records')
          .update(dataToSave)
          .eq('id', selectedRecord.id);

        if (error) throw error;
      } else {
        // 新規作成
        const { error } = await supabase
          .from('training_records')
          .insert(dataToSave);

        if (error) throw error;
      }

      await fetchData();
      setIsCreating(false);
      setIsEditing(false);
      setSelectedRecord(null);
      resetForm();
    } catch (err) {
      console.error('保存エラー:', err);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // フォームリセット
  const resetForm = () => {
    setFormData({
      trainingType: 'internal',
      title: '',
      trainingDate: new Date().toISOString().split('T')[0],
      category: 'skill_improvement',
      status: 'scheduled',
      participants: [],
    });
  };

  // 参加者の追加・削除
  const toggleParticipant = (staff: Staff) => {
    const currentParticipants = formData.participants || [];
    const exists = currentParticipants.find((p) => p.staffId === staff.id);

    if (exists) {
      setFormData({
        ...formData,
        participants: currentParticipants.filter((p) => p.staffId !== staff.id),
      });
    } else {
      setFormData({
        ...formData,
        participants: [...currentParticipants, { staffId: staff.id, name: staff.name, attended: false }],
      });
    }
  };

  // PDF出力
  const exportPdf = (record: TrainingRecord) => {
    const pdf = new PdfDocument({
      title: '研修実施報告書',
      facilityName: facility?.name || '施設名',
      facilityCode: facility?.code,
      createdAt: formatDate(new Date(), 'short'),
    });

    pdf.drawHeader();
    pdf.addSpace(5);

    // 基本情報
    pdf.addLabelValue('研修名', record.title);
    pdf.addLabelValue('研修種別', trainingTypes[record.trainingType].label);
    if (record.category) {
      pdf.addLabelValue('カテゴリ', categories[record.category as keyof typeof categories]?.label || record.category);
    }
    pdf.addLabelValue('開催日', toJapaneseEra(record.trainingDate));
    if (record.startTime && record.endTime) {
      pdf.addLabelValue('時間', `${record.startTime} 〜 ${record.endTime}`);
    }
    if (record.durationHours) {
      pdf.addLabelValue('研修時間', `${record.durationHours}時間`);
    }
    pdf.addLabelValue('開催場所', record.location || '-');

    pdf.addSpace(5);
    pdf.addLine();
    pdf.addSpace(5);

    // 講師情報
    if (record.instructorName) {
      pdf.addText('講師情報', { fontSize: 12 });
      pdf.addSpace(3);
      pdf.addLabelValue('講師名', record.instructorName);
      if (record.instructorAffiliation) pdf.addLabelValue('所属', record.instructorAffiliation);
      if (record.instructorQualification) pdf.addLabelValue('資格', record.instructorQualification);
    }

    // 研修内容
    if (record.description) {
      pdf.addSpace(5);
      pdf.addText('研修概要', { fontSize: 12 });
      pdf.addSpace(3);
      pdf.addMultilineText(record.description);
    }

    if (record.objectives) {
      pdf.addSpace(5);
      pdf.addText('研修目標', { fontSize: 12 });
      pdf.addSpace(3);
      pdf.addMultilineText(record.objectives);
    }

    if (record.content) {
      pdf.addSpace(5);
      pdf.addText('研修内容', { fontSize: 12 });
      pdf.addSpace(3);
      pdf.addMultilineText(record.content);
    }

    // 参加者
    if (record.participants && record.participants.length > 0) {
      pdf.addSpace(5);
      pdf.addText('参加者', { fontSize: 12 });
      pdf.addSpace(3);
      pdf.addTable(
        [
          { header: '氏名', key: 'name', width: 40 },
          { header: '出席', key: 'attendance', width: 20, align: 'center' as const },
          { header: '備考', key: 'notes', width: 40 },
        ],
        record.participants.map((p) => ({
          name: p.name,
          attendance: p.attended ? '○' : '×',
          notes: p.notes || '',
        }))
      );
    }

    // 振り返り
    if (record.overallFeedback) {
      pdf.addSpace(5);
      pdf.addText('全体の振り返り', { fontSize: 12 });
      pdf.addSpace(3);
      pdf.addMultilineText(record.overallFeedback);
    }

    if (record.improvementPoints) {
      pdf.addSpace(5);
      pdf.addText('改善点', { fontSize: 12 });
      pdf.addSpace(3);
      pdf.addMultilineText(record.improvementPoints);
    }

    // 署名欄
    pdf.addSignatureBlock([
      { role: '記録者', signed: false },
      { role: '確認者', signed: false },
    ]);

    pdf.save(`研修記録_${record.title}_${record.trainingDate}.pdf`);
  };

  // フィルター適用
  const filteredRecords = records.filter((record) => {
    if (filterType !== 'all' && record.trainingType !== filterType) return false;
    if (filterStatus !== 'all' && record.status !== filterStatus) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        record.title.toLowerCase().includes(query) ||
        record.instructorName?.toLowerCase().includes(query) ||
        record.description?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c4cc]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-[#00c4cc]" />
            研修記録
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            スタッフの研修実施記録を管理します
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsCreating(true);
            setSelectedRecord(null);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#00c4cc] text-white rounded-lg text-sm font-medium hover:bg-[#00b0b8] transition-colors"
        >
          <Plus className="w-4 h-4" />
          新規研修
        </button>
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">全種別</option>
              <option value="internal">施設内研修</option>
              <option value="external">外部研修</option>
              <option value="online">オンライン研修</option>
              <option value="oj_training">OJT</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">全ステータス</option>
              <option value="scheduled">予定</option>
              <option value="completed">完了</option>
              <option value="cancelled">中止</option>
            </select>
          </div>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-1.5 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 研修一覧 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-bold text-gray-800">研修一覧</h2>
              <p className="text-xs text-gray-500 mt-1">{filteredRecords.length}件</p>
            </div>
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {filteredRecords.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <GraduationCap className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  研修記録がありません
                </div>
              ) : (
                filteredRecords.map((record) => {
                  const TypeIcon = trainingTypes[record.trainingType].icon;
                  return (
                    <button
                      key={record.id}
                      onClick={() => {
                        setSelectedRecord(record);
                        setIsCreating(false);
                        setIsEditing(false);
                      }}
                      className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                        selectedRecord?.id === record.id ? 'bg-[#00c4cc]/5 border-l-4 border-[#00c4cc]' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${trainingTypes[record.trainingType].color}`}>
                          <TypeIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusLabels[record.status].color}`}>
                              {statusLabels[record.status].label}
                            </span>
                            {record.category && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${categories[record.category as keyof typeof categories]?.color || 'bg-gray-100 text-gray-600'}`}>
                                {categories[record.category as keyof typeof categories]?.label || record.category}
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-gray-800 truncate">{record.title}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(record.trainingDate).toLocaleDateString('ja-JP')}
                            {record.participantCount !== undefined && ` / ${record.participantCount}名参加`}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 詳細・フォーム */}
        <div className="lg:col-span-2">
          {isCreating || (selectedRecord && isEditing) ? (
            // 編集フォーム
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-800">
                  {selectedRecord ? '研修を編集' : '新規研修'}
                </h2>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* 研修種別 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">研修種別</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(trainingTypes) as Array<keyof typeof trainingTypes>).map((type) => {
                      const TypeIcon = trainingTypes[type].icon;
                      return (
                        <button
                          key={type}
                          onClick={() => setFormData({ ...formData, trainingType: type })}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                            formData.trainingType === type
                              ? 'border-[#00c4cc] bg-[#00c4cc]/5 text-[#00c4cc]'
                              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <TypeIcon className="w-4 h-4" />
                          {trainingTypes[type].label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 研修名 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">研修名 *</label>
                  <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="研修のタイトルを入力"
                  />
                </div>

                {/* カテゴリ */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">カテゴリ</label>
                  <select
                    value={formData.category || ''}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  >
                    <option value="">選択してください</option>
                    {Object.entries(categories).map(([key, { label }]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 日時 */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">開催日 *</label>
                    <input
                      type="date"
                      value={formData.trainingDate || ''}
                      onChange={(e) => setFormData({ ...formData, trainingDate: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">開始時間</label>
                    <input
                      type="time"
                      value={formData.startTime || ''}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">終了時間</label>
                    <input
                      type="time"
                      value={formData.endTime || ''}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                </div>

                {/* 場所 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">開催場所</label>
                  <input
                    type="text"
                    value={formData.location || ''}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="会議室、〇〇ホールなど"
                  />
                </div>

                {/* 講師情報 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">講師名</label>
                    <input
                      type="text"
                      value={formData.instructorName || ''}
                      onChange={(e) => setFormData({ ...formData, instructorName: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">講師所属</label>
                    <input
                      type="text"
                      value={formData.instructorAffiliation || ''}
                      onChange={(e) => setFormData({ ...formData, instructorAffiliation: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                </div>

                {/* 研修内容 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">研修概要</label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="研修の概要を入力"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">研修目標</label>
                  <textarea
                    value={formData.objectives || ''}
                    onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="研修で達成したい目標"
                  />
                </div>

                {/* 参加者選択 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">参加者</label>
                  <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                    <div className="flex flex-wrap gap-2">
                      {staffList.map((staff) => {
                        const isSelected = formData.participants?.some((p) => p.staffId === staff.id);
                        return (
                          <button
                            key={staff.id}
                            onClick={() => toggleParticipant(staff)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors ${
                              isSelected
                                ? 'bg-[#00c4cc] text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            <User className="w-3 h-3" />
                            {staff.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.participants?.length || 0}名選択中
                  </p>
                </div>

                {/* ステータス */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">ステータス</label>
                  <select
                    value={formData.status || 'scheduled'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  >
                    <option value="scheduled">予定</option>
                    <option value="completed">完了</option>
                    <option value="cancelled">中止</option>
                  </select>
                </div>

                {/* 完了の場合の追加項目 */}
                {formData.status === 'completed' && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">全体の振り返り</label>
                      <textarea
                        value={formData.overallFeedback || ''}
                        onChange={(e) => setFormData({ ...formData, overallFeedback: e.target.value })}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2"
                        placeholder="研修全体を通しての振り返り"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">改善点</label>
                      <textarea
                        value={formData.improvementPoints || ''}
                        onChange={(e) => setFormData({ ...formData, improvementPoints: e.target.value })}
                        rows={2}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2"
                        placeholder="次回に向けての改善点"
                      />
                    </div>
                  </>
                )}

                {/* 保存ボタン */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      setIsEditing(false);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-[#00c4cc] text-white rounded-lg hover:bg-[#00b0b8] disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            </div>
          ) : selectedRecord ? (
            // 詳細表示
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${trainingTypes[selectedRecord.trainingType].color}`}>
                      {trainingTypes[selectedRecord.trainingType].label}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusLabels[selectedRecord.status].color}`}>
                      {statusLabels[selectedRecord.status].label}
                    </span>
                    {selectedRecord.category && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${categories[selectedRecord.category as keyof typeof categories]?.color || 'bg-gray-100 text-gray-600'}`}>
                        {categories[selectedRecord.category as keyof typeof categories]?.label || selectedRecord.category}
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-gray-800">{selectedRecord.title}</h2>
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {new Date(selectedRecord.trainingDate).toLocaleDateString('ja-JP')}
                    {selectedRecord.startTime && selectedRecord.endTime && (
                      <>
                        <Clock className="w-4 h-4 ml-2" />
                        {selectedRecord.startTime} 〜 {selectedRecord.endTime}
                      </>
                    )}
                  </p>
                  {selectedRecord.location && (
                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {selectedRecord.location}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => exportPdf(selectedRecord)}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-800 border border-gray-300 px-3 py-2 rounded-lg"
                  >
                    <Download className="w-4 h-4" />
                    PDF出力
                  </button>
                  <button
                    onClick={() => {
                      setFormData({
                        ...selectedRecord,
                      });
                      setIsEditing(true);
                    }}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-800 border border-gray-300 px-3 py-2 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                    編集
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {/* 講師情報 */}
                {selectedRecord.instructorName && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2">講師情報</h3>
                    <p className="text-gray-600">
                      {selectedRecord.instructorName}
                      {selectedRecord.instructorAffiliation && ` (${selectedRecord.instructorAffiliation})`}
                    </p>
                  </div>
                )}

                {/* 研修概要 */}
                {selectedRecord.description && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2">研修概要</h3>
                    <p className="text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                      {selectedRecord.description}
                    </p>
                  </div>
                )}

                {/* 研修目標 */}
                {selectedRecord.objectives && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2">研修目標</h3>
                    <p className="text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                      {selectedRecord.objectives}
                    </p>
                  </div>
                )}

                {/* 参加者 */}
                {selectedRecord.participants && selectedRecord.participants.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2">
                      参加者 ({selectedRecord.participants.length}名)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedRecord.participants.map((p, i) => (
                        <span
                          key={i}
                          className={`px-3 py-1 rounded-full text-sm ${
                            p.attended ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {p.name}
                          {p.attended && <CheckCircle className="w-3 h-3 inline ml-1" />}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 振り返り */}
                {selectedRecord.overallFeedback && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2">全体の振り返り</h3>
                    <p className="text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                      {selectedRecord.overallFeedback}
                    </p>
                  </div>
                )}

                {selectedRecord.improvementPoints && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-2">改善点</h3>
                    <p className="text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                      {selectedRecord.improvementPoints}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // 未選択時
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <div className="text-center text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>研修を選択するか、新規研修を作成してください</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
