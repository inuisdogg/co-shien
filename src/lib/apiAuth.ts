/**
 * API認証ユーティリティ
 *
 * アプリはlocalStorage ベースの認証を使用しているため、
 * カスタムヘッダー (X-User-Id) でユーザーを識別し、
 * データベースで存在確認を行う。
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export interface AuthResult {
  userId: string;
  facilityId?: string;
}

/**
 * リクエストの認証を行う。
 * クライアントが送信する X-User-Id ヘッダーを読み取り、
 * そのユーザーがデータベースに存在するかを検証する。
 *
 * @returns 認証済みの場合は { userId, facilityId? }、失敗時は null
 */
export async function authenticateRequest(
  req: NextRequest | Request,
): Promise<AuthResult | null> {
  const userId = req.headers.get('x-user-id');
  if (!userId) return null;

  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .single();

  if (!data) return null;

  const facilityId = req.headers.get('x-facility-id') || undefined;
  return { userId: data.id, facilityId };
}

/**
 * 認証エラー時の統一レスポンスを返す。
 */
export function unauthorizedResponse(message = '認証が必要です') {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * 施設の所有権を検証する。
 * 認証済みユーザーが指定の施設の owner_user_id であるかをチェックする。
 *
 * @returns 所有権がある場合は true
 */
export async function verifyFacilityOwnership(
  userId: string,
  facilityId: string,
): Promise<boolean> {
  const supabase = createServerSupabaseClient();

  // facilities テーブルで owner_user_id を確認
  const { data: facility } = await supabase
    .from('facilities')
    .select('id, owner_user_id')
    .eq('id', facilityId)
    .single();

  if (!facility) return false;

  if (facility.owner_user_id === userId) return true;

  // users テーブルで facility_id と role を確認（管理者も許可）
  const { data: user } = await supabase
    .from('users')
    .select('id, role, facility_id')
    .eq('id', userId)
    .eq('facility_id', facilityId)
    .single();

  if (user && (user.role === 'admin' || user.role === 'owner')) return true;

  return false;
}

/**
 * 権限不足時のレスポンスを返す。
 */
export function forbiddenResponse(message = 'この操作を行う権限がありません') {
  return NextResponse.json({ error: message }, { status: 403 });
}
