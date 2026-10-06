/** Master accounts (same list as the Wallet). The profile flag `is_owner` is set from this at signup. */
export function ownerEmails(): string[] {
  const env = (process.env.OWNER_EMAILS ?? "awad@apixis.dev,alaidaroosawad@gmail.com").split(",");
  return env.map((e) => e.trim().toLowerCase()).filter(Boolean);
}
export function isOwnerEmail(email: string | null | undefined): boolean {
  return Boolean(email && ownerEmails().includes(email.toLowerCase()));
}
