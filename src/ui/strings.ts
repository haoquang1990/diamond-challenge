import { formatE164 } from '../domain/people';
import type { AuthFailure, PasswordProblem } from '../data/auth-service';
import type { SyncFailure } from '../data/contact-sync';

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
  reminderButton: 'Cài đặt',
  reminderButtonLabel: 'Mở Cài đặt',
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
  soundToggle: 'Âm thanh thưởng',
  soundSaveError: 'Không lưu được cài đặt âm thanh. Thử lại nhé.',

  // Achievements (toast, popup)
  toastLesson: 'Bài Học',
  toastActivity: 'Hoạt động',
  popupKicker: 'Thành tích mới',
  popupClose: 'Tuyệt vời!',
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
  filterKhShort: 'KH',
  filterSheetTitle: 'Lọc danh sách',
  filterKindGroup: 'Loại',
  filterOwnerGroup: 'Phụ trách',
  ownerAll: 'Tất cả',
  ownerMine: 'Của tôi',
  ownerSpouse: (name: string) => `Của ${name}`,
  ownerBothNote: 'Cả hai phụ trách: hiện ở cả hai danh sách.',
  ownerFilterAria: { all: '', mine: 'liên hệ của tôi', spouse: 'liên hệ của vợ/chồng' },
  ownerField: 'Phụ trách',
  ownerMe: 'Tôi',
  ownerBoth: 'Cả hai',
  ownerSpouseFallback: 'vợ/chồng',
  emptyAllTitle: 'Chưa có ai trong danh bạ của bạn',
  emptyKhBody: 'Chưa có khách hàng nào. Mở một người và bấm "Hoạt động" → "Bán hàng" khi họ mua.',
  emptyNppBody: 'Chưa có NPP nào. Mở một người và bấm "Hoạt động" → "Bảo trợ" khi họ tham gia đội nhóm.',
  emptyArchivedBody: 'Chưa có ai được lưu trữ.',
  labelKh: 'KH',
  labelNpp: 'NPP',
  restore: 'Khôi phục',
  restoreError: 'Không khôi phục được. Thử lại nhé.',
  addPersonToggleOpen: 'Thêm người',
  addPersonToggleClose: 'Thu gọn',
  phoneCountryLabel: 'Mã nước',
  phoneNumberLabel: 'Số điện thoại',
  phonePlaceholder: 'Vd. 912 345 678',
  phoneUnknownCountry: 'Mã nước không hợp lệ.',
  phoneNotDigits: 'Số điện thoại chỉ gồm chữ số.',
  phoneBadLength: 'Số điện thoại cần từ 6 đến 15 chữ số.',
  phoneBadVn: 'Số di động Việt Nam có 9 số sau +84, bắt đầu bằng 3, 5, 7, 8 hoặc 9 (vd. 912 345 678).',
  createAccountLoginPreview: 'Tài khoản đăng nhập',
  amwayCodeLabel: 'Mã số Amway (không bắt buộc)',
  amwayCodePlaceholder: 'Vd. 1234567',
  codeRequiredTitle: 'Mã số Amway của bạn',
  codeRequiredBody: 'App dành cho NPP Amway. Nhập mã số một lần để tuyến trên, tuyến dưới và bạn bè tìm đúng bạn.',
  codeRequiredLabel: 'Mã số Amway',
  codeRequiredSave: 'Lưu mã số',
  codeRequiredCouple: 'Mã số kép: vợ/chồng dùng chung một mã, chỉ cần một người nhập.',
  codeRequiredTaken: 'Mã này đã thuộc một tài khoản khác.',
  codeRequiredSendAdmin: 'Gửi admin kiểm tra',
  codeRequiredRetry: 'Nhập lại',
  codeRequiredSent: 'Đã gửi admin. Trong lúc chờ, bạn vẫn dùng app bình thường; tuyến trên và bạn bè chưa tìm được bạn bằng mã số.',
  codeRequiredContinue: 'Tiếp tục',
  codeRequiredError: 'Chưa lưu được mã số. Kiểm tra mạng rồi thử lại nhé.',
  amwayCodeInvalid: 'Mã số Amway chỉ gồm chữ số (được cách bằng dấu cách, chấm hoặc gạch) và dài từ 4 đến 15 chữ số.',
  personDetailAmwayCode: 'Mã số Amway',
  activitySectionTitle: 'Hoạt động',
  activityNoneLeft: 'Đã làm hết các việc. Giỏi lắm!',
  activityArchivedNote: 'Người đã lưu trữ không làm được việc.',
  historyTitle: 'Lịch sử',
  historyEmpty: 'Chưa có hoạt động nào.',
  taskUndone: 'Đã hoàn tác việc vừa làm.',
  personDetailPhone: 'Số điện thoại',
  addPersonTitle: 'Thêm người',
  addPersonButton: 'Thêm người',
  boardOpen: 'Bảng 30x30',
  groupOpen: 'Nhóm của tôi',
  groupOpenLockedReason: 'Đăng nhập để xem nhóm của bạn.',
  groupTitle: 'Nhóm của tôi',
  groupPrompt: 'Các NPP F1 trực tiếp của bạn.',
  groupEmptyTitle: 'Chưa có NPP F1 nào',
  groupEmptyHint: 'Mở một liên hệ NPP có mã số Amway và bấm "Tạo tài khoản" để tạo tài khoản cho NPP F1.',
  groupLoadError: 'Chưa tải được nhóm. Thử lại nhé.',
  groupOfflineNoData: 'Cần có mạng để xem nhóm lần đầu.',
  groupOfflineNote: 'Đang offline, hiện dữ liệu lần tải gần nhất.',
  groupNoHousehold: 'Tài khoản này chưa gắn với mã số nào.',
  groupCodeLabel: 'Mã số',
  groupNoCode: 'Chưa có mã',
  groupNoNumbers: 'Chưa có số liệu',
  groupAchieved: 'Đạt 30x30',
  groupNeverActive: 'Chưa hoạt động lần nào',
  sponsorCancelTitle: 'Huỷ bảo trợ',
  sponsorCancelBody: 'Dùng khi NPP bị huỷ, ví dụ vì không hoạt động. Nhãn NPP sẽ bỏ, XP đã nhận vẫn giữ, sau này bảo trợ lại được.',
  sponsorCancelNoteLabel: 'Lý do (không bắt buộc)',
  sponsorCancelConfirm: 'Huỷ bảo trợ',
  sponsorCancelKeep: 'Giữ bảo trợ',
  sponsorCancelDone: 'Đã huỷ bảo trợ.',
  sponsorCancelHistory: 'Huỷ bảo trợ',
  cheerGroupTitle: 'Cổ vũ nhóm',
  cheerAllDone: '✓ Hôm nay bạn đã cổ vũ tất cả mọi người.',
  spouseCardTitle: 'Vợ/chồng',
  spouseNoNumbers: 'Chưa có số liệu (cần mở bản app mới)',
  spouseCheered: 'Đã cổ vũ',
  cheerSpouseNote: 'Đứng chung mã số với bạn',
  cheerPickTitle: 'Gửi lời cổ vũ',
  cheerPickLabel: 'Chọn một lời',
  cheerCustomLabel: 'Hoặc tự viết (tối đa 200 ký tự)',
  cheerSend: 'Gửi',
  cheerCancel: 'Huỷ',
  tabBadges: 'Huy hiệu',
  badgesTitle: 'Huy hiệu',
  badgesEarned: 'huy hiệu đã có',
  badgesGoldPlus: 'huy hiệu Vàng trở lên',
  badgesRecent: 'Mới đạt',
  badgesFilterLabel: 'Lọc huy hiệu',
  badgesFilters: { all: 'Tất cả', done: 'Đã có', todo: 'Chưa có' },
  badgesDone: 'Đã đạt hết',
  badgesNow: 'hiện tại',
  f1BoxTitle: 'NPP F1',
  f1BoxLogin: 'Tài khoản',
  f1InsightGoalMet: 'Hôm nay: đã đạt mục tiêu',
  f1InsightGoalNot: 'Hôm nay: chưa đạt mục tiêu',
  f1InsightActiveDays: '7 ngày qua: hoạt động',
  f1InsightTasks: 'Việc làm 7 ngày',
  f1InsightLessons: 'Đã học',
  f1InsightBadges: 'Huy hiệu mới 7 ngày',
  f1InsightSeen: 'Mở app lần cuối',
  f1NotActivated: 'Chưa kích hoạt',
  cheerSuggestedLabel: 'Gợi ý theo hoạt động',
  cheerStandardLabel: 'Lời cổ vũ chung',
  appLinkLine: 'Ứng dụng',
  f1ResendButton: 'Cấp lại mật khẩu tạm',
  f1ResendTitle: 'Mật khẩu tạm mới',
  f1ResendOffline: 'Cần có mạng để cấp lại mật khẩu.',
  f1ResendErrors: {
    already_active: 'Tài khoản này đã đổi mật khẩu và đang dùng. Nhờ quản trị đặt lại nếu cần.',
    not_allowed: 'Bạn chỉ cấp lại được cho NPP F1 trực tiếp của mình.',
    not_found: 'Không tìm thấy tài khoản này.',
    network: 'Chưa kết nối được máy chủ. Thử lại nhé.',
    other: 'Chưa cấp lại được mật khẩu. Thử lại sau nhé.',
  },
  nppSortLabel: 'Sắp xếp NPP',
  contactSortTitle: 'Sắp xếp',
  f1RowToday: 'Hôm nay',
  f1StatContacts: 'Liên hệ',
  f1StatCustomers: 'KH',
  f1StatNpp: 'NPP',
  installTitle: 'Đưa app ra màn hình chính',
  installIntro: 'Mở app bằng một chạm như app thường, toàn màn hình, không cần gõ địa chỉ. Trên iPhone, cần làm bước này để nhận thông báo.',
  installButton: 'Cài app',
  installDone: '✓ App đã ở màn hình chính của máy này.',
  installTabIos: 'iPhone',
  installTabAndroid: 'Android',
  installStepsIos: [
    'Mở app bằng Safari.',
    'Bấm nút Chia sẻ (ô vuông có mũi tên lên) ở thanh dưới.',
    'Kéo xuống, chọn "Thêm vào MH chính".',
    'Bấm "Thêm". Biểu tượng Diamond Challenge hiện trên màn hình chính.',
  ],
  installStepsAndroid: [
    'Mở app bằng Chrome.',
    'Bấm nút ⋮ ở góc trên bên phải.',
    'Chọn "Thêm vào màn hình chính" hoặc "Cài đặt ứng dụng".',
    'Bấm "Cài đặt" (hoặc "Thêm"). Biểu tượng Diamond Challenge hiện trên màn hình chính.',
  ],
  contactSortNppGroup: 'Chỉ khi lọc NPP',
  contactSortNames: {
    recent: 'Hoạt động gần nhất',
    stale: 'Lâu chưa liên hệ',
    name: 'Tên A → Z',
    added: 'Mới thêm',
    nppNewest: 'Mới bảo trợ',
    xpTotal: 'Tổng XP',
    xp7d: 'XP 7 ngày',
  },
  contactSortHints: {
    recent: 'Người vừa làm việc cùng lên đầu',
    stale: 'Ai bị bỏ quên lâu nhất lên đầu',
    name: '',
    added: '',
    nppNewest: '',
    xpTotal: '',
    xp7d: '',
  },
  contactDaysNone: 'Chưa có hoạt động',
  nppSortNames: { newest: 'Mới bảo trợ', xpTotal: 'Tổng XP', xp7d: 'XP 7 ngày' },
  f1BoxOffline: 'đang không có mạng',
  groupCheerButton: 'Cổ vũ',
  groupCheeredToday: 'Đã cổ vũ hôm nay',
  groupCheerOfflineReason: 'Cần có mạng để cổ vũ.',
  groupCheerSent: 'Đã gửi lời cổ vũ.',
  groupCheerErrors: {
    already: 'Hôm nay bạn đã cổ vũ NPP này rồi.',
    not_allowed: 'Bạn không gửi được lời cổ vũ cho NPP này.',
    no_message: 'Chưa có lời cổ vũ nào để gửi.',
    network: 'Chưa gửi được. Kiểm tra mạng rồi thử lại nhé.',
  },
  groupMemberUnnamed: 'Chưa có tên',
  cheerCardTitle: 'Lời cổ vũ từ người bảo trợ',
  cheerCardDismiss: 'Đóng',
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
  boardDuplicatesOpen: 'Kiểm tra liên hệ trùng',
  achievementsOpen: 'Thành tích',
  achievementsTitle: 'Thành tích',
  achievementsPrompt: 'Các mốc bạn đã đạt và các mốc đang chờ.',
  achievementsLoadError: 'Không tải được Thành tích. Thử lại nhé.',
  achievementsEmpty: 'Chưa có mốc nào được cấu hình.',
  achievementsEarnedBefore: 'Đã đạt từ trước',
  achievementsEarned: 'Đã đạt',
  achievementsNotEarned: 'Chưa đạt',
  achievementsNoDailyGoal: 'Chưa đạt mục tiêu ngày nào',
  personNameLabel: 'Tên',
  personNamePlaceholder: 'Vd. Lan',
  personNameRequired: 'Hãy nhập tên.',
  personDuplicateWarning: 'Đã có người trùng tên này. Bạn vẫn có thể thêm.',
  personAddedXp: 'Đã thêm người',
  personSaveError: 'Không lưu được. Thử lại nhé.',
  personInfoSectionTitle: 'Thông tin',
  activityNoteLabel: 'Ghi chú (không bắt buộc)',
  activityDateTimeLabel: 'Ngày giờ',
  activityConfirm: 'Xác nhận',
  activityCancel: 'Huỷ',
  activityTimeFuture: 'Ngày giờ không được ở tương lai.',
  activityTimeInvalid: 'Hãy chọn ngày giờ hợp lệ.',
  historyClose: 'Đóng',
  historySummaryTitle: 'Tóm tắt',
  historyTotalXpLabel: 'Tổng XP từ người này',
  historyFirstLabel: 'Liên hệ đầu tiên',
  historyLastLabel: 'Liên hệ gần nhất',
  historyDaysSinceLabel: 'Kể từ lần gần nhất',
  historyAddedLabel: 'Thêm vào danh sách',
  historyLatestLabel: 'Hoạt động gần nhất',
  noteEditButton: 'Sửa ghi chú',
  noteAddButton: '+ Thêm ghi chú',
  noteEditTitle: 'Sửa ghi chú',
  noteAddTitle: 'Thêm ghi chú',
  noteEditHint: 'Xoá hết chữ rồi Lưu để bỏ ghi chú.',
  noteEditSave: 'Lưu',
  noteEditCancel: 'Huỷ',
  noteEdited: 'đã sửa',
  noteEditError: 'Chưa lưu được ghi chú. Thử lại nhé.',
  historyListTitle: 'Danh sách',
  personSaveChanges: 'Lưu thay đổi',
  personEditTitle: 'Sửa thông tin',
  personEditSave: 'Lưu',
  personEditCancel: 'Huỷ',
  personCodeNone: 'Mã số chưa có',
  summaryTitle: 'Tóm tắt',
  summaryLastLabel: 'Lần gần nhất',
  summaryNoActivity: 'Chưa có hoạt động',
  noteSaving: 'Đang lưu…',
  noteSavedMark: '✓ Đã lưu',
  noteSaveError: 'Chưa lưu được, sẽ thử lại khi bạn rời ô ghi chú.',
  notePlaceholder: 'F O R M H D: gia đình, nghề nghiệp, sở thích, tiền bạc, sức khoẻ, ước mơ…',
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

  // Tài khoản (story 021)
  accountHeading: 'Tài khoản',
  accountSignedOut: 'Chưa đăng nhập',
  accountSignedInAs: 'Đang đăng nhập:',
  accountLogin: 'Đăng nhập',
  accountSignOut: 'Đăng xuất',
  accountSignOutKeepsData: 'Đăng xuất không xoá dữ liệu trên máy này.',
  accountSignOutError: 'Không đăng xuất được. Thử lại nhé.',
  displayNameLabel: 'Tên hiển thị',
  displayNameHint: 'Từ 1 đến 60 ký tự.',
  displayNameInvalid: 'Tên cần từ 1 đến 60 ký tự.',
  displayNameSaved: 'Đã lưu tên.',
  displayNamePromptTitle: 'Bạn muốn được gọi là gì?',
  displayNamePromptBody: 'Tên này hiện trong tài khoản của bạn. Bạn có thể đổi lại trong Cài đặt.',
  displayNameSkip: 'Để sau',
  loginTitle: 'Đăng nhập',
  loginPrompt: 'Dùng số điện thoại và mật khẩu được cấp cho bạn.',
  loginCountryLabel: 'Mã nước',
  loginPhoneLabel: 'Số điện thoại',
  loginPasswordLabel: 'Mật khẩu',
  loginSubmit: 'Đăng nhập',
  loginSubmitting: 'Đang đăng nhập…',
  loginInvalidPhone: 'Số điện thoại chưa đúng. Kiểm tra mã nước và số điện thoại.',
  loginPasswordRequired: 'Hãy nhập mật khẩu.',
  authBadCredentials: 'Số điện thoại hoặc mật khẩu chưa đúng. Kiểm tra lại rồi thử nhé.',
  authNetworkError: 'Không có kết nối mạng. Kiểm tra mạng rồi thử lại nhé.',
  authServerError: 'Máy chủ đang gặp sự cố. Thử lại sau ít phút nhé.',
  authSessionExpired: 'Phiên đăng nhập trên máy này đã hết. Bấm "Đăng xuất" rồi đăng nhập lại (bằng mật khẩu tạm nếu chưa đổi), sau đó thử lại.',
  authReauthenticationNeeded: 'Máy chủ cần bạn đăng nhập lại trước khi đổi mật khẩu. Bấm "Đăng xuất", đăng nhập lại bằng mật khẩu tạm rồi đổi ngay.',
  authWeakPassword: 'Mật khẩu này quá yếu hoặc đã từng bị lộ. Chọn mật khẩu khác dài hơn, có cả chữ và số.',
  /** Appended to a server error so the user can report it; `code` is the server's error code, never a secret. */
  authErrorCode: (code: string) => `(mã lỗi: ${code})`,
  passwordShow: 'Hiện mật khẩu',
  passwordHide: 'Ẩn mật khẩu',
  changePasswordTitle: 'Đổi mật khẩu',
  changePasswordPrompt: 'Đây là lần đăng nhập đầu. Hãy đặt mật khẩu của riêng bạn trước khi tiếp tục.',
  newPasswordLabel: 'Mật khẩu mới',
  confirmPasswordLabel: 'Nhập lại mật khẩu mới',
  changePasswordSubmit: 'Đổi mật khẩu',
  changePasswordSubmitting: 'Đang đổi…',
  passwordTooShort: 'Mật khẩu cần ít nhất 8 ký tự.',
  passwordMismatch: 'Hai mật khẩu chưa giống nhau.',
  passwordSameAsTemporary: 'Mật khẩu mới phải khác mật khẩu tạm.',

  // Tạo tài khoản cho NPP (story 024)
  createAccountButton: 'Tạo tài khoản',
  createAccountNeedsNetwork: 'Cần có mạng để tạo tài khoản',
  createAccountHasAccount: 'Đã có tài khoản',
  linkedAccountLabel: 'Tài khoản của người này',
  linkedPhoneUpdate: 'Cập nhật số trong danh bạ',
  linkedPhoneUpdated: 'Đã cập nhật số theo tài khoản.',
  createAccountNameNote: 'Lấy từ danh bạ của bạn. F1 sẽ thấy tên này khi đăng nhập lần đầu và sửa được.',
  createAccountWarnArchived: 'Người này đã có tài khoản và đang được lưu trữ. Tài khoản vẫn được giữ.',
  createAccountWarnNotNpp: 'Người này đã có tài khoản nhưng không còn nhãn NPP. Tài khoản vẫn được giữ.',
  createAccountTitle: 'Tạo tài khoản',
  createAccountPrompt: 'Tạo tài khoản cho người này bằng số điện thoại. App sẽ sinh một mật khẩu tạm để bạn gửi cho họ.',
  createAccountCodeLine: 'Mã số Amway',
  createAccountSubmit: 'Tạo tài khoản',
  createAccountSubmitting: 'Đang tạo…',
  createAccountPhoneRequired: 'Hãy nhập số điện thoại.',
  createAccountCodeRequired: 'Hãy nhập mã số Amway của người này.',
  createAccountPersonMissing: 'Không tìm thấy người này.',
  createAccountLater: 'Để sau',
  createAccountNameInvalid: 'Tên hiển thị cần từ 1 đến 60 ký tự.',
  createAccountDone: 'Đã tạo tài khoản',
  createAccountShareHint: 'Nhắc họ đổi mật khẩu khi đăng nhập lần đầu.',
  createAccountOnce: 'Mật khẩu tạm chỉ hiện một lần. Hãy sao chép hoặc gửi ngay trước khi rời màn hình này.',
  createAccountPhoneLine: 'Số điện thoại',
  createAccountPasswordLine: 'Mật khẩu tạm',
  createAccountCopy: 'Sao chép',
  createAccountCopied: 'Đã sao chép.',
  createAccountCopyFailed: 'Không sao chép được. Hãy chép tay.',
  createAccountShare: 'Chia sẻ',
  createAccountSaveWarning: 'Đã tạo tài khoản nhưng chưa lưu được vào danh bạ. Hãy ghi lại mật khẩu tạm này.',
  createAccountFinish: 'Xong',
  createAccountErrors: {
    not_signed_in: 'Bạn cần đăng nhập để tạo tài khoản.',
    change_password_first: 'Hãy đổi mật khẩu tạm của bạn trước khi tạo tài khoản cho người khác.',
    invalid_phone: 'Số điện thoại chưa đúng. Kiểm tra mã nước và số điện thoại.',
    invalid_password: 'Mật khẩu tạm không hợp lệ. Thử lại nhé.',
    invalid_code: 'Mã số Amway của người này chưa hợp lệ. Hãy sửa mã trong thông tin liên hệ.',
    phone_taken: 'Số điện thoại này đã có tài khoản.',
    code_taken: 'Mã số Amway này đã có tài khoản khác dùng.',
    no_household: 'Bạn chưa gắn với mã số nào nên chưa tạo được tài khoản.',
    not_allowed: 'Bạn không có quyền tạo tài khoản.',
    household_full_or_inactive: 'Mã số của bạn đã đủ 2 người hoặc không còn hoạt động.',
    create_failed: 'Máy chủ chưa tạo được tài khoản. Thử lại sau ít phút nhé.',
    network: 'Không có kết nối mạng. Kiểm tra mạng rồi thử lại nhé.',
    unknown: 'Chưa tạo được tài khoản. Thử lại sau nhé.',
  },

  // NPP của tôi và Thêm vợ/chồng (story 025)
  householdEntry: 'Mã số của tôi',
  householdTitle: 'Mã số của tôi',
  householdPrompt: 'Mã số Amway và người đứng chung mã số với bạn.',
  householdCodeLabel: 'Mã số Amway',
  householdNoCode: 'Chưa có mã',
  householdMembersHeading: 'Người đứng chung mã số',
  householdNoHousehold: 'Tài khoản này chưa gắn với mã số nào.',
  householdOffline: 'Cần có mạng để xem thông tin mã số. Kết nối mạng rồi thử lại nhé.',
  householdLoadError: 'Chưa tải được thông tin mã số. Thử lại nhé.',
  householdMemberUnnamed: 'Chưa có tên',
  householdMe: 'Bạn',
  householdSharedHint: 'Mã số kép: hai người dùng chung một Danh bạ, mỗi người có XP và mục tiêu riêng.',
  householdSingleHint: 'Vợ/chồng có thể đứng chung mã số này (mã số kép) để dùng chung Danh bạ.',
  settingsGroupAccount: 'Tài khoản',
  settingsGroupCode: 'Mã số của tôi',
  settingsGroupGoal: 'Mục tiêu hằng ngày',
  goalCardLabel: 'XP mỗi ngày',
  goalXpHint: 'Tổng điểm cần đạt',
  goalLessonsName: 'Bài học',
  goalLessonsHint: 'Số bài học xong trong ngày',
  goalTasksName: 'Việc làm',
  goalTasksHint: 'Liên hệ, demo, chăm sóc… bất kỳ',
  goalLess: 'Giảm 5 XP',
  goalMore: 'Tăng 5 XP',
  goalRule: 'Đặt 0 để bỏ mục tiêu bài học hoặc việc làm. Đạt khi đủ cả ba. Thay đổi áp dụng từ ngày mai.',
  goalSave: 'Lưu mục tiêu',
  goalLearn: 'Học',
  goalLearnMore: 'Học thêm',
  goalWork: 'Làm',
  goalWorkMore: 'Làm thêm',
  goalSaved: 'Đã đặt. Mục tiêu mới áp dụng từ ngày mai.',
  goalSaveError: 'Chưa lưu được mục tiêu. Thử lại nhé.',
  settingsGroupApp: 'Ứng dụng',
  pushTitle: 'Thông báo',
  pushCheersToggle: 'Khi có người cổ vũ',
  pushCheersHint: 'Báo ngay, kể cả lúc app đang đóng',
  reminderDailyToggle: 'Nhắc mục tiêu mỗi ngày',
  reminderDailyHint: 'Chỉ nhắc khi hôm nay chưa đạt mục tiêu',
  pushPrefsError: 'Chưa lưu được. Kiểm tra mạng rồi thử lại nhé.',
  pushIntro: 'Nhận thông báo khi có người cổ vũ và lời nhắc mục tiêu, kể cả lúc app đang đóng.',
  pushEnable: 'Bật thông báo trên máy này',
  pushOn: '✓ Máy này đang nhận thông báo.',
  pushEnabled: 'Đã bật thông báo trên máy này.',
  addedByDot: { spouse: 'vợ/chồng thêm', both: 'cả hai cùng có' },
  pushPromptAskTitle: 'Bật thông báo',
  pushPromptAskBody: (time: string) => `Nhận lời cổ vũ từ tuyến trên và nhắc học lúc ${time} nếu hôm nay chưa đạt mục tiêu.`,
  pushPromptLater: 'Để sau',
  pushPromptOn: 'Bật',
  pushPromptInstallTitle: 'Muốn nhận thông báo?',
  pushPromptInstallBody: 'Trên iPhone, cần đưa app ra màn hình chính trước:',
  pushPromptInstallSteps: ['Bấm nút Chia sẻ ⬆︎ ở thanh dưới của Safari', 'Chọn “Thêm vào MH chính”', 'Mở app từ màn hình chính, rồi bấm “Bật” ở thẻ này'],
  pushPromptBlockedTitle: 'Thông báo đang bị chặn',
  pushPromptBlockedBody: 'Mở Cài đặt của điện thoại › Thông báo › Diamond Challenge › bật Cho phép thông báo.',
  pushPromptGotIt: 'Đã hiểu',
  pushPromptDoneTitle: 'Đã bật thông báo',
  pushPromptDoneBody: (time: string) => `Cổ vũ: bật · Nhắc mỗi ngày: ${time}. Đổi giờ trong Cài đặt › Thông báo.`,
  pushErrors: {
    denied: 'Bạn đã chặn thông báo. Mở cài đặt của trình duyệt hoặc điện thoại để cho phép, rồi thử lại.',
    unsupported: 'Trình duyệt này không nhận được thông báo đẩy.',
    failed: 'Chưa bật được thông báo. Kiểm tra mạng rồi thử lại nhé.',
  },
  pushSupport: {
    ready: '',
    needs_install: 'Trên iPhone, hãy đưa app ra màn hình chính (thẻ ở trên) rồi mở app từ biểu tượng đó để bật thông báo.',
    denied: 'Thông báo đang bị chặn. Mở cài đặt của trình duyệt hoặc điện thoại để cho phép.',
    unsupported: 'Trình duyệt này không nhận được thông báo đẩy. Thử Chrome (Android) hoặc app ngoài màn hình chính (iPhone).',
    not_configured: 'Máy chủ chưa sẵn sàng gửi thông báo (hoặc đang không có mạng). Thử lại sau ít phút nhé.',
  },
  settingsGroupData: 'Dữ liệu',
  settingsGroupOther: 'Khác',
  accountLoginLabel: 'Đăng nhập bằng',
  addMemberButton: 'Thêm người đứng chung (mã số kép)',
  addMemberOfflineReason: 'Cần có mạng để thêm người đứng chung.',
  addMemberTitle: 'Thêm người đứng chung (mã số kép)',
  addMemberPrompt: 'Tạo tài khoản cho vợ/chồng đứng chung mã số này (mã số kép) bằng số điện thoại. App sẽ sinh một mật khẩu tạm để bạn gửi cho họ.',
  addMemberSubmit: 'Thêm vào mã số',
  addMemberSubmitting: 'Đang thêm…',
  addMemberDone: 'Đã thêm vào mã số',
  addMemberErrors: {
    not_signed_in: 'Bạn cần đăng nhập để thêm người đứng chung.',
    change_password_first: 'Hãy đổi mật khẩu tạm của bạn trước khi thêm người đứng chung.',
    invalid_phone: 'Số điện thoại chưa đúng. Kiểm tra mã nước và số điện thoại.',
    invalid_password: 'Mật khẩu tạm không hợp lệ. Thử lại nhé.',
    phone_taken: 'Số điện thoại này đã có tài khoản. Hãy nhờ quản trị viên hỗ trợ.',
    no_household: 'Bạn chưa gắn với mã số nào nên chưa thêm được người đứng chung.',
    household_full_or_inactive: 'Mã số đã đủ 2 người hoặc không còn hoạt động.',
    not_allowed: 'Bạn không có quyền thêm người vào mã số này.',
    not_found: 'Không tìm thấy mã số này.',
    create_failed: 'Máy chủ chưa thêm được người đứng chung. Thử lại sau ít phút nhé.',
    network: 'Không có kết nối mạng. Kiểm tra mạng rồi thử lại nhé.',
    unknown: 'Chưa thêm được người đứng chung. Thử lại sau nhé.',
  },

  // Quản trị (story 029)
  adminEntry: 'Quản trị',
  adminTitle: 'Quản trị',
  adminPrompt: 'Tìm mã số theo số điện thoại hoặc mã số Amway để đặt lại mật khẩu hoặc đặt mã số.',
  adminOffline: 'Cần có mạng để dùng màn Quản trị.',
  adminSearchByPhone: 'SĐT',
  adminSearchByCode: 'Mã số',
  adminSearchCodeLabel: 'Mã số Amway',
  adminSearchButton: 'Tìm mã số',
  adminSearching: 'Đang tìm…',
  adminSearchOfflineReason: 'Cần có mạng để tìm mã số.',
  adminSearchPhoneRequired: 'Hãy nhập số điện thoại.',
  adminSearchCodeInvalid: 'Mã số chỉ gồm chữ số (được cách bằng dấu cách, chấm hoặc gạch) và dài từ 4 đến 15 chữ số.',
  adminNotFound: 'Không tìm thấy mã số nào.',
  adminSearchErrors: {
    network: 'Không có kết nối mạng. Kiểm tra mạng rồi thử lại nhé.',
    unknown: 'Chưa tìm được. Thử lại sau nhé.',
  },
  adminMembersHeading: 'Thành viên',
  adminNoMembers: 'Mã số chưa có người dùng.',
  adminActiveCodeLabel: 'Mã đang hoạt động',
  adminNoCode: 'Chưa có mã',
  adminCancelledHeading: 'Mã đã huỷ',
  adminCancelledTag: 'Đã huỷ',
  adminResetButton: 'Đặt lại mật khẩu',
  adminResetting: 'Đang đặt lại…',
  adminResetOfflineReason: 'Cần có mạng để đặt lại mật khẩu.',
  adminResetDone: 'Đã đặt lại mật khẩu',
  adminResetErrors: {
    not_found: 'Không tìm thấy tài khoản này.',
    admin_only: 'Chỉ quản trị viên mới đặt lại được mật khẩu.',
    network: 'Không có kết nối mạng. Mật khẩu chưa đổi. Kiểm tra mạng rồi thử lại nhé.',
    other: 'Chưa đặt lại được mật khẩu. Thử lại sau nhé.',
  },
  adminSetCodeHeading: 'Đặt mã số',
  adminSetCodeLabel: 'Mã số mới',
  adminSetCodeButton: 'Đặt mã số',
  adminSetCodeSaving: 'Đang đặt…',
  adminSetCodeOfflineReason: 'Cần có mạng để đặt mã số.',
  adminSetCodeDone: 'Đã đặt mã số. Mã cũ chuyển sang Đã huỷ.',
  adminSetCodeErrors: {
    invalid_code: 'Mã số chỉ gồm chữ số (được cách bằng dấu cách, chấm hoặc gạch) và dài từ 4 đến 15 chữ số.',
    code_taken: 'Mã số này đang được tài khoản khác dùng. Chưa đổi gì.',
    not_admin: 'Chỉ quản trị viên mới đặt được mã số.',
    network: 'Không có kết nối mạng. Mã số chưa đổi. Kiểm tra mạng rồi thử lại nhé.',
    other: 'Chưa đặt được mã số. Thử lại sau nhé.',
  },

  // Đồng bộ Danh bạ NPP (story 023)
  consentTitle: 'Đồng bộ dữ liệu',
  consentIntro:
    'Để dùng chung với người đứng chung mã số, Danh bạ của bạn (tên, số điện thoại, mã số Amway, ghi chú, nhãn, việc cần làm và lịch sử) sẽ được lưu trên máy chủ đặt tại Singapore.',
  consentMembersOnly: 'Chỉ người đứng chung mã số với bạn xem được Danh bạ này qua app.',
  consentProgress:
    'Tiến độ học và XP của bạn (bài học đã học, XP, streak, thành tích) cũng được lưu trên máy chủ ở Singapore, chỉ bạn xem được.',
  consentAdmins: 'Quản trị viên của dự án có thể truy cập dữ liệu trên máy chủ.',
  consentRequiredNote: 'Bạn cần đồng ý để dùng app. Nếu chưa muốn, hãy đăng xuất.',
  consentAgree: 'Đồng ý và tiếp tục',
  consentSignOut: 'Đăng xuất',
  consentNeedsNetwork: 'Cần có mạng để xác nhận đồng ý.',
  consentRetry: 'Thử lại',
  loginNeedsNetwork: 'Cần có mạng cho lần đăng nhập đầu.',
  loginNoAccount: 'Chưa có tài khoản? Liên hệ người bảo trợ.',
  loginForgotPassword: 'Quên mật khẩu? Nhờ người bảo trợ hoặc quản trị đặt lại.',
  sessionRestoring: 'Đang mở app…',
  storeOpening: 'Đang chuyển dữ liệu trên máy sang tài khoản của bạn…',
  storeOpenError: 'Chưa mở được dữ liệu trên máy. Dữ liệu cũ vẫn còn nguyên. Thử lại nhé.',
  eraseHeading: 'Xoá dữ liệu trên máy này',
  eraseOpen: 'Đăng xuất và xoá dữ liệu trên máy này',
  eraseWarning:
    'Dữ liệu chưa đồng bộ sẽ mất và không lấy lại được. Tiến độ và Danh bạ đã đồng bộ vẫn còn trên máy chủ và sẽ quay lại khi bạn đăng nhập lại.',
  eraseExport: 'Xuất file sao lưu',
  eraseConfirm: 'Xoá và đăng xuất',
  eraseCancel: 'Huỷ',
  eraseBlocked: (n: number) => `Còn ${n} mục chưa đồng bộ (Danh bạ và tiến độ). Hãy đồng bộ hoặc xuất file sao lưu trước khi xoá.`,
  eraseError: 'Chưa xoá được dữ liệu. Thử lại nhé.',
  contactSyncHeading: 'Đồng bộ dữ liệu',
  contactSyncChecking: 'Chưa kiểm tra được bạn đã đồng ý hay chưa. Cần có mạng.',
  contactSyncNotConsented: 'Chưa đồng ý lưu Danh bạ trên máy chủ.',
  contactSyncNow: 'Đồng bộ ngay',
  contactSyncIdle: 'Chưa đồng bộ.',
  contactSyncSyncing: 'Đang đồng bộ…',
  /** Prefix of the Danh bạ line in the sync card (story 032). */
  contactSyncContactsLabel: 'Danh bạ:',
  /** Prefix of the personal progress line in the sync card (story 032). */
  contactSyncProgressLabel: 'Tiến độ:',
  syncNetworkError: 'Không có mạng. App sẽ thử lại khi có mạng.',
  syncServerError: 'Máy chủ đang gặp sự cố. Thử lại sau ít phút nhé.',
  syncDenied: 'Máy chủ từ chối đồng bộ (có thể bạn không còn đứng chung mã số này). Đã dừng đồng bộ; dữ liệu trên máy vẫn giữ nguyên.',
  /** Progress sync refused (no current consent or no rights); the Danh bạ wording about the household does not apply. */
  progressSyncDenied: 'Máy chủ từ chối lưu tiến độ (có thể bạn cần đồng ý lại). Đã dừng đồng bộ tiến độ; dữ liệu trên máy vẫn giữ nguyên.',
  syncNoHousehold: 'Tài khoản chưa gắn với mã số nào nên chưa đồng bộ được. Dữ liệu trên máy vẫn giữ nguyên.',
  historyFormerMember: 'Thành viên cũ',

  // Liên hệ trùng (story 026)
  dupTitle: 'Kiểm tra liên hệ trùng',
  dupPrompt: 'Xem từng cặp và chọn gộp hoặc giữ riêng.',
  dupBack: 'Quay lại Làm',
  dupNone: 'Không còn liên hệ trùng cần kiểm tra.',
  dupMergeAll: 'Gộp tất cả',
  dupMergeAllHint: 'Chỉ gộp các cặp trùng chắc chắn, không xung đột mã. Cặp chỉ trùng tên phải duyệt từng cặp.',
  dupMerge: 'Gộp',
  dupNotSame: 'Không phải cùng người',
  dupCertain: 'Trùng chắc chắn',
  dupPossible: 'Có thể trùng',
  dupReasonCode: 'Cùng mã số',
  dupReasonPhone: 'Cùng số điện thoại',
  dupReasonName: 'Cùng tên',
  dupReasonNearName: 'Tên gần giống',
  dupPhone: 'SĐT',
  dupNoPhone: 'Chưa có SĐT',
  dupCode: 'Mã số',
  dupNoCode: 'Chưa có mã',
  dupLabel: 'Nhãn',
  dupNoLabel: 'Chưa có nhãn',
  dupTasksDone: 'Việc đã làm',
  dupAddedBy: 'Người thêm',
  dupAddedByMe: 'Tôi',
  dupLinkedConflict: 'Hai liên hệ đã liên kết hai tài khoản khác nhau, không thể gộp.',
  dupPickCodeTitle: 'Hai mã khác nhau. Giữ mã nào?',
  dupCancel: 'Huỷ',
  dupError: 'Chưa lưu được. Thử lại nhé.',
  dupMergedSection: 'Đã gộp',
  dupSplit: 'Tách',
  dupOtherPhones: 'SĐT khác',

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

/** Popup headline of a stage item, e.g. "Chặng Silver" -> "Bạn đã lên chặng Silver!". */
export function stageReachedTitle(itemName: string): string {
  return `Bạn đã lên ${itemName.charAt(0).toLowerCase()}${itemName.slice(1)}!`;
}

/** Toast text, e.g. "+15 XP · Demo sản phẩm". */
export function toastLabel(xp: number, label: string): string {
  return `+${xp} XP · ${label}`;
}

/** Merged toast text, e.g. "+45 XP · 3 hoạt động". */
export function toastMergedLabel(xp: number, count: number): string {
  return `+${xp} XP · ${count} hoạt động`;
}

/** Title of the popup that folds the remaining milestones. */
export function popupRestTitle(count: number): string {
  return `Bạn vừa đạt thêm ${count} thành tích`;
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
export function taskButtonLabel(name: string, xp: number, times = 0): string {
  return times > 0 ? `${name}, ${xpLabel(xp)}, ${taskDoneTimesLabel(times)}` : `${name}, ${xpLabel(xp)}`;
}

/** "đã làm N lần" on a task of the Hoạt động list (story 035), shown when N > 0. */
/** Note under a one-time task that is done (greyed out, not selectable): "Đã chốt NPP ngày 22/11/2026". */
/** Bảo trợ row for someone still NPP (story 040): "Đã bảo trợ ngày 02/03 · bấm để huỷ". */
export function sponsorCancelHint(taskName: string, iso: string | null): string {
  return `${taskDoneOnceLabel(taskName, iso)} · bấm để huỷ`;
}

export function taskDoneOnceLabel(taskName: string, iso: string | null): string {
  const date = iso === null ? '' : shortDateLabel(iso);
  const name = taskName.charAt(0).toLocaleLowerCase('vi-VN') + taskName.slice(1);
  return date === '' ? `Đã ${name}` : `Đã ${name} ngày ${date}`;
}

export function taskDoneTimesLabel(times: number): string {
  return `đã làm ${times} lần`;
}

/** Message when the chosen activity time is more than `days` days back. */
export function activityTimeTooOldLabel(days: number): string {
  return days === 0 ? 'Chỉ ghi được vào lúc bấm.' : `Chỉ ghi lùi tối đa ${days} ngày.`;
}

/** "Hôm nay" / "N ngày trước" for the days since the last contact. */
/** "Kể từ lần gần nhất" in Lịch sử (story 065): "Hôm nay" or "14 ngày". */
export function daysCountLabel(days: number): string {
  return days === 0 ? 'Hôm nay' : `${days} ngày`;
}

export function daysSinceLabel(days: number): string {
  return days === 0 ? 'Hôm nay' : `${days} ngày trước`;
}

/** Character counter under the note field, e.g. "12/500". */
export function noteCounterLabel(length: number, max: number): string {
  return `${length}/${max}`;
}

/** "Bài học 1/2" (story 062). */
export function goalCountLabel(name: string, done: number, needed: number): string {
  return `${name} ${Math.min(done, needed)}/${needed}`;
}

/** "Hôm nay 1 → từ mai 2" (story 062). */
export function goalChangeLabel(today: number, next: number): string {
  return `Hôm nay ${today} → từ mai ${next}`;
}

/** "Từ mai: 40 XP · 2 bài học · 3 việc làm" (story 062): only the parts that change. */
export function goalTomorrowLabel(today: { xp: number; lessons: number; tasks: number }, next: { xp: number; lessons: number; tasks: number }): string {
  const parts: string[] = [];
  if (next.xp !== today.xp) parts.push(`${next.xp} XP`);
  if (next.lessons !== today.lessons) parts.push(`${next.lessons} bài học`);
  if (next.tasks !== today.tasks) parts.push(`${next.tasks} việc làm`);
  return `Từ mai: ${parts.join(' · ')}`;
}

/** "Hôm nay: 30 XP" (story 056). */
export function goalTodayLabel(xp: number): string {
  return `Mục tiêu hôm nay: ${xp} XP`;
}

/** "Từ ngày mai: 50 XP" (story 056). */
export function goalFromTomorrowLabel(xp: number): string {
  return `Từ ngày mai: ${xp} XP`;
}

/** Screen-reader text of an F1 row's goal and streak (story 060). */
export function f1RowAria(goalToday: boolean, streak: number): string {
  return `${goalToday ? 'Hôm nay đã đạt mục tiêu' : 'Hôm nay chưa đạt mục tiêu'}, chuỗi ${streak} ngày`;
}

/** "7 ngày 210 XP · mở app hôm nay" (story 061). */
export function spouseMetaLabel(xp7d: number, seen: string | null): string {
  return `7 ngày ${xp7d.toLocaleString('vi-VN')} XP${seen === null ? '' : ` · mở app ${seen}`}`;
}

/** "🔥 5 ngày". */
export function streakDaysLabel(streak: number): string {
  return `🔥 ${streak} ngày`;
}

/** Screen-reader text of a row's day count (story 052). */
export function contactDaysAria(days: number | null): string {
  return days === null ? 'Chưa có hoạt động' : days === 0 ? 'Hôm nay có hoạt động' : `${days} ngày chưa hoạt động`;
}

/** Button label of the sort choice: "Sắp xếp: Hoạt động gần nhất" (screen readers only). */
export function contactSortAria(name: string): string {
  return `Sắp xếp: ${name}`;
}

/** "Tài khoản: Uyên · +84 912 345 678" (story 059); without a name only the phone. */
export function linkedAccountLine(name: string | null, phone: string | null): string {
  return `Tài khoản: ${[name, phone].filter((x) => x !== null && x !== '').join(' · ')}`;
}

/** "Số trong danh bạ khác số tài khoản (+84 …)." */
export function linkedPhoneDiffersLabel(phone: string): string {
  return `Số trong danh bạ khác số tài khoản (${phone}).`;
}

/** Short local date, e.g. "02/11/26" (story 051 summary). */
export function compactDateLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/** Local date and time for an activity row, e.g. "21/11/2026, 09:30". */
export function dateTimeLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
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

/** Warning above the board while `count` duplicate pairs are unresolved (crm.md rule 23). */
export function boardDuplicatesWarning(count: number): string {
  return `Có ${count} cặp liên hệ có thể trùng, số liệu có thể bị đếm hai lần`;
}

/** What is still missing for 30x30, e.g. "còn 5 KH, còn 12 NPP F1". */
export function boardMissingLabel(customersMissing: number, f1Missing: number): string {
  const parts: string[] = [];
  if (customersMissing > 0) parts.push(`còn ${customersMissing} KH`);
  if (f1Missing > 0) parts.push(`còn ${f1Missing} NPP F1`);
  return parts.join(', ');
}

/** Summary line of the Thành tích screen, e.g. "Đã đạt 3/15". */
export function achievementsSummaryLabel(earned: number, total: number): string {
  return `Đã đạt ${earned}/${total}`;
}

/** Daily goal line, e.g. "Đã đạt mục tiêu ngày 4 lần". */
export function achievementsDailyGoalLabel(count: number): string {
  if (count === 0) return STRINGS.achievementsNoDailyGoal;
  return `Đã đạt mục tiêu ngày ${count} lần`;
}

/** "Còn N XP" for a stage not yet reached. */
export function achievementsXpLeftLabel(xp: number): string {
  return `Còn ${xp} XP`;
}

/** "Streak a/b". */
export function achievementsStreakLabel(current: number, days: number): string {
  return `Streak ${current}/${days}`;
}

/** Earned date line, e.g. "Đạt ngày 10/03/2026". */
export function achievementsEarnedOnLabel(date: string): string {
  return `Đạt ngày ${date}`;
}

/** Entry on the Làm tab, e.g. "Kiểm tra liên hệ trùng (2)". */
export function duplicatesEntryLabel(count: number): string {
  return `Kiểm tra liên hệ trùng (${count})`;
}

/** Button text for keeping one code when merging, e.g. "Giữ mã 123456". */
export function keepCodeLabel(code: string): string {
  return `Giữ mã ${code}`;
}

/** Result line after "Gộp tất cả", e.g. "Đã gộp 3 cặp". */
export function mergedCountLabel(count: number): string {
  return `Đã gộp ${count} cặp`;
}

/** Button name for "Tách" of one absorbed contact. */
export function splitLabel(name: string): string {
  return `Tách ${name}`;
}

/** Warning shown when another person has the same Amway code, e.g. "Trùng mã số với Lan, Hà". */
export function duplicateCodeWarning(names: string): string {
  return `Trùng mã số với ${names}`;
}

/** Shared text for Zalo: phone, temporary password and the reminder to change it (story 024). */
export function createAccountShareText(phone: string, password: string, appUrl?: string): string {
  const link = appUrl === undefined || appUrl === '' ? '' : `Ứng dụng: ${appUrl}\n`;
  return `${link}Số điện thoại: ${formatE164(phone)}\nMật khẩu tạm: ${password}\nHãy đổi mật khẩu khi đăng nhập lần đầu.`;
}

/** The app's own address (origin + path, without index.html, query or hash), for the share text (2026-11-25). */
export function appLink(location: Pick<Location, 'origin' | 'pathname'>): string {
  return `${location.origin}${location.pathname.replace(/index\.html$/, '')}`;
}

/**
 * Vietnamese message for a failed auth call; never says whether a phone number exists.
 * `code` (the server's error code) is shown only for unexpected server errors, so they can be reported.
 */
export function authFailureText(reason: AuthFailure, code?: string): string {
  switch (reason) {
    case 'invalid-phone':
      return STRINGS.loginInvalidPhone;
    case 'bad-credentials':
      return STRINGS.authBadCredentials;
    case 'network':
      return STRINGS.authNetworkError;
    case 'same-password':
      return STRINGS.passwordSameAsTemporary;
    case 'session-expired':
      return STRINGS.authSessionExpired;
    case 'reauthentication-needed':
      return STRINGS.authReauthenticationNeeded;
    case 'weak-password':
      return STRINGS.authWeakPassword;
    case 'server':
      return code === undefined ? STRINGS.authServerError : `${STRINGS.authServerError} ${STRINGS.authErrorCode(code)}`;
  }
}

/** Vietnamese message for a rejected new password. */
export function passwordProblemText(problem: PasswordProblem): string {
  switch (problem) {
    case 'too-short':
      return STRINGS.passwordTooShort;
    case 'mismatch':
      return STRINGS.passwordMismatch;
    case 'same-as-temporary':
      return STRINGS.passwordSameAsTemporary;
  }
}

/** Vietnamese message for a failed sync or consent call. */
export function syncFailureText(reason: SyncFailure): string {
  switch (reason) {
    case 'network':
      return STRINGS.syncNetworkError;
    case 'server':
      return STRINGS.syncServerError;
    case 'denied':
      return STRINGS.syncDenied;
    case 'no-household':
      return STRINGS.syncNoHousehold;
  }
}

/** "Đồng bộ lần cuối: 14:05 07/11/2026" (device time zone). */
export function contactSyncLastSyncedLabel(iso: string): string {
  const at = new Date(iso);
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(at);
  const date = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(at);
  return `Đồng bộ lần cuối: ${time} ${date}`;
}

/** "x/2 thành viên". */
export function householdCountLabel(count: number, max: number): string {
  return `${count}/${max} người`;
}

/** Note shown instead of the add button when the household is full. */
export function householdFullNote(max: number): string {
  return `Mã số đã đủ ${max} người`;
}

/** "KH 12/30". */
export function groupCustomersLabel(count: number, target: number): string {
  return `KH ${count}/${target}`;
}

/** "NPP F1 12/30". */
export function groupF1Label(count: number, target: number): string {
  return `NPP F1 ${count}/${target}`;
}

/** "3 ngày chưa hoạt động". */
export function groupInactiveLabel(days: number): string {
  return `${days} ngày chưa hoạt động`;
}

/** "Cập nhật lúc 14:05 07/11/2026" (device time zone). */
export function groupUpdatedLabel(iso: string): string {
  const at = new Date(iso);
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(at);
  const date = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(at);
  return `cập nhật lúc ${time} ${date}`;
}

/** Aria label of the cheer button of one household. */
export function groupCheerAria(name: string): string {
  return `Cổ vũ ${name}`;
}

/** "Đã huỷ 07/11/2026" (device time zone). */
export function adminCancelledLabel(iso: string): string {
  const date = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
  return `${STRINGS.adminCancelledTag} ${date}`;
}

/** Vietnamese text of a code's cancel reason; unknown reasons are shown as stored. */
export function adminCancelReason(reason: string): string {
  const known: Record<string, string> = { replaced: 'đã thay bằng mã mới', merged: 'gộp mã', dissolved: 'mã số giải thể' };
  return known[reason] ?? reason;
}

/** Aria label of the reset button of one member. */
export function adminResetAria(name: string): string {
  return `Đặt lại mật khẩu của ${name}`;
}

/** "23/150" (story 047). */
export function badgesSummaryLabel(earned: number, total: number): string {
  return `${earned}/${total}`;
}

/** Badge card accessible progress, e.g. "đã đạt 2/5 mốc". */
export function badgeProgressLabel(reached: number, total: number): string {
  return `đã đạt ${reached}/${total} mốc`;
}

/** Received cheer card title with the sender (story 049), e.g. "Lời cổ vũ từ Anh Bình". */
export function cheerFromLabel(senderName: string): string {
  return `Lời cổ vũ từ ${senderName}`;
}
