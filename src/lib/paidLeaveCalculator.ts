/**
 * 有給休暇計算ユーティリティ
 * 日本の労働基準法に基づく有給休暇の付与日数を計算する
 *
 * Full-time entitlement table:
 *   6mo  = 10d
 *   1.5y = 11d
 *   2.5y = 12d
 *   3.5y = 14d
 *   4.5y = 16d
 *   5.5y = 18d
 *   6.5y+= 20d
 *
 * Part-time: proportional based on weekly working days (3-4 days)
 */

// Full-time entitlement lookup: [years of service (continuous from hire), days granted]
const FULLTIME_TABLE: [number, number][] = [
  [0.5, 10],
  [1.5, 11],
  [2.5, 12],
  [3.5, 14],
  [4.5, 16],
  [5.5, 18],
  [6.5, 20],
];

// Part-time proportional table keyed by weekly working days
// Each entry: [years of service, days granted]
const PARTTIME_TABLE: Record<number, [number, number][]> = {
  4: [
    [0.5, 7],
    [1.5, 8],
    [2.5, 9],
    [3.5, 10],
    [4.5, 12],
    [5.5, 13],
    [6.5, 15],
  ],
  3: [
    [0.5, 5],
    [1.5, 6],
    [2.5, 6],
    [3.5, 8],
    [4.5, 9],
    [5.5, 10],
    [6.5, 11],
  ],
  2: [
    [0.5, 3],
    [1.5, 4],
    [2.5, 4],
    [3.5, 5],
    [4.5, 6],
    [5.5, 6],
    [6.5, 7],
  ],
  1: [
    [0.5, 1],
    [1.5, 2],
    [2.5, 2],
    [3.5, 2],
    [4.5, 3],
    [5.5, 3],
    [6.5, 3],
  ],
};

/**
 * Calculate years of continuous service from hire date to a reference date.
 */
function yearsOfService(hireDate: string, referenceDate?: string): number {
  const hire = new Date(hireDate);
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const diffMs = ref.getTime() - hire.getTime();
  return diffMs / (365.25 * 24 * 60 * 60 * 1000);
}

/**
 * Look up entitlement from a table based on years of service.
 * Returns the matching tier's days, or 0 if not yet eligible.
 */
function lookupEntitlement(table: [number, number][], years: number): number {
  let result = 0;
  for (const [threshold, days] of table) {
    if (years >= threshold) {
      result = days;
    } else {
      break;
    }
  }
  return result;
}

/**
 * Calculate paid leave entitlement based on Japanese labor law.
 *
 * @param hireDate - ISO date string (YYYY-MM-DD) of hire
 * @param employmentType - 'fulltime' or 'parttime'
 * @param weeklyDays - Weekly working days (required for part-time, typically 1-4)
 * @returns Number of paid leave days entitled
 */
export function calculateEntitlement(
  hireDate: string,
  employmentType: 'fulltime' | 'parttime',
  weeklyDays?: number
): number {
  const years = yearsOfService(hireDate);

  if (employmentType === 'fulltime' || (weeklyDays && weeklyDays >= 5)) {
    return lookupEntitlement(FULLTIME_TABLE, years);
  }

  // Part-time
  const days = weeklyDays || 3;
  const clampedDays = Math.max(1, Math.min(4, days));
  const table = PARTTIME_TABLE[clampedDays];
  if (!table) return 0;
  return lookupEntitlement(table, years);
}

/**
 * Calculate the expiry date for a granted leave balance.
 * Under Japanese law, paid leave expires 2 years from the grant date.
 *
 * @param grantDate - ISO date string (YYYY-MM-DD) of the grant
 * @returns ISO date string of the expiry (2 years later)
 */
export function calculateExpiryDate(grantDate: string): string {
  const d = new Date(grantDate);
  d.setFullYear(d.getFullYear() + 2);
  return d.toISOString().split('T')[0];
}

/**
 * Calculate the next grant date based on hire date.
 * First grant at 6 months, then every anniversary year thereafter.
 *
 * @param hireDate - ISO date string (YYYY-MM-DD)
 * @returns ISO date string of the next grant date
 */
export function calculateNextGrantDate(hireDate: string): string {
  const hire = new Date(hireDate);
  const now = new Date();
  const years = yearsOfService(hireDate);

  if (years < 0.5) {
    // Next grant is at 6 months from hire
    const next = new Date(hire);
    next.setMonth(next.getMonth() + 6);
    return next.toISOString().split('T')[0];
  }

  // After the first grant (at 6 months), subsequent grants are at 1.5y, 2.5y, etc.
  // Find the next anniversary: 6mo, then each year after that
  const firstGrant = new Date(hire);
  firstGrant.setMonth(firstGrant.getMonth() + 6);

  let nextGrant = new Date(firstGrant);
  while (nextGrant <= now) {
    nextGrant.setFullYear(nextGrant.getFullYear() + 1);
  }

  return nextGrant.toISOString().split('T')[0];
}

/**
 * Get the current fiscal year (April-March in Japan).
 */
export function getCurrentFiscalYear(): number {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  return month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * Format days count for display.
 */
export function formatDays(days: number): string {
  if (Number.isInteger(days)) return `${days}日`;
  return `${days.toFixed(1)}日`;
}
