import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateAge, calculateAgeWithMonths } from '../ageCalculation';

describe('calculateAgeWithMonths', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should calculate age correctly for a birthday well in the past', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15'));

    const result = calculateAgeWithMonths('2020-01-15');
    expect(result.years).toBe(4);
    expect(result.months).toBe(5);
    expect(result.display).toBe('4歳5ヶ月');
  });

  it('should return 0 years and 0 months on exact birthday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-10'));

    const result = calculateAgeWithMonths('2024-03-10');
    expect(result.years).toBe(0);
    expect(result.months).toBe(0);
    expect(result.display).toBe('0歳0ヶ月');
  });

  it('should handle the day before a birthday correctly', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-09'));

    const result = calculateAgeWithMonths('2023-03-10');
    // March 9 is before March 10, so 11 months old
    expect(result.years).toBe(0);
    expect(result.months).toBe(11);
  });

  it('should handle leap year birthday (Feb 29)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-02-28'));

    const result = calculateAgeWithMonths('2024-02-29');
    // Feb 28 < Feb 29 so day hasn't come yet, so months = 12 - 1 = 11
    expect(result.years).toBe(0);
    expect(result.months).toBe(11);
  });

  it('should calculate a 1-year-old correctly', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15'));

    const result = calculateAgeWithMonths('2024-06-15');
    expect(result.years).toBe(1);
    expect(result.months).toBe(0);
    expect(result.display).toBe('1歳0ヶ月');
  });

  it('should handle infant age (less than 1 month)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-20'));

    const result = calculateAgeWithMonths('2024-01-05');
    expect(result.years).toBe(0);
    expect(result.months).toBe(0);
  });

  it('should handle a child turning exactly N years old on their birthday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-07-04'));

    const result = calculateAgeWithMonths('2019-07-04');
    expect(result.years).toBe(5);
    expect(result.months).toBe(0);
    expect(result.display).toBe('5歳0ヶ月');
  });

  it('should produce the correct display format in Japanese', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-12-25'));

    const result = calculateAgeWithMonths('2021-05-10');
    expect(result.display).toMatch(/^\d+歳\d+ヶ月$/);
  });
});

describe('calculateAge', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return only the years portion', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15'));

    expect(calculateAge('2020-01-15')).toBe(4);
  });

  it('should return 0 for a newborn', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15'));

    expect(calculateAge('2024-06-15')).toBe(0);
  });

  it('should not count a birthday that has not happened this year yet', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-14'));

    // Born on June 15, 2020 -- today is June 14, 2024
    // Birthday hasn't happened yet this year
    expect(calculateAge('2020-06-15')).toBe(3);
  });
});
