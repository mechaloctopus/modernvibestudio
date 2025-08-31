import React from 'react';
import { Dimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { FeatureFrame, VisualizerModule } from '../../core/types';
import { useStore } from '../../state/useStore';
import { applySpectrumMapping } from '../../core/mapping';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type FlowParams = {
  speed: number; // 0..2
  trailColor: { r: number; g: number; b: number };
};

const FlowImpl: React.FC<{ params: FlowParams; frame: FeatureFrame | null }>= ({ params, frame }) => {
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), 16);
    return () => clearInterval(id);
  }, []);

  const amp = frame?.amplitudeRms ?? 0;
  const { audioMapping } = useStore();
  const bands = applySpectrumMapping(frame?.spectrum, frame?.sampleRateHz, audioMapping);
  const low = bands[0] ?? 0;
  const mid = bands[Math.floor(bands.length/2)] ?? 0;
  const high = bands[bands.length-1] ?? 0;
  const radial = 0.2 + 0.8 * (0.4*low + 0.4*mid + 0.2*high);
  const speed = Math.max(0, Math.min(2, params.speed));
  const count = 100;
  const cx = SCREEN_W / 2;
  const cy = SCREEN_H / 2;
  const maxR = Math.min(cx, cy) * 1.2;
  const nodes = [] as JSX.Element[];
  for (let i = 0; i < count; i++) {
    const f = i / count;
    const angle = (t * 0.01 * speed + f * Math.PI * 4) % (Math.PI * 2);
    const r = (0.2 + 0.8 * f) * maxR * radial;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    const base = params.trailColor;
    const alpha = 0.1 + 0.6 * Math.pow(f, 2) * (0.2 + 0.8 * amp);
    nodes.push(
      <Circle key={`p-${i}`} cx={x} cy={y} r={2 + 4 * amp * (1 - f)} fill={`rgba(${Math.floor(base.r*255)},${Math.floor(base.g*255)},${Math.floor(base.b*255)},${alpha})`} />
    );
  }
  return (
    <Svg width={SCREEN_W} height={SCREEN_H}>
      {nodes}
    </Svg>
  );
};

export const FlowModule: VisualizerModule = {
  id: 'flow',
  name: 'Flow',
  schema: {
    speed: { type: 'number', min: 0, max: 2, step: 0.01, default: 1, description: 'Camera flight speed' },
    trailColor: { type: 'color', default: { r: 1.0, g: 0.6, b: 0.3 }, description: 'Trail color' },
  },
  defaultParams: {
    speed: 1,
    trailColor: { r: 1.0, g: 0.6, b: 0.3 },
  },
  Component: FlowImpl as any,
};


