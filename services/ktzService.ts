/**
 * KTZ Mock Service
 * Simulates KTZ (Kazakhstan Temir Zholy) ASOUP / EK IODV API calls.
 * Replace fetch calls with real KTZ endpoints when API access is granted.
 */

import type {
  KTZGu12Data,
  KTZWagonData,
  KTZTrackingData,
  WagonType,
} from '@/types';

// Simulated network delay
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Station reference (subset of KTZ ESR codes) ────────────────────────────
const ESR_STATIONS: Record<string, string> = {
  '67010': 'Алматы-1',
  '67012': 'Алматы-2',
  '67030': 'Алматы-Товарная',
  '65010': 'Нур-Султан (Астана)',
  '65020': 'Астана-Товарная',
  '63100': 'Шымкент',
  '62100': 'Актобе',
  '66100': 'Семей',
  '60100': 'Актау-Морской',
  '60110': 'Бейнеу',
  '61100': 'Атырау',
  '64100': 'Павлодар',
  '63200': 'Тараз',
  '65300': 'Экибастуз',
  '63500': 'Арысь',
};

const ESR_CODES = Object.keys(ESR_STATIONS);

// ── ETSNG cargo reference ───────────────────────────────────────────────────
const ETSNG_CARGOS: Record<string, { name: string; type: WagonType }> = {
  '411062': { name: 'Нефть сырая', type: 'tank' },
  '411001': { name: 'Нефтепродукты светлые', type: 'tank' },
  '411082': { name: 'Мазут', type: 'tank' },
  '223001': { name: 'Уголь каменный', type: 'gondola' },
  '161002': { name: 'Зерно пшеница', type: 'hopper' },
  '161021': { name: 'Ячмень', type: 'hopper' },
  '421001': { name: 'Удобрения минеральные', type: 'hopper' },
  '011001': { name: 'Черные металлы', type: 'flatcar' },
  '891001': { name: 'Контейнеры 20 фут', type: 'flatcar' },
  '331001': { name: 'Цемент', type: 'hopper' },
  '124001': { name: 'Руда железная', type: 'gondola' },
};

const ETSNG_CODES = Object.keys(ETSNG_CARGOS);

// ── Mock wagon tech data ────────────────────────────────────────────────────
const WAGON_TYPE_SPECS: Record<WagonType, Partial<KTZWagonData>> = {
  tank: {
    wagon_type: 'tank',
    payload_capacity_tons: 72,
    volume_m3: 85,
    model_number: 'ЖС-72',
    tare_weight_tons: 25.6,
  },
  hopper: {
    wagon_type: 'hopper',
    payload_capacity_tons: 70,
    volume_m3: 88,
    model_number: 'Хоппер-70',
    tare_weight_tons: 22.8,
  },
  flatcar: {
    wagon_type: 'flatcar',
    payload_capacity_tons: 71,
    volume_m3: 0,
    model_number: 'ПВ-71',
    tare_weight_tons: 21.0,
  },
  boxcar: {
    wagon_type: 'boxcar',
    payload_capacity_tons: 68,
    volume_m3: 120,
    model_number: 'КР-68',
    tare_weight_tons: 24.2,
  },
  gondola: {
    wagon_type: 'gondola',
    payload_capacity_tons: 69,
    volume_m3: 73,
    model_number: 'ПВ-69',
    tare_weight_tons: 23.0,
  },
  refrigerator: {
    wagon_type: 'refrigerator',
    payload_capacity_tons: 40,
    volume_m3: 92,
    model_number: 'РФ-40',
    tare_weight_tons: 44.0,
  },
};

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ── fetchGU12 ───────────────────────────────────────────────────────────────
/**
 * Fetches GU-12 cargo orders for a shipper by their 7-digit KTZ payer code.
 * In production: POST to ASOUP API with payerCode.
 */
export async function fetchGU12(payerCode: string): Promise<KTZGu12Data[]> {
  await delay(800 + Math.random() * 400);

  if (!/^\d{7}$/.test(payerCode)) {
    throw new Error('Неверный формат кода плательщика (должно быть 7 цифр)');
  }

  // Generate 3–6 realistic mock orders
  const count = 3 + Math.floor(Math.random() * 4);
  const today = new Date();

  return Array.from({ length: count }, (_, i) => {
    const etsngCode = randomFrom(ETSNG_CODES);
    const cargo = ETSNG_CARGOS[etsngCode];
    const depCode = randomFrom(ESR_CODES);
    let arrCode = randomFrom(ESR_CODES);
    while (arrCode === depCode) arrCode = randomFrom(ESR_CODES);

    const periodStart = addDays(today, i * 5);
    const periodEnd = addDays(today, i * 5 + 30);

    return {
      gu12_number: `ГУ12-${payerCode}-${String(i + 1).padStart(3, '0')}`,
      cargo_etsng_code: etsngCode,
      departure_esr_code: depCode,
      arrival_esr_code: arrCode,
      quantity_planned: 5 + Math.floor(Math.random() * 20),
      period_start: periodStart,
      period_end: periodEnd,
    };
  });
}

// ── verifyWagon ─────────────────────────────────────────────────────────────
/**
 * Fetches technical passport data for a wagon by its 8-digit number.
 * In production: GET from EK IODV API.
 * Marks as non-operational if next_repair_date is in the past.
 */
export async function verifyWagon(wagonNumber: string): Promise<KTZWagonData> {
  await delay(600 + Math.random() * 300);

  if (!/^\d{8}$/.test(wagonNumber)) {
    throw new Error('Неверный формат номера вагона (должно быть 8 цифр)');
  }

  // Deterministic type based on last digit for consistency
  const lastDigit = parseInt(wagonNumber[7]);
  const types: WagonType[] = ['tank', 'hopper', 'flatcar', 'boxcar', 'gondola', 'refrigerator'];
  const wagonType = types[lastDigit % types.length];
  const specs = WAGON_TYPE_SPECS[wagonType];

  const today = new Date();

  // 20% chance of overdue repair (non-operational)
  const seed = parseInt(wagonNumber.slice(-4));
  const isOverdue = seed % 5 === 0;

  const lastRepair = new Date(today);
  lastRepair.setMonth(lastRepair.getMonth() - (isOverdue ? 14 : 6));

  const nextRepair = new Date(lastRepair);
  nextRepair.setFullYear(nextRepair.getFullYear() + 1);

  const next_repair_date = nextRepair.toISOString().split('T')[0];
  const operational_status: 'operational' | 'non_operational' =
    nextRepair < today ? 'non_operational' : 'operational';

  return {
    number: wagonNumber,
    ...specs,
    last_repair_date: lastRepair.toISOString().split('T')[0],
    next_repair_date,
    remaining_mileage_km: isOverdue ? 0 : 80000 + Math.floor(Math.random() * 120000),
    operational_status,
  } as KTZWagonData;
}

// ── getLiveTracking ─────────────────────────────────────────────────────────
/**
 * Returns current station ESR code and last operation for a wagon.
 * In production: subscribe to KTZ ASOUP live feed.
 */
export async function getLiveTracking(wagonNumber: string): Promise<KTZTrackingData> {
  await delay(400 + Math.random() * 200);

  const currentEsr = randomFrom(ESR_CODES);
  const nextEsr = Math.random() > 0.3 ? randomFrom(ESR_CODES.filter((c) => c !== currentEsr)) : null;

  const operations = [
    'Прибытие на станцию',
    'Погрузка завершена',
    'Отправление со станции',
    'Проследование транзитом',
    'Ожидание локомотива',
    'Сортировка на сортировочной горке',
    'Выгрузка завершена',
  ];

  const opTime = new Date();
  opTime.setHours(opTime.getHours() - Math.floor(Math.random() * 6));

  return {
    wagon_number: wagonNumber,
    current_esr_code: currentEsr,
    station_name: ESR_STATIONS[currentEsr],
    last_operation: randomFrom(operations),
    operation_time: opTime.toISOString(),
    next_station_esr: nextEsr,
  };
}
