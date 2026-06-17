'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    company_name: '',
    email: '',
    password: '',
    role: 'shipper' as 'shipper' | 'wagon_owner',
    bin: '',
    ktz_payer_code: '',
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!/^\d{12}$/.test(form.bin)) {
      setError('БИН должен содержать ровно 12 цифр');
      return;
    }
    if (form.role === 'shipper' && form.ktz_payer_code && !/^\d{7}$/.test(form.ktz_payer_code)) {
      setError('Код плательщика КТЖ должен содержать ровно 7 цифр');
      return;
    }

    setLoading(true);

    try {
      // Server-side uniqueness check (bypasses RLS)
      const checkRes = await fetch('/api/check-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bin: form.bin, email: form.email }),
      });

      if (!checkRes.ok) {
        const text = await checkRes.text();
        throw new Error(`Ошибка проверки: ${checkRes.status} — ${text}`);
      }

      const checkData = await checkRes.json();
      if (checkData.conflict === 'bin') {
        setError('Компания с таким БИН уже зарегистрирована в системе');
        setLoading(false);
        return;
      }
      if (checkData.conflict === 'email') {
        setError('Пользователь с таким email уже существует');
        setLoading(false);
        return;
      }

      const supabase = createClient();

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
          data: {
            full_name: form.full_name,
            company_name: form.company_name,
            role: form.role,
            bin: form.bin,
            ktz_payer_code: form.ktz_payer_code || null,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message || signUpError.toString() || 'Ошибка регистрации');
        setLoading(false);
        return;
      }

      // If session returned immediately (email confirmation disabled) — create profile now
      if (data.session && data.user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: form.full_name,
          email: form.email,
          role: form.role,
          bin: form.bin,
          ktz_payer_code: form.ktz_payer_code || null,
          company_name: form.company_name,
          verification_status: 'pending',
        }, { onConflict: 'id' });

        if (profileError) {
          setError(`Ошибка создания профиля: ${profileError.message}`);
          setLoading(false);
          return;
        }

        window.location.href = form.role === 'wagon_owner' ? '/wagon-owner' : '/shipper';
        return;
      }

      // Email confirmation required — show "check email" screen
      setEmailSent(true);
      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  if (emailSent) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-blue-600">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-gray-900 mb-2">Проверьте почту</h2>
        <p className="text-sm text-gray-500 mb-1">Письмо с подтверждением отправлено на</p>
        <p className="text-sm font-semibold text-blue-700 mb-4">{form.email}</p>
        <p className="text-xs text-gray-400">Перейдите по ссылке в письме — вас автоматически перенаправит в личный кабинет</p>
        <button onClick={() => setEmailSent(false)} className="mt-5 text-xs text-gray-400 hover:text-gray-600 cursor-pointer">
          ← Вернуться к форме
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-semibold text-gray-900 mb-1">Регистрация</h1>
      <p className="text-sm text-gray-500 mb-5">Создайте аккаунт грузоотправителя или собственника вагонов</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Role selector */}
        <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-gray-200 bg-gray-50 p-1">
          {(['shipper', 'wagon_owner'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => set('role', r)}
              className={`rounded-md py-2 text-sm font-medium transition-colors cursor-pointer ${
                form.role === r
                  ? 'bg-white text-blue-700 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {r === 'shipper' ? 'Грузоотправитель' : 'Собственник вагонов'}
            </button>
          ))}
        </div>

        <Input label="ФИО / Контактное лицо" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} required />
        <Input label="Наименование компании" value={form.company_name} onChange={(e) => set('company_name', e.target.value)} required />
        <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="example@company.kz" required />
        <Input label="Пароль" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Минимум 8 символов" required />
        <Input
          label="БИН (12 цифр)"
          value={form.bin}
          onChange={(e) => set('bin', e.target.value.replace(/\D/g, '').slice(0, 12))}
          hint="Бизнес-идентификационный номер"
          placeholder="000000000000"
          required
        />
        {form.role === 'shipper' && (
          <Input
            label="Код плательщика КТЖ (7 цифр)"
            value={form.ktz_payer_code}
            onChange={(e) => set('ktz_payer_code', e.target.value.replace(/\D/g, '').slice(0, 7))}
            hint="Присваивается при заключении договора с КТЖ"
            placeholder="0000000"
          />
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full mt-1">
          Зарегистрироваться
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500">
        Уже есть аккаунт?{' '}
        <Link href="/login" className="text-blue-700 hover:underline font-medium">
          Войти
        </Link>
      </p>
    </div>
  );
}
