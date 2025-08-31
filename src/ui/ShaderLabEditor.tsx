import React from 'react';
import { View, Text, Platform, TextInput, ScrollView, Button } from 'react-native';
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

  const examples = [
    {
      name: 'Audio stripes',
      code: 'float v = step(0.5, fract(uv.x*20.0 + u_time*4.0 + band(0)*8.0));\ncol = mix(vec3(0.05), vec3(0.9,0.6,0.2), v);',
    },
    {
      name: 'Highs glow',
      code: 'float g = smoothstep(0.6, 1.0, u_high);\ncol += vec3(0.1,0.2,0.6) * g;',
    },
    {
      name: 'Onset flash',
      code: 'col += vec3(u_onset) * 0.6;',
    },
  ];

  return (
    <View style={{ gap: 8 }}>
      <Panel title="ShaderLab — Presets" collapsed={false} onToggle={()=>{}}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {Object.keys(PRESET_SOURCES).map((key)=> (
            <Button key={key} title={key} onPress={()=>{
              setParam('fragment', (PRESET_SOURCES as any)[key]);
              const defs = (PRESET_DEFAULTS as any)[key];
              if (defs) Object.keys(defs).forEach((k)=> setParam(k, defs[k]));
            }} />
          ))}
        </View>
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
      <Panel title="Snippets" collapsed={false} onToggle={()=>{}}>
        <ScrollView horizontal style={{ maxHeight: 120 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {examples.map(ex => (
              <View key={ex.name} style={{ padding: 8, borderWidth: 1, borderColor: '#333' }}>
                <Text style={{ color: '#9fd', marginBottom: 6 }}>{ex.name}</Text>
                <Button title="Insert" onPress={()=> setFrag(((params.fragment_draft ?? fragment) + "\n" + ex.code))} />
              </View>
            ))}
          </View>
        </ScrollView>
      </Panel>
    </View>
  );
};


