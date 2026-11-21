# Story 034: Trang chi tiết người: thông tin mở sẵn, popup hoạt động và popup Lịch sử

> **Epic**: diamond-challenge
> **Status**: Ready
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-21

## Context

**GDD**: `design/gdd/crm.md` (luật 13, 26; AC-35–38)
**Requirement**: Phản hồi dùng thử 2026-11-21: bấm vào liên hệ thì hiện sẵn thông tin, không cần nút "Sửa thông tin" hay "Thu gọn"; bấm hoạt động mở popup nhập chi tiết rồi xác nhận hoặc huỷ; Lịch sử là nút mở popup thống kê.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Mở trang chi tiết: các ô tên, số điện thoại, mã Amway, ghi chú hiện sẵn, có giá trị hiện tại; không còn nút "Sửa thông tin" / "Thu gọn". "Lưu thay đổi" chỉ bật khi có ô khác giá trị đã lưu; lưu xong thì tắt lại và báo "Đã lưu". Kiểm tra tên, số, mã như hiện nay.
- [ ] Bấm một việc (Liên hệ, Demo, Trình bày opp, Follow-up, Chốt khách hàng, Chốt NPP) mở popup: tên việc, XP, ô Ghi chú (không bắt buộc, tối đa `activityNoteMaxLength`), ô Ngày giờ mặc định là bây giờ, hai nút "Xác nhận" và "Huỷ".
- [ ] "Xác nhận" ghi đúng một `activity_logged` (qua `buildTaskCompletionEvent`, thêm `payload.note` khi có, `timestamp` = ngày giờ đã chọn); "Huỷ", phím Esc hoặc bấm ra ngoài không ghi gì. "Hoàn tác" và việc Chốt NPP mở "Tạo tài khoản" vẫn chạy như cũ.
- [ ] Ngày giờ ở tương lai, hoặc lùi quá `activityBackdateDays` ngày (mặc định 7) thì "Xác nhận" bị tắt và có thông báo; ghi lùi 2 ngày thì sự kiện mang thời điểm đó và XP tính vào ngày đó. Hàm kiểm tra thuần, có unit test (biên: đúng 7 ngày, 7 ngày + 1 phút, 1 phút tới tương lai).
- [ ] Nút "Lịch sử" mở popup: tóm tắt (số lần mỗi việc, tổng XP từ người này, lần liên hệ đầu tiên và gần nhất, số ngày kể từ lần gần nhất) và danh sách mới nhất trước kèm ghi chú và người làm; nút "Đóng". Người chưa có lịch sử: popup báo chưa có. Hàm tóm tắt thuần, có unit test (bỏ sự kiện đã hoàn tác, tính cả việc của liên hệ đã gộp).
- [ ] Popup dùng `role="dialog"`, `aria-modal`, có tiêu đề; mở thì tiêu điểm vào popup, Esc đóng, đóng thì tiêu điểm về nút đã mở; nền phía sau không cuộn.
- [ ] Ghi chú hoạt động đồng bộ trong hộ như mọi sự kiện có `personId` (không đổi `contact-sync`); hoạt động cũ không có ghi chú hiện bình thường. Không tạo migration.
- [ ] Mobile-first 390×844 và 320px: nút ≥ 44px, không tràn ngang, popup vừa màn hình (cuộn bên trong nếu dài).

---

## Implementation Notes

- Nền: `src/ui/screens/person-form.tsx` (`PersonDetail`: bỏ `editOpen`, giữ `saveEdits`; `completeTask` nhận ghi chú và thời điểm), `src/domain/people.ts` (`buildTaskCompletionEvent` đã nhận `timestamp`; thêm `note`), `buildPersonHistory` (thêm ghi chú), `src/ui/strings.ts`, `src/ui/styles.css`.
- Hai núm mới trong `src/config/game-config.json` theo bảng Tuning Knobs của `crm.md`: `activityBackdateDays` (7), `activityNoteMaxLength` (500). Không hardcode.
- Ghi lùi ngày: sự kiện có `timestamp` riêng nên `withHouseholdClock` không đổi nó; kiểm tra lại streak và mục tiêu ngày tính đúng theo ngày đã chọn.
- Nếu app đã có thành phần popup (ví dụ `AchievementsOverlay`, `.popup-backdrop`), dùng lại kiểu dáng thay vì tạo kiểu mới.
- Chụp ảnh: trang chi tiết với thông tin mở sẵn, popup hoạt động (390 và 320px), lỗi ngày giờ, popup Lịch sử.

---

## Out of Scope

- Sửa hoặc xoá ghi chú của hoạt động đã ghi (chỉ hoàn tác lần vừa làm như hiện nay).
- Màn thống kê chung cho cả Danh bạ.
- Đổi XP hay danh sách việc.

---

## Files

- `src/ui/screens/person-form.tsx`, `src/domain/people.ts`
- `src/config/game-config.json`, `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/unit/domain/` (hàm kiểm tra ngày giờ, hàm tóm tắt lịch sử)
- `production/qa/evidence/story-034-person-detail-popups/`

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: ảnh chụp từng trạng thái, giữ lại trong `production/qa/evidence/`; unit test cho hai hàm thuần (giữ lại dù `qa.level: minimal`, vì ghi lùi ngày ảnh hưởng XP và streak).

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: None (story 033 đã xong; không cần migration)
- Unlocks: None
