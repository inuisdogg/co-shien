import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import type { GenerateAuthenticationOptionsOpts } from '@simplewebauthn/server';

/**
 * パスキー認証開始API
 * チャレンジを生成してクライアントに返す
 *
 * loginIdが空の場合: Discoverable Credential（パスキー自動検出）フローを使用
 * loginIdが指定の場合: 特定ユーザーのパスキーを指定して認証
 */
export async function POST(request: NextRequest) {
  try {
    const { facilityCode, loginId } = await request.json();

    // RP IDを決定（単一ドメイン roots.inu.co.jp でパスベースルーティング）
    const rpID = 'roots.inu.co.jp';

    // ===== Discoverable Credential フロー（loginIdなし） =====
    if (!loginId) {
      // allowCredentialsを空にすることで、ブラウザがデバイスに保存された
      // すべてのクレデンシャルからユーザーに選択させる
      const opts: GenerateAuthenticationOptionsOpts = {
        rpID,
        allowCredentials: [],
        userVerification: 'preferred',
        timeout: 60000,
      };

      const options = await generateAuthenticationOptions(opts);

      // Discoverableフローではチャレンジをセッション的に管理
      // challenge自体をレスポンスに含め、finishで検証する
      // 一時チャレンジをDBに保存（discoverable_challenge テーブルまたはグローバル管理）
      // ここではシンプルにchallengeをレスポンスに含める
      return NextResponse.json({
        ...options,
        discoverable: true,
      });
    }

    // ===== 通常フロー（loginId指定） =====

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

    // 認証オプションを生成
    const opts: GenerateAuthenticationOptionsOpts = {
      rpID,
      allowCredentials,
      userVerification: 'preferred',
      timeout: 60000,
    };

    const options = await generateAuthenticationOptions(opts);

    // チャレンジをデータベースに保存（サーバーサイドで管理）
    await supabase
      .from('users')
      .update({
        passkey_challenge: options.challenge,
        passkey_challenge_expires: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .eq('id', userData.id);

    return NextResponse.json({
      ...options,
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
