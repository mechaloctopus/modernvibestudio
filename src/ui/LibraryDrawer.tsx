import React from 'react';
import { View, Text, Button, ScrollView } from 'react-native';
import { useStore } from '../state/useStore';
import { PresetBrowser } from './PresetBrowser';

export const LibraryDrawer: React.FC = () => {
  const { visualizers, currentId, setVisualizer, presets, savePreset, loadPreset, deletePreset, saveScene, loadScene, deleteScene, showLibrary } = useStore();
  const { setShowShaderLabUi } = useStore.getState();
  const viz = visualizers.find(v=> v.id === currentId)!;
  const vizPresets = presets[viz.id] || {};
  React.useEffect(()=>{
    if (showLibrary && viz.id === 'shaderlab') setShowShaderLabUi(false);
  }, [showLibrary, viz.id]);
  return (
    <View style={{ width: 320, backgroundColor: 'rgba(0,0,0,0.35)', borderRightWidth: 1, borderColor: '#222', height: '100%' }}>
      <ScrollView style={{ padding: 8 }}>
        <Text style={{ color: 'white', fontWeight: 'bold', marginBottom: 6 }}>Visualizers</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {visualizers.map(v=> (
            <Button key={v.id} title={v.name} onPress={()=> { setVisualizer(v.id); setShowShaderLabUi(v.id === 'shaderlab'); }} />
          ))}
        </View>
        {viz.id === 'shaderlab' ? null : null}
        <Text style={{ color: 'white', fontWeight: 'bold', marginBottom: 6 }}>Presets ({viz.name})</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <Button title="Save" onPress={() => {
            try {
              const name = typeof prompt !== 'undefined' ? prompt('Preset name?') : undefined;
              if (name) savePreset(name);
            } catch {}
          }} />
        </View>
        <PresetBrowser />
        <Text style={{ color: 'white', fontWeight: 'bold', marginBottom: 6 }}>Scenes</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <Button title="Save Scene" onPress={() => {
            const name = typeof prompt !== 'undefined' ? prompt('Scene name?') : undefined;
            if (name) saveScene(name);
          }} />
          <Button title="Load Scene" onPress={() => {
            const name = typeof prompt !== 'undefined' ? prompt('Load scene by name') : undefined;
            if (name) loadScene(name);
          }} />
          <Button title="Delete Scene" onPress={() => {
            const name = typeof prompt !== 'undefined' ? prompt('Delete scene by name') : undefined;
            if (name) deleteScene(name);
          }} />
        </View>
      </ScrollView>
    </View>
  );
};


