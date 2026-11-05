# Quick Design Spec: Hệ thống thông báo thành tích

**Type**: New Small System
**Scope**: Toast nhỏ khi được cộng XP, popup lớn khi đạt danh hiệu hoặc mốc, ghi nhận bằng sự kiện trong nhật ký, mục "Thành tích" để xem lại, tùy chọn tắt âm thanh. Không đổi cách tính XP, streak, chặng hay 30x30.
**Date**: 2026-11-05
**Estimated Implementation**: khoảng 3–5 ngày (stories 016, 017, 018)
**GDD Reference**: `design/game-brief.md` (không có GDD riêng cho hệ thống này)

## Overview

Mỗi lần được cộng XP, một toast nhỏ hiện ở mép trên rồi tự ẩn, không chặn thao tác. Khi đạt một danh hiệu hoặc mốc (lên chặng Con đường, đạt mục tiêu ngày, streak 7/30/100, các mốc 30x30), một popup chặn màn hình hiện ngay tại màn đang dùng, có hiệu ứng kim cương và pháo giấy, một câu khích lệ ngẫu nhiên và nút "Tuyệt vời!". Mỗi mốc chỉ hiện một lần và được ghi nhận bằng sự kiện, nên tải lại trang hay khôi phục sao lưu không làm hiện lại. Danh sách mốc, tên và câu khích lệ nằm trong `game-config.json`.

## Core Rules

1. **Cấu hình** `game-config.json`, mục `achievements`: `toastMs` (2000), `maxPopupsPerAction` (3), `soundDefault` (true), `encouragements[]`, và `items[]`. Mỗi mục có `id`, `kind`, `name` và tham số theo loại:

   | kind | Mốc mặc định | Điều kiện đạt |
   |---|---|---|
   | `stage` | Silver, Gold, Platinum, Emerald, Diamond (`stageId`) | chặng hiện tại theo `computeStageProgress` đạt hoặc vượt chặng đó |
   | `daily_goal` | Đạt mục tiêu ngày | `dailyGoal.met` của hôm nay |
   | `streak` | 7, 30, 100 ngày (`days`) | streak hiện tại ≥ `days` |
   | `people` | Khách hàng đầu tiên, NPP đầu tiên, 250 liên hệ, 30 khách hàng, 30 NPP F1, đạt 30x30 (`metric`: `customers` / `f1` / `contacts` / `achieved30x30`, `threshold`: số hoặc `"target"`) | số đếm của `computePeopleStats` ≥ ngưỡng; `"target"` đọc từ `target30x30` |

   Thêm một mốc cùng loại chỉ cần thêm dòng vào cấu hình, không sửa code. Cấu hình hỏng thì bỏ mục đó và báo `problems`, không lỗi.
2. **Ghi nhận** bằng sự kiện có sẵn, không thêm kiểu sự kiện mới:
   - chặng: `settings_changed { stageAcknowledged }` hiện có;
   - mốc khác: `settings_changed { achievementAcknowledged: <id> }`; mục tiêu ngày dùng id `daily_goal:YYYY-MM-DD` để mỗi ngày hiện một lần;
   - sự kiện được ghi lúc popup bắt đầu hiện; không bao giờ bị bù trừ, nên hoàn tác tụt dưới mốc rồi đạt lại không hiện lại popup.
3. **Khi nào kiểm tra:** sau mỗi lần ghi sự kiện (lớp bọc quanh `EventStore` báo nhật ký vừa đổi), khi mở app và khi đổi tab. Hàm thuần `evaluateAchievements(events, config, now, timeZone)` trả về các mốc đang đạt; mốc mới = đang đạt mà chưa ghi nhận.
4. **Mốc đã đạt từ trước:** lần mở đầu tiên sau cập nhật (chưa có `settings_changed { achievementsSeeded: true }`), app ghi nhận im lặng mọi mốc đang đạt (`achievementAcknowledged` kèm `silent: true`) rồi ghi `achievementsSeeded`. Sau khi nhập file sao lưu cũng chạy lại bước im lặng này, nên khôi phục không bật popup. Chặng đang chờ mừng theo luật `shouldCelebrate` vẫn được hiện như hiện nay.
5. **Toast:** khi một sự kiện có `xp > 0` được ghi (trừ sự kiện bù trừ). Nội dung "+15 XP · Demo sản phẩm" (tên việc cần làm hoặc loại hoạt động; bài Học ghi "Bài Học"). Hiện ở mép trên khoảng `toastMs`, `pointer-events: none`, `role="status"`, không chặn thao tác. Xếp hàng lần lượt, không chồng nhau; quá 3 toast đang chờ thì gộp phần thừa vào toast cuối thành "+X XP · N hoạt động". Đang có popup thì toast chờ tới khi popup đóng.
6. **Âm thanh:** tiếng "ting" chỉ phát từ toast và popup; các chỗ đang gọi `playTing` trực tiếp (làm việc cho người, thêm người, bài Học, thẻ chặng) bỏ gọi để không kêu đôi. Công tắc "Âm thanh thưởng" trong Cài đặt lưu bằng `settings_changed { sound: { enabled } }`, mặc định theo `soundDefault`; tắt thì cả toast và popup đều im.
7. **Popup:** hộp thoại chặn màn hình (`role="dialog"`, `aria-modal`, tiêu điểm ở nút), hiện ngay tại màn đang dùng, hiệu ứng kim cương và pháo giấy, tên mốc, một câu khích lệ chọn ngẫu nhiên từ `encouragements` (không lặp câu vừa hiện; danh sách trống thì dùng câu mặc định), nút "Tuyệt vời!" (Enter/Esc đóng). Thay thẻ "Bạn đã lên chặng…" đang nằm trên Hôm nay.
8. **Nhiều mốc cùng lúc:** xếp theo thứ tự chặng → mục tiêu ngày → streak → people. Nếu số mốc ≤ `maxPopupsPerAction` thì hiện từng popup; nếu nhiều hơn thì hiện `maxPopupsPerAction − 1` popup đơn rồi một popup "Bạn vừa đạt thêm N thành tích" gộp phần còn lại.
9. **Giảm chuyển động** (`prefers-reduced-motion: reduce`): không pháo giấy, không trượt hay nhấp nháy; popup và toast hiện tĩnh.
10. **Mục "Thành tích":** nút "Thành tích" trên màn Con đường, cạnh Bảng 30x30, mở màn có nút quay lại, tiêu đề "Đã đạt X/Y". Mốc đã đạt có tên và ngày đạt; mốc chưa đạt hiện xám kèm cách đạt và tiến độ (ví dụ "Khách hàng 12/30"). Mục tiêu ngày hiện "Đã đạt mục tiêu ngày N lần". Mốc đạt rồi vẫn hiện là đạt dù sau đó tụt xuống.

## Tuning Knobs

| Knob | Default | Range | Category | Rationale |
|------|---------|-------|----------|-----------|
| `achievements.toastMs` | 2000 | 1000–5000 | feel | đủ đọc một dòng ngắn mà không cản |
| `achievements.maxPopupsPerAction` | 3 | 1–5 | gate | tránh dồn popup, theo yêu cầu |
| `achievements.soundDefault` | true | true/false | feel | giữ tiếng "ting" như hiện tại |
| `achievements.encouragements[]` | khoảng 8 câu | ≥ 1 | feel | câu khích lệ ngẫu nhiên |
| `achievements.items[]` | 5 chặng, 1 mục tiêu ngày, 3 streak, 6 people | — | gate | thêm mốc không cần sửa code |

All values live in `src/config/game-config.json`, not hardcoded.

## Acceptance Criteria

- [ ] AC-1: làm một việc +10 XP thì hiện toast "+10 XP · <tên việc>" ở mép trên, tự ẩn sau khoảng 2 giây, không chặn bấm; đúng một tiếng ting.
- [ ] AC-2: làm 5 việc liên tiếp thì toast xếp hàng, không chồng nhau; quá 3 toast chờ thì gộp "+X XP · N hoạt động".
- [ ] AC-3: lên chặng Silver thì popup hiện ngay tại màn đang dùng, có tên chặng, câu khích lệ từ cấu hình và nút "Tuyệt vời!"; tải lại không hiện lại.
- [ ] AC-4: đạt mục tiêu ngày thì popup một lần trong ngày; ngày hôm sau đạt lại thì hiện lại; hoàn tác rồi đạt lại cùng ngày thì không.
- [ ] AC-5: streak đạt 7 (rồi 30, 100) thì popup tương ứng đúng một lần.
- [ ] AC-6: khách hàng đầu tiên, NPP đầu tiên, 250 liên hệ, 30 khách hàng, 30 NPP F1, đạt 30x30 mỗi mốc hiện popup đúng một lần khi vừa đạt.
- [ ] AC-7: một hành động đạt 4 mốc thì hiện 2 popup đơn rồi "Bạn vừa đạt thêm 2 thành tích"; đạt 3 mốc thì 3 popup đơn.
- [ ] AC-8: hoàn tác làm tụt dưới mốc rồi đạt lại thì không hiện lại popup; mốc vẫn là đã đạt trong Thành tích.
- [ ] AC-9: lần mở đầu sau cập nhật với dữ liệu đã có chặng, streak, khách hàng thì không bật popup nào; các mốc đó hiện đã đạt trong Thành tích.
- [ ] AC-10: xuất sao lưu, mở trình duyệt mới, nhập file thì không bật popup nào.
- [ ] AC-11: thêm một mốc streak mới vào cấu hình thì có popup và dòng trong Thành tích, không sửa code.
- [ ] AC-12: với `prefers-reduced-motion: reduce` không có pháo giấy hay chuyển động; popup vẫn đọc và đóng được.
- [ ] AC-13: tắt "Âm thanh thưởng" thì toast và popup đều không kêu; lựa chọn giữ sau tải lại và sau khôi phục sao lưu.
- [ ] AC-14: màn Thành tích hiện "Đã đạt X/Y", mốc đã đạt có ngày, mốc chưa đạt có tiến độ.
- [ ] AC-15: mobile-first 390×844 và 320px, nút ≥ 44px, popup đóng được bằng bàn phím.
- [ ] AC-16: không hồi quy: XP, streak, mục tiêu ngày, mốc Con đường và Bảng 30x30 tính như cũ.

## Systems Index

Không có `design/gdd/systems-index.md` ở tier minimal. Hệ thống này dưới ngưỡng cần GDD riêng — quick spec là đủ; brief được cập nhật một đoạn.
