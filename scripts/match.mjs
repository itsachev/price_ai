// npm run match: match every merchant product to competitor listings with
// Gemini (cached, batched, throttled), refresh price statuses and record each
// merchant's daily snapshot for Reports. Stopping when Gemini is out of quota
// or overloaded is not a failure: the next run resumes from the verdict cache.
import { createAdminClient } from '../src/lib/supabase/admin.js';
import { matchConfig, runMatch } from '../src/lib/pipeline/match.js';

const supabase = createAdminClient();
const config = matchConfig();
const r = await runMatch(supabase, { config });
console.log(`judged ${r.judged}/${r.pending} pairs in ${r.requests} requests`);
if (r.stopped) console.log(`stopped early: ${r.stopped}`);
console.log('statuses:', r.counts);

const { data, error } = await supabase.rpc('record_snapshots', { active_days: config.activeDays });
if (error) throw new Error(`record_snapshots: ${error.code} ${error.message}`, { cause: error });
console.log(`snapshots: ${data} merchants`);
