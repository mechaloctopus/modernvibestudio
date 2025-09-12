import React from 'react';
import { View, Text, Platform, TextInput, ScrollView, Button, Dimensions } from 'react-native';
import { useStore } from '../state/useStore';
import { Panel } from './Panel';
import { PRESET_SOURCES, PRESET_DEFAULTS } from '../visualizers/shaderlab/ShaderLab';

export const ShaderLabEditor: React.FC = () => {
  const { currentId, params, setParam } = useStore();
  if (currentId !== 'shaderlab') return null;
  const fragment = params.fragment ?? '';

  const setFrag = (val: string) => setParam('fragment_draft', val);
  const apply = () => {
    setParam('fragment', params.fragment_draft ?? params.fragment ?? '');
    setParam('preset', '');
  };
  const resetToCurrent = () => setParam('fragment_draft', params.fragment ?? '');

  // Simplified editor (no snippet examples).

  return (
    <View style={{ gap: 8 }}>
      <Panel title="ShaderLab — Presets" collapsed={false} onToggle={()=>{}}>
        {Platform.OS === 'web' ? (
          <select onChange={(e:any)=>{
            const key = e.target.value;
            if (!key) return;
            setParam('fragment', (PRESET_SOURCES as any)[key]);
            const defs = (PRESET_DEFAULTS as any)[key];
            if (defs) Object.keys(defs).forEach((k)=> setParam(k, defs[k]));
          }} defaultValue="">
            <option value="" disabled>(choose a preset)</option>
            {Object.keys(PRESET_SOURCES).map((key)=> (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
        ) : (
          <View>
            <Text style={{ color: 'white', marginBottom: 6 }}>Choose a preset:</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Object.keys(PRESET_SOURCES).map((key)=> (
                <Button key={key} title={key} onPress={()=>{
                  setParam('fragment', (PRESET_SOURCES as any)[key]);
                  const defs = (PRESET_DEFAULTS as any)[key];
                  if (defs) Object.keys(defs).forEach((k)=> setParam(k, defs[k]));
                }} />
              ))}
            </View>
          </View>
        )}
      </Panel>
      <Panel title="ShaderLab — Quick Editor" collapsed={false} onToggle={()=>{}}>
        <View style={{ gap: 8 }}>
          <Text style={{ color: 'white' }}>Fragment (GLSL body setting vec3 col):</Text>
          <TextInput multiline value={params.fragment_draft ?? fragment}
            onChangeText={setFrag}
            placeholder="Write GLSL here"
            style={{ minHeight: 140, color: 'white', borderWidth: 1, borderColor: '#333', padding: 8 }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Apply" onPress={apply} />
            <Button title="Reset draft" onPress={resetToCurrent} />
          </View>
        </View>
      </Panel>

    </View>
  );
};


