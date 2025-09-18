import React from 'react';
import { View, Text, Button } from 'react-native';
import { useStore } from '../state/useStore';

export const PanelsMenu: React.FC = () => {
  const { showPanelsMenu, setShowPanelsMenu,
    showMenu, setShowMenu,
    showRoutingPanel, setShowRoutingPanel,
    showUniforms, setShowUniforms,
    showHud, setShowHud,
    showAudioMapping, showToneColors, setPanels,
    collapsed, setCollapsed,
    showBandsOverlay, setShowBandsOverlay } = useStore();
  const { openPanel } = useStore();
  if (!showPanelsMenu) return null;
  return (
    <View style={{ position: 'absolute', top: 80, right: 16, backgroundColor: 'rgba(0,0,0,0.7)', padding: 12, borderRadius: 8, gap: 8 }}>
      <Text style={{ color: 'white', fontWeight: 'bold' }}>Panels</Text>
      <Button title={`${showMenu ? 'Hide' : 'Show'} Menu`} onPress={()=> setShowMenu(!showMenu)} />
      <Button title={`${showRoutingPanel ? 'Hide' : 'Show'} Routing`} onPress={()=> setShowRoutingPanel(!showRoutingPanel)} />
      <Button title={`${showAudioMapping ? 'Hide' : 'Show'} Mapping`} onPress={()=> setPanels({ showAudioMapping: !showAudioMapping })} />
      <Button title={`${showToneColors ? 'Hide' : 'Show'} Tone Colors`} onPress={()=> setPanels({ showToneColors: !showToneColors })} />
      <Button title={`${showUniforms ? 'Hide' : 'Show'} Uniforms`} onPress={()=> setShowUniforms(!showUniforms)} />
      <Button title={`${showHud ? 'Hide' : 'Show'} HUD`} onPress={()=> setShowHud(!showHud)} />
      <Button title={`${collapsed.menu ? 'Expand' : 'Collapse'} Menu`} onPress={()=> setCollapsed({ menu: !collapsed.menu })} />
      <Button title={`${collapsed.mapping ? 'Expand' : 'Collapse'} Mapping`} onPress={()=> setCollapsed({ mapping: !collapsed.mapping })} />
      <Button title={`${collapsed.tones ? 'Expand' : 'Collapse'} Tones`} onPress={()=> setCollapsed({ tones: !collapsed.tones })} />
      <Button title={`${showBandsOverlay ? 'Hide' : 'Show'} Bands`} onPress={()=> setShowBandsOverlay(!showBandsOverlay)} />
      <Text style={{ color: 'white', marginTop: 6 }}>Open Floating:</Text>
      <Button title="Params" onPress={()=> { openPanel('params', 'Parameters'); setShowPanelsMenu(false); }} />
      <Button title="Routing" onPress={()=> { openPanel('routing', 'Routing'); setShowPanelsMenu(false); }} />
      <Button title="Audio" onPress={()=> { openPanel('audio', 'Audio Devices & Mapping'); setShowPanelsMenu(false); }} />
      <Button title="Tone" onPress={()=> { openPanel('tone', 'Tone Colors'); setShowPanelsMenu(false); }} />
      <Button title="Uniforms" onPress={()=> { openPanel('uniforms', 'Live Uniforms'); setShowPanelsMenu(false); }} />
      <Button title="Sessions" onPress={()=> { openPanel('sessions', 'Sessions'); setShowPanelsMenu(false); }} />
      <Button title="Signal Lab" onPress={()=> { openPanel('signal', 'Signal Lab'); setShowPanelsMenu(false); }} />
      <Button title="Close" onPress={()=> setShowPanelsMenu(false)} />
    </View>
  );
};


