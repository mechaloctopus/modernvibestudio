import React from 'react';
import { View, Button, Text } from 'react-native';
import { useStore } from '../state/useStore';

export const CommandBar: React.FC = () => {
  const {
    showPanelsMenu, setShowPanelsMenu,
    showHamburger, setShowHamburger,
    saveSession, loadSession, listSessions, currentSessionName,
  } = useStore();

  const [saveFlash, setSaveFlash] = React.useState<string | null>(null);
  const [loadFlash, setLoadFlash] = React.useState<string | null>(null);

  const getNextSessionName = React.useCallback(() => {
    const names = listSessions();
    let maxN = 0;
    for (const n of names) {
      const m = /^Session\s+(\d+)$/.exec(n);
      if (m) {
        const k = parseInt(m[1], 10);
        if (!Number.isNaN(k)) maxN = Math.max(maxN, k);
      }
    }
    return `Session ${maxN + 1}`;
  }, [listSessions]);

  const onSaveSession = React.useCallback(() => {
    const name = getNextSessionName();
    saveSession(name);
    setSaveFlash(`Saved ✓ (${name})`);
    const t = setTimeout(()=> setSaveFlash(null), 1500);
    return () => clearTimeout(t);
  }, [getNextSessionName, saveSession]);

  const onLoadLast = React.useCallback(() => {
    const names = listSessions();
    let pick = currentSessionName as string | undefined;
    if (!pick) {
      let maxN = 0; let best: string | undefined;
      for (const n of names) {
        const m = /^Session\s+(\d+)$/.exec(n);
        if (m) {
          const k = parseInt(m[1], 10);
          if (!Number.isNaN(k) && k > maxN) { maxN = k; best = n; }
        }
      }
      pick = best || names[0];
    }
    if (pick) {
      loadSession(pick);
      setLoadFlash(`Loaded ✓ (${pick})`);
      const t = setTimeout(()=> setLoadFlash(null), 1500);
      return () => clearTimeout(t);
    }
    setLoadFlash('No sessions');
    const t = setTimeout(()=> setLoadFlash(null), 1200);
    return () => clearTimeout(t);
  }, [currentSessionName, listSessions, loadSession]);

  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Button title={showHamburger ? 'Menu ✓' : 'Menu'} onPress={()=> setShowHamburger(!showHamburger)} />
      <Button title={showPanelsMenu ? 'Panels ✓' : 'Panels'} onPress={()=> setShowPanelsMenu(!showPanelsMenu)} />
      <Button title={saveFlash ?? 'Save Session'} onPress={onSaveSession} />
      <Button title={loadFlash ?? 'Load Last Session'} onPress={onLoadLast} />
      {(saveFlash || loadFlash) ? (
        <Text style={{ color: '#9fd' }}>{saveFlash || loadFlash}</Text>
      ) : null}
    </View>
  );
};


