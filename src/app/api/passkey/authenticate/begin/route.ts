import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type { GenerateAuthenticationOptionsOpts } from '@simplewebauthn/server';

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

    // ユーザーのパスキーを取得
    const { data: passkeys, error: passkeyError } = await supabase
      .from('passkeys')
      .select('credential_id, counter')
      .eq('user_id', userData.id)
      .eq('login_id', loginId);

    if (passkeyError || !passkeys || passkeys.length === 0) {
      return NextResponse.json(
        { error: 'No passkeys found for this user' },
        { status: 404 }
      );
    }

    // 許可するクレデンシャルのリストを作成
    // idはbase64url形式の文字列として提供する必要がある
    const allowCredentials = passkeys.map((pk) => ({
      id: pk.credential_id, // 既にbase64url形式の文字列として保存されている
      type: 'public-key' as const,
      transports: [] as AuthenticatorTransport[],
    }));

    // RP IDを決定
    const rpId = (() => {
      const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || '';
      const hostname = host.split(':')[0];
      if (hostname.startsWith('biz.') || hostname.includes('biz.co-shien')) {
        return 'biz.co-shien.inu.co.jp';
      }
      return 'my.co-shien.inu.co.jp';
    })();

    // 認証オプションを生成
    const opts: GenerateAuthenticationOptionsOpts = {
      rpID: rpId,
      allowCredentials,
      userVerification: 'preferred',
      timeout: 60000,
    };

    const options = await generateAuthenticationOptions(opts);

    return NextResponse.json({
      ...options,
      userId: userData.id,
    });
  } catch (error: any) {
    console.error('Passkey authenticate begin error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
