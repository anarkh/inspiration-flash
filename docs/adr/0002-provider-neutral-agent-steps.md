# Use provider-neutral Agent Steps

The first Personal Agent represents each visible model-driven decision as a provider-neutral Agent Step rather than binding the agent loop to a model provider's native tool-calling format. This makes the loop easier to inspect, teach, validate, and migrate across Model Providers or future Skill Pack runtimes; the trade-off is that the Personal Agent owns schema validation, output repair, and Recovery Attempts instead of delegating those entirely to the provider.
