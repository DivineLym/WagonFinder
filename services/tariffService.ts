// Mock KTZ tariff calculator (2026 internal rates)
// Real tariffs require access to closed KTZ tariff tables (Прейскурант цен)

const EMPTY_RATE_PER_TON_KM = 2.2;   // tenge
const LOADED_RATE_PER_TON_KM = 3.8;  // tenge
const TERMINAL_FEE = 8_000;          // tenge per wagon per leg

// Approximate geographic coordinates of major KZ rail stations (lat, lon)
const STATION_COORDS: Record<string, [number, number]> = {
  '61100': [47.12, 51.89],  // Атырау
  '67030': [43.22, 76.85],  // Алматы-Товарная
  '65010': [51.19, 71.45],  // Нур-Султан (Астана)
  '63100': [42.31, 69.59],  // Шымкент
  '42400': [53.12, 63.62],  // Костанай
  '45678': [52.28, 76.97],  // Павлодар
  '44100': [49.80, 73.08],  // Қарағанды
  '48100': [54.87, 69.15],  // Петропавловск
  '72000': [50.27, 57.17],  // Актобе
  '71200': [43.65, 51.17],  // Ақтау
  '64100': [40.28, 68.78],  // Жізақ (узб.)
};

/** Straight-line rail distance estimate between two ESR codes (km) */
export function esrDistance(from: string, to: string): number {
  if (from === to) return 0;
  const a = STATION_COORDS[from];
  const b = STATION_COORDS[to];
  if (a && b) {
    const dy = (a[0] - b[0]) * 111;
    const dx = (a[1] - b[1]) * Math.cos((a[0] * Math.PI) / 180) * 111;
    // 1.35 — average rail detour coefficient for KZ network
    return Math.max(50, Math.round(Math.sqrt(dx * dx + dy * dy) * 1.35));
  }
  // Fallback: numeric ESR difference scaled to km
  const diff = Math.abs(parseInt(from, 10) - parseInt(to, 10));
  return Math.min(3000, Math.max(150, Math.round(diff * 0.32)));
}

export interface TariffResult {
  emptyDistKm: number | null;   // порожний рейс: текущая → погрузка
  loadedDistKm: number;         // гружёный рейс: погрузка → назначение
  emptyTariffKzt: number | null;
  loadedTariffKzt: number;
  totalTariffKzt: number | null; // null if current location unknown
}

export function calcTariff(
  currentEsr: string | null,
  departureEsr: string,
  arrivalEsr: string,
  capacityTons: number,
): TariffResult {
  const loadedDistKm = esrDistance(departureEsr, arrivalEsr);
  const loadedTariffKzt = Math.round(loadedDistKm * capacityTons * LOADED_RATE_PER_TON_KM + TERMINAL_FEE);

  if (!currentEsr) {
    return { emptyDistKm: null, loadedDistKm, emptyTariffKzt: null, loadedTariffKzt, totalTariffKzt: null };
  }

  const emptyDistKm = esrDistance(currentEsr, departureEsr);
  const emptyTariffKzt = Math.round(emptyDistKm * capacityTons * EMPTY_RATE_PER_TON_KM + TERMINAL_FEE);

  return {
    emptyDistKm,
    loadedDistKm,
    emptyTariffKzt,
    loadedTariffKzt,
    totalTariffKzt: emptyTariffKzt + loadedTariffKzt,
  };
}

export function fmtKzt(n: number): string {
  return n.toLocaleString('ru-RU') + ' ₸';
}
