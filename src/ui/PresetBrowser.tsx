import React from 'react';
import { View, Text, Button, Platform, TextInput } from 'react-native';
import { useStore } from '../state/useStore';

export const PresetBrowser: React.FC = () => {
  const { visualizers, currentId, presets, loadPreset, deletePreset, togglePresetFavorite, presetMeta, setPresetTags, setParams, currentPresetName } = useStore();
  const [query, setQuery] = React.useState('');
  const [tagFilter, setTagFilter] = React.useState('');
  const viz = visualizers.find(v=> v.id === currentId)!;
  const map = presets[viz.id] || {};
  const metaMap = presetMeta[viz.id] || {};
  const names = Object.keys(map).filter(n=> n.toLowerCase().includes(query.toLowerCase())).filter(n=> tagFilter ? ((metaMap[n]?.tags||[]).includes(tagFilter)) : true);

  const allTags = Array.from(new Set(Object.values(metaMap).flatMap(m=> m.tags || [])));

  return (
    <View>
      <View style={{ marginBottom: 8 }}>
        <Text style={{ color: 'white', marginBottom: 4 }}>Search Presets</Text>
        {Platform.OS === 'web' ? (
          <input type="text" value={query} onChange={(e:any)=> setQuery(e.target.value)} placeholder="Search by name" style={{ width: '100%' }} />
        ) : (
          <TextInput value={query} onChangeText={setQuery} placeholder="Search by name" style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6 }} />
        )}
      </View>
      <View style={{ marginBottom: 8 }}>
        <Text style={{ color: 'white', marginBottom: 4 }}>Filter by Tag</Text>
        {Platform.OS === 'web' ? (
          <select value={tagFilter} onChange={(e:any)=> setTagFilter(e.target.value)}>
            <option value="">(all)</option>
            {allTags.map(t=> <option key={t} value={t}>{t}</option>)}
          </select>
        ) : (
          <TextInput value={tagFilter} onChangeText={setTagFilter} placeholder="tag" style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6 }} />
        )}
      </View>
      {names.map(name=>{
        const fav = !!metaMap[name]?.favorite;
        const tags = metaMap[name]?.tags || [];
        return (
          <View key={name} style={{ borderColor: '#222', borderWidth: 1, borderRadius: 6, padding: 6, marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: 'white' }}>{name}</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Button title={fav ? '★' : '☆'} onPress={()=> togglePresetFavorite(viz.id, name)} />
                <Button title="Load" onPress={()=> loadPreset(name)} />
                <Button title="Delete" onPress={()=> deletePreset(name)} />
              </View>
            </View>
            <View style={{ marginTop: 6, flexDirection: 'row', gap: 8 }}>
              <Button title="Preview" onPress={()=>{
                const entry = (presets[viz.id]||{})[name];
                if (entry) setParams(entry);
              }} />
              <Button title="Restore" onPress={()=>{
                const s = require('../state/useStore').useStore.getState();
                const lastName = s.currentPresetName;
                if (lastName && (s.presets[s.currentId]||{})[lastName]) {
                  s.loadPreset(lastName);
                } else {
                  const found = s.visualizers.find((v:any)=> v.id===s.currentId);
                  if (found) s.setParams(found.defaultParams);
                }
              }} />
            </View>
            <View style={{ marginTop: 6, flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {tags.map(t=> <Text key={t} style={{ color: '#9fd', borderColor: '#224', borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>{t}</Text>)}
            </View>
            <View style={{ marginTop: 6 }}>
              {Platform.OS === 'web' ? (
                <input type="text" placeholder="add tags comma separated" onKeyDown={(e:any)=>{
                  if (e.key === 'Enter') {
                    const value = (e.target.value as string).trim();
                    const parts = value ? value.split(',').map((s)=> s.trim()).filter(Boolean) : [];
                    setPresetTags(viz.id, name, parts);
                    e.target.value='';
                  }
                }} style={{ width: '100%' }} />
              ) : (
                <TextInput placeholder="add tags comma separated" onSubmitEditing={(e:any)=>{
                  const value = (e.nativeEvent.text as string).trim();
                  const parts = value ? value.split(',').map((s)=> s.trim()).filter(Boolean) : [];
                  setPresetTags(viz.id, name, parts);
                }} style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6 }} />
              )}
            </View>
          </View>
        );
      })}
      <View style={{ marginTop: 8 }}>
        <Button title="Randomize Favorite" onPress={()=>{
          const arr = names.filter(n=> !!metaMap[n]?.favorite);
          const pick = arr[Math.floor(Math.random() * Math.max(1, arr.length))];
          if (pick) loadPreset(pick);
        }} />
      </View>
    </View>
  );
};


