---
name: writing-guidelines
description: Review docs/prose for Writing Guidelines compliance. Use when asked to "review my docs", "check writing style", "audit prose", "review docs voice and tone", or "check this page against the writing handbook".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Writing Guidelines

Review files for compliance with Writing Guidelines.

## How It Works

1. Read the guidelines from `references/guidelines.md` (next to this SKILL.md)
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in the fetched guidelines
4. Output findings in the terse `file:line` format

## Guidelines Source

The guidelines are vendored in `references/guidelines.md`, a snapshot of the upstream `command.md` so reviews work offline and can't change underneath you. The file contains all the rules and output format instructions.

Upstream: https://raw.githubusercontent.com/vercel-labs/writing-guidelines/main/command.md

## Usage

When a user provides a file or pattern argument:
1. Read `references/guidelines.md`
2. Read the specified files
3. Apply all rules from the fetched guidelines
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.
