import {Server} from "socket.io";

let io;

export function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: "http://localhost:5173",
            credentials: true  
        }
    });

    console.log("Socket.io server is running");

    /**
     * socket.id is unique to each connected client
     * Everytime a client re-connects to the server, it's socket id is changed. 
    */
    io.on("connection", (socket) => {
        console.log("A user connected: " + socket.id);
    });
}