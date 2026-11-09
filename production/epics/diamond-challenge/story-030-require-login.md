# Story 030: Bắt buộc đăng nhập và gộp thông báo đồng ý vào lần đăng nhập đầu

> **Epic**: diamond-challenge
> **Status**: Draft
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-09

## Context

**GDD**: `design/gdd/accounts.md` (luật 4) và `design/gdd/crm.md` (luật 16–18, 25) — cần sửa khi story này được chốt
**Requirement**: Quyết định của người dùng 2026-11-09: app hướng tới việc phải đăng nhập mới dùng được; màn "Đồng bộ Danh bạ trong hộ" không bỏ mà gộp vào lần đăng nhập đầu.

**ADR Governing Implementation**: N/A (minimal — no ADRs). Ảnh hưởng `docs/architecture/adr-0002-household-contacts-on-server.md` (Amendments: "Không đồng ý" trên máy thắng) — cần ghi amendment mới.
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) + Supabase | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Mở app khi chưa đăng nhập: hiện màn Đăng nhập trước mọi tab; không dùng được Hôm nay, Học, Làm, Con đường khi chưa đăng nhập.
- [ ] Lần đăng nhập đầu (sau đổi mật khẩu): một màn thông báo lưu Danh bạ trên máy chủ ở Singapore (nội dung như story 023) với một nút "Đồng ý và tiếp tục"; gọi `record_contact_consent(version)`. Không còn nút "Không đồng ý" và không còn công tắc đồng bộ trong Cài đặt.
- [ ] Tài khoản đã đồng ý trước đó không thấy lại màn này; tăng `version` của thông báo thì hỏi lại một lần.
- [ ] Máy đang có dữ liệu giai đoạn 1 (chưa đăng nhập): dữ liệu trên máy được giữ và đẩy lên sau khi đăng nhập và đồng ý, như story 023; không mất XP, streak hay Danh bạ.
- [ ] Đăng xuất: quay về màn Đăng nhập; dữ liệu trên máy xử lý theo câu hỏi mở bên dưới.
- [ ] Mobile-first 390×844 và 320px, nút ≥ 44px.

---

## Open Questions (chốt trước khi chuyển sang Ready)

- Người đang dùng giai đoạn 1 chưa có tài khoản: ai tạo tài khoản cho họ (người bảo trợ qua "Tạo tài khoản", hay admin)? Có cho dùng tiếp tạm thời không?
- Offline lần đầu mở app (chưa từng đăng nhập): chặn hẳn, hay cho dùng tạm đến khi có mạng?
- Đăng xuất: xoá dữ liệu trên máy hay giữ lại cho lần đăng nhập sau cùng tài khoản?
- Máy đã từng bấm "Không đồng ý" (story 023): hỏi lại bằng màn mới hay bắt buộc đồng ý mới dùng tiếp?

---

## Implementation Notes

- Trước khi làm: sửa `design/gdd/accounts.md` luật 4, `design/gdd/crm.md` luật về đồng ý, và thêm amendment cho ADR-0002 (bỏ "Không đồng ý trên máy thắng").
- Không đưa secret hay service_role key vào code app.
- Chụp ảnh: màn Đăng nhập khi mở app, màn đồng ý lần đầu, Cài đặt không còn công tắc đồng bộ, 320px.

---

## Out of Scope

- Đăng ký tài khoản tự phục vụ (tài khoản vẫn do người bảo trợ hoặc admin tạo).
- Xoá tài khoản, rời hộ (2b).

---

## Files

- `src/app.tsx`, `src/ui/screens/consent-screen.tsx`, `src/ui/screens/login-screen.tsx`, `src/ui/screens/settings-screen.tsx`
- `src/data/contact-sync.ts`, `src/ui/strings.ts`, `src/ui/styles.css`
- `design/gdd/accounts.md`, `design/gdd/crm.md`, `docs/architecture/adr-0002-household-contacts-on-server.md`
- `production/qa/evidence/story-030-require-login/`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: ảnh chụp từng trạng thái, giữ lại trong `production/qa/evidence/`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-021-login-change-password.md`, `production/epics/diamond-challenge/story-023-consent-household-contact-sync.md`
- Unlocks: None
