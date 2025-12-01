# Contributing

</div>

We welcome contributions to Mentingo! Please check our Contributing Guide for guidelines about how to proceed.

### 📚 Naming Conventions: Branches, Commits, and Pull Requests

To ensure consistency and clarity across our development workflow, we follow the naming conventions outlined below:

---

#### 🔀 Branch Naming

Each branch name should follow this pattern:

`[initials]_[type]_[module]_[ticket]_[short_description]`

**Components:**

- `initials` – First letter of the author's first and last name, in lowercase (e.g., `jd` for _John Doe_)
- `type` – Type of change:
  - `feat` – New feature
  - `fix` – Bug fix
  - `chore` – Maintenance or build-related tasks
  - `refactor` – Code refactoring without functional changes
- `module` – Relevant module or system (e.g. `lms`)
- `ticket` – Ticket or issue number (e.g. `459`)
- `short_description` _(optional)_ – Brief description in `snake_case`

**Example:**

```
jd_feat_lms_459_implement_sso
```

---

#### ✅ Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

**Format:**

```
<prefix>: description of the change
```

**Examples:**

```
feat: implement SSO authentication
fix: resolve token expiration issue
```

---

#### 📦 Pull Requests

Pull Requests should:

- Use conventional title format:

```
feat: Implement SSO authentication
fix: Resolve token expiration issue
refactor: Simplify chart rendering logic
```

- If you have access to ticket number link it using `#ticketId`
- Follow the project's PR template and fill out all required sections
- Provide a brief description of the change and link to the related ticket
- Include video, screenshots, test results, or instructions if applicable
