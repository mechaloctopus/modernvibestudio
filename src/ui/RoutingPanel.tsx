import React from 'react';
import { View, Text, Button, Platform, TextInput, ScrollView } from 'react-native';
import { Panel } from './Panel';
import { useStore } from '../state/useStore';
import type { ParamRoute } from '../core/types';
import type { FeatureFrame } from '../core/types';
import { applySpectrumMapping } from '../core/mapping';

const newId = () => Math.random().toString(36).slice(2);

export const RoutingPanel: React.FC<{ frame: FeatureFrame | null }>= ({ frame }) => {
  const { visualizers, currentId, routes, addRoute, updateRoute, removeRoute, collapsed, setCollapsed, audioMapping, params } = useStore();
  const [draft, setDraft] = React.useState<ParamRoute>({
    id: newId(),
    visualizerId: currentId,
    paramKey: 'petals',
    source: { kind: 'band', index: 0 },
    scale: { inMin: 0, inMax: 1, outMin: 3, outMax: 24 },
    curve: 'linear',
    enabled: true,
  });
  React.useEffect(()=> setDraft((d)=> ({ ...d, visualizerId: currentId })), [currentId]);

  const current = visualizers.find(v=> v.id === currentId)!;
  const schemaKeys = Object.keys(current.schema || {});
  const paramInfo: any = (current.schema as any)?.[draft.paramKey] || null;

  // live preview for routes
  const bands = applySpectrumMapping(frame?.spectrum, frame?.sampleRateHz, audioMapping);
  const ctx = {
    bands,
    low: frame?.bandEnergies?.low ?? bands[0] ?? 0,
    mid: frame?.bandEnergies?.mid ?? bands[Math.floor(bands.length/2)] ?? 0,
    high: frame?.bandEnergies?.high ?? bands[bands.length-1] ?? 0,
    rms: frame?.amplitudeRms ?? 0,
    onset: frame?.onsetPercussive ? 1 : 0,
    centroid: frame?.spectralCentroidHz ?? 0,
    note: frame?.midiNote,
  };

  const computeSource = (r: ParamRoute): number => {
    const s:any = r.source;
    if (s.kind === 'band') return ctx.bands[s.index] ?? 0;
    if (s.kind === 'group') return s.name === 'low' ? ctx.low : s.name === 'mid' ? ctx.mid : ctx.high;
    if (s.kind === 'rms') return ctx.rms;
    if (s.kind === 'onset') return ctx.onset;
    if (s.kind === 'centroid') return ctx.centroid / Math.max(1, ctx.centroid + 1);
    if (s.kind === 'note') return (ctx.note ?? 0) / 127;
    return 0;
  };
  const applyCurve = (t:number, curve:ParamRoute['curve'])=> {
    let u = Math.max(0, Math.min(1, t));
    if (curve === 'exp') u = Math.pow(u, 2);
    else if (curve === 'log') u = Math.sqrt(u);
    else if (curve === 'smoothstep') u = u*u*(3-2*u);
    return u;
  };

  const applyPresetRoutes = () => {
    // Basic presets per-visualizer following guidance: Low→size, Mid→rotation/push, High→glow/bloom
    if (currentId === 'mandala') {
      const r1: ParamRoute = {
        id: newId(), visualizerId: currentId, paramKey: 'shapeSize',
        source: { kind: 'group', name: 'low' } as any,
        scale: { inMin: 0, inMax: 1, outMin: 0.03, outMax: 0.12 }, curve: 'linear', enabled: true,
      } as any;
      const r2: ParamRoute = {
        id: newId(), visualizerId: currentId, paramKey: 'bandPush',
        source: { kind: 'group', name: 'mid' } as any,
        scale: { inMin: 0, inMax: 1, outMin: 0.5, outMax: 3.0 }, curve: 'exp', enabled: true,
      } as any;
      const r3: ParamRoute = {
        id: newId(), visualizerId: currentId, paramKey: 'darkenShapes',
        source: { kind: 'group', name: 'high' } as any,
        scale: { inMin: 0, inMax: 1, outMin: 0.05, outMax: 0.6 }, curve: 'smoothstep', enabled: true,
      } as any;
      addRoute(r1); addRoute(r2); addRoute(r3);
    } else if (currentId === 'shaderlab') {
      const r1: ParamRoute = {
        id: newId(), visualizerId: currentId, paramKey: 'plasmaFocus',
        source: { kind: 'group', name: 'low' } as any,
        scale: { inMin: 0, inMax: 1, outMin: 0.2, outMax: 1.0 }, curve: 'smoothstep', enabled: true,
      } as any;
      const r2: ParamRoute = {
        id: newId(), visualizerId: currentId, paramKey: 'plasmaSwirl',
        source: { kind: 'group', name: 'mid' } as any,
        scale: { inMin: 0, inMax: 1, outMin: 0.0, outMax: 1.0 }, curve: 'exp', enabled: true,
      } as any;
      const r3: ParamRoute = {
        id: newId(), visualizerId: currentId, paramKey: 'hueShift',
        source: { kind: 'group', name: 'high' } as any,
        scale: { inMin: 0, inMax: 1, outMin: 0.0, outMax: 1.0 }, curve: 'linear', enabled: true,
      } as any;
      addRoute(r1); addRoute(r2); addRoute(r3);
    } else if (currentId === 'lightning') {
      const r1: ParamRoute = {
        id: newId(), visualizerId: currentId, paramKey: 'intensity',
        source: { kind: 'group', name: 'low' } as any,
        scale: { inMin: 0, inMax: 1, outMin: 0.2, outMax: 1.0 }, curve: 'linear', enabled: true,
      } as any;
      const r2: ParamRoute = {
        id: newId(), visualizerId: currentId, paramKey: 'branches',
        source: { kind: 'group', name: 'mid' } as any,
        scale: { inMin: 0, inMax: 1, outMin: 0, outMax: 5 }, curve: 'smoothstep', enabled: true,
      } as any;
      const r3: ParamRoute = {
        id: newId(), visualizerId: currentId, paramKey: 'glow',
        source: { kind: 'group', name: 'high' } as any,
        scale: { inMin: 0, inMax: 1, outMin: 0.0, outMax: 1.0 }, curve: 'exp', enabled: true,
      } as any;
      addRoute(r1); addRoute(r2); addRoute(r3);
    }
  };

  return (
    <View style={{ width: 360 }}>
      <Panel title="Routing Matrix" collapsed={collapsed.mapping} onToggle={()=> setCollapsed({ mapping: !collapsed.mapping })}>
        <ScrollView style={{ maxHeight: 360 }}>
          <Text style={{ color: 'white', marginBottom: 6 }}>Add Route</Text>
          <Text style={{ color: '#9fd' }}>Param Key</Text>
          {Platform.OS === 'web' ? (
            <select value={draft.paramKey} onChange={(e:any)=> setDraft({ ...draft, paramKey: e.target.value })}>
              {schemaKeys.length ? schemaKeys.map(k=> <option key={k} value={k}>{k}</option>) : <option value={draft.paramKey}>{draft.paramKey}</option>}
            </select>
          ) : (
            <TextInput value={draft.paramKey} onChangeText={(v)=> setDraft({ ...draft, paramKey: v })} style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, marginBottom: 6 }} />
          )}
          {paramInfo && paramInfo.type === 'number' ? (
            <Text style={{ color: '#8a8' }}>Hint: range {paramInfo.min != null ? paramInfo.min : '0'}..{paramInfo.max != null ? paramInfo.max : '1'} (default {paramInfo.default != null ? paramInfo.default : '-'})</Text>
          ) : null}
          <Text style={{ color: '#9fd' }}>Source</Text>
          {Platform.OS === 'web' ? (
            <select value={(draft.source as any).kind} onChange={(e:any)=> {
              const kind = e.target.value;
              if (kind === 'band') setDraft({ ...draft, source: { kind: 'band', index: 0 } as any });
              else if (kind === 'group') setDraft({ ...draft, source: { kind: 'group', name: 'low' } as any });
              else setDraft({ ...draft, source: { kind } as any });
            }}>
              <option value="band">Band</option>
              <option value="group">Group</option>
              <option value="rms">RMS</option>
              <option value="onset">Onset</option>
              <option value="centroid">Centroid</option>
              <option value="note">Note</option>
            </select>
          ) : null}
          { (draft.source as any).kind === 'band' ? (
            <>
              <Text style={{ color: '#9fd' }}>Band Index</Text>
              <TextInput value={String((draft.source as any).index)} onChangeText={(v)=> setDraft({ ...draft, source: { kind: 'band', index: parseInt(v,10)||0 } as any })} style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, marginBottom: 6 }} />
            </>
          ) : null}
          { (draft.source as any).kind === 'group' ? (
            Platform.OS === 'web' ? (
              <select value={(draft.source as any).name} onChange={(e:any)=> setDraft({ ...draft, source: { kind: 'group', name: e.target.value } as any })}>
                <option value="low">low</option>
                <option value="mid">mid</option>
                <option value="high">high</option>
              </select>
            ) : null
          ) : null}
          <Text style={{ color: '#9fd' }}>Scale In (min/max)</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={String(draft.scale.inMin)} onChangeText={(v)=> setDraft({ ...draft, scale: { ...draft.scale, inMin: Number(v)||0 } })} style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, flex: 1 }} />
            <TextInput value={String(draft.scale.inMax)} onChangeText={(v)=> setDraft({ ...draft, scale: { ...draft.scale, inMax: Number(v)||1 } })} style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, flex: 1 }} />
          </View>
          <Text style={{ color: '#9fd', marginTop: 6 }}>Scale Out (min/max)</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={String(draft.scale.outMin)} onChangeText={(v)=> setDraft({ ...draft, scale: { ...draft.scale, outMin: Number(v)||0 } })} style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, flex: 1 }} />
            <TextInput value={String(draft.scale.outMax)} onChangeText={(v)=> setDraft({ ...draft, scale: { ...draft.scale, outMax: Number(v)||1 } })} style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, flex: 1 }} />
          </View>
          <Text style={{ color: '#9fd', marginTop: 6 }}>Curve</Text>
          {Platform.OS === 'web' ? (
            <select value={draft.curve} onChange={(e:any)=> setDraft({ ...draft, curve: e.target.value })}>
              <option value="linear">linear</option>
              <option value="exp">exp</option>
              <option value="log">log</option>
              <option value="smoothstep">smoothstep</option>
            </select>
          ) : null}
          <View style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
            <Button title="Add Route" onPress={()=> { addRoute({ ...draft, id: newId(), visualizerId: currentId }); }} />
            <Button title="Apply Presets" onPress={applyPresetRoutes} />
          </View>
          <Text style={{ color: 'white', marginVertical: 8 }}>Routes</Text>
          {routes.filter(r=> r.visualizerId === currentId).map((r)=> {
            const src = computeSource(r);
            const t = (src - r.scale.inMin) / Math.max(1e-6, (r.scale.inMax - r.scale.inMin));
            const u = applyCurve(t, r.curve);
            const y = r.scale.outMin + (r.scale.outMax - r.scale.outMin) * u;
            return (
            <View key={r.id} style={{ borderColor: '#222', borderWidth: 1, padding: 6, borderRadius: 6, marginBottom: 6 }}>
              <Text style={{ color: 'white' }}>{r.paramKey} ← {r.source.kind}</Text>
              <Text style={{ color: '#9fd' }}>src={src.toFixed(3)} → out={y.toFixed(3)}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <Button title={r.enabled ? 'Disable' : 'Enable'} onPress={()=> updateRoute(r.id, { enabled: !r.enabled })} />
                <Button title="Delete" onPress={()=> removeRoute(r.id)} />
              </View>
            </View>
            );
          })}
        </ScrollView>
      </Panel>
    </View>
  );
};


