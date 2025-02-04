require('dotenv').config(); // Importa dotenv
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
  }
});

let rooms = {};

io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado:', socket.id);

  socket.on('createRoom', (callback) => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms[roomCode] = { coordinator: socket.id, players: [], numbers: [] };
    socket.join(roomCode);
    callback(roomCode);
  });

  socket.on('joinRoom', (roomCode, callback) => {
    if (rooms[roomCode]) {
      socket.join(roomCode);
      rooms[roomCode].players.push(socket.id);
      callback({ success: true });
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

  socket.on('declareWinner', (roomCode, winnerName) => {
    io.to(roomCode).emit('winnerDeclared', winnerName);
  });

  socket.on('endGame', (roomCode) => {
    io.to(roomCode).emit('gameEnded');
    delete rooms[roomCode];
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      if (room.coordinator === socket.id) {
        io.to(roomCode).emit('gameEnded');
        delete rooms[roomCode];
      } else {
        room.players = room.players.filter((id) => id !== socket.id);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
