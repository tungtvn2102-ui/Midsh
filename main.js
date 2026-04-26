import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';
import { RectAreaLightUniformsLib } from 'https://unpkg.com/three@0.160.0/examples/jsm/lights/RectAreaLightUniformsLib.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const randRange = (a, b) => a + Math.random() * (b - a);

const sizes = { width: window.innerWidth, height: window.innerHeight };
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setScissorTest(true);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0717);
scene.fog = new THREE.FogExp2(0x0d0717, 0.028);

const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 1000);
camera.position.set(0, 1.6, 5);
scene.add(camera);

// Second camera for split-screen (Player 2)
const camera2 = new THREE.PerspectiveCamera(75, (sizes.width/2) / sizes.height, 0.1, 1000);
camera2.position.set(5, 6, 10);
scene.add(camera2);

const hemi = new THREE.HemisphereLight(0x6a5acd, 0x0a0612, 0.5);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xc084fc, 0.7);
dir.position.set(8, 12, 6);
dir.castShadow = true;
dir.shadow.mapSize.set(2048, 2048);
dir.shadow.camera.near = 0.5;
dir.shadow.camera.far = 50;
dir.shadow.camera.left = -20;
dir.shadow.camera.right = 20;
dir.shadow.camera.top = 20;
dir.shadow.camera.bottom = -20;
scene.add(dir);
RectAreaLightUniformsLib.init();
const rect = new THREE.RectAreaLight(0x9d4edd, 5.5, 8, 3);
rect.position.set(0, 6.0, -2);
rect.lookAt(0, 0, 0);
scene.add(rect);
const spot = new THREE.SpotLight(0x22d3ee, 1.2, 40, Math.PI / 5, 0.4, 1.5);
spot.position.set(-6, 10, 6);
spot.castShadow = true;
scene.add(spot);

function createGridTexture({ size = 1024, gap = 64, thin = 1, thickEvery = 4, thinColor = '#3b2f4a', thickColor = '#6a5acd', bg = '#12081f' } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size; const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size);
  for (let x = 0; x <= size; x += gap) {
    const isThick = (Math.round(x / gap) % thickEvery) === 0;
    ctx.strokeStyle = isThick ? thickColor : thinColor; ctx.lineWidth = isThick ? 2 : thin;
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, x + 0.5); ctx.lineTo(size, x + 0.5); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(8, 8); tex.anisotropy = 8; return tex;
}
const gridTex = createGridTexture();
const groundGeo = new THREE.PlaneGeometry(200, 200);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a0e2b, roughness: 0.9, metalness: 0.05, map: gridTex });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a0e2b, roughness: 0.95, metalness: 0.04, map: gridTex });
const wallGeo = new THREE.PlaneGeometry(200, 40);
const wallBack = new THREE.Mesh(wallGeo, wallMat); wallBack.position.set(0, 20, -100);
const wallFront = new THREE.Mesh(wallGeo, wallMat); wallFront.position.set(0, 20, 100); wallFront.rotation.y = Math.PI;
const wallLeft = new THREE.Mesh(wallGeo, wallMat); wallLeft.position.set(-100, 20, 0); wallLeft.rotation.y = Math.PI / 2;
const wallRight = new THREE.Mesh(wallGeo, wallMat); wallRight.position.set(100, 20, 0); wallRight.rotation.y = -Math.PI / 2;
for (const w of [wallBack, wallFront, wallLeft, wallRight]) { w.receiveShadow = true; scene.add(w); }

const pillarGeo = new THREE.CylinderGeometry(0.4, 0.4, 6, 24);
for (let i = 0; i < 12; i++) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x5b21b6, emissive: 0x6d28d9, emissiveIntensity: 0.3, metalness: 0.35, roughness: 0.6 });
  const p = new THREE.Mesh(pillarGeo, mat);
  p.position.set(randRange(-40, 40), 3, randRange(-40, 40));
  p.castShadow = true;
  p.receiveShadow = true;
  scene.add(p);
}

const player = { velocity: new THREE.Vector3(), isOnGround: true, speed: 8, jumpStrength: 6, health: 100, maxHealth: 100, score: 0 };

// Removed visible humanoid/player model per request

const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.getObject());

// Removed camera angle toggling per request

const keys = { w: false, a: false, s: false, d: false, space: false };
const keys2 = { up: false, down: false, left: false, right: false, jump: false, shoot: false, fireCharge: false };
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyW') keys.w = true;
  if (e.code === 'KeyA') keys.a = true;
  if (e.code === 'KeyS') keys.s = true;
  if (e.code === 'KeyD') keys.d = true;
  if (e.code === 'Space') keys.space = true;
  if (e.code === 'ArrowUp') keys2.up = true;
  if (e.code === 'ArrowDown') keys2.down = true;
  if (e.code === 'ArrowLeft') keys2.left = true;
  if (e.code === 'ArrowRight') keys2.right = true;
  if (e.code === 'ShiftRight') keys2.jump = true;
  if (e.code === 'Enter') keys2.shoot = true;
  if (e.code === 'ControlRight') keys2.fireCharge = true;
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW') keys.w = false;
  if (e.code === 'KeyA') keys.a = false;
  if (e.code === 'KeyS') keys.s = false;
  if (e.code === 'KeyD') keys.d = false;
  if (e.code === 'Space') keys.space = false;
  if (e.code === 'ArrowUp') keys2.up = false;
  if (e.code === 'ArrowDown') keys2.down = false;
  if (e.code === 'ArrowLeft') keys2.left = false;
  if (e.code === 'ArrowRight') keys2.right = false;
  if (e.code === 'ShiftRight') keys2.jump = false;
  if (e.code === 'Enter') keys2.shoot = false;
  if (e.code === 'ControlRight') keys2.fireCharge = false;
});

const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const overlayMessage = document.getElementById('overlayMessage');
const healthFill = document.getElementById('healthFill');
const healthText = document.getElementById('healthText');
const scoreText = document.getElementById('scoreText');
const enemiesText = document.getElementById('enemiesText');
const statusText = document.getElementById('statusText');
const universeContainer = document.getElementById('universe');

// Simple achievements using localStorage
const ACH_KEY = 'pve_achievements_v1';
function readAchievements() {
  try { return JSON.parse(localStorage.getItem(ACH_KEY) || '[]'); } catch { return []; }
}
function writeAchievements(list) {
  localStorage.setItem(ACH_KEY, JSON.stringify(list));
}
function addAchievement(label) {
  const list = readAchievements();
  if (!list.includes(label)) { list.push(label); writeAchievements(list); renderAchievements(); }
}
function renderAchievements() {
  // achievementsList element not present in this build — no-op
}
renderAchievements();

// Universe 3D header scene (separate lightweight renderer)
let uniRenderer, uniScene, uniCam, uniAnimId;
function initUniverse() {
  if (!universeContainer) return;
  const w = universeContainer.clientWidth; const h = universeContainer.clientHeight;
  uniRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  uniRenderer.setSize(w, h); uniRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  universeContainer.appendChild(uniRenderer.domElement);
  uniScene = new THREE.Scene();
  uniCam = new THREE.PerspectiveCamera(55, w / h, 0.1, 100);
  uniCam.position.set(0, 0, 8);
  const ambient = new THREE.AmbientLight(0x7c3aed, 0.8); uniScene.add(ambient);
  const glow = new THREE.PointLight(0x22d3ee, 1.4, 15); glow.position.set(0, -1, 2); uniScene.add(glow);
  // Planet
  const planet = new THREE.Mesh(new THREE.SphereGeometry(2.2, 48, 48), new THREE.MeshStandardMaterial({ color: 0x221031, roughness: 0.5, metalness: 0.2, emissive: 0x4c1d95, emissiveIntensity: 0.25 }));
  planet.position.y = -0.6; uniScene.add(planet);
  // Ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.08, 16, 128), new THREE.MeshStandardMaterial({ color: 0x9d4edd, metalness: 0.6, roughness: 0.2, emissive: 0x6d28d9, emissiveIntensity: 0.6 }));
  ring.rotation.x = Math.PI / 2.4; uniScene.add(ring);
  // Stars
  const starsGeo = new THREE.BufferGeometry();
  const starCount = 400;
  const pos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) { pos[i*3+0] = (Math.random()-0.5)*20; pos[i*3+1] = (Math.random()-0.2)*10; pos[i*3+2] = -Math.random()*10; }
  starsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0x94a3b8, size: 0.03 })); uniScene.add(stars);
  const animateUniverse = () => {
    ring.rotation.z += 0.0025; planet.rotation.y += 0.0015; stars.rotation.z += 0.0008;
    uniRenderer.render(uniScene, uniCam);
    uniAnimId = requestAnimationFrame(animateUniverse);
  };
  animateUniverse();
  window.addEventListener('resize', () => {
    if (!uniRenderer) return; const W = universeContainer.clientWidth; const H = universeContainer.clientHeight; uniRenderer.setSize(W, H); uniCam.aspect = W/H; uniCam.updateProjectionMatrix();
  });
}
initUniverse();

// AudioContext created lazily on first user gesture to satisfy browser autoplay policy
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq, duration, type = 'sine', volume = 0.2) {
  const ctx = getAudioCtx();
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.value = freq; o.connect(g); g.connect(ctx.destination);
  g.gain.value = volume; o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration); o.stop(ctx.currentTime + duration);
}
function playSound(name) {
  if (name === 'jump') playTone(500, 0.08, 'square', 0.15);
  else if (name === 'shoot') playTone(900, 0.05, 'sawtooth', 0.12);
  else if (name === 'fireball') playTone(220, 0.25, 'sine', 0.2);
  else if (name === 'stun') playTone(120, 0.35, 'triangle', 0.25);
  else if (name === 'hurt') playTone(160, 0.1, 'square', 0.2);
  else if (name === 'enemyDown') playTone(600, 0.2, 'sine', 0.18);
}

function requestPointerLock() {
  // Resume audio context if suspended (required by some browsers after lazy init)
  getAudioCtx();
  try {
    controls.lock();
  } catch (err) {
    overlayMessage.textContent = 'Pointer lock blocked. Click the canvas or press Play again.';
  }
}

startBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  requestPointerLock();
});
renderer.domElement.addEventListener('click', () => { if (!controls.isLocked) requestPointerLock(); });
controls.addEventListener('lock', () => { overlay.style.display = 'none'; overlayMessage.textContent = ''; });
controls.addEventListener('unlock', () => { overlay.style.display = ''; overlayMessage.textContent = 'Paused — click Play to resume'; });

const downRay = new THREE.Raycaster();

const projectileSpeed = 50;
const projectileLifetime = 2.0;
const projectileGeometry = new THREE.SphereGeometry(0.08, 12, 12);
const projectileMaterial = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.35 });
const projectiles = [];

function getMuzzlePosition(out) {
  const obj = controls.getObject();
  return out.copy(obj.position).add(new THREE.Vector3(0, 1.2, 0.1));
}

// Player 2 state
const player2 = { position: new THREE.Vector3(3, 1.6, 8), velocity: new THREE.Vector3(), isOnGround: true, speed: 7, jumpStrength: 6 };
function getMuzzlePositionP2(out) {
  return out.copy(player2.position).add(new THREE.Vector3(0, 0.2, 0));
}

function spawnProjectile() {
  const bullet = new THREE.Mesh(projectileGeometry, projectileMaterial.clone());
  bullet.castShadow = true;
  getMuzzlePosition(bullet.position);
  const dirVec = new THREE.Vector3();
  camera.getWorldDirection(dirVec);
  bullet.userData = { dir: dirVec.clone(), life: projectileLifetime };
  scene.add(bullet);
  projectiles.push(bullet);
}

window.addEventListener('mousedown', (e) => { if (e.button === 0 && controls.isLocked) spawnProjectile(); });
window.addEventListener('mousedown', (e) => { if (e.button === 0 && controls.isLocked) playSound('shoot'); });
// Block default context menu so right-click can be used for special ability
window.addEventListener('contextmenu', (e) => { e.preventDefault(); }, { passive: false });

// Right-click: charge and release a giant fireball with AoE
let isCharging = false;
let chargeTime = 0;
const maxCharge = 1.25; // seconds to reach full charge
const fireballMaxRadius = 1.2; // visual radius
const fireballSpeed = 30;
const fireballLifetime = 4.0;
const fireballs = [];
const fireballGeo = new THREE.SphereGeometry(0.4, 24, 24);
const fireballMat = new THREE.MeshStandardMaterial({ color: 0xf0abfc, emissive: 0xa21caf, emissiveIntensity: 0.8, roughness: 0.35, metalness: 0.25 });

function spawnFireball(power01) {
  const size = THREE.MathUtils.lerp(0.4, fireballMaxRadius, power01);
  const fb = new THREE.Mesh(fireballGeo, fireballMat.clone());
  fb.scale.setScalar(size / 0.4);
  fb.castShadow = true;
  getMuzzlePosition(fb.position);
  const dirVec = new THREE.Vector3(); camera.getWorldDirection(dirVec);
  fb.userData = { dir: dirVec.clone(), life: fireballLifetime, power: power01, radius: size };
  scene.add(fb);
  fireballs.push(fb);
}

function spawnProjectileAt(pos, dir) {
  const b = new THREE.Mesh(projectileGeometry, projectileMaterial.clone());
  b.castShadow = true;
  b.position.copy(pos);
  b.userData = { dir: dir.clone(), life: projectileLifetime };
  scene.add(b);
  projectiles.push(b);
}
function spawnFireballAt(power01, pos, dir) {
  const size = THREE.MathUtils.lerp(0.4, fireballMaxRadius, power01);
  const fb = new THREE.Mesh(fireballGeo, fireballMat.clone());
  fb.scale.setScalar(size / 0.4);
  fb.castShadow = true;
  fb.position.copy(pos);
  fb.userData = { dir: dir.clone(), life: fireballLifetime, power: power01, radius: size };
  scene.add(fb);
  fireballs.push(fb);
}

window.addEventListener('mousedown', (e) => {
  if (e.button === 2 && controls.isLocked) {
    isCharging = true; chargeTime = 0; statusText.textContent = 'Charging fireball...';
  }
});

// Player 2 fireball charge with Right Ctrl
let isCharging2 = false; let chargeTime2 = 0;
window.addEventListener('keydown', (e) => {
  if (e.code === 'ControlRight') { isCharging2 = true; chargeTime2 = 0; statusText.textContent = 'P2 charging fireball...'; }
  if (e.code === 'Enter') {
    const dir = new THREE.Vector3(0, 0, -1);
    const origin = new THREE.Vector3(); getMuzzlePositionP2(origin);
    spawnProjectileAt(origin, dir);
    playSound('shoot');
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ControlRight' && isCharging2) {
    isCharging2 = false;
    const power = clamp(chargeTime2 / maxCharge, 0.1, 1);
    const dir = new THREE.Vector3(0, 0, -1);
    const origin = new THREE.Vector3(); getMuzzlePositionP2(origin);
    spawnFireballAt(power, origin, dir);
    statusText.textContent = '';
    playSound('fireball');
  }
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 2 && isCharging) {
    isCharging = false;
    const power = clamp(chargeTime / maxCharge, 0.1, 1);
    spawnFireball(power);
    statusText.textContent = '';
    playSound('fireball');
  }
});

const enemies = [];
const enemyGeometry = new THREE.CapsuleGeometry(0.6, 1.0, 6, 12);
const enemyBaseMaterial = new THREE.MeshStandardMaterial({ color: 0xa78bfa, roughness: 0.75, metalness: 0.15, emissive: 0x6d28d9, emissiveIntensity: 0.25 });
// Sprinter type: smaller, faster enemy
const sprinterGeometry = new THREE.CapsuleGeometry(0.45, 0.6, 6, 12);
const sprinterMaterial = new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.65, metalness: 0.25, emissive: 0x0891b2, emissiveIntensity: 0.2 });
// Health bar materials (reused)
const hpBgMaterial = new THREE.MeshBasicMaterial({ color: 0x0a0612, transparent: true, opacity: 0.9, depthWrite: false });
const hpFillMaterial = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.98, depthWrite: false });
const hpBarWidth = 0.9; // world units
const hpBarHeight = 0.12;

function createEnemyHealthBar() {
  const group = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(hpBarWidth, hpBarHeight), hpBgMaterial.clone());
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(hpBarWidth * 0.96, hpBarHeight * 0.68), hpFillMaterial.clone());
  // Slightly in front to avoid z-fighting
  fill.position.z = 0.001;
  group.add(bg);
  group.add(fill);
  group.renderOrder = 10; // draw on top-ish
  return { group, fill };
}

function setHealthBarPercent(hpUI, percent01) {
  const pct = clamp(percent01, 0, 1);
  hpUI.fill.scale.x = pct;
  // Left-align the fill by offsetting after scale
  const fullWidth = hpBarWidth * 0.96;
  hpUI.fill.position.x = -(fullWidth / 2) + (fullWidth * pct) / 2;
  // Magenta -> cyan gradient for modern palette
  const color = new THREE.Color();
  const h = 0.83 - 0.33 * pct;
  color.setHSL(h, 0.9, 0.55);
  hpUI.fill.material.color.copy(color);
}

function createHitboxWireframe(geometry) {
  const edges = new THREE.EdgesGeometry(geometry);
  const mat = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.6 });
  const wire = new THREE.LineSegments(edges, mat);
  wire.renderOrder = 5;
  return wire;
}

function spawnEnemy() {
  const isSprinter = Math.random() < 0.35; // 35% chance
  const e = new THREE.Mesh(isSprinter ? sprinterGeometry : enemyGeometry, (isSprinter ? sprinterMaterial : enemyBaseMaterial).clone());
  e.castShadow = true;
  const radius = randRange(18, 35);
  const angle = randRange(0, Math.PI * 2);
  e.position.set(Math.cos(angle) * radius, 1.3, Math.sin(angle) * radius);
  const baseHealth = isSprinter ? 22 : 30;
  const baseSpeed = isSprinter ? randRange(3.6, 5.0) : randRange(2.2, 3.6);
  e.userData = { health: baseHealth, maxHealth: baseHealth, speed: baseSpeed, damageCooldown: 0, type: isSprinter ? 'sprinter' : 'brute' };
  scene.add(e);
  enemies.push(e);

  // Hitbox wireframe attached to enemy so it follows transforms
  const hitbox = createHitboxWireframe(isSprinter ? sprinterGeometry : enemyGeometry);
  e.add(hitbox);
  e.userData.hitbox = hitbox;

  // Floating HP bar (billboard) managed by scene and updated every frame
  const hpUI = createEnemyHealthBar();
  scene.add(hpUI.group);
  e.userData.hpUI = hpUI;
  setHealthBarPercent(hpUI, 1);
}

function removeEnemy(enemy) {
  scene.remove(enemy);
  const idx = enemies.indexOf(enemy);
  if (idx >= 0) enemies.splice(idx, 1);
  if (enemy.userData && enemy.userData.hpUI) {
    scene.remove(enemy.userData.hpUI.group);
  }
}

let enemySpawnTimer = 0;
let enemySpawnInterval = 2.0;

function damagePlayer(amount) {
  player.health = Math.max(0, player.health - amount);
  updateHealthUI();
  if (player.health === 0) gameOver();
  playSound('hurt');
}

function updateHealthUI() {
  const pct = (player.health / player.maxHealth) * 100;
  healthFill.style.width = pct + '%';
  healthFill.style.background = pct < 35 ? 'linear-gradient(90deg, #dc2626, #ef4444)' : 'linear-gradient(90deg, #16a34a, #22c55e)';
  healthText.textContent = Math.round(player.health).toString();
}
function updateScoreUI() { scoreText.textContent = player.score.toString(); }
function updateEnemiesUI() { enemiesText.textContent = enemies.length.toString(); }

function gameOver() {
  controls.unlock();
  overlay.style.display = '';
  overlayMessage.innerHTML = 'You were defeated. Score: ' + player.score + '<br/>Click Play to restart';
  if (player.score >= 100) addAchievement('Score 100+');
  if (player.health <= 0) addAchievement('Fallen Warrior');
  resetGame();
}

function resetGame() {
  for (const e of [...enemies]) removeEnemy(e);
  for (const p of [...projectiles]) scene.remove(p);
  projectiles.length = 0;
  player.health = player.maxHealth;
  player.score = 0;
  updateHealthUI();
  updateScoreUI();
  updateEnemiesUI();
  enemySpawnInterval = 2.0;
  enemySpawnTimer = 0;
  camera.position.set(0, 1.6, 5);
  controls.getObject().position.set(0, 1.6, 5);
}

const tmpVec3 = new THREE.Vector3();
function handleProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const b = projectiles[i];
    b.userData.life -= dt;
    if (b.userData.life <= 0) { scene.remove(b); projectiles.splice(i, 1); continue; }
    b.position.addScaledVector(b.userData.dir, projectileSpeed * dt);
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      tmpVec3.copy(b.position).sub(e.position);
      if (tmpVec3.lengthSq() < 0.8) {
        e.userData.health -= 15;
        scene.remove(b); projectiles.splice(i, 1);
        if (e.userData.hpUI) setHealthBarPercent(e.userData.hpUI, e.userData.health / 30);
        if (e.userData.health <= 0) { removeEnemy(e); player.score += 10; updateScoreUI(); updateEnemiesUI(); playSound('enemyDown'); }
        break;
      }
    }
  }
}

// Fireball handling with AoE on proximity to enemies or lifetime expiration
function handleFireballs(dt) {
  for (let i = fireballs.length - 1; i >= 0; i--) {
    const fb = fireballs[i];
    fb.userData.life -= dt;
    fb.position.addScaledVector(fb.userData.dir, fireballSpeed * dt);
    // Detonate if near any enemy or on life end
    let detonated = fb.userData.life <= 0;
    for (let j = enemies.length - 1; j >= 0 && !detonated; j--) {
      const e = enemies[j];
      tmpVec3.copy(fb.position).sub(e.position);
      if (tmpVec3.length() <= (fb.userData.radius + 0.7)) {
        detonated = true;
      }
    }
    if (detonated) {
      // Area damage and pushback
      const radius = fb.userData.radius + 1.2;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        const dist = e.position.distanceTo(fb.position);
        if (dist <= radius) {
          const dmg = Math.max(10, (1 - dist / radius) * 40 * fb.userData.power);
          e.userData.health -= dmg;
          if (e.userData.hpUI) setHealthBarPercent(e.userData.hpUI, e.userData.health / 30);
          if (e.userData.health <= 0) { removeEnemy(e); player.score += 10; updateScoreUI(); updateEnemiesUI(); playSound('enemyDown'); }
        }
      }
      scene.remove(fb);
      fireballs.splice(i, 1);
      continue;
    }
  }
}

function handleEnemies(dt) {
  for (const e of enemies) {
    const playerPos = controls.getObject().position;
    tmpVec3.copy(playerPos).sub(e.position); tmpVec3.y = 0; const len = tmpVec3.length();
    if (len > 0.0001) { tmpVec3.normalize(); e.position.addScaledVector(tmpVec3, e.userData.speed * dt); }
    if (len > 0.4) e.rotation.y = Math.atan2(tmpVec3.x, tmpVec3.z);
    e.userData.damageCooldown -= dt;
    if (len < 1.2 && e.userData.damageCooldown <= 0) {
      damagePlayer(10);
      e.userData.damageCooldown = 0.8;
      if (e.userData.isGiant) { applyStun(0.8); playSound('stun'); }
    }

    // Update HP bar position and facing
    if (e.userData.hpUI) {
      const hpGroup = e.userData.hpUI.group;
      hpGroup.position.copy(e.position).add(new THREE.Vector3(0, 2.2, 0));
      hpGroup.quaternion.copy(camera.quaternion);
    }

    // Update giant form state machine
    maybeUpdateGiantForm(e, dt);
  }
}

function trySpawnEnemies(dt) {
  enemySpawnTimer += dt;
  if (enemySpawnTimer >= enemySpawnInterval) {
    enemySpawnTimer = 0; spawnEnemy(); updateEnemiesUI();
    enemySpawnInterval = clamp(enemySpawnInterval * 0.97, 0.6, 999);
  }
}

const GRAVITY = 16; const friction = 10;
function updateMovement(dt) {
  const obj = controls.getObject();
  const forward = new THREE.Vector3(); const right = new THREE.Vector3();
  camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
  right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).negate();
  const moveDir = new THREE.Vector3();
  if (keys.w) moveDir.add(forward); if (keys.s) moveDir.sub(forward); if (keys.a) moveDir.add(right); if (keys.d) moveDir.sub(right);
  if (moveDir.lengthSq() > 0) moveDir.normalize();
  const canMove = stunTimer <= 0;
  const targetVX = canMove ? moveDir.x * player.speed : 0;
  const targetVZ = canMove ? moveDir.z * player.speed : 0;
  player.velocity.x = THREE.MathUtils.damp(player.velocity.x, targetVX, friction, dt);
  player.velocity.z = THREE.MathUtils.damp(player.velocity.z, targetVZ, friction, dt);
  downRay.set(obj.position.clone(), new THREE.Vector3(0, -1, 0));
  const hits = downRay.intersectObject(ground, false);
  const onGround = hits.length && (hits[0].distance <= 1.61);
  player.isOnGround = onGround;
  if (onGround) { player.velocity.y = 0; if (keys.space) player.velocity.y = player.jumpStrength; } else { player.velocity.y -= GRAVITY * dt; }
  if (keys.space && onGround) playSound('jump');
  obj.position.addScaledVector(player.velocity, dt);
  if (obj.position.y < 1.6) obj.position.y = 1.6;
  // Player model removed; no sync needed
  // Player 2 movement (arrow keys)
  const move2 = new THREE.Vector3((keys2.right?1:0) - (keys2.left?1:0), 0, (keys2.down?1:0) - (keys2.up?1:0));
  if (move2.lengthSq() > 0) move2.normalize();
  player2.velocity.x = THREE.MathUtils.damp(player2.velocity.x, move2.x * player2.speed, friction, dt);
  player2.velocity.z = THREE.MathUtils.damp(player2.velocity.z, move2.z * player2.speed, friction, dt);
  // simple ground & jump
  player2.velocity.y -= GRAVITY * dt;
  if (keys2.jump && player2.isOnGround) { player2.velocity.y = player2.jumpStrength; playSound('jump'); }
  player2.position.addScaledVector(player2.velocity, dt);
  if (player2.position.y < 1.6) { player2.position.y = 1.6; player2.isOnGround = true; player2.velocity.y = 0; } else { player2.isOnGround = false; }
}

window.addEventListener('resize', () => {
  sizes.width = window.innerWidth; sizes.height = window.innerHeight;
  camera.aspect = sizes.width / sizes.height; camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
});

updateHealthUI(); updateScoreUI(); updateEnemiesUI();

let last = performance.now();
function animate(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (controls.isLocked) { updateMovement(dt); handleProjectiles(dt); handleEnemies(dt); trySpawnEnemies(dt); }
  // Charging indicator
  if (isCharging) { chargeTime += dt; const pct = clamp(chargeTime / maxCharge, 0, 1); statusText.textContent = `Charging fireball: ${Math.round(pct*100)}%`; }
  updateStun(dt);
  handleFireballs(dt);
  // Split-screen rendering: left (P1) and right (P2)
  const halfW = Math.floor(sizes.width / 2);
  renderer.setViewport(0, 0, halfW, sizes.height);
  renderer.setScissor(0, 0, halfW, sizes.height);
  camera.aspect = (halfW) / sizes.height; camera.updateProjectionMatrix();
  renderer.render(scene, camera);

  renderer.setViewport(halfW, 0, sizes.width - halfW, sizes.height);
  renderer.setScissor(halfW, 0, sizes.width - halfW, sizes.height);
  camera2.aspect = (sizes.width - halfW) / sizes.height; camera2.updateProjectionMatrix();
  camera2.position.copy(player2.position.clone().add(new THREE.Vector3(6, 6, 10)));
  camera2.lookAt(player2.position);
  renderer.render(scene, camera2);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

for (let i = 0; i < 4; i++) spawnEnemy();
updateEnemiesUI();

// Giant-form behavior for enemies: temporary morph that increases speed and stuns on hit
function maybeUpdateGiantForm(e, dt) {
  if (!e.userData.giantTimer) {
    e.userData.giantTimer = randRange(3, 7);
    e.userData.isGiant = false;
  }
  e.userData.giantTimer -= dt;
  if (e.userData.giantTimer <= 0) {
    // Toggle state
    e.userData.isGiant = !e.userData.isGiant;
    e.userData.giantTimer = e.userData.isGiant ? randRange(2.5, 4.0) : randRange(4.5, 7.0);
    if (e.userData.isGiant) {
      e.scale.setScalar(1.8);
      e.userData.speedBoost = e.userData.speed * 0.8;
      e.userData.speed += e.userData.speedBoost;
      if (e.userData.hitbox) e.userData.hitbox.material.color.set(0xfbbf24);
      if (e.userData.hpUI) e.userData.hpUI.group.position.y += 0.4;
    } else {
      e.scale.setScalar(1.0);
      if (e.userData.speedBoost) e.userData.speed -= e.userData.speedBoost;
      if (e.userData.hitbox) e.userData.hitbox.material.color.set(0x22d3ee);
    }
  }
}

let stunTimer = 0;
function applyStun(duration) {
  stunTimer = Math.max(stunTimer, duration);
  statusText.textContent = 'Stunned!';
}

function updateStun(dt) {
  if (stunTimer > 0) {
    stunTimer -= dt;
    if (stunTimer <= 0) statusText.textContent = '';
    // Zero out horizontal intent while stunned
    player.velocity.x = 0; player.velocity.z = 0;
  }
}


