import LegalPage from '@/components/LegalPage';
import { getDictionary, getLocale } from '../dictionaries';

export async function generateMetadata() {
  const dict = await getDictionary(await getLocale());
  return { title: dict.legal.terms.title, alternates: { canonical: '/terms' } };
}

export default async function TermsPage() {
  const dict = await getDictionary(await getLocale());
  return <LegalPage t={dict.legal.terms} />;
}
