// app/utils/jewelry-pricing.js

/**
 * Parse weight from variant selectedOptions.
 *
 * @param {Array} selectedOptions - The variant's selectedOptions array
 * @param {string} specificOptionName - If provided, look for this exact option name.
 *   If empty/falsy, auto-detect common weight option names.
 */
export function parseWeightFromOptions(selectedOptions, specificOptionName = "") {
  if (!Array.isArray(selectedOptions)) return 0;

  let opt;

  if (specificOptionName && specificOptionName.trim()) {
    const target = specificOptionName.trim().toLowerCase();
    opt = selectedOptions.find((o) => {
      const name = (o?.name || "").toLowerCase().trim();
      return name === target;
    });
  } else {
    const commonNames = ["weight", "wt", "grams", "gram", "g", "gms"];
    opt = selectedOptions.find((o) => {
      const name = (o?.name || "").toLowerCase().trim();
      return commonNames.includes(name);
    });
  }

  if (!opt) return 0;

  const match = String(opt.value).match(/([\d.,]+)/);
  if (!match) return 0;

  const num = parseFloat(match[1].replace(",", ""));
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Parse a numeric weight value from a metafield value string.
 * Handles plain numbers, numbers with units, JSON structured types, etc.
 *
 * @param {string|number} value
 * @returns {number}
 */
export function parseWeightFromMetafieldValue(value) {
  if (value === null || value === undefined) return 0;

  if (typeof value === "number") {
    return Number.isNaN(value) ? 0 : value;
  }

  const str = String(value).trim();

  // Try parsing as JSON first (handles weight/measurement structured metafields)
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed === "number") return parsed;
    if (parsed && typeof parsed === "object") {
      if (parsed.value !== undefined) {
        const num = parseFloat(String(parsed.value));
        return Number.isNaN(num) ? 0 : num;
      }
    }
  } catch {
    // Not JSON, continue
  }

  // Extract first number from string
  const match = str.match(/([\d.,]+)/);
  if (!match) return 0;

  const num = parseFloat(match[1].replace(",", ""));
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Calculate price:
 *  newPrice = (weightValue * ratePerUnit) * (1 + percent/100)
 */
export function calculatePriceFromRate(weightGrams, ratePerGram, percent) {
  const w = Number(weightGrams || 0);
  const r = Number(ratePerGram || 0);
  const p = Number(percent || 0);

  const base = w * r;
  const result = base * (1 + p / 100);
  return Math.round(result * 100) / 100;
}

/**
 * Simple stats for the selected collections.
 */
export function summarizeSelectedCollections(selectedCollections) {
  const totalCollections = selectedCollections.length;
  const totalProducts = selectedCollections.reduce(
    (sum, c) => sum + (c.products?.length || 0),
    0
  );
  return { totalCollections, totalProducts };
}