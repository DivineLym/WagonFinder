type Tier = { max: number; rate: number };

const TIERS: Tier[] = [
  { max: 5,        rate: 12_000 },
  { max: 20,       rate: 10_000 },
  { max: 60,       rate:  8_000 },
  { max: 80,       rate:  5_000 },
  { max: 120,      rate:  3_000 },
  { max: 160,      rate:  1_496 },
  { max: 200,      rate:  1_308 },
  { max: 299,      rate:  1_016 },
  { max: 399,      rate:    884 },
  { max: 599,      rate:    810 },
  { max: 999,      rate:    739 },
  { max: 1999,     rate:    721 },
  { max: 2999,     rate:    693 },
  { max: 4999,     rate:    675 },
  { max: 9999,     rate:    628 },
  { max: Infinity, rate:    554 },
];

function ratePerWagon(wagonCount: number): number {
  const tier = TIERS.find((t) => wagonCount <= t.max);
  return tier?.rate ?? 554;
}

export function calcCommission(wagonCount: number, _dealType?: 'spot' | 'lease'): {
  ratePerWagon: number;
  totalBase: number;
  perParty: number;
} {
  const rate = ratePerWagon(wagonCount);
  const totalBase = rate * wagonCount;
  const perParty = Math.round(totalBase * 0.65);
  return { ratePerWagon: rate, totalBase, perParty };
}
