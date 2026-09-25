// npm run seed-demo: create a demo merchant (demo@priceai.test) with a small
// grocery catalog, so matching can be tried before auth and product import
// exist. Safe to rerun: it does nothing if the demo merchant has products.
import { randomUUID } from 'node:crypto';
import { createAdminClient } from '../src/lib/supabase/admin.js';

const EMAIL = 'demo@priceai.test';
const CATALOG = [
  ['Прясно мляко Верея 3%', '1 л', 1.79],
  ['Прясно мляко Саяна 3%', '1 л', 1.85],
  ['Прясно мляко Балкан 3%', '1 л', 2.15],
  ['Слънчогледово олио Калиакра', '1 л', 1.99],
  ['Слънчогледово олио Бисер', '1 л', 1.89],
  ['Слънчогледово олио Клас', '1 л', 1.75],
  ['Кисело мляко Верея 3,6%', '400 г', 0.99],
  ['Бяла захар', '1 кг', 1.29],
  ['Брашно тип 500', '1 кг', 1.19],
  ['Ориз', '1 кг', 2.49],
  ['Coca-Cola', '2 л', 2.79],
  ['Бира Загорка', '500 мл', 1.25],
  ['Бира Каменица', '500 мл', 1.19],
  ['Нескафе Класик', '100 г', 5.49],
  ['Шоколад Милка млечен', '100 г', 1.99],
  ['Масло Верея', '125 г', 2.69],
  ['Яйца размер М', '10 бр', 3.29],
  ['Минерална вода Банкя', '1,5 л', 0.69],
];

const supabase = createAdminClient();
const { data: list, error: listError } = await supabase.auth.admin.listUsers();
if (listError) throw listError;
let user = list.users.find((u) => u.email === EMAIL);
if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({ email: EMAIL, password: randomUUID(), email_confirm: true });
  if (error) throw error;
  user = data.user;
}

const { count, error: countError } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('owner_id', user.id);
if (countError) throw countError;
if (count) {
  console.log(`${EMAIL} already has ${count} products`);
} else {
  const { error } = await supabase
    .from('products')
    .insert(CATALOG.map(([name, size, price]) => ({ owner_id: user.id, name, size, price })));
  if (error) throw error;
  console.log(`Seeded ${CATALOG.length} products for ${EMAIL}`);
}
