import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import AuthShell from '@/components/AuthShell';
import { signUp } from '../actions/auth';
import { ACCOUNT_TYPES, safeNext } from '@/lib/auth';
import { PASSWORD_MAX, PASSWORD_MIN } from '@/lib/formGuard';
import { getDictionary, getLocale } from '../dictionaries';

export async function generateMetadata() {
  const dict = await getDictionary(await getLocale());
  return { title: dict.auth.signUp, alternates: { canonical: '/signup' } };
}


export default async function SignupPage({ searchParams }) {
  const { auth: t } = await getDictionary(await getLocale());
  const { next } = await searchParams;

  return (
    <AuthShell
      eyebrow={t.signUpEyebrow}
      title={t.signUpTitle}
      intro={t.signUpIntro}
      wide
      footer={<>{t.haveAccount} <Link href="/login">{t.signIn}</Link></>}
    >
      <AuthForm
        action={signUp}
        t={t}
        submit={t.signUp}
        hidden={{ next: safeNext(next) }}
        guard
        fields={[
          // "nickname", not "username": password managers would save it as the login, which is the email.
          { name: 'username', label: t.username, hint: t.usernameHint, autoComplete: 'nickname', minLength: 2, maxLength: 32, half: true },
          { name: 'email', type: 'email', label: t.email, autoComplete: 'email', maxLength: 254, half: true },
          { name: 'password', type: 'password', label: t.password, hint: t.passwordHint, autoComplete: 'new-password', minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX, half: true },
          { name: 'confirm', type: 'password', label: t.confirmPassword, autoComplete: 'new-password', minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX, half: true },
          { name: 'accountType', label: t.accountType, options: ACCOUNT_TYPES.map((type) => [type, t.accountTypes[type]]), note: ['consumer', t.consumerNote] },
        ]}
      />
    </AuthShell>
  );
}
