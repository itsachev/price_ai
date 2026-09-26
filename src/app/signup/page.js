import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import AuthShell from '@/components/AuthShell';
import { signUp } from '../actions/auth';
import { safeNext } from '@/lib/auth';
import { getDictionary, getLocale } from '../dictionaries';

export default async function SignupPage({ searchParams }) {
  const { auth: t } = await getDictionary(await getLocale());
  const { next } = await searchParams;

  return (
    <AuthShell
      title={t.signUpTitle}
      intro={t.signUpIntro}
      footer={<>{t.haveAccount} <Link href="/login">{t.signIn}</Link></>}
    >
      <AuthForm
        action={signUp}
        t={t}
        submit={t.signUp}
        hidden={{ next: safeNext(next) }}
        fields={[
          { name: 'email', type: 'email', label: t.email, autoComplete: 'email' },
          { name: 'password', type: 'password', label: t.password, hint: t.passwordHint, autoComplete: 'new-password', minLength: 6 },
          { name: 'confirm', type: 'password', label: t.confirmPassword, autoComplete: 'new-password', minLength: 6 },
        ]}
      />
    </AuthShell>
  );
}
