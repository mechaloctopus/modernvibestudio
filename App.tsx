import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Platform, Pressable } from 'react-native';
import React from 'react';
function useKeyboardShortcuts() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      const s = require('./src/state/useStore').useStore.getState();
      if (e.key === 'Escape' && s.fullscreen) { s.setFullscreen(false); return; }
      if (e.key === 'ArrowRight' && (e.metaKey || e.ctrlKey)) s.nextVisualizer();
      else if (e.key === 'ArrowLeft' && (e.metaKey || e.ctrlKey)) s.prevVisualizer();
      else if (e.key === ']' && (e.metaKey || e.ctrlKey)) s.nextPreset();
      else if (e.key === '[' && (e.metaKey || e.ctrlKey)) s.prevPreset();
      else if (e.key.toLowerCase() === 'l') s.setShowLibrary(!s.showLibrary);
      else if (e.key.toLowerCase() === 'i') s.setShowInspector(!s.showInspector);
      else if (e.key.toLowerCase() === 'h') s.setShowHud(!s.showHud);
      else if (e.key.toLowerCase() === 'b') s.setShowBandsOverlay(!s.showBandsOverlay);
    };
    window.addEventListener('keydown', handler as any);
    return () => window.removeEventListener('keydown', handler as any);
  }, []);
}
import { audioEngine } from './src/audio/AudioEngine';
import { useStore } from './src/state/useStore';
import type { FeatureFrame } from './src/core/types';
import { Hud } from './src/ui/Hud';
import { BandsOverlay } from './src/ui/BandsOverlay';
import { PanelsMenu } from './src/ui/PanelsMenu';
import { CommandBar } from './src/ui/CommandBar';
import { QuickControls } from './src/ui/QuickControls';
import { Inspector } from './src/ui/Inspector';
import { LibraryDrawer } from './src/ui/LibraryDrawer';
// removed ShaderLab bottom overlay
import { applySpectrumMapping, applyRoutes } from './src/core/mapping';
import { PanelManager } from './src/ui/PanelManager';
 

export default function App() {
  const { visualizers, currentId, setVisualizer, params, audioSensitivity, rmsSmoothing, inputMode, showBandsOverlay, showHud, toneColorEnabled, toneColorKeyOffset, toneColorSaturation, toneColorLightness, toneColorMap, audioMapping, routes, themeBrightness, themeSaturation, setShowShaderLabUi, showHamburger, setShowHamburger, openPanel, fullscreen, setFullscreen } = useStore();
  const current = visualizers.find((v) => v.id === currentId)!;
  const [frame, setFrame] = React.useState<FeatureFrame | null>(null);

  React.useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        await audioEngine.start();
        unsub = audioEngine.onFrame(setFrame);
      } catch (e) {
        console.warn('Audio start failed', e);
      }
    })();
    return () => {
      unsub();
      audioEngine.stop();
    };
  }, []);

  React.useEffect(() => {
    audioEngine.setSensitivity(audioSensitivity);
  }, [audioSensitivity]);

  React.useEffect(() => {
    audioEngine.setRmsSmoothing(rmsSmoothing);
  }, [rmsSmoothing]);

  React.useEffect(() => {
    audioEngine.stop();
    audioEngine.setInputMode(inputMode);
    audioEngine.start().then(() => {
      // no-op
    }).catch((e)=> console.warn('Audio restart failed', e));
  }, [inputMode]);

  const Visual = current.Component;
  const mappedBands = React.useMemo(() => applySpectrumMapping(frame?.spectrum, frame?.sampleRateHz, audioMapping), [frame?.spectrum, frame?.sampleRateHz, audioMapping]);
  useKeyboardShortcuts();

  // True browser fullscreen when toggled
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const doc: any = document;
    const elem: any = document.documentElement;
    const isFs = !!doc.fullscreenElement || !!(doc as any).webkitFullscreenElement;
    const requestFs = () => (elem.requestFullscreen ? elem.requestFullscreen() : (elem as any).webkitRequestFullscreen?.());
    const exitFs = () => (doc.exitFullscreen ? doc.exitFullscreen() : (doc as any).webkitExitFullscreen?.());
    if (fullscreen && !isFs) {
      try { requestFs(); } catch {}
    } else if (!fullscreen && isFs) {
      try { exitFs(); } catch {}
    }
    // keep store in sync if user exits with ESC
    const onChange = () => {
      const now = !!doc.fullscreenElement || !!(doc as any).webkitFullscreenElement;
      if (!now && fullscreen) setFullscreen(false);
    };
    doc.addEventListener('fullscreenchange', onChange);
    return () => doc.removeEventListener('fullscreenchange', onChange);
  }, [fullscreen, setFullscreen]);

  return (
    <View style={styles.container}>
      {/* Header hidden in fullscreen */}
      {!fullscreen && (
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>ModernVibeStudio</Text>
            <Text style={styles.subtitle}>Audio‑Reactive Visual Lab{Platform.OS !== 'web' ? ' — Mobile mic soon; web mic works.' : ''}</Text>
          </View>
          <CommandBar />
        </View>
      )}
      {!fullscreen && (
        <View style={{ paddingHorizontal: 16 }}>
          <QuickControls />
        </View>
      )}
      <View style={styles.visual}>
        <Visual params={{
          ...applyRoutes(routes, currentId, params, {
            bands: new Float32Array(mappedBands),
            low: frame?.bandEnergies?.low ?? mappedBands[0] ?? 0,
            mid: frame?.bandEnergies?.mid ?? mappedBands[8] ?? 0,
            high: frame?.bandEnergies?.high ?? mappedBands[15] ?? 0,
            rms: frame?.amplitudeRms ?? 0,
            onset: frame?.onsetPercussive ? 1 : 0,
            centroid: frame?.spectralCentroidHz ?? 0,
            note: frame?.midiNote,
          }),
          _global: { toneColorEnabled, toneColorKeyOffset, toneColorSaturation, toneColorLightness, toneColorMap, audioMapping, mappedBands, themeBrightness, themeSaturation }
        }} frame={frame} />
      </View>
      {/* Overlays hidden in fullscreen */}
      {!fullscreen && showHud ? <Hud frame={frame} /> : null}
      {!fullscreen && <PanelsMenu />}
      {!fullscreen && <PanelManager frame={frame} />}
      {!fullscreen && showBandsOverlay ? <BandsOverlay frame={frame} /> : null}
      {!fullscreen && <StatusBar style="light" />}
      {!fullscreen && showHamburger ? (
        <View style={{ position: 'absolute', top: 80, left: 16, backgroundColor: 'rgba(0,0,0,0.7)', padding: 12, borderRadius: 8 }}>
          <Text style={{ color: 'white', fontWeight: 'bold', marginBottom: 8 }}>Menu</Text>
          <View style={{ gap: 8 }}>
            <Text style={{ color: '#9aa' }}>Visualizer</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {visualizers.map(v => (
                <Text key={v.id} style={{ color: v.id === currentId ? '#9fd' : '#fff', textDecorationLine: 'underline' }}
                  onPress={()=> { setVisualizer(v.id); setShowShaderLabUi(v.id === 'shaderlab'); setShowHamburger(false); }}>
                  {v.name}
                </Text>
              ))}
            </View>
            <Text style={{ color: '#9aa', marginTop: 6 }}>Open Panels</Text>
            <View style={{ gap: 6 }}>
              <Text style={{ color: '#fff' }} onPress={()=> { openPanel('params', 'Parameters'); setShowHamburger(false); }}>Parameters</Text>
              <Text style={{ color: '#fff' }} onPress={()=> { openPanel('routing', 'Routing'); setShowHamburger(false); }}>Routing</Text>
              <Text style={{ color: '#fff' }} onPress={()=> { openPanel('audio', 'Audio Devices & Mapping'); setShowHamburger(false); }}>Audio</Text>
              <Text style={{ color: '#fff' }} onPress={()=> { openPanel('tone', 'Tone Colors'); setShowHamburger(false); }}>Tone Colors</Text>
              <Text style={{ color: '#fff' }} onPress={()=> { openPanel('uniforms', 'Live Uniforms'); setShowHamburger(false); }}>Uniforms</Text>
              <Text style={{ color: '#fff' }} onPress={()=> { openPanel('shader', 'ShaderLab Editor'); setShowHamburger(false); }}>ShaderLab Editor</Text>
            </View>
          </View>
          <View style={{ marginTop: 10 }}>
            <Text style={{ color: '#9aa' }} onPress={()=> setShowHamburger(false)}>Close</Text>
          </View>
        </View>
      ) : null}

      {/* Fullscreen toggle button overlay */}
      {!fullscreen && (
        <Pressable onPress={()=> setFullscreen(true)} style={{ position: 'absolute', right: 16, bottom: 16, backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6 }}>
          <Text style={{ color: '#fff' }}>Fullscreen</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'stretch',
    justifyContent: 'stretch',
  },
  header: {
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  subtitle: { color: '#9aa', marginTop: 2 },
  visual: { flex: 1 },
  bottomDock: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    maxWidth: 520,
  },
  leftDrawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 320,
    zIndex: 10,
  },
  rightDock: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 380,
    zIndex: 10,
  },
});
