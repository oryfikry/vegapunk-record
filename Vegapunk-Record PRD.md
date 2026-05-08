# **Product Requirements Document (PRD): Vegapunk-Record**

**Date:** May 8, 2026  
**Status:** Draft

## **1\. Executive Summary**

**Vegapunk-Record** is a lightweight, centralized knowledge hub and multi-agent observability platform. Inspired by the "Punk Records" concept from One Piece, it features a central server ("Stella") that acts as the main brain, coordinating and storing the experiences of multiple specialized sub-agents ("Satellites"). Built entirely on the Bun \+ Elysia ecosystem using the Model Context Protocol (MCP), it prioritizes developer velocity, low overhead, and seamless LLM interoperability.

## **2\. System Architecture**

The system relies on a unified Bun/TypeScript stack, deployed via Docker.

* **Stella (Main Server):** A Bun \+ Elysia backend handling MCP connections over Server-Sent Events (SSE). It serves the dashboard and orchestrates database reads/writes.  
* **Satellites (Clients):** Lightweight Bun scripts acting as specialized MCP clients (e.g., Lilith the Coder, Shaka the Researcher). They run the ReAct loop and outsource inference to the configured LLMs.  
* **LLM Router:** Dynamic routing supporting OpenRouter (for free models), direct cloud APIs (Gemini/OpenAI), and local LAN endpoints (Ollama).  
* **Punk Records (Storage):** A dual-hemisphere memory system combining relational state tracking and semantic vector storage.

## **3\. Database Schema (Punk Records)**

### **3.1. Left Brain: SQLite (State & Metadata)**

Managed natively via bun:sqlite. Handles strict operational data.

| Table Name | Columns | Description |
| :---- | :---- | :---- |
| agents | id, name, role, status, custom\_llm | Tracks the registered Satellites and their current operational state. |
| tasks | task\_id, assigned\_to, status, description | Global to-do list assigned by Stella to the Satellites. |
| configs | key, value, type | Stores API keys, base URLs, and system settings securely. |

### **3.2. Right Brain: ChromaDB (Vector Knowledge)**

Running as a standalone Docker container alongside Stella. Handles semantic embeddings for RAG.

* **ephemeral\_memory:** Short-term scratchpad for in-progress tasks and inter-agent communication.  
* **core\_knowledge:** Long-term storage for finalized schemas, code snippets, and validated research.  
* **activity\_logs:** Raw telemetry and actions taken by agents, used for "What happened?" queries.

## **4\. Core Capabilities & MCP Tools**

Stella exposes specific tools to the Satellites via the MCP SDK.

* **sync\_to\_records:** Ingests content (text/code), generates embeddings, and saves to ChromaDB with authorship metadata.  
* **query\_records:** Semantic search function allowing agents to retrieve historical context.  
* **update\_task\_status:** Updates the SQLite task queue, instantly reflecting on the dashboard.  
* **Nightly Sleep Routine:** An automated background job that summarizes raw activity\_logs into core\_knowledge and flushes ephemeral memory to prevent "brain rot".

## **5\. User Interface (The Dashboard)**

Served as a static HTML file by Elysia, utilizing Alpine.js and Tailwind CSS for reactivity without a build step.

* **Agent Control Panel:** Toggle switches to activate/deactivate Satellites (Lilith, Shaka, etc.) and view live statuses.  
* **Stella Interface:** A central chat window to prompt the Main Brain directly.  
* **Knowledge Stream:** A live, scrolling terminal view of data being synced to Punk Records.  
* **Settings Modal:** UI to configure default OpenRouter models and manage custom API endpoints (e.g., local Ollama URLs).

## **6\. Tech Stack Requirements**

`- Runtime: Bun`  
`- Framework: ElysiaJS`  
`- Protocol: Model Context Protocol (MCP SDK for TypeScript)`  
`- Frontend: Alpine.js + Tailwind CSS`  
`- Databases: SQLite (Native Bun), ChromaDB (Docker)`  
`- LLM Integrations: OpenRouter, Google Gemini, OpenAI, Ollama`  
    