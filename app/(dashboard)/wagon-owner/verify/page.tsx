import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WagonVerificationForm } from '@/components/wagon-owner/WagonVerificationForm';
import type { Profile } from '@/types';

export default async function WagonVerifyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile || profile.role !== 'wagon_owner') redirect('/shipper');

  return <WagonVerificationForm profile={profile as Profile} />;
}
