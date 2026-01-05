import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * パスキー認証完了API
 * クライアントからの認証レスポンスを検証
 */
export async function POST(request: NextRequest) {
  try {
    const {
      credentialId,
      clientDataJSON,
      authenticatorData,
      signature,
      userHandle,
      facilityCode,
      loginId,
    } = await request.json();

    if (!credentialId || !loginId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
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

    // TODO: 実際のWebAuthn検証ロジックを実装する必要があります
    // 現時点では、簡易版として認証が成功したと仮定してユーザーIDを返します
    // 本番環境では、公開鍵の検証、署名の検証などを行う必要があります

    return NextResponse.json({
      success: true,
      userId: userData.id,
    });
  } catch (error: any) {
    console.error('Passkey authenticate finish error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

