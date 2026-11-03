# Game Brief: Diamond Challenge

**One-sentence pitch:** CRM được game hoá cho nhà phân phối Amway: một danh sách Người duy nhất mà bạn đưa dần từ "Người quen" tới "NPP tuyến dưới". Mỗi việc làm thật với một người, mỗi lần chuyển giai đoạn và mỗi bài học ngắn đều cho XP, giữ streak và đẩy bạn tiến trên Con đường Diamond, cùng một bảng theo dõi mục tiêu 30x30x4x4 của chính bạn.

## Core loop
- Mở app, vào màn **Hôm nay**: thấy streak, XP hôm nay so với mục tiêu ngày, cùng hai nút **Học** và **Làm**.
- **Làm**: chọn **một người** trong danh sách (hoặc thêm người mới), ghi một hoạt động thật với người đó (liên hệ, demo, opp, follow-up…), nhận XP. Khi người đó tiến lên giai đoạn tiếp theo thì nhận thêm XP chuyển giai đoạn.
- **Học**: làm một bài kỹ năng ngắn (3–5 câu, khoảng 2 phút) để nhận XP.
- Đạt mục tiêu ngày thì streak +1. Tổng XP đẩy bạn tiến trên bản đồ Con đường Diamond. Danh sách Người cho thấy ai đang chờ bạn bước tiếp theo, đó là lý do để ngày mai quay lại.

## Thực thể trung tâm: Người
- **Một danh sách duy nhất.** Mỗi người có tên, ghi chú, và đúng một **giai đoạn**:
  **Người quen → Đã liên hệ → Đã demo → Đã nghe opp → Khách hàng → NPP tuyến dưới**.
- Mỗi hoạt động Làm gắn với một người. Hoạt động có thể kéo theo việc chuyển giai đoạn của người đó.
- XP của từng loại hoạt động và XP chuyển tới từng giai đoạn được lấy từ file cấu hình.
- Toàn bộ thông tin về người lưu trên máy và được tính lại từ nhật ký sự kiện, giống XP và streak.
- Mỗi người có **Người bảo trợ** (chính mình hoặc một NPP) để dựng cây tuyến dưới; số KH và số NPP tầng 1 của mỗi người đều đếm từ danh sách.
- **Mục tiêu 30x30x4x4:** bản thân đạt 30x30 (≥30 khách hàng và ≥30 NPP tầng 1) và có ≥4 nhánh đạt chuẩn (mỗi nhánh có người đạt 30x30 ở ít nhất 4 tầng khác nhau). Mốc phụ: 250 liên hệ. Chi tiết ở `design/gdd/crm.md`.

## Player goal & fail state — what "working" looks like
- **Mục tiêu:** mỗi ngày đạt mục tiêu XP (có ít nhất 1 Học và 1 Làm), duy trì streak, đưa người trong danh sách tiến qua các giai đoạn, và đi hết các chặng tới Diamond.
- **Thất bại:** qua nửa đêm (giờ máy) mà chưa đạt mục tiêu ngày thì streak về 0.

## MVP — what must exist to be the game
1. **Danh sách Người + giai đoạn:** thêm và sửa người, xem theo giai đoạn, chuyển giai đoạn để nhận XP. Giai đoạn và XP lấy từ cấu hình.
2. **Ghi hoạt động Làm gắn với một người:** chọn người, chọn loại hoạt động, ghi chú tùy chọn, nhận XP, và có thể đồng thời chuyển giai đoạn.
3. **Bài Học ngắn:** trắc nghiệm 3–5 câu lấy từ file dữ liệu.
4. **Hôm nay: mục tiêu ngày + streak:** streak, thanh XP ngày, phần còn thiếu, lối vào Học và Làm.
5. **Bản đồ Con đường Diamond và Bảng 30x30x4x4:** các chặng tạo động lực, mở khóa theo tổng XP và mốc hoạt động; bảng hiện tiến độ của mình (liên hệ/KH/NPP) và 4 nhánh có điểm sâu cao nhất, số liệu tính từ danh sách, không phải xác nhận chính thức.
6. **Lưu cục bộ, sẵn sàng đồng bộ, có sao lưu và khôi phục bằng file:** dữ liệu là nhật ký sự kiện lưu trên máy. Người dùng xuất được một file sao lưu và nhập lại file đó (ví dụ khi đổi điện thoại).
7. **Nhắc nhở hằng ngày:** banner trong app, cộng thông báo cục bộ nếu trình duyệt hỗ trợ.

## Out of scope — not building this
- Giải đấu tuần trong nhóm, tài khoản, server, đồng bộ (giai đoạn 2).
- **Liên kết "NPP tuyến dưới" với tài khoản thật của người đó** (giai đoạn 2, làm cùng tài khoản do admin tạo).
- Đưa danh sách Người lên server hay chia sẻ cho tuyến trên.
- Nhập danh bạ điện thoại tự động.
- Bảng xếp hạng, bạn bè, chat, chia sẻ mạng xã hội.
- Kết nối với doanh số, PV, BV thật của Amway. Bản đồ là lộ trình thói quen, không phải xác nhận danh hiệu chính thức.
- Logo, thương hiệu và tài liệu chính thức của Amway.
- Streak freeze, cửa hàng hay tiền ảo, trình soạn bài học trong app.
- Đồng bộ số liệu tuyến dưới từ tài khoản thật (giai đoạn 2).

## Build order
1. ~~Nhật ký sự kiện + tính XP/streak~~ (đã có).
2. ~~Làm, Hôm nay, Học, Bản đồ, Nhắc nhở~~ (đã có, Làm hiện chưa gắn với người).
3. **Mô hình Người trong nhật ký sự kiện**: thêm người, sửa người, chuyển giai đoạn, kèm XP chuyển giai đoạn, cây bảo trợ và tính 30x30x4x4 (hàm thuần có test). Đây là phần rủi ro nhất vì thay đổi cấu trúc sự kiện.
4. **Màn danh sách Người**, **Làm gắn với người** (gồm xử lý các hoạt động cũ chưa gắn với ai) và **màn Bảng 30x30x4x4**.
5. **Sao lưu và khôi phục bằng file**.

---
**Who it's for / what they feel:** Nhà phân phối Amway đang xây dựng kinh doanh. Họ thấy rõ từng người trong danh sách đang ở đâu và mình tiến bộ mỗi ngày, và thấy tiếc khi để đứt streak hoặc bỏ quên một người.

**Art & audio direction:** Giao diện phẳng, tươi sáng kiểu Duolingo, điểm nhấn kim cương xanh, có tiếng "ting" ngắn khi nhận XP.

**Reference game:** Duolingo, chỉ lấy mục tiêu XP ngày, streak và bản đồ lộ trình. Phần danh sách theo giai đoạn giống một pipeline CRM đơn giản (như Trello hay một phễu bán hàng), nhưng chỉ có một danh sách và không có tùy chỉnh.
