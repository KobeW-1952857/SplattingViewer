import * as pc from "playcanvas";
// @ts-ignore
import { CameraControls } from "playcanvas/scripts/esm/camera-controls.mjs";
// @ts-ignore
import { TranslateGizmo, RotateGizmo, ScaleGizmo } from "playcanvas";
import { state } from "./state";
import { updateTransformUI } from "./ui";

export let translateGizmo: any;
export let rotateGizmo: any;
export let scaleGizmo: any;

export function initEngine(canvas: HTMLCanvasElement) {
  state.app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    keyboard: new pc.Keyboard(window),
    graphicsDeviceOptions: {
      alpha: false,
      depth: true,
      antialias: true,
      powerPreference: "high-performance",
    },
  });
  state.app.start();
  state.app.setCanvasFillMode(pc.FILLMODE_NONE);
  state.app.setCanvasResolution(pc.RESOLUTION_AUTO);
  state.app.resizeCanvas();

  window.addEventListener("resize", () => state.app!.resizeCanvas());
  const resizeObserver = new ResizeObserver(() => state.app!.resizeCanvas());
  resizeObserver.observe(canvas);

  const light = new pc.Entity("DirectionalLight");
  light.addComponent("light", {
    type: "directional",
    color: new pc.Color(1, 1, 1),
    castShadows: false,
    intensity: 1,
  });
  light.setEulerAngles(45, 30, 0);
  state.app.root.addChild(light);

  state.cameraEntity = new pc.Entity("Camera");
  state.cameraEntity.addComponent("camera", {
    clearColor: new pc.Color(0.2, 0.2, 0.2),
  });
  state.cameraEntity.addComponent("script");
  state.app.root.addChild(state.cameraEntity);
  state.cameraEntity.setPosition(0, 2, 5);

  state.app.scripts.add(CameraControls);
  const controls = state.cameraEntity.script!.create("cameraControls") as any;

  setupGizmos(controls);
}

function setupGizmos(controls: any) {
  const gizmoLayer = new pc.Layer({
    name: "Gizmo",
    clearDepthBuffer: true,
    opaqueSortMode: pc.SORTMODE_NONE,
    transparentSortMode: pc.SORTMODE_NONE,
  });
  state.app!.scene.layers.push(gizmoLayer);
  state.cameraEntity!.camera!.layers =
    state.cameraEntity!.camera!.layers.concat([gizmoLayer.id]);

  translateGizmo = new TranslateGizmo(state.cameraEntity!.camera!, gizmoLayer);
  rotateGizmo = new RotateGizmo(state.cameraEntity!.camera!, gizmoLayer);
  scaleGizmo = new ScaleGizmo(state.cameraEntity!.camera!, gizmoLayer);

  const onTransformMove = () => updateTransformUI();
  const onTransformStart = () => {
    controls.enabled = false;
  };
  const onTransformEnd = () => {
    controls.enabled = true;
  };

  [translateGizmo, rotateGizmo, scaleGizmo].forEach((gizmo) => {
    gizmo.on("transform:move", onTransformMove);
    gizmo.on("transform:start", onTransformStart);
    gizmo.on("transform:end", onTransformEnd);
  });

  state.activeGizmo = translateGizmo;
}
