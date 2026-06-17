import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ContractView } from '@/components/contract/ContractView';
import type { Profile } from '@/types';

export default async function ContractPage({ searchParams }: { searchParams: Promise<{ application_id?: string }> }) {
  const { application_id } = await searchParams;
  if (!application_id) redirect('/');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');

  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('application_id', application_id)
    .single();

  if (!contract) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Контракт не найден или ещё не сформирован
      </div>
    );
  }

  return <ContractView contract={contract} profile={profile as Profile} />;
}
