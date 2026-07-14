/**
 * Category colour palette — the swatches offered in the category colour picker,
 * taken from the J&L design. Curated to stay legible on the dark surfaces: a
 * category's colour is used as text, border, and background tint on its chip.
 *
 * Categories store an arbitrary hex string (validated by `categoryCreateSchema`),
 * so a colour outside this list is legal — the picker just doesn't offer one.
 */
export const CATEGORY_PALETTE = [
  "#3b9eff", // blue
  "#5aa3ff",
  "#2f6fe0",
  "#9b87f5", // violet
  "#b06bd6",
  "#3fbf8f", // green / teal
  "#2fb6b6",
  "#fb7215", // brand orange
  "#e0a23a",
  "#c9b458",
  "#e85b87", // pink / red
  "#e0484d",
  "#7c8794", // neutral / sage
  "#5b8a72",
] as const;

/**
 * Colour to pre-select for a new category. Walking the palette by the current
 * category count means back-to-back creates don't all land on the same blue.
 */
export function suggestCategoryColor(existingCount: number): string {
  return CATEGORY_PALETTE[existingCount % CATEGORY_PALETTE.length];
}
