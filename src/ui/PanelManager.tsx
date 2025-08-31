import React from 'react';
import { View } from 'react-native';
import { useStore } from '../state/useStore';
import { Draggable } from './Draggable';
import { Panel } from './Panel';
import { Menu } from './Menu';
import { RoutingPanel } from './RoutingPanel';
import { AudioMappingPanel } from './AudioMappingPanel';
import { ToneColorPanel } from './ToneColorPanel';
import { LiveUniforms } from './LiveUniforms';
import type { FeatureFrame } from '../core/types';
import { AudioDevicesPanel } from './AudioDevicesPanel';
import { ShaderLabEditor } from './ShaderLabEditor';

export const PanelManager: React.FC<{ frame: FeatureFrame | null }>= ({ frame }) => {
  const { openPanels, movePanel, closePanel, togglePanelCollapsed } = useStore();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
      {openPanels.map(p => (
        <Draggable key={p.id} x={p.x} y={p.y} onDragEnd={(x,y)=> movePanel(p.id, x, y)}>
          <View style={{ width: 360, maxWidth: '90vw' }}>
            {renderPanel(p.id, p.title, p.collapsed ?? false, ()=> togglePanelCollapsed(p.id), ()=> closePanel(p.id), frame)}
          </View>
        </Draggable>
      ))}
    </View>
  );
};

function renderPanel(id: string, title: string, collapsed: boolean, onToggle: () => void, onClose: () => void, frame: FeatureFrame | null) {
  if (id === 'params') {
    return (
      <Panel title={title} collapsed={collapsed} onToggle={onToggle} onClose={onClose}>
        <Menu />
      </Panel>
    );
  }
  if (id === 'routing') {
    return (
      <Panel title={title} collapsed={collapsed} onToggle={onToggle} onClose={onClose}>
        <RoutingPanel frame={frame} />
      </Panel>
    );
  }
  if (id === 'audio') {
    return (
      <Panel title={title} collapsed={collapsed} onToggle={onToggle} onClose={onClose}>
        <AudioDevicesPanel />
        <View style={{ height: 8 }} />
        <AudioMappingPanel frame={frame} />
      </Panel>
    );
  }
  if (id === 'tone') {
    return (
      <Panel title={title} collapsed={collapsed} onToggle={onToggle} onClose={onClose}>
        <ToneColorPanel />
      </Panel>
    );
  }
  if (id === 'uniforms') {
    return (
      <Panel title={title} collapsed={collapsed} onToggle={onToggle} onClose={onClose}>
        <LiveUniforms frame={frame} collapsed={false} onToggle={()=>{}} />
      </Panel>
    );
  }
  if (id === 'shader') {
    return (
      <Panel title={title} collapsed={collapsed} onToggle={onToggle} onClose={onClose}>
        <ShaderLabEditor />
      </Panel>
    );
  }
  return (
    <Panel title={title} collapsed={collapsed} onToggle={onToggle} onClose={onClose}>
      {/* Unknown panel id */}
    </Panel>
  );
}


