/**
 * SaaS運営管理画面
 * マスター管理者のみがアクセス可能
 * 主な機能：施設招待リンクの発行（メモ付き）、招待履歴管理
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import {
  Building2,
  Plus,
  Copy,
  CheckCircle,
  Users,
  Briefcase,
  Baby,
  ArrowLeft,
  Clock,
  ExternalLink,
  Send,
  ChevronDown,
  ChevronUp,
  LinkIcon,
  FileCheck,
  XCircle,
  AlertCircle,
  Eye,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Facility {
  id: string;
  name: string;
  companyName: string;
  status: 'pending' | 'active';
  createdAt: string;
}

interface InvitationToken {
  id: string;
  token: string;
  memoCompanyName: string | null;
  memoContactName: string | null;
  memoContactEmail: string | null;
  expiresAt: string;
  usedAt: string | null;
  usedByFacilityName: string | null;
  createdAt: string;
}

interface FacilityApplication {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  companyName: string;
  companyType: string | null;
  representativeName: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  facilityName: string;
  serviceCategories: Record<string, boolean>;
  businessNumber: string | null;
  postalCode: string | null;
  facilityAddress: string | null;
  capacityAm: number | null;
  capacityPm: number | null;
  designationFileUrl: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface DashboardStats {
  totalCompanies: number;
  totalFacilities: number;
  pendingApplications: number;
  totalStaff: number;
  totalChildren: number;
}

export default function AdminPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [invitations, setInvitations] = useState<InvitationToken[]>([]);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 申請管理
  const [applications, setApplications] = useState<FacilityApplication[]>([]);
  const [selectedApp, setSelectedApp] = useState<FacilityApplication | null>(null);
  const [appProcessing, setAppProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  // 招待フォーム
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [memoCompanyName, setMemoCompanyName] = useState('');
  const [memoContactName, setMemoContactName] = useState('');
  const [memoContactEmail, setMemoContactEmail] = useState('');

  // 招待履歴の展開
  const [showInvitationHistory, setShowInvitationHistory] = useState(false);

  // 権限チェック
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          router.push('/career/login');
          return;
        }

        const userData = JSON.parse(userStr);

        const { data: dbUser, error: dbError } = await supabase
          .from('users')
          .select('id, name, email, role, user_type')
          .eq('id', userData.id)
          .single();

        if (dbError || !dbUser) {
          router.push('/career/login');
          return;
        }

        const updatedUser = {
          ...userData,
          role: dbUser.role,
          name: dbUser.name,
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);

        if (dbUser.role === 'owner') {
          setHasPermission(true);
          loadData();
          return;
        }

        const { data: permData } = await supabase
          .from('admin_permissions')
          .select('id')
          .eq('user_id', userData.id)
          .eq('permission_type', 'facility_creation')
          .maybeSingle();

        if (!permData) {
          router.push('/career');
          return;
        }

        setHasPermission(true);
        loadData();
      } catch {
        router.push('/career/login');
      }
    };

    checkPermission();
  }, [router]);

  const loadData = async () => {
    try {
      const [
        { count: companiesCount },
        { count: facilitiesCount },
        { count: staffCount },
        { count: childrenCount },
      ] = await Promise.all([
        supabase.from('companies').select('*', { count: 'exact', head: true }),
        supabase.from('facilities').select('*', { count: 'exact', head: true }),
        supabase.from('staff').select('*', { count: 'exact', head: true }),
        supabase.from('children').select('*', { count: 'exact', head: true }),
      ]);

      const { count: pendingAppCount } = await supabase
        .from('facility_applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      setStats({
        totalCompanies: companiesCount || 0,
        totalFacilities: facilitiesCount || 0,
        pendingApplications: pendingAppCount || 0,
        totalStaff: staffCount || 0,
        totalChildren: childrenCount || 0,
      });

      // 申請一覧を取得
      const { data: appsData } = await supabase
        .from('facility_applications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (appsData) {
        const userIds = [...new Set(appsData.map((a: any) => a.user_id))];
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, email')
          .in('id', userIds);

        const usersMap = new Map((usersData || []).map((u: any) => [u.id, u]));

        setApplications(appsData.map((a: any) => ({
          id: a.id,
          userId: a.user_id,
          userName: usersMap.get(a.user_id)?.name || '不明',
          userEmail: usersMap.get(a.user_id)?.email || '',
          companyName: a.company_name,
          companyType: a.company_type,
          representativeName: a.representative_name,
          companyAddress: a.company_address,
          companyPhone: a.company_phone,
          facilityName: a.facility_name,
          serviceCategories: a.service_categories || {},
          businessNumber: a.business_number,
          postalCode: a.postal_code,
          facilityAddress: a.facility_address,
          capacityAm: a.capacity_am,
          capacityPm: a.capacity_pm,
          designationFileUrl: a.designation_file_url,
          status: a.status,
          createdAt: a.created_at,
        })));
      }

      // 施設一覧（最新10件）
      const { data: facilitiesData } = await supabase
        .from('facilities')
        .select(`
          id, name, pre_registered, verification_status, code, created_at,
          companies(name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      const formattedFacilities: Facility[] = (facilitiesData || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        companyName: f.companies?.name || '未設定',
        status: f.pre_registered ? 'pending' : 'active',
        createdAt: f.created_at,
      }));

      setFacilities(formattedFacilities);

      // 招待トークン履歴（最新20件）
      const { data: tokensData } = await supabase
        .from('platform_invitation_tokens')
        .select('id, token, memo_company_name, memo_contact_name, memo_contact_email, expires_at, used_at, used_by_facility_id, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      if (tokensData) {
        const formattedTokens: InvitationToken[] = [];
        for (const t of tokensData) {
          let facilityName: string | null = null;
          if (t.used_by_facility_id) {
            const { data: fac } = await supabase
              .from('facilities')
              .select('name')
              .eq('id', t.used_by_facility_id)
              .single();
            facilityName = fac?.name || null;
          }
          formattedTokens.push({
            id: t.id,
            token: t.token,
            memoCompanyName: t.memo_company_name,
            memoContactName: t.memo_contact_name,
            memoContactEmail: t.memo_contact_email,
            expiresAt: t.expires_at,
            usedAt: t.used_at,
            usedByFacilityName: facilityName,
            createdAt: t.created_at,
          });
        }
        setInvitations(formattedTokens);
      }
    } catch (err) {
      console.error('データ読み込みエラー:', err);
    } finally {
      setLoading(false);
    }
  };

  // 招待リンク生成（メモ付き）
  const generateInvitation = async () => {
    setSubmitting(true);

    try {
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error: tokenError } = await supabase
        .from('platform_invitation_tokens')
        .insert({
          token,
          expires_at: expiresAt.toISOString(),
          created_by: user?.id,
          memo_company_name: memoCompanyName.trim() || null,
          memo_contact_name: memoContactName.trim() || null,
          memo_contact_email: memoContactEmail.trim() || null,
        });

      if (tokenError) throw tokenError;

      const baseUrl = window.location.origin;
      setGeneratedLink(`${baseUrl}/facility/register?token=${token}`);

      // フォームリセット
      setShowInviteForm(false);
      setMemoCompanyName('');
      setMemoContactName('');
      setMemoContactEmail('');

      // データリロード
      loadData();
    } catch (err: any) {
      toast.error('招待リンクの生成に失敗しました: ' + (err.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  // 申請を承認（法人・施設・設定・雇用記録を作成）
  const approveApplication = async (app: FacilityApplication) => {
    if (!confirm(`「${app.companyName} / ${app.facilityName}」の申請を承認しますか？`)) return;
    setAppProcessing(true);

    try {
      // 1. 法人を作成
      const companyId = crypto.randomUUID();
      const { error: companyError } = await supabase
        .from('companies')
        .insert({
          id: companyId,
          name: app.companyName,
          company_type: app.companyType || null,
          contact_person_name: app.representativeName || null,
          address: app.companyAddress || null,
          phone: app.companyPhone || null,
          contract_status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      if (companyError) throw new Error(`法人作成失敗: ${companyError.message}`);

      // 2. 施設コード発番
      let facilityCode = '';
      let isUnique = false;
      do {
        facilityCode = String(10000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 90000));
        const { data: existing } = await supabase
          .from('facilities')
          .select('id')
          .eq('code', facilityCode)
          .single();
        if (!existing) isUnique = true;
      } while (!isUnique);

      // 3. 施設を作成
      const facilityId = `facility-${Date.now()}`;
      const { error: facilityError } = await supabase
        .from('facilities')
        .insert({
          id: facilityId,
          name: app.facilityName,
          code: facilityCode,
          company_id: companyId,
          owner_user_id: app.userId,
          business_number: app.businessNumber || null,
          designation_document_path: app.designationFileUrl || null,
          verification_status: 'unverified',
          pre_registered: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      if (facilityError) throw new Error(`施設作成失敗: ${facilityError.message}`);

      // 4. 施設設定を作成
      const settingsData: Record<string, unknown> = {
        facility_id: facilityId,
        facility_name: app.facilityName,
        service_categories: app.serviceCategories,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (app.postalCode) settingsData.postal_code = app.postalCode;
      if (app.facilityAddress) settingsData.address = app.facilityAddress;
      if (app.capacityAm || app.capacityPm) {
        settingsData.capacity = { AM: app.capacityAm || 0, PM: app.capacityPm || 0 };
      }
      await supabase.from('facility_settings').insert(settingsData);

      // 5. 申請者を管理者として雇用登録
      await supabase.from('employment_records').insert({
        id: `emp-${app.userId}-${facilityId}`,
        user_id: app.userId,
        facility_id: facilityId,
        start_date: new Date().toISOString().split('T')[0],
        role: '管理者',
        employment_type: '常勤',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // 6. 申請ステータスを更新
      await supabase
        .from('facility_applications')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          approved_facility_id: facilityId,
          approved_company_id: companyId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', app.id);

      // 7. 申請者に通知
      await supabase.from('notifications').insert({
        id: `notif-${Date.now()}-${app.userId}`,
        user_id: app.userId,
        title: '施設登録が承認されました',
        message: `「${app.facilityName}」の施設登録が承認されました。施設管理画面からご利用いただけます。`,
        type: 'facility_approved',
        is_read: false,
        created_at: new Date().toISOString(),
      });

      setSelectedApp(null);
      loadData();
    } catch (err: any) {
      toast.error('承認処理に失敗しました: ' + (err.message || ''));
    } finally {
      setAppProcessing(false);
    }
  };

  // 申請を却下
  const rejectApplication = async (app: FacilityApplication) => {
    if (!rejectionReason.trim()) {
      toast.warning('却下理由を入力してください');
      return;
    }
    setAppProcessing(true);

    try {
      await supabase
        .from('facility_applications')
        .update({
          status: 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', app.id);

      // 申請者に通知
      await supabase.from('notifications').insert({
        id: `notif-${Date.now()}-${app.userId}`,
        user_id: app.userId,
        title: '施設登録申請について',
        message: `「${app.facilityName}」の施設登録申請が承認されませんでした。理由: ${rejectionReason.trim()}`,
        type: 'facility_rejected',
        is_read: false,
        created_at: new Date().toISOString(),
      });

      setSelectedApp(null);
      setShowRejectForm(false);
      setRejectionReason('');
      loadData();
    } catch (err: any) {
      toast.error('却下処理に失敗しました: ' + (err.message || ''));
    } finally {
      setAppProcessing(false);
    }
  };

  const SERVICE_LABEL: Record<string, string> = {
    childDevelopmentSupport: '児童発達支援',
    afterSchoolDayService: '放課後等デイサービス',
    nurseryVisitSupport: '保育所等訪問支援',
    homeBasedChildSupport: '居宅訪問型児童発達支援',
  };

  const COMPANY_TYPE_LABEL: Record<string, string> = {
    corporation: '株式会社・有限会社',
    npo: 'NPO法人',
    general_association: '一般社団法人・一般財団法人',
    social_welfare: '社会福祉法人',
    medical: '医療法人',
    individual: '個人事業主',
  };

  const getTokenStatus = (token: InvitationToken) => {
    if (token.usedAt) return 'used';
    if (new Date(token.expiresAt) < new Date()) return 'expired';
    return 'active';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-personal"></div>
      </div>
    );
  }

  if (!hasPermission) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/career')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-3">
                <Image
                  src="/logo.svg"
                  alt="Roots"
                  width={120}
                  height={40}
                  className="h-8 w-auto"
                />
                <span className="text-sm font-bold text-personal bg-personal/10 px-2 py-1 rounded">
                  {user?.role === 'owner' ? 'プラットフォーム管理' : '運営管理'}
                </span>
              </div>
            </div>
            <div className="text-sm text-gray-600">{user?.name}</div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* 統計カード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Briefcase, color: 'blue', value: stats?.totalCompanies || 0, label: '法人' },
            { icon: Building2, color: 'green', value: stats?.totalFacilities || 0, label: '施設' },
            { icon: Users, color: 'purple', value: stats?.totalStaff || 0, label: 'スタッフ' },
            { icon: Baby, color: 'orange', value: stats?.totalChildren || 0, label: '利用者' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 bg-${stat.color}-100 rounded-lg flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* プラットフォームダッシュボード */}
        {user?.role === 'owner' && (
          <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 rounded-xl shadow-sm p-6 mb-8 cursor-pointer hover:from-cyan-700 hover:to-cyan-800 transition-all"
            onClick={() => router.push('/admin/platform')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">プラットフォームダッシュボード</h2>
                  <p className="text-cyan-100 text-sm">全施設の売上・ベンチマーク・戦略インサイトを一覧</p>
                </div>
              </div>
              <ExternalLink className="w-5 h-5 text-white/70" />
            </div>
          </div>
        )}

        {/* 施設申請管理セクション */}
        {applications.filter(a => a.status === 'pending').length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border-2 border-amber-200 mb-8">
            <div className="p-6 border-b border-amber-100 bg-amber-50/50 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    未審査の施設申請（{applications.filter(a => a.status === 'pending').length}件）
                  </h2>
                  <p className="text-xs text-gray-500">承認すると施設アカウントが自動作成されます</p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {applications.filter(a => a.status === 'pending').map((app) => (
                <div key={app.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-800">{app.companyName}</span>
                        <span className="text-gray-400">/</span>
                        <span className="font-bold text-primary">{app.facilityName}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>申請者: {app.userName}</span>
                        <span>{new Date(app.createdAt).toLocaleDateString('ja-JP')}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => { setSelectedApp(app); setShowRejectForm(false); setRejectionReason(''); }}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-bold text-personal bg-personal/10 hover:bg-personal/20 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      詳細・審査
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 申請詳細モーダル */}
        {selectedApp && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-800">施設申請の詳細</h3>
                  <button
                    onClick={() => { setSelectedApp(null); setShowRejectForm(false); }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <XCircle className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* 法人情報 */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4" />法人情報
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex"><span className="w-24 text-gray-500 flex-shrink-0">法人名</span><span className="font-bold text-gray-800">{selectedApp.companyName}</span></div>
                    {selectedApp.companyType && <div className="flex"><span className="w-24 text-gray-500 flex-shrink-0">種別</span><span className="text-gray-800">{COMPANY_TYPE_LABEL[selectedApp.companyType] || selectedApp.companyType}</span></div>}
                    {selectedApp.representativeName && <div className="flex"><span className="w-24 text-gray-500 flex-shrink-0">代表者</span><span className="text-gray-800">{selectedApp.representativeName}</span></div>}
                    {selectedApp.companyAddress && <div className="flex"><span className="w-24 text-gray-500 flex-shrink-0">住所</span><span className="text-gray-800">{selectedApp.companyAddress}</span></div>}
                    {selectedApp.companyPhone && <div className="flex"><span className="w-24 text-gray-500 flex-shrink-0">電話</span><span className="text-gray-800">{selectedApp.companyPhone}</span></div>}
                  </div>
                </div>

                {/* 施設情報 */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" />施設情報
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex"><span className="w-24 text-gray-500 flex-shrink-0">施設名</span><span className="font-bold text-gray-800">{selectedApp.facilityName}</span></div>
                    <div className="flex">
                      <span className="w-24 text-gray-500 flex-shrink-0">サービス</span>
                      <span className="text-gray-800">
                        {Object.entries(selectedApp.serviceCategories)
                          .filter(([, v]) => v)
                          .map(([k]) => SERVICE_LABEL[k] || k)
                          .join('、') || '未選択'}
                      </span>
                    </div>
                    {selectedApp.businessNumber && <div className="flex"><span className="w-24 text-gray-500 flex-shrink-0">事業所番号</span><span className="text-gray-800 font-mono">{selectedApp.businessNumber}</span></div>}
                    {selectedApp.facilityAddress && <div className="flex"><span className="w-24 text-gray-500 flex-shrink-0">所在地</span><span className="text-gray-800">{selectedApp.postalCode ? `〒${selectedApp.postalCode} ` : ''}{selectedApp.facilityAddress}</span></div>}
                    {(selectedApp.capacityAm || selectedApp.capacityPm) && <div className="flex"><span className="w-24 text-gray-500 flex-shrink-0">定員</span><span className="text-gray-800">AM {selectedApp.capacityAm || 0}名 / PM {selectedApp.capacityPm || 0}名</span></div>}
                    {selectedApp.designationFileUrl && <div className="flex"><span className="w-24 text-gray-500 flex-shrink-0">指定通知書</span><span className="text-primary text-xs">アップロード済み</span></div>}
                  </div>
                </div>

                {/* 申請者情報 */}
                <div className="bg-blue-50 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-blue-700 mb-2">申請者</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex"><span className="w-24 text-blue-600 flex-shrink-0">氏名</span><span className="text-blue-800 font-bold">{selectedApp.userName}</span></div>
                    <div className="flex"><span className="w-24 text-blue-600 flex-shrink-0">メール</span><span className="text-blue-800">{selectedApp.userEmail}</span></div>
                    <div className="flex"><span className="w-24 text-blue-600 flex-shrink-0">申請日</span><span className="text-blue-800">{new Date(selectedApp.createdAt).toLocaleString('ja-JP')}</span></div>
                  </div>
                </div>

                {/* 却下フォーム */}
                {showRejectForm && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <label className="block text-sm font-bold text-red-700 mb-2">却下理由</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-transparent"
                      placeholder="却下理由を入力してください（申請者に通知されます）"
                      rows={3}
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => rejectApplication(selectedApp)}
                        disabled={appProcessing}
                        className="flex items-center gap-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        {appProcessing ? '処理中...' : '却下を確定'}
                      </button>
                      <button
                        onClick={() => { setShowRejectForm(false); setRejectionReason(''); }}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* アクションボタン */}
              {selectedApp.status === 'pending' && !showRejectForm && (
                <div className="p-6 border-t border-gray-100 flex gap-3">
                  <button
                    onClick={() => approveApplication(selectedApp)}
                    disabled={appProcessing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
                  >
                    <FileCheck className="w-4 h-4" />
                    {appProcessing ? '処理中...' : '承認する'}
                  </button>
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="flex items-center justify-center gap-2 px-6 py-3 border border-red-300 text-red-600 font-bold rounded-xl text-sm hover:bg-red-50 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    却下
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 審査済み申請履歴 */}
        {applications.filter(a => a.status !== 'pending').length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-600 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-gray-400" />
                審査済み申請（{applications.filter(a => a.status !== 'pending').length}件）
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {applications.filter(a => a.status !== 'pending').map((app) => (
                <div key={app.id} className="px-6 py-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">{app.companyName}</span>
                    <span className="text-gray-400">/</span>
                    <span className="text-gray-700">{app.facilityName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {app.status === 'approved' ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                        <CheckCircle className="w-3 h-3" />承認済み
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                        <XCircle className="w-3 h-3" />却下
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(app.createdAt).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 施設招待セクション */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-personal" />
                施設招待
              </h2>
              {!generatedLink && !showInviteForm && (
                <button
                  onClick={() => setShowInviteForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-personal hover:bg-personal-dark text-white font-bold rounded-lg transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  招待リンクを発行
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              新しい法人・施設の登録はすべてこの招待リンクから行います。リンクを発行して担当者に共有すると、担当者が法人情報と施設情報を入力して登録を完了できます。
            </p>
          </div>

          {/* 招待フォーム（メモ入力） */}
          {showInviteForm && !generatedLink && (
            <div className="p-6 bg-indigo-50/50 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-700 mb-4">招待先の情報（メモ）</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">法人名</label>
                  <input
                    type="text"
                    value={memoCompanyName}
                    onChange={(e) => setMemoCompanyName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-personal focus:border-transparent"
                    placeholder="例: 株式会社ひまわり福祉会"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">担当者名</label>
                    <input
                      type="text"
                      value={memoContactName}
                      onChange={(e) => setMemoContactName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-personal focus:border-transparent"
                      placeholder="例: 山田太郎"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">連絡先メール</label>
                    <input
                      type="email"
                      value={memoContactEmail}
                      onChange={(e) => setMemoContactEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-personal focus:border-transparent"
                      placeholder="例: yamada@example.com"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  ※ メモは管理用です。招待先には表示されません。空欄でも発行できます。
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={generateInvitation}
                    disabled={submitting}
                    className="flex items-center gap-2 px-5 py-2.5 bg-personal hover:bg-personal-dark text-white font-bold rounded-lg transition-colors text-sm disabled:opacity-50"
                  >
                    {submitting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {submitting ? '生成中...' : 'リンクを発行'}
                  </button>
                  <button
                    onClick={() => {
                      setShowInviteForm(false);
                      setMemoCompanyName('');
                      setMemoContactName('');
                      setMemoContactEmail('');
                    }}
                    className="px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 生成されたリンク表示 */}
          {generatedLink && (
            <div className="p-6 bg-green-50/50 border-b border-gray-100">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-bold">招待リンクを生成しました</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-2">以下のリンクを施設担当者に共有してください：</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={generatedLink}
                      readOnly
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm font-mono"
                    />
                    <button
                      onClick={() => copyLink(generatedLink)}
                      className={`flex items-center gap-1 px-4 py-2 rounded-lg font-bold transition-colors ${
                        copied
                          ? 'bg-green-100 text-green-600'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {copied ? (
                        <><CheckCircle className="w-4 h-4" />コピー済み</>
                      ) : (
                        <><Copy className="w-4 h-4" />コピー</>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">※ このリンクは7日間有効です</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 font-bold mb-2">担当者に案内する登録フロー</p>
                  <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                    <li>リンクを開いてキャリアアカウントでログイン</li>
                    <li>法人情報を入力（法人名・種別・代表者名）</li>
                    <li>施設情報を入力（施設名・サービス種別・住所・定員）</li>
                    <li>確認画面で内容を確認して登録完了</li>
                  </ol>
                </div>

                <button
                  onClick={() => setGeneratedLink('')}
                  className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>
          )}

          {/* 招待履歴 */}
          {invitations.length > 0 && (
            <div className="border-b border-gray-100">
              <button
                onClick={() => setShowInvitationHistory(!showInvitationHistory)}
                className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-bold text-gray-600 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  招待リンク履歴（{invitations.length}件）
                </span>
                {showInvitationHistory ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {showInvitationHistory && (
                <div className="px-6 pb-4">
                  <div className="space-y-2">
                    {invitations.map((inv) => {
                      const status = getTokenStatus(inv);
                      return (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-800 truncate">
                                {inv.memoCompanyName || '（メモなし）'}
                              </span>
                              {inv.memoContactName && (
                                <span className="text-gray-500 text-xs">/ {inv.memoContactName}</span>
                              )}
                            </div>
                            {status === 'used' && inv.usedByFacilityName && (
                              <p className="text-xs text-green-600 mt-0.5">
                                → {inv.usedByFacilityName} として登録済み
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {status === 'used' ? (
                              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                                <CheckCircle className="w-3 h-3" />使用済み
                              </span>
                            ) : status === 'expired' ? (
                              <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                                <Clock className="w-3 h-3" />期限切れ
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                <Clock className="w-3 h-3" />有効
                              </span>
                            )}
                            <span className="text-xs text-gray-400">
                              {new Date(inv.createdAt).toLocaleDateString('ja-JP')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 施設一覧 */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-600">登録済み施設</h3>
              {user?.role === 'owner' && (
                <button
                  onClick={() => router.push('/admin/platform')}
                  className="text-xs text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                >
                  法人・施設の詳細管理
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
            {facilities.length > 0 ? (
              <div className="space-y-3">
                {facilities.map((facility) => (
                  <div
                    key={facility.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        facility.status === 'active' ? 'bg-green-100' : 'bg-yellow-100'
                      }`}>
                        <Building2 className={`w-5 h-5 ${
                          facility.status === 'active' ? 'text-green-600' : 'text-yellow-600'
                        }`} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">{facility.name}</p>
                        <p className="text-xs text-gray-500">{facility.companyName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {facility.status === 'pending' ? (
                        <span className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                          <Clock className="w-3 h-3" />招待中
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                          <CheckCircle className="w-3 h-3" />登録済み
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(facility.createdAt).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">まだ施設がありません</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
