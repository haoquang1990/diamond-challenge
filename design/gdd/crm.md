# crm — Danh sách Người

> **Status**: In Design
> **Author**: user + Claude
> **Last Updated**: 2026-11-03
> **Last Verified**: 2026-11-03
> **Implements**: `design/game-brief.md` MVP mục 1, 2, 5 (Bảng 30x30), 6

## Summary

Một danh sách Người duy nhất, mỗi người có một giai đoạn. Mọi hoạt động Làm gắn với một người, chuyển giai đoạn cộng XP, dữ liệu chỉ lưu trên máy và có sao lưu/khôi phục bằng file. Mỗi người chỉ quản lý danh sách của chính mình. Giai đoạn 1 chỉ có Bảng 30x30 của bản thân; cây hệ thống và Bảng 4x4 thuộc giai đoạn 2 (`design/phase-2-notes.md`).

> **Quick reference** — Layer: `Foundation` · Priority: `MVP` · Key deps: `Nhật ký sự kiện (story 001)`, `computeProgress (story 002)`
> *(Category `Core`, Layer và Priority được suy ra từ brief, vì ở tier minimal không có systems index.)*
> *(Tính khả thi chưa được đối chiếu với tài liệu tham chiếu engine: dự án là web app, không có `docs/engine-reference/` cho stack này.)*

## Overview

- Người là thực thể trung tâm. Người, giai đoạn và danh sách đều được **tính lại từ nhật ký sự kiện** (chỉ thêm, không sửa/xóa), giống XP và streak.
- Giai đoạn theo thứ tự: **Người quen → Đã liên hệ → Đã demo → Đã nghe opp → Khách hàng → NPP tuyến dưới**.
- Chuyển giai đoạn cộng XP vào hệ thống XP sẵn có, nên mục tiêu ngày, streak và bản đồ Con đường Diamond tự tính đúng.
- Danh sách chỉ gồm người của chính mình: KH của mình và NPP F1 của mình. Không dựng cây nhiều tầng trên máy.

## Detailed Design

### Core Rules

1. **Người** gồm: `personId` (UUID), `name` (bắt buộc, không rỗng sau khi cắt khoảng trắng), `note` (tùy chọn), giai đoạn (suy ra), `linkedUserId` (luôn `null` ở giai đoạn 1; được ghi khi tạo tài khoản cho một NPP F1 ở giai đoạn 2).
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
10. **Danh sách chỉ của mình.** Mọi người chưa lưu trữ trong danh sách đều là của mình. Ai ở giai đoạn Khách hàng là KH của mình, ai ở giai đoạn NPP là NPP F1 của mình. Không có ô chọn người bảo trợ, không dựng cây nhiều tầng trên máy.

### States and Transitions

- Người: `Đang dùng` → `Đã lưu trữ` (`person_archived`). Không khôi phục từ lưu trữ ở MVP.
- Giai đoạn: đi tiến một bậc có XP một lần; lùi hoặc nhảy bậc không có XP; mọi lần chuyển đều hoàn tác được.

### Interactions with Other Systems

- `computeProgress` cộng mọi `payload.xp`, nên XP chuyển giai đoạn tự được tính. `computeProgress` **không đổi**.
- Mốc chặng ở `stages.ts` đếm `activity_logged` theo `activityType`, không đổi.
- Nhắc nhở không bị ảnh hưởng.
- **Màn "Bảng 30x30"** (mở từ màn Con đường): liên hệ x/250, Khách hàng x/30, NPP F1 x/30, kèm huy hiệu "Đạt 30x30". Ghi chú luôn hiển thị: "Số liệu tính từ danh sách bạn tự nhập, không phải xác nhận chính thức."
- **Không cộng XP:** bảng này không tạo sự kiện có `xp`. XP, streak và chặng Con đường tính như cũ.
- Không có cách phân loại "tích cực / không tích cực" của Người.
- **Giai đoạn 2** (`design/phase-2-notes.md`): nút "Tạo tài khoản" trên một NPP F1 (ghi `linkedUserId`); app đồng bộ số tổng hợp (số KH, số NPP F1, đạt 30x30) lên server; server dựng cây hệ thống và tính Bảng 4x4.

## Formulas

**Biến** (từ cấu hình, xem Tuning Knobs): `Kc` = `customersTarget` (30), `Kf` = `f1Target` (30), `L` = `contactsTarget` (250).

| Công thức | Định nghĩa |
|---|---|
| **KH của mình** | `customers(me)` = số người **chưa lưu trữ** ở giai đoạn `customer` |
| **NPP F1 của mình** | `f1(me)` = số người **chưa lưu trữ** ở giai đoạn `downline` |
| **Liên hệ của mình** | `contacts(me)` = số người **chưa lưu trữ**, **mọi giai đoạn** |
| **Đạt 30x30** | `achieved(me) = customers(me) ≥ Kc ∧ f1(me) ≥ Kf` |
| **Đạt mốc liên hệ** | `contactsMet(me) = contacts(me) ≥ L` |

**Khoảng giá trị:** cả ba số đếm từ 0 trở lên; `customers + f1 ≤ contacts`.

**Ví dụ:** danh sách có 260 người chưa lưu trữ, trong đó 31 ở giai đoạn Khách hàng và 29 ở giai đoạn NPP → `contacts = 260` (đạt mốc 250), `customers = 31`, `f1 = 29` → chưa đạt 30x30. Một Khách hàng được chuyển lên NPP → `customers = 30`, `f1 = 30` → đạt 30x30.

Công thức tầng, nhánh, điểm sâu và 30x30x4x4 thuộc giai đoạn 2 và do server tính (`design/phase-2-notes.md`).

## Edge Cases

- Tên rỗng hoặc chỉ có khoảng trắng: từ chối. Tên trùng nhau: cho phép nhưng cảnh báo.
- Tên rất dài: cắt khi hiển thị, lưu nguyên (giới hạn trong config).
- Hoạt động trỏ tới `personId` không có sự kiện `person_added` (ví dụ sau khi nhập file thiếu): hiện "Người không rõ", không báo lỗi, không mất XP.
- Chuyển lùi rồi tiến lại: không nhận XP lần hai ở giai đoạn đó. Hoàn tác lần nhận XP đầu thì được nhận lại.
- Nhập file sai định dạng hoặc `formatVersion` lạ: từ chối cả file với thông báo rõ. Từng sự kiện hỏng trong file hợp lệ: bỏ qua và đếm.
- Hai sự kiện cùng thời điểm: xếp theo thứ tự thêm vào.
- Người đã lưu trữ có hoạt động: XP đã có vẫn giữ.
- **NPP bị chuyển lùi khỏi giai đoạn NPP** (ví dụ sửa nhầm): `f1(me)` giảm ngay; nếu là Khách hàng thì `customers(me)` tăng tương ứng.
- **Người đã lưu trữ:** không tính vào KH, NPP F1 hay liên hệ.
- **Danh sách có vài nghìn người:** bảng vẫn phải tính được nhanh; mỗi lần tính chỉ duyệt danh sách một lượt.

## Dependencies

- **Phụ thuộc vào:** nhật ký sự kiện (`EventStore`, story 001), `computeProgress` (story 002), `src/config/game-config.json`.
- **Được phụ thuộc bởi:** màn Làm (chọn người), màn Hôm nay (có thể hiện người cần theo dõi), bản đồ (mốc hoạt động), màn Bảng 30x30 (mở từ màn Con đường), giai đoạn 2 (tạo tài khoản cho F1, đồng bộ số tổng hợp, Bảng 4x4).
- **Cần sửa code hiện có:** màn Làm, `strings.ts`, `game-config.json`, thêm kiểu sự kiện vào `src/data/event-store.ts` (thay đổi cấu trúc sự kiện), màn Con đường (nút mở Bảng 30x30).

## Tuning Knobs

Đặt trong `src/config/game-config.json`, mục `target30x30`:

| Núm | Mặc định | Khoảng an toàn | Ảnh hưởng |
|---|---|---|---|
| `contactsTarget` | 250 | 1–5000 | mốc phụ "liên hệ" |
| `customersTarget` | 30 | 1–999 | ngưỡng KH của "đạt 30x30" |
| `f1Target` | 30 | 1–999 | ngưỡng NPP F1 của "đạt 30x30" |

Các núm của Bảng 4x4 (`depthTarget`, `branchTarget`, `topBranchesShown`) thuộc giai đoạn 2, xem `design/phase-2-notes.md`.

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
- **AC-12:** Given 30 người ở giai đoạn Khách hàng và 29 ở giai đoạn NPP, When mở Bảng 30x30, Then chưa "đạt 30x30"; chuyển thêm 1 người lên NPP thì "đạt".
- **AC-13:** Given một Khách hàng và một NPP đã lưu trữ, When tính, Then cả hai không được đếm vào KH, NPP F1 hay liên hệ.
- **AC-14:** Given 250 người chưa lưu trữ ở các giai đoạn khác nhau, When mở bảng, Then liên hệ = 250 và mốc liên hệ được đánh dấu đạt; với 249 thì chưa.
- **AC-15:** Given một NPP bị chuyển lùi về Khách hàng, When tính lại, Then NPP F1 giảm 1 và KH tăng 1.
- **AC-16:** Given đổi `customersTarget` trong cấu hình từ 30 xuống 25, When mở bảng, Then kết quả đổi theo mà không sửa code.
- **AC-17:** Given mở màn thêm/sửa người và Bảng 30x30, When xem, Then không có ô chọn người bảo trợ; bảng không tạo sự kiện có `xp` và luôn hiện ghi chú "số liệu tính từ danh sách bạn tự nhập, không phải xác nhận chính thức".
