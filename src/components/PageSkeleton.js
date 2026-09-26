import { getDictionary, getLocale } from '@/app/dictionaries';

// Instant fallback for signed-in pages. As a loading.js it's prefetched with the
// link, so a click paints this at once while the page's queries run.
export default async function PageSkeleton() {
  const { loading } = await getDictionary(await getLocale());
  return (
    <section className="dash" aria-busy="true">
      <p role="status" className="visually-hidden">{loading}</p>
      <div className="dash__title skeleton" aria-hidden="true">
        <span className="skeleton__title" />
        <span className="skeleton__line" />
      </div>
      <div className="dash__panel skeleton skeleton__panel" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => <span key={i} className="skeleton__line" />)}
      </div>
    </section>
  );
}
