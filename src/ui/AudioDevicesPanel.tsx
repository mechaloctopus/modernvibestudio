import React from 'react';
import { View, Text, Button, Platform } from 'react-native';
import { useStore } from '../state/useStore';
import { Panel } from './Panel';
import { audioEngine } from '../audio/AudioEngine';

export const AudioDevicesPanel: React.FC = () => {
  const { inputMode, setInputMode } = useStore();
  const { audioDevices, setAudioDevices, selectedDeviceId, setSelectedDeviceId } = useStore();
  React.useEffect(()=>{
    (async ()=>{
      if (Platform.OS === 'web') {
        const list = await audioEngine.listInputDevices();
        setAudioDevices(list);
      }
    })();
  }, []);
  const applyDevice = async (id: string | undefined) => {
    audioEngine.stop();
    audioEngine.setDeviceId(id);
    try { await audioEngine.start(); } catch (e) { console.warn('Failed to start with device', e); }
  };
  return (
    <Panel title="Audio — Input & Devices" collapsed={false} onToggle={()=>{}}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: 'white' }}>Input Mode</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title={inputMode === 'mic' ? 'Mic ✓' : 'Mic'} onPress={()=> setInputMode('mic')} />
          <Button title={inputMode === 'tab' ? 'Tab Audio ✓' : 'Tab Audio'} onPress={()=> setInputMode('tab')} />
        </View>
        {Platform.OS === 'web' ? (
          <View style={{ marginTop: 8 }}>
            <Text style={{ color: 'white', marginBottom: 4 }}>Input Device</Text>
            <select value={selectedDeviceId || ''} onChange={async (e: any)=>{
              const id = e.target.value || undefined;
              setSelectedDeviceId(id);
              await applyDevice(id);
            }}>
              <option value="">Default</option>
              {audioDevices.map(d=> <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
            </select>
            <View style={{ marginTop: 6 }}>
              <Button title="Refresh Devices" onPress={async ()=>{
                const list = await audioEngine.listInputDevices();
                setAudioDevices(list);
              }} />
            </View>
          </View>
        ) : null}
      </View>
    </Panel>
  );
};


