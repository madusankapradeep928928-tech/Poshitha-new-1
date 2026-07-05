/**
 * Shared utility helpers for unit-aware quantity handling.
 * Used by BillingPage (POS) and ProductsPage (inventory).
 */

/** Units that require fractional / decimal quantities */
export const FLOAT_UNITS = new Set([
  'kg', 'g', 'l', 'ltr', 'ml', 'm', 'cm',
  'litre', 'liter', 'gram', 'kilo',
]);

/** True when the unit supports fractional quantities (kg, L, ml, m …) */
export function isFloatUnit(unit: string): boolean {
  return FLOAT_UNITS.has(unit.toLowerCase());
}

/** Qty increment step for +/- buttons — 0.1 for weight/volume, 1 for discrete */
export function qtyStep(unit: string): number {
  return isFloatUnit(unit) ? 0.1 : 1;
}

/** Minimum sellable qty — 0.001 for weight/volume, 1 for discrete */
export function minQty(unit: string): number {
  return isFloatUnit(unit) ? 0.001 : 1;
}

/** HTML input `step` attribute string — fine-grained for float units */
export function inputStep(unit: string): string {
  return isFloatUnit(unit) ? '0.001' : '1';
}

/**
 * Format a qty value for display.
 * - Float units: show at least 1 decimal (e.g. 2.0 kg), strip trailing zeros beyond that
 * - Integer units: show as whole number
 */
export function fmtQty(qty: number, unit: string): string {
  if (isFloatUnit(unit)) {
    // Always show at least 1 decimal place; trim extra trailing zeros
    const s = qty.toFixed(3).replace(/0+$/, '');
    return s.endsWith('.') ? s + '0' : s;
  }
  return qty.toString();
}
