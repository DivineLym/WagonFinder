'use client';

import { useState, useRef, useMemo } from 'react';
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

  async function updateAppStatus(appId: string, action: 'accepted' | 'rejected') {
    if (inFlightRef.current.has(appId)) return;
    inFlightRef.current.add(appId);
    setUpdatingApp(appId);
    const supabase = createClient();
    const app = appList.find((a) => a.id === appId);
    if (!app) { inFlightRef.current.delete(appId); setUpdatingApp(null); return; }

    if (action === 'accepted') {
      setAcceptError('');
      const executorBin = app.wagon_owner.bin ?? '';
      const gu12OrderId = app.gu12_order_id;

      // Check if a contract for this owner+order already exists
      const { data: existingContracts } = await supabase
        .from('contracts')
        .select('id')
        .eq('gu12_order_id', gu12OrderId)
        .eq('executor_bin', executorBin)
        .eq('customer_bin', myBin)
        .maybeSingle();

      let contractId: string;

      if (existingContracts) {
        // Add wagon to existing contract
        contractId = existingContracts.id;
      } else {
        // Create a new contract for this owner+order pair
        const { data: newContract, error: contractErr } = await supabase.from('contracts').insert({
          application_id: app.id,
          gu12_order_id: gu12OrderId,
          executor_id: app.wagon_owner_id,
          customer_id: profile?.id,
          contract_number: makeContractNum(),
          status: 'pending_payment',
          executor_company: app.wagon_owner.company_name ?? app.wagon_owner.full_name,
          executor_bin: executorBin,
          executor_name: app.wagon_owner.full_name,
          customer_company: profile?.company_name ?? profile?.full_name ?? '',
          customer_bin: myBin,
          customer_name: profile?.full_name ?? '',
          cargo_name: app.gu12_order?.etsng_cargos?.name ?? '',
          cargo_etsng: app.gu12_order?.cargo_etsng_code ?? '',
          departure_station: app.gu12_order?.departure_station?.name ?? app.gu12_order?.departure_esr_code ?? '',
          arrival_station: app.gu12_order?.arrival_station?.name ?? app.gu12_order?.arrival_esr_code ?? '',
          period_start: app.gu12_order?.period_start ?? new Date().toISOString().slice(0,10),
          period_end: app.gu12_order?.period_end ?? new Date().toISOString().slice(0,10),
          deal_type: app.gu12_order?.deal_type ?? 'spot',
        }).select('id').single();
        if (contractErr || !newContract) {
          setAcceptError(`Ошибка создания договора: ${contractErr?.message}`);
          inFlightRef.current.delete(appId);
          setUpdatingApp(null);
          return;
        }
        contractId = newContract.id;
      }

      // Add wagon to contract_wagons
      const { error: wagonErr } = await supabase.from('contract_wagons').insert({
        contract_id: contractId,
        wagon_id: app.wagon_id,
        wagon_number: app.wagon.number,
        wagon_type: app.wagon.wagon_type,
        application_id: app.id,
      });
      if (wagonErr) {
        setAcceptError(`Ошибка добавления вагона: ${wagonErr.message}`);
        inFlightRef.current.delete(appId);
        setUpdatingApp(null);
        return;
      }
      // Mark wagon as booked (trigger also does this after migration 023 is applied)
      if (app.wagon_id) {
        await supabase.from('wagons').update({ status: 'booked' }).eq('id', app.wagon_id).eq('status', 'active');
      }
      await supabase.from('wagon_owner_pending_requests').delete().eq('id', appId);
      setAppList((prev) => prev.filter((a) => a.id !== appId));
      if (app.gu12_order?.id) {
        setFulfilledDelta((d) => ({ ...d, [app.gu12_order!.id]: (d[app.gu12_order!.id] ?? 0) + 1 }));
      }
    } else {
      await supabase.from('wagon_owner_rejected_requests').insert({
        gu12_order_id: app.gu12_order_id,
        wagon_owner_id: app.wagon_owner_id,
        wagon_id: app.wagon_id,
        message: app.message,
        created_at: app.created_at,
      });
      await supabase.from('wagon_owner_pending_requests').delete().eq('id', appId);
      setAppList((prev) => prev.filter((a) => a.id !== appId));
    }

    inFlightRef.current.delete(appId);
    setUpdatingApp(null);
    router.refresh();
  }

  // Outgoing: shipper requested a wagon owner's wagon; if accepted by owner → contract already created by owner
  // Nothing to do here on shipper side for outgoing (owner accepts/rejects)

  const pendingTotal = appList.length + outgoing.length;

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
            {filteredApps.length === 0 ? (
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
                      {filteredApps.map((app) => {
                        const o = app.gu12_order;
                        const f = o ? orderFulfillment[o.id] : null;
                        const pct = f && f.planned > 0 ? Math.min(100, Math.round((f.fulfilled / f.planned) * 100)) : 0;
                        return (
                          <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-mono text-xs text-blue-700 font-medium truncate">{o?.gu12_number}</div>
                              <div className="text-xs text-gray-500 truncate">{o?.etsng_cargos?.name}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 text-xs text-gray-400 italic"><Shield size={11} className="shrink-0" /> Скрыто до оплаты</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-mono text-xs text-gray-800">{app.wagon.number}</div>
                              <div className="text-xs text-gray-400">{twt(app.wagon.wagon_type as Parameters<typeof twt>[0])} · {app.wagon.payload_capacity_tons}т</div>
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
                                <button disabled={updatingApp === app.id} onClick={() => updateAppStatus(app.id, 'accepted')}
                                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors cursor-pointer disabled:opacity-40">
                                  <CheckCircle size={12} /> {tr('acceptRequest')}
                                </button>
                                <button disabled={updatingApp === app.id} onClick={() => updateAppStatus(app.id, 'rejected')}
                                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-40">
                                  <XCircle size={12} /> {tr('rejectRequest')}
                                </button>
                              </div>
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
