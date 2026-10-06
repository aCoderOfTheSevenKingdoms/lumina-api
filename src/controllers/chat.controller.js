import { generateChatTitle, generateResponse } from "../services/ai.service.js";
import ChatModel from "../models/chat.model.js";
import MessageModel from "../models/message.model.js";

export async function sendMessage(req, res) {
    const {message, chat: chatId} = req.body;

    /**
     * Create a new chat with a title if there does not exist one 
    */
    let title = null, chat = null;
    if(!chatId) {
        title = await generateChatTitle(message);
        console.log(title);
        
        chat = await ChatModel.create({
            user: req.user.id,
            title
        });
    }

    const userMessage = await MessageModel.create({
        chat: chatId || chat._id,
        content: message,
        role: "user"
    });

    const messages = await MessageModel.find({chat: chatId || chat._id}); 

    const result = await generateResponse(messages);

    // ==================== CREATE MESSAGE DOCS IN DB ===================
    const aiMessage = await MessageModel.create({
        chat: chatId || chat._id,
        content: result,
        role: "ai"
    });

    res.status(201).json({
        chatTitle: title,
        chat,
        messages,
        aiMessage
    });
}

export async function getChats(req, res) {
    const user = req.user;

    const chats = await ChatModel.find({user: user.id});

    res.status(200).json({
        message: "Chats retrieved successfully",
        chats
    });
}

export async function getMessages(req, res) {
    const {chatId} = req.params;
    const chat = await ChatModel.findOne({
        _id: chatId,
        user: req.user.id
    });

    if(!chat) {
        return res.status(404).json({
            message: "Chat not found"
        });
    }

    const messages = await MessageModel.find({
        chat: chat._id
    });

    res.status(200).json({
        message: `Messages of chat ${chat.title || ""} retrieved successfully`,
        messages
    });
}

export async function deleteChat(req, res) {
    const {chatId} = req.params;
    const chat = await ChatModel.findOneAndDelete({
        _id: chatId,
        user: req.user.id
    });

    await MessageModel.deleteMany({
        chat: chatId
    });

    if(!chat) {
        return res.status(404).json({
            message: "Chat not found"
        });
    }

    res.status(200).json({
        message: `Chat ${chat.title} deleted successfully`
    });
}