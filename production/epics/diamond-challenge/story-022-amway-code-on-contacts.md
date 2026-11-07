# Story 022: Mã số Amway trên liên hệ và cảnh báo trùng mã

> **Epic**: diamond-challenge
> **Status**: In Progress
> **Layer**: Core
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-07

## Context

**GDD**: `design/gdd/crm.md` (luật 1, 3) và `design/gdd/accounts.md` (luật 13–17)
**Requirement**: Giai đoạn 2a mục 2 — ô Mã số Amway trên liên hệ, giữ nguyên khi KH → NPP, cảnh báo trùng mã

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Form thêm và sửa liên hệ có ô "Mã số Amway" (không bắt buộc). Giá trị chuẩn hoá: bỏ khoảng trắng, dấu chấm, gạch; còn 4–15 chữ số (`amwayCodeDigits` trong cấu hình). Sai thì từ chối kèm thông báo rõ và không ghi sự kiện; để trống hợp lệ.
- [ ] Mã lưu bằng `person_added {…, amwayCode}` / `person_updated {personId, amwayCode}`; `derivePeople` trả mã mới nhất; xoá mã bằng cách để trống.
- [ ] Đổi nhãn KH → NPP (Chốt NPP) giữ nguyên mã; hoàn tác Chốt NPP cũng giữ mã.
- [ ] Trang chi tiết liên hệ hiện mã. Không có sự kiện nào trong story này có `xp`; tổng XP không đổi.
- [ ] Hai liên hệ chưa lưu trữ cùng mã: cả hai hiện cảnh báo "Trùng mã số với …" trong Danh bạ và trang chi tiết; khi nhập mã trùng, form cảnh báo nhưng vẫn cho lưu.
- [ ] Dữ liệu cũ không có mã đọc bình thường; sao lưu và khôi phục giữ mã; sự kiện có mã sai định dạng trong file bị bỏ mã (không lỗi).
- [ ] Mobile-first 390×844 và 320px, nút ≥ 44px, không tràn ngang; bàn phím số cho ô mã.

---

## Implementation Notes

- Hàm chuẩn hoá dùng chung luật với `normalizeAmwayCode` trong `supabase/functions/_shared/phone.ts`; phía app đặt trong `src/domain`.
- Chụp ảnh: form có ô mã, lỗi mã sai, chi tiết có mã, cảnh báo trùng mã, 320px.

---

## Out of Scope

- Kiểm tra với hệ thống Amway.
- Dò và gộp liên hệ trùng (story 026).

---

## Files

- `src/domain/people.ts`, `src/data/event-store.ts`
- `src/ui/screens/person-form.tsx`, `src/ui/screens/people-screen.tsx`, `src/ui/people-helpers.ts`
- `src/config/game-config.json`, `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/unit/people/amway-code.test.ts`
- `production/qa/evidence/story-022-amway-code-on-contacts/`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: ảnh chụp từng trạng thái, giữ lại trong `production/qa/evidence/`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-015-merge-lam-danh-ba.md`
- Unlocks: story 024, 026
