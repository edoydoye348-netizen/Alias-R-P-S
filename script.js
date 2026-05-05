const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const CANVAS_SIZE = 500;
const PARTICLE_SIZE = 20;
const COLLISION_DISTANCE = 25;

const TYPES = {
    ROCK: 1,
    PAPER: 2,
    SCISSORS: 3
};

const COLORS = {
    [TYPES.ROCK]: '#9ca3af',
    [TYPES.PAPER]: '#fbbf24',
    [TYPES.SCISSORS]: '#f87171'
};

const EMOJIS = {
    [TYPES.ROCK]: '🪨',
    [TYPES.PAPER]: '📄',
    [TYPES.SCISSORS]: '✂️'
};

let particles = [];
let isRunning = false;
let speed = 1;
let gameOver = false;
let prediction = null;

canvas.width = CANVAS_SIZE;
canvas.height = CANVAS_SIZE;

// Connect to server
const socket = io();

function initParticles() {
    particles = [];
    
    const elements = [
        { type: TYPES.ROCK, count: 10 },
        { type: TYPES.PAPER, count: 10 },
        { type: TYPES.SCISSORS, count: 10 }
    ];

    elements.forEach(({ type, count }) => {
        for (let i = 0; i < count; i++) {
            let x, y;
            let attempts = 0;
            do {
                x = Math.random() * (CANVAS_SIZE - PARTICLE_SIZE) + PARTICLE_SIZE / 2;
                y = Math.random() * (CANVAS_SIZE - PARTICLE_SIZE) + PARTICLE_SIZE / 2;
                attempts++;
            } while (attempts < 100 && particles.some(p => Math.hypot(p.x - x, p.y - y) < PARTICLE_SIZE));
            
            const vx = (Math.random() - 0.5) * 4;
            const vy = (Math.random() - 0.5) * 4;
            
            particles.push({ x, y, vx, vy, type });
        }
    });

    gameOver = false;
    updateStats();
}

function updateParticles() {
    // Update positions and bounce off walls
    particles.forEach(p => {
        p.x += p.vx * speed;
        p.y += p.vy * speed;
        
        if (p.x <= PARTICLE_SIZE / 2 || p.x >= CANVAS_SIZE - PARTICLE_SIZE / 2) {
            p.vx = -p.vx;
            p.x = Math.max(PARTICLE_SIZE / 2, Math.min(CANVAS_SIZE - PARTICLE_SIZE / 2, p.x));
        }
        if (p.y <= PARTICLE_SIZE / 2 || p.y >= CANVAS_SIZE - PARTICLE_SIZE / 2) {
            p.vy = -p.vy;
            p.y = Math.max(PARTICLE_SIZE / 2, Math.min(CANVAS_SIZE - PARTICLE_SIZE / 2, p.y));
        }
    });
    
    // Check collisions and transform
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const p1 = particles[i];
            const p2 = particles[j];
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            if (dist < COLLISION_DISTANCE) {
                // Transform based on rules
                if (p1.type === TYPES.ROCK && p2.type === TYPES.PAPER) {
                    p1.type = TYPES.PAPER;
                } else if (p1.type === TYPES.PAPER && p2.type === TYPES.SCISSORS) {
                    p1.type = TYPES.SCISSORS;
                } else if (p1.type === TYPES.SCISSORS && p2.type === TYPES.ROCK) {
                    p1.type = TYPES.ROCK;
                } else if (p2.type === TYPES.ROCK && p1.type === TYPES.PAPER) {
                    p2.type = TYPES.PAPER;
                } else if (p2.type === TYPES.PAPER && p1.type === TYPES.SCISSORS) {
                    p2.type = TYPES.SCISSORS;
                } else if (p2.type === TYPES.SCISSORS && p1.type === TYPES.ROCK) {
                    p2.type = TYPES.ROCK;
                }
            }
        }
    }
    
    updateStats();
    
    if (checkGameOver()) {
        isRunning = false;
        gameOver = true;
        updateStatus();
    }
}

function checkGameOver() {
    const types = new Set(particles.map(p => p.type));
    return types.size <= 1;
}

function updateStats() {
    let counts = { rock: 0, paper: 0, scissors: 0 };
    const total = particles.length;

    particles.forEach(p => {
        if (p.type === TYPES.ROCK) counts.rock++;
        else if (p.type === TYPES.PAPER) counts.paper++;
        else if (p.type === TYPES.SCISSORS) counts.scissors++;
    });

    document.getElementById('rockCount').textContent = counts.rock;
    document.getElementById('paperCount').textContent = counts.paper;
    document.getElementById('scissorsCount').textContent = counts.scissors;

    if (total > 0) {
        document.getElementById('rockProgress').style.width = (counts.rock / total * 100) + '%';
        document.getElementById('paperProgress').style.width = (counts.paper / total * 100) + '%';
        document.getElementById('scissorsProgress').style.width = (counts.scissors / total * 100) + '%';
    }
}

function updateStatus() {
    const status = document.getElementById('status');
    if (gameOver) {
        const types = new Set(particles.map(p => p.type));
        
        let winner = 'None';
        if (types.has(TYPES.ROCK)) winner = '🪨 Rock';
        else if (types.has(TYPES.PAPER)) winner = '📄 Paper';
        else if (types.has(TYPES.SCISSORS)) winner = '✂️ Scissors';

        let predictionText = '';
        if (prediction) {
            const winnerType = types.has(TYPES.ROCK) ? TYPES.ROCK : types.has(TYPES.PAPER) ? TYPES.PAPER : TYPES.SCISSORS;
            if (prediction === winnerType) {
                predictionText = ' 🎉 Your prediction was correct!';
            } else {
                predictionText = ' 😞 Your prediction was wrong.';
            }
        }

        status.textContent = `🏆 Game Over! ${winner} dominated the space!${predictionText}`;
        status.classList.add('finished');
    } else if (isRunning) {
        status.textContent = '⚙️ Simulation running...';
        status.classList.remove('finished');
    } else {
        status.textContent = '⏸️ Simulation paused';
        status.classList.remove('finished');
    }
}

function draw() {
    ctx.fillStyle = '#0a0a15';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `${PARTICLE_SIZE}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    particles.forEach(p => {
        let emoji = EMOJIS[p.type];
        if (!emoji) {
            // Fallback for platforms with missing emoji glyphs
            if (p.type === TYPES.ROCK) emoji = '⛰️';
            else if (p.type === TYPES.PAPER) emoji = '📄';
            else if (p.type === TYPES.SCISSORS) emoji = '✂️';
        }

        // Fallback to letters if emoji is still missing
        if (!emoji) {
            if (p.type === TYPES.ROCK) emoji = 'R';
            else if (p.type === TYPES.PAPER) emoji = 'P';
            else if (p.type === TYPES.SCISSORS) emoji = 'S';
        }

        ctx.fillText(emoji, p.x, p.y);
    });
}

function animate() {
    draw();
    requestAnimationFrame(animate);
}

// Socket event listeners
socket.on('gameState', (state) => {
    particles = state.particles;
    isRunning = state.isRunning;
    gameOver = state.gameOver;
    updateStats();
    updateStatus();
    if (isRunning) {
        document.getElementById('startBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
    } else {
        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
    }

    // Show modal when game is over
    if (gameOver) {
        showGameOverModal();
    }
});

document.getElementById('startBtn').addEventListener('click', () => {
    socket.emit('startGame');
});

document.getElementById('pauseBtn').addEventListener('click', () => {
    socket.emit('pauseGame');
});

document.getElementById('resetBtn').addEventListener('click', () => {
    socket.emit('resetGame');
    prediction = null;
    document.querySelectorAll('.prediction-btn').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('gameOverModal').style.display = 'none';
});

document.getElementById('speedSlider').addEventListener('input', (e) => {
    speed = parseFloat(e.target.value);
    document.getElementById('speedValue').textContent = speed + 'x';
    socket.emit('changeSpeed', speed);
});

document.querySelectorAll('.prediction-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.prediction-btn').forEach(b => b.classList.remove('selected'));
        e.target.classList.add('selected');
        prediction = parseInt(e.target.dataset.type);
    });
});

function showGameOverModal() {
    const types = new Set(particles.map(p => p.type));
    
    let winner = 'None';
    let winnerEmoji = '';
    if (types.has(TYPES.ROCK)) {
        winner = 'Rock';
        winnerEmoji = '🪨';
    } else if (types.has(TYPES.PAPER)) {
        winner = 'Paper';
        winnerEmoji = '📄';
    } else if (types.has(TYPES.SCISSORS)) {
        winner = 'Scissors';
        winnerEmoji = '✂️';
    }

    document.getElementById('modalMessage').textContent = `${winnerEmoji} ${winner} wins the battle!`;

    let predictionText = '';
    if (prediction) {
        const winnerType = types.has(TYPES.ROCK) ? TYPES.ROCK : types.has(TYPES.PAPER) ? TYPES.PAPER : TYPES.SCISSORS;
        if (prediction === winnerType) {
            predictionText = '🎉 Your prediction was correct!';
        } else {
            predictionText = '😞 Your prediction was wrong.';
        }
    } else {
        predictionText = 'You didn\'t make a prediction this time.';
    }
    document.getElementById('predictionResult').textContent = predictionText;

    document.getElementById('gameOverModal').style.display = 'block';
}

// Modal event listeners
document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('gameOverModal').style.display = 'none';
});

document.getElementById('playAgainBtn').addEventListener('click', () => {
    document.getElementById('gameOverModal').style.display = 'none';
    socket.emit('resetGame');
    prediction = null;
    document.querySelectorAll('.prediction-btn').forEach(btn => btn.classList.remove('selected'));
});

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    const modal = document.getElementById('gameOverModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});

// Initial setup
initParticles();
animate();