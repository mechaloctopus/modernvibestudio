import type { ModularRegistry, PresetModule } from './types';
import PRESETS from '../presets';

let _all: PresetModule[] | null = null;

export function getAllPresets(): PresetModule[] {
  if (_all) return _all;
  _all = PRESETS.slice();
  return _all;
}

export const Registry: ModularRegistry = {
  all: () => getAllPresets(),
  byId: (id: string) => getAllPresets().find(p => p.id === id),
  firstId: () => getAllPresets()[0]?.id,
};

export default Registry;

