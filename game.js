(function () {
  'use strict';

  var cv = document.getElementById('game');
  var ctx = cv.getContext('2d');

  var W = 800;
  var H = 450;
  var GROUND = H - 88;
  var PRX = 132;
  var GRAV = 1900;
  var JUMP_V = 630;
  var MAX_SPEED = 760;
  var TARGET_DIST = 12000;

  var state = 'menu';
  var speed = 320;
  var dist = 0;
  var height = 0;
  var vy = 0;
  var grounded = true;
  var jumpHeld = false;
  var obstacles = [];
  var spawnT = 1.2;
  var princeActive = false;
  var princeX = W;
  var time = 0;
  var best = 0;
  var particles = [];

  var clouds = [];
  for (var i = 0; i < 9; i++) {
    clouds.push({ y: 40 + Math.sin(i * 1.7) * 26 + (i % 3) * 18, s: 0.7 + (i % 4) * 0.16 });
  }

  try {
    best = parseInt(localStorage.getItem('princessBest') || '0', 10) || 0;
  } catch (e) {
    best = 0;
  }

  var audio = null;

  function initAudio() {
    if (audio) return;
    try {
      audio = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      audio = null;
    }
  }

  function beep(freq, dur, type, vol, slideTo) {
    if (!audio) return;
    var t = audio.currentTime;
    var osc = audio.createOscillator();
    var gain = audio.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol || 0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  function soundJump() {
    beep(420, 0.18, 'square', 0.06, 720);
  }

  function soundDead() {
    beep(300, 0.5, 'sawtooth', 0.09, 80);
  }

  function soundWin() {
    beep(523, 0.18, 'triangle', 0.09);
    setTimeout(function () { beep(659, 0.18, 'triangle', 0.09); }, 160);
    setTimeout(function () { beep(784, 0.3, 'triangle', 0.1); }, 320);
    setTimeout(function () { beep(1047, 0.5, 'triangle', 0.1); }, 480);
  }

  function resetRun() {
    speed = 320;
    dist = 0;
    height = 0;
    vy = 0;
    grounded = true;
    jumpHeld = false;
    obstacles = [];
    spawnT = 1.2;
    princeActive = false;
    princeX = W;
    time = 0;
    particles = [];
  }

  function press() {
    if (state === 'menu' || state === 'over' || state === 'win') {
      initAudio();
      resetRun();
      state = 'playing';
      return;
    }
    if (state === 'playing' && grounded) {
      vy = JUMP_V;
      grounded = false;
      soundJump();
    }
  }

  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      jumpHeld = true;
      press();
    }
  });

  window.addEventListener('keyup', function (e) {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      jumpHeld = false;
    }
  });

  cv.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    press();
  });

  window.addEventListener('blur', function () {
    jumpHeld = false;
  });

  function saveBest() {
    try {
      localStorage.setItem('princessBest', String(best));
    } catch (e) { }
  }

  function meters() {
    return Math.floor(dist * 0.06);
  }

  function spawnObstacle() {
    var variants = [
      { w: 62, h: 32 + ((Math.random() * 10) | 0), kind: 'spikes' },
      { w: 54, h: 42 + ((Math.random() * 14) | 0), kind: 'rock' },
      { w: 46, h: 52 + ((Math.random() * 12) | 0), kind: 'thornbush' }
    ];
    var ob = variants[(Math.random() * variants.length) | 0];
    ob.x = W + 60;
    obstacles.push(ob);
  }

  function inPrincessBox() {
    var ph = 58;
    return { x: PRX - 11, y: GROUND - height - ph + 2, w: 22, h: ph - 2 };
  }

  function inObstacleBox(o) {
    return { x: o.x + 8, y: GROUND - o.h + 8, w: o.w - 16, h: o.h - 8 };
  }

  function hbOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function update(dt) {
    time += dt;

    if (state !== 'playing') {
      if (state === 'menu') {
        dist = 0;
      }
      updateParticles(dt);
      return;
    }

    speed = Math.min(MAX_SPEED, 320 + dist * 0.012);
    dist += speed * dt;

    if (!princeActive && dist >= TARGET_DIST) {
      princeActive = true;
      soundWin();
    }

    if (!grounded) {
      vy -= GRAV * dt;
      if (!jumpHeld && vy < -200) vy = -200;
      height += vy * dt;
      if (height <= 0) {
        height = 0;
        vy = 0;
        grounded = true;
      }
    }

    if (!princeActive) {
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnObstacle();
        var gap = 260 + speed * 0.5;
        spawnT = gap / speed;
      }
    }

    for (var i = obstacles.length - 1; i >= 0; i--) {
      var o = obstacles[i];
      o.x -= speed * dt;
      if (o.x + o.w < -60) {
        obstacles.splice(i, 1);
        continue;
      }
      if (hbOverlap(inPrincessBox(), inObstacleBox(o))) {
        state = 'over';
        soundDead();
        if (meters() > best) {
          best = meters();
          saveBest();
        }
        break;
      }
    }

    if (princeActive) {
      princeX = W - (dist - TARGET_DIST);
      if (princeX <= PRX + 10) {
        state = 'win';
        soundWin();
        spawnHearts();
      }
    }

    updateParticles(dt);
  }

  function spawnHearts() {
    for (var i = 0; i < 26; i++) {
      particles.push({
        x: PRX + (Math.random() - 0.5) * 180,
        y: GROUND - 40 - Math.random() * 220,
        vx: (Math.random() - 0.5) * 140,
        vy: -60 - Math.random() * 160,
        life: 1.6 + Math.random() * 1.4,
        t: 0,
        kind: 'heart'
      });
    }
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      if (p.t >= p.life) particles.splice(i, 1);
    }
  }

  var last = 0;
  var runPhase = 0;

  function frame() {
    var now = performance.now() / 1000;
    var dt = Math.min(0.033, now - (last || now));
    last = now;
    update(dt);
    draw(dt);
    requestAnimationFrame(frame);
  }

  function draw(dt) {
    ctx.clearRect(0, 0, W, H);
    drawSky();
    drawClouds();
    drawHills();
    drawCastle();
    drawGround();

    if (state !== 'over') {
      drawProgress();
    }

    drawHud();

    for (var i = 0; i < obstacles.length; i++) {
      drawObstacle(obstacles[i]);
    }

    if (princeActive) {
      drawPrince(princeX, GROUND, false, true);
    }

    if (state !== 'over') {
      if (grounded) runPhase += speed * dt * 0.045;
      else runPhase = 2.4;
    } else {
      runPhase = 0;
    }

    drawPrincess(PRX, GROUND - height, state === 'over');
    drawParticles();

    if (state === 'menu') drawMenu();
    else if (state === 'over') drawOver();
    else if (state === 'win') drawWin();
  }

  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#8ecbf7');
    g.addColorStop(0.6, '#cdeafe');
    g.addColorStop(1, '#ffe9c9');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#fff2a8';
    ctx.beginPath();
    ctx.arc(690, 82, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,242,168,0.35)';
    ctx.beginPath();
    ctx.arc(690, 82, 48, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawClouds() {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      var x = (((i * 260) - dist * 0.06) % (W + 320) + W + 320) % (W + 320) - 160;
      var s = c.s;
      ctx.beginPath();
      ctx.ellipse(x, c.y, 46 * s, 18 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 30 * s, c.y - 12 * s, 28 * s, 15 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 34 * s, c.y + 4 * s, 26 * s, 13 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHills() {
    ctx.fillStyle = '#8ecb7d';
    ctx.beginPath();
    ctx.moveTo(0, GROUND);
    for (var x = 0; x <= W; x += 10) {
      var y = GROUND - 26 - Math.sin((dist * 0.22 + x) / 160) * 14 - Math.cos((dist * 0.11 + x) / 300) * 10;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, GROUND);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#a8df9a';
    ctx.beginPath();
    ctx.moveTo(0, GROUND);
    for (var x2 = 0; x2 <= W; x2 += 10) {
      var y2 = GROUND - 10 - Math.sin((dist * 0.4 + x2) / 120) * 7;
      ctx.lineTo(x2, y2);
    }
    ctx.lineTo(W, GROUND);
    ctx.closePath();
    ctx.fill();
  }

  function drawCastle() {
    ctx.fillStyle = 'rgba(120,80,150,0.55)';
    var bx = (((W * 0.7 - dist * 0.16) % (W + 500)) + W + 500) % (W + 500) - 300;
    var by = GROUND - 30;
    ctx.fillRect(bx, by - 26, 60, 26);
    ctx.fillRect(bx + 8, by - 44, 10, 22);
    ctx.fillRect(bx + 30, by - 56, 10, 30);
    ctx.fillRect(bx + 44, by - 44, 10, 22);
    ctx.fillRect(bx + 23, by - 14, 16, 14);
  }

  function drawGround() {
    ctx.fillStyle = '#caa06a';
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#b98f5b';
    ctx.fillRect(0, GROUND + 6, W, H - GROUND - 6);
    ctx.fillStyle = '#d7b27f';
    ctx.fillRect(0, GROUND, W, 4);
    ctx.fillStyle = '#9ce06b';
    ctx.fillRect(0, GROUND - 3, W, 4);

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (var i = 0; i < 7; i++) {
      var x = (((i * 130) - dist * 1.0) % (W + 260) + W + 260) % (W + 260) - 130;
      ctx.fillRect(x, GROUND + 22 + (i % 3) * 12, 26, 3);
    }
  }

  function drawProgress() {
    var p = Math.min(1, dist / TARGET_DIST);
    var w = 260;
    var x = (W - w) / 2;
    var y = 18;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, 14, 7);
    ctx.fill();
    ctx.fillStyle = '#ff6ba8';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, Math.max(0, (w - 4) * p), 10, 5);
    ctx.fill();
    drawMiniCrown(x + w + 4, y + 7, 11);
    drawMiniPrincess(x - 16, y + 7, 9);
  }

  function drawMiniCrown(x, y, s) {
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath();
    ctx.moveTo(x - s, y + s * 0.7);
    ctx.lineTo(x - s * 0.7, y - s * 0.4);
    ctx.lineTo(x - s * 0.2, y + s * 0.2);
    ctx.lineTo(x, y - s * 0.6);
    ctx.lineTo(x + s * 0.2, y + s * 0.2);
    ctx.lineTo(x + s * 0.7, y - s * 0.4);
    ctx.lineTo(x + s, y + s * 0.7);
    ctx.closePath();
    ctx.fill();
  }

  function drawMiniPrincess(x, y, s) {
    ctx.fillStyle = '#ffd9b3';
    ctx.beginPath();
    ctx.arc(x, y - s, s * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd24d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.7, y - s * 0.2);
    ctx.lineTo(x, y - s * 1.4);
    ctx.lineTo(x + s * 0.7, y - s * 0.2);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = '#e0559b';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.85, y);
    ctx.lineTo(x + s * 0.85, y);
    ctx.lineTo(x, y + s * 1.2);
    ctx.closePath();
    ctx.fill();
  }

  function drawHud() {
    ctx.font = '600 17px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(40,20,60,0.55)';
    ctx.fillText('Distância: ' + meters() + ' m', 16, 34);
    ctx.fillStyle = '#fff';
    ctx.fillText('Distância: ' + meters() + ' m', 16, 33);

    ctx.fillStyle = 'rgba(40,20,60,0.55)';
    if (state === 'playing') {
      ctx.fillText('Velocidade: ' + Math.round(speed) + ' km/h', W - 216, 34);
    }
    ctx.fillStyle = '#fff';
    if (state === 'playing') {
      ctx.fillText('Velocidade: ' + Math.round(speed) + ' km/h', W - 216, 33);
    }
  }

  function drawObstacle(o) {
    var gx = o.x;
    var h = o.h;
    var w = o.w;
    var base = GROUND - h;

    if (o.kind === 'spikes') {
      ctx.fillStyle = '#aab2bd';
      ctx.fillRect(gx, GROUND - 6, w, 6);
      ctx.fillStyle = '#c4cbd4';
      ctx.fillRect(gx, GROUND - 4, w, 4);
      ctx.fillStyle = '#7d8693';
      ctx.strokeStyle = '#5b646e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx, GROUND - 6);
      ctx.lineTo(gx + w / 2, base - h);
      ctx.lineTo(gx + w, GROUND - 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1;
    } else if (o.kind === 'rock') {
      ctx.fillStyle = '#8d7f72';
      ctx.strokeStyle = '#6e6156';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx + w * 0.15, GROUND);
      ctx.lineTo(gx + w * 0.3, base + h * 0.25);
      ctx.lineTo(gx + w * 0.5, base);
      ctx.lineTo(gx + w * 0.75, base + h * 0.3);
      ctx.lineTo(gx + w * 0.9, GROUND);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#a49689';
      ctx.beginPath();
      ctx.ellipse(gx + w * 0.45, base + h * 0.45, w * 0.12, h * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1;
    } else {
      ctx.fillStyle = '#2f7d33';
      ctx.strokeStyle = '#1e5822';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(gx + w * 0.3, base + h * 0.88, h * 0.24, 0, Math.PI * 2);
      ctx.arc(gx + w * 0.55, base + h * 0.6, h * 0.28, 0, Math.PI * 2);
      ctx.arc(gx + w * 0.42, base + h * 0.32, h * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3f9c44';
      ctx.beginPath();
      ctx.arc(gx + w * 0.3, base + h * 0.88, h * 0.14, 0, Math.PI * 2);
      ctx.arc(gx + w * 0.55, base + h * 0.6, h * 0.16, 0, Math.PI * 2);
      ctx.arc(gx + w * 0.42, base + h * 0.32, h * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#cfd7a6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx + w * 0.42, base);
      ctx.lineTo(gx + w * 0.42 + 3, base - 7);
      ctx.moveTo(gx + w * 0.55, base + h * 0.34);
      ctx.lineTo(gx + w * 0.55 + 3, base + h * 0.34 - 7);
      ctx.moveTo(gx + w * 0.3, base + h * 0.64);
      ctx.lineTo(gx + w * 0.3 + 3, base + h * 0.64 - 7);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  function drawPrincess(x, feetY, fallen) {
    ctx.save();
    ctx.translate(x, feetY);

    var jump = !grounded && state === 'playing';
    var swing = Math.sin(runPhase) * 7;

    if (fallen) {
      ctx.rotate(0.14);
      drawTorso();
      drawLegs(-14, -20, 3);
      drawLegs(16, -22, 1);
      drawArms(12, 6);
      ctx.save();
      ctx.translate(-16, -66);
      ctx.rotate(-0.2);
      drawHead();
      drawCrown(0);
      ctx.restore();
      ctx.restore();
      return;
    }

    if (jump) {
      ctx.translate(0, -6);
      drawLegs(-8, 6, 5);
      drawLegs(8, 5, 4);
      drawArms(-7, 10);
      drawTorso();
      drawHead();
      drawCrown(0);
    } else {
      var bob = Math.abs(Math.sin(runPhase * 2)) * 2;
      ctx.translate(0, -bob);
      drawLegs(swing, -6, 0);
      drawLegs(-swing, -2, 0);
      drawArms(-swing * 0.75, 0);
      drawTorso();
      drawHead();
      drawCrown(0);
    }

    ctx.restore();
  }

  function drawLegs(step, lift, rise) {
    ctx.strokeStyle = '#ffd9b3';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.quadraticCurveTo(step * 0.6, -16 - rise * 2, step, -6 - lift - rise);
    ctx.stroke();
    ctx.strokeStyle = '#c97a4a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(step, -6 - lift - rise);
    ctx.quadraticCurveTo(step + 4, -2 - lift, step + 7, -2);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  function drawArms(armX, lift) {
    ctx.strokeStyle = '#ffd9b3';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(3, -48);
    ctx.quadraticCurveTo(armX * 0.6, -36, armX * 0.9, -24 - lift);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  function drawTorso() {
    ctx.fillStyle = '#e8d5ff';
    ctx.beginPath();
    ctx.moveTo(-9, -54);
    ctx.lineTo(9, -54);
    ctx.lineTo(10, -34);
    ctx.lineTo(-10, -34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8d5ff';
    ctx.beginPath();
    ctx.ellipse(-9, -47, 5, 6, -0.3, 0, Math.PI * 2);
    ctx.ellipse(9, -47, 5, 6, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e0559b';
    ctx.beginPath();
    ctx.moveTo(-13, -34);
    ctx.lineTo(13, -34);
    ctx.lineTo(20, -4);
    ctx.lineTo(-20, -4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c43d80';
    ctx.beginPath();
    ctx.moveTo(-20, -4);
    ctx.lineTo(20, -4);
    ctx.lineTo(16, 1);
    ctx.lineTo(-16, 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd24d';
    ctx.fillRect(-12, -35, 24, 3);
  }

  function drawHead() {
    ctx.fillStyle = '#7a3b1f';
    ctx.beginPath();
    ctx.arc(4, -1, 12.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd9b3';
    ctx.beginPath();
    ctx.arc(0, 0, 10.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a3b1f';
    ctx.beginPath();
    ctx.arc(-2, -6, 9, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, -5, 8, Math.PI * 1.1, Math.PI * 1.9);
    ctx.fill();
    ctx.fillStyle = '#2b1a3d';
    ctx.beginPath();
    ctx.arc(4, -1, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,140,150,0.55)';
    ctx.beginPath();
    ctx.arc(-5, 3, 2.4, 0, Math.PI * 2);
    ctx.arc(3, 4, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c76a3a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-1, 6);
    ctx.quadraticCurveTo(3, 9, 7, 6);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  function drawCrown(cx) {
    ctx.translate(cx, -79);
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(-7, -9);
    ctx.lineTo(-2, -3);
    ctx.lineTo(0, -11);
    ctx.lineTo(2, -3);
    ctx.lineTo(7, -9);
    ctx.lineTo(9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff5c7a';
    ctx.beginPath();
    ctx.arc(0, -4, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(-cx, 79);
  }

  function drawPrince(x, feetY, jumping, facingLeft) {
    ctx.save();
    ctx.translate(x, feetY);
    if (facingLeft) ctx.scale(-1, 1);

    ctx.strokeStyle = '#5a4632';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(4, -26);
    ctx.lineTo(-3, -14);
    ctx.moveTo(6, -26);
    ctx.lineTo(13, -15);
    ctx.stroke();
    ctx.strokeStyle = '#4a3219';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-3, -14);
    ctx.lineTo(-5, -3);
    ctx.moveTo(13, -15);
    ctx.lineTo(12, -3);
    ctx.stroke();
    ctx.lineCap = 'butt';

    ctx.fillStyle = '#3d7fe0';
    ctx.fillRect(-10, -52, 20, 26);
    ctx.fillStyle = '#2f66bd';
    ctx.beginPath();
    ctx.moveTo(-10, -48);
    ctx.lineTo(0, -42);
    ctx.lineTo(10, -48);
    ctx.lineTo(10, -26);
    ctx.lineTo(-10, -26);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#274e94';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, -50);
    ctx.lineTo(-22, -40);
    ctx.lineTo(-18, -30);
    ctx.stroke();
    ctx.lineCap = 'butt';

    ctx.save();
    ctx.translate(4, -62);
    ctx.fillStyle = '#e8b73c';
    ctx.beginPath();
    ctx.arc(4, -1, 13, 0, Math.PI * 2);
    ctx.arc(-4, -2, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd9b3';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b1a3d';
    ctx.beginPath();
    ctx.arc(4, -1, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c76a3a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2, 5);
    ctx.quadraticCurveTo(2, 8, 6, 5);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.lineTo(-6, -20);
    ctx.lineTo(-1, -15);
    ctx.lineTo(1, -23);
    ctx.lineTo(3, -15);
    ctx.lineTo(8, -20);
    ctx.lineTo(10, -12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff5c7a';
    ctx.beginPath();
    ctx.arc(1, -15, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b78a2e';
    ctx.lineWidth = 2;
    ctx.save();
    ctx.translate(1, -10);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffb49b';
    ctx.fillRect(-8, -1, 14, 1);
    ctx.restore();
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.restore();

    ctx.restore();
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var a = 1 - p.t / p.life;
      if (p.kind === 'heart') {
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = '#ff4d88';
        drawHeart(p.x, p.y, 7);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawHeart(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s, y + s * 0.2, x - s * 0.6, y - s, x, y - s * 0.3);
    ctx.bezierCurveTo(x + s * 0.6, y - s, x + s, y + s * 0.2, x, y + s * 0.9);
    ctx.fill();
  }

  function panel() {
    ctx.fillStyle = 'rgba(28,18,50,0.78)';
    ctx.beginPath();
    ctx.roundRect(90, 120, W - 180, 210, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  function bigText(txt, y) {
    ctx.textAlign = 'center';
    ctx.font = '800 30px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffd24d';
    ctx.fillText(txt, W / 2, y);
  }

  function smallText(txt, y) {
    ctx.font = '600 17px "Segoe UI", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(txt, W / 2, y);
  }

  function drawMenu() {
    panel();
    bigText('A Princesa e o Príncipe', 175);
    for (var i = -1; i <= 1; i++) {
      var x = W / 2 + i * 130;
      if (i === 0) drawTinyPrincess(x, 205);
      else drawTinyPrince(x, 205, i < 0);
    }
    smallText('Pule os obstáculos até chegar no príncipe!', 258);
    smallText('Espaço / Toque para pular', 292);
    if (best > 0) smallText('Melhor distância: ' + best + ' m', 318);
    ctx.fillStyle = '#ffe9b3';
    ctx.font = '600 15px "Segoe UI", sans-serif';
    ctx.fillText('Pressione ESPAÇO ou toque para começar', W / 2, 348);
  }

  function drawTinyPrincess(x, y) {
    ctx.fillStyle = '#ffd9b3';
    ctx.beginPath();
    ctx.arc(x, y - 18, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e0559b';
    ctx.beginPath();
    ctx.moveTo(x - 13, y - 8);
    ctx.lineTo(x + 13, y - 8);
    ctx.lineTo(x, y + 16);
    ctx.closePath();
    ctx.fill();
    drawMiniCrown(x - 13, y - 30, 13);
  }

  function drawTinyPrince(x, y, left) {
    ctx.fillStyle = '#ffd9b3';
    ctx.beginPath();
    ctx.arc(x, y - 18, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3d7fe0';
    ctx.fillRect(x - 12, y - 8, 24, 18);
    ctx.fillStyle = '#5a4632';
    ctx.fillRect(x - 9, y + 10, 7, 10);
    ctx.fillRect(x + 2, y + 10, 7, 10);
    ctx.fillStyle = '#e8b73c';
    ctx.beginPath();
    ctx.arc(x + 3, y - 20, 4, 0, Math.PI * 2);
    ctx.fill();
    drawMiniCrown(x - 6, y - 34, 11);
    if (left) {
      ctx.strokeStyle = '#ffd24d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 14, y - 16, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  function drawOver() {
    drawPrincess(PRX, GROUND, true);
    panel();
    bigText('Fim de jogo!', 175);
    smallText('A princesa colidiu com um obstáculo a ' + meters() + ' m', 210);
    smallText('Recorde: ' + Math.max(best, meters()) + ' m', 240);
    ctx.fillStyle = '#ffe9b3';
    ctx.font = '600 15px "Segoe UI", sans-serif';
    ctx.fillText('Pressione ESPAÇO ou toque para tentar de novo', W / 2, 275);
  }

  function drawWin() {
    panel();
    bigText('Você chegou ao príncipe!', 175);
    smallText('Distância percorrida: ' + meters() + ' m', 215);
    smallText('A princesa finalmente encontrou seu príncipe!', 245);
    ctx.fillStyle = '#ffe9b3';
    ctx.font = '600 15px "Segoe UI", sans-serif';
    ctx.fillText('Pressione ESPAÇO ou toque para jogar de novo', W / 2, 280);
  }

  frame();
})();