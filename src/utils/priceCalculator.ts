/**
 * Centralized pricing configuration based on exhibition floors.
 * Update these values here to apply changes across the entire application.
 */
export const FLOOR_PRICES: Record<string, { adult: number; student: number; child: number }> = {
  'Floor 6/7': { adult: 100_000, student: 50_000, child: 25_000 },
  'Floor 5': { adult: 40_000, student: 20_000, child: 10_000 },
  'Floor 1': { adult: 60_000, student: 40_000, child: 20_000 }
};

/**
 * Calculates the aggregate unit price per age category based on the selected floors.
 * * @example
 * // Returns { adult: 100000, student: 60000, child: 30000 }
 * calculateAggregatePrices(['Floor 1', 'Floor 5'])
 *
 * @param selectedFloors - Array of selected floor IDs.
 * @returns An object containing the combined price for adult, student, and child.
 */
export function calculateAggregatePrices(selectedFloors: string[]) {
  let adult = 0, student = 0, child = 0;
  
  selectedFloors.forEach(floor => {
    const prices = FLOOR_PRICES[floor];
    if (prices) {
      adult += prices.adult;
      student += prices.student;
      child += prices.child;
    }
  });

  return { adult, student, child };
}

/**
 * Calculates the final grand total for the transaction.
 *
 * @param counts - The number of visitors in each category.
 * @param aggregatePrices - The combined unit price per category based on selected floors.
 * @returns Total price in IDR.
 */
export function calculateTotalPrice(
  counts: { adult: number; student: number; child: number },
  aggregatePrices: { adult: number; student: number; child: number }
): number {
  return (
    (counts.adult * aggregatePrices.adult) +
    (counts.student * aggregatePrices.student) +
    (counts.child * aggregatePrices.child)
  );
}

/**
 * Formats a numeric amount as an Indonesian Rupiah (IDR) currency string.
 *
 * @param amount - The amount in IDR.
 * @returns A formatted string, e.g. `"Rp 25.000"`.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}