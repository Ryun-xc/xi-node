# MCP Server

XI Node exposes a small local MCP server over stdio.

Start the HTTP host first, then:

```bash
npm run mcp
```

Environment:

```text
XI_NODE_URL   default http://127.0.0.1:8787
XI_NODE_TOKEN access token
XI_NODE_DATA  data directory containing access-token
```

Tools:

```text
xi_memory_query
xi_goal_list
xi_task_list
xi_timeline_read
xi_knowledge_search
```

The MCP server is read-only. It does not create goals, write memory, or execute actions.

Example MCP client configuration:

```json
{
  "mcpServers": {
    "xi-node": {
      "command": "node",
      "args": ["K:/path/to/xi-node/server/mcp-server.mjs"],
      "env": {
        "XI_NODE_URL": "http://127.0.0.1:8787",
        "XI_NODE_DATA": "K:/path/to/xi-node/data"
      }
    }
  }
}
```