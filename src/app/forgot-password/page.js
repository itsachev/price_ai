import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import AuthShell from '@/components/AuthShell';
import { requestPasswordReset } from '../actions/auth';
import { getDictionary, getLocale } from '../dictionaries';

export async function generateMetadata() {
  const dict = await getDictionary(await getLocale());
  return { title: dict.auth.forgotTitle };
}


export default async function ForgotPasswordPage() {
  const { auth: t } = await getDictionary(await getLocale());

  return (
    <AuthShell title={t.forgotTitle} intro={t.forgotIntro} footer={<Link href="/login">{t.backToSignIn}</Link>}>
      <AuthForm
        action={requestPasswordReset}
        t={t}
        submit={t.sendLink}
        fields={[{ name: 'email', type: 'email', label: t.email, autoComplete: 'email' }]}
      />
    </AuthShell>
  );
}
