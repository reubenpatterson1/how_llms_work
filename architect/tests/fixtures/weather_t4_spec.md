# Dense Architecture Specification
# Density Score: 0.476

## Purpose
# Resolution: 37.5%

- A weather page that displays current weather information.
- PoC scope — success = working demo, formal metrics at MVP
- Success means real current weather for any valid city.

## Data Model
# Resolution: 46.0%

- PoC scope — basic relationships, normalize at MVP
- PoC scope — cardinality deferred to MVP
- PoC scope — default indexes only, optimize at MVP

## API
# Resolution: 78.0%

- GET / serves the HTML page.
- A text input field for a city name (defaulting to 'New York').
- City name returned by OpenWeather, current temperature in °F, and weather description.
- 200 response: {"city": str, "temp_f": number, "description": str}
- PoC scope — no versioning needed
- PoC scope — defer real-time to MVP unless core to concept

## Tech Stack
# Resolution: 82.0%

- Not required / out of scope (user marked N/A)
- Python 3.12
- Not required / out of scope (user marked N/A)
- Flask
- no persistence
- Not required / out of scope (user marked N/A)
- Not required / out of scope (user marked N/A)

## Auth
# Resolution: 45.0%

- No login required for PoC — deliberate scoping decision
- No sessions required for PoC — deliberate scoping decision

## Deployment
# Resolution: 37.5%

- a single service
- The 'training' namespace

## Error Handling
# Resolution: 22.5%

- 400 error for missing or empty city parameter.

## Performance
# Resolution: 40.0%

- Upstream OpenWeather call must have a 5s timeout.
- No targets beyond the 5s upstream timeout (confirming this is the sole performance constraint)

## Security
# Resolution: 45.0%

- City name input is required for the API endpoint.
- Config must come from the env var OPENWEATHER_API_KEY and is never hard-coded.
- The API key must be read from os.environ only.
- The API key must never be logged, returned in a response, or rendered into the page (data leakage prevention).

## Testing
# Resolution: 42.5%

- pytest suits Part 5
- pytest framework will be used for testing.
- Tests must mock 'requests.get' to prevent real network calls.

## All Constraints (Flat)

- A weather page that displays current weather information.
- PoC scope — success = working demo, formal metrics at MVP
- Success means real current weather for any valid city.
- PoC scope — basic relationships, normalize at MVP
- PoC scope — cardinality deferred to MVP
- PoC scope — default indexes only, optimize at MVP
- GET / serves the HTML page.
- A text input field for a city name (defaulting to 'New York').
- City name returned by OpenWeather, current temperature in °F, and weather description.
- 200 response: {"city": str, "temp_f": number, "description": str}
- PoC scope — no versioning needed
- PoC scope — defer real-time to MVP unless core to concept
- Not required / out of scope (user marked N/A)
- Python 3.12
- Not required / out of scope (user marked N/A)
- Flask
- no persistence
- Not required / out of scope (user marked N/A)
- Not required / out of scope (user marked N/A)
- No login required for PoC — deliberate scoping decision
- No sessions required for PoC — deliberate scoping decision
- a single service
- The 'training' namespace
- 400 error for missing or empty city parameter.
- Upstream OpenWeather call must have a 5s timeout.
- No targets beyond the 5s upstream timeout (confirming this is the sole performance constraint)
- City name input is required for the API endpoint.
- Config must come from the env var OPENWEATHER_API_KEY and is never hard-coded.
- The API key must be read from os.environ only.
- The API key must never be logged, returned in a response, or rendered into the page (data leakage prevention).
- pytest suits Part 5
- pytest framework will be used for testing.
- Tests must mock 'requests.get' to prevent real network calls.

## Implementation Rules

- Every architectural decision MUST trace to a constraint above
- If a dimension has no constraint, ASK — do not invent
- Prefer explicit over implicit in all generated code
- No defaults: every value must come from this spec

