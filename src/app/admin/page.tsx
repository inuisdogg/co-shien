/**
 * 運営用管理画面
 * 企業登録→施設登録→招待リンク発行
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Building2, Plus, Copy, X, CheckCircle, XCircle, Briefcase, Users, Link as LinkIcon, Shield } from 'lucide-react';

// 静的生成をスキップ
export const dynamic = 'force-dynamic';

interface Company {
  id: string;
  name: string;
  contactPersonName?: string;
  contactPersonEmail?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  contractAmount?: number;
  createdAt: string;
  facilities: Facility[];
}

interface Facility {
  id: string;
  name: string;
  companyId: string;
  franchiseOrIndependent: 'franchise' | 'independent' | null;
  registrationToken?: string;
  tokenExpiresAt?: string;
  isCompleted: boolean;
  createdAt: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'companies' | 'facilities'>('companies');
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [showFacilityForm, setShowFacilityForm] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  
  // 企業フォーム状態
  const [companyName, setCompanyName] = useState('');
  const [contactPersonName, setContactPersonName] = useState('');
  const [contactPersonEmail, setContactPersonEmail] = useState('');
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [contractAmount, setContractAmount] = useState('');
  
  // 施設フォーム状態
  const [facilityName, setFacilityName] = useState('');
  const [franchiseOrIndependent, setFranchiseOrIndependent] = useState<'franchise' | 'independent' | ''>('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 権限チェックとユーザー情報取得
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          router.push('/login');
          return;
        }

        const userData = JSON.parse(userStr);
        setUser(userData);

        // 施設発行権限をチェック
        const { data, error } = await supabase
          .from('admin_permissions')
          .select('id')
          .eq('user_id', userData.id)
          .eq('permission_type', 'facility_creation')
          .single();

        if (error || !data) {
          setError('施設発行権限がありません');
          setLoading(false);
          return;
        }

        setHasPermission(true);
        loadCompanies();
      } catch (err: any) {
        setError(err.message || '権限確認に失敗しました');
        setLoading(false);
      }
    };

    checkPermission();
  }, [router]);

  // 企業一覧を取得
  const loadCompanies = async () => {
    try {
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (companiesError) {
        console.error('企業取得エラー:', companiesError);
        return;
      }

      // 各企業に紐づく施設を取得
      const companyIds = companiesData?.map(c => c.id) || [];
      let facilitiesData: any[] = [];
      if (companyIds.length > 0) {
        const { data: facilities, error: facilitiesError } = await supabase
          .from('facilities')
          .select('id, name, company_id, franchise_or_independent, pre_registered, verification_status, code, created_at, facility_registration_tokens(token, expires_at)')
          .in('company_id', companyIds)
          .eq('pre_registered', true);
        
        if (facilitiesError) {
          console.error('施設取得エラー:', facilitiesError);
        } else {
          facilitiesData = facilities || [];
        }
      }

      // データを結合
      const companiesWithFacilities = (companiesData || []).map(company => {
        const facilities = facilitiesData
          .filter(f => f.company_id === company.id)
          .map(f => ({
            id: f.id,
            name: f.name,
            companyId: f.company_id,
            franchiseOrIndependent: f.franchise_or_independent,
            registrationToken: f.facility_registration_tokens?.[0]?.token,
            tokenExpiresAt: f.facility_registration_tokens?.[0]?.expires_at,
            isCompleted: (f.verification_status === 'verified' || !!f.code) && !f.pre_registered,
            createdAt: f.created_at,
          }));
        
        return {
          id: company.id,
          name: company.name,
          contactPersonName: company.contact_person_name,
          contactPersonEmail: company.contact_person_email,
          contractStartDate: company.contract_start_date,
          contractEndDate: company.contract_end_date,
          contractAmount: company.contract_amount,
          createdAt: company.created_at,
          facilities,
        };
      });

      setCompanies(companiesWithFacilities);
    } catch (err) {
      console.error('データ読み込みエラー:', err);
    } finally {
      setLoading(false);
    }
  };

  // 企業登録
  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (!companyName.trim()) {
        throw new Error('企業名を入力してください');
      }

      const now = new Date().toISOString();

      if (editingCompanyId) {
        // 更新
        const { error } = await supabase
          .from('companies')
          .update({
            name: companyName.trim(),
            contact_person_name: contactPersonName.trim() || null,
            contact_person_email: contactPersonEmail.trim() || null,
            contract_start_date: contractStartDate || null,
            contract_end_date: contractEndDate || null,
            contract_amount: contractAmount ? parseFloat(contractAmount) : null,
            updated_at: now,
          })
          .eq('id', editingCompanyId);

        if (error) throw error;
        setSuccess('企業情報を更新しました');
      } else {
        // 新規作成
        const { error } = await supabase
          .from('companies')
          .insert({
            name: companyName.trim(),
            contact_person_name: contactPersonName.trim() || null,
            contact_person_email: contactPersonEmail.trim() || null,
            contract_start_date: contractStartDate || null,
            contract_end_date: contractEndDate || null,
            contract_amount: contractAmount ? parseFloat(contractAmount) : null,
          });

        if (error) throw error;
        setSuccess('企業を登録しました');
      }

      resetCompanyForm();
      loadCompanies();
    } catch (err: any) {
      setError(err.message || '登録に失敗しました');
    }
  };

  // 施設登録
  const handleFacilitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (!selectedCompanyId) {
        throw new Error('企業を選択してください');
      }
      if (!facilityName.trim()) {
        throw new Error('施設名を入力してください');
      }
      if (!franchiseOrIndependent) {
        throw new Error('フランチャイズか独立店舗かを選択してください');
      }

      const facilityId = `facility-pre-${Date.now()}`;
      const now = new Date().toISOString();

      // 施設を作成（事前登録状態）
      const { error } = await supabase
        .from('facilities')
        .insert({
          id: facilityId,
          name: facilityName.trim(),
          company_id: selectedCompanyId,
          franchise_or_independent: franchiseOrIndependent,
          pre_registered: true,
          verification_status: 'unverified',
        });

      if (error) throw error;
      setSuccess('施設を登録しました');
      resetFacilityForm();
      loadCompanies();
    } catch (err: any) {
      setError(err.message || '登録に失敗しました');
    }
  };

  // トークンを生成
  const generateToken = async (facilityId: string) => {
    try {
      const token = `reg-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // 既存のトークンを削除
      await supabase
        .from('facility_registration_tokens')
        .delete()
        .eq('facility_id', facilityId);

      // 新しいトークンを保存
      const { error } = await supabase
        .from('facility_registration_tokens')
        .insert({
          facility_id: facilityId,
          token,
          expires_at: expiresAt.toISOString(),
        });

      if (error) throw error;
      setSuccess('トークンを生成しました');
      loadCompanies();
    } catch (err: any) {
      setError(err.message || 'トークンの生成に失敗しました');
    }
  };

  // フォームをリセット
  const resetCompanyForm = () => {
    setCompanyName('');
    setContactPersonName('');
    setContactPersonEmail('');
    setContractStartDate('');
    setContractEndDate('');
    setContractAmount('');
    setShowCompanyForm(false);
    setEditingCompanyId(null);
  };

  const resetFacilityForm = () => {
    setFacilityName('');
    setFranchiseOrIndependent('');
    setShowFacilityForm(false);
    setSelectedCompanyId(null);
  };

  // 編集開始
  const startEditCompany = (company: Company) => {
    setCompanyName(company.name);
    setContactPersonName(company.contactPersonName || '');
    setContactPersonEmail(company.contactPersonEmail || '');
    setContractStartDate(company.contractStartDate || '');
    setContractEndDate(company.contractEndDate || '');
    setContractAmount(company.contractAmount?.toString() || '');
    setEditingCompanyId(company.id);
    setShowCompanyForm(true);
  };

  // 特設ページのURLを取得
  const getRegistrationUrl = (token: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/facility/register?token=${token}`;
  };

  // URLをコピー
  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setSuccess('URLをクリップボードにコピーしました');
    setTimeout(() => setSuccess(''), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md">
          <div className="text-center">
            <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">アクセス権限がありません</h2>
            <p className="text-gray-600 mb-4">施設発行権限が必要です</p>
            <button
              onClick={() => router.push('/staff-dashboard')}
              className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-2 px-4 rounded-md transition-colors"
            >
              ダッシュボードに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/logo-cropped-center.png"
                alt="co-shien"
                width={120}
                height={32}
                className="h-8 w-auto"
                priority
              />
              <h1 className="text-xl font-bold text-gray-800">運営管理画面</h1>
            </div>
            <button
              onClick={() => router.push('/staff-dashboard')}
              className="text-gray-600 hover:text-gray-800 text-sm"
            >
              ダッシュボードに戻る
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* メッセージ */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-6">
            {success}
          </div>
        )}

        {/* タブ */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('companies')}
            className={`px-4 py-2 rounded-md font-bold transition-colors ${
              activeTab === 'companies'
                ? 'bg-[#00c4cc] text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            企業管理
          </button>
          <button
            onClick={() => setActiveTab('facilities')}
            className={`px-4 py-2 rounded-md font-bold transition-colors ${
              activeTab === 'facilities'
                ? 'bg-[#00c4cc] text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Building2 className="w-4 h-4 inline mr-2" />
            施設管理
          </button>
        </div>

        {/* 企業管理タブ */}
        {activeTab === 'companies' && (
          <>
            {!showCompanyForm && (
              <div className="mb-6">
                <button
                  onClick={() => {
                    resetCompanyForm();
                    setShowCompanyForm(true);
                  }}
                  className="flex items-center gap-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-2 px-4 rounded-md transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  企業を登録
                </button>
              </div>
            )}

            {showCompanyForm && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">
                  {editingCompanyId ? '企業情報を編集' : '企業を登録'}
                </h2>
                <form onSubmit={handleCompanySubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      企業名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      placeholder="例: ○○株式会社"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        担当者名
                      </label>
                      <input
                        type="text"
                        value={contactPersonName}
                        onChange={(e) => setContactPersonName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        担当者メールアドレス
                      </label>
                      <input
                        type="email"
                        value={contactPersonEmail}
                        onChange={(e) => setContactPersonEmail(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        契約開始日
                      </label>
                      <input
                        type="date"
                        value={contractStartDate}
                        onChange={(e) => setContractStartDate(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        契約終了日
                      </label>
                      <input
                        type="date"
                        value={contractEndDate}
                        onChange={(e) => setContractEndDate(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        契約金額（円）
                      </label>
                      <input
                        type="number"
                        value={contractAmount}
                        onChange={(e) => setContractAmount(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                        placeholder="例: 50000"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-2 px-4 rounded-md transition-colors"
                    >
                      {editingCompanyId ? '更新' : '登録'}
                    </button>
                    <button
                      type="button"
                      onClick={resetCompanyForm}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-md transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 企業一覧 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-800">企業一覧</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {companies.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    登録された企業がありません
                  </div>
                ) : (
                  companies.map((company) => (
                    <div key={company.id} className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Briefcase className="w-5 h-5 text-[#00c4cc]" />
                            <h3 className="text-lg font-bold text-gray-800">{company.name}</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                            {company.contactPersonName && (
                              <div>
                                <span className="font-bold">担当者:</span> {company.contactPersonName}
                              </div>
                            )}
                            {company.contactPersonEmail && (
                              <div>
                                <span className="font-bold">メール:</span> {company.contactPersonEmail}
                              </div>
                            )}
                            {company.contractStartDate && (
                              <div>
                                <span className="font-bold">契約開始:</span> {new Date(company.contractStartDate).toLocaleDateString('ja-JP')}
                              </div>
                            )}
                            {company.contractEndDate && (
                              <div>
                                <span className="font-bold">契約終了:</span> {new Date(company.contractEndDate).toLocaleDateString('ja-JP')}
                              </div>
                            )}
                            {company.contractAmount && (
                              <div>
                                <span className="font-bold">契約金額:</span> ¥{company.contractAmount.toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => startEditCompany(company)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold py-2 px-4 rounded-md transition-colors"
                        >
                          編集
                        </button>
                      </div>

                      {/* 施設一覧 */}
                      {company.facilities.length > 0 && (
                        <div className="mt-4 pl-8 border-l-2 border-gray-200">
                          <h4 className="text-sm font-bold text-gray-700 mb-2">登録施設 ({company.facilities.length})</h4>
                          <div className="space-y-3">
                            {company.facilities.map((facility) => (
                              <div key={facility.id} className="bg-gray-50 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-gray-600" />
                                    <span className="font-bold text-gray-800">{facility.name}</span>
                                    <span className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700">
                                      {facility.franchiseOrIndependent === 'franchise' ? 'フランチャイズ' : '独立店舗'}
                                    </span>
                                    {facility.isCompleted ? (
                                      <CheckCircle className="w-4 h-4 text-green-500" />
                                    ) : (
                                      <XCircle className="w-4 h-4 text-yellow-500" />
                                    )}
                                  </div>
                                </div>
                                {facility.registrationToken ? (
                                  <div className="mt-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs font-bold text-gray-700">招待リンク:</span>
                                      <button
                                        onClick={() => copyUrl(getRegistrationUrl(facility.registrationToken!))}
                                        className="text-[#00c4cc] hover:text-[#00b0b8] text-xs flex items-center gap-1"
                                      >
                                        <Copy className="w-3 h-3" />
                                        コピー
                                      </button>
                                    </div>
                                    <div className="bg-white border border-gray-300 rounded-md p-2 text-xs font-mono text-gray-700 break-all">
                                      {getRegistrationUrl(facility.registrationToken)}
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => generateToken(facility.id)}
                                    className="mt-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white text-xs font-bold py-1 px-3 rounded-md transition-colors"
                                  >
                                    招待リンクを発行
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* 施設管理タブ */}
        {activeTab === 'facilities' && (
          <>
            {!showFacilityForm && (
              <div className="mb-6">
                <button
                  onClick={() => {
                    if (companies.length === 0) {
                      setError('まず企業を登録してください');
                      return;
                    }
                    resetFacilityForm();
                    setShowFacilityForm(true);
                  }}
                  className="flex items-center gap-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-2 px-4 rounded-md transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  施設を登録
                </button>
              </div>
            )}

            {showFacilityForm && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">施設を登録</h2>
                <form onSubmit={handleFacilitySubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      企業 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedCompanyId || ''}
                      onChange={(e) => setSelectedCompanyId(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                    >
                      <option value="">企業を選択</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      施設名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={facilityName}
                      onChange={(e) => setFacilityName(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00c4cc]"
                      placeholder="例: ○○放課後等デイサービス"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      タイプ <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="franchise"
                          checked={franchiseOrIndependent === 'franchise'}
                          onChange={(e) => setFranchiseOrIndependent(e.target.value as 'franchise' | 'independent')}
                          className="mr-2"
                        />
                        <span>フランチャイズ</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="independent"
                          checked={franchiseOrIndependent === 'independent'}
                          onChange={(e) => setFranchiseOrIndependent(e.target.value as 'independent')}
                          className="mr-2"
                        />
                        <span>独立店舗</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="bg-[#00c4cc] hover:bg-[#00b0b8] text-white font-bold py-2 px-4 rounded-md transition-colors"
                    >
                      登録
                    </button>
                    <button
                      type="button"
                      onClick={resetFacilityForm}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-md transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 全施設一覧 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-800">全施設一覧</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {companies.flatMap(c => c.facilities).length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    登録された施設がありません
                  </div>
                ) : (
                  companies.flatMap(company =>
                    company.facilities.map(facility => (
                      <div key={facility.id} className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Building2 className="w-5 h-5 text-[#00c4cc]" />
                              <span className="font-bold text-gray-800">{facility.name}</span>
                              <span className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700">
                                {facility.franchiseOrIndependent === 'franchise' ? 'フランチャイズ' : '独立店舗'}
                              </span>
                              <span className="text-xs text-gray-500">
                                ({companies.find(c => c.id === facility.companyId)?.name})
                              </span>
                              {facility.isCompleted ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-yellow-500" />
                              )}
                            </div>
                            {facility.registrationToken ? (
                              <div className="mt-2">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-bold text-gray-700">招待リンク:</span>
                                  <button
                                    onClick={() => copyUrl(getRegistrationUrl(facility.registrationToken!))}
                                    className="text-[#00c4cc] hover:text-[#00b0b8] text-xs flex items-center gap-1"
                                  >
                                    <Copy className="w-3 h-3" />
                                    コピー
                                  </button>
                                </div>
                                <div className="bg-gray-50 border border-gray-300 rounded-md p-2 text-xs font-mono text-gray-700 break-all">
                                  {getRegistrationUrl(facility.registrationToken)}
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => generateToken(facility.id)}
                                className="mt-2 bg-[#00c4cc] hover:bg-[#00b0b8] text-white text-xs font-bold py-1 px-3 rounded-md transition-colors"
                              >
                                招待リンクを発行
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
