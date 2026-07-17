import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import fsp from "fs/promises";
import path from "path";
import logger from "../core/logger.js";
import APP_ROOT from "../utils/appRoot.js";

/**
 * McpManager orchestrates the lifecycle and communication of external MCP servers.
 * It reads the standard MCP configuration, spawns child processes, discovers tools,
 * and exposes them in a format compatible with the Paser Mini execution engine.
 */
class McpManager {
  /**
   * Initializes the McpManager with empty maps for clients, tools, and schemas.
   */
  constructor() {
    this.clients = new Map();
    this.tools = {};
    this.schemas = {};
  }

  /**
   * Initializes the manager by reading mcp.json and connecting to all configured servers.
   * @returns {Promise<void>}
   */
  async initialize() {
    const configPath = path.join(APP_ROOT, "mcp.json");
    
    try {
      const configContent = await fsp.readFile(configPath, "utf8");
      const config = JSON.parse(configContent);
      
      if (!config.mcpServers) {
        logger.info("[McpManager] No 'mcpServers' defined in mcp.json. Skipping initialization.");
        return;
      }

      await Promise.all(
        Object.entries(config.mcpServers).map(async ([serverName, serverConfig]) => {
          if (this.clients.has(serverName)) return; // Idempotency check
          if (serverConfig.enabled === false) {
            logger.info(`[McpManager] Server '${serverName}' is disabled. Skipping.`);
            return;
          }
          await this.connectServer(serverName, serverConfig);
        })
      );
    } catch (err) {
      if (err.code === "ENOENT") {
        logger.info("[McpManager] No mcp.json found. Running without external MCP tools.");
      } else {
        logger.error(`[McpManager] Failed to initialize MCP servers: ${err.message}`);
      }
    }
  }

  /**
   * Gracefully terminates a specific MCP server connection and removes its tools.
   * @param {string} serverName - The logical name of the server.
   * @returns {Promise<void>}
   */
  async disconnectServer(serverName) {
    const client = this.clients.get(serverName);
    if (!client) return;

    const safeServerName = serverName.replace(/[^a-zA-Z0-9_]/g, '_');
    const prefix = `mcp_${safeServerName}_`;

    // Remove tools and schemas
    Object.keys(this.tools).forEach((toolName) => {
      if (toolName.startsWith(prefix)) {
        delete this.tools[toolName];
        delete this.schemas[toolName];
      }
    });

    try {
      await client.close();
      this.clients.delete(serverName);
      logger.info(`[McpManager] Disconnected from ${serverName}.`);
    } catch (err) {
      logger.warn(`[McpManager] Error disconnecting from ${serverName}: ${err.message}`);
    }
  }

  /**
   * Recursively resolves ${ENV_VAR} patterns in strings using process.env.
   * @param {string | object | unknown[]} value - Any config value.
   * @returns {string | object | unknown[]} The resolved value.
   * @private
   */
  _resolveEnvVars(value) {
    if (typeof value === "string") {
      return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
        const resolved = process.env[varName];
        if (resolved === undefined) {
          logger.warn(`[McpManager] Environment variable '${varName}' is not set. Leaving literal.`);
          return match;
        }
        return resolved;
      });
    }
    if (Array.isArray(value)) {
      return value.map((v) => this._resolveEnvVars(v));
    }
    if (value !== null && typeof value === "object") {
      return Object.entries(value).reduce((acc, [k, v]) => {
        acc[k] = this._resolveEnvVars(v);
        return acc;
      }, {});
    }
    return value;
  }

  /**
   * Connects to a single MCP server, performs the handshake, and registers its tools.
   * Supports both Stdio (local processes) and Streamable HTTP (remote servers).
   * @param {string} serverName - The logical name of the server from mcp.json.
   * @param {object} serverConfig - The configuration object.
   * @returns {Promise<void>}
   */
  async connectServer(serverName, serverConfig) {
    try {
      const resolvedConfig = this._resolveEnvVars(serverConfig);
      let transport;
      
      if (resolvedConfig.type === "http" && resolvedConfig.url) {
        logger.info(`[McpManager] Connecting to HTTP MCP server: ${serverName} at ${resolvedConfig.url}...`);
        
        const requestInit = {};
        if (resolvedConfig.headers) {
          requestInit.headers = resolvedConfig.headers;
        }
        
        transport = new StreamableHTTPClientTransport(
          new URL(resolvedConfig.url),
          { requestInit }
        );
      } else {
        logger.info(`[McpManager] Spawning stdio MCP server: ${serverName}...`);
        
        transport = new StdioClientTransport({
          command: resolvedConfig.command,
          args: resolvedConfig.args || [],
          stderr: "pipe",
        });

        transport.stderr.on("data", (chunk) => {
          const msg = chunk.toString().trim();
          if (msg) logger.warn(`[MCP:${serverName}] ${msg}`);
        });
      }

      const client = new Client(
        { name: `paser-mini-${serverName}`, version: "1.0.0" },
        { capabilities: {} }
      );

      await client.connect(transport);
      this.clients.set(serverName, client);
      
      logger.info(`[McpManager] Connected to ${serverName}. Discovering tools...`);
      
      const toolsResponse = await client.listTools();
      
      if (toolsResponse && toolsResponse.tools) {
        toolsResponse.tools.forEach((tool) => {
          const safeServerName = serverName.replace(/[^a-zA-Z0-9_]/g, '_');
          const namespacedToolName = `mcp_${safeServerName}_${tool.name}`;
          
          /**
           * Executes the remote tool via the MCP client.
           * @param {object} args - Arguments matching the tool's input schema.
           * @returns {Promise<string>} The concatenated text content of the tool's response.
           * @private
           */
          this.tools[namespacedToolName] = async (args) => {
            const result = await client.callTool({ name: tool.name, arguments: args });
            return result.content.map((c) => c.text || "").join("\n");
          };
          
          // Store the raw JSON Schema for the schemaRegistry
          this.schemas[namespacedToolName] = tool.inputSchema;
          
          logger.info(`[McpManager] Registered tool: ${namespacedToolName}`);
        });
      }
    } catch (err) {
      logger.error(`[McpManager] Failed to connect to ${serverName}: ${err.message}`);
    }
  }

  /**
   * Retrieves the dynamically discovered tools in the format expected by the registry.
   * @returns {object} A map of tool names to async functions.
   */
  getTools() {
    return this.tools;
  }

  /**
   * Retrieves the dynamically discovered JSON schemas.
   * @returns {object} A map of tool names to JSON schemas.
   */
  getSchemas() {
    return this.schemas;
  }

  /**
   * Gracefully terminates all MCP server connections.
   * @returns {Promise<void>}
   */
  async shutdown() {
    const clientEntries = Array.from(this.clients.entries());
    await Promise.all(
      clientEntries.map(async ([name, client]) => {
        try {
          await client.close();
          logger.info(`[McpManager] Closed connection with ${name}`);
        } catch (err) {
          logger.warn(`[McpManager] Error closing ${name}: ${err.message}`);
        }
      })
    );
  }
}

const mcpManager = new McpManager();
export default mcpManager;
