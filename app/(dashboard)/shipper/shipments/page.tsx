import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ShipperShipmentsView } from '@/components/shipper/ShipperShipmentsView';
import type { PendingApplication, RejectedApplication, Profile } from '@/types';

export default async function ShipperShipmentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  const { data: orders } = await supabase
    .from('gu12_orders')
    .select('id')
    .eq('shipper_id', user.id);

  const orderIds = (orders ?? []).map((o) => o.id);

  const [{ data: pending }, { data: rejected }] = await Promise.all([
    orderIds.length > 0
      ? supabase
          .from('wagon_owner_pending_requests')
          .select('*, gu12_order:gu12_orders(*), wagon:wagons(number,wagon_type,payload_capacity_tons), wagon_owner:profiles!wagon_owner_id(company_name,full_name,bin)')
          .in('gu12_order_id', orderIds)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    orderIds.length > 0
      ? supabase
          .from('wagon_owner_rejected_requests')
          .select('*, gu12_order:gu12_orders(*), wagon:wagons(number,wagon_type,payload_capacity_tons), wagon_owner:profiles!wagon_owner_id(company_name,full_name,bin)')
          .in('gu12_order_id', orderIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <ShipperShipmentsView
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applications={(pending ?? []) as any}
      rejected={(rejected ?? []) as RejectedApplication[]}
      myBin={profile?.bin ?? ''}
      profile={profile as Profile}
    />
  );
}
