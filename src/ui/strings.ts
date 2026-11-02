/** Player-facing Vietnamese strings for the UI. No i18n framework at MVP. */
export const STRINGS = {
  logActivityTitle: 'Làm',
  logActivityPrompt: 'Hôm nay bạn đã làm gì?',
  noActivityTypes: 'Chưa có loại hoạt động nào. Hãy thêm vào file cấu hình.',
  noteLabel: 'Ghi chú (không bắt buộc)',
  notePlaceholder: 'Vd. tên khách, nội dung trao đổi…',
  save: 'Lưu',
  saving: 'Đang lưu…',
  pickFirst: 'Chọn một hoạt động',
  savedTitle: 'Tuyệt vời!',
  undo: 'Hoàn tác',
  undoing: 'Đang hoàn tác…',
  continue: 'Tiếp tục',
  saveError: 'Không lưu được. Thử lại nhé.',
  undoError: 'Không hoàn tác được. Thử lại nhé.',
  undone: 'Đã hoàn tác. Bạn có thể chọn lại.',
} as const;

/** Formats an XP amount, e.g. `xpLabel(15)` → "+15 XP". */
export function xpLabel(xp: number): string {
  return `+${xp} XP`;
}
