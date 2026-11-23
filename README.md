# vista-bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/takhao666/vista-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/takhao666/vista-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Vista Bay** is a 3D open-world crime game in the spirit of GTA 6, built from scratch for make.fun's "Make GTA 6" bounty. A sun-soaked 600×600m coastal city — downtown towers, a beach and pier, the Golden Palm Casino, a hospital, a park, a harbor and an airport runway — free to explore on foot and by car, with traffic, pedestrians, a five-star wanted system, police pursuits, combat and a nine-mission original story.

You are **Mara Voss**, new in Vista Bay with $250 and nothing to lose. Fixer **Dario Kane** has work for you; **Rook** owns the city's underworld and wants you gone. Steal cars, outrun the Vista Bay police, and take the city back mission by mission.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: every script, texture and sound is generated locally or vendored under `game/` (Three.js r160 as `game/vendor/three.min.js`). Just serve the folder with any static server and open `game/index.html` in desktop Chrome.

## Play

- **WASD** move / drive · **Shift** run · **Mouse drag** look around (camera auto-follows)
- **E** steal / enter / exit a car · **Click** shoot / punch · **1 / 2** fists / pistol
- **R** reload · **F** punch · **M** big map · **Esc / P** pause
- Stealing a car, shooting, running people over and killing cops raise your **wanted level** (1–5 stars). Police cars chase and ram you; foot cops try to grab you; at 4+ stars the police set up roadblocks. Break line of sight and hide to cool the heat off.
- Get **busted** or **wasted** and you lose 20% of your cash and wake up at Vista General Hospital.
- Progress autosaves to `localStorage` after every completed mission; continue from the main menu.

## The city

- **Downtown** — procedural towers with lit windows, **Vista Beach** with sand, sea and a wooden pier, **Palm Avenue** lined with palm trees
- **Golden Palm Casino**, **Vista General Hospital**, **Palm Court Park** (fountain), **Harbor Docks** (containers and a crane), **Vista Bay Airport** (runway, terminal, parked plane)
- 26 traffic cars on a real road network, 18 stealable parked cars, 42 pedestrians who flee gunfire, day-afternoon sun and fog

## Story missions (9)

1. **First Wheels** — steal your first car, deliver it to Mara's Garage
2. **Dockside Delivery** — 90-second run to the end of Vista Pier
3. **Park Pickup** — meet Dario's contact, then lose the cops
4. **Pier Shootout** — clear Rook's crew off the pier
5. **Cash Run** — five cash drops across the city
6. **Casino Vault Truck** — steal the Golden Palm's armored truck
7. **Harbor Cleanup** — clear the smugglers from the docks
8. **Convoy Ambush** — wreck Rook's armored convoy on Palm Avenue
9. **Airport Showdown** — finish Rook on the runway

Each mission has dialogue, an on-screen objective with a beacon and minimap marker, timers where the story demands them, and a cash reward. All sound — engine, gunshots, sirens, mission music — is synthesized live with WebAudio.

## Layout

```
game/
  index.html          page, HUD, menus, import map
  vendor/three.min.js Three.js r160 (vendored, minified)
  src/
    main.js           bootstrap, game loop, input, test hooks
    state.js          shared state, math helpers, save/load
    city.js           procedural city, districts, landmarks, road graph
    vehicles.js       car models, traffic AI, parked cars, driving, explosions
    pedestrians.js    pedestrians + humanoid factory
    player.js         third-person character, camera, enter/exit cars
    police.js         wanted system, pursuit, foot cops, roadblocks
    missions.js       9 story missions, dialogue, beacons, timers
    combat.js         pistol raycast, tracers, fists, goons who shoot back
    hud.js            HUD, minimap, big map, menus, toasts
    audio.js          WebAudio synth: engine, gunfire, sirens, music
    shots.js          ?shot= presets (start / chase / mission / street)
screenshots/          real in-browser captures of the game
main.ts               entrypoint: copies game/ + screenshots/, writes dossier.json
```

## Screenshots

`?shot=start|chase|mission|street` opens a preset scene — title menu, police chase, pier shootout, or on-foot downtown.

---

<sub>Entered on [make.fun](https://make.fun/?ref=hvn9m3q0&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
