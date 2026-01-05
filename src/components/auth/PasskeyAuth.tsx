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

      const options = await challengeResponse.json();

      // サーバーから返されたオプションをBase64URLからArrayBufferに変換
      if (options.challenge) {
        options.challenge = Uint8Array.from(
          atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')),
          (c) => c.charCodeAt(0)
        );
      }
      
      if (options.user?.id) {
        options.user.id = Uint8Array.from(
          atob(options.user.id.replace(/-/g, '+').replace(/_/g, '/')),
          (c) => c.charCodeAt(0)
        );
      }

      if (options.excludeCredentials) {
        options.excludeCredentials = options.excludeCredentials.map((cred: any) => ({
          ...cred,
          id: Uint8Array.from(
            atob(cred.id.replace(/-/g, '+').replace(/_/g, '/')),
            (c) => c.charCodeAt(0)
          ),
        }));
      }

      const publicKeyCredentialCreationOptions = options as PublicKeyCredentialCreationOptions;

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('パスキーの作成に失敗しました');
      }

      // レスポンスをサーバーに送信
      // Base64URLエンコード用のヘルパー関数
      const base64UrlEncode = (buffer: ArrayBuffer): string => {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      };

      const response = credential.response as AuthenticatorAttestationResponse;
      
      // Base64URLエンコードされた文字列に変換
      const clientDataJSON = base64UrlEncode(response.clientDataJSON);
      const attestationObject = base64UrlEncode(response.attestationObject);
      const credentialId = base64UrlEncode(credential.rawId);
      
      // チャレンジを取得（optionsから）
      // Uint8ArrayをArrayBufferに変換
      const challengeBuffer = publicKeyCredentialCreationOptions.challenge as Uint8Array;
      const challengeArrayBuffer = new ArrayBuffer(challengeBuffer.length);
      const challengeView = new Uint8Array(challengeArrayBuffer);
      challengeView.set(challengeBuffer);
      const challenge = base64UrlEncode(challengeArrayBuffer);

      const finishResponse = await fetch('/api/passkey/register/finish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential: {
            id: credentialId,
            rawId: credentialId,
            response: {
              clientDataJSON,
              attestationObject,
            },
            type: credential.type,
          },
          challenge,
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

      const options = await challengeResponse.json();

      // allowCredentialsが空の場合は、パスキーが登録されていないことを示す
      // ただし、エラーではなくユーザーフレンドリーなメッセージを表示
      if (!options.allowCredentials || options.allowCredentials.length === 0) {
        throw new Error('パスキーが登録されていません。まずパスキーを登録してください。');
      }

      // サーバーから返されたオプションをBase64URLからArrayBufferに変換
      if (options.challenge) {
        options.challenge = Uint8Array.from(
          atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')),
          (c) => c.charCodeAt(0)
        );
      }

      if (options.allowCredentials) {
        options.allowCredentials = options.allowCredentials.map((cred: any) => ({
          ...cred,
          id: Uint8Array.from(
            atob(cred.id.replace(/-/g, '+').replace(/_/g, '/')),
            (c) => c.charCodeAt(0)
          ),
        }));
      }

      const publicKeyCredentialRequestOptions = options as PublicKeyCredentialRequestOptions;

      const assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      }) as PublicKeyCredential;

      if (!assertion) {
        throw new Error('パスキー認証に失敗しました');
      }

      // レスポンスをサーバーに送信
      // Base64URLエンコード用のヘルパー関数
      const base64UrlEncode = (buffer: ArrayBuffer): string => {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      };

      const response = assertion.response as AuthenticatorAssertionResponse;
      
      // Base64URLエンコードされた文字列に変換
      const clientDataJSON = base64UrlEncode(response.clientDataJSON);
      const authenticatorData = base64UrlEncode(response.authenticatorData);
      const signature = base64UrlEncode(response.signature);
      const userHandle = response.userHandle ? base64UrlEncode(response.userHandle) : null;
      const credentialId = base64UrlEncode(assertion.rawId);
      
      // チャレンジを取得（optionsから）
      // Uint8ArrayをArrayBufferに変換
      const challengeBuffer = publicKeyCredentialRequestOptions.challenge as Uint8Array;
      const challengeArrayBuffer = new ArrayBuffer(challengeBuffer.length);
      const challengeView = new Uint8Array(challengeArrayBuffer);
      challengeView.set(challengeBuffer);
      const challenge = base64UrlEncode(challengeArrayBuffer);

      const finishResponse = await fetch('/api/passkey/authenticate/finish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential: {
            id: credentialId,
            rawId: credentialId,
            response: {
              clientDataJSON,
              authenticatorData,
              signature,
              userHandle,
            },
            type: assertion.type,
          },
          challenge,
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

