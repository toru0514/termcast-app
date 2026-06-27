import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Scene } from '../../types.js';
import type { VisualName } from '../../scene/visuals.js';
import { theme } from '../theme.js';

export interface VisualProps {
  scene: Scene;
  term: string;
}

const center: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

// ===== 1. ローソク足の登場アニメ =====
const CandleIntro: React.FC<VisualProps> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const candles = [
    { x: 180, up: true, o: 520, c: 360, h: 320, l: 560 },
    { x: 360, up: false, o: 360, c: 470, h: 330, l: 510 },
    { x: 540, up: true, o: 470, c: 300, h: 270, l: 500 },
    { x: 720, up: true, o: 300, c: 220, h: 190, l: 330 },
  ];
  return (
    <div style={center}>
      <svg width={900} height={760} viewBox="0 0 900 760">
        {candles.map((cd, i) => {
          const appear = spring({ frame: frame - i * 8, fps, config: { damping: 14 } });
          const color = cd.up ? theme.color.up : theme.color.down;
          const top = Math.min(cd.o, cd.c);
          const bodyH = Math.abs(cd.o - cd.c);
          return (
            <g key={i} transform={`translate(${cd.x},0) scale(1, ${appear})`} opacity={appear}>
              <line x1={40} y1={cd.h} x2={40} y2={cd.l} stroke={color} strokeWidth={6} />
              <rect x={10} y={top} width={60} height={Math.max(bodyH, 6)} fill={color} rx={4} />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ===== 2. 始値・終値・高値・安値の分解図 =====
const CandleAnatomy: React.FC<VisualProps> = () => {
  const frame = useCurrentFrame();
  const labelOpacity = (delay: number) =>
    interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: 'clamp' });
  const labelStyle: React.CSSProperties = {
    fontFamily: theme.fontFamily,
    fontSize: 38,
    fontWeight: 700,
    fill: theme.color.text,
  };
  return (
    <div style={center}>
      <svg width={760} height={760} viewBox="0 0 760 760">
        <line x1={380} y1={120} x2={380} y2={210} stroke={theme.color.up} strokeWidth={8} />
        <rect x={340} y={210} width={80} height={300} fill={theme.color.up} rx={6} />
        <line x1={380} y1={510} x2={380} y2={620} stroke={theme.color.up} strokeWidth={8} />
        <g opacity={labelOpacity(6)}>
          <line x1={420} y1={120} x2={620} y2={120} stroke={theme.color.line} strokeWidth={3} />
          <text x={630} y={132} style={labelStyle}>高値</text>
        </g>
        <g opacity={labelOpacity(16)}>
          <line x1={420} y1={210} x2={620} y2={210} stroke={theme.color.line} strokeWidth={3} />
          <text x={630} y={222} style={labelStyle}>終値</text>
        </g>
        <g opacity={labelOpacity(26)}>
          <line x1={340} y1={510} x2={140} y2={510} stroke={theme.color.line} strokeWidth={3} />
          <text x={40} y={522} style={labelStyle}>始値</text>
        </g>
        <g opacity={labelOpacity(36)}>
          <line x1={380} y1={620} x2={620} y2={620} stroke={theme.color.line} strokeWidth={3} />
          <text x={630} y={632} style={labelStyle}>安値</text>
        </g>
      </svg>
    </div>
  );
};

// ===== 3. ゴールデン／デッドクロス =====
const CrossAnimation: React.FC<VisualProps> = ({ term }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 70], [0, 1], { extrapolateRight: 'clamp' });
  const isDead = term.includes('デッド');
  const w = 760;
  const fastColor = theme.color.gold;
  const slowColor = theme.color.accent;
  const fastPath = `M0,${isDead ? 520 : 240} Q${w / 2},${380} ${w},${isDead ? 240 : 520}`;
  const slowPath = `M0,380 Q${w / 2},${380} ${w},380`;
  const dash = 1400;
  return (
    <div style={center}>
      <svg width={w} height={620} viewBox={`0 0 ${w} 620`}>
        <path d={slowPath} fill="none" stroke={slowColor} strokeWidth={8}
          strokeDasharray={dash} strokeDashoffset={dash * (1 - progress)} />
        <path d={fastPath} fill="none" stroke={fastColor} strokeWidth={8}
          strokeDasharray={dash} strokeDashoffset={dash * (1 - progress)} />
        {progress > 0.5 && (
          <circle cx={w / 2} cy={380} r={interpolate(progress, [0.5, 1], [0, 22])}
            fill="none" stroke={isDead ? theme.color.down : theme.color.up} strokeWidth={6} />
        )}
      </svg>
    </div>
  );
};

// ===== 4. PER などの数式アニメーション =====
const RatioCalc: React.FC<VisualProps> = ({ term }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const formulas: Record<string, [string, string, string]> = {
    PER: ['PER', '株価', '1株あたり利益(EPS)'],
    PBR: ['PBR', '株価', '1株あたり純資産(BPS)'],
    ROE: ['ROE', '純利益', '自己資本'],
    ROA: ['ROA', '純利益', '総資産'],
    配当利回り: ['配当利回り', '1株配当', '株価'],
  };
  const [label, num, den] = formulas[term] ?? [term, '指標の分子', '指標の分母'];
  const pop = spring({ frame, fps, config: { damping: 12 } });
  const box: React.CSSProperties = {
    fontFamily: theme.fontFamily,
    color: theme.color.text,
    fontSize: 46,
    fontWeight: 700,
    textAlign: 'center',
  };
  return (
    <div style={{ ...center, transform: `scale(${pop})` }}>
      <div style={box}>
        <div style={{ color: theme.color.gold, fontSize: 60, marginBottom: 28 }}>{label}</div>
        <div style={{ fontSize: 44, paddingBottom: 18 }}>{num}</div>
        <div style={{ borderTop: `4px solid ${theme.color.accent}`, paddingTop: 18, width: 620 }}>
          {den}
        </div>
      </div>
    </div>
  );
};

// ===== 5. 汎用タイトル =====
const GenericTerm: React.FC<VisualProps> = ({ term }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 13 } });
  return (
    <div style={center}>
      <div
        style={{
          fontFamily: theme.fontFamily,
          fontSize: theme.fontSize.term,
          fontWeight: 800,
          color: theme.color.text,
          transform: `scale(${pop})`,
          textShadow: `0 0 40px ${theme.color.accent}55`,
        }}
      >
        {term}
      </div>
    </div>
  );
};

// ===== 6. 箇条書き（汎用） =====
const BulletPoints: React.FC<VisualProps> = ({ scene }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: 'clamp' });
  const y = interpolate(frame, [0, 14], [30, 0], { extrapolateRight: 'clamp' });
  return (
    <div style={center}>
      <div
        style={{
          fontFamily: theme.fontFamily,
          fontSize: 56,
          fontWeight: 700,
          color: theme.color.text,
          maxWidth: 820,
          textAlign: 'center',
          lineHeight: 1.5,
          opacity,
          transform: `translateY(${y}px)`,
        }}
      >
        {scene.caption}
      </div>
    </div>
  );
};

export const VISUAL_REGISTRY: Record<VisualName, React.FC<VisualProps>> = {
  candle_intro: CandleIntro,
  candle_anatomy: CandleAnatomy,
  cross_animation: CrossAnimation,
  ratio_calc: RatioCalc,
  generic_term: GenericTerm,
  bullet_points: BulletPoints,
};
