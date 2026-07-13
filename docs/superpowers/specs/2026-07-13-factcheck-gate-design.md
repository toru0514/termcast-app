# ファクトチェック・ゲート 設計

_2026-07-13_

## 目的

生成された台本に事実誤り（例: 「陰線＝終値>始値」と逆に説明）が含まれたまま動画化・
アップロードされるのを、**人手ではなくシステムで**防ぐ。台本生成の直後に独立AIによる
ファクトチェックを挟み、通らない限り動画を作らずアップロードもしない。

## 全体フロー

```
用語選定 → 台本生成(Gemini Flash)
              ↓
        【ファクトチェック】(Gemini・独立プロンプト)   ← 新設ゲート
         ├─ pass → シーン→音声→レンダリング→アップロード（従来どおり）
         └─ fail → 指摘(issues)を添えて再生成（最大 maxRegen 回）
                     └─ なお不合格 → その用語を needs_review にして次の pending 用語へ
                        （1実行で試す用語数は maxTerms で上限）
```

ゲートは generate パイプラインの1箇所に置く。TikTok/YouTube/Drive はすべて後段なので、
1ゲートで全アップロード経路を守れる。

## 判定基準

検証役には**生成プロンプトを見せず**、用語＋生成ナレーションだけを渡し、自分の知識で
批判的に事実確認させる（同じ勘違いの伝播を防ぐ）。

- fail 対象（material issue のみ）:
  - 定義そのものの誤り（別用語の説明になっている等）
  - 数値・方向・大小関係の取り違え（始値/終値・高値/安値・上/下 など）
  - 投資助言的な断定（「買うべき」等）
- 対象外: 言い回し・テンポ等の文体（誤検出で正しい台本を弾かないため）
- 迷う程度は pass に倒す（保守的）。

## モジュール構成

- `src/verify/types.ts` — `FactCheckVerdict`(zod) と `FactChecker` インターフェース
  - `FactCheckVerdict = { verdict: 'pass'|'fail', issues: { scene, problem, correction }[] }`
  - `FactChecker = { name; check(term, script): Promise<FactCheckVerdict> }`
- `src/verify/gemini.ts` — `GeminiFactChecker`（独立プロンプト・構造化JSON出力）
- `src/verify/noop.ts` — `NoopFactChecker`（GEMINI未設定時は pass＋警告ログ。オフラインでも
  パイプラインは止めない）
- `src/verify/index.ts` — `createFactChecker()` ファクトリ ＋ `verifiedGenerate()` オーケストレータ

### verifiedGenerate（テスト対象の中核）

```
verifiedGenerate(term, generator, checker, { maxRegen }):
  issues = []
  for attempt in 0..maxRegen:
    script = generator.generate(term, issues)   // issues があれば「直して」と添える
    verdict = checker.check(term, script)
    if verdict.verdict == 'pass': return { ok: true, script, attempts: attempt+1 }
    issues = verdict.issues
  return { ok: false, script, verdict, attempts: maxRegen+1 }
```

ジェネレータ/チェッカーを注入できるので、fake を使って再生成ループを単体テストできる。
`generate(term, issues?)` の第2引数はオプションにして既存呼び出しと後方互換。

## 失敗時の状態管理

- `TermStatus` に `needs_review` を追加。
- `TermStore` に `markNeedsReview(id)` を追加（Local: used.json に status=needs_review で記録
  → 以後 pickNext から除外 / Supabase: status を needs_review に更新）。
- generate は pickNext→verifiedGenerate を最大 maxTerms 回ループ。ok が出たらその用語で続行、
  fail が続いたら markNeedsReview して次へ。maxTerms 使い切ったら「本日は生成なし」で終了。

## 設定（config.verify）

- `VERIFY_ENABLED`（既定 on。off で従来動作）
- `VERIFY_MODEL`（既定 Gemini Flash。将来 Pro 等へ差し替え）
- `VERIFY_MAX_REGEN`（既定 2 ＝ 最大3回生成）
- `VERIFY_MAX_TERMS`（既定 3 ＝ 1実行で試す用語数上限）

## スコープ外（今回やらない）

- 既存の生成済み動画（19本）の遡及チェック。ゲートは今後の生成分に適用。
- 用語ごとの「正解データ」マスタ整備（将来のハイブリッド化の余地として残す）。

## テスト

- `verifiedGenerate`: fake generator/checker で (1)一発pass (2)再生成でpass
  (3)maxRegen超で fail=ok:false、を検証。issues が次の generate に渡ることも確認。
- `NoopFactChecker`: 常に pass を返す。
- Gemini実呼び出しは単体テスト対象外（プロンプト構築の純粋部分のみ必要なら検証）。
