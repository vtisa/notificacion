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

let rooms = {}; // Almacena todas las salas activas

// Manejo de conexión de nuevos clientes
io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado:', socket.id);

  // Crear una sala
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
      currentPrizeIndex: 0,
    };

    socket.join(roomCode);
    callback({ roomCode, coordinatorName });

    console.log(`Sala creada: ${roomCode} por ${coordinatorName}`);
  });

  // Unirse a una sala
  socket.on('joinRoom', ({ roomCode, playerName }, callback) => {
    if (rooms[roomCode]) {
      socket.join(roomCode);
      rooms[roomCode].players.push({ id: socket.id, name: playerName });

      callback({
        success: true,
        drawnNumbers: rooms[roomCode].numbers,
        winningRules: rooms[roomCode].winningRules,
      });

      console.log(`${playerName} se unió a la sala: ${roomCode}`);
    } else {
      callback({ success: false, message: 'Sala no encontrada' });
    }
  });

  // Sorteo de un número
  socket.on('drawNumber', ({ roomCode, number, letter }) => {
    if (rooms[roomCode]) {
      rooms[roomCode].numbers.push({ number, letter });
      io.to(roomCode).emit('numberDrawn', { number, letter });
      console.log(`Número sorteado: ${number}${letter} en la sala ${roomCode}`);
    }
  });

  // Declarar ganador
  socket.on('declareWinner', ({ roomCode, winnerName }) => {
    if (rooms[roomCode]) {
      io.to(roomCode).emit('winnerDeclared', winnerName);
      const currentPrize = rooms[roomCode].prizes[rooms[roomCode].currentPrizeIndex];
      io.to(roomCode).emit('selectingPrize', { winnerName, currentPrize });
      console.log(`Ganador declarado: ${winnerName} en la sala ${roomCode}`);
    }
  });

  // Asignar un premio
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
    console.log(`Premio asignado: ${prize} en la sala ${roomCode}`);
  });

  // Finalizar el juego manualmente
  socket.on('endGame', ({ roomCode }) => {
    if (rooms[roomCode]) {
      io.to(roomCode).emit('gameEnded', 'El coordinador ha finalizado el juego.');
      delete rooms[roomCode];
      console.log(`Juego finalizado por el coordinador en la sala ${roomCode}`);
    }
  });

  // Manejo de desconexión
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

// Iniciar el servidor
server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});