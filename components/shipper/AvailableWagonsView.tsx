'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { formatDate, daysUntil } from '@/lib/utils';
import { calcTariff, fmtKzt } from '@/services/tariffService';
import { createClient } from '@/lib/supabase/client';
import type { Profile, Wagon, GU12Order } from '@/types';
import { Train, Wrench, CheckCircle, AlertTriangle, Calculator, Send, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';

type SortKey = 'payload' | 'repair_days' | 'mileage' | 'total';
type SortDir = 'asc' | 'desc';

const TYPE_LABELS: Record<string, string> = {
  tank: 'Цистерна', hopper: 'Хоппер', flatcar: 'Платформа',
  boxcar: 'Крытый', gondola: 'Полувагон', refrigerator: 'Рефрижератор',
};

interface WagonWithOwner extends Wagon {
  owner?: { id: string; full_name: string; company_name: string };
}

interface Props { profile: Profile; wagons: WagonWithOwner[]; orders: GU12Order[]; }

export function AvailableWagonsView({ profile, wagons, orders }: Props) {
  const [filterType, setFilterType] = useState('');
  const [selectedOrder, setSelectedOrder] = useState('');
  // key = `${orderId}-${wagonId}`
  const [requesting, setRequesting] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const defaultDesc: SortKey[] = ['payload', 'mileage', 'repair_days'];

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(defaultDesc.includes(key) ? 'desc' : 'asc'); }
  }

  async function requestWagon(wagon: WagonWithOwner) {
    if (!selectedOrder || !wagon.owner?.id) return;
    const key = `${selectedOrder}-${wagon.id}`;
    setRequesting(key);
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase.from('shipper_pending_requests').insert({
      gu12_order_id: selectedOrder,
      shipper_id: profile.id,
      wagon_id: wagon.id,
      wagon_owner_id: wagon.owner.id,
      message: null,
    });
    if (err) {
      setError(err.message.includes('unique') ? 'Запрос на этот вагон уже отправлен' : err.message);
    } else {
      setSent((s) => new Set(s).add(key));
    }
    setRequesting(null);
  }

  const activeOrder = orders.find((o) => o.id === selectedOrder);

  const filtered = wagons
    .filter((w) => {
      if (filterType && w.wagon_type !== filterType) return false;
      if (activeOrder?.wagon_type_required && w.wagon_type !== activeOrder.wagon_type_required) return false;
      return true;
    })
    .sort((a, b) => {
      if (!sortKey) return 0;
      let va = 0, vb = 0;
      if (sortKey === 'payload') {
        va = a.payload_capacity_tons ?? 0; vb = b.payload_capacity_tons ?? 0;
      } else if (sortKey === 'repair_days') {
        va = daysUntil(a.next_repair_date) ?? 9999; vb = daysUntil(b.next_repair_date) ?? 9999;
      } else if (sortKey === 'mileage') {
        va = a.remaining_mileage_km ?? 0; vb = b.remaining_mileage_km ?? 0;
      } else if (sortKey === 'total' && activeOrder) {
        const ta = calcTariff(a.current_esr_code, activeOrder.departure_esr_code, activeOrder.arrival_esr_code, a.payload_capacity_tons ?? 60);
        const tb = calcTariff(b.current_esr_code, activeOrder.departure_esr_code, activeOrder.arrival_esr_code, b.payload_capacity_tons ?? 60);
        va = ta.totalTariffKzt ?? 0; vb = tb.totalTariffKzt ?? 0;
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });

  const showTariff = !!activeOrder;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Подбор вагонов</h2>
        <p className="text-sm text-gray-500 mt-0.5">Сертифицированные вагоны, доступные для подачи</p>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <Select
          label="Тип вагона"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          options={[{ value: '', label: 'Все типы' }, ...Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))]}
          className="w-48"
        />
        <Select
          label="Привязать к заявке ГУ-12 (для расчёта тарифа)"
          value={selectedOrder}
          onChange={(e) => setSelectedOrder(e.target.value)}
          options={[{ value: '', label: 'Без привязки' }, ...orders.map((o) => ({ value: o.id, label: `${o.gu12_number} — ${o.cargo_name ?? o.cargo_etsng_code}` }))]}
          className="w-96"
        />
      </div>

      {!activeOrder && (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-xl bg-white text-center">
          <Train size={36} className="text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Выберите заявку ГУ-12</p>
          <p className="text-sm text-gray-400 mt-1">Укажите груз, чтобы увидеть подходящие вагоны с расчётом тарифа</p>
        </div>
      )}

      {activeOrder && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm flex items-center gap-3">
          <CheckCircle size={14} className="text-blue-600 shrink-0" />
          <span className="text-blue-800">
            Заявка <strong>{activeOrder.gu12_number}</strong> · {activeOrder.departure_station_name ?? activeOrder.departure_esr_code} → {activeOrder.arrival_station_name ?? activeOrder.arrival_esr_code} · Тип: <strong>{TYPE_LABELS[activeOrder.wagon_type_required ?? ''] ?? 'Любой'}</strong>
          </span>
          <span className="ml-auto flex items-center gap-1 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-lg">
            <Calculator size={12} /> Тарифы рассчитаны по нормативным ставкам КТЖ (оценочно)
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>
      )}

      {activeOrder && <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {([
                  { label: '№ Вагона',       key: null },
                  { label: 'Тип',            key: null },
                  { label: 'Грузопод.',      key: 'payload' as SortKey },
                  { label: 'Следующий ТО',   key: 'repair_days' as SortKey },
                  { label: 'Пробег (ост.)',  key: 'mileage' as SortKey },
                  { label: 'Собственник',    key: null },
                  ...(showTariff ? [
                    { label: 'Порожний рейс', key: null },
                    { label: 'Гружёный рейс', key: null },
                    { label: 'Итого (оценка)', key: 'total' as SortKey },
                  ] : []),
                  { label: '', key: null },
                ] as { label: string; key: SortKey | null }[]).map(({ label, key }) => (
                  <th key={label || 'action'} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {key ? (
                      <button onClick={() => toggleSort(key)} className="flex items-center gap-1 hover:text-gray-800 transition-colors cursor-pointer">
                        {label}
                        {sortKey === key
                          ? sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                          : <ChevronsUpDown size={12} className="text-gray-300" />}
                      </button>
                    ) : label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={showTariff ? 9 : 6} className="text-center px-4 py-12 text-gray-400">Нет доступных вагонов с выбранными фильтрами</td></tr>
              )}
              {filtered.map((wagon) => {
                const days = daysUntil(wagon.next_repair_date);
                const repairBadge = days === null ? null
                  : days < 0 ? <Badge variant="danger"><AlertTriangle size={10} className="inline mr-0.5" />Просрочен ТО</Badge>
                  : days < 30 ? <Badge variant="warning"><Wrench size={10} className="inline mr-0.5" />{days} дн.</Badge>
                  : <Badge variant="success">{days} дн.</Badge>;

                const tariff = showTariff && activeOrder
                  ? calcTariff(
                      wagon.current_esr_code,
                      activeOrder.departure_esr_code,
                      activeOrder.arrival_esr_code,
                      wagon.payload_capacity_tons ?? 60,
                    )
                  : null;

                return (
                  <tr key={wagon.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-blue-700">{wagon.number}</div>
                      <Badge variant="success" className="mt-1">Сертифицирован</Badge>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-gray-800">
                        <Train size={13} className="text-gray-400" />{TYPE_LABELS[wagon.wagon_type]}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{wagon.model_number ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{wagon.payload_capacity_tons ? `${wagon.payload_capacity_tons} т` : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-500 mb-1">{formatDate(wagon.next_repair_date)}</div>
                      {repairBadge}
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs">
                      {wagon.remaining_mileage_km != null ? `${wagon.remaining_mileage_km.toLocaleString('ru')} км` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{wagon.owner?.company_name ?? '—'}</td>

                    {showTariff && tariff && (
                      <>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {tariff.emptyTariffKzt != null ? (
                            <div>
                              <div className="text-xs font-medium text-gray-800">{fmtKzt(tariff.emptyTariffKzt)}</div>
                              <div className="text-xs text-gray-400">{tariff.emptyDistKm} км</div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Нет геолокации</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-xs font-medium text-gray-800">{fmtKzt(tariff.loadedTariffKzt)}</div>
                          <div className="text-xs text-gray-400">{tariff.loadedDistKm} км</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {tariff.totalTariffKzt != null ? (
                            <div className="text-sm font-semibold text-blue-700">{fmtKzt(tariff.totalTariffKzt)}</div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {(() => {
                        const key = `${selectedOrder}-${wagon.id}`;
                        const isSent = sent.has(key);
                        return isSent ? (
                          <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1.5 rounded-lg">
                            <CheckCircle size={12} /> Запрос отправлен
                          </span>
                        ) : (
                          <Button size="sm" loading={requesting === key} onClick={() => requestWagon(wagon)}>
                            <Send size={12} /> Запросить
                          </Button>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>}

      {showTariff && (
        <p className="text-xs text-gray-400 text-right">
          * Тарифы рассчитаны оценочно по ставкам 2.2 ₸/т·км (порожний) и 3.8 ₸/т·км (гружёный) + терминальный сбор 8 000 ₸.
          Для официального расчёта обратитесь к Прейскуранту цен КТЖ-2026.
        </p>
      )}
    </div>
  );
}
