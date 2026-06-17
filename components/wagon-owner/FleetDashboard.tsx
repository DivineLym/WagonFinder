'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getLiveTracking } from '@/services/ktzService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, daysUntil } from '@/lib/utils';
import type { Profile, Wagon, KTZTrackingData } from '@/types';
import { Train, MapPin, Wrench, Plus, RefreshCw, AlertTriangle, DatabaseZap, FlaskConical } from 'lucide-react';
import { seedWagonOwnerData, seedBulkData } from '@/services/seedService';

const TYPE_LABELS: Record<string, string> = {
  tank: 'Цистерна', hopper: 'Хоппер', flatcar: 'Платформа',
  boxcar: 'Крытый', gondola: 'Полувагон', refrigerator: 'Рефрижератор',
};

const STATUS_MAP: Record<string, { label: string; variant: 'success' | 'warning' | 'info' }> = {
  active:    { label: 'Активен',   variant: 'success' },
  in_repair: { label: 'В ремонте', variant: 'warning' },
  booked:    { label: 'Занят',     variant: 'info'    },
};

interface Props { profile: Profile; wagons: Wagon[]; }

export function FleetDashboard({ profile, wagons: initial }: Props) {
  const [wagons, setWagons] = useState(initial);
  const [tracking, setTracking] = useState<Record<string, KTZTrackingData>>({});
  const [trackingAll, setTrackingAll] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [bulkSeeding, setBulkSeeding] = useState(false);
  const [bulkMsg, setBulkMsg] = useState('');

  const total = wagons.length;
  const verified = wagons.filter((w) => w.is_verified).length;
  const active = wagons.filter((w) => w.status === 'active').length;
  const criticalRepair = wagons.filter((w) => { const d = daysUntil(w.next_repair_date); return d !== null && d < 30; }).length;

  async function trackAll() {
    setTrackingAll(true);
    const results = await Promise.all(
      wagons.filter((w) => w.is_verified).map(async (w) => {
        const t = await getLiveTracking(w.number);
        return [w.number, t] as [string, KTZTrackingData];
      })
    );
    setTracking(Object.fromEntries(results));
    const supabase = createClient();
    for (const [num, t] of results) {
      await supabase.from('wagons').update({ current_esr_code: t.current_esr_code, last_operation: t.last_operation, last_tracked_at: t.operation_time }).eq('number', num).eq('owner_id', profile.id);
    }
    setTrackingAll(false);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Мой вагонный парк</h2>
          <p className="text-sm text-gray-500 mt-0.5">{profile.company_name} · БИН {profile.bin}</p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <Button variant="secondary" onClick={trackAll} loading={trackingAll} size="sm">
            <RefreshCw size={13} /> Дислокация (ВМД)
          </Button>
          <span className="text-xs text-gray-400">Срезы в 07:00 и 17:00</span>
        </div>
      </div>

      {bulkMsg && <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">{bulkMsg}</div>}

      {/* Tab header */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <span className="inline-block px-4 py-2 text-sm font-medium border-b-2 border-blue-600 text-blue-700 -mb-px">Мой парк</span>
        <div className="flex gap-2 pb-1">
          <Button
            variant="secondary" size="sm" loading={bulkSeeding}
            onClick={async () => {
              setBulkSeeding(true); setBulkMsg('');
              try {
                const r = await seedBulkData(profile.id, profile.id);
                setBulkMsg(`✓ Загружено ${r.wagons} вагонов`);
                window.location.reload();
              } catch (e: unknown) {
                setBulkMsg(e instanceof Error ? e.message : 'Ошибка');
              } finally { setBulkSeeding(false); }
            }}
          >
            <FlaskConical size={13} /> Тест: 50 вагонов
          </Button>
          <Link href="/wagon-owner/verify">
            <Button size="sm"><Plus size={13} /> Добавить вагон</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Всего вагонов', value: total,         color: 'text-gray-900' },
          { label: 'Сертифицировано', value: verified,    color: 'text-green-700' },
          { label: 'Активны',         value: active,      color: 'text-blue-700'  },
          { label: 'Критический ТО',  value: criticalRepair, color: criticalRepair > 0 ? 'text-red-600' : 'text-gray-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['№ Вагона', 'Тип / Модель', 'Грузопод.', 'Послед. ТО', 'Следующий ТО', 'Пробег (ост.)', 'Дислокация (ЭСР)', 'Статус'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {wagons.length === 0 && (
                <tr><td colSpan={8} className="text-center px-4 py-16 text-gray-400">
                  <Train size={32} className="mx-auto mb-2 text-gray-200" />
                  <p className="mb-3">Вагоны не добавлены</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={seeding}
                    onClick={async () => {
                      setSeeding(true);
                      try {
                        await seedWagonOwnerData(profile.id);
                        window.location.reload();
                      } catch {
                        setSeeding(false);
                      }
                    }}
                  >
                    <DatabaseZap size={14} />
                    Загрузить тестовые данные
                  </Button>
                </td></tr>
              )}
              {wagons.map((wagon) => {
                const days = daysUntil(wagon.next_repair_date);
                const tr = tracking[wagon.number];
                const status = STATUS_MAP[wagon.status] ?? { label: wagon.status, variant: 'default' as const };

                const repairCell = days === null ? <span className="text-gray-400">—</span>
                  : days < 0 ? <div className="flex items-center gap-1 text-red-600 text-xs font-medium"><AlertTriangle size={12} />Просрочен</div>
                  : days < 30 ? <div className="flex items-center gap-1 text-amber-600 text-xs font-medium"><Wrench size={12} />{days} дн.</div>
                  : <span className="text-green-600 text-xs">{days} дн.</span>;

                return (
                  <tr key={wagon.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-blue-700">{wagon.number}</div>
                      {wagon.is_verified
                        ? <Badge variant="success" className="mt-1">Сертифицирован</Badge>
                        : <Badge variant="warning" className="mt-1">Не проверен</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-gray-800">
                        <Train size={13} className="text-gray-400" />
                        {TYPE_LABELS[wagon.wagon_type] ?? wagon.wagon_type}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{wagon.model_number ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{wagon.payload_capacity_tons ? `${wagon.payload_capacity_tons} т` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(wagon.last_repair_date)}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-500 mb-1">{formatDate(wagon.next_repair_date)}</div>
                      {repairCell}
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs">
                      {wagon.remaining_mileage_km != null ? `${wagon.remaining_mileage_km.toLocaleString('ru')} км` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {tr ? (
                        <div>
                          <div className="flex items-center gap-1.5 text-gray-700">
                            <MapPin size={12} className="text-blue-500 shrink-0" />
                            <span className="font-mono text-xs bg-blue-50 px-1.5 py-0.5 rounded text-blue-700">{tr.current_esr_code}</span>
                            <span className="text-xs text-gray-500">{tr.station_name}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">{tr.last_operation}</div>
                          <div className="text-xs text-gray-300 mt-0.5">Срез ВМД: {new Date(tr.operation_time).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</div>
                        </div>
                      ) : wagon.current_esr_code ? (
                        <div>
                          <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{wagon.current_esr_code}</span>
                          <div className="text-xs text-gray-300 mt-0.5">
                            {wagon.last_tracked_at
                              ? `Срез ВМД: ${new Date(wagon.last_tracked_at).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}`
                              : 'Срез ВМД: нет данных'}
                          </div>
                        </div>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
