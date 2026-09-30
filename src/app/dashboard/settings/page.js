import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import Toast from '@/components/Toast';
import { changePassword, updateProfile } from '@/app/actions/auth';
import { savePricingRules } from '@/app/actions/pricing';
import { formatPrice } from '@/lib/format';
import { PASSWORD_MAX, PASSWORD_MIN } from '@/lib/formGuard';
import { loadRules } from '@/lib/suggestions';
import { createClient } from '@/lib/supabase/server';
import { getDictionary, getLocale } from '../../dictionaries';

// Account settings, ordered by how often they matter: the pricing rules that
// shape every suggested price, then the profile, then the password. Each
// section is its description beside a form card (stacked on narrow screens).
export async function generateMetadata() {
  const dict = await getDictionary(await getLocale());
  return { title: dict.nav.settings };
}

function Section({ id, title, intro, aside, children }) {
  return (
    <section className="settings__section" id={id} aria-labelledby={`${id}-title`}>
      <div className="settings__intro">
        <h2 id={`${id}-title`}>{title}</h2>
        <p className="muted">{intro}</p>
        {aside}
      </div>
      <div className="dash__panel settings__card">{children}</div>
    </section>
  );
}

export default async function SettingsPage({ searchParams }) {
  const { notice, at } = await searchParams;
  const lang = await getLocale();
  const dict = await getDictionary(lang);
  const t = dict.settings;
  const tr = t.rules;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect('/login?next=/dashboard/settings');
  const { email, user_metadata: meta } = data.claims;
  const rules = await loadRules(supabase);
  const name = meta?.username || email.split('@')[0];
  // Stored as ratios, typed as percents; the decimal separator follows the language.
  const shown = (n, scale = 1) => (n == null ? '' : String(Math.round(n * scale * 100) / 100).replace('.', lang === 'bg' ? ',' : '.'));
  const summary = [
    ['min_margin', rules.minMargin != null && `${shown(rules.minMargin, 100)}%`],
    ['undercut', rules.undercut > 0 && formatPrice(rules.undercut, lang)],
    ['max_change', rules.maxChange != null && `${shown(rules.maxChange, 100)}%`],
  ];
  const nav = [
    ['rules', tr.title],
    ['profile', t.profile],
    ['security', t.security],
  ];

  return (
    <>
      {notice === 'passwordChanged' && <Toast key={at}>{dict.auth.notices.passwordChanged}</Toast>}
      <section className="dash">
        <header className="dash__head">
          <div className="dash__title">
            <h1>{t.title}</h1>
            <p className="muted">{t.intro}</p>
          </div>
        </header>

        <div className="settings">
          <nav className="settings__nav" aria-label={t.title}>
            {nav.map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </nav>

          <div className="settings__body">
            <Section
              id="rules"
              title={tr.title}
              intro={tr.intro}
              aside={
                <ul className="settings__rules" aria-label={tr.current}>
                  {summary.map(([key, value]) => (
                    <li key={key} data-on={value ? '' : undefined}>
                      <span>{tr.short[key]}</span>
                      <strong>{value || tr.off}</strong>
                    </li>
                  ))}
                </ul>
              }
            >
              <AuthForm
                action={savePricingRules}
                t={tr}
                submit={tr.save}
                fields={[
                  { name: 'min_margin', unit: '%', label: tr.fields.min_margin, hint: tr.hints.min_margin, inputMode: 'decimal', autoComplete: 'off', required: false, placeholder: '15', defaultValue: shown(rules.minMargin, 100) },
                  { name: 'undercut', unit: '€', label: tr.fields.undercut, hint: tr.hints.undercut, inputMode: 'decimal', autoComplete: 'off', required: false, placeholder: '0', defaultValue: rules.undercut ? shown(rules.undercut) : '' },
                  { name: 'max_change', unit: '%', label: tr.fields.max_change, hint: tr.hints.max_change, inputMode: 'decimal', autoComplete: 'off', required: false, placeholder: '10', defaultValue: shown(rules.maxChange, 100) },
                ]}
              />
            </Section>

            <Section id="profile" title={t.profile} intro={t.profileIntro}>
              <div className="settings__identity">
                <span className="settings__avatar" aria-hidden="true">
                  {name[0].toUpperCase()}
                </span>
                <div>
                  <strong>{name}</strong>
                  <span className="muted">{email}</span>
                </div>
              </div>
              <AuthForm
                action={updateProfile}
                t={dict.auth}
                submit={t.save}
                fields={[
                  { name: 'username', label: dict.auth.username, hint: dict.auth.usernameHint, autoComplete: 'nickname', minLength: 2, maxLength: 32, defaultValue: meta?.username ?? '' },
                  { name: 'email', type: 'email', label: dict.auth.email, hint: t.emailHint, defaultValue: email, readOnly: true, required: false },
                ]}
              />
            </Section>

            <Section id="security" title={t.security} intro={t.securityIntro}>
              <AuthForm
                action={changePassword}
                t={dict.auth}
                submit={t.changePassword}
                fields={[
                  { name: 'current', type: 'password', label: t.currentPassword, autoComplete: 'current-password', maxLength: 256 },
                  { name: 'password', type: 'password', label: dict.auth.newPassword, hint: dict.auth.passwordHint, autoComplete: 'new-password', minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX },
                  { name: 'confirm', type: 'password', label: dict.auth.confirmPassword, autoComplete: 'new-password', minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX },
                ]}
              />
            </Section>
          </div>
        </div>
      </section>
    </>
  );
}
