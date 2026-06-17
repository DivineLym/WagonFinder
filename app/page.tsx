import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) {
    // Auth user exists but no profile — sign out to break the redirect loop
    await supabase.auth.signOut();
    redirect('/login');
  }

  if (profile.role === 'wagon_owner') redirect('/wagon-owner');
  redirect('/shipper');
}
