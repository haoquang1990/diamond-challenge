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
  amwayCodeLabel: 'Mã số Amway (không bắt buộc)',
  amwayCodePlaceholder: 'Vd. 1234567',
  amwayCodeInvalid: 'Mã số Amway chỉ gồm chữ số (được cách bằng dấu cách, chấm hoặc gạch) và dài từ 4 đến 15 chữ số.',
  personDetailAmwayCode: 'Mã số Amway',
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

  // Tài khoản (story 021)
  accountHeading: 'Tài khoản',
  accountSignedOut: 'Chưa đăng nhập',
  accountSignedOutHint: 'Không cần đăng nhập để dùng app. Đăng nhập chỉ để dùng các tính năng cần tài khoản.',
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
  createAccountNeedsCode: 'Nhập mã số Amway trước',
  createAccountNeedsNetwork: 'Cần có mạng để tạo tài khoản',
  createAccountHasAccount: 'Đã có tài khoản',
  createAccountWarnArchived: 'Người này đã có tài khoản và đang được lưu trữ. Tài khoản vẫn được giữ.',
  createAccountWarnNotNpp: 'Người này đã có tài khoản nhưng không còn nhãn NPP. Tài khoản vẫn được giữ.',
  createAccountTitle: 'Tạo tài khoản',
  createAccountPrompt: 'Tạo tài khoản cho người này bằng số điện thoại. App sẽ sinh một mật khẩu tạm để bạn gửi cho họ.',
  createAccountCodeLine: 'Mã số Amway',
  createAccountSubmit: 'Tạo tài khoản',
  createAccountSubmitting: 'Đang tạo…',
  createAccountPhoneRequired: 'Hãy nhập số điện thoại.',
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
    code_taken: 'Mã số Amway này đã được một hộ khác dùng.',
    no_household: 'Bạn chưa thuộc hộ nào nên chưa tạo được tài khoản.',
    not_allowed: 'Bạn không có quyền tạo tài khoản.',
    household_full_or_inactive: 'Hộ của bạn đã đủ thành viên hoặc không còn hoạt động.',
    create_failed: 'Máy chủ chưa tạo được tài khoản. Thử lại sau ít phút nhé.',
    network: 'Không có kết nối mạng. Kiểm tra mạng rồi thử lại nhé.',
    unknown: 'Chưa tạo được tài khoản. Thử lại sau nhé.',
  },

  // Hộ của tôi và Thêm vợ/chồng (story 025)
  householdEntry: 'Hộ của tôi',
  householdTitle: 'Hộ của tôi',
  householdPrompt: 'Mã số Amway và các thành viên trong hộ của bạn.',
  householdCodeLabel: 'Mã số Amway',
  householdNoCode: 'Chưa có mã',
  householdMembersHeading: 'Thành viên',
  householdNoHousehold: 'Tài khoản này chưa thuộc hộ nào.',
  householdOffline: 'Cần có mạng để xem thông tin hộ. Kết nối mạng rồi thử lại nhé.',
  householdLoadError: 'Chưa tải được thông tin hộ. Thử lại nhé.',
  householdMemberUnnamed: 'Chưa có tên',
  addMemberButton: 'Thêm vợ/chồng',
  addMemberOfflineReason: 'Cần có mạng để thêm vợ/chồng.',
  addMemberTitle: 'Thêm vợ/chồng',
  addMemberPrompt: 'Tạo tài khoản cho vợ/chồng bằng số điện thoại. App sẽ sinh một mật khẩu tạm để bạn gửi cho họ.',
  addMemberSubmit: 'Thêm vào hộ',
  addMemberSubmitting: 'Đang thêm…',
  addMemberDone: 'Đã thêm vào hộ',
  addMemberErrors: {
    not_signed_in: 'Bạn cần đăng nhập để thêm thành viên.',
    change_password_first: 'Hãy đổi mật khẩu tạm của bạn trước khi thêm thành viên.',
    invalid_phone: 'Số điện thoại chưa đúng. Kiểm tra mã nước và số điện thoại.',
    invalid_password: 'Mật khẩu tạm không hợp lệ. Thử lại nhé.',
    phone_taken: 'Số điện thoại này đã có tài khoản. Hãy nhờ quản trị viên hỗ trợ.',
    no_household: 'Bạn chưa thuộc hộ nào nên chưa thêm được thành viên.',
    household_full_or_inactive: 'Hộ đã đủ thành viên hoặc không còn hoạt động.',
    not_allowed: 'Bạn không có quyền thêm thành viên vào hộ này.',
    not_found: 'Không tìm thấy hộ này.',
    create_failed: 'Máy chủ chưa thêm được thành viên. Thử lại sau ít phút nhé.',
    network: 'Không có kết nối mạng. Kiểm tra mạng rồi thử lại nhé.',
    unknown: 'Chưa thêm được thành viên. Thử lại sau nhé.',
  },

  // Đồng bộ Danh bạ hộ (story 023)
  consentTitle: 'Đồng bộ Danh bạ trong hộ',
  consentIntro:
    'Để đồng bộ với các thành viên trong hộ, Danh bạ của bạn (tên, số điện thoại, mã số Amway, ghi chú, nhãn, việc cần làm và lịch sử) sẽ được lưu trên máy chủ đặt tại Singapore.',
  consentMembersOnly: 'Chỉ thành viên trong hộ của bạn xem được Danh bạ này qua app.',
  consentAdmins: 'Quản trị viên của dự án có thể truy cập dữ liệu trên máy chủ.',
  consentDeclineNote: 'Nếu không đồng ý, app vẫn dùng bình thường và Danh bạ chỉ nằm trên máy này. Bạn có thể bật lại trong Cài đặt.',
  consentAgree: 'Đồng ý',
  consentDecline: 'Không đồng ý',
  contactSyncHeading: 'Đồng bộ Danh bạ hộ',
  contactSyncSignedOut: 'Đang tắt. Đăng nhập để đồng bộ Danh bạ trong hộ.',
  contactSyncChecking: 'Chưa kiểm tra được bạn đã đồng ý hay chưa. Cần có mạng.',
  contactSyncOff: 'Đang tắt. Danh bạ chỉ nằm trên máy này.',
  contactSyncNotConsented: 'Chưa đồng ý lưu Danh bạ trên máy chủ.',
  contactSyncEnable: 'Bật đồng bộ',
  contactSyncNow: 'Đồng bộ ngay',
  contactSyncIdle: 'Chưa đồng bộ.',
  contactSyncSyncing: 'Đang đồng bộ…',
  syncNetworkError: 'Không có mạng. App sẽ thử lại khi có mạng.',
  syncServerError: 'Máy chủ đang gặp sự cố. Thử lại sau ít phút nhé.',
  syncDenied: 'Máy chủ từ chối đồng bộ (có thể bạn không còn trong hộ). Đã dừng đồng bộ; dữ liệu trên máy vẫn giữ nguyên.',
  syncNoHousehold: 'Tài khoản chưa thuộc hộ nào nên chưa đồng bộ được. Dữ liệu trên máy vẫn giữ nguyên.',
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
export function createAccountShareText(phone: string, password: string): string {
  return `Số điện thoại: ${phone}\nMật khẩu tạm: ${password}\nHãy đổi mật khẩu khi đăng nhập lần đầu.`;
}

/** Vietnamese message for a failed auth call; never says whether a phone number exists. */
export function authFailureText(reason: AuthFailure): string {
  switch (reason) {
    case 'invalid-phone':
      return STRINGS.loginInvalidPhone;
    case 'bad-credentials':
      return STRINGS.authBadCredentials;
    case 'network':
      return STRINGS.authNetworkError;
    case 'same-password':
      return STRINGS.passwordSameAsTemporary;
    case 'server':
      return STRINGS.authServerError;
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
  return `${count}/${max} thành viên`;
}

/** Note shown instead of the add button when the household is full. */
export function householdFullNote(max: number): string {
  return `Hộ đã đủ ${max} thành viên`;
}
