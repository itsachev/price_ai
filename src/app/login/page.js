import LoginForm from '@/components/LoginForm';
import { getDictionary, getLocale } from '../dictionaries';

export default async function LoginPage({ searchParams }) {
  const dict = await getDictionary(await getLocale());
  const { error } = await searchParams;

  return (
    <section className="auth stack">
      <h1>{dict.auth.title}</h1>
      <p className="muted">{dict.auth.intro}</p>
      <LoginForm t={dict.auth} initialError={error === 'link' ? 'link' : null} />
    </section>
  );
}
