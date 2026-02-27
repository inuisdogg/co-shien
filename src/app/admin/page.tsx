/**
 * SaaS運営管理画面
 * マスター管理者のみがアクセス可能
 * 主な機能：施設招待リンクの発行
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import {
  Building2,
  Plus,
  Copy,
  CheckCircle,
  Users,
  Briefcase,
  Baby,
  Link as LinkIcon,
  ArrowLeft,
  Clock,
  Mail,
  ExternalLink
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Facility {
  id: string;
  name: string;
  companyName: string;
  status: 'pending' | 'active';
  invitationToken?: string;
  tokenExpiresAt?: string;
  createdAt: string;
}

interface DashboardStats {
  totalCompanies: number;
  totalFacilities: number;
  pendingInvitations: number;
  totalStaff: number;
  totalChildren: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

        // DBから最新のユーザー情報を取得して権限確認
        const { data: dbUser, error: dbError } = await supabase
          .from('users')
          .select('id, name, email, role, user_type')
          .eq('id', userData.id)
          .single();

        if (dbError || !dbUser) {
          console.error('ユーザー取得エラー:', dbError);
          router.push('/career/login');
          return;
        }

        // localStorageを最新の情報で更新
        const updatedUser = {
          ...userData,
          role: dbUser.role,
          name: dbUser.name,
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);

        // オーナーロールの場合は即座に許可
        if (dbUser.role === 'owner') {
          setHasPermission(true);
          loadData();
          return;
        }

        // それ以外はadmin_permissionsをチェック
        const { data: permData, error: permError } = await supabase
          .from('admin_permissions')
          .select('id')
          .eq('user_id', userData.id)
          .eq('permission_type', 'facility_creation')
          .maybeSingle();

        if (permError || !permData) {
          router.push('/career');
          return;
        }

        setHasPermission(true);
        loadData();
      } catch (err) {
        console.error('権限確認エラー:', err);
        router.push('/career/login');
      }
    };

    checkPermission();
  }, [router]);

  // データ読み込み
  const loadData = async () => {
    try {
      // 統計データ
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

      // 招待待ち施設数
      const { count: pendingCount } = await supabase
        .from('facilities')
        .select('*', { count: 'exact', head: true })
        .eq('pre_registered', true);

      setStats({
        totalCompanies: companiesCount || 0,
        totalFacilities: facilitiesCount || 0,
        pendingInvitations: pendingCount || 0,
        totalStaff: staffCount || 0,
        totalChildren: childrenCount || 0,
      });

      // 施設一覧（最新10件）
      const { data: facilitiesData } = await supabase
        .from('facilities')
        .select(`
          id,
          name,
          pre_registered,
          verification_status,
          code,
          created_at,
          companies(name),
          facility_registration_tokens(token, expires_at)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      const formattedFacilities: Facility[] = (facilitiesData || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        companyName: f.companies?.name || '未設定',
        status: f.pre_registered ? 'pending' : 'active',
        invitationToken: f.facility_registration_tokens?.[0]?.token,
        tokenExpiresAt: f.facility_registration_tokens?.[0]?.expires_at,
        createdAt: f.created_at,
      }));

      setFacilities(formattedFacilities);
    } catch (err) {
      console.error('データ読み込みエラー:', err);
    } finally {
      setLoading(false);
    }
  };

  // 招待リンク生成（シンプル版：トークンのみ発行）
  const generateInvitation = async () => {
    setSubmitting(true);

    try {
      // トークンを生成
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7日間有効

      const { error: tokenError } = await supabase
        .from('platform_invitation_tokens')
        .insert({
          token: token,
          expires_at: expiresAt.toISOString(),
          created_by: user?.id,
        });

      if (tokenError) throw tokenError;

      // 招待リンクを生成
      const baseUrl = window.location.origin;
      const inviteLink = `${baseUrl}/facility/register?token=${token}`;
      setGeneratedLink(inviteLink);
    } catch (err: any) {
      console.error('招待生成エラー:', err);
      alert('招待リンクの生成に失敗しました: ' + (err.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  // リンクをコピー
  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('コピーエラー:', err);
    }
  };

  // リンク表示をリセット
  const resetForm = () => {
    setGeneratedLink('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#818CF8]"></div>
      </div>
    );
  }

  if (!hasPermission) {
    return null;
  }

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
                <span className="text-sm font-bold text-[#818CF8] bg-[#818CF8]/10 px-2 py-1 rounded">
                  {user?.role === 'owner' ? 'プラットフォーム管理' : '運営管理'}
                </span>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {user?.name}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* 統計カード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stats?.totalCompanies || 0}</p>
                <p className="text-xs text-gray-500">企業</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stats?.totalFacilities || 0}</p>
                <p className="text-xs text-gray-500">施設</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stats?.totalStaff || 0}</p>
                <p className="text-xs text-gray-500">スタッフ</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Baby className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stats?.totalChildren || 0}</p>
                <p className="text-xs text-gray-500">利用者</p>
              </div>
            </div>
          </div>
        </div>

        {/* プラットフォームダッシュボードへの導線（ownerのみ） */}
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

        {/* 施設招待セクション */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#818CF8]" />
                施設招待
              </h2>
              {!generatedLink && (
                <button
                  onClick={generateInvitation}
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-[#818CF8] hover:bg-[#6366F1] text-white font-bold rounded-lg transition-colors text-sm disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      招待リンクを発行
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* 生成されたリンク表示 */}
          {generatedLink && (
            <div className="p-6 bg-gray-50 border-b border-gray-100">
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
                        <>
                          <CheckCircle className="w-4 h-4" />
                          コピー済み
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          コピー
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    ※ このリンクは7日間有効です
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 font-bold mb-2">登録フロー</p>
                  <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                    <li>施設担当者がリンクを開く</li>
                    <li>施設情報・管理者情報を入力</li>
                    <li>施設＆管理者アカウント作成</li>
                    <li>施設管理画面へ移動</li>
                  </ol>
                </div>

                <button
                  onClick={resetForm}
                  className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>
          )}

          {/* 施設一覧 */}
          <div className="p-6">
            <h3 className="text-sm font-bold text-gray-600 mb-4">最近の施設</h3>
            {facilities.length > 0 ? (
              <div className="space-y-3">
                {facilities.map((facility) => (
                  <div
                    key={facility.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        facility.status === 'active'
                          ? 'bg-green-100'
                          : 'bg-yellow-100'
                      }`}>
                        <Building2 className={`w-5 h-5 ${
                          facility.status === 'active'
                            ? 'text-green-600'
                            : 'text-yellow-600'
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
                          <Clock className="w-3 h-3" />
                          招待中
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                          <CheckCircle className="w-3 h-3" />
                          登録済み
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
              <p className="text-center text-gray-500 py-8">
                まだ施設がありません
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
