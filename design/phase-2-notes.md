# Ghi chú giai đoạn 2

Chưa làm trong MVP (xem Out of scope trong `design/game-brief.md`). Ghi lại để không mất quyết định.

## Tài khoản: đăng ký và đăng nhập
- **Không cho tự đăng ký.**
- **Admin tạo tài khoản** với: họ tên, số điện thoại, tuyến trên. Hệ thống cấp **mật khẩu tạm**.
- **Đăng nhập** bằng số điện thoại + mật khẩu.
- **Bắt buộc đổi mật khẩu** ở lần đăng nhập đầu tiên.
- **Admin có thể đặt lại mật khẩu** (cấp mật khẩu tạm mới, người dùng lại phải đổi khi đăng nhập).

## Liên quan
- Giải đấu tuần trong nhóm (dùng "tuyến trên" để xác định nhóm).
- Đồng bộ nhật ký sự kiện lên server: `userId` cục bộ và `syncedAt` đã có sẵn từ story 001.
