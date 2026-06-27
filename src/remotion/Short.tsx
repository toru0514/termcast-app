import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { Scene, SceneFile } from '../types.js';
import { isVisualName } from '../scene/visuals.js';
import { theme, VIDEO } from './theme.js';
import { VISUAL_REGISTRY } from './visuals/index.js';

const fallbackDuration = 4;

function sceneFrames(scene: Scene, fps: number): number {
  return Math.max(1, Math.round((scene.durationSec ?? fallbackDuration) * fps));
}

const BrandHeader: React.FC<{ term: string }> = ({ term }) => (
  <div
    style={{
      position: 'absolute',
      top: 90,
      left: 0,
      right: 0,
      textAlign: 'center',
      fontFamily: theme.fontFamily,
      color: theme.color.sub,
      fontSize: theme.fontSize.sub,
      fontWeight: 700,
      letterSpacing: 2,
    }}
  >
    📈 1分で株用語 ｜ {term}
  </div>
);

const Caption: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 360,
        left: 60,
        right: 60,
        textAlign: 'center',
        fontFamily: theme.fontFamily,
        fontSize: theme.fontSize.caption,
        fontWeight: 800,
        color: theme.color.text,
        opacity,
        textShadow: '0 4px 24px rgba(0,0,0,0.6)',
      }}
    >
      {scene.caption}
    </div>
  );
};

const Disclaimer: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: 'absolute',
      bottom: 70,
      left: 0,
      right: 0,
      textAlign: 'center',
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize.disclaimer,
      color: theme.color.sub,
      opacity: 0.85,
    }}
  >
    ※ {text}
  </div>
);

const SceneView: React.FC<{ scene: Scene; term: string }> = ({ scene, term }) => {
  const Visual = isVisualName(scene.visual)
    ? VISUAL_REGISTRY[scene.visual]
    : VISUAL_REGISTRY.generic_term;
  // bullet_points は visual 自体が caption を見せるため、下部の重複表示を抑止する
  const showCaption = scene.visual !== 'bullet_points';
  return (
    <AbsoluteFill>
      <Visual scene={scene} term={term} />
      {showCaption ? <Caption scene={scene} /> : null}
    </AbsoluteFill>
  );
};

export const Short: React.FC<SceneFile> = ({ scenes, term, disclaimer, audioFile }) => {
  const { fps } = useVideoConfig();
  let acc = 0;
  const placed = scenes.map((scene) => {
    const from = acc;
    const frames = sceneFrames(scene, fps);
    acc += frames;
    return { scene, from, frames };
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 30%, ${theme.color.bgAccent}, ${theme.color.bg})`,
      }}
    >
      {audioFile ? <Audio src={staticFile(audioFile)} /> : null}
      <BrandHeader term={term} />
      {placed.map(({ scene, from, frames }) => (
        <Sequence key={scene.id} from={from} durationInFrames={frames}>
          <SceneView scene={scene} term={term} />
        </Sequence>
      ))}
      <Disclaimer text={disclaimer} />
    </AbsoluteFill>
  );
};

/** inputProps から総フレーム数を算出（Remotion calculateMetadata 用） */
export function totalFrames(scenes: Scene[]): number {
  return scenes.reduce((sum, s) => sum + Math.max(1, Math.round((s.durationSec ?? fallbackDuration) * VIDEO.fps)), 0);
}
