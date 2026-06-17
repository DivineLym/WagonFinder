'use client';

import { useState } from 'react';
import { formatDate } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { ArrowRight, Clock, CheckCircle, XCircle, Inbox } from 'lucide-react';
import type { PendingApplication, RejectedApplication, ShipperRequest, Profile } from '@/types';

const WAGON_TYPE_LABELS: Record<string, string> = {
  tank: 'Цистерна', hopper: 'Хоппер', flatcar: 'Платформа',
  boxcar: 'Крытый', gondola: 'Полувагон', refrigerator: 'Рефрижератор',
};

interface Props {
  pending?: PendingApplication[];
  rejected?: RejectedApplication[];
  shipperRequests?: ShipperRequest[];
  profile?: Profile;
}

export function OwnerShipmentsView({ pending = [], rejected = [], shipperRequests = [], profile }: Props) {
  const [subTab, setSubTab] = useState<'pending' | 'rejected'>('pending');
  const [requests, setRequests] = useState<ShipperRequest[]>(shipperRequests);
  const [updatingReq, setUpdatingReq] = useState<string | null>(null);

  async function handleShipperRequest(req: ShipperRequest, action: 'accepted' | 'rejected') {
    setUpdatingReq(req.id);
    const supabase = createClient();

    if (action === 'accepted') {
      const { error } = await supabase
        .from('shipper_pending_requests')
        .update({ status: 'accepted' })
        .eq('id', req.id);

      if (!error) {
        const num = `ДУ-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;
        await supabase.from('contracts').insert({
          application_id: req.id,
          contract_number: num,
          executor_company: profile?.company_name ?? profile?.full_name ?? '',
          executor_bin: profile?.bin ?? '',
          executor_name: profile?.full_name ?? '',
          customer_company: req.shipper?.company_name ?? req.shipper?.full_name ?? '',
          customer_bin: req.shipper?.bin ?? '',
          customer_name: req.shipper?.full_name ?? '',
          wagon_number: req.wagon?.number ?? '',
          wagon_type: req.wagon?.wagon_type ?? '',
          cargo_name: req.gu12_order?.cargo_name ?? '',
          cargo_etsng: req.gu12_order?.cargo_etsng_code ?? '',
          departure_station: req.gu12_order?.departure_station_name ?? req.gu12_order?.departure_esr_code ?? '',
          arrival_station: req.gu12_order?.arrival_station_name ?? req.gu12_order?.arrival_esr_code ?? '',
          period_start: req.gu12_order?.period_start ?? new Date().toISOString().slice(0,10),
          period_end: req.gu12_order?.period_end ?? new Date().toISOString().slice(0,10),
        });
        setRequests((prev) => prev.filter((r) => r.id !== req.id));
      }
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

    setUpdatingReq(null);
  }

  const pendingCount = pending.length + requests.length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Заявки</h2>
        <p className="text-sm text-gray-500 mt-0.5">Поданные заявки и запросы от грузоотправителей</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'pending',  label: `Ожидающие${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          { key: 'rejected', label: `Отказанные${rejected.length > 0 ? ` (${rejected.length})` : ''}` },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setSubTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              subTab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >{label}</button>
        ))}
      </div>

      {subTab === 'pending' && (
        <div className="space-y-6">
          {/* My outgoing pending applications */}
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Мои поданные заявки</h3>
            {pending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-200 rounded-xl bg-white text-center">
                <Inbox size={28} className="text-gray-300 mb-2" />
                <p className="text-gray-500 text-sm">Нет ожидающих заявок</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {['Груз (ГУ-12)', 'Вагон', 'Маршрут', 'Период'].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {pending.map((app) => {
                        const order = app.gu12_order as { gu12_number?: string; cargo_name?: string; departure_esr_code?: string; arrival_esr_code?: string; departure_station_name?: string; arrival_station_name?: string; period_start?: string; period_end?: string } | undefined;
                        const wagon = app.wagon as { number?: string; wagon_type?: string } | undefined;
                        return (
                          <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-mono text-xs text-blue-700 font-medium">{order?.gu12_number ?? '—'}</div>
                              <div className="text-xs text-gray-500">{order?.cargo_name}</div>
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
                              <div className="text-xs text-gray-400 mt-0.5">{order?.departure_station_name} → {order?.arrival_station_name}</div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                              {order?.period_start && `${formatDate(order.period_start)} – ${formatDate(order.period_end ?? '')}`}
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

          {/* Incoming shipper requests */}
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Входящие запросы от грузоотправителей</h3>
            {requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-200 rounded-xl bg-white text-center">
                <Inbox size={28} className="text-gray-300 mb-2" />
                <p className="text-gray-500 text-sm">Нет входящих запросов</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {['Груз (ГУ-12)', 'Грузоотправитель', 'Вагон', 'Период', 'Действие'].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {requests.map((req) => {
                        const order = req.gu12_order as { gu12_number?: string; cargo_name?: string; departure_esr_code?: string; arrival_esr_code?: string; departure_station_name?: string; arrival_station_name?: string; period_start?: string; period_end?: string } | undefined;
                        const wagon = req.wagon as { number?: string; wagon_type?: string } | undefined;
                        return (
                          <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-mono text-xs text-blue-700 font-medium">{order?.gu12_number ?? '—'}</div>
                              <div className="text-xs text-gray-500">{order?.cargo_name}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-medium text-gray-900 text-xs">{req.shipper?.company_name ?? req.shipper?.full_name ?? '—'}</div>
                              <div className="text-xs text-gray-400">БИН {req.shipper?.bin ?? '—'}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-mono text-xs text-gray-800">{wagon?.number ?? '—'}</div>
                              <div className="text-xs text-gray-400">{wagon?.wagon_type ? WAGON_TYPE_LABELS[wagon.wagon_type] : ''}</div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
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
        </div>
      )}

      {subTab === 'rejected' && (
        rejected.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-xl bg-white text-center">
            <XCircle size={36} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">Нет отказанных заявок</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Груз (ГУ-12)', 'Вагон', 'Маршрут', 'Дата отказа', 'Причина'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rejected.map((app) => {
                    const order = app.gu12_order as { gu12_number?: string; cargo_name?: string; departure_esr_code?: string; arrival_esr_code?: string; departure_station_name?: string; arrival_station_name?: string } | undefined;
                    const wagon = app.wagon as { number?: string; wagon_type?: string } | undefined;
                    return (
                      <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-mono text-xs text-blue-700 font-medium">{order?.gu12_number ?? '—'}</div>
                          <div className="text-xs text-gray-500">{order?.cargo_name}</div>
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
                          <div className="text-xs text-gray-400 mt-0.5">{order?.departure_station_name} → {order?.arrival_station_name}</div>
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
        )
      )}
    </div>
  );
}
