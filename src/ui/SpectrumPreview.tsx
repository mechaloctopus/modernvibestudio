import React from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useStore } from '../state/useStore';
import type { FeatureFrame } from '../core/types';
import { applySpectrumMapping } from '../core/mapping';

export const SpectrumPreview: React.FC<{ frame: FeatureFrame | null }>= ({ frame }) => {
  const { audioMapping } = useStore();
  const bands = applySpectrumMapping(frame?.spectrum, frame?.sampleRateHz, audioMapping);
  const w = 300, h = 60;
  const barW = bands.length > 0 ? w / bands.length : 0;
  const rects = [] as JSX.Element[];
  for (let i = 0; i < bands.length; i++) {
    const v = Math.max(0, Math.min(1, bands[i]));
    const bh = v * h;
    rects.push(<Rect key={i} x={i*barW} y={h-bh} width={Math.max(1, barW-1)} height={bh} fill={`rgba(160,220,255,0.9)`} />);
  }
  return (
    <View style={{ width: w, height: h }}>
      <Svg width={w} height={h}>
        {rects}
      </Svg>
    </View>
  );
};


