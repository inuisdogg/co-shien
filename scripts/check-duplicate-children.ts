/**
 * 児童データの重複をチェックして整理
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ukjkltiafitpnqfoahhl.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVramtsdGlhZml0cG5xZm9haGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTc4NTUsImV4cCI6MjA4MzQ5Mzg1NX0.2vbMDE2CCr3hA111KmsTf6dBsBb_mm1vzJB29MsLasU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAndCleanDuplicateChildren() {
  console.log('🔍 児童データの重複をチェック中...');
  
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
  
  console.log(`📋 現在の児童数: ${childrenData.length}名`);
  
  // 重複をチェック（名前と生年月日で判定）
  const nameDateMap: Record<string, string[]> = {};
  const duplicates: string[] = [];
  
  childrenData.forEach((child) => {
    const key = `${child.name}_${child.birth_date || ''}`;
    if (!nameDateMap[key]) {
      nameDateMap[key] = [];
    }
    nameDateMap[key].push(child.id);
    
    if (nameDateMap[key].length > 1 && !duplicates.includes(key)) {
      duplicates.push(key);
    }
  });
  
  if (duplicates.length > 0) {
    console.log('⚠️  重複している児童が見つかりました:');
    duplicates.forEach(key => {
      const ids = nameDateMap[key];
      console.log(`  - ${key}: ${ids.length}件 (ID: ${ids.join(', ')})`);
    });
  }
  
  // 同じIDが複数ある場合（IDでの重複）
  const idCounts: Record<string, number> = {};
  childrenData.forEach((child) => {
    idCounts[child.id] = (idCounts[child.id] || 0) + 1;
  });
  
  const duplicateIds: string[] = [];
  Object.keys(idCounts).forEach(id => {
    if (idCounts[id] > 1) {
      duplicateIds.push(id);
    }
  });
  
  if (duplicateIds.length > 0) {
    console.log('❌ 同じIDが複数存在します（データベースエラー）:', duplicateIds);
  }
  
  // 最初の10名を保持して、残りを削除（重複を除く）
  const uniqueChildrenMap = new Map<string, any>();
  childrenData.forEach((child) => {
    if (!uniqueChildrenMap.has(child.id)) {
      uniqueChildrenMap.set(child.id, child);
    }
  });
  
  const uniqueChildren = Array.from(uniqueChildrenMap.values());
  
  if (uniqueChildren.length > 10) {
    // 作成日が古い順にソートして、最初の10名を保持
    const sortedChildren = uniqueChildren.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateA - dateB;
    });
    
    const childrenToKeep = sortedChildren.slice(0, 10);
    const childrenToDelete = sortedChildren.slice(10);
    
    console.log(`✅ 保持する児童: ${childrenToKeep.length}名`);
    console.log(`🗑️  削除する児童: ${childrenToDelete.length}名`);
    
    if (childrenToDelete.length > 0) {
      const idsToDelete = childrenToDelete.map(c => c.id);
      
      // 関連データを削除
      console.log('🗑️  関連データを削除中...');
      
      // schedulesを削除
      const { error: scheduleError } = await supabase
        .from('schedules')
        .delete()
        .in('child_id', idsToDelete);
      
      if (scheduleError) {
        console.error('⚠️  schedulesの削除エラー:', scheduleError);
      }
      
      // usage_recordsを削除
      const { error: usageError } = await supabase
        .from('usage_records')
        .delete()
        .in('child_id', idsToDelete);
      
      if (usageError) {
        console.error('⚠️  usage_recordsの削除エラー:', usageError);
      }
      
      // leadsのchildIdsから削除
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('id, child_ids')
        .eq('facility_id', facilityId);
      
      if (!leadsError && leadsData) {
        for (const lead of leadsData) {
          if (lead.child_ids && Array.isArray(lead.child_ids)) {
            const updatedChildIds = lead.child_ids.filter((id: string) => !idsToDelete.includes(id));
            if (updatedChildIds.length !== lead.child_ids.length) {
              await supabase
                .from('leads')
                .update({ child_ids: updatedChildIds })
                .eq('id', lead.id);
            }
          }
        }
      }
      
      // 児童を削除
      const { error: deleteError } = await supabase
        .from('children')
        .delete()
        .in('id', idsToDelete);
      
      if (deleteError) {
        console.error('❌ 児童の削除エラー:', deleteError);
        return;
      }
      
      console.log(`✅ ${childrenToDelete.length}名の児童を削除しました`);
    }
  }
  
  // 最終的な児童数を確認
  const { data: finalChildren, error: finalError } = await supabase
    .from('children')
    .select('id, name, birth_date, created_at')
    .eq('facility_id', facilityId)
    .order('created_at', { ascending: true });
  
  if (!finalError && finalChildren) {
    console.log(`\n📊 最終的な児童数: ${finalChildren.length}名`);
    console.log('児童一覧:');
    finalChildren.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.name} (生年月日: ${c.birth_date || '未設定'}, ID: ${c.id})`);
    });
  }
}

checkAndCleanDuplicateChildren();

