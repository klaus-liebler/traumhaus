import { LitElement, html, css, nothing } from 'lit';
import { Editor, type Entry, type Mode } from './editor';
import { HOUSES, type HouseDef } from './houses';
import { CATEGORIES, ITEMS, type Category } from './catalog';
import { COVERINGS, coveringThumb } from './textures';
import { renderHouseThumbs, renderItemThumbs } from './thumbs';

export class PmApp extends LitElement {
  static properties = {
    screen: { state: true },
    cat: { state: true },
    tick: { state: true },
    toastMsg: { state: true },
    ghost: { state: true },
    helpOpen: { state: true },
  };

  declare screen: 'select' | 'edit';
  declare cat: string;
  declare tick: number;
  declare toastMsg: string;
  declare ghost: { x: number; y: number; src: string } | null;
  declare helpOpen: boolean;

  private editor!: Editor;
  private house: HouseDef | null = null;
  private itemThumbs = new Map<string, string>();
  private coverThumbs = new Map<string, string>();
  private houseThumbs = new Map<string, string>();
  private toastTimer = 0;
  private dragInfo: { entry: Entry; sx: number; sy: number; active: boolean; src: string; id: number } | null = null;

  constructor() {
    super();
    this.screen = 'select';
    this.cat = 'wohnen';
    this.tick = 0;
    this.toastMsg = '';
    this.ghost = null;
    this.helpOpen = false;
    this.itemThumbs = renderItemThumbs(ITEMS);
    for (const c of COVERINGS) this.coverThumbs.set(c.id, coveringThumb(c));
    this.houseThumbs = renderHouseThumbs(HOUSES);
    window.addEventListener('pointermove', (e) => this.onDragMove(e));
    window.addEventListener('pointerup', (e) => this.onDragEnd(e));
    window.addEventListener('pointercancel', () => this.onDragCancel());
  }

  firstUpdated() {
    const vp = this.renderRoot.querySelector('#viewport') as HTMLElement;
    this.editor = new Editor(vp);
    const bump = () => (this.tick = this.tick + 1);
    for (const ev of ['change', 'selection', 'overlaps']) this.editor.addEventListener(ev, bump);
    this.editor.addEventListener('toast', (e) => this.toast((e as CustomEvent).detail));
    (window as unknown as { editor: Editor }).editor = this.editor;
    const params = new URLSearchParams(location.search);
    const h = HOUSES.find((x) => x.id === params.get('haus'));
    if (h) this.open(h);
  }

  private open(h: HouseDef) {
    this.house = h;
    this.screen = 'edit';
    this.updateComplete.then(() => {
      this.editor.loadHouse(h);
      window.dispatchEvent(new Event('resize'));
    });
  }

  private toast(msg: string) {
    this.toastMsg = msg;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toastMsg = ''), 2200);
  }

  // ---------- Ziehen aus dem Katalog ----------
  private onTileDown(e: PointerEvent, entry: Entry, src: string) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this.dragInfo = { entry, sx: e.clientX, sy: e.clientY, active: false, src, id: e.pointerId };
  }

  private overCanvas(x: number, y: number) {
    const vp = this.renderRoot.querySelector('#viewport') as HTMLElement;
    const r = vp.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
    for (const sel of ['.catalog', '.topbar', '.selbar', '.pad']) {
      const el = this.renderRoot.querySelector(sel) as HTMLElement | null;
      if (!el) continue;
      const b = el.getBoundingClientRect();
      if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) return false;
    }
    return true;
  }

  private onDragMove(e: PointerEvent) {
    const d = this.dragInfo;
    if (!d || e.pointerId !== d.id) return;
    if (!d.active) {
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (Math.hypot(dx, dy) < 8) return;
      if (e.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx) * 1.5) {
        this.dragInfo = null; // vertikales Scrollen im Katalog
        return;
      }
      d.active = true;
      this.editor.beginCatalogDrag(d.entry);
    }
    const over = this.overCanvas(e.clientX, e.clientY);
    this.editor.updateCatalogDrag(e.clientX, e.clientY, over);
    this.ghost = over && d.entry.kind === 'item' ? null : { x: e.clientX, y: e.clientY, src: d.src };
  }

  private onDragEnd(e: PointerEvent) {
    const d = this.dragInfo;
    if (!d || e.pointerId !== d.id) return;
    this.dragInfo = null;
    this.ghost = null;
    if (d.active) this.editor.endCatalogDrag(e.clientX, e.clientY, this.overCanvas(e.clientX, e.clientY));
    else this.editor.placeAtCenter(d.entry);
  }

  private onDragCancel() {
    if (this.dragInfo?.active) this.editor.cancelPreview();
    this.dragInfo = null;
    this.ghost = null;
  }

  // ---------- Render ----------
  render() {
    return html`
      ${this.screen === 'select' ? this.renderSelect() : nothing}
      <div class="editor" ?hidden=${this.screen !== 'edit'}>
        <div id="viewport"></div>
        ${this.screen === 'edit' && this.editor ? this.renderEditorUI() : nothing}
      </div>
      ${this.ghost ? html`<img class="ghost" src=${this.ghost.src} style="left:${this.ghost.x}px;top:${this.ghost.y}px" />` : nothing}
      ${this.toastMsg ? html`<div class="toast">${this.toastMsg}</div>` : nothing}
    `;
  }

  private renderSelect() {
    return html`
      <div class="select">
        <h1>🏡 Mein Traumhaus-Planer</h1>
        <p class="sub">Such dir ein Haus aus – dann richtest du es ganz nach deinem Geschmack ein!</p>
        <div class="cards">
          ${HOUSES.map(
            (h) => html`
              <button class="card" @click=${() => this.open(h)}>
                <img src=${this.houseThumbs.get(h.id) ?? ''} alt="" />
                <div class="cardbody">
                  <h2>${h.emoji} ${h.name}</h2>
                  <p>${h.description}</p>
                  <span class="go">${this.editor?.hasSave(h.id) ? 'Weiter einrichten ➜' : 'Einziehen ➜'}</span>
                </div>
              </button>
            `,
          )}
        </div>
      </div>
    `;
  }

  private renderEditorUI() {
    const ed = this.editor;
    const levels = ed.house?.levels ?? 1;
    const modeBtn = (m: Mode, icon: string, label: string) =>
      html`<button class="tb ${ed.mode === m ? 'on' : ''}" @click=${() => ed.setMode(m)} title=${label}><span>${icon}</span>${label}</button>`;
    return html`
      <div class="topbar">
        <button class="tb back" @click=${() => { ed.save(); this.screen = 'select'; }}>⬅ Häuser</button>
        <div class="title">${this.house?.emoji} ${this.house?.name}</div>
        <div class="group">
          ${modeBtn('drone', '🚁', 'Drohne')} ${modeBtn('third', '🧍', 'Figur')} ${modeBtn('ego', '👀', 'Ich-Sicht')}
        </div>
        <div class="group">
          ${levels > 1
            ? html`<button class="tb ${ed.activeTop === 0 ? 'on' : ''}" @click=${() => ed.setActiveTop(ed.activeTop === 0 ? levels - 1 : 0)}>
                <span>${ed.activeTop === 0 ? '⬇️' : '⬆️'}</span>${ed.activeTop === 0 ? 'Nur Erdgeschoss' : 'Alle Etagen'}
              </button>`
            : nothing}
          <button class="tb ${ed.lowWalls ? 'on' : ''}" @click=${() => ed.setLowWalls(!ed.lowWalls)}><span>✂️</span>Wände niedrig</button>
          <button class="tb ${ed.roofOn ? 'on' : ''}" @click=${() => ed.setRoof(!ed.roofOn)}><span>🏠</span>Dach</button>
          <button class="tb ${ed.autoTour ? 'on' : ''}" @click=${() => ed.setAutoTour(!ed.autoTour)}><span>🔄</span>Rundflug</button>
          <button class="tb" @click=${() => (this.helpOpen = !this.helpOpen)}><span>❓</span>Hilfe</button>
          <button class="tb" @click=${() => { if (confirm('Wirklich alles ausräumen?')) ed.clearAll(); }}><span>🧹</span>Ausräumen</button>
        </div>
      </div>
      ${this.renderCatalog()} ${this.renderSelection()}
      ${ed.mode !== 'drone' ? this.renderPad() : nothing}
      ${ed.collidingCount > 0
        ? html`<div class="warn">🔴 ${ed.collidingCount} Sachen stoßen zusammen</div>`
        : nothing}
      ${this.helpOpen ? this.renderHelp() : nothing}
    `;
  }

  private renderCatalog() {
    const cat = CATEGORIES.find((c) => c.id === this.cat) as Category;
    let tiles;
    if (cat.kind === 'cover') {
      tiles = COVERINGS.filter((c) => c.surface === cat.surface).map((c) => {
        const src = this.coverThumbs.get(c.id) ?? '';
        return html`<div class="tile" @pointerdown=${(e: PointerEvent) => this.onTileDown(e, { kind: 'cover', cov: c }, src)}>
          <img class="swatch" src=${src} alt="" draggable="false" /><span>${c.name}</span>
        </div>`;
      });
    } else {
      tiles = ITEMS.filter((i) => i.cat === cat.id).map((d) => {
        const src = this.itemThumbs.get(d.id) ?? '';
        return html`<div class="tile" @pointerdown=${(e: PointerEvent) => this.onTileDown(e, { kind: 'item', def: d }, src)}>
          <img src=${src} alt="" draggable="false" /><span>${d.name}</span>
        </div>`;
      });
    }
    return html`
      <div class="catalog">
        <div class="cats">
          ${CATEGORIES.map(
            (c) => html`<button class="cat ${c.id === this.cat ? 'on' : ''}" title=${c.name} @click=${() => (this.cat = c.id)}>
              <span class="ci">${c.icon}</span><span class="cn">${c.name}</span>
            </button>`,
          )}
        </div>
        <div class="items">
          <div class="cathead">${cat.icon} ${cat.name}</div>
          <div class="hint">Ziehe es ins Haus – oder tippe drauf.</div>
          <div class="grid">${tiles}</div>
        </div>
      </div>
    `;
  }

  private renderSelection() {
    const ed = this.editor;
    const it = ed.selected;
    if (!it) return nothing;
    const d = it.userData.def;
    const color = d.colors[it.userData.colorIdx % d.colors.length];
    return html`
      <div class="selbar">
        <div class="selname">${d.name}</div>
        <button class="sb ${ed.gizmoMode === 'translate' ? 'on' : ''}" @click=${() => ed.setGizmoMode('translate')}>✥ Schieben</button>
        ${d.placement !== 'wall'
          ? html`<button class="sb ${ed.gizmoMode === 'rotate' ? 'on' : ''}" @click=${() => ed.setGizmoMode('rotate')}>⟳ Drehen</button>
              <button class="sb" @click=${() => ed.rotateSelected(90)}>↻ 90°</button>`
          : nothing}
        <button class="sb" @click=${() => ed.recolorSelected()}>
          <i class="dot" style="background:#${color.toString(16).padStart(6, '0')}"></i> Farbe
        </button>
        <button class="sb" @click=${() => ed.duplicateSelected()}>⧉ Nochmal</button>
        <button class="sb del" @click=${() => ed.deleteSelected()}>🗑 Weg damit</button>
        <button class="sb x" @click=${() => ed.select(null)}>✕</button>
      </div>
    `;
  }

  private renderPad() {
    const ed = this.editor;
    const b = (k: 'fwd' | 'back' | 'left' | 'right', label: string) => html`<button
      class="pb ${k}"
      @pointerdown=${(e: PointerEvent) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); ed.setVirtualKey(k, true); }}
      @pointerup=${() => ed.setVirtualKey(k, false)}
      @pointercancel=${() => ed.setVirtualKey(k, false)}
      @lostpointercapture=${() => ed.setVirtualKey(k, false)}
    >${label}</button>`;
    return html`
      <div class="pad">${b('fwd', '▲')}${b('left', '◀')}${b('right', '▶')}${b('back', '▼')}</div>
      <div class="walkhint">Laufen: W A S D oder Pfeiltasten · Umschauen: ins Bild ziehen · Shift = rennen</div>
    `;
  }

  private renderHelp() {
    return html`
      <div class="help" @click=${() => (this.helpOpen = false)}>
        <div class="helpbox" @click=${(e: Event) => e.stopPropagation()}>
          <h2>So geht's</h2>
          <ul>
            <li>🖱️ <b>Einrichten:</b> Sachen links aus dem Katalog ins Haus ziehen. Antippen setzt sie in die Bildmitte.</li>
            <li>🎨 <b>Böden, Wände, Decken:</b> Belag auf ein Zimmer oder eine Wand ziehen – das ganze Zimmer wird neu gestaltet. Außenwände geben dem Haus eine neue Farbe.</li>
            <li>✥ <b>Verschieben:</b> Gegenstand anklicken und ziehen – oder die farbigen Pfeile benutzen. Mit „Drehen“ erscheint ein Ring.</li>
            <li>🧱 <b>Wände</b> halten Möbel auf. 🔴 <b>Rot</b> leuchtet, was mit etwas anderem zusammenstößt.</li>
            <li>🚁 <b>Drohne:</b> linke Maustaste drehen, rechte schieben, Mausrad zoomen.</li>
            <li>🧍 <b>Figur / 👀 Ich-Sicht:</b> mit W A S D oder den Pfeilen durchs Haus laufen, Treppen hoch und runter.</li>
            <li>⌨️ <b>Tasten:</b> R = drehen, Entf = löschen, Esc = abwählen.</li>
            <li>💾 Alles wird automatisch im Browser gespeichert.</li>
          </ul>
          <button class="tb on" @click=${() => (this.helpOpen = false)}>Alles klar!</button>
        </div>
      </div>
    `;
  }

  static styles = css`
    :host {
      --pink: #ff5d8f;
      --pink2: #ffd0e0;
      --blue: #3a7bd5;
      --ink: #3b2d4a;
      --panel: rgba(255, 255, 255, 0.92);
      display: block;
      height: 100%;
      color: var(--ink);
      font-family: 'Fredoka', 'Comic Sans MS', system-ui, sans-serif;
      user-select: none;
      -webkit-user-select: none;
    }
    [hidden] { display: none !important; }
    button { font: inherit; color: inherit; cursor: pointer; }
    .select {
      height: 100%;
      overflow: auto;
      box-sizing: border-box;
      padding: 24px 16px 40px;
      background: radial-gradient(circle at 20% 10%, #fff3b0 0, transparent 35%), radial-gradient(circle at 85% 20%, #ffd0e6 0, transparent 40%), linear-gradient(#bfe6ff, #e6f7ff);
      text-align: center;
    }
    h1 { font-size: clamp(28px, 5vw, 46px); margin: 8px 0 4px; color: var(--pink); text-shadow: 0 3px 0 #fff; }
    .sub { font-size: 18px; margin: 0 0 24px; }
    .cards { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }
    .card {
      width: min(340px, 100%);
      border: 4px solid #fff;
      border-radius: 26px;
      padding: 0;
      overflow: hidden;
      background: #fff;
      box-shadow: 0 8px 0 #f3b3cb, 0 14px 30px rgba(80, 40, 90, 0.18);
      text-align: left;
      transition: transform 0.15s;
    }
    .card:hover { transform: translateY(-4px) rotate(-0.5deg); }
    .card img { width: 100%; aspect-ratio: 3/2; display: block; object-fit: cover; }
    .cardbody { padding: 12px 16px 16px; }
    .cardbody h2 { margin: 0 0 4px; font-size: 22px; }
    .cardbody p { margin: 0 0 12px; font-size: 15px; opacity: 0.85; }
    .go { display: inline-block; background: var(--pink); color: #fff; padding: 6px 16px; border-radius: 99px; font-weight: 600; }

    .editor { position: relative; height: 100%; }
    #viewport { position: absolute; inset: 0; }
    .topbar {
      position: absolute; left: 8px; right: 8px; top: 8px;
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
      pointer-events: none;
    }
    .topbar > * { pointer-events: auto; }
    .title { font-size: 20px; font-weight: 600; background: var(--panel); padding: 6px 14px; border-radius: 16px; }
    .group { display: flex; gap: 4px; background: var(--panel); padding: 4px; border-radius: 18px; flex-wrap: wrap; }
    .tb {
      border: none; background: transparent; padding: 6px 10px; border-radius: 14px; font-size: 15px; font-weight: 500;
      display: inline-flex; align-items: center; gap: 5px;
    }
    .tb span { font-size: 18px; }
    .tb:hover { background: var(--pink2); }
    .tb.on { background: var(--pink); color: #fff; }
    .tb.back { background: #fff; box-shadow: 0 3px 0 #f3b3cb; }

    .catalog {
      position: absolute; left: 8px; top: 64px; bottom: 8px;
      width: 330px; display: flex; background: var(--panel); border-radius: 22px; overflow: hidden;
      box-shadow: 0 8px 24px rgba(60, 30, 80, 0.15);
    }
    .cats { display: flex; flex-direction: column; gap: 2px; padding: 6px 4px; background: #ffe3ee; overflow-y: auto; }
    .cat { border: none; background: transparent; border-radius: 12px; padding: 5px 4px; width: 66px; display: flex; flex-direction: column; align-items: center; }
    .cat .ci { font-size: 22px; }
    .cat .cn { font-size: 10.5px; line-height: 1.1; }
    .cat.on { background: #fff; box-shadow: 0 2px 0 #f3b3cb; }
    .items { flex: 1; overflow-y: auto; padding: 8px; }
    .cathead { font-size: 20px; font-weight: 600; }
    .hint { font-size: 12px; opacity: 0.7; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; }
    .tile {
      background: #fff; border-radius: 16px; padding: 6px; text-align: center; cursor: grab;
      box-shadow: 0 3px 0 #e8d8e2; touch-action: pan-y; transition: transform 0.1s;
    }
    .tile:hover { transform: scale(1.05); box-shadow: 0 3px 0 var(--pink); }
    .tile img { width: 100%; aspect-ratio: 1; display: block; pointer-events: none; }
    .tile img.swatch { border-radius: 12px; }
    .tile span { font-size: 13px; display: block; margin-top: 2px; line-height: 1.15; }
    .ghost { position: fixed; width: 80px; height: 80px; margin: -40px 0 0 -40px; pointer-events: none; opacity: 0.85; border-radius: 14px; z-index: 50; }

    .selbar {
      position: absolute; left: 350px; right: 8px; bottom: 10px; margin: 0 auto; width: fit-content; max-width: calc(100% - 360px);
      display: flex; flex-wrap: wrap; align-items: center; gap: 6px; background: var(--panel); padding: 6px; border-radius: 20px;
      box-shadow: 0 8px 24px rgba(60, 30, 80, 0.18);
    }
    .selname { font-weight: 600; padding: 0 8px; font-size: 17px; }
    .sb { border: none; background: #fff; border-radius: 14px; padding: 8px 12px; font-size: 15px; box-shadow: 0 3px 0 #e8d8e2; display: inline-flex; gap: 6px; align-items: center; }
    .sb.on { background: var(--blue); color: #fff; box-shadow: 0 3px 0 #23508f; }
    .sb.del { background: #ffe0e0; }
    .sb.x { background: transparent; box-shadow: none; }
    .dot { width: 16px; height: 16px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px #ccc; display: inline-block; }
    .warn { position: absolute; right: 12px; top: 64px; background: #ff4d4d; color: #fff; padding: 6px 14px; border-radius: 14px; font-weight: 600; }
    .toast {
      position: fixed; left: 50%; top: 72px; transform: translateX(-50%); background: #fff; padding: 10px 20px; border-radius: 99px;
      font-size: 17px; font-weight: 500; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15); z-index: 60; pointer-events: none;
    }
    .pad { position: absolute; right: 20px; bottom: 20px; display: grid; grid-template-columns: repeat(3, 58px); grid-template-rows: repeat(2, 58px); gap: 6px; }
    .pb { border: none; border-radius: 16px; background: var(--panel); font-size: 24px; box-shadow: 0 4px 0 #e8d8e2; touch-action: none; }
    .pb:active { background: var(--pink); color: #fff; }
    .pb.fwd { grid-column: 2; grid-row: 1; }
    .pb.left { grid-column: 1; grid-row: 2; }
    .pb.back { grid-column: 2; grid-row: 2; }
    .pb.right { grid-column: 3; grid-row: 2; }
    .walkhint { position: absolute; left: 350px; bottom: 14px; background: var(--panel); padding: 6px 12px; border-radius: 12px; font-size: 13px; }
    .help { position: fixed; inset: 0; background: rgba(60, 30, 80, 0.35); display: flex; align-items: center; justify-content: center; z-index: 80; padding: 16px; }
    .helpbox { background: #fff; border-radius: 24px; padding: 20px 24px; max-width: 560px; max-height: 90vh; overflow: auto; }
    .helpbox h2 { margin-top: 0; color: var(--pink); }
    .helpbox li { margin-bottom: 8px; }

    @media (max-width: 760px) {
      .catalog { top: auto; height: 42%; width: auto; right: 8px; }
      .cat { width: 52px; }
      .cat .cn { display: none; }
      .grid { grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); }
      .selbar { left: 8px; max-width: calc(100% - 16px); bottom: calc(42% + 16px); }
      .walkhint { display: none; }
      .pad { bottom: calc(42% + 16px); }
      .title { display: none; }
      .tb { font-size: 0; padding: 6px 8px; }
      .tb span { font-size: 20px; }
      .tb.back { font-size: 14px; }
    }
  `;
}

customElements.define('pm-app', PmApp);
