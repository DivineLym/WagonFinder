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
import { useTranslations } from 'next-intl';

type SortKey = 'payload' | 'repair_days' | 'mileage' | 'total';
type SortDir = 'asc' | 'desc';

interface WagonWithOwner extends Wagon {
  owner?: { id: string; full_name: string; company_name: string };
}

interface Props { profile: Profile; wagons: WagonWithOwner[]; orders: GU12Order[]; }

export function AvailableWagonsView({ profile, wagons, orders }: Props) {
  const tw = useTranslations('wagonSearch');
  const twt = useTranslations('wagonTypes');
  const [selectedOrder, setSelectedOrder] = useState('');
  // key = `${orderId}-${wagonId}`
  const [requesting, setRequesting] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>('total');
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
      setError(err.message.includes('unique') ? tw('alreadySent') : err.message);
    } else {
      setSent((s) => new Set(s).add(key));
    }
    setRequesting(null);
  }

  const activeOrder = orders.find((o) => o.id === selectedOrder);

  // Allowed wagon types for active order: explicit type OR derived from ETSNG regulatory rules
  const ETSNG_WAGON_TYPES: Record<string, string[]> = {
    '011063': ['hopper'], '011066': ['hopper'], '011068': ['hopper'], '011079': ['hopper'],
    '211001': ['tank'],   '212041': ['tank'],   '212061': ['tank'],   '212065': ['tank'],
    '161002': ['gondola'], '091001': ['gondola', 'hopper'], '093001': ['gondola'],
    '111001': ['hopper'], '131001': ['flatcar'],
    '226021': ['hopper', 'boxcar'], '511001': ['boxcar'],
  };
  const allowedTypes: string[] | null = activeOrder
    ? activeOrder.etsng_cargos?.wagon_type_required
      ? [activeOrder.etsng_cargos.wagon_type_required]
      : (activeOrder.cargo_etsng_code ? ETSNG_WAGON_TYPES[activeOrder.cargo_etsng_code] ?? null : null)
    : null;

  const filtered = wagons
    .filter((w) => {
      if (allowedTypes && !allowedTypes.includes(w.wagon_type ?? '')) return false;
      // filter by deal type compatibility
      if (activeOrder?.deal_type === 'spot'  && w.availability_type === 'lease') return false;
      if (activeOrder?.deal_type === 'lease' && w.availability_type === 'spot')  return false;
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
    <div className="h-full flex flex-col min-h-0 -m-6">
      {/* Top panel — padded */}
      <div className="px-6 pt-6 pb-4 flex flex-col gap-3 shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{tw('title')}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{tw('subtitle')}</p>
        </div>

        {/* Filters */}
        <div className="flex items-end gap-3 flex-wrap bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
          <Select
            label={tw('linkToOrder')}
            value={selectedOrder}
            onChange={(e) => setSelectedOrder(e.target.value)}
            options={[{ value: '', label: tw('noLink') }, ...orders.map((o) => ({ value: o.id, label: `${o.gu12_number} — ${o.etsng_cargos?.name ?? o.cargo_etsng_code}` }))]}
            className="w-96"
          />
        </div>

        {activeOrder && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm flex items-center gap-3">
            <CheckCircle size={14} className="text-blue-600 shrink-0" />
            <span className="text-blue-800">
              {tw('orderInfo', {
                number: activeOrder.gu12_number,
                from: activeOrder.departure_station?.name ?? activeOrder.departure_esr_code,
                to: activeOrder.arrival_station?.name ?? activeOrder.arrival_esr_code,
                type: allowedTypes ? allowedTypes.map((t) => twt(t as Parameters<typeof twt>[0])).join(', ') : tw('anyType'),
              })}
            </span>
            <span className="ml-auto flex items-center gap-1 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-lg">
              <Calculator size={12} /> {tw('tariffNote')}
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-200 shrink-0" />

      {!activeOrder && (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center">
          <Train size={36} className="text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">{tw('selectOrder')}</p>
          <p className="text-sm text-gray-400 mt-1">{tw('selectOrderHint')}</p>
        </div>
      )}

      {activeOrder && <div className="overflow-auto flex-1 min-h-0">
          <table className="w-full text-sm bg-white">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 sticky top-0 z-10">
                {([
                  { label: tw('colType'),         key: null },
                  { label: tw('colAvailability'), key: null },
                  { label: tw('colPayload'),       key: 'payload' as SortKey },
                  { label: tw('colRepair'),  key: 'repair_days' as SortKey },
                  { label: tw('colMileage'), key: 'mileage' as SortKey },
                  ...(showTariff ? [
                    { label: tw('colTotal'), key: 'total' as SortKey },
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
                <tr><td colSpan={showTariff ? 6 : 5} className="text-center px-4 py-12 text-gray-400">{tw('noWagons')}</td></tr>
              )}
              {filtered.map((wagon) => {
                const days = daysUntil(wagon.next_repair_date);
                const repairBadge = days === null ? null
                  : days < 0 ? <Badge variant="danger"><AlertTriangle size={10} className="inline mr-0.5" />{tw('repairOverdue')}</Badge>
                  : days < 30 ? <Badge variant="warning"><Wrench size={10} className="inline mr-0.5" />{days} дн.</Badge>
                  : <Badge variant="success">{days} дн.</Badge>;

                const tariff = showTariff && activeOrder
                  ? calcTariff(
                      wagon.current_esr_code,
                      activeOrder.departure_esr_code,
                      activeOrder.arrival_esr_code,
                      wagon.payload_capacity_tons ?? 60,
                      wagon.wagon_type,
                      activeOrder.cargo_etsng_code,
                      wagon.tare_weight_tons,
                    )
                  : null;

                return (
                  <tr key={wagon.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-gray-800">
                        <Train size={13} className="text-gray-400" />{twt(wagon.wagon_type as Parameters<typeof twt>[0])}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{wagon.model_number ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        wagon.availability_type === 'spot'  ? 'bg-orange-100 text-orange-700' :
                        wagon.availability_type === 'lease' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {tw(`availability_${wagon.availability_type}` as Parameters<typeof tw>[0])}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{wagon.payload_capacity_tons ? `${wagon.payload_capacity_tons} т` : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-500 mb-1">{formatDate(wagon.next_repair_date)}</div>
                      {repairBadge}
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs">
                      {wagon.remaining_mileage_km != null ? `${wagon.remaining_mileage_km.toLocaleString('ru')} км` : '—'}
                    </td>
                    {showTariff && tariff && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tariff.totalTariffKzt != null ? (
                          <div>
                            <div className="text-sm font-semibold text-blue-700">{fmtKzt(tariff.totalTariffKzt)}</div>
                            <div className="text-[10px] text-gray-400">
                              {tariff.emptyDistKm} + {tariff.loadedDistKm} км · инфраст. {fmtKzt(tariff.infraKzt)}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm font-semibold text-blue-700">{fmtKzt(tariff.loadedTariffKzt)}</div>
                            <div className="text-[10px] text-gray-400">{tariff.loadedDistKm} км · {tw('noGeo')}</div>
                          </div>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {(() => {
                        const key = `${selectedOrder}-${wagon.id}`;
                        const isSent = sent.has(key);
                        return isSent ? (
                          <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1.5 rounded-lg">
                            <CheckCircle size={12} /> {tw('requestSent')}
                          </span>
                        ) : (
                          <Button size="sm" loading={requesting === key} onClick={() => requestWagon(wagon)}>
                            <Send size={12} /> {tw('request')}
                          </Button>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      </div>}

      {showTariff && (
        <p className="text-xs text-gray-400 text-right shrink-0 px-6 py-2 border-t border-gray-100 bg-white">
          {tw('tariffDisclaimer')}
        </p>
      )}
    </div>
  );
}
