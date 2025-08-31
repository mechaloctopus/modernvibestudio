import React from 'react';
import { Platform, View } from 'react-native';

export const Draggable: React.FC<{ x: number; y: number; children: React.ReactNode; onDragEnd?: (x: number, y: number) => void }>= ({ x, y, children, onDragEnd }) => {
  const [pos, setPos] = React.useState({ x, y });
  const dragging = React.useRef(false);
  const offset = React.useRef({ x: 0, y: 0 });

  React.useEffect(() => { setPos({ x, y }); }, [x, y]);

  if (Platform.OS !== 'web') {
    return (
      <View style={{ position: 'absolute', left: pos.x, top: pos.y }}>
        {children}
      </View>
    );
  }

  const onMouseDown = (e: any) => {
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    window.addEventListener('mousemove', onMouseMove as any);
    window.addEventListener('mouseup', onMouseUp as any);
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!dragging.current) return;
    setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
  };
  const onMouseUp = () => {
    dragging.current = false;
    window.removeEventListener('mousemove', onMouseMove as any);
    window.removeEventListener('mouseup', onMouseUp as any);
    if (onDragEnd) onDragEnd(pos.x, pos.y);
  };

  return (
    <div style={{ position: 'absolute', left: pos.x, top: pos.y, cursor: 'move', zIndex: 15 }} onMouseDown={onMouseDown}>
      {children as any}
    </div>
  );
};


