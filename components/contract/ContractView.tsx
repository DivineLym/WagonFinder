'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import type { Profile } from '@/types';
import { CheckCircle, FileText, Shield } from 'lucide-react';

const WAGON_TYPE_LABELS: Record<string, string> = {
  tank: 'Цистерна', hopper: 'Хоппер', flatcar: 'Платформа',
  boxcar: 'Крытый вагон', gondola: 'Полувагон', refrigerator: 'Рефрижератор',
};

interface Contract {
  id: string;
  application_id: string;
  contract_number: string;
  executor_company: string;
  executor_bin: string;
  executor_name: string;
  customer_company: string;
  customer_bin: string;
  customer_name: string;
  wagon_number: string;
  wagon_type: string;
  cargo_name: string;
  cargo_etsng: string;
  departure_station: string;
  arrival_station: string;
  period_start: string;
  period_end: string;
  executor_signed_at: string | null;
  customer_signed_at: string | null;
  created_at: string;
}

interface Props {
  contract: Contract;
  profile: Profile;
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('ru-RU');
}

export function ContractView({ contract: initial, profile }: Props) {
  const [contract, setContract] = useState(initial);
  const [signing, setSigning] = useState(false);

  const isExecutor = profile.bin === contract.executor_bin;
  const isCustomer = profile.bin === contract.customer_bin;

  const mySigned = isExecutor ? !!contract.executor_signed_at : isCustomer ? !!contract.customer_signed_at : false;
  const bothSigned = !!contract.executor_signed_at && !!contract.customer_signed_at;

  async function sign() {
    setSigning(true);
    const supabase = createClient();
    const field = isExecutor ? 'executor_signed_at' : 'customer_signed_at';
    const now = new Date().toISOString();
    const { error } = await supabase.from('contracts').update({ [field]: now }).eq('id', contract.id);
    if (!error) setContract((c) => ({ ...c, [field]: now }));
    setSigning(false);
  }

  const today = new Date(contract.created_at);
  const city = contract.departure_station.split('-')[0].split(' ')[0];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Договор № {contract.contract_number}</h2>
          <p className="text-sm text-gray-500 mt-0.5">Оказание услуг по предоставлению подвижного состава</p>
        </div>
        <div className="flex items-center gap-3">
          {bothSigned && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
              <CheckCircle size={14} /> Договор подписан обеими сторонами
            </div>
          )}
        </div>
      </div>

      {/* Signing status */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Исполнитель', company: contract.executor_company, name: contract.executor_name, signed_at: contract.executor_signed_at },
          { label: 'Заказчик',   company: contract.customer_company,  name: contract.customer_name,  signed_at: contract.customer_signed_at },
        ].map(({ label, company, name, signed_at }) => (
          <div key={label} className={`rounded-xl border p-4 ${signed_at ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className="font-semibold text-gray-900 text-sm">{company}</div>
            <div className="text-xs text-gray-500">{name}</div>
            {signed_at ? (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-green-700">
                <CheckCircle size={12} /> Подписано {fmt(signed_at)}
              </div>
            ) : (
              <div className="text-xs text-amber-600 mt-2">Ожидает подписи</div>
            )}
          </div>
        ))}
      </div>

      {/* Contract body */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 font-serif text-[14px] leading-relaxed text-gray-800">
        <div className="text-center mb-6">
          <div className="text-base font-bold uppercase tracking-wide">ДОГОВОР</div>
          <div className="text-sm">оказания услуг по предоставлению подвижного состава</div>
        </div>

        <div className="flex justify-between mb-6 text-sm">
          <span>г. {city}</span>
          <span>«{today.getDate()}» {today.toLocaleDateString('ru-RU', { month: 'long' })} {today.getFullYear()} год</span>
        </div>

        <p className="mb-4">
          <strong>«{contract.executor_company}»</strong>, именуемое в дальнейшем «<strong>Исполнитель</strong>»,
          в лице {contract.executor_name}, БИН {contract.executor_bin}, с одной стороны, и{' '}
          <strong>«{contract.customer_company}»</strong>, именуемое в дальнейшем «<strong>Заказчик</strong>»,
          в лице {contract.customer_name}, БИН {contract.customer_bin}, с другой стороны,
          совместно именуемые «Стороны», заключили настоящий Договор о нижеследующем.
        </p>

        <div className="font-bold text-center mt-5 mb-2">1. Предмет настоящего Договора</div>
        <p className="mb-3">
          1.1. Исполнитель обязуется предоставить Заказчику вагон(ы) для перевозки грузов во
          внутриреспубликанском и международном сообщениях, а Заказчик обязуется оплатить Исполнителю
          оказанные услуги.
        </p>
        <p className="mb-3">
          1.2. Предоставляемый подвижной состав:
        </p>
        <div className="ml-4 mb-3 space-y-1 text-sm">
          <div>• Номер вагона: <strong>{contract.wagon_number}</strong></div>
          <div>• Тип вагона: <strong>{WAGON_TYPE_LABELS[contract.wagon_type] ?? contract.wagon_type}</strong></div>
          <div>• Наименование груза: <strong>{contract.cargo_name}</strong> (ЕТСНГ: {contract.cargo_etsng})</div>
          <div>• Маршрут: <strong>{contract.departure_station}</strong> → <strong>{contract.arrival_station}</strong></div>
          <div>• Период: <strong>{fmt(contract.period_start)}</strong> – <strong>{fmt(contract.period_end)}</strong></div>
        </div>
        <p className="mb-3">
          1.3. Стоимость услуг Исполнителя определяется Сторонами по согласованию и оформляется
          отдельным Протоколом, являющимся неотъемлемой частью настоящего Договора.
        </p>

        <div className="font-bold text-center mt-5 mb-2">2. Права и обязанности Сторон</div>
        <p className="mb-2">2.1. <strong>Исполнитель обязан:</strong></p>
        <div className="ml-4 mb-3 space-y-1 text-sm">
          <p>2.1.1. Своевременно и качественно оказывать услуги при условии выполнения Заказчиком всех норм настоящего Договора.</p>
          <p>2.1.2. Обеспечить Заказчика технически исправными, коммерчески пригодными вагонами на станции погрузки.</p>
          <p>2.1.3. Информировать Заказчика об изменении стоимости услуг за 15 (пятнадцать) календарных дней.</p>
        </div>
        <p className="mb-2">2.2. <strong>Заказчик обязан:</strong></p>
        <div className="ml-4 mb-3 space-y-1 text-sm">
          <p>2.2.1. Подавать Перевозчику заявки по форме ГУ-12 с указанием Исполнителя в качестве владельца подвижного состава.</p>
          <p>2.2.2. Оплатить Исполнителю стоимость услуг в соответствии с настоящим Договором.</p>
          <p>2.2.3. Обеспечить срок нахождения вагонов на станциях назначения не более 2 (двух) суток.</p>
          <p>2.2.4. Обеспечить очистку вагонов от остатков груза после выгрузки.</p>
          <p>2.2.5. В случае отказа от погрузки по согласованной заявке уведомить за 7 (семь) рабочих дней.</p>
        </div>

        <div className="font-bold text-center mt-5 mb-2">3. Стоимость услуг и порядок расчётов</div>
        <p className="mb-3 text-sm">
          3.1. Заказчик производит 100% предварительную оплату услуг на расчётный счёт Исполнителя
          не позднее 2 (двух) рабочих дней после подачи заявки. Валютой расчётов является
          национальная валюта Республики Казахстан — тенге.
        </p>
        <p className="mb-3 text-sm">
          3.2. В случае превышения сроков нахождения вагонов на станциях Заказчик уплачивает штраф
          в размере 12 500 (двенадцать тысяч пятьсот) тенге за каждый вагон в сутки.
        </p>

        <div className="font-bold text-center mt-5 mb-2">4. Ответственность Сторон</div>
        <p className="mb-3 text-sm">
          4.1. В случае ненадлежащего исполнения обязательств Стороны несут ответственность
          в соответствии с законодательством Республики Казахстан.
        </p>
        <p className="mb-3 text-sm">
          4.2. За нарушение сроков оплаты начисляется пеня в размере 0,1% от суммы задолженности
          за каждый день просрочки, но не более 10% от общей суммы задолженности.
        </p>

        <div className="font-bold text-center mt-5 mb-2">5. Заключительные положения</div>
        <p className="mb-3 text-sm">
          5.1. Настоящий Договор вступает в силу с даты подписания обеими Сторонами и действует
          до {fmt(contract.period_end)}, а в части взаиморасчётов — до полного исполнения обязательств.
        </p>
        <p className="mb-3 text-sm">
          5.2. Договор составлен в электронном виде и подписан с использованием электронной
          цифровой подписи (ЭЦП) каждой из Сторон, что приравнивается к собственноручной подписи
          в соответствии с законодательством Республики Казахстан.
        </p>
        <p className="mb-6 text-sm">
          5.3. Споры разрешаются путём переговоров, при недостижении согласия — в судебном
          порядке по месту нахождения Исполнителя.
        </p>

        {/* Signatures block */}
        <div className="grid grid-cols-2 gap-8 mt-8 pt-6 border-t border-gray-200 text-sm">
          <div>
            <div className="font-bold mb-3">Исполнитель:</div>
            <div>{contract.executor_company}</div>
            <div className="text-gray-500">БИН: {contract.executor_bin}</div>
            <div className="text-gray-500 mt-1">{contract.executor_name}</div>
            <div className="mt-4 h-10 border-b border-dashed border-gray-300 flex items-end pb-1">
              {contract.executor_signed_at && (
                <span className="text-green-700 text-xs flex items-center gap-1">
                  <Shield size={11} /> ЭЦП подписано {fmt(contract.executor_signed_at)}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1">МП / Подпись</div>
          </div>
          <div>
            <div className="font-bold mb-3">Заказчик:</div>
            <div>{contract.customer_company}</div>
            <div className="text-gray-500">БИН: {contract.customer_bin}</div>
            <div className="text-gray-500 mt-1">{contract.customer_name}</div>
            <div className="mt-4 h-10 border-b border-dashed border-gray-300 flex items-end pb-1">
              {contract.customer_signed_at && (
                <span className="text-green-700 text-xs flex items-center gap-1">
                  <Shield size={11} /> ЭЦП подписано {fmt(contract.customer_signed_at)}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1">МП / Подпись</div>
          </div>
        </div>
      </div>

      {/* Action */}
      {!bothSigned && (isExecutor || isCustomer) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-amber-800">
              {mySigned ? 'Вы подписали договор. Ожидаем подпись другой стороны.' : 'Ознакомьтесь с договором и подпишите его ЭЦП'}
            </div>
            <div className="text-xs text-amber-600 mt-0.5">
              {isExecutor ? 'Вы выступаете как Исполнитель (собственник вагонов)' : 'Вы выступаете как Заказчик (грузоотправитель)'}
            </div>
          </div>
          {!mySigned && (
            <Button onClick={sign} loading={signing}>
              <Shield size={14} /> Подписать ЭЦП
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
