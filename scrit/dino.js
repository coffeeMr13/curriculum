// ─── Elementos del DOM ────────────────────────────────────────────────────────
const dinoContainer   = document.getElementById("dino-container");
const dinoRun         = document.getElementById("dino-run");
const dinoJump        = document.getElementById("dino-jump");
const cactusContainer = document.getElementById("cactus-container");
const background      = document.getElementById("background");
const ground          = document.getElementById("ground");
const scoreElement    = document.getElementById("score");
const highScoreElement= document.getElementById("high-score");
const startMessage    = document.getElementById("start-message");
const gameOverScreen  = document.getElementById("game-over-screen");
const finalScoreElement = document.getElementById("final-score");
const restartBtn      = document.getElementById("restart-btn");
const jumpBtn         = document.getElementById("jump-btn");
const pauseBtn        = document.getElementById("pause-btn");
const mobileControls  = document.getElementById("mobile-controls");
const gameContainer   = document.getElementById("game-container");

// ─── Rutas de imágenes ────────────────────────────────────────────────────────
// encodeURIComponent convierte los espacios en %20 y evita los 404
const IMG_PATH = '/yo/imagen/';
function img(name) {
    return IMG_PATH + encodeURIComponent(name);
}

const dinoFrames = [
    img('dino-run-sprite 1f.png'),
    img('dino-run-sprite 2f.png'),
    img('dino-run-sprite 3f.png'),
    img('dino-run-sprite 4f.png'),
];
const JUMP_IMG = img('dino-jump.png');
const CACTUS_S = img('catuz.png');
const CACTUS_D = img('catuz doble.png');

// Precarga imágenes para que no haya retraso en móvil al cambiar frame
function preloadImages() {
    [...dinoFrames, JUMP_IMG, CACTUS_S, CACTUS_D].forEach(src => {
        const im = new Image();
        im.src = src;
    });
}

// ─── Constantes de layout (coinciden con el CSS) ──────────────────────────────
const GROUND_H   = 30;   // height de #ground
const DINO_W     = 60;   // width de #dino-container
const DINO_H     = 70;   // height de #dino-container
const JUMP_HEIGHT= 160;  // píxeles que sube el dino (era 100 → demasiado poco)
const JUMP_MS    = 550;  // duración total del salto en ms

// ─── Variables del juego ──────────────────────────────────────────────────────
let score         = 0;
let highScore     = parseInt(localStorage.getItem("dinoHighScore")) || 0;
let gameRunning   = false;
let isPaused      = false;
let isJumping     = false;
let gameLoop      = null;
let cactusTimeout = null;
let groundPos     = 0;
let gameSpeed     = 5;
let obstacles     = [];
let framesSurvived= 0;

// Posición Y del dino rastreada en JS (desde arriba del game-container).
// Esto garantiza que checkCollision siempre coincide con lo visual,
// incluso a mitad del salto y en móvil.
let dinoYtop = 0;

// ─── Animación frames ─────────────────────────────────────────────────────────
let currentFrame = 0;
let frameCounter = 0;
function getFrameInterval() {
    return Math.max(2, Math.round(6 - (gameSpeed - 5) * 0.4));
}

// ─── Delay entre cactus ───────────────────────────────────────────────────────
function getNextCactusDelay() {
    const base = Math.max(800, 2000 - (gameSpeed - 5) * 120);
    return base * (0.7 + Math.random() * 0.6);
}

// ─── Helper: alto real del contenedor ────────────────────────────────────────
function containerH() { return gameContainer.clientHeight; }

// ─── Init ─────────────────────────────────────────────────────────────────────
function initGame() {
    preloadImages();
    highScoreElement.textContent = `High Score: ${highScore}`;

    // Botones siempre visibles en dispositivos táctiles
    const isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (isMobile && mobileControls) mobileControls.classList.remove("hidden");

    dinoRun.style.backgroundImage  = `url('${dinoFrames[0]}')`;
    dinoJump.style.backgroundImage = `url('${JUMP_IMG}')`;

    // Posición inicial en tierra
    dinoContainer.style.bottom = GROUND_H + 'px';
    dinoYtop = containerH() - GROUND_H - DINO_H;

    // Eventos
    document.addEventListener("keydown", handleKeyPress);
    gameContainer.addEventListener("click", handleGameClick);

    // Touch: tap o swipe arriba para saltar
    let touchStartY = 0;
    gameContainer.addEventListener("touchstart", e => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    gameContainer.addEventListener("touchend", e => {
        if (e.target.closest("#mobile-controls")) return;
        const dy = touchStartY - e.changedTouches[0].clientY;
        if (!gameRunning) startGame();
        else if (dy >= -20) jump();
    }, { passive: true });

    // Botones móviles
    restartBtn?.addEventListener("click", startGame);
    jumpBtn?.addEventListener("click",  e => { e.stopPropagation(); jump(); });
    pauseBtn?.addEventListener("click", e => { e.stopPropagation(); togglePause(); });

    // Nubes decorativas
    for (let i = 0; i < 3; i++) createCloud();
    setInterval(createCloud, 3000);

    startMessage.classList.remove("hidden");
}

// ─── Teclado ──────────────────────────────────────────────────────────────────
function handleKeyPress(e) {
    if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (!gameRunning) startGame();
        else jump();
    } else if (e.code === "KeyP") {
        togglePause();
    }
}

function handleGameClick(e) {
    if (e.target.closest("#mobile-controls")) return;
    if (!gameRunning) startGame();
    else jump();
}

// ─── Iniciar juego ────────────────────────────────────────────────────────────
function startGame() {
    if (gameRunning) return;
    resetGame();
    gameRunning = true;
    startMessage.classList.add("hidden");
    gameOverScreen.classList.add("hidden");
    scheduleCactus(1200);
    gameLoop = requestAnimationFrame(updateGame);
}

// ─── Salto animado por JS ─────────────────────────────────────────────────────
// Usamos una parábola en JS en vez de dejar la animación solo en CSS.
// Esto permite que dinoYtop esté siempre sincronizado con la posición visual,
// lo que hace que la hitbox sea correcta en todo momento (incluyendo en móvil).
function jump() {
    if (!gameRunning || isJumping || isPaused) return;
    isJumping = true;
    dinoContainer.classList.add("jumping");

    const groundBottom = GROUND_H;           // bottom CSS en tierra
    const startTime    = performance.now();

    function animateJump(now) {
        if (!gameRunning) { isJumping = false; return; }

        const t       = Math.min((now - startTime) / JUMP_MS, 1);  // 0 → 1
        const height  = JUMP_HEIGHT * Math.sin(t * Math.PI);       // parábola suave

        // Mover visualmente el dino
        dinoContainer.style.bottom = (groundBottom + height) + 'px';

        // Actualizar la Y que usará checkCollision
        dinoYtop = containerH() - GROUND_H - DINO_H - height;

        if (t < 1) {
            requestAnimationFrame(animateJump);
        } else {
            // Aterrizaje
            dinoContainer.style.bottom = groundBottom + 'px';
            dinoYtop  = containerH() - GROUND_H - DINO_H;
            isJumping = false;
            dinoContainer.classList.remove("jumping");
        }
    }

    requestAnimationFrame(animateJump);
}

// ─── Cactus ───────────────────────────────────────────────────────────────────
function scheduleCactus(delay) {
    clearTimeout(cactusTimeout);
    cactusTimeout = setTimeout(() => {
        if (!gameRunning || isPaused) return;
        createCactus();
        scheduleCactus(getNextCactusDelay());
    }, delay || getNextCactusDelay());
}

function createCactus() {
    if (!gameRunning) return;

    const isDouble = Math.random() > 0.6;
    const spriteW  = isDouble ? 90 : 60;
    const hitW     = isDouble ? 55 : 28;   // hitbox más estrecha que el sprite
    const height   = Math.random() > 0.5 ? 70 : 55;

    const cactus = document.createElement("div");
    cactus.className = `cactus${isDouble ? ' double-cactus' : ''}`;
    cactus.style.cssText = `
        background-image: url('${isDouble ? CACTUS_D : CACTUS_S}');
        width: ${spriteW}px;
        height: ${height}px;
        will-change: transform;
    `;
    cactusContainer.appendChild(cactus);

    obstacles.push({
        element : cactus,
        x       : gameContainer.clientWidth,  // empieza justo a la derecha
        spriteW,
        width   : hitW,
        height,
        passed  : false
    });
}

// ─── Nubes ────────────────────────────────────────────────────────────────────
function createCloud() {
    const cloud = document.createElement("div");
    cloud.className = "cloud";
    const size  = Math.random() * 20 + 30;
    const speed = Math.random() * 20 + 30;
    cloud.style.cssText = `
        width:${size*2}px; height:${size}px;
        top:${Math.random()*100+20}px;
        right:-${size*2}px;
        opacity:${Math.random()*0.4+0.6};
        animation-duration:${speed}s;
    `;
    background.appendChild(cloud);
    setTimeout(() => cloud.remove(), speed * 1000);
}

// ─── Animación del dino corriendo ─────────────────────────────────────────────
function animateDino() {
    if (!gameRunning || isJumping) return;
    frameCounter++;
    if (frameCounter % getFrameInterval() === 0) {
        currentFrame = (currentFrame + 1) % dinoFrames.length;
        dinoRun.style.backgroundImage = `url('${dinoFrames[currentFrame]}')`;
    }
}

// ─── Bucle principal ──────────────────────────────────────────────────────────
function updateGame() {
    if (!gameRunning || isPaused) return;

    animateDino();

    // Puntos por sobrevivir
    framesSurvived++;
    if (framesSurvived % 6 === 0) addScore(1);

    // Suelo animado
    groundPos -= gameSpeed;
    if (groundPos <= -20) groundPos = 0;
    ground.style.backgroundPosition = `${groundPos}px bottom`;

    // Mover cactus
    const cw = gameContainer.clientWidth;
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const ob = obstacles[i];
        ob.x -= gameSpeed;
        ob.element.style.transform = `translateX(${ob.x - cw}px)`;

        if (checkCollision(ob)) {
            gameOver();
            return;
        }

        if (!ob.passed && ob.x < dinoContainer.offsetLeft) {
            ob.passed = true;
            addScore(10);
        }

        if (ob.x < -ob.spriteW - 10) {
            ob.element.remove();
            obstacles.splice(i, 1);
        }
    }

    gameLoop = requestAnimationFrame(updateGame);
}

// ─── Colisión ─────────────────────────────────────────────────────────────────
//
//  Coordenadas: origen en la esquina superior-izquierda de game-container.
//
//  Dino:
//    X  = dinoContainer.offsetLeft
//    Y  = dinoYtop  ← actualizado en JS en cada frame del salto
//    W  = DINO_W,  H = DINO_H
//
//  Cactus:
//    X  = ob.x + (spriteW - hitW) / 2   ← centramos la hitbox en el sprite
//    Y  = containerH - GROUND_H - ob.height   ← pegado al suelo
//    W  = ob.width,  H = ob.height
//
function checkCollision(ob) {
    const margin = 18;

    // Dino (reducido por margin)
    const dx = dinoContainer.offsetLeft + margin;
    const dy = dinoYtop                 + margin;
    const dw = DINO_W                   - margin * 3 ;
    const dh = DINO_H                   - margin * 3;

    // Cactus (hitbox centrada en el sprite)
    const cx = ob.x + (ob.spriteW - ob.width) / 10;
    const cy = containerH() - GROUND_H - ob.height;
    const cw = ob.width;
    const ch = ob.height;

    return dx < cx + cw && dx + dw > cx &&
            dy < cy + ch && dy + dh > cy;
}

// ─── Puntuación ───────────────────────────────────────────────────────────────
function addScore(points) {
    score += points;
    scoreElement.textContent = `Score: ${score}`;

    if (score % 50 === 0 && score > 0) {
        scoreElement.style.transform = 'scale(1.2)';
        scoreElement.style.color = '#4CAF50';
        setTimeout(() => {
            scoreElement.style.transform = 'scale(1)';
            scoreElement.style.color = 'white';
        }, 200);
    }

    if (score % 100 === 0 && score > 0 && gameSpeed < 12) {
        gameSpeed += 0.5;
    }
}

// ─── Game Over ────────────────────────────────────────────────────────────────
function gameOver() {
    gameRunning = false;
    cancelAnimationFrame(gameLoop);
    clearTimeout(cactusTimeout);

    const flash = document.createElement('div');
    flash.style.cssText = `
        position:absolute; inset:0;
        background:rgba(255,0,0,0.3);
        animation:hitFlash 0.3s forwards;
        z-index:15; pointer-events:none;
    `;
    gameContainer.appendChild(flash);
    setTimeout(() => flash.remove(), 300);

    if (score > highScore) {
        highScore = score;
        localStorage.setItem("dinoHighScore", highScore);
        highScoreElement.textContent = `High Score: ${highScore}`;
    }

    finalScoreElement.textContent = `Puntuación: ${score}`;
    setTimeout(() => gameOverScreen.classList.remove("hidden"), 500);
}

// ─── Pausa ────────────────────────────────────────────────────────────────────
function togglePause() {
    if (!gameRunning) return;
    isPaused = !isPaused;

    if (isPaused) {
        cancelAnimationFrame(gameLoop);
        clearTimeout(cactusTimeout);
        showPauseMessage();
    } else {
        document.getElementById('pause-message')?.remove();
        gameLoop = requestAnimationFrame(updateGame);
        scheduleCactus(getNextCactusDelay());
    }
}

function showPauseMessage() {
    if (document.getElementById('pause-message')) return;
    const msg = document.createElement('div');
    msg.id = 'pause-message';
    msg.innerHTML = `<h3>PAUSA</h3><p>Pulsa P o el botón para continuar</p>`;
    msg.style.cssText = `
        position:absolute; top:50%; left:50%;
        transform:translate(-50%,-50%);
        background:rgba(0,0,0,0.9); color:white;
        padding:20px 40px; border-radius:10px;
        text-align:center; z-index:99;
        border:2px solid #4CAF50;
    `;
    gameContainer.appendChild(msg);
}

// ─── Reset ────────────────────────────────────────────────────────────────────
function resetGame() {
    score          = 0;
    gameSpeed      = 5;
    isJumping      = false;
    isPaused       = false;
    groundPos      = 0;
    obstacles      = [];
    frameCounter   = 0;
    currentFrame   = 0;
    framesSurvived = 0;

    while (cactusContainer.firstChild) cactusContainer.firstChild.remove();
    document.getElementById('pause-message')?.remove();

    scoreElement.textContent = 'Score: 0';
    dinoContainer.classList.remove("jumping");
    dinoContainer.style.bottom = GROUND_H + 'px';
    dinoRun.style.backgroundImage = `url('${dinoFrames[0]}')`;
    dinoYtop = containerH() - GROUND_H - DINO_H;
}

// ─── Arrancar ─────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', initGame);