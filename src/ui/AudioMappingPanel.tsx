import React from 'react';
import { View, Text, Platform, TextInput, Button, ScrollView } from 'react-native';
import { useStore } from '../state/useStore';
import { SpectrumPreview } from './SpectrumPreview';
import { Panel } from './Panel';
import type { FeatureFrame } from '../core/types';

export const AudioMappingPanel: React.FC<{ frame: FeatureFrame | null }>= ({ frame }) => {
  const { audioMapping, setAudioMapping, collapsed, setCollapsed, inputMode, setInputMode, audioSensitivity, setAudioSensitivity, rmsSmoothing, setRmsSmoothing } = useStore();
  return (
    <View style={{ width: 340, maxHeight: '70%' }}>
      <Panel title="Audio Mapping" collapsed={collapsed.mapping} onToggle={()=> setCollapsed({ mapping: !collapsed.mapping })}>
      <ScrollView>
        <View style={{ marginBottom: 8 }}>
          <Text style={{ color: 'white', marginBottom: 4 }}>Input</Text>
          {Platform.OS === 'web' ? (
            <select value={inputMode} onChange={(e:any)=> setInputMode(e.target.value)}>
              <option value="mic">Microphone</option>
              <option value="tab">Desktop/Tab</option>
            </select>
          ) : (
            <Text style={{ color: '#aaa' }}>{inputMode}</Text>
          )}
        </View>
        <View style={{ marginBottom: 8 }}>
          <Text style={{ color: 'white' }}>Mic Sensitivity: {audioSensitivity.toFixed(2)}</Text>
          {Platform.OS === 'web' ? (
            <input type="range" min={0.1} max={5} step={0.1} value={audioSensitivity} onChange={(e:any)=> setAudioSensitivity(parseFloat(e.target.value))} style={{ width: '100%' }} />
          ) : (
            <TextInput value={String(audioSensitivity)} keyboardType="numeric" onChangeText={(txt)=> { const n = Number(txt); if (!Number.isNaN(n)) setAudioSensitivity(n); }} style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, marginTop: 6 }} />
          )}
        </View>
        <View style={{ marginBottom: 8 }}>
          <Text style={{ color: 'white' }}>RMS Smoothing: {rmsSmoothing.toFixed(2)}</Text>
          {Platform.OS === 'web' ? (
            <input type="range" min={0} max={1} step={0.01} value={rmsSmoothing} onChange={(e:any)=> setRmsSmoothing(parseFloat(e.target.value))} style={{ width: '100%' }} />
          ) : (
            <TextInput value={String(rmsSmoothing)} keyboardType="numeric" onChangeText={(txt)=> { const n = Number(txt); if (!Number.isNaN(n)) setRmsSmoothing(n); }} style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, marginTop: 6 }} />
          )}
        </View>
        <SpectrumPreview frame={frame} />
        <Text style={{ color: 'white' }}>Scale</Text>
        {Platform.OS === 'web' ? (
          <select value={audioMapping.scale} onChange={(e:any)=> setAudioMapping({ scale: e.target.value })}>
            <option value="linear">Linear</option>
            <option value="log">Log</option>
          </select>
        ) : (
          <Text style={{ color: '#aaa' }}>{audioMapping.scale}</Text>
        )}

        <Text style={{ color: 'white', marginTop: 8 }}>Magnitude</Text>
        {Platform.OS === 'web' ? (
          <select value={audioMapping.magnitudeMode} onChange={(e:any)=> setAudioMapping({ magnitudeMode: e.target.value })}>
            <option value="linear">Linear</option>
            <option value="db">dB</option>
          </select>
        ) : (
          <Text style={{ color: '#aaa' }}>{audioMapping.magnitudeMode}</Text>
        )}
        {audioMapping.magnitudeMode === 'db' && (
          <View style={{ marginTop: 6 }}>
            <Text style={{ color: 'white' }}>dB Floor: {audioMapping.dbFloor} dB</Text>
            {Platform.OS === 'web' ? (
              <input type="range" min={-100} max={-20} step={1} value={audioMapping.dbFloor} onChange={(e:any)=> setAudioMapping({ dbFloor: parseInt(e.target.value,10) })} />
            ) : (
              <TextInput value={String(audioMapping.dbFloor)} onChangeText={(v)=> setAudioMapping({ dbFloor: parseInt(v,10) || -60 })} style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, marginTop: 6 }} />
            )}
          </View>
        )}

        <Text style={{ color: 'white', marginTop: 8 }}>Low/High Hz: {audioMapping.lowHz} - {audioMapping.highHz}</Text>
        {Platform.OS === 'web' ? (
          <>
            <input type="range" min={20} max={audioMapping.highHz-10} step={1} value={audioMapping.lowHz} onChange={(e:any)=> setAudioMapping({ lowHz: parseInt(e.target.value,10) })} />
            <input type="range" min={audioMapping.lowHz+10} max={22050} step={1} value={audioMapping.highHz} onChange={(e:any)=> setAudioMapping({ highHz: parseInt(e.target.value,10) })} />
          </>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={String(audioMapping.lowHz)} onChangeText={(v)=> setAudioMapping({ lowHz: parseInt(v,10) || 40 })} style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, flex: 1 }} />
            <TextInput value={String(audioMapping.highHz)} onChangeText={(v)=> setAudioMapping({ highHz: parseInt(v,10) || 16000 })} style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, flex: 1 }} />
          </View>
        )}

        <Text style={{ color: 'white', marginTop: 8 }}>Bands: {audioMapping.numBands}</Text>
        {Platform.OS === 'web' ? (
          <input type="range" min={4} max={64} step={1} value={audioMapping.numBands} onChange={(e:any)=> setAudioMapping({ numBands: parseInt(e.target.value,10) })} />
        ) : (
          <TextInput value={String(audioMapping.numBands)} onChangeText={(v)=> setAudioMapping({ numBands: parseInt(v,10) || 16 })} style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6 }} />
        )}

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <Text style={{ color: 'white' }}>Normalize:</Text>
          {Platform.OS === 'web' ? (
            <input type="checkbox" checked={audioMapping.normalize} onChange={(e:any)=> setAudioMapping({ normalize: !!e.target.checked })} />
          ) : (
            <Button title={audioMapping.normalize ? 'On' : 'Off'} onPress={()=> setAudioMapping({ normalize: !audioMapping.normalize })} />
          )}
        </View>
      </ScrollView>
      </Panel>
    </View>
  );
};


