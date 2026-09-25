// npm run match: match every merchant product to competitor listings with
// Gemini (cached, batched, throttled) and refresh price statuses. Stopping when
// Gemini is out of quota or overloaded is not a failure: the next run resumes
// from the verdict cache.
import { createAdminClient } from '../src/lib/supabase/admin.js';
import { runMatch } from '../src/lib/pipeline/match.js';

const r = await runMatch(createAdminClient());
console.log(`judged ${r.judged}/${r.pending} pairs in ${r.requests} requests`);
if (r.stopped) console.log(`stopped early: ${r.stopped}`);
console.log('statuses:', r.counts);
