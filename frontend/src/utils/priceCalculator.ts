/**
 * Ticket prices in Indonesian Rupiah (IDR), grouped by visitor age category.
 * Update these values here to apply changes across the entire application.
 */
export const PRICES = {
  /** Children under 8 years old */
  UNDER_8: 25_000,
  /** Teenagers under 22 years old */
  UNDER_22: 50_000,
  /** Adults aged 22 and above */
  ADULT: 100_000,
} as const;

/**
 * Calculates the total ticket price for a group of visitors.
 *
 * @param under8Count  - Number of children under 8 years old.
 * @param under22Count - Number of teenagers under 22 years old.
 * @param adultCount   - Number of adults aged 22 and above.
 * @returns Total price in IDR.
 */
export function calculateTotalPrice(
  under8Count: number,
  under22Count: number,
  adultCount: number
): number {
  return (
    under8Count * PRICES.UNDER_8 +
    under22Count * PRICES.UNDER_22 +
    adultCount * PRICES.ADULT
  );
}

/**
 * Formats a numeric amount as an Indonesian Rupiah (IDR) currency string.
 *
 * @param amount - The amount in IDR.
 * @returns A formatted string, e.g. `"Rp 25.000"`.
 *
 * @example
 * formatCurrency(25_000); // "Rp 25.000"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}