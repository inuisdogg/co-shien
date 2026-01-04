/**
 * ドメイン設定ユーティリティ
 * Biz側とPersonal側のドメインを管理
 */

/**
 * 現在のアプリケーションタイプを取得
 */
export function getAppType(): 'biz' | 'personal' {
  if (typeof window === 'undefined') {
    // サーバーサイド
    return (process.env.NEXT_PUBLIC_APP_TYPE as 'biz' | 'personal') || 'biz';
  }
  
  // クライアントサイド: ホスト名から判定
  const hostname = window.location.hostname;
  if (hostname.includes('biz.co-shien') || hostname === 'biz.co-shien.inu.co.jp') {
    return 'biz';
  }
  if (hostname.includes('my.co-shien') || hostname === 'my.co-shien.inu.co.jp') {
    return 'personal';
  }
  
  // デフォルトは環境変数から
  return (process.env.NEXT_PUBLIC_APP_TYPE as 'biz' | 'personal') || 'biz';
}

/**
 * 現在のベースURLを取得
 */
export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // クライアントサイド: 現在のoriginを使用
    return window.location.origin;
  }
  
  // サーバーサイド: 環境変数から取得
  const appType = getAppType();
  if (appType === 'biz') {
    return process.env.NEXT_PUBLIC_BIZ_DOMAIN 
      ? `https://${process.env.NEXT_PUBLIC_BIZ_DOMAIN}`
      : 'https://biz.co-shien.inu.co.jp';
  } else {
    return process.env.NEXT_PUBLIC_PERSONAL_DOMAIN
      ? `https://${process.env.NEXT_PUBLIC_PERSONAL_DOMAIN}`
      : 'https://my.co-shien.inu.co.jp';
  }
}

/**
 * Biz側のドメインを取得
 */
export function getBizDomain(): string {
  return process.env.NEXT_PUBLIC_BIZ_DOMAIN || 'biz.co-shien.inu.co.jp';
}

/**
 * Personal側のドメインを取得
 */
export function getPersonalDomain(): string {
  return process.env.NEXT_PUBLIC_PERSONAL_DOMAIN || 'my.co-shien.inu.co.jp';
}

/**
 * Biz側のベースURLを取得
 */
export function getBizBaseUrl(): string {
  return `https://${getBizDomain()}`;
}

/**
 * Personal側のベースURLを取得
 */
export function getPersonalBaseUrl(): string {
  return `https://${getPersonalDomain()}`;
}

