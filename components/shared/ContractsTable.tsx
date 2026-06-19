'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Clock, CheckCircle, Shield, FileText, CreditCard, AlertCircle, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Contract, Profile } from '@/types';

const WAGON_TYPE_LABELS: Record<string, string> = {
  tank: 'Цистерна', hopper: 'Хоппер', flatcar: 'Платформа',
  boxcar: 'Крытый', gondola: 'Полувагон', refrigerator: 'Рефрижератор',
};

const COMMISSION_KZT = 5_000;
function fmtKzt(n: number) { return n.toLocaleString('ru-KZ') + ' ₸'; }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('ru-RU'); }

interface Props {
  contracts: Contract[];
  myBin: string;
  role: 'executor' | 'customer';
  profile: Profile;
  emptyHint?: string;
}

export function ContractsTable({ contracts: initial, myBin, role, profile, emptyHint }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'payment' | 'pending' | 'signed'>('payment');
  const [contracts, setContracts] = useState<Contract[]>(initial);
  const [paying, setPaying] = useState<string | null>(null);
  const [payModal, setPayModal] = useState<Contract | null>(null);
  const [balance, setBalance] = useState(profile.balance_kzt);
  const [payError, setPayError] = useState('');
  const [, startTransition] = useTransition();

  const awaitingPayment = contracts.filter((c) => c.status === 'pending_payment');
  const pending = contracts.filter((c) => c.status === 'pending_signature');
  const signed  = contracts.filter((c) => c.status === 'signed' || (!!c.executor_signed_at && !!c.customer_signed_at));

  const visible = tab === 'payment' ? awaitingPayment : tab === 'pending' ? pending : signed;
  const insufficient = balance < COMMISSION_KZT;

  async function payCommission(contractId: string) {
    if (insufficient) { setPayError(`Недостаточно средств. Нужно ${fmtKzt(COMMISSION_KZT)}, на балансе ${fmtKzt(balance)}.`); return; }
    setPaying(contractId);
    setPayError('');
    const supabase = createClient();

    const { data: ok } = await supabase.rpc('deduct_commission', {
      p_profile_id: profile.id,
      p_amount: COMMISSION_KZT,
      p_contract_id: contractId,
      p_description: `Комиссия за подбор вагона`,
    });
    if (!ok) { setPayError('Ошибка списания. Проверьте баланс.'); setPaying(null); return; }
    setBalance((b) => b - COMMISSION_KZT);

    // Mark this party as paid
    const field = role === 'executor' ? 'executor_paid_at' : 'customer_paid_at';
    const now = new Date().toISOString();
    await supabase.from('contracts').update({ [field]: now }).eq('id', contractId);

    // Check if both paid — if so, advance to pending_signature
    const updated = { ...contracts.find((c) => c.id === contractId)!, [field]: now };
    const bothPaid = !!updated.executor_paid_at && !!updated.customer_paid_at;
    if (bothPaid) {
      await supabase.from('contracts').update({ status: 'pending_signature' }).eq('id', contractId);
      updated.status = 'pending_signature';
    }

    setContracts((prev) => prev.map((c) => c.id === contractId ? updated : c));
    setPaying(null);
    setPayModal(null);
    router.refresh(); // обновляет баланс в сайдбаре

    // Switch tab if this contract is no longer in current tab
    startTransition(() => {
      if (tab === 'payment' && bothPaid) setTab('pending');
    });
  }

  return (
    <div className="h-full flex flex-col gap-4 min-h-0 flex-1">
      {/* Sub-tabs */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex gap-1 border-b border-gray-200 flex-1">
          {([
            { key: 'payment', label: `Ожидают оплаты${awaitingPayment.length > 0 ? ` (${awaitingPayment.length})` : ''}` },
            { key: 'pending', label: `Ожидают подписи${pending.length > 0 ? ` (${pending.length})` : ''}` },
            { key: 'signed',  label: `Подписанные${signed.length > 0 ? ` (${signed.length})` : ''}` },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >{label}</button>
          ))}
        </div>
        <Link href="/profile"
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ml-4 transition-colors ${
            insufficient ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' : 'bg-blue-50 border-blue-100 text-blue-700 hover:bg-blue-100'
          }`}
        >
          <Wallet size={12} />
          <span className="font-semibold">{fmtKzt(balance)}</span>
          {insufficient && <span className="opacity-70">· Пополнить</span>}
        </Link>
      </div>

      {payError && (
        <div className="flex items-center gap-2 text-sm rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-red-700 shrink-0">
          <AlertCircle size={14} /> {payError}
          <Link href="/profile" className="ml-auto text-xs underline underline-offset-2">Пополнить баланс</Link>
        </div>
      )}

      {tab === 'payment' && visible.length > 0 && (
        <div className="flex items-start gap-2 text-sm rounded-lg bg-blue-50 border border-blue-100 px-4 py-2.5 text-blue-700 shrink-0">
          <CreditCard size={15} className="mt-0.5 shrink-0" />
          <span>Чтобы сформировать договор, каждая из сторон должна оплатить комиссию платформы — <strong>{fmtKzt(COMMISSION_KZT)}</strong>. После оплаты обеими сторонами договор перейдёт на подписание.</span>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-xl bg-white text-center flex-1">
          <FileText size={36} className="text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">
            {tab === 'payment' ? 'Нет договоров, ожидающих оплаты' : tab === 'pending' ? 'Нет договоров, ожидающих подписи' : 'Нет подписанных договоров'}
          </p>
          {tab === 'payment' && <p className="text-sm text-gray-400 mt-1">Договора появятся после принятия заявки</p>}
          {tab === 'pending' && emptyHint && <p className="text-sm text-gray-400 mt-1">{emptyHint}</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col flex-1 min-h-0">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['№ Договора', role === 'executor' ? 'Заказчик' : 'Перевозчик', 'Вагон', 'Груз', 'Маршрут', 'Период', 'Статус', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visible.map((c) => {
                  const myPaid   = role === 'executor' ? !!c.executor_paid_at : !!c.customer_paid_at;
                  const mySigned = role === 'executor' ? !!c.executor_signed_at : !!c.customer_signed_at;
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
                        {fmtDate(c.period_start)} – {fmtDate(c.period_end)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tab === 'payment' ? (
                          myPaid ? (
                            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full w-fit">
                              <Clock size={11} /> Ждём вторую сторону
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full w-fit border border-blue-200">
                              <CreditCard size={11} /> Ожидает оплаты
                            </span>
                          )
                        ) : bothSigned ? (
                          <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full w-fit">
                            <CheckCircle size={11} /> Подписан
                          </span>
                        ) : mySigned ? (
                          <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full w-fit">
                            <Clock size={11} /> Ждёт другую сторону
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full w-fit">
                            <Clock size={11} /> Ожидает вашей подписи
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tab === 'payment' && !myPaid ? (
                          <button
                            onClick={() => { setPayError(''); setPayModal(c); }}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 border border-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer"
                          >
                            <CreditCard size={12} /> Оплатить
                          </button>
                        ) : (
                          <Link href={`/contract?application_id=${c.application_id}`}>
                            <button className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer">
                              <Shield size={12} /> {bothSigned ? 'Просмотр' : tab === 'payment' ? 'Просмотр' : mySigned ? 'Просмотр' : 'Подписать'}
                            </button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setPayModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 flex flex-col gap-5" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Оплата комиссии платформы</h3>
              <p className="text-sm text-gray-500 mt-0.5">Комиссия списывается с вашего баланса</p>
            </div>

            {/* Contract details */}
            <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Договор</span>
                <span className="font-mono font-semibold text-blue-700">{payModal.contract_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{role === 'executor' ? 'Заказчик' : 'Перевозчик'}</span>
                <span className="font-medium text-gray-800">{role === 'executor' ? payModal.customer_company : payModal.executor_company}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Вагон</span>
                <span className="font-mono text-gray-800">{payModal.wagon_number} · {WAGON_TYPE_LABELS[payModal.wagon_type] ?? payModal.wagon_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Груз</span>
                <span className="text-gray-800">{payModal.cargo_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Маршрут</span>
                <span className="text-gray-800">{payModal.departure_station} → {payModal.arrival_station}</span>
              </div>
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Комиссия платформы</span>
                <span className="font-bold text-gray-900 text-base">{fmtKzt(COMMISSION_KZT)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Ваш баланс</span>
                <span className={`font-semibold ${balance < COMMISSION_KZT ? 'text-red-600' : 'text-green-600'}`}>{fmtKzt(balance)}</span>
              </div>
              {balance >= COMMISSION_KZT && (
                <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-2">
                  <span className="text-gray-500">После оплаты</span>
                  <span className="font-medium text-gray-700">{fmtKzt(balance - COMMISSION_KZT)}</span>
                </div>
              )}
            </div>

            {balance < COMMISSION_KZT && (
              <div className="flex items-center gap-2 text-sm rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-red-700">
                <AlertCircle size={14} className="shrink-0" />
                Недостаточно средств. Пополните баланс в <Link href="/profile" className="underline underline-offset-2 font-medium">профиле</Link>.
              </div>
            )}

            {payError && (
              <div className="flex items-center gap-2 text-sm rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-red-700">
                <AlertCircle size={14} className="shrink-0" /> {payError}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={() => setPayModal(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">
                Отмена
              </button>
              <button
                disabled={paying === payModal.id || balance < COMMISSION_KZT}
                onClick={() => payCommission(payModal.id)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors font-medium"
              >
                <CreditCard size={14} />
                {paying === payModal.id ? 'Обработка...' : `Оплатить ${fmtKzt(COMMISSION_KZT)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
