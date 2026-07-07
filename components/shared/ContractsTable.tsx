'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Clock, CheckCircle, Shield, FileText, CreditCard, AlertCircle, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Contract, Profile } from '@/types';
import { calcCommission } from '@/services/commissionService';
import { useTranslations } from 'next-intl';

const COMMISSION_RATES = [
  { range: '1–5',         commission: 7_800 },
  { range: '6–20',        commission: 6_500 },
  { range: '21–60',       commission: 5_200 },
  { range: '61–80',       commission: 3_250 },
  { range: '81–120',      commission: 1_950 },
  { range: '121–160',     commission:   972 },
  { range: '161–200',     commission:   850 },
  { range: '201–299',     commission:   660 },
  { range: '300–399',     commission:   575 },
  { range: '400–599',     commission:   527 },
  { range: '600–999',     commission:   480 },
  { range: '1 000–1 999', commission:   469 },
  { range: '2 000–2 999', commission:   450 },
  { range: '3 000–4 999', commission:   439 },
  { range: '5 000–9 999', commission:   408 },
  { range: '10 000+',     commission:   360 },
];

function CommissionRatesInfo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="shrink-0 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 cursor-pointer transition-colors px-1">
        <CreditCard size={13} />
        <span className="font-medium">Ставки комиссии платформы</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CreditCard size={15} className="text-blue-600" />
                <span className="font-semibold text-gray-900 text-sm">Ставки комиссии платформы</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors">✕</button>
            </div>
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Кол-во вагонов</th>
                    <th className="text-right px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Комиссия за вагон</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {COMMISSION_RATES.map(({ range, commission }) => (
                    <tr key={range} className="hover:bg-gray-50">
                      <td className="px-5 py-2.5 text-gray-700">{range}</td>
                      <td className="px-5 py-2.5 text-right font-medium text-blue-700">{commission.toLocaleString('ru-KZ')} ₸</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const WAGON_TYPE_KEYS: Record<string, string> = {
  tank: 'tank', hopper: 'hopper', flatcar: 'flatcar',
  boxcar: 'boxcar', gondola: 'gondola', refrigerator: 'refrigerator',
};

function fmtKzt(n: number) { return n.toLocaleString('ru-KZ') + ' ₸'; }

function getCommission(c: Contract): number {
  const wagonCount = (c.contract_wagons && c.contract_wagons.length > 0) ? c.contract_wagons.length : 1;
  const dealType = c.deal_type ?? 'spot';
  return calcCommission(wagonCount, dealType).perParty;
}
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
  const t = useTranslations('contracts');
  const tw = useTranslations('wagonTypes');
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
  const modalCommission = payModal ? getCommission(payModal) : 0;
  const insufficient = balance < modalCommission;

  async function payCommission(contractId: string) {
    const contract = contracts.find((c) => c.id === contractId);
    if (!contract) return;
    const commission = getCommission(contract);
    if (balance < commission) { setPayError(`${t('insufficientFunds')}. ${fmtKzt(commission)} / ${fmtKzt(balance)}.`); return; }
    setPaying(contractId);
    setPayError('');
    const supabase = createClient();

    const { data: ok } = await supabase.rpc('deduct_commission', {
      p_profile_id: profile.id,
      p_amount: commission,
      p_contract_id: contractId,
      p_description: t('commission'),
    });
    if (!ok) { setPayError('Ошибка списания. Проверьте баланс.'); setPaying(null); return; }
    setPayModal(null);
    setBalance((b) => b - commission);

    const field = role === 'executor' ? 'executor_paid_at' : 'customer_paid_at';
    const now = new Date().toISOString();
    await supabase.from('contracts').update({ [field]: now }).eq('id', contractId);

    const updated = { ...contracts.find((c) => c.id === contractId)!, [field]: now };
    const bothPaid = !!updated.executor_paid_at && !!updated.customer_paid_at;
    if (bothPaid) {
      await supabase.from('contracts').update({ status: 'pending_signature' }).eq('id', contractId);
      updated.status = 'pending_signature';
    }

    setContracts((prev) => prev.map((c) => c.id === contractId ? updated : c));
    setPaying(null);
    setPayModal(null);
    router.refresh();

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
            { key: 'payment', label: `${t('tabPayment')}${awaitingPayment.length > 0 ? ` (${awaitingPayment.length})` : ''}` },
            { key: 'pending', label: `${t('tabPending')}${pending.length > 0 ? ` (${pending.length})` : ''}` },
            { key: 'signed',  label: `${t('tabSigned')}${signed.length > 0 ? ` (${signed.length})` : ''}` },
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
          {insufficient && <span className="opacity-70">· {t('topUp')}</span>}
        </Link>
      </div>

      {payError && (
        <div className="flex items-center gap-2 text-sm rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-red-700 shrink-0">
          <AlertCircle size={14} /> {payError}
          <Link href="/profile" className="ml-auto text-xs underline underline-offset-2">{t('topUp')}</Link>
        </div>
      )}

      {tab === 'payment' && visible.length > 0 && <CommissionRatesInfo />}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-xl bg-white text-center flex-1">
          <FileText size={36} className="text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">
            {tab === 'payment' ? t('noAwaitingPayment') : tab === 'pending' ? t('noAwaitingSignature') : t('noSigned')}
          </p>
          {tab === 'payment' && <p className="text-sm text-gray-400 mt-1">{t('contractsAppearAfter')}</p>}
          {tab === 'pending' && emptyHint && <p className="text-sm text-gray-400 mt-1">{emptyHint}</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col flex-1 min-h-0">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-gray-100 bg-gray-50">
                  {[t('number'), role === 'executor' ? t('customer') : t('carrier'), t('wagon'), t('cargo'), t('route'), t('period'), t('awaitingSignature').replace('Ожидает ', ''), ''].map((h, i) => (
                    <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visible.map((c) => {
                  const myPaid   = role === 'executor' ? !!c.executor_paid_at : !!c.customer_paid_at;
                  const mySigned = role === 'executor' ? !!c.executor_signed_at : !!c.customer_signed_at;
                  const bothSigned = !!c.executor_signed_at && !!c.customer_signed_at;
                  const bothPaidContract = !!c.executor_paid_at && !!c.customer_paid_at;
                  const counterparty = role === 'executor'
                    ? { company: c.customer_company, bin: c.customer_bin }
                    : { company: c.executor_company, bin: c.executor_bin };

                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-blue-700 font-medium whitespace-nowrap">{c.contract_number}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {bothPaidContract ? (
                          <>
                            <div className="font-medium text-gray-900 text-xs">{counterparty.company}</div>
                            <div className="text-xs text-gray-400">БИН {counterparty.bin}</div>
                          </>
                        ) : (
                          <>
                            <div className="font-medium text-gray-400 text-xs italic flex items-center gap-1"><Shield size={11} /> Скрыто до оплаты</div>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {c.contract_wagons && c.contract_wagons.length > 0 ? (
                          <>
                            <div className="font-mono text-xs text-gray-800">
                              {c.contract_wagons.length === 1
                                ? c.contract_wagons[0].wagon_number
                                : `${c.contract_wagons.length} вагона`}
                            </div>
                            <div className="text-xs text-gray-400">
                              {c.contract_wagons.length === 1
                                ? tw(WAGON_TYPE_KEYS[c.contract_wagons[0].wagon_type] as Parameters<typeof tw>[0] ?? 'tank')
                                : c.contract_wagons.map((w) => w.wagon_number).join(', ')}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="font-mono text-xs text-gray-800">{c.wagon_number ?? '—'}</div>
                            <div className="text-xs text-gray-400">{c.wagon_type ? tw(WAGON_TYPE_KEYS[c.wagon_type] as Parameters<typeof tw>[0] ?? 'tank') : ''}</div>
                          </>
                        )}
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
                              <Clock size={11} /> {t('awaitingBothParties')}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full w-fit border border-blue-200">
                              <CreditCard size={11} /> {t('awaitingPayment')}
                            </span>
                          )
                        ) : bothSigned ? (
                          <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full w-fit">
                            <CheckCircle size={11} /> {t('signed')}
                          </span>
                        ) : mySigned ? (
                          <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full w-fit">
                            <Clock size={11} /> {t('awaitingOtherParty')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full w-fit">
                            <Clock size={11} /> {t('awaitingYourSignature')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tab === 'payment' && !myPaid ? (
                          <button
                            onClick={() => { setPayError(''); setPayModal(c); }}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 border border-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer"
                          >
                            <CreditCard size={12} /> {t('pay')}
                          </button>
                        ) : (
                          <Link href={`/contract?id=${c.id}`}>
                            <button className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer">
                              <Shield size={12} /> {bothSigned ? t('view') : tab === 'payment' ? t('view') : mySigned ? t('view') : t('sign')}
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
              <h3 className="text-base font-semibold text-gray-900">{t('payCommission')}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{t('commissionNote')}</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('number')}</span>
                <span className="font-mono font-semibold text-blue-700">{payModal.contract_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{role === 'executor' ? t('customer') : t('carrier')}</span>
                <span className="font-medium text-gray-400 italic flex items-center gap-1 text-xs">
                  <Shield size={11} /> Скрыто до оплаты
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('wagon')}</span>
                <span className="font-mono text-gray-800">
                  {payModal.contract_wagons && payModal.contract_wagons.length > 0
                    ? payModal.contract_wagons.map((w) => w.wagon_number).join(', ')
                    : payModal.wagon_number ?? '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('cargo')}</span>
                <span className="text-gray-800">{payModal.cargo_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('route')}</span>
                <span className="text-gray-800">{payModal.departure_station} → {payModal.arrival_station}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {(() => {
                const info = calcCommission(
                  (payModal.contract_wagons && payModal.contract_wagons.length > 0) ? payModal.contract_wagons.length : 1,
                  payModal.deal_type ?? 'spot',
                );
                return (
                  <>
                    <div className="flex justify-between items-center text-xs text-gray-400">
                      <span>{payModal.contract_wagons?.length ?? 1} вагон × {fmtKzt(info.ratePerWagon)} × 65%</span>
                      <span className="text-gray-500">{payModal.deal_type === 'lease' ? 'аренда' : 'тех. рейс'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">{t('commission')}</span>
                      <span className="font-bold text-gray-900 text-base">{fmtKzt(info.perParty)}</span>
                    </div>
                  </>
                );
              })()}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">{t('balance')}</span>
                <span className={`font-semibold ${insufficient ? 'text-red-600' : 'text-green-600'}`}>{fmtKzt(balance)}</span>
              </div>
              {!insufficient && (
                <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-2">
                  <span className="text-gray-500">{t('afterPayment')}</span>
                  <span className="font-medium text-gray-700">{fmtKzt(balance - modalCommission)}</span>
                </div>
              )}
            </div>

            {insufficient && (
              <div className="flex items-center gap-2 text-sm rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-red-700">
                <AlertCircle size={14} className="shrink-0" />
                {t('insufficientFunds')}. <Link href="/profile" className="underline underline-offset-2 font-medium">{t('insufficientFundsHint')}</Link>.
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
                disabled={paying === payModal.id || insufficient}
                onClick={() => payCommission(payModal.id)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors font-medium"
              >
                <CreditCard size={14} />
                {paying === payModal.id ? t('processing') : `${t('pay')} ${fmtKzt(modalCommission)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
