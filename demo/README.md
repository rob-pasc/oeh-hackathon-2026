# demo

Scan JSON files and pre-generated caches for the seeded demo devices on the public deployment ([feature 005](../docs/features/feature-005-public-demo-deployment/PLAN.md)). They let demo results render without live LLM calls. Since feature 008 the cache that matters for the result screen is `category_cache` (with `fact_cache`); `explanation_cache` is no longer used by the report stream.

The selected models are the ThinkPad T480, XPS 13 9360 and EliteBook 840 G5. Real scan files, caches and the seed command are pending.
