import React from 'react';
import { View, Text, Button, ScrollView, Platform, TextInput } from 'react-native';
import { useStore } from '../state/useStore';
import { Panel } from './Panel';
import { PRESET_SOURCES, PRESET_DEFAULTS, PRESET_HELP } from '../visualizers/shaderlab/ShaderLab';
import { RoutingPanel } from './RoutingPanel';
import { AudioMappingPanel } from './AudioMappingPanel';
import { ToneColorPanel } from './ToneColorPanel';
import { LiveUniforms } from './LiveUniforms';
import type { FeatureFrame } from '../core/types';

export const Inspector: React.FC<{ frame: FeatureFrame | null }>= ({ frame }) => {
  const { activeInspectorTab, setActiveInspectorTab, currentId } = useStore();
  const baseTabs: Array<'Params'|'Routing'|'Audio'|'Tone'|'Uniforms'> = ['Params','Routing','Audio','Tone','Uniforms'];
  const tabs = baseTabs as const;
  return (
    <View style={{ width: 380, backgroundColor: 'rgba(0,0,0,0.35)', borderLeftWidth: 1, borderColor: '#222' }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ padding: 8, borderBottomWidth: 1, borderColor: '#222' }} contentContainerStyle={{ flexDirection: 'row', gap: 4 }}>
        {tabs.map((t:any)=> (
          <Button key={t} title={t} onPress={()=> setActiveInspectorTab(t)} />
        ))}
      </ScrollView>
      <View style={{ padding: 8 }}>
        {activeInspectorTab === 'Params' ? (
          <ParamsTab />
        ) : activeInspectorTab === 'Routing' ? (
          <RoutingPanel frame={frame} />
        ) : activeInspectorTab === 'Audio' ? (
          <AudioMappingPanel frame={frame} />
        ) : activeInspectorTab === 'Tone' ? (
          <ToneColorPanel />
        ) : (
          <LiveUniforms frame={frame} collapsed={useStore.getState().collapsed.uniforms} onToggle={()=> useStore.getState().setCollapsed({ uniforms: !useStore.getState().collapsed.uniforms })} />
        )}
      </View>
    </View>
  );
};

const ParamsTab: React.FC = () => {
  const { visualizers, currentId, setVisualizer, params, setParam, pinParam, unpinParam, pinnedParams } = useStore();
  const current = visualizers.find((v) => v.id === currentId)!;
  return (
    <View>
      <Panel title={`Params — ${current.name}`} collapsed={useStore.getState().collapsed.menu} onToggle={()=> useStore.getState().setCollapsed({ menu: !useStore.getState().collapsed.menu })}>
        <ScrollView style={{ maxHeight: 520 }}>
          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: 'white', marginBottom: 4 }}>Visualizer</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {visualizers.map((v) => (
                <Button key={v.id} title={v.name} onPress={() => setVisualizer(v.id)} />
              ))}
            </View>
          </View>
          {(() => {
            // Filter ShaderLab params by active preset using meta.presets
            const preset = current.id === 'shaderlab' ? (useStore.getState().params?.preset || '') : '';
            const entries = Object.entries(current.schema).filter(([key, meta]: any) => {
              if (current.id === 'shaderlab' && Array.isArray(meta.presets) && meta.presets.length > 0) {
                return meta.presets.includes(preset);
              }
              return true;
            });
            return groupByEntries(entries);
          })().map(([groupName, items])=> {
            const isCollapsed = !!useStore.getState().groupCollapsed[currentId]?.[groupName];
            return (
              <View key={groupName} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#9fd', fontWeight: 'bold', marginBottom: 4 }}>{groupName}</Text>
                  <Button title={isCollapsed ? 'Expand' : 'Collapse'} onPress={()=> useStore.getState().toggleGroupCollapsed(currentId, groupName)} />
                </View>
                {isCollapsed ? null : items.map(([key, meta]: any)=> (
                  <View key={key} style={{ marginVertical: 8 }}>
                    {(() => {
                      if (meta.type === 'number') {
                        const value = params[key] ?? meta.default;
                        return (
                          <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Text style={{ color: 'white' }}>{key}: {typeof value === 'number' ? value.toFixed(2) : String(value)}</Text>
                              {Array.isArray(pinnedParams[currentId]) && pinnedParams[currentId].includes(key) ? (
                                <Button title="Unpin" onPress={()=> unpinParam(currentId, key)} />
                              ) : (
                                <Button title="Pin" onPress={()=> pinParam(currentId, key)} />
                              )}
                            </View>
                            <input type="range" min={meta.min} max={meta.max} step={meta.step} value={value} onChange={(e:any)=> setParam(key, parseFloat(e.target.value))} style={{ width: '100%' }} />
                          </View>
                        );
                      }
                      if (meta.type === 'boolean') {
                        const value = params[key] ?? meta.default;
                        return (
                          <View>
                            <Text style={{ color: 'white' }}>{key}: {String(value)}</Text>
                            <input type="checkbox" checked={!!value} onChange={(e:any)=> setParam(key, !!e.target.checked)} />
                          </View>
                        );
                      }
                      if (meta.type === 'select' && meta.options) {
                        const value = params[key] ?? meta.default;
                        return (
                          <View>
                            <Text style={{ color: 'white' }}>{key}</Text>
                            <select value={value} onChange={(e:any)=> setParam(key, e.target.value)}>
                              {meta.options.map((opt:any)=> <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </View>
                        );
                      }
                      if (meta.type === 'string') {
                        const value = params[key] ?? (meta.default ?? '');
                        return (
                          <View>
                            <Text style={{ color: 'white' }}>{key}</Text>
                            {(meta as any).multiline ? (
                              <textarea value={value} onChange={(e:any)=> setParam(key, e.target.value)} style={{ width: '100%', minHeight: 120, background: 'transparent', color: 'white', border: '1px solid #333', padding: 6 }} />
                            ) : (
                              <input type="text" value={value} onChange={(e:any)=> setParam(key, e.target.value)} style={{ width: '100%' }} />
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
                          <View>
                            <Text style={{ color: 'white' }}>{key}</Text>
                            <input type="color" value={hex}
                              onChange={(e:any)=>{
                                const h = e.target.value as string; // #rrggbb
                                const r = parseInt(h.slice(1,3),16) / 255;
                                const g = parseInt(h.slice(3,5),16) / 255;
                                const b = parseInt(h.slice(5,7),16) / 255;
                                setParam(key, { r, g, b });
                              }} />
                          </View>
                        );
                      }
                      return null;
                    })()}
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>
      </Panel>
    </View>
  );
};


function groupByEntries(entries: Array<[string, any]>): Array<[string, Array<[string, any]>]> {
  const map = new Map<string, Array<[string, any]>>();
  for (const e of entries) {
    const group = (e[1] as any).group || 'General';
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(e);
  }
  return Array.from(map.entries());
}


