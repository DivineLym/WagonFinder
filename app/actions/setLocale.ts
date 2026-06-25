'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function setLocale(locale: string) {
  const valid = ['ru', 'kk', 'en'];
  if (!valid.includes(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set('locale', locale, { path: '/', maxAge: 60 * 60 * 24 * 365 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('profiles').update({ language: locale }).eq('id', user.id);
  }

  revalidatePath('/', 'layout');
}
