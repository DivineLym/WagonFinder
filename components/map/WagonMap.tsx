'use client';

import { useEffect, useRef } from 'react';
import type { Wagon } from '@/types';
import { getCoordsByEsr, getStationName } from '@/lib/esrCoords';

const WAGON_TYPE_LABELS: Record<string, string> = {
  tank: 'Цистерна', hopper: 'Хоппер', flatcar: 'Платформа',
  boxcar: 'Крытый', gondola: 'Полувагон', refrigerator: 'Рефрижератор',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Свободен',
  booked: 'Занят',
  in_repair: 'В ремонте',
};

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  booked: '#3b82f6',
  in_repair: '#f97316',
};

interface WagonWithCoords extends Wagon {
  owner?: { company_name: string | null; full_name: string } | null;
}

interface Props {
  wagons: WagonWithCoords[];
}

export function WagonMap({ wagons }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    (async () => {
      const leafletModule = await import('leaflet');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (leafletModule as any).default ?? leafletModule;
      // markercluster is a legacy plugin that needs mutable global L
      (window as any).L = L;
      await import('leaflet.markercluster');
      if (!mapRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((mapRef.current as any)._leaflet_id) return;

      // Fix default icon paths
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current).setView([48.0, 68.0], 5);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      // Marker cluster group
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cluster = (L as any).markerClusterGroup({
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: false,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: false,
        iconCreateFunction: (c: any) => {
          // Sum wagonCount from all child markers
          const total = c.getAllChildMarkers().reduce((sum: number, m: any) => sum + (m.wagonCount ?? 1), 0);
          const big = total > 99;
          return L.divIcon({
            className: '',
            html: `<div style="
              background:#1d4ed8;color:#fff;border-radius:50%;
              width:${big ? 44 : 36}px;height:${big ? 44 : 36}px;
              display:flex;align-items:center;justify-content:center;
              font-weight:700;font-size:${big ? 11 : 13}px;
              border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25);
            ">${total}</div>`,
            iconSize: [big ? 44 : 36, big ? 44 : 36],
            iconAnchor: [big ? 22 : 18, big ? 22 : 18],
          });
        },
      });

      // Group wagons by station (for popup content)
      const byStation: Record<string, WagonWithCoords[]> = {};
      for (const wagon of wagons) {
        const coords = getCoordsByEsr(wagon.current_esr_code);
        if (!coords) continue;
        const key = `${coords[0]},${coords[1]}`;
        if (!byStation[key]) byStation[key] = [];
        byStation[key].push(wagon);
      }

      for (const [key, group] of Object.entries(byStation)) {
        const [lat, lng] = key.split(',').map(Number);
        const stationName = getStationName(group[0].current_esr_code);

        const wagonRows = group.map((w) => `
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:4px 8px;font-family:monospace;font-size:12px;color:#1d4ed8">${w.number}</td>
            <td style="padding:4px 8px;font-size:12px">${WAGON_TYPE_LABELS[w.wagon_type] ?? w.wagon_type}</td>
            <td style="padding:4px 8px">
              <span style="
                font-size:11px;padding:2px 6px;border-radius:999px;
                background:${STATUS_COLORS[w.status] ?? '#e5e7eb'}20;
                color:${STATUS_COLORS[w.status] ?? '#6b7280'};
                border:1px solid ${STATUS_COLORS[w.status] ?? '#e5e7eb'}40;
              ">${STATUS_LABELS[w.status] ?? w.status}</span>
            </td>
            <td style="padding:4px 8px;font-size:11px;color:#6b7280">${w.owner?.company_name ?? w.owner?.full_name ?? '—'}</td>
          </tr>`).join('');

        const popup = L.popup({ maxWidth: 420, minWidth: 320 }).setContent(`
          <div style="font-family:system-ui,sans-serif">
            <div style="font-weight:700;font-size:14px;margin-bottom:8px;color:#111">
              📍 ${stationName}
              <span style="font-weight:400;font-size:12px;color:#6b7280;margin-left:6px">${group[0].current_esr_code}</span>
            </div>
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#f9fafb">
                  <th style="padding:4px 8px;text-align:left;font-size:11px;color:#6b7280;font-weight:600">№ ВАГОНА</th>
                  <th style="padding:4px 8px;text-align:left;font-size:11px;color:#6b7280;font-weight:600">ТИП</th>
                  <th style="padding:4px 8px;text-align:left;font-size:11px;color:#6b7280;font-weight:600">СТАТУС</th>
                  <th style="padding:4px 8px;text-align:left;font-size:11px;color:#6b7280;font-weight:600">ВЛАДЕЛЕЦ</th>
                </tr>
              </thead>
              <tbody>${wagonRows}</tbody>
            </table>
          </div>`);

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            background:#1d4ed8;color:#fff;border-radius:50%;
            width:34px;height:34px;
            display:flex;align-items:center;justify-content:center;
            font-weight:700;font-size:13px;
            border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25);
          ">${group.length}</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const marker = L.marker([lat, lng], { icon }).bindPopup(popup);
        (marker as any).wagonCount = group.length;
        (marker as any).stationName = stationName;
        (marker as any).esrCode = group[0].current_esr_code;
        (marker as any).wagons = group;
        cluster.addLayer(marker);
      }

      map.addLayer(cluster);

      cluster.on('clusterclick', (e: any) => {
        const children: any[] = e.layer.getAllChildMarkers();
        const allWagons: WagonWithCoords[] = children.flatMap((m) => m.wagons ?? []);
        const stationCount = new Set(children.map((m) => m.esrCode).filter(Boolean)).size;

        const wagonRows = allWagons.map((w) => `
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:4px 8px;font-family:monospace;font-size:12px;color:#1d4ed8">${w.number}</td>
            <td style="padding:4px 8px;font-size:12px">${WAGON_TYPE_LABELS[w.wagon_type] ?? w.wagon_type}</td>
            <td style="padding:4px 8px">
              <span style="font-size:11px;padding:2px 6px;border-radius:999px;
                background:${STATUS_COLORS[w.status] ?? '#e5e7eb'}20;
                color:${STATUS_COLORS[w.status] ?? '#6b7280'};
                border:1px solid ${STATUS_COLORS[w.status] ?? '#e5e7eb'}40;">
                ${STATUS_LABELS[w.status] ?? w.status}
              </span>
            </td>
            <td style="padding:4px 8px;font-size:11px;color:#6b7280">${getStationName(w.current_esr_code)}</td>
            <td style="padding:4px 8px;font-size:11px;color:#6b7280">${w.owner?.company_name ?? w.owner?.full_name ?? '—'}</td>
          </tr>`).join('');

        const popup = L.popup({ maxWidth: 480, minWidth: 360 })
          .setLatLng(e.layer.getLatLng())
          .setContent(`
            <div style="font-family:system-ui,sans-serif">
              <div style="font-weight:700;font-size:14px;margin-bottom:8px;color:#111">
                📍 ${stationCount} станц. — ${allWagons.length} вагонов
              </div>
              <div style="max-height:300px;overflow-y:auto">
                <table style="width:100%;border-collapse:collapse">
                  <thead>
                    <tr style="background:#f9fafb;position:sticky;top:0">
                      <th style="padding:4px 8px;text-align:left;font-size:11px;color:#6b7280;font-weight:600">№ ВАГОНА</th>
                      <th style="padding:4px 8px;text-align:left;font-size:11px;color:#6b7280;font-weight:600">ТИП</th>
                      <th style="padding:4px 8px;text-align:left;font-size:11px;color:#6b7280;font-weight:600">СТАТУС</th>
                      <th style="padding:4px 8px;text-align:left;font-size:11px;color:#6b7280;font-weight:600">СТАНЦИЯ</th>
                      <th style="padding:4px 8px;text-align:left;font-size:11px;color:#6b7280;font-weight:600">ВЛАДЕЛЕЦ</th>
                    </tr>
                  </thead>
                  <tbody>${wagonRows}</tbody>
                </table>
              </div>
            </div>`)
          .openOn(map);
      });
    })();

    return () => {
      if (mapInstanceRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapInstanceRef.current as any).remove();
        mapInstanceRef.current = null;
      }
    };
  }, [wagons]);

  return (
    <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />
  );
}
