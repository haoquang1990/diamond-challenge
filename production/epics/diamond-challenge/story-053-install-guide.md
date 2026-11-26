# Story 053: Hướng dẫn đưa app ra màn hình chính trong Cài đặt

> **Epic**: diamond-challenge
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-26

## Context

**GDD**: `design/game-brief.md` (PWA, mobile-first)
**Requirement**: Phản hồi 2026-11-26: trong Cài đặt thêm hướng dẫn đưa app ra màn hình điện thoại. Mockup đã duyệt.

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (React 19 / Vite 8 / TypeScript 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] Thẻ "Đưa app ra màn hình chính" đầu Cài đặt: tab iPhone / Android với các bước ngắn; tab của loại máy đang dùng mở sẵn (iPad nhận ra dù báo user agent Mac). Có unit test.
- [x] Khi Chrome cho phép, nút "Cài app" mở hộp cài của trình duyệt (giữ từ lúc mở app); cài xong thẻ chỉ còn "✓ App đã ở màn hình chính của máy này". Có unit test.
- [x] Mở app từ biểu tượng ngoài màn hình chính: thẻ chỉ hiện dòng "✓ App đã ở màn hình chính".
- [x] 390 và 320px không tràn ngang.

## Files

- `src/ui/install-guide.ts` (`detectInstallPlatform`, `createInstallPrompt`, `listenForInstallPrompt`)
- `src/ui/screens/install-guide-card.tsx`, `src/ui/screens/settings-screen.tsx`, `src/main.tsx`
- `src/ui/strings.ts`, `src/ui/styles.css`
- `tests/unit/install/install-guide.test.ts` (4 tests, seen failing first)
- `production/qa/evidence/story-053-install-guide/`

## Completion Notes
**Completed**: 2026-11-26
**Criteria**: 4/4 passing (none deferred)
**Deviations**: Advisory: the screenshots use an emulated iPhone and Android browser; the real Safari share sheet and Chrome install dialog are the browsers' own and were not captured
**Test Evidence**: unit tests above; screenshots of the iPhone steps, the Android steps with "Cài app", and the installed line at 390 and 320px; full suite 700/700
**Reviewed by**: self, no independent review
