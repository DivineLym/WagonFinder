import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ShipperCargoView } from '@/components/shipper/ShipperCargoView';
import type { Profile, GU12Order } from '@/types';

export default async function ShipperPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single();

  if (!profile || profile.role !== 'shipper') redirect('/wagon-owner');

  const { data: orders } = await supabase
    .from('gu12_orders').select('*').eq('shipper_id', user.id).order('created_at', { ascending: false });

  return (
    <ShipperCargoView
      profile={profile as Profile}
      initialOrders={(orders ?? []) as GU12Order[]}
      initialApplications={[]}
    />
  );
}
