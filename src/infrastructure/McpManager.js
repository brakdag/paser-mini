import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fsp from "fs/promises";
import path from "path";
import logger from "../core/logger.js";

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
    const configPath = path.join(process.cwd(), "mcp.json");
    
    try {
      const configContent = await fsp.readFile(configPath, "utf8");
      const config = JSON.parse(configContent);
      
      if (!config.mcpServers) {
        logger.info("[McpManager] No 'mcpServers' defined in mcp.json. Skipping initialization.");
        return;
      }

      await Promise.all(
        Object.entries(config.mcpServers).map(async ([serverName, serverConfig]) => {
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
   * Connects to a single MCP server, performs the handshake, and registers its tools.
   * @param {string} serverName - The logical name of the server from mcp.json.
   * @param {object} serverConfig - The configuration object (command, args).
   * @returns {Promise<void>}
   */
  async connectServer(serverName, serverConfig) {
    try {
      logger.info(`[McpManager] Spawning MCP server: ${serverName}...`);
      
      const transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args || [],
      });

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
          const namespacedToolName = `mcp_${serverName}_${tool.name}`;
          
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
