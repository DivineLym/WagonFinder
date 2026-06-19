'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { Wagon } from '@/types';
import { getCoordsByEsr } from '@/lib/esrCoords';

// Leaflet must be loaded client-side only (no SSR)
const WagonMap = dynamic(() => import('./WagonMap').then((m) => m.WagonMap), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-50 rounded-xl">
      <div className="text-gray-400 text-sm">Загрузка карты...</div>
    </div>
  ),
});

const STATUS_LABELS: Record<string, string> = {
  active: 'Свободен',
  booked: 'Занят',
  in_repair: 'В ремонте',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  booked: 'bg-blue-100 text-blue-700 border-blue-200',
  in_repair: 'bg-orange-100 text-orange-700 border-orange-200',
};

type WagonWithOwner = Wagon & {
  owner?: { company_name: string | null; full_name: string } | null;
};

interface Props {
  wagons: WagonWithOwner[];
}

export function WagonMapPage({ wagons }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const withCoords = wagons.filter((w) => getCoordsByEsr(w.current_esr_code));
  const withoutCoords = wagons.filter((w) => !getCoordsByEsr(w.current_esr_code));

  const filtered = statusFilter === 'all'
    ? withCoords
    : withCoords.filter((w) => w.status === statusFilter);

  const counts = {
    all: withCoords.length,
    active: withCoords.filter((w) => w.status === 'active').length,
    booked: withCoords.filter((w) => w.status === 'booked').length,
    in_repair: withCoords.filter((w) => w.status === 'in_repair').length,
  };

  return (
    <div className="h-full flex flex-col gap-4 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Карта вагонов</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {withCoords.length} вагонов на карте
            {withoutCoords.length > 0 && ` · ${withoutCoords.length} без местоположения`}
          </p>
        </div>

        {/* Status filter */}
        <div className="flex gap-1">
          {([
            { key: 'all', label: `Все (${counts.all})` },
            { key: 'active', label: `Свободны (${counts.active})` },
            { key: 'booked', label: `Заняты (${counts.booked})` },
            { key: 'in_repair', label: `В ремонте (${counts.in_repair})` },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                statusFilter === key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 shrink-0">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${STATUS_COLORS[key]}`}>
              {label}
            </span>
          </div>
        ))}
        <span className="text-xs text-gray-400 ml-2">Цифра на маркере = количество вагонов на станции</span>
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <WagonMap wagons={filtered} />
      </div>
    </div>
  );
}
