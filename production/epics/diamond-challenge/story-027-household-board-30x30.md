# Story 027: Bảng 30x30 theo hộ và đồng bộ số tổng hợp

> **Epic**: diamond-challenge
> **Status**: In Progress
> **Layer**: Feature
> **Type**: UI
> **Estimate**: L
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-09

## Context

**GDD**: `design/gdd/crm.md` (Formulas, luật 23; AC-31) và `design/gdd/accounts.md` (luật 5, Formulas)
**Requirement**: Giai đoạn 2a mục 7 — Bảng 30x30 đếm từ Danh bạ hộ, cảnh báo cặp trùng chưa duyệt, đẩy số tổng hợp của hộ lên server

**ADR Governing Implementation**: N/A (minimal — no ADRs). Bảng `household_aggregates` theo `docs/architecture/adr-0001-household-model.md`.
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) + Supabase | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Bảng 30x30 đếm trên Danh bạ hộ: liên hệ chưa lưu trữ, chưa bị gộp vào liên hệ khác; `customers(h)`, `f1(h)`, `contacts(h)`, `achieved(h)` đúng công thức `crm.md`. Một cặp đã gộp đếm một lần.
- [ ] Hai thành viên cùng hộ thấy cùng số KH, NPP F1, liên hệ (test với hai nhật ký đã đồng bộ).
- [ ] Còn cặp trùng chưa duyệt: bảng hiện "Có N cặp liên hệ có thể trùng, số liệu có thể bị đếm hai lần" với nút mở màn kiểm tra; duyệt xong thì cảnh báo mất.
- [ ] Chưa đăng nhập hoặc chưa đồng ý: bảng tính như giai đoạn 1 (hộ chỉ có mình), không gửi gì lên server.
- [ ] Đã đồng ý và có mạng: khi số đổi, upsert `household_aggregates {customers, f1, contacts, achieved_30x30, pending_duplicates}` cho hộ của mình (gộp nhiều thay đổi, không gửi khi số không đổi). Offline thì gửi ở lần có mạng kế tiếp.
- [ ] Mốc thành tích `people` (KH đầu tiên, đủ 30 KH, đủ 30 NPP F1, đạt 30×30, 250 liên hệ) đếm theo Danh bạ hộ; mỗi thành viên nhận popup một lần (ghi nhận theo người).
- [ ] Bảng không tạo sự kiện có `xp`; ghi chú "không phải xác nhận chính thức" vẫn hiện. Mobile-first 390×844 và 320px.

---

## Implementation Notes

- Tuyến trên đọc số này ở story 028; giá trị cũ hoặc chưa có thì coi như chưa đạt.
- Chụp ảnh: bảng theo hộ, cảnh báo trùng, sau khi duyệt, 320px.

---

## Out of Scope

- Bảng 4x4, cây nhiều tầng (2b).

---

## Files

- `src/domain/people.ts`, `src/domain/achievements.ts`
- `src/data/aggregates-sync.ts`
- `src/ui/screens/board-30x30-screen.tsx`, `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/unit/people/household-board.test.ts`
- `production/qa/evidence/story-027-household-board-30x30/`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: ảnh chụp từng trạng thái, giữ lại trong `production/qa/evidence/`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-023-consent-household-contact-sync.md`, `production/epics/diamond-challenge/story-026-merge-duplicate-contacts.md`
- Unlocks: story 028
