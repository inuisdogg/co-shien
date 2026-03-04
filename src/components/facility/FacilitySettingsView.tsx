/**
 * 施設情報設定ビュー
 */

'use client';

import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { Settings, Save, Calendar, Clock, Users, Building2, Plus, Trash2, History, X, MapPin, Truck, Briefcase, UserCheck, AlertTriangle, FileText, ChevronRight, Bell, Shield, CheckCircle, Loader2, Camera, ImagePlus, Database, Download, AlertOctagon, Info, Globe, Copy, ExternalLink, Eye, Search, ClipboardList, Stethoscope, Edit3, Upload } from 'lucide-react';
import { normalizeAddress } from '@/lib/addressNormalizer';
import { FacilitySettings, HolidayPeriod, BusinessHoursPeriod, FacilitySettingsHistory, ChangeNotification, CHANGE_NOTIFICATION_TYPE_LABELS, CHANGE_NOTIFICATION_STATUS_CONFIG, CertificationStatus, CooperativeMedicalInstitution, DesignationChecklistItem } from '@/types';
import { DESIGNATION_DOCUMENTS, CHECKLIST_STATUS_CONFIG, type ChecklistStatus } from '@/constants/designationChecklist';
import FileUploader from '@/components/common/FileUploader';
import {
  generateChangeNotificationHTML,
  generateOperatingRegulationsHTML,
  openPrintWindow as openDocPrintWindow,
  analyzeChangeImpact,
  CHANGE_IMPACT_MAP,
  CHANGE_TYPE_LABELS,
  type FacilityInfo,
} from '@/lib/changeDocumentEngine';
import { useFacilityData } from '@/hooks/useFacilityData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { getJapaneseHolidays } from '@/utils/japaneseHolidays';
import { useChangeNotifications, detectSettingsChanges, daysUntilDeadline, getDeadlineColor, getDeadlineBgColor } from '@/hooks/useChangeNotifications';
import { geocodeAddress } from '@/utils/googleMaps';
import ChangeNotificationList from './ChangeNotificationList';
import OperationsReviewWizard from './OperationsReviewWizard';
// タブの種類
type SettingsTab = 'basic' | 'operation' | 'designation' | 'change_notifications' | 'notification_preferences' | 'data_management' | 'homepage';

const SETTINGS_TABS: { id: SettingsTab; label: string; icon: 'building' | 'clock' | 'bell' | 'bellring' | 'database' | 'globe' | 'clipboard' }[] = [
  { id: 'basic', label: '基本情報', icon: 'building' },
  { id: 'operation', label: '営業・休日', icon: 'clock' },
  { id: 'designation', label: '指定情報', icon: 'clipboard' },
  { id: 'homepage', label: 'ホームページ', icon: 'globe' },
  { id: 'change_notifications', label: '変更届', icon: 'bell' },
  { id: 'notification_preferences', label: '通知設定', icon: 'bellring' },
  { id: 'data_management', label: 'データ管理', icon: 'database' },
];

// 通知設定の型
interface NotificationPreferences {
  types: {
    newApplication: boolean;   // 新規応募
    newMessage: boolean;       // 新着メッセージ
    scoutReply: boolean;       // スカウト返信
    interviewConfirmed: boolean; // 面接確定
    reviewPosted: boolean;     // レビュー投稿
  };
  channels: {
    email: boolean;
    push: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm
    end: string;   // HH:mm
  };
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  types: {
    newApplication: true,
    newMessage: true,
    scoutReply: true,
    interviewConfirmed: true,
    reviewPosted: true,
  },
  channels: {
    email: true,
    push: true,
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
  },
};

const NOTIFICATION_TYPE_LABELS: { key: keyof NotificationPreferences['types']; label: string; description: string }[] = [
  { key: 'newApplication', label: '新規応募', description: '求人への新しい応募があった時' },
  { key: 'newMessage', label: '新着メッセージ', description: '新しいチャットメッセージを受信した時' },
  { key: 'scoutReply', label: 'スカウト返信', description: 'スカウトへの返信があった時' },
  { key: 'interviewConfirmed', label: '面接確定', description: '面接日程が確定した時' },
  { key: 'reviewPosted', label: 'レビュー投稿', description: '施設へのレビューが投稿された時' },
];

const FacilitySettingsView: React.FC = () => {
  const { facilitySettings, updateFacilitySettings, saving, timeSlots, addTimeSlot, updateTimeSlot, deleteTimeSlot } = useFacilityData();
  const { facility } = useAuth();
  const { toast } = useToast();
  const {
    pendingNotifications,
    pendingCount,
    createNotificationsFromChanges,
    updateStatus: updateNotificationStatus,
    notifications: allNotifications,
    refetch: refetchNotifications,
  } = useChangeNotifications();
  const [currentFacilityCode, setCurrentFacilityCode] = useState<string>('');
  const [activeTab, setActiveTab] = useState<SettingsTab>('basic');
  const [showChangeWarning, setShowChangeWarning] = useState(false);
  const [detectedChanges, setDetectedChanges] = useState<{ type: import('@/types').ChangeNotificationType; description: string; oldValue: any; newValue: any }[]>([]);
  const [showPostSaveAlert, setShowPostSaveAlert] = useState(false);
  const settingsSnapshotRef = useRef<FacilitySettings>(facilitySettings);

  const [settings, setSettings] = useState<FacilitySettings>(facilitySettings);
  const [newHoliday, setNewHoliday] = useState('');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyType, setHistoryType] = useState<'business_hours' | 'holidays' | 'all'>('all');
  const [historyData, setHistoryData] = useState<FacilitySettingsHistory[]>([]);
  const [isAddingTimeSlot, setIsAddingTimeSlot] = useState(false);
  const [newTimeSlot, setNewTimeSlot] = useState({ name: '', startTime: '09:00', endTime: '12:00', capacity: 10 });
  const [editingTimeSlotId, setEditingTimeSlotId] = useState<string | null>(null);
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [showOperationsWizard, setShowOperationsWizard] = useState(false);

  // データ管理（APPI）
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletionRequested, setDeletionRequested] = useState(false);
  const [exportingData, setExportingData] = useState(false);

  // 通知設定
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [notificationSaved, setNotificationSaved] = useState(false);

  // 施設認証
  const [certificationNumber, setCertificationNumber] = useState('');
  const [certificationStatus, setCertificationStatus] = useState<CertificationStatus>('unverified');
  const [certificationVerifiedAt, setCertificationVerifiedAt] = useState<string | null>(null);
  const [certificationSubmitting, setCertificationSubmitting] = useState(false);

  // 施設写真
  const [facilityPhotos, setFacilityPhotos] = useState<string[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ホームページ設定
  const [homepageCopied, setHomepageCopied] = useState(false);
  const [homepageSaving, setHomepageSaving] = useState(false);
  const [homepageSaved, setHomepageSaved] = useState(false);

  // 指定情報
  const [designationDate, setDesignationDate] = useState('');
  const [designationExpiryDate, setDesignationExpiryDate] = useState('');
  const [designationDocPath, setDesignationDocPath] = useState('');
  const [designationDocName, setDesignationDocName] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  const [designatedServiceTypes, setDesignatedServiceTypes] = useState<string[]>([]);
  const [designationSaving, setDesignationSaving] = useState(false);
  const [designationSaved, setDesignationSaved] = useState(false);

  // 協力医療機関
  const [medicalInstitutions, setMedicalInstitutions] = useState<CooperativeMedicalInstitution[]>([]);
  const [editingInstitution, setEditingInstitution] = useState<Partial<CooperativeMedicalInstitution> | null>(null);
  const [institutionSaving, setInstitutionSaving] = useState(false);

  // チェックリスト
  const [checklistItems, setChecklistItems] = useState<DesignationChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);

  // 補足情報
  const [socialInsurance, setSocialInsurance] = useState<Record<string, boolean>>({
    healthInsurance: false, welfarePension: false, employmentInsurance: false, workersComp: false,
  });
  const [earthquakeResistance, setEarthquakeResistance] = useState<Record<string, string>>({
    buildYear: '', diagnosisCompleted: 'no', diagnosisResult: '',
  });
  const [complaintResolution, setComplaintResolution] = useState<Record<string, string>>({
    responsiblePerson: '', receptionHours: '', externalConsultation: '',
  });
  const [primaryDisabilityTypes, setPrimaryDisabilityTypes] = useState<string[]>([]);

  // 最新の施設コード・認証情報・写真・指定情報を取得
  useEffect(() => {
    const fetchFacilityCode = async () => {
      if (facility?.id) {
        const { data, error } = await supabase
          .from('facilities')
          .select('code, certification_number, certification_status, certification_verified_at, photos, business_number, designation_document_path, designation_date, designation_expiry_date, designated_service_types')
          .eq('id', facility.id)
          .single();

        if (!error && data) {
          setCurrentFacilityCode(data.code || '');
          setCertificationNumber(data.certification_number || '');
          setCertificationStatus((data.certification_status as CertificationStatus) || 'unverified');
          setCertificationVerifiedAt(data.certification_verified_at || null);
          setFacilityPhotos(Array.isArray(data.photos) ? data.photos : []);
          setBusinessNumber(data.business_number || '');
          setDesignationDocPath(data.designation_document_path || '');
          setDesignationDate(data.designation_date || '');
          setDesignationExpiryDate(data.designation_expiry_date || '');
          setDesignatedServiceTypes(Array.isArray(data.designated_service_types) ? data.designated_service_types : []);
        }
      }
    };

    fetchFacilityCode();
  }, [facility?.id]);

  // 協力医療機関を取得
  useEffect(() => {
    const fetchMedicalInstitutions = async () => {
      if (!facility?.id) return;
      const { data, error } = await supabase
        .from('cooperative_medical_institutions')
        .select('*')
        .eq('facility_id', facility.id)
        .order('is_primary', { ascending: false });
      if (!error && data) {
        setMedicalInstitutions(data.map((row: any) => ({
          id: row.id,
          facilityId: row.facility_id,
          institutionName: row.institution_name,
          department: row.department,
          doctorName: row.doctor_name,
          address: row.address,
          phone: row.phone,
          travelTimeMinutes: row.travel_time_minutes,
          agreementFileUrl: row.agreement_file_url,
          agreementFileName: row.agreement_file_name,
          agreementDate: row.agreement_date,
          agreementExpiryDate: row.agreement_expiry_date,
          notes: row.notes,
          isPrimary: row.is_primary || false,
        })));
      }
    };
    fetchMedicalInstitutions();
  }, [facility?.id]);

  // チェックリストを取得
  useEffect(() => {
    const fetchChecklist = async () => {
      if (!facility?.id) return;
      setChecklistLoading(true);
      const { data, error } = await supabase
        .from('designation_checklist')
        .select('*')
        .eq('facility_id', facility.id)
        .order('document_number');
      if (!error && data) {
        setChecklistItems(data.map((row: any) => ({
          id: row.id,
          facilityId: row.facility_id,
          documentNumber: row.document_number,
          documentName: row.document_name,
          status: row.status,
          fileUrl: row.file_url,
          fileName: row.file_name,
          notes: row.notes,
          linkedFeature: row.linked_feature,
          updatedAt: row.updated_at,
        })));
      }
      setChecklistLoading(false);
    };
    fetchChecklist();
  }, [facility?.id]);

  // 補足情報をfacility_settingsから取得
  useEffect(() => {
    if (settings) {
      const s = settings as any;
      if (s.socialInsuranceStatus && typeof s.socialInsuranceStatus === 'object') {
        setSocialInsurance(prev => ({ ...prev, ...s.socialInsuranceStatus }));
      }
      if (s.earthquakeResistance && typeof s.earthquakeResistance === 'object') {
        setEarthquakeResistance(prev => ({ ...prev, ...s.earthquakeResistance }));
      }
      if (s.complaintResolution && typeof s.complaintResolution === 'object') {
        setComplaintResolution(prev => ({ ...prev, ...s.complaintResolution }));
      }
      if (Array.isArray(s.primaryDisabilityTypes)) {
        setPrimaryDisabilityTypes(s.primaryDisabilityTypes);
      }
    }
  }, [settings]);

  // 通知設定をlocalStorageから読み込み
  useEffect(() => {
    if (facility?.id) {
      try {
        const stored = localStorage.getItem(`notification_prefs_${facility.id}`);
        if (stored) {
          setNotificationPrefs(JSON.parse(stored));
        }
      } catch {
        // パースエラーは無視
      }
    }
  }, [facility?.id]);

  // 通知設定を保存
  const handleSaveNotificationPrefs = () => {
    if (!facility?.id) return;
    localStorage.setItem(`notification_prefs_${facility.id}`, JSON.stringify(notificationPrefs));
    setNotificationSaved(true);
    setTimeout(() => setNotificationSaved(false), 3000);
  };

  // 認証申請
  const handleCertificationSubmit = async () => {
    if (!facility?.id || !certificationNumber.trim()) return;
    setCertificationSubmitting(true);
    try {
      const { error } = await supabase
        .from('facilities')
        .update({
          certification_number: certificationNumber.trim(),
          certification_status: 'pending',
        })
        .eq('id', facility.id);

      if (error) {
        console.error('認証申請に失敗しました:', error);
        toast.error('認証申請に失敗しました');
      } else {
        setCertificationStatus('pending');
        toast.success('認証申請を送信しました。審査完了までしばらくお待ちください。');
      }
    } catch (err) {
      console.error('認証申請時にエラーが発生しました:', err);
      toast.error('認証申請に失敗しました');
    } finally {
      setCertificationSubmitting(false);
    }
  };

  // 写真アップロード
  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !facility?.id) return;

    // バリデーション
    if (!file.type.startsWith('image/')) {
      toast.warning('画像ファイルのみアップロードできます');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.warning('ファイルサイズは5MB以下にしてください');
      return;
    }
    if (facilityPhotos.length >= 10) {
      toast.warning('写真は最大10枚までです');
      return;
    }

    setPhotoUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${facility.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('facility-photos')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        console.error('写真のアップロードに失敗しました:', uploadError);
        toast.error('写真のアップロードに失敗しました');
        return;
      }

      const { data: urlData } = supabase.storage
        .from('facility-photos')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;
      const newPhotos = [...facilityPhotos, publicUrl];

      const { error: updateError } = await supabase
        .from('facilities')
        .update({ photos: newPhotos })
        .eq('id', facility.id);

      if (updateError) {
        console.error('写真情報の更新に失敗しました:', updateError);
        toast.error('写真情報の更新に失敗しました');
        return;
      }

      setFacilityPhotos(newPhotos);
    } catch (err) {
      console.error('写真アップロード時にエラーが発生しました:', err);
      toast.error('写真のアップロードに失敗しました');
    } finally {
      setPhotoUploading(false);
      // file inputをリセット
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
    }
  };

  // 写真削除
  const handlePhotoDelete = async (photoUrl: string) => {
    if (!facility?.id) return;
    if (!confirm('この写真を削除しますか？')) return;

    try {
      const newPhotos = facilityPhotos.filter((url) => url !== photoUrl);

      const { error: updateError } = await supabase
        .from('facilities')
        .update({ photos: newPhotos })
        .eq('id', facility.id);

      if (updateError) {
        console.error('写真の削除に失敗しました:', updateError);
        toast.error('写真の削除に失敗しました');
        return;
      }

      setFacilityPhotos(newPhotos);

      // ストレージからも削除を試みる（エラーがあっても無視）
      try {
        const url = new URL(photoUrl);
        const pathParts = url.pathname.split('/facility-photos/');
        if (pathParts.length > 1) {
          const storagePath = decodeURIComponent(pathParts[1]);
          await supabase.storage.from('facility-photos').remove([storagePath]);
        }
      } catch {
        // ストレージ削除のエラーは無視
      }
    } catch (err) {
      console.error('写真削除時にエラーが発生しました:', err);
      toast.error('写真の削除に失敗しました');
    }
  };

  // 郵便番号から住所を検索（+ ジオコーディングで緯度経度も取得）
  const lookupAddress = async () => {
    const postalCode = settings.postalCode?.replace(/-/g, '');
    if (!postalCode || postalCode.length !== 7) {
      toast.warning('7桁の郵便番号を入力してください');
      return;
    }

    setIsAddressLoading(true);
    try {
      const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${postalCode}`);
      if (!response.ok) throw new Error('API error');
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        const fullAddress = `${result.address1}${result.address2}${result.address3}`;
        const updated: Partial<typeof settings> = { address: fullAddress };

        // ジオコーディングで緯度経度も取得（送迎ルート計算に必要）
        try {
          const loc = await geocodeAddress(fullAddress);
          if (loc) {
            updated.latitude = loc.lat;
            updated.longitude = loc.lng;
          }
        } catch {
          // ジオコーディング失敗は無視（住所だけでもセット）
        }

        setSettings({ ...settings, ...updated });
        toast.success('住所を取得しました');
      } else {
        toast.warning('住所が見つかりませんでした');
      }
    } catch (error) {
      console.error('Error looking up address:', error);
      toast.error('住所検索に失敗しました');
    } finally {
      setIsAddressLoading(false);
    }
  };

  // facilitySettingsが更新されたらローカル状態も更新
  useEffect(() => {
    setSettings(facilitySettings);
    settingsSnapshotRef.current = facilitySettings;
  }, [facilitySettings]);

  // === 指定情報の保存ハンドラ ===
  const handleSaveDesignation = async () => {
    if (!facility?.id) return;
    setDesignationSaving(true);
    try {
      // facilities テーブル更新
      const { error: facError } = await supabase
        .from('facilities')
        .update({
          business_number: businessNumber.trim(),
          designation_date: designationDate || null,
          designation_expiry_date: designationExpiryDate || null,
          designation_document_path: designationDocPath || null,
          designated_service_types: designatedServiceTypes,
        })
        .eq('id', facility.id);
      if (facError) throw facError;

      // facility_settings テーブル更新（補足情報）
      const { error: settingsError } = await supabase
        .from('facility_settings')
        .update({
          social_insurance_status: socialInsurance,
          earthquake_resistance: earthquakeResistance,
          complaint_resolution: complaintResolution,
          primary_disability_types: primaryDisabilityTypes,
        })
        .eq('facility_id', facility.id);
      if (settingsError) throw settingsError;

      // 変更届の自動生成が必要な変更がないかチェック（指定情報変更は重要）
      // 事業所番号の変更、サービス種別の変更は届出対象
      setDesignationSaved(true);
      setTimeout(() => setDesignationSaved(false), 3000);
      refetchNotifications();
    } catch (error: any) {
      console.error('指定情報の保存に失敗:', error);
      toast.error(`保存に失敗しました: ${error.message || '不明なエラー'}`);
    } finally {
      setDesignationSaving(false);
    }
  };

  // 協力医療機関の保存
  const handleSaveInstitution = async () => {
    if (!facility?.id || !editingInstitution) return;
    if (!editingInstitution.institutionName?.trim()) {
      toast.warning('医療機関名を入力してください');
      return;
    }
    setInstitutionSaving(true);
    try {
      const payload = {
        facility_id: facility.id,
        institution_name: editingInstitution.institutionName?.trim(),
        department: editingInstitution.department || null,
        doctor_name: editingInstitution.doctorName || null,
        address: editingInstitution.address || null,
        phone: editingInstitution.phone || null,
        travel_time_minutes: editingInstitution.travelTimeMinutes || null,
        agreement_file_url: editingInstitution.agreementFileUrl || null,
        agreement_file_name: editingInstitution.agreementFileName || null,
        agreement_date: editingInstitution.agreementDate || null,
        agreement_expiry_date: editingInstitution.agreementExpiryDate || null,
        notes: editingInstitution.notes || null,
        is_primary: editingInstitution.isPrimary || false,
        updated_at: new Date().toISOString(),
      };

      if (editingInstitution.id) {
        // 更新
        const { error } = await supabase
          .from('cooperative_medical_institutions')
          .update(payload)
          .eq('id', editingInstitution.id);
        if (error) throw error;
        setMedicalInstitutions(prev => prev.map(inst =>
          inst.id === editingInstitution.id
            ? { ...inst, ...editingInstitution as CooperativeMedicalInstitution }
            : inst
        ));
      } else {
        // 新規作成
        const { data, error } = await supabase
          .from('cooperative_medical_institutions')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        if (data) {
          setMedicalInstitutions(prev => [...prev, {
            id: data.id,
            facilityId: data.facility_id,
            institutionName: data.institution_name,
            department: data.department,
            doctorName: data.doctor_name,
            address: data.address,
            phone: data.phone,
            travelTimeMinutes: data.travel_time_minutes,
            agreementFileUrl: data.agreement_file_url,
            agreementFileName: data.agreement_file_name,
            agreementDate: data.agreement_date,
            agreementExpiryDate: data.agreement_expiry_date,
            notes: data.notes,
            isPrimary: data.is_primary || false,
          }]);
        }
      }
      setEditingInstitution(null);
    } catch (error: any) {
      console.error('医療機関の保存に失敗:', error);
      toast.error(`保存に失敗しました: ${error.message || '不明なエラー'}`);
    } finally {
      setInstitutionSaving(false);
    }
  };

  // 協力医療機関の削除
  const handleDeleteInstitution = async (id: string) => {
    if (!confirm('この医療機関を削除しますか？')) return;
    try {
      const { error } = await supabase
        .from('cooperative_medical_institutions')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setMedicalInstitutions(prev => prev.filter(inst => inst.id !== id));
    } catch (error: any) {
      console.error('医療機関の削除に失敗:', error);
      toast.error(`削除に失敗しました: ${error.message || '不明なエラー'}`);
    }
  };

  // チェックリストステータス更新
  const handleUpdateChecklistStatus = async (documentNumber: number, newStatus: ChecklistStatus) => {
    if (!facility?.id) return;
    const existing = checklistItems.find(item => item.documentNumber === documentNumber);
    const doc = DESIGNATION_DOCUMENTS.find(d => d.number === documentNumber);
    try {
      if (existing) {
        const { error } = await supabase
          .from('designation_checklist')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
        setChecklistItems(prev => prev.map(item =>
          item.documentNumber === documentNumber ? { ...item, status: newStatus } : item
        ));
      } else {
        const { data, error } = await supabase
          .from('designation_checklist')
          .insert({
            facility_id: facility.id,
            document_number: documentNumber,
            document_name: doc?.name || '',
            status: newStatus,
            linked_feature: doc?.linkedFeature || null,
          })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          setChecklistItems(prev => [...prev, {
            id: data.id,
            facilityId: data.facility_id,
            documentNumber: data.document_number,
            documentName: data.document_name,
            status: data.status,
            fileUrl: data.file_url,
            fileName: data.file_name,
            notes: data.notes,
            linkedFeature: data.linked_feature,
            updatedAt: data.updated_at,
          }]);
        }
      }
    } catch (error: any) {
      console.error('チェックリスト更新に失敗:', error);
    }
  };

  // チェックリスト ファイルアップロード処理
  const handleChecklistFileUpload = async (documentNumber: number, fileUrl: string, fileName: string) => {
    if (!facility?.id) return;
    const existing = checklistItems.find(item => item.documentNumber === documentNumber);
    const doc = DESIGNATION_DOCUMENTS.find(d => d.number === documentNumber);
    try {
      if (existing) {
        const { error } = await supabase
          .from('designation_checklist')
          .update({ file_url: fileUrl, file_name: fileName, status: 'uploaded', updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
        setChecklistItems(prev => prev.map(item =>
          item.documentNumber === documentNumber ? { ...item, fileUrl, fileName, status: 'uploaded' as const } : item
        ));
      } else {
        const { data, error } = await supabase
          .from('designation_checklist')
          .insert({
            facility_id: facility.id,
            document_number: documentNumber,
            document_name: doc?.name || '',
            status: 'uploaded',
            file_url: fileUrl,
            file_name: fileName,
            linked_feature: doc?.linkedFeature || null,
          })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          setChecklistItems(prev => [...prev, {
            id: data.id,
            facilityId: data.facility_id,
            documentNumber: data.document_number,
            documentName: data.document_name,
            status: data.status as any,
            fileUrl: data.file_url,
            fileName: data.file_name,
            notes: data.notes,
            linkedFeature: data.linked_feature,
            updatedAt: data.updated_at,
          }]);
        }
      }
    } catch (error: any) {
      console.error('チェックリストファイル更新に失敗:', error);
    }
  };

  const weekDays = [
    { value: 0, label: '日' },
    { value: 1, label: '月' },
    { value: 2, label: '火' },
    { value: 3, label: '水' },
    { value: 4, label: '木' },
    { value: 5, label: '金' },
    { value: 6, label: '土' },
  ];

  const handleSave = async () => {
    // Check for changes that require notification
    const changes = detectSettingsChanges(settingsSnapshotRef.current, settings);

    if (changes.length > 0) {
      setDetectedChanges(changes);
      setShowChangeWarning(true);
      return;
    }

    await performSave();
  };

  const performSave = async () => {
    try {
      await updateFacilitySettings(settings, '施設情報を更新しました');

      // If there were detected changes, create notifications
      if (detectedChanges.length > 0) {
        await createNotificationsFromChanges(detectedChanges);
        setDetectedChanges([]);
        setShowPostSaveAlert(true);
      } else {
        toast.success('施設情報を保存しました');
      }
    } catch (error: any) {
      console.error('Error saving facility settings:', error);
      toast.error(`施設情報の保存に失敗しました: ${error.message || '不明なエラー'}`);
    }
  };

  const handleConfirmSaveWithNotification = async () => {
    setShowChangeWarning(false);
    await performSave();
  };

  // 履歴を取得
  const fetchHistory = async (type: 'business_hours' | 'holidays' | 'all' = 'all') => {
    if (!facility?.id) return;
    
    try {
      let query = supabase
        .from('facility_settings_history')
        .select('*')
        .eq('facility_id', facility.id)
        .order('changed_at', { ascending: false })
        .limit(50);
      
      if (type !== 'all') {
        query = query.eq('change_type', type);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching history:', error);
        return;
      }
      
      if (data) {
        setHistoryData(data.map((row: any) => ({
          id: row.id,
          facilityId: row.facility_id,
          changeType: row.change_type,
          oldValue: row.old_value,
          newValue: row.new_value,
          changedBy: row.changed_by,
          changedAt: row.changed_at,
          description: row.description,
        })));
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  // 履歴モーダルを開く
  const openHistoryModal = async (type: 'business_hours' | 'holidays' | 'all' = 'all') => {
    setHistoryType(type);
    setIsHistoryModalOpen(true);
    await fetchHistory(type);
  };

  // 期間ごとの営業時間設定を追加
  const addBusinessHoursPeriod = () => {
    const newPeriod: BusinessHoursPeriod = {
      id: `period-${Date.now()}`,
      startDate: '',
      endDate: '',
      businessHours: {
        AM: { start: '09:00', end: '12:00' },
        PM: { start: '13:00', end: '18:00' },
      },
    };
    setSettings({
      ...settings,
      businessHoursPeriods: [...(settings.businessHoursPeriods || []), newPeriod],
    });
  };

  // 期間ごとの営業時間設定を更新
  const updateBusinessHoursPeriod = (periodId: string, updates: Partial<BusinessHoursPeriod>) => {
    setSettings({
      ...settings,
      businessHoursPeriods: (settings.businessHoursPeriods || []).map((period) =>
        period.id === periodId ? { ...period, ...updates } : period
      ),
    });
  };

  // 期間ごとの営業時間設定を削除
  const removeBusinessHoursPeriod = (periodId: string) => {
    setSettings({
      ...settings,
      businessHoursPeriods: (settings.businessHoursPeriods || []).filter(
        (period) => period.id !== periodId
      ),
    });
  };

  const toggleRegularHoliday = (day: number) => {
    const newHolidays = settings.regularHolidays.includes(day)
      ? settings.regularHolidays.filter((d) => d !== day)
      : [...settings.regularHolidays, day];
    setSettings({ ...settings, regularHolidays: newHolidays });
  };

  const toggleIncludeHolidays = () => {
    const newIncludeHolidays = !settings.includeHolidays;
    
    // includeHolidaysフラグを切り替えるだけ
    // isHoliday関数でincludeHolidaysがtrueの場合、isJapaneseHolidayで判定されるため、
    // customHolidaysに追加する必要はない
    setSettings({ 
      ...settings, 
      includeHolidays: newIncludeHolidays,
    });
  };

  const addCustomHoliday = () => {
    if (newHoliday && !settings.customHolidays.includes(newHoliday)) {
      setSettings({
        ...settings,
        customHolidays: [...settings.customHolidays, newHoliday],
      });
      setNewHoliday('');
    }
  };

  const removeCustomHoliday = (date: string) => {
    setSettings({
      ...settings,
      customHolidays: settings.customHolidays.filter((d) => d !== date),
    });
  };

  // 期間ごとの定休日設定を追加
  const addHolidayPeriod = () => {
    const newPeriod: HolidayPeriod = {
      id: `period-${Date.now()}`,
      startDate: '',
      endDate: '',
      regularHolidays: [],
    };
    setSettings({
      ...settings,
      holidayPeriods: [...(settings.holidayPeriods || []), newPeriod],
    });
  };

  // 期間ごとの定休日設定を更新
  const updateHolidayPeriod = (periodId: string, updates: Partial<HolidayPeriod>) => {
    setSettings({
      ...settings,
      holidayPeriods: (settings.holidayPeriods || []).map((period) =>
        period.id === periodId ? { ...period, ...updates } : period
      ),
    });
  };

  // 期間ごとの定休日設定を削除
  const removeHolidayPeriod = (periodId: string) => {
    setSettings({
      ...settings,
      holidayPeriods: (settings.holidayPeriods || []).filter((period) => period.id !== periodId),
    });
  };

  // 期間内の定休日を切り替え
  const togglePeriodHoliday = (periodId: string, day: number) => {
    const period = (settings.holidayPeriods || []).find((p) => p.id === periodId);
    if (!period) return;

    const newHolidays = period.regularHolidays.includes(day)
      ? period.regularHolidays.filter((d) => d !== day)
      : [...period.regularHolidays, day];
    
    updateHolidayPeriod(periodId, { regularHolidays: newHolidays });
  };


  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* ヘッダー */}
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Settings size={18} className="text-primary" />
              </div>
              施設情報設定
            </h2>
            <p className="text-gray-500 text-sm mt-2">
              定休日、営業時間、受け入れ人数などの施設情報を設定します
            </p>
          </div>
          <button
            onClick={() => setShowOperationsWizard(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition-colors shadow-sm shrink-0"
          >
            <FileText size={16} />
            来月の運営確認
          </button>
        </div>
      </div>

      {/* 変更届アラートバナー */}
      {pendingCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle size={16} className="text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-red-800">変更届の提出が必要です</p>
            <div className="space-y-1 mt-1">
              {pendingNotifications.slice(0, 3).map((n) => {
                const daysLeft = daysUntilDeadline(n.deadline);
                return (
                  <p key={n.id} className="text-xs text-red-700">
                    {CHANGE_NOTIFICATION_TYPE_LABELS[n.changeType]}
                    {' - '}
                    <span className={`font-bold ${getDeadlineColor(daysLeft)}`}>
                      {daysLeft < 0 ? `期限超過（${Math.abs(daysLeft)}日）` : `期限まであと${daysLeft}日（${new Date(n.deadline).toLocaleDateString('ja-JP')}）`}
                    </span>
                  </p>
                );
              })}
            </div>
            <button
              onClick={() => setActiveTab('change_notifications')}
              className="mt-2 text-xs font-bold text-red-700 hover:text-red-900 flex items-center gap-1"
            >
              変更届の管理へ <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* タブナビゲーション */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-1.5">
        <div className="flex gap-1">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              data-tour={tab.id === 'operation' ? 'operation-tab' : undefined}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-bold rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'text-white bg-primary shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.icon === 'building' ? <Building2 size={16} /> : tab.icon === 'clock' ? <Clock size={16} /> : tab.icon === 'clipboard' ? <ClipboardList size={16} /> : tab.icon === 'globe' ? <Globe size={16} /> : tab.icon === 'bellring' ? <Bell size={16} /> : tab.icon === 'database' ? <Database size={16} /> : <Bell size={16} />}
              {tab.label}
              {tab.id === 'change_notifications' && pendingCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* タブコンテンツ */}
      <div className="space-y-6">
        {/* ========== 基本情報タブ ========== */}
        {activeTab === 'basic' && (
          <>
            {/* 施設名設定 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
          <Building2 size={20} className="mr-2 text-primary" />
          施設名設定
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              施設ID
            </label>
            <div className="bg-gray-50 border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 font-mono">
              {currentFacilityCode || facility?.code || '未設定'}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              この施設IDはログイン時に使用します
            </p>
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              施設名
            </label>
            <input
              type="text"
              data-tour="facility-name"
              value={settings.facilityName || ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  facilityName: e.target.value,
                })
              }
              placeholder="施設名を入力してください"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <p className="text-xs text-gray-500 mt-1">
              この施設名はサイドバーの下部に表示されます
            </p>
          </div>
        </div>
      </div>

      {/* 施設住所設定 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
          <MapPin size={20} className="mr-2 text-primary" />
          施設住所設定
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          送迎ルート計算時の起点・終点として使用されます。
        </p>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              郵便番号
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.postalCode || ''}
                onChange={(e) => {
                  // ハイフンを自動的に除去して保存
                  const value = e.target.value.replace(/-/g, '');
                  setSettings({
                    ...settings,
                    postalCode: value,
                  });
                }}
                placeholder="1234567"
                maxLength={7}
                className="w-32 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <button
                onClick={lookupAddress}
                disabled={isAddressLoading}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-bold transition-colors disabled:opacity-50"
              >
                {isAddressLoading ? '検索中...' : '住所検索'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              郵便番号を入力して「住所検索」をクリックすると、住所が自動入力されます
            </p>
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              住所
            </label>
            <input
              type="text"
              value={settings.address || ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  address: e.target.value,
                })
              }
              onBlur={(e) => {
                const normalized = normalizeAddress(e.target.value);
                if (normalized !== e.target.value) {
                  setSettings({ ...settings, address: normalized });
                }
              }}
              placeholder="東京都○○区1-2-3 ビル名"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* 送迎設定 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
          <Truck size={20} className="mr-2 text-primary" />
          送迎設定
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          1回の送迎で乗車できる最大人数を設定します。送迎ルート計算時に使用されます。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              お迎え可能人数
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={20}
                value={settings.transportCapacity?.pickup ?? 4}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    transportCapacity: {
                      ...(settings.transportCapacity || { pickup: 4, dropoff: 4 }),
                      pickup: parseInt(e.target.value) || 4,
                    },
                  })
                }
                className="w-20 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <span className="text-sm text-gray-600">名</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              朝のお迎え時に1回で乗車できる最大人数
            </p>
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              お送り可能人数
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={20}
                value={settings.transportCapacity?.dropoff ?? 4}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    transportCapacity: {
                      ...(settings.transportCapacity || { pickup: 4, dropoff: 4 }),
                      dropoff: parseInt(e.target.value) || 4,
                    },
                  })
                }
                className="w-20 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <span className="text-sm text-gray-600">名</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              帰りのお送り時に1回で乗車できる最大人数
            </p>
          </div>
        </div>

        {/* 送迎車両設定 */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="font-bold text-sm text-gray-800 mb-3">送迎車両設定</h4>
          <p className="text-xs text-gray-500 mb-4">
            送迎に使用する車両を登録します。利用予約画面で児童ごとに乗車車両を指定できます。
          </p>
          <div className="space-y-2 mb-3">
            {(settings.transportVehicles || []).map((vehicle: { id: string; name: string; capacity: number }, idx: number) => (
              <div key={vehicle.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                <input
                  type="text"
                  value={vehicle.name}
                  onChange={(e) => {
                    const updated = [...(settings.transportVehicles || [])];
                    updated[idx] = { ...vehicle, name: e.target.value };
                    setSettings({ ...settings, transportVehicles: updated });
                  }}
                  className="flex-1 min-w-0 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  placeholder="車両名"
                />
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs text-gray-500">定員:</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={vehicle.capacity}
                    onChange={(e) => {
                      const updated = [...(settings.transportVehicles || [])];
                      updated[idx] = { ...vehicle, capacity: parseInt(e.target.value) || 4 };
                      setSettings({ ...settings, transportVehicles: updated });
                    }}
                    className="w-16 border border-gray-300 rounded-md px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  <span className="text-xs text-gray-500">名</span>
                </div>
                <button
                  onClick={() => {
                    const updated = (settings.transportVehicles || []).filter((_: any, i: number) => i !== idx);
                    setSettings({ ...settings, transportVehicles: updated });
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="削除"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              const vehicles = settings.transportVehicles || [];
              const nextNum = vehicles.length + 1;
              setSettings({
                ...settings,
                transportVehicles: [
                  ...vehicles,
                  { id: `vehicle-${nextNum}`, name: `${nextNum}号車`, capacity: 4 },
                ],
              });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-lg transition-colors"
          >
            <Plus size={14} />
            車両を追加
          </button>
        </div>
      </div>

      {/* 事業区分設定 */}
      <div data-tour="service-categories" className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
          <Building2 size={20} className="mr-2 text-primary" />
          事業区分
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          この施設が提供するサービスの種類を選択してください。多機能型施設の場合は複数選択できます。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.serviceCategories?.childDevelopmentSupport || false}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  serviceCategories: {
                    ...settings.serviceCategories,
                    childDevelopmentSupport: e.target.checked,
                    afterSchoolDayService: settings.serviceCategories?.afterSchoolDayService || false,
                    nurseryVisitSupport: settings.serviceCategories?.nurseryVisitSupport || false,
                    homeBasedChildSupport: settings.serviceCategories?.homeBasedChildSupport || false,
                  },
                })
              }
              className="w-5 h-5 mt-0.5 text-primary border-gray-300 rounded focus:ring-primary"
            />
            <div>
              <span className="font-bold text-gray-800">児童発達支援</span>
              <p className="text-xs text-gray-500 mt-1">未就学児を対象とした発達支援サービス</p>
            </div>
          </label>
          <label className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.serviceCategories?.afterSchoolDayService || false}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  serviceCategories: {
                    ...settings.serviceCategories,
                    childDevelopmentSupport: settings.serviceCategories?.childDevelopmentSupport || false,
                    afterSchoolDayService: e.target.checked,
                    nurseryVisitSupport: settings.serviceCategories?.nurseryVisitSupport || false,
                    homeBasedChildSupport: settings.serviceCategories?.homeBasedChildSupport || false,
                  },
                })
              }
              className="w-5 h-5 mt-0.5 text-primary border-gray-300 rounded focus:ring-primary"
            />
            <div>
              <span className="font-bold text-gray-800">放課後等デイサービス</span>
              <p className="text-xs text-gray-500 mt-1">就学児を対象とした放課後支援サービス</p>
            </div>
          </label>
          <label className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.serviceCategories?.nurseryVisitSupport || false}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  serviceCategories: {
                    ...settings.serviceCategories,
                    childDevelopmentSupport: settings.serviceCategories?.childDevelopmentSupport || false,
                    afterSchoolDayService: settings.serviceCategories?.afterSchoolDayService || false,
                    nurseryVisitSupport: e.target.checked,
                    homeBasedChildSupport: settings.serviceCategories?.homeBasedChildSupport || false,
                  },
                })
              }
              className="w-5 h-5 mt-0.5 text-primary border-gray-300 rounded focus:ring-primary"
            />
            <div>
              <span className="font-bold text-gray-800">保育所等訪問支援</span>
              <p className="text-xs text-gray-500 mt-1">保育所・学校等への訪問による支援サービス</p>
            </div>
          </label>
          <label className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.serviceCategories?.homeBasedChildSupport || false}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  serviceCategories: {
                    ...settings.serviceCategories,
                    childDevelopmentSupport: settings.serviceCategories?.childDevelopmentSupport || false,
                    afterSchoolDayService: settings.serviceCategories?.afterSchoolDayService || false,
                    nurseryVisitSupport: settings.serviceCategories?.nurseryVisitSupport || false,
                    homeBasedChildSupport: e.target.checked,
                  },
                })
              }
              className="w-5 h-5 mt-0.5 text-primary border-gray-300 rounded focus:ring-primary"
            />
            <div>
              <span className="font-bold text-gray-800">居宅訪問型児童発達支援</span>
              <p className="text-xs text-gray-500 mt-1">自宅への訪問による発達支援サービス</p>
            </div>
          </label>
        </div>
      </div>

            {/* 勤怠設定 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
                <UserCheck size={20} className="mr-2 text-primary" />
                勤怠設定
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                スタッフの勤怠管理に使用する設定です。
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-2">
                    1日の所定労働時間
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={12}
                      step={0.5}
                      value={(settings.prescribedWorkingHours ?? 480) / 60}
                      onChange={(e) => {
                        const hours = parseFloat(e.target.value) || 8;
                        setSettings({
                          ...settings,
                          prescribedWorkingHours: Math.round(hours * 60),
                        });
                      }}
                      className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    <span className="text-sm text-gray-600">時間</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    勤怠カレンダーで月間の所定労働時間を計算する際に使用されます（例: 7時間の場合、22日勤務で154時間）
                  </p>
                </div>
              </div>
            </div>

            {/* 施設認証 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
                <Shield size={20} className="mr-2 text-primary" />
                施設認証
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                指定事業所番号を入力して認証申請を行うと、求人に認証バッジが表示されます。
              </p>

              <div className="space-y-4">
                {/* 認証ステータス表示 */}
                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-2">認証ステータス</label>
                  {certificationStatus === 'verified' ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-sm bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">
                        <CheckCircle className="w-4 h-4" />
                        認証済み
                      </span>
                      {certificationVerifiedAt && (
                        <span className="text-xs text-gray-500">
                          ({new Date(certificationVerifiedAt).toLocaleDateString('ja-JP')} 認証)
                        </span>
                      )}
                    </div>
                  ) : certificationStatus === 'pending' ? (
                    <span className="inline-flex items-center gap-1 text-sm bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-medium">
                      <Clock size={14} />
                      審査中
                    </span>
                  ) : certificationStatus === 'rejected' ? (
                    <span className="inline-flex items-center gap-1 text-sm bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium">
                      <X size={14} />
                      却下 - 番号を確認して再申請してください
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">未申請</span>
                  )}
                </div>

                {/* 指定事業所番号入力 */}
                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-2">
                    指定事業所番号
                  </label>
                  <input
                    type="text"
                    value={certificationNumber}
                    onChange={(e) => setCertificationNumber(e.target.value)}
                    placeholder="例: 1234567890"
                    disabled={certificationStatus === 'verified'}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:bg-gray-50 disabled:text-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    障害福祉サービス事業所として指定を受けた際に交付された番号を入力してください
                  </p>
                </div>

                {/* 認証申請ボタン */}
                {certificationStatus !== 'verified' && (
                  <button
                    onClick={handleCertificationSubmit}
                    disabled={certificationSubmitting || !certificationNumber.trim() || certificationStatus === 'pending'}
                    className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {certificationSubmitting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Shield size={14} />
                    )}
                    {certificationStatus === 'pending' ? '審査中...' : '認証を申請'}
                  </button>
                )}
              </div>
            </div>

            {/* 写真管理 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
                <Camera size={20} className="mr-2 text-primary" />
                写真管理 ({facilityPhotos.length}/10)
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                施設の写真をアップロードしてください。求人ページに表示されます。（最大10枚、各5MBまで）
              </p>

              {/* 写真グリッド */}
              {facilityPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {facilityPhotos.map((photoUrl, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden group">
                      <img
                        src={photoUrl}
                        alt={`施設写真 ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => handlePhotoDelete(photoUrl)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="削除"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* アップロードボタン */}
              {facilityPhotos.length < 10 && (
                <div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photoUploading}
                    className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm font-bold text-gray-600 hover:border-primary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {photoUploading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        アップロード中...
                      </>
                    ) : (
                      <>
                        <ImagePlus size={16} />
                        写真を追加
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* 常勤の所定労働時間（週） */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
                <UserCheck size={20} className="mr-2 text-primary" />
                人員・労務設定
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-2">
                    常勤の所定労働時間（週）
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={32}
                      max={44}
                      step={0.5}
                      value={settings.standardWeeklyHours ?? 40}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          setSettings({
                            ...settings,
                            standardWeeklyHours: val,
                          });
                        }
                      }}
                      className="w-28 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    <span className="text-sm text-gray-600">時間 / 週</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    この施設の常勤職員の週あたり所定労働時間。常勤換算（FTE）の分母として使用されます。32時間未満は設定できません。
                  </p>
                </div>
              </div>
            </div>

            {/* 基本情報の保存ボタン */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm rounded-xl border border-gray-100 shadow-lg p-4 z-10">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">変更内容を保存してください</p>
                <button
                  data-tour="save-basic-button"
                  onClick={handleSave}
                  disabled={saving}
                  className={`text-white h-10 px-6 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all min-w-[120px] justify-center ${saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-primary-dark'}`}
                >
                  <Save size={16} />
                  基本情報を保存
                </button>
              </div>
            </div>
          </>
        )}

        {/* ========== 営業・休日タブ ========== */}
        {activeTab === 'operation' && (
          <>
            {/* 定休日設定 */}
            <div data-tour="regular-holidays" className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-gray-800 flex items-center">
                  <Calendar size={20} className="mr-2 text-primary" />
                  定休日設定
          </h3>
          <button
            onClick={() => openHistoryModal('holidays')}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100"
          >
            <History size={14} />
            変更履歴を見る
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-3">
              デフォルトの週次定休日（期間指定がない場合）
            </label>
            <div className="flex flex-wrap gap-2">
              {weekDays.map((day) => (
                <button
                  key={day.value}
                  onClick={() => toggleRegularHoliday(day.value)}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${
                    settings.regularHolidays.includes(day.value)
                      ? 'bg-red-100 text-red-700 border-2 border-red-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold text-gray-700 block">
                期間ごとの定休日設定
              </label>
              <button
                onClick={addHolidayPeriod}
                className="bg-primary hover:bg-primary-dark text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center transition-colors"
              >
                <Plus size={14} className="mr-1" />
                期間を追加
              </button>
            </div>
            <div className="space-y-4">
              {(settings.holidayPeriods || []).map((period) => (
                <div
                  key={period.id}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-gray-600">期間設定</span>
                    <button
                      onClick={() => removeHolidayPeriod(period.id)}
                      className="text-red-600 hover:text-red-800 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">
                        開始日
                      </label>
                      <input
                        type="date"
                        value={period.startDate}
                        onChange={(e) =>
                          updateHolidayPeriod(period.id, { startDate: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">
                        終了日（空欄の場合は無期限）
                      </label>
                      <input
                        type="date"
                        value={period.endDate}
                        onChange={(e) =>
                          updateHolidayPeriod(period.id, { endDate: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-2">
                      この期間の定休日
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {weekDays.map((day) => (
                        <button
                          key={day.value}
                          onClick={() => togglePeriodHoliday(period.id, day.value)}
                          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                            period.regularHolidays.includes(day.value)
                              ? 'bg-red-100 text-red-700 border-2 border-red-300'
                              : 'bg-white text-gray-700 hover:bg-gray-100 border-2 border-transparent'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {(settings.holidayPeriods || []).length === 0 && (
                <p className="text-xs text-gray-500 text-center py-4">
                  期間ごとの定休日設定がありません。期間を追加して設定してください。
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-gray-700 block mb-3">
              祝日設定
            </label>
            <div className="mb-4">
              <button
                onClick={toggleIncludeHolidays}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${
                  settings.includeHolidays
                    ? 'bg-red-100 text-red-700 border-2 border-red-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent'
                }`}
              >
                祝日を休業日に含める
              </button>
              <p className="text-xs text-gray-500 mt-2">
                選択すると、一般的な祝日が自動的に休業日として追加されます
              </p>
            </div>
            <label className="text-sm font-bold text-gray-700 block mb-3">
              カスタム休業日（追加の休業日など）
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="date"
                value={newHoliday}
                onChange={(e) => setNewHoliday(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <button
                onClick={addCustomHoliday}
                className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-md text-sm font-bold transition-colors"
              >
                追加
              </button>
            </div>
            {settings.customHolidays.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {settings.customHolidays.map((date) => (
                  <div
                    key={date}
                    className="bg-red-50 border border-red-200 rounded-md px-3 py-1.5 flex items-center space-x-2"
                  >
                    <span className="text-sm text-red-700 font-bold">{date}</span>
                    <button
                      onClick={() => removeCustomHoliday(date)}
                      className="text-red-600 hover:text-red-800 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 営業時間・サービス提供時間設定 */}
      <div data-tour="business-hours" className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-gray-800 flex items-center">
            <Clock size={20} className="mr-2 text-primary" />
            営業時間・サービス提供時間
          </h3>
          <button
            onClick={() => openHistoryModal('business_hours')}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100"
          >
            <History size={14} />
            変更履歴
          </button>
        </div>

        {/* コンパクトな曜日別設定 */}
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 0].map((dayValue) => {
            const day = weekDays.find(d => d.value === dayValue)!;
            const dayOverride = settings.flexibleBusinessHours?.dayOverrides?.[dayValue];
            const isClosed = dayOverride?.isClosed || false;
            const startTime = dayOverride?.start || settings.flexibleBusinessHours?.default?.start || '09:00';
            const endTime = dayOverride?.end || settings.flexibleBusinessHours?.default?.end || '18:00';

            return (
              <div
                key={dayValue}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  isClosed ? 'bg-gray-50 border-gray-200' : 'bg-primary/5 border-primary/20'
                }`}
              >
                {/* 曜日 */}
                <div className={`w-8 text-center font-bold ${
                  dayValue === 0 ? 'text-red-500' : dayValue === 6 ? 'text-blue-500' : 'text-gray-700'
                }`}>
                  {day.label}
                </div>

                {/* 営業/休業トグル */}
                <button
                  onClick={() => {
                    const newOverrides = { ...(settings.flexibleBusinessHours?.dayOverrides || {}) };
                    if (isClosed) {
                      newOverrides[dayValue] = {
                        start: settings.flexibleBusinessHours?.default?.start || '09:00',
                        end: settings.flexibleBusinessHours?.default?.end || '18:00',
                        isClosed: false,
                      };
                    } else {
                      newOverrides[dayValue] = { isClosed: true };
                    }
                    setSettings({
                      ...settings,
                      flexibleBusinessHours: {
                        ...settings.flexibleBusinessHours,
                        default: settings.flexibleBusinessHours?.default || { start: '09:00', end: '18:00' },
                        dayOverrides: newOverrides,
                      },
                    });
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                    isClosed
                      ? 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                      : 'bg-primary text-white hover:bg-primary-dark'
                  }`}
                >
                  {isClosed ? '休業' : '営業'}
                </button>

                {/* 時間設定 - セレクトボックス */}
                {!isClosed && (
                  <div className="flex items-center gap-2 flex-1">
                    <select
                      value={startTime}
                      onChange={(e) => {
                        const newOverrides = { ...(settings.flexibleBusinessHours?.dayOverrides || {}) };
                        newOverrides[dayValue] = {
                          start: e.target.value,
                          end: dayOverride?.end || settings.flexibleBusinessHours?.default?.end || '18:00',
                          isClosed: false,
                        };
                        setSettings({
                          ...settings,
                          flexibleBusinessHours: {
                            ...settings.flexibleBusinessHours,
                            default: settings.flexibleBusinessHours?.default || { start: '09:00', end: '18:00' },
                            dayOverrides: newOverrides,
                          },
                        });
                      }}
                      className="border border-gray-200 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-primary cursor-pointer"
                    >
                      {Array.from({ length: 34 }, (_, i) => {
                        const h = Math.floor(i / 2) + 6;
                        const m = (i % 2) * 30;
                        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                        return <option key={time} value={time}>{time}</option>;
                      })}
                    </select>
                    <span className="text-gray-400">〜</span>
                    <select
                      value={endTime}
                      onChange={(e) => {
                        const newOverrides = { ...(settings.flexibleBusinessHours?.dayOverrides || {}) };
                        newOverrides[dayValue] = {
                          start: dayOverride?.start || settings.flexibleBusinessHours?.default?.start || '09:00',
                          end: e.target.value,
                          isClosed: false,
                        };
                        setSettings({
                          ...settings,
                          flexibleBusinessHours: {
                            ...settings.flexibleBusinessHours,
                            default: settings.flexibleBusinessHours?.default || { start: '09:00', end: '18:00' },
                            dayOverrides: newOverrides,
                          },
                        });
                      }}
                      className="border border-gray-200 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-primary cursor-pointer"
                    >
                      {Array.from({ length: 34 }, (_, i) => {
                        const h = Math.floor(i / 2) + 6;
                        const m = (i % 2) * 30;
                        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                        return <option key={time} value={time}>{time}</option>;
                      })}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-500 mt-4">
          サービス提供時間は通常、営業時間と同じです。異なる場合は別途お問い合わせください。
        </p>
      </div>

      {/* 時間枠設定 */}
      <div data-tour="timeslot-section" className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
          <Clock size={20} className="mr-2 text-primary" />
          利用時間枠設定
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          午前・午後以外の時間枠も設定できます。放課後デイなど複数の時間区分がある施設向けの設定です。
        </p>

        {/* 既存の時間枠一覧 */}
        <div className="space-y-3 mb-4">
          {timeSlots.map((slot) => (
            <div
              key={slot.id}
              className="border border-gray-200 rounded-lg p-4 bg-gray-50"
            >
              {editingTimeSlotId === slot.id ? (
                // 編集モード
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">枠名</label>
                      <input
                        type="text"
                        value={slot.name}
                        onChange={(e) => updateTimeSlot(slot.id, { name: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">開始時間</label>
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateTimeSlot(slot.id, { startTime: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">終了時間</label>
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateTimeSlot(slot.id, { endTime: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1">定員</label>
                      <input
                        type="number"
                        min="1"
                        value={slot.capacity}
                        onChange={(e) => updateTimeSlot(slot.id, { capacity: parseInt(e.target.value) || 10 })}
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingTimeSlotId(null)}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                      完了
                    </button>
                  </div>
                </div>
              ) : (
                // 表示モード
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-gray-800">{slot.name}</span>
                    <span className="text-sm text-gray-500">
                      {slot.startTime} - {slot.endTime}
                    </span>
                    <span className="text-sm text-gray-500">
                      定員: {slot.capacity}名
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingTimeSlotId(slot.id)}
                      className="text-sm text-primary hover:underline"
                    >
                      編集
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`「${slot.name}」を削除しますか？`)) {
                          await deleteTimeSlot(slot.id);
                        }
                      }}
                      className="text-sm text-red-500 hover:underline"
                    >
                      削除
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 新規追加フォーム */}
        {isAddingTimeSlot ? (
          <div className="border border-primary rounded-lg p-4 bg-primary/5">
            <h4 className="font-bold text-sm text-gray-700 mb-3">新しい時間枠を追加</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">枠名</label>
                <input
                  type="text"
                  value={newTimeSlot.name}
                  onChange={(e) => setNewTimeSlot({ ...newTimeSlot, name: e.target.value })}
                  placeholder="例: 放課後"
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">開始時間</label>
                <input
                  type="time"
                  value={newTimeSlot.startTime}
                  onChange={(e) => setNewTimeSlot({ ...newTimeSlot, startTime: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">終了時間</label>
                <input
                  type="time"
                  value={newTimeSlot.endTime}
                  onChange={(e) => setNewTimeSlot({ ...newTimeSlot, endTime: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">定員</label>
                <input
                  type="number"
                  min="1"
                  value={newTimeSlot.capacity}
                  onChange={(e) => setNewTimeSlot({ ...newTimeSlot, capacity: parseInt(e.target.value) || 10 })}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setIsAddingTimeSlot(false);
                  setNewTimeSlot({ name: '', startTime: '09:00', endTime: '12:00', capacity: 10 });
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={async () => {
                  if (!newTimeSlot.name.trim()) {
                    toast.warning('枠名を入力してください');
                    return;
                  }
                  try {
                    await addTimeSlot({
                      name: newTimeSlot.name,
                      startTime: newTimeSlot.startTime,
                      endTime: newTimeSlot.endTime,
                      capacity: newTimeSlot.capacity,
                      displayOrder: timeSlots.length + 1,
                    });
                    setIsAddingTimeSlot(false);
                    setNewTimeSlot({ name: '', startTime: '09:00', endTime: '12:00', capacity: 10 });
                  } catch (error) {
                    toast.error('時間枠の追加に失敗しました');
                  }
                }}
                className="px-4 py-2 text-sm bg-primary text-white rounded font-bold hover:bg-primary-dark transition-colors"
              >
                追加
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingTimeSlot(true)}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            時間枠を追加
          </button>
        )}
      </div>

            {/* 営業設定の保存ボタン */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm rounded-xl border border-gray-100 shadow-lg p-4 z-10">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">変更内容を保存してください</p>
                <button
                  data-tour="save-operation-button"
                  onClick={handleSave}
                  disabled={saving}
                  className={`text-white h-10 px-6 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all min-w-[120px] justify-center ${saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-primary-dark'}`}
                >
                  <Save size={16} />
                  営業設定を保存
                </button>
              </div>
            </div>
          </>
        )}

        {/* ========== 変更届タブ ========== */}
        {activeTab === 'change_notifications' && (
          <ChangeNotificationList
            notifications={allNotifications}
            onUpdateStatus={updateNotificationStatus}
            onRefetch={refetchNotifications}
            facilitySettings={settings}
            facilityInfo={{
              name: settings.facilityName || facility?.name || '',
              code: facility?.code || '',
              businessNumber: businessNumber,
              address: settings.address || '',
              postalCode: settings.postalCode || '',
            }}
            designationDate={designationDate}
            designatedServiceTypes={designatedServiceTypes}
            socialInsurance={socialInsurance}
            complaintResolution={complaintResolution}
            primaryDisabilityTypes={primaryDisabilityTypes}
          />
        )}

        {/* ========== 通知設定タブ ========== */}
        {activeTab === 'notification_preferences' && (
          <>
            {/* 通知種別 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
                <Bell size={20} className="mr-2 text-primary" />
                通知の種類
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                受け取りたい通知の種類を選択してください。
              </p>
              <div className="space-y-3">
                {NOTIFICATION_TYPE_LABELS.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <span className="font-bold text-sm text-gray-800">{item.label}</span>
                      <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notificationPrefs.types[item.key]}
                      onClick={() =>
                        setNotificationPrefs({
                          ...notificationPrefs,
                          types: {
                            ...notificationPrefs.types,
                            [item.key]: !notificationPrefs.types[item.key],
                          },
                        })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                        notificationPrefs.types[item.key] ? 'bg-primary' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                          notificationPrefs.types[item.key] ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </label>
                ))}
              </div>
            </div>

            {/* 通知チャネル */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
                <Settings size={20} className="mr-2 text-primary" />
                通知方法
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                通知を受け取る方法を選択してください。
              </p>
              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <div className="flex-1 min-w-0 mr-4">
                    <span className="font-bold text-sm text-gray-800">メール通知</span>
                    <p className="text-xs text-gray-500 mt-0.5">登録されたメールアドレスに通知を送信します</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notificationPrefs.channels.email}
                    onClick={() =>
                      setNotificationPrefs({
                        ...notificationPrefs,
                        channels: {
                          ...notificationPrefs.channels,
                          email: !notificationPrefs.channels.email,
                        },
                      })
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                      notificationPrefs.channels.email ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                        notificationPrefs.channels.email ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>
                <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <div className="flex-1 min-w-0 mr-4">
                    <span className="font-bold text-sm text-gray-800">プッシュ通知</span>
                    <p className="text-xs text-gray-500 mt-0.5">ブラウザのプッシュ通知を受け取ります</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notificationPrefs.channels.push}
                    onClick={() =>
                      setNotificationPrefs({
                        ...notificationPrefs,
                        channels: {
                          ...notificationPrefs.channels,
                          push: !notificationPrefs.channels.push,
                        },
                      })
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                      notificationPrefs.channels.push ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                        notificationPrefs.channels.push ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>
              </div>
            </div>

            {/* おやすみ時間 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
                <Clock size={20} className="mr-2 text-primary" />
                おやすみ時間
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                指定した時間帯は通知を送信しません。
              </p>
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <div className="flex-1 min-w-0 mr-4">
                    <span className="font-bold text-sm text-gray-800">おやすみ時間を有効にする</span>
                    <p className="text-xs text-gray-500 mt-0.5">設定した時間帯に通知をミュートします</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notificationPrefs.quietHours.enabled}
                    onClick={() =>
                      setNotificationPrefs({
                        ...notificationPrefs,
                        quietHours: {
                          ...notificationPrefs.quietHours,
                          enabled: !notificationPrefs.quietHours.enabled,
                        },
                      })
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                      notificationPrefs.quietHours.enabled ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                        notificationPrefs.quietHours.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>

                {notificationPrefs.quietHours.enabled && (
                  <div className="flex items-center gap-3 pl-4">
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">開始</label>
                      <select
                        value={notificationPrefs.quietHours.start}
                        onChange={(e) =>
                          setNotificationPrefs({
                            ...notificationPrefs,
                            quietHours: {
                              ...notificationPrefs.quietHours,
                              start: e.target.value,
                            },
                          })
                        }
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      >
                        {Array.from({ length: 24 }, (_, i) => {
                          const time = `${i.toString().padStart(2, '0')}:00`;
                          return <option key={time} value={time}>{time}</option>;
                        })}
                      </select>
                    </div>
                    <span className="text-gray-400 mt-5">〜</span>
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">終了</label>
                      <select
                        value={notificationPrefs.quietHours.end}
                        onChange={(e) =>
                          setNotificationPrefs({
                            ...notificationPrefs,
                            quietHours: {
                              ...notificationPrefs.quietHours,
                              end: e.target.value,
                            },
                          })
                        }
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      >
                        {Array.from({ length: 24 }, (_, i) => {
                          const time = `${i.toString().padStart(2, '0')}:00`;
                          return <option key={time} value={time}>{time}</option>;
                        })}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 保存ボタン */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm rounded-xl border border-gray-100 shadow-lg p-4 z-10">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  {notificationSaved ? (
                    <span className="text-primary font-bold flex items-center gap-1">
                      <CheckCircle size={14} />
                      通知設定を保存しました
                    </span>
                  ) : (
                    '変更内容を保存してください'
                  )}
                </p>
                <button
                  onClick={handleSaveNotificationPrefs}
                  className="bg-primary hover:bg-primary-dark text-white h-10 px-6 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all min-w-[120px] justify-center"
                >
                  <Save size={16} />
                  通知設定を保存
                </button>
              </div>
            </div>
          </>
        )}

        {/* ========== ホームページタブ ========== */}
        {activeTab === 'homepage' && (
          <>
            {/* プレビューリンク */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
                <Globe size={20} className="mr-2 text-primary" />
                施設ホームページ
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                施設の公開ページを自動生成します。保護者や利用検討者向けの情報発信にご活用ください。
              </p>
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">あなたの施設ページ</p>
                    <p className="text-sm font-mono text-primary font-bold truncate">
                      /facilities/{currentFacilityCode || facility?.code || '...'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/facilities/${currentFacilityCode || facility?.code || ''}`;
                        navigator.clipboard.writeText(url).then(() => {
                          setHomepageCopied(true);
                          setTimeout(() => setHomepageCopied(false), 2000);
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {homepageCopied ? (
                        <>
                          <CheckCircle size={14} className="text-green-500" />
                          コピー済み
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          URLをコピー
                        </>
                      )}
                    </button>
                    <a
                      href={`/facilities/${currentFacilityCode || facility?.code || ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors"
                    >
                      <ExternalLink size={14} />
                      プレビュー
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* 公開設定 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
                <Eye size={20} className="mr-2 text-primary" />
                公開設定
              </h3>
              <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200">
                <div>
                  <p className="text-sm font-bold text-gray-800">ホームページを公開する</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    オフにすると施設ページは非公開になります
                  </p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, homepageEnabled: !settings.homepageEnabled })}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    settings.homepageEnabled !== false ? 'bg-primary' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                      settings.homepageEnabled !== false ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* キャッチコピー・紹介文 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
                <FileText size={20} className="mr-2 text-primary" />
                ページ内容
              </h3>
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-2">
                    キャッチコピー
                  </label>
                  <input
                    type="text"
                    value={settings.homepageTagline || ''}
                    onChange={(e) => {
                      if (e.target.value.length <= 100) {
                        setSettings({ ...settings, homepageTagline: e.target.value });
                      }
                    }}
                    placeholder="例: お子さまの可能性を広げる支援を"
                    maxLength={100}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">
                    {(settings.homepageTagline || '').length} / 100文字
                  </p>
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-2">
                    施設紹介文
                  </label>
                  <textarea
                    value={settings.homepageDescription || ''}
                    onChange={(e) => setSettings({ ...settings, homepageDescription: e.target.value })}
                    placeholder="施設の特徴、療育方針、対象のお子さまなど、保護者に伝えたい情報を記載してください。"
                    rows={6}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-2">
                    カバー画像URL
                  </label>
                  <input
                    type="text"
                    value={settings.homepageCoverImageUrl || ''}
                    onChange={(e) => setSettings({ ...settings, homepageCoverImageUrl: e.target.value })}
                    placeholder="https://example.com/cover.jpg"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    ヒーローエリアに表示される画像です。未設定の場合はグラデーションが表示されます。
                  </p>
                </div>
              </div>
            </div>

            {/* フォトギャラリー */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
                <Camera size={20} className="mr-2 text-primary" />
                フォトギャラリー
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                施設の写真URLを最大6枚まで登録できます。
              </p>
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 w-6 text-center">{idx + 1}</span>
                    <input
                      type="text"
                      value={(settings.homepagePhotos || [])[idx] || ''}
                      onChange={(e) => {
                        const newPhotos = [...(settings.homepagePhotos || [])];
                        // Extend array if needed
                        while (newPhotos.length <= idx) newPhotos.push('');
                        newPhotos[idx] = e.target.value;
                        // Trim trailing empty entries
                        while (newPhotos.length > 0 && newPhotos[newPhotos.length - 1] === '') {
                          newPhotos.pop();
                        }
                        setSettings({ ...settings, homepagePhotos: newPhotos });
                      }}
                      placeholder="https://example.com/photo.jpg"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    {(settings.homepagePhotos || [])[idx] && (
                      <button
                        onClick={() => {
                          const newPhotos = [...(settings.homepagePhotos || [])];
                          newPhotos.splice(idx, 1);
                          setSettings({ ...settings, homepagePhotos: newPhotos });
                        }}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                ヒント: 基本情報タブの施設写真も自動的にホームページに表示されます。
              </p>
            </div>

            {/* SEOプレビュー */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
                <Search size={20} className="mr-2 text-primary" />
                SEOプレビュー
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Google検索結果でのイメージです。
              </p>
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-xs text-green-700 font-mono truncate mb-1">
                  {typeof window !== 'undefined' ? window.location.origin : 'https://roots-app.jp'}/facilities/{currentFacilityCode || facility?.code || '...'}
                </p>
                <p className="text-[#1a0dab] text-base font-medium hover:underline cursor-pointer truncate">
                  {settings.facilityName || '施設名'}{settings.homepageTagline ? ` - ${settings.homepageTagline}` : ''} | Roots
                </p>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {settings.homepageDescription
                    ? settings.homepageDescription.slice(0, 160)
                    : `${settings.facilityName || '施設名'}の施設情報、求人情報、アクセスなど。Rootsで詳細を確認できます。`}
                </p>
              </div>
            </div>

            {/* 保存ボタン */}
            <div className="flex justify-end">
              <button
                onClick={async () => {
                  setHomepageSaving(true);
                  try {
                    await updateFacilitySettings(settings, 'ホームページ設定を更新しました');
                    setHomepageSaved(true);
                    setTimeout(() => setHomepageSaved(false), 3000);
                  } catch (error: any) {
                    console.error('ホームページ設定の保存に失敗しました:', error);
                    toast.error(`ホームページ設定の保存に失敗しました: ${error.message || '不明なエラー'}`);
                  } finally {
                    setHomepageSaving(false);
                  }
                }}
                disabled={homepageSaving}
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-8 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 shadow-sm"
              >
                {homepageSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : homepageSaved ? (
                  <CheckCircle size={16} />
                ) : (
                  <Save size={16} />
                )}
                {homepageSaving ? '保存中...' : homepageSaved ? '保存しました' : 'ホームページ設定を保存'}
              </button>
            </div>
          </>
        )}

        {/* ========== 指定情報タブ ========== */}
        {activeTab === 'designation' && (
          <>
            {/* 3-A. 指定基本情報セクション */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
                <ClipboardList size={20} className="mr-2 text-primary" />
                指定基本情報
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-gray-700 block mb-2">
                      事業所番号（10桁）
                    </label>
                    <input
                      type="text"
                      value={businessNumber}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                        setBusinessNumber(v);
                      }}
                      placeholder="1234567890"
                      maxLength={10}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    {businessNumber && businessNumber.length !== 10 && (
                      <p className="text-xs text-orange-500 mt-1">事業所番号は10桁です（現在{businessNumber.length}桁）</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-700 block mb-2">
                      認証番号
                    </label>
                    <div className="bg-gray-50 border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 font-mono">
                      {certificationNumber || '未設定'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-gray-700 block mb-2">
                      指定日
                    </label>
                    <input
                      type="date"
                      value={designationDate}
                      onChange={(e) => setDesignationDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-700 block mb-2">
                      指定有効期限
                    </label>
                    <input
                      type="date"
                      value={designationExpiryDate}
                      onChange={(e) => setDesignationExpiryDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-2">
                    指定サービス種別
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { key: 'child_development_support', label: '児童発達支援' },
                      { key: 'after_school_day_service', label: '放課後等デイサービス' },
                      { key: 'nursery_visit_support', label: '保育所等訪問支援' },
                      { key: 'home_based_child_support', label: '居宅訪問型児童発達支援' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={designatedServiceTypes.includes(key)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setDesignatedServiceTypes(prev => [...prev, key]);
                            } else {
                              setDesignatedServiceTypes(prev => prev.filter(t => t !== key));
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-2">
                    指定通知書
                  </label>
                  <FileUploader
                    bucket="facility-photos"
                    folder={`designation/${facility?.id}`}
                    accept=".pdf,.jpg,.jpeg,.png"
                    maxSizeMB={10}
                    label="指定通知書をアップロード（PDF/画像）"
                    currentFile={designationDocPath ? { url: designationDocPath, name: designationDocName || '指定通知書' } : null}
                    onUpload={(url, name) => {
                      setDesignationDocPath(url);
                      setDesignationDocName(name);
                    }}
                    onRemove={() => {
                      setDesignationDocPath('');
                      setDesignationDocName('');
                    }}
                  />
                  {designationDocPath && /\.(jpg|jpeg|png|gif|webp)$/i.test(designationDocPath) && (
                    <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                      <img src={designationDocPath} alt="指定通知書プレビュー" className="max-w-full max-h-96 object-contain mx-auto" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3-B. 協力医療機関セクション */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-gray-800 flex items-center">
                  <Stethoscope size={20} className="mr-2 text-primary" />
                  協力医療機関
                </h3>
                <button
                  onClick={() => setEditingInstitution({ isPrimary: medicalInstitutions.length === 0 })}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors"
                >
                  <Plus size={14} />
                  追加
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-4 flex items-center gap-1">
                <Info size={12} />
                協力医療機関は事業所から車で概ね10分以内の距離にある医療機関が望ましいとされています
              </p>

              {medicalInstitutions.length === 0 && !editingInstitution && (
                <div className="text-center py-8 text-gray-400">
                  <Stethoscope size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">協力医療機関が登録されていません</p>
                </div>
              )}

              <div className="space-y-3">
                {medicalInstitutions.map((inst) => (
                  <div key={inst.id} className={`border rounded-lg p-4 ${inst.isPrimary ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-gray-800">{inst.institutionName}</span>
                          {inst.isPrimary && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-primary text-white rounded-full">主たる医療機関</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 mt-2">
                          {inst.department && <div>診療科: {inst.department}</div>}
                          {inst.doctorName && <div>担当医: {inst.doctorName}</div>}
                          {inst.address && <div className="col-span-2">住所: {inst.address}</div>}
                          {inst.phone && <div>電話: {inst.phone}</div>}
                          {inst.travelTimeMinutes != null && <div>所要時間: 約{inst.travelTimeMinutes}分</div>}
                          {inst.agreementDate && <div>協定日: {inst.agreementDate}</div>}
                          {inst.agreementExpiryDate && <div>有効期限: {inst.agreementExpiryDate}</div>}
                        </div>
                        {inst.agreementFileUrl && (
                          <a href={inst.agreementFileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2">
                            <FileText size={12} />
                            協定書を表示
                          </a>
                        )}
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button onClick={() => setEditingInstitution(inst)} className="p-1.5 text-gray-400 hover:text-primary" title="編集">
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => handleDeleteInstitution(inst.id)} className="p-1.5 text-gray-400 hover:text-red-500" title="削除">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 編集フォーム */}
              {editingInstitution && (
                <div className="mt-4 border border-primary/30 rounded-lg p-4 bg-primary/5">
                  <h4 className="font-bold text-sm text-gray-800 mb-3">
                    {editingInstitution.id ? '医療機関を編集' : '新規医療機関を追加'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">医療機関名 *</label>
                      <input
                        type="text"
                        value={editingInstitution.institutionName || ''}
                        onChange={(e) => setEditingInstitution(prev => prev ? { ...prev, institutionName: e.target.value } : null)}
                        className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary"
                        placeholder="○○病院"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">診療科</label>
                      <input
                        type="text"
                        value={editingInstitution.department || ''}
                        onChange={(e) => setEditingInstitution(prev => prev ? { ...prev, department: e.target.value } : null)}
                        className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary"
                        placeholder="小児科"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">担当医師名</label>
                      <input
                        type="text"
                        value={editingInstitution.doctorName || ''}
                        onChange={(e) => setEditingInstitution(prev => prev ? { ...prev, doctorName: e.target.value } : null)}
                        className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">電話番号</label>
                      <input
                        type="tel"
                        value={editingInstitution.phone || ''}
                        onChange={(e) => setEditingInstitution(prev => prev ? { ...prev, phone: e.target.value } : null)}
                        className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary"
                        placeholder="03-0000-0000"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-bold text-gray-600 block mb-1">住所</label>
                      <input
                        type="text"
                        value={editingInstitution.address || ''}
                        onChange={(e) => setEditingInstitution(prev => prev ? { ...prev, address: e.target.value } : null)}
                        className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">所要時間（分）</label>
                      <input
                        type="number"
                        value={editingInstitution.travelTimeMinutes ?? ''}
                        onChange={(e) => setEditingInstitution(prev => prev ? { ...prev, travelTimeMinutes: e.target.value ? parseInt(e.target.value) : undefined } : null)}
                        className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary"
                        placeholder="10"
                        min={0}
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer mt-5">
                        <input
                          type="checkbox"
                          checked={editingInstitution.isPrimary || false}
                          onChange={(e) => setEditingInstitution(prev => prev ? { ...prev, isPrimary: e.target.checked } : null)}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm font-bold text-gray-700">主たる協力医療機関</span>
                      </label>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">協定日</label>
                      <input
                        type="date"
                        value={editingInstitution.agreementDate || ''}
                        onChange={(e) => setEditingInstitution(prev => prev ? { ...prev, agreementDate: e.target.value } : null)}
                        className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">協定有効期限</label>
                      <input
                        type="date"
                        value={editingInstitution.agreementExpiryDate || ''}
                        onChange={(e) => setEditingInstitution(prev => prev ? { ...prev, agreementExpiryDate: e.target.value } : null)}
                        className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-bold text-gray-600 block mb-1">協定書ファイル</label>
                      <FileUploader
                        bucket="documents"
                        folder={`agreements/${facility?.id}`}
                        accept=".pdf,.jpg,.jpeg,.png"
                        maxSizeMB={10}
                        label="協定書をアップロード"
                        currentFile={editingInstitution.agreementFileUrl ? { url: editingInstitution.agreementFileUrl, name: editingInstitution.agreementFileName || '協定書' } : null}
                        onUpload={(url, name) => setEditingInstitution(prev => prev ? { ...prev, agreementFileUrl: url, agreementFileName: name } : null)}
                        onRemove={() => setEditingInstitution(prev => prev ? { ...prev, agreementFileUrl: undefined, agreementFileName: undefined } : null)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-bold text-gray-600 block mb-1">備考</label>
                      <textarea
                        value={editingInstitution.notes || ''}
                        onChange={(e) => setEditingInstitution(prev => prev ? { ...prev, notes: e.target.value } : null)}
                        className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary"
                        rows={2}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-3">
                    <button
                      onClick={() => setEditingInstitution(null)}
                      className="px-3 py-1.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleSaveInstitution}
                      disabled={institutionSaving}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50"
                    >
                      {institutionSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      {editingInstitution.id ? '更新' : '追加'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3-C. 指定申請チェックリスト（24書類） */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
                <CheckCircle size={20} className="mr-2 text-primary" />
                指定申請チェックリスト
              </h3>

              {/* プログレスバー */}
              {(() => {
                const total = DESIGNATION_DOCUMENTS.length;
                const completed = checklistItems.filter(item => item.status === 'verified' || item.status === 'uploaded').length;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                return (
                  <div className="mb-5">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-bold text-gray-700">進捗状況</span>
                      <span className="text-gray-600">{total}件中 <span className="font-bold text-primary">{completed}件</span> 完了（{pct}%）</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-primary h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {checklistLoading ? (
                <div className="text-center py-8">
                  <Loader2 size={24} className="animate-spin mx-auto text-primary" />
                </div>
              ) : (
                <div className="space-y-2">
                  {DESIGNATION_DOCUMENTS.map((doc) => {
                    const item = checklistItems.find(ci => ci.documentNumber === doc.number);
                    const status: ChecklistStatus = (item?.status as ChecklistStatus) || 'not_started';
                    const statusConfig = CHECKLIST_STATUS_CONFIG[status];
                    return (
                      <div key={doc.number} className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                            {doc.number}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-gray-800">{doc.name}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusConfig.color}`}>
                                {statusConfig.label}
                              </span>
                              {doc.managedByRoots && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                  Roots管理
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {/* ステータス変更 */}
                              <select
                                value={status}
                                onChange={(e) => handleUpdateChecklistStatus(doc.number, e.target.value as ChecklistStatus)}
                                className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-primary"
                              >
                                <option value="not_started">未着手</option>
                                <option value="in_progress">作成中</option>
                                <option value="uploaded">アップロード済</option>
                                <option value="verified">確認済</option>
                              </select>
                              {/* Roots機能リンク */}
                              {doc.linkedTab && (
                                <button
                                  onClick={() => setActiveTab(doc.linkedTab as SettingsTab)}
                                  className="text-xs text-primary hover:underline flex items-center gap-0.5"
                                >
                                  <ExternalLink size={10} />
                                  {doc.linkedFeature}
                                </button>
                              )}
                              {doc.linkedFeature && !doc.linkedTab && (
                                <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                  <ExternalLink size={10} />
                                  {doc.linkedFeature}
                                </span>
                              )}
                              {/* ファイルアップロード */}
                              {item?.fileUrl && (
                                <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                                  <FileText size={10} />
                                  {item.fileName || 'ファイルを表示'}
                                </a>
                              )}
                            </div>
                            {doc.uploadable && (
                              <div className="mt-2">
                                <FileUploader
                                  bucket="documents"
                                  folder={`checklist/${facility?.id}/${doc.number}`}
                                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                                  maxSizeMB={10}
                                  label={`${doc.name}をアップロード`}
                                  currentFile={item?.fileUrl ? { url: item.fileUrl, name: item.fileName || doc.name } : null}
                                  onUpload={(url, name) => handleChecklistFileUpload(doc.number, url, name)}
                                  onRemove={() => handleChecklistFileUpload(doc.number, '', '')}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3-D. 補足情報セクション */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
                <Info size={20} className="mr-2 text-primary" />
                補足情報
              </h3>

              {/* 社保・労保加入状況 */}
              <div className="mb-6">
                <h4 className="font-bold text-sm text-gray-700 mb-3">社会保険・労働保険の加入状況</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key: 'healthInsurance', label: '健康保険' },
                    { key: 'welfarePension', label: '厚生年金' },
                    { key: 'employmentInsurance', label: '雇用保険' },
                    { key: 'workersComp', label: '労災保険' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={socialInsurance[key] || false}
                        onChange={(e) => setSocialInsurance(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 耐震化情報 */}
              <div className="mb-6">
                <h4 className="font-bold text-sm text-gray-700 mb-3">耐震化情報</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">建築年</label>
                    <input
                      type="text"
                      value={earthquakeResistance.buildYear || ''}
                      onChange={(e) => setEarthquakeResistance(prev => ({ ...prev, buildYear: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary"
                      placeholder="1990"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">耐震診断</label>
                    <select
                      value={earthquakeResistance.diagnosisCompleted || 'no'}
                      onChange={(e) => setEarthquakeResistance(prev => ({ ...prev, diagnosisCompleted: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary"
                    >
                      <option value="no">未実施</option>
                      <option value="yes">実施済み</option>
                      <option value="not_required">不要（1981年以降建築）</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">診断結果</label>
                    <input
                      type="text"
                      value={earthquakeResistance.diagnosisResult || ''}
                      onChange={(e) => setEarthquakeResistance(prev => ({ ...prev, diagnosisResult: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary"
                      placeholder="耐震基準適合"
                    />
                  </div>
                </div>
              </div>

              {/* 苦情解決体制 */}
              <div className="mb-6">
                <h4 className="font-bold text-sm text-gray-700 mb-3">苦情解決体制</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">受付責任者</label>
                    <input
                      type="text"
                      value={complaintResolution.responsiblePerson || ''}
                      onChange={(e) => setComplaintResolution(prev => ({ ...prev, responsiblePerson: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">受付日時</label>
                    <input
                      type="text"
                      value={complaintResolution.receptionHours || ''}
                      onChange={(e) => setComplaintResolution(prev => ({ ...prev, receptionHours: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary"
                      placeholder="月〜金 9:00〜18:00"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">外部相談窓口</label>
                    <input
                      type="text"
                      value={complaintResolution.externalConsultation || ''}
                      onChange={(e) => setComplaintResolution(prev => ({ ...prev, externalConsultation: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary"
                      placeholder="○○運営適正化委員会"
                    />
                  </div>
                </div>
              </div>

              {/* 主たる障害種別 */}
              <div>
                <h4 className="font-bold text-sm text-gray-700 mb-3">主たる対象障害種別</h4>
                <div className="flex flex-wrap gap-3">
                  {[
                    { key: 'intellectual', label: '知的障害' },
                    { key: 'developmental', label: '発達障害' },
                    { key: 'physical', label: '身体障害' },
                    { key: 'mental', label: '精神障害' },
                    { key: 'severe', label: '重症心身障害' },
                    { key: 'hearing', label: '聴覚障害' },
                    { key: 'visual', label: '視覚障害' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={primaryDisabilityTypes.includes(key)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPrimaryDisabilityTypes(prev => [...prev, key]);
                          } else {
                            setPrimaryDisabilityTypes(prev => prev.filter(t => t !== key));
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* 保存ボタン */}
            <div className="sticky bottom-4 flex justify-end">
              <button
                onClick={handleSaveDesignation}
                disabled={designationSaving}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-primary-dark disabled:opacity-50 transition-all"
              >
                {designationSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : designationSaved ? (
                  <CheckCircle size={16} />
                ) : (
                  <Save size={16} />
                )}
                {designationSaving ? '保存中...' : designationSaved ? '保存しました' : '指定情報を保存'}
              </button>
            </div>
          </>
        )}

        {/* ========== データ管理タブ ========== */}
        {activeTab === 'data_management' && (
          <>
            {/* データエクスポート */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
                <Download size={20} className="mr-2 text-primary" />
                データエクスポート
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                個人情報保護法（APPI）に基づき、施設に関連する全データをJSON形式でエクスポートできます。
              </p>
              <button
                onClick={async () => {
                  setExportingData(true);
                  try {
                    // Mock data export
                    const exportData = {
                      exportedAt: new Date().toISOString(),
                      facilityId: facility?.id || '',
                      facilityName: settings.facilityName || '',
                      children: [
                        { note: 'この機能は現在モックデータを出力しています。実装完了後に実データが出力されます。' },
                      ],
                      usageRecords: [],
                      staff: [],
                      billing: [],
                    };
                    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                      type: 'application/json',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    a.href = url;
                    a.download = `facility-data-export-${timestamp}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    console.error('データエクスポートに失敗しました:', err);
                    toast.error('データエクスポートに失敗しました');
                  } finally {
                    setExportingData(false);
                  }
                }}
                disabled={exportingData}
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
              >
                <Download size={16} />
                {exportingData ? 'エクスポート中...' : '全データをエクスポート'}
              </button>
            </div>

            {/* データ削除リクエスト */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
                <AlertOctagon size={20} className="mr-2 text-red-500" />
                データ削除リクエスト
              </h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-800">この操作は取り消せません</p>
                    <p className="text-sm text-red-700 mt-1">
                      データ削除をリクエストすると、施設に関連する全てのデータが完全に削除されます。
                      法定保持期間が経過したデータのみが削除対象となります。
                    </p>
                  </div>
                </div>
              </div>
              {deletionRequested ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={18} className="text-green-600" />
                    <p className="text-sm font-bold text-green-800">
                      削除リクエストを受け付けました。担当者が確認後、処理を開始します。
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-bold text-gray-700 block mb-2">
                      確認のため施設名を入力してください
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={settings.facilityName || '施設名を入力'}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                  <button
                    onClick={() => {
                      // Store deletion request in localStorage (mock)
                      const request = {
                        facilityId: facility?.id || '',
                        facilityName: settings.facilityName || '',
                        requestedAt: new Date().toISOString(),
                        status: 'pending',
                      };
                      localStorage.setItem(
                        `deletion-request-${facility?.id}`,
                        JSON.stringify(request)
                      );
                      setDeletionRequested(true);
                      setDeleteConfirmText('');
                    }}
                    disabled={
                      !deleteConfirmText ||
                      deleteConfirmText !== (settings.facilityName || '')
                    }
                    className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={16} />
                    削除リクエスト送信
                  </button>
                </div>
              )}
            </div>

            {/* データ保持期間 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-lg text-gray-800 flex items-center mb-4">
                <Info size={20} className="mr-2 text-primary" />
                データ保持期間
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                法令に基づくデータの保持期間は以下の通りです。保持期間内のデータは削除リクエストの対象外となります。
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText size={16} className="text-primary" />
                    </div>
                    <span className="text-sm font-bold text-gray-800">利用記録</span>
                  </div>
                  <span className="text-sm font-bold text-primary">5年</span>
                </div>
                <div className="flex items-center justify-between border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText size={16} className="text-primary" />
                    </div>
                    <span className="text-sm font-bold text-gray-800">請求データ</span>
                  </div>
                  <span className="text-sm font-bold text-primary">7年</span>
                </div>
                <div className="flex items-center justify-between border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users size={16} className="text-primary" />
                    </div>
                    <span className="text-sm font-bold text-gray-800">スタッフ情報</span>
                  </div>
                  <span className="text-sm font-bold text-primary">退職後3年</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 変更警告ダイアログ */}
      {showChangeWarning && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-yellow-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">この変更には届出義務があります</h3>
                  <p className="text-sm text-gray-500">保存後、Rootsが届出書類の作成をサポートします</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {detectedChanges.map((change, i) => {
                const impact = analyzeChangeImpact(change.type, new Date());
                const deadlineDate = new Date(impact.deadline);
                const daysLeft = Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-amber-800">
                        {CHANGE_NOTIFICATION_TYPE_LABELS[change.type as keyof typeof CHANGE_NOTIFICATION_TYPE_LABELS] || change.type}
                      </p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        daysLeft <= 3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {change.type === 'subsidy' ? '前月15日まで' : `${daysLeft}日以内に届出`}
                      </span>
                    </div>
                    <p className="text-xs text-amber-700 mt-1">{change.description}</p>
                    <div className="mt-2 text-xs text-amber-600">
                      必要書類: {impact.requiredDocuments.map(d => d.name).join('、')}
                    </div>
                  </div>
                );
              })}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <p className="font-bold mb-1">Rootsが自動でサポートすること:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>変更届出書の自動生成（施設情報・変更内容を自動埋め込み）</li>
                  <li>運営規程の自動更新（変更箇所をハイライト表示）</li>
                  <li>届出期限の管理とリマインド</li>
                </ul>
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowChangeWarning(false);
                  setDetectedChanges([]);
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                変更を取り消す
              </button>
              <button
                onClick={handleConfirmSaveWithNotification}
                className="px-6 py-2 text-sm bg-primary text-white rounded-lg font-bold hover:bg-primary-dark transition-colors flex items-center gap-2"
              >
                <Save size={14} />
                保存して届出準備へ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== 保存後 プロアクティブ案内モーダル ====== */}
      {showPostSaveAlert && detectedChanges.length > 0 && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl border border-gray-100 overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* ヘッダー */}
            <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <AlertTriangle size={24} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">行政への届出が必要です</h3>
                  <p className="text-sm text-gray-600">
                    以下の変更には届出義務があります。Rootsが書類作成をサポートします。
                  </p>
                </div>
              </div>
            </div>

            {/* 変更ごとの詳細案内 */}
            <div className="p-5 space-y-4">
              {detectedChanges.map((change, i) => {
                const impact = analyzeChangeImpact(change.type, new Date());
                const impactDocs = CHANGE_IMPACT_MAP[change.type] || [];
                const deadlineDate = new Date(impact.deadline);
                const daysLeft = Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

                return (
                  <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* 変更サマリー */}
                    <div className="p-4 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-gray-800">
                            {CHANGE_TYPE_LABELS[change.type] || change.type}
                          </h4>
                          <p className="text-xs text-gray-500 mt-0.5">{change.description}</p>
                        </div>
                        <div className={`text-center px-3 py-1.5 rounded-lg ${
                          daysLeft <= 3 ? 'bg-red-100 text-red-700' : daysLeft <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          <div className="text-lg font-bold">{daysLeft}</div>
                          <div className="text-[10px] font-bold">日以内</div>
                        </div>
                      </div>
                    </div>

                    {/* 期限と手続き案内 */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock size={14} className="text-amber-600" />
                        <span className="font-bold text-gray-700">届出期限:</span>
                        <span className={`font-bold ${daysLeft <= 3 ? 'text-red-600' : 'text-amber-600'}`}>
                          {deadlineDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                          {change.type === 'subsidy' ? '（翌月開始の場合、前月15日まで）' : '（変更後10日以内）'}
                        </span>
                      </div>

                      {/* 必要書類リスト */}
                      <div>
                        <p className="text-xs font-bold text-gray-600 mb-2">提出が必要な書類:</p>
                        <div className="space-y-1.5">
                          {impactDocs.map((doc, j) => (
                            <div key={j} className="flex items-center gap-2 text-xs">
                              {doc.autoGenerable ? (
                                <CheckCircle size={12} className="text-emerald-600 shrink-0" />
                              ) : (
                                <div className="w-3 h-3 rounded-full border-2 border-gray-300 shrink-0" />
                              )}
                              <span className={doc.autoGenerable ? 'text-emerald-700 font-bold' : 'text-gray-600'}>
                                {doc.name}
                              </span>
                              {doc.autoGenerable && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold">
                                  自動生成OK
                                </span>
                              )}
                              {!doc.autoGenerable && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                                  別途準備
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 書類生成ボタン */}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => {
                            const fi: FacilityInfo = {
                              name: settings.facilityName || facility?.name || '',
                              code: facility?.code || '',
                              businessNumber: businessNumber,
                              address: settings.address || '',
                              postalCode: settings.postalCode || '',
                            };
                            const html = generateChangeNotificationHTML({
                              facility: fi,
                              changeType: change.type,
                              changeDescription: change.description,
                              oldValue: change.oldValue,
                              newValue: change.newValue,
                              detectedAt: new Date().toISOString(),
                              deadline: impact.deadline,
                            });
                            openDocPrintWindow(html);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-white rounded-lg font-bold hover:bg-primary-dark transition-colors"
                        >
                          <FileText size={12} />
                          変更届出書を今すぐ生成
                        </button>
                        <button
                          onClick={() => {
                            const fi: FacilityInfo = {
                              name: settings.facilityName || facility?.name || '',
                              code: facility?.code || '',
                              businessNumber: businessNumber,
                              address: settings.address || '',
                              postalCode: settings.postalCode || '',
                            };
                            const html = generateOperatingRegulationsHTML({
                              facility: fi,
                              settings,
                              designationDate,
                              designatedServiceTypes,
                              complaintResolution,
                              primaryDisabilityTypes,
                              changedSections: impact.affectedRegulationSections,
                            });
                            openDocPrintWindow(html);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
                        >
                          <FileText size={12} />
                          運営規程を生成
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* フッターアクション */}
            <div className="p-5 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                変更届タブでいつでも書類の生成・ステータス管理ができます
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowPostSaveAlert(false);
                    setDetectedChanges([]);
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  あとで対応
                </button>
                <button
                  onClick={() => {
                    setShowPostSaveAlert(false);
                    setDetectedChanges([]);
                    setActiveTab('change_notifications');
                  }}
                  className="px-5 py-2 text-sm bg-primary text-white rounded-lg font-bold hover:bg-primary-dark transition-colors flex items-center gap-2"
                >
                  変更届の管理へ
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 月次運営確認ウィザード */}
      <OperationsReviewWizard
        isOpen={showOperationsWizard}
        onClose={() => setShowOperationsWizard(false)}
        onComplete={() => {
          refetchNotifications();
        }}
      />

      {/* 履歴モーダル */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[80vh] overflow-hidden shadow-2xl border border-gray-100">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800">変更履歴</h3>
              <div className="flex items-center gap-2">
                <select
                  value={historyType}
                  onChange={(e) => {
                    const type = e.target.value as 'business_hours' | 'holidays' | 'all';
                    setHistoryType(type);
                    fetchHistory(type);
                  }}
                  className="text-xs border border-gray-300 rounded-md px-2 py-1"
                >
                  <option value="all">全て</option>
                  <option value="business_hours">営業時間</option>
                  <option value="holidays">定休日</option>
                </select>
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-4">
              {historyData.length === 0 ? (
                <div className="text-center text-gray-500 py-8">履歴がありません</div>
              ) : (
                <div className="space-y-4">
                  {historyData.map((history) => (
                    <div
                      key={history.id}
                      className="border border-gray-200 rounded-md p-4 bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-600">
                            {history.changeType === 'business_hours'
                              ? '営業時間'
                              : history.changeType === 'holidays'
                              ? '定休日'
                              : '全て'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(history.changedAt).toLocaleString('ja-JP')}
                          </span>
                        </div>
                      </div>
                      {history.description && (
                        <p className="text-xs text-gray-600 mb-2">{history.description}</p>
                      )}
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <div className="font-bold text-gray-700 mb-1">変更前</div>
                          <pre className="bg-white p-2 rounded border border-gray-200 overflow-x-auto text-[10px]">
                            {JSON.stringify(history.oldValue, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <div className="font-bold text-gray-700 mb-1">変更後</div>
                          <pre className="bg-white p-2 rounded border border-gray-200 overflow-x-auto text-[10px]">
                            {JSON.stringify(history.newValue, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacilitySettingsView;

