/**
 * Master admins. The database copy is `public.master_admins` (migration 003), which is
 * what sets `profiles.is_owner`. This list is the app-side mirror. The support mailbox
 * is never an admin.
 */
export const SUPPORT_EMAIL = "newsxis@apixis.dev";

export const MASTER_ADMIN_EMAILS = ["alaidaroosawad@gmail.com", "awad@apixis.dev"] as const;

const ALLOWED = new Set<string>(MASTER_ADMIN_EMAILS);

export function ownerEmails(): string[] {
  const fromEnv = (process.env.OWNER_EMAILS ?? MASTER_ADMIN_EMAILS.join(","))
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0 && e !== SUPPORT_EMAIL && ALLOWED.has(e));
  return fromEnv.length > 0 ? fromEnv : [...MASTER_ADMIN_EMAILS];
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  return Boolean(email && ownerEmails().includes(email.toLowerCase()));
}
