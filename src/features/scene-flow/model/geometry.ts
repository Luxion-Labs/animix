export const SCENE_NODE_WIDTH_PERCENT = 9;
export const SCENE_NODE_MIN_WIDTH_PERCENT = 6;
export const SCENE_NODE_MAX_WIDTH_PERCENT = 16;
export const SCENE_NODE_HEIGHT_PERCENT = 10;

export function clampSceneFlowPercent(value: number) {
  return Math.min(108, Math.max(-8, value));
}

export function clampSceneNodeWidth(value: number) {
  return Math.min(SCENE_NODE_MAX_WIDTH_PERCENT, Math.max(SCENE_NODE_MIN_WIDTH_PERCENT, value));
}

export function clampSceneNodeX(value: number, width = SCENE_NODE_WIDTH_PERCENT) {
  return Math.min(100 - width, Math.max(0, value));
}

export function clampSceneNodeY(value: number) {
  return Math.min(100 - SCENE_NODE_HEIGHT_PERCENT, Math.max(0, value));
}
