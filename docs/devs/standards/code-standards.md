# Code Standards

This document defines the coding standards for the Erledigen project. These standards are **enforced automatically** through TypeScript compiler settings, Biome linting, and code reviews.

## Philosophy

Our code should be:
- **Explicit over implicit**: Make intent clear through explicit types and names
- **Readable over clever**: Code is read far more often than written
- **Safe over convenient**: Type safety prevents bugs at compile time
- **Self-documenting**: Good names and structure reduce the need for comments

---

## 1. Type Safety Standards

### 1.1 Zero `any` Types

**Rule**: Never use the `any` type (neither implicit nor explicit).

**Why**: `any` defeats the purpose of TypeScript and allows type errors to slip through.

```typescript
// (x) BAD
function processData(data: any) {
  return data.value
}

const result: any = fetchData()

// [OK] GOOD
function processData(data: { value: string }): string {
  return data.value
}

const result: Task[] = fetchData()
```

**Exceptions**: Use `unknown` for truly unknown types, then narrow with type guards.

```typescript
// [OK] Using unknown with type guards
function handleError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'An unknown error occurred'
}
```

### 1.2 Explicit Return Types

**Rule**: All functions MUST have explicit return type annotations.

**Why**:
- Prevents accidental type changes from propagating
- Makes function contracts clear
- Catches return statement errors

```typescript
// (x) BAD - inferred return type
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0)
}

// [OK] GOOD - explicit return type
function calculateTotal(items: Item[]): number {
  return items.reduce((sum: number, item: Item): number => sum + item.price, 0)
}

// [OK] GOOD - explicit void
function logMessage(message: string): void {
  console.log(message)
}

// [OK] GOOD - explicit Promise type
async function fetchUser(id: string): Promise<User> {
  const response: Response = await fetch(`/api/users/${id}`)
  return response.json() as Promise<User>
}
```

### 1.3 Explicit Type Annotations on Variables

**Rule**: Add explicit type annotations on variables where the type is not immediately obvious.

```typescript
// (x) BAD - unclear type
const config = getConfig()

// [OK] GOOD - explicit type
const config: AppConfig = getConfig()

// [OK] OK - type is obvious from literal
const port: number = 3000
const name: string = 'Erledigen'

// [OK] OK - type is obvious from constructor
const date: Date = new Date()
const tasks: Task[] = []
```

### 1.4 Type Assertions

**Rule**: Avoid type assertions unless absolutely necessary. When used, document WHY.

```typescript
// (x) BAD - unnecessary assertion
const user: User = response as User

// [OK] GOOD - narrow with type guard instead
function isUser(value: unknown): value is User {
  return typeof value === 'object' && value !== null && 'id' in value
}

if (isUser(response)) {
  const user: User = response // No assertion needed
}

// [OK] ACCEPTABLE - necessary for external API with comment
// Bun's native API doesn't provide correct types for json()
const data: Task = (await request.json()) as Promise<Task>
```

### 1.5 Strict Null Checking

**Rule**: Handle `null` and `undefined` explicitly. Never use non-null assertions (`!`) without justification.

```typescript
// (x) BAD - non-null assertion without justification
function getUsername(user: User | null): string {
  return user!.name
}

// [OK] GOOD - explicit null handling
function getUsername(user: User | null): string {
  if (user === null) {
    throw new Error('User cannot be null')
  }
  return user.name
}

// [OK] GOOD - optional chaining with fallback
function getUsername(user: User | null): string {
  return user?.name ?? 'Anonymous'
}
```

---

## 2. Code Style Standards

### 2.1 Descriptive Naming

**Rule**: Names should be descriptive and explicit. Clarity always wins over brevity.

```typescript
// (x) BAD - too terse
const usr = getUsr(id)
const temp = calc(a, b)
const res = await fetch(url)

// [OK] GOOD - descriptive
const user: User = getUserById(id)
const temperature: number = calculateTemperature(celsius, fahrenheit)
const response: Response = await fetch(url)
```

### 2.2 Function Names

**Rule**: Function names should be verbs or verb phrases that describe what they do.

```typescript
// (x) BAD
function user(id: string): User { }
function data(): Task[] { }
function validation(input: string): boolean { }

// [OK] GOOD
function getUserById(id: string): User { }
function getAllTasks(): Task[] { }
function validateInput(input: string): boolean { }
function isValidEmail(email: string): boolean { }
```

### 2.3 Boolean Variables and Functions

**Rule**: Boolean names should be predicates (is/has/can/should prefix).

```typescript
// (x) BAD
const active: boolean = true
const permissions: boolean = checkPermissions()
function valid(input: string): boolean { }

// [OK] GOOD
const isActive: boolean = true
const hasPermissions: boolean = checkPermissions()
function isValid(input: string): boolean { }
function hasRequiredFields(data: object): boolean { }
function canEditTask(user: User, task: Task): boolean { }
```

### 2.4 Constants

**Rule**: Constants should be UPPER_SNAKE_CASE only for truly global constants. Use camelCase for module-level constants.

```typescript
// [OK] GOOD - global constants
const MAX_RETRY_ATTEMPTS: number = 3
const DEFAULT_TIMEOUT_MS: number = 5000

// [OK] GOOD - module-level constants
const defaultPort: number = 4000
const apiBaseUrl: string = 'https://api.example.com'
```

---

## 3. Naming Conventions

### 3.1 No Interface Prefix

**Rule**: Never use `I` prefix for interfaces.

**Why**: Interfaces represent the abstraction, not the implementation. They shouldn't be marked differently.

```typescript
// (x) BAD
interface IUser {
  id: string
  name: string
}

interface ITaskRepository {
  findAll(): Promise<Task[]>
}

// [OK] GOOD
interface User {
  id: string
  name: string
}

interface TaskRepository {
  findAll(): Promise<Task[]>
}
```

### 3.2 Abbreviations Use camelCase

**Rule**: Multi-word abbreviations should use camelCase, not UPPERCASE.

**Why**: ALL_CAPS abbreviations reduce readability in camelCase/PascalCase contexts.

```typescript
// (x) BAD
const myAPI = createAPI()
const HTTPClient = new Client()
const parseURL = (input: string) => { }
const userID = '123'

// [OK] GOOD
const myApi: Api = createApi()
const httpClient: HttpClient = new Client()
const parseUrl = (input: string): URL => { }
const userId: string = '123'

// [OK] Exceptions - common single abbreviations
const id: string = '123'  // OK
const url: string = 'https://example.com'  // OK
const api: Api = createApi()  // OK
```

**Examples:**
| Bad | Good |
|-----|------|
| `XMLHTTPRequest` | `XmlHttpRequest` |
| `URLParser` | `UrlParser` |
| `HTMLElement` | `HtmlElement` |
| `JSONData` | `JsonData` |
| `HTTPSConnection` | `HttpsConnection` |

### 3.3 Avoid Abbreviations

**Rule**: Write full words except for universally understood abbreviations.

**Allowed abbreviations:** `id`, `url`, `api`, `http`, `html`, `json`, `xml`, `css`, `sql`, `config`, `repo`, `async`, `sync`, `auth`, `init`, `max`, `min`, `arg`, `param`, `temp`

```typescript
// (x) BAD
const usr = getUsr()
const msg = createMsg()
const err = handleErr()
const ctx = getCtx()
const cfg = loadCfg()

// [OK] GOOD
const user: User = getUser()
const message: string = createMessage()
const error: Error = handleError()
const context: Context = getContext()
const config: Config = loadConfig()

// [OK] GOOD - allowed abbreviations
const userId: string = generateId()
const apiUrl: string = getUrl()
const httpClient: HttpClient = createClient()
```

### 3.4 Domain-Driven Naming

**Rule**: Use business domain terminology, not technical jargon.

```typescript
// (x) BAD - technical terms
interface DataRecord {
  id: string
  fields: Record<string, unknown>
}

function processRecords(records: DataRecord[]): void { }

// [OK] GOOD - domain terms
interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
}

function archiveCompletedTasks(tasks: Task[]): void { }
```

---

## 4. Documentation Standards

### 4.1 JSDoc on Exported APIs

**Rule**: All exported functions, classes, and types MUST have JSDoc comments.

```typescript
/**
 * Retrieves a user by their unique identifier
 *
 * @param userId - The unique identifier of the user
 * @returns The user object if found
 * @throws {NotFoundError} When user with given ID doesn't exist
 * @throws {ValidationError} When userId is invalid
 *
 * @example
 * ```typescript
 * const user = await getUserById('user-123')
 * console.log(user.name)
 * ```
 */
export async function getUserById(userId: string): Promise<User> {
  if (!userId) {
    throw new ValidationError('User ID is required')
  }

  const user: User | null = await findUser(userId)

  if (user === null) {
    throw new NotFoundError(`User not found: ${userId}`)
  }

  return user
}

/**
 * HTTP client for making API requests
 *
 * Provides a type-safe wrapper around the Fetch API with automatic
 * error handling and request/response transformation.
 */
export class FetchHttpClient implements HttpClient {
  /**
   * Creates a new HTTP client
   *
   * @param baseUrl - The base URL for all requests
   * @param defaultHeaders - Headers to include in every request
   */
  constructor(
    private readonly baseUrl: string,
    private readonly defaultHeaders: Record<string, string> = {},
  ) {}

  // Methods...
}
```

### 4.2 Inline Comments for Complex Logic

**Rule**: Add inline comments to explain WHY, not WHAT or HOW.

```typescript
// (x) BAD - comments explain what the code does (obvious)
// Loop through all tasks
for (const task of tasks) {
  // Check if task is completed
  if (task.status === 'completed') {
    // Add to completed array
    completedTasks.push(task)
  }
}

// [OK] GOOD - comment explains WHY
// Include completed tasks from the last 30 days for analytics
// Older completed tasks are archived and don't need real-time metrics
const cutoffDate: Date = dateProvider.subtractDays(dateProvider.now(), 30)
for (const task of tasks) {
  if (task.status === 'completed' && task.completedAt > cutoffDate) {
    completedTasks.push(task)
  }
}

// [OK] GOOD - explains non-obvious behavior
// Sunday returns 0, but we want weeks to start on Monday
// Shift Sunday to the end (6) and all other days down by 1
const dayIndex: number = date.getDay() === 0 ? 6 : date.getDay() - 1
```

### 4.3 Comment Quality

**Don't comment:**
- Obvious code
- What is already clear from names
- Code that should be refactored instead

**Do comment:**
- Non-obvious design decisions
- Performance optimizations
- Workarounds for external issues
- Complex algorithms
- Business rules and constraints

---

## 5. File Organization

### 5.1 File Naming

**Rule**: Files should use kebab-case and match their primary export.

```
[OK] GOOD
task-repository.ts       // exports TaskRepository
http-client.ts           // exports HttpClient
error-handler.ts         // exports errorHandler functions
constants.ts             // exports constants

(x) BAD
TaskRepository.ts        // PascalCase
task_repository.ts       // snake_case
taskRepo.ts              // abbreviated
```

### 5.2 Import Organization

**Rule**: Imports should be organized and use type imports where appropriate.

```typescript
// [OK] GOOD - organized imports
import type { Task, TaskStatus } from '@/types/task'
import type { User } from '@/types/user'

import { TaskRepository } from '@/repositories/task-repository'
import { Logger } from '@/adapters/logging/logger'

import { validateTask } from '@/utils/validation'
import { formatDate } from '@/utils/date'
```

**Import order:**
1. Type imports from external packages
2. Type imports from local modules
3. Value imports from external packages
4. Value imports from local modules

### 5.3 Export Organization

**Rule**: Prefer named exports over default exports.

```typescript
// (x) BAD - default export
export default class TaskRepository { }

// [OK] GOOD - named export
export class TaskRepository { }

// [OK] GOOD - named function exports
export function createTask(data: CreateTaskInput): Task { }
export function deleteTask(id: string): void { }
```

---

## 6. Error Handling

### 6.1 Typed Errors

**Rule**: Use custom error classes, never throw strings or plain objects.

```typescript
// (x) BAD
throw 'User not found'
throw { error: 'Invalid input' }
throw 404

// [OK] GOOD
throw new NotFoundError('User not found')
throw new ValidationError('Invalid input', { field: 'email' })
throw new UnauthorizedError()
```

### 6.2 Unknown Errors in Catch Blocks

**Rule**: Catch blocks receive `unknown`, not `any`. Always handle with type guards.

```typescript
// (x) BAD
try {
  await riskyOperation()
} catch (error) {
  console.error(error.message)  // TypeScript error with useUnknownInCatchVariables
}

// [OK] GOOD
try {
  await riskyOperation()
} catch (error: unknown) {
  if (error instanceof AppError) {
    logger.error(error.message, { statusCode: error.statusCode })
  } else if (error instanceof Error) {
    logger.error(error.message)
  } else {
    logger.error('An unknown error occurred', { error })
  }
}
```

---

## 7. Svelte-Specific Standards

### 7.1 Component Props Typing

**Rule**: Component props must have explicit TypeScript types.

```svelte
<!-- (x) BAD -->
<script>
  export let user;
  export let onEdit;
</script>

<!-- [OK] GOOD -->
<script lang="ts">
  import type { User } from '@erledigen/shared';

  interface Props {
    user: User;
    onEdit?: (user: User) => void;
  }

  let { user, onEdit }: Props = $props();
</script>

<div>
  <h1>{user.name}</h1>
  {#if onEdit}
    <button onclick={() => onEdit!(user)}>Edit</button>
  {/if}
</div>
```

### 7.2 Event Handlers

**Rule**: Event handlers must have explicit types.

```svelte
<script lang="ts">
  // (x) BAD
  function handleClick(event) {
    event.preventDefault();
  }

  // [OK] GOOD
  function handleClick(event: MouseEvent): void {
    event.preventDefault();
    // Handle click
  }

  function handleInputChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    // Handle change
  }
</script>
```

### 7.3 Runes and Reactivity Gotchas

Each of these has shipped a real bug in this repo.

- **Capture `$derived` values into a local BEFORE the first `await`** in an
  async event handler. While the handler is suspended, a later write in the
  same handler (e.g. clearing the input) nulls the derived mid-flight --
  this caused a crash in the inline habit-hint parser. Snapshot the value
  first, then await.
- **Rune-using non-component files must end in `.svelte.ts`.** A plain `.ts`
  store file silently cannot use `$state`/`$derived`.
- **Never rely on template whitespace for spacing.** Svelte 5 strips
  newline-only whitespace between elements; a "g t" chord once rendered as
  "gt" with no space. Space with CSS (flex `gap`), always.
- **`getAttribute('aria-pressed')` returns a STRING** -- `"false"` is truthy.
  Compare with `=== 'true'`.

### 7.4 SSR, Hydration, and E2E Assertions

- The app is server-rendered: markup exists before any event handler
  attaches. `+layout.svelte` sets `data-hydrated="true"` on `.app-shell` in
  `onMount`; e2e tests must wait for it (see `hydrated()` in
  `tests/e2e/util.ts`) before interacting -- earlier clicks silently do
  nothing.
- `bind:value` inputs expose a value, not text content, so a `toContainText`
  assertion on one can never pass; use `toHaveValue`.

### 7.5 Theming and Shared UI Conventions

- Components must work in BOTH light and dark themes. Prefer the tooltip
  pattern in `app.css` -- ink/surface token inversion serves both themes from
  one rule -- over theme-specific overrides.
- Keybinding hints come from the single registry in
  `packages/client/src/lib/keybindings.ts`; the help modal and every tooltip
  derive from it. Never hand-write a keybinding hint.

### 7.6 Date Handling

Task dates are local `yyyy-MM-dd` key strings. Do date math through the
shared `dateProvider` helpers (`today()`, `addDays`), never `new Date()`
arithmetic -- deriving dates from `Date` objects shipped a timezone bug in
the calendar. (`new Date()` is fine for wall-clock display, e.g. the
bottom-bar clock.)

---

## 8. Async/Await Standards

### 8.1 Explicit Promise Types

**Rule**: Functions returning Promises must have explicit `Promise<T>` return type.

```typescript
// (x) BAD
async function fetchUser(id: string) {
  const response = await fetch(`/api/users/${id}`)
  return response.json()
}

// [OK] GOOD
async function fetchUser(id: string): Promise<User> {
  const response: Response = await fetch(`/api/users/${id}`)
  return response.json() as Promise<User>
}
```

### 8.2 Avoid Floating Promises

**Rule**: Always await or explicitly handle promises.

```typescript
// (x) BAD - floating promise
function saveUser(user: User): void {
  repository.save(user)  // Promise ignored
}

// [OK] GOOD - awaited
async function saveUser(user: User): Promise<void> {
  await repository.save(user)
}

// [OK] GOOD - explicitly handled
function saveUser(user: User): void {
  repository.save(user).catch((error: unknown): void => {
    logger.error('Failed to save user', { error })
  })
}
```

---

## 9. Enforcement Tools

These standards are enforced automatically through:

### 9.1 TypeScript Compiler

Configured in `tsconfig.json` with maximum strictness:
- `strict: true` - Enables all strict type checking
- `noImplicitAny` - Errors on implicit any
- `noImplicitReturns` - Requires return in all code paths
- `noUnusedLocals` - Errors on unused variables
- `noUnusedParameters` - Errors on unused parameters
- `useUnknownInCatchVariables` - Catch blocks use unknown
- `exactOptionalPropertyTypes` - Strict optional property handling
- And more (see tsconfig.json files)

### 9.2 Biome Linter

Configured in `biome.json`:
- `noExplicitAny: "error"` - No explicit any types
- `useImportType: "error"` - Use type imports
- `noNonNullAssertion: "error"` - No `!` assertions
- `noUnusedVariables: "error"` - No unused variables
- `noUnusedImports: "error"` - No unused imports

### 9.3 Running Checks

```bash
# Format code
bun run format

# Lint code
bun run lint

# Type check
bun run type-check

# Run all checks
bun run validate
```

---

## 10. Examples: Good vs Bad

### Example 1: Function Definition

```typescript
// (x) BAD
function get(id) {
  const data = fetch(`/api/tasks/${id}`)
  return data.json()
}

// [OK] GOOD
async function getTaskById(taskId: string): Promise<Task> {
  const response: Response = await fetch(`/api/tasks/${taskId}`)

  if (!response.ok) {
    throw new HttpError(`Failed to fetch task: ${response.statusText}`)
  }

  return response.json() as Promise<Task>
}
```

### Example 2: Class Definition

```typescript
// (x) BAD
class Repo {
  private items = []

  add(item) {
    this.items.push(item)
  }

  getAll() {
    return this.items
  }
}

// [OK] GOOD
/**
 * In-memory repository for managing tasks
 *
 * Provides basic CRUD operations with auto-incrementing IDs.
 * For production use, replace with a database-backed implementation.
 */
class InMemoryTaskRepository implements TaskRepository {
  private tasks: Map<string, Task> = new Map()

  async create(input: CreateTaskInput): Promise<Task> {
    const task: Task = {
      id: this.generateId(),
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.tasks.set(task.id, task)
    return task
  }

  async findAll(): Promise<Task[]> {
    return Array.from(this.tasks.values())
  }

  private generateId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }
}
```

---

## 11. Bun Runtime Gotchas

Each of these has cost real debugging time in this repo.

- **Package-script wrappers leak child processes.** `bun run dev` /
  `bun run start` spawn a wrapper; `kill $!` kills the wrapper and leaves the
  real server child alive, still holding the port. When running a server
  manually, invoke the entry directly (`bun packages/server/src/index.ts`)
  and verify with `lsof -ti:<port>` after killing (`bun run kill-server-port`
  reclaims 4000).
- **`bun build` does not bundle `.sql`.** The server build script copies
  `src/adapters/data/migrations/` into `dist/` explicitly -- a migration that
  is not committed passes locally (dev runs from source) but breaks every
  docker and CI build. Always commit migrations together with the code that
  needs them.
- **The two storage adapters are not behaviorally identical.**
  `projects.tag` is UNIQUE in SQLite but not in-memory, so the same POST
  passes on memory and 500s on SQLite. Any repository-behavior change must
  extend the contract suites in
  `packages/server/src/adapters/data/contracts/`, which run against both
  adapters.
- **Test code sets `process.env['STORAGE_ADAPTER']` with bracket access** --
  `noPropertyAccessFromIndexSignature` rejects dot access on index
  signatures.
- **Regex: avoid one large alternation with a lazy prefix and nested optional
  groups.** A Bun/JS backtracking pathology then rejects VALID input (this
  forced a rewrite of `parseRecurrence`). Build parsers as an ordered array
  of small anchored regexes, and suspect this first when a parser
  mysteriously rejects valid input.
- **The client build is size-gated**: CI fails when `packages/client/dist`
  exceeds 512KB (see [ci-cd-pipeline.md](../process/ci-cd-pipeline.md)) --
  think twice before adding dependencies or large static assets.

---

## Summary

- [OK] **Zero `any` types** - Use `unknown` with type guards
- [OK] **Explicit return types on ALL functions** - Never rely on inference
- [OK] **Descriptive naming** - Clarity over brevity
- [OK] **No I- prefix on interfaces** - They're not implementations
- [OK] **camelCase for abbreviations** - `myApi` not `myAPI`
- [OK] **JSDoc on exported APIs** - Document public interfaces
- [OK] **Comment WHY not WHAT** - Explain intent, not mechanics
- [OK] **Named exports** - Prefer over default exports
- [OK] **Type-safe error handling** - Custom error classes

**Remember**: These rules exist to make code more maintainable, less error-prone, and easier to understand. When in doubt, choose the more explicit, more type-safe option.
