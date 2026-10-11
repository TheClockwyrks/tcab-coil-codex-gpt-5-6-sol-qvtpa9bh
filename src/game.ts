import type {
  Game,
  InitApi,
  RenderApi,
  UpdateApi,
} from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as K from "./constants";
import type { Cell, Direction, Screen } from "./constants";

export const BACKGROUND = "#050713";
interface Sprites {
  head: readonly ImageBitmap[];
  body: ImageBitmap;
  corner: ImageBitmap;
  tail: ImageBitmap;
}
export interface CoilState {
  readonly screen: Screen;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly score: number;
  readonly best: number;
  readonly combo: number;
  readonly comboWindow: number;
  readonly muted: boolean;
  readonly ticks: number;
  readonly simTime: number;
  readonly accumulator: number;
  readonly dir: Direction;
  readonly turns: readonly Direction[];
  readonly snake: readonly Cell[];
  readonly pellet: Cell | null;
  readonly obstacles: readonly Cell[];
  readonly steering: boolean;
  readonly travel: boolean;
  readonly pelletRespawn: boolean;
  readonly nextPellet: Cell | null;
  readonly biteTime: number;
  readonly pointerArmed: number | null;
  readonly sprites: Sprites;
}
type R = DeepReadonly<CoilState>;
type Rect = { x: number; y: number; w: number; h: number };
export interface CoilSnapshot {
  version: number;
  screen: Screen;
  menuIndex: number;
  titleIndex: number;
  mode: typeof K.MODE;
  score: number;
  best: number;
  combo: number;
  comboWindow: number;
  muted: boolean;
  ticks: number;
  simTime: number;
  dir: Direction;
  turns: Direction[];
  snake: Cell[];
  pellet: Cell | null;
  obstacles: Cell[];
  steering: boolean;
  travel: boolean;
  pelletRespawn: boolean;
  nextPellet: Cell | null;
}
export interface CoilDebugApi {
  readonly version: number;
  reset(s: R): CoilState;
  reconcile(s: R): CoilState;
  snapshot(s: R): CoilSnapshot;
  menuItemRect(s: R, i: number): Rect | null;
  setScreen(s: R, v: Screen): CoilState;
  setMenuIndex(s: R, v: number): CoilState;
  setScore(s: R, v: number): CoilState;
  setBest(s: R, v: number): CoilState;
  setCombo(s: R, v: number): CoilState;
  setComboWindow(s: R, v: number): CoilState;
  setSnake(s: R, v: readonly Cell[]): CoilState;
  setDirection(s: R, v: Direction): CoilState;
  clearTurns(s: R): CoilState;
  setSnakeSteering(s: R, v: boolean): CoilState;
  setSnakeTravel(s: R, v: boolean): CoilState;
  setPellet(s: R, col: number, row: number): CoilState;
  clearPellet(s: R): CoilState;
  setPelletRespawn(s: R, v: boolean): CoilState;
  setNextPellet(s: R, col: number, row: number): CoilState;
  drawPelletCell(s: R): Cell | null;
}
const cell = (c: DeepReadonly<Cell>): Cell => ({ col: c.col, row: c.row });
const same = (a: DeepReadonly<Cell>, b: DeepReadonly<Cell>): boolean =>
  a.col === b.col && a.row === b.row;
const inside = (c: DeepReadonly<Cell>): boolean =>
  c.col >= K.INTERIOR_MIN_COL &&
  c.col <= K.INTERIOR_MAX_COL &&
  c.row >= K.INTERIOR_MIN_ROW &&
  c.row <= K.INTERIOR_MAX_ROW;
function copy(s: R): CoilState {
  return {
    ...s,
    turns: [...s.turns],
    snake: s.snake.map(cell),
    pellet: s.pellet ? cell(s.pellet) : null,
    obstacles: s.obstacles.map(cell),
    nextPellet: s.nextPellet ? cell(s.nextPellet) : null,
    sprites: { ...s.sprites, head: [...s.sprites.head] },
  };
}
function opening(sprites: Sprites, muted = false): CoilState {
  return {
    screen: "title",
    menuIndex: 0,
    titleIndex: 0,
    score: 0,
    best: 0,
    combo: 1,
    comboWindow: 0,
    muted,
    ticks: 0,
    simTime: 0,
    accumulator: 0,
    dir: K.START_DIR,
    turns: [],
    snake: K.START_CELLS.map(cell),
    pellet: null,
    obstacles: K.OBSTACLE_CELLS.map(cell),
    steering: true,
    travel: true,
    pelletRespawn: true,
    nextPellet: null,
    biteTime: 0,
    pointerArmed: null,
    sprites,
  };
}
function valid(s: R): Cell[] {
  const out: Cell[] = [];
  for (let row = 1; row < K.GRID_ROWS - 1; row++)
    for (let col = 1; col < K.GRID_COLS - 1; col++) {
      const c = { col, row };
      if (
        !s.snake.some((x) => same(x, c)) &&
        !s.obstacles.some((x) => same(x, c)) &&
        (!s.pellet || !same(s.pellet, c))
      )
        out.push(c);
    }
  return out;
}
function randomCell(s: R): Cell | null {
  const a = valid(s);
  return a.length ? cell(a[Math.floor(Math.random() * a.length)]) : null;
}
function spawn(s: R): { pellet: Cell | null; nextPellet: null } {
  const a = valid(s);
  const pellet =
    s.nextPellet && a.some((x) => same(x, s.nextPellet!))
      ? cell(s.nextPellet)
      : a.length
        ? cell(a[Math.floor(Math.random() * a.length)])
        : null;
  return { pellet, nextPellet: null };
}
function items(screen: Screen): readonly string[] {
  return screen === "title"
    ? K.TITLE_ITEMS
    : screen === "paused"
      ? K.PAUSE_ITEMS
      : screen === "gameover" || screen === "cleared"
        ? K.OVER_ITEMS
        : screen === "howto"
          ? ["BACK"]
          : [];
}
function rect(s: R, i: number): Rect | null {
  if (!Number.isInteger(i) || i < 0)
    throw new RangeError("index outside domain");
  if (i >= items(s.screen).length) return null;
  const w = s.screen === "paused" ? 330 : 390;
  return {
    x: K.STAGE_CX - w / 2,
    y: (s.screen === "title" ? 414 : s.screen === "howto" ? 610 : 440) + i * 74,
    w,
    h: 58,
  };
}
function at(s: R, x: number, y: number): number | null {
  for (let i = 0; i < items(s.screen).length; i++) {
    const r = rect(s, i)!;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return null;
}
function whole(v: number, lo = 0, hi = Infinity): void {
  if (!Number.isInteger(v) || v < lo || v > hi)
    throw new RangeError("value outside domain");
}
function snap(s: R): CoilSnapshot {
  return {
    version: K.COIL_DEBUG_VERSION,
    screen: s.screen,
    menuIndex: s.menuIndex,
    titleIndex: s.titleIndex,
    mode: K.MODE,
    score: s.score,
    best: s.best,
    combo: s.combo,
    comboWindow: s.comboWindow,
    muted: s.muted,
    ticks: s.ticks,
    simTime: s.simTime,
    dir: s.dir,
    turns: [...s.turns],
    snake: s.snake.map(cell),
    pellet: s.pellet ? cell(s.pellet) : null,
    obstacles: s.obstacles.map(cell),
    steering: s.steering,
    travel: s.travel,
    pelletRespawn: s.pelletRespawn,
    nextPellet: s.nextPellet ? cell(s.nextPellet) : null,
  };
}
function debugApi(): CoilDebugApi {
  return {
    version: K.COIL_DEBUG_VERSION,
    reset: (s) => opening(s.sprites, s.muted),
    reconcile: copy,
    snapshot: snap,
    menuItemRect: rect,
    setScreen: (s, v) => {
      if (!K.SCREENS.includes(v)) throw new RangeError("screen");
      return { ...copy(s), screen: v };
    },
    setMenuIndex: (s, v) => {
      const n = items(s.screen).length;
      if (!Number.isInteger(v) || v < 0 || (n ? v >= n : v !== 0))
        throw new RangeError("menu index");
      return { ...copy(s), menuIndex: v };
    },
    setScore: (s, v) => (whole(v), { ...copy(s), score: v }),
    setBest: (s, v) => (whole(v), { ...copy(s), best: v }),
    setCombo: (s, v) => (whole(v, 1, K.COMBO_MAX), { ...copy(s), combo: v }),
    setComboWindow: (s, v) => {
      if (!Number.isFinite(v) || v < 0 || v > K.COMBO_WINDOW)
        throw new RangeError("window");
      return { ...copy(s), comboWindow: v };
    },
    setSnake: (s, v) => {
      if (!v.length) throw new RangeError("snake");
      const seen = new Set<string>();
      v.forEach((c, i) => {
        whole(c.col);
        whole(c.row);
        const p = v[i - 1];
        const key = `${c.col},${c.row}`;
        if (
          !inside(c) ||
          s.obstacles.some((o) => same(o, c)) ||
          seen.has(key) ||
          (p && Math.abs(p.col - c.col) + Math.abs(p.row - c.row) !== 1)
        )
          throw new RangeError("snake");
        seen.add(key);
      });
      return { ...copy(s), snake: v.map(cell) };
    },
    setDirection: (s, v) => {
      if (!K.DIRECTIONS.includes(v)) throw new RangeError("direction");
      return { ...copy(s), dir: v };
    },
    clearTurns: (s) => ({ ...copy(s), turns: [] }),
    setSnakeSteering: (s, v) => {
      if (typeof v !== "boolean") throw new TypeError("enabled");
      return { ...copy(s), steering: v };
    },
    setSnakeTravel: (s, v) => {
      if (typeof v !== "boolean") throw new TypeError("enabled");
      return { ...copy(s), travel: v };
    },
    setPellet: (s, col, row) => {
      whole(col);
      whole(row);
      const c = { col, row };
      if (
        !inside(c) ||
        s.snake.some((x) => same(x, c)) ||
        s.obstacles.some((x) => same(x, c))
      )
        throw new RangeError("pellet");
      return { ...copy(s), pellet: c };
    },
    clearPellet: (s) => ({ ...copy(s), pellet: null }),
    setPelletRespawn: (s, v) => {
      if (typeof v !== "boolean") throw new TypeError("enabled");
      return { ...copy(s), pelletRespawn: v };
    },
    setNextPellet: (s, col, row) => (
      whole(col, 0, K.GRID_COLS - 1),
      whole(row, 0, K.GRID_ROWS - 1),
      { ...copy(s), nextPellet: { col, row } }
    ),
    drawPelletCell: randomCell,
  };
}
const D: Record<Direction, Cell> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};
const horiz = (d: Direction): boolean => d === "left" || d === "right";
function drain(s: CoilState): CoilState {
  const comboWindow = Math.max(0, s.comboWindow - K.TICK_SECONDS);
  return { ...s, comboWindow, combo: comboWindow === 0 ? 1 : s.combo };
}
function tick(s: CoilState, api: UpdateApi): CoilState {
  let dir = s.dir;
  const turns = [...s.turns];
  if (s.steering && turns.length) {
    const q = turns.shift()!;
    if (horiz(q) !== horiz(dir)) dir = q;
  }
  const counted = { ...s, dir, turns, ticks: s.ticks + 1 };
  if (!s.travel) return drain(counted);
  const h = s.snake[0];
  const n = { col: h.col + D[dir].col, row: h.row + D[dir].row };
  const eating = Boolean(s.pellet && same(n, s.pellet));
  const limit = eating ? s.snake.length : s.snake.length - 1;
  if (
    !inside(n) ||
    s.obstacles.some((x) => same(x, n)) ||
    s.snake.slice(0, limit).some((x) => same(x, n))
  ) {
    api.audio.play(K.CUES.death);
    api.audio.stop(K.CUES.music);
    return { ...counted, screen: "gameover", menuIndex: 0, accumulator: 0 };
  }
  const snake = [n, ...s.snake.map(cell)];
  if (!eating) snake.pop();
  if (!eating) return drain({ ...counted, snake });
  const combo = s.comboWindow > 0 ? Math.min(K.COMBO_MAX, s.combo + 1) : 1;
  api.audio.play(K.CUES.eat);
  if (combo > s.combo) api.audio.play(K.CUES.comboUp);
  let e: CoilState = {
    ...counted,
    snake,
    pellet: null,
    combo,
    comboWindow: K.COMBO_WINDOW,
    score: s.score + K.PELLET_POINTS * combo,
    biteTime: K.BITE_SECONDS,
  };
  e = { ...e, best: Math.max(e.best, e.score) };
  if (s.pelletRespawn) {
    e = { ...e, ...spawn(e) };
    if (!e.pellet) {
      api.audio.stop(K.CUES.music);
      return { ...e, screen: "cleared", menuIndex: 0, accumulator: 0 };
    }
  }
  return drain(e);
}
function round(s: R, api: UpdateApi): CoilState {
  let n: CoilState = {
    ...copy(s),
    screen: "playing",
    menuIndex: 0,
    score: 0,
    combo: 1,
    comboWindow: 0,
    accumulator: 0,
    dir: K.START_DIR,
    turns: [],
    snake: K.START_CELLS.map(cell),
    pellet: null,
    obstacles: K.OBSTACLE_CELLS.map(cell),
    biteTime: 0,
    pointerArmed: null,
  };
  n = { ...n, ...spawn(n) };
  api.audio.loop(K.CUES.music);
  return n.pellet ? n : { ...n, screen: "cleared" };
}
function title(s: R, api: UpdateApi): CoilState {
  api.audio.stop(K.CUES.music);
  return {
    ...copy(s),
    screen: "title",
    menuIndex: s.titleIndex,
    accumulator: 0,
    pointerArmed: null,
  };
}
function confirm(s: CoilState, api: UpdateApi): CoilState {
  if (s.screen === "title") {
    const m = { ...s, titleIndex: s.menuIndex };
    return s.menuIndex === 0
      ? round(m, api)
      : { ...m, screen: "howto", menuIndex: 0 };
  }
  if (s.screen === "howto") return title(s, api);
  if (s.screen === "paused")
    return s.menuIndex === 0
      ? { ...s, screen: "playing", menuIndex: 0 }
      : s.menuIndex === 1
        ? round(s, api)
        : title(s, api);
  if (s.screen === "gameover" || s.screen === "cleared")
    return s.menuIndex === 0 ? round(s, api) : title(s, api);
  return s;
}
function input(s: CoilState, api: UpdateApi): CoilState {
  let n = s;
  if (api.input.pressed("mute")) api.audio.setMuted(!api.audio.muted());
  if (s.screen === "playing") {
    if (api.input.pressed("back") || api.input.pressed("pause"))
      return { ...s, screen: "paused", menuIndex: 0, pointerArmed: null };
    if (s.steering)
      for (const d of K.DIRECTIONS)
        if (api.input.pressed(d) && n.turns.length < K.TURN_QUEUE_MAX)
          n = { ...n, turns: [...n.turns, d] };
    return n;
  }
  if (
    s.screen === "paused" &&
    (api.input.pressed("back") || api.input.pressed("pause"))
  )
    return { ...s, screen: "playing", menuIndex: 0 };
  if (
    api.input.pressed("back") &&
    (s.screen === "howto" || s.screen === "gameover" || s.screen === "cleared")
  )
    return title(s, api);
  const count = items(s.screen).length;
  if (count && api.input.pressed("up"))
    n = { ...n, menuIndex: (n.menuIndex + count - 1) % count };
  if (count && api.input.pressed("down"))
    n = { ...n, menuIndex: (n.menuIndex + 1) % count };
  if (count && api.input.pressed("confirm")) n = confirm(n, api);
  if (n.screen === "playing") return n;
  let armed = n.pointerArmed;
  for (const p of api.input.pointerSamples()) {
    if (!p.primary) continue;
    const i = at(n, p.x, p.y);
    if (i !== null) n = { ...n, menuIndex: i };
    if (p.type === "down" && p.buttons.includes("primary")) armed = i;
    if (p.type === "up") {
      if (armed !== null && armed === i)
        n = confirm({ ...n, menuIndex: i }, api);
      armed = null;
    }
  }
  if (n.screen !== "playing") {
    const p = api.input.pointer();
    const i = at(n, p.x, p.y);
    if (i !== null) n = { ...n, menuIndex: i };
  }
  return { ...n, pointerArmed: armed };
}
function rot(d: Direction): number {
  return d === "right"
    ? 0
    : d === "down"
      ? Math.PI / 2
      : d === "left"
        ? Math.PI
        : -Math.PI / 2;
}
function toward(a: DeepReadonly<Cell>, b: DeepReadonly<Cell>): Direction {
  if (b.col > a.col) return "right";
  if (b.col < a.col) return "left";
  return b.row > a.row ? "down" : "up";
}
function sprite(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  c: DeepReadonly<Cell>,
  a: number,
): void {
  const x = K.BOARD_X + c.col * K.CELL + K.CELL / 2,
    y = K.BOARD_Y + c.row * K.CELL + K.CELL / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.drawImage(img, -16, -16, 32, 32);
  ctx.restore();
}
function board(s: R, ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#080d20";
  ctx.fillRect(
    K.BOARD_X,
    K.BOARD_Y,
    K.GRID_COLS * K.CELL,
    K.GRID_ROWS * K.CELL,
  );
  ctx.strokeStyle = "rgba(74,111,170,.18)";
  for (let c = 1; c < K.GRID_COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(K.BOARD_X + c * 32 + 0.5, K.BOARD_Y);
    ctx.lineTo(K.BOARD_X + c * 32 + 0.5, K.BOARD_Y + 576);
    ctx.stroke();
  }
  for (let r = 1; r < K.GRID_ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(K.BOARD_X, K.BOARD_Y + r * 32 + 0.5);
    ctx.lineTo(K.BOARD_X + 960, K.BOARD_Y + r * 32 + 0.5);
    ctx.stroke();
  }
  ctx.shadowBlur = 12;
  ctx.shadowColor = "#614dff";
  ctx.fillStyle = "#171348";
  for (let r = 0; r < K.GRID_ROWS; r++)
    for (let c = 0; c < K.GRID_COLS; c++)
      if (!r || r === 17 || !c || c === 29) {
        ctx.fillRect(K.BOARD_X + c * 32 + 2, K.BOARD_Y + r * 32 + 2, 28, 28);
        ctx.strokeStyle = "#735cff";
        ctx.strokeRect(
          K.BOARD_X + c * 32 + 5.5,
          K.BOARD_Y + r * 32 + 5.5,
          21,
          21,
        );
      }
  ctx.shadowBlur = 0;
  if (s.pellet) {
    const x = K.BOARD_X + s.pellet.col * 32 + 16,
      y = K.BOARD_Y + s.pellet.row * 32 + 16;
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#ff287f";
    ctx.fillStyle = "#ff287f";
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff2a8";
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.imageSmoothingEnabled = false;
  ctx.shadowColor = "#15efc3";
  ctx.shadowBlur = 7;
  s.snake.forEach((c, i) => {
    if (!i) {
      const f =
        s.biteTime <= 0
          ? 0
          : Math.min(
              3,
              1 +
                Math.floor(
                  ((K.BITE_SECONDS - s.biteTime) / K.BITE_SECONDS) * 3,
                ),
            );
      sprite(ctx, s.sprites.head[f], c, rot(s.dir));
    } else if (i === s.snake.length - 1)
      sprite(ctx, s.sprites.tail, c, rot(toward(c, s.snake[i - 1])));
    else {
      const a = toward(c, s.snake[i - 1]),
        b = toward(c, s.snake[i + 1]);
      if (horiz(a) === horiz(b))
        sprite(ctx, s.sprites.body, c, horiz(a) ? 0 : Math.PI / 2);
      else {
        const ds = new Set([a, b]);
        const angle =
          ds.has("left") && ds.has("down")
            ? Math.PI / 2
            : ds.has("left") && ds.has("up")
              ? Math.PI
              : ds.has("right") && ds.has("up")
                ? -Math.PI / 2
                : 0;
        sprite(ctx, s.sprites.corner, c, angle);
      }
    }
  });
  ctx.shadowBlur = 0;
}
function txt(
  ctx: CanvasRenderingContext2D,
  v: string,
  x: number,
  y: number,
  size: number,
  color = "#e8f8ff",
): void {
  ctx.font = `700 ${size}px "Trebuchet MS",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(v, x, y);
}
function hud(s: R, ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "rgba(8,13,32,.94)";
  ctx.fillRect(160, 12, 960, 94);
  ctx.strokeStyle = "#21345f";
  ctx.strokeRect(160.5, 12.5, 959, 93);
  txt(ctx, K.SCORE_LABEL, 230, 36, 16, "#6f8fb9");
  txt(ctx, String(s.score).padStart(5, "0"), 230, 70, 30);
  txt(ctx, K.BEST_LABEL, 420, 36, 16, "#6f8fb9");
  txt(ctx, String(s.best).padStart(5, "0"), 420, 70, 30);
  txt(ctx, K.MODE_LABEL, 820, 54, 19, "#9f8fff");
  txt(
    ctx,
    s.muted ? "MUTED" : "SOUND ON",
    1040,
    54,
    15,
    s.muted ? "#ff629d" : "#51d8c0",
  );
  if (s.combo >= 2) {
    txt(ctx, `x${s.combo}`, 640, 45, 32, "#ffe769");
    ctx.fillStyle = "#1d2845";
    ctx.fillRect(565, 78, 150, 8);
    ctx.fillStyle = "#ffe769";
    ctx.fillRect(565, 78, (150 * s.comboWindow) / K.COMBO_WINDOW, 8);
  }
}
function menu(s: R, ctx: CanvasRenderingContext2D): void {
  items(s.screen).forEach((v, i) => {
    const r = rect(s, i)!;
    const on = s.menuIndex === i;
    ctx.fillStyle = on ? "#13dcb7" : "rgba(12,19,45,.94)";
    ctx.shadowColor = on ? "#13dcb7" : "transparent";
    ctx.shadowBlur = on ? 18 : 0;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = on ? "#b5fff1" : "#354b78";
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    txt(ctx, v, 640, r.y + 29, 22, on ? "#04161a" : "#dcecff");
  });
  ctx.shadowBlur = 0;
}
function render(s: R, ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, 1280, 720);
  if (s.screen !== "title" && s.screen !== "howto") {
    hud(s, ctx);
    board(s, ctx);
  }
  if (s.screen === "playing") return;
  if (s.screen === "title") {
    const g = ctx.createRadialGradient(640, 270, 20, 640, 300, 500);
    g.addColorStop(0, "#15255a");
    g.addColorStop(1, BACKGROUND);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1280, 720);
    ctx.strokeStyle = "rgba(44,231,197,.12)";
    for (let x = 0; x < 1280; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 720);
      ctx.stroke();
    }
    for (let y = 0; y < 720; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1280, y);
      ctx.stroke();
    }
    ctx.shadowColor = "#2cf0cf";
    ctx.shadowBlur = 30;
    txt(ctx, K.TITLE_TEXT, 640, 180, 112, "#9effeb");
    ctx.shadowBlur = 0;
    txt(ctx, K.TAGLINE_TEXT, 640, 263, 24, "#8298cb");
    txt(ctx, K.BEST_LABEL, 640, 324, 15, "#7285aa");
    txt(ctx, String(s.best).padStart(5, "0"), 640, 359, 30);
    menu(s, ctx);
    txt(ctx, "ARROWS / WASD  •  ENTER  •  M MUTES", 640, 660, 15, "#5f739c");
    return;
  }
  if (s.screen === "howto") {
    const lines = [
      "THE COIL NEVER STOPS. STEER NOW — IT TURNS ON THE NEXT TICK.",
      "TURN ONLY AT RIGHT ANGLES. YOU CANNOT DOUBLE BACK.",
      "EAT A PULSE TO GROW. HIT THE WALL OR YOUR BODY AND THE RUN ENDS.",
      "CHAIN QUICK EATS TO RAISE x2 → x5. LET THE BAR EMPTY AND IT RESETS.",
      "MOVE: ARROWS / WASD     PAUSE: P / ESC     MUTE: M",
    ];
    txt(ctx, "HOW TO PLAY", 640, 86, 48, "#9effeb");
    lines.forEach((v, i) =>
      txt(
        ctx,
        v,
        640,
        190 + i * 72,
        i === 4 ? 18 : 20,
        i === 4 ? "#ffdf73" : "#cbdaf5",
      ),
    );
    menu(s, ctx);
    return;
  }
  ctx.fillStyle = "rgba(3,5,16,.82)";
  ctx.fillRect(0, 0, 1280, 720);
  if (s.screen === "paused") {
    txt(ctx, "PAUSED", 640, 285, 56, "#9effeb");
    menu(s, ctx);
    return;
  }
  txt(
    ctx,
    s.screen === "gameover" ? K.GAMEOVER_TEXT : K.CLEARED_TEXT,
    640,
    225,
    58,
    s.screen === "gameover" ? "#ff4f91" : "#ffe46d",
  );
  txt(ctx, K.SCORE_LABEL, 540, 315, 15, "#7285aa");
  txt(ctx, String(s.score), 540, 355, 34);
  txt(ctx, K.BEST_LABEL, 740, 315, 15, "#7285aa");
  txt(ctx, String(s.best), 740, 355, 34);
  menu(s, ctx);
}
export const game: Game<CoilState, CoilDebugApi> = {
  async initialize(api: InitApi<CoilState>) {
    for (const a of K.ACTIONS)
      api.input.register(a, { keys: [...K.BINDINGS[a]] });
    await Promise.all(
      Object.entries(K.CUE_PATHS).map(([n, p]) => api.audio.load(n, p)),
    );
    const a = await Promise.all(
      [
        ...K.SPRITE_PATHS.head,
        K.SPRITE_PATHS.body,
        K.SPRITE_PATHS.corner,
        K.SPRITE_PATHS.tail,
      ].map((p) => api.assets.loadImage(p)),
    );
    const sprites: Sprites = {
      head: a.slice(0, 4),
      body: a[4],
      corner: a[5],
      tail: a[6],
    };
    const d: [string, (s: R) => string | number][] = [
      ["screen", (s) => s.screen],
      ["score", (s) => s.score],
      ["best", (s) => s.best],
      ["combo", (s) => s.combo],
      ["combo window", (s) => s.comboWindow],
      ["direction", (s) => s.dir],
      ["length", (s) => s.snake.length],
      ["head", (s) => `${s.snake[0].col},${s.snake[0].row}`],
      [
        "pellet",
        (s) => (s.pellet ? `${s.pellet.col},${s.pellet.row}` : "none"),
      ],
    ];
    d.forEach(([n, f]) => api.diagnostics.register(n, f));
    return [opening(sprites), debugApi()];
  },
  update(state, api, dt) {
    let n = input(copy(state), api);
    n = { ...n, muted: api.audio.muted(), best: Math.max(n.best, n.score) };
    if (n.screen !== "playing") return n;
    n = {
      ...n,
      simTime: n.simTime + dt,
      accumulator: n.accumulator + dt,
      biteTime: Math.max(0, n.biteTime - dt),
    };
    while (
      n.accumulator + Number.EPSILON >= K.TICK_SECONDS &&
      n.screen === "playing"
    ) {
      n = { ...n, accumulator: n.accumulator - K.TICK_SECONDS };
      n = tick(n, api);
    }
    return n.screen === "playing" ? n : { ...n, accumulator: 0 };
  },
  render(state, api: RenderApi) {
    render(state, api.ctx);
  },
};
