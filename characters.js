class Particle {
  p = vec();
  v = vec();
  l = 1;
  t = 1;
  r = 1;

  color = "#ffffff";
  get brightness() { return this.t / this.l; };

  constructor (pos, vel, lt, sz, clr) {
    this.p = pos;
    this.v = vel;
    this.l = this.t = lt;
    this.r = sz;
    this.color = clr || "#ffffff";
  }

  update() {
    this.t -= 1;
    this.v = scale(this.v, 0.99);
    this.p = add(this.p, this.v);
  }

  // a lot of vars, but the code itself isnt complex
  static generateEffect(obj) {
    let pos = obj.pos || vec(), vel = obj.vel || vec(), amt = obj.amt || 1,
      min_rad = obj.min_rad || 1, max_rad = obj.max_rad || min_rad,
      min_spd = obj.min_spd || 1, max_spd = obj.max_spd || min_spd,
      min_lft = obj.min_lft || 1, max_lft = obj.max_lft || min_lft,
      spread = obj.spread || Math.PI, color = obj.color || "#ffffff";
    
    if (useParticles) return new Array(amt).fill(0).map(() => {
      let a = (Math.random() * 2 - 1) * spread;
      let v = scale(vec(Math.cos(a) * vel.x - Math.sin(a) * vel.y,  // x
                        Math.sin(a) * vel.x + Math.cos(a) * vel.y), // y
                        Math.random() * (max_spd - min_spd) + min_spd); // * Math.rand...
      return new Particle(pos, v, Math.random() * (max_lft - min_lft) + min_lft, Math.random() * (max_rad - min_rad) + min_rad, color);
    });

    // for if particles are disabled

    // return an empty arra
    return [];
  }
}

class Projectile {
  p = vec();
  v = vec();
  l = 1;
  dmg = 1;
  toRemove = false;
  get hitbox() { return lin(this.p, sub(this.p, scale(norm(this.v), this.l))); }
  
  constructor (start, vel, len, dmg) {
    this.p = add(start, scale(norm(vel), len));
    this.v = vel;
    this.l = len;
    this.dmg = dmg;
  }

  update (characters, gameStats) {
    let chars = characters.filter((v) => v.dmg > 0 && !v.isMainChar);

    for (let i = 0; i < characters.length; i++) {
      if (characters[i].type == "f") {
        if (lineCircleInters(this.hitbox, characters[i])) {
          this.toRemove = true;
          return;
        }
      }
    }

    for (let i = 0; i < chars.length; i++) {
      let enem = chars[i];
      let inters = lineCircleInters(this.hitbox, enem);

      if (inters) {
        enem.hp -= this.dmg;
        this.toRemove = true;
        return;
      }
    }
    
    this.v = scale(this.v, 0.99);
    this.p = add(this.p, this.v);

    if (mag(this.v) <= Math.sqrt(shotSpeed)) this.toRemove = true;
  }
}

class Wanderer {
  type = "w";
  hp = 1;
  p = vec();
  v = vec();
  r = charSize;
  d = Math.random() * Math.PI * 2;
  s = charMoveSpeed / 2;
  dmg = 4;
  color = "#ffff00";
  id = String(Date.now() + Math.floor(Math.random() * 1000));
  bounds = { width: 1, height: 1 };
  xpDrop = 1;
  
  constructor (width = 1, height = 1) {
    this.p = vec(Math.random() * width, Math.random() * height);
    this.bounds.width = width;
    this.bounds.height = height;
  }

  update (characters, game) {
    for(let i = 0; i < characters.length; i++) {
      let character = characters[i];
      if (this.id == character.id) continue;
      let dis = dist(this.p, character.p);
      if (dis < this.r + character.r) {
        this.hp -= character.dmg;
        character.hp -= this.dmg;

        if (this.hp <= 0) return;
      }
    }

    // wander
    this.d += Math.random() * 0.8 - 0.4;
    let moveDir = vec(Math.cos(this.d), Math.sin(this.d));
    this.v = add(scale(this.v, 0.99), scale(moveDir, this.s));
    this.p = add(this.p, this.v);

    // bounds
    this.applyBounds();
  }

  applyBounds() {
    if (this.p.x <= this.r) { // left
      this.p.x = this.r;
      this.v.x *= -bounceFactor;
    }
    
    if (this.p.x >= w - this.r) { // right
      this.p.x = w - this.r;
      this.v.x *= -bounceFactor;
    }
    
    if (this.p.y <= this.r) { // top
      this.p.y = this.r;
      this.v.y *= -bounceFactor;
    }
    
    if (this.p.y >= h - this.r) { // bottom
      this.p.y = h - this.r;
      this.v.y *= -bounceFactor;
    } 
  }

  onDeath() {
    particles.push(...Particle.generateEffect({ // pos, vel, amt, min_rad, max_rad, min_spd, max_spd, min_lft, max_lft, spread, color
      pos: this.p,
      vel: vec(1, 0),
      amt: particleSpawnCount,
      min_rad: 1,
      min_spd: 1,
      max_spd: 3,
      min_lft: 60,
      color: "#ffff00",
    }));
  }
}

class Follower {
  type = "f";
  hp = 60 * 5; // 60 = 1 sec
  p = vec();
  v = vec(); 
  r = charSize * 2;
  d = Math.random() * Math.PI * 2;
  s = charMoveSpeed / 2;
  dmg = 0;
  color = "#ffffcc";
  id = String(Date.now() + Math.floor(Math.random() * 1000));
  bounds = { width: 1, height: 1 };
  xpDrop = 0;

  followDist = charSize * 5;
  following = null;
  
  constructor (width = 1, height = 1) {
    this.p = vec(Math.random() * width, Math.random() * height);
    this.bounds.width = width;
    this.bounds.height = height;
  }

  update (characters, game) {
    this.hp -= 1;

    this.color = "#ffffff";
    if (this.following == null) this.color = "#ffffcc";
    
    for(let i = 0; i < characters.length; i++) {
      let character = characters[i];
      if (this.id == character.id) continue;
      let dx = character.p.x - this.p.x;
      let dy = character.p.y - this.p.y;
      let d = Math.sqrt(dx * dx + dy * dy);

      if (this.following == null && d < this.followDist) {
        if (character.type != "f") {
          this.following = character;
        } else {
          if (character.following == null) { 
            this.following = character;
          } else {
            if (character.following.id != this.id) this.following = character;
          }
        }
      }
      
      if (d < this.r + character.r) {
        let mag = (d - (this.r + character.r)) * bounceFactor;
        
        dx /= d;
        dy /= d;
        
        this.v.x += dx * mag;
        this.v.y += dy * mag;
        this.p.x += dx * (mag / bounceFactor);
        this.p.y += dy * (mag / bounceFactor);

        if (character.type != "f") {
          character.v.x -= dy * mag;
          character.v.y -= dy * mag;
          character.p.x -= dx * (mag / bounceFactor);
          character.p.y -= dy * (mag / bounceFactor);
        }
        
        this.hp -= character.dmg;
      }
    }

    if (this.following != null) {
      if (this.following.hp <= 0) 
        this.following = null;
    }

    // wander
    if (this.following == null) {
      
      this.d += Math.random() * 0.8 - 0.4;
      let moveDir = vec(Math.cos(this.d), Math.sin(this.d));
      this.v = add(scale(this.v, 0.99), scale(moveDir, this.s));
      this.p = add(this.p, this.v);
    }

    // following
    else {
      let d = dist(this.p, this.following.p);

      if (d > this.followDist) {
        let dir = norm(sub(this.following.p, this.p));
        this.v = add(scale(this.v, 0.99), scale(dir, this.s));
        this.p = add(this.p, this.v);
      }
    }

    // bounds
    this.applyBounds();
  }

  applyBounds() {
    if (this.p.x <= this.r) { // left
      this.p.x = this.r;
      this.v.x *= -bounceFactor;
    }
    
    if (this.p.x >= w - this.r) { // right
      this.p.x = w - this.r;
      this.v.x *= -bounceFactor;
    }
    
    if (this.p.y <= this.r) { // top
      this.p.y = this.r;
      this.v.y *= -bounceFactor;
    }
    
    if (this.p.y >= h - this.r) { // bottom
      this.p.y = h - this.r;
      this.v.y *= -bounceFactor;
    } 
  }

  onDeath() {
    particles.push(...Particle.generateEffect({ // pos, vel, amt, min_rad, max_rad, min_spd, max_spd, min_lft, max_lft, spread, color
      pos: this.p,
      vel: vec(1, 0),
      amt: particleSpawnCount,
      min_rad: 2,
      min_spd: 1,
      max_spd: 6,
      min_lft: 60,
      color: "#ffffff",
    }));
  }
}

class Healer {
  type = "h";
  hp = 60 * 7.5; // 60 = 1 sec
  p = vec();
  v = vec();
  r = charSize / 2; 
  hr = charSize * 12;
  s = 0;
  dmg = 0;
  color = "#00ff00";
  id = String(Date.now() + Math.floor(Math.random() * 1000));
  bounds = { width: 1, height: 1 };
  xpDrop = 0;

  constructor (width = 1, height = 1) {
    this.p = vec(Math.random() * width, Math.random() * height);
    this.bounds.width = width;
    this.bounds.height = height;

    particles.push(...Particle.generateEffect({ // pos, vel, amt, min_rad, max_rad, min_spd, max_spd, min_lft, max_lft, spread, color
      pos: this.p,
      vel: vec(1, 0),
      amt: particleSpawnCount,
      min_rad: 1,
      min_spd: 3,
      min_lft: 60,
      color: "#00ff00",
    }));
  }

  update (characters, game) {
    this.hp -= 1;

    if (this.hp <= 0) return;
    
    for (let i = 0; i < characters.length; i++)
      if (characters[i].isMainChar)
        if (dist(characters[i].p, this.p) < this.hr)
          characters[i].hp += 0.2;
  }

  onDeath() {
    // healers have a particle effect on spawn
  }
}

class Upgrader {
  type = "u";
  hp = 60 * 7.5; // 60 = 1 sec
  p = vec();
  v = vec();
  r = charSize / 2; 
  s = 0;
  dmg = 0;
  color = "#ff00ff";
  id = String(Date.now() + Math.floor(Math.random() * 1000));
  bounds = { width: 1, height: 1 };
  xpDrop = 1;

  constructor (width = 1, height = 1) {
    this.p = vec(Math.random() * width, Math.random() * height);
    this.bounds.width = width;
    this.bounds.height = height;
  }

  update (characters, game) {
    this.hp -= 1;

    if (this.hp <= 0) return;
    
    for (let i = 0; i < characters.length; i++)
      if (characters[i].isMainChar)
        if (dist(characters[i].p, this.p) < characters[i].r + this.r){
          let stats = ["vit", "spd", "frt", "dmg"];
          game.stats[stats[Math.floor(Math.random() * stats.length)]]++;
          this.hp = 0;
        }
  }

  onDeath() {
    particles.push(...Particle.generateEffect({ // pos, vel, amt, min_rad, max_rad, min_spd, max_spd, min_lft, max_lft, spread, color
      pos: this.p,
      vel: vec(1, 0),
      amt: particleSpawnCount,
      min_rad: 1,
      min_spd: 1,
      max_spd: 2,
      min_lft: 60,
      color: "#ff00ff",
    }));
  }
}

class Boxer {
  type = "b";
  hp = 4 * (1 + difficulty);
  p = vec();
  v = vec();
  r = charSize;
  ar = charSize * 24;
  s = charMoveSpeed * (1 + difficulty);
  dmg = 4 * (1 + difficulty);
  color = "#ff0000";
  id = String(Date.now() + Math.floor(Math.random() * 1000));
  bounds = { width: 1, height: 1 };
  xpDrop = 4;

  constructor (width = 1, height = 1) {
    this.p = vec(Math.random() * width, Math.random() * height);
    this.bounds.width = width;
    this.bounds.height = height;
  }

  update (characters, game) {
    for(let i = 0; i < characters.length; i++) {
      let character = characters[i];
      if (this.id == character.id) continue;
      if (character.isMainChar) continue;
      let dx = character.p.x - this.p.x;
      let dy = character.p.y - this.p.y;
      let d = Math.sqrt(dx * dx + dy * dy);

      if (d < this.r + character.r) {
        let mag = (d - (this.r + character.r)) * 2.0;
        
        dx /= d;
        dy /= d;
        
        this.v.x += dx * mag;
        this.v.y += dy * mag;
        this.p.x += dx * (mag);
        this.p.y += dy * (mag);
      }
    }
    
    let mainChar = null;

    for (let i = 0; i < characters.length; i++)
      if (characters[i].isMainChar) mainChar = characters[i];

    if(mainChar == null) return;

    this.applyBounds();

    let d = dist(mainChar.p, this.p);

    // if within aggro range
    if (d <= this.ar) {
      // if within dmg range
      if (d <= this.r + mainChar.r) {
        mainChar.hp -= this.dmg;
        this.hp -= mainChar.dmg;

        let dir = scale(norm(sub(this.p, mainChar.p)), (this.r + mainChar.r) - d + 1);
        this.p = add(this.p, dir);
        this.v = scale(dir, 4);
      } else {
        this.v = scale(this.v, 0.99);
        this.p = add(this.p, this.v);
      }
    }

    // not within aggro range
    else {
      let moveDir = norm(sub(mainChar.p, this.p));
      this.v = add(scale(this.v, 0.99), scale(moveDir, this.s));
      this.p = add(this.p, this.v);
    }
  }

  applyBounds() {
    if (this.p.x <= this.r) { // left
      this.p.x = this.r;
      this.v.x *= -bounceFactor;
    }
    
    if (this.p.x >= w - this.r) { // right
      this.p.x = w - this.r;
      this.v.x *= -bounceFactor;
    }
    
    if (this.p.y <= this.r) { // top
      this.p.y = this.r;
      this.v.y *= -bounceFactor;
    }
    
    if (this.p.y >= h - this.r) { // bottom
      this.p.y = h - this.r;
      this.v.y *= -bounceFactor;
    } 
  }

  onDeath() {
    particles.push(...Particle.generateEffect({ // pos, vel, amt, min_rad, max_rad, min_spd, max_spd, min_lft, max_lft, spread, color
      pos: this.p,
      vel: vec(1, 0),
      amt: particleSpawnCount,
      min_rad: 1,
      min_spd: 1,
      max_spd: 3,
      min_lft: 60,
      color: "#ff0000",
    }));
  }
}
