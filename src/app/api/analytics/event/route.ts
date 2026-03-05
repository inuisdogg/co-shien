/**
 * Analytics Event API
 * ツール利用・PDF生成等のイベントをSupabaseに記録
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const { event, metadata, ts } = await req.json();

    if (!event || typeof event !== 'string') {
      return NextResponse.json({ error: 'event is required' }, { status: 400 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      // Dev mode — just log
      console.log('[analytics]', event, metadata);
      return NextResponse.json({ success: true, devMode: true });
    }

    const { error } = await supabase.from('analytics_events').insert({
      event_name: event,
      metadata: metadata || {},
      user_agent: req.headers.get('user-agent') || '',
      referrer: req.headers.get('referer') || '',
      created_at: ts || new Date().toISOString(),
    });

    if (error) {
      // Table might not exist yet — log but don't fail
      console.warn('[analytics] insert error:', error.message);
      return NextResponse.json({ success: true, warning: 'table may not exist' });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true }); // Never fail on analytics
  }
}
