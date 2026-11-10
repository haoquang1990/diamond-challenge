/**
 * User-facing text for lesson mini-games. Kept apart from the shared
 * `strings.ts` so lesson work does not collide with other features; same
 * shape and conventions as STRINGS.
 */
export const LESSON_STRINGS = {
  orderHint: 'Chạm các bước theo đúng thứ tự. Chạm lại một bước đã xếp để bỏ ra.',
  orderSlotsLabel: 'Thứ tự của bạn',
  orderPoolLabel: 'Các bước',
  orderCheck: 'Kiểm tra',
  orderPlaceAll: 'Xếp hết các bước',
  orderCorrectOrderTitle: 'Thứ tự đúng:',
} as const;

/** Accessible label of an empty slot, e.g. "Ô 2, còn trống". */
export function orderEmptySlotLabel(position: number): string {
  return `Ô ${position}, còn trống`;
}
