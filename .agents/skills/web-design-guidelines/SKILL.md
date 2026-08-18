---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

> **Provenance note:** this is a third-party skill authored by Vercel Labs and its rules are fetched
> from that public repository. The "vercel" references here are the *author* of the guidelines and
> have nothing to do with Homiquity's hosting — the app runs on Railway. Don't "correct" them.
> On conflict, Homiquity's own design rules win:
> [`design_guidelines.md`](../../../knowledge-base/handbook/design/design_guidelines.md) and
> [`visual-consistency-standard.md`](../../../knowledge-base/handbook/design/visual-consistency-standard.md)
> (Calm Emerald tokens, the design-token guard, WCAG AA).

## How It Works

1. Fetch the latest guidelines from the source URL below
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in the fetched guidelines
4. Output findings in the terse `file:line` format

## Guidelines Source

Fetch fresh guidelines before each review:

```
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```

Use WebFetch to retrieve the latest rules. The fetched content contains all the rules and output format instructions.

## Usage

When a user provides a file or pattern argument:
1. Fetch guidelines from the source URL above
2. Read the specified files
3. Apply all rules from the fetched guidelines
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.
