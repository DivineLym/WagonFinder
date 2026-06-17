'use client';

import Link from 'next/link';
import { ArrowRight, Clock, CheckCircle, Shield, FileText } from 'lucide-react';
import type { Contract } from '@/types';

const WAGON_TYPE_LABELS: Record<string, string> = {
  tank: 'Цистерна', hopper: 'Хоппер', flatcar: 'Платформа',
  boxcar: 'Крытый', gondola: 'Полувагон', refrigerator: 'Рефрижератор',
};

interface Props {
  contracts: Contract[];
  myBin: string;
  role: 'executor' | 'customer';
  emptyHint?: string;
}

export function ContractsTable({ contracts, myBin, role, emptyHint }: Props) {
  if (contracts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-xl bg-white text-center">
        <FileText size={36} className="text-gray-300 mb-3" />
        <p className="text-gray-500 font-medium">Договоров пока нет</p>
        {emptyHint && <p className="text-sm text-gray-400 mt-1">{emptyHint}</p>}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['№ Договора', role === 'executor' ? 'Заказчик' : 'Перевозчик', 'Вагон', 'Груз', 'Маршрут', 'Период', 'Подписан', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {contracts.map((c) => {
              const isMine = role === 'executor' ? myBin === c.executor_bin : myBin === c.customer_bin;
              const mySigned = isMine
                ? (role === 'executor' ? !!c.executor_signed_at : !!c.customer_signed_at)
                : false;
              const bothSigned = !!c.executor_signed_at && !!c.customer_signed_at;
              const counterparty = role === 'executor'
                ? { company: c.customer_company, bin: c.customer_bin }
                : { company: c.executor_company, bin: c.executor_bin };

              return (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-blue-700 font-medium whitespace-nowrap">{c.contract_number}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium text-gray-900 text-xs">{counterparty.company}</div>
                    <div className="text-xs text-gray-400">БИН {counterparty.bin}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-mono text-xs text-gray-800">{c.wagon_number}</div>
                    <div className="text-xs text-gray-400">{WAGON_TYPE_LABELS[c.wagon_type] ?? c.wagon_type}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-xs text-gray-800">{c.cargo_name}</div>
                    <div className="font-mono text-xs text-gray-400">{c.cargo_etsng}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-gray-600">{c.departure_station}</span>
                      <ArrowRight size={10} className="text-gray-400" />
                      <span className="text-gray-600">{c.arrival_station}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(c.period_start).toLocaleDateString('ru-RU')} – {new Date(c.period_end).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {bothSigned ? (
                      <span className="flex items-center gap-1 text-xs text-green-700"><CheckCircle size={12} /> Обе стороны</span>
                    ) : mySigned ? (
                      <span className="text-xs text-amber-600">Ожидает другую сторону</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-red-600"><Clock size={12} /> Ожидает вашей подписи</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/contract?application_id=${c.application_id}`}>
                      <button className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer">
                        <Shield size={12} /> {mySigned ? 'Просмотр' : 'Подписать'}
                      </button>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
