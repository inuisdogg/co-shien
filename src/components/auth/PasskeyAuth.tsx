/**
 * パスキー認証コンポーネント
 * WebAuthn APIを使用したパスキー認証機能
 */

'use client';

import { useState } from 'react';

interface PasskeyAuthProps {
  onAuthSuccess: (credentialId: string) => void;
  onError: (error: string) => void;
  facilityCode: string;
  loginId: string;
}

export const usePasskeyAuth = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // WebAuthn APIのサポート確認
  const checkSupport = () => {
    const supported = 
      typeof window !== 'undefined' &&
      typeof window.PublicKeyCredential !== 'undefined' &&
      typeof navigator.credentials !== 'undefined' &&
      typeof navigator.credentials.create !== 'undefined';
    
    setIsSupported(supported);
    return supported;
  };

  // パスキー登録
  const registerPasskey = async (facilityCode: string, loginId: string, userId: string) => {
    if (!checkSupport()) {
      throw new Error('このブラウザはパスキーに対応していません');
    }

    setIsRegistering(true);
    try {
      // サーバーからチャレンジを取得
      const challengeResponse = await fetch('/api/passkey/register/begin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facilityCode,
          loginId,
          userId,
        }),
      });

      if (!challengeResponse.ok) {
        throw new Error('パスキー登録の開始に失敗しました');
      }

      const challengeData = await challengeResponse.json();

      // 公開鍵クレデンシャルを作成
      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge: Uint8Array.from(challengeData.challenge, (c: string) => c.charCodeAt(0)),
        rp: {
          name: 'co-shien',
          id: (() => {
            if (typeof window === 'undefined') {
              return 'biz.co-shien.inu.co.jp'; // サーバーサイドのデフォルト
            }
            const appType = window.location.hostname.startsWith('biz.') || window.location.hostname.includes('biz.co-shien')
              ? 'biz'
              : 'personal';
            return appType === 'biz' ? 'biz.co-shien.inu.co.jp' : 'my.co-shien.inu.co.jp';
          })(),
        },
        user: {
          id: Uint8Array.from(userId, (c: string) => c.charCodeAt(0)),
          name: loginId,
          displayName: loginId,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'preferred',
        },
        timeout: 60000,
        attestation: 'direct',
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('パスキーの作成に失敗しました');
      }

      // レスポンスをサーバーに送信
      const response = credential.response as AuthenticatorAttestationResponse;
      const clientDataJSON = new Uint8Array(response.clientDataJSON);
      const attestationObject = new Uint8Array(response.attestationObject);

      const finishResponse = await fetch('/api/passkey/register/finish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credentialId: credential.id,
          clientDataJSON: Array.from(clientDataJSON),
          attestationObject: Array.from(attestationObject),
          facilityCode,
          loginId,
          userId,
        }),
      });

      if (!finishResponse.ok) {
        throw new Error('パスキー登録の完了に失敗しました');
      }

      return credential.id;
    } catch (error: any) {
      throw new Error(error.message || 'パスキー登録に失敗しました');
    } finally {
      setIsRegistering(false);
    }
  };

  // パスキー認証
  const authenticatePasskey = async (facilityCode: string, loginId: string) => {
    if (!checkSupport()) {
      throw new Error('このブラウザはパスキーに対応していません');
    }

    setIsAuthenticating(true);
    try {
      // サーバーからチャレンジを取得
      const challengeResponse = await fetch('/api/passkey/authenticate/begin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facilityCode,
          loginId,
        }),
      });

      if (!challengeResponse.ok) {
        throw new Error('パスキー認証の開始に失敗しました');
      }

      const challengeData = await challengeResponse.json();

      if (!challengeData.allowCredentials || challengeData.allowCredentials.length === 0) {
        throw new Error('登録されたパスキーが見つかりません');
      }

      // 公開鍵クレデンシャルを取得
      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge: Uint8Array.from(challengeData.challenge, (c: string) => c.charCodeAt(0)),
        allowCredentials: challengeData.allowCredentials.map((cred: any) => ({
          id: Uint8Array.from(cred.id, (c: string) => c.charCodeAt(0)),
          type: 'public-key',
        })),
        timeout: 60000,
        userVerification: 'preferred',
      };

      const assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      }) as PublicKeyCredential;

      if (!assertion) {
        throw new Error('パスキー認証に失敗しました');
      }

      // レスポンスをサーバーに送信
      const response = assertion.response as AuthenticatorAssertionResponse;
      const clientDataJSON = new Uint8Array(response.clientDataJSON);
      const authenticatorData = new Uint8Array(response.authenticatorData);
      const signature = new Uint8Array(response.signature);
      const userHandle = response.userHandle ? new Uint8Array(response.userHandle) : null;

      const finishResponse = await fetch('/api/passkey/authenticate/finish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credentialId: assertion.id,
          clientDataJSON: Array.from(clientDataJSON),
          authenticatorData: Array.from(authenticatorData),
          signature: Array.from(signature),
          userHandle: userHandle ? Array.from(userHandle) : null,
          facilityCode,
          loginId,
        }),
      });

      if (!finishResponse.ok) {
        throw new Error('パスキー認証の完了に失敗しました');
      }

      const result = await finishResponse.json();
      return result;
    } catch (error: any) {
      throw new Error(error.message || 'パスキー認証に失敗しました');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return {
    isSupported,
    isRegistering,
    isAuthenticating,
    checkSupport,
    registerPasskey,
    authenticatePasskey,
  };
};

