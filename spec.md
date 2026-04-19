# 画像保存サイト v1 仕様書

## 目的
- 自分専用の画像保存・整理 Web アプリを提供する。
- 一覧 → 詳細モーダル → 全画面ビューアの流れで、画像を見返しやすくする。
- v1 では公開機能、タグ、検索、共有、GIF 対応は含めない。

## 技術スタック
- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Storage
- Supabase Postgres
- Vercel 前提

## 画面構成

### ログイン画面
- メールアドレス / パスワードでログインする。
- 認証エラーを画面上に表示する。
- ログイン成功時は `/gallery` へ遷移する。

### ギャラリー画面
- 左サイドバーと右メインの 2 カラム構成。
- 画面全体は白ベースのフラットな管理画面 UI とする。
- サイドバーには `すべての画像` `未分類` `お気に入り` 通常フォルダー一覧を表示する。
- サイドバー上部に `フォルダー` 見出しと新規フォルダーボタンを置く。
- フォルダーは作成 / 名前変更 / 削除に対応する。
- フォルダー削除時、中の画像は削除せず未分類へ移動する。
- 右メインではアップロード、一覧表示、選択モード、詳細モーダル、全画面ビューアを扱う。
- メイン上部には現在カテゴリ名、件数、並び順、グリッド / リスト切り替え、選択モード入口を置く。
- アップロード領域は大きい点線枠、その下にクリップボード案内バー、その下に画像一覧を並べる。

## データ設計

### folders
- `id`
- `user_id`
- `name`
- `last_used_at`
- `created_at`
- `updated_at`

### images
- `id`
- `user_id`
- `folder_id`
- `file_name`
- `storage_path`
- `mime_type`
- `size_bytes`
- `width`
- `height`
- `is_favorite`
- `created_at`
- `updated_at`

## 一覧とフィルター
- 一覧は `all` `uncategorized` `favorites` `folder` の scope で絞り込む。
- URL クエリで `scope` `folderId` `view` `sort` を保持する。
- 表示形式は `grid` / `list` を切り替えられる。
- 並び順は `newest` / `oldest` を持つ。
- フォルダー一覧は `last_used_at desc`、画像一覧は `created_at desc` を基準にする。

## アップロード
- ファイル選択、ドラッグ&ドロップ、クリップボード貼り付けに対応する。
- 対応形式は `png` `jpg` `jpeg` `webp`。
- 1 ファイル 20MB まで。
- 現在の scope が通常フォルダーならそのフォルダーへ保存し、それ以外は未分類へ保存する。
- Storage バケットは `gallery-images` の private bucket を使う。

## ViewerState
- 一覧、詳細モーダル、全画面ビューアは同じ `ViewerState` を共有する。

```ts
type ViewerState = {
  isOpen: boolean
  currentIndex: number
  images: GalleryImageItem[]
}
```

- 一覧クリック時に、現在表示中の配列と index をそのまま `ViewerState` に渡す。
- 詳細モーダルと全画面ビューアは `ViewerState.images[currentIndex]` を読む。
- ID ベースの再取得は行わない。

## 詳細モーダル
- `ViewerState` の current image を表示する。
- 前へ / 次へボタンを持ち、端では無効化する。
- 画像名変更、フォルダー移動、単体削除、お気に入り切り替えに対応する。
- 単体操作後は `viewerState.images[currentIndex]` を即時更新する。
- 削除後は `viewerState.images` から対象を除去し、次画像があれば表示、なければ閉じる。
- `Esc` と backdrop click で閉じる。
- `role="dialog"` と `aria-modal="true"` を付与する。

## 全画面ビューア
- 詳細モーダルと同じ `ViewerState` を使う。
- 黒背景で画像を中央に収めて表示する。
- 前へ / 次へ、現在位置表示に対応する。
- `Esc` で閉じる。
- `ArrowLeft` / `ArrowRight` で移動する。
- backdrop click で閉じる。
- モーダルとイベント競合しないよう、全画面表示中のみキーボードイベントを処理する。

## 選択モード
- `GalleryShell` に `isSelectionMode` と `selectedImageIds` を集約する。
- グリッド表示 / リスト表示の両方で同じ選択状態を共有する。
- 選択モード中のみ大きいチェック UI を出す。
- 一括削除、一括フォルダー移動、一括お気に入り追加 / 解除に対応する。
- scope / sort / view の変更時には選択状態をクリアする。
- refresh 後は現在一覧に存在しない ID を自動除去する。

## UX / 安定性
- 単体保存中、一括操作中、アップロード中は多重送信を防止する。
- mutation ロックと upload ロックは `finally` で必ず解除する。
- 操作失敗時は toast でユーザーに分かる文言を表示する。
- Storage 削除後に DB 更新が失敗した場合は、その状況が分かるエラー文言を表示する。
- 一覧 0 件時は scope ごとに自然な空状態文言を表示する。
- pending 中も一覧を消さず、必要なボタンだけ disabled にする。
- sort 変更時は viewer を閉じて、並び替え前の index を引きずらないようにする。
- scope 変更で選択状態を解除した場合は、その旨を通知する。
- 主要ボタンに `aria-label` を付ける。
- confirm dialog は `role="dialog"` と `aria-modal="true"` を持つ。
- 全画面ビューアを閉じたら、開く前にフォーカスしていた要素へ戻す。
- クリップボード案内文 `ページ上で Ctrl + V または Cmd + V を押すと、クリップボードの画像も貼り付けできます。` は細い補助バーとして残す。

## Supabase / セキュリティ
- Auth は Supabase Auth を使用する。
- `/gallery` は未ログインでアクセス不可。
- `folders` `images` は RLS で `user_id = auth.uid()` のみ許可する。
- Storage はオブジェクトパス先頭の `user_id` と `auth.uid()` を一致条件にする。
- `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` は `src/lib/supabase/env.ts` で直接参照する。

## UIトーン調整
- gallery 画面は白ベースの管理画面トーンを維持しつつ、余白と角丸を抑えた高密度レイアウトにする。
- サイドバーは固定幅のプレーンなリスト UI とし、行高と内側余白を詰める。
- メインヘッダーはカテゴリ名と件数、表示切り替え、並び順を短い高さで収める。
- アップロード枠は点線の軽いフラット表現にし、クリップボード案内は細い補助バーとして表示する。
- グリッドカードはサムネイル主体で、下部情報はファイル名とメタ情報 1 行程度に圧縮する。
- リスト表示は横並びの情報密度を優先し、セル余白とサムネイルサイズを抑える。
- グリッド一覧は desktop で列数を増やし、カード幅とサムネイル高さを少し抑えて一覧密度を上げる。
- 全画面ビューアを閉じる操作は `viewerState` を閉じず、`isFullscreenOpen` のみ `false` にして詳細モーダルへ戻す。

## 保守性調整
- folder の `last_used_at` 更新は server render 中ではなく client 側に寄せ、同一遷移で二重更新しないようにする。
- Storage 削除と DB 削除の組み合わせ処理は mutation 層の共通関数に寄せ、単体削除と一括削除で重複実装しない。
- ギャラリー一覧の選択状態判定は `Set` を使い、描画ごとの線形検索を減らす。
- toast の自動消去タイマーは unmount 時に確実に掃除する。
- signed URL 生成に失敗しても一覧全体を壊さず、対象画像だけ `signed_url: null` として扱えるようにする。
- gallery 一覧は `page` クエリを使ったページネーション対応とし、1 ページあたり 32 件を取得・表示する。
- page は現在の scope / folder / sort / view と同じ URL クエリで扱い、scope または folder 切り替え時は `page=1` に戻す。
- グリッド表示は desktop で 4 列を優先する。
- 一覧下部に前へ / 次へボタンと現在ページ表示を置き、disabled 条件は「前ページなし」「次ページなし」に合わせる。
- viewerState は現在ページに表示している画像配列をそのまま使う。ページ切り替え時は viewer を閉じ、別ページの画像を混在させない。
- gallery 一覧では viewer 用の大きい画像 URL と別に、一覧描画専用の軽量サムネイル URL を使う。
- 一覧サムネイルは Supabase Storage の画像 transform で幅 640 / 高さ 512 / cover / quality 70 の signed URL を生成する。
- 詳細モーダルと全画面ビューアは引き続き full-size の signed URL を使う。
- 一覧カードは next/image を使い、4 列グリッドに合わせた `sizes` を設定し、1 画面目の一部のみ eager、それ以外は lazy 読み込みにする。
- `ImageGridCard` と `ImageListRow` は memo 化して、未変更カードの再レンダリングを減らす。
- `src/lib/gallery/mutations.ts` の画像更新系 mutation は共通 helper へ集約し、単体操作と一括操作で同じ update ロジックを再利用する。
- 画像一覧 query は毎回 fresh な Supabase query builder を組み立てる。builder の再利用には依存しない。
- 一覧カードの `React.memo` は stale callback を残さない前提で使い、viewer を開く処理と選択処理は ref / stable callback で現在状態を参照する。
