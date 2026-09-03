# Bots policy — Pamela-

**Automatic runs are BANNED.**

Sole owner: **Pam Richardson** (`Pjrich1313`).

No agent or bot may open branches, commits, or pull requests unless the sole owner explicitly assigns that specific task.

## Active automation currently detected

These appear under Actions / agent workflows and must be treated as **off for automatic use**:

| Name | Type |
|------|------|
| Copilot cloud agent | Agent |
| Copilot code review | Agent |
| Copilot (PR reviewer) | Agent |
| OpenAI Codex | Third-party agent |
| Claude (Anthropic) | Third-party agent |
| Dependabot Updates | Dependency bot |
| Build / CI / CodeQL | CI (allowed for security checks on push/PR) |

Collaborators: owner only (`Pjrich1313` admin). No other human collaborators.

## Turn automatic agents OFF (owner must do this in GitHub UI)

API tools cannot disable these product settings. Use the UI:

### 1. Copilot cloud agent (stop auto coding agents)

1. Open **https://github.com/settings/copilot**
2. Open **Coding agent** / **Policies** for repositories
3. For **Pamela-**, disable or opt out of **Copilot cloud agent**
4. Disable **third-party coding agents** (Claude, Codex) if listed

Also: **Repository → Settings → Copilot** (if shown) → turn off coding agent for this repo.

### 2. Dependabot automatic PRs

1. **Pamela- → Settings → Code security**
2. Under **Dependabot**, disable **Dependabot version updates** and/or **Dependabot security updates** if you do not want auto PRs

### 3. Do not assign issues to bots

- Never assign issues to **Copilot**, **Claude**, or **Codex** unless you intend that one task
- Remove bot assignees from open issues if they were auto-assigned

### 4. Cancel running agent sessions

1. Open **https://github.com/copilot/agents** (Agents tab)
2. Stop any active sessions on **Pamela-**

## Allowed without new agent PRs

- CodeQL / secret scanning on push or PR
- Manual CI when you push or open a PR yourself
- Work you explicitly request from an agent for a single, named task

## Policy file

Custom agent rules (including this ban) live in:

`.github/agents/my-agent.agent.md`
