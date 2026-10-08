import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PANEL_STATE,
  loadPanelState,
  parsePanelState,
  savePanelState,
  serializePanelState,
} from './storage';

describe('parsePanelState', () => {
  it('returns defaults when nothing stored', () => {
    expect(parsePanelState(null)).toEqual(DEFAULT_PANEL_STATE);
  });

  it('round-trips a serialized state', () => {
    const state = { x: 120, y: 340, collapsed: true };
    expect(parsePanelState(serializePanelState(state))).toEqual(state);
  });

  it('falls back to defaults on corrupt JSON', () => {
    expect(parsePanelState('{not json')).toEqual(DEFAULT_PANEL_STATE);
  });

  it('falls back per-field on wrong types', () => {
    const parsed = parsePanelState(JSON.stringify({ x: 'oops', y: 50, collapsed: 1 }));
    expect(parsed).toEqual({ x: DEFAULT_PANEL_STATE.x, y: 50, collapsed: false });
  });
});

describe('load/save with a storage-like object', () => {
  it('persists and reloads', () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
    };
    savePanelState(storage, { x: 1, y: 2, collapsed: true });
    expect(loadPanelState(storage)).toEqual({ x: 1, y: 2, collapsed: true });
  });
});
