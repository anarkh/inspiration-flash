import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const scenePath = resolve(projectRoot, "cocos/assets/InfiniteFlow.scene.scene");
const sceneMetaPath = `${scenePath}.meta`;
const scriptPath = resolve(projectRoot, "cocos/assets/scripts/InfiniteFlowApp.ts");
const scriptMetaPath = `${scriptPath}.meta`;
const forbiddenAssetShim = resolve(
  projectRoot,
  "cocos/assets/scripts/cc.d.ts",
);
const base64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function fail(message) {
  throw new Error(`Cocos scene verification failed: ${message}`);
}

function requireJson(path) {
  if (!existsSync(path)) fail(`missing ${path}`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`invalid JSON ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function compressScriptUuid(uuid) {
  const normalized = uuid.replaceAll("-", "");
  if (!/^[0-9a-fA-F]{32}$/.test(normalized)) {
    fail(`invalid script UUID ${uuid}`);
  }
  let index = 5;
  let compressed = normalized.slice(0, index);
  while (index < normalized.length) {
    const first = Number.parseInt(normalized[index], 16);
    const second = Number.parseInt(normalized[index + 1], 16);
    const third = Number.parseInt(normalized[index + 2], 16);
    compressed += base64[(first << 2) | (second >> 2)];
    compressed += base64[((second & 3) << 4) | third];
    index += 3;
  }
  return compressed;
}

if (existsSync(forbiddenAssetShim)) {
  fail("headless cc.d.ts must stay outside cocos/assets");
}
if (!existsSync(scriptPath)) fail(`missing ${scriptPath}`);

const scene = requireJson(scenePath);
const sceneMeta = requireJson(sceneMetaPath);
const scriptMeta = requireJson(scriptMetaPath);
if (!Array.isArray(scene)) fail("scene root must be an array");
if (sceneMeta.importer !== "scene") fail("scene meta importer is not scene");
if (scriptMeta.importer !== "typescript") {
  fail("InfiniteFlowApp meta importer is not typescript");
}

const sceneAsset = scene.find((entry) => entry?.__type__ === "cc.SceneAsset");
const sceneObject = scene.find((entry) => entry?.__type__ === "cc.Scene");
if (sceneAsset === undefined || sceneObject === undefined) {
  fail("missing cc.SceneAsset or cc.Scene");
}
if (sceneAsset.scene?.__id__ !== scene.indexOf(sceneObject)) {
  fail("SceneAsset does not reference the serialized Scene object");
}
if (sceneMeta.uuid !== sceneObject._id) {
  fail("scene meta UUID does not match scene _id");
}

const canvases = scene.filter((entry) => entry?.__type__ === "cc.Canvas");
if (canvases.length !== 1) fail(`expected one cc.Canvas, found ${canvases.length}`);
const canvasNodeId = canvases[0].node?.__id__;
const canvasNode = scene[canvasNodeId];
if (canvasNode?.__type__ !== "cc.Node" || canvasNode._name !== "Canvas") {
  fail("cc.Canvas is not attached to the Canvas node");
}

const expectedScriptType = compressScriptUuid(scriptMeta.uuid);
const scriptComponents = scene.filter(
  (entry) => entry?.__type__ === expectedScriptType,
);
if (scriptComponents.length !== 1) {
  fail(`expected one InfiniteFlowApp component, found ${scriptComponents.length}`);
}
if (scriptComponents[0].node?.__id__ !== canvasNodeId) {
  fail("InfiniteFlowApp is not attached to the Canvas node");
}

const customComponents = scene.filter(
  (entry) => typeof entry?.__type__ === "string" && !entry.__type__.startsWith("cc."),
);
if (
  customComponents.length !== 1
  || customComponents[0].__type__ !== expectedScriptType
) {
  fail("scene contains an unexpected custom component");
}

// The WeChat main package is capped at 4 MiB. Two things keep the engine and its built-in assets small:
// the scene must not reference the default skybox cubemaps, and the engine is cropped to the modules the
// 2D game uses (Creator falls back to every module when this list is missing).
const skybox = scene.find((entry) => entry?.__type__ === "cc.SkyboxInfo");
for (const field of ["_envmap", "_envmapHDR", "_envmapLDR"]) {
  if (skybox?.[field] != null) fail(`scene skybox ${field} must stay empty to keep cubemaps out of the main package`);
}
const engineModulesPath = resolve(projectRoot, "cocos/settings/v2/packages/engine.json");
const engineModules = requireJson(engineModulesPath).modules;
const includedEngineModules = engineModules?.configs?.[engineModules.globalConfigKey]?.includeModules;
const expectedEngineModules = [
  "2d", "affine-transform", "base", "custom-pipeline", "gfx-webgl", "graphics", "mask", "profiler", "ui",
];
if (JSON.stringify(includedEngineModules) !== JSON.stringify(expectedEngineModules)) {
  fail(`engine modules must be exactly ${expectedEngineModules.join(", ")}; found ${JSON.stringify(includedEngineModules)}`);
}

console.log(JSON.stringify({
  status: "COCOS_SCENE_VALID",
  sceneUuid: sceneMeta.uuid,
  scriptUuid: scriptMeta.uuid,
  scriptType: expectedScriptType,
  canvasComponents: canvasNode._components?.length ?? 0,
  engineModules: includedEngineModules.length,
}, null, 2));
