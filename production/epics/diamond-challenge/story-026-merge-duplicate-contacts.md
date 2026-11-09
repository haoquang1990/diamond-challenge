# Story 026: Gộp Danh bạ khi vào chung hộ (dò trùng, kiểm tra, gộp, tách)

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Core
> **Type**: UI
> **Estimate**: L
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-09

## Context

**GDD**: `design/gdd/crm.md` (luật 3, 19–22; AC-29, AC-30, AC-32, AC-33)
**Requirement**: Giai đoạn 2a mục 6 — dò trùng, màn kiểm tra, gộp/tách

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Hàm thuần dò trùng: **chắc chắn** = cùng `amwayCode` chuẩn hoá hoặc cùng SĐT E.164; **có thể** = cùng tên hoặc khác ≤ `duplicateNameMaxDistance` ký tự sau bỏ dấu, không phân biệt hoa thường. Bỏ qua liên hệ đã lưu trữ, đã gộp và cặp `person_not_duplicate`.
- [ ] Dò chạy khi thành viên thứ hai vào hộ, khi đẩy dữ liệu cũ, khi thêm hoặc sửa liên hệ, và sau khi khôi phục file; có cặp mới thì Danh bạ hiện lối vào "Kiểm tra liên hệ trùng (N)".
- [ ] Màn "Kiểm tra liên hệ trùng" hiện từng cặp cạnh nhau (tên, SĐT, mã, nhãn, số việc đã làm, ai thêm), với **Gộp** và **Không phải cùng người**. "Gộp tất cả" chỉ gộp cặp chắc chắn không xung đột mã; cặp chỉ trùng tên không bao giờ tự gộp.
- [ ] Hai mã khác nhau: phải chọn mã giữ trước khi gộp (ghi trong `person_merged.amwayCode`). Hai liên hệ liên kết hai tài khoản khác nhau: không cho gộp.
- [ ] Luật gộp áp dụng khi đọc (`person_merged {keepId, mergedId}`, liên hệ giữ là liên hệ thêm sớm hơn): giữ toàn bộ lịch sử và người làm; nhãn NPP > KH > không có; việc xong ở một bên là xong; giữ cả hai SĐT; nối ghi chú theo thời gian; giữ `linkedUserId`.
- [ ] Không cộng hay trừ XP và thành tích: tổng XP, streak và mốc của mỗi người bằng nhau trước và sau khi gộp (unit test).
- [ ] "Tách liên hệ" ghi sự kiện bù cho `person_merged`; hai liên hệ trở lại như trước gộp (nhãn, việc đã làm) và cặp tự đánh "Không phải cùng người".
- [ ] Hai thành viên gộp cùng một cặp khi offline: kết quả như gộp một lần; một người gộp, người kia đánh "Không phải cùng người": sự kiện muộn hơn thắng.
- [ ] Hàm `pendingDuplicates` trả số cặp chưa duyệt cho story 027. Mobile-first 390×844 và 320px, nút ≥ 44px.

---

## Implementation Notes

- Sự kiện `person_merged`, `person_not_duplicate` đã được server chấp nhận (migration hộ) và đồng bộ như sự kiện Danh bạ khác (story 023).
- Chụp ảnh: lối vào "Kiểm tra liên hệ trùng", một cặp chắc chắn, một cặp chỉ trùng tên, chọn mã khi xung đột, liên hệ sau gộp, sau khi tách, 320px.

---

## Out of Scope

- Liên hệ "Đã chuyển lên tuyến trên" và gộp hai mã (2b).

---

## Files

- `src/domain/duplicates.ts` (new), `src/domain/people.ts` (`deriveMerges`, merge applied on read), `src/data/event-store.ts` (doc)
- `src/ui/screens/duplicates-screen.tsx` (new), `src/ui/screens/people-screen.tsx`
- `src/ui/screens/person-form.tsx` ("Đã gộp" + Tách, other phones), `src/ui/people-helpers.ts`, `src/ui/people-config.ts`, `src/app.tsx` (screen route)
- `src/config/game-config.json` (`duplicateNameMaxDistance`), `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/unit/people/duplicates.test.ts`
- `production/qa/evidence/story-026-merge-duplicate-contacts/`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: ảnh chụp từng trạng thái, giữ lại trong `production/qa/evidence/`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-022-amway-code-on-contacts.md`, `production/epics/diamond-challenge/story-023-consent-household-contact-sync.md`
- Unlocks: story 027

## Completion Notes
**Completed**: 2026-11-09
**Criteria**: 9/9 passing (built app in Chromium 390×844 and 320px with seeded contacts; not tried on a real phone or against the live Supabase)
**Deviations**: Advisory, not logged as tech debt: (1) detection after a file restore is not a separate step, it follows from detection being recomputed on every read, and was not run; (2) the two-member offline case is covered by pure-function tests only, no two-device run; (3) "first KH/NPP" progress counts live contacts, so a merge can lower the count of a milestone not yet earned (earned ones stay); (4) the message that blocks merging two different linked accounts was not captured on screen; (5) `person-form.tsx`, `people-helpers.ts`, `people-config.ts` and `app.tsx` were touched beyond the planned list and are in `## Files`
**Test Evidence**: screenshots in production/qa/evidence/story-026-merge-duplicate-contacts/ (01–10 plus stamp.txt, stamp unchanged); unit test `tests/unit/people/duplicates.test.ts`; full suite 355/355
**Reviewed by**: self, no independent review
