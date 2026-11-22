# Story 035: Trang chi tiết người: Thông tin lên đầu, nút Hoạt động mở danh sách đủ việc, làm lại mọi việc

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-22

## Context

**GDD**: `design/gdd/crm.md` (luật 2, 4, 12, 13, 26; AC-2, AC-39–42)
**Requirement**: Phản hồi dùng thử 2026-11-22: thêm người xong thì thu gọn form; vào chi tiết liên hệ thì phần Thông tin ở trên; "Hoạt động" là một nút cạnh nút "Lịch sử", bấm mới hiện các việc để chọn; danh sách việc hiện đủ vì có việc làm lại nhiều lần. Quyết định: mỗi lần làm đều cộng đủ XP; nhãn giữ ngày chốt đầu; mốc "Khách hàng mới" đếm người khác nhau.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [ ] Danh bạ đã có người: thêm người xong thì form "Thêm người" thu gọn ngay, người mới hiện trong danh sách; Danh bạ trống thì form vẫn mở sẵn.
- [ ] Trang chi tiết, từ trên xuống: tên, nhãn, cảnh báo → **Thông tin** (các ô và "Lưu thay đổi" như story 034) → một hàng hai nút **Hoạt động** và **Lịch sử** → lưu trữ. Không còn danh sách việc hiện sẵn trên trang. Nút "Tạo tài khoản" (NPP chưa có tài khoản) và mục "Liên hệ đã gộp" vẫn còn.
- [ ] Nút **Hoạt động** mở popup danh sách đủ mọi việc trong `personTasks` theo thứ tự cấu hình, mỗi dòng có tên, XP và "đã làm N lần" khi N > 0; có nút "Đóng". Chọn một việc thì mở popup ghi chú + ngày giờ của story 034 (Xác nhận / Huỷ, kiểm tra ngày giờ, Chốt NPP mở "Tạo tài khoản", "Hoàn tác" sau khi xác nhận).
- [ ] Mọi việc làm lại được (`repeatable: true` cho cả 6 việc trong `game-config.json`); mỗi lần xác nhận ghi một `activity_logged` và cộng đủ XP của việc; Lịch sử hiện từng lần. Người đã lưu trữ không làm được việc (nút Hoạt động tắt hoặc ẩn).
- [ ] Nhãn: chốt KH cho người đã KH hoặc NPP thì nhãn không đổi; chốt NPP lại thì ngày lên NPP vẫn là lần chốt NPP đầu tiên chưa bị hoàn tác; hoàn tác một lần chốt thì nhãn và ngày tính lại từ các lần còn lại. Hàm thuần, có unit test.
- [ ] Mốc Con đường "Khách hàng mới" (`activityType: new_customer`) đếm số người khác nhau có lần chốt KH chưa bị hoàn tác; con số của dữ liệu hiện có không đổi. Hàm thuần, có unit test (cùng một người chốt 2 lần đếm 1; hoàn tác một lần vẫn đếm 1; hoàn tác cả hai đếm 0).
- [ ] Popup danh sách dùng thành phần `Dialog` của story 034 (`role="dialog"`, Esc đóng, tiêu điểm trả về nút đã mở, khoá cuộn nền).
- [ ] Mobile-first 390×844 và 320px: hai nút Hoạt động / Lịch sử cùng hàng (hoặc xếp chồng nếu không đủ chỗ), nút ≥ 44px, không tràn ngang, popup vừa màn hình.

---

## Implementation Notes

- Nền: story 034 (`src/ui/screens/person-form.tsx`: `PersonDetail`, `Dialog`, popup hoạt động; `src/ui/people-helpers.ts`: `buildPersonHistory`, `summarizeHistory`), `src/ui/screens/people-screen.tsx` (`showAdd`, `addPerson`).
- Nhãn: `derivePeople` trong `src/domain/people.ts` (khoảng dòng 736: `setLabel` cho NPP luôn ghi đè ngày; cần giữ ngày đầu). `pendingTasks` không còn lọc việc đã làm.
- Mốc: `countActivities` / chỗ tính mốc trong `src/domain/stages.ts`; chỉ mốc `new_customer` đếm người, các `activityType` khác giữ cách đếm hiện tại. Kiểm tra nơi gọi (Con đường, thành tích) để không đổi con số khác.
- Giá trị lấy từ `game-config.json`, không hardcode. Không cần migration; không đổi đồng bộ.
- Chụp ảnh: Danh bạ sau khi thêm người (form thu gọn), trang chi tiết bố cục mới, popup danh sách việc (có "đã làm N lần"), Lịch sử có 2 lần cùng việc; 390 và 320px.

---

## Out of Scope

- Đổi XP của từng việc hoặc giới hạn số lần làm trong ngày.
- Sửa/xoá một lần làm cũ trong Lịch sử (chỉ hoàn tác lần vừa làm).

---

## Files

- `src/ui/screens/person-form.tsx` (Thông tin first, Hoạt động / Lịch sử row, task list dialog)
- `src/ui/screens/people-screen.tsx` (add form collapses after adding)
- `src/ui/people-helpers.ts` (`countDoneTasks`)
- `src/domain/people.ts` (every task stays and repeats; first NPP date kept)
- `src/domain/stages.ts` (`countMilestoneActivities`: Khách hàng mới counts people)
- `src/config/game-config.json` (`repeatable: true` on all 6 tasks)
- `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/unit/people/people-tasks.test.ts` (updated to crm rule 4 + new label tests), `tests/unit/people/done-task-counts.test.ts` (new), `tests/unit/stages/stages.test.ts` (new milestone tests; Emerald fixture 2 → 1)
- `production/qa/evidence/story-035-activity-button-repeatable-tasks/` (10 screenshots at 390 and 320px + stamp)

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above.*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: ảnh chụp từng trạng thái, giữ lại trong `production/qa/evidence/`; unit test cho hàm nhãn và hàm đếm mốc (giữ lại dù `qa.level: minimal`, vì ảnh hưởng nhãn, 30x30 và chặng).

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/diamond-challenge/story-034-person-detail-popups.md`
- Unlocks: None

## Completion Notes
**Completed**: 2026-11-22
**Criteria**: 8/8 passing (none deferred)
**Deviations**: Advisory, not logged as tech debt: (1) "count distinct people" is a constant for `new_customer` in `stages.ts` (`DISTINCT_PERSON_ACTIVITY`), not a per-milestone config flag; (2) activities logged without a person and later reassigned, and two merged contacts that both closed a customer, still count per event, so today's numbers do not change; (3) seven existing tests were updated to crm.md rule 4 (done tasks stay, no `already_done` rejection; the Emerald fixture went from 2 to 1 because both closings were the same person), none skipped or weakened; (4) every task earns full XP each time (user decision 2026-11-22), so repeating Chốt NPP gives +50 XP each time; (5) `activityNoneLeft` in `strings.ts` is now unused and ESLint did not run (no config in the repo)
**Test Evidence**: screenshots `production/qa/evidence/story-035-activity-button-repeatable-tasks/` (10 images at 390 and 320px, stamp unchanged); `tests/unit/people/people-tasks.test.ts`, `tests/unit/people/done-task-counts.test.ts`, `tests/unit/stages/stages.test.ts`; full suite 571/571
**Reviewed by**: self, no independent review
