export type ChannelPassRef = { kind: 'pass'; id: string };
export type ChannelAudio = { kind: 'audio'; source: 'spectrum' | 'rms' };
export type ChannelTexture = { kind: 'texture'; name?: string; builtin?: 'checker' | 'noise' };
export type Channel = ChannelPassRef | ChannelAudio | ChannelTexture | null;

export type PassKind = 'buffer' | 'image';

export type MPNode = {
  id: string;                // e.g., 'A', 'B', 'C', 'D', 'Image'
  kind: PassKind;            // 'buffer' renders to FBO, 'image' renders to screen
  pingpong?: boolean;        // enable ping-pong for feedback (buffers only)
  body: string;              // fragment body that writes to col
  iChannels?: [Channel?, Channel?, Channel?, Channel?]; // up to 4
};

export type MPGraph = {
  nodes: MPNode[];           // must contain exactly one 'image' node
};

export type MPUniforms = Record<string, number | number[] | Float32Array>;

