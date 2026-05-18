#!/usr/bin/env node
/**
 * Iran Memorial — MCP Server
 *
 * Exposes the Iran Memorial read-only API as MCP tools so
 * any MCP-aware LLM (Claude Desktop, Cline, Cursor, ChatGPT-via-MCP, …)
 * can search and cite victim records directly.
 *
 * No authentication required: hits the public /api/mcp/* endpoints.
 *
 * Usage:
 *   1. npm install && npm run build
 *   2. Add to Claude Desktop config (see README.md).
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const BASE_URL = process.env.IRAN_MEMORIAL_BASE_URL ?? (() => { throw new Error("Set IRAN_MEMORIAL_BASE_URL to your memorial deployment URL"); })();
const USER_AGENT = "iran-memorial-mcp/0.1";

async function fetchJson(path: string): Promise<unknown> {
  const r = await fetch(`${BASE_URL}${path}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!r.ok) {
    throw new Error(`HTTP ${r.status} ${r.statusText} for ${path}`);
  }
  return r.json();
}

const server = new Server(
  { name: "iran-memorial", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

// ───────────────── Tool definitions ─────────────────

const TOOLS = [
  {
    name: "search_victims",
    description:
      "Full-text search of the Iran Memorial victim database by name, place, or details. Returns up to N matches with slug, name, date and place of death, and a profile URL.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term (≥ 2 characters). Latin or Farsi script." },
        limit: { type: "number", description: "Max results (1–50). Default 20.", default: 20 },
      },
      required: ["query"],
    },
  },
  {
    name: "get_victim",
    description:
      "Fetch the full profile of a single victim by their slug (e.g. 'azadvar-sasan-2005'). Returns name, dates, place, cause, circumstances, responsible court/forces, sources, photo URL.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Victim slug as shown in the URL." },
      },
      required: ["slug"],
    },
  },
  {
    name: "get_executions",
    description:
      "List documented judicial executions, optionally filtered by method (hanging/shooting/stoning/custody/other) and year. Useful for asking 'who was executed in 1988' or 'all hangings in 2026'.",
    inputSchema: {
      type: "object",
      properties: {
        method: {
          type: "string",
          enum: ["hanging", "shooting", "stoning", "custody", "other"],
          description: "Execution method filter.",
        },
        year: { type: "number", description: "Year filter (1979–present)." },
        page: { type: "number", description: "Page number (1-based). Default 1.", default: 1 },
        limit: { type: "number", description: "Page size (1–100). Default 25.", default: 25 },
      },
    },
  },
  {
    name: "get_death_row",
    description:
      "List people currently sentenced to death and awaiting execution in Iran. These are the cases where international advocacy can still save lives. Returns names, charges, prison location, profile URL.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number. Default 1.", default: 1 },
        limit: { type: "number", description: "Page size (1–100). Default 50.", default: 50 },
      },
    },
  },
  {
    name: "get_statistics",
    description:
      "Top-level memorial statistics: total victims documented, events, sources, years covered, current death-row count, and protesters executed since March 2026.",
    inputSchema: { type: "object", properties: {} },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// ───────────────── Tool implementations ─────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case "search_victims": {
        const q = String(args?.query || "");
        const limit = Number(args?.limit) || 20;
        result = await fetchJson(`/api/mcp/search?q=${encodeURIComponent(q)}&limit=${limit}`);
        break;
      }
      case "get_victim": {
        const slug = String(args?.slug || "");
        if (!slug) throw new Error("slug is required");
        result = await fetchJson(`/api/mcp/victims/${encodeURIComponent(slug)}`);
        break;
      }
      case "get_executions": {
        const params = new URLSearchParams();
        if (args?.method) params.set("method", String(args.method));
        if (args?.year) params.set("year", String(args.year));
        if (args?.page) params.set("page", String(args.page));
        if (args?.limit) params.set("limit", String(args.limit));
        const qs = params.toString();
        result = await fetchJson(`/api/mcp/executions${qs ? `?${qs}` : ""}`);
        break;
      }
      case "get_death_row": {
        const params = new URLSearchParams();
        if (args?.page) params.set("page", String(args.page));
        if (args?.limit) params.set("limit", String(args.limit));
        const qs = params.toString();
        result = await fetchJson(`/api/mcp/death-row${qs ? `?${qs}` : ""}`);
        break;
      }
      case "get_statistics": {
        result = await fetchJson("/api/mcp/statistics");
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (exc) {
    const msg = exc instanceof Error ? exc.message : String(exc);
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${msg}` }],
    };
  }
});

// ───────────────── Wire up stdio transport ─────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[iran-memorial-mcp] running, base=${BASE_URL}`);
