# Iran Memorial — MCP Server

Model Context Protocol server that exposes the [<DEPLOYMENT_DOMAIN>](<DEPLOYMENT_URL>) victim database to any MCP-aware LLM (Claude Desktop, Cline, Cursor, ChatGPT-via-MCP, …).

**Public, read-only.** No API key required — hits the public `/api/mcp/*` endpoints.

## What it does

Adds five tools your LLM can call:

| Tool | Purpose |
|---|---|
| `search_victims` | Search by name/place/details, returns matches with profile URLs |
| `get_victim` | Full profile by slug — name, date/place, charges, court, sources, photo |
| `get_executions` | List judicial executions, filterable by method (hanging/shooting/stoning/custody) and year |
| `get_death_row` | List people currently sentenced to death — where international advocacy still matters |
| `get_statistics` | Total counts: victims, events, sources, recent protest executions, death-row size |

## Install (Claude Desktop, macOS)

```bash
git clone https://github.com/iran-memorial26/iran-memorial.git
cd iran-memorial/tools/mcp
npm install
npm run build
```

Then add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "iran-memorial": {
      "command": "node",
      "args": ["/absolute/path/to/iran-memorial/tools/mcp/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop. Try asking:

> "Search the Iran Memorial database for Sasan Azadvar."
> "How many people are currently on death row in Iran?"
> "Show me all hangings recorded in 1988."

## Install (Claude Desktop, Windows / Linux)

Same as above, config file lives at:
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

Use the absolute Windows-style path if on Windows: `"C:\\path\\to\\iran-memorial\\tools\\mcp\\dist\\index.js"`.

## Use with other MCP clients

Any MCP client speaking the standard stdio transport works. Cline / Cursor / Continue.dev all consume the same config schema. Point `command` + `args` at the built `index.js`.

## Environment overrides

| Var | Default | Use |
|---|---|---|
| `IRAN_MEMORIAL_BASE_URL` | `<DEPLOYMENT_URL>` | Point at a local dev server during development. |

## Citation

Data is licensed CC BY-SA 4.0. Please credit "<DEPLOYMENT_DOMAIN> — Iran Memorial Project" when reporting on individual cases or aggregate numbers.

## License

MIT (the MCP server code). The underlying data is CC BY-SA 4.0.
