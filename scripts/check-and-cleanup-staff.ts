/**
 * スタッフデータの重複をチェックして整理
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ukjkltiafitpnqfoahhl.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVramtsdGlhZml0cG5xZm9haGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTc4NTUsImV4cCI6MjA4MzQ5Mzg1NX0.2vbMDE2CCr3hA111KmsTf6dBsBb_mm1vzJB29MsLasU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAndCleanupStaff() {
  console.log('🔍 スタッフデータの重複をチェック中...');
  
  const facilityId = 'dev-facility-test';
  
  // スタッフデータを取得
  const { data: staffData, error: fetchError } = await supabase
    .from('staff')
    .select('*')
    .eq('facility_id', facilityId)
    .order('created_at', { ascending: true });
  
  if (fetchError) {
    console.error('❌ スタッフデータの取得エラー:', fetchError);
    return;
  }
  
  if (!staffData || staffData.length === 0) {
    console.log('⚠️  スタッフデータがありません');
    return;
  }
  
  console.log(`📋 現在のスタッフ数: ${staffData.length}名`);
  
  // IDの重複をチェック
  const idCounts: Record<string, number> = {};
  staffData.forEach((staff) => {
    idCounts[staff.id] = (idCounts[staff.id] || 0) + 1;
  });
  
  const duplicateIds: string[] = [];
  Object.keys(idCounts).forEach(id => {
    if (idCounts[id] > 1) {
      duplicateIds.push(id);
    }
  });
  
  if (duplicateIds.length > 0) {
    console.log('❌ 同じIDが複数存在します（データベースエラー）:', duplicateIds);
  } else {
    console.log('✅ IDの重複なし');
  }
  
  // 名前とメールアドレスで重複をチェック
  const nameEmailMap: Record<string, string[]> = {};
  const duplicates: string[] = [];
  
  staffData.forEach((staff) => {
    const key = `${staff.name}_${staff.email || ''}`;
    if (!nameEmailMap[key]) {
      nameEmailMap[key] = [];
    }
    nameEmailMap[key].push(staff.id);
    
    if (nameEmailMap[key].length > 1 && !duplicates.includes(key)) {
      duplicates.push(key);
    }
  });
  
  if (duplicates.length > 0) {
    console.log('\n⚠️  重複しているスタッフが見つかりました:');
    duplicates.forEach(key => {
      const ids = nameEmailMap[key];
      const staff = staffData.find(s => s.id === ids[0]);
      console.log(`  - ${key}: ${ids.length}件`);
      console.log(`    ID: ${ids.join(', ')}`);
      if (staff) {
        console.log(`    名前: ${staff.name}, メール: ${staff.email || 'なし'}, 作成日: ${staff.created_at}`);
      }
    });
  } else {
    console.log('✅ 名前とメールアドレスでの重複なし');
  }
  
  // ユニークなスタッフを取得（同じIDは1つだけ）
  const uniqueStaffMap = new Map<string, any>();
  staffData.forEach((staff) => {
    if (!uniqueStaffMap.has(staff.id)) {
      uniqueStaffMap.set(staff.id, staff);
    }
  });
  
  const uniqueStaff = Array.from(uniqueStaffMap.values());
  
  console.log(`\n📊 ユニークなスタッフ数: ${uniqueStaff.length}名`);
  
  // 名前で重複しているスタッフを整理（最初の1つを残して、残りを削除）
  const nameMap = new Map<string, any[]>();
  uniqueStaff.forEach((staff) => {
    const name = staff.name || '';
    if (!nameMap.has(name)) {
      nameMap.set(name, []);
    }
    nameMap.get(name)!.push(staff);
  });
  
  const staffToDelete: string[] = [];
  const staffToKeep: string[] = [];
  
  nameMap.forEach((staffs, name) => {
    if (staffs.length > 1) {
      // 名前が重複している場合、最初の1つを残して、残りを削除対象にする
      // 作成日が古い順にソート
      const sorted = staffs.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateA - dateB;
      });
      
      staffToKeep.push(sorted[0].id);
      for (let i = 1; i < sorted.length; i++) {
        staffToDelete.push(sorted[i].id);
      }
      
      console.log(`⚠️  "${name}" が ${staffs.length}件存在します。最初の1件を保持し、残りを削除します。`);
    } else {
      staffToKeep.push(staffs[0].id);
    }
  });
  
  // 合計で10名を超える場合は、作成日が古い順に10名を保持
  if (staffToKeep.length > 10) {
    const keepStaffs = uniqueStaff
      .filter(s => staffToKeep.includes(s.id))
      .sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateA - dateB;
      });
    
    const finalKeepIds = keepStaffs.slice(0, 10).map(s => s.id);
    const additionalDeleteIds = keepStaffs.slice(10).map(s => s.id);
    
    staffToDelete.push(...additionalDeleteIds);
    staffToKeep.splice(0, staffToKeep.length, ...finalKeepIds);
    
    console.log(`\n⚠️  スタッフ数が10名を超えています。最初の10名を保持し、残りを削除します。`);
  }
  
  console.log(`\n✅ 保持するスタッフ: ${staffToKeep.length}名`);
  console.log(`🗑️  削除するスタッフ: ${staffToDelete.length}名`);
  
  if (staffToDelete.length > 0) {
    console.log('\n🗑️  関連データを削除中...');
    
    // employment_recordsを削除
    const { error: empError } = await supabase
      .from('employment_records')
      .delete()
      .in('user_id', staffToDelete);
    
    if (empError) {
      console.error('⚠️  employment_recordsの削除エラー:', empError);
    } else {
      console.log('✅ employment_recordsを削除しました');
    }
    
    // shiftsを削除
    const { error: shiftError } = await supabase
      .from('shifts')
      .delete()
      .in('staff_id', staffToDelete);
    
    if (shiftError) {
      console.error('⚠️  shiftsの削除エラー:', shiftError);
    } else {
      console.log('✅ shiftsを削除しました');
    }
    
    // スタッフを削除
    const { error: deleteError } = await supabase
      .from('staff')
      .delete()
      .in('id', staffToDelete);
    
    if (deleteError) {
      console.error('❌ スタッフの削除エラー:', deleteError);
      return;
    }
    
    console.log(`\n✅ ${staffToDelete.length}名のスタッフを削除しました`);
  }
  
  // 最終的なスタッフ数を確認
  const { data: finalStaff, error: finalError } = await supabase
    .from('staff')
    .select('id, name, email, role, type, created_at')
    .eq('facility_id', facilityId)
    .order('created_at', { ascending: true });
  
  if (!finalError && finalStaff) {
    console.log(`\n📊 最終的なスタッフ数: ${finalStaff.length}名`);
    console.log('\nスタッフ一覧:');
    finalStaff.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.name} (${s.role}, ${s.type}) - メール: ${s.email || 'なし'} - ID: ${s.id}`);
    });
    
    // 名前の重複を再確認
    const finalNameMap = new Map<string, number>();
    finalStaff.forEach(s => {
      const name = s.name || '';
      finalNameMap.set(name, (finalNameMap.get(name) || 0) + 1);
    });
    
    const finalDuplicates: string[] = [];
    finalNameMap.forEach((count, name) => {
      if (count > 1) {
        finalDuplicates.push(name);
      }
    });
    
    if (finalDuplicates.length > 0) {
      console.log(`\n⚠️  最終的な名前の重複: ${finalDuplicates.join(', ')}`);
    } else {
      console.log('\n✅ 最終的な名前の重複なし（すべてユニーク）');
    }
  }
}

checkAndCleanupStaff();

