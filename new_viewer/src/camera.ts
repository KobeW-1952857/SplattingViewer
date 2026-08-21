import * as pc from "playcanvas";
// @ts-ignore
import { CameraControls } from "playcanvas/scripts/esm/camera-controls.mjs";
import { CameraControlsInstance, CameraData, SceneData, SceneParams } from "./types";

// Add a flag to prevent double-registration warnings
let isRegistered = false;

export function createCamera(app: pc.Application, camera_data: CameraData | undefined, sceneParams: SceneParams): pc.Entity {
  // 1. Register the script HERE, ensuring the app already exists
  if (!isRegistered) {
    pc.registerScript(CameraControls, "cameraControls");
    isRegistered = true;
  }

  const camera = new pc.Entity("Camera");
  camera.addComponent("camera");
  camera.addComponent("script");

  const controls = camera.script!.create("cameraControls") as unknown as CameraControlsInstance;
  setCameraControlSettings(controls);

  app.root.addChild(camera);

  let c_p =  camera_data?.position || [1.0, 2.5, 0.0];
  let c_la = camera_data?.lookAt || [1.0, 2.5, 0.0];

  let c_pos = new pc.Vec3(...c_p);
  let c_look = new pc.Vec3(...c_la);

  if (sceneParams.hasCamArgs) {
    c_pos = sceneParams.camPos;
    c_look = sceneParams.camLookAt;
  }

  camera.setPosition(c_pos);
  camera.lookAt(c_look);

  const angles = camera.getEulerAngles();
  if (controls) {
    controls.look(c_look, false);
    controls.yaw = angles.y;
    controls.pitch = angles.x;
    controls.ey = angles.y;
    controls.ex = angles.x;
  }

  setupCameraKeyBindings(camera);

  return camera;
}

export function setCameraControlSettings(controls: CameraControlsInstance): void {
  if (!controls) return;
  controls.moveSlowSpeed = controls.moveSpeed * 0.5;
  controls.moveFastSpeed = controls.moveSpeed * 2;
  controls.enableOrbit = false;
  controls.enablePan = false;
}

export function smoothCameraMove(
  camera: pc.Entity,
  sceneData: SceneData,
  targetPos: pc.Vec3,
  targetLookAt: pc.Vec3
): void {
  if (camera.script && camera.script.has("cameraControls")) {
    camera.script.destroy("cameraControls");
  }

  const dummy = new pc.Entity();
  dummy.setPosition(targetPos);
  dummy.lookAt(targetLookAt);
  const endRot = dummy.getRotation().clone();
  dummy.destroy();

  const newControls = camera.script!.create("cameraControls") as unknown as CameraControlsInstance;

  camera.setPosition(targetPos);
  camera.setRotation(endRot);
  camera.syncHierarchy();

  if (newControls) {
    setCameraControlSettings(newControls);
    camera.lookAt(targetLookAt);
    
    const angles = camera.getEulerAngles();
    newControls.look(targetLookAt, false);
    newControls.yaw = angles.y;
    newControls.pitch = angles.x;
    newControls.ey = angles.y;
    newControls.ex = angles.x;
  }
}

function setupCameraKeyBindings(camera: pc.Entity): void {
  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "p") {
      const p = camera.getPosition();
      const r = camera.getEulerAngles();
      const f = camera.forward;

      console.log(`"targetCameraPosition": [${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}]`);
      console.log(`"rotation": [${r.x.toFixed(2)}, ${r.y.toFixed(2)}, ${r.z.toFixed(2)}]`);

      const lookAtX = p.x + f.x * 10;
      const lookAtY = p.y + f.y * 10;
      const lookAtZ = p.z + f.z * 10;
      console.log(`"targetCameraLookAt": [${lookAtX.toFixed(2)}, ${lookAtY.toFixed(2)}, ${lookAtZ.toFixed(2)}]`);
      console.log("-----------------------------------");
    }
  });
}