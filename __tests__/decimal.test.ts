import { describe, expect, it } from '@jest/globals';
import {
  formatDecimal,
  formatKg,
  formatKgDelta,
  parseDecimal,
  sanitizeDecimalInput,
} from '../src/utils/decimal';

describe('sanitizeDecimalInput', () => {
  it('shows the locale separator whichever one was typed', () => {
    expect(sanitizeDecimalInput('43.5', 'pt')).toBe('43,5');
    expect(sanitizeDecimalInput('43,5', 'pt')).toBe('43,5');
    expect(sanitizeDecimalInput('43,5', 'en')).toBe('43.5');
  });

  it('keeps only one separator, digits, 4 integer and 2 decimal digits', () => {
    expect(sanitizeDecimalInput('4,3,5', 'pt')).toBe('4,35');
    expect(sanitizeDecimalInput('12a kg', 'pt')).toBe('12');
    expect(sanitizeDecimalInput('43,555', 'pt')).toBe('43,55');
    expect(sanitizeDecimalInput('123456', 'pt')).toBe('1234');
    expect(sanitizeDecimalInput(',5', 'pt')).toBe('0,5');
  });

  it('keeps a trailing separator while typing', () => {
    expect(sanitizeDecimalInput('43,', 'pt')).toBe('43,');
    expect(sanitizeDecimalInput('', 'pt')).toBe('');
  });
});

describe('parseDecimal', () => {
  it('reads both separators', () => {
    expect(parseDecimal('43,5')).toBe(43.5);
    expect(parseDecimal('43.5')).toBe(43.5);
    expect(parseDecimal('43,')).toBe(43);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal(',')).toBeNull();
  });
});

describe('formatting', () => {
  it('formats with the locale separator and no grouping', () => {
    expect(formatDecimal(43.5, 'pt')).toBe('43,5');
    expect(formatDecimal(43.5, 'en')).toBe('43.5');
    expect(formatDecimal(40, 'pt')).toBe('40');
    expect(formatDecimal(1200.25, 'pt')).toBe('1200,25');
    expect(formatKg(36.6, 'pt')).toBe('36,6 kg');
    expect(formatKgDelta(2.5, 'pt')).toBe('+2,5 kg');
    expect(formatKgDelta(-1, 'pt')).toBe('−1 kg');
  });
});
