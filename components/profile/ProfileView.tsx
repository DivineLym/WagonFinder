'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile, BalanceTransaction } from '@/types';
import { Wallet, Plus, ArrowDownLeft, ArrowUpRight, RotateCcw, CheckCircle, AlertCircle, CreditCard, Lock, ChevronLeft, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

const COMMISSION_KZT = 5_000;
const TOP_UP_PRESETS = [10_000, 25_000, 50_000, 100_000];

function fmtKzt(n: number) {
  return n.toLocaleString('ru-KZ') + ' ₸';
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TX_ICONS = {
  top_up:     <ArrowDownLeft size={14} className="text-green-600" />,
  commission: <ArrowUpRight size={14} className="text-red-500" />,
  refund:     <RotateCcw size={14} className="text-blue-500" />,
};

interface Props {
  profile: Profile;
  transactions: BalanceTransaction[];
}

export function ProfileView({ profile, transactions: initialTx }: Props) {
  const router = useRouter();
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const [balance, setBalance] = useState(profile.balance_kzt);
  const [transactions, setTransactions] = useState(initialTx);
  const [showTopUp, setShowTopUp] = useState(false);
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'amount' | 'card'>('amount');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [topping, startTopUp] = useTransition();
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState(profile.phone ?? '');
  const [savingPhone, setSavingPhone] = useState(false);

  async function savePhone() {
    setSavingPhone(true);
    const supabase = createClient();
    await supabase.from('profiles').update({ phone: phoneValue }).eq('id', profile.id);
    setSavingPhone(false);
    setEditingPhone(false);
    router.refresh();
  }

  function openTopUp() { setAmount(''); setMsg(null); setStep('amount'); setShowTopUp(true); }
  function closeTopUp() { setShowTopUp(false); setMsg(null); setStep('amount'); setCardNumber(''); setCardExpiry(''); setCardCvv(''); setCardName(''); }

  function goToCard() {
    const kzt = Number(amount.replace(/\s/g, ''));
    if (!kzt || kzt < 1000) { setMsg({ type: 'err', text: 'Минимальная сумма — 1 000 ₸' }); return; }
    if (kzt > 10_000_000)   { setMsg({ type: 'err', text: 'Максимальная сумма — 10 000 000 ₸' }); return; }
    setMsg(null);
    setStep('card');
  }

  function fmtCardNumber(v: string) {
    return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  }
  function fmtExpiry(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
  }

  function handleTopUp() {
    const kzt = Number(amount.replace(/\s/g, ''));
    if (!cardNumber || cardNumber.replace(/\s/g, '').length < 16) { setMsg({ type: 'err', text: 'Введите номер карты' }); return; }
    if (!cardExpiry || cardExpiry.length < 5) { setMsg({ type: 'err', text: 'Введите срок действия' }); return; }
    if (!cardCvv || cardCvv.length < 3) { setMsg({ type: 'err', text: 'Введите CVV' }); return; }
    setMsg(null);
    startTopUp(async () => {
      await new Promise((r) => setTimeout(r, 1200));
      const supabase = createClient();
      const { error } = await supabase.rpc('topup_balance', {
        p_profile_id: profile.id,
        p_amount: kzt,
      });
      if (error) { setMsg({ type: 'err', text: error.message }); return; }
      const { data: p } = await supabase.from('profiles').select('balance_kzt').eq('id', profile.id).single();
      if (p) setBalance(p.balance_kzt);
      const { data: tx } = await supabase
        .from('balance_transactions').select('*').eq('profile_id', profile.id)
        .order('created_at', { ascending: false }).limit(50);
      if (tx) setTransactions(tx as BalanceTransaction[]);
      setMsg({ type: 'ok', text: `${t('balance')} +${fmtKzt(kzt)}` });
      router.refresh();
      setTimeout(closeTopUp, 1500);
    });
  }

  const low = balance < COMMISSION_KZT;

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-8">
      <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
            {(profile.full_name || profile.email).charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-gray-900">{profile.full_name}</div>
            <div className="text-sm text-gray-500">{profile.email}</div>
            <div className="text-xs text-gray-400 mt-0.5">{profile.role === 'shipper' ? t('shipper') : t('wagonOwner')}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100 text-sm">
          <div><span className="text-gray-400 text-xs">{t('company')}</span><div className="text-gray-800 font-medium">{profile.company_name || '—'}</div></div>
          <div><span className="text-gray-400 text-xs">{t('bin')}</span><div className="font-mono text-gray-800">{profile.bin || '—'}</div></div>
          <div>
            <span className="text-gray-400 text-xs">{t('phone')}</span>
            {editingPhone ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <input
                  type="tel"
                  value={phoneValue}
                  onChange={(e) => setPhoneValue(e.target.value)}
                  placeholder="+7 (___) ___-__-__"
                  className="border border-gray-300 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300 w-40"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') savePhone(); if (e.key === 'Escape') setEditingPhone(false); }}
                />
                <Button size="sm" onClick={savePhone} loading={savingPhone}>{tc('save')}</Button>
                <button onClick={() => setEditingPhone(false)} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">{tc('cancel')}</button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {profile.phone
                  ? <><span className="text-gray-800">{profile.phone}</span><button onClick={() => setEditingPhone(true)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><Pencil size={12} /></button></>
                  : <button onClick={() => setEditingPhone(true)} className="text-blue-500 hover:text-blue-700 text-sm flex items-center gap-1 cursor-pointer"><Plus size={13} />{t('addPhone')}</button>
                }
              </div>
            )}
          </div>
          <div><span className="text-gray-400 text-xs">{t('payerCode')}</span><div className="font-mono text-gray-800">{profile.ktz_payer_code || '—'}</div></div>
        </div>
      </div>

      {/* Balance card */}
      <div className={`rounded-xl border shadow-sm p-5 ${low ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet size={18} className={low ? 'text-amber-500' : 'text-blue-600'} />
            <span className="font-semibold text-gray-700">{t('balancePlatform')}</span>
          </div>
          <Button size="sm" variant={low ? 'primary' : 'secondary'} onClick={openTopUp}>
            <Plus size={13} /> {t('topUp')}
          </Button>
        </div>

        <div className={`mt-3 text-3xl font-bold ${low ? 'text-amber-700' : 'text-gray-900'}`}>
          {fmtKzt(balance)}
        </div>

        {low && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
            <AlertCircle size={12} />
            {t('insufficientHint', { amount: fmtKzt(COMMISSION_KZT) })}
          </div>
        )}
        {!low && (
          <div className="mt-2 text-xs text-gray-400">
            {t('commissionNote', { amount: fmtKzt(COMMISSION_KZT) })}
          </div>
        )}
      </div>

      {/* Transaction history */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="font-semibold text-sm text-gray-700">{t('history')}</span>
          <span className="text-xs text-gray-400">{transactions.length} {t('transactions')}</span>
        </div>
        {transactions.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">{t('noTransactions')}</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gray-100 shrink-0">
                  {TX_ICONS[tx.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-800 font-medium">{t(`tx_${tx.type}` as Parameters<typeof t>[0])}</div>
                  <div className="text-xs text-gray-400">{fmtDate(tx.created_at)}</div>
                </div>
                <div className={`text-sm font-semibold tabular-nums ${tx.amount_kzt > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.amount_kzt > 0 ? '+' : ''}{fmtKzt(tx.amount_kzt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top-up modal */}
      {showTopUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={closeTopUp}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>

            {step === 'amount' ? <>
              <div className="flex items-center gap-2">
                <Wallet size={18} className="text-blue-600" />
                <h3 className="font-semibold text-gray-900">{t('topUp')}</h3>
              </div>

              <div className="flex gap-2 flex-wrap">
                {TOP_UP_PRESETS.map((p) => (
                  <button key={p} onClick={() => setAmount(String(p))}
                    className={`text-sm px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                      amount === String(p) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'
                    }`}
                  >{fmtKzt(p)}</button>
                ))}
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('topUpAmount')}, ₸</label>
                <input type="number" min={1000} step={1000} value={amount}
                  onChange={(e) => { setAmount(e.target.value); setMsg(null); }}
                  placeholder={t('topUpAmount')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {msg && (
                <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 bg-red-50 text-red-600">
                  <AlertCircle size={14} /> {msg.text}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button className="flex-1" onClick={goToCard} disabled={!amount}>
                  {tc('next')}
                </Button>
                <Button variant="secondary" onClick={closeTopUp}>{tc('cancel')}</Button>
              </div>
            </> : <>
              <div className="flex items-center gap-2">
                <button onClick={() => { setStep('amount'); setMsg(null); }} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                  <ChevronLeft size={18} />
                </button>
                <CreditCard size={18} className="text-blue-600" />
                <h3 className="font-semibold text-gray-900">Данные карты</h3>
                <span className="ml-auto text-sm font-bold text-blue-700">{fmtKzt(Number(amount))}</span>
              </div>

              <div className="rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 p-4 text-white space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-blue-200">WagonFinder Pay</span>
                  <CreditCard size={20} className="text-blue-200" />
                </div>
                <div className="font-mono text-lg tracking-widest">
                  {cardNumber || '•••• •••• •••• ••••'}
                </div>
                <div className="flex justify-between text-xs text-blue-200">
                  <span>{cardName || 'ИМЯ ДЕРЖАТЕЛЯ'}</span>
                  <span>{cardExpiry || 'ММ/ГГ'}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Номер карты</label>
                  <input value={cardNumber} onChange={(e) => { setCardNumber(fmtCardNumber(e.target.value)); setMsg(null); }}
                    placeholder="0000 0000 0000 0000" maxLength={19}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Имя на карте</label>
                  <input value={cardName} onChange={(e) => { setCardName(e.target.value.toUpperCase()); setMsg(null); }}
                    placeholder="IVAN IVANOV"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Срок действия</label>
                    <input value={cardExpiry} onChange={(e) => { setCardExpiry(fmtExpiry(e.target.value)); setMsg(null); }}
                      placeholder="ММ/ГГ" maxLength={5}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs text-gray-500 mb-1">CVV</label>
                    <input value={cardCvv} onChange={(e) => { setCardCvv(e.target.value.replace(/\D/g,'').slice(0,3)); setMsg(null); }}
                      placeholder="•••" maxLength={3} type="password"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                </div>
              </div>

              {msg && (
                <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {msg.type === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  {msg.text}
                </div>
              )}

              <Button className="w-full" onClick={handleTopUp} loading={topping}>
                <Lock size={13} /> {tc('confirm')} {fmtKzt(Number(amount))}
              </Button>

              <p className="text-[11px] text-gray-400 text-center flex items-center justify-center gap-1">
                <Lock size={10} /> Демо-режим: данные карты не передаются и не сохраняются
              </p>
            </>}
          </div>
        </div>
      )}
    </div>
  );
}
