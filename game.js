const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

const playerScoreEl = document.getElementById("playerScore");
const enemyScoreEl = document.getElementById("enemyScore");
const timerEl = document.getElementById("timer");
const statusEl = document.getElementById("status");

const state = {
  playerScore: 0,
  enemyScore: 0,
  timeLeft: 60,
  lastShot: 0,
  keys: {},
  gameOver: false,
  possession: "player",
  ball: null,
  player: null,
  enemy: null,
  hoop: null,
  rim: null,
  lastTime: 0
};

function createScene() {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.14, 0.3, 0.7, 1);

  const camera = new BABYLON.ArcRotateCamera(
    "camera",
    -Math.PI / 2,
    Math.PI / 2.5,
    18,
    new BABYLON.Vector3(0, 0, 0),
    scene
  );
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 8;
  camera.upperRadiusLimit = 30;
  camera.wheelPrecision = 20;

  const light = new BABYLON.HemisphericLight(
    "light",
    new BABYLON.Vector3(0, 1, 0),
    scene
  );
  light.intensity = 1.1;

  const dirLight = new BABYLON.DirectionalLight(
    "dirLight",
    new BABYLON.Vector3(-1, -2, 1),
    scene
  );
  dirLight.intensity = 0.6;

  // 地板
  const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 26, height: 18 }, scene);
  ground.material = new BABYLON.StandardMaterial("groundMat", scene);
  ground.material.diffuseColor = new BABYLON.Color3(0.2, 0.7, 0.3);

  const lineMat = new BABYLON.StandardMaterial("lineMat", scene);
  lineMat.emissiveColor = new BABYLON.Color3(1, 1, 1);

  function addLine(p1, p2) {
    const line = BABYLON.MeshBuilder.CreateLines("line", { points: [p1, p2] }, scene);
    line.color = new BABYLON.Color3(1, 1, 1);
    line.material = lineMat;
  }

  addLine(new BABYLON.Vector3(-10, 0.02, -7), new BABYLON.Vector3(10, 0.02, -7));
  addLine(new BABYLON.Vector3(-10, 0.02, 7), new BABYLON.Vector3(10, 0.02, 7));
  addLine(new BABYLON.Vector3(-10, 0.02, -7), new BABYLON.Vector3(-10, 0.02, 7));
  addLine(new BABYLON.Vector3(10, 0.02, -7), new BABYLON.Vector3(10, 0.02, 7));
  addLine(new BABYLON.Vector3(0, 0.02, -7), new BABYLON.Vector3(0, 0.02, 7));

  // 篮筐
  const hoopGroup = new BABYLON.TransformNode("hoopGroup");
  const hoopPole = BABYLON.MeshBuilder.CreateCylinder("hoopPole", { height: 3.5, diameter: 0.15 }, scene);
  hoopPole.position = new BABYLON.Vector3(8.4, 1.7, 0);
  hoopPole.parent = hoopGroup;

  const backBoard = BABYLON.MeshBuilder.CreateBox("backBoard", { width: 1.5, height: 1, depth: 0.12 }, scene);
  backBoard.position = new BABYLON.Vector3(8.8, 2.8, 0);
  backBoard.parent = hoopGroup;

  const rim = BABYLON.MeshBuilder.CreateTorus("rim", { diameter: 1.2, thickness: 0.08 }, scene);
  rim.rotation.x = Math.PI / 2;
  rim.position = new BABYLON.Vector3(8.25, 2.2, 0);
  rim.parent = hoopGroup;

  // 球员
  const playerMat = new BABYLON.StandardMaterial("playerMat", scene);
  playerMat.diffuseColor = new BABYLON.Color3(0.38, 0.6, 1);

  const enemyMat = new BABYLON.StandardMaterial("enemyMat", scene);
  enemyMat.diffuseColor = new BABYLON.Color3(1, 0.45, 0.45);

  const playerBody = BABYLON.MeshBuilder.CreateSphere("playerBody", { diameter: 0.9 }, scene);
  playerBody.material = playerMat;
  playerBody.position = new BABYLON.Vector3(-6, 0.55, 0);

  const enemyBody = BABYLON.MeshBuilder.CreateSphere("enemyBody", { diameter: 0.9 }, scene);
  enemyBody.material = enemyMat;
  enemyBody.position = new BABYLON.Vector3(6, 0.55, 0);

  // 球
  const ballMat = new BABYLON.StandardMaterial("ballMat", scene);
  ballMat.diffuseColor = new BABYLON.Color3(1, 0.7, 0.1);

  const ball = BABYLON.MeshBuilder.CreateSphere("ball", { diameter: 0.7 }, scene);
  ball.material = ballMat;
  ball.position = new BABYLON.Vector3(-6, 0.8, 0);

  const player = {
    mesh: playerBody,
    x: -6, y: 0.55, z: 0,
    speed: 4.5
  };

  const enemy = {
    mesh: enemyBody,
    x: 6, y: 0.55, z: 0,
    speed: 3.6
  };

  state.player = player;
  state.enemy = enemy;
  state.ball = ball;
  state.hoop = hoopGroup;
  state.rim = rim;

  scene.registerBeforeRender(() => {
    const dt = engine.getDeltaTime() / 1000;
    if (!state.gameOver) {
      updateMovement(dt);
      updateEnemy(dt);
      updateBall(dt);
      updateHud();
    }
  });

  return scene;
}

function updateMovement(dt) {
  const player = state.player;
  const ball = state.ball;

  let mx = 0;
  let mz = 0;

  if (state.keys["w"] || state.keys["arrowup"]) mz -= 1;
  if (state.keys["s"] || state.keys["arrowdown"]) mz += 1;
  if (state.keys["a"] || state.keys["arrowleft"]) mx -= 1;
  if (state.keys["d"] || state.keys["arrowright"]) mx += 1;

  if (mx !== 0 || mz !== 0) {
    const len = Math.hypot(mx, mz) || 1;
    mx /= len; mz /= len;
    player.x += mx * player.speed * dt;
    player.z += mz * player.speed * dt;
    player.x = clamp(player.x, -9.5, 9.5);
    player.z = clamp(player.z, -6.5, 6.5);
  }

  player.mesh.position.x = player.x;
  player.mesh.position.z = player.z;

  if (state.possession === "player") {
    ball.position.x = player.x;
    ball.position.z = player.z + 0.7;
    ball.position.y = 0.85;
  }
}

function updateEnemy(dt) {
  const enemy = state.enemy;
  const player = state.player;

  const targetX = player.x * 0.6 + 5.5;
  const targetZ = player.z * 0.4;

  const dx = targetX - enemy.x;
  const dz = targetZ - enemy.z;
  const length = Math.hypot(dx, dz) || 1;

  if (length > 0.1) {
    enemy.x += (dx / length) * enemy.speed * dt;
    enemy.z += (dz / length) * enemy.speed * dt;
  }

  enemy.mesh.position.x = enemy.x;
  enemy.mesh.position.z = enemy.z;

  if (Math.random() < 0.01 && !state.ball.flight && state.possession !== "player") {
    shootEnemy();
  }
}

function shootEnemy() {
  const enemy = state.enemy;
  const target = new BABYLON.Vector3(8.2, 2.3, 0);

  const dx = target.x - enemy.x;
  const dz = target.z - enemy.z;
  const dy = target.y - 0.8;

  const len = Math.hypot(dx, Math.hypot(dz, dy)) || 1;

  state.ball.flight = true;
  state.possession = "enemy";
  state.ball.velocity = new BABYLON.Vector3(
    (dx / len) * 10,
    (dy / len) * 10 + 1.8,
    (dz / len) * 10
  );
  state.ball.owner = "enemy";
}

function shootBall() {
  if (state.gameOver || state.possession !== "player") return;

  const player = state.player;
  const target = new BABYLON.Vector3(8.2, 2.3, 0);

  const dx = target.x - player.x;
  const dz = target.z - player.z;
  const dy = target.y - 0.8;

  const len = Math.hypot(dx, Math.hypot(dz, dy)) || 1;

  state.ball.flight = true;
  state.ball.velocity = new BABYLON.Vector3(
    (dx / len) * 11,
    (dy / len) * 11 + 2.0,
    (dz / len) * 11
  );
  state.ball.owner = "player";
}

function updateBall(dt) {
  const ball = state.ball;

  if (!ball.flight) {
    ball.position.y = 0.85;
    return;
  }

  ball.position.x += ball.velocity.x * dt;
  ball.position.z += ball.velocity.z * dt;
  ball.position.y += ball.velocity.y * dt;

  ball.velocity.y -= 4.8 * dt;

  if (
    ball.position.x > 7.6 && ball.position.x < 9.2 &&
    ball.position.z > -0.5 && ball.position.z < 0.5 &&
    ball.position.y < 2.9 && ball.position.y > 1.4
  ) {
    if (ball.owner === "player") {
      state.playerScore += 2;
      statusEl.textContent = "状态：你命中两分！";
    } else {
      state.enemyScore += 2;
      statusEl.textContent = "状态：敌方命中两分！";
    }

    state.ball.flight = false;
    state.ball.velocity = new BABYLON.Vector3(0, 0, 0);
    state.possession = ball.owner === "player" ? "player" : "enemy";
    if (state.possession === "player") {
      state.ball.position.x = state.player.x;
      state.ball.position.z = state.player.z + 0.7;
      state.ball.position.y = 0.85;
    } else {
      state.ball.position.x = state.enemy.x;
      state.ball.position.z = state.enemy.z + 0.7;
      state.ball.position.y = 0.85;
    }
    updateHud();
    return;
  }

  if (ball.position.y <= 0.35) {
    ball.position.y = 0.35;
    ball.flight = false;
    ball.velocity = new BABYLON.Vector3(0, 0, 0);

    if (Math.random() < 0.5) {
      state.possession = "player";
      ball.position.x = state.player.x;
      ball.position.z = state.player.z + 0.7;
    } else {
      state.possession = "enemy";
      ball.position.x = state.enemy.x;
      ball.position.z = state.enemy.z + 0.7;
    }
  }

  if (ball.position.x < -11 || ball.position.x > 11 || ball.position.z < -8 || ball.position.z > 8) {
    ball.flight = false;
    ball.velocity = new BABYLON.Vector3(0, 0, 0);
    state.possession = Math.random() < 0.5 ? "player" : "enemy";
    if (state.possession === "player") {
      ball.position.x = state.player.x;
      ball.position.z = state.player.z + 0.7;
    } else {
      ball.position.x = state.enemy.x;
      ball.position.z = state.enemy.z + 0.7;
    }
  }
}

function updateHud() {
  playerScoreEl.textContent = state.playerScore;
  enemyScoreEl.textContent = state.enemyScore;
  timerEl.textContent = Math.ceil(state.timeLeft);
}

function resetGame() {
  state.playerScore = 0;
  state.enemyScore = 0;
  state.timeLeft = 60;
  state.gameOver = false;
  state.possession = "player";
  state.ball.flight = false;
  state.ball.velocity = new BABYLON.Vector3(0, 0, 0);

  state.player.x = -6;
  state.player.z = 0;
  state.enemy.x = 6;
  state.enemy.z = 0;

  state.player.mesh.position = new BABYLON.Vector3(-6, 0.55, 0);
  state.enemy.mesh.position = new BABYLON.Vector3(6, 0.55, 0);

  state.ball.position = new BABYLON.Vector3(-6, 0.85, 0.7);
  statusEl.textContent = "状态：比赛中";
  updateHud();
}

document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  state.keys[key] = true;

  if (key === " ") {
    e.preventDefault();
    shootBall();
  }

  if (key === "r") resetGame();
});

document.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  state.keys[key] = false;
});

canvas.addEventListener("click", () => shootBall());

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

const scene = createScene();
state.ball.flight = false;
state.ball.velocity = new BABYLON.Vector3(0, 0, 0);

setInterval(() => {
  if (state.gameOver) return;
  state.timeLeft -= 1;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    state.gameOver = true;
    statusEl.textContent = "状态：比赛结束";
  }
  updateHud();
}, 1000);

resetGame();

engine.runRenderLoop(() => {
  scene.render();
});

window.addEventListener("resize", () => engine.resize());
