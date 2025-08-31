import React from 'react';
import { View, Text } from 'react-native';
import type { FeatureFrame } from '../core/types';

export const Hud: React.FC<{ frame: FeatureFrame | null }>= ({ frame }) => {
  const [fps, setFps] = React.useState(0);
  const last = React.useRef<number | null>(null);
  const count = React.useRef(0);
  React.useEffect(() => {
    const id = setInterval(() => {
      setFps(count.current);
      count.current = 0;
    }, 1000);
    return () => clearInterval(id);
  }, []);
  React.useEffect(() => {
    const now = Date.now();
    if (last.current == null || now - last.current > 0) {
      count.current += 1;
      last.current = now;
    }
  }, [frame]);
  const rms = frame?.amplitudeRms ?? 0;
  const centroid = frame?.spectralCentroidHz ?? 0;
  const note = frame?.midiNote != null ? frame.midiNote : undefined;
  const bands = frame?.bandEnergies;
  const onset = frame?.onsetPercussive;
  return (
    <View style={{ position: 'absolute', top: 80, right: 12, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 8 }}>
      <Text style={{ color: '#9fd' }}>FPS: {fps}</Text>
      <Text style={{ color: '#9fd' }}>RMS: {rms.toFixed(3)}</Text>
      <Text style={{ color: '#9fd' }}>Centroid: {centroid.toFixed(0)} Hz</Text>
      {note != null ? <Text style={{ color: '#9fd' }}>MIDI: {note.toFixed(1)}</Text> : null}
      {bands ? <Text style={{ color: '#9fd' }}>Bands L:{bands.low.toFixed(2)} M:{bands.mid.toFixed(2)} H:{bands.high.toFixed(2)}</Text> : null}
      {onset ? <Text style={{ color: '#f88' }}>Onset!</Text> : null}
    </View>
  );
};


