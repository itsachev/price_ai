'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// RLS limits every write to the caller's own rows; ids are checked here first.
const id = (formData, key) => {
  const n = Number(formData.get(key));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

async function run(write) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return;
  const { error } = await write(supabase);
  if (error) throw new Error(`${error.code}: ${error.message}`, { cause: error });
  revalidatePath('/info', 'layout');
}

export async function addToList(formData) {
  const listingId = id(formData, 'listing');
  if (!listingId) return;
  await run((s) => s.from('shopping_list_items')
    .upsert({ listing_id: listingId }, { onConflict: 'user_id,listing_id', ignoreDuplicates: true }));
}

export async function removeFromList(formData) {
  const itemId = id(formData, 'item');
  if (!itemId) return;
  await run((s) => s.from('shopping_list_items').delete().eq('id', itemId));
}

// The +/- buttons send the new quantity; 0 removes the item.
export async function setQuantity(formData) {
  const itemId = id(formData, 'item');
  const quantity = Number(formData.get('quantity'));
  if (!itemId || !Number.isInteger(quantity) || quantity < 0 || quantity > 99) return;
  await run((s) => quantity === 0
    ? s.from('shopping_list_items').delete().eq('id', itemId)
    : s.from('shopping_list_items').update({ quantity }).eq('id', itemId));
}

export async function clearList() {
  await run((s) => s.from('shopping_list_items').delete().not('id', 'is', null));
}
