import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import { updateProfile } from '@/app/actions/auth';
import { savePricingRules } from '@/app/actions/pricing';
import { loadRules } from '@/lib/suggestions';
import { createClient } from '@/lib/supabase/server';
import { getDictionary, getLocale } from '../../dictionaries';

// Account settings: the display name (email is the login and stays read-only)
// and the pricing rules that shape every suggested price.
export async function generateMetadata() {
  const dict = await getDictionary(await getLocale());
  return { title: dict.nav.settings };
}


export default async function SettingsPage() {
  const lang = await getLocale();
  const dict = await getDictionary(lang);
  const t = dict.settings;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect('/login?next=/dashboard/settings');
  const { email, user_metadata: meta } = data.claims;
  const rules = await loadRules(supabase);
  const tr = t.rules;
  // Stored as ratios, typed as percents; the decimal separator follows the language.
  const shown = (n, scale = 1) => (n == null ? '' : String(Math.round(n * scale * 100) / 100).replace('.', lang === 'bg' ? ',' : '.'));

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
      <div className="dash__panel settings" id="rules">
        <h2>{tr.title}</h2>
        <p className="muted">{tr.intro}</p>
        <AuthForm
          action={savePricingRules}
          t={tr}
          submit={tr.save}
          fields={[
            { name: 'min_margin', label: tr.fields.min_margin, hint: tr.hints.min_margin, inputMode: 'decimal', autoComplete: 'off', required: false, placeholder: '15', defaultValue: shown(rules.minMargin, 100) },
            { name: 'undercut', label: tr.fields.undercut, hint: tr.hints.undercut, inputMode: 'decimal', autoComplete: 'off', required: false, placeholder: '0', defaultValue: rules.undercut ? shown(rules.undercut) : '' },
            { name: 'max_change', label: tr.fields.max_change, hint: tr.hints.max_change, inputMode: 'decimal', autoComplete: 'off', required: false, placeholder: '10', defaultValue: shown(rules.maxChange, 100) },
          ]}
        />
      </div>
    </section>
  );
}
