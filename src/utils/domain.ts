/**
 * ドメイン設定ユーティリティ
 *
 * シングルドメイン構成:
 * - Roots.inu.co.jp (メインドメイン)
 *   - /business → 施設管理（Biz）
 *   - /career   → スタッフ向け
 *   - /parent   → 保護者向け
 *   - /admin    → プラットフォーム管理
 *   - /login    → 統一ログイン
 */

// メインドメイン
const MAIN_DOMAIN = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'Roots.inu.co.jp';

/**
 * 現在のパスからアプリケーションタイプを取得
 * @returns 'business' | 'career' | 'parent' | 'admin' | 'other'
 */
export type AppType = 'business' | 'career' | 'parent' | 'admin' | 'other';

export function getAppType(): AppType {
  if (typeof window === 'undefined') {
    return 'other';
  }

  const pathname = window.location.pathname;

  if (pathname.startsWith('/business')) {
    return 'business';
  }
  if (pathname.startsWith('/career')) {
    return 'career';
  }
  if (pathname.startsWith('/parent')) {
    return 'parent';
  }
  if (pathname.startsWith('/admin')) {
    return 'admin';
  }

  return 'other';
}

/**
 * 現在のベースURLを取得
 */
export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return `https://${MAIN_DOMAIN}`;
}

/**
 * メインドメインを取得
 */
export function getMainDomain(): string {
  return MAIN_DOMAIN;
}

/**
 * メインドメインのベースURLを取得
 */
export function getMainBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${window.location.protocol}//${window.location.host}`;
    }
    return window.location.origin;
  }
  return `https://${MAIN_DOMAIN}`;
}

/**
 * 各アプリケーションのURLを取得
 */
export function getBusinessUrl(): string {
  return `${getMainBaseUrl()}/business`;
}

export function getCareerUrl(): string {
  return `${getMainBaseUrl()}/career`;
}

export function getParentUrl(): string {
  return `${getMainBaseUrl()}/parent`;
}

export function getAdminUrl(): string {
  return `${getMainBaseUrl()}/admin`;
}

export function getLoginUrl(): string {
  return `${getMainBaseUrl()}/login`;
}

/**
 * 招待リンク用のベースURLを取得
 * @param type 招待の種類
 */
export function getInvitationBaseUrl(type: 'staff' | 'parent' = 'staff'): string {
  const baseUrl = getMainBaseUrl();

  if (type === 'parent') {
    return `${baseUrl}/parent`;
  }
  return `${baseUrl}/career`;
}

/**
 * Auth コールバックURLを取得
 */
export function getAuthCallbackUrl(type: 'business' | 'career' | 'parent' = 'business'): string {
  return `${getMainBaseUrl()}/auth/callback?type=${type}`;
}

// ========================================
// 後方互換性のための関数（非推奨）
// ========================================

/**
 * @deprecated Use getAppType() instead
 */
export function getBizDomain(): string {
  return MAIN_DOMAIN;
}

/**
 * @deprecated Use getMainDomain() instead
 */
export function getClientDomain(): string {
  return MAIN_DOMAIN;
}

/**
 * @deprecated Use getMainDomain() instead
 */
export function getPersonalDomain(): string {
  return MAIN_DOMAIN;
}

/**
 * @deprecated Use getMainBaseUrl() instead
 */
export function getBizBaseUrl(): string {
  return getMainBaseUrl();
}

/**
 * @deprecated Use getMainBaseUrl() instead
 */
export function getClientBaseUrl(): string {
  return getMainBaseUrl();
}

/**
 * @deprecated Use getMainBaseUrl() instead
 */
export function getPersonalBaseUrl(): string {
  return getMainBaseUrl();
}
