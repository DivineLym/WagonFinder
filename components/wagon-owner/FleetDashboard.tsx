'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { formatDate, daysUntil } from '@/lib/utils';
import type { Profile, Wagon, WagonType } from '@/types';
import { Train, Wrench, Plus, RefreshCw, AlertTriangle, Info, Pencil, Search, X } from 'lucide-react';
import wagonModels from '@/lib/wagonModels.json';
import { useTranslations } from 'next-intl';

const TYPE_LABELS: Record<string, string> = {
  tank: 'Цистерна', hopper: 'Хоппер', flatcar: 'Платформа',
  boxcar: 'Крытый', gondola: 'Полувагон', refrigerator: 'Рефрижератор',
};

const WAGON_TYPES: WagonType[] = ['tank', 'hopper', 'flatcar', 'boxcar', 'gondola', 'refrigerator'];

// STATUS_MAP built dynamically in component with translations

interface WagonModel {
  model: string;
  type_name: string;
  type: WagonType;
  payload_t: number | null;
  volume_m3: number | null;
}

const MODELS_DB: WagonModel[] = wagonModels as WagonModel[];

interface Props { profile: Profile; wagons: Wagon[]; }

interface WagonForm {
  number: string;
  wagon_type: WagonType;
  model_number: string;
  payload_capacity_tons: string;
  volume_m3: string;
  tare_weight_tons: string;
  last_repair_date: string;
  next_repair_date: string;
  status: 'active' | 'in_repair';
  availability_type: 'spot' | 'lease' | 'both';
}

const EMPTY_FORM: WagonForm = {
  number: '', wagon_type: 'gondola', model_number: '',
  payload_capacity_tons: '', volume_m3: '', tare_weight_tons: '',
  last_repair_date: '', next_repair_date: '',
  status: 'active',
  availability_type: 'both',
};

export function FleetDashboard({ profile, wagons: initial }: Props) {
  const router = useRouter();
  const tf = useTranslations('fleet');
  const tw = useTranslations('wagonTypes');
  const [wagons, setWagons] = useState(initial);
  const [editingAvail, setEditingAvail] = useState<string | null>(null);
  const [savingAvail, setSavingAvail] = useState<string | null>(null);
  const [editingRepair, setEditingRepair] = useState<string | null>(null);
  const [repairForm, setRepairForm] = useState({ last: '', next: '' });
  const [savingRepair, setSavingRepair] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<WagonForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modelLocked, setModelLocked] = useState(false); // true when known model selected
  const [modelWarning, setModelWarning] = useState('');  // unknown model warning
  const [suggestions, setSuggestions] = useState<WagonModel[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestRef = useRef<HTMLDivElement>(null);

  function openRepairEdit(wagon: typeof initial[0]) {
    setRepairForm({
      last: wagon.last_repair_date ?? '',
      next: wagon.next_repair_date ?? '',
    });
    setEditingRepair(wagon.id);
  }

  async function saveRepair(wagonId: string) {
    setSavingRepair(wagonId);
    const supabase = createClient();
    const { error } = await supabase.from('wagons').update({
      last_repair_date: repairForm.last || null,
      next_repair_date: repairForm.next || null,
    }).eq('id', wagonId);
    if (!error) {
      setWagons((prev) => prev.map((w) => w.id === wagonId
        ? { ...w, last_repair_date: repairForm.last || null, next_repair_date: repairForm.next || null }
        : w));
    }
    setSavingRepair(null);
    setEditingRepair(null);
  }

  async function saveAvailType(wagonId: string, value: 'spot' | 'lease' | 'both') {
    setSavingAvail(wagonId);
    const supabase = createClient();
    const { error } = await supabase.from('wagons').update({ availability_type: value }).eq('id', wagonId);
    if (!error) {
      setWagons((prev) => prev.map((w) => w.id === wagonId ? { ...w, availability_type: value } : w));
    }
    setSavingAvail(null);
    setEditingAvail(null);
  }

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAvail, setFilterAvail] = useState('');

  const total = wagons.length;
  const active = wagons.filter((w) => w.status === 'active').length;
  const criticalRepair = wagons.filter((w) => { const d = daysUntil(w.next_repair_date); return d !== null && d < 30; }).length;

  const filtered = wagons.filter((w) => {
    if (search) {
      const q = search.toLowerCase();
      if (!w.number.toLowerCase().includes(q) && !(w.model_number ?? '').toLowerCase().includes(q)) return false;
    }
    if (filterType && w.wagon_type !== filterType) return false;
    if (filterStatus && w.status !== filterStatus) return false;
    if (filterAvail && w.availability_type !== filterAvail) return false;
    return true;
  });
  const hasFilters = search || filterType || filterStatus || filterAvail;

  // Close suggestions on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function setField<K extends keyof WagonForm>(key: K, value: WagonForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setSaveError('');
    setModelLocked(false);
    setModelWarning('');
    setSuggestions([]);
    setShowAdd(true);
  }

  function closeAdd() { setShowAdd(false); }

  function handleModelInput(val: string) {
    setField('model_number', val);
    setModelLocked(false);
    setModelWarning('');

    if (val.length < 1) { setSuggestions([]); setShowSuggestions(false); return; }
    const q = val.toUpperCase();
    const matches = MODELS_DB.filter((m) => m.model.toUpperCase().includes(q)).slice(0, 50);
    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  }

  function selectModel(m: WagonModel) {
    setForm((prev) => ({
      ...prev,
      model_number: m.model,
      wagon_type: m.type,
      payload_capacity_tons: m.payload_t != null ? String(m.payload_t) : prev.payload_capacity_tons,
      volume_m3: m.volume_m3 != null ? String(m.volume_m3) : prev.volume_m3,
    }));
    setModelLocked(true);
    setModelWarning('');
    setShowSuggestions(false);
    setSuggestions([]);
  }

  function handleModelBlur() {
    setTimeout(() => {
      setShowSuggestions(false);
      // Check if entered model exists in DB
      if (form.model_number.trim().length > 0) {
        const exact = MODELS_DB.find(
          (m) => m.model.toUpperCase() === form.model_number.trim().toUpperCase()
        );
        if (!exact) {
          setModelWarning('Модель не найдена в справочнике. Проверьте данные и вводите характеристики самостоятельно.');
        }
      }
    }, 150);
  }

  function clearModel() {
    setField('model_number', '');
    setModelLocked(false);
    setModelWarning('');
    setSuggestions([]);
  }

  async function handleSave() {
    setSaveError('');
    if (form.number.length !== 8) { setSaveError('Введите 8-значный номер вагона'); return; }
    if (form.last_repair_date && form.next_repair_date && form.next_repair_date <= form.last_repair_date) {
      setSaveError('Дата следующего ремонта должна быть позже даты последнего ремонта'); return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('wagons').insert({
      number: form.number,
      owner_id: profile.id,
      wagon_type: form.wagon_type,
      model_number: form.model_number || null,
      payload_capacity_tons: form.payload_capacity_tons ? Number(form.payload_capacity_tons) : null,
      volume_m3: form.volume_m3 ? Number(form.volume_m3) : null,
      tare_weight_tons: form.tare_weight_tons ? Number(form.tare_weight_tons) : null,
      last_repair_date: form.last_repair_date || null,
      next_repair_date: form.next_repair_date || null,
      status: form.status,
      availability_type: form.availability_type,
    });
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    closeAdd();
    router.refresh();
  }

  return (
    <div className="h-full flex flex-col gap-4 min-h-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{tf('title')}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{profile.company_name} · БИН {profile.bin}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-gray-400 border border-dashed border-gray-300 px-3 py-1.5 rounded-lg">
            <RefreshCw size={12} /> Дислокация (ВМД) — скоро
          </span>
          <Button size="sm" onClick={openAdd}><Plus size={13} /> {tf('addWagon')}</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        {[
          { label: tf('totalWagons'),  value: total,          color: 'text-gray-900' },
          { label: tf('operational'),  value: active,         color: 'text-blue-700'  },
          { label: tf('inRepair'),     value: total - active, color: total - active > 0 ? 'text-amber-600' : 'text-gray-400' },
          { label: tf('repairSoon'),   value: criticalRepair, color: criticalRepair > 0 ? 'text-red-600' : 'text-gray-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-end gap-3 shrink-0 flex-wrap">
        {/* Search */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide px-1">Поиск</span>
          <div className="relative bg-white border border-gray-200 rounded-lg shadow-sm h-[38px] flex items-center">
            <Search size={13} className="absolute left-2.5 text-gray-400 pointer-events-none" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Номер вагона или модель..."
              className="pl-7 pr-6 text-sm focus:outline-none bg-transparent text-gray-600 w-52 h-full" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 text-gray-300 hover:text-gray-500 cursor-pointer"><X size={13} /></button>
            )}
          </div>
        </div>

        {/* Wagon type */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide px-1">Тип вагона</span>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg shadow-sm py-2 pl-3 pr-8 text-sm focus:outline-none text-gray-700 cursor-pointer h-[38px]">
            <option value="">Все типы</option>
            {(['tank','hopper','flatcar','boxcar','gondola','refrigerator'] as const).map((t) => (
              <option key={t} value={t}>{tw(t)}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide px-1">Статус</span>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg shadow-sm py-2 pl-3 pr-8 text-sm focus:outline-none text-gray-700 cursor-pointer h-[38px]">
            <option value="">Все статусы</option>
            <option value="active">{tf('operational')}</option>
            <option value="in_repair">{tf('inRepair')}</option>
            <option value="booked">Занят</option>
          </select>
        </div>

        {/* Avail type */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide px-1">Тип сдачи</span>
          <select value={filterAvail} onChange={(e) => setFilterAvail(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg shadow-sm py-2 pl-3 pr-8 text-sm focus:outline-none text-gray-700 cursor-pointer h-[38px]">
            <option value="">Все</option>
            <option value="spot">{tf('availability_spot')}</option>
            <option value="lease">{tf('availability_lease')}</option>
            <option value="both">{tf('availability_both')}</option>
          </select>
        </div>

        {hasFilters && (
          <div className="flex items-center gap-3 pb-0.5">
            <button onClick={() => { setSearch(''); setFilterType(''); setFilterStatus(''); setFilterAvail(''); }}
              className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer px-2.5 py-2 border border-dashed border-gray-300 rounded-lg transition-colors h-[38px]">
              Сбросить
            </button>
            <span className="text-xs text-gray-400 whitespace-nowrap">{filtered.length} из {total}</span>
          </div>
        )}
      </div>

      {/* Table */}
      {wagons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-xl bg-white text-center">
          <Train size={36} className="text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium mb-4">{tf('noWagons')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-0 flex-1">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 sticky top-0 z-10">
                  {[tf('wagonNumber'), tf('typeModel'), tf('payload'), tf('availabilityType'), tf('lastRepair'), tf('nextRepair'), tf('status')].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center px-4 py-12 text-gray-400 text-sm">Ничего не найдено</td></tr>
                )}
                {filtered.map((wagon) => {
                  const days = daysUntil(wagon.next_repair_date);
                  const CONTRACT_STATUS_LABELS: Record<string, { label: string; variant: 'info' | 'warning' | 'success' }> = {
                    pending_payment:   { label: 'Ожидает оплаты',   variant: 'warning' },
                    pending_signature: { label: 'Ожидает подписи',  variant: 'info'    },
                    signed:            { label: 'Занят',            variant: 'info'    },
                  };
                  const activeContractStatus = wagon.contract_wagons
                    ?.map((cw: any) => cw.contracts?.status)
                    .find((s: string) => s && s !== 'cancelled');
                  const STATUS_MAP: Record<string, { label: string; variant: 'success' | 'warning' | 'info' }> = {
                    active:    { label: tf('operational'), variant: 'success' },
                    in_repair: { label: tf('inRepair'),   variant: 'warning' },
                    booked:    CONTRACT_STATUS_LABELS[activeContractStatus] ?? { label: 'Занят', variant: 'info' },
                  };
                  const status = STATUS_MAP[wagon.status] ?? { label: wagon.status, variant: 'default' as const };
                  const repairCell = days === null ? <span className="text-gray-400">—</span>
                    : days < 0 ? <div className="flex items-center gap-1 text-red-600 text-xs font-medium"><AlertTriangle size={12} />{tf('overdue')}</div>
                    : days < 30 ? <div className="flex items-center gap-1 text-amber-600 text-xs font-medium"><Wrench size={12} />{days} дн.</div>
                    : <span className="text-green-600 text-xs">{days} дн.</span>;

                  return (
                    <tr key={wagon.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-sm text-blue-700 tracking-wide">{wagon.number}</div>
                        <span className="text-[10px] text-gray-400 mt-0.5 block">{tf('manuallyAdded')}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-gray-800">
                          <Train size={13} className="text-gray-400" />
                          {tw(wagon.wagon_type as Parameters<typeof tw>[0]) ?? wagon.wagon_type}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{wagon.model_number ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{wagon.payload_capacity_tons ? `${wagon.payload_capacity_tons} т` : '—'}</td>
                      <td className="px-4 py-3">
                        {editingAvail === wagon.id ? (
                          <div className="flex gap-1">
                            {(['spot', 'lease', 'both'] as const).map((v) => (
                              <button key={v} onClick={() => saveAvailType(wagon.id, v)}
                                disabled={savingAvail === wagon.id}
                                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border cursor-pointer transition-all disabled:opacity-40 ${
                                  wagon.availability_type === v
                                    ? v === 'spot' ? 'bg-orange-200 border-orange-400 text-orange-800'
                                    : v === 'lease' ? 'bg-purple-200 border-purple-400 text-purple-800'
                                    : 'bg-gray-200 border-gray-400 text-gray-800'
                                    : 'bg-white border-gray-200 text-gray-400 hover:border-gray-400'
                                }`}>
                                {tf(`availability_${v}` as Parameters<typeof tf>[0])}
                              </button>
                            ))}
                            <button onClick={() => setEditingAvail(null)} className="text-[10px] text-gray-300 hover:text-gray-500 cursor-pointer px-0.5">✕</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              wagon.availability_type === 'spot' ? 'bg-orange-100 text-orange-700' :
                              wagon.availability_type === 'lease' ? 'bg-purple-100 text-purple-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {tf(`availability_${wagon.availability_type}` as Parameters<typeof tf>[0])}
                            </span>
                            <button onClick={() => setEditingAvail(wagon.id)}
                              className="cursor-pointer text-gray-300 hover:text-gray-500 p-0.5 rounded transition-colors">
                              <Pencil size={11} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingRepair === wagon.id ? (
                          <div className="flex flex-col gap-1.5 min-w-[200px]">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] text-gray-400">Последний</label>
                              <input type="date" value={repairForm.last}
                                onChange={(e) => setRepairForm((f) => ({ ...f, last: e.target.value }))}
                                className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] text-gray-400">Следующий</label>
                              <input type="date" value={repairForm.next}
                                onChange={(e) => setRepairForm((f) => ({ ...f, next: e.target.value }))}
                                className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
                            </div>
                            <div className="flex gap-1.5 mt-0.5">
                              <button onClick={() => saveRepair(wagon.id)} disabled={savingRepair === wagon.id}
                                className="text-[10px] px-2 py-0.5 bg-blue-600 text-white rounded cursor-pointer hover:bg-blue-700 disabled:opacity-40 transition-colors">
                                {savingRepair === wagon.id ? '...' : 'Сохранить'}
                              </button>
                              <button onClick={() => setEditingRepair(null)}
                                className="text-[10px] px-2 py-0.5 border border-gray-200 text-gray-500 rounded cursor-pointer hover:bg-gray-50 transition-colors">
                                Отмена
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 group/repair">
                            <span className="text-xs text-gray-500">{formatDate(wagon.last_repair_date) ?? '—'}</span>
                            <button onClick={() => openRepairEdit(wagon)}
                              className="cursor-pointer text-gray-300 hover:text-gray-500 p-0.5 rounded transition-colors">
                              <Pencil size={11} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingRepair !== wagon.id && (
                          <>
                            <div className="text-xs text-gray-500 mb-1">{formatDate(wagon.next_repair_date)}</div>
                            {repairCell}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400 shrink-0">{total} вагонов</div>
        </div>
      )}

      {/* Add wagon modal */}
      <Modal open={showAdd} onClose={closeAdd} title={tf('addWagon')}>
        <div className="space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
            <div>
              <div className="font-semibold mb-0.5">Ответственность за достоверность данных</div>
              <div className="text-amber-700 text-xs leading-relaxed">
                Предоставление ложных сведений при заключении договора влечёт имущественную ответственность и штрафные санкции со стороны КТЖ и контрагентов.
              </div>
            </div>
          </div>

          {/* Number + type */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Номер вагона (8 цифр)"
              value={form.number}
              onChange={(e) => setField('number', e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="00000000"
              className="font-mono tracking-widest"
            />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Тип вагона</label>
              <select
                value={form.wagon_type}
                disabled={modelLocked}
                onChange={(e) => setField('wagon_type', e.target.value as WagonType)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white disabled:bg-gray-50 disabled:text-gray-500"
              >
                {WAGON_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Model autocomplete + status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative" ref={suggestRef}>
              <label className="block text-xs font-medium text-gray-600 mb-1">Модель вагона</label>
              <div className="relative">
                <input
                  type="text"
                  value={form.model_number}
                  onChange={(e) => handleModelInput(e.target.value)}
                  onBlur={handleModelBlur}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="12-9046"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 pr-6 ${
                    modelLocked ? 'bg-blue-50 border-blue-200 text-blue-800' : 'border-gray-200'
                  }`}
                />
                {modelLocked && (
                  <button
                    onClick={clearModel}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                    title="Очистить"
                  >✕</button>
                )}
              </div>
              {modelLocked && (
                <p className="text-[10px] text-blue-600 mt-0.5 flex items-center gap-1">
                  <Info size={10} /> Данные из справочника — тип, грузоподъёмность и объём заполнены автоматически
                </p>
              )}
              {modelWarning && (
                <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1">
                  <AlertTriangle size={10} /> {modelWarning}
                </p>
              )}
              {showSuggestions && (
                <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg overflow-y-auto max-h-72">
                  {suggestions.map((s) => (
                    <button
                      key={s.model}
                      onMouseDown={() => selectModel(s)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 cursor-pointer flex items-center gap-2 whitespace-nowrap overflow-hidden"
                    >
                      <span className="font-mono font-semibold text-blue-700 shrink-0">{s.model}</span>
                      <span className="text-gray-400 truncate">{TYPE_LABELS[s.type]}{s.payload_t ? ` · ${s.payload_t}т` : ''}{s.volume_m3 ? ` · ${s.volume_m3}м³` : ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Состояние</label>
              <select
                value={form.status}
                onChange={(e) => setField('status', e.target.value as 'active' | 'in_repair')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
              >
                <option value="active">{tf('operational')}</option>
                <option value="in_repair">{tf('inRepair')}</option>
              </select>
            </div>
          </div>

          {/* Tech specs */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Технические характеристики</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Грузоподъёмность, т"
                type="number"
                value={form.payload_capacity_tons}
                onChange={(e) => setField('payload_capacity_tons', e.target.value)}
                placeholder="69"
                disabled={modelLocked}
              />
              <Input
                label="Объём, м³"
                type="number"
                value={form.volume_m3}
                onChange={(e) => setField('volume_m3', e.target.value)}
                placeholder="73"
                disabled={modelLocked}
              />
            </div>
          </div>

          {/* Dates */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Техническое обслуживание</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Последний ремонт"
                type="date"
                value={form.last_repair_date}
                onChange={(e) => setField('last_repair_date', e.target.value)}
              />
              <Input
                label="Следующий ремонт"
                type="date"
                value={form.next_repair_date}
                min={form.last_repair_date || undefined}
                onChange={(e) => setField('next_repair_date', e.target.value)}
              />
            </div>
          </div>

          {/* Availability type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{tf('availabilityType')}</label>
            <div className="flex gap-2">
              {([
                { value: 'spot',  label: tf('availability_spot'),  color: 'border-orange-300 bg-orange-50 text-orange-700' },
                { value: 'lease', label: tf('availability_lease'), color: 'border-purple-300 bg-purple-50 text-purple-700' },
                { value: 'both',  label: tf('availability_both'),  color: 'border-gray-300 bg-gray-50 text-gray-700' },
              ] as const).map(({ value, label, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setField('availability_type', value)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border-2 transition-all cursor-pointer ${
                    form.availability_type === value ? color + ' ring-2 ring-offset-1 ring-blue-300' : 'border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {saveError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
              <AlertTriangle size={13} /> {saveError}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" onClick={closeAdd} disabled={saving}>Отмена</Button>
            <Button loading={saving} onClick={handleSave}>
              <Plus size={14} /> {tf('addWagon')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
