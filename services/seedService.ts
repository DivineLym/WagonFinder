import { createClient } from '@/lib/supabase/client';

export async function seedShipperData(profileId: string) {
  const supabase = createClient();

  const orders = [
    {
      shipper_id: profileId,
      gu12_number: 'ГУ12-2231423-001',
      cargo_etsng_code: '411062',
      cargo_name: 'Нефть сырая',
      departure_esr_code: '61100',
      departure_station_name: 'Атырау',
      arrival_esr_code: '67030',
      arrival_station_name: 'Алматы-Товарная',
      quantity_planned: 12,
      quantity_fulfilled: 3,
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      wagon_type_required: 'tank',
      status: 'active',
    },
    {
      shipper_id: profileId,
      gu12_number: 'ГУ12-2231423-002',
      cargo_etsng_code: '161002',
      cargo_name: 'Зерно пшеница',
      departure_esr_code: '65010',
      departure_station_name: 'Нур-Султан (Астана)',
      arrival_esr_code: '63100',
      arrival_station_name: 'Шымкент',
      quantity_planned: 8,
      quantity_fulfilled: 0,
      period_start: '2026-06-10',
      period_end: '2026-07-10',
      wagon_type_required: 'hopper',
      status: 'active',
    },
    {
      shipper_id: profileId,
      gu12_number: 'ГУ12-2231423-003',
      cargo_etsng_code: '223001',
      cargo_name: 'Уголь каменный',
      departure_esr_code: '65300',
      departure_station_name: 'Экибастуз',
      arrival_esr_code: '64100',
      arrival_station_name: 'Павлодар',
      quantity_planned: 20,
      quantity_fulfilled: 20,
      period_start: '2026-05-01',
      period_end: '2026-05-31',
      wagon_type_required: 'gondola',
      status: 'fulfilled',
    },
    {
      shipper_id: profileId,
      gu12_number: 'ГУ12-2231423-004',
      cargo_etsng_code: '421001',
      cargo_name: 'Удобрения минеральные',
      departure_esr_code: '62100',
      departure_station_name: 'Актобе',
      arrival_esr_code: '67010',
      arrival_station_name: 'Алматы-1',
      quantity_planned: 15,
      quantity_fulfilled: 7,
      period_start: '2026-06-15',
      period_end: '2026-07-15',
      wagon_type_required: 'hopper',
      status: 'partially_fulfilled',
    },
    {
      shipper_id: profileId,
      gu12_number: 'ГУ12-2231423-005',
      cargo_etsng_code: '011001',
      cargo_name: 'Черные металлы',
      departure_esr_code: '66100',
      departure_station_name: 'Семей',
      arrival_esr_code: '60100',
      arrival_station_name: 'Актау-Морской',
      quantity_planned: 6,
      quantity_fulfilled: 0,
      period_start: '2026-07-01',
      period_end: '2026-07-31',
      wagon_type_required: 'flatcar',
      status: 'active',
    },
  ];

  const { error } = await supabase
    .from('gu12_orders')
    .upsert(orders, { onConflict: 'gu12_number' });

  if (error) throw new Error(error.message);
  return orders.length;
}

export async function seedWagonOwnerData(profileId: string) {
  const supabase = createClient();

  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const addMonths = (d: Date, n: number) => { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; };

  const wagons = [
    {
      number: '52314789',
      owner_id: profileId,
      is_verified: true,
      wagon_type: 'tank',
      payload_capacity_tons: 72,
      volume_m3: 85,
      model_number: 'ЖС-72',
      tare_weight_tons: 25.6,
      last_repair_date: fmt(addMonths(today, -6)),
      next_repair_date: fmt(addMonths(today, 6)),
      remaining_mileage_km: 145000,
      status: 'active',
      current_esr_code: '61100',
      last_operation: 'Прибытие на станцию',
    },
    {
      number: '63847210',
      owner_id: profileId,
      is_verified: true,
      wagon_type: 'hopper',
      payload_capacity_tons: 70,
      volume_m3: 88,
      model_number: 'Хоппер-70',
      tare_weight_tons: 22.8,
      last_repair_date: fmt(addMonths(today, -4)),
      next_repair_date: fmt(addDays(today, 20)),
      remaining_mileage_km: 18000,
      status: 'active',
      current_esr_code: '65010',
      last_operation: 'Погрузка завершена',
    },
    {
      number: '74920183',
      owner_id: profileId,
      is_verified: true,
      wagon_type: 'gondola',
      payload_capacity_tons: 69,
      volume_m3: 73,
      model_number: 'ПВ-69',
      tare_weight_tons: 23.0,
      last_repair_date: fmt(addMonths(today, -14)),
      next_repair_date: fmt(addDays(today, -30)),
      remaining_mileage_km: 0,
      status: 'in_repair',
      current_esr_code: '63100',
      last_operation: 'Направлен в депо',
    },
    {
      number: '81034567',
      owner_id: profileId,
      is_verified: true,
      wagon_type: 'flatcar',
      payload_capacity_tons: 71,
      volume_m3: 0,
      model_number: 'ПВ-71',
      tare_weight_tons: 21.0,
      last_repair_date: fmt(addMonths(today, -2)),
      next_repair_date: fmt(addMonths(today, 10)),
      remaining_mileage_km: 210000,
      status: 'booked',
      current_esr_code: '67030',
      last_operation: 'Отправление со станции',
    },
    {
      number: '92841076',
      owner_id: profileId,
      is_verified: false,
      wagon_type: 'tank',
      payload_capacity_tons: 72,
      volume_m3: 85,
      model_number: 'ЖС-72',
      tare_weight_tons: 25.6,
      last_repair_date: fmt(addMonths(today, -3)),
      next_repair_date: fmt(addMonths(today, 9)),
      remaining_mileage_km: 98000,
      status: 'active',
      current_esr_code: null,
      last_operation: null,
    },
  ];

  const { error } = await supabase
    .from('wagons')
    .upsert(wagons, { onConflict: 'number' });

  if (error) throw new Error(error.message);
  return wagons.length;
}

// ─── Bulk seed (50 wagons + 50 GU-12 orders) ───────────────────────────────

const WAGON_TYPES = ['tank', 'hopper', 'flatcar', 'boxcar', 'gondola', 'refrigerator'] as const;
const STATUSES_W = ['active', 'active', 'active', 'in_repair', 'booked'] as const;
const MODELS: Record<string, string[]> = {
  tank:         ['ЖС-72', 'ЖС-66', 'ЦС-50'],
  hopper:       ['Хоппер-70', 'Хоппер-60', 'ЦНИИ-3'],
  flatcar:      ['ПВ-71', '13-4012', '13-9808'],
  boxcar:       ['11-066', '11-270', 'ЦМВ-65'],
  gondola:      ['ПВ-69', '12-9853', '12-132'],
  refrigerator: ['БМЗ-5', 'АРВ-Э', 'РС-4'],
};
const STATIONS: [string, string][] = [
  ['61100','Атырау'], ['67030','Алматы-Товарная'], ['65010','Нур-Султан (Астана)'],
  ['63100','Шымкент'], ['44100','Қарағанды'], ['72000','Актобе'],
  ['71200','Ақтау-Теңіз'], ['42400','Костанай'], ['45678','Павлодар'],
  ['66100','Семей'], ['48100','Петропавловск'], ['65300','Екібастуз'],
  ['60100','Ақтау-Морской'], ['62100','Елек'], ['67010','Алматы-1'],
];
const CARGOS: [string, string, (typeof WAGON_TYPES)[number]][] = [
  ['411062','Нефть сырая','tank'],      ['411001','Дизельное топливо','tank'],
  ['161002','Зерно пшеница','hopper'],  ['162001','Зерно ячмень','hopper'],
  ['421001','Удобрения','hopper'],       ['223001','Уголь каменный','gondola'],
  ['011001','Черные металлы','flatcar'], ['012001','Трубы стальные','flatcar'],
  ['311001','Лесоматериалы','flatcar'],  ['891001','Грузы в контейнерах','flatcar'],
  ['591001','Продукты питания','refrigerator'], ['111001','Руда железная','gondola'],
];

function rnd<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rndInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function fmt(d: Date) { return d.toISOString().split('T')[0]; }

export async function seedBulkData(wagonOwnerId: string, shipperId: string) {
  const supabase = createClient();
  const today = new Date();

  // 50 wagons
  const wagons = Array.from({ length: 50 }, (_, i) => {
    const type = rnd(WAGON_TYPES);
    const model = rnd(MODELS[type]);
    const status = rnd(STATUSES_W);
    const nextRepairDays = rndInt(-20, 365);
    const station = rnd(STATIONS);
    return {
      number: String(10000000 + i * 137 + rndInt(0, 99)),
      owner_id: wagonOwnerId,
      is_verified: Math.random() > 0.2,
      wagon_type: type,
      payload_capacity_tons: rndInt(60, 75),
      volume_m3: type === 'flatcar' ? 0 : rndInt(65, 95),
      model_number: model,
      tare_weight_tons: +(rndInt(210, 265) / 10),
      last_repair_date: fmt(addDays(today, -rndInt(30, 540))),
      next_repair_date: fmt(addDays(today, nextRepairDays)),
      remaining_mileage_km: nextRepairDays < 0 ? 0 : rndInt(5000, 250000),
      status: nextRepairDays < 0 ? 'in_repair' : status,
      current_esr_code: Math.random() > 0.15 ? station[0] : null,
      last_operation: rnd(['Прибытие на станцию','Погрузка завершена','Отправление','Выгрузка','Транзит']),
      last_tracked_at: fmt(addDays(today, -rndInt(0, 3))) + 'T07:00:00.000Z',
    };
  });

  // 50 GU-12 orders
  const usedNums = new Set<string>();
  const orders = Array.from({ length: 50 }, (_, i) => {
    const cargo = rnd(CARGOS);
    const dep = rnd(STATIONS);
    let arr = rnd(STATIONS);
    while (arr[0] === dep[0]) arr = rnd(STATIONS);
    const planned = rndInt(4, 20);
    const fulfilled = rndInt(0, planned);
    const status = fulfilled === planned ? 'fulfilled' : fulfilled > 0 ? 'partially_fulfilled' : 'active';
    const startOffset = rndInt(-30, 60);
    let num: string;
    do { num = `ГУ12-BULK-${String(i + 1).padStart(3,'0')}-${rndInt(100,999)}`; } while (usedNums.has(num));
    usedNums.add(num);
    return {
      shipper_id: shipperId,
      gu12_number: num,
      cargo_etsng_code: cargo[0],
      cargo_name: cargo[1],
      departure_esr_code: dep[0],
      departure_station_name: dep[1],
      arrival_esr_code: arr[0],
      arrival_station_name: arr[1],
      quantity_planned: planned,
      quantity_fulfilled: fulfilled,
      period_start: fmt(addDays(today, startOffset)),
      period_end: fmt(addDays(today, startOffset + rndInt(20, 60))),
      wagon_type_required: cargo[2],
      status,
      is_public: false,
    };
  });

  const results = await Promise.all([
    wagonOwnerId
      ? supabase.from('wagons').upsert(wagons, { onConflict: 'number' })
      : Promise.resolve({ error: null }),
    supabase.from('gu12_orders').upsert(orders, { onConflict: 'gu12_number' }),
  ]);

  if (results[0].error) throw new Error('Wagons: ' + results[0].error.message);
  if (results[1].error) throw new Error('Orders: ' + results[1].error.message);
  return { wagons: wagonOwnerId ? wagons.length : 0, orders: orders.length };
}
