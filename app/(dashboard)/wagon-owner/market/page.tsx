import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CargoMarket } from '@/components/wagon-owner/CargoMarket';
import type { Profile, GU12Order, Wagon } from '@/types';

export type ExistingApp = { id: string; gu12_order_id: string; wagon_id: string };

export default async function MarketPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: orders }, { data: wagons }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('gu12_orders')
      .select('*, shipper:profiles!shipper_id(company_name, bin)')
      .eq('is_public', true)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    supabase.from('wagons').select('*').eq('owner_id', user.id).eq('is_verified', true).eq('status', 'active'),
  ]);

  if (!profile) redirect('/login');

  const orderIds = (orders ?? []).map((o) => o.id);

  // Pending applications by this user for visible orders
  const { data: myApps } = orderIds.length > 0
    ? await supabase
        .from('wagon_owner_pending_requests')
        .select('id, gu12_order_id, wagon_id')
        .eq('wagon_owner_id', user.id)
        .in('gu12_order_id', orderIds)
    : { data: [] };

  const availableOrders = (orders ?? []).filter(
    (o) => (o.quantity_fulfilled ?? 0) < o.quantity_planned
  );

  const freeWagons = wagons ?? [];

  return (
    <CargoMarket
      profile={profile as Profile}
      orders={availableOrders as (GU12Order & { shipper: { company_name: string; bin: string } })[]}
      myWagons={freeWagons as Wagon[]}
      existingApps={(myApps ?? []) as ExistingApp[]}
    />
  );
}
