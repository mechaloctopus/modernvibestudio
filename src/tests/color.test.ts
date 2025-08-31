import { midiToNoteName, noteToHueDegrees, colorFromMidi, generateHarmonyHues, huesToRgbPalette } from '../core/color';

describe('color musical mapping', () => {
  test('midi to note name', () => {
    expect(midiToNoteName(60)).toBe('C4');
    expect(midiToNoteName(69)).toBe('A4');
  });

  test('note to hue wraps correctly', () => {
    expect(noteToHueDegrees(60) % 360).toBeCloseTo(0);
    expect(noteToHueDegrees(63) % 360).toBeCloseTo(90);
  });

  test('color from midi returns rgb', () => {
    const c = colorFromMidi(69);
    expect(c.r).toBeGreaterThanOrEqual(0);
    expect(c.r).toBeLessThanOrEqual(1);
  });
  test('harmony hues and palette', () => {
    const hues = generateHarmonyHues(180, 'triad', 3);
    expect(hues.length).toBe(3);
    const pal = huesToRgbPalette(hues, 0.8, 0.5);
    expect(pal[0].r).toBeDefined();
  });
});


