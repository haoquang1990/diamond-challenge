# Story 030: Bắt buộc đăng nhập và gộp thông báo đồng ý vào lần đăng nhập đầu

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-17

## Context

**GDD**: `design/gdd/accounts.md` (luật 4, mục "Bắt buộc đăng nhập") và `design/gdd/crm.md` (luật 18, AC-28)
**Requirement**: Quyết định của người dùng 2026-11-09 và 2026-11-17: app phải đăng nhập mới dùng được; màn "Đồng bộ Danh bạ trong hộ" thành màn đồng ý bắt buộc ở lần đăng nhập đầu; dữ liệu trên máy tách theo tài khoản.

**ADR Governing Implementation**: N/A (minimal — no ADRs). Đã ghi amendment 2026-11-17 trong `docs/architecture/adr-0002-household-contacts-on-server.md` (đồng ý bắt buộc, kho trên máy theo tài khoản).
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) + Supabase | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] **Cổng đăng nhập:** chưa có phiên thì chỉ hiện màn Đăng nhập (không vào được Hôm nay, Học, Làm, Con đường), có dòng "Chưa có tài khoản? Liên hệ người bảo trợ" và "Quên mật khẩu? Nhờ người bảo trợ hoặc quản trị đặt lại". Không có chế độ dùng tạm.
- [ ] **Offline lần đầu:** máy chưa từng đăng nhập mà offline thì màn Đăng nhập báo cần có mạng cho lần đăng nhập đầu. Đã có phiên trên máy thì mở app và dùng offline như trước (tên, quyền admin lần cuối lưu trên máy).
- [ ] **Đồng ý bắt buộc:** sau đăng nhập (và đổi mật khẩu nếu cần), tài khoản chưa đồng ý thấy màn thông báo như story 023 với đúng hai nút "Đồng ý và tiếp tục" (gọi `record_contact_consent(version)`) và "Đăng xuất"; chưa đồng ý thì không vào app và không gửi sự kiện Danh bạ nào. Máy từng chọn "Không đồng ý" cũng thấy màn này. Cài đặt không còn công tắc bật/tắt đồng bộ. Tài khoản đã đồng ý không thấy lại; tăng `version` thì hỏi lại một lần.
- [ ] **Kho theo tài khoản:** dữ liệu trên máy nằm trong một kho riêng cho mỗi tài khoản. Lần đầu đăng nhập trên máy, kho cũ của máy (giai đoạn 1) được chép sang kho của tài khoản đó — nếu kho cũ đã liên kết với một tài khoản (story 021) thì chỉ tài khoản đó nhận — và được đánh dấu đã chuyển, không xoá. Không mất XP, streak, thành tích, bài học hay Danh bạ; Danh bạ cũ được đẩy lên sau khi đồng ý (story 023).
- [ ] **Đăng xuất giữ dữ liệu:** "Đăng xuất" quay về màn Đăng nhập và giữ kho của tài khoản; đăng nhập lại cùng tài khoản thấy lại mọi thứ; đăng nhập tài khoản khác không thấy dữ liệu của người trước (chỉ kho của tài khoản đó, kéo Danh bạ hộ về).
- [ ] **Đăng xuất và xoá dữ liệu:** lựa chọn riêng "Đăng xuất và xoá dữ liệu trên máy này" có cảnh báo mất XP, streak, thành tích, bài học và bước xác nhận; bị chặn khi còn sự kiện Danh bạ chưa đồng bộ, kèm "Đồng bộ ngay" và "Xuất file sao lưu".
- [ ] Không thay đổi server (không migration, không Edge Function mới); không đưa secret hay service_role key vào app. Mobile-first 390×844 và 320px, nút ≥ 44px, không tràn ngang.

---

## Implementation Notes

- Tài liệu đã sửa 2026-11-17: `design/gdd/accounts.md` luật 4, `design/gdd/crm.md` luật 18 và AC-28, amendment ADR-0002.
- Kho cũ `diamond-challenge` giữ nguyên sau khi chuyển (chỉ đánh dấu) để lấy lại được nếu có lỗi; unit test cho việc chuyển kho và tách kho.
- Thử thật: người dùng tạo một hộ gốc thử nghiệm (không dưới hộ thật) và thử theo checklist sau khi deploy.
- Không đưa secret hay service_role key vào code app.
- Chụp ảnh: màn Đăng nhập khi mở app, offline lần đầu, màn đồng ý (cả máy từng "Không đồng ý"), dữ liệu cũ sau khi chuyển, hai tài khoản trên một máy, đăng xuất giữ dữ liệu, xoá dữ liệu bị chặn và có cảnh báo, Cài đặt không còn công tắc, 320px.

---

## Out of Scope

- Đăng ký tài khoản tự phục vụ (tài khoản vẫn do người bảo trợ hoặc admin tạo).
- Xoá tài khoản, rời hộ (2b).

---

## Files

- `src/ui/auth-gate.tsx` (new: login gate, session restore incl. offline, per-account App, migration loading/error)
- `src/data/account-stores.ts` (new: per-account stores, legacy migration, device account cache, erase), `src/data/indexeddb-event-store.ts` (`seedFrom`, close on version change), `src/data/contact-sync.ts` (consent version read)
- `src/main.tsx`, `src/app.tsx`, `src/ui/screens/consent-screen.tsx`, `src/ui/screens/login-screen.tsx`, `src/ui/screens/settings-screen.tsx`
- `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/unit/data/account-stores.test.ts`
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

## Completion Notes
**Completed**: 2026-11-17
**Criteria**: 7/7 passing (built app in Chromium 390×844 and 320px with a fake Supabase; not tried on a real phone or against the live Supabase)
**Deviations**: Advisory, not logged as tech debt: (1) the real-Supabase try is still to do (the user runs the test-household checklist after the deploy; the legacy copy happens once per real device); (2) a signed-in device is recognised offline through supabase-js's own `sb-<project>-auth-token` localStorage key, which can break if the library changes how it stores the session, and nothing tests it; (3) the consent screen gets a third button "Thử lại" when the device is offline and the consent state is unknown (the normal state has exactly two buttons); (4) the legacy copy takes the whole old `meta` (sync cursors and member ids), not only the local userId, so other members' XP is not counted as mine before the first sync; (5) after "Xuất file sao lưu" the erase stays blocked until the contact events are synced (stricter than the decision); (6) the "legacy log linked to another account is not transferred" rule and the consent-version re-ask were checked by unit test or by reading code only; (7) `src/ui/auth-gate.tsx` was added beyond the planned list and is in `## Files`; (8) the story did not go through `/code-review` or a security review, although it touches store migration and erase
**Test Evidence**: screenshots in production/qa/evidence/story-030-require-login/ (01–12 plus stamp.txt, recaptured and restamped after the code-review fix); `tests/unit/data/account-stores.test.ts` (21 tests); full suite 439/439
**Code review (2026-11-17)**: CHANGES REQUIRED → fixed: "Đăng xuất và xoá dữ liệu trên máy này" now also deletes the legacy `diamond-challenge` database when it was given to this account (regression test seen failing on the old code); a 0-row legacy copy now logs a warning. Suggestions left: shorten `AuthGate`, the offline must-change-password case, the unverified SIGNED_OUT-on-offline-refresh claim
**Reviewed by**: self, no independent review
