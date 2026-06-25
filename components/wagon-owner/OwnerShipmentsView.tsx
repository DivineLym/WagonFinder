'use client';

import { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { ArrowRight, Clock, CheckCircle, XCircle, Inbox, Search, Shield } from 'lucide-react';
import type { PendingApplication, RejectedApplication, ShipperRequest, Profile } from '@/types';
import { useTranslations } from 'next-intl';

const WAGON_TYPE_LABELS: Record<string, string> = {
  tank: 'Цистерна', hopper: 'Хоппер', flatcar: 'Платформа',
  boxcar: 'Крытый', gondola: 'Полувагон', refrigerator: 'Рефрижератор',
};

interface Props {
  pending?: PendingApplication[];
  rejected?: RejectedApplication[];
  shipperRequests?: ShipperRequest[];
  rejectedShipperRequests?: ShipperRequest[];
  profile?: Profile;
}

type PendingWithPayment = PendingApplication & {
  status?: string;
  wagon_owner_paid_at?: string | null;
  shipper_paid_at?: string | null;
  wagon?: { number?: string; wagon_type?: string; payload_capacity_tons?: number | null };
  gu12_order?: {
    gu12_number?: string; etsng_cargos?: { name?: string }; departure_esr_code?: string; arrival_esr_code?: string;
    departure_station?: { name?: string }; arrival_station?: { name?: string }; period_start?: string; period_end?: string;
    cargo_etsng_code?: string;
  };
};

type ShipperRequestWithPayment = ShipperRequest & {
  status?: string;
  shipper_paid_at?: string | null;
  wagon_owner_paid_at?: string | null;
};

export function OwnerShipmentsView({ pending = [], rejected = [], shipperRequests = [], rejectedShipperRequests = [], profile }: Props) {
  const tr = useTranslations('requests');
  const [subTab, setSubTab] = useState<'pending' | 'rejected'>('pending');
  const [pendingList, setPendingList] = useState<PendingWithPayment[]>(pending as PendingWithPayment[]);
  const [requests, setRequests] = useState<ShipperRequestWithPayment[]>(shipperRequests as ShipperRequestWithPayment[]);
  const [updatingReq, setUpdatingReq] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState('');
  const [filter, setFilter] = useState('');
  const inFlightRef = useRef<Set<string>>(new Set());
  const router = useRouter();

  const filteredPending = useMemo(() => {
    if (!filter.trim()) return pendingList;
    const q = filter.toLowerCase();
    return pendingList.filter((a) => {
      const o = a.gu12_order as { gu12_number?: string; etsng_cargos?: { name?: string } } | undefined;
      const w = a.wagon as { number?: string } | undefined;
      return o?.gu12_number?.toLowerCase().includes(q) || w?.number?.toLowerCase().includes(q) || o?.etsng_cargos?.name?.toLowerCase().includes(q);
    });
  }, [pendingList, filter]);

  const filteredRequests = useMemo(() => {
    if (!filter.trim()) return requests;
    const q = filter.toLowerCase();
    return requests.filter((r) => {
      const o = r.gu12_order as { gu12_number?: string; etsng_cargos?: { name?: string } } | undefined;
      const w = r.wagon as { number?: string } | undefined;
      return o?.gu12_number?.toLowerCase().includes(q) || w?.number?.toLowerCase().includes(q);
    });
  }, [requests, filter]);

  const filteredRejected = useMemo(() => {
    if (!filter.trim()) return rejected;
    const q = filter.toLowerCase();
    return rejected.filter((a) => {
      const o = a.gu12_order as { gu12_number?: string; etsng_cargos?: { name?: string } } | undefined;
      const w = a.wagon as { number?: string } | undefined;
      return o?.gu12_number?.toLowerCase().includes(q) || w?.number?.toLowerCase().includes(q);
    });
  }, [rejected, filter]);

  const filteredRejectedShipper = useMemo(() => {
    if (!filter.trim()) return rejectedShipperRequests;
    const q = filter.toLowerCase();
    return rejectedShipperRequests.filter((r) => {
      const o = r.gu12_order as { gu12_number?: string; etsng_cargos?: { name?: string } } | undefined;
      const w = r.wagon as { number?: string } | undefined;
      return o?.gu12_number?.toLowerCase().includes(q) || w?.number?.toLowerCase().includes(q);
    });
  }, [rejectedShipperRequests, filter]);

  function makeContractNum() {
    return `ДУ-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  async function handleShipperRequest(req: ShipperRequestWithPayment, action: 'accepted' | 'rejected') {
    if (inFlightRef.current.has(req.id)) return;
    inFlightRef.current.add(req.id);
    setUpdatingReq(req.id);
    const supabase = createClient();

    if (action === 'accepted') {
      setAcceptError('');
      // Create contract immediately with pending_payment status
      const { error: contractErr } = await supabase.from('contracts').insert({
        application_id: req.id,
        contract_number: makeContractNum(),
        status: 'pending_payment',
        executor_company: profile?.company_name ?? profile?.full_name ?? '',
        executor_bin: profile?.bin ?? '',
        executor_name: profile?.full_name ?? '',
        customer_company: req.shipper?.company_name ?? req.shipper?.full_name ?? '',
        customer_bin: req.shipper?.bin ?? '',
        customer_name: req.shipper?.full_name ?? '',
        wagon_number: req.wagon?.number ?? '',
        wagon_type: req.wagon?.wagon_type ?? '',
        cargo_name: req.gu12_order?.etsng_cargos?.name ?? '',
        cargo_etsng: req.gu12_order?.cargo_etsng_code ?? '',
        departure_station: req.gu12_order?.departure_station?.name ?? req.gu12_order?.departure_esr_code ?? '',
        arrival_station: req.gu12_order?.arrival_station?.name ?? req.gu12_order?.arrival_esr_code ?? '',
        period_start: req.gu12_order?.period_start ?? new Date().toISOString().slice(0,10),
        period_end: req.gu12_order?.period_end ?? new Date().toISOString().slice(0,10),
      });
      if (contractErr) {
        setAcceptError(`Ошибка создания договора: ${contractErr.message}`);
        inFlightRef.current.delete(req.id);
        setUpdatingReq(null);
        return;
      }
      await supabase.from('shipper_pending_requests').delete().eq('id', req.id);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } else {
      await supabase.from('shipper_rejected_requests').insert({
        gu12_order_id: req.gu12_order_id,
        shipper_id: req.shipper_id,
        wagon_id: req.wagon_id,
        wagon_owner_id: req.wagon_owner_id,
        message: req.message,
        created_at: req.created_at,
      });
      await supabase.from('shipper_pending_requests').delete().eq('id', req.id);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    }

    inFlightRef.current.delete(req.id);
    setUpdatingReq(null);
    router.refresh();
  }

  const pendingCount = pendingList.length + requests.length;

  return (
    <div className="h-full flex flex-col gap-4 min-h-0">
      <div className="shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">{tr('title')}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{tr('outgoing')} / {tr('incoming')}</p>
      </div>

      {acceptError && (
        <div className="flex items-center gap-2 text-sm rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-red-700 shrink-0">
          <span>{acceptError}</span>
          <button onClick={() => setAcceptError('')} className="ml-auto text-xs underline cursor-pointer">Закрыть</button>
        </div>
      )}

      {/* Sub-tabs + filter */}
      <div className="flex items-center gap-3 shrink-0">
      <div className="flex gap-1 border-b border-gray-200 flex-1">
        {([
          { key: 'pending',  label: `Ожидающие${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          { key: 'rejected', label: `Отказанные${(rejected.length + rejectedShipperRequests.length) > 0 ? ` (${rejected.length + rejectedShipperRequests.length})` : ''}` },
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
            placeholder="№ ГУ-12 или вагон..."
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
          />
        </div>
      </div>

      {subTab === 'pending' && (
        <div className="grid grid-rows-2 gap-4 flex-1 min-h-0">
          {/* Incoming shipper requests */}
          <div className="flex flex-col min-h-0">
            <h3 className="text-sm font-semibold text-gray-600 mb-3 shrink-0">{tr('incoming')}</h3>
            {filteredRequests.length === 0 ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-white text-center">
                <Inbox size={28} className="text-gray-300 mb-2" />
                <p className="text-gray-500 text-sm">Нет входящих запросов</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col flex-1 min-h-0">
                <div className="overflow-auto flex-1 min-h-0">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col style={{width:'20%'}} /><col style={{width:'16%'}} /><col style={{width:'12%'}} />
                      <col style={{width:'18%'}} /><col style={{width:'14%'}} /><col style={{width:'20%'}} />
                    </colgroup>
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {['Груз', 'Грузоотправитель', 'Вагон', 'Маршрут', 'Период', 'Действие'].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredRequests.map((req) => {
                        const order = req.gu12_order as { gu12_number?: string; etsng_cargos?: { name?: string }; departure_esr_code?: string; arrival_esr_code?: string; departure_station?: { name?: string }; arrival_station?: { name?: string }; period_start?: string; period_end?: string } | undefined;
                        const wagon = req.wagon as { number?: string; wagon_type?: string } | undefined;
                        return (
                          <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="text-xs font-medium text-gray-800 truncate">{order?.etsng_cargos?.name ?? '—'}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 text-xs text-gray-400 italic"><Shield size={11} className="shrink-0" /> Скрыто до оплаты</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-mono text-xs text-gray-800">{wagon?.number ?? '—'}</div>
                              <div className="text-xs text-gray-400">{wagon?.wagon_type ? WAGON_TYPE_LABELS[wagon.wagon_type] : ''}</div>
                            </td>
                            <td className="px-4 py-3">
                              {order?.departure_esr_code ? (
                                <>
                                  <div className="flex items-center gap-1 text-xs">
                                    <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{order.departure_esr_code}</span>
                                    <ArrowRight size={10} className="text-gray-400 shrink-0" />
                                    <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{order.arrival_esr_code}</span>
                                  </div>
                                  <div className="text-xs text-gray-400 mt-0.5 truncate">{order.departure_station?.name} → {order.arrival_station?.name}</div>
                                </>
                              ) : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {order?.period_start && `${formatDate(order.period_start)} – ${formatDate(order.period_end ?? '')}`}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1.5">
                                <button disabled={updatingReq === req.id} onClick={() => handleShipperRequest(req, 'accepted')}
                                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors cursor-pointer disabled:opacity-40">
                                  <CheckCircle size={12} /> Принять
                                </button>
                                <button disabled={updatingReq === req.id} onClick={() => handleShipperRequest(req, 'rejected')}
                                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-40">
                                  <XCircle size={12} /> Отклонить
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

          {/* My outgoing pending applications */}
          <div className="flex flex-col min-h-0">
            <h3 className="text-sm font-semibold text-gray-600 mb-3 shrink-0">Мои поданные заявки</h3>
            {filteredPending.length === 0 ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-white text-center">
                <Inbox size={28} className="text-gray-300 mb-2" />
                <p className="text-gray-500 text-sm">Нет ожидающих заявок</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col flex-1 min-h-0">
                <div className="overflow-auto flex-1 min-h-0">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col style={{width:'20%'}} /><col style={{width:'16%'}} /><col style={{width:'12%'}} />
                      <col style={{width:'18%'}} /><col style={{width:'14%'}} /><col style={{width:'20%'}} />
                    </colgroup>
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {['Груз', 'Грузоотправитель', 'Вагон', 'Маршрут', 'Период', 'Действие'].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredPending.map((app) => {
                        const order = app.gu12_order;
                        const wagon = app.wagon;
                        return (
                          <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="text-xs font-medium text-gray-800 truncate">{order?.etsng_cargos?.name ?? '—'}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 text-xs text-gray-400 italic"><Shield size={11} className="shrink-0" /> Скрыто до оплаты</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-mono text-xs text-gray-800">{wagon?.number ?? '—'}</div>
                              <div className="text-xs text-gray-400">{wagon?.wagon_type ? WAGON_TYPE_LABELS[wagon.wagon_type] : ''}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 text-xs">
                                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{order?.departure_esr_code}</span>
                                <ArrowRight size={10} className="text-gray-400 shrink-0" />
                                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{order?.arrival_esr_code}</span>
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5 truncate">{order?.departure_station?.name} → {order?.arrival_station?.name}</div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {order?.period_start && `${formatDate(order.period_start)} – ${formatDate(order.period_end ?? '')}`}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                                <Clock size={11} /> Ожидает принятия грузоотправителем
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
          {/* My rejected outgoing apps */}
          <div className="flex flex-col min-h-0">
            <h3 className="text-sm font-semibold text-gray-600 mb-3 shrink-0">
              Мои отказанные заявки
              {filteredRejected.length > 0 && <span className="ml-2 text-xs font-normal text-gray-400">({filteredRejected.length})</span>}
            </h3>
            {filteredRejected.length === 0 ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-white text-center">
                <XCircle size={28} className="text-gray-200 mb-2" />
                <p className="text-gray-500 text-sm">{filter ? 'Ничего не найдено' : 'Нет отказанных заявок'}</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col flex-1 min-h-0">
                <div className="overflow-auto flex-1 min-h-0">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {['Груз (ГУ-12)', 'Вагон', 'Маршрут', 'Дата отказа', 'Причина'].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredRejected.map((app) => {
                        const order = app.gu12_order as { gu12_number?: string; etsng_cargos?: { name?: string }; departure_esr_code?: string; arrival_esr_code?: string; departure_station?: { name?: string }; arrival_station?: { name?: string }; } | undefined;
                        const wagon = app.wagon as { number?: string; wagon_type?: string } | undefined;
                        return (
                          <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-mono text-xs text-blue-700 font-medium">{order?.gu12_number ?? '—'}</div>
                              <div className="text-xs text-gray-500">{order?.etsng_cargos?.name}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-mono text-xs text-gray-800">{wagon?.number ?? '—'}</div>
                              <div className="text-xs text-gray-400">{wagon?.wagon_type ? WAGON_TYPE_LABELS[wagon.wagon_type] : ''}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1 text-xs">
                                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{order?.departure_esr_code}</span>
                                <ArrowRight size={10} className="text-gray-400" />
                                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{order?.arrival_esr_code}</span>
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">{order?.departure_station?.name} → {order?.arrival_station?.name}</div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(app.created_at)}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {app.rejection_reason ?? <span className="text-gray-300">—</span>}
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

          {/* Rejected incoming shipper requests */}
          <div className="flex flex-col min-h-0">
            <h3 className="text-sm font-semibold text-gray-600 mb-3 shrink-0">
              Отказанные запросы от грузоотправителей
              {filteredRejectedShipper.length > 0 && <span className="ml-2 text-xs font-normal text-gray-400">({filteredRejectedShipper.length})</span>}
            </h3>
            {filteredRejectedShipper.length === 0 ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-white text-center">
                <XCircle size={28} className="text-gray-200 mb-2" />
                <p className="text-gray-500 text-sm">{filter ? 'Ничего не найдено' : 'Нет отказанных входящих запросов'}</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col flex-1 min-h-0">
                <div className="overflow-auto flex-1 min-h-0">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {['Груз (ГУ-12)', 'Грузоотправитель', 'Вагон', 'Маршрут', 'Дата'].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredRejectedShipper.map((req) => {
                        const order = req.gu12_order as { gu12_number?: string; etsng_cargos?: { name?: string }; departure_esr_code?: string; arrival_esr_code?: string; departure_station?: { name?: string }; arrival_station?: { name?: string }; } | undefined;
                        const wagon = req.wagon as { number?: string; wagon_type?: string } | undefined;
                        return (
                          <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-mono text-xs text-blue-700 font-medium">{order?.gu12_number ?? '—'}</div>
                              <div className="text-xs text-gray-500">{order?.etsng_cargos?.name}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1 text-xs text-gray-400 italic"><Shield size={11} /> Скрыто до оплаты</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-mono text-xs text-gray-800">{wagon?.number ?? '—'}</div>
                              <div className="text-xs text-gray-400">{wagon?.wagon_type ? WAGON_TYPE_LABELS[wagon.wagon_type] : ''}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1 text-xs">
                                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{order?.departure_esr_code}</span>
                                <ArrowRight size={10} className="text-gray-400" />
                                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{order?.arrival_esr_code}</span>
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">{order?.departure_station?.name} → {order?.arrival_station?.name}</div>
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
