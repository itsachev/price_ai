import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import { updateProfile } from '@/app/actions/auth';
import { createClient } from '@/lib/supabase/server';
import { getDictionary, getLocale } from '../../dictionaries';

// Account settings: the display name for now. Email is the login and stays read-only.
export default async function SettingsPage() {
  const dict = await getDictionary(await getLocale());
  const t = dict.settings;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect('/login?next=/dashboard/settings');
  const { email, user_metadata: meta } = data.claims;

  return (
    <section className="dash">
      <header className="dash__head">
        <div className="dash__title">
          <h1>{t.title}</h1>
          <p className="muted">{t.intro}</p>
        </div>
      </header>
      <div className="dash__panel settings">
        <h2>{t.profile}</h2>
        <AuthForm
          action={updateProfile}
          t={dict.auth}
          submit={t.save}
          fields={[
            { name: 'username', label: dict.auth.username, hint: dict.auth.usernameHint, autoComplete: 'nickname', minLength: 2, maxLength: 32, defaultValue: meta?.username ?? '' },
            { name: 'email', type: 'email', label: dict.auth.email, defaultValue: email, readOnly: true, required: false },
          ]}
        />
        <p className="settings__more">
          <Link href="/reset-password">{t.changePassword}</Link>
        </p>
      </div>
    </section>
  );
}
