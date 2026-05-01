let ioInstance = null;

const initSocket = (io) => {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log('New client connected', socket.id);

    socket.on('join', (data) => {
      console.log(`User ${data.userId} joined with role ${data.role}`);
      // Join a room based on role
      socket.join(data.role);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected', socket.id);
    });
  });
};

const getIo = () => ioInstance;

module.exports = { initSocket, getIo };
