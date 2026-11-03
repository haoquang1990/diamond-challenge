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
  back: 'Quay lại',

  // Navigation (bottom tab bar)
  navLabel: 'Điều hướng chính',
  tabToday: 'Hôm nay',
  tabLearn: 'Học',
  tabDo: 'Làm',
  tabPath: 'Con đường',

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
  settingsTitle: 'Cài đặt nhắc nhở',
  settingsPrompt: 'Nhắc bạn hoàn thành mục tiêu ngày, chỉ khi hôm nay chưa đạt.',
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
