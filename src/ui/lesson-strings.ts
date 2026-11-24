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
  pathNext: 'Học tiếp',
  pathLearned: 'đã học',
  pathStart: 'Bắt đầu',
  pathReview: 'Ôn lại',
  pathClose: 'Đóng',
  pathTrophy: 'Hoàn thành chặng',
} as const;

/** Stage card heading on the Học path, e.g. "Chặng 2 · Mời hẹn" ("Chặng 2" when title is empty). */
export function pathStageHeading(position: number, title: string): string {
  return title === '' ? `Chặng ${position}` : `Chặng ${position} · ${title}`;
}

/** Stage progress on the Học path, e.g. "3/12 bài". */
export function pathStageCount(learned: number, total: number): string {
  return `${learned}/${total} bài`;
}

/** Lesson popup facts, e.g. "+10 XP · 5 câu". */
export function pathLessonFacts(xp: number, questions: number): string {
  return `+${xp} XP · ${questions} câu`;
}

/** Trophy popup text. */
export function pathTrophyBody(learned: number, total: number, stageTitle: string): string {
  return learned >= total
    ? `Bạn đã học hết ${total} bài của chặng ${stageTitle}.`
    : `Học hết ${total} bài của chặng ${stageTitle} để cúp sáng lên. Bạn đã học ${learned}/${total} bài.`;
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
