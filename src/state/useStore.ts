import { create } from 'zustand';
import { MandalaModule } from '../visualizers/mandala/Mandala';
import { LightningModule } from '../visualizers/lightning/Lightning';
import { ShaderLabModule } from '../visualizers/shaderlab/ShaderLab';
import type { VisualizerModule, AudioMappingSettings, ParamRoute } from '../core/types';

type StoreState = {
  visualizers: VisualizerModule[];
  currentId: string;
  params: Record<string, any>;
  setParam: (key: string, value: any) => void;
  setParams: (next: Record<string, any>) => void;
  setVisualizer: (id: string) => void;
  nextVisualizer: () => void;
  prevVisualizer: () => void;
  audioSensitivity: number; // 0.1..5
  setAudioSensitivity: (value: number) => void;
  inputMode: 'mic' | 'tab';
  setInputMode: (mode: 'mic' | 'tab') => void;
  rmsSmoothing: number; // 0..1 EMA alpha
  setRmsSmoothing: (alpha: number) => void;
  presets: Record<string, Record<string, Record<string, any>>>; // visualizerId -> name -> params
  currentPresetName?: string;
  setCurrentPresetName: (name: string | undefined) => void;
  savePreset: (name: string) => void;
  loadPreset: (name: string) => void;
  deletePreset: (name: string) => void;
  nextPreset: () => void;
  prevPreset: () => void;
  saveScene: (name: string) => void;
  loadScene: (name: string) => void;
  deleteScene: (name: string) => void;
  // Sessions (full app state snapshots)
  saveSession: (name: string) => void;
  loadSession: (name: string) => void;
  deleteSession: (name: string) => void;
  listSessions: () => string[];
  exportSession: (name: string) => string | undefined;
  importSession: (name: string, json: string) => void;
  currentSessionName?: string;
  toneColorEnabled: boolean;
  toneColorKeyOffset: number; // -6..+6 semitones
  toneColorSaturation: number; // 0..1
  toneColorLightness: number; // 0..1
  setToneColor: (updates: Partial<Pick<StoreState,'toneColorEnabled'|'toneColorKeyOffset'|'toneColorSaturation'|'toneColorLightness'>>) => void;
  audioMapping: AudioMappingSettings;
  setAudioMapping: (updates: Partial<AudioMappingSettings>) => void;
  toneColorMap: { hueDeg: number; brightness: number }[]; // length 12 for pitch classes
  setToneColorMap: (index: number, entry: { hueDeg?: number; brightness?: number }) => void;
  showAudioMapping: boolean;
  showToneColors: boolean;
  // top-level visibility toggles
  showMenu: boolean;
  setShowMenu: (v: boolean) => void;
  showRoutingPanel: boolean;
  setShowRoutingPanel: (v: boolean) => void;
  showUniforms: boolean;
  setShowUniforms: (v: boolean) => void;
  showHud: boolean;
  setShowHud: (v: boolean) => void;
  showShaderLabUi: boolean; // legacy; not used for overlay
  setShowShaderLabUi: (v: boolean) => void;
  // library/inspector
  showLibrary: boolean;
  setShowLibrary: (v: boolean) => void;
  showInspector: boolean;
  setShowInspector: (v: boolean) => void;
  activeInspectorTab: 'Params' | 'Routing' | 'Audio' | 'Tone' | 'Uniforms';
  setActiveInspectorTab: (t: 'Params' | 'Routing' | 'Audio' | 'Tone' | 'Uniforms') => void;
  setPanels: (updates: Partial<Pick<StoreState,'showAudioMapping'|'showToneColors'>>) => void;
  exportConfig: () => string;
  importConfig: (json: string) => void;
  showBandsOverlay: boolean;
  setShowBandsOverlay: (v: boolean) => void;
  collapsed: { menu: boolean; mapping: boolean; tones: boolean; uniforms: boolean };
  setCollapsed: (updates: Partial<{ menu: boolean; mapping: boolean; tones: boolean; uniforms: boolean }>) => void;
  showPanelsMenu: boolean;
  setShowPanelsMenu: (v: boolean) => void;
  routes: ParamRoute[];
  addRoute: (route: ParamRoute) => void;
  updateRoute: (id: string, updates: Partial<ParamRoute>) => void;
  removeRoute: (id: string) => void;
  themeBrightness: number; // 0..2 global brightness
  themeSaturation: number; // 0..2 saturation multiplier
  setTheme: (updates: Partial<Pick<StoreState,'themeBrightness'|'themeSaturation'>>) => void;
  // pinned quick controls per-visualizer
  pinnedParams: Record<string, string[]>;
  pinParam: (visualizerId: string, key: string) => void;
  unpinParam: (visualizerId: string, key: string) => void;
  // inspector group collapse state per visualizer
  groupCollapsed: Record<string, Record<string, boolean>>;
  toggleGroupCollapsed: (visualizerId: string, groupKey: string) => void;
  // preset metadata (favorites, tags) per visualizer/preset
  presetMeta: Record<string, Record<string, { favorite?: boolean; tags?: string[] }>>;
  togglePresetFavorite: (visualizerId: string, name: string) => void;
  setPresetTags: (visualizerId: string, name: string, tags: string[]) => void;
  // floating panel manager
  openPanels: Array<{ id: string; title: string; x: number; y: number; collapsed?: boolean }>;
  openPanel: (id: string, title: string, initial?: { x?: number; y?: number }) => void;
  closePanel: (id: string) => void;
  movePanel: (id: string, x: number, y: number) => void;
  togglePanelCollapsed: (id: string) => void;
  showHamburger: boolean;
  setShowHamburger: (v: boolean) => void;
  // audio device selection (web)
  audioDevices: Array<{ deviceId: string; label: string }>;
  setAudioDevices: (list: Array<{ deviceId: string; label: string }>) => void;
  selectedDeviceId?: string;
  setSelectedDeviceId: (id: string | undefined) => void;
};

export const useStore = create<StoreState>((set, get) => {
  const registry: VisualizerModule[] = [MandalaModule, LightningModule, ShaderLabModule];
  const initial = registry[0];
  const storageKey = 'mvs:presets:v1';
  const sceneKey = 'mvs:scenes:v1';
  const sessionKey = 'mvs:sessions:v1';
  const pinnedKey = 'mvs:pinned:v1';
  const presetMetaKey = 'mvs:presetMeta:v1';
  const loadAllPresets = (): StoreState['presets'] => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) return JSON.parse(raw);
      }
    } catch {}
    return {} as any;
  };
  const saveAllPresets = (presets: StoreState['presets']) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(storageKey, JSON.stringify(presets));
      }
    } catch {}
  };
  const loadAllSessions = (): Record<string, any> => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(sessionKey);
        if (raw) return JSON.parse(raw);
      }
    } catch {}
    return {};
  };
  const saveAllSessions = (sessions: Record<string, any>) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(sessionKey, JSON.stringify(sessions));
      }
    } catch {}
  };
  const loadAllScenes = (): Record<string, any> => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(sceneKey);
        if (raw) return JSON.parse(raw);
      }
    } catch {}
    return {};
  };
  const saveAllScenes = (scenes: Record<string, any>) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(sceneKey, JSON.stringify(scenes));
      }
    } catch {}
  };
  const loadPinned = (): StoreState['pinnedParams'] => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(pinnedKey);
        if (raw) return JSON.parse(raw);
      }
    } catch {}
    return {} as any;
  };
  const savePinned = (p: StoreState['pinnedParams']) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(pinnedKey, JSON.stringify(p));
      }
    } catch {}
  };
  const loadPresetMeta = (): StoreState['presetMeta'] => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(presetMetaKey);
        if (raw) return JSON.parse(raw);
      }
    } catch {}
    return {} as any;
  };
  const savePresetMeta = (m: StoreState['presetMeta']) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(presetMetaKey, JSON.stringify(m));
      }
    } catch {}
  };
  return {
    visualizers: registry,
    currentId: initial.id,
    params: { ...initial.defaultParams },
    setParam: (key, value) => set((s) => ({ params: { ...s.params, [key]: value } })),
    setParams: (next) => set({ params: { ...next } }),
    setVisualizer: (id) => {
      const found = get().visualizers.find((v) => v.id === id) || get().visualizers[0];
      set({ currentId: found.id, params: { ...found.defaultParams }, currentPresetName: undefined });
    },
    nextVisualizer: () => {
      const s = get();
      const idx = s.visualizers.findIndex(v=> v.id===s.currentId);
      const next = s.visualizers[(idx+1 + s.visualizers.length) % s.visualizers.length];
      s.setVisualizer(next.id);
    },
    prevVisualizer: () => {
      const s = get();
      const idx = s.visualizers.findIndex(v=> v.id===s.currentId);
      const prev = s.visualizers[(idx-1 + s.visualizers.length) % s.visualizers.length];
      s.setVisualizer(prev.id);
    },
    audioSensitivity: 1.5,
    setAudioSensitivity: (value) => set({ audioSensitivity: Math.max(0.1, Math.min(5, value)) }),
    inputMode: 'mic',
    setInputMode: (mode) => set({ inputMode: mode }),
    rmsSmoothing: 0.5,
    setRmsSmoothing: (alpha) => set({ rmsSmoothing: Math.max(0, Math.min(1, alpha)) }),
    presets: loadAllPresets(),
    currentPresetName: undefined,
    setCurrentPresetName: (name) => set({ currentPresetName: name }),
    savePreset: (name) => {
      const s = get();
      const vId = s.currentId;
      const next = { ...(s.presets || ({} as any)) };
      next[vId] = { ...(next[vId] || {}), [name]: { ...s.params } };
      saveAllPresets(next);
      set({ presets: next, currentPresetName: name });
    },
    loadPreset: (name) => {
      const s = get();
      const vId = s.currentId;
      const entry = s.presets?.[vId]?.[name];
      if (entry) set({ params: { ...entry }, currentPresetName: name });
    },
    deletePreset: (name) => {
      const s = get();
      const vId = s.currentId;
      const next = { ...(s.presets || ({} as any)) };
      if (next[vId]) {
        const { [name]: _, ...rest } = next[vId];
        next[vId] = rest;
      }
      saveAllPresets(next);
      set({ presets: next, currentPresetName: s.currentPresetName === name ? undefined : s.currentPresetName });
    },
    nextPreset: () => {
      const s = get();
      const map = s.presets?.[s.currentId] || {};
      const names = Object.keys(map);
      if (!names.length) return;
      const idx = Math.max(0, names.findIndex(n=> n===s.currentPresetName));
      const next = names[(idx+1) % names.length];
      s.loadPreset(next);
    },
    prevPreset: () => {
      const s = get();
      const map = s.presets?.[s.currentId] || {};
      const names = Object.keys(map);
      if (!names.length) return;
      const idx = Math.max(0, names.findIndex(n=> n===s.currentPresetName));
      const prev = names[(idx-1 + names.length) % names.length];
      s.loadPreset(prev);
    },
    saveScene: (name) => {
      const s = get();
      const scenes = loadAllScenes();
      scenes[name] = {
        audioMapping: s.audioMapping,
        toneColor: {
          enabled: s.toneColorEnabled,
          keyOffset: s.toneColorKeyOffset,
          saturation: s.toneColorSaturation,
          lightness: s.toneColorLightness,
          map: s.toneColorMap,
        },
        current: { id: s.currentId, params: s.params },
      };
      saveAllScenes(scenes);
    },
    loadScene: (name) => {
      const scenes = loadAllScenes();
      const cfg = scenes[name];
      if (!cfg) return;
      const updates: any = {};
      if (cfg.audioMapping) updates.audioMapping = { ...get().audioMapping, ...cfg.audioMapping };
      if (cfg.toneColor) {
        updates.toneColorEnabled = !!cfg.toneColor.enabled;
        if (typeof cfg.toneColor.keyOffset === 'number') updates.toneColorKeyOffset = cfg.toneColor.keyOffset;
        if (typeof cfg.toneColor.saturation === 'number') updates.toneColorSaturation = cfg.toneColor.saturation;
        if (typeof cfg.toneColor.lightness === 'number') updates.toneColorLightness = cfg.toneColor.lightness;
        if (Array.isArray(cfg.toneColor.map) && cfg.toneColor.map.length === 12) updates.toneColorMap = cfg.toneColor.map;
      }
      if (cfg.current && typeof cfg.current.id === 'string') {
        const found = get().visualizers.find((v)=> v.id === cfg.current.id);
        if (found) {
          updates.currentId = found.id;
          if (cfg.current.params && typeof cfg.current.params === 'object') updates.params = cfg.current.params;
        }
      }
      set(updates);
    },
    deleteScene: (name) => {
      const scenes = loadAllScenes();
      delete scenes[name];
      saveAllScenes(scenes);
    },
    toneColorEnabled: false,
    toneColorKeyOffset: 0,
    toneColorSaturation: 0.8,
    toneColorLightness: 0.5,
    setToneColor: (updates) => set(updates as any),
    // Sessions API
    saveSession: (name: string) => {
      const s = get();
      const sessions = loadAllSessions();
      sessions[name] = {
        version: 1,
        current: { id: s.currentId, params: s.params, presetName: s.currentPresetName },
        audio: {
          sensitivity: s.audioSensitivity,
          inputMode: s.inputMode,
          rmsSmoothing: s.rmsSmoothing,
          mapping: s.audioMapping,
          selectedDeviceId: s.selectedDeviceId,
        },
        tone: {
          enabled: s.toneColorEnabled,
          keyOffset: s.toneColorKeyOffset,
          saturation: s.toneColorSaturation,
          lightness: s.toneColorLightness,
          map: s.toneColorMap,
        },
        theme: { brightness: s.themeBrightness, saturation: s.themeSaturation },
        routes: s.routes,
        presets: s.presets,
        pinned: s.pinnedParams,
        presetMeta: s.presetMeta,
      };
      saveAllSessions(sessions);
      set({ currentSessionName: name } as any);
    },
    loadSession: (name: string) => {
      const sAll = loadAllSessions();
      const ss = sAll[name];
      if (!ss) return;
      const updates: any = {};
      if (ss.current && typeof ss.current.id === 'string') {
        const found = get().visualizers.find(v=> v.id === ss.current.id);
        if (found) {
          updates.currentId = found.id;
          if (ss.current.params && typeof ss.current.params === 'object') updates.params = ss.current.params;
          if (typeof ss.current.presetName === 'string') updates.currentPresetName = ss.current.presetName;
        }
      }
      if (ss.audio) {
        if (typeof ss.audio.sensitivity === 'number') updates.audioSensitivity = ss.audio.sensitivity;
        if (ss.audio.inputMode === 'mic' || ss.audio.inputMode === 'tab') updates.inputMode = ss.audio.inputMode;
        if (typeof ss.audio.rmsSmoothing === 'number') updates.rmsSmoothing = ss.audio.rmsSmoothing;
        if (ss.audio.mapping) updates.audioMapping = { ...get().audioMapping, ...ss.audio.mapping };
        if (typeof ss.audio.selectedDeviceId === 'string' || ss.audio.selectedDeviceId === undefined) updates.selectedDeviceId = ss.audio.selectedDeviceId;
      }
      if (ss.tone) {
        updates.toneColorEnabled = !!ss.tone.enabled;
        if (typeof ss.tone.keyOffset === 'number') updates.toneColorKeyOffset = ss.tone.keyOffset;
        if (typeof ss.tone.saturation === 'number') updates.toneColorSaturation = ss.tone.saturation;
        if (typeof ss.tone.lightness === 'number') updates.toneColorLightness = ss.tone.lightness;
        if (Array.isArray(ss.tone.map) && ss.tone.map.length === 12) updates.toneColorMap = ss.tone.map;
      }
      if (ss.theme) {
        if (typeof ss.theme.brightness === 'number') updates.themeBrightness = ss.theme.brightness;
        if (typeof ss.theme.saturation === 'number') updates.themeSaturation = ss.theme.saturation;
      }
      if (Array.isArray(ss.routes)) updates.routes = ss.routes;
      if (ss.presets && typeof ss.presets === 'object') updates.presets = ss.presets;
      if (ss.pinned && typeof ss.pinned === 'object') updates.pinnedParams = ss.pinned;
      if (ss.presetMeta && typeof ss.presetMeta === 'object') updates.presetMeta = ss.presetMeta;
      updates.currentSessionName = name;
      set(updates);
    },
    deleteSession: (name: string) => {
      const sessions = loadAllSessions();
      delete sessions[name];
      saveAllSessions(sessions);
      if (get().currentSessionName === name) set({ currentSessionName: undefined } as any);
    },
    listSessions: () => Object.keys(loadAllSessions()),
    exportSession: (name: string) => {
      const sessions = loadAllSessions();
      const ss = sessions[name];
      return ss ? JSON.stringify(ss) : undefined;
    },
    importSession: (name: string, json: string) => {
      try {
        const ss = JSON.parse(json);
        const sessions = loadAllSessions();
        sessions[name] = ss;
        saveAllSessions(sessions);
      } catch {}
    },
    audioMapping: {
      scale: 'log',
      magnitudeMode: 'db',
      dbFloor: -60,
      lowHz: 40,
      highHz: 16000,
      numBands: 16,
      normalize: true,
    },
    setAudioMapping: (updates) => set((s) => ({ audioMapping: { ...s.audioMapping, ...updates } })),
    toneColorMap: Array.from({ length: 12 }, (_, i) => ({ hueDeg: (i/12)*360, brightness: 0.8 })),
    setToneColorMap: (index, entry) => set((s) => {
      const next = s.toneColorMap.slice();
      const prev = next[index] || { hueDeg: 0, brightness: 0.8 };
      next[index] = { hueDeg: entry.hueDeg ?? prev.hueDeg, brightness: entry.brightness ?? prev.brightness };
      return { toneColorMap: next } as any;
    }),
    showAudioMapping: false,
    showToneColors: false,
    showMenu: false,
    setShowMenu: (v) => set({ showMenu: v }),
    showRoutingPanel: false,
    setShowRoutingPanel: (v) => set({ showRoutingPanel: v }),
    showUniforms: false,
    setShowUniforms: (v) => set({ showUniforms: v }),
    showHud: false,
    setShowHud: (v) => set({ showHud: v }),
    showShaderLabUi: false,
    setShowShaderLabUi: (v) => set({ showShaderLabUi: v }),
    showLibrary: false,
    setShowLibrary: (v) => set({ showLibrary: v }),
    showInspector: false,
    setShowInspector: (v) => set({ showInspector: v }),
    activeInspectorTab: 'Params',
    setActiveInspectorTab: (t) => set({ activeInspectorTab: t }),
    setPanels: (updates) => set(updates as any),
    exportConfig: () => {
      const s = get();
      return JSON.stringify({
        audioMapping: s.audioMapping,
        toneColor: {
          enabled: s.toneColorEnabled,
          keyOffset: s.toneColorKeyOffset,
          saturation: s.toneColorSaturation,
          lightness: s.toneColorLightness,
          map: s.toneColorMap,
        },
        current: { id: s.currentId, params: s.params },
      });
    },
    importConfig: (json: string) => {
      try {
        const cfg = JSON.parse(json);
        const updates: any = {};
        if (cfg.audioMapping) updates.audioMapping = { ...get().audioMapping, ...cfg.audioMapping };
        if (cfg.toneColor) {
          updates.toneColorEnabled = !!cfg.toneColor.enabled;
          if (typeof cfg.toneColor.keyOffset === 'number') updates.toneColorKeyOffset = cfg.toneColor.keyOffset;
          if (typeof cfg.toneColor.saturation === 'number') updates.toneColorSaturation = cfg.toneColor.saturation;
          if (typeof cfg.toneColor.lightness === 'number') updates.toneColorLightness = cfg.toneColor.lightness;
          if (Array.isArray(cfg.toneColor.map) && cfg.toneColor.map.length === 12) updates.toneColorMap = cfg.toneColor.map;
        }
        if (cfg.current && typeof cfg.current.id === 'string') {
          const found = get().visualizers.find((v)=> v.id === cfg.current.id);
          if (found) {
            updates.currentId = found.id;
            if (cfg.current.params && typeof cfg.current.params === 'object') updates.params = cfg.current.params;
          }
        }
        set(updates);
      } catch {}
    },
    showBandsOverlay: false,
    setShowBandsOverlay: (v) => set({ showBandsOverlay: v }),
    collapsed: { menu: false, mapping: true, tones: true, uniforms: true },
    setCollapsed: (updates) => set((s)=> ({ collapsed: { ...s.collapsed, ...updates } })),
    showPanelsMenu: false,
    setShowPanelsMenu: (v) => set({ showPanelsMenu: v }),
    routes: [],
    addRoute: (route) => set((s)=> ({ routes: [...s.routes, route] })),
    updateRoute: (id, updates) => set((s)=> ({ routes: s.routes.map(r=> r.id===id ? { ...r, ...updates } : r) })),
    removeRoute: (id) => set((s)=> ({ routes: s.routes.filter(r=> r.id!==id) })),
    themeBrightness: 1.0,
    themeSaturation: 1.0,
    setTheme: (updates) => set(updates as any),
    pinnedParams: loadPinned(),
    pinParam: (visualizerId, key) => set((s)=>{
      const list = s.pinnedParams[visualizerId] || [];
      if (list.includes(key)) return {} as any;
      const next = { ...s.pinnedParams, [visualizerId]: [...list, key] };
      savePinned(next);
      return { pinnedParams: next } as any;
    }),
    unpinParam: (visualizerId, key) => set((s)=>{
      const list = s.pinnedParams[visualizerId] || [];
      const next = { ...s.pinnedParams, [visualizerId]: list.filter(k=> k!==key) };
      savePinned(next);
      return { pinnedParams: next } as any;
    }),
    groupCollapsed: {},
    toggleGroupCollapsed: (visualizerId, groupKey) => set((s)=>{
      const forViz = { ...(s.groupCollapsed[visualizerId] || {}) };
      forViz[groupKey] = !forViz[groupKey];
      return { groupCollapsed: { ...s.groupCollapsed, [visualizerId]: forViz } } as any;
    }),
    presetMeta: loadPresetMeta(),
    togglePresetFavorite: (visualizerId, name) => set((s)=>{
      const forViz = { ...(s.presetMeta[visualizerId] || {}) };
      const entry = { ...(forViz[name] || {}) } as any;
      entry.favorite = !entry.favorite;
      const next = { ...s.presetMeta, [visualizerId]: { ...forViz, [name]: entry } };
      savePresetMeta(next);
      return { presetMeta: next } as any;
    }),
    setPresetTags: (visualizerId, name, tags) => set((s)=>{
      const forViz = { ...(s.presetMeta[visualizerId] || {}) };
      const entry = { ...(forViz[name] || {}), tags } as any;
      const next = { ...s.presetMeta, [visualizerId]: { ...forViz, [name]: entry } };
      savePresetMeta(next);
      return { presetMeta: next } as any;
    }),
    // panel manager
    openPanels: [],
    openPanel: (id, title, initial) => set((s)=>{
      if (s.openPanels.find(p=> p.id === id)) return {} as any;
      const position = { x: initial?.x ?? 24 + s.openPanels.length * 16, y: initial?.y ?? 120 + s.openPanels.length * 16 };
      return { openPanels: [...s.openPanels, { id, title, ...position, collapsed: false }] } as any;
    }),
    closePanel: (id) => set((s)=> ({ openPanels: s.openPanels.filter(p=> p.id !== id) })),
    movePanel: (id, x, y) => set((s)=> ({ openPanels: s.openPanels.map(p=> p.id===id ? { ...p, x, y } : p) })),
    togglePanelCollapsed: (id) => set((s)=> ({ openPanels: s.openPanels.map(p=> p.id===id ? { ...p, collapsed: !p.collapsed } : p) })),
    showHamburger: false,
    setShowHamburger: (v) => set({ showHamburger: v }),
    // audio devices
    audioDevices: [],
    setAudioDevices: (list) => set({ audioDevices: list }),
    selectedDeviceId: undefined,
    setSelectedDeviceId: (id) => set({ selectedDeviceId: id }),
  };
});


