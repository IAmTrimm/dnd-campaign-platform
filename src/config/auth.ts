// Username rules shared by the website and the DM's account script.
//
// Supabase Auth needs an email address for every login, but players only ever
// see a username. Each username maps to an address on the ".invalid" top-level
// domain, which is permanently reserved (RFC 2606 / RFC 6761) and can never
// exist, so no email can ever be delivered to anyone.

export const LOGIN_EMAIL_DOMAIN = 'dnd-campaign-platform.invalid'

export const USERNAME_RULES = '3-32 characters: lowercase letters, numbers and underscores'

export function normaliseUsername(input: string): string {
  return input.trim().toLowerCase()
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_]{3,32}$/.test(username)
}

export function usernameToLoginEmail(username: string): string {
  return `${normaliseUsername(username)}@${LOGIN_EMAIL_DOMAIN}`
}

// The login box accepts a username, or an email for accounts created with one
// (such as the original DM account).
export function loginIdentifierToEmail(identifier: string): string {
  const value = identifier.trim()
  return value.includes('@') ? value.toLowerCase() : usernameToLoginEmail(value)
}

export const MIN_PASSWORD_LENGTH = 12
