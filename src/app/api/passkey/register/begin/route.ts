import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * パスキー登録開始API
 * チャレンジを生成してクライアントに返す
 */
export async function POST(request: NextRequest) {
  try {
    const { facilityCode, loginId, userId } = await request.json();

    if (!loginId || !userId) {
      return NextResponse.json(
        { error: 'loginId and userId are required' },
        { status: 400 }
      );
    }

    // ユーザーの存在確認
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .eq('account_status', 'active')
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // チャレンジを生成（簡易版：ランダムな文字列）
    const challenge = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => String.fromCharCode(b))
      .join('');

    // チャレンジを一時的に保存（実際の実装では、セッションストアやRedisなどに保存）

    return NextResponse.json({
      challenge,
      userId: userData.id,
    });
  } catch (error: any) {
    console.error('Passkey register begin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

