const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const port = process.env.PORT || 3000;

// Game state
let particles = [];
let isRunning = false;
let speed = 1;
let gameOver = false;

const CANVAS_SIZE = 500;
const PARTICLE_SIZE = 20;
const COLLISION_DISTANCE = 25;

const TYPES = {
    ROCK: 1,
    PAPER: 2,
    SCISSORS: 3
};

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
    
    if (checkGameOver()) {
        isRunning = false;
        gameOver = true;
    }
}

function checkGameOver() {
    const types = new Set(particles.map(p => p.type));
    return types.size <= 1;
}

// Serve static files
app.use(express.static(path.join(__dirname)));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Send current game state to new client
    socket.emit('gameState', { particles, isRunning, gameOver });

    socket.on('startGame', () => {
        if (!isRunning && !gameOver) {
            isRunning = true;
            io.emit('gameState', { particles, isRunning, gameOver });
        }
    });

    socket.on('pauseGame', () => {
        isRunning = false;
        io.emit('gameState', { particles, isRunning, gameOver });
    });

    socket.on('resetGame', () => {
        isRunning = false;
        gameOver = false;
        initParticles();
        io.emit('gameState', { particles, isRunning, gameOver });
    });

    socket.on('changeSpeed', (newSpeed) => {
        speed = newSpeed;
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Game loop on server
setInterval(() => {
    if (isRunning) {
        updateParticles();
        io.emit('gameState', { particles, isRunning, gameOver });
    }
}, 1000 / 60); // 60 FPS

// Initialize game
initParticles();

server.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Access from other devices using your IP address: http://YOUR_IP:${port}`);
});