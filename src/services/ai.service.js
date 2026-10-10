import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage, AIMessage, AIMessageChunk, tool, createAgent } from "langchain";
import * as z from "zod";
import { searchInternet } from "./internet.service.js";

const chatModel = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-flash-lite",
    apiKey: process.env.GEMINI_API_KEY,
    thinkingConfig: {
        thinkingLevel: "LOW"
    }
});

const searchInternetTool = tool(
    async ({ query }) => searchInternet(query),
    {
        name: "searchInternet",
        description: "Use this tool to search the internet for relevant information to answer user queries. Input should be a search query string, and output will be a list of search results.",
        schema: z.object({
            query: z.string().describe("The search query to look up on the internet")
        })
    }
);

const agent = createAgent({
    model: chatModel,
    tools: [searchInternetTool]
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

/**
 * Normalizes one item from `agent.stream(..., { streamMode: ["messages","tools"] })`.
 *
 * Runtime yields 2-tuples ("messages" → [chunk, metadata]; "tools" → event).
 * The 3-tuple branch keeps this correct if `subgraphs: true` is ever enabled.
 * The final branch covers the legacy single-mode "messages" shape ([chunk, meta]).
 */
function normalizeStreamItem(item) {
    if(!Array.isArray(item)) return null;

    if(item.length === 3 && Array.isArray(item[0]) && typeof item[1] === "string") {
        return {mode: item[1], data: item[2]};
    }
    if(item.length === 2 && typeof item[0] === "string") {
        return {mode: item[0], data: item[1]};
    }
    if (item.length === 2) {
        return { mode: "messages", data: item };
    }
    return null;
}

/**
 * Pulls the tool's return string out of the "tools" event's 'output'
*/
function extractToolResultText(output) {
    if (output == null) return null;
    if (typeof output === "string") return output;
    if (typeof output.content === "string") return output.content;      // ToolMessage
    if (Array.isArray(output.content)) return extractText(output.content);
    if (typeof output.kwargs?.content === "string") return output.kwargs.content;
    return null;
}

const toSources = (results = []) =>
    results.map((result) => ({
        title: result.title,
        url: result.url,
        favicon: result.favicon ?? null,
        score: result.score,
        publishedDate: result.publishedDate ?? null
    }));

/**
 * Streams one agent run.
 *
 * Yields, in order:
 *   { type: "thinking" }
 *   { type: "search",  query }        // per web search
 *   { type: "sources", sources }      // per search result set
 *   { type: "writing" }               // once, before the first answer token
 *   { type: "text",    text }         // answer tokens
 */    
export async function* streamResponse(messages) {
    const lcMessages = messages.map((msg) =>
        msg.role === "user"
            ? new HumanMessage(msg.content)
            : new AIMessage(msg.content)
    );

    const stream = await agent.stream(
        { messages: lcMessages },
        { streamMode: "messages" }
    );

    yield {type: "thinking"};

    let announcedWriting = false; 

    for await (const raw of stream) {
        const parsed = normalizeStreamItem(raw);
        if(!parsed) continue;

        if(parsed.mode === "messages") {
            const chunk = parsed.data?.[0];
            if(!AIMessageChunk.isInstance(chunk)) continue;

            const text  = extractText(chunk.content);
            if(!text) continue;

            if(!announcedWriting) {
                announcedWriting = true;
                yield {type: "writing"}
            }
            yield {type: "text", text}
            continue;
        }

        if(parsed.mode === "tools") {
            const event = parsed.data;
            if(!event || event.name !== "searchInternet") continue;

            if(event.event === "on_tool_started") {
                // INput is a JSON string of the tool args.
                let query = null;
                try {
                    query = JSON.parse(event.input)?.query ?? null; 
                } catch {
                    query = null;
                }
                yield {type: "search", query};
            } else if (event.event === "on_tool_end") {
                let sources = [];
                try {
                    const text = extractToolResultText(event.output) ?? "{}";
                    sources = toSources(JSON.parse(text)?.results ?? []);
                } catch {
                    sources = [];
                }
                yield {type: "sources", sources}
            }
        }
    }
}

export async function generateChatTitle(message) {
    const response = await chatModel.invoke([
        // ============== SYSTEM INSTRUCTIONS =============
        new SystemMessage(`You're a helpful assistant that generates concise and descriptive titles for chat conversation.
            User will provide you with the first message of a chat conversation, and you will generate a title that captures the essence of the conversation in 3-5 words. The title should be clear, relevant, and engaging, giving users a quick understanding of the chat's topic.    
                `),

        new HumanMessage(`Generate a title for a chat conversation based on the following first message: "${message}"
                `)
    ]);

    return extractText(response.content);
}
