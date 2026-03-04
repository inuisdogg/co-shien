#!/usr/bin/env node

/**
 * populate-attendance-records.mjs
 *
 * Reads the LINE chat export file for POCOPOCO attendance reports and
 * ensures all attendance_records are properly populated in Supabase.
 *
 * This script:
 *  1. Re-parses the chat file to extract clock-in/clock-out/break events
 *  2. Fetches existing records from attendance_records
 *  3. Inserts any missing records (deduplication via unique constraint)
 *  4. Reports a summary of what was added
 *
 * Usage: node scripts/populate-attendance-records.mjs [--dry-run]
 */

import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://iskgcqzozsemlmbvubna.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza2djcXpvenNlbWxtYnZ1Ym5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg0NjE4NywiZXhwIjoyMDgyNDIyMTg3fQ.IoX82N5BgSsasQ5LzkAPdyWT52k1mqqHUuAn6kn7ZCI';
const FACILITY_ID = 'facility-1770623012121';

const CHAT_FILE = '/Users/inu/Library/Mobile Documents/com~apple~CloudDocs/INU/pocopoco/追加データ/202511202602勤怠報告ルーム.txt';

const DRY_RUN = process.argv.includes('--dry-run');

// ── Name → user_id mapping ──────────────────────────────────────────────────
const NAME_MAP = {
  '酒井くるみ': 'pocopoco-staff-sakai',
  '平井菜央':   'pocopoco-staff-hirai',
  '水石晶子':   'pocopoco-staff-mizuishi',
  '長尾麻由子': 'pocopoco-staff-nagao',
  '宮古萌慧':   'pocopoco-staff-yogo',
  '大石瑠美':   'pocopoco-staff-oishi',
  '畠昂哉':     'c6f4c329-17e6-4fcc-a1de-28cfbe08b504',
};
const SKIP_NAMES = new Set(['畠真姫']);

// ── Event-type detection ────────────────────────────────────────────────────

function detectEventType(msg) {
  const m = msg.replace(/：/g, ':');

  const hasBS = /休憩.{0,6}(入|はい|in)/i.test(m) || /休憩は\s*入/i.test(m);
  const hasBE = /休憩.{0,6}(終|おわ|おえ|out)/i.test(m);
  if (hasBS && hasBE) return 'break_start';

  if (/休憩\s*(終|おわ|おえ|out)/i.test(m)) return 'break_end';
  if (/休憩\s*out/i.test(m)) return 'break_end';
  if (/休憩.{0,6}(おわ|おえ|終え|終わ|終り|終了)/i.test(m)) return 'break_end';
  if (/休憩(から|に)?\s*(戻|もど)/i.test(m)) return 'break_end';

  if (/休憩\s*(入|はい|in|します|im)/i.test(m)) return 'break_start';
  if (/休憩は\s*(入)/i.test(m)) return 'break_start';
  if (/休憩\s*in/i.test(m)) return 'break_start';
  if (/休暇入/i.test(m)) return 'break_start';
  if (/^\s*休憩\s*$/i.test(m.trim())) return 'break_start';
  if (/休憩\s*スタート/i.test(m)) return 'break_start';
  if (/\d+[:時]\s*\d*\s*休憩\s*$/.test(m.trim())) return 'break_start';
  if (/\d+[:：]\s*\d+\s*休憩/.test(m)) return 'break_start';
  if (/休憩.*とりました/.test(m)) return 'break_start';

  const hasClockIn = /出勤/.test(m);
  const hasClockOut = /退勤|たいきん|大金/.test(m);
  if (hasClockIn && hasClockOut) return 'clock_in_out';

  if (hasClockOut) return 'clock_out';
  if (hasClockIn) return 'clock_in';

  return null;
}

function toDbType(eventType) {
  switch (eventType) {
    case 'clock_in':    return 'start';
    case 'clock_out':   return 'end';
    case 'break_start': return 'break_start';
    case 'break_end':   return 'break_end';
    default: return null;
  }
}

// ── Time extraction from message body ──────────────────────────────────────

function extractOverrideTime(msg, headerHour, headerMinute) {
  const m = msg.replace(/：/g, ':');

  {
    const match = m.match(/(\d{1,2}):(\d{2})\s*(?:に|から|頃|ごろ|で|休憩|退勤|出勤|大金)/);
    if (match) return { hours: parseInt(match[1], 10), minutes: parseInt(match[2], 10) };
  }
  {
    const match = m.match(/(\d{1,2}):(\d{2})\s*(退勤|出勤)/);
    if (match) return { hours: parseInt(match[1], 10), minutes: parseInt(match[2], 10) };
  }
  {
    const match = m.match(/(\d{1,2})時(\d{1,2})分/);
    if (match) return { hours: parseInt(match[1], 10), minutes: parseInt(match[2], 10) };
  }
  {
    const match = m.match(/(\d{1,2})時(?:に|頃|ごろ)?(?:退勤|出勤|休憩|戻)/);
    if (match) return { hours: parseInt(match[1], 10), minutes: 0 };
  }
  {
    const match = m.match(/(?:^|[^0-9時:])(\d{1,2})分\s*(?:に|から|頃|で|休憩|退勤|出勤|戻)/);
    if (match) return { hours: headerHour, minutes: parseInt(match[1], 10) };
  }
  return null;
}

// ── Messages that mention multiple people ──────────────────────────────────

function extractMentionedNames(msg, senderName) {
  const names = new Set();
  const allNames = Object.keys(NAME_MAP);

  if (/全員|みんな/.test(msg)) {
    return { everyone: true, names };
  }

  for (const fullName of allNames) {
    if (fullName === senderName) continue;
    const surname = fullName.slice(0, 2);
    if (msg.includes(surname) && !msg.includes(surname + 'さんを招待')) {
      names.add(fullName);
    }
  }

  return { everyone: false, names };
}

// ── Parsing ─────────────────────────────────────────────────────────────────

function parseDate(line) {
  const match = line.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;
  const y = match[1];
  const m = match[2].padStart(2, '0');
  const d = match[3].padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseTimeName(line) {
  const match = line.trim().match(/^(\d{1,2}):(\d{2})\/(.*?)$/);
  if (!match) return null;
  return {
    hours: parseInt(match[1], 10),
    minutes: parseInt(match[2], 10),
    name: match[3].trim(),
  };
}

function isSystemMessage(msg) {
  if (/さんを招待しました/.test(msg)) return true;
  if (/トークを送信すると/.test(msg)) return true;
  if (/トークの送信を取り消しました/.test(msg)) return true;
  if (/トークルームが作成されます/.test(msg)) return true;
  return false;
}

function isSkippableMessage(msg) {
  if (isSystemMessage(msg)) return true;
  const hasAttendance = /出勤|退勤|たいきん|大金|休憩|休暇入/.test(msg);
  if (!hasAttendance) return true;
  if (/勤怠関連はこちら|勤怠報告の部屋|勤怠連絡はこちら/.test(msg)) return true;
  if (/休憩報告グループ/.test(msg)) return true;
  if (/出勤、退勤、休憩入り、休憩終わりを連絡する/.test(msg)) return true;
  return false;
}

function nextDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + 1);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, '0');
  const nd = String(date.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

function parseFile(content) {
  const lines = content.split('\n');
  const entries = [];
  let currentDate = null;
  let lastHour = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === '') { i++; continue; }

    const date = parseDate(line);
    if (date) {
      currentDate = date;
      lastHour = 0;
      i++;
      continue;
    }

    const tn = parseTimeName(line);
    if (tn && currentDate) {
      if (tn.hours < lastHour - 4) {
        currentDate = nextDate(currentDate);
        console.warn(`  [WARN] No date header, assuming new day: ${currentDate}`);
        lastHour = 0;
      }
      lastHour = tn.hours;

      const msgLines = [];
      i++;
      while (i < lines.length) {
        const nextLine = lines[i].trim();
        if (nextLine === '') break;
        if (parseDate(nextLine)) break;
        if (parseTimeName(nextLine)) break;
        msgLines.push(nextLine);
        i++;
      }

      const message = msgLines.join('\n');
      entries.push({
        date: currentDate,
        hours: tn.hours,
        minutes: tn.minutes,
        name: tn.name,
        message,
      });
      continue;
    }
    i++;
  }

  return entries;
}

// ── Build attendance records ────────────────────────────────────────────────

function buildRecords(entries) {
  const records = [];
  const datePresent = {};

  // First pass: identify who clocked in per day
  for (const entry of entries) {
    if (SKIP_NAMES.has(entry.name)) continue;
    if (!NAME_MAP[entry.name]) continue;
    const evt = detectEventType(entry.message);
    if (evt === 'clock_in' || evt === 'clock_in_out') {
      if (!datePresent[entry.date]) datePresent[entry.date] = new Set();
      datePresent[entry.date].add(entry.name);
    }
  }

  // Also handle messages where someone reports for others
  for (const entry of entries) {
    if (SKIP_NAMES.has(entry.name)) continue;
    if (!NAME_MAP[entry.name]) continue;
    const evt = detectEventType(entry.message);
    if (evt === 'clock_in' || evt === 'clock_in_out') {
      const mentioned = extractMentionedNames(entry.message, entry.name);
      if (mentioned.names.size > 0) {
        if (!datePresent[entry.date]) datePresent[entry.date] = new Set();
        for (const n of mentioned.names) {
          datePresent[entry.date].add(n);
        }
      }
    }
  }

  // Second pass: create records
  for (const entry of entries) {
    if (SKIP_NAMES.has(entry.name)) continue;
    if (!NAME_MAP[entry.name]) continue;
    if (isSkippableMessage(entry.message)) continue;

    const eventType = detectEventType(entry.message);
    if (!eventType) continue;

    const userId = NAME_MAP[entry.name];
    const normalizedMsg = entry.message.replace(/：/g, ':');

    const override = extractOverrideTime(entry.message, entry.hours, entry.minutes);
    const hours = override ? override.hours : entry.hours;
    const minutes = override ? override.minutes : entry.minutes;
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

    // Handle combo: both clock_in AND clock_out in one message
    if (eventType === 'clock_in_out') {
      let ciHours = entry.hours, ciMinutes = entry.minutes;
      const ciMatch1 = normalizedMsg.match(/(\d{1,2}):(\d{2})\s*(?:に)?出勤/);
      const ciMatch2 = normalizedMsg.match(/(\d{1,2})時(\d{0,2})分?\s*(?:に)?出勤/);
      if (ciMatch1) {
        ciHours = parseInt(ciMatch1[1], 10);
        ciMinutes = parseInt(ciMatch1[2], 10);
      } else if (ciMatch2) {
        ciHours = parseInt(ciMatch2[1], 10);
        ciMinutes = ciMatch2[2] ? parseInt(ciMatch2[2], 10) : 0;
      }

      let coHours = entry.hours, coMinutes = entry.minutes;
      const coMatch1 = normalizedMsg.match(/(\d{1,2}):(\d{2})\s*(?:に)?(?:退勤|大金)/);
      const coMatch2 = normalizedMsg.match(/(\d{1,2})時(\d{0,2})分?\s*(?:に|半)?(?:退勤|大金)/);
      const coMatch3 = normalizedMsg.match(/(\d{1,2})時半\s*(?:退勤|大金)/);
      if (coMatch1) {
        coHours = parseInt(coMatch1[1], 10);
        coMinutes = parseInt(coMatch1[2], 10);
      } else if (coMatch3) {
        coHours = parseInt(coMatch3[1], 10);
        coMinutes = 30;
      } else if (coMatch2) {
        coHours = parseInt(coMatch2[1], 10);
        coMinutes = coMatch2[2] ? parseInt(coMatch2[2], 10) : 0;
        if (/(\d{1,2})時半/.test(normalizedMsg)) {
          const halfMatch = normalizedMsg.match(/(\d{1,2})時半/);
          if (halfMatch && parseInt(halfMatch[1], 10) === coHours) {
            coMinutes = 30;
          }
        }
      }

      const ciTimeStr = `${String(ciHours).padStart(2, '0')}:${String(ciMinutes).padStart(2, '0')}:00`;
      const coTimeStr = `${String(coHours).padStart(2, '0')}:${String(coMinutes).padStart(2, '0')}:00`;

      records.push({
        id: randomUUID(),
        user_id: userId,
        facility_id: FACILITY_ID,
        date: entry.date,
        type: 'start',
        time: ciTimeStr,
        is_manual_correction: true,
        correction_reason: 'LINE chat import (populate)',
        memo: entry.message,
      });
      records.push({
        id: randomUUID(),
        user_id: userId,
        facility_id: FACILITY_ID,
        date: entry.date,
        type: 'end',
        time: coTimeStr,
        is_manual_correction: true,
        correction_reason: 'LINE chat import (populate)',
        memo: entry.message,
      });
      continue;
    }

    const dbType = toDbType(eventType);
    if (!dbType) continue;

    // Handle combo: both break_start AND break_end in one message
    const hasBreakStart = /休憩.{0,6}(入|はい|in)/i.test(normalizedMsg) || /休憩は\s*入/i.test(normalizedMsg);
    const hasBreakEnd = /休憩.{0,6}(終|おわ|おえ|out)/i.test(normalizedMsg);

    if (hasBreakStart && hasBreakEnd) {
      let bsTime = timeStr;
      let beTime = timeStr;

      const bsMatch = normalizedMsg.match(/(\d{1,2}):(\d{2})\s*(?:に)?休憩\s*(?:入|はい|in)/i);
      const bsMatch2 = normalizedMsg.match(/(\d{1,2})時(\d{0,2})分?\s*(?:に)?休憩\s*(?:入|はい|in)/i);
      if (bsMatch) {
        bsTime = `${String(parseInt(bsMatch[1])).padStart(2,'0')}:${bsMatch[2]}:00`;
      } else if (bsMatch2) {
        bsTime = `${String(parseInt(bsMatch2[1])).padStart(2,'0')}:${String(parseInt(bsMatch2[2]||'0')).padStart(2,'0')}:00`;
      }

      const beMatch = normalizedMsg.match(/(\d{1,2}):(\d{2})\s*(?:に)?休憩\s*(?:終|おわ|おえ|out)/i);
      const beMatch2 = normalizedMsg.match(/(\d{1,2})時(\d{0,2})分?\s*(?:に)?休憩\s*(?:終|おわ|おえ|out)/i);
      if (beMatch) {
        beTime = `${String(parseInt(beMatch[1])).padStart(2,'0')}:${beMatch[2]}:00`;
      } else if (beMatch2) {
        beTime = `${String(parseInt(beMatch2[1])).padStart(2,'0')}:${String(parseInt(beMatch2[2]||'0')).padStart(2,'0')}:00`;
      }

      records.push({
        id: randomUUID(),
        user_id: userId,
        facility_id: FACILITY_ID,
        date: entry.date,
        type: 'break_start',
        time: bsTime,
        is_manual_correction: true,
        correction_reason: 'LINE chat import (populate)',
        memo: entry.message,
      });
      records.push({
        id: randomUUID(),
        user_id: userId,
        facility_id: FACILITY_ID,
        date: entry.date,
        type: 'break_end',
        time: beTime,
        is_manual_correction: true,
        correction_reason: 'LINE chat import (populate)',
        memo: entry.message,
      });
      continue;
    }

    // Handle messages that mention other people
    const mentioned = extractMentionedNames(entry.message, entry.name);
    const targetNames = [entry.name];

    if (mentioned.everyone) {
      const present = datePresent[entry.date] || new Set();
      for (const n of present) {
        if (n !== entry.name && NAME_MAP[n]) targetNames.push(n);
      }
    } else if (mentioned.names.size > 0) {
      for (const n of mentioned.names) {
        if (NAME_MAP[n]) targetNames.push(n);
      }
    }

    for (const targetName of targetNames) {
      const targetUserId = NAME_MAP[targetName];
      if (!targetUserId) continue;

      records.push({
        id: randomUUID(),
        user_id: targetUserId,
        facility_id: FACILITY_ID,
        date: entry.date,
        type: dbType,
        time: timeStr,
        is_manual_correction: true,
        correction_reason: 'LINE chat import (populate)',
        memo: entry.message,
      });
    }
  }

  return records;
}

// ── Deduplicate ─────────────────────────────────────────────────────────────

function deduplicateRecords(records) {
  const seen = new Map();
  for (const r of records) {
    const key = `${r.date}|${r.user_id}|${r.type}`;
    if (!seen.has(key)) {
      seen.set(key, r);
    }
  }
  return Array.from(seen.values());
}

// ── Supabase helpers ────────────────────────────────────────────────────────

async function fetchExistingRecords() {
  const url = `${SUPABASE_URL}/rest/v1/attendance_records?select=date,user_id,type,time&facility_id=eq.${FACILITY_ID}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) {
    console.error('Failed to fetch existing records:', await res.text());
    return [];
  }
  return await res.json();
}

async function insertRecords(records) {
  const BATCH_SIZE = 50;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const url = `${SUPABASE_URL}/rest/v1/attendance_records`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal,resolution=merge-duplicates',
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, res.status, body);
      for (const record of batch) {
        const singleRes = await fetch(url, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal,resolution=merge-duplicates',
          },
          body: JSON.stringify(record),
        });
        if (singleRes.ok) {
          inserted++;
        } else {
          skipped++;
          const name = Object.entries(NAME_MAP).find(([, v]) => v === record.user_id)?.[0] || record.user_id;
          console.warn(`  Skip: ${record.date} ${record.time} ${name} ${record.type}`);
        }
      }
    } else {
      inserted += batch.length;
    }
  }

  return { inserted, skipped };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Populate Attendance Records ===');
  console.log(`Chat file: ${CHAT_FILE}`);
  console.log(`Facility:  ${FACILITY_ID}`);
  console.log(`Dry run:   ${DRY_RUN}`);
  console.log('');

  // Read and parse the chat file
  const content = readFileSync(CHAT_FILE, 'utf-8');
  const entries = parseFile(content);
  console.log(`Parsed ${entries.length} chat entries`);

  // Build attendance records from parsed entries
  let records = buildRecords(entries);
  console.log(`Generated ${records.length} attendance records (before dedup)`);

  records = deduplicateRecords(records);
  console.log(`After dedup: ${records.length} records`);

  // Fetch existing records to find what's already in DB
  const existing = await fetchExistingRecords();
  const existingKeys = new Set(
    existing.map(r => `${r.date}|${r.user_id}|${r.type}`)
  );

  const newRecords = records.filter(r => {
    const key = `${r.date}|${r.user_id}|${r.type}`;
    return !existingKeys.has(key);
  });

  console.log(`Existing records in DB: ${existing.length}`);
  console.log(`New records to insert: ${newRecords.length}`);
  console.log('');

  // Print summary by person
  const byPerson = {};
  for (const r of newRecords) {
    const name = Object.entries(NAME_MAP).find(([, v]) => v === r.user_id)?.[0] || r.user_id;
    if (!byPerson[name]) byPerson[name] = { start: 0, end: 0, break_start: 0, break_end: 0 };
    byPerson[name][r.type]++;
  }
  if (Object.keys(byPerson).length > 0) {
    console.log('New records by person:');
    for (const [name, counts] of Object.entries(byPerson).sort()) {
      console.log(`  ${name}: clock_in=${counts.start}, clock_out=${counts.end}, break_start=${counts.break_start}, break_end=${counts.break_end}`);
    }
  } else {
    console.log('No new records needed — all data is already in the database.');
  }
  console.log('');

  // Print summary by month
  const byMonth = {};
  for (const r of newRecords) {
    const month = r.date.slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + 1;
  }
  if (Object.keys(byMonth).length > 0) {
    console.log('New records by month:');
    for (const [month, count] of Object.entries(byMonth).sort()) {
      console.log(`  ${month}: ${count} records`);
    }
    console.log('');
  }

  // Also report on existing data for verification
  const existByPerson = {};
  for (const r of existing) {
    const name = Object.entries(NAME_MAP).find(([, v]) => v === r.user_id)?.[0] || r.user_id;
    if (!existByPerson[name]) existByPerson[name] = { start: 0, end: 0, break_start: 0, break_end: 0 };
    existByPerson[name][r.type]++;
  }
  console.log('=== Existing data summary ===');
  for (const [name, counts] of Object.entries(existByPerson).sort()) {
    console.log(`  ${name}: clock_in=${counts.start}, clock_out=${counts.end}, break_start=${counts.break_start}, break_end=${counts.break_end}`);
  }
  console.log('');

  const existByMonth = {};
  for (const r of existing) {
    const month = r.date.slice(0, 7);
    existByMonth[month] = (existByMonth[month] || 0) + 1;
  }
  console.log('Existing records by month:');
  for (const [month, count] of Object.entries(existByMonth).sort()) {
    console.log(`  ${month}: ${count} records`);
  }
  console.log('');

  if (DRY_RUN) {
    console.log('[DRY RUN] Would insert these records:');
    for (const r of newRecords.slice(0, 20)) {
      const name = Object.entries(NAME_MAP).find(([, v]) => v === r.user_id)?.[0] || r.user_id;
      console.log(`  ${r.date} ${r.time} ${name} ${r.type}`);
    }
    if (newRecords.length > 20) {
      console.log(`  ... and ${newRecords.length - 20} more`);
    }
    console.log('');
    console.log('Run without --dry-run to insert.');
    return;
  }

  // Insert new records
  if (newRecords.length === 0) {
    console.log('All attendance records are already populated. Nothing to insert.');
    return;
  }

  console.log(`Inserting ${newRecords.length} records...`);
  const { inserted, skipped } = await insertRecords(newRecords);
  console.log(`Done! Inserted: ${inserted}, Failed: ${skipped}`);

  // Final verification
  const final = await fetchExistingRecords();
  console.log(`\nFinal record count: ${final.length} (was ${existing.length})`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
