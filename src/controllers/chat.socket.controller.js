import Chat from "../models/chat.model.js";
import Message from "../models/message.model.js";
import { generateChatTitle, streamResponse } from "../services/ai.service.js";

function emitError(socket, chatId, label, message) {
    socket.emit("chat:error", {
        chatId: chatId ?? null,
        stage: label,
        message,
    });
}

export async function chatMessageHandler(socket, payload, ack) {
    const { content, chatId } = payload ?? {};

    if (socket.data.activeStream) {
        return emitError(socket, chatId, "stream", "A response is already streaming");
    }
    if (!content?.trim()) {
        return emitError(socket, chatId, "validate", "Message cannot be empty");
    }

    // Reserve the stream slot before any async work to avoid overlapping messages.
    socket.data.activeStream = true;
    let chat = null;

    try {
        // Ownership check when chatId is provided
        chat = chatId
            ? await Chat.findOne({ _id: chatId, user: socket.user.id })
            : null;
        if (chatId && !chat) {
            return emitError(socket, chatId, "chat", "Chat not found");
        }

        if (!chat) {
            // new chat -> title first (short, stays on .invoke())
            const title = await generateChatTitle(content);
            chat = await Chat.create({ user: socket.user.id, title });
        }

        const userMessage = await Message.create({
            chat: chat._id,
            content,
            role: "user",
        });
        socket.emit("chat:started", {
            chatId: chat._id,
            title: chat.title,
            userMessage,
        });

        // history WITH sort + limit
        const history = await Message.find({ chat: chat._id })
            .sort({ createdAt: 1 })
            .limit(50);

        let full = "";
        const timeline = [];
        const sources = [];
        const startedAt = Date.now();
        let durationMs = null;
        for await (const event of streamResponse(history)) {
            if(event.type === "text") {
                if(durationMs === null) durationMs = Date.now() - startedAt;
                full += event.text;
                if(socket.connected) {
                    socket.emit("chat:ai_response_chunk", {
                        chatId: chat._id,
                        chunk: event.text
                    });
                }
                continue;
            }
            
            // thinking / search/ sources / writing -> timeline stage
            const entry = {type: event.type, at: new Date()};
            if(event.type === "search") entry.query = event.query ?? null;
            if(event.type === "sources") {
                entry.sources = event.sources ?? [];
                sources.push(...entry.sources);
            }
            timeline.push(entry);

            if(socket.connected) {
                socket.emit("chat:thought", {chatId: chat._id, event: entry});
            }
        }

        const metadata = {timeline, sources, durationMs}; 

        const aiMessage = await Message.create({
            chat: chat._id,
            content: full,
            role: "ai",
            metadata
        });
        await Chat.findByIdAndUpdate(chat._id, { updatedAt: new Date() });

        socket.emit("chat:ai_response_done", {
            chatId: chat._id,
            messageId: aiMessage._id,
            content: full,
            metadata
        });
    } catch (err) {
        emitError(socket, chat?._id ?? chatId, "ai", "Failed to generate a response");
    } finally {
        socket.data.activeStream = false;
    }
}
