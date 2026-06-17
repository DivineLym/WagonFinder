import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FleetDashboard } from '@/components/wagon-owner/FleetDashboard';
import type { Profile, Wagon } from '@/types';

export default async function WagonOwnerPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile || profile.role !== 'wagon_owner') redirect('/shipper');

  const { data: wagons } = await supabase
    .from('wagons')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <FleetDashboard
      profile={profile as Profile}
      wagons={(wagons ?? []) as Wagon[]}
    />
  );
}
