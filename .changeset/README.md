# Changesets

Add a changeset for every user-facing package change:

```sh
pnpm changeset
```

Choose the affected packages and semantic version bump, then commit the generated Markdown file with the change. On `main`, the release workflow maintains a version PR. Merging that PR publishes the packages through the protected `npm` GitHub environment, creates npm provenance attestations, pushes Git tags, and writes GitHub release notes.

Repository maintainers must configure the `npm` environment with required reviewers and add an `NPM_TOKEN` environment secret before enabling publishing.
