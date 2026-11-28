# Epic: Diamond Challenge (MVP)

> **Source**: `design/game-brief.md`
> **Tier**: minimal (no GDD, no ADRs)

## Goal
Duolingo cho nhà phân phối Amway — mỗi ngày học một bài kỹ năng ngắn và ghi một việc làm thật, giữ streak và tiến từng chặng trên Con đường Diamond.

## Scope
MVP 7 mục của brief, một người dùng, dữ liệu lưu trên máy (IndexedDB), sẵn sàng đồng bộ. Ngoài phạm vi: giải đấu nhóm, tài khoản, server, bảng xếp hạng, dữ liệu doanh số thật, thương hiệu Amway.

## Order
Theo Build order của brief: nhật ký sự kiện + XP/streak → Làm + Hôm nay → Học → Bản đồ → Nhắc nhở (rủi ro kỹ thuật nhất, kiểm tra khả thi sớm).

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | Nhật ký sự kiện cục bộ | Logic | Ready | N/A |
| 002 | Mục tiêu ngày + streak | Logic | Ready | N/A |
| 003 | Ghi hoạt động Làm | UI | Ready | N/A |
| 004 | Màn Hôm nay | UI | Ready | N/A |
| 005 | Bài Học ngắn | UI | Ready | N/A |
| 006 | Bản đồ Con đường Diamond | UI | Ready | N/A |
| 007 | Nhắc nhở hằng ngày | Integration | Ready | N/A |
| 008 | Mô hình Người + XP chuyển giai đoạn + tính 30x30 | Logic | Ready | N/A |
| 009 | Màn danh sách Người + Làm gắn với một người | UI | Ready | N/A |
| 010 | Bảng 30x30 | UI | Ready | N/A |
| 011 | Sao lưu và khôi phục bằng file | Integration | Ready | N/A |
| 012 | Việc cần làm + nhãn KH/NPP + chuyển dữ liệu cũ | Logic | Ready | N/A |
| 013 | Danh bạ, bộ lọc, lưu trữ/khôi phục, chi tiết người | UI | Ready | N/A |
| 014 | Tab Hoạt động + Bảng 30x30 mở Danh bạ đã lọc | UI | Ready | N/A |
| 015 | Gộp Làm và Danh bạ thành một tab Làm | UI | Ready | N/A |
| 016 | Mô hình thành tích (cấu hình, đánh giá, ghi nhận, hàng đợi) | Logic | Ready | N/A |
| 017 | Toast cộng XP, popup thành tích, âm thanh và giảm chuyển động | UI | Ready | N/A |
| 018 | Màn Thành tích và khôi phục sao lưu không bật popup | UI | Ready | N/A |
| 021 | Đăng nhập, đổi mật khẩu lần đầu, tên hiển thị | UI | Ready | N/A |
| 022 | Mã số Amway trên liên hệ và cảnh báo trùng mã | UI | Ready | N/A |
| 023 | Đồng ý lưu trên server và đồng bộ Danh bạ hộ | Integration | Ready | N/A |
| 024 | "Tạo tài khoản" cho liên hệ NPP có mã số | UI | Ready | N/A |
| 025 | Màn "Hộ của tôi" và "Thêm vợ/chồng vào hộ" | UI | Ready | N/A |
| 026 | Gộp Danh bạ khi vào chung hộ (dò trùng, kiểm tra, gộp, tách) | UI | Ready | N/A |
| 027 | Bảng 30x30 theo hộ và đồng bộ số tổng hợp | UI | Ready | N/A |
| 028 | Màn "Nhóm của tôi" (một tầng), cảnh báo không hoạt động, cổ vũ | UI | Ready | N/A |
| 029 | Màn Quản trị tối thiểu (đặt lại mật khẩu, đặt mã số cho hộ) | UI | Ready | N/A |
| 030 | Bắt buộc đăng nhập, đồng ý bắt buộc, dữ liệu trên máy theo tài khoản | UI | Complete | N/A |
| 031 | Bảng `personal_events` trên server (migration, RLS, `sync_seq`) | Integration | Complete | N/A |
| 032 | Bộ đồng bộ tiến độ cá nhân trong app (đẩy, kéo, offline) | Integration | Complete | N/A |
| 033 | Văn bản đồng ý mới và chặn xoá dữ liệu theo tiến độ chưa đồng bộ | UI | Complete | N/A |
| 034 | Trang chi tiết người: thông tin mở sẵn, popup hoạt động và popup Lịch sử | UI | Complete | N/A |
| 035 | Trang chi tiết người: Thông tin lên đầu, nút Hoạt động mở danh sách đủ việc, làm lại mọi việc | UI | Complete | N/A |
| 036 | Bài học 5–7 câu, nhóm Khởi đầu, bổ sung 11 bài cũ | Logic | Complete | N/A |
| 037 | Tab Học theo chặng: con đường bài học có icon, popup bài | UI | Complete | N/A |
| 038 | Chia lại tab Học thành 18 chặng, mỗi chặng 5–7 bài | Config/Data | Complete | N/A |
| 039 | Thẻ "Bài nên học tiếp" trên Hôm nay | UI | Complete | N/A |
| 040 | Huỷ bảo trợ | Integration | Complete | N/A |
| 041 | Thẻ "Cổ vũ nhóm" trên Hôm nay | UI | Complete | N/A |
| 042 | Bỏ màn Bảng 30x30 và Nhóm của tôi; khung "Hộ F1" trong chi tiết NPP | UI | Complete | N/A |
| 043 | Bỏ Lưu trữ liên hệ | UI | Complete | N/A |
| 044 | Xếp NPP theo mức tích cực (Tổng XP, XP 7 ngày) kèm chuỗi ngày | Integration | Complete | N/A |
| 045 | Tab "Huy hiệu" thay Con đường; bỏ Cấp độ và ô Chặng hiện tại | UI | Complete | N/A |
| 046 | Hệ thống 150 huy hiệu nhiều bậc | Logic | Complete | N/A |
| 047 | Màn Huy hiệu | UI | Complete | N/A |
| 048 | Tuyến trên cấp lại mật khẩu tạm cho F1 chưa kích hoạt; link app khi chia sẻ | Integration | Complete | N/A |
| 049 | Cổ vũ hiện người gửi, cổ vũ vợ/chồng, chọn hoặc tự viết lời | Integration | Complete | N/A |
| 050 | Tuyến trên xem hoạt động của F1 và gợi ý lời cổ vũ | Integration | Complete | N/A |
| 051 | Trang chi tiết liên hệ: tóm tắt, ghi chú tự lưu, popup sửa | UI | Complete | N/A |
| 052 | Danh sách Làm hiện số ngày, sắp xếp theo hoạt động hoặc tên | UI | Complete | N/A |
| 053 | Hướng dẫn đưa app ra màn hình chính trong Cài đặt | UI | Complete | N/A |
| 054 | Một cách ghi số điện thoại (+84, không có số 0) và quy tắc số di động Việt Nam | Integration | Complete | N/A |
| 055 | Sắp xếp lại Cài đặt, gọi "hộ" là "mã số" (mã số kép) | UI | Complete | N/A |
| 056 | Mỗi người tự chọn mục tiêu XP hằng ngày | Integration | Complete | N/A |
| 057 | Thông báo đẩy khi được cổ vũ | Integration | In Progress | N/A |
| 058 | Nhắc mục tiêu bằng thông báo đẩy, gộp thẻ Thông báo | Integration | Complete | N/A |
| 059 | Liên kết thông tin giữa liên hệ và tài khoản F1 | UI | Complete | N/A |
| 060 | Dòng NPP hiện mục tiêu hôm nay và chuỗi ngày; ô NPP F1 gọn hơn | UI | Complete | N/A |
| 061 | Theo dõi tình hình vợ/chồng cùng mã số | UI | Complete | N/A |
| 062 | Mục tiêu hằng ngày gồm XP, số bài học và số việc làm | Logic | Complete | N/A |
| 063 | Thẻ "Bật thông báo" trên Hôm nay | UI | Complete | N/A |
| 064 | Chấm sau tên liên hệ: vợ/chồng thêm, cả hai cùng có | UI | Complete | N/A |
| 065 | Sửa ghi chú việc làm trong Lịch sử, Tóm tắt gọn | UI | Complete | N/A |
| 066 | Phụ trách liên hệ và lọc Của tôi / Của vợ chồng | UI | Complete | N/A |
| 067 | Nút Học / Làm trong Mục tiêu hôm nay, bỏ thẻ Bài nên học tiếp | UI | Complete | N/A |
| 068 | Bắt buộc mã số Amway cho tài khoản còn thiếu | UI | Complete | N/A |
| 069 | Kết bạn bằng mã số hoặc link, trang Nhóm | UI | Complete | N/A |
| 070 | Thẻ Nhóm trên Hôm nay, cổ vũ bạn bè và tuyến trên, cổ vũ có XP | UI | Complete | N/A |
| 071 | Chia sẻ với bạn bè và xếp hạng tuần | UI | Complete | N/A |

> 012–014 thay mô hình giai đoạn bằng việc cần làm + nhãn KH/NPP theo phản hồi dùng thử (2026-11-04, `design/gdd/crm.md`). Thứ tự gợi ý: 012 → 013 → 014 → 011.

> 016–018 thêm hệ thống thông báo thành tích (`design/quick-specs/achievements-system-2026-11-05.md`). Thứ tự: 016 → 017 → 018.

> 021–029 là giai đoạn 2a (tập trung 30x30, `design/gdd/accounts.md`, `design/gdd/crm.md`); 019–020 là phần server. Thứ tự: 021 → 022 → 023 → 024 → 025 → 026 → 027 → 028 → 029. Migration `sync_seq` (sửa ADR-0002) đã có; phải deploy trước khi thử 023 trên server. Không có story cho Bảng 4x4, cây nhiều tầng, gộp hai mã, Web Push (2b).

> 030 bắt buộc đăng nhập (xong 2026-11-17). 031–033 đồng bộ tiến độ cá nhân theo ADR-0004 (Accepted 2026-11-18). Thứ tự: 031 → 032 → 033. Migration của 031 chạy lên Supabase thật khi merge: deploy 031 trước hoặc cùng lúc với 032; deploy 033 sau khi 032 chạy ổn vì nó buộc mọi người đồng ý lại.

> 034 (2026-11-21) đổi trang chi tiết người theo phản hồi dùng thử: thông tin mở sẵn, bấm hoạt động mở popup ghi chú + ngày giờ, Lịch sử thành popup thống kê (`design/gdd/crm.md` luật 13, 26; AC-35–38). Không cần migration.

> 035 (2026-11-22) theo phản hồi dùng thử: thu gọn form sau khi thêm người, Thông tin lên đầu trang chi tiết, nút Hoạt động mở danh sách đủ việc, mọi việc làm lại được và cộng đủ XP mỗi lần; nhãn giữ ngày chốt đầu, mốc Khách hàng mới đếm người (`design/gdd/crm.md` luật 2, 4, 12, 13, 26; AC-39–42). Không cần migration.

> 036 (2026-11-24) chuẩn bị đưa 86 bài mới lên app (`design/lessons/outline.md`): giới hạn 5–7 câu mỗi bài, nhóm Khởi đầu đứng đầu, bổ sung 11 bài cũ lên 5 câu. Nội dung 86 bài làm thành 7 đợt, mỗi đợt người dùng duyệt chữ rồi mới deploy.

> 037 (2026-11-24) đổi danh sách bài trong tab Học thành con đường theo chặng (mẫu được duyệt 2026-11-24): icon từng bài, thẻ đầu chặng, cúp trang trí, popup bài; không khoá bài, không đổi XP.

> 039–043 (2026-11-24) theo phản hồi dùng thử: bài nên học tiếp và cổ vũ lên Hôm nay; huỷ bảo trợ (migration thêm loại sự kiện); bỏ Bảng 30x30, Nhóm của tôi và Lưu trữ liên hệ. Thứ tự: 039 → 040 → 041 → 042 → 043. 040 có migration chạy trên Supabase khi merge.

> 044 (2026-11-24) xếp NPP theo Tổng XP / XP 7 ngày kèm chuỗi ngày; mỗi tài khoản gửi số của mình lên bảng mới `member_progress` (migration chạy khi merge). Không đồng ý lại.

> 045–047 (2026-11-24) thay Con đường bằng tab Huy hiệu: 150 huy hiệu (35 thẻ + 18 "Xong chặng"), không cộng XP, ghi nhận im lặng huy hiệu đã có; bỏ Cấp độ. Không migration.
