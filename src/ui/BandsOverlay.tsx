import React from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { FeatureFrame } from '../core/types';
import { applySpectrumMapping } from '../core/mapping';
import { useStore } from '../state/useStore';

export const BandsOverlay: React.FC<{ frame: FeatureFrame | null }>= ({ frame }) => {
  const { audioMapping } = useStore();
  const bands = applySpectrumMapping(frame?.spectrum, frame?.sampleRateHz, audioMapping);
  const w = 160, h = 48;
  const barW = bands.length > 0 ? w / bands.length : 0;
  const rects: React.ReactElement[] = [];
  for (let i = 0; i < bands.length; i++) {
    const v = Math.max(0, Math.min(1, bands[i]));
    const bh = v * h;
    rects.push(<Rect key={i} x={i*barW} y={h-bh} width={Math.max(1, barW-1)} height={bh} fill={`rgba(255,255,255,0.8)`} />);
  }
  return (
    <View style={{ position: 'absolute', bottom: 12, right: 12, opacity: 0.7 }}>
      <Svg width={w} height={h}>
        <Rect x={0} y={0} width={w} height={h} fill="rgba(0,0,0,0.4)" />
        {rects}
      </Svg>
    </View>
  );
};


