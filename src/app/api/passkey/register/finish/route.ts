import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * パスキー登録完了API
 * クライアントからの登録レスポンスを検証して保存
 */
export async function POST(request: NextRequest) {
  try {
    const {
      credentialId,
      clientDataJSON,
      attestationObject,
      facilityCode,
      loginId,
      userId,
    } = await request.json();

    if (!credentialId || !userId || !loginId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
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

    // TODO: 実際のWebAuthn検証ロジックを実装する必要があります
    // TODO: passkeysテーブルを作成して、credentialIdと公開鍵を保存する必要があります
    // 現時点では、簡易版として登録が成功したと仮定して返答します
    // 本番環境では、attestation objectの検証、公開鍵の抽出と保存などを行う必要があります

    return NextResponse.json({
      success: true,
      credentialId,
    });
  } catch (error: any) {
    console.error('Passkey register finish error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

