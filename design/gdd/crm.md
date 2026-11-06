# crm — Danh bạ (Người, việc cần làm, nhãn KH/NPP)

> **Status**: In Design
> **Author**: user + Claude
> **Last Updated**: 2026-11-07
> **Last Verified**: 2026-11-07
> **Implements**: `design/game-brief.md` MVP mục 1, 2, 5 (Bảng 30x30), 6

## Summary

Một Danh bạ duy nhất. Mỗi người có một danh sách **việc cần làm** (Liên hệ, Demo, Trình bày opp, Follow-up, Chốt khách hàng, Chốt NPP); hoàn thành một việc cộng XP, việc đó biến khỏi danh sách và ghi vào lịch sử. Chốt khách hàng hoặc Chốt NPP gắn **nhãn KH / NPP** cho người đó. Giai đoạn 1: dữ liệu chỉ lưu trên máy, có sao lưu/khôi phục bằng file, mỗi người quản lý danh sách của chính mình. **Giai đoạn 2 (quyết định 2026-11-07):** Danh bạ thuộc **Hộ kinh doanh** (`design/gdd/accounts.md`), đồng bộ lên server, chỉ thành viên hộ đọc/ghi; liên hệ có ô mã số Amway; khi hai Danh bạ vào chung một hộ thì dò và gộp liên hệ trùng. Bảng 30x30 tính theo hộ; cây hệ thống và Bảng 4x4 do server tính (`design/phase-2-notes.md`).

> **Quick reference** — Layer: `Foundation` · Priority: `MVP` · Key deps: `Nhật ký sự kiện (story 001)`, `computeProgress (story 002)`
> *(Category `Core`, Layer và Priority được suy ra từ brief, vì ở tier minimal không có systems index.)*
> *(Tính khả thi chưa được đối chiếu với tài liệu tham chiếu engine: dự án là web app, không có `docs/engine-reference/` cho stack này.)*

## Overview

- Người là thực thể trung tâm. Người, việc đã làm, nhãn và danh sách đều được **tính lại từ nhật ký sự kiện** (chỉ thêm, không sửa/xóa), giống XP và streak.
- **Không còn giai đoạn tuần tự.** Thay vào đó là danh sách việc cần làm trong `game-config.json` (`personTasks`) và hai nhãn: **KH** và **NPP**.
- Hoàn thành một việc ghi một `activity_logged` (cùng loại sự kiện đã có), nên mục tiêu ngày, streak, mốc chặng Con đường và `computeProgress` **không đổi**.
- Danh sách gồm người của **hộ mình**: KH của hộ và NPP F1 của hộ (giai đoạn 1: hộ một người). Không dựng cây nhiều tầng trên máy.
- Giai đoạn 2: nhật ký sự kiện về người là **nhật ký của hộ**, vẫn dùng offline và đồng bộ khi có mạng (`docs/architecture/ADR-0002-household-contacts-on-server.md`).
- Dữ liệu cũ (giai đoạn) được dẫn xuất sang mô hình mới khi đọc; tổng XP và lịch sử không đổi.

## Detailed Design

### Core Rules

1. **Người** gồm: `personId` (UUID), `name` (bắt buộc, không rỗng sau khi cắt khoảng trắng), `note` (tùy chọn), `phone` (tùy chọn, `{country, number}`), nhãn (suy ra: `KH`, `NPP` hoặc không có), đã lưu trữ hay chưa (suy ra), `linkedUserId` (luôn `null` ở giai đoạn 1; được ghi khi tạo tài khoản cho một NPP F1 ở giai đoạn 2), `amwayCode` (tùy chọn, chuẩn hoá theo `accounts.md` luật 13; đổi nhãn KH → NPP giữ nguyên mã), `phones` phụ (chỉ có sau khi gộp hai liên hệ khác SĐT), trạng thái "Đã chuyển lên tuyến trên" (suy ra). **Không còn giai đoạn và không còn "Người quen".**
2. **Việc cần làm** nằm trong `game-config.json` mục `personTasks`: `id`, tên, `xp`, `repeatable`, `label` (tùy chọn). Mặc định:

   | id | Tên | XP | Làm lại | Nhãn |
   |---|---|---|---|---|
   | `contact` | Liên hệ | 5 | không | – |
   | `demo` | Demo | 10 | không | – |
   | `opp` | Trình bày opp | 20 | không | – |
   | `follow_up` | Follow-up | 10 | có | – |
   | `new_customer` | Chốt khách hàng | 30 | không | KH |
   | `new_npp` | Chốt NPP | 50 | không | NPP |

   Id `new_customer` được giữ để mốc Con đường (`stages[].milestones`) không đổi.
3. **Sự kiện** (đều chỉ thêm):
   - `person_added {personId, name, note?, phone?, amwayCode?}`
   - `person_updated {personId, name?, note?, phone?, amwayCode?}`
   - `person_archived {personId}` và `person_restored {personId}`
   - `activity_logged {activityType, xp, personId?, taskId?}`: hoàn thành một việc ghi `taskId` bằng `activityType`
   - `activity_reassigned {activityId, personId}` (gán lại hoạt động cũ chưa gắn ai)
   - `person_stage_changed {personId, from, to, xp}`: **chỉ còn là sự kiện cũ**, vẫn đọc được và vẫn tính XP; app không ghi thêm.
   - Giai đoạn 2: `person_merged {keepId, mergedId, amwayCode?}`, `person_not_duplicate {personIds: [a, b]}`, `person_transferred_out {personId, name}` (do server ghi khi gộp mã). Tách liên hệ = sự kiện bù của `person_merged` (`payload.compensates`). Không sự kiện nào trong nhóm này có `xp`.
4. **Hoàn thành một việc** = ghi `activity_logged {activityType: taskId, taskId, xp: xp của việc, personId}`. Việc `repeatable: false` biến khỏi danh sách của người đó khi có một sự kiện chưa bị bù; việc `repeatable: true` luôn còn. Người đã lưu trữ không hoàn thành được việc. Không còn gợi ý đổi giai đoạn.
5. **Hoàn tác** một việc bằng sự kiện bù `payload.compensates` (như cách hoàn tác hoạt động): việc hiện lại, XP trừ lại, nhãn được tính lại.
6. **Thêm người** ghi đồng thời `person_added` và `activity_logged {add_name}` (+5 XP). `add_name` không phải việc cần làm. Tự thêm người không kèm hoạt động thì không có XP.
7. **Nhãn** (suy ra, duyệt sự kiện chưa bị bù theo thứ tự nhật ký): `taskId = new_customer` → KH; `taskId = new_npp` → NPP; **NPP thay KH và không quay lại KH** khi làm thêm `new_customer`. Mỗi người tối đa một nhãn; gỡ nhãn bằng cách hoàn tác việc chốt.
8. **Chuyển dữ liệu cũ, chỉ khi đọc, không sửa nhật ký:**
   - `person_stage_changed` cũ: nhãn = theo `to` của lần đổi cuối chưa bị bù (`customer` → KH, `downline` → NPP, còn lại không nhãn); sự kiện đổi giai đoạn và nhãn đặt sau đó cùng tuân theo thứ tự nhật ký.
   - Việc đã làm của người cũ = các giai đoạn từng nhận XP (`contacted` → `contact`, `demoed` → `demo`, `heard_opp` → `opp`), cộng `activity_logged` cũ có `personId` thuộc `demo` hoặc `opp`. Nhờ đó không nhận XP lần hai.
   - Mọi sự kiện cũ giữ nguyên `xp`, nên **tổng XP không đổi**.
   - `activity_logged {new_customer}` cũ không có `taskId` **không** gắn nhãn, nên số KH của dữ liệu cũ không đổi.
9. **Số điện thoại:** chọn mã nước trước (danh sách `countryCodes` trong cấu hình, mặc định `+84` Việt Nam) rồi nhập số. Số chỉ gồm chữ số (cho phép khoảng trắng khi nhập, bỏ khi lưu), 6–15 chữ số; để trống được.
10. **Lưu trữ và khôi phục:** người đã lưu trữ ẩn khỏi các bộ lọc trừ "Đã lưu trữ", có nút **Khôi phục** (`person_restored`). Trạng thái lưu trữ là sự kiện mới nhất giữa `person_archived` và `person_restored`. XP đã có luôn được giữ.
11. **Bộ lọc Danh bạ** (không có danh sách riêng): `Tất cả` / `Khách hàng` / `NPP` / `Đã lưu trữ`.
    - **Khách hàng:** hiện "liên hệ gần nhất"; sắp **lâu chưa chăm sóc lên đầu**.
    - **NPP:** hiện "ngày lên NPP"; mới nhất lên đầu. Nút "Tạo tài khoản" thuộc giai đoạn 2.
    - **Tất cả:** mọi người chưa lưu trữ, mỗi dòng kèm nhãn nếu có.
12. **Tab Làm = Danh bạ** (phản hồi 2026-11-05): chỉ còn 4 tab **Hôm nay · Học · Làm · Con đường**. Danh bạ (danh sách người, bộ lọc, thêm người, khôi phục, gán hoạt động cũ) nằm trong tab **Làm**, tiêu đề màn "Làm"; không còn màn chọn người riêng. Nút **Làm** trên Hôm nay mở tab này. Có ô tìm tên, không phân biệt dấu. Nhãn ô ghi chú: "(FORMHD)".
13. **Trang chi tiết người:** danh sách việc cần làm nằm trên cùng; sửa tên, số điện thoại, ghi chú thu gọn sau nút "Sửa thông tin"; lịch sử và lưu trữ ở dưới. Hoàn thành việc chỉ diễn ra ở đây.
14. **Sao lưu:** xuất một file JSON `diamond-challenge-backup-YYYY-MM-DD.json` gồm `format`, `formatVersion: 1`, `exportedAt`, `events[]` (toàn bộ nhật ký). **Khôi phục** là **gộp, bỏ trùng theo `id` sự kiện**: nhập hai lần không sinh trùng, không mất dữ liệu đang có. Mỗi sự kiện đi qua cùng bộ kiểm tra khi đọc (`parseStoredEvent`), gồm cả `person_restored`. Sau khi nhập, báo "thêm N, bỏ qua M". File chứa tên, số điện thoại và ghi chú về người khác, nên app nhắc người dùng giữ file cẩn thận.
15. **Danh sách của hộ.** Mọi người chưa lưu trữ trong Danh bạ đều là của hộ mình (giai đoạn 1: hộ chỉ có mình). Ai có nhãn KH là KH của hộ, ai có nhãn NPP là NPP F1 của hộ. Không có ô chọn người bảo trợ, không dựng cây nhiều tầng trên máy.

**Giai đoạn 2: Danh bạ dùng chung trong hộ** (quyết định C, D ngày 2026-11-07)

16. **Danh bạ hộ trên server.** Mọi sự kiện về người (`person_*`, `activity_logged` có `personId`, `activity_reassigned`, sự kiện bù của chúng và nhóm sự kiện gộp ở luật 3) thuộc nhật ký của hộ và đồng bộ lên Supabase. Sự kiện cá nhân (bài học, hoạt động không gắn người, cài đặt, ghi nhận thành tích) ở lại trên máy. **Chỉ thành viên hộ đọc/ghi** Danh bạ hộ; tuyến trên, tuyến dưới và người dùng khác không đọc được (RLS).
17. **Offline và gộp đồng thời.** App vẫn ghi vào nhật ký trên máy khi không có mạng; khi có mạng thì đẩy sự kiện chưa đồng bộ (`syncedAt` rỗng) và kéo sự kiện mới của hộ. Sự kiện có id do máy tạo nên hai người sửa cùng lúc không đè nhau: tất cả sự kiện được giữ, mọi giá trị suy ra tính lại từ toàn bộ nhật ký hộ. Trường hợp hai `person_updated` sửa cùng một trường: lấy sự kiện có thời điểm muộn hơn. Mỗi sự kiện ghi người làm; XP cộng cho người làm (`accounts.md` luật 4).
18. **Đồng ý trước khi lưu trên server.** Lần đăng nhập đầu, app hiện thông báo: Danh bạ (tên, SĐT, mã số, ghi chú, nhãn, việc, lịch sử) sẽ được lưu trên server ở Singapore để đồng bộ trong hộ, chỉ thành viên hộ xem được. Chỉ sau khi đồng ý app mới đẩy dữ liệu cũ trên máy lên; không đồng ý thì app vẫn dùng như giai đoạn 1 trên máy và không đồng bộ Danh bạ. Server từ chối sự kiện Danh bạ của người chưa đồng ý.
19. **Dò liên hệ trùng** khi thành viên thứ hai vào hộ, khi đẩy dữ liệu cũ lên, khi nhận liên hệ chuyển đến từ gộp mã, và khi thêm hoặc sửa một liên hệ:
    - **Trùng chắc chắn:** cùng `amwayCode` (sau chuẩn hoá), hoặc cùng SĐT sau chuẩn hoá E.164.
    - **Có thể trùng:** chỉ cùng tên hoặc tên gần giống (bỏ dấu, không phân biệt hoa thường, khoảng cách sửa ≤ `duplicateNameMaxDistance`).
    - Cặp đã đánh dấu "Không phải cùng người" (`person_not_duplicate`) không bao giờ hiện lại. Người đã lưu trữ và dòng "Đã chuyển" không tham gia dò.
20. **Màn "Kiểm tra liên hệ trùng"** hiện từng cặp cạnh nhau (tên, SĐT, mã, nhãn, số việc đã làm, người thêm). Nút **"Gộp tất cả"** chỉ áp dụng cho các cặp trùng chắc chắn mà không có xung đột mã; cặp chỉ trùng tên phải duyệt từng cặp, không bao giờ tự gộp. Mỗi cặp có **Gộp** và **Không phải cùng người**.
21. **Luật gộp** (`person_merged {keepId, mergedId}`; liên hệ giữ là liên hệ thêm sớm hơn), áp dụng khi đọc, không sửa sự kiện cũ:
    - Toàn bộ sự kiện của liên hệ bị gộp được tính cho liên hệ giữ; lịch sử giữ nguyên người làm.
    - Nhãn lấy mức cao hơn: NPP > KH > không có.
    - Một việc đã xong ở một bên thì coi là xong.
    - SĐT khác nhau thì giữ cả hai (SĐT của liên hệ giữ là chính, còn lại vào `phones`).
    - Ghi chú nối lại theo thứ tự thời gian, cách nhau một dòng.
    - Mã số: giống nhau hoặc chỉ một bên có thì giữ; **hai mã khác nhau thì người dùng chọn** và lựa chọn ghi trong `person_merged.amwayCode`.
    - `linkedUserId` được giữ; hai liên hệ liên kết **hai tài khoản khác nhau** thì không cho gộp.
    - **Không cộng hay trừ lại XP và thành tích.** Việc đã làm ở cả hai bên không cộng điểm lần nữa.
22. **Tách liên hệ** (hoàn tác gộp nhầm): ghi sự kiện bù cho `person_merged`; hai liên hệ trở lại như trước gộp, kể cả nhãn và việc đã làm, và cặp đó được tự đánh dấu "Không phải cùng người".
23. **Cảnh báo đếm trùng:** khi Danh bạ hộ còn cặp trùng (chắc chắn hoặc có thể) chưa duyệt, Bảng 30x30 hiện "Có N cặp liên hệ có thể trùng, số liệu có thể bị đếm hai lần" kèm lối vào màn kiểm tra.
24. **Liên hệ "Đã chuyển lên tuyến trên"** (từ gộp mã, `accounts.md` luật 21): chỉ hiện tên với trạng thái đó, chỉ xem, không có việc, không đếm vào KH, NPP F1 hay liên hệ. Máy xoá bản chi tiết của liên hệ đó khi nhận `person_transferred_out`.
25. **Sao lưu và khôi phục bằng file vẫn giữ.** Khôi phục một file vào Danh bạ hộ đi qua dò trùng (luật 19). Rời hộ: app mời xuất file trước khi xoá bản Danh bạ hộ trên máy.

### States and Transitions

- Người: `Đang dùng` ⇄ `Đã lưu trữ` (`person_archived` / `person_restored`); `Đang dùng` → `Đã gộp vào X` (`person_merged`) → `Đang dùng` (tách); `Đang dùng` → `Đã chuyển lên tuyến trên` (`person_transferred_out`, do server ghi; hoàn tác gộp mã bỏ trạng thái này).
- Cặp trùng: `Chưa duyệt` → `Đã gộp` / `Không phải cùng người`; `Đã gộp` → `Không phải cùng người` (tách).
- Nhãn: không có → KH → NPP bằng cách chốt; NPP thay KH; mọi lần chốt đều hoàn tác được. Không có chuyển lùi riêng: muốn gỡ nhãn thì hoàn tác việc chốt.
- Việc: `Còn` → `Đã làm` (một lần, trừ Follow-up) → `Còn` khi hoàn tác.

### Interactions with Other Systems

- `computeProgress` cộng mọi `payload.xp` và đếm `activity_logged` cho mục tiêu ngày, nên XP và mục tiêu ngày tự đúng. `computeProgress` **không đổi**.
- Mốc chặng ở `stages.ts` đếm `activity_logged` theo `activityType` (`new_customer`), không đổi.
- Nhắc nhở không bị ảnh hưởng.
- **Màn "Bảng 30x30"** (mở từ màn Con đường): liên hệ x/250, Khách hàng x/30, NPP F1 x/30, huy hiệu "Đạt 30x30". **Bấm dòng Khách hàng hoặc NPP F1 mở tab Làm (Danh bạ) đã lọc sẵn theo nhãn đó.** Ghi chú luôn hiển thị: "Số liệu tính từ danh sách bạn tự nhập, không phải xác nhận chính thức."
- **Không cộng XP:** bảng này không tạo sự kiện có `xp`.
- Không có cách phân loại "tích cực / không tích cực" của Người.
- **Giai đoạn 2** (`design/gdd/accounts.md`, `design/phase-2-notes.md`): nút "Tạo tài khoản" trên một người có nhãn NPP và có mã số (tạo hộ F1, ghi `linkedUserId`); Danh bạ hộ đồng bộ lên server (luật 16–25); app đẩy số tổng hợp của hộ (KH, NPP F1, liên hệ, đạt 30x30, số cặp trùng chưa duyệt); server dựng cây hộ và tính Bảng 4x4.
- `computeProgress`, `stages` và mốc `daily_goal` / `streak` chỉ nhận sự kiện có `userId` của chính mình; mốc `people` của thành tích đếm theo Danh bạ hộ (`accounts.md` luật 4, 5).

## Formulas

**Biến** (từ cấu hình, xem Tuning Knobs): `Kc` = `customersTarget` (30), `Kf` = `f1Target` (30), `L` = `contactsTarget` (250).

| Công thức | Định nghĩa |
|---|---|
| **Liên hệ được đếm** | `P(h)` = liên hệ trong Danh bạ hộ h **chưa lưu trữ**, **chưa bị gộp vào liên hệ khác**, **không** "Đã chuyển lên tuyến trên". Một cặp đã gộp đếm một lần. |
| **KH của hộ** | `customers(h)` = số liên hệ trong `P(h)` có nhãn KH (sau luật gộp) |
| **NPP F1 của hộ** | `f1(h)` = số liên hệ trong `P(h)` có nhãn NPP |
| **Liên hệ của hộ** | `contacts(h)` = `|P(h)|`, **mọi nhãn** |
| **Cặp trùng chưa duyệt** | `pendingDuplicates(h)` = số cặp trùng chắc chắn hoặc có thể trong `P(h)` chưa gộp và chưa đánh dấu "Không phải cùng người" |
| **Đạt 30x30** | `achieved(h) = customers(h) ≥ Kc ∧ f1(h) ≥ Kf` |
| **Đạt mốc liên hệ** | `contactsMet(h) = contacts(h) ≥ L` |
| **Liên hệ gần nhất** | `lastContactAt(p)` = thời điểm của `activity_logged` mới nhất chưa bị bù của p, **trừ** `add_name`; không có thì thời điểm `person_added`. Lọc KH sắp tăng dần theo giá trị này (lâu chưa chăm sóc lên đầu). |
| **Ngày lên NPP** | `nppAt(p)` = thời điểm của sự kiện đặt nhãn NPP hiện hiệu lực. Lọc NPP sắp giảm dần. |

**Khoảng giá trị:** cả ba số đếm từ 0 trở lên; `customers + f1 ≤ contacts` (mỗi người tối đa một nhãn).

Giai đoạn 1 hộ chỉ có mình, nên `h` = mình và các công thức trùng với bản trước.

**Ví dụ gộp:** Lan có An (KH, mã 111), Minh có "An Nguyễn" (NPP, mã 111). Hai Danh bạ vào chung hộ: trùng chắc chắn (cùng mã). Trước khi duyệt: `customers = 1`, `f1 = 1`, `pendingDuplicates = 1`, Bảng 30x30 có cảnh báo. Sau khi gộp: một liên hệ, nhãn NPP → `customers = 0`, `f1 = 1`, `pendingDuplicates = 0`.

**Ví dụ:** danh sách có 260 người chưa lưu trữ, trong đó 31 có nhãn KH và 29 có nhãn NPP → `contacts = 260` (đạt mốc 250), `customers = 31`, `f1 = 29` → chưa đạt 30x30. Một KH được "Chốt NPP" → `customers = 30`, `f1 = 30` → đạt 30x30.

Công thức tầng, nhánh, điểm sâu và 30x30x4x4 thuộc giai đoạn 2 và do server tính (`design/phase-2-notes.md`).

## Edge Cases

- Tên rỗng hoặc chỉ có khoảng trắng: từ chối. Tên trùng nhau: cho phép nhưng cảnh báo.
- Tên rất dài: cắt khi hiển thị, lưu nguyên (giới hạn trong config).
- Hoạt động trỏ tới `personId` không có sự kiện `person_added` (ví dụ sau khi nhập file thiếu): hiện "Người không rõ", không báo lỗi, không mất XP.
- Việc không làm lại được: sau khi làm một lần không nhận XP lần hai; hoàn tác lần làm đầu thì làm lại được.
- Nhập file sai định dạng hoặc `formatVersion` lạ: từ chối cả file với thông báo rõ. Từng sự kiện hỏng trong file hợp lệ: bỏ qua và đếm.
- Hai sự kiện cùng thời điểm: xếp theo thứ tự thêm vào.
- Người đã lưu trữ có hoạt động: XP đã có vẫn giữ.
- **Gỡ nhãn NPP** (hoàn tác việc chốt): `f1(me)` giảm ngay; nếu người đó từng được chốt KH thì `customers(me)` tăng tương ứng.
- **Người đã lưu trữ:** không tính vào KH, NPP F1 hay liên hệ.
- **Danh sách có vài nghìn người:** bảng vẫn phải tính được nhanh; mỗi lần tính chỉ duyệt danh sách một lượt.
- **Chốt NPP cho người đang KH:** nhãn thành NPP, KH giảm 1, F1 tăng 1. Hoàn tác việc "Chốt NPP" khi từng "Chốt khách hàng" thì nhãn về KH.
- **Làm "Chốt khách hàng" cho người đã NPP:** nhận XP của việc (nếu chưa làm) nhưng nhãn vẫn là NPP.
- **Người có nhãn NPP hoặc KH** luôn thấy trong "Tất cả" và trong bộ lọc tương ứng. Lỗi "NPP biến mất sau khi đánh dấu" chưa tái hiện được từ mã (nhóm NPP vẫn hiện ở cuối danh sách cũ); story phải tái hiện trên bản build thật trước khi sửa và giữ ảnh chụp.
- **Lưu trữ rồi khôi phục:** giữ nguyên nhãn và việc đã làm.
- **`taskId` không có trong cấu hình:** bỏ qua nhãn, vẫn tính XP và hiện trong lịch sử.
- **Số điện thoại sai** (có chữ cái, ngắn hơn 6 hoặc dài hơn 15 chữ số): từ chối kèm thông báo rõ; để trống thì hợp lệ.
- **Chưa có việc nào được làm** cho một người mới: `lastContactAt` là ngày thêm.
- **Dữ liệu cũ có `person_stage_changed` tới giai đoạn không còn trong cấu hình:** bỏ qua, không lỗi.
- **Gộp hai liên hệ cùng có việc "Demo" đã làm:** sau gộp "Demo" coi là xong một lần; XP của cả hai lần giữ nguyên cho hai người đã làm.
- **Gộp hai liên hệ có mã khác nhau:** không gộp được qua "Gộp tất cả"; khi gộp từng cặp, người dùng phải chọn mã giữ.
- **Gộp hai liên hệ liên kết hai tài khoản khác nhau:** từ chối, báo hai người này đã có hai tài khoản riêng.
- **Gộp một liên hệ đã bị gộp vào liên hệ khác:** gộp vào liên hệ giữ cuối cùng (theo chuỗi), không tạo vòng.
- **Tách một liên hệ đã được gộp thêm lần nữa sau đó:** chỉ tách lần gộp được chọn; các lần gộp khác giữ nguyên.
- **Hai thành viên cùng gộp một cặp khi offline:** hai `person_merged` trùng nội dung; lần thứ hai không đổi kết quả.
- **Một thành viên gộp, thành viên kia đánh dấu "Không phải cùng người" khi offline:** sự kiện muộn hơn thắng; nếu `person_not_duplicate` muộn hơn thì cặp được tách.
- **Liên hệ đang có trong Danh bạ hộ X bị chuyển lên S2 khi gộp mã:** máy của X xoá chi tiết, chỉ giữ dòng tên "Đã chuyển lên tuyến trên". File sao lưu tạo trước đó vẫn còn chi tiết; khôi phục file đó không làm liên hệ xuất hiện lại (sự kiện `person_transferred_out` vẫn ẩn nó).
- **Chưa đồng ý lưu trên server:** Danh bạ chỉ ở trên máy, Bảng 30x30 tính như giai đoạn 1, tuyến trên không nhận số tổng hợp mới.

## Dependencies

- **Phụ thuộc vào:** nhật ký sự kiện (`EventStore`, story 001), `computeProgress` (story 002), `src/config/game-config.json`.
- **Phụ thuộc thêm ở giai đoạn 2:** `design/gdd/accounts.md` (hộ, mã số, gộp mã), Supabase (bảng Danh bạ hộ, RLS), ADR-0002 và ADR-0003.
- **Được phụ thuộc bởi:** tab Làm (chọn người, chọn việc), màn Hôm nay (có thể hiện người cần theo dõi), bản đồ (mốc hoạt động), màn Bảng 30x30 (mở từ màn Con đường), giai đoạn 2 (tạo tài khoản cho F1, đồng bộ số tổng hợp, Bảng 4x4).
- **Cần sửa code hiện có:** `src/domain/people.ts` (nhãn, việc cần làm, chuyển dữ liệu cũ), `src/data/event-store.ts` (thêm `person_restored`, `taskId`, `phone`), màn Người → tab Làm (Danh bạ), bỏ màn chọn người riêng, trang chi tiết người, màn Bảng 30x30 (dòng KH/NPP bấm được), `strings.ts`, `game-config.json`.

## Tuning Knobs

Đặt trong `src/config/game-config.json`:

| Núm | Mặc định | Khoảng an toàn | Ảnh hưởng |
|---|---|---|---|
| `target30x30.contactsTarget` | 250 | 1–5000 | mốc phụ "liên hệ" |
| `target30x30.customersTarget` | 30 | 1–999 | ngưỡng KH của "đạt 30x30" |
| `target30x30.f1Target` | 30 | 1–999 | ngưỡng NPP F1 của "đạt 30x30" |
| `personTasks[].xp` | 5 / 10 / 20 / 10 / 30 / 50 | 0–200 | XP mỗi việc |
| `personTasks[].repeatable` | chỉ `follow_up` | true/false | việc còn trong danh sách sau khi làm |
| `personTasks[].label` | `new_customer` → KH, `new_npp` → NPP | `KH`/`NPP`/không có | nhãn đặt khi làm việc đó |
| `countryCodes` | `+84` (Việt Nam) mặc định, kèm một số mã phổ biến | ≥1 mục | mã nước chọn khi nhập số |
| `duplicateNameMaxDistance` | 1 | 0–3 | tên khác nhau bao nhiêu ký tự (sau bỏ dấu) vẫn coi là "có thể trùng"; 0 = chỉ trùng hẳn |
| `amwayCodeDigits` | 4–15 | 1–20 | độ dài mã số hợp lệ (`accounts.md`) |

`personStages` chỉ còn dùng để đọc dữ liệu cũ, không dùng cho giao diện mới. Các núm của Bảng 4x4 (`depthTarget`, `branchTarget`, `topBranchesShown`) thuộc giai đoạn 2, xem `design/phase-2-notes.md`.

## Acceptance Criteria

- **AC-1:** Given nhật ký rỗng, When thêm người "An", Then Danh bạ có "An" không nhãn, XP tăng 5 (hoạt động `add_name`) và không có mục "Người quen".
- **AC-2:** Given An có việc "Demo", When hoàn thành, Then có `activity_logged` với `taskId = demo`, `xp = 10`, "Demo" biến khỏi danh sách việc của An và hiện trong lịch sử.
- **AC-3:** Given An, When hoàn thành "Follow-up" hai lần, Then mỗi lần +10 XP và mục "Follow-up" vẫn còn.
- **AC-4:** Given một việc đã hoàn thành, When hoàn tác bằng sự kiện bù, Then XP bị trừ lại và việc hiện lại.
- **AC-5:** Given dữ liệu cũ An từng chuyển tới `demoed` (xp 10), When mở trang chi tiết sau khi cập nhật, Then "Demo" không còn trong danh sách việc, tổng XP không đổi và lịch sử không mất.
- **AC-6:** Given tên chỉ có khoảng trắng, When lưu, Then bị từ chối và không ghi sự kiện nào.
- **AC-7:** Given hoạt động cũ không có `personId`, When gán cho An, Then hoạt động hiện thuộc An và tổng XP không đổi.
- **AC-8:** Given một file sao lưu, When khôi phục hai lần liên tiếp, Then lần hai thêm 0 sự kiện và dữ liệu không đổi.
- **AC-9:** Given file có 1 sự kiện hỏng trong 10, When khôi phục, Then thêm 9, bỏ qua 1 và báo đúng số liệu.
- **AC-10:** Given file có `formatVersion` lạ, When khôi phục, Then bị từ chối, nhật ký hiện tại không đổi.
- **AC-11:** Given hoạt động trỏ tới người không tồn tại, When mở tab Làm, Then không lỗi và hiện "Người không rõ".
- **AC-12:** Given 31 người nhãn KH và 29 người nhãn NPP, When mở Bảng 30x30, Then chưa "đạt 30x30" (còn 1 NPP F1); When một KH làm "Chốt NPP", Then KH = 30, NPP F1 = 30 và hiện "Đạt 30x30".
- **AC-13:** Given một KH và một NPP đã lưu trữ, When tính, Then cả hai không được đếm vào KH, NPP F1 hay liên hệ.
- **AC-14:** Given 250 người chưa lưu trữ, When mở bảng, Then liên hệ = 250 và mốc liên hệ được đánh dấu đạt; với 249 thì chưa.
- **AC-15:** Given một NPP đã từng "Chốt khách hàng", When hoàn tác "Chốt NPP", Then NPP giảm 1 và KH tăng 1.
- **AC-16:** Given đổi `customersTarget` từ 30 xuống 25, hoặc đổi `xp` của một việc trong `personTasks`, When mở bảng hoặc danh sách việc, Then kết quả đổi theo mà không sửa code.
- **AC-17:** Given mở màn thêm/sửa người và Bảng 30x30, When xem, Then không có ô chọn người bảo trợ; bảng không tạo sự kiện có `xp` và luôn hiện ghi chú "Số liệu tính từ danh sách bạn tự nhập, không phải xác nhận chính thức".
- **AC-18:** Given một người đã lưu trữ, When xem "Đã lưu trữ" rồi bấm Khôi phục, Then người đó quay lại "Tất cả" với nhãn và việc đã làm như trước.
- **AC-19:** Given 3 KH có liên hệ gần nhất khác nhau, When lọc "Khách hàng", Then người lâu chưa chăm sóc nhất ở đầu và mỗi dòng hiện ngày liên hệ gần nhất; When lọc "NPP", Then mỗi dòng hiện ngày lên NPP, mới nhất ở đầu.
- **AC-20:** Given Bảng 30x30, When bấm dòng "Khách hàng" hoặc "NPP F1", Then mở Danh bạ đã lọc sẵn theo nhãn đó.
- **AC-21:** Given thêm số điện thoại, When mở ô nhập, Then mã nước mặc định `+84`; số có chữ cái hoặc ngoài 6–15 chữ số bị từ chối.
- **AC-22:** Given hoàn thành một việc, When xem Hôm nay, Then XP, mục tiêu ngày ("có ít nhất 1 Làm") và mốc Con đường tăng như hoạt động trước đây (vẫn là `activity_logged`).
- **AC-24:** Given app mở, When xem thanh tab, Then có đúng 4 tab Hôm nay · Học · Làm · Con đường; bấm nút Làm trên Hôm nay mở tab Làm (Danh bạ).
- **AC-25:** Given Danh bạ có "Dũng", When gõ "dung" vào ô tìm, Then chỉ còn những người khớp tên, không phân biệt dấu và hoa thường.
- **AC-23:** Given một NPP vừa được đánh dấu, When mở Danh bạ (Tất cả hoặc lọc NPP), Then người đó hiện đúng một dòng với nhãn NPP.
- **AC-26:** Given hộ Lan–Minh, When Lan thêm "Bình" trên máy Lan và có mạng, Then máy Minh thấy "Bình" sau lần đồng bộ kế tiếp, kèm "Lan thêm"; người ngoài hộ, tuyến trên và tuyến dưới không đọc được "Bình" qua API.
- **AC-27:** Given Lan và Minh cùng hoàn thành việc cho hai liên hệ khác nhau khi offline, When cả hai có mạng, Then cả hai hoạt động đều còn, XP mỗi người chỉ tính việc của mình.
- **AC-28:** Given lần đăng nhập đầu, When người dùng chưa bấm đồng ý, Then không sự kiện Danh bạ nào được gửi lên server; When đồng ý, Then dữ liệu cũ được đẩy lên.
- **AC-29:** Given Lan có An (mã 111) và Minh có "An Nguyễn" (mã 111), When Minh vào hộ của Lan, Then màn "Kiểm tra liên hệ trùng" có cặp này là trùng chắc chắn; When "Gộp tất cả", Then còn một liên hệ nhãn NPP, lịch sử của cả hai, XP không đổi.
- **AC-30:** Given hai liên hệ chỉ trùng tên, When bấm "Gộp tất cả", Then cặp đó không bị gộp; When bấm "Không phải cùng người", Then cặp đó không hiện lại.
- **AC-31:** Given còn 1 cặp chưa duyệt, When mở Bảng 30x30, Then thấy cảnh báo có thể đếm trùng; When duyệt xong, Then cảnh báo mất.
- **AC-32:** Given một cặp đã gộp, When bấm "Tách liên hệ", Then hai liên hệ trở lại như trước với nhãn và việc đã làm riêng.
- **AC-33:** Given hai liên hệ trong Danh bạ có cùng mã, When mở Danh bạ, Then thấy cảnh báo trùng mã trên cả hai.
- **AC-34:** Given gộp mã đã chạy (`accounts.md` AC-7), When thành viên hộ X mở Danh bạ, Then liên hệ được chuyển chỉ hiện tên với "Đã chuyển lên tuyến trên", không mở được chi tiết, không đếm 30x30.
