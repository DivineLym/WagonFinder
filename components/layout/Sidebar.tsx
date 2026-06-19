'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { Profile } from '@/types';
import {
  Train, Package, ClipboardList,
  LayoutDashboard, Settings, HeadphonesIcon,
  LogOut, ChevronDown, User, Store, Map, Wallet,
} from 'lucide-react';
import { useState } from 'react';

interface SidebarProps { profile: Profile; }

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isShipper = profile.role === 'shipper';
  const [railOpen, setRailOpen] = useState(true);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const railItems = isShipper
    ? [
        { href: '/shipper',              label: 'Мои грузы (ГУ-12)', icon: Package        },
        { href: '/shipper/wagons',       label: 'Подбор вагонов',    icon: Train          },
        { href: '/shipper/shipments',    label: 'Заявки',            icon: ClipboardList  },
        { href: '/shipper/contracts',    label: 'Договора',          icon: LayoutDashboard },
      ]
    : [
        { href: '/wagon-owner',              label: 'Мой парк',     icon: Train           },
        { href: '/wagon-owner/map',          label: 'Карта вагонов', icon: Map            },
        { href: '/wagon-owner/market',       label: 'Биржа грузов', icon: Store           },
        { href: '/wagon-owner/shipments',    label: 'Заявки',       icon: ClipboardList   },
        { href: '/wagon-owner/contracts',    label: 'Договора',     icon: LayoutDashboard },
      ];

  return (
    <aside className="w-[240px] shrink-0 h-screen bg-white border-r border-gray-200 flex flex-col select-none">
      {/* Logo — matches SmartCargo header style */}
      <div className="flex items-center gap-3 px-4 py-[14px] border-b border-gray-100">
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <Train size={18} className="text-white" />
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-bold text-gray-900">Ж/Д перевозки</div>
          <div className="text-[11px] text-gray-400">Smart Cargo</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">

        {/* Railway section — expanded */}
        <button
          onClick={() => setRailOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Train size={15} className="text-gray-500 shrink-0" />
          <span className="flex-1 text-left">Ж/Д перевозки</span>
          <ChevronDown size={13} className={`text-gray-400 transition-transform ${railOpen ? '' : '-rotate-90'}`} />
        </button>

        {railOpen && (
          <ul className="ml-4 pl-3 border-l border-gray-100 mt-0.5 space-y-0.5 mb-1">
            {railItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] transition-colors ${
                      active
                        ? 'bg-blue-600 text-white font-medium'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon size={14} className={active ? 'text-white' : 'text-gray-400'} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* Divider */}
        <div className="my-2 border-t border-gray-100" />

        {/* Other platform sections */}
        {[
          { label: 'Профиль',   icon: User,           href: '/profile' },
          { label: 'Поддержка', icon: HeadphonesIcon, href: '#' },
          { label: 'Настройки', icon: Settings,        href: '#' },
        ].map(({ label, icon: Icon, href }) => {
          const active = pathname === href;
          return (
            <Link key={label} href={href}
              className={`flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] transition-colors ${
                active ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              }`}
            >
              <Icon size={15} className={active ? 'text-white' : 'text-gray-400 shrink-0'} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom user block */}
      <div className="border-t border-gray-100 p-3 space-y-1">
        {/* Balance chip */}
        <Link href="/profile"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            profile.balance_kzt < 5000
              ? 'bg-red-50 border border-red-200 hover:bg-red-100'
              : 'bg-blue-50 border border-blue-100 hover:bg-blue-100'
          }`}
        >
          <Wallet size={13} className={profile.balance_kzt < 5000 ? 'text-red-500' : 'text-blue-600'} />
          <span className={`text-[12px] font-semibold flex-1 ${profile.balance_kzt < 5000 ? 'text-red-700' : 'text-blue-700'}`}>
            {profile.balance_kzt.toLocaleString('ru-KZ')} ₸
          </span>
          {profile.balance_kzt < 5000 && (
            <span className="text-[10px] text-red-500 font-medium">Пополнить</span>
          )}
        </Link>

        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {(profile.full_name || profile.email).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-gray-900 truncate">{profile.company_name || profile.full_name}</div>
            <div className="text-[10px] text-gray-400 truncate">{profile.email}</div>
          </div>
        </div>
        <button onClick={signOut}
          className="flex items-center gap-2 px-3 py-1.5 w-full rounded-lg text-[12px] text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <LogOut size={12} /> Выход
        </button>
      </div>
    </aside>
  );
}
