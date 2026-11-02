/**
 * licensefile MCP server. Tools: catalog_licenses.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys
 * not in this tool's defined spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schema as an explicit literal, and every
 * tools/call is validated by the core, which names the
 * offending path on invalid input.
 *
 * The cataloging is pure local computation: no upstream API,
 * no authentication, no configuration.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { catalogLicenses, formatPayload, VERSION } from "./licensefile.js";

const TOOLS = [
  {
    name: "catalog_licenses",
    description:
      "Build a dependency license and attribution inventory for a repository: normalize each dependency license, group counts by license, produce attribution lines, and flag unknown licenses, strong-copyleft conflicts with the repository license, weak-copyleft notices, and unclassified licenses.",
    inputSchema: {
      type: "object" as const,
      properties: {
        repo_license: {
          type: "string",
          description: "SPDX id of the repository's own license, e.g. MIT",
        },
        dependencies: {
          type: "array",
          description: "Dependencies to catalog (at least one)",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Dependency name" },
              version: {
                type: "string",
                description: "Dependency version (optional)",
              },
              license: {
                type: "string",
                description:
                  "SPDX id of the dependency license (optional; missing or empty means unknown)",
              },
              author: {
                type: "string",
                description: "Dependency author (optional)",
              },
              homepage: {
                type: "string",
                description: "Dependency homepage (optional)",
              },
            },
            required: ["name"],
          },
        },
      },
      required: ["repo_license", "dependencies"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "licensefile", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let out: unknown;
    if (name === "catalog_licenses") {
      const raw = (args ?? {}) as Record<string, unknown>;
      out = catalogLicenses(raw.repo_license, raw.dependencies);
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
