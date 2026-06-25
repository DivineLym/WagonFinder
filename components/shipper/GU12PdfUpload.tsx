'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { FileText, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

// ── Reference dictionaries for validation ─────────────────────────────────────

const KNOWN_ETSNG: Record<string, string> = {
  '011063': 'Зерно пшеница',
  '011066': 'Ячмень',
  '011068': 'Кукуруза',
  '011079': 'Подсолнечник',
  '091001': 'Руда железная',
  '093001': 'Медная руда',
  '111001': 'Глинозём',
  '131001': 'Лесоматериалы',
  '161002': 'Уголь каменный',
  '211001': 'Нефть сырая',
  '212041': 'Бензин автомобильный',
  '212061': 'Мазут топочный',
  '212065': 'Дизельное топливо',
  '226021': 'Удобрения азотные',
  '511001': 'Хлопок',
};

const KNOWN_ESR: Record<string, string> = {
  '654205': 'Алматы-1',
  '662109': 'Тараз',
  '668101': 'Шымкент',
  '706101': 'Атырау',
  '720101': 'Уральск',
  '726301': 'Актау',
  '728201': 'Актобе',
  '730900': 'Елек',
  '800101': 'Кокшетау',
  '802200': 'Петропавловск',
  '802602': 'Астана',
  '804504': 'Костанай',
  '803000': 'Магнитогорск',
  '836401': 'Карагандa',
  '846100': 'Балхаш',
  '852102': 'Павлодар',
  '862101': 'Семей',
  '864101': 'Усть-Каменогорск',
};

/**
 * Permitted wagon types per ETSNG cargo class (СМГС Приложение 2, правила КТЖ).
 * First entry = рекомендуемый тип по умолчанию.
 */
const ETSNG_WAGON_TYPES: Record<string, string[]> = {
  // Зерновые и масличные → только хоппер-зерновоз
  '011063': ['hopper'],
  '011066': ['hopper'],
  '011068': ['hopper'],
  '011079': ['hopper'],
  // Нефть и нефтепродукты → только цистерна
  '211001': ['tank'],
  '212041': ['tank'],
  '212061': ['tank'],
  '212065': ['tank'],
  // Уголь, руды, металлолом → полувагон (допускается хоппер для руды)
  '161002': ['gondola'],
  '091001': ['gondola', 'hopper'],
  '093001': ['gondola'],
  // Глинозём → хоппер-цементовоз
  '111001': ['hopper'],
  // Лесоматериалы → платформа
  '131001': ['flatcar'],
  // Удобрения азотные → хоппер-минераловоз или крытый
  '226021': ['hopper', 'boxcar'],
  // Хлопок → крытый вагон
  '511001': ['boxcar'],
};

function validateEtsng(code?: string): string | null {
  if (!code) return null;
  if (!KNOWN_ETSNG[code]) return `Код ЕТСНГ ${code} не найден в справочнике`;
  return null;
}

function findEsrByName(name: string): string | null {
  const q = name.toLowerCase();
  const entry = Object.entries(KNOWN_ESR).find(([, n]) =>
    n.toLowerCase().includes(q) || q.includes(n.split('-')[0].toLowerCase())
  );
  return entry ? entry[0] : null;
}

function validateEsr(code?: string, stationName?: string, label = 'ЕСР'): string | null {
  if (!code) return null;
  const known = KNOWN_ESR[code];
  if (!known) return `Код ${label} ${code} не найден в справочнике`;
  if (stationName && !stationName.toLowerCase().includes(known.split('-')[0].toLowerCase())) {
    const nameCode = findEsrByName(stationName);
    const nameCodePart = nameCode ? `, код «${stationName}»: ${nameCode}` : '';
    return `«${stationName}» не соответствует коду ${code} — по справочнику это «${known}»${nameCodePart}`;
  }
  return null;
}

const WAGON_TYPE_LABELS: Record<string, string> = {
  tank: 'Цистерна', hopper: 'Хоппер', flatcar: 'Платформа',
  boxcar: 'Крытый', gondola: 'Полувагон', refrigerator: 'Рефрижератор',
};

export interface ParsedGU12 {
  gu12_number?: string;
  cargo_etsng_code?: string;
  departure_esr_code?: string;
  departure_station_name?: string;
  arrival_esr_code?: string;
  arrival_station_name?: string;
  quantity_planned?: number;
  period_start?: string;
  period_end?: string;
}

// ── Regex helpers ─────────────────────────────────────────────────────────────

function after(text: string, ...labels: string[]): string | undefined {
  for (const label of labels) {
    const re = new RegExp(label + '[:\\s]*([^\\n\\r]{1,80})', 'i');
    const m = text.match(re);
    if (m) return m[1].trim();
  }
}

function firstMatch(text: string, re: RegExp): string | undefined {
  return text.match(re)?.[1]?.trim();
}

/** Convert "DD.MM.YYYY" or "DD/MM/YYYY" → "YYYY-MM-DD" */
function toIso(raw: string): string | undefined {
  const m = raw.match(/(\d{2})[.\/-](\d{2})[.\/-](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
}

function parseWagonType(text: string): string | undefined {
  const map: [RegExp, string][] = [
    [/цистерн/i, 'tank'],
    [/хоп[пе]р/i, 'hopper'],
    [/платформ/i, 'flatcar'],
    [/крыт/i, 'boxcar'],
    [/полувагон|гондол/i, 'gondola'],
    [/рефрижер/i, 'refrigerator'],
  ];
  for (const [re, type] of map) {
    if (re.test(text)) return type;
  }
}

function parseGU12Text(text: string): ParsedGU12 {
  // Normalise whitespace but keep newlines
  const t = text.replace(/[ \t]+/g, ' ');

  // ── Number ──────────────────────────────────────────────────────────────────
  // "ГУ-12 № 123456" / "Заявка № 123456" / standalone pattern ГУ12-...
  const gu12_number =
    firstMatch(t, /(?:заявк[аи]|номер|№)\s*[:\-]?\s*(ГУ[\-\s]?12[\-\s]?\S+)/i) ??
    firstMatch(t, /(?:заявк[аи]|номер|№)\s*[:\-]?\s*(\d{5,})/i) ??
    firstMatch(t, /(ГУ[\-\s]?12[\-\s]?[А-ЯA-Z0-9\-]+)/i);

  // ── Cargo ───────────────────────────────────────────────────────────────────
  const cargoRaw =
    after(t, 'наименование груза', 'груз', 'cargo') ??
    firstMatch(t, /этснг[:\s]+\d+\s+([^\n\r]{2,50})/i); // sometimes after ETSNG code

  // ── ETSNG ───────────────────────────────────────────────────────────────────
  const cargo_etsng_code =
    firstMatch(t, /[эе]тснг[:\s]+(\d{5,6})/i) ??
    firstMatch(t, /код груза[:\s]+(\d{5,6})/i) ??
    firstMatch(t, /\b(\d{6})\b/); // 6-digit standalone

  // ── Stations ────────────────────────────────────────────────────────────────
  // Pattern 1: "Станция отправления ... Код ЕСР ..."
  const depSection = t.match(/(?:станция\s+)?отправлени[яе][:\s]+([^\n\r]{2,60})/i)?.[1] ?? '';
  const arrSection = t.match(/(?:станция\s+)?назначени[яе][:\s]+([^\n\r]{2,60})/i)?.[1] ?? '';

  const cleanStation = (s: string) =>
    s.replace(/\s*\(?\s*[ЕE]СР[:\s].*/i, '').replace(/\s*\d{5,6}.*/, '').trim();

  const departure_station_name = cleanStation(depSection) || undefined;
  const arrival_station_name   = cleanStation(arrSection) || undefined;

  // ESR codes — 5-6 digit codes near station labels
  const departure_esr_code =
    firstMatch(depSection, /(\d{5,6})/) ??
    firstMatch(t, /(?:код\s+)?ЕСР[:\s]+(\d{5,6})/i);

  // Find second ESR code for arrival (skip departure code)
  const allEsr = [...t.matchAll(/\b(\d{5,6})\b/g)].map((m) => m[1]);
  const arrival_esr_code =
    firstMatch(arrSection, /(\d{5,6})/) ??
    (allEsr.length >= 2 && allEsr[1] !== departure_esr_code ? allEsr[1] : undefined);

  // ── Quantity ─────────────────────────────────────────────────────────────────
  const qtyRaw =
    after(t, 'количество вагонов', 'число вагонов', 'вагонов') ??
    firstMatch(t, /(\d{1,4})\s*(?:вагон|ваг\.)/i);
  const quantity_planned = qtyRaw ? parseInt(qtyRaw) : undefined;

  // ── Dates ────────────────────────────────────────────────────────────────────
  // "Период с DD.MM.YYYY по DD.MM.YYYY" or "с ... по ..."
  const periodMatch = t.match(
    /(?:период|срок|дата)[^0-9]*(\d{2}[.\/-]\d{2}[.\/-]\d{4})[^0-9]*(\d{2}[.\/-]\d{2}[.\/-]\d{4})/i,
  );
  const allDates = [...t.matchAll(/\b(\d{2}[.\/]\d{2}[.\/]\d{4})\b/g)].map((m) => m[1]);

  const period_start = periodMatch ? toIso(periodMatch[1]) : (allDates[0] ? toIso(allDates[0]) : undefined);
  const period_end   = periodMatch ? toIso(periodMatch[2]) : (allDates[1] ? toIso(allDates[1]) : undefined);

  return {
    gu12_number: gu12_number ?? undefined,
    cargo_etsng_code: cargo_etsng_code ?? undefined,
    departure_station_name: departure_station_name || undefined,
    departure_esr_code: departure_esr_code ?? undefined,
    arrival_station_name: arrival_station_name || undefined,
    arrival_esr_code: arrival_esr_code ?? undefined,
    quantity_planned: Number.isFinite(quantity_planned) ? quantity_planned : undefined,
    period_start,
    period_end,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  shipperId: string;
  existingNumbers?: string[];
  onSaved: () => void;
}

type BulkResult = { name: string; status: 'ok' | 'warning' | 'error' | 'duplicate' | 'skipped'; gu12_number?: string; warnings?: string[]; error?: string; parsed?: ParsedGU12 };

export function GU12PdfUpload({ shipperId, existingNumbers = [], onSaved }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'idle' | 'extracting' | 'review' | 'saving' | 'done' | 'error' | 'bulk'>('idle');
  const [form, setForm] = useState<ParsedGU12>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [open, setOpen] = useState(false);

  const [isDuplicate, setIsDuplicate] = useState(false);
  // bulk state
  const [bulkQueue, setBulkQueue] = useState<File[]>([]);
  const [bulkIndex, setBulkIndex] = useState(0);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  // index into bulkResults of the warning item currently being edited (-1 = none)
  const [reviewingIdx, setReviewingIdx] = useState(-1);

  function field(
    label: string,
    key: keyof ParsedGU12,
    type: 'text' | 'number' | 'date' = 'text',
    validation?: { warn?: string | null; ok?: string | null },
  ) {
    const hasWarn = !!validation?.warn;
    const hasOk   = !hasWarn && !!validation?.ok;
    return (
      <div key={key}>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <input
          type={type}
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
            hasWarn ? 'border-amber-400 focus:ring-amber-400 bg-amber-50'
            : hasOk  ? 'border-green-400 focus:ring-green-400 bg-green-50'
            : 'border-gray-200 focus:ring-blue-500'
          }`}
          value={(form[key] as string | number) ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, [key]: type === 'number' ? Number(e.target.value) || undefined : e.target.value || undefined }))}
        />
        {hasWarn && (
          <p className="mt-0.5 text-xs text-amber-600 flex items-center gap-1">⚠ {validation!.warn}</p>
        )}
        {hasOk && (
          <p className="mt-0.5 text-xs text-green-600 flex items-center gap-1">✓ {validation!.ok}</p>
        )}
      </div>
    );
  }

  async function extractText(file: File): Promise<string> {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item) => ('str' in item ? item.str ?? '' : '')).join(' ') + '\n';
    }
    return text;
  }

  async function saveForm(parsed: ParsedGU12, fileName: string): Promise<BulkResult> {
    const missing: string[] = [];
    if (!parsed.cargo_etsng_code) missing.push('код ЕТСНГ');
    if (!parsed.departure_esr_code) missing.push('ЕСР отправления');
    if (!parsed.arrival_esr_code) missing.push('ЕСР назначения');
    if (missing.length) return { name: fileName, status: 'error', error: `Не распознано: ${missing.join(', ')}` };

    const supabase = createClient();
    const gu12_number = parsed.gu12_number?.trim() || `PDF-${Date.now()}`;
    const { error } = await supabase.from('gu12_orders').upsert({
      shipper_id: shipperId,
      gu12_number,
      cargo_etsng_code: parsed.cargo_etsng_code ?? null,
      departure_esr_code: parsed.departure_esr_code ?? null,
      arrival_esr_code: parsed.arrival_esr_code ?? null,
      quantity_planned: parsed.quantity_planned ?? 1,
      quantity_fulfilled: 0,
      period_start: parsed.period_start ?? null,
      period_end: parsed.period_end ?? null,
      status: 'active',
      is_public: false,
    }, { onConflict: 'gu12_number' });
    if (error) return { name: fileName, status: 'error', error: error.message };
    return { name: fileName, status: 'ok', gu12_number };
  }

  async function handleFiles(files: FileList) {
    const arr = Array.from(files);
    setOpen(true);
    setErrorMsg('');

    if (arr.length === 1) {
      // single file → review mode
      setStep('extracting');
      setIsDuplicate(false);
      try {
        const text = await extractText(arr[0]);
        if (!text.trim()) { setStep('error'); setErrorMsg('PDF не содержит текста. Загрузите цифровой PDF.'); return; }
        const parsed = parseGU12Text(text);
        const num = parsed.gu12_number?.trim();
        if (num && existingNumbers.includes(num)) setIsDuplicate(true);
        setForm(parsed);
        setStep('review');
      } catch (err) {
        setStep('error');
        setErrorMsg(err instanceof Error ? err.message : 'Ошибка обработки PDF');
      }
    } else {
      // multiple files → bulk auto-save
      setBulkQueue(arr);
      setBulkIndex(0);
      setBulkResults([]);
      setStep('bulk');
      const results: BulkResult[] = [];
      // Track numbers seen in this batch + already existing
      const seenNumbers = new Set(existingNumbers);
      for (let i = 0; i < arr.length; i++) {
        setBulkIndex(i);
        try {
          const text = await extractText(arr[i]);
          if (!text.trim()) { results.push({ name: arr[i].name, status: 'error', error: 'Пустой текст' }); continue; }
          const parsed = parseGU12Text(text);
          const num = parsed.gu12_number?.trim();
          if (num && seenNumbers.has(num)) {
            results.push({ name: arr[i].name, status: 'duplicate', gu12_number: num });
            continue;
          }
          // Check validation warnings before saving
          const warnings: string[] = [
            validateEtsng(parsed.cargo_etsng_code),
            validateEsr(parsed.departure_esr_code, parsed.departure_station_name, 'ЕСР отпр.'),
            validateEsr(parsed.arrival_esr_code, parsed.arrival_station_name, 'ЕСР назн.'),
          ].filter(Boolean) as string[];

          if (warnings.length) {
            results.push({ name: arr[i].name, status: 'warning', warnings, parsed });
          } else {
            const result = await saveForm(parsed, arr[i].name);
            if (result.status === 'ok' && num) seenNumbers.add(num);
            results.push(result);
          }
        } catch (err) {
          results.push({ name: arr[i].name, status: 'error', error: err instanceof Error ? err.message : 'Ошибка' });
        }
        setBulkResults([...results]);
      }
      setBulkIndex(arr.length);
      onSaved();
    }
  }

  async function save() {
    setStep('saving');
    const result = await saveForm(form, '');
    if (result.status === 'error') {
      setStep('error');
      setErrorMsg(result.error ?? 'Ошибка сохранения');
    } else {
      setStep('done');
      onSaved();
    }
  }

  function close() {
    setOpen(false);
    setStep('idle');
    setForm({});
    setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  }

  const TRACKED_FIELDS: (keyof ParsedGU12)[] = [
    'gu12_number', 'cargo_etsng_code',
    'departure_station_name', 'departure_esr_code',
    'arrival_station_name', 'arrival_esr_code',
    'quantity_planned', 'period_start', 'period_end',
  ];
  const filledCount = TRACKED_FIELDS.filter((k) => form[k] != null && form[k] !== '').length;
  const totalFields = TRACKED_FIELDS.length;

  const [dragging, setDragging] = useState(false);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const files = e.dataTransfer.files;
    if (files.length) handleFiles(files);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }}
      />

      <Button variant="secondary" size="md" onClick={() => { setOpen(true); setStep('idle'); }}>
        <FileText size={14} /> Загрузить PDF ГУ-12
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                <span className="font-semibold text-gray-900">
                  {step === 'bulk' ? `Массовый импорт ГУ-12 (${bulkQueue.length} файлов)` : 'Импорт ГУ-12 из PDF'}
                </span>
              </div>
              <button onClick={close} className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {step === 'idle' && (
                <div
                  className={`flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed p-12 transition-colors cursor-pointer ${
                    dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/40'
                  }`}
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                >
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${dragging ? 'bg-blue-100' : 'bg-white border border-gray-200'}`}>
                    <FileText size={32} className={dragging ? 'text-blue-500' : 'text-gray-400'} />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-semibold text-gray-800">
                      {dragging ? 'Отпустите файлы' : 'Перетащите PDF-файлы сюда'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">или нажмите чтобы выбрать</p>
                  </div>
                  <div className="flex items-center gap-6 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                      Один файл — откроется форма проверки
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                      Несколько файлов — автоматическая загрузка
                    </span>
                  </div>
                  <p className="text-xs text-gray-300">Только PDF · Форма ГУ-12</p>
                </div>
              )}

              {step === 'bulk' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Обработано {Math.min(bulkIndex + 1, bulkQueue.length)} из {bulkQueue.length} файлов</span>
                    {bulkIndex < bulkQueue.length && (
                      <span className="text-xs text-gray-400 truncate max-w-[240px]">{bulkQueue[bulkIndex]?.name}</span>
                    )}
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${(Math.min(bulkIndex, bulkQueue.length) / bulkQueue.length) * 100}%` }}
                    />
                  </div>
                  <div className="space-y-1.5 max-h-80 overflow-y-auto">
                    {bulkResults.map((r, i) => (
                      <div key={i} className={`rounded-lg text-sm overflow-hidden ${
                        r.status === 'ok'         ? 'bg-green-50 text-green-800'
                        : r.status === 'warning'  ? 'bg-amber-50 text-amber-800'
                        : r.status === 'skipped'  ? 'bg-gray-50 text-gray-500'
                        : r.status === 'duplicate'? 'bg-amber-50 text-amber-800'
                        : 'bg-red-50 text-red-800'
                      }`}>
                        <div className="flex items-center gap-2 px-3 py-2">
                          <span className="shrink-0">{r.status === 'ok' ? '✓' : r.status === 'skipped' ? '—' : r.status === 'warning' || r.status === 'duplicate' ? '⚠' : '✗'}</span>
                          <span className="truncate flex-1">{r.name}</span>
                          {r.status === 'ok' && <span className="text-xs font-mono shrink-0 opacity-70">{r.gu12_number}</span>}
                          {r.status === 'duplicate' && <span className="text-xs shrink-0">уже существует: {r.gu12_number}</span>}
                          {r.status === 'error' && <span className="text-xs text-red-500 shrink-0">{r.error}</span>}
                          {r.status === 'skipped' && <span className="text-xs shrink-0">пропущено</span>}
                          {r.status === 'warning' && reviewingIdx !== i && (
                            <button
                              onClick={() => { setForm(r.parsed ?? {}); setReviewingIdx(i); }}
                              className="shrink-0 text-xs px-2.5 py-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700 cursor-pointer transition-colors"
                            >
                              Исправить
                            </button>
                          )}
                        </div>
                        {r.status === 'warning' && reviewingIdx !== i && r.warnings?.map((w, wi) => (
                          <p key={wi} className="text-xs text-amber-600 px-3 pb-1.5 pl-7">⚠ {w}</p>
                        ))}

                        {/* Inline edit form */}
                        {r.status === 'warning' && reviewingIdx === i && (() => {
                          const etsngWarn = validateEtsng(form.cargo_etsng_code);
                          const depKnown  = form.departure_esr_code ? KNOWN_ESR[form.departure_esr_code] : null;
                          const depMismatch = depKnown && form.departure_station_name && !form.departure_station_name.toLowerCase().includes(depKnown.split('-')[0].toLowerCase());
                          const depNameCode = depMismatch ? findEsrByName(form.departure_station_name!) : null;
                          const depWarnName = depMismatch ? `Не соответствует коду — по справочнику это «${depKnown}»` : null;
                          const depWarnCode = depMismatch ? `Код ${form.departure_esr_code} = «${depKnown}»${depNameCode ? `, код «${form.departure_station_name}»: ${depNameCode}` : ''}` : null;

                          const arrKnown  = form.arrival_esr_code ? KNOWN_ESR[form.arrival_esr_code] : null;
                          const arrMismatch = arrKnown && form.arrival_station_name && !form.arrival_station_name.toLowerCase().includes(arrKnown.split('-')[0].toLowerCase());
                          const arrNameCode = arrMismatch ? findEsrByName(form.arrival_station_name!) : null;
                          const arrWarnName = arrMismatch ? `Не соответствует коду — по справочнику это «${arrKnown}»` : null;
                          const arrWarnCode = arrMismatch ? `Код ${form.arrival_esr_code} = «${arrKnown}»${arrNameCode ? `, код «${form.arrival_station_name}»: ${arrNameCode}` : ''}` : null;

                          function inlineField(
                            lbl: string,
                            key: keyof ParsedGU12,
                            warn: string | null | undefined,
                            type: 'text' | 'number' = 'text',
                          ) {
                            const hasWarn = !!warn;
                            const hasVal  = !!form[key];
                            const cls = hasWarn
                              ? 'border-red-400 bg-red-50 focus:ring-red-400'
                              : hasVal
                              ? 'border-green-400 bg-green-50 focus:ring-green-400'
                              : 'border-gray-200 focus:ring-blue-500';
                            return (
                              <div key={key}>
                                <label className="block text-xs text-gray-400 mb-0.5">{lbl}</label>
                                <input
                                  type={type}
                                  className={`w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 ${cls}`}
                                  value={(form[key] as string | number) ?? ''}
                                  onChange={(e) => setForm((f) => ({ ...f, [key]: type === 'number' ? Number(e.target.value) || undefined : e.target.value || undefined }))}
                                />
                                {hasWarn && <p className="text-xs text-red-500 mt-0.5">⚠ {warn}</p>}
                              </div>
                            );
                          }

                          return (
                          <div className="border-t border-amber-200 px-3 py-3 space-y-3 bg-white">
                            <p className="text-xs text-amber-700 font-medium">Проверьте и исправьте данные:</p>
                            <div className="grid grid-cols-2 gap-2">
                              {inlineField('№ ГУ-12', 'gu12_number', null)}
                              {inlineField('Кол-во вагонов', 'quantity_planned', null, 'number')}
                              {inlineField('Код ЕТСНГ', 'cargo_etsng_code', etsngWarn)}
                              {inlineField('Станция отправления', 'departure_station_name', depWarnName)}
                              {inlineField('ЕСР отправления', 'departure_esr_code', depWarnCode)}
                              {inlineField('Станция назначения', 'arrival_station_name', arrWarnName)}
                              {inlineField('ЕСР назначения', 'arrival_esr_code', arrWarnCode)}
                            </div>
                            <div className="flex gap-2 justify-end pt-1">
                              <button
                                onClick={() => {
                                  setBulkResults(prev => prev.map((x, xi) => xi === i ? { ...x, status: 'skipped' } : x));
                                  setReviewingIdx(-1);
                                }}
                                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer"
                              >
                                Пропустить
                              </button>
                              <button
                                onClick={async () => {
                                  const result = await saveForm(form, r.name);
                                  setBulkResults(prev => prev.map((x, xi) => xi === i ? { ...result } : x));
                                  setReviewingIdx(-1);
                                  if (result.status === 'ok') onSaved();
                                }}
                                className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                              >
                                Сохранить
                              </button>
                            </div>
                          </div>
                          );
                        })()}
                      </div>
                    ))}
                    {bulkIndex < bulkQueue.length && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm">
                        <Loader2 size={13} className="animate-spin shrink-0" />
                        <span className="truncate">{bulkQueue[bulkIndex]?.name}</span>
                      </div>
                    )}
                  </div>
                  {bulkIndex >= bulkQueue.length && (
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <span className="text-sm text-gray-600 flex items-center gap-3 flex-wrap">
                        <span>✓ <strong className="text-green-700">{bulkResults.filter(r => r.status === 'ok').length}</strong> загружено</span>
                        {bulkResults.some(r => r.status === 'warning') && (
                          <span>⚠ <strong className="text-amber-600">{bulkResults.filter(r => r.status === 'warning').length}</strong> ожидают исправления</span>
                        )}
                        {bulkResults.some(r => r.status === 'skipped') && (
                          <span>— <strong className="text-gray-500">{bulkResults.filter(r => r.status === 'skipped').length}</strong> пропущено</span>
                        )}
                        {bulkResults.some(r => r.status === 'duplicate') && (
                          <span>⚠ <strong className="text-amber-600">{bulkResults.filter(r => r.status === 'duplicate').length}</strong> дубликат</span>
                        )}
                        {bulkResults.some(r => r.status === 'error') && (
                          <span>✗ <strong className="text-red-600">{bulkResults.filter(r => r.status === 'error').length}</strong> ошибка</span>
                        )}
                      </span>
                      <Button onClick={close}>Готово</Button>
                    </div>
                  )}
                </div>
              )}

              {step === 'extracting' && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <Loader2 size={36} className="text-blue-500 animate-spin" />
                  <p className="text-gray-600 font-medium">Читаем PDF...</p>
                  <p className="text-sm text-gray-400">Извлекаем и анализируем текст документа</p>
                </div>
              )}

              {step === 'error' && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <AlertCircle size={36} className="text-red-400" />
                  <p className="text-red-600 font-medium text-center">{errorMsg}</p>
                  <Button variant="secondary" onClick={close}>Закрыть</Button>
                </div>
              )}

              {step === 'done' && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <CheckCircle size={36} className="text-green-500" />
                  <p className="text-green-700 font-medium">Заявка ГУ-12 успешно добавлена!</p>
                  <p className="text-sm text-gray-400">Найдите её в списке и опубликуйте на бирже</p>
                  <Button onClick={close}>Готово</Button>
                </div>
              )}

              {(step === 'review' || step === 'saving') && (
                <div className="space-y-4">
                  {/* Recognition quality */}
                  <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2.5">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${filledCount >= 7 ? 'bg-green-500' : filledCount >= 4 ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: `${(filledCount / totalFields) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      Распознано {filledCount} из {totalFields} полей
                    </span>
                  </div>

                  {isDuplicate && (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-300 px-3 py-2.5 text-sm text-amber-800">
                      <AlertCircle size={15} className="shrink-0" />
                      <span>Заявка <strong>{form.gu12_number}</strong> уже есть в вашем кабинете. Сохранение обновит существующую запись.</span>
                    </div>
                  )}

                  {(() => {
                    const missingReq = [
                      !form.cargo_etsng_code && 'код ЕТСНГ',
                      !form.departure_esr_code && 'ЕСР отправления',
                      !form.arrival_esr_code && 'ЕСР назначения',
                    ].filter(Boolean);
                    return missingReq.length > 0 ? (
                      <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                        <AlertCircle size={14} className="shrink-0" />
                        <span>Обязательные поля не распознаны: <strong>{missingReq.join(', ')}</strong>. Заполните вручную перед сохранением.</span>
                      </div>
                    ) : filledCount < 4 ? (
                      <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
                        <AlertCircle size={14} /> Мало данных распознано — возможно, структура PDF отличается от стандарта. Заполните оставшиеся поля вручную.
                      </div>
                    ) : null;
                  })()}

                  <p className="text-sm text-gray-500">Проверьте данные и при необходимости исправьте:</p>

                  <div className="grid grid-cols-2 gap-3">
                    {field('№ ГУ-12', 'gu12_number')}
                    {field('Количество вагонов', 'quantity_planned', 'number')}
                    {(() => {
                      const w = validateEtsng(form.cargo_etsng_code);
                      const knownName = form.cargo_etsng_code ? KNOWN_ETSNG[form.cargo_etsng_code] : null;
                      const v = { warn: w, ok: !w && knownName ? `Проверено: ${knownName}` : null };
                      return field('Код ЕТСНГ', 'cargo_etsng_code', 'text', v);
                    })()}
                    {(() => {
                      const knownSt = form.departure_esr_code ? KNOWN_ESR[form.departure_esr_code] : null;
                      const mismatch = knownSt && form.departure_station_name && !form.departure_station_name.toLowerCase().includes(knownSt.split('-')[0].toLowerCase());
                      const nameCode = mismatch ? findEsrByName(form.departure_station_name ?? '') : null;
                      const wName = mismatch ? `Не соответствует коду — по справочнику это «${knownSt}»` : null;
                      const wCode = mismatch ? `Код ${form.departure_esr_code} = «${knownSt}»${nameCode ? `, код «${form.departure_station_name}»: ${nameCode}` : ''}` : null;
                      const ok = !mismatch && knownSt ? `Проверено: ${knownSt}` : null;
                      return <>
                        {field('Станция отправления', 'departure_station_name', 'text', { warn: wName, ok })}
                        {field('Код ЕСР отправления', 'departure_esr_code', 'text', { warn: wCode, ok })}
                      </>;
                    })()}
                    {(() => {
                      const knownSt = form.arrival_esr_code ? KNOWN_ESR[form.arrival_esr_code] : null;
                      const mismatch = knownSt && form.arrival_station_name && !form.arrival_station_name.toLowerCase().includes(knownSt.split('-')[0].toLowerCase());
                      const nameCode = mismatch ? findEsrByName(form.arrival_station_name ?? '') : null;
                      const wName = mismatch ? `Не соответствует коду — по справочнику это «${knownSt}»` : null;
                      const wCode = mismatch ? `Код ${form.arrival_esr_code} = «${knownSt}»${nameCode ? `, код «${form.arrival_station_name}»: ${nameCode}` : ''}` : null;
                      const ok = !mismatch && knownSt ? `Проверено: ${knownSt}` : null;
                      return <>
                        {field('Станция назначения', 'arrival_station_name', 'text', { warn: wName, ok })}
                        {field('Код ЕСР назначения', 'arrival_esr_code', 'text', { warn: wCode, ok })}
                      </>;
                    })()}
                    {field('Дата начала', 'period_start', 'date')}
                    {field('Дата окончания', 'period_end', 'date')}
                  </div>

                </div>
              )}
            </div>

            {(step === 'review' || step === 'saving') && (
              <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
                <Button variant="secondary" onClick={close}>Отмена</Button>
                <Button onClick={save} loading={step === 'saving'}>
                  <CheckCircle size={14} /> Сохранить заявку
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
