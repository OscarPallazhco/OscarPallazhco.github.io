import * as THREE from "three";

const ARENA = 36;
const WALL_H = 8;
const PLAYER_RADIUS = 0.55;
const PLAYER_EYE = 1.55;
const MOVE_SPEED = 9;
const TURN_SPEED = 2.35;
const SHOT_COOLDOWN = 0.28;
const SHOT_SPEED = 42;
const SHOT_LIFE = 1.4;
const MAX_HP = 100;
const PLAYER_DMG = 14;
const ENEMY_DMG = 9;
const ENEMY_RADIUS = 0.7;

const keys = new Set();
const obstacles = [];
const bullets = [];

let scene, camera, renderer, clock;
let playerYaw = 0;
let playerPos = new THREE.Vector3(0, 0, 12);
let playerHp = MAX_HP;
let playerCooldown = 0;
let running = false;
let ended = false;

let enemy;
let enemyHp = MAX_HP;
let enemyCooldown = 0;
let enemyWander = 0;
let muzzleLight;

const canvas = document.getElementById("game-canvas");
const startScreen = document.getElementById("start-screen");
const endScreen = document.getElementById("end-screen");
const hud = document.getElementById("hud");
const crosshair = document.getElementById("crosshair");
const playerBar = document.getElementById("player-health");
const enemyBar = document.getElementById("enemy-health");

document.getElementById("start-btn").addEventListener("click", startMatch);
document.getElementById("restart-btn").addEventListener("click", startMatch);

window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
    event.preventDefault();
  }
  keys.add(event.key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

function startMatch() {
  playerYaw = 0;
  playerPos.set(0, 0, 12);
  playerHp = MAX_HP;
  playerCooldown = 0;
  enemyHp = MAX_HP;
  enemyCooldown = 0.6;
  ended = false;
  running = true;
  keys.clear();

  while (bullets.length) {
    const bullet = bullets.pop();
    scene.remove(bullet.mesh);
  }

  enemy.position.set(0, 0, -12);
  enemy.userData.yaw = Math.PI;
  enemy.visible = true;
  setHealth(playerBar, 1);
  setHealth(enemyBar, 1);

  startScreen.hidden = true;
  endScreen.hidden = true;
  endScreen.setAttribute("aria-hidden", "true");
  hud.hidden = false;
  crosshair.hidden = false;
}

function endMatch(won) {
  running = false;
  ended = true;
  hud.hidden = true;
  crosshair.hidden = true;
  endScreen.hidden = false;
  endScreen.setAttribute("aria-hidden", "false");
  document.getElementById("end-kicker").textContent = "Match over";
  document.getElementById("end-title").textContent = won ? "Victory" : "Defeated";
  document.getElementById("end-copy").textContent = won
    ? "The computer opponent is down. Hold the arena."
    : "You were eliminated. Reload and try a better angle.";
}

function setHealth(el, ratio) {
  el.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
}

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1020);
  scene.fog = new THREE.Fog(0x0a1020, 18, 52);

  camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 120);
  clock = new THREE.Clock();

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;

  scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x1a120c, 0.55));

  const sun = new THREE.DirectionalLight(0xffe6c8, 1.15);
  sun.position.set(10, 18, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);

  muzzleLight = new THREE.PointLight(0x9cf4ff, 0, 8);
  camera.add(muzzleLight);
  scene.add(camera);

  buildArena();
  enemy = buildEnemy();
  scene.add(enemy);

  window.addEventListener("resize", onResize);
  renderer.setAnimationLoop(tick);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function addBox(w, h, d, x, y, z, color, opts = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.72,
      metalness: opts.metalness ?? 0.12,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 0,
    })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  if (opts.collide) {
    obstacles.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
    });
  }
  return mesh;
}

function buildArena() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA, ARENA),
    new THREE.MeshStandardMaterial({ color: 0x1a2438, roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(ARENA, 18, 0x3d5a88, 0x24344f);
  grid.position.y = 0.01;
  scene.add(grid);

  const half = ARENA / 2;
  const t = 1.2;
  addBox(ARENA + t * 2, WALL_H, t, 0, WALL_H / 2, -half - t / 2, 0x243049, { collide: true });
  addBox(ARENA + t * 2, WALL_H, t, 0, WALL_H / 2, half + t / 2, 0x243049, { collide: true });
  addBox(t, WALL_H, ARENA, -half - t / 2, WALL_H / 2, 0, 0x243049, { collide: true });
  addBox(t, WALL_H, ARENA, half + t / 2, WALL_H / 2, 0, 0x243049, { collide: true });

  const covers = [
    [8, 1.4, 2.4, -8, 0.7, -4],
    [2.4, 2.2, 2.4, 7, 1.1, 6],
    [3.4, 1.6, 1.6, 0, 0.8, 0],
    [1.8, 2.8, 1.8, -10, 1.4, 8],
    [5, 1.2, 1.6, 10, 0.6, -9],
  ];
  for (const c of covers) {
    addBox(c[0], c[1], c[2], c[3], c[4], c[5], 0x31415c, { collide: true, metalness: 0.2 });
  }

  addBox(1.2, 0.18, ARENA * 0.7, 0, 0.1, 0, 0x66d8ff, {
    roughness: 0.3,
    metalness: 0.4,
    emissive: 0x2288aa,
    emissiveIntensity: 0.6,
  });
}

function buildEnemy() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xc44a3a,
    roughness: 0.45,
    metalness: 0.25,
    emissive: 0x401010,
    emissiveIntensity: 0.35,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1f2a, roughness: 0.5, metalness: 0.4 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.15, 0.55), bodyMat);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.48), dark);
  head.position.y = 1.92;
  group.add(head);

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.12, 0.1),
    new THREE.MeshStandardMaterial({
      color: 0xffef9a,
      emissive: 0xffaa33,
      emissiveIntensity: 1.4,
    })
  );
  visor.position.set(0, 1.94, 0.24);
  group.add(visor);

  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.9), dark);
  gun.position.set(0.42, 1.2, 0.35);
  group.add(gun);

  const glow = new THREE.PointLight(0xff6a3a, 1.35, 11);
  glow.position.set(0, 1.7, 0);
  group.add(glow);

  group.userData.yaw = Math.PI;
  group.userData.bodyMat = bodyMat;
  return group;
}

function collideMove(pos, dx, dz, radius) {
  const next = pos.clone();
  next.x += dx;
  if (!blocked(next.x, pos.z, radius)) pos.x = next.x;
  next.x = pos.x;
  next.z += dz;
  if (!blocked(pos.x, next.z, radius)) pos.z = next.z;
}

function blocked(x, z, radius) {
  const limit = ARENA / 2 - radius - 0.15;
  if (Math.abs(x) > limit || Math.abs(z) > limit) return true;
  for (const o of obstacles) {
    if (
      x + radius > o.minX &&
      x - radius < o.maxX &&
      z + radius > o.minZ &&
      z - radius < o.maxZ
    ) {
      return true;
    }
  }
  return false;
}

function spawnBullet(origin, direction, fromPlayer) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 10),
    new THREE.MeshBasicMaterial({ color: fromPlayer ? 0x7ee7ff : 0xff6a4a })
  );
  mesh.position.copy(origin);
  scene.add(mesh);
  bullets.push({
    mesh,
    vel: direction.clone().normalize().multiplyScalar(SHOT_SPEED),
    life: SHOT_LIFE,
    fromPlayer,
  });
}

function shootPlayer() {
  if (playerCooldown > 0) return;
  playerCooldown = SHOT_COOLDOWN;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = camera.position.clone().add(dir.clone().multiplyScalar(0.6));
  spawnBullet(origin, dir, true);
  muzzleLight.intensity = 3.2;
}

function updatePlayer(dt) {
  if (keys.has("ArrowLeft")) playerYaw += TURN_SPEED * dt;
  if (keys.has("ArrowRight")) playerYaw -= TURN_SPEED * dt;

  const forward = new THREE.Vector3(-Math.sin(playerYaw), 0, -Math.cos(playerYaw));
  let move = 0;
  if (keys.has("ArrowUp")) move += 1;
  if (keys.has("ArrowDown")) move -= 1;
  if (move !== 0) {
    collideMove(playerPos, forward.x * move * MOVE_SPEED * dt, forward.z * move * MOVE_SPEED * dt, PLAYER_RADIUS);
  }

  camera.position.set(playerPos.x, PLAYER_EYE, playerPos.z);
  camera.rotation.set(0, playerYaw, 0);

  playerCooldown = Math.max(0, playerCooldown - dt);
  if (keys.has(" ")) shootPlayer();
  muzzleLight.intensity = THREE.MathUtils.damp(muzzleLight.intensity, 0, 12, dt);
}

function updateEnemy(dt) {
  if (enemyHp <= 0) return;

  const toPlayer = new THREE.Vector3().subVectors(playerPos, enemy.position);
  toPlayer.y = 0;
  const dist = toPlayer.length();
  const desiredYaw = Math.atan2(-toPlayer.x, -toPlayer.z);
  enemy.userData.yaw = THREE.MathUtils.lerp(enemy.userData.yaw, desiredYaw, 1 - Math.pow(0.001, dt));
  enemy.rotation.y = enemy.userData.yaw;

  enemyWander += dt;
  const side = Math.sin(enemyWander * 1.6) * 0.55;
  const right = new THREE.Vector3(Math.cos(enemy.userData.yaw), 0, -Math.sin(enemy.userData.yaw));
  const fwd = new THREE.Vector3(-Math.sin(enemy.userData.yaw), 0, -Math.cos(enemy.userData.yaw));

  let approach = dist > 9 ? 1 : dist < 5.5 ? -0.55 : 0.15;
  const speed = 5.4;
  collideMove(
    enemy.position,
    (fwd.x * approach + right.x * side) * speed * dt,
    (fwd.z * approach + right.z * side) * speed * dt,
    ENEMY_RADIUS
  );

  const keepOff = PLAYER_RADIUS + ENEMY_RADIUS + 0.15;
  const away = new THREE.Vector3().subVectors(enemy.position, playerPos);
  away.y = 0;
  const overlap = away.length();
  if (overlap > 0.001 && overlap < keepOff) {
    away.multiplyScalar((keepOff - overlap) / overlap);
    collideMove(enemy.position, away.x, away.z, ENEMY_RADIUS);
  }

  enemyCooldown -= dt;
  const facing = fwd.dot(toPlayer.clone().normalize());
  if (enemyCooldown <= 0 && dist < 18 && facing > 0.55) {
    enemyCooldown = 0.72 + Math.random() * 0.25;
    const origin = enemy.position.clone().add(new THREE.Vector3(0, 1.25, 0)).add(fwd.multiplyScalar(0.85));
    const aim = new THREE.Vector3(playerPos.x, PLAYER_EYE, playerPos.z).sub(origin);
    spawnBullet(origin, aim, false);
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.life -= dt;
    b.mesh.position.addScaledVector(b.vel, dt);
    const p = b.mesh.position;

    if (b.life <= 0 || blocked(p.x, p.z, 0.12) || p.y < 0.05 || p.y > WALL_H) {
      scene.remove(b.mesh);
      bullets.splice(i, 1);
      continue;
    }

    if (b.fromPlayer) {
      const hit = p.distanceTo(new THREE.Vector3(enemy.position.x, 1.2, enemy.position.z));
      if (enemyHp > 0 && hit < 0.85) {
        enemyHp = Math.max(0, enemyHp - PLAYER_DMG);
        setHealth(enemyBar, enemyHp / MAX_HP);
        enemy.userData.bodyMat.emissiveIntensity = 1.4;
        scene.remove(b.mesh);
        bullets.splice(i, 1);
        if (enemyHp <= 0) {
          enemy.visible = false;
          endMatch(true);
        }
      }
    } else {
      const hit = p.distanceTo(new THREE.Vector3(playerPos.x, PLAYER_EYE, playerPos.z));
      if (hit < 0.7) {
        playerHp = Math.max(0, playerHp - ENEMY_DMG);
        setHealth(playerBar, playerHp / MAX_HP);
        scene.remove(b.mesh);
        bullets.splice(i, 1);
        if (playerHp <= 0) endMatch(false);
      }
    }
  }

  if (enemy.userData.bodyMat.emissiveIntensity > 0.35) {
    enemy.userData.bodyMat.emissiveIntensity = THREE.MathUtils.damp(
      enemy.userData.bodyMat.emissiveIntensity,
      0.35,
      8,
      dt
    );
  }
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (running && !ended) {
    updatePlayer(dt);
    updateEnemy(dt);
    updateBullets(dt);
  } else {
    camera.position.set(playerPos.x, PLAYER_EYE, playerPos.z);
    camera.rotation.set(0, playerYaw, 0);
  }

  renderer.render(scene, camera);
}

init();
