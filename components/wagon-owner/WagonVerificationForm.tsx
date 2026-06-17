'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { verifyWagon } from '@/services/ktzService';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { formatDate } from '@/lib/utils';
import type { Profile, KTZWagonData } from '@/types';
import { Search, Train, Wrench, AlertTriangle, FileSignature, CheckCircle } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  tank: 'Цистерна', hopper: 'Хоппер', flatcar: 'Платформа',
  boxcar: 'Крытый', gondola: 'Полувагон', refrigerator: 'Рефрижератор',
};

export function WagonVerificationForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [wagonNumber, setWagonNumber] = useState('');
  const [searching, setSearching] = useState(false);
  const [ktzData, setKtzData] = useState<KTZWagonData | null>(null);
  const [error, setError] = useState('');
  const [showEdsModal, setShowEdsModal] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setKtzData(null); setSearching(true);
    try {
      const data = await verifyWagon(wagonNumber);
      setKtzData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка запроса КТЖ');
    } finally {
      setSearching(false);
    }
  }

  async function handleSign() {
    if (!ktzData) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('wagons').upsert({
      number: ktzData.number,
      owner_id: profile.id,
      is_verified: true,
      wagon_type: ktzData.wagon_type,
      payload_capacity_tons: ktzData.payload_capacity_tons,
      volume_m3: ktzData.volume_m3,
      model_number: ktzData.model_number,
      tare_weight_tons: ktzData.tare_weight_tons,
      last_repair_date: ktzData.last_repair_date,
      next_repair_date: ktzData.next_repair_date,
      remaining_mileage_km: ktzData.remaining_mileage_km,
      status: ktzData.operational_status === 'non_operational' ? 'in_repair' : 'active',
    }, { onConflict: 'number' });
    setSaving(false);
    setShowEdsModal(false);
    if (error) { setError(error.message); return; }
    router.push('/wagon-owner');
    router.refresh();
  }

  const isOverdue = ktzData && new Date(ktzData.next_repair_date) < new Date();

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Добавить вагон в парк</h2>
        <p className="text-sm text-gray-500 mt-0.5">Введите номер вагона для проверки по базе КТЖ (АСОУП / ЕК ИОДВ)</p>
      </div>

      <form onSubmit={handleVerify} className="flex items-end gap-3">
        <Input
          label="Номер вагона (8 цифр)"
          value={wagonNumber}
          onChange={(e) => setWagonNumber(e.target.value.replace(/\D/g, '').slice(0, 8))}
          placeholder="00000000"
          className="font-mono text-lg tracking-widest"
          hint="Номер указан на борту вагона"
        />
        <Button type="submit" loading={searching} disabled={wagonNumber.length !== 8} className="shrink-0 mb-0">
          <Search size={14} /> Проверить
        </Button>
      </form>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {ktzData && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                <Train size={20} className="text-blue-600" />
              </div>
              <div>
                <div className="font-mono font-bold text-blue-700 text-lg">{ktzData.number}</div>
                <div className="text-sm text-gray-500">{TYPE_LABELS[ktzData.wagon_type]} · {ktzData.model_number}</div>
              </div>
            </div>
            <Badge variant={ktzData.operational_status === 'operational' ? 'success' : 'danger'}>
              {ktzData.operational_status === 'operational' ? 'Пригоден' : 'Непригоден'}
            </Badge>
          </div>

          {/* Tech passport */}
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Технический паспорт</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Тип', value: TYPE_LABELS[ktzData.wagon_type] },
                { label: 'Модель', value: ktzData.model_number },
                { label: 'Грузоподъёмность', value: `${ktzData.payload_capacity_tons} т` },
                { label: 'Объём', value: `${ktzData.volume_m3} м³` },
                { label: 'Тара', value: `${ktzData.tare_weight_tons} т` },
                { label: 'Пробег (остаток)', value: `${ktzData.remaining_mileage_km?.toLocaleString('ru')} км` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{value ?? '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Maintenance */}
          <div className="px-5 pb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Обслуживание</p>
            <div className="rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100">
              <div className="flex items-center gap-3 px-4 py-3">
                <Wrench size={15} className="text-gray-400 shrink-0" />
                <div>
                  <div className="text-xs text-gray-400">Последний ремонт</div>
                  <div className="text-sm text-gray-800">{formatDate(ktzData.last_repair_date)}</div>
                </div>
              </div>
              <div className={`flex items-center gap-3 px-4 py-3 ${isOverdue ? 'bg-red-50' : ''}`}>
                <AlertTriangle size={15} className={isOverdue ? 'text-red-500 shrink-0' : 'text-amber-500 shrink-0'} />
                <div>
                  <div className="text-xs text-gray-400">Следующий ремонт</div>
                  <div className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-800'}`}>
                    {formatDate(ktzData.next_repair_date)}{isOverdue && ' — ПРОСРОЧЕН'}
                  </div>
                </div>
              </div>
            </div>
            {isOverdue && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700 flex items-center gap-2">
                <AlertTriangle size={14} /> Требуется плановый ремонт перед сертификацией
              </div>
            )}
          </div>

          {!isOverdue && (
            <div className="px-5 pb-5">
              <Button onClick={() => setShowEdsModal(true)} className="w-full">
                <FileSignature size={15} /> Подписать доверенность через ЭЦП
              </Button>
            </div>
          )}
        </div>
      )}

      <Modal open={showEdsModal} onClose={() => setShowEdsModal(false)} title="Подписание доверенности — ЭЦП КТЖ">
        <div className="space-y-4">
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm space-y-2">
            {[
              ['Вагон', ktzData?.number],
              ['Тип', TYPE_LABELS[ktzData?.wagon_type ?? '']],
              ['Собственник', profile.company_name],
              ['БИН', profile.bin],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-gray-900">{value}</span>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
            Подписывая доверенность через ЭЦП, вы подтверждаете право собственности на вагон и соглашаетесь с правилами платформы WagonFinder.
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowEdsModal(false)}>Отмена</Button>
            <Button loading={saving} onClick={handleSign}>
              <CheckCircle size={14} /> Подтвердить и подписать
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
