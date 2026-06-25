'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import type { Profile, GU12Order, Wagon } from '@/types';
import type { ExistingApp } from '@/app/(dashboard)/wagon-owner/market/page';
import { Store, ArrowRight, Train, Package, XCircle, Clock, X, Search } from 'lucide-react';
import { StationAutocomplete } from '@/components/ui/StationAutocomplete';
import { useTranslations } from 'next-intl';

// wagon type labels populated from translations below

type PublicOrder = GU12Order & { shipper: { company_name: string; bin: string } };

interface Props {
  profile: Profile;
  orders: PublicOrder[];
  myWagons: Wagon[];
  existingApps?: ExistingApp[];
}

export function CargoMarket({ profile, orders, myWagons, existingApps = [] }: Props) {
  const tm = useTranslations('market');
  const tw = useTranslations('wagonTypes');
  const WAGON_TYPE_LABELS: Record<string, string> = {
    tank: tw('tank'), hopper: tw('hopper'), flatcar: tw('flatcar'),
    boxcar: tw('boxcar'), gondola: tw('gondola'), refrigerator: tw('refrigerator'),
  };
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterFrom_date, setFilterFromDate] = useState('');
  const [filterTo_date, setFilterToDate] = useState('');
  const [filterWagonType, setFilterWagonType] = useState('');
  const [filterCargo, setFilterCargo] = useState('');
  const [cargoQuery, setCargoQuery] = useState('');
  const [cargoOpen, setCargoOpen] = useState(false);
  const cargoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (cargoRef.current && !cargoRef.current.contains(e.target as Node)) setCargoOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const cargoSuggestions = useMemo(() => {
    if (!cargoQuery.trim()) return [];
    const q = cargoQuery.toLowerCase();
    const seen = new Set<string>();
    return orders.filter((o) => {
      const key = o.cargo_etsng_code;
      if (seen.has(key)) return false;
      seen.add(key);
      return o.cargo_etsng_code.includes(q) || (o.etsng_cargos?.name ?? '').toLowerCase().includes(q);
    }).slice(0, 8);
  }, [orders, cargoQuery]);
  const [applying, setApplying] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const WAGONS_PREVIEW = 8;
  const [selectedWagons, setSelectedWagons] = useState<Record<string, Set<string>>>({});
  const [message, setMessage] = useState<Record<string, string>>({});
  const [orderErrors, setOrderErrors] = useState<Record<string, string>>({});

  // Track submitted apps in this session
  const [sessionApps, setSessionApps] = useState<ExistingApp[]>([]);

  const allApps = [...existingApps, ...sessionApps];

  function appsForOrder(orderId: string): ExistingApp[] {
    return allApps.filter((a) => a.gu12_order_id === orderId);
  }

  function hasAppForWagon(orderId: string, wagonId: string): boolean {
    return allApps.some((a) => a.gu12_order_id === orderId && a.wagon_id === wagonId);
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
        ...wagonIds.map((wId) => ({ id: `${orderId}-${wId}`, gu12_order_id: orderId, wagon_id: wId })),
      ]);
      setSelectedWagons((s) => { const n = { ...s }; delete n[orderId]; return n; });
      setMessage((m) => { const n = { ...m }; delete n[orderId]; return n; });
    }
    setApplying(null);
  }

  const hasFilters = filterFrom || filterTo || filterFrom_date || filterTo_date || filterWagonType || filterCargo;

  function matchStation(val: string, esr: string, name: string | null) {
    const q = val.toLowerCase();
    return esr.includes(q) || (name ?? '').toLowerCase().includes(q);
  }

  const filtered = useMemo(() => orders.filter((o) => {
    if (filterFrom && !matchStation(filterFrom, o.departure_esr_code, o.departure_station?.name ?? null)) return false;
    if (filterTo   && !matchStation(filterTo,   o.arrival_esr_code,   o.arrival_station?.name ?? null))   return false;
    if (filterFrom_date && o.period_start < filterFrom_date) return false;
    if (filterTo_date   && o.period_start > filterTo_date)   return false;
    if (filterWagonType && o.etsng_cargos?.wagon_type_required !== filterWagonType) return false;
    if (filterCargo) {
      const q = filterCargo.toLowerCase();
      if (!o.cargo_etsng_code.includes(q) && !(o.etsng_cargos?.name ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [orders, filterFrom, filterTo, filterFrom_date, filterTo_date, filterWagonType, filterCargo]);

  function clearFilters() {
    setFilterFrom(''); setFilterTo(''); setFilterFromDate(''); setFilterToDate(''); setFilterWagonType('');
    setFilterCargo(''); setCargoQuery('');
  }

  return (
    <div className="h-full flex flex-col gap-4 min-h-0">
      <div className="shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">{tm('title')}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{tm('subtitle')}</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        {/* From */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide px-1">{tm('from')}</span>
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <StationAutocomplete value={filterFrom} onChange={setFilterFrom} placeholder={tm('stationOrEsr')} />
          </div>
        </div>

        {/* To */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide px-1">{tm('to')}</span>
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <StationAutocomplete value={filterTo} onChange={setFilterTo} placeholder={tm('stationOrEsr')} />
          </div>
        </div>

        {/* Cargo */}
        <div className="flex flex-col gap-1" ref={cargoRef}>
          <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide px-1">{tm('cargo')}</span>
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <input
              value={cargoQuery}
              onChange={(e) => {
                const v = e.target.value;
                setCargoQuery(v);
                setFilterCargo(v);
                setCargoOpen(true);
              }}
              onFocus={() => cargoSuggestions.length > 0 && setCargoOpen(true)}
              placeholder={tm('nameOrEtsng')}
              className="pl-7 pr-6 py-2 text-sm focus:outline-none bg-transparent text-gray-600 w-52 h-[38px]"
            />
            {cargoQuery && (
              <button onClick={() => { setCargoQuery(''); setFilterCargo(''); setCargoOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 cursor-pointer">
                <X size={13} />
              </button>
            )}
            {cargoOpen && cargoSuggestions.length > 0 && (
              <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-[260px]">
                {cargoSuggestions.map((o) => (
                  <button
                    key={o.cargo_etsng_code}
                    onMouseDown={() => {
                      setCargoQuery(o.etsng_cargos?.name ?? o.cargo_etsng_code);
                      setFilterCargo(o.cargo_etsng_code);
                      setCargoOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 cursor-pointer flex items-center gap-2"
                  >
                    <span className="font-mono text-blue-600 shrink-0">{o.cargo_etsng_code}</span>
                    <span className="text-gray-700 truncate">{o.etsng_cargos?.name ?? '—'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Wagon type */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide px-1">{tm('wagonType')}</span>
          <select
            value={filterWagonType}
            onChange={(e) => setFilterWagonType(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg shadow-sm py-2 pl-3 pr-8 text-sm focus:outline-none text-gray-700 cursor-pointer h-[38px]"
          >
            <option value="">{tm('allTypes')}</option>
            {Object.entries(WAGON_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        {/* Period */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide px-1">{tm('period')}</span>
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg shadow-sm px-3 h-[38px]">
            <input
              type="date"
              value={filterFrom_date}
              onChange={(e) => setFilterFromDate(e.target.value)}
              className="text-sm focus:outline-none text-gray-700 w-32 bg-transparent"
            />
            <span className="text-gray-300 text-sm">—</span>
            <input
              type="date"
              value={filterTo_date}
              onChange={(e) => setFilterToDate(e.target.value)}
              className="text-sm focus:outline-none text-gray-700 w-32 bg-transparent"
            />
          </div>
        </div>

        {hasFilters && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] invisible">x</span>
            <div className="flex items-center gap-2 h-[38px]">
              <span className="text-xs text-gray-400">{filtered.length} из {orders.length}</span>
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors cursor-pointer">
                <X size={12} /> {tm('resetFilters')}
              </button>
            </div>
          </div>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-xl bg-white text-center">
          <Store size={36} className="text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">{tm('noOrders')}</p>
          <p className="text-sm text-gray-400 mt-1">{tm('noOrdersHint')}</p>
        </div>
      ) : (
        <div className="overflow-y-auto flex-1 min-h-0 space-y-2.5 pr-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-xl bg-white text-center">
              <Search size={36} className="text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">{tm('noOrdersFound')}</p>
              <p className="text-sm text-gray-400 mt-1">{tm('adjustFilters')}</p>
            </div>
          ) : null}
          {filtered.map((order) => {
            const existingAppsForOrder = appsForOrder(order.id);
            const compatibleWagons = myWagons.filter(
              (w) => !order.etsng_cargos?.wagon_type_required || w.wagon_type === order.etsng_cargos.wagon_type_required
            );
            const checkedForOrder = selectedWagons[order.id] ?? new Set<string>();

            return (
              <div key={order.id} className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
                {/* Header row */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs font-semibold text-blue-700 shrink-0">{order.gu12_number}</span>

                    <span className="font-semibold text-gray-900 text-sm truncate">{order.etsng_cargos?.name}</span>
                    <span className="text-xs text-gray-400 font-mono shrink-0">ЕТСНГ: {order.cargo_etsng_code}</span>
                  </div>
                </div>

                {/* Meta row */}
                <div className="mt-2.5 flex items-center gap-4 bg-blue-50 rounded-lg px-3 py-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-bold text-gray-900">{order.departure_esr_code}</span>
                    <ArrowRight size={14} className="text-blue-400" />
                    <span className="font-mono text-sm font-bold text-gray-900">{order.arrival_esr_code}</span>
                    <span className="text-xs text-gray-500 ml-1">{order.departure_station?.name} → {order.arrival_station?.name}</span>
                  </div>
                  <div className="w-px h-4 bg-blue-200" />
                  <div className="flex items-center gap-1 text-sm font-semibold text-blue-700">
                    <Train size={14} className="text-blue-500" />
                    {order.etsng_cargos?.wagon_type_required ? WAGON_TYPE_LABELS[order.etsng_cargos.wagon_type_required] : tm('anyType')}
                  </div>
                  <div className="w-px h-4 bg-blue-200" />
                  <div className="text-sm">
                    <span className="text-gray-500 text-xs">{tm('wagonsNeeded')}: </span>
                    <span className="font-bold text-gray-900">{order.quantity_planned - order.quantity_fulfilled}</span>
                  </div>
                  <div className="w-px h-4 bg-blue-200" />
                  <div className="text-sm text-gray-700">
                    <span className="text-gray-500 text-xs">{tm('submitPeriod')}: </span>
                    <span className="font-medium">{formatDate(order.period_start)} – {formatDate(order.period_end)}</span>
                  </div>
                </div>

                {/* Wagon selection */}
                <div className="mt-2.5 pt-2.5 border-t border-gray-100">
                  {myWagons.length === 0 ? (
                    <p className="text-xs text-gray-400">{tm('noActiveWagons')}</p>
                  ) : compatibleWagons.length === 0 ? (
                    <p className="text-xs text-gray-400">{tm('noCompatibleWagons')} ({order.etsng_cargos?.wagon_type_required ? WAGON_TYPE_LABELS[order.etsng_cargos.wagon_type_required] : ''})</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs text-gray-500">{tm('selectWagons')}:</div>
                      {(() => {
                        const isExpanded = expandedOrders.has(order.id);
                        const visible = isExpanded ? compatibleWagons : compatibleWagons.slice(0, WAGONS_PREVIEW);
                        const hidden = compatibleWagons.length - WAGONS_PREVIEW;
                        return (<>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1">
                        {visible.map((w) => {
                          const isChecked = checkedForOrder.has(w.id);
                          const isPending = hasAppForWagon(order.id, w.id);
                          return (
                            <label key={w.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                              isChecked ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleWagon(order.id, w.id)}
                                className="rounded border-gray-300 text-blue-600 cursor-pointer shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-mono text-xs font-semibold text-gray-900">{w.number}</div>
                                <div className="text-[11px] text-gray-400 truncate">{WAGON_TYPE_LABELS[w.wagon_type]} · {w.payload_capacity_tons}т</div>
                              </div>
                              {isPending && (
                                <span title="На рассмотрении"><Clock size={10} className="text-amber-500 shrink-0" /></span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                      {hidden > 0 && (
                        <button
                          onClick={() => setExpandedOrders((s) => { const n = new Set(s); isExpanded ? n.delete(order.id) : n.add(order.id); return n; })}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                        >
                          {isExpanded ? `↑ ${tm('collapse')}` : `↓ ${tm('showMore', { count: hidden })}`}
                        </button>
                      )}
                        </>);
                      })()}
                      {orderErrors[order.id] && (
                        <p className="text-xs text-red-600 flex items-center gap-1"><XCircle size={12} />{orderErrors[order.id]}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          className="flex-1 min-w-[180px] rounded-lg border border-gray-200 text-xs px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 placeholder-gray-400"
                          placeholder={tm('commentPlaceholder')}
                          value={message[order.id] ?? ''}
                          onChange={(e) => setMessage((m) => ({ ...m, [order.id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          loading={applying === order.id}
                          disabled={checkedForOrder.size === 0}
                          onClick={() => applyToOrder(order.id)}
                        >
                          <Package size={13} />
                          {checkedForOrder.size > 1 ? tm('submitWagons', { count: checkedForOrder.size }) : tm('submitRequest')}
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
