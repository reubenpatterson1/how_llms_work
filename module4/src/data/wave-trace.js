// module4/src/data/wave-trace.js
// Mirrors the build event sequence the live agent emits for the HelloWorld spec.
// Times are simulated wall-clock ms — they paint the wave-parallel story
// at presentation pace (faster than real Ollama, slower than instant).

export const HELLO_WORLD_TRACE = [
  { t: 0,    event: 'build:start', payload: { total_components: 4, total_waves: 2 } },
  { t: 100,  event: 'build:wave:start', payload: { wave_index: 0, components: ['weather-service', 'health-handler'] } },
  { t: 200,  event: 'build:component:start', payload: { component_id: 'weather-service' } },
  { t: 250,  event: 'build:component:start', payload: { component_id: 'health-handler' } },
  { t: 1500, event: 'build:component:done', payload: { component_id: 'health-handler', file_path: 'src/health-handler.js', duration_ms: 1250 } },
  { t: 2400, event: 'build:component:done', payload: { component_id: 'weather-service', file_path: 'src/weather-service.js', duration_ms: 2200 } },
  { t: 2500, event: 'build:wave:done', payload: { wave_index: 0, duration_ms: 2400 } },
  { t: 2600, event: 'build:wave:start', payload: { wave_index: 1, components: ['weather-handler', 'app-server'] } },
  { t: 2700, event: 'build:component:start', payload: { component_id: 'weather-handler' } },
  { t: 2750, event: 'build:component:start', payload: { component_id: 'app-server' } },
  { t: 4000, event: 'build:component:done', payload: { component_id: 'weather-handler', file_path: 'src/weather-handler.js', duration_ms: 1300 } },
  { t: 4500, event: 'build:component:done', payload: { component_id: 'app-server', file_path: 'src/app-server.js', duration_ms: 1750 } },
  { t: 4600, event: 'build:wave:done', payload: { wave_index: 1, duration_ms: 2000 } },
  { t: 4700, event: 'build:complete', payload: { duration_ms: 4700 } },
];
