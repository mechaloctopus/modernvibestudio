import React from 'react';
import { View, Text, Button, Platform, TextInput, ScrollView } from 'react-native';
import { useStore } from '../state/useStore';

export const SessionsPanel: React.FC = () => {
  const {
    saveSession, loadSession, deleteSession, listSessions,
    exportSession, importSession, currentSessionName,
  } = useStore();
  const [name, setName] = React.useState('My Session');
  const [importName, setImportName] = React.useState('Imported Session');
  const [importText, setImportText] = React.useState('');
  const sessions = listSessions();

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: 'white', fontWeight: 'bold' }}>Sessions</Text>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        {Platform.OS === 'web' ? (
          <input type="text" value={name} onChange={(e:any)=> setName(e.target.value)} placeholder="Session name" />
        ) : (
          <TextInput value={name} onChangeText={setName} placeholder="Session name" style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6 }} />
        )}
        <Button title="Save" onPress={()=> saveSession(name)} />
      </View>

      <Text style={{ color: 'white', marginTop: 8 }}>Saved Sessions</Text>
      <ScrollView style={{ maxHeight: 200 }}>
        {sessions.map((n)=> (
          <View key={n} style={{ borderColor: '#333', borderWidth: 1, borderRadius: 6, padding: 6, marginVertical: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: currentSessionName===n ? '#9fd' : 'white' }}>{n}</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Button title="Load" onPress={()=> loadSession(n)} />
                <Button title="Delete" onPress={()=> deleteSession(n)} />
                <Button title="Export" onPress={()=> {
                  const json = exportSession(n);
                  if (!json) return;
                  if (Platform.OS === 'web') {
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `${n}.json`; a.click();
                    URL.revokeObjectURL(url);
                  } else {
                    console.log('Session JSON:', json);
                  }
                }} />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <Text style={{ color: 'white', marginTop: 8 }}>Import Session</Text>
      {Platform.OS === 'web' ? (
        <>
          <input type="text" value={importName} onChange={(e:any)=> setImportName(e.target.value)} placeholder="Name for imported session" />
          <textarea value={importText} onChange={(e:any)=> setImportText(e.target.value)} placeholder="Paste session JSON here" style={{ width: '100%', minHeight: 120 }} />
        </>
      ) : (
        <>
          <TextInput value={importName} onChangeText={setImportName} placeholder="Name for imported session" style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6 }} />
          <TextInput value={importText} onChangeText={setImportText} placeholder="Paste session JSON here" multiline style={{ color: 'white', borderColor: '#333', borderWidth: 1, padding: 6, minHeight: 120 }} />
        </>
      )}
      <Button title="Import" onPress={()=> importSession(importName, importText)} />
    </View>
  );
};

