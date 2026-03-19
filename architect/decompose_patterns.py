"""Regex-based component extraction — offline fallback for the Decomposition Agent.

Mirrors the pattern-matching approach from analyzer.py but maps spec constraints
to components rather than channel updates.
"""

import re
from typing import Optional

from .wave_plan import Component, DependencyEdge, InterfaceContract


# ── Static dependency ordering by component type ──

TYPE_ORDER = {
    "interface": 0,
    "config": 1,
    "model": 1,
    "service": 2,
    "middleware": 2,
    "handler": 3,
    "test": 4,
}

# Channel-based build ordering (earlier channels produce components that later ones depend on)
CHANNEL_ORDER = {
    "purpose": 0,
    "tech_stack": 1,
    "data_model": 1,
    "auth": 2,
    "api": 2,
    "error_handling": 3,
    "performance": 3,
    "security": 3,
    "deployment": 4,
    "testing": 4,
}


# ── Entity extraction from Data Model constraints ──

def _extract_entities(constraints: list[str]) -> list[str]:
    """Extract entity names from data_model constraints."""
    entities = []
    for constraint in constraints:
        # "Entities: Task, User, Team, Comment" — must start with Entity/Entities
        m = re.match(r'(?:Entit(?:y|ies))\s*:\s*(.+)', constraint.strip(), re.IGNORECASE)
        if m:
            for name in re.split(r'[,;/]+', m.group(1)):
                name = name.strip().split('(')[0].split('[')[0].strip().rstrip(')')
                if name and name[0].isupper():
                    entities.append(name)
            continue
        # "Entities defined (entities: User)" or "Entities defined (models: Task)"
        m = re.search(r'\((?:entities|models?)\s*(?::\s*|\s+)(\w+)\)', constraint, re.IGNORECASE)
        if m:
            name = m.group(1).strip()
            skip_words = {"on", "defined", "the", "for", "with", "in"}
            if name and name.lower() not in skip_words:
                entities.append(name if name[0].isupper() else name.capitalize())
                continue
        # "Entity: users/accounts" — lowercase entity names
        m = re.search(r'(?:core\s+)?entity\s*:\s*([a-zA-Z/]+)', constraint, re.IGNORECASE)
        if m:
            for part in m.group(1).split('/'):
                part = part.strip()
                if part:
                    # Normalize: "users" -> "User"
                    normalized = part.capitalize().rstrip('s') if part[0].islower() else part
                    entities.append(normalized)
    return list(dict.fromkeys(entities))  # dedupe preserving order


def _extract_resources(constraints: list[str]) -> list[str]:
    """Extract API resource names from api constraints."""
    resources = []
    for constraint in constraints:
        # "GET /v1/tasks" or "POST /api/users"
        for m in re.finditer(r'(?:GET|POST|PUT|PATCH|DELETE)\s+/(?:v\d+/|api/)?(\w+)', constraint):
            raw = m.group(1)
            # Singularize: "tasks" -> "task", "cities" -> "city"
            if raw.endswith('ies'):
                name = raw[:-3] + 'y'
            elif raw.endswith('s') and not raw.endswith('ss'):
                name = raw[:-1]
            else:
                name = raw
            if name and name not in resources:
                resources.append(name)
        # "Resource: tasks" or "Endpoints: /tasks, /users"
        m = re.search(r'(?:Resource|Endpoint)s?\s*:\s*(.+)', constraint, re.IGNORECASE)
        if m:
            for part in re.split(r'[,;]+', m.group(1)):
                part = part.strip().strip('/').split('/')[-1].rstrip('s')
                if part and part not in resources:
                    resources.append(part)
    return resources


# ── Pattern-based component extractor ──

class PatternComponentExtractor:
    """Extracts components from parsed spec sections using regex heuristics."""

    def extract(self, sections: dict[str, list[str]]) -> tuple[list[Component], list[DependencyEdge]]:
        """Extract components and dependency edges from spec sections.

        Args:
            sections: dict mapping channel_id to list of constraint strings

        Returns:
            (components, edges)
        """
        components: list[Component] = []
        component_ids: set[str] = set()

        def _add(comp: Component):
            if comp.id not in component_ids:
                components.append(comp)
                component_ids.add(comp.id)

        # ── Data Model → Model components ──
        entities = _extract_entities(sections.get("data_model", []))
        for entity in entities:
            cid = f"{entity.lower()}-model"
            _add(Component(
                id=cid,
                name=f"{entity}Model",
                description=f"{entity} entity and persistence",
                component_type="model",
                channel_sources=["data_model"],
                constraints=[c for c in sections.get("data_model", []) if entity.lower() in c.lower()],
                interfaces_provided=[f"I{entity}Repository"],
                estimated_complexity="low",
            ))

        # ── Tech Stack → Config components ──
        tech_constraints = sections.get("tech_stack", [])
        for constraint in tech_constraints:
            if re.search(r'Database\s*:', constraint, re.IGNORECASE):
                _add(Component(
                    id="database-config",
                    name="DatabaseConfig",
                    description="Database connection and configuration",
                    component_type="config",
                    channel_sources=["tech_stack"],
                    constraints=[constraint],
                    estimated_complexity="low",
                ))
            if re.search(r'Cache\s*:', constraint, re.IGNORECASE):
                _add(Component(
                    id="cache-service",
                    name="CacheService",
                    description="Caching layer configuration and operations",
                    component_type="service",
                    channel_sources=["tech_stack", "performance"],
                    constraints=[constraint],
                    interfaces_provided=["ICacheService"],
                    estimated_complexity="medium",
                ))
            if re.search(r'(?:Message|Queue|Broker|Event)\s*:', constraint, re.IGNORECASE):
                # Skip "not needed" / "none" / "no message queue"
                if not re.search(r'not\s+needed|none|no\s+(?:message|queue)', constraint, re.IGNORECASE):
                    _add(Component(
                        id="message-queue",
                        name="MessageQueue",
                        description="Message broker configuration",
                        component_type="config",
                        channel_sources=["tech_stack"],
                        constraints=[constraint],
                        estimated_complexity="low",
                    ))

        # ── Auth → AuthService + AuthMiddleware ──
        auth_constraints = sections.get("auth", [])
        if auth_constraints:
            _add(Component(
                id="auth-service",
                name="AuthService",
                description="Authentication and token management",
                component_type="service",
                channel_sources=["auth"],
                constraints=auth_constraints,
                interfaces_provided=["IAuthService"],
                estimated_complexity="high",
            ))
            _add(Component(
                id="auth-middleware",
                name="AuthMiddleware",
                description="Request authentication and authorization middleware",
                component_type="middleware",
                channel_sources=["auth"],
                constraints=auth_constraints,
                interfaces_consumed=["IAuthService"],
                estimated_complexity="medium",
            ))

        # ── API → Handler components ──
        api_constraints = sections.get("api", [])
        resources = _extract_resources(api_constraints)
        if not resources and entities:
            # Fall back to using entity names as resources
            resources = [e.lower() for e in entities]

        for resource in resources:
            cid = f"{resource.lower()}-handler"
            cap = resource.capitalize()
            model_deps = [f"{resource.lower()}-model"] if f"{resource.lower()}-model" in component_ids else []
            _add(Component(
                id=cid,
                name=f"{cap}Handler",
                description=f"REST endpoints for {resource} resource",
                component_type="handler",
                channel_sources=["api"],
                constraints=[c for c in api_constraints if resource.lower() in c.lower()],
                dependencies=model_deps,
                interfaces_consumed=["IAuthService"] if auth_constraints else [],
                estimated_complexity="medium",
            ))

        # WebSocket handler (skip if "No WebSocket" or "not needed")
        for constraint in api_constraints:
            if re.search(r'WebSocket|/ws/', constraint, re.IGNORECASE) and \
               not re.search(r'no\s+WebSocket|not\s+needed', constraint, re.IGNORECASE):
                _add(Component(
                    id="websocket-handler",
                    name="WebSocketHandler",
                    description="WebSocket real-time event handler",
                    component_type="handler",
                    channel_sources=["api"],
                    constraints=[constraint],
                    interfaces_consumed=["ICacheService"] if "cache-service" in component_ids else [],
                    estimated_complexity="high",
                ))
                break

        # ── Error Handling → ErrorHandler ──
        error_constraints = sections.get("error_handling", [])
        if error_constraints:
            _add(Component(
                id="error-handler",
                name="ErrorHandler",
                description="Error taxonomy, circuit breaker, structured logging",
                component_type="middleware",
                channel_sources=["error_handling"],
                constraints=error_constraints,
                estimated_complexity="medium",
            ))

        # ── Security → RateLimiter + SecurityMiddleware ──
        security_constraints = sections.get("security", [])
        for constraint in security_constraints:
            if re.search(r'rate\s*limit', constraint, re.IGNORECASE):
                _add(Component(
                    id="rate-limiter",
                    name="RateLimiter",
                    description="Rate limiting middleware",
                    component_type="middleware",
                    channel_sources=["security"],
                    constraints=[constraint],
                    estimated_complexity="medium",
                ))
            if re.search(r'(?:input.valid|CORS|encrypt)', constraint, re.IGNORECASE):
                _add(Component(
                    id="security-middleware",
                    name="SecurityMiddleware",
                    description="Input validation, CORS, encryption enforcement",
                    component_type="middleware",
                    channel_sources=["security"],
                    constraints=[constraint],
                    estimated_complexity="medium",
                ))

        # ── Deployment → DeploymentConfig ──
        deploy_constraints = sections.get("deployment", [])
        if deploy_constraints:
            _add(Component(
                id="deployment-config",
                name="DeploymentConfig",
                description="Infrastructure, CI/CD, environment configuration",
                component_type="config",
                channel_sources=["deployment"],
                constraints=deploy_constraints,
                estimated_complexity="medium",
            ))

        # ── Testing → TestSuite ──
        test_constraints = sections.get("testing", [])
        if test_constraints:
            _add(Component(
                id="test-suite",
                name="TestSuite",
                description="Test strategy, fixtures, CI integration",
                component_type="test",
                channel_sources=["testing"],
                constraints=test_constraints,
                estimated_complexity="medium",
            ))

        # ── Build dependency edges ──
        edges = self._build_edges(components)

        return components, edges

    def _build_edges(self, components: list[Component]) -> list[DependencyEdge]:
        """Build dependency edges from component type ordering and interface matching."""
        edges: list[DependencyEdge] = []
        seen: set[tuple[str, str]] = set()
        comp_map = {c.id: c for c in components}

        # Type-order based dependencies — selective, not exhaustive
        for comp in components:
            comp_tier = TYPE_ORDER.get(comp.component_type, 3)
            comp_channels = set(comp.channel_sources)
            for dep in components:
                if dep.id == comp.id:
                    continue
                dep_tier = TYPE_ORDER.get(dep.component_type, 3)
                if comp_tier <= dep_tier:
                    continue

                dep_channels = set(dep.channel_sources)
                should_link = False

                # Same-channel dependency (e.g., auth service → auth middleware)
                if comp_channels & dep_channels:
                    should_link = True
                # Database config is a universal foundation
                elif dep.id == "database-config" and comp.component_type in ("service", "handler"):
                    should_link = True
                # Services depend on models from related domains
                elif dep.component_type == "model" and comp.component_type in ("service", "handler"):
                    # Link if model entity appears in component's constraints or name
                    entity = dep.name.replace("Model", "").lower()
                    if entity in comp.id or entity in comp.description.lower():
                        should_link = True

                if should_link:
                    key = (comp.id, dep.id)
                    if key not in seen:
                        edges.append(DependencyEdge(
                            from_component=comp.id,
                            to_component=dep.id,
                            reason=f"{comp.component_type} depends on {dep.component_type}",
                        ))
                        seen.add(key)

        # Interface matching: if A provides what B consumes
        providers: dict[str, str] = {}
        for comp in components:
            for iface in comp.interfaces_provided:
                providers[iface] = comp.id

        for comp in components:
            for iface in comp.interfaces_consumed:
                if iface in providers:
                    provider_id = providers[iface]
                    if provider_id != comp.id:
                        key = (comp.id, provider_id)
                        if key not in seen:
                            edges.append(DependencyEdge(
                                from_component=comp.id,
                                to_component=provider_id,
                                reason=f"consumes {iface}",
                            ))
                            seen.add(key)

        # Explicit dependencies from component.dependencies field
        for comp in components:
            for dep_id in comp.dependencies:
                if dep_id in comp_map:
                    key = (comp.id, dep_id)
                    if key not in seen:
                        edges.append(DependencyEdge(
                            from_component=comp.id,
                            to_component=dep_id,
                            reason="explicit dependency",
                        ))
                        seen.add(key)

        return edges

    def generate_interfaces(self, components: list[Component],
                            sections: dict[str, list[str]]) -> list[InterfaceContract]:
        """Generate interface contracts from components."""
        interfaces: list[InterfaceContract] = []
        seen_names: set[str] = set()

        for comp in components:
            for iface_name in comp.interfaces_provided:
                if iface_name in seen_names:
                    continue
                seen_names.add(iface_name)

                methods: list[str] = []
                data_types: list[str] = []

                if comp.component_type == "model":
                    # Repository interface with CRUD
                    entity = comp.name.replace("Model", "")
                    methods = [
                        f"create({entity.lower()}: Create{entity}DTO) -> {entity}",
                        f"get_by_id(id: str) -> {entity} | None",
                        f"update(id: str, data: Update{entity}DTO) -> {entity}",
                        f"delete(id: str) -> bool",
                        f"list(filters: dict) -> list[{entity}]",
                    ]
                    data_types = [f"Create{entity}DTO", f"Update{entity}DTO", entity]
                elif "Auth" in comp.name:
                    methods = [
                        "authenticate(credentials: AuthCredentials) -> AuthToken",
                        "validate_token(token: str) -> TokenPayload",
                        "authorize(user_id: str, permission: str) -> bool",
                    ]
                    data_types = ["AuthCredentials", "AuthToken", "TokenPayload"]
                elif "Cache" in comp.name:
                    methods = [
                        "get(key: str) -> Any | None",
                        "set(key: str, value: Any, ttl: int) -> bool",
                        "delete(key: str) -> bool",
                        "invalidate_pattern(pattern: str) -> int",
                    ]
                    data_types = []

                interfaces.append(InterfaceContract(
                    name=iface_name,
                    component_name=comp.name,
                    methods=methods,
                    data_types=data_types,
                    channel_sources=list(comp.channel_sources),
                ))

        return interfaces
