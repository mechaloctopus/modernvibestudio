import React from 'react';
import { View, Text, Button } from 'react-native';

export const Panel: React.FC<{ title: string; collapsed: boolean; onToggle: () => void; onClose?: () => void; style?: any; children?: React.ReactNode }>= ({ title, collapsed, onToggle, onClose, style, children }) => {
  return (
    <View style={[{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 8, borderWidth: 1, borderColor: '#222' }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: 'white', fontWeight: 'bold' }}>{title}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Button title={collapsed ? 'Expand' : 'Collapse'} onPress={onToggle} />
          {onClose ? (<Button title="Close" onPress={onClose} />) : null}
        </View>
      </View>
      {!collapsed ? (
        <View style={{ marginTop: 8 }}>
          {children}
        </View>
      ) : null}
    </View>
  );
};


