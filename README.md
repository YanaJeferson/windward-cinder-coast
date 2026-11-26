# Windward: Cinder Coast

[![make.fun flight game bounty](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![leaderboard rank](https://make.fun/badge/best-flight-game-20261126-0057/YanaJeferson/windward-cinder-coast/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/YanaJeferson/windward-cinder-coast/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A complete coastal flight game for the browser, entered in make.fun's
[Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057) bounty.

Fly the Petrel, a strut-braced bush plane, over the volcanic Cinder Coast: turquoise water,
black-sand headlands, a river-cut canyon, outer islands and a working airstrip. Eight ways to
fly, one airframe.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

No build step and no network requests: `game/index.html` and every module it loads live in this
repository. The game runs in desktop Chrome (or any current desktop browser) at 1280×720.

**Assets.** The sky panorama, ground, rock and asphalt textures are CC0 photographic sources credited in [CREDITS.md](./CREDITS.md); the game code, aircraft, terrain shape and HUD are original. The strip is surrounded by crop fields, hedgerows, fences, a dirt track and mixed woodland.

**Controls**

| Input | Action |
| --- | --- |
| `W` / `↑` or `S` / `↓` | pitch: W/↑ pushes the nose down, S/↓ pulls it up |
| `A` / `←` or `D` / `→` | roll |
| `I` `J` `K` `L` | alternate pitch/roll keys (I = nose down, K = nose up) |
| `Q` / `E` | rudder |
| `Shift` / `Ctrl` or mouse wheel | throttle |
| Mouse (click to capture) | fly the aircraft |
| `C` | chase / cockpit / wing camera |
| `G` | landing gear |
| `X` | engine start / stop (glide when off) |
| `B` | parking brake |
| `F` | flaps |
| `Space` | wheel brakes |
| `P` | pause |
| `R` | restart the sortie |
| `V` | assist / pro flight envelope |
| `[` / `]` | cycle weather (auto, sunny, windy, rain, storm, fog, snow, night) |
| `M` | mute |

## Seven ways to fly

1. **Free Flight** — no clock, no gates; learn the coast and land back on 36.
2. **First Solo** — a checkout flight: take off from 36, fly the circuit, full-stop landing.
3. **Dawn Ferry** — thread five coastal rings and land on runway 36.
4. **Cinder Run** — a timed low-level run through six gates in the Cinder canyon.
5. **The Long Way Home** — find the flare off the stacks on a tank that is nearly dry, then land.
6. **Ring Sprint** — eight rings around the whole island, flat out, no landing.
7. **Storm Front** — a crosswind landing in rain with a gusting front over the strip.
8. **Deadstick** — the engine quits over the strait; glide four kilometres to 36 and land.

`C` cycles the chase, cockpit and wing cameras. `V` switches between the forgiving assisted
envelope and the heavier Pro envelope.

The flight model keeps energy honest: throttle and climb trade speed, bank bends the flight
path, the wing stalls below 30 m/s, fuel burns, and a hard arrival ends the sortie.

**Systems.** The engine starts and stops with `X` (with a short starter crank); with it off the
Petrel glides, the propeller windmills and the HUD calls the glide speed. `Space` is wheel brake,
`B` is the parking brake. Landings need gear, a shallow descent and a runway; the touchdown is
graded (smooth, firm or hard) and a heavy arrival damages the airframe. Ailerons, elevator and
rudder animate with the controls; a crash throws a fireball, smoke, debris and a ground scar.
The mission card, HUD tapes, PAPI lights and approach lights lead you home.

## Layout

```
main.ts                 hands game/ and screenshots/ to the grader and writes the dossier
game/index.html         the entry page
game/src/main.js        boot, screens, the one loop
game/src/aircraft/      Petrel model, flight model, cockpit and lit gauges
game/src/world/         terrain, sea, sky, airstrip, gates, vegetation
game/src/hud/           compass, speed and altitude tapes, pitch ladder, mission card
game/src/camera/        chase, cockpit and orbit rigs
game/src/game/          missions, input, procedural audio
game/src/util/          maths and canvas-painted textures
game/vendor/            three.js (MIT), vendored and unmodified
```

The world is 16 km across, with four outer islands, woodland belts, crop fields and a water
shader that reads the terrain height for shallows, depth colour and shore foam. The four
screenshots in `screenshots/` are real renders of this game, staged by its own `?shot=` states
and captured in desktop Chromium at 1280×720.

## License

MIT. See [LICENSE](./LICENSE).
