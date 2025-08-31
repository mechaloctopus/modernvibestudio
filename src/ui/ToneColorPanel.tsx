import React from 'react';
import { View, Text, Platform } from 'react-native';
import { useStore } from '../state/useStore';
import { generateHarmonyHues, huesToRgbPalette } from '../core/color';
import { Panel } from './Panel';

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

export const ToneColorPanel: React.FC = () => {
  const { toneColorMap, setToneColorMap, collapsed, setCollapsed, themeBrightness, themeSaturation, setTheme } = useStore();
  const [baseHue, setBaseHue] = React.useState(200);
  const [scheme, setScheme] = React.useState<'analog'|'complementary'|'triad'|'tetrad'|'heptad'>('triad');
  const [sat, setSat] = React.useState(0.9);
  const [light, setLight] = React.useState(0.6);
  return (
    <View style={{ width: 360 }}>
      <Panel title="Tone Colors (Pitch Classes)" collapsed={collapsed.tones} onToggle={()=> setCollapsed({ tones: !collapsed.tones })}>
      <View style={{ marginBottom: 8 }}>
        <Text style={{ color: 'white' }}>Global Brightness: {themeBrightness.toFixed(2)}</Text>
        {Platform.OS === 'web' ? (
          <input type="range" min={0} max={2} step={0.01} value={themeBrightness} onChange={(e:any)=> setTheme({ themeBrightness: parseFloat(e.target.value) })} />
        ) : null}
        <Text style={{ color: 'white' }}>Global Saturation: {themeSaturation.toFixed(2)}</Text>
        {Platform.OS === 'web' ? (
          <input type="range" min={0} max={2} step={0.01} value={themeSaturation} onChange={(e:any)=> setTheme({ themeSaturation: parseFloat(e.target.value) })} />
        ) : null}
      </View>
      <View style={{ marginBottom: 8 }}>
        <Text style={{ color: 'white', marginBottom: 4 }}>Palette Generator</Text>
        {Platform.OS === 'web' ? (
          <>
            <input type="range" min={0} max={360} value={baseHue} onChange={(e:any)=> setBaseHue(parseInt(e.target.value,10))} />
            <select value={scheme} onChange={(e:any)=> setScheme(e.target.value)}>
              <option value="analog">analog</option>
              <option value="complementary">complementary</option>
              <option value="triad">triad</option>
              <option value="tetrad">tetrad</option>
              <option value="heptad">heptad</option>
            </select>
            <input type="range" min={0} max={1} step={0.01} value={sat} onChange={(e:any)=> setSat(parseFloat(e.target.value))} />
            <input type="range" min={0} max={1} step={0.01} value={light} onChange={(e:any)=> setLight(parseFloat(e.target.value))} />
            <button onClick={()=> {
              const hues = generateHarmonyHues(baseHue, scheme as any, 7);
              const pal = huesToRgbPalette(hues, sat, light);
              // map diatonic degrees across 12 pitch classes (simple round-robin)
              const mapping = Array.from({ length: 12 }, (_, i) => pal[i % pal.length]);
              mapping.forEach((c, i)=> setToneColorMap(i, { hueDeg: hues[i % hues.length], brightness: light }));
            }}>Apply Palette</button>
          </>
        ) : null}
      </View>
      {toneColorMap.map((entry, i) => {
        const hex = hslToHex(entry.hueDeg, 0.9, entry.brightness);
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 }}>
            <Text style={{ color: 'white', width: 40 }}>{NOTE_NAMES[i]}</Text>
            {Platform.OS === 'web' ? (
              <input type="color" value={hex} onChange={(e:any)=> {
                const { h, l } = hexToHsl(e.target.value);
                setToneColorMap(i, { hueDeg: h, brightness: l });
              }} />
            ) : (
              <View style={{ width: 24, height: 24, backgroundColor: hex, borderRadius: 4 }} />
            )}
            {Platform.OS === 'web' ? (
              <input type="range" min={0} max={1} step={0.01} value={entry.brightness} onChange={(e:any)=> setToneColorMap(i, { brightness: parseFloat(e.target.value) })} style={{ flex: 1 }} />
            ) : null}
          </View>
        );
      })}
      </Panel>
    </View>
  );
};

function hslToHex(h:number, s:number, l:number){
  const a = s*Math.min(l,1-l);
  const f = (n:number)=>{
    const k = (n + h/30) % 12;
    const color = l - a*Math.max(Math.min(k-3,9-k,1),-1);
    return Math.round(255*color).toString(16).padStart(2,'0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
function hexToHsl(hex:string){
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h=0,s=0,l=(max+min)/2;
  const d=max-min;
  if (d!==0){
    s = d / (1 - Math.abs(2*l-1));
    switch(max){
      case r: h = 60 * (((g-b)/d) % 6); break;
      case g: h = 60 * (((b-r)/d) + 2); break;
      case b: h = 60 * (((r-g)/d) + 4); break;
    }
  }
  if (h<0) h+=360;
  return { h, s, l };
}


