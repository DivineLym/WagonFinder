import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ContractsTable } from '@/components/shared/ContractsTable';
import type { Contract, Profile } from '@/types';

export default async function ShipperContractsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  const { data: contracts } = await supabase
    .from('contracts')
    .select('*')
    .eq('customer_bin', profile?.bin ?? '')
    .order('created_at', { ascending: false });

  return (
    <div className="h-full flex flex-col gap-4 min-h-0">
      <div className="shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">Договора</h2>
        <p className="text-sm text-gray-500 mt-0.5">Подписанные и ожидающие подписания договора</p>
      </div>
      <ContractsTable
        contracts={(contracts ?? []) as Contract[]}
        myBin={profile?.bin ?? ''}
        role="customer"
        profile={profile as Profile}
        emptyHint="Они появятся после принятия заявки от перевозчика"
      />
    </div>
  );
}
