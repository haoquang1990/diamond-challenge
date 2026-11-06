# Ghi chú giai đoạn 2

Chưa làm trong MVP (xem Out of scope trong `design/game-brief.md`). Ghi lại để không mất quyết định.

> **Cập nhật 2026-11-07:** mô hình Hộ kinh doanh thay thế phần tài khoản và đồng bộ dưới đây. Luật hiện hành ở `design/gdd/accounts.md` (người, hộ, mã số Amway, bảo trợ theo hộ, gộp mã) và `design/gdd/crm.md` luật 16–25 (Danh bạ hộ trên server, gộp liên hệ trùng). Các mục dưới giữ lại làm lịch sử; chỗ nào khác với hai GDD đó thì GDD thắng.

## Tài khoản: đăng ký và đăng nhập (đã thay bằng `accounts.md`)
- **Không cho tự đăng ký.**
- **Admin chỉ tạo người gốc** (tài khoản đầu tiên của một hệ thống), **đặt lại mật khẩu** và **sửa người bảo trợ**.
- **Người dùng tạo tài khoản cho NPP F1 của chính mình:** trên một người trong Danh bạ có nhãn NPP, bấm **"Tạo tài khoản"**, nhập **SĐT + mật khẩu tạm**. Tài khoản mới **tự gắn mình là người bảo trợ**; app ghi `linkedUserId` vào người đó.
- Mỗi người **chỉ tạo được tài khoản cho F1 của mình**.
- **Đăng nhập** bằng số điện thoại + mật khẩu. **Bắt buộc đổi mật khẩu** ở lần đăng nhập đầu tiên.
- Admin đặt lại mật khẩu thì cấp mật khẩu tạm mới, người dùng lại phải đổi khi đăng nhập.

## Đồng bộ số tổng hợp
- Mỗi hộ gửi **số tổng hợp** lên server: **số KH**, **số NPP F1**, **số liên hệ**, **đạt 30x30**, **số cặp trùng chưa duyệt**, kèm thời điểm cập nhật. Tuyến trên chỉ đọc các số này.
- ~~Danh sách tên, ghi chú và hoạt động không rời máy.~~ **Đã đổi 2026-11-07:** Danh bạ hộ được lưu trên server để đồng bộ trong hộ, chỉ thành viên hộ đọc được (`crm.md` luật 16, `docs/architecture/adr-0002-household-contacts-on-server.md`).
- Số tổng hợp được tính bằng đúng công thức giai đoạn 1 trong `design/gdd/crm.md` (mục Formulas).

## Cây hệ thống và Bảng 4x4 (server tính)
Cây lấy từ quan hệ bảo trợ giữa các **hộ** (`accounts.md`); trong các công thức dưới, "tài khoản" đọc là "hộ". Không phân loại "tích cực / không tích cực".

**Biến** (cấu hình phía server): `D` = `depthTarget` (4), `B` = `branchTarget` (4), `topBranchesShown` (4).

| Công thức | Định nghĩa |
|---|---|
| **Tầng** | `tier(a) = số bước bảo trợ từ tài khoản a tới mình`; F1 của mình là tầng 1 |
| **Nhánh** | một F1 của mình cùng toàn bộ tuyến dưới của họ |
| **Đạt 30x30 (tài khoản a)** | lấy từ số tổng hợp a đã đồng bộ |
| **Điểm sâu nhánh b** | `depth(b) = số giá trị tier khác nhau t sao cho ∃ a ∈ b, tier(a) = t ∧ achieved(a)` (ở bất kỳ đâu trong nhánh, không cần cùng một đường, không cần liền tầng; mỗi tầng tính một lần) |
| **Nhánh đạt chuẩn** | `depth(b) ≥ D` |
| **Số nhánh đạt chuẩn** | `Q = |{ b : depth(b) ≥ D }|` |
| **Đạt 30x30x4x4** | `achieved(me) ∧ Q ≥ B`; mốc phụ: 250 liên hệ (từ giai đoạn 1) |

**Ví dụ (nhánh của Lan):** Lan (tầng 1) đạt 30x30 → tầng 1. Hai người ở tầng 3 cùng đạt → tầng 3 chỉ tính một lần. Một người ở tầng 5 đạt → tầng 5. `depth = |{1, 3, 5}| = 3` → chưa đạt chuẩn. Thêm một người đạt ở tầng 6 → `depth = 4` → đạt chuẩn, dù các tầng không liền nhau.

**Bảng 4x4:** 4 nhánh có điểm sâu cao nhất (hòa thì nhiều người đạt hơn đứng trước, vẫn hòa thì theo tên), mỗi nhánh hiện tên F1, điểm sâu x/4 và các tầng đã có người đạt 30x30. Hiện cả số nhánh đạt chuẩn x/4 và ghi chú "không phải xác nhận chính thức".

## Trường hợp biên của giai đoạn 2
- **Admin sửa người bảo trợ:** tầng của cả tuyến dưới đổi theo, Bảng 4x4 tính lại.
- **Vòng lặp bảo trợ:** server từ chối mọi thay đổi tạo vòng lặp.
- **Số đồng bộ bị cũ hoặc chưa có:** vẫn dùng số gần nhất, hiện "cập nhật lúc…"; chưa đồng bộ lần nào thì coi như chưa đạt 30x30.
- **SĐT đã có tài khoản:** từ chối tạo; nếu người đó đã có tài khoản do người khác tạo thì phải nhờ admin sửa người bảo trợ.
- **F1 bị gỡ nhãn NPP (hoàn tác việc chốt) hoặc lưu trữ trên máy:** tài khoản của họ vẫn giữ; app cảnh báo người đó đã có tài khoản.
- **Chưa có F1 nào có tài khoản:** Bảng 4x4 hiện "Chưa có nhánh nào".

## Liên quan
- Giải đấu tuần trong nhóm (dùng quan hệ bảo trợ để xác định nhóm).
- Đồng bộ lên server: `userId` cục bộ và `syncedAt` đã có sẵn từ story 001.
