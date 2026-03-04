/**
 * スタッフ情報更新スクリプト
 * 書類から抽出した住所・電話・メール・資格・生年月日をスタッフレコードに反映
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iskgcqzozsemlmbvubna.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg0NjE4NywiZXhwIjoyMDgyNDIyMTg3fQ.IoX82N5BgSsasQ5LzkAPdyWT52k1mqqHUuAn6kn7ZCI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const OWNER_USER_ID = 'c6f4c329-17e6-4fcc-a1de-28cfbe08b504';

// 書類から抽出した情報
const staffUpdates = [
  {
    staffId: 'pocopoco-s-sakai',
    userId: 'pocopoco-staff-sakai',
    staff: {
      email: null, // Not in resume
      phone: '090-9375-7801',
      birth_date: '1993-09-28',
      address: '〒185-0022 東京都国分寺市東元町1-21-37',
      qualifications: ['理学療法士', '児童発達支援管理責任者(基礎研修修了)', '児童発達支援管理責任者(実践研修修了)', '保育士'],
    },
    user: {
      birth_date: '1993-09-28',
      phone: '090-9375-7801',
      address: '〒185-0022 東京都国分寺市東元町1-21-37',
    },
  },
  {
    staffId: 'pocopoco-s-hirai',
    userId: 'pocopoco-staff-hirai',
    staff: {
      email: 'naaaaao60420@gmail.com',
      phone: '080-5883-3754',
      birth_date: '1994-04-20',
      address: '〒183-0052 東京都府中市新町2-60-23',
      qualifications: ['保育士', '普通自動車第一種運転免許'],
    },
    user: {
      birth_date: '1994-04-20',
      email: 'naaaaao60420@gmail.com',
      phone: '080-5883-3754',
      address: '〒183-0052 東京都府中市新町2-60-23',
    },
  },
  {
    staffId: 'pocopoco-s-mizuishi',
    userId: 'pocopoco-staff-mizuishi',
    staff: {
      phone: '080-3270-0617',
      address: '〒183-0057 東京都府中市晴見町1-8-13',
      qualifications: ['保育士', '幼稚園教諭二種免許', '普通自動車運転免許'],
    },
    user: {
      phone: '080-3270-0617',
      address: '〒183-0057 東京都府中市晴見町1-8-13',
    },
  },
  {
    staffId: 'pocopoco-s-nagao',
    userId: 'pocopoco-staff-nagao',
    staff: {
      phone: '090-4670-7428',
      birth_date: '1979-08-15',
      qualifications: ['幼稚園教諭二種免許', '中学校教諭一種免許(音楽)', '高等学校教諭一種免許(音楽)'],
    },
    user: {
      birth_date: '1979-08-15',
      phone: '090-4670-7428',
    },
  },
  {
    staffId: 'pocopoco-s-oishi',
    userId: 'pocopoco-staff-oishi',
    staff: {
      email: 'f0865090@yahoo.co.jp',
      phone: '080-6516-1514',
      birth_date: '1990-02-07',
      address: '〒185-0022 東京都国分寺市東元町1-32-10',
      qualifications: ['言語聴覚士'],
    },
    user: {
      birth_date: '1990-02-07',
      email: 'f0865090@yahoo.co.jp',
      phone: '080-6516-1514',
      address: '〒185-0022 東京都国分寺市東元町1-32-10',
    },
  },
];

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  スタッフ情報更新（書類から抽出したデータ）    ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  for (const update of staffUpdates) {
    console.log(`\n--- ${update.staffId} ---`);

    // Update staff table
    const staffPayload = {};
    if (update.staff.email) staffPayload.email = update.staff.email;
    if (update.staff.phone) staffPayload.phone = update.staff.phone;
    if (update.staff.birth_date) staffPayload.birth_date = update.staff.birth_date;
    if (update.staff.address) staffPayload.address = update.staff.address;
    if (update.staff.qualifications) {
      staffPayload.qualifications = update.staff.qualifications.join(',');
    }

    if (Object.keys(staffPayload).length > 0) {
      const { data, error } = await supabase
        .from('staff')
        .update(staffPayload)
        .eq('id', update.staffId)
        .select('id, name');

      if (error) {
        console.error(`  ✗ staff update: ${error.message}`);
      } else {
        console.log(`  ✓ staff updated: ${data?.[0]?.name || update.staffId}`);
        console.log(`    Fields: ${Object.keys(staffPayload).join(', ')}`);
      }
    }

    // Update users table
    const userPayload = {};
    if (update.user.birth_date) userPayload.birth_date = update.user.birth_date;
    if (update.user.email) userPayload.email = update.user.email;
    if (update.user.phone) userPayload.phone = update.user.phone;
    if (update.user.address) userPayload.address = update.user.address;

    if (Object.keys(userPayload).length > 0) {
      const { data, error } = await supabase
        .from('users')
        .update(userPayload)
        .eq('id', update.userId)
        .select('id, name');

      if (error) {
        console.error(`  ✗ user update: ${error.message}`);
      } else {
        console.log(`  ✓ user updated: ${data?.[0]?.name || update.userId}`);
        console.log(`    Fields: ${Object.keys(userPayload).join(', ')}`);
      }
    }
  }

  console.log('\n=== 完了 ===');
}

main().catch(console.error);
