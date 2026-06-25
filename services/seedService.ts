import { createClient } from '@/lib/supabase/client';

export async function seedShipperData(profileId: string) {
  const supabase = createClient();

  const orders = [
    {
      shipper_id: profileId,
      gu12_number: 'ГУ12-2231423-001',
      cargo_etsng_code: '411062',
      departure_esr_code: '61100',
      arrival_esr_code: '67030',
      quantity_planned: 12,
      quantity_fulfilled: 3,
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      status: 'active',
    },
    {
      shipper_id: profileId,
      gu12_number: 'ГУ12-2231423-002',
      cargo_etsng_code: '161002',
      departure_esr_code: '65010',
      arrival_esr_code: '63100',
      quantity_planned: 8,
      quantity_fulfilled: 0,
      period_start: '2026-06-10',
      period_end: '2026-07-10',
      status: 'active',
    },
    {
      shipper_id: profileId,
      gu12_number: 'ГУ12-2231423-003',
      cargo_etsng_code: '223001',
      departure_esr_code: '65300',
      arrival_esr_code: '64100',
      quantity_planned: 20,
      quantity_fulfilled: 20,
      period_start: '2026-05-01',
      period_end: '2026-05-31',
      status: 'fulfilled',
    },
    {
      shipper_id: profileId,
      gu12_number: 'ГУ12-2231423-004',
      cargo_etsng_code: '421001',
      departure_esr_code: '62100',
      arrival_esr_code: '67010',
      quantity_planned: 15,
      quantity_fulfilled: 7,
      period_start: '2026-06-15',
      period_end: '2026-07-15',
      status: 'partially_fulfilled',
    },
    {
      shipper_id: profileId,
      gu12_number: 'ГУ12-2231423-005',
      cargo_etsng_code: '011001',
      departure_esr_code: '66100',
      arrival_esr_code: '60100',
      quantity_planned: 6,
      quantity_fulfilled: 0,
      period_start: '2026-07-01',
      period_end: '2026-07-31',
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
      current_esr_code: '66170',
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
      current_esr_code: '69000',
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
      current_esr_code: '69860',
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
      current_esr_code: '67390',
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
  ['70000','Алматы-1'],       ['70010','Алматы-2'],        ['69000','Астана-1'],
  ['66170','Атырау'],         ['66350','Актау-Порт'],      ['68950','Актобе'],
  ['69860','Шымкент'],        ['69800','Арысь'],           ['67390','Қарағанды'],
  ['69610','Павлодар'],       ['70940','Семей'],           ['69470','Екибастуз-2'],
  ['68400','Костанай'],       ['68870','Петропавловск'],   ['71370','Усть-Каменогорск'],
  ['67700','Жезказган'],      ['67750','Балхаш'],          ['70630','Тараз'],
  ['67170','Кызылорда'],      ['66390','Жанаозен'],        ['68700','Кокшетау'],
  ['67430','Темиртау'],       ['70800','Актогай'],         ['70870','Аягоз'],
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

export async function seedBulkData(wagonOwnerId: string) {
  const supabase = createClient();
  const today = new Date();

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

  const { error } = await supabase.from('wagons').upsert(wagons, { onConflict: 'number' });
  if (error) throw new Error(error.message);

  return { wagons: wagons.length };
}
