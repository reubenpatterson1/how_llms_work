# Dense Architecture Specification — HelloWorld
# Density Score: 0.85

## Purpose

- Objective: Display "Hello, World!" with the current time and weather for a single hardcoded city
- Users: Internal fubo employees as a teaching artifact for the architect → decompose → build → deploy pipeline
- Success Criteria: Page loads, time updates each second, weather shown for New York
- Scope: One page, one external API call, no auth, no database

## Data Model

- Entities: GreetingState entity with text, time, weatherTemp, weatherDescription, lastFetchedAt
- Relationships: none (single in-memory state)
- Constraints: weatherTemp expressed in Fahrenheit
- Indexes: not applicable

## API

- Endpoints: GET /api/weather returns current weather for hardcoded city New York
- Endpoints: GET /healthz returns 200 OK with body {"status":"ok"} for liveness probe
- Request Shapes: no request body required for either endpoint
- Response Shapes: GET /api/weather returns {temp_f: number, description: string, fetchedAt: ISO8601}
- Response Shapes: GET /healthz returns {status: "ok"}

## Tech Stack

- Language: JavaScript (ES2022)
- Framework: Express 4 on Node 20
- Database: none
- External APIs: OpenWeatherMap current-weather API, key in OPENWEATHER_API_KEY env var

## Auth

- Method: none for v1 (internal demo)

## Deployment

- Infrastructure: fubo internal Application platform, namespace training, single replica
- Cicd: deployed via the architect tool, no GitHub Actions
- Environments: training only

## Performance

- Latency: P95 of /api/weather under 800ms (network-bound on OpenWeatherMap)

## All Constraints (Flat)

- "Hello, World!" + current time + weather for hardcoded New York
- Internal fubo employees as a teaching artifact
- Page loads, time updates each second
- One page, one external API call, no auth
- GreetingState entity with text, time, weatherTemp, weatherDescription, lastFetchedAt
- weatherTemp in Fahrenheit
- GET /api/weather for hardcoded New York
- GET /healthz returns {"status":"ok"}
- {temp_f, description, fetchedAt} response shape
- JavaScript ES2022, Express 4 on Node 20
- OpenWeatherMap API, key in OPENWEATHER_API_KEY env var
- fubo internal Application platform, namespace training, single replica

## Implementation Rules

- Every architectural decision MUST trace to a constraint above
- If a dimension has no constraint, ASK — do not invent
- Prefer explicit over implicit in all generated code
- No defaults: every value must come from this spec
