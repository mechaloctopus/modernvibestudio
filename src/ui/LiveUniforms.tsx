import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import type { FeatureFrame } from '../core/types';
import { Panel } from './Panel';

export const LiveUniforms: React.FC<{ frame: FeatureFrame | null; collapsed: boolean; onToggle: () => void }>= ({ frame, collapsed, onToggle }) => {
  const rms = frame?.amplitudeRms ?? 0;
  const centroid = frame?.spectralCentroidHz ?? 0;
  const note = frame?.midiNote ?? -1;
  const low = frame?.bandEnergies?.low ?? 0;
  const mid = frame?.bandEnergies?.mid ?? 0;
  const high = frame?.bandEnergies?.high ?? 0;
  const onset = frame?.onsetPercussive ? 1 : 0;
  const notes = frame?.notesMidi || new Float32Array(0);
  const notesAmp = frame?.notesAmp || new Float32Array(0);
  const bands16 = frame?.spectrum && frame?.sampleRateHz ? undefined : undefined; // placeholder if we later want raw bands

  return (
    <View style={{ width: 280 }}>
      <Panel title="Live Uniforms" collapsed={collapsed} onToggle={onToggle}>
        <ScrollView style={{ maxHeight: 260 }}>
          <Text style={{ color: '#9fd' }}>u_amp: {rms.toFixed(3)}</Text>
          <Text style={{ color: '#9fd' }}>u_centroid: {centroid.toFixed(0)} Hz</Text>
          <Text style={{ color: '#9fd' }}>u_note: {note >= 0 ? note.toFixed(1) : 'none'}</Text>
          <Text style={{ color: '#9fd' }}>u_low/u_mid/u_high: {low.toFixed(3)} / {mid.toFixed(3)} / {high.toFixed(3)}</Text>
          <Text style={{ color: onset ? '#f88' : '#9fd' }}>u_onset: {onset}</Text>
          <Text style={{ color: '#9fd', marginTop: 6 }}>u_notesA (top 4):</Text>
          {Array.from({ length: 4 }, (_, i)=> (
            <Text key={i} style={{ color: '#9fd' }}>  {i}: {notes[i] != null ? notes[i].toFixed(1) : '—'} (amp {notesAmp[i] != null ? notesAmp[i].toFixed(2) : '—'})</Text>
          ))}
        </ScrollView>
      </Panel>
    </View>
  );
};


