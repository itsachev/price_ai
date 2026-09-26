import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import AuthShell from '@/components/AuthShell';
import { updatePassword } from '../actions/auth';
import { createClient } from '@/lib/supabase/server';
import { getDictionary, getLocale } from '../dictionaries';

// Reached from the reset email via /auth/callback, which signs the user in first.
export default async function ResetPasswordPage() {
  const { auth: t } = await getDictionary(await getLocale());
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect('/login?next=/reset-password');

  return (
    <AuthShell title={t.resetTitle} intro={t.resetIntro}>
      <AuthForm
        action={updatePassword}
        t={t}
        submit={t.savePassword}
        fields={[
          { name: 'email', type: 'email', label: t.email, autoComplete: 'username', defaultValue: data.claims.email, readOnly: true, required: false },
          { name: 'password', type: 'password', label: t.newPassword, hint: t.passwordHint, autoComplete: 'new-password', minLength: 6 },
          { name: 'confirm', type: 'password', label: t.confirmPassword, autoComplete: 'new-password', minLength: 6 },
        ]}
      />
    </AuthShell>
  );
}
