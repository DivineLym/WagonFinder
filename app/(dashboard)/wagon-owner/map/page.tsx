import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WagonMapPage } from '@/components/map/WagonMapPage';

export default async function WagonOwnerMapPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: wagons } = await supabase
    .from('wagons')
    .select('*, owner:profiles!owner_id(company_name, full_name)')
    .not('current_esr_code', 'is', null)
    .order('status');

  return <WagonMapPage wagons={wagons ?? []} />;
}
