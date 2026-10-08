/** 面板状态在 localStorage 的读写。纯数据逻辑,不碰 DOM,便于测试。 */

export interface PanelState {
  x: number;
  y: number;
  collapsed: boolean;
}

export const DEFAULT_PANEL_STATE: PanelState = { x: 16, y: 16, collapsed: false };

const STORAGE_KEY = 'arknova-assistant:panel';

export function parsePanelState(raw: string | null): PanelState {
  if (raw === null) return { ...DEFAULT_PANEL_STATE };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_PANEL_STATE };
    const p = parsed as Record<string, unknown>;
    return {
      x: typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : DEFAULT_PANEL_STATE.x,
      y: typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : DEFAULT_PANEL_STATE.y,
      collapsed: typeof p.collapsed === 'boolean' ? p.collapsed : DEFAULT_PANEL_STATE.collapsed,
    };
  } catch {
    return { ...DEFAULT_PANEL_STATE };
  }
}

export function serializePanelState(state: PanelState): string {
  return JSON.stringify(state);
}

export function loadPanelState(storage: Pick<Storage, 'getItem'>): PanelState {
  return parsePanelState(storage.getItem(STORAGE_KEY));
}

export function savePanelState(storage: Pick<Storage, 'setItem'>, state: PanelState): void {
  storage.setItem(STORAGE_KEY, serializePanelState(state));
}

/** 评分权重的持久化(工单 06:配置文件默认值 + 面板可调) */

import { DEFAULT_WEIGHTS, type Weights } from './advisor/scoring';

const WEIGHTS_KEY = 'arknova-assistant:weights';

export function parseWeights(raw: string | null): Weights {
  if (raw === null) return { ...DEFAULT_WEIGHTS };
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    const pick = (k: keyof Weights): number =>
      typeof p[k] === 'number' && Number.isFinite(p[k]) && (p[k] as number) >= 0
        ? (p[k] as number)
        : DEFAULT_WEIGHTS[k];
    return { synergy: pick('synergy'), efficiency: pick('efficiency'), conservation: pick('conservation') };
  } catch {
    return { ...DEFAULT_WEIGHTS };
  }
}

export function loadWeights(storage: Pick<Storage, 'getItem'>): Weights {
  return parseWeights(storage.getItem(WEIGHTS_KEY));
}

export function saveWeights(storage: Pick<Storage, 'setItem'>, weights: Weights): void {
  storage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
}
