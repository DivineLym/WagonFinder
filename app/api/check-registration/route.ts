import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const { bin, email } = await req.json();

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey || serviceRoleKey === 'YOUR_SERVICE_ROLE_KEY_HERE') {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  if (bin) {
    const { data } = await supabase.from('profiles').select('id').eq('bin', bin).maybeSingle();
    if (data) return NextResponse.json({ conflict: 'bin' });
  }

  if (email) {
    const { data } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
    if (data) return NextResponse.json({ conflict: 'email' });
  }

  return NextResponse.json({ ok: true });
}
