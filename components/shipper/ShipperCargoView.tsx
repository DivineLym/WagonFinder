'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchGU12 } from '@/services/ktzService';
import { Button } from '@/components/ui/button';
import type { Profile, GU12Order, PendingApplication } from '@/types';
import { formatDate } from '@/lib/utils';
import { RefreshCw, AlertCircle, Package, Train, ArrowRight, Globe, GlobeLock, Search, X } from 'lucide-react';
import { GU12PdfUpload } from './GU12PdfUpload';
import { useTranslations } from 'next-intl';

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
  const ts = useTranslations('shipper');
  const tw = useTranslations('wagonTypes');
  const [orders, setOrders] = useState<GU12Order[]>(initialOrders);
  const [applications, setApplications] = useState<AppWithDetails[]>(initialApplications);
  const payerCode = profile.ktz_payer_code ?? '';
  const [syncing, startSync] = useTransition();
  const [syncError, setSyncError] = useState('');
  const [syncSuccess, setSyncSuccess] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPublishing, setBulkPublishing] = useState(false);
  const [cargoTab, setCargoTab] = useState<'active' | 'fulfilled'>('active');
  const [search, setSearch] = useState('');
  const [filterWagonType, setFilterWagonType] = useState('');
  const [filterPublic, setFilterPublic] = useState<'' | 'public' | 'private'>('');
  const [filterCargo, setFilterCargo] = useState('');
  const [cargoQuery, setCargoQuery] = useState('');
  const [cargoOpen, setCargoOpen] = useState(false);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = document.getElementById('cargo-filter-dropdown');
      if (el && !el.contains(e.target as Node)) setCargoOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

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
          departure_esr_code: o.departure_esr_code,
          arrival_esr_code: o.arrival_esr_code,
          quantity_planned: o.quantity_planned,
          period_start: o.period_start,
          period_end: o.period_end,
        }));
        const { error } = await supabase.from('gu12_orders').upsert(rows, { onConflict: 'gu12_number' });
        if (error) throw new Error(error.message);
        const { data: fresh } = await supabase.from('gu12_orders').select('*, etsng_cargos(name,wagon_type_required), departure_station:esr_stations!departure_esr_code(name), arrival_station:esr_stations!arrival_esr_code(name)').eq('shipper_id', profile.id).order('created_at', { ascending: false });
        setOrders((fresh ?? []) as GU12Order[]);
        setSyncSuccess(`${ts('syncSuccess')}: ${ktzOrders.length}`);
      } catch (err: unknown) {
        setSyncError(err instanceof Error ? err.message : 'Ошибка синхронизации');
      }
    });
  }

  const activeOrders = orders.filter(o => o.status !== 'fulfilled' && o.status !== 'cancelled');
  const fulfilledOrders = orders.filter(o => o.status === 'fulfilled' || o.status === 'cancelled');

  const WAGON_TYPE_LABELS: Record<string, string> = useMemo(() => ({
    tank: tw('tank'), hopper: tw('hopper'), flatcar: tw('flatcar'),
    boxcar: tw('boxcar'), gondola: tw('gondola'), refrigerator: tw('refrigerator'),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [tw]);

  const baseOrders = cargoTab === 'active' ? activeOrders : fulfilledOrders;

  const cargoSuggestions = useMemo(() => {
    if (!cargoQuery.trim()) return [];
    const q = cargoQuery.toLowerCase();
    const seen = new Set<string>();
    return baseOrders.filter((o) => {
      if (seen.has(o.cargo_etsng_code)) return false;
      seen.add(o.cargo_etsng_code);
      return o.cargo_etsng_code.includes(q) || (o.etsng_cargos?.name ?? '').toLowerCase().includes(q);
    }).slice(0, 8);
  }, [baseOrders, cargoQuery]);

  const visibleOrders = useMemo(() => {
    const q = search.toLowerCase().trim();
    return baseOrders.filter((o) => {
      if (q && !(
        o.gu12_number.toLowerCase().includes(q) ||
        (o.etsng_cargos?.name ?? '').toLowerCase().includes(q) ||
        o.cargo_etsng_code.includes(q) ||
        (o.departure_station?.name ?? '').toLowerCase().includes(q) ||
        (o.arrival_station?.name ?? '').toLowerCase().includes(q)
      )) return false;
      if (filterWagonType && o.etsng_cargos?.wagon_type_required !== filterWagonType) return false;
      if (filterPublic === 'public' && !o.is_public) return false;
      if (filterPublic === 'private' && o.is_public) return false;
      if (filterCargo) {
        const cq = filterCargo.toLowerCase();
        if (!o.cargo_etsng_code.includes(cq) && !(o.etsng_cargos?.name ?? '').toLowerCase().includes(cq)) return false;
      }
      return true;
    });
  }, [baseOrders, search, filterWagonType, filterPublic, filterCargo]);

  const hasFilters = search || filterWagonType || filterPublic || filterCargo;
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

  async function toggleDealType(order: GU12Order) {
    const newType = order.deal_type === 'spot' ? 'lease' : 'spot';
    const supabase = createClient();
    const { error } = await supabase.from('gu12_orders').update({ deal_type: newType }).eq('id', order.id);
    if (!error) setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, deal_type: newType } : o));
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
          <h2 className="text-lg font-semibold text-gray-900">{ts('title')}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{profile.company_name} · БИН {profile.bin}</p>
        </div>
        <div className="flex items-center gap-2">
          <GU12PdfUpload shipperId={profile.id} existingNumbers={orders.map(o => o.gu12_number)} onSaved={async () => {
            const supabase = createClient();
            const { data: fresh } = await supabase.from('gu12_orders').select('*, etsng_cargos(name,wagon_type_required), departure_station:esr_stations!departure_esr_code(name), arrival_station:esr_stations!arrival_esr_code(name)').eq('shipper_id', profile.id).order('created_at', { ascending: false });
            setOrders((fresh ?? []) as GU12Order[]);
          }} />
          <Button disabled size="md" title={ts('syncKtz')}>
            <RefreshCw size={14} /> {ts('syncKtz')} <span className="text-xs opacity-60 ml-1">· {ts('syncComingSoon')}</span>
          </Button>
        </div>
      </div>

      {!payerCode && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-700">
          <AlertCircle size={14} /> {ts('noPayerCodeHint')}
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
          { key: 'active',    label: `${ts('activeTab')}${activeOrders.length > 0 ? ` (${activeOrders.length})` : ''}` },
          { key: 'fulfilled', label: `${ts('fulfilledTab')}${fulfilledOrders.length > 0 ? ` (${fulfilledOrders.length})` : ''}` },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => { setCargoTab(key); setSelected(new Set()); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              cargoTab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >{label}</button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={ts('searchPlaceholder')}
            className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 cursor-pointer">
              <X size={13} />
            </button>
          )}
        </div>
        <div id="cargo-filter-dropdown" className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
          <input
            value={cargoQuery}
            onChange={(e) => { setCargoQuery(e.target.value); setFilterCargo(e.target.value); setCargoOpen(true); }}
            onFocus={() => cargoSuggestions.length > 0 && setCargoOpen(true)}
            placeholder={ts('cargoOrEtsng')}
            className="pl-8 pr-7 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-44 h-[38px]"
          />
          {cargoQuery && (
            <button onClick={() => { setCargoQuery(''); setFilterCargo(''); setCargoOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 cursor-pointer">
              <X size={13} />
            </button>
          )}
          {cargoOpen && cargoSuggestions.length > 0 && (
            <div className="absolute z-50 top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-[240px]">
              {cargoSuggestions.map((o) => (
                <button key={o.cargo_etsng_code} onMouseDown={() => { setCargoQuery(o.etsng_cargos?.name ?? o.cargo_etsng_code); setFilterCargo(o.cargo_etsng_code); setCargoOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 cursor-pointer flex items-center gap-2">
                  <span className="font-mono text-blue-600 shrink-0">{o.cargo_etsng_code}</span>
                  <span className="text-gray-700 truncate">{o.etsng_cargos?.name ?? '—'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <select
          value={filterWagonType}
          onChange={(e) => setFilterWagonType(e.target.value)}
          className="border border-gray-200 rounded-lg bg-white py-2 pl-3 pr-8 text-sm focus:outline-none text-gray-700 cursor-pointer h-[38px]"
        >
          <option value="">{ts('allWagonTypes')}</option>
          {Object.entries(WAGON_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {cargoTab === 'active' && (
          <select
            value={filterPublic}
            onChange={(e) => setFilterPublic(e.target.value as '' | 'public' | 'private')}
            className="border border-gray-200 rounded-lg bg-white py-2 pl-3 pr-8 text-sm focus:outline-none text-gray-700 cursor-pointer h-[38px]"
          >
            <option value="">{ts('allVisibility')}</option>
            <option value="public">{ts('publishedToMarket')}</option>
            <option value="private">{ts('hiddenFromMarket')}</option>
          </select>
        )}
        {hasFilters && (
          <button onClick={() => { setSearch(''); setFilterWagonType(''); setFilterPublic(''); setFilterCargo(''); setCargoQuery(''); }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors cursor-pointer">
            <X size={12} /> {ts('resetFilters')}
          </button>
        )}
        {hasFilters && (
          <span className="text-xs text-gray-400">{visibleOrders.length} из {baseOrders.length}</span>
        )}
      </div>

      {visibleOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-xl bg-white text-center">
          <Package size={36} className="text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">
            {cargoTab === 'fulfilled' ? ts('noFulfilled') : ts('noOrders')}
          </p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            {cargoTab === 'fulfilled' ? ts('noFulfilledHint') : ts('noOrdersHint')}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-0 flex-1">
          {cargoTab === 'active' && selected.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-b border-blue-100 rounded-t-xl shrink-0">
              <span className="text-sm text-blue-700 font-medium">{ts('selected')}: {selected.size}</span>
              <button onClick={() => bulkPublish(true)} disabled={bulkPublishing}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50">
                <Globe size={12} /> {ts('publish')}
              </button>
              <button onClick={() => bulkPublish(false)} disabled={bulkPublishing}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50">
                <GlobeLock size={12} /> {ts('hide')}
              </button>
              <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-blue-500 hover:text-blue-700 cursor-pointer">{ts('resetFilters')}</button>
            </div>
          )}
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 sticky top-0 z-10">
                  {cargoTab === 'active' && (
                    <th className="px-3 py-3 w-8">
                      <input type="checkbox" checked={allSelectedActive}
                        onChange={() => setSelected(allSelectedActive ? new Set() : new Set(activeOrders.map(o => o.id)))}
                        className="rounded border-gray-300 text-blue-600 cursor-pointer" />
                    </th>
                  )}
                  {(cargoTab === 'active'
                    ? [ts('orderNumber'), ts('cargo'), ts('route'), ts('shipped'), ts('period'), '']
                    : [ts('orderNumber'), ts('cargo'), ts('route'), ts('fulfilled'), ts('period')]
                  ).map((h) => (
                    <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visibleOrders.map((order) => {
                  const isSelected = selected.has(order.id);
                  const wagonLabel = WAGON_TYPE_LABELS[order.etsng_cargos?.wagon_type_required ?? ''];
                  const pct = order.quantity_planned > 0 ? Math.round((order.quantity_fulfilled / order.quantity_planned) * 100) : 0;
                  return (
                    <tr key={order.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/40' : ''}`}>
                      {cargoTab === 'active' && (
                        <td className="px-3 py-3">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(order.id)}
                            className="rounded border-gray-300 text-blue-600 cursor-pointer" />
                        </td>
                      )}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="font-mono text-xs text-blue-700 font-medium">{order.gu12_number}</div>
                        <button
                          onClick={() => toggleDealType(order)}
                          title={order.deal_type === 'spot' ? ts('dealTypeSpot') : ts('dealTypeLease')}
                          className={`mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full cursor-pointer transition-colors ${
                            order.deal_type === 'lease'
                              ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                              : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                          }`}
                        >
                          {order.deal_type === 'lease' ? ts('dealTypeLease') : ts('dealTypeSpot')}
                        </button>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900 text-xs">{order.etsng_cargos?.name ?? '—'}</div>
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
                        <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{order.departure_station?.name} → {order.arrival_station?.name}</div>
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
                            title={order.is_public ? ts('publishedOnMarket') : ts('private')}
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

