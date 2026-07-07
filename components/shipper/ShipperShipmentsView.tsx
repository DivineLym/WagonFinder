'use client';

import { useState, useRef, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';
import type { PendingApplication, RejectedApplication, Profile } from '@/types';
import { CheckCircle, XCircle, Inbox, Search, ArrowRight, Clock, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';


type GU12OrderInfo = {
  id: string; gu12_number: string;
  etsng_cargos?: { name: string; wagon_type_required: string | null };
  departure_esr_code: string; arrival_esr_code: string;
  departure_station?: { name: string }; arrival_station?: { name: string };
  period_start: string; period_end: string;
  cargo_etsng_code: string;
  quantity_planned: number; quantity_fulfilled: number;
};

type AppWithDetails = PendingApplication & {
  status?: string;
  wagon_owner_paid_at?: string | null;
  shipper_paid_at?: string | null;
  wagon: { number: string; wagon_type: string; payload_capacity_tons: number | null };
  wagon_owner: { company_name: string | null; full_name: string; bin: string | null };
  gu12_order?: GU12OrderInfo;
};

type OutgoingRequest = {
  id: string; created_at: string;
  status?: string;
  shipper_paid_at?: string | null;
  wagon_owner_paid_at?: string | null;
  wagon: { number: string; wagon_type: string; payload_capacity_tons: number | null };
  wagon_owner: { company_name: string | null; full_name: string; bin: string | null };
  gu12_order?: GU12OrderInfo;
};

type RejectedWithDetails = RejectedApplication & {
  wagon: { number: string; wagon_type: string; payload_capacity_tons: number | null };
  wagon_owner: { company_name: string | null; full_name: string; bin: string | null };
  gu12_order?: GU12OrderInfo;
};

interface Props {
  applications: AppWithDetails[];
  rejected: RejectedWithDetails[];
  outgoing?: OutgoingRequest[];
  rejectedOutgoing?: OutgoingRequest[];
  myBin?: string;
  profile?: Profile;
}

export function ShipperShipmentsView({ applications, rejected, outgoing = [], rejectedOutgoing = [], myBin = '', profile }: Props) {
  const tr = useTranslations('requests');
  const tc = useTranslations('common');
  const twt = useTranslations('wagonTypes');
  const [appList, setAppList] = useState<AppWithDetails[]>(applications);
  const [updatingApp, setUpdatingApp] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState('');
  const [subTab, setSubTab] = useState<'pending' | 'rejected'>('pending');
  const [filter, setFilter] = useState('');
  const inFlightRef = useRef<Set<string>>(new Set());
  const router = useRouter();
  const [fulfilledDelta, setFulfilledDelta] = useState<Record<string, number>>({});
  // expanded group keys and per-group selected wagon app ids
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedWagons, setSelectedWagons] = useState<Record<string, Set<string>>>({});

  const orderFulfillment = useMemo(() => {
    const map: Record<string, { planned: number; fulfilled: number }> = {};
    [...applications, ...outgoing].forEach((a) => {
      const o = a.gu12_order;
      if (o && !map[o.id]) map[o.id] = { planned: o.quantity_planned, fulfilled: o.quantity_fulfilled };
    });
    // Apply optimistic increments
    Object.entries(fulfilledDelta).forEach(([orderId, delta]) => {
      if (map[orderId]) map[orderId] = { ...map[orderId], fulfilled: map[orderId].fulfilled + delta };
    });
    return map;
  }, [applications, fulfilledDelta]);

  const filteredApps = useMemo(() => {
    if (!filter.trim()) return appList;
    const q = filter.toLowerCase();
    return appList.filter((a) =>
      a.gu12_order?.gu12_number?.toLowerCase().includes(q) ||
      a.wagon?.number?.toLowerCase().includes(q) ||
      a.wagon_owner?.company_name?.toLowerCase().includes(q) ||
      a.wagon_owner?.full_name?.toLowerCase().includes(q)
    );
  }, [appList, filter]);

  const filteredOutgoing = useMemo(() => {
    if (!filter.trim()) return outgoing;
    const q = filter.toLowerCase();
    return outgoing.filter((r) =>
      r.gu12_order?.gu12_number?.toLowerCase().includes(q) ||
      r.wagon?.number?.toLowerCase().includes(q) ||
      r.wagon_owner?.company_name?.toLowerCase().includes(q)
    );
  }, [outgoing, filter]);

  const filteredRejected = useMemo(() => {
    if (!filter.trim()) return rejected;
    const q = filter.toLowerCase();
    return rejected.filter((a) =>
      a.gu12_order?.gu12_number?.toLowerCase().includes(q) ||
      (a as unknown as AppWithDetails).wagon?.number?.toLowerCase().includes(q) ||
      (a as unknown as AppWithDetails).wagon_owner?.company_name?.toLowerCase().includes(q)
    );
  }, [rejected, filter]);

  const filteredRejectedOutgoing = useMemo(() => {
    if (!filter.trim()) return rejectedOutgoing;
    const q = filter.toLowerCase();
    return rejectedOutgoing.filter((r) =>
      r.gu12_order?.gu12_number?.toLowerCase().includes(q) ||
      r.wagon?.number?.toLowerCase().includes(q) ||
      r.wagon_owner?.company_name?.toLowerCase().includes(q)
    );
  }, [rejectedOutgoing, filter]);

  function makeContractNum() {
    return `ДУ-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  // Group incoming applications by (gu12_order_id, wagon_owner_id)
  const groupedApps = useMemo(() => {
    const groups: Record<string, AppWithDetails[]> = {};
    filteredApps.forEach((app) => {
      const key = `${app.gu12_order_id}__${app.wagon_owner_id}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(app);
    });
    return Object.values(groups);
  }, [filteredApps]);

  async function updateAppGroup(groupApps: AppWithDetails[], action: 'accepted' | 'rejected', fullGroup?: AppWithDetails[]) {
    const groupKey = groupApps[0].id;
    if (inFlightRef.current.has(groupKey)) return;
    inFlightRef.current.add(groupKey);
    setUpdatingApp(groupKey);
    const supabase = createClient();
    const first = groupApps[0];

    if (action === 'accepted') {
      setAcceptError('');
      const executorBin = first.wagon_owner.bin ?? '';
      const gu12OrderId = first.gu12_order_id;

      const { data: existingContract } = await supabase
        .from('contracts')
        .select('id')
        .eq('gu12_order_id', gu12OrderId)
        .eq('executor_bin', executorBin)
        .eq('customer_bin', myBin)
        .maybeSingle();

      let contractId: string;
      if (existingContract) {
        contractId = existingContract.id;
      } else {
        const { data: newContract, error: contractErr } = await supabase.from('contracts').insert({
          application_id: first.id,
          gu12_order_id: gu12OrderId,
          executor_id: first.wagon_owner_id,
          customer_id: profile?.id,
          contract_number: makeContractNum(),
          status: 'pending_payment',
          executor_company: first.wagon_owner.company_name ?? first.wagon_owner.full_name,
          executor_bin: executorBin,
          executor_name: first.wagon_owner.full_name,
          customer_company: profile?.company_name ?? profile?.full_name ?? '',
          customer_bin: myBin,
          customer_name: profile?.full_name ?? '',
          cargo_name: first.gu12_order?.etsng_cargos?.name ?? '',
          cargo_etsng: first.gu12_order?.cargo_etsng_code ?? '',
          departure_station: first.gu12_order?.departure_station?.name ?? first.gu12_order?.departure_esr_code ?? '',
          arrival_station: first.gu12_order?.arrival_station?.name ?? first.gu12_order?.arrival_esr_code ?? '',
          period_start: first.gu12_order?.period_start ?? new Date().toISOString().slice(0,10),
          period_end: first.gu12_order?.period_end ?? new Date().toISOString().slice(0,10),
          deal_type: first.gu12_order?.deal_type ?? 'spot',
        }).select('id').single();
        if (contractErr || !newContract) {
          setAcceptError(`Ошибка создания договора: ${contractErr?.message}`);
          inFlightRef.current.delete(groupKey);
          setUpdatingApp(null);
          return;
        }
        contractId = newContract.id;
      }

      // Add all wagons to contract_wagons at once
      const { error: wagonErr } = await supabase.from('contract_wagons').insert(
        groupApps.map((app) => ({
          contract_id: contractId,
          wagon_id: app.wagon_id,
          wagon_number: app.wagon.number,
          wagon_type: app.wagon.wagon_type,
          application_id: app.id,
        }))
      );
      if (wagonErr) {
        setAcceptError(`Ошибка добавления вагонов: ${wagonErr.message}`);
        inFlightRef.current.delete(groupKey);
        setUpdatingApp(null);
        return;
      }
      // Mark all wagons as booked
      await Promise.all(
        groupApps.filter((a) => a.wagon_id).map((a) =>
          supabase.from('wagons').update({ status: 'booked' }).eq('id', a.wagon_id!).eq('status', 'active')
        )
      );
      // Auto-reject wagons not in accepted selection
      const acceptedIds = new Set(groupApps.map((a) => a.id));
      const rejectedApps = (fullGroup ?? groupApps).filter((a) => !acceptedIds.has(a.id));
      if (rejectedApps.length > 0) {
        await supabase.from('wagon_owner_rejected_requests').insert(
          rejectedApps.map((app) => ({
            gu12_order_id: app.gu12_order_id,
            wagon_owner_id: app.wagon_owner_id,
            wagon_id: app.wagon_id,
            message: app.message,
            created_at: app.created_at,
          }))
        );
        await supabase.from('wagon_owner_pending_requests').delete().in('id', rejectedApps.map((a) => a.id));
      }
      // Delete accepted pending applications
      await supabase.from('wagon_owner_pending_requests').delete().in('id', groupApps.map((a) => a.id));
      const allIds = new Set((fullGroup ?? groupApps).map((a) => a.id));
      setAppList((prev) => prev.filter((a) => !allIds.has(a.id)));
      if (first.gu12_order?.id) {
        setFulfilledDelta((d) => ({ ...d, [first.gu12_order!.id]: (d[first.gu12_order!.id] ?? 0) + groupApps.length }));
      }
    } else {
      await supabase.from('wagon_owner_rejected_requests').insert(
        groupApps.map((app) => ({
          gu12_order_id: app.gu12_order_id,
          wagon_owner_id: app.wagon_owner_id,
          wagon_id: app.wagon_id,
          message: app.message,
          created_at: app.created_at,
        }))
      );
      await supabase.from('wagon_owner_pending_requests').delete().in('id', groupApps.map((a) => a.id));
      const groupIds = new Set(groupApps.map((a) => a.id));
      setAppList((prev) => prev.filter((a) => !groupIds.has(a.id)));
    }

    inFlightRef.current.delete(groupKey);
    setUpdatingApp(null);
    router.refresh();
  }

  const pendingTotal = groupedApps.length + outgoing.length;

  return (
    <div className="h-full flex flex-col gap-4 min-h-0">
      <div className="shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">{tr('title')}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{tr('incoming')} / {tr('outgoing')}</p>
      </div>

      {acceptError && (
        <div className="flex items-center gap-2 text-sm rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-red-700 shrink-0">
          <span>{acceptError}</span>
          <button onClick={() => setAcceptError('')} className="ml-auto text-xs underline cursor-pointer">{tc('close')}</button>
        </div>
      )}

      {/* Tabs + filter */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex gap-1 border-b border-gray-200 flex-1">
          {([
            { key: 'pending',  label: `${tr('pending')}${pendingTotal > 0 ? ` (${pendingTotal})` : ''}` },
            { key: 'rejected', label: `${tr('rejected')}${(rejected.length + rejectedOutgoing.length) > 0 ? ` (${rejected.length + rejectedOutgoing.length})` : ''}` },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setSubTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                subTab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >{label}</button>
          ))}
        </div>
        <div className="relative shrink-0">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={tr('searchPlaceholder')}
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
          />
        </div>
      </div>

      {subTab === 'pending' && (
        <div className="grid grid-rows-2 gap-4 flex-1 min-h-0">

          {/* Incoming: wagon owners → shipper's orders */}
          <div className="flex flex-col flex-1 min-h-0">
            <h3 className="text-sm font-semibold text-gray-600 mb-3 shrink-0">
              {tr('incoming')}
              {filteredApps.length > 0 && <span className="ml-2 text-xs font-normal text-gray-400">({filteredApps.length})</span>}
            </h3>
            {groupedApps.length === 0 ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-white text-center">
                <Inbox size={28} className="text-gray-300 mb-2" />
                <p className="text-gray-500 text-sm">{filter ? tr('nothingFound') : tr('noIncoming')}</p>
                {!filter && <p className="text-xs text-gray-400 mt-1">{tr('noIncomingHint')}</p>}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col flex-1 min-h-0">
                <div className="overflow-auto flex-1 min-h-0">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col className="w-[18%]" /><col className="w-[16%]" /><col className="w-[18%]" />
                      <col className="w-[16%]" /><col className="w-[12%]" /><col className="w-[20%]" />
                    </colgroup>
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {[tr('colCargo'), tr('colCarrier'), 'Вагоны', tr('colRoute'), tr('colProgress'), tr('colAction')].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupedApps.map((group) => {
                        const first = group[0];
                        const o = first.gu12_order;
                        const f = o ? orderFulfillment[o.id] : null;
                        const pct = f && f.planned > 0 ? Math.min(100, Math.round((f.fulfilled / f.planned) * 100)) : 0;
                        const groupKey = `${first.gu12_order_id}__${first.wagon_owner_id}`;
                        const isUpdating = updatingApp === first.id;
                        const isExpanded = expandedGroups.has(groupKey);
                        const sel = selectedWagons[groupKey] ?? new Set(group.map((a) => a.id));
                        const selectedApps = group.filter((a) => sel.has(a.id));
                        const allChecked = group.every((a) => sel.has(a.id));

                        const toggleGroup = () => setExpandedGroups((prev) => {
                          const next = new Set(prev);
                          if (next.has(groupKey)) next.delete(groupKey);
                          else {
                            next.add(groupKey);
                            // init all selected on first expand
                            setSelectedWagons((sw) => ({ ...sw, [groupKey]: sw[groupKey] ?? new Set(group.map((a) => a.id)) }));
                          }
                          return next;
                        });

                        const toggleWagon = (appId: string) => setSelectedWagons((sw) => {
                          const cur = new Set(sw[groupKey] ?? group.map((a) => a.id));
                          if (cur.has(appId)) cur.delete(appId); else cur.add(appId);
                          return { ...sw, [groupKey]: cur };
                        });

                        const toggleAll = () => setSelectedWagons((sw) => ({
                          ...sw,
                          [groupKey]: allChecked ? new Set() : new Set(group.map((a) => a.id)),
                        }));

                        const wagonWord = (n: number) => n === 1 ? 'вагон' : n < 5 ? 'вагона' : 'вагонов';

                        return (
                          <Fragment key={groupKey}>
                            {/* Group header row */}
                            <tr className="hover:bg-gray-50 border-b border-gray-100 transition-colors">
                              <td className="px-4 py-3">
                                <div className="text-xs font-medium text-gray-800 truncate">{o?.etsng_cargos?.name ?? '—'}</div>
                                <div className="font-mono text-xs text-blue-600 truncate">{o?.gu12_number}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1 text-xs text-gray-400 italic"><Shield size={11} className="shrink-0" /> Скрыто до оплаты</div>
                              </td>
                              <td className="px-4 py-3">
                                <button onClick={toggleGroup} className="flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-blue-600 cursor-pointer transition-colors">
                                  <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                                  {group.length} {wagonWord(group.length)}
                                  {isExpanded && sel.size < group.length && (
                                    <span className="text-blue-500">({sel.size} выбрано)</span>
                                  )}
                                </button>
                                {!isExpanded && (
                                  <div className="text-xs text-gray-400 truncate mt-0.5">
                                    {group.map((a) => (a as any).offered_price ? `${Number((a as any).offered_price).toLocaleString('ru-KZ')} ₸` : '—').join(' · ')}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {o ? (
                                  <>
                                    <div className="flex items-center gap-1 text-xs">
                                      <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{o.departure_esr_code}</span>
                                      <ArrowRight size={10} className="text-gray-400 shrink-0" />
                                      <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{o.arrival_esr_code}</span>
                                    </div>
                                    <div className="text-xs text-gray-400 mt-0.5 truncate">{o.departure_station?.name} → {o.arrival_station?.name}</div>
                                  </>
                                ) : <span className="text-gray-300 text-xs">—</span>}
                              </td>
                              <td className="px-4 py-3">
                                {f ? (
                                  <div>
                                    <div className="text-xs text-gray-500">{tr('wagonsMatched', { fulfilled: f.fulfilled, planned: f.planned })}</div>
                                    <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden w-20">
                                      <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                ) : <span className="text-gray-300 text-xs">—</span>}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1.5">
                                  <button disabled={isUpdating || selectedApps.length === 0} onClick={() => updateAppGroup(selectedApps, 'accepted', group)}
                                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors cursor-pointer disabled:opacity-40">
                                    <CheckCircle size={12} /> Принять{selectedApps.length < group.length ? ` (${selectedApps.length})` : ''}
                                  </button>
                                  <button disabled={isUpdating || selectedApps.length === 0} onClick={() => updateAppGroup(selectedApps, 'rejected')}
                                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-40">
                                    <XCircle size={12} /> Отклонить{selectedApps.length < group.length ? ` (${selectedApps.length})` : ''}
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Expanded wagon rows */}
                            {isExpanded && (
                              <>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                  <td colSpan={6} className="px-8 py-1.5">
                                    <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                                      <input type="checkbox" checked={allChecked} onChange={toggleAll} className="rounded" />
                                      Выбрать все
                                    </label>
                                  </td>
                                </tr>
                                {group.map((app) => (
                                  <tr key={app.id} className="bg-blue-50/30 border-b border-gray-100 hover:bg-blue-50/60 transition-colors">
                                    <td colSpan={2} className="px-8 py-2">
                                      <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input type="checkbox" checked={sel.has(app.id)} onChange={() => toggleWagon(app.id)} className="rounded" />
                                        <span className="font-mono text-xs text-gray-800">{app.wagon.number}</span>
                                        <span className="text-xs text-gray-400">{twt(app.wagon.wagon_type as Parameters<typeof twt>[0])} · {app.wagon.payload_capacity_tons}т</span>
                                        {(app as any).offered_price && (
                                          <span className="ml-auto text-xs font-medium text-blue-700">{Number((app as any).offered_price).toLocaleString('ru-KZ')} ₸</span>
                                        )}
                                      </label>
                                    </td>
                                    <td colSpan={4} />
                                  </tr>
                                ))}
                              </>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Outgoing: shipper → wagon owners */}
          <div className="flex flex-col flex-1 min-h-0">
            <h3 className="text-sm font-semibold text-gray-600 mb-3 shrink-0">
              {tr('outgoing')}
              {filteredOutgoing.length > 0 && <span className="ml-2 text-xs font-normal text-gray-400">({filteredOutgoing.length})</span>}
            </h3>
            {filteredOutgoing.length === 0 ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-white text-center">
                <Inbox size={28} className="text-gray-300 mb-2" />
                <p className="text-gray-500 text-sm">{filter ? tr('nothingFound') : tr('noOutgoing')}</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col flex-1 min-h-0">
                <div className="overflow-auto flex-1 min-h-0">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col className="w-[18%]" /><col className="w-[16%]" /><col className="w-[12%]" />
                      <col className="w-[18%]" /><col className="w-[16%]" /><col className="w-[20%]" />
                    </colgroup>
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {[tr('colCargo'), tr('colCarrier'), tr('colWagon'), tr('colRoute'), tr('colProgress'), tr('colAction')].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredOutgoing.map((req) => {
                        const o = req.gu12_order;
                        const f = o ? orderFulfillment[o.id] : null;
                        const pct = f && f.planned > 0 ? Math.min(100, Math.round((f.fulfilled / f.planned) * 100)) : 0;
                        return (
                          <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-mono text-xs text-blue-700 font-medium truncate">{o?.gu12_number ?? '—'}</div>
                              <div className="text-xs text-gray-500 truncate">{o?.etsng_cargos?.name}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 text-xs text-gray-400 italic"><Shield size={11} className="shrink-0" /> Скрыто до оплаты</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-mono text-xs text-gray-800">{req.wagon.number}</div>
                              <div className="text-xs text-gray-400">{twt(req.wagon.wagon_type as Parameters<typeof twt>[0])} · {req.wagon.payload_capacity_tons}т</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 text-xs">
                                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{o?.departure_esr_code}</span>
                                <ArrowRight size={10} className="text-gray-400 shrink-0" />
                                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{o?.arrival_esr_code}</span>
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5 truncate">{o?.departure_station?.name} → {o?.arrival_station?.name}</div>
                            </td>
                            <td className="px-4 py-3">
                              {f ? (
                                <div>
                                  <div className="text-xs text-gray-500">{tr('wagonsMatched', { fulfilled: f.fulfilled, planned: f.planned })}</div>
                                  <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden w-20">
                                    <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              ) : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 text-xs text-amber-600 whitespace-nowrap">
                                <Clock size={11} /> {tr('awaitingCarrier')}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'rejected' && (
        <div className="grid grid-rows-2 gap-4 flex-1 min-h-0">
          {/* Rejected incoming */}
          <div className="flex flex-col flex-1 min-h-0">
            <h3 className="text-sm font-semibold text-gray-600 mb-3 shrink-0">
              {tr('rejectedIncoming')}
              {filteredRejected.length > 0 && <span className="ml-2 text-xs font-normal text-gray-400">({filteredRejected.length})</span>}
            </h3>
            {filteredRejected.length === 0 ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-white text-center">
                <XCircle size={28} className="text-gray-200 mb-2" />
                <p className="text-gray-500 text-sm">{filter ? tr('nothingFound') : tr('noRejectedIncoming')}</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col flex-1 min-h-0">
                <div className="overflow-auto flex-1 min-h-0">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {[tr('colCargo'), tr('colCarrier'), tr('colWagon'), tr('colReason')].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredRejected.map((app) => {
                        const wd = app as unknown as AppWithDetails;
                        return (
                          <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-mono text-xs text-blue-700 font-medium">{app.gu12_order?.gu12_number}</div>
                              <div className="text-xs text-gray-500">{app.gu12_order?.etsng_cargos?.name}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1 text-xs text-gray-400 italic"><Shield size={11} /> Скрыто до оплаты</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-mono text-xs text-gray-800">{wd.wagon?.number ?? '—'}</div>
                              <div className="text-xs text-gray-400">{wd.wagon?.wagon_type ? twt(wd.wagon.wagon_type as Parameters<typeof twt>[0]) : ''}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {app.rejection_reason && <div className="text-xs text-gray-500 mb-0.5">{app.rejection_reason}</div>}
                              <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={11} /> {formatDate(app.created_at)}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Rejected outgoing */}
          <div className="flex flex-col flex-1 min-h-0">
            <h3 className="text-sm font-semibold text-gray-600 mb-3 shrink-0">
              {tr('rejectedOutgoing')}
              {filteredRejectedOutgoing.length > 0 && <span className="ml-2 text-xs font-normal text-gray-400">({filteredRejectedOutgoing.length})</span>}
            </h3>
            {filteredRejectedOutgoing.length === 0 ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-white text-center">
                <XCircle size={28} className="text-gray-200 mb-2" />
                <p className="text-gray-500 text-sm">{filter ? tr('nothingFound') : tr('noRejectedOutgoing')}</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col flex-1 min-h-0">
                <div className="overflow-auto flex-1 min-h-0">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {[tr('colCargo'), tr('colCarrier'), tr('colWagon'), tr('colRoute'), tr('colDate')].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredRejectedOutgoing.map((req) => {
                        const o = req.gu12_order;
                        return (
                          <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-mono text-xs text-blue-700 font-medium">{o?.gu12_number ?? '—'}</div>
                              <div className="text-xs text-gray-500">{o?.etsng_cargos?.name}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-medium text-gray-900 text-xs">{req.wagon_owner.company_name ?? req.wagon_owner.full_name}</div>
                              <div className="text-xs text-gray-400">{tr('bin')} {req.wagon_owner.bin}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-mono text-xs text-gray-800">{req.wagon.number}</div>
                              <div className="text-xs text-gray-400">{twt(req.wagon.wagon_type as Parameters<typeof twt>[0])}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1 text-xs">
                                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{o?.departure_esr_code}</span>
                                <ArrowRight size={10} className="text-gray-400" />
                                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{o?.arrival_esr_code}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(req.created_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
