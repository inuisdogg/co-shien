import { describe, it, expect } from 'vitest';
import { getJapaneseHolidays, isJapaneseHoliday } from '../japaneseHolidays';

describe('getJapaneseHolidays', () => {
  it('should include New Year\'s Day (January 1)', () => {
    const holidays = getJapaneseHolidays(2024);
    expect(holidays).toContain('2024-01-01');
  });

  it('should include National Foundation Day (February 11)', () => {
    const holidays = getJapaneseHolidays(2024);
    expect(holidays).toContain('2024-02-11');
  });

  it('should include Constitution Memorial Day (May 3)', () => {
    const holidays = getJapaneseHolidays(2024);
    expect(holidays).toContain('2024-05-03');
  });

  it('should include Greenery Day (May 4)', () => {
    const holidays = getJapaneseHolidays(2024);
    expect(holidays).toContain('2024-05-04');
  });

  it('should include Children\'s Day (May 5)', () => {
    const holidays = getJapaneseHolidays(2024);
    expect(holidays).toContain('2024-05-05');
  });

  it('should include Mountain Day (August 11)', () => {
    const holidays = getJapaneseHolidays(2024);
    expect(holidays).toContain('2024-08-11');
  });

  it('should include Culture Day (November 3)', () => {
    const holidays = getJapaneseHolidays(2024);
    expect(holidays).toContain('2024-11-03');
  });

  it('should include Labour Thanksgiving Day (November 23)', () => {
    const holidays = getJapaneseHolidays(2024);
    expect(holidays).toContain('2024-11-23');
  });

  it('should include Emperor\'s Birthday on Feb 23 for years >= 2020', () => {
    const holidays2024 = getJapaneseHolidays(2024);
    expect(holidays2024).toContain('2024-02-23');
    // Should NOT include Dec 23 for 2024
    expect(holidays2024).not.toContain('2024-12-23');
  });

  it('should include Emperor\'s Birthday on Dec 23 for years < 2020', () => {
    const holidays2019 = getJapaneseHolidays(2019);
    expect(holidays2019).toContain('2019-12-23');
    // Should NOT include Feb 23 for 2019
    expect(holidays2019).not.toContain('2019-02-23');
  });

  it('should include Coming of Age Day (second Monday of January)', () => {
    // In 2024, Jan 1 is Monday, so second Monday is Jan 8
    const holidays = getJapaneseHolidays(2024);
    expect(holidays).toContain('2024-01-08');
  });

  it('should include Showa Day (April 29)', () => {
    const holidays = getJapaneseHolidays(2024);
    expect(holidays).toContain('2024-04-29');
  });

  it('should include a Spring Equinox date in March', () => {
    const holidays = getJapaneseHolidays(2024);
    const springEquinox = holidays.find(
      (h) => h.startsWith('2024-03-') && h !== '2024-03-11'
    );
    expect(springEquinox).toBeDefined();
    // Spring equinox is typically March 20 or 21
    const day = parseInt(springEquinox!.split('-')[2], 10);
    expect(day).toBeGreaterThanOrEqual(19);
    expect(day).toBeLessThanOrEqual(22);
  });

  it('should include an Autumn Equinox date in September', () => {
    const holidays = getJapaneseHolidays(2024);
    const autumnEquinox = holidays.find(
      (h) => h.startsWith('2024-09-') && parseInt(h.split('-')[2], 10) >= 21
    );
    expect(autumnEquinox).toBeDefined();
    const day = parseInt(autumnEquinox!.split('-')[2], 10);
    expect(day).toBeGreaterThanOrEqual(21);
    expect(day).toBeLessThanOrEqual(24);
  });

  it('should return holidays sorted in chronological order', () => {
    const holidays = getJapaneseHolidays(2024);
    const sorted = [...holidays].sort();
    expect(holidays).toEqual(sorted);
  });

  it('should not have duplicate entries', () => {
    const holidays = getJapaneseHolidays(2024);
    const uniqueHolidays = [...new Set(holidays)];
    expect(holidays.length).toBe(uniqueHolidays.length);
  });

  it('should return holidays for different years without error', () => {
    expect(() => getJapaneseHolidays(2020)).not.toThrow();
    expect(() => getJapaneseHolidays(2025)).not.toThrow();
    expect(() => getJapaneseHolidays(2030)).not.toThrow();
  });
});

describe('isJapaneseHoliday', () => {
  it('should return true for New Year\'s Day', () => {
    expect(isJapaneseHoliday('2024-01-01')).toBe(true);
  });

  it('should return true for Constitution Memorial Day', () => {
    expect(isJapaneseHoliday('2024-05-03')).toBe(true);
  });

  it('should return false for a regular weekday', () => {
    // 2024-06-12 is a Wednesday, not a holiday
    expect(isJapaneseHoliday('2024-06-12')).toBe(false);
  });

  it('should return false for a typical non-holiday date', () => {
    expect(isJapaneseHoliday('2024-03-15')).toBe(false);
  });

  it('should correctly identify holidays across year boundaries', () => {
    expect(isJapaneseHoliday('2023-01-01')).toBe(true);
    expect(isJapaneseHoliday('2025-01-01')).toBe(true);
  });
});
