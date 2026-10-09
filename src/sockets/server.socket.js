import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { chatMessageHandler } from "../controllers/chat.socket.controller.js";

let io;

function parseCookieHeader(header = "") {
    return Object.fromEntries(
        header
            .split(";")
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => {
                const separator = part.indexOf("=");
                const key = part.slice(0, separator).trim();
                const value = decodeURIComponent(part.slice(separator + 1).trim());
                return [key, value];
            })
    );
}

export function initSocket(httpServer) {
    const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

    io = new Server(httpServer, {
        cors: {
            origin: allowedOrigins,
            credentials: true,
        },
    });

    // JWT Handshake Auth
    io.use((socket, next) => {
        try {
            const cookies = parseCookieHeader(socket.handshake.headers.cookie);
            const token = cookies.token;
            if (!token) return next(new Error("Unauthorized"));

            socket.user = jwt.verify(token, process.env.JWT_SECRET);
            next();
        } catch (error) {
            next(new Error("Unauthorized"));
        }
    });

    /**
     * socket.id is unique to each connected client
     * Everytime a client re-connects to the server, it's socket id is changed.
    */
    io.on("connection", (socket) => {
        socket.data.activeStream = false;
        socket.on("chat:message", (payload, ack) => {
            chatMessageHandler(socket, payload, ack, io);
        });
    });
}
