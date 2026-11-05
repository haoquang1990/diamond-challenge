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

> 012–014 thay mô hình giai đoạn bằng việc cần làm + nhãn KH/NPP theo phản hồi dùng thử (2026-11-04, `design/gdd/crm.md`). Thứ tự gợi ý: 012 → 013 → 014 → 011.
