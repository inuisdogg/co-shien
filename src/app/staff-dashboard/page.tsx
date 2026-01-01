/**
 * 個人スタッフ用ダッシュボード
 * 「自分のキャリアの価値を確認する場所」であり、「今日の業務をスムーズに始めるためのショートカット」
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Briefcase,
  Award,
  Clock,
  FileText,
  Bell,
  Settings,
  LogOut,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Calendar,
  MapPin,
  User,
  Building2,
  ArrowRight,
  PlayCircle,
  PauseCircle,
  Coffee,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { User as UserType, EmploymentRecord } from '@/types';

export default function StaffDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserType | null>(null);
  const [activeEmployments, setActiveEmployments] = useState<EmploymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFacility, setCurrentFacility] = useState<EmploymentRecord | null>(null);
  const [timeTrackingStatus, setTimeTrackingStatus] = useState<'idle' | 'working' | 'break'>('idle');
  const [activeTab, setActiveTab] = useState<'home' | 'career' | 'work' | 'jobs' | 'settings'>('home');

  useEffect(() => {
    const loadUserData = async () => {
      try {
        // セッションからユーザー情報を取得
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
          router.push('/login');
          return;
        }

        const userData = JSON.parse(storedUser);
        setUser(userData);

        // アクティブな所属関係を取得
        const { data: employments, error } = await supabase
          .from('employment_records')
          .select(`
            *,
            facilities:facility_id (
              id,
              name,
              code
            )
          `)
          .eq('user_id', userData.id)
          .is('end_date', null)
          .order('start_date', { ascending: false });

        if (error) {
          console.error('所属関係取得エラー:', error);
        } else if (employments && employments.length > 0) {
          setActiveEmployments(employments as any);
          setCurrentFacility(employments[0] as any);
        }
      } catch (err) {
        console.error('データ読み込みエラー:', err);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [router]);

  // ログアウト処理
  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  // 打刻処理
  const handleTimeTracking = async (type: 'start' | 'end' | 'break_start' | 'break_end') => {
    if (!user || !currentFacility) return;
    
    try {
      const now = new Date();
      const timeString = now.toTimeString().slice(0, 5);
      
      // 打刻データを保存（暫定：後でattendance_recordsテーブルを作成）
      // 現時点ではlocalStorageに保存（後でDBに移行）
      const attendanceData = {
        user_id: user.id,
        facility_id: currentFacility.facility_id,
        date: now.toISOString().split('T')[0],
        type,
        time: timeString,
        timestamp: now.toISOString(),
      };
      
      const existingRecords = JSON.parse(localStorage.getItem('attendance_records') || '[]');
      existingRecords.push(attendanceData);
      localStorage.setItem('attendance_records', JSON.stringify(existingRecords));
      
      // ステータス更新
      if (type === 'start') {
        setTimeTrackingStatus('working');
      } else if (type === 'end') {
        setTimeTrackingStatus('idle');
      } else if (type === 'break_start') {
        setTimeTrackingStatus('break');
      } else if (type === 'break_end') {
        setTimeTrackingStatus('working');
      }
      
      // TODO: 後でattendance_recordsテーブルに保存する処理を追加
    } catch (err) {
      console.error('打刻エラー:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ① アイデンティティ・エリア */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-[#00c4cc] rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{user.name}</h1>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>

          {/* 所属情報 */}
          {currentFacility && (
            <div className="bg-[#00c4cc]/10 rounded-lg p-4 border border-[#00c4cc]/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#00c4cc]" />
                  <div>
                    <span className="font-bold text-gray-800 block">
                      {currentFacility.facilities?.name || '事業所'}
                    </span>
                    <span className="text-sm text-gray-600">
                      {currentFacility.role} / {currentFacility.employment_type}
                    </span>
                  </div>
                </div>
                {activeEmployments.length > 1 && (
                  <button className="text-sm text-[#00c4cc] hover:underline">
                    切り替え
                  </button>
                )}
              </div>
            </div>
          )}

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
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* ② キャリア・インジケーター */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#00c4cc]" />
            あなたのキャリア価値
          </h2>
          
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-start gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-blue-800 mb-3">
                    キャリアアップの選択肢
                  </p>
                  <div className="space-y-3">
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-gray-800 mb-1">児童発達支援管理責任者（児発管）</h4>
                          <p className="text-xs text-gray-600 mb-2">児発管になるには、5年以上の実務経験が必要です。</p>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500">要件：5年以上の実務経験</span>
                          </div>
                        </div>
                        <button
                          onClick={() => setActiveTab('jobs')}
                          className="flex items-center gap-1 text-xs text-[#00c4cc] hover:text-[#00b0b8] font-bold whitespace-nowrap"
                        >
                          求人を見る
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ③ 業務管理ツール */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#00c4cc]" />
            業務管理ツール
          </h2>
          
          <div className="space-y-4">
            {/* 打刻セクション */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-bold text-gray-700 mb-3">打刻</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => handleTimeTracking('start')}
                  disabled={timeTrackingStatus === 'working' || timeTrackingStatus === 'break'}
                  className="flex flex-col items-center justify-center p-3 bg-[#00c4cc]/10 rounded-lg border border-[#00c4cc]/20 hover:bg-[#00c4cc]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PlayCircle className="w-6 h-6 text-[#00c4cc] mb-1" />
                  <span className="text-xs font-bold text-gray-800">始業</span>
                </button>
                <button
                  onClick={() => handleTimeTracking('break_start')}
                  disabled={timeTrackingStatus !== 'working'}
                  className="flex flex-col items-center justify-center p-3 bg-[#00c4cc]/10 rounded-lg border border-[#00c4cc]/20 hover:bg-[#00c4cc]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Coffee className="w-6 h-6 text-[#00c4cc] mb-1" />
                  <span className="text-xs font-bold text-gray-800">休憩開始</span>
                </button>
                <button
                  onClick={() => handleTimeTracking('break_end')}
                  disabled={timeTrackingStatus !== 'break'}
                  className="flex flex-col items-center justify-center p-3 bg-[#00c4cc]/10 rounded-lg border border-[#00c4cc]/20 hover:bg-[#00c4cc]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PlayCircle className="w-6 h-6 text-[#00c4cc] mb-1" />
                  <span className="text-xs font-bold text-gray-800">休憩終了</span>
                </button>
                <button
                  onClick={() => handleTimeTracking('end')}
                  disabled={timeTrackingStatus === 'idle'}
                  className="flex flex-col items-center justify-center p-3 bg-[#00c4cc]/10 rounded-lg border border-[#00c4cc]/20 hover:bg-[#00c4cc]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PauseCircle className="w-6 h-6 text-[#00c4cc] mb-1" />
                  <span className="text-xs font-bold text-gray-800">退勤</span>
                </button>
              </div>
              {timeTrackingStatus !== 'idle' && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  {timeTrackingStatus === 'working' ? '勤務中' : '休憩中'}
                </p>
              )}
            </div>

            {/* 事業所設定のメニュー */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3">その他の業務ツール</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <button className="flex flex-col items-center justify-center p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                  <FileText className="w-6 h-6 text-gray-600 mb-1" />
                  <span className="text-xs font-bold text-gray-800">日報作成</span>
                </button>
                <button className="flex flex-col items-center justify-center p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                  <FileText className="w-6 h-6 text-gray-600 mb-1" />
                  <span className="text-xs font-bold text-gray-800">書類出力</span>
                </button>
                <button className="flex flex-col items-center justify-center p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                  <Calendar className="w-6 h-6 text-gray-600 mb-1" />
                  <span className="text-xs font-bold text-gray-800">スケジュール</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ④ 通知・アクションセンター */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#00c4cc]" />
            通知・アクション
          </h2>
          
          <div className="space-y-3">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-800 mb-1">
                    資格証の有効期限が切れています
                  </p>
                  <p className="text-xs text-gray-600">
                    保育士証の有効期限が2024年3月31日に切れます。再アップロードしてください。
                  </p>
                  <button className="mt-2 text-xs text-[#00c4cc] hover:underline">
                    確認する →
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-800 mb-1">
                    実務経験の承認依頼が届いています
                  </p>
                  <p className="text-xs text-gray-600">
                    過去の職場（〇〇事業所）から実務経験証明の承認依頼が届いています。
                  </p>
                  <button className="mt-2 text-xs text-[#00c4cc] hover:underline">
                    確認する →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      )}

      {activeTab === 'career' && (
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">キャリア</h2>
          <p className="text-gray-600">キャリア管理機能は後で実装します</p>
        </div>
      )}

      {activeTab === 'work' && (
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">業務</h2>
          <p className="text-gray-600">業務管理ツールは後で実装します</p>
        </div>
      )}

      {activeTab === 'jobs' && (
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">求人</h2>
          <p className="text-gray-600">求人情報は後で実装します</p>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">設定</h2>
          <p className="text-gray-600">設定機能は後で実装します</p>
        </div>
      )}

      {/* タブバー（画面下部） */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-around py-2">
            <button 
              onClick={() => setActiveTab('home')}
              className={`flex flex-col items-center gap-1 p-2 transition-colors ${
                activeTab === 'home' ? 'text-[#00c4cc]' : 'text-gray-600 hover:text-[#00c4cc]'
              }`}
            >
              <Briefcase className="w-6 h-6" />
              <span className="text-xs font-bold">ホーム</span>
            </button>
            <button 
              onClick={() => setActiveTab('career')}
              className={`flex flex-col items-center gap-1 p-2 transition-colors ${
                activeTab === 'career' ? 'text-[#00c4cc]' : 'text-gray-600 hover:text-[#00c4cc]'
              }`}
            >
              <Award className="w-6 h-6" />
              <span className="text-xs font-bold">キャリア</span>
            </button>
            <button 
              onClick={() => setActiveTab('work')}
              className={`flex flex-col items-center gap-1 p-2 transition-colors ${
                activeTab === 'work' ? 'text-[#00c4cc]' : 'text-gray-600 hover:text-[#00c4cc]'
              }`}
            >
              <FileText className="w-6 h-6" />
              <span className="text-xs font-bold">業務</span>
            </button>
            <button 
              onClick={() => setActiveTab('jobs')}
              className={`flex flex-col items-center gap-1 p-2 transition-colors ${
                activeTab === 'jobs' ? 'text-[#00c4cc]' : 'text-gray-600 hover:text-[#00c4cc]'
              }`}
            >
              <Briefcase className="w-6 h-6" />
              <span className="text-xs font-bold">求人</span>
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center gap-1 p-2 transition-colors ${
                activeTab === 'settings' ? 'text-[#00c4cc]' : 'text-gray-600 hover:text-[#00c4cc]'
              }`}
            >
              <Settings className="w-6 h-6" />
              <span className="text-xs font-bold">設定</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
