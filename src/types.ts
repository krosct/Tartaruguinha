export enum PostureResult {
  Good = "good",
  Hunched = "hunched",
  NotVisible = "not_visible",
  Unknown = "unknown",
}

export interface Landmark {
  x: number;
  y: number;
  visibility: number;
}

export type Landmarks = Record<string, Landmark>;
