#!/usr/bin/env node

/**
 * import-attendance-chat.mjs
 *
 * Reads a LINE chat export file containing attendance reports (出勤/退勤/休憩)
 * and imports them into the Supabase attendance_records table.
 *
 * Usage: node scripts/import-attendance-chat.mjs [--dry-run]
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

// Order matters: check more specific patterns first
function detectEventType(msg) {
  // Normalize full-width chars
  const m = msg.replace(/：/g, ':');

  // Special case: "休憩入って、休憩終えてます" — handled separately in buildRecords
  // but we detect as break_start+break_end combo; return break_start as primary
  const hasBS = /休憩.{0,6}(入|はい|in)/i.test(m) || /休憩は\s*入/i.test(m);
  const hasBE = /休憩.{0,6}(終|おわ|おえ|out)/i.test(m);
  if (hasBS && hasBE) return 'break_start'; // will be handled as combo

  // ── break_end ─────────────────────────────────────────────────────────
  // Check break_end first, but be careful not to match "教室戻ってきてます" etc.
  if (/休憩\s*(終|おわ|おえ|out)/i.test(m)) return 'break_end';
  if (/休憩\s*out/i.test(m)) return 'break_end';
  // "休憩みんなおわります" — with words between 休憩 and おわ/終
  if (/休憩.{0,6}(おわ|おえ|終え|終わ|終り|終了)/i.test(m)) return 'break_end';
  // "休憩戻" or "休憩から戻" — only when 戻 directly follows 休憩
  if (/休憩(から|に)?\s*(戻|もど)/i.test(m)) return 'break_end';

  // ── break_start ───────────────────────────────────────────────────────
  if (/休憩\s*(入|はい|in|します|im)/i.test(m)) return 'break_start';
  if (/休憩は\s*(入)/i.test(m)) return 'break_start'; // 休憩は入り
  if (/休憩\s*in/i.test(m)) return 'break_start';
  if (/休暇入/i.test(m)) return 'break_start';  // 休暇入ります = break
  if (/^\s*休憩\s*$/i.test(m.trim())) return 'break_start'; // just "休憩"
  if (/休憩\s*スタート/i.test(m)) return 'break_start';
  // "12:05休憩" or "12時休憩" — time followed by 休憩 alone
  if (/\d+[:時]\s*\d*\s*休憩\s*$/.test(m.trim())) return 'break_start';
  // "12:05 休憩入ります" or just "12:05休憩"
  if (/\d+[:：]\s*\d+\s*休憩/.test(m)) return 'break_start';
  // "休憩15分から15分とりました" — completed break report (treat as break_start, will need break_end too)
  if (/休憩.*とりました/.test(m)) return 'break_start';

  // ── combo: both clock_in and clock_out in same message ─────────────
  const hasClockIn = /出勤/.test(m);
  const hasClockOut = /退勤|たいきん|大金/.test(m);
  if (hasClockIn && hasClockOut) return 'clock_in_out'; // handled in buildRecords

  // ── clock_out ─────────────────────────────────────────────────────────
  if (hasClockOut) return 'clock_out';

  // ── clock_in ──────────────────────────────────────────────────────────
  if (hasClockIn) return 'clock_in';

  return null;
}

// Map our internal event type names to the DB `type` column values
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

/**
 * Some messages mention a different time than the header timestamp, e.g.
 *   "12:05から休憩入ります"  → use 12:05
 *   "8時59分に出勤しました" → use 08:59
 *   "17時に退勤してます"     → use 17:00
 *   "50分に出勤してます"     → use header hour + :50
 *   "12：50休憩入り"          → use 12:50
 *
 * Returns { hours, minutes } or null to use the header time.
 */
function extractOverrideTime(msg, headerHour, headerMinute) {
  const m = msg.replace(/：/g, ':');

  // "HH:MM" pattern before a keyword — e.g. "12:05から休憩" or "18:10退勤"
  {
    const match = m.match(/(\d{1,2}):(\d{2})\s*(?:に|から|頃|ごろ|で|休憩|退勤|出勤|大金)/);
    if (match) {
      return { hours: parseInt(match[1], 10), minutes: parseInt(match[2], 10) };
    }
  }

  // "HH:MM退勤" at end of string (like "18:20退勤")
  {
    const match = m.match(/(\d{1,2}):(\d{2})\s*(退勤|出勤)/);
    if (match) {
      return { hours: parseInt(match[1], 10), minutes: parseInt(match[2], 10) };
    }
  }

  // "H時M分" pattern — e.g. "8時59分に出勤しました"  or "13時10分休憩終わり"
  {
    const match = m.match(/(\d{1,2})時(\d{1,2})分/);
    if (match) {
      return { hours: parseInt(match[1], 10), minutes: parseInt(match[2], 10) };
    }
  }

  // "H時" without minutes — e.g. "17時に退勤" or "18時退勤"
  {
    const match = m.match(/(\d{1,2})時(?:に|頃|ごろ)?(?:退勤|出勤|休憩|戻)/);
    if (match) {
      return { hours: parseInt(match[1], 10), minutes: 0 };
    }
  }

  // "MM分" alone (no hour) — e.g. "50分に出勤してます" → header hour + 50 min
  // Only match if there's a keyword nearby and no preceding hour
  {
    const match = m.match(/(?:^|[^0-9時:])(\d{1,2})分\s*(?:に|から|頃|で|休憩|退勤|出勤|戻)/);
    if (match) {
      return { hours: headerHour, minutes: parseInt(match[1], 10) };
    }
  }

  return null;
}

// ── Messages that mention multiple people ──────────────────────────────────

/**
 * Some messages like "平井さんと宮古、退勤します" or "全員休憩in" mention
 * other people. We extract the extra names so we can create records for them too.
 */
function extractMentionedNames(msg, senderName) {
  const names = new Set();
  const allNames = Object.keys(NAME_MAP);

  // Check for "全員" or "みんな" (everyone) — means all active staff that day
  if (/全員|みんな/.test(msg)) {
    return { everyone: true, names };
  }

  // Check for explicit name mentions (surname only): 酒井さん、平井さん、etc.
  for (const fullName of allNames) {
    if (fullName === senderName) continue;
    const surname = fullName.slice(0, 2); // Japanese surnames are usually 2 chars
    if (msg.includes(surname) && !msg.includes(surname + 'さんを招待')) {
      names.add(fullName);
    }
  }

  // "長尾と宮古9時に出勤" pattern - surname without さん
  // Already handled above by checking surname presence

  return { everyone: false, names };
}

// ── Parsing ─────────────────────────────────────────────────────────────────

function parseDate(line) {
  // "2025年11月19日 水曜日" or "2026年1月5日 月曜日"
  const match = line.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;
  const y = match[1];
  const m = match[2].padStart(2, '0');
  const d = match[3].padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseTimeName(line) {
  // "8:54/酒井くるみ" — sometimes with trailing space
  const match = line.trim().match(/^(\d{1,2}):(\d{2})\/(.*?)$/);
  if (!match) return null;
  return {
    hours: parseInt(match[1], 10),
    minutes: parseInt(match[2], 10),
    name: match[3].trim(),
  };
}

// ── System / skip messages ──────────────────────────────────────────────────

function isSystemMessage(msg) {
  if (/さんを招待しました/.test(msg)) return true;
  if (/トークを送信すると/.test(msg)) return true;
  if (/トークの送信を取り消しました/.test(msg)) return true;
  if (/トークルームが作成されます/.test(msg)) return true;
  return false;
}

function isSkippableMessage(msg) {
  if (isSystemMessage(msg)) return true;

  // Purely conversational / informational with no attendance keyword
  const hasAttendance = /出勤|退勤|たいきん|大金|休憩|休暇入/.test(msg);
  if (!hasAttendance) return true;

  // Messages that are just explanatory meta-comments from managers
  if (/勤怠関連はこちら|勤怠報告の部屋|勤怠連絡はこちら/.test(msg)) return true;
  if (/休憩報告グループ/.test(msg)) return true;
  if (/出勤、退勤、休憩入り、休憩終わりを連絡する/.test(msg)) return true;

  return false;
}

// ── Parse the whole file ────────────────────────────────────────────────────

function nextDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + 1); // month is 0-indexed
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, '0');
  const nd = String(date.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

function parseFile(content) {
  const lines = content.split('\n');
  const entries = [];
  let currentDate = null;
  let lastHour = 0;       // Track last seen hour to detect day rollover
  let dateFromHeader = true; // whether currentDate came from a header line
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip blank lines
    if (line === '') {
      i++;
      continue;
    }

    // Try to parse as date line
    const date = parseDate(line);
    if (date) {
      currentDate = date;
      dateFromHeader = true;
      lastHour = 0;
      i++;
      continue;
    }

    // Try to parse as time/name line
    const tn = parseTimeName(line);
    if (tn && currentDate) {
      // Detect missing date header: if time jumps back significantly (e.g. 17:xx → 8:xx)
      // it means we crossed to a new day without a date header
      if (tn.hours < lastHour - 4) {
        currentDate = nextDate(currentDate);
        dateFromHeader = false;
        console.warn(`  [WARN] No date header detected, assuming new day: ${currentDate}`);
        lastHour = 0;
      }
      lastHour = tn.hours;

      // Collect subsequent message lines until blank line or next date/time line
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

    // Line doesn't match date or time/name — it could be a system line or junk
    // Collect it as part of "no sender" (system)
    i++;
  }

  return entries;
}

// ── Build attendance records ────────────────────────────────────────────────

function buildRecords(entries) {
  const records = [];
  // Track who was present on each date (for "全員"/"みんな" resolution)
  const datePresent = {};  // date → Set<name>

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

  // Also handle messages where someone reports clock_in for others
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

    // Determine actual time: check if message overrides header time
    const override = extractOverrideTime(entry.message, entry.hours, entry.minutes);
    const hours = override ? override.hours : entry.hours;
    const minutes = override ? override.minutes : entry.minutes;
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

    // ── Handle combo: both clock_in AND clock_out in one message ────────
    // e.g. "9:20出勤、18時半退勤" or "本日9時に出勤しております。これから退勤します。"
    if (eventType === 'clock_in_out') {
      // Extract clock_in time: find time pattern BEFORE or near 出勤
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

      // Extract clock_out time: find time pattern BEFORE or near 退勤/大金
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
        // Check for 半 right after
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
        correction_reason: 'LINE chat import',
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
        correction_reason: 'LINE chat import',
        memo: entry.message,
      });
      continue;
    }

    const dbType = toDbType(eventType);
    if (!dbType) continue;

    // ── Handle combo: both break_start AND break_end in one message ─────
    const hasBreakStart = /休憩.{0,6}(入|はい|in)/i.test(normalizedMsg) || /休憩は\s*入/i.test(normalizedMsg);
    const hasBreakEnd = /休憩.{0,6}(終|おわ|おえ|out)/i.test(normalizedMsg);
    const hasBothBreak = hasBreakStart && hasBreakEnd;

    if (hasBothBreak) {
      // Try to extract separate times for break_start and break_end
      // e.g. "13:20休憩in 13:30休憩おわり" or "12:50休憩入り\n13:50休憩終わります"
      let bsTime = timeStr;
      let beTime = timeStr;

      // Look for time before break_start keyword
      const bsMatch = normalizedMsg.match(/(\d{1,2}):(\d{2})\s*(?:に)?休憩\s*(?:入|はい|in)/i);
      const bsMatch2 = normalizedMsg.match(/(\d{1,2})時(\d{0,2})分?\s*(?:に)?休憩\s*(?:入|はい|in)/i);
      if (bsMatch) {
        bsTime = `${String(parseInt(bsMatch[1])).padStart(2,'0')}:${bsMatch[2]}:00`;
      } else if (bsMatch2) {
        bsTime = `${String(parseInt(bsMatch2[1])).padStart(2,'0')}:${String(parseInt(bsMatch2[2]||'0')).padStart(2,'0')}:00`;
      }

      // Look for time before break_end keyword
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
        correction_reason: 'LINE chat import',
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
        correction_reason: 'LINE chat import',
        memo: entry.message,
      });
      continue;
    }

    // Handle messages that mention other people doing the same action
    const mentioned = extractMentionedNames(entry.message, entry.name);
    const targetNames = [entry.name];

    if (mentioned.everyone) {
      // "全員" or "みんな" — apply to all present that day
      const present = datePresent[entry.date] || new Set();
      for (const n of present) {
        if (n !== entry.name && NAME_MAP[n]) {
          targetNames.push(n);
        }
      }
    } else if (mentioned.names.size > 0) {
      for (const n of mentioned.names) {
        if (NAME_MAP[n]) {
          targetNames.push(n);
        }
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
        correction_reason: 'LINE chat import',
        memo: entry.message,
      });
    }
  }

  return records;
}

// ── Deduplicate ─────────────────────────────────────────────────────────────

function deduplicateRecords(records) {
  // DB has unique constraint on (user_id, facility_id, date, type)
  // So we can only have ONE record per person/date/type.
  // Keep the FIRST occurrence (chronologically earliest).
  const seen = new Map(); // key → record
  for (const r of records) {
    const key = `${r.date}|${r.user_id}|${r.type}`;
    if (!seen.has(key)) {
      seen.set(key, r);
    }
    // Keep the first (earliest) one
  }
  return Array.from(seen.values());
}

// ── Supabase insert ─────────────────────────────────────────────────────────

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
  // Use upsert to handle unique constraint conflicts gracefully
  // The unique constraint is on (user_id, facility_id, date, type)
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
      // Try inserting one-by-one for this batch
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
  console.log('=== LINE Attendance Chat Importer ===');
  console.log(`Chat file: ${CHAT_FILE}`);
  console.log(`Facility:  ${FACILITY_ID}`);
  console.log(`Dry run:   ${DRY_RUN}`);
  console.log('');

  // Read and parse
  const content = readFileSync(CHAT_FILE, 'utf-8');
  const entries = parseFile(content);
  console.log(`Parsed ${entries.length} chat entries`);

  // Build records
  let records = buildRecords(entries);
  console.log(`Generated ${records.length} attendance records (before dedup)`);

  records = deduplicateRecords(records);
  console.log(`After dedup: ${records.length} records`);

  // Fetch existing to avoid duplicates
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
  console.log('Records by person:');
  for (const [name, counts] of Object.entries(byPerson).sort()) {
    console.log(`  ${name}: clock_in=${counts.start}, clock_out=${counts.end}, break_start=${counts.break_start}, break_end=${counts.break_end}`);
  }
  console.log('');

  // Print summary by month
  const byMonth = {};
  for (const r of newRecords) {
    const month = r.date.slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + 1;
  }
  console.log('Records by month:');
  for (const [month, count] of Object.entries(byMonth).sort()) {
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

  // Insert
  if (newRecords.length === 0) {
    console.log('Nothing to insert.');
    return;
  }

  console.log(`Inserting ${newRecords.length} records...`);
  const { inserted, skipped } = await insertRecords(newRecords);
  console.log(`Done! Inserted: ${inserted}, Failed: ${skipped}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
