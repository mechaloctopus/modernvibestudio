import React from 'react';
import { View, Text, Platform } from 'react-native';
import { useStore } from '../state/useStore';
import { Panel } from './Panel';

export const SignalLabPanel: React.FC = () => {
  const {
    audioSensitivity, rmsSmoothing, audioMapping,
    advancedAnalysisEnabled, setAdvancedAnalysisEnabled,
    signalLab, setSignalLab, setSignalLabRouting,
    signalLabDirty, currentSignalLabPreset,
    listSignalLabPresets, saveSignalLabPreset, loadSignalLabPreset,
    renameSignalLabPreset, deleteSignalLabPreset,
  } = useStore();

  const selectedRef = React.useRef<string>('');


  return (
    <Panel title="Signal Lab" collapsed={false} onToggle={()=>{}}>
      <View style={{ gap: 8 }}>
        {/* Preset controls */}
        <Text style={{ color: '#9cf' }}>Presets</Text>
        {Platform.OS === 'web' ? (
          <>
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: '#ccc' }} title="Currently loaded Signal Lab preset (independent from sessions)">
                {currentSignalLabPreset ? `Preset: ${currentSignalLabPreset}` : 'Preset: (none)'}{signalLabDirty ? ' (modified)' : ''}
              </Text>
            </View>
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <select
                defaultValue={currentSignalLabPreset || ''}
                onChange={(e:any)=> { (selectedRef as any).current = e.target.value; }}
                title="Choose a saved Signal Lab preset to load"
              >
                <option value="">(select a preset)</option>
                {listSignalLabPresets().map((p)=> (
                  <option key={p.name} value={p.name} title={(p.description||'') + ` — ${new Date(p.createdAt).toLocaleString()}`}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button onClick={()=>{
                const sel = (selectedRef as any).current || currentSignalLabPreset;
                if (!sel) return;
                loadSignalLabPreset(sel);
              }}>Load</button>
              <button onClick={()=>{
                const name = prompt('Save Signal Lab as preset name:');
                if (!name) return;
                const desc = prompt('Optional description:') || undefined;
                saveSignalLabPreset(name, desc);
              }}>Save As</button>
              <button onClick={()=>{
                const sel = (selectedRef as any).current || currentSignalLabPreset;
                if (!sel) return;
                const n = prompt(`Rename preset "${sel}" to:`, sel);
                if (!n || n===sel) return;
                renameSignalLabPreset(sel, n);
                (selectedRef as any).current = n;
              }}>Rename</button>
              <button onClick={()=>{
                const sel = (selectedRef as any).current || currentSignalLabPreset;
                if (!sel) return;
                if (confirm(`Delete Signal Lab preset "${sel}"? This cannot be undone.`)) {
                  deleteSignalLabPreset(sel);
                  (selectedRef as any).current = '';
                }
              }}>Delete</button>
            </View>
          </>
        ) : (
          <Text style={{ color: '#888' }}>Preset management available on web UI</Text>
        )}
        <View style={{ height: 8 }} />

        <Text style={{ color: '#9cf' }} title="Master enable to apply envelopes, gating, and routing to uniforms">Enable</Text>
        <Text style={{ color: signalLab.enabled ? '#6f6' : '#ccc', textDecorationLine: 'underline' }} onPress={()=> setSignalLab({ enabled: !signalLab.enabled })}>
          {signalLab.enabled ? 'ON' : 'OFF'} — tap to toggle
        </Text>

        <Text style={{ color: '#9cf', marginTop: 6 }}>Analysis (Phase 2)</Text>
        <Text
          style={{ color: advancedAnalysisEnabled ? '#6f6' : '#ccc', textDecorationLine: 'underline' }}
          onPress={() => setAdvancedAnalysisEnabled(!advancedAnalysisEnabled)}
          title="Use enhanced polyphony, chord, resonance, HNR, dissonance"
        >
          Advanced Analysis {advancedAnalysisEnabled ? 'ON' : 'OFF'}
        </Text>

        <Text style={{ color: '#9cf', marginTop: 10 }}>Harmonic Analysis</Text>
        <Text style={{ color: 'white' }} title="Max harmonics considered for fundamental grouping (1–12)">maxHarmonics: {signalLab.harmonic.maxHarmonics}</Text>
        {Platform.OS === 'web' ? (
          <input type="range" min={1} max={12} value={signalLab.harmonic.maxHarmonics}
            onChange={(e:any)=> setSignalLab({ harmonic: { ...signalLab.harmonic, maxHarmonics: Number(e.target.value) } })} />
        ) : null}
        <Text style={{ color: 'white' }} title="Exponential closeness slope (20–120). Higher = stricter alignment">closenessSlope: {signalLab.harmonic.closenessSlope}</Text>
        {Platform.OS === 'web' ? (
          <input type="range" min={20} max={120} step={1} value={signalLab.harmonic.closenessSlope}
            onChange={(e:any)=> setSignalLab({ harmonic: { ...signalLab.harmonic, closenessSlope: Number(e.target.value) } })} />
        ) : null}
        <Text style={{ color: 'white' }} title="Neighbor bins to include when sampling harmonics for HNR (0–2)">hnrNeighborBins: {signalLab.harmonic.hnrNeighborBins}</Text>
        {Platform.OS === 'web' ? (
          <input type="range" min={0} max={2} step={1} value={signalLab.harmonic.hnrNeighborBins}
            onChange={(e:any)=> setSignalLab({ harmonic: { ...signalLab.harmonic, hnrNeighborBins: Number(e.target.value) } })} />
        ) : null}

        <Text style={{ color: '#9cf', marginTop: 10 }}>Chord Detection</Text>
        <Text style={{ color: 'white' }} title="Smoothing window for chord label (ms)">smoothingMs: {signalLab.chord.smoothingMs} ms</Text>
        {Platform.OS === 'web' ? (
          <input type="range" min={0} max={800} step={10} value={signalLab.chord.smoothingMs}
            onChange={(e:any)=> setSignalLab({ chord: { ...signalLab.chord, smoothingMs: Number(e.target.value) } })} />
        ) : null}
        <Text style={{ color: 'white' }} title="Minimum confidence required to show advanced chord">minConfidence: {signalLab.chord.minConfidence.toFixed(2)}</Text>
        {Platform.OS === 'web' ? (
          <input type="range" min={0} max={1} step={0.01} value={signalLab.chord.minConfidence}
            onChange={(e:any)=> setSignalLab({ chord: { ...signalLab.chord, minConfidence: Number(e.target.value) } })} />
        ) : null}

        <Text style={{ color: '#9cf', marginTop: 10 }}>Dissonance</Text>
        <Text style={{ color: 'white' }} title="Scale the roughness model strength (0–2)">strength: {signalLab.dissonance.strength.toFixed(2)}</Text>
        {Platform.OS === 'web' ? (
          <input type="range" min={0} max={2} step={0.05} value={signalLab.dissonance.strength}
            onChange={(e:any)=> setSignalLab({ dissonance: { ...signalLab.dissonance, strength: Number(e.target.value) } })} />
        ) : null}

        <Text style={{ color: '#9cf', marginTop: 10 }}>Envelopes (ms)</Text>
        <Text style={{ color: 'white' }} title="RMS attack/release">RMS A/R: {signalLab.envelopes.rms.attackMs} / {signalLab.envelopes.rms.releaseMs}</Text>
        {Platform.OS === 'web' ? (
          <>
            <input type="range" min={0} max={500} step={5} value={signalLab.envelopes.rms.attackMs}
              onChange={(e:any)=> setSignalLab({ envelopes: { ...signalLab.envelopes, rms: { ...signalLab.envelopes.rms, attackMs: Number(e.target.value) } } })} />
            <input type="range" min={0} max={1000} step={10} value={signalLab.envelopes.rms.releaseMs}
              onChange={(e:any)=> setSignalLab({ envelopes: { ...signalLab.envelopes, rms: { ...signalLab.envelopes.rms, releaseMs: Number(e.target.value) } } })} />
          </>
        ) : null}
        <Text style={{ color: 'white' }} title="Band energies attack/release">Bands A/R: {signalLab.envelopes.bands.attackMs} / {signalLab.envelopes.bands.releaseMs}</Text>
        {Platform.OS === 'web' ? (
          <>
            <input type="range" min={0} max={400} step={5} value={signalLab.envelopes.bands.attackMs}
              onChange={(e:any)=> setSignalLab({ envelopes: { ...signalLab.envelopes, bands: { ...signalLab.envelopes.bands, attackMs: Number(e.target.value) } } })} />
            <input type="range" min={0} max={1000} step={10} value={signalLab.envelopes.bands.releaseMs}
              onChange={(e:any)=> setSignalLab({ envelopes: { ...signalLab.envelopes, bands: { ...signalLab.envelopes.bands, releaseMs: Number(e.target.value) } } })} />
          </>
        ) : null}
        <Text style={{ color: 'white' }} title="Note amplitude attack/release">Note Amp A/R: {signalLab.envelopes.noteAmp.attackMs} / {signalLab.envelopes.noteAmp.releaseMs}</Text>
        {Platform.OS === 'web' ? (
          <>
            <input type="range" min={0} max={200} step={5} value={signalLab.envelopes.noteAmp.attackMs}
              onChange={(e:any)=> setSignalLab({ envelopes: { ...signalLab.envelopes, noteAmp: { ...signalLab.envelopes.noteAmp, attackMs: Number(e.target.value) } } })} />
            <input type="range" min={0} max={1000} step={10} value={signalLab.envelopes.noteAmp.releaseMs}
              onChange={(e:any)=> setSignalLab({ envelopes: { ...signalLab.envelopes, noteAmp: { ...signalLab.envelopes.noteAmp, releaseMs: Number(e.target.value) } } })} />
          </>
        ) : null}
        <Text style={{ color: 'white' }} title="Onset hold time; decays afterwards">Onset Hold: {signalLab.envelopes.onsetHoldMs} ms</Text>
        {Platform.OS === 'web' ? (
          <input type="range" min={0} max={500} step={10} value={signalLab.envelopes.onsetHoldMs}
            onChange={(e:any)=> setSignalLab({ envelopes: { ...signalLab.envelopes, onsetHoldMs: Number(e.target.value) } })} />
        ) : null}

        <Text style={{ color: '#9cf', marginTop: 10 }}>Note Gating</Text>
        <Text style={{ color: signalLab.gating.enableNoteGating ? '#6f6' : '#ccc', textDecorationLine: 'underline' }} onPress={()=> setSignalLab({ gating: { ...signalLab.gating, enableNoteGating: !signalLab.gating.enableNoteGating } })} title="Suppress low-confidence or weak notes">
          Gating: {signalLab.gating.enableNoteGating ? 'ON' : 'OFF'}
        </Text>
        <Text style={{ color: 'white' }} title="Minimum per-note confidence">minConf: {signalLab.gating.noteMinConfidence.toFixed(2)}</Text>
        {Platform.OS === 'web' ? (
          <input type="range" min={0} max={1} step={0.01} value={signalLab.gating.noteMinConfidence}
            onChange={(e:any)=> setSignalLab({ gating: { ...signalLab.gating, noteMinConfidence: Number(e.target.value) } })} />
        ) : null}
        <Text style={{ color: 'white' }} title="Minimum raw amplitude">minAmp: {signalLab.gating.noteMinAmp.toFixed(2)}</Text>
        {Platform.OS === 'web' ? (
          <input type="range" min={0} max={0.2} step={0.005} value={signalLab.gating.noteMinAmp}
            onChange={(e:any)=> setSignalLab({ gating: { ...signalLab.gating, noteMinAmp: Number(e.target.value) } })} />
        ) : null}

        <Text style={{ color: '#9cf', marginTop: 10 }}>Uniform Routing</Text>
        {Platform.OS === 'web' ? (
          <>
            {['u_amp','u_low','u_mid','u_high','u_onset','u_centroid','u_note'].map((k)=> (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: 'white', width: 84 }}>{k}</Text>
                <select value={signalLab.routing[k] || ''} onChange={(e:any)=> setSignalLabRouting(k, e.target.value || undefined)} title="Pick which processed source feeds this uniform">
                  <option value="">(default)</option>
                  <option value="rms">rms</option>
                  <option value="low">low</option>
                  <option value="mid">mid</option>
                  <option value="high">high</option>
                  <option value="onset">onset</option>
                  <option value="centroid">centroid</option>
                  <option value="note">note</option>
                  {Array.from({ length: 16 }, (_, i)=> <option key={i} value={`band:${i}`}>band:{i}</option>)}
                </select>
              </View>
            ))}
          </>
        ) : (
          <Text style={{ color: '#888' }}>Routing available on web UI</Text>
        )}

        <View style={{ height: 8 }} />
        <Text style={{ color: '#9cf' }}>Current Inputs (read-only)</Text>
        <Text style={{ color: 'white' }}>Mic Sensitivity: {audioSensitivity.toFixed(2)}</Text>
        <Text style={{ color: 'white' }}>RMS Smoothing: {rmsSmoothing.toFixed(2)}</Text>
        <Text style={{ color: 'white' }}>Mapping: {audioMapping.scale} / {audioMapping.magnitudeMode}</Text>
        <Text style={{ color: 'white' }}>Range: {audioMapping.lowHz}–{audioMapping.highHz} Hz | Bands: {audioMapping.numBands} | Norm: {audioMapping.normalize ? 'Yes' : 'No'}</Text>
        {Platform.OS === 'web' ? (
          <Text style={{ color: '#777', fontSize: 12 }}>Tip: Exit fullscreen to adjust panels.</Text>
        ) : null}
      </View>
    </Panel>
  );
};

