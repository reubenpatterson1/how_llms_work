"""Mock LLM that generates pre-tagged outputs for vague vs dense comparison.

Two modes:
- Vague: generates code with hallucinations (Express when unspecified, invents auth, defaults to MongoDB)
- Dense: follows spec exactly, all tokens grounded
"""

from dataclasses import dataclass


@dataclass
class Token:
    text: str
    grounding: str  # "grounded" | "inferred" | "defaulted" | "confabulated"


@dataclass
class LLMOutput:
    tokens: list[Token]
    raw_text: str

    @property
    def hallucination_surface(self) -> float:
        if not self.tokens:
            return 0.0
        confabulated = sum(1 for t in self.tokens if t.grounding == "confabulated")
        return confabulated / len(self.tokens)

    @property
    def grounding_breakdown(self) -> dict[str, int]:
        counts = {"grounded": 0, "inferred": 0, "defaulted": 0, "confabulated": 0}
        for t in self.tokens:
            counts[t.grounding] = counts.get(t.grounding, 0) + 1
        return counts

    def to_dict(self) -> dict:
        return {
            "raw_text": self.raw_text,
            "tokens": [{"text": t.text, "grounding": t.grounding} for t in self.tokens],
            "hallucination_surface": round(self.hallucination_surface, 4),
            "grounding_breakdown": self.grounding_breakdown,
        }


# Pre-built vague outputs (5 variants to simulate run-to-run variance)
VAGUE_OUTPUTS: list[list[tuple[str, str]]] = [
    # Run 1: Express + MongoDB (most common LLM default)
    [
        ("const", "defaulted"), ("express", "confabulated"), ("=", "grounded"),
        ("require", "grounded"), ("('express')", "confabulated"), (";", "grounded"),
        ("const", "defaulted"), ("mongoose", "confabulated"), ("=", "grounded"),
        ("require", "grounded"), ("('mongoose')", "confabulated"), (";", "grounded"),
        ("const", "defaulted"), ("app", "grounded"), ("=", "grounded"),
        ("express", "confabulated"), ("()", "grounded"), (";", "grounded"),
        ("\n// Task Schema", "defaulted"), ("\nconst", "defaulted"),
        ("taskSchema", "grounded"), ("=", "grounded"), ("new", "grounded"),
        ("mongoose.Schema", "confabulated"), ("({", "grounded"),
        ("\n  title:", "grounded"), ("String,", "inferred"),
        ("\n  description:", "inferred"), ("String,", "inferred"),
        ("\n  status:", "grounded"), ("String,", "inferred"),
        ("\n  assignee:", "confabulated"), ("String,", "confabulated"),
        ("\n  dueDate:", "confabulated"), ("Date,", "confabulated"),
        ("\n  priority:", "confabulated"), ("String", "confabulated"),
        ("\n});", "grounded"),
        ("\n\n// Routes", "defaulted"),
        ("\napp.get", "grounded"), ("('/tasks',", "grounded"),
        ("async", "defaulted"), ("(req, res)", "grounded"), ("=> {", "grounded"),
        ("\n  const tasks =", "grounded"), ("await", "defaulted"),
        ("Task.find()", "confabulated"), (";", "grounded"),
        ("\n  res.json(tasks)", "grounded"), (";", "grounded"),
        ("\n});", "grounded"),
        ("\napp.post", "grounded"), ("('/tasks',", "grounded"),
        ("async", "defaulted"), ("(req, res)", "grounded"), ("=> {", "grounded"),
        ("\n  const task =", "grounded"), ("new Task(req.body)", "confabulated"), (";", "grounded"),
        ("\n  await task.save()", "confabulated"), (";", "grounded"),
        ("\n  res.status(201).json(task)", "grounded"), (";", "grounded"),
        ("\n});", "grounded"),
        ("\n\n// No auth middleware", "confabulated"),
        ("\napp.listen(3000)", "defaulted"), (";", "grounded"),
    ],
    # Run 2: Express + PostgreSQL (different DB default)
    [
        ("const", "defaulted"), ("express", "confabulated"), ("=", "grounded"),
        ("require", "grounded"), ("('express')", "confabulated"), (";", "grounded"),
        ("const", "defaulted"), ("{", "grounded"), ("Pool", "confabulated"),
        ("}", "grounded"), ("=", "grounded"), ("require", "grounded"),
        ("('pg')", "confabulated"), (";", "grounded"),
        ("const", "defaulted"), ("pool", "confabulated"), ("=", "grounded"),
        ("new Pool()", "confabulated"), (";", "grounded"),
        ("\n// CRUD routes", "defaulted"),
        ("\napp.get", "grounded"), ("('/api/tasks',", "grounded"),
        ("async", "defaulted"), ("(req, res)", "grounded"), ("=> {", "grounded"),
        ("\n  const result =", "grounded"), ("await", "defaulted"),
        ("pool.query('SELECT * FROM tasks')", "confabulated"), (";", "grounded"),
        ("\n  res.json(result.rows)", "grounded"), (";", "grounded"),
        ("\n});", "grounded"),
        ("\n\n// Basic JWT auth", "confabulated"),
        ("\nconst jwt =", "confabulated"), ("require('jsonwebtoken')", "confabulated"), (";", "grounded"),
        ("\nfunction authMiddleware(req, res, next)", "confabulated"), ("{", "grounded"),
        ("\n  const token = req.headers.authorization", "confabulated"), (";", "grounded"),
        ("\n  // verify token...", "confabulated"),
        ("\n  next()", "confabulated"), (";", "grounded"),
        ("\n}", "grounded"),
        ("\napp.listen(8080)", "defaulted"), (";", "grounded"),
    ],
    # Run 3: FastAPI + SQLite (Python variant)
    [
        ("from", "defaulted"), ("fastapi", "confabulated"), ("import", "grounded"),
        ("FastAPI", "confabulated"), ("\n", "grounded"),
        ("from", "defaulted"), ("sqlmodel", "confabulated"), ("import", "grounded"),
        ("SQLModel, Field, create_engine", "confabulated"), ("\n", "grounded"),
        ("\napp =", "grounded"), ("FastAPI()", "confabulated"), ("\n", "grounded"),
        ("\nclass Task(SQLModel,", "confabulated"), ("table=True):", "confabulated"),
        ("\n    id:", "grounded"), ("int | None", "inferred"), ("= Field(default=None,", "confabulated"),
        ("primary_key=True)", "confabulated"),
        ("\n    title:", "grounded"), ("str", "inferred"),
        ("\n    done:", "confabulated"), ("bool = False", "confabulated"),
        ("\n\nengine =", "confabulated"), ("create_engine('sqlite:///tasks.db')", "confabulated"),
        ("\n\n@app.get('/tasks')", "grounded"),
        ("\ndef get_tasks():", "grounded"),
        ("\n    # ...", "confabulated"),
        ("\n    return tasks", "grounded"),
        ("\n\n@app.post('/tasks')", "grounded"),
        ("\ndef create_task(task: Task):", "grounded"),
        ("\n    # ...", "confabulated"),
        ("\n    return task", "grounded"),
    ],
    # Run 4: Hono + Drizzle (hipster stack)
    [
        ("import", "defaulted"), ("{ Hono }", "confabulated"), ("from", "grounded"),
        ("'hono'", "confabulated"), ("\n", "grounded"),
        ("import", "defaulted"), ("{ drizzle }", "confabulated"), ("from", "grounded"),
        ("'drizzle-orm'", "confabulated"), ("\n", "grounded"),
        ("\nconst app =", "grounded"), ("new Hono()", "confabulated"), ("\n", "grounded"),
        ("\nconst tasks =", "grounded"), ("pgTable('tasks', {", "confabulated"),
        ("\n  id:", "grounded"), ("serial('id').primaryKey(),", "confabulated"),
        ("\n  title:", "grounded"), ("text('title').notNull(),", "inferred"),
        ("\n  status:", "grounded"), ("text('status').default('pending'),", "confabulated"),
        ("\n})", "grounded"),
        ("\n\napp.get('/tasks',", "grounded"), ("async (c) => {", "confabulated"),
        ("\n  const all = await db.select().from(tasks)", "confabulated"),
        ("\n  return c.json(all)", "grounded"),
        ("\n})", "grounded"),
        ("\n\nexport default app", "confabulated"),
    ],
    # Run 5: Express + MongoDB (same as run 1 but different schema)
    [
        ("const", "defaulted"), ("express", "confabulated"), ("=", "grounded"),
        ("require", "grounded"), ("('express')", "confabulated"), (";", "grounded"),
        ("const", "defaulted"), ("mongoose", "confabulated"), ("=", "grounded"),
        ("require", "grounded"), ("('mongoose')", "confabulated"), (";", "grounded"),
        ("\nconst taskSchema =", "grounded"), ("new mongoose.Schema({", "confabulated"),
        ("\n  name:", "confabulated"), ("{ type: String, required: true },", "confabulated"),
        ("\n  completed:", "confabulated"), ("{ type: Boolean, default: false },", "confabulated"),
        ("\n  createdBy:", "confabulated"), ("String,", "confabulated"),
        ("\n  tags:", "confabulated"), ("[String],", "confabulated"),
        ("\n});", "grounded"),
        ("\n\nconst app = express();", "confabulated"),
        ("\napp.use(express.json());", "defaulted"),
        ("\n\napp.get('/tasks',", "grounded"), ("async (req, res) => {", "grounded"),
        ("\n  const tasks = await Task.find();", "confabulated"),
        ("\n  res.json(tasks);", "grounded"),
        ("\n});", "grounded"),
        ("\napp.listen(process.env.PORT || 3000);", "defaulted"),
    ],
]

# Dense output: follows a spec for Task Management API with all channels resolved
DENSE_OUTPUT: list[tuple[str, str]] = [
    ("from", "grounded"), ("fastapi", "grounded"), ("import", "grounded"),
    ("FastAPI, HTTPException, Depends, WebSocket", "grounded"), ("\n", "grounded"),
    ("from", "grounded"), ("fastapi.security", "grounded"), ("import", "grounded"),
    ("HTTPBearer", "grounded"), ("\n", "grounded"),
    ("from", "grounded"), ("sqlalchemy", "grounded"), ("import", "grounded"),
    ("create_engine, Column, Integer, String, ForeignKey, DateTime, Boolean, Index", "grounded"),
    ("\n", "grounded"),
    ("from", "grounded"), ("sqlalchemy.orm", "grounded"), ("import", "grounded"),
    ("declarative_base, sessionmaker, relationship", "grounded"), ("\n", "grounded"),
    ("import", "grounded"), ("redis", "grounded"), ("\n", "grounded"),
    ("import", "grounded"), ("jwt", "grounded"), ("\n\n", "grounded"),
    ("# Constraint: Database: PostgreSQL 15", "grounded"), ("\n", "grounded"),
    ("DATABASE_URL =", "grounded"), ("'postgresql://user:pass@db:5432/taskdb'", "grounded"),
    ("\n", "grounded"),
    ("engine = create_engine(DATABASE_URL,", "grounded"),
    ("pool_size=20, max_overflow=10)", "grounded"), ("\n", "grounded"),
    ("Session = sessionmaker(bind=engine)", "grounded"), ("\n\n", "grounded"),
    ("# Constraint: Cache: Redis for session + query cache", "grounded"), ("\n", "grounded"),
    ("cache = redis.Redis(host='redis', port=6379, db=0)", "grounded"), ("\n\n", "grounded"),
    ("Base = declarative_base()", "grounded"), ("\n\n", "grounded"),
    ("# Constraint: Entity: User (id, email UNIQUE NOT NULL, name, role ENUM)", "grounded"),
    ("\n", "grounded"),
    ("class User(Base):", "grounded"), ("\n", "grounded"),
    ("    __tablename__ = 'users'", "grounded"), ("\n", "grounded"),
    ("    id = Column(Integer, primary_key=True)", "grounded"), ("\n", "grounded"),
    ("    email = Column(String, unique=True, nullable=False)", "grounded"), ("\n", "grounded"),
    ("    name = Column(String, nullable=False)", "grounded"), ("\n", "grounded"),
    ("    role = Column(String, nullable=False)", "grounded"),
    ("  # RBAC: admin, manager, member", "grounded"), ("\n", "grounded"),
    ("    team_id = Column(Integer, ForeignKey('teams.id'))", "grounded"), ("\n", "grounded"),
    ("    tasks = relationship('Task', back_populates='assignee')", "grounded"),
    ("\n\n", "grounded"),
    ("# Constraint: Entity: Team (id, name UNIQUE, created_at)", "grounded"),
    ("\n", "grounded"),
    ("class Team(Base):", "grounded"), ("\n", "grounded"),
    ("    __tablename__ = 'teams'", "grounded"), ("\n", "grounded"),
    ("    id = Column(Integer, primary_key=True)", "grounded"), ("\n", "grounded"),
    ("    name = Column(String, unique=True, nullable=False)", "grounded"), ("\n", "grounded"),
    ("    members = relationship('User')", "grounded"), ("\n\n", "grounded"),
    ("# Constraint: Entity: Task (id, title NOT NULL, description, status ENUM, priority ENUM)", "grounded"),
    ("\n", "grounded"),
    ("# Constraint: Relationship: Task many-to-one User (assignee_id FK)", "grounded"),
    ("\n", "grounded"),
    ("# Constraint: Relationship: Task many-to-one Team (team_id FK)", "grounded"),
    ("\n", "grounded"),
    ("class Task(Base):", "grounded"), ("\n", "grounded"),
    ("    __tablename__ = 'tasks'", "grounded"), ("\n", "grounded"),
    ("    id = Column(Integer, primary_key=True)", "grounded"), ("\n", "grounded"),
    ("    title = Column(String, nullable=False)", "grounded"), ("\n", "grounded"),
    ("    description = Column(String)", "grounded"), ("\n", "grounded"),
    ("    status = Column(String, nullable=False, default='todo')", "grounded"),
    ("  # todo|in_progress|review|done", "grounded"), ("\n", "grounded"),
    ("    priority = Column(String, nullable=False, default='medium')", "grounded"),
    ("  # low|medium|high|critical", "grounded"), ("\n", "grounded"),
    ("    assignee_id = Column(Integer, ForeignKey('users.id'))", "grounded"), ("\n", "grounded"),
    ("    team_id = Column(Integer, ForeignKey('teams.id'), nullable=False)", "grounded"),
    ("\n", "grounded"),
    ("    assignee = relationship('User', back_populates='tasks')", "grounded"),
    ("\n", "grounded"),
    ("    __table_args__ = (", "grounded"), ("\n", "grounded"),
    ("        Index('ix_task_team_status', 'team_id', 'status'),", "grounded"), ("\n", "grounded"),
    ("        Index('ix_task_assignee', 'assignee_id'),", "grounded"), ("\n", "grounded"),
    ("    )", "grounded"), ("\n\n", "grounded"),
    ("# Constraint: Auth: JWT with RS256, 15min access + 7d refresh", "grounded"),
    ("\n", "grounded"),
    ("security = HTTPBearer()", "grounded"), ("\n", "grounded"),
    ("JWT_SECRET = 'from-env-var'", "grounded"),
    ("  # Constraint: env-based config", "grounded"), ("\n\n", "grounded"),
    ("app = FastAPI(title='Task Management API', version='v1')", "grounded"),
    ("\n\n", "grounded"),
    ("# Constraint: Rate limiting: 100 req/min per user", "grounded"), ("\n", "grounded"),
    ("# Constraint: CORS: allow app.example.com only", "grounded"), ("\n", "grounded"),
    ("# Constraint: Input validation on all endpoints", "grounded"), ("\n\n", "grounded"),
    ("@app.get('/v1/tasks')", "grounded"), ("\n", "grounded"),
    ("async def list_tasks(team_id: int,", "grounded"),
    ("status: str | None = None,", "grounded"), ("\n", "grounded"),
    ("    cursor: str | None = None,", "grounded"),
    ("limit: int = 50):", "grounded"), ("\n", "grounded"),
    ("    # Constraint: Pagination: cursor-based, max 50", "grounded"), ("\n", "grounded"),
    ("    # Constraint: P95 latency < 100ms", "grounded"), ("\n", "grounded"),
    ("    ...", "grounded"), ("\n\n", "grounded"),
    ("@app.post('/v1/tasks', status_code=201)", "grounded"), ("\n", "grounded"),
    ("async def create_task(task: TaskCreate):", "grounded"), ("\n", "grounded"),
    ("    # Constraint: Validate title length 1-200", "grounded"), ("\n", "grounded"),
    ("    # Constraint: Broadcast via WebSocket on create", "grounded"), ("\n", "grounded"),
    ("    ...", "grounded"), ("\n\n", "grounded"),
    ("@app.websocket('/v1/ws/tasks/{team_id}')", "grounded"), ("\n", "grounded"),
    ("async def task_updates(websocket: WebSocket, team_id: int):", "grounded"),
    ("\n", "grounded"),
    ("    # Constraint: Realtime: WebSocket per team", "grounded"), ("\n", "grounded"),
    ("    ...", "grounded"), ("\n", "grounded"),
]


class MockLLM:
    """Mock LLM that returns pre-tagged outputs."""

    def generate(self, prompt: str, spec: str | None = None, run_index: int = 0) -> LLMOutput:
        if spec:
            return self._dense_output()
        return self._vague_output(run_index)

    def _vague_output(self, run_index: int = 0) -> LLMOutput:
        idx = run_index % len(VAGUE_OUTPUTS)
        token_data = VAGUE_OUTPUTS[idx]
        tokens = [Token(text=t, grounding=g) for t, g in token_data]
        raw = "".join(t.text for t in tokens)
        return LLMOutput(tokens=tokens, raw_text=raw)

    def _dense_output(self) -> LLMOutput:
        tokens = [Token(text=t, grounding=g) for t, g in DENSE_OUTPUT]
        raw = "".join(t.text for t in tokens)
        return LLMOutput(tokens=tokens, raw_text=raw)
