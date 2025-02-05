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

let rooms = {};  // Aquí almacenaremos todas las salas activas

// Manejo de conexión de nuevos clientes
io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado:', socket.id);

  // Evento para crear una sala
  socket.on('createRoom', ({ coordinatorName, winningRules, prizes }, callback) => {
    if (typeof callback !== 'function') {
      console.error('Error: callback no es una función');
      return;
    }
    
    // Generamos un código de sala único
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Creamos la sala con sus propiedades
    rooms[roomCode] = {
      coordinator: socket.id,  // ID del coordinador
      coordinatorName,         // Nombre del coordinador
      players: [],             // Lista de jugadores
      numbers: [],             // Números sorteados
      winningRules,            // Reglas de la sala
      prizes,                  // Premios de la sala
      currentPrizeIndex: 0     // Índice del premio actual
    };
    
    // El coordinador se une a la sala
    socket.join(roomCode);
    
    // Devolvemos el código de la sala al cliente
    callback({ roomCode, coordinatorName });
    
    console.log(`Sala creada: ${roomCode} por ${coordinatorName}`);
  });

  // Evento para unirse a una sala
  socket.on('joinRoom', ({ roomCode, playerName }, callback) => {
    if (rooms[roomCode]) {
      // Si la sala existe, el jugador se une
      socket.join(roomCode);
      rooms[roomCode].players.push({ id: socket.id, name: playerName });

      // Devolvemos la información del estado de la sala
      callback({
        success: true,
        drawnNumbers: rooms[roomCode].numbers,
        winningRules: rooms[roomCode].winningRules
      });
      console.log(`${playerName} se unió a la sala: ${roomCode}`);
    } else {
      // Si la sala no existe, enviamos un mensaje de error
      callback({ success: false, message: 'Sala no encontrada' });
    }
  });

  // Evento para sortear un número
  socket.on('drawNumber', ({ roomCode, number, letter }) => {
    if (rooms[roomCode]) {
      rooms[roomCode].numbers.push({ number, letter });
      io.to(roomCode).emit('numberDrawn', { number, letter });
      console.log(`Número sorteado: ${number}${letter} en la sala ${roomCode}`);
    }
  });

  // Evento para declarar un ganador
  socket.on('declareWinner', ({ roomCode, winnerName }) => {
    if (rooms[roomCode]) {
      io.to(roomCode).emit('winnerDeclared', winnerName);
      const currentPrize = rooms[roomCode].prizes[rooms[roomCode].currentPrizeIndex];
      io.to(roomCode).emit('selectingPrize', { winnerName, currentPrize });
      console.log(`Ganador declarado: ${winnerName} en la sala ${roomCode}`);
    }
  });

  // Evento para asignar un premio
  socket.on('assignPrize', ({ roomCode, prize }) => {
    io.to(roomCode).emit('prizeAssigned', prize);
    rooms[roomCode].currentPrizeIndex++;

    if (rooms[roomCode].currentPrizeIndex < rooms[roomCode].prizes.length) {
      io.to(roomCode).emit('nextRound', 'Iniciando siguiente ronda...');
      rooms[roomCode].numbers = [];  // Limpiar los números sorteados para la siguiente ronda
    } else {
      io.to(roomCode).emit('gameEnded', 'Juego terminado');
      delete rooms[roomCode];  // Eliminar la sala después de finalizar el juego
    }
    console.log(`Premio asignado: ${prize} en la sala ${roomCode}`);
  });

  // Manejo de desconexión de clientes
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      if (room.coordinator === socket.id) {
        // Si el coordinador se desconecta, termina el juego y elimina la sala
        io.to(roomCode).emit('gameEnded', 'El coordinador se ha desconectado.');
        delete rooms[roomCode];
      } else {
        // Si un jugador se desconecta, se elimina de la lista de jugadores
        room.players = room.players.filter((player) => player.id !== socket.id);
      }
    }
  });
});

// Iniciar el servidor
server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
