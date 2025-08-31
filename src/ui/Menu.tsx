import React from 'react';
import { View, Text, Button, Platform, TextInput, ScrollView } from 'react-native';
import { useStore } from '../state/useStore';
import { Panel } from './Panel';
import { midiToNoteName } from '../core/color';

export const Menu: React.FC = () => {
  const { visualizers, currentId, setVisualizer, params, setParam, presets, savePreset, loadPreset, deletePreset, exportConfig, importConfig, saveScene, loadScene, deleteScene } = useStore();
  const current = visualizers.find((v) => v.id === currentId)!;

  return (
    <View>
      <Panel title={`Menu — ${current.name}`} collapsed={useStore.getState().collapsed.menu} onToggle={()=> useStore.getState().setCollapsed({ menu: !useStore.getState().collapsed.menu })}>
      {/* Visualizer switch and input/meters moved to Library/Inspector */}
      <ScrollView style={{ maxHeight: 320 }}>
        <View style={{ marginVertical: 8, padding: 8, borderColor: '#222', borderWidth: 1, borderRadius: 8 }}>
          <Text style={{ color: 'white', fontWeight: 'bold', marginBottom: 6 }}>Tone → Color</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ color: 'white' }}>Enabled:</Text>
            {Platform.OS === 'web' ? (
              <input type="checkbox" checked={useStore.getState().toneColorEnabled} onChange={(e:any)=> useStore.getState().setToneColor({ toneColorEnabled: !!e.target.checked })} />
            ) : (
              <Button title={useStore.getState().toneColorEnabled ? 'On' : 'Off'} onPress={()=> useStore.getState().setToneColor({ toneColorEnabled: !useStore.getState().toneColorEnabled })} />
            )}
          </View>
          <Text style={{ color: 'white' }}>Key Offset (semitones): {useStore.getState().toneColorKeyOffset}</Text>
          {Platform.OS === 'web' ? (
            <input type="range" min={-6} max={6} step={1} value={useStore.getState().toneColorKeyOffset} onChange={(e:any)=> useStore.getState().setToneColor({ toneColorKeyOffset: parseInt(e.target.value,10) })} />
          ) : (
            <TextInput value={String(useStore.getState().toneColorKeyOffset)} onChangeText={(v)=> useStore.getState().setToneColor({ toneColorKeyOffset: parseInt(v,10) || 0 })} style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, marginTop: 6 }} />
          )}
          <Text style={{ color: 'white' }}>Saturation: {useStore.getState().toneColorSaturation.toFixed(2)}</Text>
          {Platform.OS === 'web' ? (
            <input type="range" min={0} max={1} step={0.01} value={useStore.getState().toneColorSaturation} onChange={(e:any)=> useStore.getState().setToneColor({ toneColorSaturation: parseFloat(e.target.value) })} />
          ) : (
            <TextInput value={String(useStore.getState().toneColorSaturation)} onChangeText={(v)=> useStore.getState().setToneColor({ toneColorSaturation: Number(v) || 0 })} style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, marginTop: 6 }} />
          )}
          <Text style={{ color: 'white' }}>Lightness: {useStore.getState().toneColorLightness.toFixed(2)}</Text>
          {Platform.OS === 'web' ? (
            <input type="range" min={0} max={1} step={0.01} value={useStore.getState().toneColorLightness} onChange={(e:any)=> useStore.getState().setToneColor({ toneColorLightness: parseFloat(e.target.value) })} />
          ) : (
            <TextInput value={String(useStore.getState().toneColorLightness)} onChangeText={(v)=> useStore.getState().setToneColor({ toneColorLightness: Number(v) || 0 })} style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, marginTop: 6 }} />
          )}
        </View>
      {Object.entries(current.schema).map(([key, meta]) => {
        // Optional: show a simple group header when group changes
        const group = (meta as any).group as string | undefined;
        // Render a header row before grouped controls (web only simple style)
        // Lightweight: we don't track previous group; just render a label row for grouped fields
        if (group) {
          return (
            <View key={`group-${key}`} style={{ marginTop: 12 }}>
              <Text style={{ color: '#9fd', fontWeight: 'bold', marginBottom: 4 }}>{group}</Text>
              {/* Render the control below */}
              {(() => {
                if (meta.type === 'number') {
                  const value = params[key] ?? meta.default;
                  return (
                    <View key={key} style={{ marginVertical: 8 }}>
                      <Text style={{ color: 'white' }}>{key}: {typeof value === 'number' ? value.toFixed(2) : String(value)}</Text>
                      {Platform.OS === 'web' ? (
                        <input type="range"
                               min={meta.min}
                               max={meta.max}
                               step={meta.step}
                               value={value}
                               onChange={(e:any)=> setParam(key, parseFloat(e.target.value))}
                               style={{ width: '100%' }} />
                      ) : (
                        <TextInput
                          value={String(value)}
                          onChangeText={(txt)=> {
                            const n = Number(txt);
                            if (!Number.isNaN(n)) setParam(key, n);
                          }}
                          keyboardType="numeric"
                          style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, marginTop: 6 }}
                        />
                      )}
                    </View>
                  );
                }
                if (meta.type === 'boolean') {
                  const value = params[key] ?? meta.default;
                  return (
                    <View key={key} style={{ marginVertical: 8 }}>
                      <Text style={{ color: 'white' }}>{key}: {String(value)}</Text>
                      {Platform.OS === 'web' ? (
                        <input type="checkbox" checked={!!value} onChange={(e:any)=> setParam(key, !!e.target.checked)} />
                      ) : (
                        <Button title={value ? 'On' : 'Off'} onPress={() => setParam(key, !value)} />
                      )}
                    </View>
                  );
                }
                if (meta.type === 'select' && meta.options) {
                  const value = params[key] ?? meta.default;
                  return (
                    <View key={key} style={{ marginVertical: 8 }}>
                      <Text style={{ color: 'white' }}>{key}</Text>
                      {Platform.OS === 'web' ? (
                        <select value={value} onChange={(e:any)=> setParam(key, e.target.value)}>
                          {meta.options.map((opt)=> <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <TextInput value={String(value)} onChangeText={(v)=> setParam(key, v)} style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, marginTop: 6 }} />
                      )}
                    </View>
                  );
                }
                if (meta.type === 'string') {
                  const value = params[key] ?? (meta.default ?? '');
                  return (
                    <View key={key} style={{ marginVertical: 8 }}>
                      <Text style={{ color: 'white' }}>{key}</Text>
                      {Platform.OS === 'web' ? (
                        meta.multiline ? (
                          <textarea value={value} onChange={(e:any)=> setParam(key, e.target.value)} style={{ width: '100%', minHeight: 120, background: 'transparent', color: 'white', border: '1px solid #333', padding: 6 }} />
                        ) : (
                          <input type="text" value={value} onChange={(e:any)=> setParam(key, e.target.value)} style={{ width: '100%' }} />
                        )
                      ) : (
                        <TextInput value={value} onChangeText={(v)=> setParam(key, v)} multiline={!!meta.multiline} style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, marginTop: 6, minHeight: meta.multiline ? 120 : undefined }} />
                      )}
                    </View>
                  );
                }
                if (meta.type === 'color') {
                  const value = params[key] ?? meta.default;
                  const toHex = (c:number)=> {
                    const v = Math.max(0, Math.min(255, Math.round(c * (c <= 1 ? 255 : 1))));
                    return v.toString(16).padStart(2, '0');
                  };
                  const hex = typeof value === 'object' && value ? `#${toHex(value.r*255)}${toHex(value.g*255)}${toHex(value.b*255)}` : '#ffffff';
                  return (
                    <View key={key} style={{ marginVertical: 8 }}>
                      <Text style={{ color: 'white' }}>{key}</Text>
                      {Platform.OS === 'web' ? (
                        <input type="color" value={hex}
                          onChange={(e:any)=>{
                            const h = e.target.value as string; // #rrggbb
                            const r = parseInt(h.slice(1,3),16) / 255;
                            const g = parseInt(h.slice(3,5),16) / 255;
                            const b = parseInt(h.slice(5,7),16) / 255;
                            setParam(key, { r, g, b });
                          }} />
                      ) : (
                        <TextInput value={hex}
                          onChangeText={(h)=>{
                            if (/^#[0-9a-fA-F]{6}$/.test(h)){
                              const r = parseInt(h.slice(1,3),16) / 255;
                              const g = parseInt(h.slice(3,5),16) / 255;
                              const b = parseInt(h.slice(5,7),16) / 255;
                              setParam(key, { r, g, b });
                            }
                          }}
                          style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, marginTop: 6 }} />
                      )}
                    </View>
                  );
                }
                return null;
              })()}
            </View>
          );
        }
        if (meta.type === 'number') {
          const value = params[key] ?? meta.default;
          return (
            <View key={key} style={{ marginVertical: 8 }}>
              <Text style={{ color: 'white' }}>{key}: {typeof value === 'number' ? value.toFixed(2) : String(value)}</Text>
              {meta.description ? (<Text style={{ color: '#aaa', marginTop: 2 }}>{meta.description}</Text>) : null}
              {Platform.OS === 'web' ? (
                <input type="range"
                       min={meta.min}
                       max={meta.max}
                       step={meta.step}
                       value={value}
                       onChange={(e:any)=> setParam(key, parseFloat(e.target.value))}
                       style={{ width: '100%' }} />
              ) : (
                <TextInput
                  value={String(value)}
                  onChangeText={(txt)=> {
                    const n = Number(txt);
                    if (!Number.isNaN(n)) setParam(key, n);
                  }}
                  keyboardType="numeric"
                  style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, marginTop: 6 }}
                />
              )}
            </View>
          );
        }
        if (meta.type === 'color') {
          const value = params[key] ?? meta.default;
          const toHex = (c:number)=> {
            const v = Math.max(0, Math.min(255, Math.round(c * (c <= 1 ? 255 : 1))));
            return v.toString(16).padStart(2, '0');
          };
          const hex = typeof value === 'object' && value ? `#${toHex(value.r*255)}${toHex(value.g*255)}${toHex(value.b*255)}` : '#ffffff';
          return (
            <View key={key} style={{ marginVertical: 8 }}>
              <Text style={{ color: 'white' }}>{key}</Text>
              {meta.description ? (<Text style={{ color: '#aaa', marginTop: 2 }}>{meta.description}</Text>) : null}
              {Platform.OS === 'web' ? (
                <input type="color" value={hex}
                  onChange={(e:any)=>{
                    const h = e.target.value as string; // #rrggbb
                    const r = parseInt(h.slice(1,3),16) / 255;
                    const g = parseInt(h.slice(3,5),16) / 255;
                    const b = parseInt(h.slice(5,7),16) / 255;
                    setParam(key, { r, g, b });
                  }} />
              ) : (
                <TextInput value={hex}
                  onChangeText={(h)=>{
                    if (/^#[0-9a-fA-F]{6}$/.test(h)){
                      const r = parseInt(h.slice(1,3),16) / 255;
                      const g = parseInt(h.slice(3,5),16) / 255;
                      const b = parseInt(h.slice(5,7),16) / 255;
                      setParam(key, { r, g, b });
                    }
                  }}
                  style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, marginTop: 6 }} />
              )}
            </View>
          );
        }
        if (meta.type === 'boolean') {
          const value = params[key] ?? meta.default;
          return (
            <View key={key} style={{ marginVertical: 8 }}>
              <Text style={{ color: 'white' }}>{key}: {String(value)}</Text>
              {meta.description ? (<Text style={{ color: '#aaa', marginTop: 2 }}>{meta.description}</Text>) : null}
              {Platform.OS === 'web' ? (
                <input type="checkbox" checked={!!value} onChange={(e:any)=> setParam(key, !!e.target.checked)} />
              ) : (
                <Button title={value ? 'On' : 'Off'} onPress={() => setParam(key, !value)} />
              )}
            </View>
          );
        }
        if (meta.type === 'select' && meta.options) {
          const value = params[key] ?? meta.default;
          return (
            <View key={key} style={{ marginVertical: 8 }}>
              <Text style={{ color: 'white' }}>{key}</Text>
              {meta.description ? (<Text style={{ color: '#aaa', marginTop: 2 }}>{meta.description}</Text>) : null}
              {Platform.OS === 'web' ? (
                <select value={value} onChange={(e:any)=> setParam(key, e.target.value)}>
                  {meta.options.map((opt)=> <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <TextInput value={String(value)} onChangeText={(v)=> setParam(key, v)} style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, marginTop: 6 }} />
              )}
            </View>
          );
        }
        if (meta.type === 'string') {
          const value = params[key] ?? (meta.default ?? '');
          return (
            <View key={key} style={{ marginVertical: 8 }}>
              <Text style={{ color: 'white' }}>{key}</Text>
              {meta.description ? (<Text style={{ color: '#aaa', marginTop: 2 }}>{meta.description}</Text>) : null}
              {Platform.OS === 'web' ? (
                meta.multiline ? (
                  <textarea value={value} onChange={(e:any)=> setParam(key, e.target.value)} style={{ width: '100%', minHeight: 120, background: 'transparent', color: 'white', border: '1px solid #333', padding: 6 }} />
                ) : (
                  <input type="text" value={value} onChange={(e:any)=> setParam(key, e.target.value)} style={{ width: '100%' }} />
                )
              ) : (
                <TextInput value={value} onChangeText={(v)=> setParam(key, v)} multiline={!!meta.multiline} style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, marginTop: 6, minHeight: meta.multiline ? 120 : undefined }} />
              )}
            </View>
          );
        }
        return null;
      })}
      </ScrollView>
      <View style={{ marginTop: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={{ color: 'white', fontWeight: 'bold' }}>Presets</Text>
        <Button title="Save" onPress={() => {
          if (Platform.OS === 'web') {
            const name = typeof prompt !== 'undefined' ? prompt('Preset name?') : undefined;
            if (name) savePreset(name);
          } else {
            const name = 'Preset ' + new Date().toLocaleTimeString();
            savePreset(name);
          }
        }} />
        <Button title="Load" onPress={() => {
          const v = presets[current.id] || {};
          const keys = Object.keys(v);
          if (Platform.OS === 'web') {
            const name = typeof prompt !== 'undefined' ? prompt('Load preset name?', keys[0] || '') : undefined;
            if (name) loadPreset(name);
          } else if (keys[0]) {
            loadPreset(keys[0]);
          }
        }} />
        <Button title="Delete" onPress={() => {
          const v = presets[current.id] || {};
          const keys = Object.keys(v);
          if (Platform.OS === 'web') {
            const name = typeof prompt !== 'undefined' ? prompt('Delete preset name?', keys[0] || '') : undefined;
            if (name) deletePreset(name);
          } else if (keys[0]) {
            deletePreset(keys[0]);
          }
        }} />
        <Button title="Export Config" onPress={() => {
          const json = exportConfig();
          if (typeof navigator !== 'undefined' && (navigator as any).clipboard) {
            (navigator as any).clipboard.writeText(json);
            alert('Config copied to clipboard');
          } else {
            alert(json);
          }
        }} />
        <Button title="Import Config" onPress={() => {
          if (Platform.OS === 'web') {
            const json = typeof prompt !== 'undefined' ? prompt('Paste config JSON') : undefined;
            if (json) importConfig(json);
          }
        }} />
        <Button title="Save Scene" onPress={() => {
          if (Platform.OS === 'web') {
            const name = typeof prompt !== 'undefined' ? prompt('Scene name?') : undefined;
            if (name) saveScene(name);
          } else {
            const name = 'Scene ' + new Date().toLocaleTimeString();
            saveScene(name);
          }
        }} />
        <Button title="Load Scene" onPress={() => {
          if (Platform.OS === 'web') {
            const name = typeof prompt !== 'undefined' ? prompt('Load scene by name') : undefined;
            if (name) loadScene(name);
          }
        }} />
        <Button title="Delete Scene" onPress={() => {
          if (Platform.OS === 'web') {
            const name = typeof prompt !== 'undefined' ? prompt('Delete scene by name') : undefined;
            if (name) deleteScene(name);
          }
        }} />
      </View>
      </Panel>
    </View>
  );
};


