import React, { useState } from 'react';
import { Search, Filter, MessageCircle, Video, Star, CheckCircle, ChevronRight, MapPin, Clock, Calendar } from 'lucide-react';

const ExpertClientUI = () => {
  const [selectedCategory, setSelectedCategory] = useState('すべて');

  // モックデータ: 専門職リスト
  const experts = [
    {
      id: 1,
      name: "佐藤 美咲",
      title: "言語聴覚士 (ST)",
      rating: 4.9,
      reviews: 124,
      tags: ["発語遅滞", "構音障害", "嚥下指導"],
      messagePrice: 2000,
      videoPrice: 5000,
      description: "10年以上の臨床経験に基づき、お子様の発語やコミュニケーションの悩みに寄り添います。家庭でできるトレーニングを重視しています。",
      online: true,
      image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200&h=200"
    },
    {
      id: 2,
      name: "高橋 健太",
      title: "理学療法士 (PT)",
      rating: 4.8,
      reviews: 89,
      tags: ["運動発達", "姿勢矯正", "脳性麻痺"],
      messagePrice: 1500,
      videoPrice: 4500,
      description: "遊びを取り入れたリハビリテーションが得意です。お子様の「動きたい」という意欲を引き出すアプローチを提案します。",
      online: false,
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200&h=200"
    },
    {
      id: 3,
      name: "田中 裕子",
      title: "作業療法士 (OT)",
      rating: 5.0,
      reviews: 56,
      tags: ["感覚統合", "ADHD", "手先の器用さ"],
      messagePrice: 2000,
      videoPrice: 6000,
      description: "生活の中での「困りごと」を解決するお手伝いをします。感覚の過敏さや集中力でお悩みの方はぜひご相談ください。",
      online: true,
      image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=200&h=200"
    }
  ];

  const categories = ['すべて', '言語 (ST)', '運動 (PT)', '生活 (OT)', '心理・行動', '食事'];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* 共通ヘッダー（Client領域のオレンジではなく、Expertへの入り口としてクリーンに） */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Star className="text-white w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-800">co-shien <span className="text-emerald-600">Expert</span></h1>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#" className="text-emerald-600 border-b-2 border-emerald-500 pb-1">専門家を探す</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">相談履歴</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">お気に入り</a>
          </nav>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
              <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=100&h=100&auto=format&fit=crop" alt="User" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* ヒーローセクション */}
        <section className="mb-8 bg-white rounded-2xl p-6 md:p-10 border border-emerald-100 shadow-sm overflow-hidden relative">
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 mb-3 leading-tight">
              お子さまの「育ち」の悩みを、<br />
              <span className="text-emerald-600">プロフェッショナル</span>に相談。
            </h2>
            <p className="text-slate-600 text-sm md:text-base mb-6 leading-relaxed">
              全国のPT・OT・STや心理士が、あなたの育児をオンラインでサポートします。
              まずはメッセージ1通から、気軽に専門的なアドバイスを受け取りましょう。
            </p>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="悩みや資格名で検索（例：発語、ADHD、ST）" 
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                />
              </div>
              <button className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md shadow-emerald-200 flex items-center justify-center gap-2">
                検索する
              </button>
            </div>
          </div>
          {/* 背景の装飾的な円 */}
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-emerald-50 rounded-full opacity-50 blur-3xl"></div>
        </section>

        {/* カテゴリフィルター */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide">
          <button className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
            <Filter className="w-5 h-5" />
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
                selectedCategory === cat
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 専門職カードグリッド */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
          {experts.map((expert) => (
            <div key={expert.id} className="group bg-white rounded-2xl border border-slate-200 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300 overflow-hidden flex flex-col">
              <div className="p-5 flex-1">
                <div className="flex gap-4 mb-4">
                  <div className="relative">
                    <img 
                      src={expert.image} 
                      alt={expert.name} 
                      className="w-16 h-16 rounded-2xl object-cover ring-2 ring-slate-100"
                    />
                    {expert.online && (
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-0.5">
                      <h3 className="font-bold text-slate-800 tracking-tight">{expert.name}</h3>
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 fill-emerald-50" />
                    </div>
                    <p className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded inline-block">
                      {expert.title}
                    </p>
                    <div className="flex items-center gap-1 mt-1 text-amber-500">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span className="text-xs font-bold text-slate-700">{expert.rating}</span>
                      <span className="text-[10px] text-slate-400 font-medium">({expert.reviews})</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {expert.tags.map(tag => (
                    <span key={tag} className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                      #{tag}
                    </span>
                  ))}
                </div>

                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-4">
                  {expert.description}
                </p>

                <div className="grid grid-cols-2 gap-2 mt-auto">
                  <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold mb-0.5">メッセージ相談</p>
                    <p className="text-sm font-extrabold text-slate-700">¥{expert.messagePrice.toLocaleString()}<span className="text-[10px] font-normal ml-0.5">/回</span></p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold mb-0.5">ビデオ通話</p>
                    <p className="text-sm font-extrabold text-slate-700">¥{expert.videoPrice.toLocaleString()}<span className="text-[10px] font-normal ml-0.5">/30分</span></p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <button className="text-xs font-bold text-slate-500 hover:text-emerald-600 flex items-center gap-1 group/link">
                  プロフィール詳細
                  <ChevronRight className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform" />
                </button>
                <button className="bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-emerald-600 transition-colors flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5" />
                  相談する
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 下部通知エリア（信頼性向上） */}
        <div className="mt-12 bg-slate-900 rounded-2xl p-8 text-white relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold mb-2">専門家として登録を希望される方へ</h3>
              <p className="text-slate-400 text-sm max-w-lg">
                PT・OT・ST、臨床心理士など、あなたの専門知識を必要としている家族がいます。
                スキマ時間を活用して、リモートで支援を届けませんか？
              </p>
            </div>
            <button className="whitespace-nowrap bg-white text-slate-900 font-bold py-3 px-8 rounded-xl hover:bg-emerald-50 transition-colors">
              Expertとして登録する
            </button>
          </div>
          {/* 装飾 */}
          <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        </div>
      </main>

      {/* モバイル用ボトムナビ（アプリ意識） */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50">
        <button className="flex flex-col items-center gap-1 text-emerald-600">
          <Search className="w-6 h-6" />
          <span className="text-[10px] font-bold">探す</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <Calendar className="w-6 h-6" />
          <span className="text-[10px] font-bold">予約</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <MessageCircle className="w-6 h-6" />
          <span className="text-[10px] font-bold">チャット</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <Star className="w-6 h-6" />
          <span className="text-[10px] font-bold">保存</span>
        </button>
      </div>
    </div>
  );
};

export default ExpertClientUI;