import React from 'react';
import { Platform, View } from 'react-native';
import { Surface as ExpoSurface } from 'gl-react-expo';

let DomSurface: any = null;
if (Platform.OS === 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    DomSurface = require('gl-react-dom').Surface;
  } catch {}
}

export const GLSurface: React.FC<{ children: React.ReactNode }>= ({ children }) => {
  const [size, setSize] = React.useState({ w: typeof window !== 'undefined' ? window.innerWidth : 0, h: typeof window !== 'undefined' ? window.innerHeight : 0 });
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (Platform.OS === 'web' && DomSurface) {
    return (
      // Use a plain div to ensure canvas fills viewport
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <DomSurface width={size.w} height={size.h}>
          {children}
        </DomSurface>
      </div>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <ExpoSurface style={{ flex: 1 }}>
        {children}
      </ExpoSurface>
    </View>
  );
};


