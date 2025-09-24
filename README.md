# Twitter Auto Manager 🤖

[![CI](https://github.com/yourusername/twitter-auto-manager/workflows/Desktop%20CI/badge.svg)](https://github.com/yourusername/twitter-auto-manager/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-orange.svg)](https://tauri.app/)

> 🚀 **高機能なTwitter Bot自動管理ツール** - デスクトップアプリとGitHub Actionsで完全自動化

Twitter Botの管理・運用を完全自動化する包括的なソリューションです。直感的なデスクトップアプリケーションでBotを設定し、GitHub Actionsで24時間365日の自動運用を実現します。

## ✨ 主要機能

### 🎛️ **デスクトップアプリケーション**
- **Bot管理**: 複数のTwitter Botアカウントを一元管理
- **スケジュール投稿**: 時間指定での自動投稿設定
- **自動返信**: 特定アカウントへの自動返信機能
- **実行ログ**: 詳細なBot動作ログと統計情報
- **設定エクスポート**: GitHub Actions用設定の自動生成

### ⚡ **GitHub Actions自動化**
- **定期投稿**: 毎時0分に自動投稿実行
- **返信監視**: 毎時30分に返信対象をチェック
- **自動更新**: 投稿インデックスの自動進行
- **エラー処理**: 失敗時のログ保存と通知

### 🔧 **高度な設定機能**
- **複数投稿内容**: ローテーション投稿対応
- **柔軟なスケジュール**: 時間帯別投稿設定
- **API対応**: Twitter API v2 (Free/Basic/Pro)
- **プラン管理**: 複数プランでの機能制限

## 🏗️ アーキテクチャ

```
twitter-auto-manager/
├── apps/
│   ├── desktop/           # Tauri + React デスクトップアプリ
│   │   ├── src/          # React フロントエンド
│   │   └── src-tauri/    # Rust バックエンド + SQLite
│   └── workers/
│       └── twitter/      # Node.js ワーカー (GitHub Actions用)
├── packages/
│   └── shared/          # 共有型定義・スキーマ
├── .github/workflows/   # CI/CD & 自動化ワークフロー
└── config/
    └── actions/        # GitHub Actions 用設定（下記参照）
        ├── user-config.json     # 人が編集する静的設定
        ├── system-state.json    # ワークフローが更新する運用状態
        ├── github-config.json   # 上記2ファイルの統合生成物
        └── scripts/             # 設定分割・統合スクリプト
```

### 技術スタック

| 領域 | 技術 |
|------|------|
| **フロントエンド** | React 18, TypeScript, Mantine UI |
| **バックエンド** | Rust (Tauri), SQLite |
| **自動化** | Node.js, GitHub Actions |
| **API** | Twitter API v2, OAuth 1.0a |
| **ビルド** | Vite, ESBuild |

## 🚀 クイックスタート

### 前提条件
- Node.js 18以上
- Rust 1.70以上 (デスクトップアプリ開発時)
- Twitter API キー

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/twitter-auto-manager.git
cd twitter-auto-manager

# 依存関係をインストール
npm install

# 共有パッケージをビルド
npm run build:shared
```

### 開発環境セットアップ

```bash
# デスクトップアプリを開発モードで起動
npm run dev:desktop

# ワーカーをビルド
npm run build:workers
```

### 本番環境デプロイ

```bash
# デスクトップアプリをビルド
npm run build:desktop
npm run tauri:build

# GitHub Actions用設定をエクスポート
# (デスクトップアプリの「設定」→「GitHub Actions設定エクスポート」)
```

## 📖 使用方法

### 1. Bot設定

1. デスクトップアプリを起動
2. 「Bot管理」でTwitter APIキーを設定
3. 「設定」でスケジュール投稿を設定
4. 投稿内容リストを登録

### 2. GitHub Actions設定

1. デスクトップアプリで設定完了後、「GitHub Actions設定エクスポート」を実行
2. エクスポート後に `npm run config:split` を実行し、`config/actions/user-config.json` と `config/actions/system-state.json` に分割
3. `user-config.json` をリポジトリにコミット（`system-state.json` はワークフローが自動更新）
4. 投稿／返信ワークフロー内で `config/actions/scripts/merge-config.js` が実行され、`github-config.json` が生成される

### 3. 自動返信設定

```typescript
// 返信設定例
{
  "reply_bot_id": "123",           // 返信するBot
  "target_bot_ids": ["456", "789"], // 監視対象Bot
  "reply_content": "ありがとうございます！",
  "is_active": true
}
```

## 📊 監視とログ

### ダッシュボード
- **Bot稼働状況**: リアルタイム監視
- **投稿統計**: 日次・月次統計
- **エラー追跡**: 詳細なエラーログ
- **API使用量**: 制限監視

### ログ機能
```bash
# 実行ログの確認
# デスクトップアプリ「Bot実行ログ」ページで確認
# または GitHub Actions の Artifacts からダウンロード
```

## 🔧 設定

### Twitter API設定

```json
{
  "api_type": "Free",  // Free, Basic, Pro
  "api_key": "your_api_key",
  "api_key_secret": "your_api_key_secret",
  "access_token": "your_access_token",
  "access_token_secret": "your_access_token_secret"
}
```

### スケジュール設定

```json
{
  "scheduled_times": "09:00,12:00,18:00",
  "scheduled_content_list": [
    "おはようございます！今日も頑張りましょう。",
    "お昼の時間ですね。お疲れ様です。",
    "お疲れ様でした！今日も一日ありがとうございました。"
  ]
}
```

## 🔐 セキュリティ

- **API キー暗号化**: ローカルDBで安全に保存
- **OAuth認証**: Twitter API v2準拠
- **GitHub Secrets**: 機密情報の安全な管理
- **権限最小化**: 必要最小限のAPI権限のみ使用

## 📈 プラン

| プラン | Bot数 | 投稿/日 | API | サポート |
|--------|-------|---------|-----|----------|
| **Starter** | 1個 | 7投稿 | Free | コミュニティ |
| **Basic** | 5個 | 7投稿 | Basic | 優先 |
| **Pro** | 10個 | 7投稿 | Pro | 24時間 |

## 🤝 コントリビューション

プロジェクトへの貢献を歓迎します！

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

詳細は [CONTRIBUTING.md](docs/CONTRIBUTING.md) をご覧ください。

## 🐛 トラブルシューティング

### よくある問題

**Q: Twitter API エラーが発生する**
```bash
# API キーの確認
# デスクトップアプリ「設定」→「API設定確認」

# レート制限の確認
# 「Bot実行ログ」でAPI使用状況を確認
```

**Q: GitHub Actions が動作しない**
```bash
# 設定ファイルの確認（手動編集用）
cat config/actions/user-config.json | jq '.'

# システム状態の確認（自動更新用）
cat config/actions/system-state.json | jq '.'

# ワークフロー権限の確認
# GitHub Settings → Actions → General → Workflow permissions
```

**Q: 投稿が重複する**
```bash
# インデックス管理の確認
# デスクトップアプリで current_index を確認
```

## 📚 ドキュメント

- [📖 アーキテクチャ](docs/ARCHITECTURE.md)
- [⚙️ GitHub Actions設定](docs/ACTIONS.md)
- [🗄️ データベース設計](docs/DB_SCHEMA.md)
- [🔒 セキュリティ](docs/SECURITY.md)
- [🤝 コントリビューション](docs/CONTRIBUTING.md)

## 📄 ライセンス

このプロジェクトは [MIT License](LICENSE) の下で公開されています。

## 🙏 謝辞

- [Tauri](https://tauri.app/) - クロスプラットフォームデスクトップアプリ開発
- [React](https://reactjs.org/) - ユーザーインターフェース
- [Mantine](https://mantine.dev/) - UIコンポーネント
- [Twitter API](https://developer.twitter.com/) - Twitter連携

## 📞 サポート

- 🐛 バグレポート: [Issues](https://github.com/yourusername/twitter-auto-manager/issues)
- 💬 質問・議論: [Discussions](https://github.com/yourusername/twitter-auto-manager/discussions)
- 📧 その他のお問い合わせ: your-email@example.com

---

<div align="center">

**⭐ このプロジェクトが役に立った場合は、スターをお願いします！**

[🏠 ホーム](https://github.com/yourusername/twitter-auto-manager) • [📖 ドキュメント](docs/) • [🚀 リリース](https://github.com/yourusername/twitter-auto-manager/releases)

</div>