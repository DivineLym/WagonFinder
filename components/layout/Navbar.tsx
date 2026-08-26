'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';
import { LogOut, Train, Package, LayoutDashboard } from 'lucide-react';

interface NavbarProps {
  profile: Profile;
}

export function Navbar({ profile }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isShipper = profile.role === 'shipper';

  const links = isShipper
    ? [
        { href: '/shipper', label: 'Мои грузы (ГУ-12)', icon: Package },
        { href: '/shipper/wagons', label: 'Подбор вагонов', icon: Train },
        { href: '/shipper/shipments', label: 'Отправки', icon: LayoutDashboard },
      ]
    : [
      { href: '/wagon-owner', label: 'Мой парк', icon: Train },
      { href: '/wagon-owner/shipments', label: 'Заявки', icon: LayoutDashboard },
    ];

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <nav className="h-16 border-b border-gray-800 bg-gray-900 flex items-center px-6 gap-6 shrink-0">
      {/* Logo */}
      <Link href={isShipper ? '/shipper' : '/wagon-owner'} className="flex items-center gap-2 mr-4">
        <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center">
          <Train size={16} className="text-white" />
        </div>
        <span className="font-bold text-white text-sm hidden sm:block">WagonFinder</span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-1 flex-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              pathname === href
                ? 'bg-blue-600/20 text-blue-300 border border-blue-600/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            <Icon size={14} />
            {label}
          </Link>
        ))}
      </div>

      {/* Profile & Signout */}
      <div className="flex items-center gap-3 ml-auto">
        <div className="hidden md:block text-right">
          <p className="text-xs font-medium text-gray-200 leading-none">{profile.company_name || profile.full_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {profile.role === 'shipper' ? 'Грузоотправитель' : 'Собственник вагонов'}
            {profile.ktz_payer_code && ` · КТЖ ${profile.ktz_payer_code}`}
          </p>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-300 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-gray-800"
        >
          <LogOut size={14} />
          Выйти
        </button>
      </div>
    </nav>
  );
}
