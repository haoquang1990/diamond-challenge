# Story 033: Văn bản đồng ý mới và chặn xoá dữ liệu theo tiến độ chưa đồng bộ

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-18

## Context

**GDD**: `design/gdd/crm.md` (luật 18, AC-28) và `design/gdd/accounts.md` (luật 4)
**Requirement**: Quyết định của người dùng 2026-11-17: thông báo đồng ý nói rõ tiến độ cá nhân cũng lưu trên server, người đã đồng ý được hỏi lại một lần; "Đăng xuất và xoá dữ liệu" tính cả tiến độ chưa đồng bộ.

**ADR Governing Implementation**: N/A (minimal — no ADRs). Thiết kế theo `docs/architecture/adr-0004-personal-progress-on-server.md` (Accepted; mục Decision: đồng ý, "Đăng xuất và xoá dữ liệu") và story 030.
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Màn đồng ý thêm một dòng nói rõ: tiến độ học và XP của bạn (bài học đã học, XP, streak, thành tích) cũng được lưu trên máy chủ ở Singapore, chỉ bạn xem được; vẫn đúng hai nút "Đồng ý và tiếp tục" và "Đăng xuất".
- [ ] Tăng `contactConsentVersion` trong `game-config.json` và `contact_consent_version` trong `app_config` trên server (migration nhỏ) cùng một lúc; tài khoản đã đồng ý ở phiên bản cũ thấy màn đồng ý một lần, đồng ý xong thì không hỏi lại; tài khoản mới chỉ hỏi một lần.
- [ ] Trước khi đồng ý phiên bản mới, không có sự kiện tiến độ nào bị đẩy lên (kiểm bằng client giả); tài khoản chưa đồng ý vẫn dùng được kho trên máy sau khi đồng ý xong.
- [ ] "Đăng xuất và xoá dữ liệu trên máy này" bị chặn khi còn sự kiện Danh bạ **hoặc** sự kiện tiến độ chưa đồng bộ (đếm cả hai, dùng `selectEventsToPush` và bộ lọc của story 032), kèm "Đồng bộ ngay" và "Xuất file sao lưu".
- [ ] Câu cảnh báo khi xoá nói rõ: dữ liệu chưa đồng bộ sẽ mất; tiến độ và Danh bạ đã đồng bộ sẽ quay lại khi đăng nhập lại.
- [ ] Mobile-first 390×844 và 320px, nút ≥ 44px, không tràn ngang.

---

## Implementation Notes

- Nền: story 030 (`consent-screen.tsx`, `readContactConsentVersion`, `contactConsentVersion`, `eraseAccountData`, điều kiện chặn trong `settings-screen.tsx`) và story 032 (bộ lọc, trạng thái đồng bộ tiến độ).
- Deploy sau khi story 032 đã chạy ổn trên Supabase thật: việc tăng phiên bản buộc mọi người đồng ý lại.
- Chụp ảnh: màn đồng ý mới (390 và 320px), tài khoản đã đồng ý ở phiên bản cũ thấy lại màn một lần, xoá bị chặn vì tiến độ chưa đồng bộ, câu cảnh báo mới.

---

## Out of Scope

- Bộ đồng bộ và bảng server (story 031, 032).
- Chính sách quyền riêng tư dạng văn bản dài ngoài màn đồng ý.

---

## Files

- `src/config/game-config.json` (`contactConsentVersion` 1 → 2)
- `supabase/migrations/20261118010000_consent_version_2.sql` (new: `app_config.contact_consent_version` = 2, idempotent)
- `src/ui/strings.ts` (`consentProgress`, new `eraseWarning` and `eraseBlocked`)
- `src/ui/screens/consent-screen.tsx` (progress line in the consent list)
- `src/ui/screens/settings-screen.tsx` (erase block counts Danh bạ and progress events)
- `src/app.tsx` (an unreadable consent version is never treated as the current one)
- `production/qa/evidence/story-033-progress-consent-and-erase/` (4 screenshots + stamp)

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: ảnh chụp từng trạng thái, giữ lại trong `production/qa/evidence/`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-032-progress-sync.md`
- Unlocks: None

## Completion Notes
**Completed**: 2026-11-18
**Criteria**: 6/6 passing (none deferred)
**Deviations**: Advisory, not logged as tech debt: (1) all checks ran against a fake Supabase and PGlite, not the live one; migrations 20261118000000 (story 031) and 20261118010000 (this story) are not on the live DB; (2) merging the new migration raises `app_config.contact_consent_version` to 2 and every account that agreed at version 1 must agree again once; per the user's decision (2026-11-18) stories 031-033 ship together in one PR, because the "no personal_events before agreeing to the new text" gate lives in this story and a separate 031/032 deploy would send progress under the old consent text; `game-config.json` (2) and the migration ship in the same release; (3) after closing, the consent screen title was changed from "Đồng bộ Danh bạ trong hộ" to "Đồng bộ dữ liệu" at the user's request (2026-11-18), evidence re-captured; (4) `src/app.tsx` also changed so an unreadable consent version is never treated as the current one (listed in `## Files`)
**Test Evidence**: screenshots `production/qa/evidence/story-033-progress-consent-and-erase/01-04` (stamp unchanged); tests waived at qa.level minimal; full suite 535/535 and the migration applied twice on PGlite
**Reviewed by**: self, no independent review
