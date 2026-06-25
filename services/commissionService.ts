// Commission tiers per wagon, based on KTZ organizer fee schedule.
// Source: table of organizer reward rates (KZT incl. VAT, per wagon).

type Tier = { max: number; rate: number };

const SPOT_TIERS: Tier[] = [
  { max: 5,   rate: 12_000 },
  { max: 20,  rate: 10_000 },
  { max: 30,  rate:  8_000 },
  { max: 59,  rate:  5_000 },
  { max: 200, rate:  3_000 },
];

const LEASE_TIERS: Tier[] = [
  { max: 19,   rate: 1_881 },
  { max: 49,   rate: 1_496 },
  { max: 99,   rate: 1_308 },
  { max: 299,  rate: 1_016 },
  { max: 399,  rate:   884 },
  { max: 599,  rate:   810 },
  { max: 999,  rate:   739 },
  { max: 1999, rate:   721 },
  { max: 2999, rate:   693 },
  { max: 4999, rate:   675 },
  { max: 9999, rate:   628 },
  { max: Infinity, rate: 554 },
];

function ratePerWagon(wagonCount: number, dealType: 'spot' | 'lease'): number {
  const tiers = dealType === 'spot' ? SPOT_TIERS : LEASE_TIERS;
  const tier = tiers.find((t) => wagonCount <= t.max);
  return tier?.rate ?? tiers[tiers.length - 1].rate;
}

// Each party pays 65% of (rate × wagon count).
export function calcCommission(wagonCount: number, dealType: 'spot' | 'lease'): {
  ratePerWagon: number;
  totalBase: number;
  perParty: number;
} {
  const rate = ratePerWagon(wagonCount, dealType);
  const totalBase = rate * wagonCount;
  const perParty = Math.round(totalBase * 0.65);
  return { ratePerWagon: rate, totalBase, perParty };
}
