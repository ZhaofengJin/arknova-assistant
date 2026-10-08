/** 悬浮面板空壳:创建、拖动、折叠,状态持久化。M1 起在这里渲染记牌数据。 */

import { loadPanelState, savePanelState, type PanelState } from './storage';

const PANEL_ID = 'arknova-assistant-panel';

export interface PanelHandle {
  body: HTMLElement;
  /** 替换面板内容(html 需已转义) */
  update(html: string): void;
}

export function mountPanel(doc: Document = document, storage: Storage = window.localStorage): PanelHandle | null {
  if (doc.getElementById(PANEL_ID)) return null; // 防重复注入

  const state = loadPanelState(storage);

  const root = doc.createElement('div');
  root.id = PANEL_ID;

  const header = doc.createElement('div');
  header.className = 'ana-header';
  const title = doc.createElement('span');
  title.textContent = '方舟助手';
  const toggle = doc.createElement('button');
  toggle.type = 'button';
  toggle.className = 'ana-toggle';
  header.append(title, toggle);

  const body = doc.createElement('div');
  body.className = 'ana-body';
  body.textContent = '等待对局日志…';

  root.append(header, body);
  doc.body.append(root);

  applyState(root, body, toggle, state);
  wireToggle(toggle, root, body, state, storage);
  wireDrag(header, root, state, storage);

  return { body, update(html: string) { body.innerHTML = html; } };
}

function applyState(root: HTMLElement, body: HTMLElement, toggle: HTMLButtonElement, state: PanelState): void {
  root.style.left = `${state.x}px`;
  root.style.top = `${state.y}px`;
  body.style.display = state.collapsed ? 'none' : '';
  toggle.textContent = state.collapsed ? '展开' : '收起';
  toggle.setAttribute('aria-expanded', String(!state.collapsed));
}

function wireToggle(
  toggle: HTMLButtonElement,
  root: HTMLElement,
  body: HTMLElement,
  state: PanelState,
  storage: Storage,
): void {
  toggle.addEventListener('click', () => {
    state.collapsed = !state.collapsed;
    applyState(root, body, toggle, state);
    savePanelState(storage, state);
  });
}

function wireDrag(header: HTMLElement, root: HTMLElement, state: PanelState, storage: Storage): void {
  header.addEventListener('pointerdown', (down) => {
    if ((down.target as HTMLElement).tagName === 'BUTTON') return; // 让折叠按钮正常点击
    const offsetX = down.clientX - state.x;
    const offsetY = down.clientY - state.y;

    const onMove = (move: PointerEvent): void => {
      state.x = Math.max(0, move.clientX - offsetX);
      state.y = Math.max(0, move.clientY - offsetY);
      root.style.left = `${state.x}px`;
      root.style.top = `${state.y}px`;
    };
    const onUp = (): void => {
      header.ownerDocument.removeEventListener('pointermove', onMove);
      header.ownerDocument.removeEventListener('pointerup', onUp);
      savePanelState(storage, state);
    };
    header.ownerDocument.addEventListener('pointermove', onMove);
    header.ownerDocument.addEventListener('pointerup', onUp);
  });
}
