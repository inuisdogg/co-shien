import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import type { GenerateRegistrationOptionsOpts } from '@simplewebauthn/server';

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

    // 既存のパスキーを取得（既存デバイスを除外するため）
    const { data: existingPasskeys } = await supabase
      .from('passkeys')
      .select('credential_id')
      .eq('user_id', userId);

    // 既存のパスキーを除外するリストを作成
    // idはbase64url形式の文字列として提供する必要がある
    const excludeCredentials = (existingPasskeys || []).map((pk) => ({
      id: pk.credential_id, // 既にbase64url形式の文字列として保存されている
      type: 'public-key' as const,
      transports: [] as AuthenticatorTransport[],
    }));

    // リライイングパーティ（RP）情報を設定
    const rpName = 'Roots';
    const rpID = (() => {
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname.startsWith('biz.') || hostname.includes('biz.Roots')) {
          return 'biz.Roots.inu.co.jp';
        }
        return 'my.Roots.inu.co.jp';
      }
      // サーバーサイドではリクエストから判定
      const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || '';
      const hostname = host.split(':')[0];
      if (hostname.startsWith('biz.') || hostname.includes('biz.Roots')) {
        return 'biz.Roots.inu.co.jp';
      }
      return 'my.Roots.inu.co.jp';
    })();

    // userIDをUint8Arrayに変換
    const userID = new Uint8Array(Buffer.from(userId));

    // 登録オプションを生成
    const opts: GenerateRegistrationOptionsOpts = {
      rpName,
      rpID,
      userID,
      userName: loginId,
      userDisplayName: userData.email || loginId,
      timeout: 60000,
      attestationType: 'direct',
      excludeCredentials,
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'preferred',
        requireResidentKey: false,
      },
      supportedAlgorithmIDs: [-7, -257], // ES256, RS256
    };

    const options = await generateRegistrationOptions(opts);

    // チャレンジをデータベースに保存（サーバーサイドで管理）
    await supabase
      .from('users')
      .update({
        passkey_challenge: options.challenge,
        passkey_challenge_expires: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .eq('id', userId);

    return NextResponse.json(options);
  } catch (error: any) {
    console.error('Passkey register begin error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
