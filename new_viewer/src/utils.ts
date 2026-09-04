import * as pc from "playcanvas";
import { ElementsData, SceneMode, SceneParams, UiElementName } from "./types";

export function setMobileViewport(): void {
  let meta = document.querySelector(
    'meta[name="viewport"]',
  ) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "viewport";
    document.head.appendChild(meta);
  }
  meta.content =
    "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
}

export function getSceneParams(): SceneParams {
  const params = new URLSearchParams(window.location.search);
  let lod = parseInt(params.get("lod") || "3", 10);
  const modeParam = params.get("mode");
  const mode: SceneMode =
    modeParam === "advanced" || modeParam === "debug" ? modeParam : "normal";
  lod = Math.max(0, Math.min(3, isNaN(lod) ? 3 : lod));

  return {
    scene: params.get("scene") || "",
    hasCamArgs: params.has("cx"),
    camPos: new pc.Vec3(
      parseFloat(params.get("cx") || "0"),
      parseFloat(params.get("cy") || "0"),
      parseFloat(params.get("cz") || "2.5"),
    ),
    camLookAt: new pc.Vec3(
      parseFloat(params.get("lx") || "0"),
      parseFloat(params.get("ly") || "0"),
      parseFloat(params.get("lz") || "0"),
    ),
    lod,
    mode,
  };
}

export function isUiElementVisible(
  elementsData: ElementsData,
  elementName: UiElementName,
  mode: SceneMode,
): boolean {
  const visibleInModes = elementsData.ui?.[elementName]?.visibleInModes;
  return Boolean(visibleInModes?.includes(mode));
}

export function toUrlPath(path: string): string {
  return path.replace(/\\/g, "/");
}
