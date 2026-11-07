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

> 012–014 thay mô hình giai đoạn bằng việc cần làm + nhãn KH/NPP theo phản hồi dùng thử (2026-11-04, `design/gdd/crm.md`). Thứ tự gợi ý: 012 → 013 → 014 → 011.

> 016–018 thêm hệ thống thông báo thành tích (`design/quick-specs/achievements-system-2026-11-05.md`). Thứ tự: 016 → 017 → 018.

> 021–029 là giai đoạn 2a (tập trung 30x30, `design/gdd/accounts.md`, `design/gdd/crm.md`); 019–020 là phần server. Thứ tự: 021 → 022 → 023 → 024 → 025 → 026 → 027 → 028 → 029. Migration `sync_seq` (sửa ADR-0002) đã có; phải deploy trước khi thử 023 trên server. Không có story cho Bảng 4x4, cây nhiều tầng, gộp hai mã, Web Push (2b).
