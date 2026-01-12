/**
 * ドメイン設定ユーティリティ
 *
 * ドメイン構成:
 * - biz.co-shien.inu.co.jp → スタッフ用（ログイン、ダッシュボード、施設管理）
 * - my.co-shien.inu.co.jp → 利用者（クライアント）専用
 */

/**
 * 現在のアプリケーションタイプを取得
 * @returns 'staff' | 'client'
 */
export function getAppType(): 'biz' | 'personal' {
  if (typeof window === 'undefined') {
    return 'biz';
  }

  const hostname = window.location.hostname;
  if (hostname.includes('my.co-shien') || hostname === 'my.co-shien.inu.co.jp') {
    return 'personal'; // クライアント用ドメイン
  }

  return 'biz'; // スタッフ用ドメイン（デフォルト）
}

/**
 * 現在のベースURLを取得
 */
export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'https://biz.co-shien.inu.co.jp';
}

/**
 * スタッフ用ドメインを取得
 */
export function getBizDomain(): string {
  return process.env.NEXT_PUBLIC_BIZ_DOMAIN || 'biz.co-shien.inu.co.jp';
}

/**
 * クライアント用ドメインを取得
 */
export function getClientDomain(): string {
  return process.env.NEXT_PUBLIC_CLIENT_DOMAIN || 'my.co-shien.inu.co.jp';
}

/**
 * @deprecated Use getClientDomain instead
 */
export function getPersonalDomain(): string {
  return getClientDomain();
}

/**
 * スタッフ用ベースURLを取得（ローカルホスト対応）
 */
export function getBizBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${window.location.protocol}//${window.location.host}`;
    }
  }
  return `https://${getBizDomain()}`;
}

/**
 * クライアント用ベースURLを取得（ローカルホスト対応）
 */
export function getClientBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${window.location.protocol}//${window.location.host}`;
    }
    if (hostname.includes('my.co-shien') || hostname === 'my.co-shien.inu.co.jp') {
      return `${window.location.protocol}//${window.location.host}`;
    }
  }
  return `https://${getClientDomain()}`;
}

/**
 * @deprecated Use getClientBaseUrl instead
 */
export function getPersonalBaseUrl(): string {
  return getClientBaseUrl();
}

/**
 * 招待リンク用のベースURLを取得
 * クライアント招待はmy.ドメイン、スタッフ招待はbiz.ドメインを使用
 */
export function getInvitationBaseUrl(forClient: boolean = false): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${window.location.protocol}//${window.location.host}`;
    }
  }

  if (forClient) {
    return `https://${getClientDomain()}`;
  }
  return `https://${getBizDomain()}`;
}
