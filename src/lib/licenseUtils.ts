/**
 * Client-side license key helpers.
 * Validation is server-side only (SALT never in client).
 * These helpers only deal with key formatting / masking / status display.
 */

/** Expected format: xxxxxxxx-xxxxxxxx-xxxxxxxx  (26 chars, lowercase hex) */
export function isWellFormedKey(key: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}$/.test(key.trim().toLowerCase());
}

/** Mask the key for display: abcd1234-••••••••-efgh5678 */
export function maskLicenseKey(key: string): string {
  const parts = key.split('-');
  if (parts.length !== 3) return key;
  return `${parts[0]}-${'•'.repeat(8)}-${parts[2]}`;
}

/** Display label for license_status value */
export function licenseStatusLabel(status: string): string {
  switch (status) {
    case 'active':   return 'සක්‍රිය ✓';
    case 'expired':  return 'කාලය ඉකුත් ✗';
    case 'inactive': return 'සක්‍රිය නොවේ';
    default:         return 'නොදනී';
  }
}

/** Tailwind colour classes for each status badge */
export function licenseStatusClass(status: string): string {
  switch (status) {
    case 'active':   return 'bg-green-600 text-white';
    case 'expired':  return 'bg-destructive text-destructive-foreground';
    default:         return 'bg-muted text-muted-foreground';
  }
}
