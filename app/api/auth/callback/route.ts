import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  const supabase = await createClient();
  let data: Awaited<ReturnType<typeof supabase.auth.exchangeCodeForSession>>['data'] | null = null;
  let error: unknown = null;

  if (tokenHash && type) {
    // Implicit flow — works across different browsers
    const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as 'signup' | 'email' });
    data = result.data as typeof data;
    error = result.error;
  } else if (code) {
    // PKCE flow — same browser only
    const result = await supabase.auth.exchangeCodeForSession(code);
    data = result.data;
    error = result.error;
  }

  if (!error && data?.user) {
    const user = data.user;

    // Check if profile already exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!existing) {
      const meta = user.user_metadata;
      await supabase.from('profiles').insert({
        id: user.id,
        full_name: meta.full_name ?? '',
        email: user.email ?? '',
        role: meta.role ?? 'shipper',
        bin: meta.bin ?? null,
        ktz_payer_code: meta.ktz_payer_code ?? null,
        company_name: meta.company_name ?? null,
        verification_status: 'pending',
      });
    }

    const role = user.user_metadata?.role;
    return NextResponse.redirect(
      new URL(role === 'wagon_owner' ? '/wagon-owner' : '/shipper', origin)
    );
  }

  return NextResponse.redirect(new URL('/login?error=auth_failed', origin));
}
