#!/usr/bin/env node
const express = require('express');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// Base URL of the running website API
const API_URL = process.env.WEBSITE_API_URL || 'http://localhost:3000';
const PORT = process.env.PORT || 3001;

// Format date to YYYY-MM-DD HH:MM:SS
function getFormattedDateTime(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Universal API request handler
async function callApi(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  console.log(`[MCP Server] Calling API: ${options.method || 'GET'} ${url}`);
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { rawResponse: text };
    }

    if (!res.ok) {
      const errorMsg = data.error || data.message || `HTTP ${res.status}`;
      return {
        content: [{
          type: "text",
          text: `API Error: ${errorMsg}\nResponse: ${JSON.stringify(data, null, 2)}`
        }],
        isError: true
      };
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(data, null, 2)
      }]
    };
  } catch (err) {
    return {
      content: [{
        type: "text",
        text: `Network Error contacting API at ${url}. Make sure the website server is running. Detail: ${err.message}`
      }],
      isError: true
    };
  }
}

// Define the tools exposed by this MCP server
const TOOLS_LIST = [
  {
    name: "get_customers",
    description: "Retrieve a list of all registered customers, containing their names, phone numbers, email addresses, and registration dates.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "create_customer",
    description: "Register a new customer. This automatically triggers an immediate waitlist registration email and schedules the follow-up email sequences (Email 2 in 2 days, Email 3 in 3 days).",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Full name of the customer."
        },
        phone: {
          type: "string",
          description: "Customer phone number. Must be a valid Vietnamese phone format (e.g. 0987654321)."
        },
        email: {
          type: "string",
          description: "Customer email address. Used to send immediate waitlist confirmation and schedule email sequence."
        },
        zalo: {
          type: "string",
          description: "Zalo details or contact ID."
        },
        registered_at: {
          type: "string",
          description: "Registration timestamp in format 'YYYY-MM-DD HH:MM:SS'. Defaults to the current date and time if not supplied."
        }
      },
      required: ["name", "phone"]
    }
  },
  {
    name: "update_customer",
    description: "Update details of an existing customer by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "integer",
          description: "Unique Customer ID."
        },
        name: {
          type: "string",
          description: "Customer's full name."
        },
        phone: {
          type: "string",
          description: "Customer phone number in Vietnamese format."
        },
        email: {
          type: "string",
          description: "Customer email address."
        },
        zalo: {
          type: "string",
          description: "Zalo contact info."
        },
        registered_at: {
          type: "string",
          description: "Registration timestamp (YYYY-MM-DD HH:MM:SS)."
        }
      },
      required: ["id", "name", "phone", "registered_at"]
    }
  },
  {
    name: "delete_customer",
    description: "Delete a customer and clean up their associated email queue items from the database.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "integer",
          description: "Unique Customer ID to delete."
        }
      },
      required: ["id"]
    }
  },
  {
    name: "get_products",
    description: "Retrieve a list of all products and services, including name, type (physical, digital, service), price (VND), and remaining stock quantity.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "create_product",
    description: "Create a new product or training package.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the product."
        },
        type: {
          type: "string",
          enum: ["physical", "digital", "service"],
          description: "Product type. Physical products require remaining_quantity."
        },
        price: {
          type: "number",
          description: "Price in VND."
        },
        description: {
          type: "string",
          description: "Short product description."
        },
        remaining_quantity: {
          type: "integer",
          description: "Stock quantity. Mandatory if type is 'physical'."
        }
      },
      required: ["name", "type", "price"]
    }
  },
  {
    name: "get_orders",
    description: "Retrieve a list of all recorded orders and invoices, showing customer name, phone, product details, total amount, status, and creation date.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "create_order",
    description: "Place a new order for a customer. Automatically decreases physical stock if the product is physical, and triggers order invoice confirmation email to the customer's email address.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: {
          type: "integer",
          description: "Customer ID."
        },
        product_id: {
          type: "integer",
          description: "Product ID."
        },
        amount: {
          type: "number",
          description: "Total payment amount in VND."
        },
        status: {
          type: "string",
          enum: ["pending", "completed", "cancelled", "refunded"],
          description: "Order status."
        },
        created_at: {
          type: "string",
          description: "Order creation timestamp in format 'YYYY-MM-DD HH:MM:SS'. Defaults to current time if not supplied."
        }
      },
      required: ["customer_id", "product_id", "amount", "status"]
    }
  },
  {
    name: "get_email_queue",
    description: "Retrieve the current email sequence queue, showing scheduled times, status (pending, sent, failed), and error messages if any.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "process_emails",
    description: "Manually trigger the local email sequence worker to scan and send any due pending emails immediately.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  }
];

// Handles tool calls by mapping them to API requests
async function callTool(name, args = {}) {
  console.log(`[MCP Server] Handling tool call: ${name}`);
  switch (name) {
    case "get_customers":
      return await callApi('/api/customers');

    case "create_customer":
      if (!args.registered_at) {
        args.registered_at = getFormattedDateTime();
      }
      return await callApi('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });

    case "update_customer":
      return await callApi(`/api/customers/${args.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });

    case "delete_customer":
      return await callApi(`/api/customers/${args.id}`, {
        method: 'DELETE'
      });

    case "get_products":
      return await callApi('/api/products');

    case "create_product":
      return await callApi('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });

    case "get_orders":
      return await callApi('/api/orders');

    case "create_order":
      if (!args.created_at) {
        args.created_at = getFormattedDateTime();
      }
      return await callApi('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });

    case "get_email_queue":
      return await callApi('/api/email-queue');

    case "process_emails":
      return await callApi('/api/cron');

    default:
      throw new Error(`Tool not found: ${name}`);
  }
}

// Instantiate the MCP server
const server = new Server({
  name: "cothien-website-mcp",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {}
  }
});

// Set up handlers in the MCP Server
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS_LIST
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await callTool(name, args);
    return result;
  } catch (err) {
    return {
      content: [{
        type: "text",
        text: `Error executing tool '${name}': ${err.message}`
      }],
      isError: true
    };
  }
});

// Setup Express server to host the SSE transport
const app = express();
app.use(express.json());

const transports = new Map();

// Establish the SSE connection
app.get('/sse', async (req, res) => {
  console.log(`[MCP Server] New SSE connection request`);
  const transport = new SSEServerTransport('/messages', res);
  transports.set(transport.sessionId, transport);
  
  await server.connect(transport);
  console.log(`[MCP Server] Connected session: ${transport.sessionId}`);
  
  req.on('close', () => {
    console.log(`[MCP Server] Session disconnected: ${transport.sessionId}`);
    transports.delete(transport.sessionId);
  });
});

// Receive messages from the client
app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports.get(sessionId);
  
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    console.warn(`[MCP Server] Message posted to invalid sessionId: ${sessionId}`);
    res.status(404).send("Session not found");
  }
});

// Health check endpoint (satisfies the user's curl check)
app.get('/mcp', (req, res) => {
  res.json({
    status: "healthy",
    server: "cothien-website-mcp",
    transport: "sse",
    endpoints: {
      sse: "/sse",
      messages: "/messages"
    }
  });
});

// Redirect root to /mcp
app.get('/', (req, res) => {
  res.redirect('/mcp');
});

// Start listening
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP SSE Server listening at http://0.0.0.0:${PORT}`);
});
