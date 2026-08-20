import * as pc from "playcanvas";
import { LabelData, LabelWrapperEntity, PortalData, SceneData } from "./types";
import { smoothCameraMove } from "./camera";

export function createBillboard(
  app: pc.Application,
  camera: pc.Entity,
  screen: pc.Entity,
  name: string,
  texture: pc.Texture,
  parent?: pc.Entity,
  onClick?: () => void,
  worldPos?: pc.Vec3,
  scaleConfig?: { minScale?: number; maxScale?: number; minSizeDistance?: number }
): pc.Entity {
  const entity = new pc.Entity(name);

  entity.addComponent("element", {
    type: pc.ELEMENTTYPE_IMAGE,
    texture: texture,
    pivot: new pc.Vec2(0.5, 0.5),
    anchor: new pc.Vec4(0, 0, 0, 0),
    width: 100,
    height: 100,
    useInput: true,
  });

  if (onClick) {
    entity.element!.on("mousedown", onClick);
    entity.element!.on("mouseenter", () => {
      document.body.style.cursor = "pointer";
    });
    entity.element!.on("mouseleave", () => {
      document.body.style.cursor = "default";
    });
  }

  if (parent) parent.addChild(entity);

  if (worldPos) {
    const screenPos = new pc.Vec3();
    const minScale = scaleConfig?.minScale ?? 0.4;
    const maxScale = scaleConfig?.maxScale ?? 2.0;
    const minSizeDist = scaleConfig?.minSizeDistance ?? 200;
    const refDistance = minScale * minSizeDist;

    const updateBillboard = () => {
      const camPos = camera.getPosition();
      const dist = camPos.distance(worldPos);

      camera.camera!.worldToScreen(worldPos, screenPos);

      if (screenPos.z > 0) {
        const scaleFactor = screen.screen!.scale;
        screenPos.x /= scaleFactor;
        screenPos.y /= scaleFactor;

        const refResY = screen.screen!.referenceResolution.y;
        screenPos.y = refResY - screenPos.y;

        entity.setLocalPosition(screenPos);

        let finalScale = refDistance / dist;
        finalScale = pc.math.clamp(finalScale, minScale, maxScale);

        entity.setLocalScale(finalScale, finalScale, finalScale);
        entity.enabled = true;
      } else {
        entity.enabled = false;
      }
    };

    app.on("prerender", updateBillboard);
    entity.on("destroy", () => app.off("prerender", updateBillboard));
  }

  return entity;
}

export function createFloatingText(
  app: pc.Application,
  camera: pc.Entity,
  screen: pc.Entity,
  fontAsset: pc.Asset,
  text: string,
  fixedWorldPos: pc.Vec3,
  fontSize: number,
  color: pc.Color,
  bgColor: pc.Color,
  minScale = 0.5,
  maxScale = 1.5,
  minSizeDistance = 50.0
): LabelWrapperEntity {
  const paddingH = 20;
  const paddingV = 10;
  const charWidthRatio = 0.6;
  const lineHeightMult = 1.0;

  const wrapper = new pc.Entity() as LabelWrapperEntity;
  wrapper.addComponent("element", {
    type: pc.ELEMENTTYPE_IMAGE,
    anchor: new pc.Vec4(0, 0, 0, 0),
    pivot: new pc.Vec2(0.5, 0.5),
    width: 100,
    height: 100,
    color: bgColor,
    opacity: (bgColor as any).a ?? 0.6,
  });
  screen.addChild(wrapper);

  const textEntity = new pc.Entity();
  textEntity.addComponent("element", {
    type: pc.ELEMENTTYPE_TEXT,
    pivot: new pc.Vec2(0.5, 0.5),
    anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
    fontAsset: fontAsset.id,
    fontSize: fontSize,
    lineHeight: fontSize * lineHeightMult,
    text: "",
    color: color,
    alignment: new pc.Vec2(0.5, 0.5),
  });
  wrapper.addChild(textEntity);

  wrapper.setText = (newString: string) => {
    textEntity.element!.text = newString;
    const lines = newString.split("\n");
    let maxLineLength = 0;
    lines.forEach((line) => {
      if (line.length > maxLineLength) maxLineLength = line.length;
    });

    const newWidth = maxLineLength * fontSize * charWidthRatio + paddingH * 2;
    const totalTextHeight = lines.length * (fontSize * lineHeightMult);
    const newHeight = totalTextHeight + paddingV * 2;

    wrapper.element!.width = newWidth;
    wrapper.element!.height = newHeight;
  };

  wrapper.setText(text);

  const screenPos = new pc.Vec3();
  const refDistance = minScale * minSizeDistance;

  const updateLabel = () => {
    const camPos = camera.getPosition();
    const dist = camPos.distance(fixedWorldPos);
    camera.camera!.worldToScreen(fixedWorldPos, screenPos);

    if (screenPos.z > 0) {
      const scaleFactor = screen.screen!.scale;
      screenPos.x /= scaleFactor;
      screenPos.y /= scaleFactor;
      const refResY = screen.screen!.referenceResolution.y;
      screenPos.y = refResY - screenPos.y;

      wrapper.setLocalPosition(screenPos);

      let finalScale = refDistance / dist;
      finalScale = pc.math.clamp(finalScale, minScale, maxScale);

      wrapper.setLocalScale(finalScale, finalScale, finalScale);
      wrapper.enabled = true;
    } else {
      wrapper.enabled = false;
    }
  };

  app.on("prerender", updateLabel);
  wrapper.on("destroy", () => app.off("prerender", updateLabel));

  return wrapper;
}

export function navigateToScene(data: PortalData, lod: number): void {
  const params = new URLSearchParams();
  params.set("scene", data.targetScene);
  params.set("cx", data.targetCameraPosition[0].toString());
  params.set("cy", data.targetCameraPosition[1].toString());
  params.set("cz", data.targetCameraPosition[2].toString());
  params.set("lx", data.targetCameraLookAt[0].toString());
  params.set("ly", data.targetCameraLookAt[1].toString());
  params.set("lz", data.targetCameraLookAt[2].toString());
  params.set("lod", lod.toString());
  window.location.href = `index.html?${params.toString()}`;
}

export function setupSceneEnvironment(
  app: pc.Application,
) {
  const light1 = new pc.Entity("Directional Light");
  light1.addComponent("light", {
    type: "directional",
    intensity: 0.9,
    castShadows: false,
  });
  light1.setEulerAngles(45, 210, 0);
  app.root.addChild(light1);
  app.scene.ambientLight = new pc.Color(0.4, 0.4, 0.4);
}