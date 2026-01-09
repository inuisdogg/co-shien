/**
 * 既存の児童データの名前を姓名形式に更新
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ukjkltiafitpnqfoahhl.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVramtsdGlhZml0cG5xZm9haGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTc4NTUsImV4cCI6MjA4MzQ5Mzg1NX0.2vbMDE2CCr3hA111KmsTf6dBsBb_mm1vzJB29MsLasU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function updateChildrenNames() {
  console.log('🔄 児童データの名前を姓名形式に更新中...');
  
  const facilityId = 'dev-facility-test';
  
  // 児童データを取得
  const { data: childrenData, error: fetchError } = await supabase
    .from('children')
    .select('*')
    .eq('facility_id', facilityId)
    .order('created_at', { ascending: true });
  
  if (fetchError) {
    console.error('❌ 児童データの取得エラー:', fetchError);
    return;
  }
  
  if (!childrenData || childrenData.length === 0) {
    console.log('⚠️  児童データがありません');
    return;
  }
  
  console.log(`📋 児童数: ${childrenData.length}名`);
  
  // 姓名のマッピング（既存の下の名前から姓名に変換）
  const nameMapping: Record<string, { fullName: string; fullNameKana: string }> = {
    '健太': { fullName: '山田 健太', fullNameKana: 'ヤマダ ケンタ' },
    'さくら': { fullName: '佐藤 さくら', fullNameKana: 'サトウ サクラ' },
    '大輔': { fullName: '鈴木 大輔', fullNameKana: 'スズキ ダイスケ' },
    '美咲': { fullName: '高橋 美咲', fullNameKana: 'タカハシ ミサキ' },
    '翔太': { fullName: '田中 翔太', fullNameKana: 'タナカ ショウタ' },
    'あかり': { fullName: '伊藤 あかり', fullNameKana: 'イトウ アカリ' },
    '優太': { fullName: '渡辺 優太', fullNameKana: 'ワタナベ ユウタ' },
    'みお': { fullName: '中村 みお', fullNameKana: 'ナカムラ ミオ' },
    '蓮': { fullName: '小林 蓮', fullNameKana: 'コバヤシ レン' },
    'ひなた': { fullName: '加藤 ひなた', fullNameKana: 'カトウ ヒナタ' },
  };
  
  // 各児童の名前を更新
  for (const child of childrenData) {
    const currentName = child.name || '';
    const mapping = nameMapping[currentName];
    
    if (mapping && currentName !== mapping.fullName) {
      console.log(`  ${currentName} → ${mapping.fullName}`);
      
      const { error: updateError } = await supabase
        .from('children')
        .update({
          name: mapping.fullName,
          name_kana: mapping.fullNameKana,
          updated_at: new Date().toISOString(),
        })
        .eq('id', child.id);
      
      if (updateError) {
        console.error(`  ❌ ${child.id}の更新エラー:`, updateError);
      } else {
        console.log(`  ✅ ${child.id}を更新しました`);
      }
    } else if (!mapping) {
      console.log(`  ⚠️  ${currentName}のマッピングが見つかりません`);
    }
  }
  
  console.log('\n✅ 児童データの名前更新が完了しました');
  
  // 最終的な児童データを確認
  const { data: finalChildren, error: finalError } = await supabase
    .from('children')
    .select('id, name, name_kana')
    .eq('facility_id', facilityId)
    .order('created_at', { ascending: true });
  
  if (!finalError && finalChildren) {
    console.log('\n📊 更新後の児童一覧:');
    finalChildren.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.name} (${c.name_kana || 'フリガナなし'})`);
    });
  }
}

updateChildrenNames();

