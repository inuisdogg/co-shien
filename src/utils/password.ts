/**
 * パスワードハッシュ化ユーティリティ
 * bcryptjs を使用したセキュアなパスワードハッシュ化
 * レガシー SHA-256 ハッシュとの後方互換性を維持
 */

import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

/**
 * パスワードをbcryptでハッシュ化
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * パスワードを検証（bcrypt + レガシーSHA-256対応）
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // bcryptハッシュは $2a$ or $2b$ で始まる
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
    return bcrypt.compare(password, hash);
  }

  // レガシー SHA-256 ハッシュ（64文字hex）
  if (hash.length === 64 && /^[0-9a-f]+$/.test(hash)) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === hash;
  }

  return false;
}

/**
 * レガシーSHA-256ハッシュかどうかを判定
 */
export function isLegacyHash(hash: string): boolean {
  return hash.length === 64 && /^[0-9a-f]+$/.test(hash);
}
