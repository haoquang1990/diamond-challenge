# crm — Danh sách Người

> **Status**: In Design
> **Author**: user + Claude
> **Last Updated**: 2026-11-03
> **Last Verified**: 2026-11-03
> **Implements**: `design/game-brief.md` MVP mục 1, 2, 6

## Summary

Một danh sách Người duy nhất, mỗi người có một giai đoạn. Mọi hoạt động Làm gắn với một người, chuyển giai đoạn cộng XP, dữ liệu chỉ lưu trên máy và có sao lưu/khôi phục bằng file. Dựng cây bảo trợ để theo dõi mục tiêu 30x30x4x4 (số liệu tính từ danh sách bạn tự nhập, không phải xác nhận chính thức).

> **Quick reference** — Layer: `Foundation` · Priority: `MVP` · Key deps: `Nhật ký sự kiện (story 001)`, `computeProgress (story 002)`
> *(Category `Core`, Layer và Priority được suy ra từ brief, vì ở tier minimal không có systems index.)*
> *(Tính khả thi chưa được đối chiếu với tài liệu tham chiếu engine: dự án là web app, không có `docs/engine-reference/` cho stack này.)*

## Overview

- Người là thực thể trung tâm. Người, giai đoạn và danh sách đều được **tính lại từ nhật ký sự kiện** (chỉ thêm, không sửa/xóa), giống XP và streak.
- Giai đoạn theo thứ tự: **Người quen → Đã liên hệ → Đã demo → Đã nghe opp → Khách hàng → NPP tuyến dưới**.
- Chuyển giai đoạn cộng XP vào hệ thống XP sẵn có, nên mục tiêu ngày, streak và bản đồ Con đường Diamond tự tính đúng.

## Detailed Design

### Core Rules

1. **Người** gồm: `personId` (UUID), `name` (bắt buộc, không rỗng sau khi cắt khoảng trắng), `note` (tùy chọn), giai đoạn (suy ra), `linkedUserId` (luôn `null` ở MVP, dùng ở giai đoạn 2), `sponsorId` (người bảo trợ: `null` = chính mình, hoặc `personId` của một NPP).
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
10. **Sự kiện mới cho cây bảo trợ** (chỉ thêm, hoàn tác được bằng sự kiện bù): `person_sponsor_set {personId, sponsorId|null}`; `person_added` có thêm `sponsorId` tùy chọn. Giá trị mới nhất chưa bị bù là giá trị hiện tại. Mặc định `sponsorId = null`.
11. **Người bảo trợ** chỉ có thể là chính mình (`null`) hoặc một người đang ở giai đoạn **NPP tuyến dưới**. Không được chọn chính người đó hoặc một người trong tuyến dưới của họ (tránh vòng lặp).
12. **Tầng** (tính, không lưu): người có `sponsorId = null` là **T1**; con trực tiếp của một T1 là T2, v.v. Tầng được **tính lại từ nhật ký** mỗi lần, nên đổi người bảo trợ sẽ đổi tầng của cả tuyến dưới (không cộng, không trừ XP).
13. **Nhánh** = một T1 (người ở giai đoạn NPP, `sponsorId = null`) cùng toàn bộ tuyến dưới của họ.
14. **Mọi số liệu, của mình lẫn của tuyến dưới, đều đếm từ danh sách.** KH của x là người ở giai đoạn Khách hàng có người bảo trợ là x. NPP tầng 1 của x là người ở giai đoạn NPP có người bảo trợ là x. Ở đây x là mình (`sponsorId = null`) hoặc một NPP. Không có ô nhập tay.

### States and Transitions

- Người: `Đang dùng` → `Đã lưu trữ` (`person_archived`). Không khôi phục từ lưu trữ ở MVP.
- Giai đoạn: đi tiến một bậc có XP một lần; lùi hoặc nhảy bậc không có XP; mọi lần chuyển đều hoàn tác được.

### Interactions with Other Systems

- `computeProgress` cộng mọi `payload.xp`, nên XP chuyển giai đoạn tự được tính. `computeProgress` **không đổi**.
- Mốc chặng ở `stages.ts` đếm `activity_logged` theo `activityType`, không đổi.
- Nhắc nhở không bị ảnh hưởng.
- Giai đoạn 2: `linkedUserId` nối người ở giai đoạn `downline` với tài khoản thật do admin tạo (`design/phase-2-notes.md`); có thể đồng bộ thêm số tổng hợp từ tài khoản thật.
- **Màn "Bảng 30x30x4x4"** (mở từ màn Con đường):
  - **Tiến độ của mình:** liên hệ x/250, Khách hàng x/30, NPP tầng 1 x/30, kèm huy hiệu "Đạt 30x30".
  - **Nhánh:** số nhánh đạt chuẩn x/4, và **4 nhánh có điểm sâu cao nhất**. Mỗi nhánh hiện tên T1, điểm sâu x/4 và danh sách các tầng đã có người đạt 30x30 (kèm tên).
  - **Cảnh báo tổng hợp:** vòng lặp, người bảo trợ không hợp lệ.
  - **Ghi chú luôn hiển thị:** "Số liệu tính từ danh sách bạn tự nhập, không phải xác nhận chính thức."
- **Không cộng XP:** bảng này không tạo sự kiện có `xp`. XP, streak và chặng Con đường tính như cũ.
- Không có cách phân loại "tích cực / không tích cực" của Người hay nhánh.

## Formulas

**Biến** (từ cấu hình, xem Tuning Knobs): `Kc` = `customersTarget` (30), `Kn` = `t1Target` (30), `D` = `depthTarget` (4), `B` = `branchTarget` (4), `L` = `contactsTarget` (250).

| Công thức | Định nghĩa |
|---|---|
| **KH của x** | `customers(x) = |{ q chưa lưu trữ : stage(q) = customer ∧ sponsor(q) = x }|` (x = mình, tức `null`, hoặc một NPP) |
| **NPP T1 của x** | `t1(x) = |{ q chưa lưu trữ : stage(q) = downline ∧ sponsor(q) = x }|` |
| **Liên hệ của mình** | `meContacts` = số người **chưa lưu trữ**, `sponsorId = null`, **mọi giai đoạn** |
| **Đạt 30x30** | `achieved(x) = customers(x) ≥ Kc ∧ t1(x) ≥ Kn`; với NPP chỉ xét người **chưa lưu trữ** ở giai đoạn NPP |
| **Tầng** | `tier(p) = 1 + số bước bảo trợ từ p tới mình` (T1 có `sponsorId = null`) |
| **Điểm sâu nhánh b** | `depth(b) = số giá trị tier khác nhau t sao cho ∃ p ∈ b, tier(p) = t ∧ achieved(p)` |
| **Nhánh đạt chuẩn** | `qualified(b) = depth(b) ≥ D` |
| **Số nhánh đạt chuẩn** | `Q = |{ b : qualified(b) }|` |
| **Đạt 30x30x4x4** | `goal = achieved(me) ∧ Q ≥ B` |

**Khoảng giá trị:** `depth(b)` từ 0 tới số tầng khác nhau trong nhánh. `Q` từ 0 tới số nhánh. `meContacts` từ 0 trở lên.

**Ví dụ (nhánh của Lan):** Lan (T1) đạt 30x30 → tầng 1. Hai NPP ở tầng 3 cùng đạt → tầng 3 chỉ tính một lần. Một NPP ở tầng 5 đạt → tầng 5. `depth = |{1, 3, 5}| = 3` → chưa đạt chuẩn. Thêm một người đạt ở tầng 6 → `depth = 4` → đạt chuẩn, dù các tầng không liền nhau.

**Xếp hạng nhánh trên bảng:** `depth` giảm dần; hòa thì nhiều người đạt hơn đứng trước; vẫn hòa thì theo tên.

## Edge Cases

- Tên rỗng hoặc chỉ có khoảng trắng: từ chối. Tên trùng nhau: cho phép nhưng cảnh báo.
- Tên rất dài: cắt khi hiển thị, lưu nguyên (giới hạn trong config).
- Hoạt động trỏ tới `personId` không có sự kiện `person_added` (ví dụ sau khi nhập file thiếu): hiện "Người không rõ", không báo lỗi, không mất XP.
- Chuyển lùi rồi tiến lại: không nhận XP lần hai ở giai đoạn đó. Hoàn tác lần nhận XP đầu thì được nhận lại.
- Nhập file sai định dạng hoặc `formatVersion` lạ: từ chối cả file với thông báo rõ. Từng sự kiện hỏng trong file hợp lệ: bỏ qua và đếm.
- Hai sự kiện cùng thời điểm: xếp theo thứ tự thêm vào.
- Người đã lưu trữ có hoạt động: XP đã có vẫn giữ.
- **Đổi người bảo trợ của một KH hay NPP:** số của người bảo trợ cũ giảm và của người mới tăng ngay.
- **Danh sách có vài nghìn người:** bảng vẫn phải tính được nhanh; mỗi lần tính chỉ duyệt cây một lượt.
- **Đổi người bảo trợ:** tầng của cả tuyến dưới đổi theo, điểm sâu và số nhánh được tính lại ngay. Trước khi lưu, app báo "N người sẽ đổi tầng". Không giữ lịch sử bảng cũ.
- **Người bảo trợ là chính mình hoặc người trong tuyến dưới của mình:** từ chối, không ghi sự kiện.
- **Vòng lặp trong dữ liệu** (ví dụ do gộp từ file sao lưu): các thành viên trong vòng lặp bị loại khỏi cây, không có tầng, không tính vào nhánh nào; bảng cảnh báo số người bị loại. Không báo lỗi, không treo.
- **Người bảo trợ không tồn tại** (id lạ sau khi nhập file): coi như chưa gắn vào cây, báo trong cảnh báo.
- **Người bảo trợ bị lưu trữ:** tuyến dưới giữ nguyên tầng (lưu trữ chỉ ẩn khỏi danh sách). Người đã lưu trữ không tính vào KH/T1 của mình và không tính là người đạt 30x30, nhưng vẫn là cầu nối cho nhánh. Nếu một T1 bị lưu trữ, nhánh của họ vẫn còn để tính điểm sâu.
- **Người bảo trợ bị chuyển lùi khỏi giai đoạn NPP:** cây giữ nguyên, báo cảnh báo "người bảo trợ không còn là NPP". Người đó không còn đạt 30x30.
- **Chưa có T1 nào:** bảng hiện "Chưa có nhánh nào", `Q = 0`. **Ít hơn 4 nhánh:** chỉ hiện những nhánh đang có.

## Dependencies

- **Phụ thuộc vào:** nhật ký sự kiện (`EventStore`, story 001), `computeProgress` (story 002), `src/config/game-config.json`.
- **Được phụ thuộc bởi:** màn Làm (chọn người), màn Hôm nay (có thể hiện người cần theo dõi), bản đồ (mốc hoạt động), màn Bảng 30x30x4x4 (mở từ màn Con đường), giai đoạn 2 (tài khoản, đồng bộ).
- **Cần sửa code hiện có:** màn Làm, `strings.ts`, `game-config.json`, thêm kiểu sự kiện vào `src/data/event-store.ts` (thay đổi cấu trúc sự kiện), màn Con đường (nút mở Bảng 30x30x4x4).

## Tuning Knobs

Đặt trong `src/config/game-config.json`, mục `target30x30x4x4`:

| Núm | Mặc định | Khoảng an toàn | Ảnh hưởng |
|---|---|---|---|
| `contactsTarget` | 250 | 1–5000 | mốc phụ "liên hệ" |
| `customersTarget` | 30 | 1–999 | ngưỡng KH của "đạt 30x30" |
| `t1Target` | 30 | 1–999 | ngưỡng NPP tầng 1 của "đạt 30x30" |
| `depthTarget` | 4 | 1–10 | điểm sâu để một nhánh đạt chuẩn |
| `branchTarget` | 4 | 1–30 | số nhánh đạt chuẩn cho mục tiêu |
| `topBranchesShown` | 4 | 1–10 | số nhánh hiện trên bảng |

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
- **AC-12:** Given 30 KH và 29 NPP T1 của mình, When xem bảng, Then chưa "đạt 30x30"; thêm 1 NPP T1 thì "đạt".
- **AC-13:** Given một KH hoặc NPP đã lưu trữ, hoặc một KH có người bảo trợ khác mình, When tính số của mình, Then không được đếm.
- **AC-14:** Given trong danh sách có 30 KH và 30 NPP với người bảo trợ là A, When tính, Then A đạt 30x30; với 30 và 29 thì không đạt.
- **AC-15:** Given trong một nhánh có người đạt ở tầng 1, 3, 3 và 5, When tính điểm sâu, Then `depth = 3` (tầng 3 chỉ tính một lần, các tầng không cần liền nhau).
- **AC-16:** Given thêm một người đạt ở tầng 6 vào nhánh trên, When tính lại, Then `depth = 4` và nhánh đạt chuẩn.
- **AC-17:** Given mình đạt 30x30 và đúng 4 nhánh đạt chuẩn, When tính, Then đạt 30x30x4x4; với 3 nhánh, hoặc khi mình chưa đạt 30x30, thì chưa đạt.
- **AC-18:** Given đổi người bảo trợ của một NPP, When xem bảng, Then tầng và điểm sâu đã được tính lại, và không có sự kiện nào mang `xp`.
- **AC-19:** Given chọn người bảo trợ là chính người đó hoặc người trong tuyến dưới của họ, When lưu, Then bị từ chối và không ghi sự kiện.
- **AC-20:** Given dữ liệu có vòng lặp bảo trợ, When mở bảng, Then không lỗi, các thành viên trong vòng lặp bị loại và bảng báo số người bị loại.
- **AC-21:** Given T1 bị lưu trữ nhưng tuyến dưới còn người đạt 30x30, When tính, Then T1 không được tính là người đạt, các tầng của tuyến dưới giữ nguyên và nhánh vẫn có điểm sâu.
- **AC-22:** Given một KH đổi người bảo trợ từ A sang B, When tính lại, Then số KH của A giảm 1 và của B tăng 1.
- **AC-23:** Given có 5 nhánh, When mở bảng, Then hiện 4 nhánh có `depth` cao nhất, hòa thì theo số người đạt, mỗi nhánh liệt kê các tầng có người đạt 30x30; không có T1 nào thì hiện "Chưa có nhánh nào".
- **AC-24:** Given đổi `customersTarget` trong cấu hình từ 30 xuống 25, When mở bảng, Then kết quả đổi theo mà không sửa code; và bảng luôn hiện ghi chú "số liệu tính từ danh sách bạn tự nhập, không phải xác nhận chính thức".
