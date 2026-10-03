import { createClient } from '@/lib/supabase/server';

// Item count beside the Shopping list nav link. Streams in its own Suspense
// boundary; the root layout re-renders after list actions, so it stays current.
export default async function ListCount({ label }) {
  const supabase = await createClient();
  const { count, error } = await supabase.from('shopping_list_items').select('id', { count: 'exact', head: true });
  if (error || !count) return null;
  return <span className="nav-count" aria-label={label.replace('{count}', count)}>{count > 99 ? '99+' : count}</span>;
}
