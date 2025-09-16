export type NumberControl = {
  type: 'number';
  min: number;
  max: number;
  step?: number;
  default: number;
  description?: string;
  group?: string;
};

export type PresetSchema = Record<string, NumberControl>;

export interface PresetModule {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  schema?: PresetSchema; // per‑preset controls
  defaults?: Record<string, number>; // optional explicit defaults override
  // Return only the GLSL body that writes to `col` using `p` (uv 0..1) and shared uniforms.
  // Per‑preset params are exposed as uniforms named `u_pm_<key>` per schema entry.
  buildFragment: (params: Record<string, number>) => string;
}

export interface ModularRegistry {
  all: () => PresetModule[];
  byId: (id: string) => PresetModule | undefined;
  firstId: () => string | undefined;
}

