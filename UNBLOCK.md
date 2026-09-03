# Unblock main (sole owner only)

**Sole owner:** Pam Richardson (`Pjrich1313`)

This document does **not** change GitHub rules by itself. Only the owner can edit rules in the GitHub UI. After the steps below, owner PRs (for example #187, #188) can merge.

## What is blocking merges

These repository rules currently block updates to `main`:

1. **Required deployments** — environments named `copilot`, `Preview`, and `Production` must succeed (Vercel may be account-blocked).
2. **Review from someone other than the last pusher** — impossible for a sole owner who pushed the branch.
3. **Required status check: CodeQL** — must pass or be removed from required checks.

Direct pushes to `main` are also blocked by the same family of rules.

## Collaborators

As of the last check: **only** `Pjrich1313` (admin). No other human collaborators. The “block” is rules, not unauthorized users.

## Owner steps to unblock (UI)

1. Open **https://github.com/Pjrich1313/Pamela-/settings/rules**
2. Also check **https://github.com/Pjrich1313/Pamela-/settings/branches**
3. Edit the rule that targets **`main`** (or `*`):

| Setting | Action |
|--------|--------|
| Require deployments to succeed | **Off** (or remove `copilot` / `Preview` / `Production`) |
| Require approval of the most recent reviewable push | **Off** |
| Do not allow bypassing the above settings | **Off**, or add `Pjrich1313` as a **bypass** actor |
| Required status checks → CodeQL | **Off** temporarily, or wait until CodeQL is green |

4. **Save** the rule.
5. Merge owner PRs:
   - https://github.com/Pjrich1313/Pamela-/pull/188 — ban auto runs + Copilot agent security
   - https://github.com/Pjrich1313/Pamela-/pull/187 — sole ownership / payout readiness
   - https://github.com/Pjrich1313/Pamela-/pull/189 — this unblock documentation (if open)

Optional: turn strict protection back on **after** those merges, keeping a **bypass** for the sole owner.

## Vercel

If deployments stay required, fix or disconnect Vercel:

- https://vercel.com/knowledge/why-is-my-account-deployment-blocked

Until the Vercel account is unblocked, any “require deployment” rule will keep failing.

## GitHub Actions / CI

Recent CI jobs on policy-only branches failed in a few seconds with **no runner** (`runner_id: 0`) and no logs. That is usually:

- Actions minutes / spending limit on a **private** repo, or
- Actions disabled for the account/repo

Check:

- https://github.com/settings/billing (Actions minutes)
- https://github.com/Pjrich1313/Pamela-/settings/actions

## Enterprise / Copilot Enterprise

Copilot Enterprise does **not** override branch protection or deployment rules. Migrating to an enterprise org is separate (billing + optional repo transfer). See GitHub: [Enterprises](https://github.com/settings/enterprises).

## After unblock

1. Merge ban-auto-runs agent policy onto `main`.
2. Turn off unwanted automatic agents in product settings:
   - https://github.com/settings/copilot
   - https://github.com/copilot/agents
3. Keep sole ownership; do not add collaborators without an explicit owner decision.
