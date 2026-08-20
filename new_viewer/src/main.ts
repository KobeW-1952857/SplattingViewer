// @ts-ignore: allow side-effect CSS import without type declarations
import "./style.css";
import * as pc from "playcanvas";
import { setMobileViewport, getSceneParams, toUrlPath } from "./utils";
import { ModelData, SceneData, LabelWrapperEntity } from "./types";
import { createCamera, smoothCameraMove } from "./camera";
import { createOverlayUI } from "./ui";
import {
  createBillboard,
  createFloatingText,
  navigateToScene,
  setupSceneEnvironment,
} from "./scene-elements";

window.pc = pc;

/** Wraps AssetListLoader in a promise so it can be awaited. */
function loadAssets(app: pc.Application, assets: pc.Asset[] | Record<string, pc.Asset>): Promise<void> {
  const list = Array.isArray(assets) ? assets : Object.values(assets);
  return new Promise((resolve) => new pc.AssetListLoader(list, app.assets).load(resolve));
}

function createApp(): { app: pc.Application; canvas: HTMLCanvasElement } {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);

  const mouse = new pc.Mouse(document.body);
  const touch = new pc.TouchDevice(document.body);

  const app = new pc.Application(canvas, {
    mouse,
    touch,
    elementInput: new pc.ElementInput(canvas, { useMouse: true, useTouch: true }),
    graphicsDeviceOptions: { antialias: false },
  });

  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.start();

  window.addEventListener("resize", () => app.resizeCanvas());

  return { app, canvas };
}

async function loadSceneData(app: pc.Application, sceneName: string): Promise<[SceneData, string]> {
  const basePath = `Assets/Scenes/${sceneName}`;
  const jsonAsset = new pc.Asset("scene-data", "json", {
    url: `${basePath}/scene.json`,
  });
  await loadAssets(app, [jsonAsset]);
  return [jsonAsset.resource as SceneData, basePath];
}

/** Builds the map of assets to load (splat model, font, portal images, viewpoint icons, obj/glb models). */
function buildAssetMap(basePath: string, sceneData: SceneData): {
  assets: Record<string, pc.Asset>;
  splatAssets: pc.Asset[];
  modelAssets: pc.Asset[];
} {
  const assets: Record<string, pc.Asset> = {
    font: new pc.Asset("font", "font", { url: `Fonts/arial.json` }),
  };

  const splatAssets: pc.Asset[] = [];
  sceneData.splats?.forEach((splatDef, index) => {
    const splatAsset = new pc.Asset(
      splatDef.name || `splat-${index}`,
      "gsplat",
      { url: `${basePath}/${toUrlPath(splatDef.path)}` } // Will fail, path currently relative to scene.json file, not to Assets folder
    );

    splatAsset.on("error", (err: unknown) => {
      console.error(`Error loading splat asset: ${splatAsset.name}, URL: ${splatAsset.getFileUrl()}`, err);
    })

    assets[`splat-${index}`] = splatAsset;
    splatAssets.push(splatAsset);
  });
  

  const modelAssets: pc.Asset[] = [];
  sceneData.models?.forEach((modelDef, index) => {
    const ext = pc.path.getExtension(modelDef.path).toLowerCase();
    const type = ext === ".glb" || ext === ".gltf" ? "container" : "model";
    const modelAsset = new pc.Asset(modelDef.name || `model-${index}`, type, { url: `${basePath}/${toUrlPath(modelDef.path)}` });

    modelAsset.on("error", (err: unknown) => {
      console.error(`Error loading model asset: ${modelAsset.name}, URL: ${modelAsset.getFileUrl()}`, err);
    });

    assets[`model-${index}`] = modelAsset;
    modelAssets.push(modelAsset);
  });

  return { assets, splatAssets, modelAssets };
}

function createScreen(app: pc.Application): pc.Entity {
  const screen = new pc.Entity("Screen");
  screen.addComponent("screen", {
    referenceResolution: new pc.Vec2(1280, 780),
    scaleBlend: 0.5,
    scaleMode: pc.SCALEMODE_NONE,
    screenSpace: true,
  });
  app.root.addChild(screen);
  return screen;
}

function createModelEntities(
  app: pc.Application,
  models: ModelData[] | undefined,
  objModelAssets: pc.Asset[]
): pc.Entity[] {
  const modelEntities: pc.Entity[] = [];

  models?.forEach((modelDef, index) => {
    const asset = objModelAssets[index];
    let entity: pc.Entity;

    if (asset.type === "container") {
      entity = (asset.resource as any).instantiateRenderEntity();
      entity.name = modelDef.name || "GlbModel";
    } else {
      entity = new pc.Entity(modelDef.name || "ObjModel");
      entity.addComponent("model", { asset });
    }

    const p = modelDef.position || [0, 0, 0];
    entity.setPosition(p[0], p[1], p[2]);
    const r = modelDef.rotation || [0, 0, 0,1];
    entity.setRotation(r[0], r[1], r[2], r[3]);
    const s = modelDef.scale || [1, 1, 1];
    entity.setLocalScale(s[0], s[1], s[2]);

    app.root.addChild(entity);
    modelEntities.push(entity);
  });

  return modelEntities;
}

function createSplatEntities(
  app: pc.Application,
  sceneData: SceneData,
  splatAssets: pc.Asset[]
): pc.Entity[] {
  const splatEntities: pc.Entity[] = [];

  sceneData.splats?.forEach((splatDef, index) => {
    const asset = splatAssets[index];
    const entity = new pc.Entity(splatDef.name || `Splat-${index}`);
    entity.addComponent("gsplat", { asset, unified: true });

    const p = splatDef.position || [0, 0, 0];
    entity.setPosition(p[0], p[1], p[2]);
    const r = splatDef.rotation || [0, 0, 0, 1];
    entity.setRotation(r[0], r[1], r[2], r[3]);
    const s = splatDef.scale || [1, 1, 1];
    entity.setLocalScale(s[0], s[1], s[2]);

    (entity as any).gsplat.lodDistances = [5, 10, 25, 50, 65];
    app.root.addChild(entity);
    splatEntities.push(entity);
  });

  return splatEntities;
}

function createDebugPanel(entities: Record<string, pc.Entity>): void {
  (window as any).sceneEntities = entities;
  console.log("Scene entities exposed on window.sceneEntities - e.g. sceneEntities['GrassClump4'].enabled = false");
 
  const panel = document.createElement("div");
  panel.id = "debug-panel";
  panel.style.cssText = `
    position: fixed;
    bottom: 10px;
    left: 10px;
    z-index: 300;
    max-height: 60vh;
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.75);
    color: #fff;
    font: 12px monospace;
    padding: 10px 12px;
    border-radius: 6px;
  `;
 
  const title = document.createElement("div");
  title.textContent = "Scene Entities";
  title.style.cssText = "font-weight: bold; margin-bottom: 6px;";
  panel.appendChild(title);
 
  Object.entries(entities).forEach(([name, entity]) => {
    const row = document.createElement("label");
    row.style.cssText = "display: flex; align-items: center; gap: 6px; margin-bottom: 4px; cursor: pointer;";
 
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = entity.enabled;
    checkbox.addEventListener("change", () => {
      entity.enabled = checkbox.checked;
    });
 
    const label = document.createElement("span");
    label.textContent = name;
 
    row.append(checkbox, label);
    panel.appendChild(row);
  });
 
  document.body.appendChild(panel);
}

// function createPortalEntities(
//   app: pc.Application,
//   camera: pc.Entity,
//   screen: pc.Entity,
//   sceneData: SceneData,
//   portalAssets: pc.Asset[],
//   lod: number
// ): pc.Entity[] {
//   const portalEntities: pc.Entity[] = [];

//   sceneData.portals?.forEach((portalDef, index) => {
//     const pos = new pc.Vec3(...portalDef.position);
//     const entity = createBillboard(
//       app, camera, screen,
//       portalDef.name || "Portal",
//       portalAssets[index].resource,
//       screen,
//       () => navigateToScene(portalDef, lod),
//       pos,
//       {
//         minScale: portalDef.minScale,
//         maxScale: portalDef.maxScale,
//         minSizeDistance: portalDef.minSizeDistance,
//       }
//     );
//     portalEntities.push(entity);
//   });

//   return portalEntities;
// }

// function createViewpointEntities(
//   app: pc.Application,
//   camera: pc.Entity,
//   screen: pc.Entity,
//   sceneData: SceneData,
//   viewpointAssets: pc.Asset[]
// ): pc.Entity[] {
//   const viewpointEntities: pc.Entity[] = [];

//   sceneData.viewpoints?.forEach((vpDef, index) => {
//     const pos = new pc.Vec3(...vpDef.position);
//     const entity = createBillboard(
//       app, camera, screen,
//       vpDef.name || `Viewpoint-${index}`,
//       viewpointAssets[index]?.resource,
//       screen,
//       () => {
//         const targetPos = new pc.Vec3(...vpDef.targetPosition);
//         const targetLook = new pc.Vec3(...vpDef.targetLookAt);
//         smoothCameraMove(camera, sceneData, targetPos, targetLook);
//       },
//       pos,
//       {
//         minScale: vpDef.minScale ?? 0.4,
//         maxScale: vpDef.maxScale ?? 1.5,
//         minSizeDistance: vpDef.minSizeDistance ?? 50,
//       }
//     );
//     viewpointEntities.push(entity);
//   });

//   return viewpointEntities;
// }

// function createLabels(
//   app: pc.Application,
//   camera: pc.Entity,
//   screen: pc.Entity,
//   fontAsset: pc.Asset,
//   sceneData: SceneData
// ): Map<string, LabelWrapperEntity> {
//   const labels = new Map<string, LabelWrapperEntity>();

//   sceneData.labels?.forEach((labelData) => {
//     const textContent = labelData.text || "Label";
//     const pos = labelData.position || [0, 0, 0];
//     const fontSize = labelData.fontSize || 42;
//     const name = labelData.name || textContent;

//     const color = labelData.color
//       ? new pc.Color(labelData.color[0], labelData.color[1], labelData.color[2])
//       : new pc.Color(1, 1, 1);

//     const bgColor = labelData.bgColor
//       ? new pc.Color(
//           labelData.bgColor[0],
//           labelData.bgColor[1],
//           labelData.bgColor[2],
//           labelData.bgColor[3] ?? 0.6
//         )
//       : new pc.Color(0, 0, 0, 0.6);

//     const label = createFloatingText(
//       app, camera, screen, fontAsset, textContent,
//       new pc.Vec3(pos[0], pos[1], pos[2]),
//       fontSize, color, bgColor,
//       labelData.minScale ?? 0.4,
//       labelData.maxScale ?? 2.0,
//       labelData.minSizeDistance ?? 50
//     );
//     labels.set(name, label);
//   });

//   return labels;
// }

async function bootstrap() {
  setMobileViewport();
  const sceneParams = getSceneParams();

  const { app } = createApp();

  const [sceneData, basePath] = await loadSceneData(app, sceneParams.scene);

  const { assets, splatAssets, modelAssets } = buildAssetMap(basePath, sceneData);
  await loadAssets(app, assets);

  const screen = createScreen(app);

  // Setup Camera & UI
  const camera = createCamera(app, sceneData, sceneParams);
  createOverlayUI(app, camera, sceneData, sceneParams);

  // Setup Models
  const modelEntities = createModelEntities(app, sceneData.models, modelAssets);
  const splatEntities = createSplatEntities(app, sceneData, splatAssets);

  // if (new URLSearchParams(window.location.search).has("debug")) {
  createDebugPanel({
    ...Object.fromEntries(modelEntities.map((e) => [e.name, e])),
    ...Object.fromEntries(splatEntities.map((e) => [e.name, e])),
  });
// }

  // Setup Environment (Light)
  setupSceneEnvironment(app);

  // Setup Portals, Viewpoints & Labels
  // const portalEntities = createPortalEntities(app, camera, screen, sceneData, portalAssets, sceneParams.lod);
  // const viewpointEntities = createViewpointEntities(app, camera, screen, sceneData, viewpointAssets);
  // const labels = createLabels(app, camera, screen, assets.font, sceneData);

  // Scene Context Exposure for External Plugins
  // (app as any).sceneContext = {
  //   camera, labels, viewpointEntities, portalEntities,
  //   portals: portalEntities, modelEntities, sceneData, screen,
  //   createFloatingText: (
  //     text: string, pos: pc.Vec3, fontSize: number, color: pc.Color, bgColor: pc.Color
  //   ) => createFloatingText(app, camera, screen, assets.font, text, pos, fontSize, color, bgColor),
  // };

  // Load Custom Scene Scripts
  // if (sceneData.scripts) {
  //   const scriptAssets = sceneData.scripts.map(
  //     (url, i) => new pc.Asset(`custom-script-${i}`, "script", { url })
  //   );
  //   await loadAssets(app, scriptAssets);
  // }
}

bootstrap().catch((err) => console.error("Initialization error:", err));