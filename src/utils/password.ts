/**
 * パスワードハッシュ化ユーティリティ
 * ブラウザのSubtleCrypto APIを使用してパスワードをハッシュ化します
 */

/**
 * パスワードをハッシュ化
 * @param password 平文のパスワード
 * @returns ハッシュ化されたパスワード（Base64形式）
 */
export async function hashPassword(password: string): Promise<string> {
  console.log('[hashPassword] Input length:', password.length);
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  console.log('[hashPassword] Encoded data length:', data.length);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  console.log('[hashPassword] Result hash:', hashHex.substring(0, 16) + '...');
  return hashHex;
}

/**
 * パスワードを検証
 * @param password 平文のパスワード
 * @param hash ハッシュ化されたパスワード
 * @returns 一致するかどうか
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}








