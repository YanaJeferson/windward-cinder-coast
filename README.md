# Windward: Cinder Coast

[![make.fun flight game bounty](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![leaderboard rank](https://make.fun/badge/best-flight-game-20261126-0057/YanaJeferson/windward-cinder-coast/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/YanaJeferson/windward-cinder-coast/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A complete coastal flight game for the browser, entered in make.fun's
[Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057) bounty.

Fly the Petrel, a strut-braced bush plane, over the volcanic Cinder Coast: turquoise water,
black-sand headlands, a river-cut canyon, outer islands and a working airstrip. Nine ways to
fly, one airframe.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

No build step and no network requests: `game/index.html` and every module it loads live in this
repository. The game runs in desktop Chrome (or any current desktop browser) at 1280×720.

**Assets.** The sky panorama, ground, rock and asphalt textures are CC0 photographic sources credited in [CREDITS.md](./CREDITS.md); the game code, aircraft, terrain shape and HUD are original. The strip is surrounded by crop fields, hedgerows, fences, a dirt track and mixed woodland.

**Title screen.** The menu is the reference's cinematic composition rebuilt with this game's own scene: a sunset over the caldera lake, the village lights, the Petrel in frame, a glass menu, pilot profile, mission card, quick controls and a live-looking speed/altitude dial. Every pixel behind it is a real render; no menu photograph is used.

**Controls**

| Input | Action |
| --- | --- |
| `W` / `↑` or `S` / `↓` | pitch: W/↑ raises the nose (climb), S/↓ lowers it |
| `A` / `←` or `D` / `→` | roll |
| `I` `J` `K` `L` | alternate pitch/roll keys (I = nose up, K = nose down) |
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
| `T` or `[` / `]` | cycle weather (auto, sunny, windy, rain, storm, fog, snow, night) |
| `M` | mute |

## Nueve formas de volar

1. **Vuelo Libre** — sin reloj ni anillos; aprende la costa y vuelve a la 36.
2. **Primer Solo** — vuelo de comprobación: despega de la 36, vuela el circuito y aterriza completo.
3. **El Valle Perdido** — salida al atardecer por el lago de la caldera, su pueblo y el circuito de anillos.
4. **Ferry del Alba** — cruza cinco anillos costeros y aterriza en la 36.
5. **Pasada del Cinder** — pasada cronometrada por seis puertas del cañón.
6. **El Camino a Casa** — encuentra la bengala junto a las chimeneas con el depósito casi seco y vuelve.
7. **Sprint de Anillos** — ocho anillos alrededor de la isla, a fondo, sin aterrizar.
8. **Frente de Tormenta** — aterrizaje con viento cruzado y lluvia.
9. **Sin Motor** — el motor se para sobre el estrecho; planea cuatro kilómetros hasta la 36.

`C` cycles the chase, cockpit and wing cameras. `V` switches between the forgiving assisted
envelope and the heavier Pro envelope.

The flight model keeps energy honest: throttle and climb trade speed, a coordinated bank bends the
flight path toward the low wing (`g·tan(bank)/v`), the wing stalls below 30 m/s and drops a wing,
fuel burns, and the approach settles when the flare is flown. Landings are judged on sink rate,
runway alignment and centreline: smooth, firm or hard, with damage above 5.5 m/s; a flat, slow
arrival in a field is survivable but fails a runway landing. The airstrip plateau is dead flat
from threshold to threshold, so neither end of the runway hides in the slope.

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
