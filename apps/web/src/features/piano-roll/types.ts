export interface Note {
  id: string;
  /** MIDI note number (60 = middle C) */
  pitch: number;
  /** If set, a stacked chord voicing sounding together for `duration` */
  pitches?: number[];
  /** Start time in beats, from the beginning of the melody */
  start: number;
  /** Duration in beats */
  duration: number;
  velocity: number;
}

export interface Melody {
  notes: Note[];
  /** Beats per bar, e.g. 4 for 4/4 */
  beatsPerBar: number;
}
