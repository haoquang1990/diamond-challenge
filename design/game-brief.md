# Game Brief: Diamond Challenge

**One-sentence pitch:** CRM được game hoá cho nhà phân phối Amway: một Danh bạ duy nhất, mỗi người có danh sách việc cần làm (Liên hệ, Demo, Trình bày opp, Follow-up, Chốt khách hàng, Chốt NPP) và nhãn KH / NPP khi bạn chốt. Mỗi việc làm thật với một người và mỗi bài học ngắn đều cho XP, giữ streak và đẩy bạn tiến trên Con đường Diamond, cùng một Bảng 30x30 của chính bạn.

## Core loop
- Mở app, vào màn **Hôm nay**: thấy streak, XP hôm nay so với mục tiêu ngày, cùng hai nút **Học** và **Làm**.
- **Làm**: chọn **một người** trong Danh bạ (hoặc thêm người mới), chọn một việc còn trong danh sách của người đó (liên hệ, demo, opp, follow-up, chốt khách hàng, chốt NPP), nhận XP; việc đó biến khỏi danh sách và vào lịch sử. Chốt khách hàng / Chốt NPP gắn nhãn KH / NPP.
- **Học**: làm một bài kỹ năng ngắn (3–5 câu, khoảng 2 phút) để nhận XP.
- Đạt mục tiêu ngày thì streak +1. Tổng XP đẩy bạn tiến trên bản đồ Con đường Diamond. Danh bạ cho thấy ai đang chờ bạn bước tiếp theo, đó là lý do để ngày mai quay lại.

## Thực thể trung tâm: Người
- **Một Danh bạ duy nhất.** Mỗi người có tên, ghi chú, số điện thoại (chọn mã nước, mặc định +84), danh sách việc cần làm và tối đa một **nhãn**: KH hoặc NPP (do chốt). Bộ lọc: Tất cả / Khách hàng / NPP / Đã lưu trữ.
- Mỗi hoạt động gắn với một người. Làm xong một việc thì việc đó biến khỏi danh sách (trừ Follow-up).
- Danh sách việc và XP của từng việc lấy từ file cấu hình. Dữ liệu giai đoạn cũ được chuyển sang mô hình này khi đọc, không mất lịch sử và XP.
- Toàn bộ thông tin về người lưu trên máy và được tính lại từ nhật ký sự kiện, giống XP và streak.
- Mỗi người chỉ quản lý danh sách của chính mình: KH và NPP F1 của mình.
- **Giai đoạn 1:** mục tiêu 30x30 (≥30 KH, ≥30 NPP F1), mốc phụ 250 liên hệ. Mục tiêu 30x30x4x4 và Bảng 4x4 ở giai đoạn 2 (`design/phase-2-notes.md`). Chi tiết ở `design/gdd/crm.md`.

## Player goal & fail state — what "working" looks like
- **Mục tiêu:** mỗi ngày đạt mục tiêu XP (có ít nhất 1 Học và 1 Làm), duy trì streak, đưa người trong danh sách tiến qua các giai đoạn, và đi hết các chặng tới Diamond.
- **Thất bại:** qua nửa đêm (giờ máy) mà chưa đạt mục tiêu ngày thì streak về 0.

## MVP — what must exist to be the game
1. **Danh bạ + việc cần làm + nhãn KH/NPP:** thêm và sửa người (kèm số điện thoại), lọc theo nhãn, lưu trữ và khôi phục, hoàn thành việc để nhận XP. Việc và XP lấy từ cấu hình.
2. **Ghi hoạt động gắn với một người:** chọn người, chọn một việc còn trong danh sách của người đó, nhận XP; chốt khách hàng / chốt NPP gắn nhãn.
3. **Bài Học ngắn:** trắc nghiệm 3–5 câu lấy từ file dữ liệu.
4. **Hôm nay: mục tiêu ngày + streak:** streak, thanh XP ngày, phần còn thiếu, lối vào Học và Làm.
5. **Bản đồ Con đường Diamond và Bảng 30x30:** các chặng tạo động lực, mở khóa theo tổng XP và mốc hoạt động; bảng hiện tiến độ của mình (liên hệ/KH/NPP F1), số liệu tính từ danh sách, không phải xác nhận chính thức.
6. **Lưu cục bộ, sẵn sàng đồng bộ, có sao lưu và khôi phục bằng file:** dữ liệu là nhật ký sự kiện lưu trên máy. Người dùng xuất được một file sao lưu và nhập lại file đó (ví dụ khi đổi điện thoại).
7. **Nhắc nhở hằng ngày:** banner trong app, cộng thông báo cục bộ nếu trình duyệt hỗ trợ.

## Out of scope — not building this
- Giải đấu tuần trong nhóm, tài khoản, server, đồng bộ (giai đoạn 2).
- **Tạo tài khoản cho NPP F1, cây hệ thống nhiều tầng, đồng bộ số tổng hợp và Bảng 4x4** (giai đoạn 2, `design/phase-2-notes.md`).
- Đưa danh sách Người lên server hay chia sẻ cho tuyến trên.
- Nhập danh bạ điện thoại tự động.
- Bảng xếp hạng, bạn bè, chat, chia sẻ mạng xã hội.
- Kết nối với doanh số, PV, BV thật của Amway. Bản đồ là lộ trình thói quen, không phải xác nhận danh hiệu chính thức.
- Logo, thương hiệu và tài liệu chính thức của Amway.
- Streak freeze, cửa hàng hay tiền ảo, trình soạn bài học trong app.

## Build order
1. ~~Nhật ký sự kiện + tính XP/streak~~ (đã có).
2. ~~Làm, Hôm nay, Học, Bản đồ, Nhắc nhở~~ (đã có, Làm hiện chưa gắn với người).
3. **Mô hình Người trong nhật ký sự kiện**: thêm người, sửa người, chuyển giai đoạn, kèm XP chuyển giai đoạn và tính 30x30 (hàm thuần có test). Đây là phần rủi ro nhất vì thay đổi cấu trúc sự kiện.
4. **Màn Danh bạ**, **Hoạt động gắn với người** (gồm xử lý các hoạt động cũ chưa gắn với ai) và **màn Bảng 30x30** (đã có). Chỉnh sửa theo phản hồi dùng thử (2026-11-04): thay giai đoạn bằng việc cần làm + nhãn, thêm lọc, lưu trữ/khôi phục, số điện thoại, chuyển dữ liệu cũ (`design/gdd/crm.md`).
5. **Sao lưu và khôi phục bằng file**.

---
**Who it's for / what they feel:** Nhà phân phối Amway đang xây dựng kinh doanh. Họ thấy rõ từng người trong danh sách đang ở đâu và mình tiến bộ mỗi ngày, và thấy tiếc khi để đứt streak hoặc bỏ quên một người.

**Art & audio direction:** Giao diện phẳng, tươi sáng kiểu Duolingo, điểm nhấn kim cương xanh, có tiếng "ting" ngắn khi nhận XP.

**Reference game:** Duolingo, chỉ lấy mục tiêu XP ngày, streak và bản đồ lộ trình. Phần danh sách theo giai đoạn giống một pipeline CRM đơn giản (như Trello hay một phễu bán hàng), nhưng chỉ có một danh sách và không có tùy chỉnh.
