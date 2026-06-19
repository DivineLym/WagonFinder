'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import stations from '@/lib/esrStations.json';

interface Station { code: string; name: string; }
const STATIONS: Station[] = stations as Station[];

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function StationAutocomplete({ value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Station[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Sync external clear (e.g. "Сбросить")
  useEffect(() => {
    if (!value) setQuery('');
  }, [value]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function handleInput(val: string) {
    setQuery(val);
    if (!val.trim()) { onChange(''); setSuggestions([]); setOpen(false); return; }
    const q = val.toLowerCase();
    const matches = STATIONS.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.includes(q)
    ).slice(0, 8);
    setSuggestions(matches);
    setOpen(matches.length > 0);
    // Pass raw query for filtering even without selecting
    onChange(val);
  }

  function select(s: Station) {
    setQuery(s.name);
    onChange(s.name);
    setOpen(false);
  }

  function clear() {
    setQuery('');
    onChange('');
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
      <input
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="pl-7 pr-6 py-2 text-sm focus:outline-none bg-transparent text-gray-600 w-44 h-[38px]"
      />
      {query && (
        <button onClick={clear} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 cursor-pointer">
          <X size={13} />
        </button>
      )}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s.code}
              onMouseDown={() => select(s)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 cursor-pointer flex items-center gap-2"
            >
              <span className="font-mono text-blue-600 shrink-0">{s.code}</span>
              <span className="text-gray-700">{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
