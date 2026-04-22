import http from 'http';
import {Server} from 'socket.io';
import express from 'express';
import path from 'path';

async function main() {

  const app = express();
  // when i write ./, i mean to say that start from directory from where my process in running.
  app.use(express.static(path.resolve('./public')));

  const server = http.createServer(app);

  const io = new Server();
  io.attach(server);

  io.on('connection', (socket) => {
    console.log(`A new socket has connected: ${socket.id}`)

    socket.on("user:message", (msg) => {
      socket.broadcast.emit('server:message', msg);
    })

    socket.on("user:typing", () => {
      socket.broadcast.emit('server:typing');
    })

    socket.on("user:stopTyping", () => {
      socket.broadcast.emit('server:stopTyping');
    })

    socket.on("message:delivered", ({ id }) => {
      socket.broadcast.emit("message:delivered", { id });
    });

    socket.on("message:seen",  ({id}) => {
      socket.broadcast.emit("message:seen", {id});
    });
  })

  server.listen(9000, () => {
    console.log(`Server is running on port 9000`);
  })
}

main();