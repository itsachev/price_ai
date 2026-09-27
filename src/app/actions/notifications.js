'use server';

import { createClient } from '@/lib/supabase/server';

// Opening the header bell marks everything read. RLS limits it to the caller's
// rows and the column grant to read_at.
export async function markNotificationsRead() {
  const supabase = await createClient();
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
}
