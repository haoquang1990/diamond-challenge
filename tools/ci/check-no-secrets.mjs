// Fails when a Supabase secret could ship with the app (story 019).
// Looks in the given files/folders for `sb_secret_…` keys and for JWTs whose role is not
// `anon` (a legacy service_role key). Usage: node tools/ci/check-no-secrets.mjs src dist .env.production
import fs from 'node:fs';
import path from 'node:path';

const SECRET_KEY = /sb_secret_[A-Za-z0-9_-]{8,}/g;
const JWT = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

function* files(target) {
  if (!fs.existsSync(target)) return;
  if (fs.statSync(target).isFile()) return yield target;
  for (const entry of fs.readdirSync(target)) yield* files(path.join(target, entry));
}

function jwtRole(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).role;
  } catch {
    return undefined;
  }
}

const problems = [];
for (const target of process.argv.slice(2)) {
  for (const file of files(target)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(SECRET_KEY)) problems.push(`${file}: secret key ${m[0].slice(0, 14)}…`);
    for (const m of text.matchAll(JWT)) {
      const role = jwtRole(m[0]);
      if (role !== 'anon') problems.push(`${file}: JWT with role ${String(role)}`);
    }
  }
}
if (problems.length > 0) {
  for (const p of problems) console.error(`::error::${p}`);
  process.exit(1);
}
console.log('No Supabase secret found.');
