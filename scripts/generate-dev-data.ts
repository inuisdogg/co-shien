/**
 * 開発環境用テストデータ生成スクリプト
 * 施設、スタッフ、利用児童、リード登録を生成
 * 
 * 使用方法:
 * npx tsx scripts/generate-dev-data.ts
 */

import { createClient } from '@supabase/supabase-js';

// 環境変数からSupabase設定を取得
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ukjkltiafitpnqfoahhl.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVramtsdGlhZml0cG5xZm9haGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTc4NTUsImV4cCI6MjA4MzQ5Mzg1NX0.2vbMDE2CCr3hA111KmsTf6dBsBb_mm1vzJB29MsLasU';

// 本番環境への誤実行を防ぐチェック
const PROD_SUPABASE_URL = 'iskgcqzozsemlmbvubna.supabase.co';
if (supabaseUrl.includes(PROD_SUPABASE_URL)) {
  console.error('❌ エラー: 本番環境のSupabase URLが検出されました！');
  console.error(`   検出されたURL: ${supabaseUrl}`);
  console.error('   このスクリプトは開発環境でのみ実行してください。');
  console.error('   環境変数 NEXT_PUBLIC_SUPABASE_URL を確認してください。');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ランダムな名前を生成
const lastNames = ['山田', '佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '中村', '小林', '加藤'];
const firstNames = ['太郎', '花子', '一郎', '次郎', '三郎', '美咲', 'さくら', '大輔', '健太', 'あかり'];
const lastNamesKana = ['ヤマダ', 'サトウ', 'スズキ', 'タカハシ', 'タナカ', 'イトウ', 'ワタナベ', 'ナカムラ', 'コバヤシ', 'カトウ'];
const firstNamesKana = ['タロウ', 'ハナコ', 'イチロウ', 'ジロウ', 'サブロウ', 'ミサキ', 'サクラ', 'ダイスケ', 'ケンタ', 'アカリ'];

// ランダムな値を取得
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateRandomName() {
  const lastName = getRandomItem(lastNames);
  const firstName = getRandomItem(firstNames);
  const lastNameKana = getRandomItem(lastNamesKana);
  const firstNameKana = getRandomItem(firstNamesKana);
  return { lastName, firstName, lastNameKana, firstNameKana };
}

// ランダムな日付を生成（1990年〜2000年）
function generateRandomBirthDate(): string {
  const year = 1990 + Math.floor(Math.random() * 11);
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// UUID生成
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function generateDevData() {
  console.log('🚀 開発環境用テストデータの生成を開始します...');

  try {
    // 1. テスト施設を作成
    const facilityId = 'dev-facility-test';
    const facilityCode = 'TEST';
    
    console.log('📋 テスト施設を作成中...');
    const { data: existingFacility } = await supabase
      .from('facilities')
      .select('id')
      .eq('id', facilityId)
      .single();

    if (!existingFacility) {
      const { error: facilityError } = await supabase
        .from('facilities')
        .insert({
          id: facilityId,
          name: 'テスト施設',
          code: facilityCode,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (facilityError) {
        console.error('❌ 施設作成エラー:', facilityError);
        return;
      }
      console.log('✅ テスト施設を作成しました');
    } else {
      console.log('ℹ️  テスト施設は既に存在します');
    }

    // 施設設定を作成
    const { error: settingsError } = await supabase
      .from('facility_settings')
      .upsert({
        facility_id: facilityId,
        facility_name: 'テスト施設',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'facility_id' });

    if (settingsError) {
      console.error('⚠️  施設設定の作成エラー:', settingsError);
    }

    // 2. スタッフ10名を生成
    console.log('👥 スタッフ10名を生成中...');
    const staffRoles = ['一般スタッフ', '一般スタッフ', '一般スタッフ', '一般スタッフ', '一般スタッフ', '一般スタッフ', '一般スタッフ', 'マネージャー', 'マネージャー', '管理者'];
    const employmentTypes = ['常勤', '常勤', '常勤', '常勤', '非常勤', '非常勤', '非常勤', '常勤', '常勤', '常勤'];

    const staffData = [];
    for (let i = 0; i < 10; i++) {
      const { lastName, firstName, lastNameKana, firstNameKana } = generateRandomName();
      const userId = generateUUID();
      const email = `staff${i + 1}@test.example.com`;
      
      // ユーザーを作成
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          id: userId,
          name: `${lastName} ${firstName}`,
          last_name: lastName,
          first_name: firstName,
          last_name_kana: lastNameKana,
          first_name_kana: firstNameKana,
          email: email,
          login_id: email,
          birth_date: generateRandomBirthDate(),
          gender: Math.random() > 0.5 ? 'male' : 'female',
          account_status: 'active',
          has_account: true,
          role: 'staff',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (userError) {
        console.error(`⚠️  ユーザー${i + 1}の作成エラー:`, userError);
        continue;
      }

      // employment_recordsを作成（既に存在する場合はスキップ）
      const { data: existingEmp } = await supabase
        .from('employment_records')
        .select('id')
        .eq('user_id', userId)
        .eq('facility_id', facilityId)
        .single();

      if (!existingEmp) {
        const { error: empError } = await supabase
          .from('employment_records')
          .insert({
            user_id: userId,
            facility_id: facilityId,
            start_date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            role: staffRoles[i],
            employment_type: employmentTypes[i],
            permissions: {},
            experience_verification_status: 'not_requested',
          });

        if (empError && empError.code !== '23505') { // 23505は重複エラー（無視）
          console.error(`⚠️  雇用記録${i + 1}の作成エラー:`, empError);
        }
      }

      // staffテーブルにも作成（後方互換性）
      const { error: staffError } = await supabase
        .from('staff')
        .upsert({
          id: `staff-${userId}`,
          facility_id: facilityId,
          user_id: userId,
          name: `${lastName} ${firstName}`,
          role: staffRoles[i],
          type: employmentTypes[i],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (staffError) {
        console.error(`⚠️  スタッフ${i + 1}の作成エラー:`, staffError);
      }

      staffData.push({ userId, name: `${lastName} ${firstName}` });
    }
    console.log(`✅ スタッフ${staffData.length}名を生成しました`);

    // 3. 利用児童を生成（10名）
    console.log('👶 利用児童10名を生成中...');
    const childLastNames = ['山田', '佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '中村', '小林', '加藤'];
    const childFirstNames = ['健太', 'さくら', '大輔', '美咲', '翔太', 'あかり', '優太', 'みお', '蓮', 'ひなた'];
    const childLastNamesKana = ['ヤマダ', 'サトウ', 'スズキ', 'タカハシ', 'タナカ', 'イトウ', 'ワタナベ', 'ナカムラ', 'コバヤシ', 'カトウ'];
    const childFirstNamesKana = ['ケンタ', 'サクラ', 'ダイスケ', 'ミサキ', 'ショウタ', 'アカリ', 'ユウタ', 'ミオ', 'レン', 'ヒナタ'];
    const guardianNames = ['山田花子', '佐藤美咲', '鈴木一郎', '高橋次郎', '田中三郎', '伊藤さくら', '渡辺太郎', '中村花子', '小林一郎', '加藤次郎'];
    const guardianRelationships = ['母', '父', '母', '父', '母', '母', '父', '母', '父', '母'];

    const childIds: string[] = [];
    for (let i = 0; i < 10; i++) {
      const childId = generateUUID();
      childIds.push(childId);
      const childLastName = childLastNames[i];
      const childFirstName = childFirstNames[i];
      const childName = `${childLastName} ${childFirstName}`;
      const childNameKana = `${childLastNamesKana[i]} ${childFirstNamesKana[i]}`;
      const birthYear = 2015 + Math.floor(Math.random() * 8);
      const birthMonth = Math.floor(Math.random() * 12) + 1;
      const birthDay = Math.floor(Math.random() * 28) + 1;
      const birthDate = `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;
      
      const patternDays = [1, 3, 5]; // 月・水・金をデフォルト
      const contractStartDate = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000);
      
      const { error: childError } = await supabase
        .from('children')
        .insert({
          id: childId,
          facility_id: facilityId,
          name: childName,
          name_kana: childNameKana,
          birth_date: birthDate,
          guardian_name: guardianNames[i],
          guardian_relationship: guardianRelationships[i],
          beneficiary_number: `123456789${i}`,
          grant_days: 10 + Math.floor(Math.random() * 5),
          contract_days: 8 + Math.floor(Math.random() * 3),
          address: `東京都渋谷区テスト${i + 1}-${i + 1}-${i + 1}`,
          phone: `03-${String(1000 + i).padStart(4, '0')}-${String(1000 + i).padStart(4, '0')}`,
          email: `child${i + 1}@test.example.com`,
          pattern_days: patternDays,
          needs_pickup: Math.random() > 0.3,
          needs_dropoff: Math.random() > 0.3,
          pickup_location_custom: Math.random() > 0.5 ? '小学校正門' : null,
          dropoff_location_custom: Math.random() > 0.5 ? '自宅' : null,
          contract_status: 'active',
          contract_start_date: contractStartDate.toISOString().split('T')[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (childError) {
        console.error(`⚠️  利用児童${i + 1}の作成エラー:`, childError);
      }
    }
    console.log('✅ 利用児童10名を生成しました');

    // 4. リード登録を生成（5件）
    console.log('📞 リード登録5件を生成中...');
    const leadStatuses: ('new-inquiry' | 'visit-scheduled' | 'considering' | 'waiting-benefit' | 'contract-progress' | 'contracted' | 'lost')[] = 
      ['new-inquiry', 'visit-scheduled', 'considering', 'waiting-benefit', 'contract-progress'];
    const inquirySources: ('devnavi' | 'homepage' | 'support-office' | 'other')[] = 
      ['devnavi', 'homepage', 'support-office', 'homepage', 'other'];
    
    const leadChildFirstNames = ['健太', 'さくら', '大輔', '美咲', '翔太'];
    const leadChildLastNames = ['山田', '佐藤', '鈴木', '高橋', '田中'];
    
    for (let i = 0; i < 5; i++) {
      const { lastName, firstName } = generateRandomName();
      const childName = leadChildFirstNames[i] ? `${leadChildLastNames[i]} ${leadChildFirstNames[i]}` : 'テスト児童';
      const preferredDays = ['月', '水', '金'];
      
      const { error: leadError } = await supabase
        .from('leads')
        .insert({
          id: generateUUID(),
          facility_id: facilityId,
          name: `${lastName} ${firstName}`,
          child_name: childName,
          email: `lead${i + 1}@test.example.com`,
          phone: `090-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
          address: `東京都渋谷区リード${i + 1}-${i + 1}-${i + 1}`,
          status: leadStatuses[i],
          inquiry_source: inquirySources[i],
          preferred_days: preferredDays,
          pickup_option: Math.random() > 0.5 ? 'required' : 'preferred',
          child_ids: i < childIds.length ? [childIds[i]] : [],
          memo: `テストリード${i + 1}のメモ`,
          created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (leadError) {
        console.error(`⚠️  リード${i + 1}の作成エラー:`, leadError);
      }
    }
    console.log('✅ リード登録5件を生成しました');

    console.log('\n🎉 開発環境用テストデータの生成が完了しました！');
    console.log(`\n📊 生成されたデータ:`);
    console.log(`  - 施設: テスト施設 (ID: ${facilityId})`);
    console.log(`  - スタッフ: ${staffData.length}名`);
    console.log(`  - 利用児童: 10名`);
    console.log(`  - リード: 5件`);

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
generateDevData();

