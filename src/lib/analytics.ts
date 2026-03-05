/**
 * Analytics utility — GA4カスタムイベント + Supabase記録
 *
 * 使い方:
 *   import { trackEvent } from '@/lib/analytics';
 *   trackEvent('tool_pdf_generated', { tool: 'resume' });
 */

// ---------- GA4 ----------

type GtagEvent = {
  action: string;
  category?: string;
  label?: string;
  value?: number;
  [key: string]: string | number | undefined;
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function sendToGA(event: GtagEvent) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', event.action, {
    event_category: event.category,
    event_label: event.label,
    value: event.value,
  });
}

// ---------- Supabase ----------

async function sendToSupabase(eventName: string, metadata: Record<string, unknown>) {
  try {
    await fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: eventName, metadata, ts: new Date().toISOString() }),
    });
  } catch {
    // Non-critical — don't break UX if analytics fails
  }
}

// ---------- Public API ----------

/**
 * Track a user event (fires to both GA4 and Supabase).
 *
 * Common events:
 *   tool_page_view     — ツールページ表示
 *   tool_pdf_generated  — PDF生成完了
 *   tool_cta_clicked    — ConversionModal内CTAクリック
 *   career_signup       — キャリアアカウント登録
 */
export function trackEvent(
  eventName: string,
  metadata: Record<string, string | number> = {}
) {
  // GA4
  sendToGA({
    action: eventName,
    category: metadata.category as string | undefined,
    label: metadata.tool as string | undefined,
    value: metadata.value as number | undefined,
  });

  // Supabase (background, non-blocking)
  sendToSupabase(eventName, metadata);
}
