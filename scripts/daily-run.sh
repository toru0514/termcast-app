#!/bin/zsh
# termcast-app: 毎日19:30の自動生成→Drive保存→YouTube公開 (launchdから起動)
# launchd は最小環境で動くため PATH と前提(Docker / VOICEVOX)を自前で整える。
set -u

# --- パス類 (launchd は PATH をほぼ持たないので明示) ---
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
PROJECT_DIR="/Users/toru/code/termcast-app"
LOG_DIR="$HOME/Library/Logs/termcast"
LOCK_FILE="/tmp/termcast-daily.lock"
VOICEVOX_IMAGE="voicevox/voicevox_engine:cpu-ubuntu20.04-latest"

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/generate-$(date +%Y-%m-%d_%H%M%S).log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

# --- 二重起動防止 (前回が長引いている場合スキップ) ---
if ! mkdir "$LOCK_FILE" 2>/dev/null; then
  log "別の実行が進行中のためスキップ ($LOCK_FILE)"
  exit 0
fi
trap 'rmdir "$LOCK_FILE" 2>/dev/null' EXIT

log "=== termcast daily 開始 ==="

# --- 1. Docker デーモン起動確認 (Docker Desktop) ---
if ! docker info >/dev/null 2>&1; then
  log "Docker デーモン未起動 → Docker Desktop を起動して待機"
  open -a Docker || log "open -a Docker 失敗"
  for i in $(seq 1 60); do
    docker info >/dev/null 2>&1 && break
    sleep 2
  done
  if ! docker info >/dev/null 2>&1; then
    log "ERROR: Docker デーモンが起動しませんでした。中止。"
    exit 1
  fi
fi

# --- 2. VOICEVOX コンテナ起動確認 (--rm なので無ければ run し直す) ---
if ! docker ps --filter "name=^voicevox$" --filter "status=running" --format '{{.Names}}' | grep -q voicevox; then
  log "VOICEVOX 未起動 → 起動"
  docker rm -f voicevox >/dev/null 2>&1 || true
  docker run -d --rm --name voicevox -p 50021:50021 "$VOICEVOX_IMAGE" >/dev/null \
    || { log "ERROR: VOICEVOX 起動失敗"; exit 1; }
else
  log "VOICEVOX 起動済み"
fi

# --- 3. VOICEVOX が応答するまで待機 (最大60秒) ---
for i in $(seq 1 30); do
  curl -sf "http://127.0.0.1:50021/version" >/dev/null 2>&1 && break
  sleep 2
done
if ! curl -sf "http://127.0.0.1:50021/version" >/dev/null 2>&1; then
  log "ERROR: VOICEVOX が応答しません (:50021)。中止。"
  exit 1
fi
log "VOICEVOX 応答OK"

# --- 4. 生成パイプライン実行 ---
cd "$PROJECT_DIR" || { log "ERROR: cd 失敗"; exit 1; }
log "npm run generate 実行…"
npm run generate >>"$LOG_FILE" 2>&1
STATUS=$?

if [ $STATUS -eq 0 ]; then
  YT_LINE=$(grep -E '\[done\]' "$LOG_FILE" | tail -1)
  log "完了 (exit 0)"
  [ -n "$YT_LINE" ] && log "$YT_LINE"

  # --- 4b. TikTok 下書き(inbox)へ送信 ---
  # 直近生成(output/last.json)を TikTok の下書きへ。未公開下書きが上限(約5件)だと
  # spam_risk で弾かれるが、その場合も generate 自体は成功扱いのまま警告 log にとどめる。
  log "npm run social -- --only tiktok 実行…（TikTok下書きへ）"
  npm run social -- --only tiktok >>"$LOG_FILE" 2>&1
  TT_LINE=$(grep -E '(✅|⏭️|❌).*tiktok' "$LOG_FILE" | tail -1)
  if echo "$TT_LINE" | grep -q '✅'; then
    log "TikTok下書き送信 完了: $TT_LINE"
  else
    log "WARN: TikTok下書き送信は未成功（生成は成功）。$TT_LINE"
  fi

  # --- 4c. 公開用キャプションページ(captions.html)を最新化して GitHub Pages へ反映 ---
  # generate が新規動画のキャプションをキャッシュ済みなので captions:page は Gemini 不要で即完了。
  log "captions.html 更新＆push…"
  npm run captions:page >>"$LOG_FILE" 2>&1
  if git diff --quiet -- captions.html 2>/dev/null; then
    log "captions.html 変更なし"
  else
    git add captions.html >>"$LOG_FILE" 2>&1
    git commit -q -m "Update captions page (daily $(date +%Y-%m-%d))" >>"$LOG_FILE" 2>&1
    if git push origin main >>"$LOG_FILE" 2>&1; then
      log "captions.html を push（GitHub Pages 反映）"
    else
      log "WARN: captions.html の push 失敗（launchdのgit認証を確認）。ローカルcommitは済。"
    fi
  fi
else
  log "ERROR: generate 失敗 (exit $STATUS)。詳細は $LOG_FILE"
fi

# --- 5. 古いログの掃除 (30日より古いものを削除) ---
find "$LOG_DIR" -name 'generate-*.log' -mtime +30 -delete 2>/dev/null || true

log "=== termcast daily 終了 ==="
exit $STATUS
