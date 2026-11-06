# accounts — Tài khoản, Hộ kinh doanh, Mã số Amway, Cây bảo trợ

> **Status**: In Design
> **Author**: user + Claude
> **Last Updated**: 2026-11-07
> **Last Verified**: 2026-11-07
> **Implements**: `design/phase-2-notes.md` (giai đoạn 2), quyết định A, B, E ngày 2026-11-07

## Summary

Giai đoạn 2 có tài khoản đăng nhập bằng SĐT + mật khẩu. Mỗi **người** có một tài khoản riêng; XP, streak, thành tích và bài học tính theo người. Người thuộc một **Hộ kinh doanh** (tối đa 2 thành viên, thường là vợ chồng) dùng chung một **mã số Amway** và một **Danh bạ** (xem `design/gdd/crm.md`). **Cây bảo trợ, Bảng 30x30 và Bảng 4x4 tính theo hộ.** Hộ một người chạy như trước. Tuyến trên thấy các hộ F1, tên thành viên và số liệu tổng hợp; không bao giờ thấy Danh bạ. Hai hộ vợ chồng trước đây có hai mã gộp được thành một hộ: mã bị huỷ, những người đã có mã dưới mã đó chuyển lên tuyến trên.

> **Quick reference** — Layer: `Foundation` · Priority: `Phase 2` · Key deps: `Supabase (story 019)`, `crm`, `achievements`
> *(Kiến trúc: `docs/architecture/ADR-0001-household-model.md`, `ADR-0002-household-contacts-on-server.md`, `ADR-0003-transfer-contacts-on-code-merge.md`.)*

## Overview

- **Người** = một tài khoản Supabase Auth (đăng nhập bằng email nội bộ dựng từ SĐT, story 019) cùng một hồ sơ `profiles`.
- **Hộ kinh doanh** (`households`) là đơn vị của cây bảo trợ và của mã số Amway. Mỗi người đang hoạt động thuộc **đúng một** hộ.
- **Mã số Amway** gắn với người khi người đó đăng ký KH, giữ nguyên khi lên NPP. Trong app, mã nằm ở hai chỗ: trên **liên hệ** trong Danh bạ (chỉ hộ đó xem) và trên **hộ** (hộ đó và tuyến trên xem). Không kiểm tra với hệ thống Amway.
- Mọi thay đổi về hộ, mã và bảo trợ chạy trên server (hàm SQL hoặc Edge Function), không sửa thẳng bảng từ app.

## Player Fantasy

"Vợ chồng mình làm chung một mã, mỗi người một điện thoại, cùng nhìn một Danh bạ và cùng đẩy một Bảng 30x30. Ai làm việc nào thì người đó được XP. Tuyến trên thấy hộ mình tiến tới đâu, nhưng danh sách khách là của riêng hộ mình."

## Detailed Design

### Core Rules

**Người và đăng nhập**

1. Không tự đăng ký. Tài khoản chỉ sinh ra qua "Tạo tài khoản" (tạo hộ F1), "Thêm vợ/chồng vào hộ" hoặc do admin tạo người gốc.
2. Đăng nhập bằng SĐT + mật khẩu; email nội bộ `<E.164 bỏ dấu +>@phone.diamond-challenge.app`; bắt buộc đổi mật khẩu tạm ở lần đăng nhập đầu (giữ nguyên story 019).
3. Mỗi người có `display_name` do chính người đó đặt (1–60 ký tự sau khi cắt khoảng trắng). Tuyến trên thấy tên này và SĐT của thành viên; chưa đặt thì chỉ thấy SĐT.
4. XP, streak, mục tiêu ngày, thành tích, bài học và cài đặt **tính theo người** và **vẫn chỉ lưu trên máy** ở giai đoạn này. Mỗi sự kiện ghi `userId` của người làm; mỗi máy chỉ cộng XP, streak, mục tiêu ngày từ sự kiện có `userId` là của mình.
5. Thành tích về người (`people`: khách hàng đầu tiên, đủ 30 KH, đủ 30 NPP F1, đạt 30×30, 250 liên hệ) **đếm theo Danh bạ hộ**, nhưng mỗi thành viên có ghi nhận riêng: mỗi người nhận popup một lần. Các mốc `stage`, `daily_goal`, `streak` chỉ tính sự kiện của chính người đó.

**Hộ kinh doanh**

6. Hộ gồm: `id`, hộ bảo trợ (`sponsor_household_id`, `null` với hộ gốc), trạng thái `active` / `merged` / `dissolved`, thời điểm tạo.
7. Thành viên hộ: tối đa `maxHouseholdMembers` (mặc định 2) người đang hoạt động. Một người chỉ thuộc một hộ đang hoạt động tại một thời điểm. Rời hộ ghi `left_at`, không xoá dòng.
8. **"Tạo tài khoản"** trên một liên hệ có nhãn NPP và có mã số Amway: nhập SĐT + mật khẩu tạm → server tạo người mới, **hộ F1 mới** với bảo trợ là **hộ của người bấm**, gán người mới làm thành viên đầu tiên và lấy **mã số của liên hệ làm mã đang hoạt động của hộ mới**. App ghi `linkedUserId` vào liên hệ. Liên hệ chưa có mã: nút bị khoá, kèm gợi ý "Nhập mã số Amway trước".
9. **"Thêm vợ/chồng vào hộ"**: người bảo trợ (thành viên của hộ bảo trợ) hoặc một thành viên của hộ đó nhập SĐT + mật khẩu tạm → server tạo người mới và gán vào hộ. Hộ đã đủ `maxHouseholdMembers`: từ chối. SĐT đã có tài khoản: từ chối và hướng sang **gộp hai mã** (luật 19) nếu người đó có hộ riêng.
10. **Tuyến trên của một hộ** = chuỗi hộ bảo trợ đi lên. Tuyến trên đọc được: hộ, mã đang hoạt động của hộ, tên và SĐT của thành viên, số liệu tổng hợp của hộ. Không đọc được Danh bạ, mã số của liên hệ hay hoạt động.
11. **Rời hộ:** một thành viên của hộ hai người rời được. Trước khi rời, app mời xuất file sao lưu Danh bạ hộ. Sau khi rời, người đó mất quyền đọc/ghi Danh bạ hộ (app xoá bản trên máy), và vào một **hộ mới một người, chưa có mã**, cùng hộ bảo trợ với hộ cũ. Thành viên duy nhất của hộ không rời được (chỉ xoá tài khoản).
12. **Xoá tài khoản:** xoá người (Auth + `profiles`) và dữ liệu cá nhân trên máy. Hoạt động người đó đã ghi trong Danh bạ hộ được giữ cho hộ nhưng **bỏ tên tác giả** (hiện "Thành viên cũ"). Người cuối cùng của hộ xoá tài khoản: hộ chuyển `dissolved`, Danh bạ hộ bị xoá, mã của hộ chuyển "Đã huỷ", các hộ F1 của hộ đó chuyển lên hộ bảo trợ của nó (như luật 21).

**Mã số Amway**

13. Mã số được chuẩn hoá trước khi lưu và so sánh: bỏ khoảng trắng, dấu chấm, gạch; chỉ còn chữ số; dài theo `amwayCodeDigits` (mặc định 4–15). Sai thì từ chối.
14. Liên hệ trong Danh bạ có ô **"Mã số Amway"** (không bắt buộc). Loại KH/NPP lấy theo nhãn của liên hệ, không lưu riêng. Đổi nhãn KH → NPP giữ nguyên mã.
15. Mỗi hộ có **tối đa một mã đang hoạt động**. Một mã đang hoạt động là **duy nhất trong mọi hộ** (server chặn trùng). Mã bị huỷ chuyển "Đã huỷ" kèm ngày và lý do, không bị xoá; mã đã huỷ dùng lại được cho hộ khác.
16. Quyền xem: mã của hộ → hộ đó và tuyến trên; mã của liên hệ → chỉ thành viên hộ (nằm trong Danh bạ hộ).
17. Danh bạ hộ cảnh báo khi hai liên hệ có cùng mã số (xem `crm.md`, gộp liên hệ trùng).

**Quyền thao tác**

18. | Thao tác | Ai làm được |
    |---|---|
    | Tạo người gốc (hộ gốc) | admin |
    | Tạo tài khoản (hộ F1) | thành viên hộ, đã đổi mật khẩu tạm |
    | Thêm vợ/chồng vào hộ | thành viên hộ bảo trợ, thành viên hộ đó, admin |
    | Đặt lại mật khẩu | admin |
    | Sửa hộ bảo trợ | admin (chặn vòng lặp) |
    | Đặt / huỷ mã của hộ | admin |
    | Gộp hai mã | admin, hoặc thành viên hộ bảo trợ của hộ **giữ mã** (X) |
    | Hoàn tác gộp mã | admin |
    | Gán tuyến trên cho mục "Chờ gán tuyến trên" | admin |

**Gộp hai mã thành một hộ (vợ chồng trước đây mỗi người một mã)**

19. Hai hộ HX (mã X) và HY (mã Y), mỗi hộ thường có một thành viên. Người thực hiện chọn **mã giữ (X)**; vợ chồng xác nhận lựa chọn trên màn gộp. Chỉ làm sau khi Amway đã xử lý. Tổng thành viên sau gộp không vượt `maxHouseholdMembers`.
20. **Màn xem trước** (server tính, chưa ghi gì) hiện:
    - số liên hệ **đã có mã số** trong Danh bạ HY sẽ chuyển lên tuyến trên của HY (S2);
    - số hộ F1 của HY sẽ đổi bảo trợ sang S2;
    - số liên hệ **chưa có mã** ở lại, gộp vào Danh bạ HX;
    - số cặp có thể trùng giữa phần ở lại và Danh bạ HX;
    - nếu HY không có hộ bảo trợ: "S2 chưa có trong app, N mục vào danh sách Chờ gán tuyến trên".
    Phải bấm xác nhận mới chạy.
21. **Khi chạy** (một giao dịch trên server):
    1. Mã Y → "Đã huỷ" (lý do "gộp vào X", ngày gộp).
    2. Thành viên của HY rời HY, vào HX. HY chuyển `merged`.
    3. Mọi **hộ F1 của HY** (đã có tài khoản) đổi hộ bảo trợ thành S2; nhánh của họ đi theo.
    4. Mọi **liên hệ có mã số** trong Danh bạ HY (KH và NPP) **chuyển sang Danh bạ S2** cùng toàn bộ sự kiện (tên, SĐT, mã, nhãn, ghi chú, việc cần làm, lịch sử). Sự kiện giữ nguyên người làm; XP đã nhận vẫn thuộc người đã làm, không cộng lại.
    5. Danh bạ HX nhận cho mỗi liên hệ được chuyển một dòng **"Đã chuyển lên tuyến trên"** (chỉ tên, chỉ xem, không đếm 30x30).
    6. Liên hệ **chưa có mã** của HY chuyển vào Danh bạ HX; sau đó qua bước dò trùng (`crm.md`).
    7. S2 không có (HY là hộ gốc): liên hệ cần chuyển và hộ F1 của HY vào danh sách **Chờ gán tuyến trên**; Danh bạ của các liên hệ đó không ai đọc được cho tới khi admin gán.
    8. Ghi một bản ghi gộp đủ để hoàn tác.
22. Sau gộp: số liệu tổng hợp của HX và S2 bị đánh dấu "cần tính lại"; app của thành viên tính lại 30x30 và đẩy lên ở lần đồng bộ kế tiếp. Bảng 4x4 của mọi hộ tuyến trên liên quan tính lại từ cây mới khi đọc.
23. **Hoàn tác gộp** (admin): trả mã Y về đang hoạt động (nếu chưa có hộ khác dùng), trả thành viên về HY, trả hộ bảo trợ của các hộ F1, chuyển các liên hệ đã chuyển (kèm mọi sự kiện mới của chúng) về HY, xoá dòng "Đã chuyển" và đưa liên hệ chưa có mã về HY. Mỗi bản ghi gộp chỉ hoàn tác được một lần.

### States and Transitions

- Hộ: `active` → `merged` (bị gộp vào hộ khác) → `active` (hoàn tác); `active` → `dissolved` (người cuối cùng xoá tài khoản).
- Mã của hộ: `active` → `cancelled` (gộp mã, admin huỷ, hộ giải thể) → `active` (hoàn tác gộp, chỉ khi mã chưa được hộ khác dùng).
- Thành viên: `joined` → `left` (rời hộ, gộp mã, xoá tài khoản).
- Mục Chờ gán tuyến trên: `pending` → `assigned` (admin chọn hộ S2).

### Interactions with Other Systems

- **crm** (`design/gdd/crm.md`): Danh bạ hộ trên server, mã số liên hệ, dò và gộp trùng, dòng "Đã chuyển lên tuyến trên". Bảng 30x30 đếm theo Danh bạ hộ.
- **achievements** (`design/quick-specs/achievements-system-2026-11-05.md`): mốc `people` đếm theo hộ, ghi nhận theo người (luật 5).
- **progress / stages**: chỉ cộng sự kiện có `userId` là của mình (luật 4).
- **Cây và Bảng 4x4** (`design/phase-2-notes.md`): đỉnh của cây là hộ; công thức không đổi, thay "tài khoản" bằng "hộ".
- **Supabase** (story 019, migration hộ): bảng, RLS, hàm SQL và Edge Function.

## Formulas

**Biến:** `M` = `maxHouseholdMembers` (2), `D` = `depthTarget` (4), `B` = `branchTarget` (4).

| Công thức | Định nghĩa |
|---|---|
| **Hộ của người u** | `household(u)` = hộ có thành viên u với `left_at` rỗng; luôn đúng một hộ |
| **Tầng** | `tier(h)` = số bước bảo trợ từ hộ h tới hộ của mình; hộ F1 là tầng 1 |
| **Nhánh** | một hộ F1 cùng toàn bộ tuyến dưới của nó |
| **Đạt 30x30 (hộ h)** | `achieved(h) = customers(h) ≥ Kc ∧ f1(h) ≥ Kf`, tính trên Danh bạ hộ (`crm.md`), lấy từ số tổng hợp hộ đã đồng bộ |
| **Điểm sâu nhánh b** | `depth(b) = |{ tier(h) : h ∈ b ∧ achieved(h) }|` |
| **Đạt 30x30x4x4** | `achieved(me) ∧ |{ b : depth(b) ≥ D }| ≥ B`, với `me` = hộ của mình |
| **Giới hạn thành viên** | `|{ m ∈ members(h) : left_at rỗng }| ≤ M` |
| **Mã duy nhất** | với mọi mã `c`: `|{ h : code(h) = c ∧ status = active }| ≤ 1` |

**Ví dụ:** hộ Lan–Minh (2 người) có 31 KH và 30 NPP trong Danh bạ hộ → `achieved = true`, dù Lan chốt 20 KH và Minh chốt 11. Lan nhận XP của 20 lần chốt, Minh của 11. Tuyến trên thấy một hộ "Lan · Minh" tầng 1 đã đạt 30x30.

**Gộp mã, ví dụ:** HY (Minh, mã Y, bảo trợ S2) có 12 liên hệ: 3 KH có mã, 1 NPP có mã và tài khoản (hộ F1 H7), 8 người quen chưa có mã. Gộp vào HX (Lan, mã X): 4 liên hệ có mã chuyển sang Danh bạ S2; H7 đổi bảo trợ sang S2; HX có thêm 4 dòng "Đã chuyển lên tuyến trên"; 8 người quen vào Danh bạ HX rồi qua dò trùng. Mã Y "Đã huỷ".

## Edge Cases

- **Hộ một người:** mọi luật vẫn đúng; Danh bạ hộ chỉ có một người đọc/ghi.
- **Thêm thành viên thứ ba:** từ chối, báo "Hộ đã đủ 2 thành viên" (theo `maxHouseholdMembers`).
- **Tạo tài khoản với mã đã có hộ khác đang dùng:** từ chối, báo mã trùng; không tạo người.
- **SĐT đã có tài khoản:** từ chối tạo; nếu người đó đang ở hộ riêng có mã thì dùng gộp mã; hộ riêng chưa có mã thì admin sửa (đưa vào hộ).
- **Gộp mã khi tổng thành viên vượt M:** từ chối ở màn xem trước.
- **Gộp mã khi HX và HY nằm trên cùng một nhánh** (HY là tuyến dưới của HX hoặc ngược lại): vẫn làm được; trước khi đổi bảo trợ, server kiểm tra vòng lặp và từ chối cả giao dịch nếu có.
- **S2 là HX** (HY là F1 của HX): liên hệ có mã của HY chuyển sang chính Danh bạ HX; không có dòng "Đã chuyển", chạy dò trùng như liên hệ chưa có mã.
- **Liên hệ được chuyển đã có trong Danh bạ S2:** S2 thấy cặp trùng chắc chắn (cùng mã) trong màn dò trùng của hộ S2.
- **Hoàn tác sau khi S2 đã ghi thêm hoạt động cho liên hệ được chuyển:** các hoạt động đó đi về HY cùng liên hệ; XP của S2 đã nhận không đổi.
- **Hoàn tác khi mã Y đã được hộ khác dùng:** từ chối hoàn tác, báo hộ đang dùng mã.
- **Sửa hộ bảo trợ tạo vòng lặp:** từ chối.
- **Người rời hộ khi đang offline:** quyền bị thu ngay trên server; máy xoá bản Danh bạ hộ ở lần đồng bộ kế tiếp.
- **Người cuối cùng của một hộ có hộ F1 xoá tài khoản:** hộ F1 chuyển lên hộ bảo trợ của hộ đó; hộ gốc thì các hộ F1 vào Chờ gán tuyến trên.
- **Tuyến trên xem hộ F1 chưa đồng bộ lần nào:** hiện "chưa có số liệu", coi như chưa đạt 30x30.

## Dependencies

- **Phụ thuộc vào:** Supabase Auth và các bảng của story 019; `design/gdd/crm.md` (Danh bạ hộ, nhãn, 30x30); `src/config/game-config.json`.
- **Được phụ thuộc bởi:** `crm.md` (Danh bạ hộ, "Tạo tài khoản", dòng "Đã chuyển"), achievements (mốc `people` theo hộ), cây và Bảng 4x4 (`phase-2-notes.md`), các màn giai đoạn 2: đăng nhập, đổi mật khẩu, đồng ý lưu trên server, tạo tài khoản, thêm vợ/chồng, gộp mã, Chờ gán tuyến trên (admin).

## Tuning Knobs

| Núm | Mặc định | Khoảng an toàn | Ảnh hưởng | Đặt ở |
|---|---|---|---|---|
| `maxHouseholdMembers` | 2 | 1–4 | số người tối đa trong một hộ | `app_config` trên server và `game-config.json` |
| `amwayCodeDigits` | 4–15 | 1–20 | độ dài mã số hợp lệ sau chuẩn hoá | `game-config.json` và hàm chuẩn hoá trên server |
| `displayNameMaxLength` | 60 | 20–120 | độ dài tên hiển thị | `game-config.json` và ràng buộc bảng |
| `depthTarget`, `branchTarget`, `topBranchesShown` | 4, 4, 4 | 1–10 | Bảng 4x4 | server (`phase-2-notes.md`) |

## Acceptance Criteria

- **AC-1:** Given liên hệ An có nhãn NPP và mã `1234567`, When người dùng hộ H1 bấm "Tạo tài khoản" với SĐT mới, Then có người mới, hộ mới H2 bảo trợ bởi H1, mã đang hoạt động của H2 là `1234567`, và An có `linkedUserId`.
- **AC-2:** Given liên hệ NPP chưa có mã, When mở An, Then nút "Tạo tài khoản" bị khoá và có gợi ý nhập mã.
- **AC-3:** Given mã `1234567` đang hoạt động ở H2, When tạo hộ khác với cùng mã, Then server từ chối và không tạo người.
- **AC-4:** Given hộ H2 có 1 thành viên, When thành viên H1 (bảo trợ) hoặc thành viên H2 "Thêm vợ/chồng", Then H2 có 2 thành viên; When thêm người thứ ba, Then bị từ chối.
- **AC-5:** Given người ngoài hộ, tuyến trên và tuyến dưới của H2, When đọc Danh bạ H2 (bất kỳ cách nào qua API), Then không trả về dòng nào; When tuyến trên đọc H2, Then thấy hộ, mã, tên thành viên và số tổng hợp.
- **AC-6:** Given hộ Lan–Minh, When Minh hoàn thành "Chốt khách hàng" cho một liên hệ, Then Minh +30 XP, Lan không đổi XP, Bảng 30x30 của cả hai cùng tăng KH 1.
- **AC-7:** Given HX, HY (bảo trợ S2) như ví dụ gộp mã, When admin xem trước, Then thấy 4 liên hệ chuyển, 1 hộ F1 đổi bảo trợ, 8 liên hệ ở lại; When xác nhận, Then S2 đọc được 4 liên hệ được chuyển kèm lịch sử, HX chỉ thấy 4 dòng "Đã chuyển lên tuyến trên" (chỉ tên), H7 có bảo trợ S2, mã Y "Đã huỷ".
- **AC-8:** Given gộp mã ở AC-7, When admin hoàn tác, Then mọi thứ trở về như trước gộp; hoàn tác lần hai bị từ chối.
- **AC-9:** Given HY là hộ gốc, When gộp, Then liên hệ có mã và hộ F1 của HY vào Chờ gán tuyến trên và không ai ngoài admin thấy chúng cho tới khi admin gán.
- **AC-10:** Given tài khoản admin tạo ở story 019, When chạy migration chuyển đổi, Then admin vẫn đăng nhập được, vẫn là admin và có một hộ riêng; cây bảo trợ cũ thành cây hộ tương ứng.
- **AC-11:** Given Minh rời hộ Lan–Minh, When Minh mở app, Then Minh không còn thấy Danh bạ hộ, đã được mời xuất bản sao trước khi rời, và ở một hộ mới chưa có mã cùng bảo trợ.
- **AC-12:** Given Minh xoá tài khoản, When Lan xem lịch sử liên hệ, Then hoạt động Minh từng ghi vẫn còn, tác giả hiện "Thành viên cũ".
