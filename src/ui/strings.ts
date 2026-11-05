/** Player-facing Vietnamese strings for the UI. No i18n framework at MVP. */
export const STRINGS = {
  noteLabel: 'Ghi chú (FORMHD)',
  save: 'Lưu',
  saving: 'Đang lưu…',
  pickFirst: 'Chọn một hoạt động',
  undo: 'Hoàn tác',
  back: 'Quay lại',

  // Navigation (bottom tab bar)
  navLabel: 'Điều hướng chính',
  tabToday: 'Hôm nay',
  tabLearn: 'Học',
  tabPath: 'Con đường',
  tabPeople: 'Làm',

  // Hôm nay
  todayTitle: 'Hôm nay',
  loading: 'Đang tải…',
  loadError: 'Không tải được tiến độ. Thử lại nhé.',
  retry: 'Thử lại',
  welcomeTitle: 'Chào mừng bạn!',
  welcomeBody: 'Mỗi ngày: 1 bài Học + 1 việc Làm và đủ XP để giữ chuỗi ngày.',
  goalTitle: 'Mục tiêu hôm nay',
  goalMetTitle: 'Đã đạt mục tiêu hôm nay!',
  goalMetBody: 'Quay lại ngày mai để giữ chuỗi nhé.',
  stillNeeded: 'Còn thiếu',
  lessonDone: 'Đã có bài Học',
  lessonMissing: 'còn 1 bài Học',
  activityDone: 'Đã có việc Làm',
  activityMissing: 'còn 1 việc Làm',
  learnButton: 'Học',
  doButton: 'Làm',
  currentStage: 'Chặng hiện tại',
  stagePending: 'Bản đồ Con đường Diamond sắp có',

  // Học (lessons)
  lessonListTitle: 'Học',
  lessonListPrompt: 'Chọn một bài ngắn, khoảng 2 phút.',
  lessonDoneToday: 'Đã học hôm nay',
  lessonErrorTitle: 'Không mở được bài học',
  lessonErrorBody: 'File bài học bị hỏng hoặc đang trống. Hãy kiểm tra src/content/lessons.json.',
  lessonSkippedNote: 'Một số bài bị lỗi nên đã được bỏ qua.',
  lessonCorrect: 'Đúng rồi!',
  lessonWrong: 'Chưa đúng',
  lessonNext: 'Tiếp',
  lessonFinish: 'Hoàn thành',
  lessonCheckAnswer: 'Chọn một đáp án',
  lessonFinishing: 'Đang lưu…',
  lessonSaveError: 'Không lưu được bài học. Thử lại nhé.',
  lessonCompleteTitle: 'Hoàn thành bài học!',
  lessonRepeatNote: 'Bạn đã học bài này hôm nay, không cộng XP lần nữa.',
  lessonBackToList: 'Về danh sách',
  lessonLeave: 'Thoát bài',

  // Con đường (story 006)
  pathTitle: 'Con đường',
  pathPrompt: 'Từng chặng trên hành trình của bạn.',
  pathDisclaimer: 'Đây là lộ trình thói quen, không phải xác nhận danh hiệu chính thức của Amway.',
  pathLoadError: 'Không tải được Con đường. Thử lại nhé.',
  pathNoStages: 'Chưa có chặng nào. Hãy kiểm tra src/config/game-config.json.',
  stageDone: 'Đã qua',
  stageCurrent: 'Chặng hiện tại',
  stageLocked: 'Chưa mở khóa',
  stageConditions: 'Điều kiện mở khóa',
  stageReached: 'Đã đạt',
  stageLastReached: 'Bạn đã tới chặng cuối. Giữ vững thói quen nhé!',
  stageXpMetMilestoneMissing: 'Đủ XP, còn thiếu mốc hoạt động',
  stageContinue: 'Tiếp tục',
  stageNeed: 'Còn thiếu',

  // Nhắc nhở (story 007)
  reminderButton: 'Nhắc nhở',
  reminderButtonLabel: 'Mở cài đặt nhắc nhở',
  settingsTitle: 'Cài đặt',
  settingsPrompt: 'Nhắc bạn hoàn thành mục tiêu ngày, chỉ khi hôm nay chưa đạt.',
  backupHeading: 'Sao lưu và khôi phục',
  backupWarning:
    'Lưu ý: file sao lưu chứa tên, số điện thoại và ghi chú về người khác. Hãy giữ file cẩn thận, đừng gửi cho người lạ.',
  backupExport: 'Xuất sao lưu',
  backupImport: 'Nhập từ file',
  backupBusy: 'Đang xử lý…',
  backupExported: 'Đã xuất file sao lưu. Hãy cất file ở nơi an toàn.',
  backupExportError: 'Không xuất được file sao lưu. Thử lại nhé.',
  backupImportError: 'Không nhập được file. Dữ liệu hiện tại không đổi. Thử lại nhé.',
  backupRejectNotJson: 'Đây không phải file JSON. Dữ liệu hiện tại không đổi.',
  backupRejectFormat: 'File này không phải file sao lưu của Diamond Challenge. Dữ liệu hiện tại không đổi.',
  backupRejectVersion: 'File sao lưu có phiên bản lạ, app chưa đọc được. Dữ liệu hiện tại không đổi.',
  backupRejectEvents: 'File sao lưu bị hỏng (thiếu danh sách sự kiện). Dữ liệu hiện tại không đổi.',
  backupImportDone: (added: number, skipped: number) => `Đã thêm ${added}, bỏ qua ${skipped}.`,
  backupImportInvalid: (invalid: number) => `Trong đó ${invalid} sự kiện hỏng đã bị bỏ qua.`,
  reminderToggle: 'Nhắc mỗi ngày',
  reminderTimeLabel: 'Giờ nhắc',
  reminderSaving: 'Đang lưu…',
  reminderSaved: 'Đã lưu.',
  reminderSaveError: 'Không lưu được cài đặt. Thử lại nhé.',
  settingsLoadError: 'Không tải được cài đặt. Thử lại nhé.',
  permissionHeading: 'Thông báo trên điện thoại',
  permissionGranted: 'Đã cho phép thông báo.',
  permissionDenied: 'Thông báo đang bị chặn. Bạn có thể bật lại trong cài đặt trình duyệt hoặc điện thoại.',
  permissionDefault: 'Chưa cho phép thông báo. Bật nhắc nhở để được hỏi.',
  permissionDefaultEnabled: 'Bạn chưa trả lời yêu cầu cho phép thông báo. Tắt rồi bật lại nhắc nhở để được hỏi lại.',
  permissionUnsupported: 'Trình duyệt hoặc điện thoại này không hỗ trợ thông báo của app.',
  permissionFallback: 'App vẫn sẽ nhắc bạn bằng banner trên màn Hôm nay khi bạn mở app.',
  reminderDisclaimer:
    'Lưu ý: nhắc nhở khi app đang đóng chưa được đảm bảo trên mọi điện thoại. Trên iPhone/iPad cần thêm app vào Màn hình chính. Chắc chắn nhất là banner trong app.',
  reminderDueTitle: 'Đến giờ rồi!',
  reminderNoticeOff: 'Thông báo bị tắt, app sẽ nhắc bạn ngay trong app.',
  reminderNotificationTitle: 'Diamond Challenge',

  // Làm = danh bạ (story 009, 013, 015)
  peopleTitle: 'Làm',
  peoplePrompt: 'Chọn một người để làm việc tiếp theo.',
  peopleLoadError: 'Không tải được danh sách người. Thử lại nhé.',
  searchLabel: 'Tìm tên',
  searchPlaceholder: 'Tìm tên…',
  searchNoMatch: 'Không tìm thấy ai có tên này.',
  peopleEmptyTitle: 'Chưa có ai trong danh sách',
  peopleEmptyBody: 'Hãy thêm người đầu tiên bạn quen. Bắt đầu bằng một cái tên, thế là đủ.',
  filterAll: 'Tất cả',
  filterKh: 'Khách hàng',
  filterNpp: 'NPP',
  filterArchived: 'Đã lưu trữ',
  filterBarLabel: 'Lọc danh bạ',
  emptyAllTitle: 'Chưa có ai trong danh bạ của bạn',
  emptyKhBody: 'Chưa có khách hàng nào. Mở một người và bấm "Chốt khách hàng" khi họ mua.',
  emptyNppBody: 'Chưa có NPP nào. Mở một người và bấm "Chốt NPP" khi họ tham gia đội nhóm.',
  emptyArchivedBody: 'Chưa có ai được lưu trữ.',
  labelKh: 'KH',
  labelNpp: 'NPP',
  restore: 'Khôi phục',
  restoreError: 'Không khôi phục được. Thử lại nhé.',
  addPersonToggleOpen: 'Thêm người',
  addPersonToggleClose: 'Thu gọn',
  phoneCountryLabel: 'Mã nước',
  phoneNumberLabel: 'Số điện thoại',
  phonePlaceholder: 'Vd. 912345678',
  phoneUnknownCountry: 'Mã nước không hợp lệ.',
  phoneNotDigits: 'Số điện thoại chỉ gồm chữ số.',
  phoneBadLength: 'Số điện thoại cần từ 6 đến 15 chữ số.',
  activitySectionTitle: 'Hoạt động',
  activityNoneLeft: 'Đã làm hết các việc. Giỏi lắm!',
  historyTitle: 'Lịch sử',
  historyEmpty: 'Chưa có hoạt động nào.',
  taskUndone: 'Đã hoàn tác việc vừa làm.',
  personDetailPhone: 'Số điện thoại',
  addPersonTitle: 'Thêm người',
  addPersonButton: 'Thêm người',
  boardOpen: 'Bảng 30x30',
  boardTitle: 'Bảng 30x30',
  boardPrompt: 'Tiến độ danh sách của bạn.',
  boardLoadError: 'Không tải được Bảng 30x30. Thử lại nhé.',
  boardContacts: 'Liên hệ',
  boardCustomers: 'Khách hàng',
  boardF1: 'NPP F1',
  boardBackFromContacts: 'Quay lại Bảng 30x30',
  boardOpenContactsHint: 'Mở tab Làm',
  boardAchieved: 'Đạt 30x30',
  boardContactsMet: 'Đã đạt mốc liên hệ',
  boardDisclaimer: 'Số liệu tính từ danh sách bạn tự nhập, không phải xác nhận chính thức.',
  boardEmptyBody: 'Chưa có ai trong danh sách. Thêm người đầu tiên để Bảng bắt đầu chạy.',
  boardGoPeople: 'Đến tab Làm',
  personNameLabel: 'Tên',
  personNamePlaceholder: 'Vd. Lan',
  personNameRequired: 'Hãy nhập tên.',
  personDuplicateWarning: 'Đã có người trùng tên này. Bạn vẫn có thể thêm.',
  personAddedXp: 'Đã thêm người',
  personSaveError: 'Không lưu được. Thử lại nhé.',
  personEditToggle: 'Sửa thông tin',
  personEditClose: 'Thu gọn',
  personSaveChanges: 'Lưu thay đổi',
  personSaved: 'Đã lưu.',
  personChangeStage: 'Đổi giai đoạn',
  personStageNoXp: 'không có XP',
  personArchive: 'Lưu trữ người này',
  personArchiveConfirmTitle: 'Lưu trữ người này?',
  personArchiveConfirmBody: 'Họ sẽ biến khỏi danh sách. XP bạn đã nhận vẫn được giữ.',
  personArchiveConfirm: 'Lưu trữ',
  cancel: 'Hủy',
  legacyTitle: 'Hoạt động chưa gắn người',
  legacyPrompt: 'Gắn mỗi hoạt động cho một người. XP không đổi.',
  legacyAssign: 'Gắn',
  legacyPickPerson: 'Chọn người',
  legacyUnknownPerson: 'Người không rõ',
  legacyUnknownActivity: 'Hoạt động',
  legacyNoPeople: 'Hãy thêm một người trước để gắn hoạt động.',

  // Placeholder screens
  comingSoon: 'Sắp có',
  comingSoonBody: 'Tính năng này đang được xây dựng.',
} as const;

/** Formats an XP amount, e.g. `xpLabel(15)` → "+15 XP". */
export function xpLabel(xp: number): string {
  return `+${xp} XP`;
}

/** XP still needed today, e.g. `xpRemainingLabel(12)` → "còn 12 XP". */
export function xpRemainingLabel(xp: number): string {
  return `còn ${xp} XP`;
}

/** XP progress toward the daily threshold, e.g. `xpProgressLabel(18, 30)` → "18 / 30 XP". */
export function xpProgressLabel(xp: number, threshold: number): string {
  return `${xp} / ${threshold} XP`;
}

/** Streak length, e.g. `streakLabel(3)` → "3 ngày liên tiếp". */
export function streakLabel(days: number): string {
  return `${days} ngày liên tiếp`;
}

/** Nudge shown while today's goal is open and a streak is at stake. */
export function keepStreakLabel(days: number): string {
  return `Hoàn thành hôm nay để giữ chuỗi ${days} ngày!`;
}

/** Question progress, e.g. `questionProgressLabel(2, 4)` → "Câu 2/4". */
export function questionProgressLabel(current: number, total: number): string {
  return `Câu ${current}/${total}`;
}

/** Lesson score, e.g. `scoreLabel(3, 4)` → "Đúng 3/4 câu". */
export function scoreLabel(correct: number, total: number): string {
  return `Đúng ${correct}/${total} câu`;
}

/** Celebration headline, e.g. "Bạn đã lên chặng Silver!". */
export function stageReachedLabel(name: string): string {
  return `Bạn đã lên chặng ${name}!`;
}

/** Progress toward the next stage, e.g. "42% tới Gold". */
export function stagePercentLabel(percent: number, nextName: string): string {
  return `${percent}% tới ${nextName}`;
}

/** Stage XP requirement, e.g. "Cần 300 XP". */
export function stageXpNeedLabel(xp: number): string {
  return `Cần ${xp} XP`;
}

/** Milestone count, e.g. "5 lần Khách hàng mới: 3/5". */
export function milestoneCountLabel(label: string, current: number, target: number): string {
  return `${label}: ${Math.min(current, target)}/${target}`;
}

/** What today's goal still needs; same shape as `ReminderMissing` in src/domain/reminders.ts. */
export interface ReminderMissingText {
  readonly xp: number;
  readonly lesson: boolean;
  readonly activity: boolean;
}

/**
 * Short reminder text with the current streak, e.g.
 * `reminderMessage(5, { xp: 0, lesson: true, activity: true })` →
 * "Giữ chuỗi 5 ngày nhé! Còn 1 bài Học và 1 việc Làm."
 * With no streak: "Bắt đầu chuỗi ngày ngay hôm nay nhé!"
 */
export function reminderMessage(streak: number, missing: ReminderMissingText): string {
  const head = streak > 0 ? `Giữ chuỗi ${streak} ngày nhé!` : 'Bắt đầu chuỗi ngày ngay hôm nay nhé!';
  const parts: string[] = [];
  if (missing.lesson) parts.push('1 bài Học');
  if (missing.activity) parts.push('1 việc Làm');
  if (missing.xp > 0) parts.push(`${missing.xp} XP`);
  if (parts.length === 0) return head;
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} và ${parts[parts.length - 1]}`;
  return `${head} Còn ${list}.`;
}

/** Person count in a stage group header, e.g. "Đã liên hệ (3)". */
export function stageGroupLabel(name: string, count: number): string {
  return `${name} (${count})`;
}

/** Stage-change XP preview: "+10 XP" or "không có XP". */
export function stageXpPreview(xp: number): string {
  return xp > 0 ? xpLabel(xp) : STRINGS.personStageNoXp;
}

/** Confirm-archive prompt title with the person's name. */
export function archivedLabel(name: string): string {
  return `Đã lưu trữ ${name}.`;
}

/** Contacts row detail, e.g. "Liên hệ gần nhất: 04/11/2026". */
export function lastContactLabel(iso: string): string {
  return `Liên hệ gần nhất: ${shortDateLabel(iso)}`;
}

/** NPP row detail, e.g. "Lên NPP: 04/11/2026". */
export function nppSinceLabel(iso: string): string {
  return `Lên NPP: ${shortDateLabel(iso)}`;
}

/** Filter chip text with count, e.g. "Khách hàng (3)". */
export function filterChipLabel(name: string, count: number): string {
  return `${name} (${count})`;
}

/** Legacy stage change shown read-only in history. */
export function historyStageLabel(stageName: string): string {
  return `Chuyển sang ${stageName}`;
}

/** Aria label for a task button, e.g. "Demo, +10 XP". */
export function taskButtonLabel(name: string, xp: number): string {
  return `${name}, ${xpLabel(xp)}`;
}

/** Short local date for a legacy activity row. */
export function shortDateLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN');
}

/** "Label x/target" progress text. */
export function boardCountLabel(label: string, count: number, target: number): string {
  return `${label} ${count}/${target}`;
}

/** What is still missing for 30x30, e.g. "còn 5 KH, còn 12 NPP F1". */
export function boardMissingLabel(customersMissing: number, f1Missing: number): string {
  const parts: string[] = [];
  if (customersMissing > 0) parts.push(`còn ${customersMissing} KH`);
  if (f1Missing > 0) parts.push(`còn ${f1Missing} NPP F1`);
  return parts.join(', ');
}
