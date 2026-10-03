import { getDictionary, getLocale } from '../dictionaries';

export async function generateMetadata() {
  const dict = await getDictionary(await getLocale());
  return { title: dict.info.title, robots: { index: false } };
}

// Where consumer accounts land after signing up. Placeholder until it has content.
export default async function InfoPage() {
  const { info: t } = await getDictionary(await getLocale());
  return (
    <section className="legal">
      <h1>{t.title}</h1>
    </section>
  );
}
