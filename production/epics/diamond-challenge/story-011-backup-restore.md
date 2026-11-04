# Story 011: Sao lưu và khôi phục bằng file

> **Epic**: diamond-challenge
> **Status**: In Progress
> **Layer**: Feature
> **Type**: Integration
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-04

## Context

**GDD**: `design/game-brief.md` (chi tiết: `design/gdd/crm.md`, Core Rules 9, Edge Cases, AC-8 đến AC-10)
**Requirement**: Brief MVP feature 6 — Lưu cục bộ, sẵn sàng đồng bộ, có sao lưu và khôi phục bằng file

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Có mục Sao lưu và khôi phục (trong màn Cài đặt) với nút **Xuất sao lưu** và **Nhập từ file**.
- [ ] Xuất tạo file JSON `diamond-challenge-backup-YYYY-MM-DD.json` gồm `format`, `formatVersion: 1`, `exportedAt` và toàn bộ nhật ký (`events[]`); tải về được trên điện thoại và máy tính.
- [ ] Nhập là **gộp, bỏ trùng theo `id` sự kiện**: nhập hai lần liên tiếp thì lần hai thêm 0 sự kiện và dữ liệu không đổi; không xóa dữ liệu đang có.
- [ ] Mỗi sự kiện trong file đi qua cùng bộ kiểm tra khi đọc; sự kiện hỏng bị bỏ qua và đếm. Ví dụ 1 hỏng trong 10 thì thêm 9, bỏ qua 1, báo đúng số liệu.
- [ ] File sai định dạng, không phải JSON, hoặc `formatVersion` lạ: từ chối cả file với thông báo rõ, nhật ký hiện tại không đổi.
- [ ] Sau khi nhập, hiện kết quả "thêm N, bỏ qua M" và các màn (Hôm nay, Người, Con đường) hiển thị dữ liệu mới.
- [ ] Có nhắc người dùng giữ file cẩn thận vì chứa tên và ghi chú về người khác.
- [ ] Khôi phục sang trình duyệt mới (hoặc sau khi xóa dữ liệu) dựng lại đúng XP, streak, Danh bạ, việc đã làm và nhãn KH/NPP (kể cả dữ liệu cũ có giai đoạn); `person_restored`, `taskId` và `phone` được `parseStoredEvent` chấp nhận (cập nhật theo story 012, 2026-11-04).
- [ ] Kiểm thử trên trình duyệt thật bằng Playwright: xuất, xóa dữ liệu, nhập lại, và dữ liệu như cũ.

---

## Implementation Notes

- Chỉ thêm sự kiện qua `EventStore`; không có thao tác xóa. Thêm một hàm nhập hàng loạt vào `EventStore` nếu cần, giữ giao diện `append` hiện có.
- Dùng `crypto.randomUUID` đã có làm `id`; trùng `id` nghĩa là cùng sự kiện.
- Lưu một test Vitest cho phần phân tích và gộp (không cần IndexedDB thật), phần kiểm trên trình duyệt thật ghi vào `production/qa/evidence/`.

---

## Out of Scope

- Đồng bộ lên server, tài khoản (giai đoạn 2).
- Mã hóa file sao lưu.
- Nhập từ định dạng khác (CSV, danh bạ điện thoại).

---

## Files

- `src/data/backup.ts`
- `src/data/event-store.ts`
- `src/data/indexeddb-event-store.ts`
- `src/data/memory-event-store.ts`
- `src/ui/screens/settings-screen.tsx`
- `src/ui/strings.ts`
- `src/ui/styles.css`
- `tests/unit/backup/backup.test.ts`
- `production/qa/evidence/story-011-backup-restore/`

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/unit/backup/backup.test.ts` (advisory at `qa.level: minimal`) cùng bản ghi kiểm thử trên trình duyệt thật trong `production/qa/evidence/`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-001-event-log.md`, `production/epics/diamond-challenge/story-012-person-tasks-labels.md` (làm sau 012 để file sao lưu có kiểu sự kiện mới)
- Unlocks: None
