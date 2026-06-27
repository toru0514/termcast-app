/** ブランドトークン（フォント・配色）。Cloud9 デザイントークン共通化の受け皿。 */
export const theme = {
  fontFamily:
    '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif',
  color: {
    bg: '#0e1726',
    bgAccent: '#16223a',
    text: '#f5f7fa',
    sub: '#9fb3c8',
    up: '#e2483f', // 陽線・上昇（日本式の赤）
    down: '#1f9d6b', // 陰線・下落（緑）
    accent: '#4f9cf9',
    gold: '#f5c451',
    line: '#2a3b57',
  },
  fontSize: {
    term: 96,
    caption: 64,
    sub: 40,
    disclaimer: 28,
  },
} as const;

export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
} as const;
