import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * パスキー認証開始API
 * チャレンジを生成してクライアントに返す
 */
export async function POST(request: NextRequest) {
  try {
    const { facilityCode, loginId } = await request.json();

    if (!loginId) {
      return NextResponse.json(
        { error: 'loginId is required' },
        { status: 400 }
      );
    }

    // 個人向けの場合、loginIdはメールアドレス
    // usersテーブルからユーザーを検索
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', loginId)
      .eq('account_status', 'active')
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // パスキークレデンシャルを検索（将来的にpasskeysテーブルを作成する必要があります）
    // 現時点では、エラーを返さずに空のallowCredentialsを返す
    // これにより、パスキーが登録されていない場合でもエラーにならないようにします
    const allowCredentials: any[] = [];

    // チャレンジを生成（簡易版：ランダムな文字列）
    const challenge = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => String.fromCharCode(b))
      .join('');

    // チャレンジを一時的に保存（実際の実装では、セッションストアやRedisなどに保存）
    // 今回は簡易版のため、クライアントに返すのみ

    return NextResponse.json({
      challenge,
      allowCredentials,
      userId: userData.id,
    });
  } catch (error: any) {
    console.error('Passkey authenticate begin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

