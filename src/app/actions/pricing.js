'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseRules, refreshStatuses } from '@/lib/suggestions';

// Pricing rules from /dashboard/settings. Blank turns a rule off. Returns the
// typed values with { error } or { notice } for useActionState (AuthForm).
export async function savePricingRules(_prev, formData) {
  const { values, error: invalid, row } = parseRules(formData);
  if (invalid) return { ...values, error: invalid };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect('/login?next=/dashboard/settings');
  const { error } = await supabase.from('pricing_rules').upsert({ owner_id: data.claims.sub, ...row });
  if (error) return { ...values, error: 'unknown' };
  // The undercut rule moves the target every status is measured against.
  await refreshStatuses(supabase);
  revalidatePath('/dashboard', 'layout');
  return { ...values, notice: 'saved' };
}
