import React from 'react';
import { View, Text, Button, Platform, TextInput } from 'react-native';
import { useStore } from '../state/useStore';

export const QuickControls: React.FC = () => {
  const { visualizers, currentId, params, setParam, pinnedParams, unpinParam } = useStore();
  const keys = pinnedParams[currentId] || [];
  const current = visualizers.find(v=> v.id===currentId)!;
  if (!keys.length) return null;
  return (
    <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {keys.slice(0, 5).map((k)=>{
        const meta: any = (current.schema as any)[k];
        if (!meta || meta.type !== 'number') return null;
        const value = params[k] ?? meta.default;
        return (
          <View key={k} style={{ minWidth: 160 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: 'white' }}>{k}: {typeof value === 'number' ? value.toFixed(2) : String(value)}</Text>
              <Button title="✕" onPress={()=> unpinParam(currentId, k)} />
            </View>
            {Platform.OS === 'web' ? (
              <input type="range" min={meta.min} max={meta.max} step={meta.step} value={value} onChange={(e:any)=> setParam(k, parseFloat(e.target.value))} style={{ width: '100%' }} />
            ) : (
              <TextInput
                value={String(value)}
                onChangeText={(txt)=> {
                  const n = Number(txt);
                  if (!Number.isNaN(n)) setParam(k, n);
                }}
                keyboardType="numeric"
                style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, marginTop: 6 }}
              />
            )}
          </View>
        );
      })}
    </View>
  );
};


