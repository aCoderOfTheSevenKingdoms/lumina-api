import { generateChatTitle, generateResponse } from "../services/ai.service.js";

export async function sendMessage(req, res) {
    const {message} = req.body;

    // ============== Generate a title for the conversation ==============
    const title = await generateChatTitle(message);
    console.log(title);

    const result = await generateResponse(message);
    res.json({
        chatTitle: title,
        response: result
    });
}