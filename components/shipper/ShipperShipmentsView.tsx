'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';
import type { PendingApplication, RejectedApplication, Profile } from '@/types';
import { CheckCircle, XCircle, Inbox } from 'lucide-react';

const WAGON_TYPE_LABELS: Record<string, string> = {
  tank: 'Цистерна', hopper: 'Хоппер', flatcar: 'Платформа',
  boxcar: 'Крытый', gondola: 'Полувагон', refrigerator: 'Рефрижератор',
};

type AppWithDetails = PendingApplication & {
  wagon: { number: string; wagon_type: string; payload_capacity_tons: number | null };
  wagon_owner: { company_name: string | null; full_name: string; bin: string | null };
};

type RejectedWithDetails = RejectedApplication & {
  wagon: { number: string; wagon_type: string; payload_capacity_tons: number | null };
  wagon_owner: { company_name: string | null; full_name: string; bin: string | null };
};

interface Props {
  applications: AppWithDetails[];
  rejected: RejectedWithDetails[];
  myBin?: string;
  profile?: Profile;
}

export function ShipperShipmentsView({ applications, rejected, myBin = '', profile }: Props) {
  const [appList, setAppList] = useState<AppWithDetails[]>(applications);
  const [updatingApp, setUpdatingApp] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'pending' | 'rejected'>('pending');

  async function updateAppStatus(appId: string, action: 'accepted' | 'rejected') {
    setUpdatingApp(appId);
    const supabase = createClient();
    const app = appList.find((a) => a.id === appId);
    if (!app) { setUpdatingApp(null); return; }

    if (action === 'accepted') {
      const { error } = await supabase
        .from('wagon_owner_pending_requests')
        .update({ status: 'accepted' })
        .eq('id', appId);

      if (!error) {
        const num = `ДУ-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;
        await supabase.from('contracts').insert({
          application_id: appId,
          contract_number: num,
          executor_company: app.wagon_owner.company_name ?? app.wagon_owner.full_name,
          executor_bin: app.wagon_owner.bin ?? '',
          executor_name: app.wagon_owner.full_name,
          customer_company: profile?.company_name ?? profile?.full_name ?? '',
          customer_bin: myBin,
          customer_name: profile?.full_name ?? '',
          wagon_number: app.wagon.number,
          wagon_type: app.wagon.wagon_type,
          cargo_name: app.gu12_order?.cargo_name ?? '',
          cargo_etsng: app.gu12_order?.cargo_etsng_code ?? '',
          departure_station: app.gu12_order?.departure_station_name ?? app.gu12_order?.departure_esr_code ?? '',
          arrival_station: app.gu12_order?.arrival_station_name ?? app.gu12_order?.arrival_esr_code ?? '',
          period_start: app.gu12_order?.period_start ?? new Date().toISOString().slice(0,10),
          period_end: app.gu12_order?.period_end ?? new Date().toISOString().slice(0,10),
        });
        if (app.gu12_order?.id) {
          const { data: ord } = await supabase.from('gu12_orders').select('quantity_fulfilled').eq('id', app.gu12_order.id).single();
          if (ord) await supabase.from('gu12_orders').update({ quantity_fulfilled: (ord.quantity_fulfilled ?? 0) + 1 }).eq('id', app.gu12_order.id);
        }
        setAppList((prev) => prev.filter((a) => a.id !== appId));
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

    setUpdatingApp(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Заявки</h2>
        <p className="text-sm text-gray-500 mt-0.5">Входящие заявки от перевозчиков</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'pending',  label: `Ожидающие${appList.length > 0 ? ` (${appList.length})` : ''}` },
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
        appList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-xl bg-white text-center">
            <Inbox size={36} className="text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Заявок пока нет</p>
            <p className="text-sm text-gray-400 mt-1">Опубликуйте грузы на биржу чтобы получать заявки</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Груз (ГУ-12)', 'Перевозчик', 'Вагон', 'Дата', 'Действие'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {appList.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono text-xs text-blue-700 font-medium">{app.gu12_order?.gu12_number}</div>
                        <div className="text-xs text-gray-500">{app.gu12_order?.cargo_name}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900 text-xs">{app.wagon_owner.company_name ?? app.wagon_owner.full_name}</div>
                        <div className="text-xs text-gray-400">БИН {app.wagon_owner.bin}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono text-xs text-gray-800">{app.wagon.number}</div>
                        <div className="text-xs text-gray-400">{WAGON_TYPE_LABELS[app.wagon.wagon_type]} · {app.wagon.payload_capacity_tons}т</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(app.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button disabled={updatingApp === app.id} onClick={() => updateAppStatus(app.id, 'accepted')}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors cursor-pointer disabled:opacity-40">
                            <CheckCircle size={12} /> Принять
                          </button>
                          <button disabled={updatingApp === app.id} onClick={() => updateAppStatus(app.id, 'rejected')}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-40">
                            <XCircle size={12} /> Отклонить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
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
                    {['Груз (ГУ-12)', 'Перевозчик', 'Вагон', 'Дата отказа'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rejected.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono text-xs text-blue-700 font-medium">{app.gu12_order?.gu12_number}</div>
                        <div className="text-xs text-gray-500">{app.gu12_order?.cargo_name}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900 text-xs">{(app as unknown as AppWithDetails).wagon_owner?.company_name ?? (app as unknown as AppWithDetails).wagon_owner?.full_name ?? '—'}</div>
                        <div className="text-xs text-gray-400">БИН {(app as unknown as AppWithDetails).wagon_owner?.bin ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono text-xs text-gray-800">{(app as unknown as AppWithDetails).wagon?.number ?? '—'}</div>
                        <div className="text-xs text-gray-400">{WAGON_TYPE_LABELS[(app as unknown as AppWithDetails).wagon?.wagon_type ?? ''] ?? ''}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        <span className="flex items-center gap-1 text-red-400"><XCircle size={11} /> {formatDate(app.created_at)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
