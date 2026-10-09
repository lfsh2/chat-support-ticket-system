// Grant and revoke hub access from the terminal, until the admin Members screen exists.
//
//   pnpm hub list
//   pnpm hub grant  client@email.com coachos ["Display Name"]   # or alive_free — lets them sign in
//   pnpm hub revoke client@email.com coachos
//   pnpm hub staff  sammi@aliveandfreeconsulting.com owner ["Sammi"]   # agent | admin | owner
//   pnpm hub name   client@email.com "New Name"
//   pnpm hub link   client@email.com     # one-time sign-in link, no email needed (expires in 1 hour)
//
// Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_APP_URL from
// .env.production.local (or the environment). Always prints which project it's about to change.

import { createClient } from "@supabase/supabase-js";

const PROGRAMS = ["coachos", "alive_free"];
const ROLES = ["member", "agent", "admin", "owner"];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\nPut them in .env.production.local (never commit it).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const [command, rawEmail, arg, ...rest] = process.argv.slice(2);
const displayName = (command === "name" ? [arg, ...rest] : rest).join(" ").trim() || null;
const email = rawEmail?.trim().toLowerCase();
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};
const needEmail = () => (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : fail("Give a valid email address."));

console.log(`Supabase project: ${url}\n`);

/** Makes sure an auth user (and so a profile, via trigger) exists for this email; sets the name if given. */
async function ensureUser(address, name = null) {
  const { data: existing } = await db.from("profiles").select("id").eq("email", address).maybeSingle();
  if (existing) {
    if (name) {
      const { error } = await db.from("profiles").update({ display_name: name }).eq("id", existing.id);
      if (error) fail(error.message);
    }
    return existing.id;
  }
  const { data, error } = await db.auth.admin.createUser({
    email: address,
    email_confirm: true,
    user_metadata: name ? { display_name: name } : {},
  });
  if (error) fail(`Couldn't create the account: ${error.message}`);
  return data.user.id;
}

switch (command) {
  case "list": {
    const [{ data: staff }, { data: members }] = await Promise.all([
      db.from("profiles").select("email, display_name, role").neq("role", "member").order("role"),
      db.from("memberships").select("email, program, status, source").order("email"),
    ]);
    console.log("Team:");
    for (const s of staff ?? []) console.log(`  ${s.role.padEnd(6)}  ${s.email}`);
    console.log("\nMemberships:");
    for (const m of members ?? []) console.log(`  ${m.status.padEnd(9)} ${m.program.padEnd(10)} ${m.email}  (${m.source})`);
    break;
  }
  case "grant": {
    needEmail();
    if (!PROGRAMS.includes(arg)) fail(`Program must be one of: ${PROGRAMS.join(", ")}`);
    const { error } = await db
      .from("memberships")
      .upsert({ email, program: arg, status: "manual", source: "manual", grace_until: null }, { onConflict: "email,program" });
    if (error) fail(error.message);
    // With a name, create the account now so it shows up properly before their first sign-in.
    if (displayName) await ensureUser(email, displayName);
    console.log(`✓ ${email} can now sign in to ${arg}. They sign in at /login with this email.`);
    break;
  }
  case "revoke": {
    needEmail();
    if (!PROGRAMS.includes(arg)) fail(`Program must be one of: ${PROGRAMS.join(", ")}`);
    const { data, error } = await db
      .from("memberships")
      .update({ status: "canceled", grace_until: null })
      .eq("email", email)
      .eq("program", arg)
      .select("id");
    if (error) fail(error.message);
    if (!data?.length) fail(`${email} has no ${arg} membership.`);
    console.log(`✓ ${email} no longer has ${arg} access (takes effect on their next page load).`);
    break;
  }
  case "staff": {
    needEmail();
    if (!ROLES.includes(arg)) fail(`Role must be one of: ${ROLES.join(", ")}`);
    const id = await ensureUser(email, displayName);
    const { error } = await db.from("profiles").update({ role: arg }).eq("id", id);
    if (error) fail(error.message);
    console.log(
      arg === "member" ? `✓ ${email} is no longer on the team.` : `✓ ${email} is now ${arg}. They sign in at /login with this email.`,
    );
    break;
  }
  case "name": {
    needEmail();
    if (!displayName) fail('Give the new name, e.g. pnpm hub name you@email.com "Your Name"');
    await ensureUser(email, displayName);
    console.log(`✓ ${email} now shows as "${displayName}".`);
    break;
  }
  case "link": {
    needEmail();
    const app = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    if (!app || !/^https?:\/\//.test(app)) fail("Set NEXT_PUBLIC_APP_URL (your live address) in .env.production.local first.");
    const { data: profile } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!profile) fail(`No account for ${email}. Create it first with grant or staff.`);
    const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
    if (error || !data.properties?.hashed_token) fail(`Couldn't make a link: ${error?.message ?? "unknown error"}`);
    const signIn = `${app}/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink&next=/dashboard`;
    console.log(`One-time sign-in link for ${email} (works once, expires in 1 hour — treat it like a password):\n\n${signIn}\n`);
    break;
  }
  default:
    console.log(`Usage:
  pnpm hub list
  pnpm hub grant  <email> <coachos|alive_free> ["Display Name"]
  pnpm hub revoke <email> <coachos|alive_free>
  pnpm hub staff  <email> <agent|admin|owner|member> ["Display Name"]
  pnpm hub name   <email> "Display Name"
  pnpm hub link   <email>`);
}
