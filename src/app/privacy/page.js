import LegalPage from '@/components/LegalPage';
import { getDictionary, getLocale } from '../dictionaries';

export async function generateMetadata() {
  const dict = await getDictionary(await getLocale());
  return { title: dict.legal.privacy.title, alternates: { canonical: '/privacy' } };
}

export default async function PrivacyPage() {
  const dict = await getDictionary(await getLocale());
  return <LegalPage t={dict.legal.privacy} />;
}
