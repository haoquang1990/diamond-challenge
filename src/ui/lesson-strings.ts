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
  matchHint: 'Chạm một thẻ ở trên, rồi chạm thẻ ở dưới để ghép thành cặp. Muốn gỡ, chạm vào thẻ ở dưới đã ghép.',
  matchLeftLabel: 'Vế cần ghép',
  matchRightLabel: 'Vế để chọn',
  matchLinkAll: 'Ghép hết các cặp',
  matchCorrectPairsTitle: 'Cặp đúng:',
  stageComingSoon: 'Sắp có bài',
  stageOther: 'Khác',
} as const;

/** Numbered group heading, e.g. "2. Mời hẹn". */
export function stageHeading(position: number, title: string): string {
  return `${position}. ${title}`;
}

/** Group progress, e.g. "1/4 bài hôm nay". */
export function stageProgressLabel(learned: number, total: number, today: number): string {
  return today > 0 ? `Đã học ${learned}/${total} · hôm nay ${today}` : `Đã học ${learned}/${total}`;
}

/** Under a lesson learned before: "Đã học 3 lần · gần nhất 22/11". */
export function lessonLearnedLabel(count: number, lastAt: string): string {
  const d = new Date(lastAt);
  const date = Number.isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return date === '' ? `Đã học ${count} lần` : `Đã học ${count} lần · gần nhất ${date}`;
}

/** Accessible label of an empty slot, e.g. "Ô 2, còn trống". */
export function orderEmptySlotLabel(position: number): string {
  return `Ô ${position}, còn trống`;
}
