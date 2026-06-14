/**
 * Secret settings keys and the redaction sentinel.
 *
 * GET /api/settings replaces each configured secret's value with
 * {@link SECRET_SENTINEL} (and sets `<key>Configured: true`) so raw provider
 * keys never travel to the browser. POST /api/settings treats an incoming
 * sentinel as "leave the stored value unchanged", which lets the settings form
 * round-trip without wiping keys the user didn't retype.
 */
export const SECRET_KEYS = [
  "anthropicApiKey",
  "openaiApiKey",
  "googleApiKey",
  "speechSuperApiKey",
  "speechSuperAppId",
  "elsaApiKey",
  "azureSpeechKey",
  "tavilyApiKey",
  "braveApiKey",
] as const;

export type SecretKey = (typeof SECRET_KEYS)[number];

const SECRET_KEY_SET: ReadonlySet<string> = new Set(SECRET_KEYS);

export function isSecretKey(key: string): key is SecretKey {
  return SECRET_KEY_SET.has(key);
}

/**
 * Opaque marker returned in place of a configured secret. Chosen to be a value
 * no real API key would ever equal.
 */
export const SECRET_SENTINEL = "__luminate_secret_set__";
