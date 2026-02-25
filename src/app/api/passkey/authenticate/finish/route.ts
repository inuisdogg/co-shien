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

    // 公開鍵をUint8Arrayに変換
    // データベースから取得したpublic_keyはBufferまたはバイナリデータとして保存されている
    // Uint8Arrayを作成する際は、内容を新しいArrayBufferにコピーする必要がある
    let publicKeyBuffer: Buffer;
    if (Buffer.isBuffer(passkeyData.public_key)) {
      publicKeyBuffer = passkeyData.public_key;
    } else if (typeof passkeyData.public_key === 'string') {
      // Base64エンコードされた文字列の場合
      publicKeyBuffer = Buffer.from(passkeyData.public_key, 'base64');
    } else if (passkeyData.public_key instanceof Uint8Array) {
      // 既にUint8Arrayの場合は、Bufferに変換
      publicKeyBuffer = Buffer.from(passkeyData.public_key);
    } else {
      // ArrayBufferやその他の形式の場合
      publicKeyBuffer = Buffer.from(passkeyData.public_key);
    }
    
    // Bufferから新しいArrayBufferを作成し、Uint8Arrayに変換
    // これにより、型の互換性の問題を回避
    const arrayBuffer = new ArrayBuffer(publicKeyBuffer.length);
    const publicKey = new Uint8Array(arrayBuffer);
    publicKey.set(publicKeyBuffer);

    // credentialIDはbase64url形式の文字列として保存されているため、そのまま使用
    const credentialIDString = passkeyData.credential_id;

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
    const rpID = (() => {
      const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || '';
      const hostname = host.split(':')[0];
      if (hostname.startsWith('biz.') || hostname.includes('biz.Roots')) {
        return 'biz.Roots.inu.co.jp';
      }
      return 'my.Roots.inu.co.jp';
    })();

    const origin = request.headers.get('origin') || 
      `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host') || request.headers.get('x-forwarded-host') || rpID}`;

    // 認証レスポンスを検証
    // 最新の@simplewebauthn/serverでは、credentialオブジェクトとして渡す
    // idはbase64url形式の文字列、publicKeyはUint8Array型である必要がある
    const opts: VerifyAuthenticationResponseOpts = {
      response: credential,
      expectedChallenge: Buffer.from(decodedChallenge).toString('base64url'),
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credentialIDString,
        publicKey: publicKey,
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
