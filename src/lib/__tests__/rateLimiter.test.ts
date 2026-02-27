import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock next/server before importing the module under test
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      body,
      status: init?.status,
      headers: init?.headers,
    }),
  },
}));

import { rateLimit, rateLimitResponse } from '../rateLimiter';

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow the first request', () => {
    const result = rateLimit('test-key-1', 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should decrement remaining with each request', () => {
    const key = 'test-key-2';
    const r1 = rateLimit(key, 3, 60_000);
    expect(r1.remaining).toBe(2);

    const r2 = rateLimit(key, 3, 60_000);
    expect(r2.remaining).toBe(1);

    const r3 = rateLimit(key, 3, 60_000);
    expect(r3.remaining).toBe(0);
  });

  it('should block requests once the limit is reached', () => {
    const key = 'test-key-3';
    // Exhaust all attempts
    rateLimit(key, 2, 60_000);
    rateLimit(key, 2, 60_000);

    // Third request should be blocked
    const result = rateLimit(key, 2, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('should reset after the window expires', () => {
    const key = 'test-key-4';
    const windowMs = 10_000;

    // Exhaust all attempts
    rateLimit(key, 1, windowMs);
    const blocked = rateLimit(key, 1, windowMs);
    expect(blocked.allowed).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(windowMs + 1);

    // Should be allowed again
    const result = rateLimit(key, 1, windowMs);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('should track different keys independently', () => {
    const keyA = 'user-a';
    const keyB = 'user-b';

    // Exhaust key A
    rateLimit(keyA, 1, 60_000);
    const blockedA = rateLimit(keyA, 1, 60_000);
    expect(blockedA.allowed).toBe(false);

    // Key B should still be allowed
    const resultB = rateLimit(keyB, 1, 60_000);
    expect(resultB.allowed).toBe(true);
  });

  it('should return retryAfter in seconds', () => {
    const key = 'test-key-5';
    const windowMs = 30_000;

    rateLimit(key, 1, windowMs);

    // Advance 10 seconds into the window
    vi.advanceTimersByTime(10_000);

    const result = rateLimit(key, 1, windowMs);
    expect(result.allowed).toBe(false);
    // Should be approximately 20 seconds remaining (30s window - 10s elapsed)
    expect(result.retryAfter).toBe(20);
  });
});

describe('rateLimitResponse', () => {
  it('should return a 429 response with Retry-After header', () => {
    const response = rateLimitResponse(30) as unknown as {
      body: { error: string };
      status: number;
      headers: Record<string, string>;
    };
    expect(response.status).toBe(429);
    expect(response.headers['Retry-After']).toBe('30');
    expect(response.body.error).toContain('リクエストが多すぎます');
  });
});
