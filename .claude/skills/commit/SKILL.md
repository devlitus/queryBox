---
name: commit
description: Create a standardized commit following Conventional Commits format
disable-model-invocation: true
argument-hint: "Separated by features"
---

# Commit Helper

Create a well-structured commit with a properly formatted message following Conventional Commits standard.

## Workflow

1. Review staged changes with `git status` and `git diff --staged`
2. Analyze the type of change (feat, fix, docs, refactor, etc.)
3. Create a concise, imperative message
4. Review the commit before execution

## Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

### Types

- **feat** - A new feature
- **fix** - A bug fix
- **docs** - Documentation changes only
- **style** - Code formatting, missing semicolons, etc. (no code logic change)
- **refactor** - Code refactoring without feature changes
- **test** - Adding or updating tests
- **perf** - Performance improvements
- **chore** - Build, dependencies, tooling (package.json, config files)
- **ci** - CI/CD pipeline changes

### Scope (optional)

The scope specifies what part of the codebase is affected:
- `components` - Component changes
- `api` - API/backend changes
- `config` - Configuration changes
- `deps` - Dependency updates
- Project-specific scopes

### Description Rules

- Use **imperative mood**, present tense ("add feature" not "added feature")
- **Don't capitalize** the first letter
- **No period** at the end
- **Keep under 50 characters** (excluding type and scope)
- Be **specific and clear** about what changed

## Extended Format (for complex commits)

```
feat(scope): short description under 50 chars

Longer explanation of what changed and why.
Can span multiple lines but keep each line under 72 characters.
Explain the motivation and context for the change.

Fixes #123
Refs #456
BREAKING CHANGE: description if it breaks backward compatibility
```

## Your Task

1. Check staged changes:
   ```bash
   git status
   git diff --staged
   ```

2. Determine the commit type based on changes

3. Draft the commit message following the format

4. If using a scope, ensure it matches the codebase areas

5. Execute the commit with proper formatting

6. Verify with `git log -1` to confirm

## References

- [Conventional Commits Standard](./conventional-commits.md)
- [Good & Bad Examples](./examples.md)

## Tips

✅ **DO:**
- Focus each commit on one logical change
- Reference issues/PRs in footer (Fixes #123)
- Use present tense verbs
- Be descriptive but concise

❌ **DON'T:**
- Mix multiple features in one commit
- Use vague messages like "fix bug" or "update"
- Write in past tense
- Make commits too large
