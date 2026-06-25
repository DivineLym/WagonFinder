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

  const [{ data: incoming }, { data: rejectedIncoming }, { data: outgoing }, { data: rejectedOutgoing }] = await Promise.all([
    // Incoming: wagon owners applying to shipper's orders
    orderIds.length > 0
      ? supabase
          .from('wagon_owner_pending_requests')
          .select('*, gu12_order:gu12_orders(*, etsng_cargos(name,wagon_type_required), departure_station:esr_stations!departure_esr_code(name), arrival_station:esr_stations!arrival_esr_code(name)), wagon:wagons(number,wagon_type,payload_capacity_tons), wagon_owner:profiles!wagon_owner_id(company_name,full_name,bin), status, wagon_owner_paid_at, shipper_paid_at')
          .in('gu12_order_id', orderIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    // Rejected incoming
    orderIds.length > 0
      ? supabase
          .from('wagon_owner_rejected_requests')
          .select('*, gu12_order:gu12_orders(*, etsng_cargos(name,wagon_type_required), departure_station:esr_stations!departure_esr_code(name), arrival_station:esr_stations!arrival_esr_code(name)), wagon:wagons(number,wagon_type,payload_capacity_tons), wagon_owner:profiles!wagon_owner_id(company_name,full_name,bin)')
          .in('gu12_order_id', orderIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    // Outgoing: shipper's own requests to wagon owners
    supabase
      .from('shipper_pending_requests')
      .select('*, gu12_order:gu12_orders(*, etsng_cargos(name,wagon_type_required), departure_station:esr_stations!departure_esr_code(name), arrival_station:esr_stations!arrival_esr_code(name)), wagon:wagons(number,wagon_type,payload_capacity_tons), wagon_owner:profiles!wagon_owner_id(company_name,full_name,bin), status, shipper_paid_at, wagon_owner_paid_at')
      .eq('shipper_id', user.id)
      .order('created_at', { ascending: false }),
    // Rejected outgoing
    supabase
      .from('shipper_rejected_requests')
      .select('*, gu12_order:gu12_orders(*, etsng_cargos(name,wagon_type_required), departure_station:esr_stations!departure_esr_code(name), arrival_station:esr_stations!arrival_esr_code(name)), wagon:wagons(number,wagon_type,payload_capacity_tons), wagon_owner:profiles!wagon_owner_id(company_name,full_name,bin)')
      .eq('shipper_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  return (
    <ShipperShipmentsView
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applications={(incoming ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rejected={(rejectedIncoming ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      outgoing={(outgoing ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rejectedOutgoing={(rejectedOutgoing ?? []) as any}
      myBin={profile?.bin ?? ''}
      profile={profile as Profile}
    />
  );
}
