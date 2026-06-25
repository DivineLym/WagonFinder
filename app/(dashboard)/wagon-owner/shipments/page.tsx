import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OwnerShipmentsView } from '@/components/wagon-owner/OwnerShipmentsView';
import type { PendingApplication, RejectedApplication } from '@/types';

export default async function OwnerShipmentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('bin, *').eq('id', user.id).single();

  const [{ data: pending }, { data: rejected }, { data: shipperRequests }, { data: rejectedShipperRequests }] = await Promise.all([
    supabase
      .from('wagon_owner_pending_requests')
      .select('*, gu12_order:gu12_orders(*, etsng_cargos(name,wagon_type_required), departure_station:esr_stations!departure_esr_code(name), arrival_station:esr_stations!arrival_esr_code(name)), wagon:wagons(number,wagon_type,payload_capacity_tons), status, wagon_owner_paid_at, shipper_paid_at')
      .eq('wagon_owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('wagon_owner_rejected_requests')
      .select('*, gu12_order:gu12_orders(*, etsng_cargos(name,wagon_type_required), departure_station:esr_stations!departure_esr_code(name), arrival_station:esr_stations!arrival_esr_code(name)), wagon:wagons(number,wagon_type,payload_capacity_tons)')
      .eq('wagon_owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('shipper_pending_requests')
      .select('*, gu12_order:gu12_orders(*, etsng_cargos(name,wagon_type_required), departure_station:esr_stations!departure_esr_code(name), arrival_station:esr_stations!arrival_esr_code(name)), wagon:wagons(number,wagon_type,payload_capacity_tons), shipper:profiles!shipper_id(full_name,company_name,bin), status, shipper_paid_at, wagon_owner_paid_at')
      .eq('wagon_owner_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('shipper_rejected_requests')
      .select('*, gu12_order:gu12_orders(*, etsng_cargos(name,wagon_type_required), departure_station:esr_stations!departure_esr_code(name), arrival_station:esr_stations!arrival_esr_code(name)), wagon:wagons(number,wagon_type,payload_capacity_tons), shipper:profiles!shipper_id(full_name,company_name,bin)')
      .eq('wagon_owner_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  return (
    <OwnerShipmentsView
      pending={(pending ?? []) as PendingApplication[]}
      rejected={(rejected ?? []) as RejectedApplication[]}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      shipperRequests={(shipperRequests ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rejectedShipperRequests={(rejectedShipperRequests ?? []) as any}
      profile={profile as any}
    />
  );
}
