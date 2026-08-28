import * as pc from "playcanvas";

export interface SceneParams {
  scene: string;
  mode: SceneMode;
  hasCamArgs: boolean;
  camPos: pc.Vec3;
  camLookAt: pc.Vec3;
  lod: number;
}

export type SceneMode = "normal" | "advanced" | "debug";

export interface SplatData {
  name?: string;
  path: string;
  position?: [number, number, number];
  rotation?: [number, number, number] | [number, number, number, number];
  scale?: [number, number, number];
}

export interface ModelData {
  name?: string;
  path: string;
  position?: [number, number, number];
  rotation?: [number, number, number] | [number, number, number, number];
  scale?: [number, number, number];
}
export interface LogoData {
  image: string;
  link?: string;
  alt: string;
}

export interface CameraData {
  position: [number, number, number];
  lookAt: [number, number, number];
}

export interface GroupData {
  elements: string[];
  enabled: boolean;
}

export interface ElementsData {
  logos?: LogoData[];
  camera?: CameraData;
  groups?: Record<string, GroupData>;
  ui?: Partial<Record<UiElementName, UiElementData>>;
}

export type UiElementName =
  | "mobileMenu"
  | "compass"
  | "viewpointSelect"
  | "lodSelect"
  | "renderSelect"
  | "debugPanel"
  | "logos";

export interface UiElementData {
  visibleInModes?: SceneMode[];
}

export interface LabelData {
  text?: string;
  position?: [number, number, number];
  fontSize?: number;
  name?: string;
  minScale?: number;
  maxScale?: number;
  minSizeDistance?: number;
  color?: [number, number, number];
  bgColor?: [number, number, number, number?];
}

export interface SceneData {
  viewpoints?: ViewpointData[];
  splats?: SplatData[];
  models?: ModelData[];
}

export interface PortalData {
  name?: string;
  image: string;
  position: [number, number, number];
  minScale?: number;
  maxScale?: number;
  minSizeDistance?: number;
  targetScene: string;
  targetCameraPosition: [number, number, number];
  targetCameraLookAt: [number, number, number];
}

export interface ViewpointData {
  name?: string;
  icon?: string;
  position: [number, number, number];
  minScale?: number;
  maxScale?: number;
  minSizeDistance?: number;
  targetPosition: [number, number, number];
  targetLookAt: [number, number, number];
}
export interface LabelWrapperEntity extends pc.Entity {
  setText: (newString: string) => void;
}

export interface CameraControlsInstance {
  look: (target: pc.Vec3, smooth?: boolean) => void;
  yaw: number;
  pitch: number;
  ey: number;
  ex: number;
  moveSpeed: number;
  moveSlowSpeed: number;
  moveFastSpeed: number;
  enableOrbit: boolean;
  enablePan: boolean;
}

declare global {
  interface Window {
    pc: typeof pc;
  }
}
