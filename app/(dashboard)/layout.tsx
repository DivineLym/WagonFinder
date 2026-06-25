import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/Sidebar';
import type { Profile } from '@/types';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');

  return (
    <div className="flex h-screen bg-[#f5f6fa] overflow-hidden">
      <Sidebar profile={profile as Profile} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-hidden p-6 flex flex-col min-h-0 [&>*]:flex-1 [&>*]:min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
