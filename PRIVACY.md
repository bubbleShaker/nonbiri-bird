# プライバシーポリシー / Privacy Policy

**対象拡張機能 / Extension:** nonbiri-bird
**最終更新 / Last updated:** 2026-06-29

## 日本語

nonbiri-bird（以下「本拡張」）は、ユーザーの個人情報を **一切収集・送信しません**。

### 取り扱うデータ

- 本拡張が扱うのは、ユーザーが設定 UI（ツールバーアイコンのポップアップ）で指定した
  **表示設定のみ**です（鳥の最大数・出現頻度・除外サイトのホスト名）。
- これらの設定は、ブラウザの `chrome.storage.sync` にのみ保存されます。
  保存先は利用者自身のブラウザ／Google アカウントの同期領域であり、
  本拡張の開発者を含む第三者がアクセスすることはありません。

### 送信・共有

- 本拡張は外部サーバーへの通信を行いません。
- 閲覧履歴・ページ内容・個人情報を収集、保存、送信、販売することはありません。
- 解析・トラッキング・広告の仕組みは一切含みません。

### 権限の利用目的

| 権限 | 目的 |
|---|---|
| `storage` | 表示設定を `chrome.storage.sync` に保存・同期するため |
| `activeTab` | ポップアップの「このサイトを除外」操作時に、現在開いているタブのホスト名のみを取得するため（クリック操作時のみ・URL は除外リスト作成にのみ使用し送信しない） |

### お問い合わせ

不明点は GitHub リポジトリの Issue よりご連絡ください。
https://github.com/bubbleShaker/nonbiri-bird

---

## English

nonbiri-bird (the "Extension") does **not collect or transmit any personal
information**.

### Data handled

- The only data the Extension handles is the **display settings** the user
  enters in the settings popup (maximum number of birds, appearance frequency,
  and excluded site hostnames).
- These settings are stored solely in the browser's `chrome.storage.sync`.
  They live in the user's own browser / Google account sync area and are not
  accessible to any third party, including the Extension's developer.

### Transmission / Sharing

- The Extension makes no network requests to any external server.
- It does not collect, store, transmit, or sell browsing history, page
  content, or personal data.
- It contains no analytics, tracking, or advertising.

### Why each permission is requested

| Permission | Purpose |
|---|---|
| `storage` | To save and sync display settings via `chrome.storage.sync`. |
| `activeTab` | To read only the hostname of the currently active tab when the user clicks "Exclude this site" in the popup. The URL is used solely to build the exclusion list and is never transmitted. |

### Contact

For questions, please open an issue on the GitHub repository:
https://github.com/bubbleShaker/nonbiri-bird
