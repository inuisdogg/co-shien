import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  UserCircle, 
  BookOpen, 
  Settings, 
  MessageSquare, 
  Video, 
  Image as ImageIcon, 
  TrendingUp, 
  Plus, 
  Eye, 
  Save,
  CheckCircle,
  MoreVertical,
  Star
} from 'lucide-react';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  // モックデータ: 統計
  const stats = [
    { label: "今月の売上", value: "¥124,500", trend: "+12%", icon: TrendingUp },
    { label: "相談件数", value: "48件", trend: "+5%", icon: MessageSquare },
    { label: "平均評価", value: "4.9", trend: "0.1", icon: Star },
    { label: "プロフィール閲覧", value: "1,204回", trend: "+24%", icon: Eye },
  ];

  // モックデータ: 記事リスト
  const blogPosts = [
    { id: 1, title: "【発語の悩み】お家でできる簡単トレーニング3選", status: "公開中", date: "2024.01.15", views: 423 },
    { id: 2, title: "イヤイヤ期のコミュニケーション、どう向き合う？", status: "公開中", date: "2024.01.10", views: 256 },
    { id: 3, title: "感覚統合から見る「偏食」のメカニズム", status: "下書き", date: "2024.01.18", views: 0 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* サイドバー */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-md shadow-emerald-200">
              <Star className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">co-shien <span className="text-emerald-600">Expert</span></span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
            { id: 'profile', label: 'プロフィール編集', icon: UserCircle },
            { id: 'blog', label: 'コラム・ブログ投稿', icon: BookOpen },
            { id: 'consultations', label: '相談管理', icon: MessageSquare },
            { id: 'settings', label: '価格・各種設定', icon: Settings },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                activeTab === item.id 
                ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-900 rounded-xl p-4 text-white text-xs">
            <p className="font-bold mb-1">現在のプラン: Pro</p>
            <p className="text-slate-400 mb-3">紹介料手数料: 15%</p>
            <button className="w-full bg-emerald-500 hover:bg-emerald-600 py-2 rounded-lg font-bold transition-colors">
              プラン詳細
            </button>
          </div>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <h2 className="font-bold text-slate-700">
            {activeTab === 'dashboard' && 'ダッシュボード'}
            {activeTab === 'profile' && 'プロフィール編集'}
            {activeTab === 'blog' && 'コラム・ブログ投稿'}
            {activeTab === 'settings' && '価格・各種設定'}
          </h2>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100">
              <Eye className="w-4 h-4" />
              公開ページを確認
            </button>
            <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-200 overflow-hidden">
               <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=100&h=100" alt="Specialist" />
            </div>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* 統計カード */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-slate-50 rounded-lg text-emerald-600">
                        <stat.icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {stat.trend}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs font-bold mb-1 uppercase tracking-wider">{stat.label}</p>
                    <h3 className="text-2xl font-extrabold text-slate-800">{stat.value}</h3>
                  </div>
                ))}
              </div>

              {/* 最近の相談と記事 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">最新のコラム</h3>
                    <button className="text-xs font-bold text-emerald-600 hover:underline">すべて見る</button>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {blogPosts.map(post => (
                      <div key={post.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer">
                        <div>
                          <p className="text-sm font-bold text-slate-700 mb-1">{post.title}</p>
                          <div className="flex items-center gap-3">
                             <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${post.status === '公開中' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                              {post.status}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">{post.date}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <Eye className="w-3.5 h-3.5" />
                          <span className="text-xs">{post.views}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h3 className="font-bold text-slate-800 mb-6">対応状況</h3>
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-bold text-slate-600">メッセージ受付中</span>
                      </div>
                      <div className="w-12 h-6 bg-emerald-500 rounded-full relative">
                        <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center opacity-50">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
                        <span className="text-sm font-bold text-slate-600">ビデオ通話（離席中）</span>
                      </div>
                      <div className="w-12 h-6 bg-slate-200 rounded-full relative">
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="max-w-4xl space-y-8">
              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="h-32 bg-gradient-to-r from-emerald-400 to-cyan-500 relative">
                  <button className="absolute right-4 bottom-4 bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg backdrop-blur-md transition-all">
                    <ImageIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="px-8 pb-8">
                  <div className="flex items-end gap-6 -mt-10 mb-8">
                    <div className="relative group cursor-pointer">
                      <img 
                        src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200&h=200" 
                        alt="Profile" 
                        className="w-24 h-24 rounded-2xl object-cover ring-4 ring-white shadow-lg"
                      />
                      <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <ImageIcon className="text-white w-6 h-6" />
                      </div>
                    </div>
                    <div className="flex-1 pb-2">
                      <h3 className="text-xl font-extrabold text-slate-800">佐藤 美咲</h3>
                      <p className="text-sm text-slate-500 font-medium">言語聴覚士 (ST) | 療育歴10年</p>
                    </div>
                    <button className="bg-emerald-500 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all flex items-center gap-2 mb-2">
                      <Save className="w-4 h-4" />
                      保存する
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">キャッチコピー（占い師のように印象的に！）</label>
                        <input 
                          type="text" 
                          defaultValue="子どもの『伝えたい』という意欲を、プロの技術で引き出します。"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">自己紹介・経歴</label>
                        <textarea
                          rows={6}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm text-slate-600 leading-relaxed"
                          defaultValue="大学卒業後、総合病院のリハビリテーション科に勤務。その後、発達支援センターにて延べ1000人以上のお子様と向き合ってきました。STとしての知見だけでなく、一人の親としての視点も大切にしています。"
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">得意な悩み・スキルタグ</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {['発語遅滞', '構音障害', '嚥下指導', '吃音'].map(tag => (
                            <span key={tag} className="bg-emerald-50 text-emerald-600 text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-100 flex items-center gap-2">
                              {tag}
                              <button className="hover:text-red-400">×</button>
                            </span>
                          ))}
                          <button className="text-xs font-bold text-slate-400 border border-dashed border-slate-300 px-3 py-1.5 rounded-lg hover:border-emerald-300 hover:text-emerald-500 flex items-center gap-1 transition-all">
                            <Plus className="w-3 h-3" /> 追加
                          </button>
                        </div>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                         <div className="flex items-center gap-3 mb-4">
                           <ImageIcon className="w-5 h-5 text-slate-400" />
                           <h4 className="text-sm font-bold text-slate-700">ギャラリー・ビジュアル登録</h4>
                         </div>
                         <div className="grid grid-cols-3 gap-2">
                           <div className="aspect-square bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-300 hover:text-emerald-400 hover:border-emerald-200 cursor-pointer transition-all">
                             <Plus className="w-6 h-6" />
                           </div>
                           {[1, 2].map(i => (
                             <div key={i} className="aspect-square bg-slate-200 rounded-xl overflow-hidden group relative">
                               <img src={`https://images.unsplash.com/photo-1544717297-fa95b3ee91f3?auto=format&fit=crop&q=80&w=150&h=150&sig=${i}`} alt="Gallery" className="w-full h-full object-cover" />
                               <div className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                                 <span className="text-white text-[10px] font-bold">削除</span>
                               </div>
                             </div>
                           ))}
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'blog' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800">コラム管理</h3>
                <button className="bg-slate-900 text-white font-bold py-2.5 px-6 rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  新規記事を書く
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {blogPosts.map(post => (
                  <div key={post.id} className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center justify-between group hover:border-emerald-200 transition-all">
                    <div className="flex items-start gap-4">
                      <div className="w-24 h-16 bg-slate-100 rounded-lg overflow-hidden shrink-0">
                         <img src={`https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=100&h=100&sig=${post.id}`} alt="Thumb" className="w-full h-full object-cover opacity-60" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-700 mb-1 group-hover:text-emerald-600 transition-colors">{post.title}</h4>
                        <div className="flex items-center gap-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${post.status === '公開中' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            {post.status}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">{post.date}</span>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                            <Eye className="w-3 h-3" />
                            {post.views}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all">
                        <CheckCircle className="w-5 h-5" />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              <h3 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-3">
                <Settings className="w-6 h-6 text-emerald-500" />
                価格・サービス設定
              </h3>
              
              <div className="space-y-8">
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-700">メッセージ相談</h4>
                      <p className="text-xs text-slate-400">1往復あたりの単価（おすすめ: ¥1,500〜）</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-bold">¥</span>
                      <input type="number" defaultValue="2000" className="w-24 px-3 py-2 rounded-lg border border-slate-200 font-bold text-right outline-none focus:ring-2 focus:ring-emerald-500/20" />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-700">ビデオ通話 (30分)</h4>
                      <p className="text-xs text-slate-400">30分あたりの単価（おすすめ: ¥4,000〜）</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-bold">¥</span>
                      <input type="number" defaultValue="5000" className="w-24 px-3 py-2 rounded-lg border border-slate-200 font-bold text-right outline-none focus:ring-2 focus:ring-emerald-500/20" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-widest">銀行口座・入金</h4>
                  <div className="flex items-center justify-between p-4 border border-emerald-100 bg-emerald-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="text-emerald-500 w-5 h-5" />
                      <span className="text-sm font-bold text-emerald-800">Stripe Connect 連携済み</span>
                    </div>
                    <button className="text-xs font-bold text-emerald-600 hover:underline">管理画面を開く</button>
                  </div>
                </div>

                <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all">
                  設定を保存する
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;