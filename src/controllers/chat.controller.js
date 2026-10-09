import ChatModel from "../models/chat.model.js";
import MessageModel from "../models/message.model.js";

export async function getChats(req, res) {
    const user = req.user;

    const chats = await ChatModel.find({ user: user.id }).sort({ updatedAt: -1 });

    res.status(200).json({
        message: "Chats retrieved successfully",
        chats
    });
}

export async function getMessages(req, res) {
    const { chatId } = req.params;
    const chat = await ChatModel.findOne({
        _id: chatId,
        user: req.user.id
    });

    if (!chat) {
        return res.status(404).json({
            message: "Chat not found"
        });
    }

    const messages = await MessageModel.find({
        chat: chat._id
    }).sort({ createdAt: 1 });

    res.status(200).json({
        message: `Messages of chat ${chat.title || ""} retrieved successfully`,
        messages
    });
}

export async function deleteChat(req, res) {
    const { chatId } = req.params;
    const chat = await ChatModel.findOneAndDelete({
        _id: chatId,
        user: req.user.id
    });

    if (!chat) {
        return res.status(404).json({
            message: "Chat not found"
        });
    }

    await MessageModel.deleteMany({
        chat: chatId
    });

    res.status(200).json({
        message: `Chat ${chat.title} deleted successfully`
    });
}
