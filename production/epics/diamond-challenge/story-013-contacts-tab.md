# Story 013: Danh bạ, bộ lọc, lưu trữ/khôi phục, chi tiết người

> **Epic**: diamond-challenge
> **Status**: Ready
> **Layer**: Presentation
> **Type**: UI
> **Estimate**: L
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-04

## Context

**GDD**: `design/game-brief.md` (chi tiết: `design/gdd/crm.md`, Core Rules 2–5, 7, 9–12, AC-1 đến AC-4, AC-18, AC-19, AC-21, AC-23)
**Requirement**: Brief MVP feature 1 — Danh bạ + việc cần làm + nhãn KH/NPP (phần màn hình)

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Tab "Người" đổi tên thành **Danh bạ** (nhãn tab và tiêu đề màn); các chỗ khác trong app gọi "Người" như tên tab cũng đổi theo qua `strings.ts`.
- [ ] Danh bạ có bộ lọc **Tất cả / Khách hàng / NPP / Đã lưu trữ** (mặc định Tất cả); không có danh sách riêng; mỗi bộ lọc hiện số người.
- [ ] Lọc Khách hàng: mỗi dòng hiện lần liên hệ gần nhất, người lâu chưa chăm sóc nhất ở đầu. Lọc NPP: mỗi dòng hiện ngày lên NPP, mới nhất ở đầu. "Tất cả" hiện nhãn KH/NPP trên dòng nào có nhãn. Dùng hàm thuần của story 012.
- [ ] **Lỗi "NPP biến mất sau khi đánh dấu":** tái hiện trên bản build thật và chụp ảnh trước khi sửa; sau khi sửa, người vừa chốt NPP hiện đúng một dòng ở "Tất cả" và ở "NPP" (ảnh chứng minh).
- [ ] "Đã lưu trữ" liệt kê người đã lưu trữ, mỗi dòng có nút **Khôi phục**; khôi phục xong người đó quay lại "Tất cả" với nhãn và việc đã làm như trước (ghi `person_restored`).
- [ ] Trang chi tiết người **bỏ "Giai đoạn" và "Người quen"**, thay bằng danh sách **Hoạt động** dạng việc cần làm (Liên hệ, Demo, Trình bày opp, Follow-up, Chốt khách hàng, Chốt NPP) kèm XP, đọc từ `personTasks`.
- [ ] Bấm hoàn thành một việc: cộng XP, hiện phản hồi XP, việc biến khỏi danh sách (trừ Follow-up) và vào lịch sử của người đó; có hoàn tác; chốt khách hàng hoặc chốt NPP gắn nhãn tương ứng ngay trên màn.
- [ ] Số điện thoại: ô chọn **mã nước (mặc định +84 Việt Nam)** rồi ô nhập số, ở form thêm và sửa người; số sai (chữ cái, ngoài 6–15 chữ số) bị từ chối kèm thông báo rõ; số hiện ở trang chi tiết.
- [ ] Nhãn ô ghi chú đổi từ "(không bắt buộc)" thành "(FORMHD)".
- [ ] Mobile-first (390×844), nút chạm ≥ 44px, dùng được một tay; trạng thái rỗng của từng bộ lọc có hướng dẫn; XP, streak và mục tiêu ngày trên Hôm nay không đổi cách tính.

---

## Implementation Notes

- Dùng hàm thuần của story 012; màn hình chỉ hiển thị và ghi sự kiện qua `EventStore` được truyền vào.
- Chạy bản build thật cũ (trước khi sửa) để tái hiện lỗi NPP và chụp ảnh; nếu không tái hiện được thì ghi rõ trong Completion Notes và giữ test chặn hồi quy bằng ảnh "Tất cả"/"NPP" sau khi chốt.
- Chụp ảnh các trạng thái: Tất cả, lọc Khách hàng, lọc NPP, Đã lưu trữ + Khôi phục, chi tiết người với việc cần làm, hoàn thành việc và hoàn tác, form số điện thoại (kể cả lỗi), trạng thái rỗng.

---

## Out of Scope

- Story 012: kiểu sự kiện và logic.
- Story 014: tab Hoạt động và liên kết từ Bảng 30x30.
- Nút "Tạo tài khoản" (giai đoạn 2).
- Sao lưu và khôi phục bằng file (story 011).

---

## Files

- `src/ui/screens/people-screen.tsx`
- `src/ui/screens/person-form.tsx`
- `src/ui/people-helpers.ts`
- `src/app.tsx`
- `src/ui/strings.ts`
- `src/ui/styles.css`
- `production/qa/evidence/story-013-contacts-tab/*.png`

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: ảnh chụp màn hình từng trạng thái, giữ lại trong `production/qa/evidence/`

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-012-person-tasks-labels.md`, `production/epics/diamond-challenge/story-009-people-list.md`
- Unlocks: `story-014-activity-tab.md`
