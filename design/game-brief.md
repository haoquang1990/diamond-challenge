# Game Brief: Diamond Challenge

**One-sentence pitch:** Duolingo cho nhà phân phối Amway — mỗi ngày học một bài kỹ năng ngắn và ghi một việc làm thật, giữ streak và tiến từng chặng trên Con đường Diamond.

## Core loop
- Mở app → màn **Hôm nay**: streak, XP hôm nay / mục tiêu ngày, hai nút **Học** / **Làm**.
- **Học**: một bài kỹ năng ngắn (3–5 câu, ~2 phút) → nhận XP.
- **Làm**: ghi một hoạt động thật (thêm tên vào danh sách, demo, opp, follow-up, khách hàng mới…) → nhận XP theo loại.
- Đạt mục tiêu ngày → streak +1, XP đẩy bạn tiến trên bản đồ Con đường Diamond → ngày mai quay lại giữ streak.

## Player goal & fail state — what "working" looks like
- **Mục tiêu:** đạt mục tiêu XP ngày (ít nhất 1 Học + 1 Làm), duy trì streak, đi hết các chặng tới Diamond.
- **Thất bại:** hết ngày (nửa đêm giờ máy) chưa đạt mục tiêu ngày → streak về 0.

## MVP — what must exist to be the game
1. **Ghi hoạt động Làm** — chọn loại, ghi chú tùy chọn, cộng XP; danh sách loại và XP từ file cấu hình.
2. **Bài Học ngắn** — bài trắc nghiệm 3–5 câu từ file dữ liệu; ~5 bài mẫu.
3. **Mục tiêu ngày + streak** — quy tắc như trên, ngưỡng XP cấu hình được.
4. **Bản đồ Con đường Diamond** — các chặng động lực (vd. Khởi động → Silver → Gold → Platinum → Emerald → Diamond), mở theo tổng XP và mốc hoạt động.
5. **Màn Hôm nay** — streak, thanh XP ngày, lối vào Học / Làm, chặng hiện tại.
6. **Lưu cục bộ, sẵn sàng đồng bộ** — nhật ký sự kiện (UUID, thời điểm, `user_id` cục bộ, `schema_version`); XP và streak tính lại từ nhật ký.
7. **Nhắc nhở hằng ngày** — thông báo cục bộ vào giờ người dùng chọn.

## Out of scope — not building this
- Giải đấu tuần trong nhóm, tài khoản, server, đồng bộ (giai đoạn 2).
- Bảng xếp hạng, bạn bè, chat, chia sẻ mạng xã hội.
- Kết nối doanh số / PV / BV thật của Amway — bản đồ là lộ trình thói quen, không phải xác nhận danh hiệu chính thức.
- Logo, thương hiệu, tài liệu chính thức của Amway.
- Streak freeze, cửa hàng / tiền ảo, trình soạn bài học trong app.

## Build order
1. Mô hình dữ liệu nhật ký sự kiện + tính XP / streak từ nhật ký (unit test) — nền móng cho đồng bộ sau này.
2. Ghi hoạt động Làm + màn Hôm nay — chứng minh vòng lặp hằng ngày đủ nhanh, đã tay.
3. Bài Học ngắn.
4. Bản đồ Con đường Diamond.
5. Nhắc nhở hằng ngày — phụ thuộc nền tảng, rủi ro nhất về kỹ thuật; kiểm tra khả thi ngay khi chọn engine.

---
**Who it's for / what they feel:** Nhà phân phối Amway đang xây dựng kinh doanh — thấy mình tiến bộ mỗi ngày và "tiếc" khi đứt streak.

**Art & audio direction:** UI phẳng, tươi sáng kiểu Duolingo, điểm nhấn kim cương xanh; tiếng "ting" ngắn khi nhận XP.

**Reference game:** Duolingo — giữ mục tiêu XP ngày, streak và bản đồ lộ trình; bỏ giải đấu, hearts, gems.
