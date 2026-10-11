# Coil

Coil is a neon grid-serpent game that runs entirely in the browser. Guide a continuous pixel-art coil through an enclosed board, eat pulses to grow, and route efficiently enough to keep a five-step combo alive. The game includes original generated sprite art, bite animation, sound effects, and a looping synthwave score.

## Run locally

Requires a current Node.js installation.

```sh
npm ci
npm run dev
```

Open the URL Vite prints. To create the self-contained static site, run:

```sh
npm run build
```

The finished site is written to `dist/`. `npm run preview` serves that build locally.

## Controls

- Move: arrow keys or WASD
- Select / confirm: Enter or Space
- Pause / resume: P or Escape
- Mute / unmute: M
- Menus: Up and Down, mouse, pen, or touch

The snake advances eight cells per second. Turns are buffered and take effect on a tick; reversing directly into the neck is not allowed. Eat another pulse before the combo bar empties to raise the multiplier from x2 through x5.

## Quality checks

Run `npm run typecheck`, `npm run lint`, `npm run format`, and `npm test`.
