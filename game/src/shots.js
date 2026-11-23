// shots.js — ?shot= presets for screenshots and testing.
// start: title menu over the city. chase: police pursuit, 3 stars.
// mission: mid-fight at the pier (mission 4). street: on foot downtown.

export function applyShot(G, shot) {
  const S = G.state;
  if (!shot) return false;
  G.shotMode = shot;
  if (shot === 'start') {
    // stay on the menu; the camera orbits downtown behind it
    G.menuOrbit = true;
    return true;
  }
  // every other preset starts the game immediately
  G.startGame(false);
  if (shot === 'chase') {
    // player in a car, mid-pursuit, 3 stars, police on the tail
    const car = G.vehicles.parked[0] || G.vehicles.traffic[0];
    if (car) {
      car.x = 30; car.z = 90; car.heading = 0;
      car.mesh.children[0].material.color.setHex(0xc0392b); // unmistakable red getaway car
      G.vehicles.enterCar(car, false);
      G.player.car.speed = 22;
    }
    S.wanted = 3;
    S.cash = 12450;
    S.health = 82;
    for (let i = 0; i < 3; i++) G.police.spawnPoliceCar(30, 90);
    // one more unit comes at the player head-on down the avenue, lights
    // flashing, so the pursuit reads in the frame, not just on the minimap
    const ahead = G.vehicles.makeCar(30, 205, Math.PI, 0xf5f5f5, { police: true, kind: 'police' });
    G.police.cars.push(ahead);
    G.missions.start(2); // timed delivery shows a live objective + timer
    G.hud.setObjective('Deliver the package to Vista Pier — 248m');
  } else if (shot === 'mission') {
    G.player.resetTo(0, 300, 0); // facing +z, down the pier at the goons
    S.weapon = 'pistol';
    S.ammo = 12; S.reserveAmmo = 60;
    S.cash = 8300;
    G.missions.start(4);
    // skip the "get to the pier" step: go straight to the shootout
    if (G.missions.active) {
      G.missions.active.stepIndex = 1;
      G.missions.enterStep();
    }
  } else if (shot === 'street') {
    G.player.resetTo(30, 42, Math.PI * 0.75);
    S.weapon = 'pistol';
    S.cash = 5120;
    G.missions.start(1);
  }
  return true;
}
