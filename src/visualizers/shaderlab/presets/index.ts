import type { PresetModule } from "../core/types";
import GridbreakPreset from "./Gridbreak";
import SquidPreset from "./Squid";
import MountainFogBeachPreset from "./MountainFogBeach";
import GrowingMountainsPreset from "./GrowingMountains";
import ColorMappingPortalPreset from "./ColorMappingPortal";
import InteractiveFogParticles from "./InteractiveFogParticles";
import ResonanceLens from "./ResonanceLens";
import OctaveStrata from "./OctaveStrata";


export const PRESETS: PresetModule[] = [
  GridbreakPreset,
  SquidPreset,
  MountainFogBeachPreset,
  GrowingMountainsPreset,
  ColorMappingPortalPreset,
  InteractiveFogParticles,
  ResonanceLens,
  OctaveStrata,
];

export default PRESETS;

