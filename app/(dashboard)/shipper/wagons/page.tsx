import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AvailableWagonsView } from '@/components/shipper/AvailableWagonsView';
import type { Profile, Wagon, GU12Order } from '@/types';

export default async function ShipperWagonsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile || profile.role !== 'shipper') redirect('/wagon-owner');

  const [{ data: wagons }, { data: orders }] = await Promise.all([
    supabase
      .from('wagons')
      .select('*, owner:owner_id(id, full_name, company_name)')
      .eq('is_verified', true)
      .eq('status', 'active'),
    supabase
      .from('gu12_orders')
      .select('*')
      .eq('shipper_id', user.id)
      .in('status', ['active', 'partially_fulfilled'])
      .order('period_start'),
  ]);

  return (
    <AvailableWagonsView
      profile={profile as Profile}
      wagons={(wagons ?? []) as Wagon[]}
      orders={(orders ?? []) as GU12Order[]}
    />
  );
}
