/**
 * インメモリ・レートリミッター
 *
 * 単一サーバーデプロイ向けのシンプルなスライディングウィンドウ方式。
 * 本番で複数インスタンスを使う場合は Redis 等に置き換えること。
 */

import { NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// 期限切れエントリを定期的にクリーンアップ（60秒ごと）
if (typeof globalThis !== 'undefined') {
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key);
    }
  };
  // Node.js 環境でのみ setInterval を使用
  // Edge Runtime でも動作するように typeof チェック
  if (typeof setInterval === 'function') {
    setInterval(cleanup, 60_000);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

/**
 * 指定キーに対するレート制限を適用する。
 *
 * @param key        - 制限対象の識別キー（例: `login:ip:1.2.3.4`）
 * @param maxAttempts - ウィンドウ内の最大試行回数
 * @param windowMs   - ウィンドウの長さ（ミリ秒）
 * @returns 許可されたかどうかと残りの回数
 */
export function rateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  // エントリが無い、または期限切れ -> 新しいウィンドウを開始
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  // 上限に達している場合
  if (entry.count >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  // カウントを増やす
  entry.count++;
  return { allowed: true, remaining: maxAttempts - entry.count };
}

/**
 * レート制限超過時の統一レスポンス (HTTP 429) を返す。
 */
export function rateLimitResponse(retryAfter: number) {
  return NextResponse.json(
    { error: 'リクエストが多すぎます。しばらくしてから再試行してください。' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    },
  );
}
