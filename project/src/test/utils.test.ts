import { describe, it, expect } from 'vitest';
import {
  cn,
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  generateIdempotencyKey,
  truncate,
  initials,
} from '@/lib/utils';

describe('Utility Functions', () => {
  describe('cn', () => {
    it('combines classes properly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
      const condition = false;
      expect(cn('btn', condition && 'hidden', 'active')).toBe('btn active');
    });
  });

  describe('formatCurrency', () => {
    it('formats amount with default PKR currency', () => {
      const res = formatCurrency(50000);
      expect(res).toBe('PKR 50,000');
    });

    it('formats with custom currency (USD, SOL)', () => {
      expect(formatCurrency(1234.5, 'USD')).toBe('USD 1,234.5');
      expect(formatCurrency(2.5, 'SOL')).toBe('SOL 2.5');
    });

    it('handles 0 and negative amounts', () => {
      expect(formatCurrency(0)).toBe('PKR 0');
      expect(formatCurrency(-100)).toBe('PKR -100');
    });
  });

  describe('formatNumber', () => {
    it('formats numbers with thousands separators', () => {
      expect(formatNumber(1000000)).toBe('1,000,000');
      expect(formatNumber(42)).toBe('42');
    });
  });

  describe('formatDate and formatDateTime', () => {
    it('formats ISO date strings', () => {
      const formatted = formatDate('2026-05-15T12:00:00Z');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('May');
    });

    it('formats date and time', () => {
      const formatted = formatDateTime('2026-05-15T14:30:00Z');
      expect(formatted).toContain('2026');
    });
  });

  describe('formatRelativeTime', () => {
    it('returns "just now" for current time', () => {
      const now = new Date();
      expect(formatRelativeTime(now)).toBe('just now');
    });

    it('returns relative minutes or hours', () => {
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
      expect(formatRelativeTime(tenMinsAgo)).toBe('10m ago');

      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
    });
  });

  describe('generateIdempotencyKey', () => {
    it('generates unique non-empty strings', () => {
      const key1 = generateIdempotencyKey();
      const key2 = generateIdempotencyKey();
      expect(key1).toBeTruthy();
      expect(key2).toBeTruthy();
      expect(key1).not.toBe(key2);
    });
  });

  describe('truncate', () => {
    it('truncates long strings with ellipsis', () => {
      expect(truncate('Hello World of AI', 5)).toBe('Hello...');
      expect(truncate('Short', 10)).toBe('Short');
    });
  });

  describe('initials', () => {
    it('extracts initials from full names', () => {
      expect(initials('Ahmed Khan')).toBe('AK');
      expect(initials('Sara')).toBe('S');
      expect(initials('Super Fast Delivery Store')).toBe('SF');
    });
  });
});
