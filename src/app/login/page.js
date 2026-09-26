import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import AuthShell from '@/components/AuthShell';
import { signIn } from '../actions/auth';
import { safeNext } from '@/lib/auth';
import { getDictionary, getLocale } from '../dictionaries';

export default async function LoginPage({ searchParams }) {
  const { auth: t } = await getDictionary(await getLocale());
  const { error, next } = await searchParams;
  const nextPath = safeNext(next);
  const signupHref = nextPath === '/dashboard' ? '/signup' : `/signup?next=${encodeURIComponent(nextPath)}`;

  return (
    <AuthShell
      title={t.signInTitle}
      intro={t.signInIntro}
      footer={<>{t.noAccount} <Link href={signupHref}>{t.signUpLink}</Link></>}
    >
      <AuthForm
        action={signIn}
        t={t}
        submit={t.signIn}
        hidden={{ next: nextPath }}
        initialError={error === 'link' ? 'link' : null}
        fields={[
          { name: 'email', type: 'email', label: t.email, autoComplete: 'email' },
          { name: 'password', type: 'password', label: t.password, autoComplete: 'current-password' },
        ]}
      >
        <Link href="/forgot-password" className="auth-form__aside">{t.forgot}</Link>
      </AuthForm>
    </AuthShell>
  );
}
