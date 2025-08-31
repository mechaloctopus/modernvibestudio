import React from 'react';
import { View, Button } from 'react-native';
import { useStore } from '../state/useStore';

export const CommandBar: React.FC = () => {
  const {
    showPanelsMenu, setShowPanelsMenu,
    showHamburger, setShowHamburger,
  } = useStore();

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Button title={showHamburger ? 'Menu ✓' : 'Menu'} onPress={()=> setShowHamburger(!showHamburger)} />
      <Button title={showPanelsMenu ? 'Panels ✓' : 'Panels'} onPress={()=> setShowPanelsMenu(!showPanelsMenu)} />
    </View>
  );
};


