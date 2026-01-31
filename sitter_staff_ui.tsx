import React, { useState } from 'react';
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
  DollarSign
} from 'lucide-react';

const SitterStaffUI = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  // モックデータ: 今後の予定
  const upcomingJobs = [
    {
      id: 1,
      childName: "山田 太郎",
      age: "3歳2ヶ月",
      date: "2024.01.20",
      time: "10:00 - 13:00",
      location: "東京都港区芝公園...",
      status: "確定",
      memo: "人見知りがありますが、電車遊びが大好きです。言葉の促しをお願いします。"
    },
    {
      id: 2,
      childName: "佐藤 花子",
      age: "1歳8ヶ月",
      date: "2024.01.22",
      time: "14:00 - 17:00",
      location: "東京都品川区北品川...",
      status: "確定",
      memo: "離乳食の補助をお願いします。ダウン症の診断あり、ゆっくりとしたペースでの食事。"
    }
  ];

  // モックデータ: 未作成の報告書
  const pendingReports = [
    { id: 101, childName: "鈴木 一郎", date: "2024.01.18", time: "3時間" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-24">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white border-b border-pink-100 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-pink-100">
              <Baby className="text-white w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">co-shien <span className="text-pink-500 text-sm">Sitter Staff</span></h1>
          </div>
          <button className="relative p-2 text-slate-400">
            <Bell className="w-6 h-6" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-pink-500 rounded-full border-2 border-white"></span>
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* 報酬・統計サマリー */}
            <section className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm">
                <div className="flex items-center gap-2 text-pink-500 mb-1">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">今月の売上</span>
                </div>
                <p className="text-xl font-black text-slate-800">¥84,200</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm">
                <div className="flex items-center gap-2 text-pink-500 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">稼働時間</span>
                </div>
                <p className="text-xl font-black text-slate-800">24.5<span className="text-xs ml-1">h</span></p>
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
                  <p className="text-[10px] text-pink-600 opacity-80">東京都の補助金申請に必須です。早めに作成しましょう。</p>
                </div>
                <button className="bg-pink-500 text-white p-2 rounded-lg">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </section>
            )}

            {/* 今後のシッティング予定 */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-700">次のシッティング</h3>
                <button className="text-[10px] font-bold text-pink-500">すべて見る</button>
              </div>
              {upcomingJobs.map(job => (
                <div key={job.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-pink-200 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-3">
                      <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                        <Baby className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800">{job.childName} ちゃん</h4>
                        <p className="text-[10px] font-bold text-slate-400">{job.age}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md">
                      {job.status}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      {job.date} ({job.time})
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                      <MapPin className="w-3.5 h-3.5" />
                      {job.location}
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-[10px] text-slate-500 leading-relaxed italic">
                    「{job.memo}」
                  </div>

                  <button className="w-full mt-4 bg-white border border-pink-200 text-pink-500 font-bold py-3 rounded-xl hover:bg-pink-50 transition-colors text-xs">
                    詳細・地図を確認
                  </button>
                </div>
              ))}
            </section>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">シフト・スケジュール</h3>
              <button className="bg-pink-500 text-white p-2 rounded-xl shadow-lg shadow-pink-100">
                <Plus className="w-5 h-5" />
              </button>
            </div>
            {/* 簡易カレンダー（実際はライブラリを使用） */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center py-12">
              <CalendarIcon className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-400">カレンダーを表示します</p>
              <button className="mt-4 text-xs font-bold text-pink-500 underline">空き時間を追加する</button>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-800">活動報告書</h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button className="bg-white border-b-2 border-pink-500 py-3 text-xs font-bold text-pink-600">未作成</button>
              <button className="bg-transparent py-3 text-xs font-bold text-slate-400">作成済み</button>
            </div>

            {pendingReports.map(report => (
              <div key={report.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between shadow-sm">
                <div>
                  <h4 className="text-sm font-bold text-slate-700">{report.childName} ちゃん</h4>
                  <p className="text-[10px] text-slate-400">{report.date} ・ {report.time}</p>
                </div>
                <button className="bg-pink-500 text-white text-[10px] font-bold px-4 py-2 rounded-lg hover:bg-pink-600 transition-colors flex items-center gap-1">
                  作成
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-8 pb-10">
            <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-pink-500"></div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                  <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200&h=200" alt="Profile" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-800">小林 亜希</h3>
                  <p className="text-xs font-bold text-pink-500 bg-pink-50 px-2 py-0.5 rounded-md inline-block">保育士 / 言語聴覚士 (ST)</p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="text-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter leading-none">評価</p>
                      <p className="text-sm font-black text-slate-700">4.9</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter leading-none">実績</p>
                      <p className="text-sm font-black text-slate-700">42件</p>
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
                    <li className="text-[10px] text-emerald-600 flex items-center gap-1 font-bold">
                      <CheckCircle2 className="w-3 h-3" /> 東京都ベビーシッター利用支援事業 研修修了済み
                    </li>
                    <li className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3 h-3 text-slate-300" /> 第一種衛生管理者
                    </li>
                  </ul>
                </div>

                <div className="space-y-2">
                   <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">シッター自己紹介</h4>
                   <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                     お子様の「発語」を促す遊びを取り入れたシッティングが得意です。言語訓練のアドバイスも可能です。
                   </p>
                </div>
              </div>

              <button className="w-full mt-6 bg-slate-900 text-white font-bold py-3.5 rounded-2xl shadow-xl shadow-slate-200 flex items-center justify-center gap-2 hover:bg-slate-800 transition-all">
                プロフィールの編集
              </button>
            </section>
          </div>
        )}
      </main>

      {/* モバイル用ボトムナビゲーション */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'dashboard' ? 'text-pink-500' : 'text-slate-400'}`}
        >
          <LayoutDashboard className="w-6 h-6" />
          <span className="text-[10px] font-bold">ホーム</span>
        </button>
        <button 
          onClick={() => setActiveTab('schedule')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'schedule' ? 'text-pink-500' : 'text-slate-400'}`}
        >
          <CalendarIcon className="w-6 h-6" />
          <span className="text-[10px] font-bold">予定</span>
        </button>
        <button 
          onClick={() => setActiveTab('reports')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'reports' ? 'text-pink-500' : 'text-slate-400'} relative`}
        >
          <FileText className="w-6 h-6" />
          {pendingReports.length > 0 && (
            <span className="absolute top-0 right-0 w-2 h-2 bg-pink-500 rounded-full border-2 border-white"></span>
          )}
          <span className="text-[10px] font-bold">報告書</span>
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'profile' ? 'text-pink-500' : 'text-slate-400'}`}
        >
          <UserCircle className="w-6 h-6" />
          <span className="text-[10px] font-bold">マイページ</span>
        </button>
      </nav>
    </div>
  );
};

export default SitterStaffUI;