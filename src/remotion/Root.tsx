import React from 'react';
import { Composition } from 'remotion';
import { DISCLAIMER, type SceneFile } from '../types.js';
import { VIDEO } from './theme.js';
import { Short, totalFrames } from './Short.js';

/** プレビュー / 単体レンダリング時の既定 props（実行時は inputProps で上書き） */
const defaultProps: SceneFile = {
  term: 'ローソク足',
  reading: 'ろうそくあし',
  category: 'チャート',
  disclaimer: DISCLAIMER,
  audioFile: undefined,
  scenes: [
    { id: 1, type: 'hook', narration: 'プレビュー', caption: 'ローソク足って何？', visual: 'candle_intro', durationSec: 4 },
    { id: 2, type: 'definition', narration: 'プレビュー', caption: '1本で4つの価格', visual: 'candle_anatomy', durationSec: 5 },
    { id: 3, type: 'example', narration: 'プレビュー', caption: '具体例でイメージ', visual: 'bullet_points', durationSec: 4 },
    { id: 4, type: 'summary', narration: 'プレビュー', caption: '今日のまとめ', visual: 'generic_term', durationSec: 4 },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Short"
      component={Short}
      durationInFrames={totalFrames(defaultProps.scenes)}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => ({
        durationInFrames: totalFrames(props.scenes),
      })}
    />
  );
};
