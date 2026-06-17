'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchGU12 } from '@/services/ktzService';
import { Button } from '@/components/ui/button';
import type { Profile, GU12Order, PendingApplication } from '@/types';
import { formatDate } from '@/lib/utils';
import { seedShipperData } from '@/services/seedService';
import { RefreshCw, AlertCircle, Package, Train, ArrowRight, DatabaseZap, Globe, GlobeLock } from 'lucide-react';

const GU12_STATUS_MAP: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'default' | 'outline' | 'danger' }> = {
  active:               { label: 'Активна',    variant: 'success' },
  partially_fulfilled:  { label: 'Частично',   variant: 'warning' },
  fulfilled:            { label: 'Выполнена',  variant: 'outline' },
  cancelled:            { label: 'Отменена',   variant: 'danger'  },
};

type AppWithDetails = PendingApplication & {
  wagon: { number: string; wagon_type: string; payload_capacity_tons: number | null };
  wagon_owner: { company_name: string | null; full_name: string; bin: string | null };
};

interface Props { profile: Profile; initialOrders: GU12Order[]; initialApplications: AppWithDetails[]; }

export function ShipperCargoView({ profile, initialOrders, initialApplications }: Props) {
  const [orders, setOrders] = useState<GU12Order[]>(initialOrders);
  const [applications, setApplications] = useState<AppWithDetails[]>(initialApplications);
  const payerCode = profile.ktz_payer_code ?? '';
  const [syncing, startSync] = useTransition();
  const [syncError, setSyncError] = useState('');
  const [syncSuccess, setSyncSuccess] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPublishing, setBulkPublishing] = useState(false);
  const [cargoTab, setCargoTab] = useState<'active' | 'fulfilled'>('active');

  function handleSync() {
    setSyncError(''); setSyncSuccess('');
    startSync(async () => {
      try {
        const ktzOrders = await fetchGU12(payerCode);
        const supabase = createClient();
        const rows = ktzOrders.map((o) => ({
          shipper_id: profile.id,
          gu12_number: o.gu12_number,
          cargo_etsng_code: o.cargo_etsng_code,
          cargo_name: o.cargo_name,
          departure_esr_code: o.departure_esr_code,
          departure_station_name: o.departure_station_name,
          arrival_esr_code: o.arrival_esr_code,
          arrival_station_name: o.arrival_station_name,
          quantity_planned: o.quantity_planned,
          period_start: o.period_start,
          period_end: o.period_end,
          wagon_type_required: o.wagon_type_required,
        }));
        const { error } = await supabase.from('gu12_orders').upsert(rows, { onConflict: 'gu12_number' });
        if (error) throw new Error(error.message);
        const { data: fresh } = await supabase.from('gu12_orders').select('*').eq('shipper_id', profile.id).order('created_at', { ascending: false });
        setOrders((fresh ?? []) as GU12Order[]);
        setSyncSuccess(`Загружено ${ktzOrders.length} заявок ГУ-12`);
      } catch (err: unknown) {
        setSyncError(err instanceof Error ? err.message : 'Ошибка синхронизации');
      }
    });
  }

  const activeOrders = orders.filter(o => o.status !== 'fulfilled' && o.status !== 'cancelled');
  const fulfilledOrders = orders.filter(o => o.status === 'fulfilled' || o.status === 'cancelled');
  const visibleOrders = cargoTab === 'active' ? activeOrders : fulfilledOrders;
  const allSelectedActive = activeOrders.length > 0 && activeOrders.every((o) => selected.has(o.id));

  function toggleSelect(id: string) {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  async function bulkPublish(publish: boolean) {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkPublishing(true);
    const supabase = createClient();
    await supabase.from('gu12_orders').update({ is_public: publish }).in('id', ids);
    setOrders((prev) => prev.map((o) => selected.has(o.id) ? { ...o, is_public: publish } : o));
    setSelected(new Set());
    setBulkPublishing(false);
  }

  async function togglePublic(order: GU12Order) {
    setToggling(order.id);
    const supabase = createClient();
    const { error } = await supabase
      .from('gu12_orders')
      .update({ is_public: !order.is_public })
      .eq('id', order.id);
    if (!error) {
      setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, is_public: !o.is_public } : o));
    }
    setToggling(null);
  }

  return (
    <div className="h-full flex flex-col gap-4 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Заявки ГУ-12</h2>
          <p className="text-sm text-gray-500 mt-0.5">{profile.company_name} · БИН {profile.bin}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSync} loading={syncing} size="md">
            <RefreshCw size={14} /> Синхр. с КТЖ
          </Button>
        </div>
      </div>

      {!payerCode && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-700">
          <AlertCircle size={14} /> Укажите код плательщика КТЖ в профиле для синхронизации заявок
        </div>
      )}

      {syncError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
          <AlertCircle size={14} /> {syncError}
        </div>
      )}
      {syncSuccess && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700">
          ✓ {syncSuccess}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-200 shrink-0">
        {([
          { key: 'active',    label: `Мои грузы${activeOrders.length > 0 ? ` (${activeOrders.length})` : ''}` },
          { key: 'fulfilled', label: `Выполнение плана${fulfilledOrders.length > 0 ? ` (${fulfilledOrders.length})` : ''}` },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => { setCargoTab(key); setSelected(new Set()); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              cargoTab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >{label}</button>
        ))}
      </div>

      {visibleOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-xl bg-white text-center">
          <Package size={36} className="text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Нет заявок ГУ-12</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Введите код плательщика и нажмите «Синхр. с КТЖ»</p>
          <Button variant="secondary" size="sm" loading={seeding} onClick={async () => {
            setSeeding(true);
            try {
              const count = await seedShipperData(profile.id);
              setSyncSuccess(`Загружено ${count} тестовых заявок ГУ-12`);
              window.location.reload();
            } catch (e: unknown) {
              setSyncError(e instanceof Error ? e.message : 'Ошибка');
            } finally { setSeeding(false); }
          }}>
            <DatabaseZap size={14} /> Загрузить тестовые данные
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-0 flex-1">
          {cargoTab === 'active' && selected.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-b border-blue-100 rounded-t-xl shrink-0">
              <span className="text-sm text-blue-700 font-medium">Выбрано: {selected.size}</span>
              <button onClick={() => bulkPublish(true)} disabled={bulkPublishing}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50">
                <Globe size={12} /> Опубликовать
              </button>
              <button onClick={() => bulkPublish(false)} disabled={bulkPublishing}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50">
                <GlobeLock size={12} /> Снять
              </button>
              <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-blue-500 hover:text-blue-700 cursor-pointer">Сбросить</button>
            </div>
          )}
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {cargoTab === 'active' && (
                    <th className="px-3 py-3 w-8">
                      <input type="checkbox" checked={allSelectedActive}
                        onChange={() => setSelected(allSelectedActive ? new Set() : new Set(activeOrders.map(o => o.id)))}
                        className="rounded border-gray-300 text-blue-600 cursor-pointer" />
                    </th>
                  )}
                  {(cargoTab === 'active'
                    ? ['№ ГУ-12', 'Груз (ЕТСНГ)', 'Маршрут', 'Отгружено', 'Период', '']
                    : ['№ ГУ-12', 'Груз (ЕТСНГ)', 'Маршрут', 'Выполнено', 'Период']
                  ).map((h) => (
                    <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visibleOrders.map((order) => {
                  const isSelected = selected.has(order.id);
                  const wagonLabel = ({ tank:'Цистерна',hopper:'Хоппер',flatcar:'Платформа',boxcar:'Крытый',gondola:'Полувагон',refrigerator:'Рефрижератор' } as Record<string,string>)[order.wagon_type_required ?? ''] ?? order.wagon_type_required;
                  const pct = order.quantity_planned > 0 ? Math.round((order.quantity_fulfilled / order.quantity_planned) * 100) : 0;
                  return (
                    <tr key={order.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/40' : ''}`}>
                      {cargoTab === 'active' && (
                        <td className="px-3 py-3">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(order.id)}
                            className="rounded border-gray-300 text-blue-600 cursor-pointer" />
                        </td>
                      )}
                      <td className="px-3 py-3 font-mono text-xs text-blue-700 font-medium whitespace-nowrap">{order.gu12_number}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900 text-xs">{order.cargo_name ?? '—'}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="font-mono text-xs text-gray-400">{order.cargo_etsng_code}</span>
                          {wagonLabel && (
                            <span className="flex items-center gap-0.5 text-xs text-gray-500">
                              <span className="text-gray-300">·</span>
                              <Train size={11} className="text-blue-400" />
                              {wagonLabel}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-gray-700">
                          <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{order.departure_esr_code}</span>
                          <ArrowRight size={11} className="text-gray-400" />
                          <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{order.arrival_esr_code}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{order.departure_station_name} → {order.arrival_station_name}</div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1 min-w-[80px]">
                          <div className="flex items-baseline gap-0.5">
                            <span className="font-semibold text-gray-900">{order.quantity_fulfilled}</span>
                            <span className="text-gray-400 text-xs">/{order.quantity_planned}</span>
                            <span className={`text-xs ml-1 ${pct >= 80 ? 'text-green-600' : pct >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{
                              width: `${pct}%`,
                              backgroundColor: `hsl(${Math.pow(pct / 100, 2) * 120}, 80%, 45%)`,
                            }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(order.period_start)} – {formatDate(order.period_end)}
                      </td>
                      {cargoTab === 'active' && (
                        <td className="px-3 py-3">
                          <button
                            title={order.is_public ? 'Опубликовано на бирже' : 'Приватно — скрыто от биржи'}
                            disabled={toggling === order.id}
                            onClick={() => togglePublic(order)}
                            className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              order.is_public
                                ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                                : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'
                            }`}
                          >
                            {order.is_public ? <Globe size={14} /> : <GlobeLock size={14} />}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

