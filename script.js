"use strict";

const w = window.innerWidth, h = window.innerHeight;
const canvas = document.getElementById("display");
const ctx = canvas.getContext("2d");

canvas.width = w, canvas.height = h;

// settings
const useParticles = false;
const particleSpawnCount = 10;
const difficultyCreep = 0.03 / 60;
const bounceFactor = .5;
const charMoveSpeed = .08;
const charSize = 12;
const shotSpread = .2; // .2
const shotLength = 250; // 250
const shotBullets = 64; // 64
const shotCooldown = 60 * .75;
const shotSpeed = 12; // aka bullet speed // 12
const shotHBLen = 16;

// running game global vars
let difficulty = -.1;
let spawnChance = 0.009;
let lost = false;
let mpos = vec();
let keys = {};
let clicked = false;
let projCD = 0;
let gameLoop;

// global arrs of main things ig
let particles = [];
let projectiles = [];
let enems = [];

// gamestats (xp, score)
let gameStats = {
  lvl: 1,
  currXp: 0,
  xpNeeded: 10,
  points: 0,

  score: 0,

  hp: 32,
  get maxHp() {
    return (this.stats.vit + 3) * 12;
  },

  get xp() { return this.currXp; },
  set xp(v) {
    this.currXp = v;
    if (v >= this.xpNeeded) {
      this.lvl ++;
      this.points ++;
      this.currXp = 0;
      this.xpNeeded *= 2;
      this.hp = this.maxHp;
    }
  },

  stats: {
    vit: 0,
    spd: 0,
    frt: 0,
    dmg: 0
  }
}

// char (pos, vel)
let char = {
  isMainChar: true,
  p: vec(w/2, h/2),
  v: vec(),
  r: charSize,
  t: 1,

  get shotCD () {
    return shotCooldown / (Math.log(gameStats.stats.frt + 1) + 1);
  },

  get dmg () {
    return (gameStats.stats.dmg + 1) * 0.6;
  },

  get hp() {
    return gameStats.hp
  },

  set hp(v = 0) {
    gameStats.hp = Math.max(Math.min(v, gameStats.maxHp), 0);
  },

  get s() {
    return charMoveSpeed * (Math.log(gameStats.stats.spd + 1) + 1);
  }
};

function init() {
  // get rid of the start popup
  document.getElementById("start").remove();

  // input listeners
  canvas.addEventListener("click", e => shoot());
  document.addEventListener("mousemove", e => mpos = vec(e.x, e.y));
  
  document.addEventListener("keydown", e => {
    let k = e.key.toLowerCase();
    
    keys[k] = true;

    if (k == "1") document.getElementById("vit_upgrade").click();
    if (k == "2") document.getElementById("spd_upgrade").click();
    if (k == "3") document.getElementById("frt_upgrade").click();
    if (k == "4") document.getElementById("dmg_upgrade").click();
  });
  
  document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

  ctx.fillStyle = "white";
  ctx.strokeStyle = "white";

  // score interval
  setInterval(() => {
    gameStats.score ++;
    if (score % 1000 == 0) gameStats.xp ++;
  }, 1000);

  // game interval
  gameLoop = setInterval(() => {
    loop();
  }, 16);
}

function loop() {
  // loss management
  if (char.hp <= 0) return lose();
  if (lost) return;

  
  ctx.clearRect(0, 0, w, h);

  // increasing difficulty ... decreasing cooldown
  projCD -= 1/(char.shotCD);
  difficulty += difficultyCreep;

  // running spawn chances (couldve made a function but whatever)
  if (Math.random() < spawnChance) enems.push(new Wanderer(w, h));
  if (Math.random() < spawnChance) enems.push(new Follower(w, h));
  if (Math.random() < spawnChance) enems.push(new Healer(w, h));
  if (Math.random() < spawnChance) enems.push(new Upgrader(w, h));
  if (Math.random() < spawnChance) enems.push(new Boxer(w, h));

  // main functions
  handleInput();
  applyBounds();
  updateProjectiles();
  drawProjectiles();
  updateParticles();
  drawParticles();
  updateEnemies();
  drawEnemies();
  drawCharacter();
  renderUi();
}

function shoot() {
  // checking if shot is ready
  if (projCD > 0) return;
  projCD = 1;
  let aimDir = norm(sub(mpos, char.p));
  let shotForce = scale(aimDir, -1); // reverse direction of shot

  char.v = add(char.v, shotForce);

  // generate the projectiles uniformly
  // used to randomize angle but that wasnt satisfying
  for (let a = -shotSpread; a <= shotSpread; a += shotSpread * 2 / shotBullets){
    let vel = vec(Math.cos(a) * aimDir.x - Math.sin(a) * aimDir.y,
                  Math.sin(a) * aimDir.x + Math.cos(a) * aimDir.y);
    
    projectiles.push(new Projectile(char.p, scale(vel, shotSpeed), shotHBLen, char.dmg / 4));
  }
}

function handleInput() {
  let rawMoveDir = vec();

  // apply movement without regard to rotation
  if (keys["w"]) rawMoveDir.x -= 1;
  if (keys["a"]) rawMoveDir.y += 1;
  if (keys["s"]) rawMoveDir.x += 1;
  if (keys["d"]) rawMoveDir.y -= 1;

  let toMouse = norm(sub(char.p, mpos));
  let rot = Math.atan2(toMouse.y, toMouse.x);

  // rotate the movement relative to the mouse pos
  let moveDir = vec(
    Math.cos(rot) * rawMoveDir.x - Math.sin(rot) * rawMoveDir.y,
    Math.sin(rot) * rawMoveDir.x + Math.cos(rot) * rawMoveDir.y,
  );

  // apply the vel and update position
  char.v = scale(add(char.v, scale(moveDir, char.s)), .99);
  char.p = add(char.p, char.v);
}

function applyBounds() {  
  // keep char on screen
  if (char.p.x <= char.r) { // left
    char.p.x = char.r;
    char.v.x *= -bounceFactor;
  }
  
  if (char.p.x >= w - char.r) { // right
    char.p.x = w - char.r;
    char.v.x *= -bounceFactor;
  }
  
  if (char.p.y <= char.r) { // top
    char.p.y = char.r;
    char.v.y *= -bounceFactor;
  }
  
  if (char.p.y >= h - char.r) { // bottom
    char.p.y = h - char.r;
    char.v.y *= -bounceFactor;
  }
}

function updateProjectiles() {
  projectiles.forEach(proj => proj.update(enems, gameStats));

  // get rid of dead projectiles
  for (let i = 0; i < projectiles.length; i++) {
    if (projectiles[i].toRemove) {
      let temp = projectiles[0];
      projectiles[0] = projectiles[i];
      projectiles[i] = temp;
      projectiles.shift();
      i--;
    }
  }
}

function drawProjectiles() {
  // reset line settings
  ctx.setLineDash([]);
  ctx.lineWidth = 2;

  // draw each projectile
  for (let i = 0; i < projectiles.length; i++) {
    let p = projectiles[i];
    let hb = p.hitbox; // getter fn so Im saving it for perf
    let g = ctx.createLinearGradient(hb.a.x, hb.a.y, hb.b.x, hb.b.y); // lingrad fill
    g.addColorStop(0, "white");
    g.addColorStop(1, "black");
    ctx.strokeStyle = g;
    ctx.beginPath();
    ctx.moveTo(hb.a.x, hb.a.y);
    ctx.lineTo(hb.b.x, hb.b.y);
    ctx.stroke();
  }

  // set back to normal
  ctx.lineWidth = 1;
}

function updateParticles() {
  particles.forEach(prtcl => prtcl.update());

  // get rid of dead particles
  for (let i = 0; i < particles.length; i++) {
    if (particles[i].t <= 0) {
      let temp = particles[0];
      particles[0] = particles[i];
      particles[i] = temp;
      particles.shift();
      i--;
    }
  }
}

function drawParticles() {
  for (let i = 0; i < particles.length; i++) {
    ctx.fillStyle = particles[i].color;
    ctx.globalAlpha = particles[i].brightness;
    drawCircle(particles[i]).fill();
  }
  
  ctx.globalAlpha = 1;
}

function updateEnemies() {
  // spread operator is disgusting for perf but idrc
  let characters = [char, ...enems];
  
  enems.forEach(enem => enem.update(characters, gameStats));

  let pruneDead = () => {
    enems.sort((a, b) => a.hp - b.hp);
    while (enems.length && enems[0].hp <= 0) {
      let enem = enems.shift();
      enem.onDeath();
      gameStats.xp += enem.xpDrop;
    }
  }

  // if there are dead ppl who are alive, prune them
  for (let i = 0; i < enems.length; i++) {
    if (enems[i]) {
      if (enems[i].hp <= 0) pruneDead();
    }
  }
}

function drawEnemies() {
  // for the healer radius thingy
  ctx.setLineDash([5, 10]);
  
  enems.forEach(enem => {
    ctx.fillStyle = enem.color;
    ctx.strokeStyle = enem.color;
    drawCircle(circ(enem.p, enem.r - 1)).stroke();
    ctx.globalAlpha = enem.hp / enem.maxHp;
    drawCircle(circ(enem.p, enem.r)).fill();
    if (enem.hp > enem.maxHp) {
      drawCircle(circ(enem.p, enem.r + (enem.hp - enem.maxHp))).stroke();
    }
    if(enem.type == "h"){
      ctx.strokeStyle = enem.color;
      drawCircle(circ(enem.p, enem.hr)).stroke();
    } 
  });
  
  ctx.fillStyle = "white";
  ctx.strokeStyle = "white";
}

function drawCharacter() {
  let aimDir = norm(sub(mpos, char.p));

  // some rotations
  let leftSpray = vec(
    Math.cos(shotSpread) * aimDir.x - Math.sin(shotSpread) * aimDir.y,
    Math.sin(shotSpread) * aimDir.x + Math.cos(shotSpread) * aimDir.y,
  );
  
  let rightSpray = vec(
    Math.cos(-shotSpread) * aimDir.x - Math.sin(-shotSpread) * aimDir.y,
    Math.sin(-shotSpread) * aimDir.x + Math.cos(-shotSpread) * aimDir.y,
  );

  ctx.setLineDash([5, 20]);
  
  ctx.beginPath();
  ctx.moveTo(char.p.x, char.p.y);
  ctx.lineTo(char.p.x + aimDir.x * w * h, char.p.y + aimDir.y * w * h);
  ctx.stroke();
  
  ctx.setLineDash([15, 5]);
  
  ctx.beginPath();
  ctx.moveTo(char.p.x, char.p.y);
  ctx.lineTo(char.p.x + leftSpray.x * shotLength, char.p.y + leftSpray.y * shotLength);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(char.p.x, char.p.y);
  ctx.lineTo(char.p.x + rightSpray.x * shotLength, char.p.y + rightSpray.y * shotLength);
  ctx.stroke();
  
  ctx.fillStyle = "white";
  drawCircle(char).fill();
  
  ctx.fillStyle = "black";
  drawCircle(circ(char.p, charSize/2)).fill();
  
  ctx.fillStyle = "white";
}

function renderUi() {
  // edit the simple things
  document.getElementById("hp").textContent = `HP: ${Math.floor(gameStats.hp)}/${gameStats.maxHp}`;
  document.getElementById("xp").textContent = `XP: ${gameStats.xp}/${gameStats.xpNeeded}`;
  document.getElementById("level").textContent = `Level: ${gameStats.lvl}`;
  document.getElementById("score").textContent = `Score: ${gameStats.score}`;
  document.getElementById("points").textContent = `Points: ${gameStats.points}`;

  // complicated stat management
  let stats = ["vit", "spd", "frt", "dmg"];
  let highestStat = String(Math.max(...stats.map(s => gameStats.stats[s]))).length;
  let buttonsHighlight = gameStats.points > 0;

  stats.forEach(stat => {
    let disp = document.getElementById(stat);
    let statStr = gameStats.stats[stat].toString();
    let paddedStat = statStr.padStart(highestStat, '0');
    disp.textContent = `${stat.toUpperCase()}: ${paddedStat}`;
    let button = document.getElementById(stat + "_upgrade");
    button.style.backgroundColor = buttonsHighlight ? "rgb(80, 80, 80)" : "rgb(10, 10, 10)";

    if (!button.onclick) button.onclick = () => {
      if (gameStats.points > 0) {
        gameStats.stats[stat] ++;
        gameStats.points --;
      }
    }
  });
  
  document.getElementById("xpbarfill").style.width = `${100 * (gameStats.xp / gameStats.xpNeeded)}%`;
  document.getElementById("hpbarfill").style.width = `${100 * (gameStats.hp / gameStats.maxHp)}%`;
  document.getElementById("rlbarfill").style.width = `${100 * (1 - Math.min(Math.max(projCD, 0), 1))}%`
}

function drawCircle({ p, r }) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2, true);
  // ctx.fill();
  return ctx;
}

function lose() {
  clearInterval(gameLoop); // disable the game loop
  lost = true;
  
  let div = document.getElementById("losedesc");
  
  let txt = (s) => {
    let p = document.createElement("p");
    p.textContent = s;
    return p;
  };
  
  document.getElementById("lose").style.visibility = "visible";

  div.appendChild(txt(`You ended with a score of ${gameStats.score}`));
  div.appendChild(txt(`You were level ${gameStats.lvl}`));

  ctx.clearRect(0, 0, w, h);
}

/* "structs" */

function vec(x = 0, y = 0) { return { x, y }; }
function circ(p = vec(), r = 1) { return { p, r }; }
function lin(a = vec(), b = vec()) { return { a, b }; }

/* vec helper funcs */

function add(a, b) { return vec(a.x + b.x, a.y + b.y); }
function sub(a, b) { return vec(a.x - b.x, a.y - b.y); }
function scale(a, b) { return vec(a.x * b, a.y * b); }
function mag(a) { return Math.sqrt(a.x * a.x + a.y * a.y); }
function norm(a) { return scale(a, 1 / mag(a)); }
function dist(a, b) { return mag(sub(a, b)); }

/* intersection functions */

function lineCircleInters(line, circle) {
  let d = linePointDist(line, circle.p);
  return d < circle.r;
}

function linePointDist(line, pt) {
  var A = pt.x - line.a.x;
  var B = pt.y - line.a.y;
  var C = line.b.y - line.a.x;
  var D = line.b.y - line.a.y;

  var dot = A * C + B * D;
  var len_sq = C * C + D * D;
  var param = -1;
  
  if (len_sq != 0)
      param = dot / len_sq;

  var xx, yy;

  if (param < 0) {
    xx = line.a.x;
    yy = line.a.y;
  } else if (param > 1) {
    xx = line.b.x;
    yy = line.b.y;
  } else {
    xx = line.a.x + param * C;
    yy = line.a.y + param * D;
  }

  var dx = pt.x - xx;
  var dy = pt.y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

// init();
// ^^^^ moved this to the start button onclick
