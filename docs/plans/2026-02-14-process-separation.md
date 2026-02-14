# Process Separation & Redis Integration Plan

> **For Trae:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Decouple the Gateway (HTTP Server) and Agent (Logic) into separate processes using Redis for communication, enhancing stability and scalability.

**Architecture:** 
- Current: Gateway + Agent in one process, memory bus.
- New: 
  - `nanobot gateway`: Only HTTP server + Redis Producer.
  - `nanobot agent`: Only Logic Loop + Redis Consumer.
  - Communication: Redis Pub/Sub (`nanobot:inbound`, `nanobot:outbound`).

**Tech Stack:** TypeScript, ioredis, Node.js

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install ioredis**

Run: `npm install ioredis`

**Step 2: Install types**

Run: `npm install --save-dev @types/ioredis`

---

### Task 2: Config Update

**Files:**
- Modify: `src/core/config.ts`

**Step 1: Add Redis config schema**

Add `redis` object to `ConfigSchema`:
```typescript
  redis: z.object({
    enabled: z.boolean().default(false),
    host: z.string().default('localhost'),
    port: z.number().default(6379),
    password: z.string().optional(),
    db: z.number().default(0),
  }).default({}),
```

**Step 2: Update Config interface**

Ensure TypeScript picks up the new schema.

---

### Task 3: Message Bus Refactoring (Interface)

**Files:**
- Create: `src/core/bus-adapter.ts`
- Modify: `src/core/bus.ts`

**Step 1: Define Adapter Interface**

Create `src/core/bus-adapter.ts`:
```typescript
import { Message } from './bus.js';

export interface BusAdapter {
  publish(message: Message): Promise<void>;
  subscribe(callback: (message: Message) => void): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
```

**Step 2: Implement Memory Adapter**

Create `src/core/bus-memory.ts` implementing `BusAdapter` using `EventEmitter` logic from current `bus.ts`.

---

### Task 4: Redis Adapter Implementation

**Files:**
- Create: `src/core/bus-redis.ts`

**Step 1: Implement Redis Adapter**

Create `src/core/bus-redis.ts`:
- Use `ioredis`.
- Need two connections: one for publishing, one for subscribing.
- Implement `publish` -> `redis.publish('nanobot:bus', JSON.stringify(msg))`.
- Implement `subscribe` -> `subRedis.subscribe('nanobot:bus'); subRedis.on('message', ...)`

---

### Task 5: Integrate Adapter into MessageBus

**Files:**
- Modify: `src/core/bus.ts`

**Step 1: Make MessageBus use Adapter**

- In `getInstance()`, check `config.redis.enabled`.
- If true, instantiate `RedisAdapter`.
- If false, instantiate `MemoryAdapter`.
- Delegate `publish` and `onMessage` to adapter.

---

### Task 6: CLI Separation

**Files:**
- Modify: `src/index.ts`

**Step 1: Update Gateway Command**

Add `--no-agent` flag to `gateway` command.
If set, do NOT start `AgentLoop`.

**Step 2: Update Agent Command**

Add `--daemon` flag to `agent` command.
If set, start `AgentLoop` and keep running (listening to Bus).

---

### Task 7: Verification

**Files:**
- Test: Manual verification

**Step 1: Start Gateway (Web)**
`npm run dev -- gateway --no-agent`

**Step 2: Start Agent (Logic)**
`npm run dev -- agent --daemon`

**Step 3: Send Message**
Trigger a WeCom message and verify flow: Gateway -> Redis -> Agent -> Processing -> Agent -> API.
