import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage, AIMessage } from "langchain";

const chatModel = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-flash-lite",
    apiKey: process.env.GEMINI_API_KEY,
    thinkingConfig: {
        thinkingLevel: "LOW"
    }
});

/**
 * Gemini can return message content either as a plain string or as an array of
 * content blocks (text / thinking / tool calls). Only text blocks should reach
 * the client, so extract them defensively.
 */
function extractText(content) {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";

    return content
        .map((part) => {
            if (typeof part === "string") return part;
            return part?.type === "text" ? part.text : "";
        })
        .join("");
}

export async function* streamResponse(messages) {
    const lcMessages = messages.map((msg) =>
        msg.role === "user"
            ? new HumanMessage(msg.content)
            : new AIMessage(msg.content)
    );

    const stream = await chatModel.stream(lcMessages);
    for await (const chunk of stream) {
        const text = extractText(chunk.content);
        if (text) yield text;
    }
}

export async function generateChatTitle(message) {
    const response = await chatModel.invoke([
        // ============== SYSTEM INSTRUCTIONS =============
        new SystemMessage(`You're a helpful assistant that generatesconscie and descriptive titles for chat conversation.
            User will provide you with the first message of a chat conversation, and you will generate a title that captures the essence of the conversation in 3-5 words. The title should be clear, relevant, and engaging, giving users a quick understanding of the chat's topic.    
                `),

        new HumanMessage(`Generate a title for a chat conversation based on the following first message: "${message}"
                `)
    ]);

    return extractText(response.content);
}
