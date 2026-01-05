import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { VerifyAuthenticationResponseOpts } from '@simplewebauthn/server';

/**
 * パスキー認証完了API
 * クライアントからの認証レスポンスを検証
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      credential: credentialData,
      challenge: expectedChallenge,
      facilityCode,
      loginId,
    } = body;

    if (!credentialData || !loginId || !expectedChallenge) {
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

    // Base64URLをArrayBufferに変換
    const base64UrlDecode = (base64url: string): ArrayBuffer => {
      const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
      const binary = Buffer.from(base64, 'base64');
      return binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength);
    };

    // クレデンシャルIDからパスキーを取得
    const credentialIdBase64 = credentialData.id || credentialData.rawId;

    const { data: passkeyData, error: passkeyError } = await supabase
      .from('passkeys')
      .select('id, user_id, credential_id, public_key, counter')
      .eq('user_id', userData.id)
      .eq('credential_id', credentialIdBase64)
      .single();

    if (passkeyError || !passkeyData) {
      return NextResponse.json(
        { error: 'Passkey not found' },
        { status: 404 }
      );
    }

    // 公開鍵をBufferに変換
    const publicKey = Buffer.from(passkeyData.public_key);
    const credentialID = Buffer.from(passkeyData.credential_id, 'base64url');

    // レスポンスを正しい形式に変換
    const credential = {
      ...credentialData,
      id: credentialIdBase64,
      rawId: base64UrlDecode(credentialData.rawId || credentialData.id),
      response: {
        ...credentialData.response,
        clientDataJSON: base64UrlDecode(credentialData.response.clientDataJSON),
        authenticatorData: base64UrlDecode(credentialData.response.authenticatorData),
        signature: base64UrlDecode(credentialData.response.signature),
        userHandle: credentialData.response.userHandle 
          ? base64UrlDecode(credentialData.response.userHandle) 
          : undefined,
      },
    };

    // チャレンジをデコード
    const decodedChallenge = base64UrlDecode(expectedChallenge);

    // RP IDを決定
    const rpId = (() => {
      const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || '';
      const hostname = host.split(':')[0];
      if (hostname.startsWith('biz.') || hostname.includes('biz.co-shien')) {
        return 'biz.co-shien.inu.co.jp';
      }
      return 'my.co-shien.inu.co.jp';
    })();

    const origin = request.headers.get('origin') || 
      `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host') || request.headers.get('x-forwarded-host') || rpId}`;

    // 認証レスポンスを検証
    const opts: VerifyAuthenticationResponseOpts = {
      response: credential,
      expectedChallenge: Buffer.from(decodedChallenge).toString('base64url'),
      expectedOrigin: origin,
      expectedRPID: rpId,
      authenticator: {
        credentialID,
        credentialPublicKey: publicKey,
        counter: passkeyData.counter || 0,
      },
      requireUserVerification: false,
    };

    const verification = await verifyAuthenticationResponse(opts);

    if (!verification.verified) {
      return NextResponse.json(
        { error: 'Authentication verification failed' },
        { status: 400 }
      );
    }

    // カウンターを更新（リプレイ攻撃防止）
    const { error: updateError } = await supabase
      .from('passkeys')
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', passkeyData.id);

    if (updateError) {
      console.error('Passkey counter update error:', updateError);
      // カウンター更新の失敗は致命的ではないが、ログに記録
    }

    return NextResponse.json({
      success: true,
      userId: userData.id,
    });
  } catch (error: any) {
    console.error('Passkey authenticate finish error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
