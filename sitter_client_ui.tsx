import React, { useState } from 'react';
import { 
  Search, 
  Heart, 
  ShieldCheck, 
  MapPin, 
  Star, 
  ChevronRight, 
  Baby, 
  Info,
  Filter,
  Calendar,
  MessageCircle,
  Clock
} from 'lucide-react';

const SitterClientUI = () => {
  const [selectedFilter, setSelectedFilter] = useState('すべて');

  // モックデータ: シッターリスト
  const sitters = [
    {
      id: 1,
      name: "小林 亜希",
      role: "保育士 / 言語聴覚士 (ST)",
      rating: 4.9,
      reviews: 42,
      hourlyRate: 3500,
      subsidyRate: 2500, // 東京都補助額
      tags: ["東京都助成対象", "発達相談可", "ダウン症児対応"],
      image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200&h=200",
      description: "お子様の「発語」を促す遊びを取り入れたシッティングが得意です。預かりながら言語訓練のアドバイスも可能です。",
      isExpert: true
    },
    {
      id: 2,
      name: "伊藤 結衣",
      role: "認定ベビーシッター / 理学療法士 (PT)",
      rating: 4.8,
      reviews: 28,
      hourlyRate: 3800,
      subsidyRate: 2500,
      tags: ["東京都助成対象", "運動発達支援", "リハビリ対応"],
      image: "https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?auto=format&fit=crop&q=80&w=200&h=200",
      description: "身体を動かす遊びを通じて、粗大運動の発達をサポートします。車椅子をご利用のお子様も安心してお任せください。",
      isExpert: true
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      {/* 補助金インフォメーション */}
      <div className="bg-pink-500 text-white px-4 py-2 text-[10px] md:text-xs font-bold text-center flex items-center justify-center gap-2">
        <ShieldCheck className="w-3 h-3 md:w-4 h-4" />
        東京都ベビーシッター利用支援事業（一時預かり）認定サービス：最大1時間2,500円補助
      </div>

      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-pink-100 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-pink-200">
              <Baby className="text-white w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-800">co-shien <span className="text-pink-500">Sitter</span></h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-slate-400 hover:text-pink-500 transition-colors">
              <Heart className="w-6 h-6" />
            </button>
            <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 overflow-hidden">
               <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=100&h=100&auto=format&fit=crop" alt="User" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* 検索・フィルターセクション */}
        <section className="mb-8">
          <h2 className="text-xl font-extrabold text-slate-800 mb-4 flex items-center gap-2">
            専門家と過ごす、<br className="md:hidden" />安心のシッティング。
          </h2>
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="地域、資格、対応可能な悩みで検索" 
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-slate-200 shadow-sm focus:ring-2 focus:ring-pink-500/20 focus:border-pink-400 outline-none transition-all text-sm"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {['すべて', 'ST (言語)', 'PT (運動)', 'OT (生活)', '保育士', '看護師'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedFilter(cat)}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-xs font-bold transition-all border ${
                  selectedFilter === cat
                  ? 'bg-pink-500 text-white border-pink-500 shadow-md shadow-pink-100'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-pink-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* 補助金シミュレーションカード */}
        <div className="bg-gradient-to-br from-pink-400 to-pink-500 rounded-2xl p-5 text-white mb-8 shadow-xl shadow-pink-200 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-sm font-bold opacity-90 mb-1">実質負担額の目安</h3>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-3xl font-black">¥1,000</span>
              <span className="text-xs font-bold">/時間 〜</span>
            </div>
            <p className="text-[10px] leading-relaxed opacity-80 max-w-xs">
              東京都の補助（2,500円/h）を適用した場合の、一般的な専門職シッターの自己負担額です。
            </p>
          </div>
          <ShieldCheck className="absolute right-[-10px] bottom-[-10px] w-32 h-32 opacity-10 rotate-12" />
        </div>

        {/* シッターリスト */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-700">おすすめのシッター</h3>
            <button className="flex items-center gap-1 text-xs font-bold text-pink-500">
              <Filter className="w-3 h-3" />
              条件変更
            </button>
          </div>

          {sitters.map(sitter => (
            <div key={sitter.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-pink-200 hover:shadow-lg transition-all">
              <div className="p-4 flex gap-4">
                <div className="relative shrink-0">
                  <img src={sitter.image} alt={sitter.name} className="w-20 h-20 rounded-2xl object-cover" />
                  {sitter.isExpert && (
                    <span className="absolute -top-2 -left-2 bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full border-2 border-white uppercase">
                      Expert
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <h4 className="font-bold text-slate-800">{sitter.name}</h4>
                      <p className="text-[10px] font-bold text-pink-500">{sitter.role}</p>
                    </div>
                    <div className="flex items-center gap-0.5 text-amber-500">
                      <Star className="w-3 h-3 fill-current" />
                      <span className="text-xs font-bold text-slate-700">{sitter.rating}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mb-2">
                    {sitter.tags.map(tag => (
                      <span key={tag} className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                        tag.includes('助成') ? 'bg-pink-50 text-pink-600 border border-pink-100' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                    {sitter.description}
                  </p>
                </div>
              </div>

              <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px] text-slate-400 font-bold">実質負担</span>
                    <span className="text-sm font-black text-slate-800">¥{(sitter.hourlyRate - sitter.subsidyRate).toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400">/h</span>
                  </div>
                  <p className="text-[8px] text-slate-400">(通常単価: ¥{sitter.hourlyRate.toLocaleString()})</p>
                </div>
                <div className="flex gap-2">
                  <button className="bg-white border border-slate-200 text-slate-600 p-2 rounded-xl hover:bg-slate-50">
                    <Calendar className="w-4 h-4" />
                  </button>
                  <button className="bg-pink-500 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-pink-600 shadow-md shadow-pink-100 transition-all flex items-center gap-1.5">
                    詳細・予約
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 専門職シッターのメリット説明 */}
        <div className="mt-12 bg-white rounded-2xl border border-pink-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-pink-50 rounded-lg text-pink-500">
              <Info className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800">なぜ「専門職シッター」なのか？</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-pink-600">01. 預かりながら療育</h4>
              <p className="text-[10px] text-slate-500 leading-relaxed">ただの預かりではなく、PT/OT/STが遊びを通じて発達を促します。</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-pink-600">02. 育児の悩みを相談</h4>
              <p className="text-[10px] text-slate-500 leading-relaxed">「言葉が遅いかも」などの不安を、その場でプロに直接相談できます。</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-pink-600">03. 補助金で賢く利用</h4>
              <p className="text-[10px] text-slate-500 leading-relaxed">東京都の認定サービスだから、高単価な専門職も低負担で呼べます。</p>
            </div>
          </div>
        </div>
      </main>

      {/* モバイルボトムナビ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50">
        <button className="flex flex-col items-center gap-1 text-pink-500">
          <Search className="w-6 h-6" />
          <span className="text-[10px] font-bold">探す</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <Calendar className="w-6 h-6" />
          <span className="text-[10px] font-bold">予約</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400 relative">
          <MessageCircle className="w-6 h-6" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-pink-500 rounded-full border-2 border-white"></span>
          <span className="text-[10px] font-bold">連絡</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <Clock className="w-6 h-6" />
          <span className="text-[10px] font-bold">履歴</span>
        </button>
      </nav>
    </div>
  );
};

export default SitterClientUI;