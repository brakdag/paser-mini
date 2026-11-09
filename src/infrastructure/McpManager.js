import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
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
   * @param {object} [options] - Injectable transport dependencies.
   * @param {(options: object) => object} [options.createStdioTransport] - Factory for local server transports.
   * @param {string} [options.configPath] - Configuration path for this project.
   */
  constructor({
    createStdioTransport = (options) => new StdioClientTransport(options),
    configPath = path.join(process.cwd(), ".paser-mini", "config", "mcp.json"),
  } = {}) {
    this.createStdioTransport = createStdioTransport;
    this.configPath = configPath;
    this.clients = new Map();
    this.registrations = new Map();
    this.pending = Promise.resolve();
    this.tools = {};
    this.schemas = {};
  }

  /**
   * Initializes the manager by reading mcp.json and connecting to all configured servers.
   * @returns {Promise<void>}
   */
  initialize() {
    return this._enqueue(async () => {
      let servers;
      try {
        const config = JSON.parse(await fsp.readFile(this.configPath, "utf8"));
        servers = config.mcpServers || {};
        if (typeof servers !== "object" || Array.isArray(servers)) {
          throw new Error("mcpServers must be an object");
        }
      } catch (err) {
        if (err.code !== "ENOENT") {
          logger.error(`[McpManager] Failed to read MCP configuration: ${err.message}`);
          return;
        }
        servers = {};
      }
      // Reconcile removals, disabled servers and changed connection settings first.
      await Promise.all(Array.from(this.clients.keys()).map(async (name) => {
        const config = servers[name];
        if (!config || config.enabled === false ||
            this.registrations.get(name)?.config !== JSON.stringify(this._resolveEnvVars(config))) {
          await this._disconnectServer(name);
        }
      }));
      // Stable configuration order also makes collision diagnostics deterministic.
      const entries = Object.entries(servers);
      for (let index = 0; index < entries.length; index += 1) {
        const [name, config] = entries[index];
        if (config && config.enabled !== false) await this._connectServer(name, config);
      }
    });
  }

  /**
   * Serializes lifecycle changes so discovery cannot publish after a disconnect.
   * @param {() => Promise<void>} operation - Lifecycle operation to perform.
   * @returns {Promise<void>} Completion of this operation.
   * @private
   */
  _enqueue(operation) {
    const result = this.pending.then(operation);
    this.pending = result.catch(() => {});
    return result;
  }

  /**
   * Removes exactly the tools owned by this connection.
   * @param {string} serverName - Registered server name.
   * @private
   */
  _removeRegistration(serverName) {
    const registration = this.registrations.get(serverName);
    if (registration) {
      registration.names.forEach((name) => {
        delete this.tools[name];
        delete this.schemas[name];
      });
    }
    this.registrations.delete(serverName);
    this.clients.delete(serverName);
  }

  /**
   * Disconnects a server and invalidates even previously copied tool functions.
   * @param {string} serverName - Logical server name.
   * @returns {Promise<void>} Completion of cleanup.
   */
  disconnectServer(serverName) {
    return this._enqueue(() => this._disconnectServer(serverName));
  }

  /**
   * Removes registration before attempting transport cleanup, even if close fails.
   * @param {string} serverName - Logical server name.
   * @returns {Promise<void>} Completion of cleanup.
   * @private
   */
  async _disconnectServer(serverName) {
    const client = this.clients.get(serverName);
    this._removeRegistration(serverName);
    if (!client) return;
    try {
      await client.close();
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
  connectServer(serverName, serverConfig) {
    return this._enqueue(() => this._connectServer(serverName, serverConfig));
  }

  /**
   * Publishes a connection only after complete discovery and collision validation.
   * @param {string} serverName - Logical server name.
   * @param {object} serverConfig - Transport configuration.
   * @returns {Promise<void>} Completion of connection attempt.
   * @private
   */
  async _connectServer(serverName, serverConfig) {
    if (this.clients.has(serverName) || serverConfig.enabled === false) return;
    let client;
    let transport;
    try {
      const resolvedConfig = this._resolveEnvVars(serverConfig);
      const safeServerName = serverName.replace(/[^a-zA-Z0-9_]/g, "_");
      if (Array.from(this.registrations.values()).some((entry) => entry.safeName === safeServerName)) {
        throw new Error(`Normalized MCP server name collision: ${safeServerName}`);
      }
      
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
        
        transport = this.createStdioTransport({
          command: resolvedConfig.command,
          args: resolvedConfig.args || [],
          env: resolvedConfig.env,
          stderr: "pipe",
        });

        transport.stderr.on("data", (chunk) => {
          const msg = chunk.toString().trim();
          if (msg) logger.warn(`[MCP:${serverName}] ${msg}`);
        });
      }

      client = new Client(
        { name: `paser-mini-${serverName}`, version: "1.0.0" },
        { capabilities: {} }
      );

      let closed = false;
      /** Removes the catalog when the SDK reports a closed connection. */
      client.onclose = () => {
        closed = true;
        if (this.clients.get(serverName) === client) this._removeRegistration(serverName);
      };
      await client.connect(transport);
      const toolsResponse = await client.listTools();
      const discovered = toolsResponse?.tools;
      if (!Array.isArray(discovered)) throw new Error("Invalid MCP tool discovery response");
      const tools = {};
      const schemas = {};
      discovered.forEach((tool) => {
        const safeToolName = tool.name.replace(/[^a-zA-Z0-9_]/g, "_");
        const name = `mcp_${safeServerName}_${safeToolName}`;
        if (Object.hasOwn(tools, name) || Object.hasOwn(this.tools, name)) {
          throw new Error(`Normalized MCP tool name collision: ${name}`);
        }
        /**
         * Executes only while the discovering connection remains registered.
         * @param {object} args - Remote tool arguments.
         * @returns {Promise<string>} Text blocks from the remote result.
         */
        tools[name] = async (args) => {
          if (this.clients.get(serverName) !== client) {
            throw new Error(`MCP server '${serverName}' is disconnected`);
          }
          const result = await client.callTool({ name: tool.name, arguments: args });
          return result.content.map((c) => c.text || "").join("\n");
        };
        schemas[name] = tool.inputSchema;
      });
      if (closed) throw new Error("MCP connection closed during discovery");
      this.clients.set(serverName, client);
      this.registrations.set(serverName, {
        names: Object.keys(tools), safeName: safeServerName, config: JSON.stringify(resolvedConfig),
      });
      Object.assign(this.tools, tools);
      Object.assign(this.schemas, schemas);
    } catch (err) {
      logger.error(`[McpManager] Failed to connect to ${serverName}: ${err.message}`);
      try {
        if (client) await client.close();
        else if (transport) await transport.close();
      } catch (closeError) {
        logger.warn(`[McpManager] Failed to clean up ${serverName}: ${closeError.message}`);
      }
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
  shutdown() {
    return this._enqueue(() => Promise.all(
      Array.from(this.clients.keys()).map((name) => this._disconnectServer(name))
    ));
  }
}

const mcpManager = new McpManager();
export { McpManager };
export default mcpManager;
