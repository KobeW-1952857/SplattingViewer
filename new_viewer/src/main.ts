// @ts-ignore: allow side-effect CSS import without type declarations
import "./style.css";
import * as pc from "playcanvas";
import {
  setMobileViewport,
  getSceneParams,
  isUiElementVisible,
  toUrlPath,
} from "./utils";
import { ModelData, SceneData, ElementsData, GroupData } from "./types";
import { createCamera } from "./camera";
import { createOverlayUI } from "./ui";
import { setupSceneEnvironment } from "./scene-elements";

window.pc = pc;

/** Wraps AssetListLoader in a promise so it can be awaited. */
function loadAssets(
  app: pc.Application,
  assets: pc.Asset[] | Record<string, pc.Asset>,
): Promise<void> {
  const list = Array.isArray(assets) ? assets : Object.values(assets);
  return new Promise((resolve) =>
    new pc.AssetListLoader(list, app.assets).load(resolve),
  );
}

function createApp(): { app: pc.Application; canvas: HTMLCanvasElement } {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);

  const mouse = new pc.Mouse(document.body);
  const touch = new pc.TouchDevice(document.body);

  const app = new pc.Application(canvas, {
    mouse,
    touch,
    elementInput: new pc.ElementInput(canvas, {
      useMouse: true,
      useTouch: true,
    }),
    graphicsDeviceOptions: { antialias: false },
  });

  // Re-evaluate splat LOD while rotating instead of waiting for camera movement.
  app.scene.gsplat.lodUpdateAngle = 1;

  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.start();

  window.addEventListener("resize", () => app.resizeCanvas());

  return { app, canvas };
}

async function loadSceneData(
  app: pc.Application,
  sceneName: string,
): Promise<[string, SceneData, ElementsData]> {
  const basePath = `Assets/Scenes/${sceneName}`;

  const assets = [
    new pc.Asset("scene-data", "json", {
      url: `${basePath}/scene.json`,
    }),
    new pc.Asset("elements-data", "json", {
      url: `${basePath}/elements.json`,
    }),
  ];
  await loadAssets(app, assets);
  return [
    basePath,
    assets[0].resource as SceneData,
    assets[1].resource as ElementsData,
  ];
}

/** Builds the map of assets to load (splat model, font, portal images, viewpoint icons, obj/glb models). */
function buildAssetMap(
  basePath: string,
  sceneData: SceneData,
): {
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
      { url: `${basePath}/${toUrlPath(splatDef.path)}` }, // Will fail, path currently relative to scene.json file, not to Assets folder
    );

    splatAsset.on("error", (err: unknown) => {
      console.error(
        `Error loading splat asset: ${splatAsset.name}, URL: ${splatAsset.getFileUrl()}`,
        err,
      );
    });

    assets[`splat-${index}`] = splatAsset;
    splatAssets.push(splatAsset);
  });

  const modelAssets: pc.Asset[] = [];
  sceneData.models?.forEach((modelDef, index) => {
    const ext = pc.path.getExtension(modelDef.path).toLowerCase();
    const type = ext === ".glb" || ext === ".gltf" ? "container" : "model";
    const modelAsset = new pc.Asset(modelDef.name || `model-${index}`, type, {
      url: `${basePath}/${toUrlPath(modelDef.path)}`,
    });

    modelAsset.on("error", (err: unknown) => {
      console.error(
        `Error loading model asset: ${modelAsset.name}, URL: ${modelAsset.getFileUrl()}`,
        err,
      );
    });

    assets[`model-${index}`] = modelAsset;
    modelAssets.push(modelAsset);
  });

  return { assets, splatAssets, modelAssets };
}

function applyEntityTransform(
  entity: pc.Entity,
  position: number[] | undefined,
  rotation: number[] | undefined,
  scale: number[] | undefined,
): void {
  const p = position || [0, 0, 0];
  entity.setLocalPosition(p[0], p[1], p[2]);

  const r = rotation || [0, 0, 0];
  if (r.length === 4) {
    entity.setLocalRotation(new pc.Quat(r[0], r[1], r[2], r[3]).normalize());
  } else {
    entity.setLocalEulerAngles(r[0], r[1], r[2]);
  }

  const s = scale || [1, 1, 1];
  entity.setLocalScale(s[0], s[1], s[2]);
}

function createModelEntities(
  app: pc.Application,
  models: ModelData[] | undefined,
  objModelAssets: pc.Asset[],
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

    applyEntityTransform(
      entity,
      modelDef.position,
      modelDef.rotation,
      modelDef.scale,
    );
    // entity.rotateLocal(0, 90, 0);

    app.root.addChild(entity);
    modelEntities.push(entity);
  });

  return modelEntities;
}

function createSplatEntities(
  app: pc.Application,
  sceneData: SceneData,
  splatAssets: pc.Asset[],
): pc.Entity[] {
  const splatEntities: pc.Entity[] = [];

  sceneData.splats?.forEach((splatDef, index) => {
    const asset = splatAssets[index];
    const entity = new pc.Entity(splatDef.name || `Splat-${index}`);

    const gsplatOptions: any = { asset, unified: true };
    if (splatDef.lodFalloff !== undefined)
      gsplatOptions.lodFalloff = splatDef.lodFalloff;
    if (splatDef.lodRangeMin !== undefined)
      gsplatOptions.lodRangeMin = splatDef.lodRangeMin;
    if (splatDef.lodRangeMax !== undefined)
      gsplatOptions.lodRangeMax = splatDef.lodRangeMax;

    const gsplat = entity.addComponent(
      "gsplat",
      gsplatOptions,
    ) as pc.GSplatComponent;

    const scale = splatDef.scale ? [...splatDef.scale] : [1, 1, 1];

    applyEntityTransform(entity, splatDef.position, splatDef.rotation, scale);

    app.root.addChild(entity);
    splatEntities.push(entity);
  });

  return splatEntities;
}

function createEntityHierarchy(
  app: pc.Application,
  groups: Record<string, GroupData> | undefined,
  entities: Record<string, pc.Entity>,
): Record<string, pc.Entity> {
  if (!groups) {
    return entities;
  }

  const groupEntities: Record<string, pc.Entity> = {};

  Object.entries(groups).forEach(([groupName, groupData]) => {
    const groupEntity = new pc.Entity(groupName);
    groupEntity.enabled = groupData.enabled;
    app.root.addChild(groupEntity);
    groupEntities[groupName] = groupEntity;
  });

  Object.entries(groups).forEach(([groupName, groupData]) => {
    const groupEntity = groupEntities[groupName];

    groupData.elements.forEach((elementName) => {
      const entity = entities[elementName];
      if (!entity) {
        console.warn(
          `Group "${groupName}" references missing entity "${elementName}"`,
        );
        return;
      }

      groupEntity.addChild(entity);
    });
  });

  return { ...entities, ...groupEntities };
}

function createDebugPanel(
  app: pc.Application,
  entities: Record<string, pc.Entity>,
): void {
  (window as any).sceneEntities = entities;
  console.log(
    "Scene entities exposed on window.sceneEntities - e.g. sceneEntities['GrassClump4'].enabled = false",
  );

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

  const sceneEntities = new Set(Object.values(entities));
  type PanelNode = {
    entity: pc.Entity;
    checkbox: HTMLInputElement;
    children: PanelNode[];
  };

  const updateNodeState = (node: PanelNode, parentEnabled: boolean): void => {
    node.checkbox.disabled = !parentEnabled;
    node.checkbox.checked = node.entity.enabled;

    const enabled = parentEnabled && node.entity.enabled;
    node.children.forEach((child) => updateNodeState(child, enabled));
  };

  const appendEntityRow = (entity: pc.Entity, depth: number): PanelNode => {
    const row = document.createElement("label");
    row.style.cssText =
      `display: flex; align-items: center; gap: 6px; margin-bottom: 4px; ` +
      `padding-left: ${depth * 16}px; cursor: pointer;`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = entity.enabled;

    const label = document.createElement("span");
    label.textContent = entity.name;

    row.append(checkbox, label);
    panel.appendChild(row);

    const node: PanelNode = { entity, checkbox, children: [] };
    checkbox.addEventListener("change", () => {
      entity.enabled = checkbox.checked;
      updateNodeState(node, entity.parent?.enabled ?? true);
    });

    node.children = entity.children
      .filter((child): child is pc.Entity =>
        sceneEntities.has(child as pc.Entity),
      )
      .map((child) => appendEntityRow(child, depth + 1));

    return node;
  };

  const rootNodes = Array.from(sceneEntities)
    .filter((entity) => entity.parent === app.root)
    .map((entity) => appendEntityRow(entity, 0));

  rootNodes.forEach((node) => updateNodeState(node, true));

  document.body.appendChild(panel);
}

async function showSceneSelection() {
  const sceneModules = import.meta.glob("/public/Assets/Scenes/*/scene.json");
  const folders = Object.keys(sceneModules).map((path) => {
    const parts = path.split("/");
    return parts[parts.length - 2];
  });

  const scenes = await Promise.all(
    folders.map(async (folder) => {
      try {
        const response = await fetch(`Assets/Scenes/${folder}/scene.json`);
        if (response.ok) {
          const data = await response.json();
          return { folder, name: data.name || folder };
        }
      } catch (e) {
        console.warn("Failed to load scene data for", folder);
      }
      return { folder, name: folder };
    }),
  );

  const container = document.createElement("div");
  container.className = "scene-selection-container";

  const title = document.createElement("h1");
  title.textContent = "Select a Scene";
  container.appendChild(title);

  const buttonContainer = document.createElement("div");
  buttonContainer.className = "scene-buttons";

  scenes.forEach((scene) => {
    const btn = document.createElement("button");
    btn.className = "scene-button";
    btn.onclick = () => {
      window.location.href = `/?scene=${encodeURIComponent(scene.folder)}`;
    };

    const img = document.createElement("img");
    img.className = "scene-image";
    img.src = `Assets/Scenes/${scene.folder}/preview.png`;
    img.onerror = () => {
      if (img.src.endsWith("preview.png")) {
        img.src = `Assets/Scenes/${scene.folder}/preview.jpg`;
      } else if (img.src.endsWith("preview.jpg")) {
        img.src =
          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="100%" height="100%" fill="%23ddd"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20px" fill="%23777">No Preview</text></svg>';
        img.onerror = null;
      }
    };
    img.alt = scene.name;

    const label = document.createElement("span");
    label.className = "scene-label";
    label.textContent = scene.name;

    btn.appendChild(img);
    btn.appendChild(label);
    buttonContainer.appendChild(btn);
  });

  container.appendChild(buttonContainer);
  document.body.appendChild(container);

  const uiContainer = document.getElementById("ui-container");
  if (uiContainer) uiContainer.style.display = "none";
  const modeMenu = document.getElementById("mode-menu");
  if (modeMenu) modeMenu.style.display = "none";
}

async function bootstrap() {
  setMobileViewport();
  const sceneParams = getSceneParams();

  if (!sceneParams.scene) {
    showSceneSelection();
    return;
  }

  const { app } = createApp();

  const [basePath, sceneData, elementsData] = await loadSceneData(
    app,
    sceneParams.scene,
  );
  console.log("Loaded scene data:", sceneData, elementsData);

  const { assets, splatAssets, modelAssets } = buildAssetMap(
    basePath,
    sceneData,
  );
  await loadAssets(app, assets);

  // Setup Camera
  const camera = createCamera(app, sceneData, elementsData.camera, sceneParams);

  // Setup Models
  const modelEntities = createModelEntities(app, sceneData.models, modelAssets);
  const splatEntities = createSplatEntities(app, sceneData, splatAssets);

  const sceneEntities = createEntityHierarchy(app, elementsData.groups, {
    ...Object.fromEntries(modelEntities.map((entity) => [entity.name, entity])),
    ...Object.fromEntries(splatEntities.map((entity) => [entity.name, entity])),
  });

  const debugPanelSupported = Boolean(
    elementsData.ui?.debugPanel?.visibleInModes?.length,
  );
  if (debugPanelSupported) createDebugPanel(app, sceneEntities);

  // Setup UI after all persistent scene elements exist so mode changes can toggle them in place.
  createOverlayUI(app, camera, sceneData, elementsData, sceneParams);

  // Setup Environment (Light)
  setupSceneEnvironment(app);
}

bootstrap().catch((err) => console.error("Initialization error:", err));
