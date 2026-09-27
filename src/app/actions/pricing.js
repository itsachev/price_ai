'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { parsePrice } from '@/lib/catalog';
import { createClient } from '@/lib/supabase/server';
import { refreshStatuses } from '@/lib/suggestions';

const FIELDS = ['min_margin', 'undercut', 'max_change'];
// Valid range per field as the merchant types it: percents for the ratios, euros for undercut.
const RANGE = { min_margin: [0, 95], undercut: [0, 100], max_change: [1, 100] };

// Pricing rules from /dashboard/settings. Blank turns a rule off. Returns the
// typed values with { error } or { notice } for useActionState (AuthForm).
export async function savePricingRules(_prev, formData) {
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? '').trim()]));
  const nums = {};
  for (const f of FIELDS) {
    if (!values[f]) {
      nums[f] = null;
      continue;
    }
    const n = parsePrice(values[f].replace('%', ''));
    const [min, max] = RANGE[f];
    if (!(n >= min && n <= max)) return { ...values, error: f };
    nums[f] = n;
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect('/login?next=/dashboard/settings');
  const { error } = await supabase.from('pricing_rules').upsert({
    owner_id: data.claims.sub,
    min_margin: nums.min_margin == null ? null : nums.min_margin / 100,
    undercut: nums.undercut ?? 0,
    max_change: nums.max_change == null ? null : nums.max_change / 100,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ...values, error: 'unknown' };
  // The undercut rule moves the target every status is measured against.
  await refreshStatuses(supabase);
  revalidatePath('/dashboard', 'layout');
  return { ...values, notice: 'saved' };
}
