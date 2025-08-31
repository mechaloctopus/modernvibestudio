export function clamp(value: number, min: number, max: number): number {
  if (min > max) [min, max] = [max, min];
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class ExponentialMovingAverage {
  private alpha: number;
  private current: number | null = null;

  constructor(alpha: number) {
    this.alpha = clamp(alpha, 0, 1);
  }

  reset(): void {
    this.current = null;
  }

  update(sample: number): number {
    if (this.current == null) {
      this.current = sample;
    } else {
      this.current = this.alpha * sample + (1 - this.alpha) * this.current;
    }
    return this.current;
  }
}


