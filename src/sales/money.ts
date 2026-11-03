/** Money is handled in integer minor units (paise/cents) to avoid float bugs. */
export const toMinor = (value: string): number => {
  const [whole, frac = ''] = value.split('.');
  return Number(whole) * 100 + Number((frac + '00').slice(0, 2));
};

export const fromMinor = (minor: number): string =>
  `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
