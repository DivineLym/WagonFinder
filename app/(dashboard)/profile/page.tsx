import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProfileView } from '@/components/profile/ProfileView';
import type { Profile, BalanceTransaction } from '@/types';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');

  const { data: transactions } = await supabase
    .from('balance_transactions')
    .select('*')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="overflow-y-auto">
      <ProfileView
        profile={profile as Profile}
        transactions={(transactions ?? []) as BalanceTransaction[]}
      />
    </div>
  );
}
