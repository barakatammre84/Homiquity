// MUST be the first import of the MCP entrypoint. A stdio MCP server owns
// stdout for JSON-RPC frames — any stray console.log from the imported app
// modules would corrupt the protocol stream. Route console.log to stderr.
console.log = console.error.bind(console);

import "dotenv/config"; // standalone process: load .env like the dev server does
