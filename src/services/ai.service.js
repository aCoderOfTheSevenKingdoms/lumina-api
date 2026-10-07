import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {ChatOpenAI} from "@langchain/openai";
import {HumanMessage, SystemMessage, AIMessage} from "langchain";

const chatModel = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-flash-lite",
    apiKey: process.env.GEMINI_API_KEY,
    thinkingConfig: {
        thinkingLevel: "LOW"
    }
});

const titleModel = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-flash-lite",
    apiKey: process.env.GEMINI_API_KEY,
    thinkingConfig: {
        thinkingLevel: "LOW"
    }
});

export async function generateResponse(messages) {
    const response = await chatModel.invoke(
        messages.map(msg => {
            if(msg.role === "user") {
                return new HumanMessage(msg.content);
            } else if(msg.role === "ai") {
                return new AIMessage(msg.content);
            }
        })
    );

    return response.text;
}

export async function generateChatTitle(message) {
    const response = await titleModel.invoke(
        [
            // ============== SYSTEM INSTRUCTIONS =============
            new SystemMessage(`You're a helpful assistant that generatesconscie and descriptive titles for chat conversation.
            User will provide you with the first message of a chat conversation, and you will generate a title that captures the essence of the conversation in 3-5 words. The title should be clear, relevant, and engaging, giving users a quick understanding of the chat's topic.    
                `),

            new HumanMessage(`Generate a title for a chat conversation based on the following first message: "${message}"
                `)    
        ]
    );

    return response.text;
}