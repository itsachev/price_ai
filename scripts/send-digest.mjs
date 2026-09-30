// npm run digest: email each merchant what changed at the chains on the newest
// feed day, after `npm run match` wrote the notifications (0012). One email per
// merchant per feed day (app_metadata.digest_date), only when something changed,
// and never to merchants who turned it off in Settings (user_metadata.digest).
// Sent through Resend's REST API with plain fetch. Without RESEND_API_KEY and
// DIGEST_FROM it logs and exits cleanly, so dev and CI without email still pass.
import { createHash } from 'node:crypto';
import { createAdminClient } from '../src/lib/supabase/admin.js';
import { SITE_URL } from '../src/lib/config.js';
import { fill, notificationText } from '../src/lib/notifications.js';
import en from '../src/app/dictionaries/en.json' with { type: 'json' };
import bg from '../src/app/dictionaries/bg.json' with { type: 'json' };

const DICTS = { en, bg };
const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.DIGEST_FROM; // e.g. "PriceAI <digest@yourdomain.bg>", a verified Resend domain
const MAX_ITEMS = Number(process.env.DIGEST_MAX_ITEMS) || 10;
const BATCH = Math.min(Number(process.env.DIGEST_BATCH) || 100, 100); // Resend's batch limit

// --dry: print who would get what (and the first email's text), send and mark nothing.
const DRY = process.argv.includes('--dry');

if (!DRY && (!KEY || !FROM)) {
  console.log('digest: RESEND_API_KEY or DIGEST_FROM not set, skipping');
  process.exit(0);
}

const supabase = createAdminClient();
const check = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.code} ${error.message}`, { cause: error });
  return data;
};

// PostgREST returns at most max-rows per request, so read in pages.
async function all(build, what) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const page = check(await build().range(from, from + 999), what);
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

const day = check(
  await supabase.from('notifications').select('data_date').order('data_date', { ascending: false }).limit(1).maybeSingle(),
  'latest day',
)?.data_date;
if (!day) {
  console.log('digest: no notifications yet');
  process.exit(0);
}

const notes = await all(
  () =>
    supabase
      .from('notifications')
      .select('id, owner_id, kind, old_price, new_price, count, product_id, product:products(name), listing:competitor_listings(competitor_key)')
      .eq('data_date', day)
      .order('id'),
  'notifications',
);
const open = await all(
  () => supabase.from('products').select('id, owner_id, price_status').in('price_status', ['at-risk', 'opportunity']).order('id'),
  'products',
);
const byOwner = Map.groupBy(notes, (n) => n.owner_id);
const statuses = Map.groupBy(open, (p) => `${p.owner_id} ${p.price_status}`);

const users = [];
for (let page = 1; ; page++) {
  const { users: batch } = check(await supabase.auth.admin.listUsers({ page, perPage: 1000 }), 'users');
  users.push(...batch);
  if (batch.length < 1000) break;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const url = (path) => `${SITE_URL}${path}`;

function email(user, items) {
  const lang = DICTS[user.user_metadata?.lang] ? user.user_metadata.lang : 'bg';
  const dict = DICTS[lang];
  const t = dict.digest;
  const name = user.user_metadata?.username || user.email.split('@')[0];
  const atRisk = statuses.get(`${user.id} at-risk`)?.length ?? 0;
  const opportunity = statuses.get(`${user.id} opportunity`)?.length ?? 0;
  const date = new Intl.DateTimeFormat(lang === 'bg' ? 'bg-BG' : 'en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(day));
  // One line per sentence: a chain can drop a product under two listing codes.
  const all = [
    ...new Map(
      items.map((n) => {
        const text = notificationText(n, dict.notifications, lang);
        return [text, { text, href: url(n.product_id ? `/dashboard/products/${n.product_id}` : '/dashboard'), alert: n.kind === 'undercut' }];
      }),
    ).values(),
  ];
  const shown = all.slice(0, MAX_ITEMS);
  const more = all.length - shown.length;
  const subject = fill(all.length === 1 ? t.subjectOne : t.subject, { n: all.length, date });
  const summary = atRisk || opportunity ? fill(t.summary, { atRisk, opportunity }) : t.summaryClear;
  const lines = [
    fill(t.greeting, { name }),
    fill(t.intro, { date }),
    summary,
    ...shown.map((s) => `- ${s.text}\n  ${s.href}`),
    more > 0 ? `${fill(t.more, { n: more })}: ${url('/dashboard/notifications')}` : '',
    `${t.open}: ${url('/dashboard')}`,
    `${t.footer} ${url('/dashboard/settings#emails')}`,
  ];
  // Inline styles and one column: mail clients ignore stylesheets and most layout.
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;padding:24px 16px;background:#f5f5f4;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1c1917;font-size:16px;line-height:1.5">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px">
<p style="margin:0 0 4px;font-size:13px;color:#78716c">PriceAI · ${esc(date)}</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.25">${esc(subject)}</h1>
<p style="margin:0 0 16px">${esc(fill(t.greeting, { name }))} ${esc(summary)}</p>
<ul style="margin:0 0 16px;padding:0;list-style:none">
${shown.map((s) => `<li style="margin:0;padding:10px 0;border-top:1px solid #e7e5e4"><a href="${esc(s.href)}" style="color:${s.alert ? '#b91c1c' : '#1c1917'};text-decoration:none">${esc(s.text)}</a></li>`).join('\n')}
</ul>
${more > 0 ? `<p style="margin:0 0 16px"><a href="${esc(url('/dashboard/notifications'))}" style="color:#1c1917">${esc(fill(t.more, { n: more }))}</a></p>` : ''}
<p style="margin:0 0 8px"><a href="${esc(url('/dashboard'))}" style="display:inline-block;padding:12px 20px;background:#1c1917;color:#fff;border-radius:999px;text-decoration:none;font-weight:600">${esc(t.open)}</a></p>
</div>
<p style="max-width:560px;margin:16px auto 0;font-size:13px;color:#78716c">${esc(t.footer)} <a href="${esc(url('/dashboard/settings#emails'))}" style="color:#78716c">${esc(t.settings)}</a></p>
</body></html>`;
  return { from: FROM, to: [user.email], subject, html, text: lines.filter(Boolean).join('\n\n') };
}

const due = users.filter(
  (u) => u.email && u.email_confirmed_at && byOwner.has(u.id) && u.user_metadata?.digest !== false && u.app_metadata?.digest_date !== day,
);
if (DRY) {
  for (const u of due) console.log(`${u.email}: ${email(u, byOwner.get(u.id)).subject}`);
  if (due[0]) console.log(`\n${email(due[0], byOwner.get(due[0].id)).text}`);
  console.log(`digest ${day} (dry): ${due.length} due, ${byOwner.size} merchants with changes`);
  process.exit(0);
}

let sent = 0;
let failed = 0;
for (let i = 0; i < due.length; i += BATCH) {
  const group = due.slice(i, i + BATCH);
  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 
      // Same day and recipients → Resend drops the resend (24 h), in case marking failed.
      'Idempotency-Key': `digest-${day}-${createHash('sha256').update(group.map((u) => u.id).join()).digest('hex').slice(0, 32)}`,
    },
    body: JSON.stringify(group.map((u) => email(u, byOwner.get(u.id)))),
  });
  if (!res.ok) {
    console.error(`digest: batch ${i / BATCH + 1} failed: ${res.status} ${await res.text()}`);
    failed += group.length;
    continue;
  }
  // Mark after sending, so a failed batch is retried on the next run.
  for (const u of group) {
    const { error } = await supabase.auth.admin.updateUserById(u.id, { app_metadata: { digest_date: day } });
    if (error) console.error(`digest: could not mark ${u.id}: ${error.message}`);
  }
  sent += group.length;
}

console.log(`digest ${day}: sent ${sent}, failed ${failed}, ${byOwner.size} merchants with changes`);
if (failed && !sent) process.exit(1);
