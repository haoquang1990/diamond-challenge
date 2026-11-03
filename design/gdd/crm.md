# crm — Danh sách Người

> **Status**: In Design
> **Author**: user + Claude
> **Last Updated**: 2026-11-03
> **Last Verified**: 2026-11-03
> **Implements**: `design/game-brief.md` MVP mục 1, 2, 6

## Summary

Một danh sách Người duy nhất, mỗi người có một giai đoạn. Mọi hoạt động Làm gắn với một người, chuyển giai đoạn cộng XP, dữ liệu chỉ lưu trên máy và có sao lưu/khôi phục bằng file.

> **Quick reference** — Layer: `Foundation` · Priority: `MVP` · Key deps: `Nhật ký sự kiện (story 001)`, `computeProgress (story 002)`
> *(Category `Core`, Layer và Priority được suy ra từ brief, vì ở tier minimal không có systems index.)*
> *(Tính khả thi chưa được đối chiếu với tài liệu tham chiếu engine: dự án là web app, không có `docs/engine-reference/` cho stack này.)*

## Overview

- Người là thực thể trung tâm. Người, giai đoạn và danh sách đều được **tính lại từ nhật ký sự kiện** (chỉ thêm, không sửa/xóa), giống XP và streak.
- Giai đoạn theo thứ tự: **Người quen → Đã liên hệ → Đã demo → Đã nghe opp → Khách hàng → NPP tuyến dưới**.
- Chuyển giai đoạn cộng XP vào hệ thống XP sẵn có, nên mục tiêu ngày, streak và bản đồ Con đường Diamond tự tính đúng.

## Detailed Design

### Core Rules

1. **Người** gồm: `personId` (UUID), `name` (bắt buộc, không rỗng sau khi cắt khoảng trắng), `note` (tùy chọn), giai đoạn (suy ra), `linkedUserId` (luôn `null` ở MVP, dùng ở giai đoạn 2).
2. **Giai đoạn** nằm trong `game-config.json` mục `personStages`: `id`, tên, XP. Mặc định: `acquaintance` 0, `contacted` 5, `demoed` 10, `heard_opp` 20, `customer` 30, `downline` 50. Người mới luôn bắt đầu ở `acquaintance`.
3. **Sự kiện mới** (đều chỉ thêm):
   - `person_added {personId, name, note?}`
   - `person_updated {personId, name?, note?}`
   - `person_archived {personId}` (ẩn khỏi danh sách, không mất XP đã có)
   - `person_stage_changed {personId, from, to, xp}`
   - `activity_reassigned {activityId, personId}` (gán lại hoạt động cũ chưa gắn ai)
   - `activity_logged` thêm trường tùy chọn `personId`.
4. **Thêm người** chính là hoạt động Làm "Thêm tên vào danh sách": ghi đồng thời `person_added` và `activity_logged {add_name}`. Tự thêm người không kèm hoạt động thì không có XP.
5. **Chuyển giai đoạn:** `xp` của sự kiện là XP của giai đoạn `to` **chỉ khi** thỏa cả hai: (a) `to` là giai đoạn **kế tiếp** ngay của người đó, và (b) người đó **chưa từng** nhận XP ở giai đoạn `to` (sự kiện chưa bị hoàn tác). Ngược lại `xp = 0`. Chuyển lùi hoặc nhảy bậc vẫn được phép để sửa nhầm, nhưng không có XP, nên không farm được.
6. **Hoàn tác** một lần chuyển giai đoạn bằng sự kiện bù `compensates` (như cách hoàn tác hoạt động). Giai đoạn hiện tại = `to` của sự kiện chuyển giai đoạn cuối cùng **chưa bị bù**, nếu không có thì `acquaintance`.
7. **Gợi ý, không tự động:** mỗi loại hoạt động trong config có thể có `suggestsStage` (ví dụ "Demo" gợi ý `demoed`). Sau khi ghi hoạt động, app hỏi một chạm "Chuyển [Tên] sang Đã demo?". Không bao giờ tự chuyển.
8. **Hoạt động cũ chưa gắn ai** vẫn tính XP và streak, hiện là "Không gắn người", và gán lại được bằng `activity_reassigned` (gán lại không đổi XP).
9. **Sao lưu:** xuất một file JSON `diamond-challenge-backup-YYYY-MM-DD.json` gồm `format`, `formatVersion: 1`, `exportedAt`, `events[]` (toàn bộ nhật ký). **Khôi phục** là **gộp, bỏ trùng theo `id` sự kiện**: nhập hai lần không sinh trùng, không mất dữ liệu đang có. Mỗi sự kiện đi qua cùng bộ kiểm tra khi đọc (`parseStoredEvent`). Sau khi nhập, báo "thêm N, bỏ qua M". File chứa tên và ghi chú về người khác, nên app nhắc người dùng giữ file cẩn thận.

### States and Transitions

- Người: `Đang dùng` → `Đã lưu trữ` (`person_archived`). Không khôi phục từ lưu trữ ở MVP.
- Giai đoạn: đi tiến một bậc có XP một lần; lùi hoặc nhảy bậc không có XP; mọi lần chuyển đều hoàn tác được.

### Interactions with Other Systems

- `computeProgress` cộng mọi `payload.xp`, nên XP chuyển giai đoạn tự được tính. `computeProgress` **không đổi**.
- Mốc chặng ở `stages.ts` đếm `activity_logged` theo `activityType`, không đổi.
- Nhắc nhở không bị ảnh hưởng.
- Giai đoạn 2: `linkedUserId` nối người ở giai đoạn `downline` với tài khoản thật do admin tạo (`design/phase-2-notes.md`).

## Edge Cases

- Tên rỗng hoặc chỉ có khoảng trắng: từ chối. Tên trùng nhau: cho phép nhưng cảnh báo.
- Tên rất dài: cắt khi hiển thị, lưu nguyên (giới hạn trong config).
- Hoạt động trỏ tới `personId` không có sự kiện `person_added` (ví dụ sau khi nhập file thiếu): hiện "Người không rõ", không báo lỗi, không mất XP.
- Chuyển lùi rồi tiến lại: không nhận XP lần hai ở giai đoạn đó. Hoàn tác lần nhận XP đầu thì được nhận lại.
- Nhập file sai định dạng hoặc `formatVersion` lạ: từ chối cả file với thông báo rõ. Từng sự kiện hỏng trong file hợp lệ: bỏ qua và đếm.
- Hai sự kiện cùng thời điểm: xếp theo thứ tự thêm vào.
- Người đã lưu trữ có hoạt động: XP đã có vẫn giữ.

## Dependencies

- **Phụ thuộc vào:** nhật ký sự kiện (`EventStore`, story 001), `computeProgress` (story 002), `src/config/game-config.json`.
- **Được phụ thuộc bởi:** màn Làm (chọn người), màn Hôm nay (có thể hiện người cần theo dõi), bản đồ (mốc hoạt động), giai đoạn 2 (tài khoản, đồng bộ).
- **Cần sửa code hiện có:** màn Làm, `strings.ts`, `game-config.json`, thêm kiểu sự kiện vào `src/data/event-store.ts` (thay đổi cấu trúc sự kiện).

## Acceptance Criteria

- **AC-1:** Given nhật ký rỗng, When thêm người "An", Then danh sách có "An" ở `Người quen` và XP tăng 5 (hoạt động `add_name`).
- **AC-2:** Given An ở `acquaintance`, When chuyển sang `contacted`, Then có `person_stage_changed` với `xp = 5`.
- **AC-3:** Given An ở `contacted`, When chuyển thẳng sang `heard_opp` (nhảy bậc), Then `xp = 0` và giai đoạn là `heard_opp`.
- **AC-4:** Given An từng nhận XP ở `demoed`, When chuyển lùi về `contacted` rồi tiến lại `demoed`, Then lần tiến lại `xp = 0`.
- **AC-5:** Given một lần chuyển giai đoạn có XP, When hoàn tác bằng sự kiện bù, Then XP bị trừ lại và giai đoạn trở về trước đó.
- **AC-6:** Given tên chỉ có khoảng trắng, When lưu, Then bị từ chối và không ghi sự kiện nào.
- **AC-7:** Given hoạt động cũ không có `personId`, When gán cho An, Then hoạt động hiện thuộc An và tổng XP không đổi.
- **AC-8:** Given một file sao lưu, When khôi phục hai lần liên tiếp, Then lần hai thêm 0 sự kiện và dữ liệu không đổi.
- **AC-9:** Given file có 1 sự kiện hỏng trong 10, When khôi phục, Then thêm 9, bỏ qua 1 và báo đúng số liệu.
- **AC-10:** Given file có `formatVersion` lạ, When khôi phục, Then bị từ chối, nhật ký hiện tại không đổi.
- **AC-11:** Given hoạt động trỏ tới người không tồn tại, When mở danh sách hoặc Làm, Then không lỗi và hiện "Người không rõ".
