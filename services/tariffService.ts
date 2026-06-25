/**
 * Улучшенный мок-калькулятор тарифа КТЖ для частных вагонов.
 * Структура формулы соответствует Прейскуранту цен КТЖ (инфраструктурная +
 * локомотивная составляющие), ставки — приближённые к реальным на 2025 год.
 * Для точного расчёта необходим доступ к официальным таблицам КТЖ.
 */

// ─── Матрица реальных жд расстояний между крупными станциями КЗ (км) ──────────
// Источник: Тарифное руководство №4, приближённые значения
const RAIL_DISTANCES: Record<string, Record<string, number>> = {
  '61100': { '67030': 2897, '65010': 2376, '63100': 2432, '42400': 2700, '45678': 2180, '44100': 2140, '48100': 2580, '72000': 1520, '71200': 468,  '64100': 2910 },
  '67030': { '61100': 2897, '65010': 1248, '63100': 703,  '42400': 1900, '45678': 810,  '44100': 947,  '48100': 1480, '72000': 2398, '71200': 3290, '64100': 870  },
  '65010': { '61100': 2376, '67030': 1248, '63100': 1284, '42400': 650,  '45678': 451,  '44100': 212,  '48100': 238,  '72000': 1102, '71200': 2760, '64100': 1640 },
  '63100': { '61100': 2432, '67030': 703,  '65010': 1284, '42400': 1820, '45678': 1090, '44100': 1140, '48100': 1560, '72000': 2040, '71200': 3170, '64100': 220  },
  '42400': { '61100': 2700, '67030': 1900, '65010': 650,  '63100': 1820, '45678': 840,  '44100': 740,  '48100': 430,  '72000': 840,  '71200': 2950, '64100': 2100 },
  '45678': { '61100': 2180, '67030': 810,  '65010': 451,  '63100': 1090, '42400': 840,  '44100': 490,  '48100': 640,  '72000': 1450, '71200': 3100, '64100': 1300 },
  '44100': { '61100': 2140, '67030': 947,  '65010': 212,  '63100': 1140, '42400': 740,  '45678': 490,  '48100': 440,  '72000': 1190, '71200': 2850, '64100': 1380 },
  '48100': { '61100': 2580, '67030': 1480, '65010': 238,  '63100': 1560, '42400': 430,  '45678': 640,  '44100': 440,  '72000': 1180, '71200': 2900, '64100': 1820 },
  '72000': { '61100': 1520, '67030': 2398, '65010': 1102, '63100': 2040, '42400': 840,  '45678': 1450, '44100': 1190, '48100': 1180, '71200': 1960, '64100': 2500 },
  '71200': { '61100': 468,  '67030': 3290, '65010': 2760, '63100': 3170, '42400': 2950, '45678': 3100, '44100': 2850, '48100': 2900, '72000': 1960, '64100': 3550 },
  '64100': { '61100': 2910, '67030': 870,  '65010': 1640, '63100': 220,  '42400': 2100, '45678': 1300, '44100': 1380, '48100': 1820, '72000': 2500, '71200': 3550 },
};

// Координаты станций для fallback расчёта незнакомых ESR
const STATION_COORDS: Record<string, [number, number]> = {
  '61100': [47.12, 51.89],
  '67030': [43.22, 76.85],
  '65010': [51.19, 71.45],
  '63100': [42.31, 69.59],
  '42400': [53.12, 63.62],
  '45678': [52.28, 76.97],
  '44100': [49.80, 73.08],
  '48100': [54.87, 69.15],
  '72000': [50.27, 57.17],
  '71200': [43.65, 51.17],
  '64100': [40.28, 68.78],
};

export function esrDistance(from: string, to: string): number {
  if (from === to) return 0;
  const direct = RAIL_DISTANCES[from]?.[to] ?? RAIL_DISTANCES[to]?.[from];
  if (direct) return direct;

  // Fallback через координаты с коэффициентом извилистости
  const a = STATION_COORDS[from];
  const b = STATION_COORDS[to];
  if (a && b) {
    const dy = (a[0] - b[0]) * 111;
    const dx = (a[1] - b[1]) * Math.cos((a[0] * Math.PI) / 180) * 111;
    return Math.max(50, Math.round(Math.sqrt(dx * dx + dy * dy) * 1.35));
  }
  const diff = Math.abs(parseInt(from, 10) - parseInt(to, 10));
  return Math.min(3000, Math.max(150, Math.round(diff * 0.32)));
}

// ─── Тарифные скобки по расстоянию (₸/тонно-км) ─────────────────────────────
// Ставка убывает с расстоянием (дальние перевозки дешевле на км)
function ratePerTonKm(distKm: number): number {
  if (distKm <=  100) return 8.20;
  if (distKm <=  200) return 7.10;
  if (distKm <=  500) return 6.40;
  if (distKm <= 1000) return 5.80;
  if (distKm <= 2000) return 5.20;
  return 4.70;
}

// Порожний рейс дешевле — ~55% от гружёного
function emptyRatePerTonKm(distKm: number): number {
  return ratePerTonKm(distKm) * 0.55;
}

// ─── Класс груза по ЕТСНГ ────────────────────────────────────────────────────
// 1 — дешевле, 3 — дороже
const ETSNG_CLASS: Record<string, 1 | 2 | 3> = {
  // Уголь, кокс, руда, стройматериалы, удобрения → класс 1
  '10': 1, '11': 1, '12': 1, '13': 1, '14': 1, '15': 1,
  '16': 1, '17': 1, '18': 1, '20': 1, '21': 1, '22': 1,
  '23': 1, '46': 1, '47': 1, '48': 1, '65': 1, '66': 1,
  // Нефть и нефтепродукты, химикаты, металлы, зерно → класс 2
  '40': 2, '41': 2, '42': 2, '43': 2, '44': 2, '45': 2,
  '01': 2, '02': 2, '03': 2, '04': 2, '05': 2, '06': 2,
  '51': 2, '52': 2, '53': 2, '54': 2, '55': 2, '56': 2,
  '57': 2, '58': 2, '59': 2, '61': 2, '62': 2, '63': 2,
  // Готовые изделия, продовольствие, машины → класс 3
  '71': 3, '72': 3, '73': 3, '74': 3, '75': 3, '76': 3,
  '77': 3, '78': 3, '79': 3, '31': 3, '32': 3, '33': 3,
};

const CLASS_MULTIPLIER: Record<1 | 2 | 3, number> = {
  1: 0.80,
  2: 1.00,
  3: 1.42,
};

function getCargoClass(etsngCode: string): 1 | 2 | 3 {
  // Пробуем двузначный префикс
  const prefix2 = etsngCode.slice(0, 2);
  if (ETSNG_CLASS[prefix2]) return ETSNG_CLASS[prefix2];
  const prefix1 = etsngCode.slice(0, 1);
  if (ETSNG_CLASS[prefix1]) return ETSNG_CLASS[prefix1];
  return 2; // по умолчанию
}

// ─── Коэффициент типа вагона ──────────────────────────────────────────────────
const WAGON_TYPE_COEFF: Record<string, number> = {
  gondola:      1.00,
  hopper:       1.00,
  flatcar:      1.05,
  boxcar:       1.10,
  tank:         1.18,
  refrigerator: 1.35,
};

// ─── Минимальная ставка за вагон (за рейс) ───────────────────────────────────
const MIN_CHARGE_PER_WAGON = 25_000; // ₸

// ─── Основная функция ─────────────────────────────────────────────────────────
export interface TariffResult {
  emptyDistKm:    number | null;
  loadedDistKm:   number;
  emptyTariffKzt: number | null;
  loadedTariffKzt: number;
  totalTariffKzt: number | null;
  cargoClass:     1 | 2 | 3;
  // Разбивка для отображения
  infraKzt:       number;
  locoKzt:        number;
}

export function calcTariff(
  currentEsr:    string | null,
  departureEsr:  string,
  arrivalEsr:    string,
  capacityTons:  number,
  wagonType?:    string,
  etsngCode?:    string,
  tareTons?:     number | null,
): TariffResult {
  const cargoClass   = getCargoClass(etsngCode ?? '');
  const classCoeff   = CLASS_MULTIPLIER[cargoClass];
  const typeCoeff    = WAGON_TYPE_COEFF[wagonType ?? 'gondola'] ?? 1.00;
  const tare         = tareTons ?? capacityTons * 0.32; // оценка тары ~32% от грузоподъёмности

  // Гружёный рейс
  const loadedDistKm    = esrDistance(departureEsr, arrivalEsr);
  const loadedRate      = ratePerTonKm(loadedDistKm) * classCoeff * typeCoeff;
  const loadedRaw       = loadedDistKm * capacityTons * loadedRate;
  const loadedTariffKzt = Math.max(MIN_CHARGE_PER_WAGON, Math.round(loadedRaw));

  // Инфраструктурная / локомотивная составляющие (~60/40)
  const infraKzt = Math.round(loadedTariffKzt * 0.60);
  const locoKzt  = Math.round(loadedTariffKzt * 0.40);

  if (!currentEsr) {
    return { emptyDistKm: null, loadedDistKm, emptyTariffKzt: null, loadedTariffKzt, totalTariffKzt: null, cargoClass, infraKzt, locoKzt };
  }

  // Порожний рейс — по таре
  const emptyDistKm    = esrDistance(currentEsr, departureEsr);
  const emptyRate      = emptyRatePerTonKm(emptyDistKm) * typeCoeff;
  const emptyTariffKzt = Math.max(MIN_CHARGE_PER_WAGON, Math.round(emptyDistKm * tare * emptyRate));

  return {
    emptyDistKm,
    loadedDistKm,
    emptyTariffKzt,
    loadedTariffKzt,
    totalTariffKzt: emptyTariffKzt + loadedTariffKzt,
    cargoClass,
    infraKzt,
    locoKzt,
  };
}

export function fmtKzt(n: number): string {
  return n.toLocaleString('ru-RU') + ' ₸';
}
