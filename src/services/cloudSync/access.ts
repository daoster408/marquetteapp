export function normalizeDogfoodAccessEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase();
}

export function parseDogfoodAllowedEmails(value?: string | null): string[] {
  if (!value) return [];

  return [...new Set(
    value
      .split(',')
      .map(normalizeDogfoodAccessEmail)
      .filter(Boolean)
  )];
}

export function isEmailInDogfoodAllowlist(email: string | null | undefined, allowedEmails: string[]): boolean {
  const normalized = normalizeDogfoodAccessEmail(email);
  if (!normalized) return false;

  return allowedEmails.includes(normalized);
}
