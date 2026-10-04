import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {HumanMessage} from "langchain";

const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    apiKey: process.env.GEMINI_API_KEY
});

export async function generateResponse(message) {
    const response = await model.invoke([
        new HumanMessage(message)
    ]);

    return response.text;
}