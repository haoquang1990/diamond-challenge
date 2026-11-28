# Story 073: Tự khai mã tuyến trên, tuyến trên đồng ý trong Nhóm

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-28

## Context

**GDD**: `design/game-brief.md` (tuyến trên/dưới; story 068, 069, 072)
**Requirement**: Chốt 2026-11-28: người chưa có tuyến trên nhập mã số tuyến trên; tuyến trên đồng ý thì hai bên được nối; đã có tuyến trên thì chỉ admin đổi. Mockup B đã duyệt.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Cài đặt › Mã số của tôi có "Mã số tuyến trên" chỉ khi hộ chưa có tuyến trên: "Gửi lời mời vào tuyến", rồi "Đang chờ tuyến trên đồng ý · mã …" với "Huỷ lời mời". Câu trả lời giống nhau dù mã có tài khoản hay không.
- [x] Hộ được mời thấy lời mời trong Nhóm (nhãn "Vào tuyến", tên, mã, "muốn làm F1 của bạn") cùng các lời mời kết bạn; thẻ Nhóm trên Hôm nay có "🔔 Có lời mời mới". Đồng ý thì nối tuyến; Bỏ qua thì đóng lời mời.
- [x] Máy chủ: chỉ hộ được mời trả lời được; hộ đã có tuyến trên không gửi được; chặn vòng tuyến; không ai đọc thẳng bảng lời mời. Có integration test; client có unit test.
- [x] Đã có tuyến trên thì thẻ không hiện (đổi qua admin, story 072).
- [x] 390 và 320px không tràn ngang.

## Files

- `supabase/migrations/20261129050000_upline_links.sql` (073 part)
- `src/data/upline-service.ts`, `src/ui/screens/upline-request-card.tsx`, `src/ui/screens/group-screen.tsx`, `src/ui/screens/group-today-card.tsx`, `src/ui/screens/nhom-panel.tsx` (`refresh`), `src/app.tsx`, `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/integration/supabase/upline.test.ts` (5 tests for 073), `tests/unit/friends/upline-service.test.ts` (3 tests); seen failing first
- `production/qa/evidence/story-073-upline-request/`

## Completion Notes
**Completed**: 2026-11-28
**Criteria**: 5/5 passing (none deferred)
**Deviations**: Advisory: no push notification for a new request to join the line; it shows on Hôm nay and in Nhóm
**Test Evidence**: integration and unit tests above; screenshots of the invites, the field and the pending state at 390 and 320px; full suite passing
**Reviewed by**: self, no independent review
