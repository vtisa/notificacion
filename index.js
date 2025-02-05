// Servidor Node.js actualizado para Bingo
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
  },
});

let rooms = {};

io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado:', socket.id);

  socket.on('createRoom', ({ coordinatorName, winningRules, prizes }, callback) => {
    if (typeof callback !== 'function') {
      console.error('Error: callback no es una función');
      return;
    }
  
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms[roomCode] = {
      coordinator: socket.id,
      coordinatorName,
      players: [],
      numbers: [],
      winningRules,
      prizes,
      currentPrizeIndex: 0
    };
  
    socket.join(roomCode);
    callback({ roomCode, coordinatorName });
  });
  

  socket.on('joinRoom', ({ roomCode, playerName }, callback) => {
    if (rooms[roomCode]) {
      socket.join(roomCode);
      rooms[roomCode].players.push({ id: socket.id, name: playerName });
      callback({ success: true, drawnNumbers: rooms[roomCode].numbers, winningRules: rooms[roomCode].winningRules });
    } else {
      callback({ success: false, message: 'Sala no encontrada' });
    }
  });

  socket.on('drawNumber', ({ roomCode, number, letter }) => {
    if (rooms[roomCode]) {
      rooms[roomCode].numbers.push({ number, letter });
      io.to(roomCode).emit('numberDrawn', { number, letter });
    }
  });

  socket.on('declareWinner', ({ roomCode, winnerName }) => {
    if (rooms[roomCode]) {
      io.to(roomCode).emit('winnerDeclared', winnerName);
      const currentPrize = rooms[roomCode].prizes[rooms[roomCode].currentPrizeIndex];
      io.to(roomCode).emit('selectingPrize', { winnerName, currentPrize });
    }
  });

  socket.on('assignPrize', ({ roomCode, prize }) => {
    io.to(roomCode).emit('prizeAssigned', prize);
    rooms[roomCode].currentPrizeIndex++;

    if (rooms[roomCode].currentPrizeIndex < rooms[roomCode].prizes.length) {
      io.to(roomCode).emit('nextRound', 'Iniciando siguiente ronda...');
      rooms[roomCode].numbers = [];
    } else {
      io.to(roomCode).emit('gameEnded', 'Juego terminado');
      delete rooms[roomCode];
    }
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      if (room.coordinator === socket.id) {
        io.to(roomCode).emit('gameEnded', 'El coordinador se ha desconectado.');
        delete rooms[roomCode];
      } else {
        room.players = room.players.filter((player) => player.id !== socket.id);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

