'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Calendar as CalendarIcon,
  FileText,
  UserCircle,
  Clock,
  MapPin,
  ChevronRight,
  Plus,
  CheckCircle2,
  AlertCircle,
  Bell,
  Baby,
  ClipboardCheck,
  DollarSign,
  Star,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSitterProfile, useSitterBookings, useSitterReports, useSitterStats } from '@/hooks/useSitter';
import { SITTER_PROFESSION_LABELS, BOOKING_STATUS_LABELS, SitterBooking } from '@/types/sitter';

type TabType = 'dashboard' | 'schedule' | 'reports' | 'profile';

export default function SitterStaffPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  const { profile, isLoading: profileLoading } = useSitterProfile(user?.id);
  const { bookings, isLoading: bookingsLoading } = useSitterBookings(profile?.id);
  const { reports, pendingReports, isLoading: reportsLoading } = useSitterReports(profile?.id);
  const { stats, isLoading: statsLoading } = useSitterStats(profile?.id);

  const isLoading = authLoading || profileLoading;

  // 未登録のシッターは登録ページへ
  useEffect(() => {
    if (!isLoading && user && !profile) {
      router.push('/sitter/staff/register');
    }
  }, [isLoading, user, profile, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Baby className="w-16 h-16 text-pink-300 mb-4" />
        <h2 className="text-lg font-bold text-slate-800 mb-2">ログインが必要です</h2>
        <p className="text-sm text-slate-500 text-center mb-6">
          シッターダッシュボードを利用するにはログインしてください
        </p>
        <Link
          href="/login"
          className="bg-pink-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-pink-600 transition-colors"
        >
          ログイン
        </Link>
      </div>
    );
  }

  if (!profile) {
    return null; // 登録ページへリダイレクト中
  }

  // 今後の予定（確定・実施中）
  const upcomingBookings = bookings.filter(b =>
    ['pending', 'confirmed', 'in_progress'].includes(b.status)
  ).slice(0, 3);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-24">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white border-b border-pink-100 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-pink-100">
              <Baby className="text-white w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">
              co-shien <span className="text-pink-500 text-sm">Sitter Staff</span>
            </h1>
          </div>
          <button className="relative p-2 text-slate-400">
            <Bell className="w-6 h-6" />
            {(pendingReports.length > 0 || (stats?.pendingBookings || 0) > 0) && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-pink-500 rounded-full border-2 border-white"></span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-6">
        {/* ダッシュボードタブ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* 報酬・統計サマリー */}
            <section className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm">
                <div className="flex items-center gap-2 text-pink-500 mb-1">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">今月の売上</span>
                </div>
                <p className="text-xl font-black text-slate-800">
                  ¥{(stats?.monthlyEarnings || 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm">
                <div className="flex items-center gap-2 text-pink-500 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">稼働時間</span>
                </div>
                <p className="text-xl font-black text-slate-800">
                  {stats?.monthlyHours || 0}<span className="text-xs ml-1">h</span>
                </p>
              </div>
            </section>

            {/* アラート: 報告書の作成依頼 */}
            {pendingReports.length > 0 && (
              <section className="bg-pink-50 border border-pink-100 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-pink-500 shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xs font-bold text-pink-700">報告書の作成が必要です</h3>
                  <p className="text-[10px] text-pink-600 opacity-80">
                    {pendingReports.length}件の報告書が未作成です
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('reports')}
                  className="bg-pink-500 text-white p-2 rounded-lg"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </section>
            )}

            {/* 新規予約リクエスト */}
            {(stats?.pendingBookings || 0) > 0 && (
              <section className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-amber-500 shrink-0">
                  <Bell className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xs font-bold text-amber-700">新規予約リクエスト</h3>
                  <p className="text-[10px] text-amber-600 opacity-80">
                    {stats?.pendingBookings}件の確認待ち
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('schedule')}
                  className="bg-amber-500 text-white p-2 rounded-lg"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </section>
            )}

            {/* 今後のシッティング予定 */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-700">次のシッティング</h3>
                <button
                  onClick={() => setActiveTab('schedule')}
                  className="text-[10px] font-bold text-pink-500"
                >
                  すべて見る
                </button>
              </div>

              {bookingsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-pink-300 animate-spin" />
                </div>
              ) : upcomingBookings.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                  <CalendarIcon className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-400">予定はありません</p>
                </div>
              ) : (
                upcomingBookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))
              )}
            </section>
          </div>
        )}

        {/* スケジュールタブ */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">シフト・スケジュール</h3>
              <button className="bg-pink-500 text-white p-2 rounded-xl shadow-lg shadow-pink-100">
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* カレンダープレースホルダー */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center py-12">
              <CalendarIcon className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-400">カレンダーを表示します</p>
              <button className="mt-4 text-xs font-bold text-pink-500 underline">
                空き時間を追加する
              </button>
            </div>

            {/* 予約一覧 */}
            <section className="space-y-4">
              <h3 className="font-bold text-slate-700">予約一覧</h3>
              {bookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} showStatus />
              ))}
            </section>
          </div>
        )}

        {/* 報告書タブ */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-800">活動報告書</h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button className="bg-white border-b-2 border-pink-500 py-3 text-xs font-bold text-pink-600">
                未作成 ({pendingReports.length})
              </button>
              <button className="bg-transparent py-3 text-xs font-bold text-slate-400">
                作成済み ({reports.length})
              </button>
            </div>

            {reportsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-pink-300 animate-spin" />
              </div>
            ) : pendingReports.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-400">すべての報告書が完了しています</p>
              </div>
            ) : (
              pendingReports.map((report) => (
                <div
                  key={report.bookingId}
                  className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between shadow-sm"
                >
                  <div>
                    <h4 className="text-sm font-bold text-slate-700">{report.childName} ちゃん</h4>
                    <p className="text-[10px] text-slate-400">
                      {report.date} ・ {report.hours}
                    </p>
                  </div>
                  <button className="bg-pink-500 text-white text-[10px] font-bold px-4 py-2 rounded-lg hover:bg-pink-600 transition-colors flex items-center gap-1">
                    作成
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* プロフィールタブ */}
        {activeTab === 'profile' && (
          <div className="space-y-8 pb-10">
            <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-pink-500"></div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                  {profile.profileImage ? (
                    <img
                      src={profile.profileImage}
                      alt={profile.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserCircle className="w-12 h-12 text-slate-300" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-800">{profile.displayName}</h3>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {profile.professions.map((prof) => (
                      <span
                        key={prof}
                        className="text-[10px] font-bold text-pink-500 bg-pink-50 px-2 py-0.5 rounded-md"
                      >
                        {SITTER_PROFESSION_LABELS[prof]}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="text-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter leading-none">
                        評価
                      </p>
                      <p className="text-sm font-black text-slate-700 flex items-center gap-0.5">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        {profile.ratingAverage.toFixed(1)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter leading-none">
                        実績
                      </p>
                      <p className="text-sm font-black text-slate-700">{profile.totalBookings}件</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <ClipboardCheck className="w-4 h-4 text-pink-500" />
                    <h4 className="text-xs font-bold text-slate-700">東京都認定・資格</h4>
                  </div>
                  <ul className="space-y-1">
                    {profile.isTokyoCertified ? (
                      <li className="text-[10px] text-emerald-600 flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3 h-3" /> 東京都ベビーシッター利用支援事業
                        研修修了済み
                      </li>
                    ) : (
                      <li className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3 text-slate-300" />{' '}
                        東京都研修は未修了
                      </li>
                    )}
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    シッター自己紹介
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    {profile.introduction || '自己紹介が登録されていません'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold">時給</p>
                    <p className="text-sm font-bold text-slate-700">
                      ¥{profile.hourlyRate.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold">最低時間</p>
                    <p className="text-sm font-bold text-slate-700">{profile.minimumHours}時間〜</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400">対応エリア</h4>
                  <div className="flex flex-wrap gap-1">
                    {profile.serviceAreas.length > 0 ? (
                      profile.serviceAreas.map((area) => (
                        <span
                          key={area}
                          className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded"
                        >
                          {area}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-400">未設定</span>
                    )}
                  </div>
                </div>
              </div>

              <button className="w-full mt-6 bg-slate-900 text-white font-bold py-3.5 rounded-2xl shadow-xl shadow-slate-200 flex items-center justify-center gap-2 hover:bg-slate-800 transition-all">
                プロフィールの編集
              </button>
            </section>

            {/* 統計 */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                累計実績
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold">累計売上</p>
                  <p className="text-lg font-black text-slate-700">
                    ¥{(stats?.totalEarnings || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold">累計稼働</p>
                  <p className="text-lg font-black text-slate-700">{stats?.totalHours || 0}h</p>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* ボトムナビゲーション */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'dashboard' ? 'text-pink-500' : 'text-slate-400'
          }`}
        >
          <LayoutDashboard className="w-6 h-6" />
          <span className="text-[10px] font-bold">ホーム</span>
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'schedule' ? 'text-pink-500' : 'text-slate-400'
          }`}
        >
          <CalendarIcon className="w-6 h-6" />
          <span className="text-[10px] font-bold">予定</span>
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'reports' ? 'text-pink-500' : 'text-slate-400'
          } relative`}
        >
          <FileText className="w-6 h-6" />
          {pendingReports.length > 0 && (
            <span className="absolute top-0 right-0 w-2 h-2 bg-pink-500 rounded-full border-2 border-white"></span>
          )}
          <span className="text-[10px] font-bold">報告書</span>
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'profile' ? 'text-pink-500' : 'text-slate-400'
          }`}
        >
          <UserCircle className="w-6 h-6" />
          <span className="text-[10px] font-bold">マイページ</span>
        </button>
      </nav>
    </div>
  );
}

// 予約カードコンポーネント
function BookingCard({ booking, showStatus }: { booking: SitterBooking; showStatus?: boolean }) {
  const statusInfo = BOOKING_STATUS_LABELS[booking.status];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-pink-200 transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-3">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
            <Baby className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800">{booking.childName || '未設定'} ちゃん</h4>
            <p className="text-[10px] font-bold text-slate-400">{booking.childAge || ''}</p>
          </div>
        </div>
        {showStatus && (
          <span
            className={`text-[10px] font-bold px-2 py-1 rounded-md ${statusInfo.bgColor} ${statusInfo.color}`}
          >
            {statusInfo.label}
          </span>
        )}
        {!showStatus && (
          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md">
            確定
          </span>
        )}
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <CalendarIcon className="w-3.5 h-3.5" />
          {booking.bookingDate} ({booking.startTime} - {booking.endTime})
        </div>
        {booking.locationAddress && (
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <MapPin className="w-3.5 h-3.5" />
            {booking.locationAddress.substring(0, 20)}...
          </div>
        )}
      </div>

      {booking.clientMemo && (
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-[10px] text-slate-500 leading-relaxed italic">
          「{booking.clientMemo}」
        </div>
      )}

      <button className="w-full mt-4 bg-white border border-pink-200 text-pink-500 font-bold py-3 rounded-xl hover:bg-pink-50 transition-colors text-xs">
        詳細・地図を確認
      </button>
    </div>
  );
}
