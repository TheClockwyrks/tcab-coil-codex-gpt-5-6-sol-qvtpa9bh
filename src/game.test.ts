import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InitApi, UpdateApi } from "@clockwyrks/simple-2d";
import { COMBO_WINDOW, TICK_SECONDS } from "./constants";
import { game, type CoilDebugApi, type CoilState } from "./game";

const pressed = new Set<string>();
const sounds: string[] = [];
let muted = false;

function initApi(): InitApi<CoilState> {
  return {
    input: { register: vi.fn(), layout: () => null },
    audio: { define: vi.fn(), load: vi.fn(async () => undefined) },
    assets: {
      loadImage: vi.fn(async () => ({}) as ImageBitmap),
      loadAudio: vi.fn(),
      load: vi.fn(),
      resolve: (path: string) => path,
    },
    diagnostics: { register: vi.fn() },
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    viewport: vi.fn(),
  } as unknown as InitApi<CoilState>;
}

function updateApi(): UpdateApi {
  return {
    input: {
      value: () => 0,
      pressed: (name: string) => pressed.has(name),
      pointer: () => ({
        x: 0,
        y: 0,
        down: false,
        device: "mouse",
        buttons: [],
      }),
      pointerPressed: () => false,
      pointerReleased: () => false,
      pointerSamples: () => [],
      pointerContacts: () => [],
      wheel: () => ({ x: 0, y: 0 }),
    },
    audio: {
      play: (cue: string) => sounds.push(cue),
      loop: (cue: string) => sounds.push(`loop:${cue}`),
      stop: (cue: string) => sounds.push(`stop:${cue}`),
      looping: () => false,
      setMuted: (value: boolean) => {
        muted = value;
      },
      muted: () => muted,
    },
    frame: () => ({ count: 0, timeMs: 0, lastDeltaMs: 0 }),
    viewport: vi.fn(),
  } as unknown as UpdateApi;
}

let state: CoilState;
let debug: CoilDebugApi;
beforeEach(async () => {
  [state, debug] = await game.initialize(initApi());
  pressed.clear();
  sounds.length = 0;
  muted = false;
});

describe("Coil simulation", () => {
  it("opens with the exact debug snapshot and a pure reset", () => {
    const shot = debug.snapshot(state);
    expect(shot).toMatchObject({
      screen: "title",
      score: 0,
      combo: 1,
      ticks: 0,
      dir: "right",
      snake: [
        { col: 15, row: 8 },
        { col: 14, row: 8 },
        { col: 13, row: 8 },
      ],
    });
    expect(debug.reset(debug.setScore(state, 99))).not.toBe(state);
    expect(debug.snapshot(state).score).toBe(0);
  });

  it("starts, spawns the posed pellet, and advances at a fixed timestep", () => {
    state = debug.setNextPellet(state, 16, 8);
    pressed.add("confirm");
    state = game.update(state, updateApi(), 0);
    pressed.clear();
    expect(debug.snapshot(state)).toMatchObject({
      screen: "playing",
      pellet: { col: 16, row: 8 },
    });
    state = game.update(state, updateApi(), TICK_SECONDS / 2);
    expect(debug.snapshot(state).ticks).toBe(0);
    state = game.update(state, updateApi(), TICK_SECONDS / 2);
    expect(debug.snapshot(state)).toMatchObject({
      score: 10,
      ticks: 1,
      snake: expect.arrayContaining([{ col: 16, row: 8 }]),
    });
    expect(sounds).toContain("eat");
  });

  it("buffers two perpendicular turns across two ticks", () => {
    state = debug.setScreen(state, "playing");
    state = debug.setPellet(state, 1, 1);
    pressed.add("down");
    pressed.add("left");
    state = game.update(state, updateApi(), 0);
    pressed.clear();
    state = game.update(state, updateApi(), TICK_SECONDS * 2);
    const shot = debug.snapshot(state);
    expect(shot).toMatchObject({ dir: "left", turns: [], ticks: 2 });
    expect(shot.snake[0]).toEqual({ col: 14, row: 9 });
  });

  it("grows combo, scores with the raised multiplier, then lapses", () => {
    state = debug.setScreen(state, "playing");
    state = debug.setCombo(state, 2);
    state = debug.setComboWindow(state, COMBO_WINDOW);
    state = debug.setPellet(state, 16, 8);
    state = debug.setPelletRespawn(state, false);
    state = game.update(state, updateApi(), TICK_SECONDS);
    expect(debug.snapshot(state)).toMatchObject({ combo: 3, score: 30 });
    expect(sounds).toEqual(expect.arrayContaining(["eat", "combo-up"]));
    state = debug.setSnakeTravel(state, false);
    state = game.update(state, updateApi(), COMBO_WINDOW);
    expect(debug.snapshot(state).combo).toBe(1);
  });

  it("applies the moving-tail collision exception and detects a wall", () => {
    state = debug.setScreen(state, "playing");
    state = debug.setSnake(state, [
      { col: 2, row: 2 },
      { col: 2, row: 3 },
      { col: 1, row: 3 },
      { col: 1, row: 2 },
    ]);
    state = debug.setDirection(state, "left");
    state = debug.clearPellet(state);
    state = game.update(state, updateApi(), TICK_SECONDS);
    expect(debug.snapshot(state).screen).toBe("playing");
    state = debug.setSnake(state, [{ col: 1, row: 2 }]);
    state = game.update(state, updateApi(), TICK_SECONDS);
    expect(debug.snapshot(state).screen).toBe("gameover");
    expect(sounds).toContain("death");
  });

  it("rejects invalid debug poses loudly", () => {
    expect(() => debug.setCombo(state, 99)).toThrow(RangeError);
    expect(() => debug.setPellet(state, 0, 0)).toThrow(RangeError);
    expect(() =>
      debug.setSnake(state, [
        { col: 2, row: 2 },
        { col: 4, row: 2 },
      ]),
    ).toThrow(RangeError);
  });
});
