import { bindings, defineConfig } from "cf/config";

export default defineConfig({
	worker: {
		name: "growthegrid",
		compatibilityDate: "2026-10-01",
		compatibilityFlags: ["nodejs_compat"],
		// Request logs off: the privacy note promises no per-visitor logs.
		observability: { enabled: true, logs: { invocationLogs: false } },
		domains: ["growthegrid.ca", "www.growthegrid.ca"],
		// Keep the workers.dev URL up: listing domains turns it off by default.
		workersDev: true,
		env: {
			// Letter counter. cf provisions the namespace on first deploy.
			COUNTER: bindings.kv({}),
			// Random salt for the counter's one-day IP code, so the code cannot be reversed.
			IP_SALT: bindings.secret(),
			// Anonymous funnel steps from /api/event; query with the Analytics Engine SQL API (scripts/funnel.sh).
			EVENTS: bindings.analyticsEngineDataset({ name: "growthegrid_events" }),
			// Update list (opt-in emails). Schema in migrations/; apply with `cf d1 migrations apply`.
			LIST: bindings.d1({ name: "growthegrid-list" }),
			// Turnstile secret for the update-list form (widget "growthegrid.ca update list").
			TURNSTILE_SECRET: bindings.secret(),
		},
	},
});
