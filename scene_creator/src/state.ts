import * as pc from "playcanvas";

export interface AssetData {
  name: string;
  path: string;
  file?: File;
  virtualFolder?: string;
  entity: pc.Entity;
  type: "model" | "splat";
  lodFalloff?: number;
  lodRangeMin?: number;
  lodRangeMax?: number;
  lodLevels?: number;
  lodDistances?: number[];
}

export interface LogoData {
  file: File;
  link: string;
  alt: string;
}

export const state = {
  app: null as pc.Application | null,
  cameraEntity: null as pc.Entity | null,
  assets: [] as AssetData[],
  selectedAssetIndex: -1,
  activeGizmo: null as any,
  logos: [] as LogoData[],
};
