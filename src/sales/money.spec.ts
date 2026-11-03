import { fromMinor, toMinor } from './money';

describe('money helpers', () => {
  it('converts decimal strings to integer minor units without float error', () => {
    expect(toMinor('0.10')).toBe(10);
    expect(toMinor('35.50')).toBe(3550);
    expect(toMinor('19')).toBe(1900);
    expect(toMinor('1234.5')).toBe(123450);
  });

  it('formats minor units back to a 2-decimal string', () => {
    expect(fromMinor(3550)).toBe('35.50');
    expect(fromMinor(5)).toBe('0.05');
    expect(fromMinor(100)).toBe('1.00');
  });

  it('survives a classic float trap (0.1 x 3)', () => {
    expect(fromMinor(toMinor('0.10') * 3)).toBe('0.30');
  });
});
