import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { VerifyRegistrationResponseOpts } from '@simplewebauthn/server';

/**
 * パスキー登録完了API
 * クライアントからの登録レスポンスを検証して保存
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      credential: credentialData,
      challenge: expectedChallenge,
      facilityCode,
      loginId,
      userId,
    } = body;

    if (!credentialData || !userId || !loginId) {
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

    // 既存のパスキーを取得（重複チェック用）
    const { data: existingPasskeys } = await supabase
      .from('passkeys')
      .select('credential_id')
      .eq('user_id', userId);

    // 既存のパスキーを除外するリスト（実際には使用されていないが、一貫性のために保持）
    // idはbase64url形式の文字列として提供する必要がある
    const excludeCredentials = (existingPasskeys || []).map((pk) => ({
      id: pk.credential_id, // 既にbase64url形式の文字列として保存されている
      type: 'public-key' as const,
      transports: [] as AuthenticatorTransport[],
    }));

    // Base64URLをArrayBufferに変換
    const base64UrlDecode = (base64url: string): ArrayBuffer => {
      const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
      const binary = Buffer.from(base64, 'base64');
      return binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength);
    };

    // レスポンスを正しい形式に変換
    const credential = {
      ...credentialData,
      id: credentialData.id || credentialData.rawId,
      rawId: base64UrlDecode(credentialData.rawId || credentialData.id),
      response: {
        ...credentialData.response,
        clientDataJSON: base64UrlDecode(credentialData.response.clientDataJSON),
        attestationObject: base64UrlDecode(credentialData.response.attestationObject),
      },
    };

    // チャレンジをデコード
    const decodedChallenge = base64UrlDecode(expectedChallenge);

    // 登録レスポンスを検証
    const opts: VerifyRegistrationResponseOpts = {
      response: credential,
      expectedChallenge: Buffer.from(decodedChallenge).toString('base64url'),
      expectedOrigin: origin,
      expectedRPID: rpId,
      requireUserVerification: false,
    };

    const verification = await verifyRegistrationResponse(opts);

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: 'Registration verification failed' },
        { status: 400 }
      );
    }

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

    // パスキー情報をデータベースに保存
    const credentialIdBase64 = Buffer.from(credentialID).toString('base64url');

    // デバイス情報を取得（可能であれば）
    const deviceName = credentialData.response?.clientExtensionResults?.devicePublicKey?.transports?.[0] || 
      'Unknown Device';
    const deviceType = credentialData.authenticatorAttachment === 'platform' ? 'platform' : 'cross-platform';

    const { data: passkeyData, error: insertError } = await supabase
      .from('passkeys')
      .insert({
        user_id: userId,
        credential_id: credentialIdBase64,
        public_key: Buffer.from(credentialPublicKey),
        counter: counter || 0,
        device_name: deviceName,
        device_type: deviceType,
        aaguid: verification.registrationInfo.aaguid || null,
        facility_code: facilityCode || null,
        login_id: loginId,
        last_used_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Passkey insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to save passkey', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      credentialId: credentialIdBase64,
    });
  } catch (error: any) {
    console.error('Passkey register finish error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
