import Chat from "../models/chat.model.js";
import Message from "../models/message.model.js";
import {generateChatTitle} from "../services/ai.service.js"

function emitError(socket, chatId, label, message) {}

export async function chatMessageHandler(socket, payload, ack) {
    const {content, chatId} = payload;
    try {
        if(socket.data.activeStream) {
            return emitError(socket, chatId, "stream", "A response is already streaming");
        }
        if(!content?.trim()) {
            return emitError(socket, chatId, "validate", "Message cannot be empty");
        }

        // Ownership check when chatId is provided
        let chat = chatId
           ? await Chat.findOne({_id: chatId, user: socket.user.id})
           : null;
        if(chatId && !chat) {
            return emitError(socket, chatId, "chat", "Chat not found");
        }   

        if(!chat) {
            // new chat -> title first (short, stays on .invoke())
            const title = await generateChatTitle(content);
            chat = await Chat.create({user: socket.user.id, title});
        }

        const userMessage = await Message.create({
            chat: chat._id,
            content,
            role: "user"
        });
        socket.emit("chat:started", {
            chatId: chat._id, 
            title: chat.title,
            userMessage
        });

        // history WITH sort + limit 
        const history = await Message.find({chat: chat._id})
           .sort({createdAt: 1})
           .limit(50);
        
        socket.data.activeStream = true;
        let full = "";
        for await (const chunk of streamResponse(history)) {
            full += chunk;
            if(socket.connected) {
                socket.emit("chat:ai_response_chunk", {
                    chatId: chat._id,
                    chunk
                });
            }
        }   

        const aiMessage = await Message.create({
            chat: chat._id,
            content: full,
            role: "ai"
        });
        await Chat.findByIdAndUpdate(chat._id, {updatedAt: new Date()});

        socket.emit("chat:ai_response_done", {
            chatId: chat._id,
            messageId: aiMessage._id,
            content: full 
        });
    } catch(err) {
        socket.emit("chat:error", {
            chatId: payload.chatId,
            stage: "ai",
            message: "Failed to generate a response"
        });
    } finally {
        socket.data.activeStream = false;
    }
}