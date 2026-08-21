import * as pc from "playcanvas";

export interface SceneParams {
  scene: string;
  hasCamArgs: boolean;
  camPos: pc.Vec3;
  camLookAt: pc.Vec3;
  lod: number;
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

export interface SplatData {
  name?: string;
  path: string;
  position?: [number, number, number];
  rotation?: [number, number, number] | [number, number, number, number];
  scale?: [number, number, number];
  // lodDistances?: number[];
  // moveSpeed?: number;
}

export interface ModelData {
  name?: string;
  path: string;
  position?: [number, number, number];
  rotation?: [number, number, number] | [number, number, number, number];
  scale?: [number, number, number];
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
  // splatAsset: string;
  // orientation: [number, number, number];
  // lodDistances?: number[];
  // moveSpeed?: number;
  // portals?: PortalData[];
  // viewpoints?: ViewpointData[];
  splats?: SplatData[];
  models?: ModelData[];
  // labels?: LabelData[];
  // scripts?: string[];
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