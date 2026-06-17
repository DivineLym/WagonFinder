import type { Profile } from '@/types';

interface HeaderProps {
  profile: Profile;
  title: string;
}

export function Header({ profile, title }: HeaderProps) {
  return (
    <header className="h-[56px] bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <h1 className="text-[15px] font-semibold text-gray-800">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-[13px] font-bold text-gray-900 leading-tight tracking-wide">
            {profile.full_name.toUpperCase()}
          </div>
          <div className="text-[11px] text-gray-400 leading-tight">
            БИН: {profile.bin}
            {profile.ktz_payer_code && ` · КТЖ: ${profile.ktz_payer_code}`}
          </div>
        </div>
      </div>
    </header>
  );
}
