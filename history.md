# 作業履歴

## 2026-04-18
- `spec.md` と `history.md` を初回作成した。
- Next.js App Router + TypeScript + Tailwind の土台を作成した。
- Supabase Auth / Storage / Postgres の接続基盤と SQL を整備した。
- `/login` と `/gallery` を実装し、認証ガードを追加した。
- フォルダー一覧、フォルダー作成 / 名前変更 / 削除を実装した。
- 画像アップロード、実データの一覧表示、グリッド / リスト切り替えを実装した。
- ViewerState を `GalleryShell` に集約し、一覧 → 詳細モーダル → 全画面ビューアで同じ状態を共有する構成にした。
- 詳細モーダル内の単体操作として、画像名変更、フォルダー移動、単体削除、お気に入り切り替えを実装した。
- 選択モード、一括削除、一括フォルダー移動、一括お気に入り追加 / 解除を実装した。
- 仕上げとして以下を改善した。
- 多重送信防止用のロックを `GalleryShell` に追加し、単体操作 / 一括操作 / アップロードの再送信を防止した。
- viewer、confirm dialog、フォルダーモーダルに `Esc` / backdrop close / focus 復帰を追加した。
- 全画面ビューアの `Esc` / 左右キー処理を安定化し、詳細モーダルとのイベント競合を整理した。
- scope 切り替え、sort 切り替え、view 切り替え時に selection state をクリアするようにした。
- refresh 後に現在一覧外の `selectedImageIds` が残らないように調整した。
- 空状態 UI、loading UI、disabled 表示、toast 表示、confirm dialog 文言を整理した。
- 表示文言の文字化けが出ていたコンポーネントを日本語で書き直した。
- mutation / upload ロックを `finally` ベースで見直し、解除漏れを起こしにくい形へ修正した。
- sort 変更時に viewer を閉じるようにして、並び替え後の index ずれを避けた。
- scope 変更で selection state を解除したときに info toast を出すようにした。
- Storage 削除後に DB 更新が失敗した場合のエラー文言を明確化した。
- 全画面ビューアを閉じたときの focus 復帰先を明示的に保持するようにした。
- Supabase の公開環境変数を `process.env[name]` ではなく直接参照する形へ修正し、クライアント側で `undefined` になる問題を解消した。
- gallery 画面の UI を参考画像寄りに再設計し、左固定幅サイドバー + 右メインの白ベース管理画面レイアウトへ変更した。
- 大きい見出しカード風 UI をやめ、カテゴリ名 / 件数 / 表示切替 / 並び順をコンパクトなヘッダーに整理した。
- アップロード領域を大きい点線枠に変更し、クリップボード案内文を細い補助バーとして残した。
- グリッド一覧はサムネイル主体のカードに整理し、カード下部にファイル名 / 解像度 / サイズを表示する構成へ変更した。
- リスト一覧は横並びの管理テーブル風 UI に寄せ、サムネイルと主要メタ情報を見やすく整理した。
- `npm run typecheck` と `npm run lint` を実行し、成功を確認した。
- gallery UI の密度調整を実施した。サイドバー行間、ヘッダー高、アップロード枠、クリップボード案内バー、選択ツールバー、グリッド/リスト一覧の余白と角丸をさらに詰めた。
- グリッド一覧をさらに小さく調整した。desktop の列数を増やし、カード下部の情報余白とサムネイル比率を詰めた。
- 全画面ビューアの閉じるボタン不具合を修正した。close ボタンと下部情報バーに `z-index` を付け、画像レイヤーを `pointer-events-none` にして `onClose` を確実に受け取れるようにした。
- 最終確認として保守性の見直しを行った。folder touch の二重更新を解消し、Storage+DB 削除処理を mutation 層へ統合し、一覧選択判定を `Set` 化し、toast タイマーの後始末を追加した。
- 2026-04-19: gallery 一覧をページネーション対応。`page` クエリを追加し、scope / folder の切り替え時は `page=1` に戻して 32 件ずつ取得するように変更。
- 2026-04-19: グリッド表示を desktop 4 列基準へ調整し、サムネイル高さとカード下部余白を少し詰めた。
- 2026-04-19: 一覧下部に前へ / 次へボタンと現在ページ表示を追加。ページ切り替え後も current page の配列だけを viewer に渡す構造を維持。
- 2026-04-19: gallery 一覧表示の体感速度を改善。server 側で一覧用の軽量サムネイル signed URL を別生成し、一覧カードでは元画像ではなくサムネイルを使うように変更。
- 2026-04-19: `ImageGridCard` と `ImageListRow` を `React.memo` 化し、選択状態やお気に入り変更時に未変更カードが再描画されにくいように調整。
- 2026-04-19: next/image の `sizes` と `priority` / `loading` を一覧向けに見直し、1画面目だけ eager、それ以外は lazy 読み込みに変更。
- 2026-04-19: `src/lib/gallery/mutations.ts` を整理し、画像更新系の重複した Supabase update ロジックを `updateImages` helper に集約。
- 2026-04-19: `src/lib/gallery/queries.ts` の画像一覧 query を fresh builder 生成に変更。page 補正時の再取得で builder を使い回さず、将来のライブラリ更新でも壊れにくい形に修正。
- 2026-04-19: `GalleryShell` の一覧カード handler を `useCallback` と ref ベースに調整し、`React.memo` と stale callback がぶつかる長期運用リスクを解消。
## 2026-05-04
- Added browser-side image derivative generation for new uploads.
- New uploads now store `thumbnail`, `display`, and optional `original` assets in Supabase Storage.
- Gallery list/grid now prefer lightweight thumbnail URLs.
- Detail modal and fullscreen viewer now prefer display URLs.
- Added backward-compatible image columns and Storage policy updates in `supabase/schema.sql`.
- Added `supabase/migrations/20260504_add_image_variants.sql`.
- Added `NEXT_PUBLIC_GALLERY_SAVE_ORIGINAL` to `.env.example`.
- Documented derivative storage policy and legacy migration guidance in `spec.md`.

## 2026-05-04 legacy backfill
- Added `scripts/backfill-image-variants.ts` for legacy image derivative generation.
- Added `npm run backfill:image-variants`.
- Added `sharp` and `tsx` for batch image conversion and script execution.
- Added `SUPABASE_SERVICE_ROLE_KEY` and optional `SUPABASE_STORAGE_BUCKET` keys to `.env.example`.
- Documented dry-run, limit, and force operation rules in `spec.md`.

## 2026-05-06 gallery switching performance
- Moved grid/list view switching to `GalleryShell` client state.
- Kept `view` out of the image data cache key.
- Added short-lived in-memory page cache keyed by user, scope, folder, sort, and page.
- Added development-only performance logs for query, signed URL generation, cache hit/miss, and view-only switching.
- Made signed URL expiry configurable with `GALLERY_SIGNED_URL_EXPIRES_IN`.
- Stabilized the Supabase client instance inside `GalleryShell` so memoized card callbacks are less likely to churn.

## 2026-05-07 long-term operation hardening
- Added `supabase/migrations/20260507_long_term_hardening.sql`.
- Hardened folder/image tenant integrity with `images_folder_user_fk` and `folders_user_id_id_key`.
- Added unique indexes for `thumbnail_path`, `display_path`, and `original_path`.
- Tightened Storage policies to legacy `{userId}/...` and derived `thumbnails|display|originals/{userId}/...` path shapes.
- Changed image deletion to remove DB rows first, then attempt Storage cleanup and surface a warning if Storage cleanup fails.
- Moved gallery search-param parsing and client page-cache logic into focused helpers.
- Added a 24-entry cap and LRU-style pruning to the gallery client page cache.
- Cleared current-user gallery cache entries on logout.
- Added browser support validation before client-side image compression starts.
- Added `scripts/audit-gallery-storage.ts` and `npm run audit:gallery-storage`.
- Added dependency-free focused tests with `scripts/run-tests.ts`, `tsconfig.test.json`, and `npm run test`.
- Added `.tmp-tests` to `.gitignore`.
- Attempted to add `vitest`, but npm registry access was unavailable/then timed out, so the test plan was implemented with the existing TypeScript compiler and Node instead.
- Verification passed: `npm run typecheck`, `npm run lint`, and `npm run test`.
- DB-connected audit/backfill dry-runs were not executed because this agent session must not read `.env` or `.env.local`.

## 2026-05-20 P1/P2 hardening follow-up
- Surfaced upload rollback cleanup failures when DB insertion fails after Storage assets were already uploaded.
- Stopped logout from clearing gallery cache and navigating to `/login` when Supabase `signOut()` returns an error.
- Tightened gallery header sort handling by validating select values before passing them as typed sort orders.
- Included card callback props in memo comparisons so future callback changes cannot leave stale handlers attached to memoized gallery rows/cards.
- Reduced upload image decoding work by generating thumbnail and display variants from one decoded bitmap per source image.
- Removed a narrow MIME type guard assertion by using a string set for supported upload types.
- Aligned `spec.md` with current derivative image columns, DB-first deletion behavior, derived Storage path policy, and same-user folder reference rule.
- Added the standard `npm run build` entrypoint for existing Next.js production build verification.
- `npm run build` was attempted after build verification was allowed, but the local process failed with `spawn EPERM`.

## 2026-06-08 staged P2 query hardening
- Split gallery image listing into image row retrieval and gallery image view-model construction while preserving the existing `listImages` API.
- Added `listGalleryData` so `/gallery` can fetch folders and image rows concurrently before combining folder names and signed URLs.
- Kept DB schema, public component props, URL parameters, pagination behavior, and Storage path behavior unchanged.
- Verification passed: `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run test`, `git diff --check`, and sandbox-escalated `npm run build`.

## 2026-06-08 staged P2 selection boundary
- Added `useGallerySelection` to own selection mode, selected ids, selected-id set, bulk-delete confirmation state, and bulk-move target state.
- Updated `GalleryShell` to use the selection hook while preserving existing selection UI, bulk actions, URL behavior, and mutation behavior.
- Left viewer state and mutation handlers in `GalleryShell` for the next staged responsibility split.
- Verification passed: `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run test`, `git diff --check`, and sandbox-escalated `npm run build`.

## 2026-06-08 staged P2 viewer boundary
- Added `useGalleryViewer` to own detail/fullscreen viewer state, current viewer image lookup, focus return ref, viewer movement, and viewer reconciliation after deletion.
- Updated `GalleryShell` to call the viewer hook while preserving viewer UI props, viewer mutations, deletion behavior, focus return behavior, and fullscreen behavior.
- Left folder/image mutation orchestration in `GalleryShell` for the next staged responsibility split.
- Verification passed: `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run test`, `git diff --check`, and sandbox-escalated `npm run build`.

## 2026-06-08 staged P2 image mutation boundary
- Added `useGalleryImageMutations` to own single-image rename/move/favorite/delete and bulk delete/move/favorite handlers.
- Updated `GalleryShell` to keep the shared mutation runner, folder mutations, upload handling, toast stack, cache refresh, and route navigation while delegating image handlers to the hook.
- Preserved DB writes, Storage cleanup flow, viewer reconciliation, selection cleanup, URL behavior, and component props.
- Restored malformed `GalleryShell` UI strings to readable Japanese after a local text rewrite exposed legacy mojibake as parse errors.
- Verification passed: `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run test`, `git diff --check`, and sandbox-escalated `npm run build`.

## 2026-06-23 staged P2 folder mutation and upload boundary
- Added `useGalleryFolderMutations` to own folder create/rename/delete handlers while continuing to use the existing shared mutation runner.
- Added `useGalleryUpload` to own upload lock handling, `uploadImages` execution, upload result toast messages, and refresh-on-success.
- Updated `GalleryShell` to keep pending state, toast stack, cache refresh, route navigation, and rendered UI composition while delegating folder and upload handlers to hooks.
- Preserved folder DB writes, upload Storage/DB writes, cache invalidation, route behavior, modal close behavior, and component props.

## 2026-06-27 gallery folder switching performance
- Added intent-based preloading for sidebar categories and folders on pointer enter and keyboard focus.
- Changed uncached gallery switches to load directly through the authenticated browser Supabase client, reusing in-flight preloads and the existing three-minute page cache.
- Preserved RLS enforcement, signed URL expiry configuration, and server navigation as the fallback when a client-side load fails.
- Reused signed URLs already held by the bounded page cache instead of regenerating them for the same image on every folder switch.
- Added bounded background preloading for the three most recently used folders.
