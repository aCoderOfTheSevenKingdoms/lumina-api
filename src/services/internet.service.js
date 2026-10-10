import {tavily as Tavily} from "@tavily/core";

const tavily = Tavily({
    apiKey: process.env.TAVILY_API_KEY
});

/**
 * Runs a Tavily search and returns a JSON string.
 *
 * The string is consumed twice:
 *  - by the LLM as the tool result (`answer` + `results[].content`), and
 *  - by ai.service.js, which parses `results` back out to build the UI's
 *    source list for the "Thought" thread.
 *
 * Tavily's result array is `results` (not `sources`). `favicon` is only
 * present when `includeFavicon` is set; `publishedDate` only when
 * `includePublishedDate` is set (or topic is "news").
 */
export const searchInternet = async (query) => {
    const response = await tavily.search(query, {
        maxResults: 5,
        searchDepth: "basic",
        includeAnswer: "basic",
        includeFavicon: true,
        includePublishedDate: true
    });

    return JSON.stringify({
        answer: response.answer ?? null,
        results: (response.results ?? []).map((result) => ({
            title: result.title,
            url: result.url,
            content: result.content,
            score: result.score,
            publishedDate: result.publishedDate ?? null,
            favicon: result.favicon ?? null
        }))
    });
}