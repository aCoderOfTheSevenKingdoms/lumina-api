import {Server} from "socket.io";
import jwt from "jsonwebtoken";
import { chatMessageHandler } from "../controllers/chat.socket.controller";

let io;

export function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL.split(","),
            credentials: true  
        }
    });

    // JWT Handshake Auth
    io.use((socket, next) => {
      const token = (socket.handshake.headers.cookie)?.token;
      if(!token) return next(new Error("Unauthorized"));
      try {
        socket.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
      } catch(error) {
        next(new Error("Unauthorized"));
      }
    })

    /**
     * socket.id is unique to each connected client
     * Everytime a client re-connects to the server, it's socket id is changed. 
    */
    io.on("connection", (socket) => {
        socket.data.activeStream = false;
        socket.on("chat:message", (payload,ack) => {
            chatMessageHandler(socket, payload, ack, io)
        })
    });
}