'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import type { Profile, GU12Order, Wagon } from '@/types';
import type { ExistingApp } from '@/app/(dashboard)/wagon-owner/market/page';
import { Store, ArrowRight, Train, Package, CheckCircle, XCircle, Clock } from 'lucide-react';

const WAGON_TYPE_LABELS: Record<string, string> = {
  tank: 'Цистерна', hopper: 'Хоппер', flatcar: 'Платформа',
  boxcar: 'Крытый', gondola: 'Полувагон', refrigerator: 'Рефрижератор',
};

type PublicOrder = GU12Order & { shipper: { company_name: string; bin: string } };

interface Props {
  profile: Profile;
  orders: PublicOrder[];
  myWagons: Wagon[];
  existingApps?: ExistingApp[];
}

export function CargoMarket({ profile, orders, myWagons, existingApps = [] }: Props) {
  const [applying, setApplying] = useState<string | null>(null); // orderId while bulk submitting
  // Per order: set of selected wagon IDs to submit
  const [selectedWagons, setSelectedWagons] = useState<Record<string, Set<string>>>({});
  const [message, setMessage] = useState<Record<string, string>>({});
  const [orderErrors, setOrderErrors] = useState<Record<string, string>>({});

  // Track submitted apps in this session
  const [sessionApps, setSessionApps] = useState<ExistingApp[]>([]);

  const allApps = [...existingApps, ...sessionApps];

  // Per order: set of wagon IDs with ACCEPTED status only (truly busy)
  function acceptedWagonsForOrder(orderId: string): Set<string> {
    return new Set(
      allApps.filter((a) => a.gu12_order_id === orderId && a.status === 'accepted').map((a) => a.wagon_id)
    );
  }

  // All apps for this order (any status) — to show status chips
  function appsForOrder(orderId: string): ExistingApp[] {
    return allApps.filter((a) => a.gu12_order_id === orderId);
  }

  function appStatusForWagon(orderId: string, wagonId: string): string | null {
    return allApps.find((a) => a.gu12_order_id === orderId && a.wagon_id === wagonId)?.status ?? null;
  }

  function toggleWagon(orderId: string, wagonId: string) {
    setSelectedWagons((prev) => {
      const cur = new Set(prev[orderId] ?? []);
      cur.has(wagonId) ? cur.delete(wagonId) : cur.add(wagonId);
      return { ...prev, [orderId]: cur };
    });
  }

  async function applyToOrder(orderId: string) {
    const wagonIds = [...(selectedWagons[orderId] ?? [])];
    if (!wagonIds.length) {
      setOrderErrors((e) => ({ ...e, [orderId]: 'Выберите хотя бы один вагон' }));
      return;
    }
    setApplying(orderId);
    setOrderErrors((e) => { const n = { ...e }; delete n[orderId]; return n; });

    const supabase = createClient();
    const rows = wagonIds.map((wagonId) => ({
      gu12_order_id: orderId,
      wagon_owner_id: profile.id,
      wagon_id: wagonId,
      message: message[orderId] || null,
    }));

    const { error: err } = await supabase.from('wagon_owner_pending_requests').upsert(rows, { onConflict: 'gu12_order_id,wagon_id' });

    if (err) {
      setOrderErrors((e) => ({ ...e, [orderId]: err.message }));
    } else {
      setSessionApps((s) => [
        ...s,
        ...wagonIds.map((wId) => ({ id: `${orderId}-${wId}`, gu12_order_id: orderId, wagon_id: wId, status: 'pending' })),
      ]);
      setSelectedWagons((s) => { const n = { ...s }; delete n[orderId]; return n; });
      setMessage((m) => { const n = { ...m }; delete n[orderId]; return n; });
    }
    setApplying(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Биржа грузов</h2>
        <p className="text-sm text-gray-500 mt-0.5">Открытые заявки ГУ-12 от грузоотправителей</p>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-xl bg-white text-center">
          <Store size={36} className="text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Нет доступных грузов</p>
          <p className="text-sm text-gray-400 mt-1">Грузоотправители пока не опубликовали заявки</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const acceptedWagons = acceptedWagonsForOrder(order.id);
            const existingAppsForOrder = appsForOrder(order.id);
            // Compatible wagons excluding only accepted ones
            const compatibleWagons = myWagons.filter(
              (w) => (!order.wagon_type_required || w.wagon_type === order.wagon_type_required)
                   && !acceptedWagons.has(w.id)
            );
            const checkedForOrder = selectedWagons[order.id] ?? new Set<string>();
            const allAccepted = compatibleWagons.length === 0 && myWagons.some(
              (w) => !order.wagon_type_required || w.wagon_type === order.wagon_type_required
            );

            return (
              <div key={order.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold text-blue-700">{order.gu12_number}</span>
                      <Badge variant="success">Активна</Badge>
                    </div>
                    <div className="text-base font-semibold text-gray-900">{order.cargo_name}</div>
                    <div className="text-xs text-gray-400 font-mono mt-0.5">ЕТСНГ: {order.cargo_etsng_code}</div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <div className="font-medium text-gray-700">{order.shipper?.company_name ?? '—'}</div>
                    <div className="text-xs">БИН {order.shipper?.bin ?? '—'}</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Маршрут</div>
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{order.departure_esr_code}</span>
                      <ArrowRight size={12} className="text-gray-400" />
                      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{order.arrival_esr_code}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{order.departure_station_name} → {order.arrival_station_name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Тип вагона</div>
                    <div className="flex items-center gap-1 text-gray-700">
                      <Train size={13} className="text-blue-500" />
                      {order.wagon_type_required ? WAGON_TYPE_LABELS[order.wagon_type_required] : 'Любой'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Требуется вагонов</div>
                    <div className="font-semibold text-gray-900">{order.quantity_planned - order.quantity_fulfilled}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Период</div>
                    <div className="text-gray-700 text-xs">{formatDate(order.period_start)} – {formatDate(order.period_end)}</div>
                  </div>
                </div>

                {/* Wagon selection + status chips */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  {myWagons.length === 0 ? (
                    <p className="text-sm text-gray-400">У вас нет верифицированных активных вагонов</p>
                  ) : allAccepted ? (
                    <p className="text-sm text-gray-400">Все подходящие вагоны приняты на этот груз</p>
                  ) : compatibleWagons.length === 0 ? (
                    <p className="text-sm text-gray-400">Нет подходящих вагонов ({order.wagon_type_required ? WAGON_TYPE_LABELS[order.wagon_type_required] : ''})</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-xs text-gray-500 font-medium">Выберите вагоны для подачи заявки:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {compatibleWagons.map((w) => {
                          const status = appStatusForWagon(order.id, w.id);
                          const isChecked = checkedForOrder.has(w.id);
                          const hasExisting = existingAppsForOrder.some((a) => a.wagon_id === w.id);
                          return (
                            <label key={w.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                              isChecked ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleWagon(order.id, w.id)}
                                className="rounded border-gray-300 text-blue-600 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-mono text-sm font-medium text-gray-900">{w.number}</div>
                                <div className="text-xs text-gray-400">{WAGON_TYPE_LABELS[w.wagon_type]} · {w.payload_capacity_tons}т</div>
                              </div>
                              {hasExisting && status && (
                                <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                                  status === 'accepted' ? 'bg-green-100 text-green-700' :
                                  status === 'rejected' ? 'bg-red-100 text-red-600' :
                                  'bg-amber-100 text-amber-700'
                                }`}>
                                  {status === 'accepted' ? <CheckCircle size={10} /> : status === 'rejected' ? <XCircle size={10} /> : <Clock size={10} />}
                                  {status === 'accepted' ? 'Принят' : status === 'rejected' ? 'Отклонён' : 'На рассмотрении'}
                                </div>
                              )}
                            </label>
                          );
                        })}
                      </div>
                      {orderErrors[order.id] && (
                        <p className="text-xs text-red-600 flex items-center gap-1"><XCircle size={12} />{orderErrors[order.id]}</p>
                      )}
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="flex-1 min-w-[200px]">
                          <label className="block text-xs text-gray-500 mb-1">Комментарий (необязательно)</label>
                          <input
                            className="w-full rounded-lg border border-gray-200 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Дополнительная информация"
                            value={message[order.id] ?? ''}
                            onChange={(e) => setMessage((m) => ({ ...m, [order.id]: e.target.value }))}
                          />
                        </div>
                        <Button
                          size="sm"
                          loading={applying === order.id}
                          disabled={checkedForOrder.size === 0}
                          onClick={() => applyToOrder(order.id)}
                        >
                          <Package size={13} />
                          {checkedForOrder.size > 1 ? `Подать ${checkedForOrder.size} вагона(-ов)` : 'Подать заявку'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
