# Story 007 — Bước 0: khảo sát khả thi nhắc nhở hằng ngày (PWA)

**Ngày**: 2026-11-03 · **Trạng thái**: CHƯA ĐỦ NGUỒN — kết luận bên dưới là tạm thời.

## Giới hạn của khảo sát này (đọc trước)
- Môi trường chạy khảo sát **không truy cập được** các trang chính thức: `developer.chrome.com`, `developer.mozilla.org`, `webkit.org` (lỗi DNS: nằm ngoài danh sách tên miền được phép). Vì vậy **không có nguồn chính thức nào được đọc trực tiếp**.
- Các nhận định "nguồn thứ cấp" dưới đây lấy từ **bản tóm tắt kết quả tìm kiếm web**, không phải từ việc đọc trang gốc; nhiều trang ghi ngày cũ (2019–2022).
- **Chưa thử trên thiết bị Android hay iOS thật.** Môi trường này không có thiết bị.

## A. Đo thực tế (đáng tin nhất): Chromium 153.0.8010.12, Playwright, bản build production
Chạy trang qua `http://localhost` (secure context), service worker đã active:

| Kiểm tra | Kết quả |
|---|---|
| `Notification` có tồn tại | có |
| `Notification.permission` ban đầu | `denied` (trình duyệt headless, chưa hỏi) |
| `'showTrigger' in Notification.prototype` | **không** |
| `typeof TimestampTrigger` | **undefined** |
| `registration.pushManager` | có |
| `registration.periodicSync` | có |
| `registration.sync` | có |
| `registration.showNotification` | có |

Ý nghĩa: **trên Chromium 153 mặc định, Notification Triggers (đặt lịch thông báo cục bộ theo giờ) không có.** Phép đo này chỉ nói về phiên bản và cấu hình đó, không nói về Chrome trên Android, Safari hay Firefox.

## B. Nguồn thứ cấp (bản tóm tắt tìm kiếm, chưa đọc trang gốc)
- **Notification Triggers:** một trang của Chrome ghi origin trial "Complete" và launch "Not started", trang dated tháng 10/2019. Cách dùng: `showTrigger` + `TimestampTrigger`, chỉ trong ngữ cảnh service worker, cần quyền thông báo, không phụ thuộc mạng. *Không tìm thấy nguồn nói API đã ra mắt chính thức hay đã bị gỡ.* Kết hợp với phép đo ở mục A, nhiều khả năng API chưa ra mắt rộng rãi, nhưng **đó là suy luận, chưa có nguồn xác nhận**.
- **iOS / iPadOS:** web push chỉ cho web app đã **thêm vào Màn hình chính**; hỏi quyền phải từ thao tác trực tiếp của người dùng (một lần chạm); ra mắt từ iOS 16.4; dùng dịch vụ đẩy của Apple. Toàn bộ là nguồn thứ cấp (bài báo, blog); không đọc được bài gốc của WebKit.
- **Periodic Background Sync:** chỉ Chromium (Chrome/Edge từ 80); Firefox và Safari ghi là không hỗ trợ; chỉ cho app **đã cài** và đã mở như ứng dụng riêng; tần suất phụ thuộc điểm tương tác của site; chỉ trên mạng đã từng kết nối. Các nguồn thuộc thời Chrome 80–81.

## C. NOT SOURCEABLE (không khẳng định)
- NOT SOURCEABLE — Notification Triggers hiện đã ra mắt, đang thử nghiệm hay đã bị gỡ trong Chrome trên Android: chưa đọc được trang chính thức hay chromestatus.
- NOT SOURCEABLE — Safari/iOS hiện có hỗ trợ thông báo theo lịch cục bộ không cần máy chủ hay không.
- NOT SOURCEABLE — hành vi tiết kiệm pin của Android (Doze, hạn chế nền theo hãng máy) đối với thông báo của PWA.
- NOT SOURCEABLE — iOS có hạn chế thêm nào đối với web push ngoài mục B, kể cả ở bản iOS mới nhất.
- NOT TESTED — mọi thứ trên thiết bị Android thật và iOS thật.

## D. Kết luận tạm thời
1. **Nhắc nhở cục bộ theo giờ, không cần máy chủ, rất có thể không đáng tin cậy trên web** (Notification Triggers vắng mặt trong Chromium 153; Periodic Sync chỉ Chromium, chỉ app đã cài, không đảm bảo giờ).
2. **Nhắc nhở đáng tin cậy cần web push từ máy chủ** (kèm đăng ký thuê bao). Điều này **nằm ngoài MVP** (story ghi web push từ máy chủ và tài khoản là giai đoạn 2).
3. Phần chắc chắn làm được trong MVP không cần máy chủ: **cài đặt bật/tắt và giờ nhắc, xin quyền thông báo đúng lúc, và nhắc trong app** (banner trên Hôm nay khi chưa đạt mục tiêu ngày vào/sau giờ đã chọn). Nhắc khi app **đang mở** hoặc ngay khi người dùng mở app.

## E. Phương án để chọn (cần quyết định của người dùng)
- **P1 — Nhắc trong app + thông báo cục bộ "cố gắng tối đa" (khuyến nghị):** cài đặt giờ nhắc; banner trong app; nếu trình duyệt có `showTrigger` thì dùng, nếu không thì chỉ banner. Ghi rõ với người dùng rằng nhắc ngoài app chưa đảm bảo.
- **P2 — Lịch .ics:** cho người dùng thêm lịch lặp hằng ngày vào lịch của điện thoại; đáng tin cậy vì do hệ điều hành lo, nhưng không biết hôm nay đã đạt mục tiêu hay chưa và không mở thẳng đúng màn hình.
- **P3 — Hoãn nhắc ngoài app tới giai đoạn 2** (web push từ máy chủ cùng tài khoản), MVP chỉ có banner trong app.
