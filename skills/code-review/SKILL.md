---
name: code-review
description: Performs thorough code reviews analyzing correctness, performance, security, and style
license: MIT
---

# Code Review Skill

When asked to review code, follow this process:

1. Read the files or diff to be reviewed
2. Analyze for:
   - **Correctness**: Logic errors, edge cases, null handling
   - **Performance**: N+1 queries, unnecessary allocations, O(n²) where O(n) is possible
   - **Security**: Injection vulnerabilities, auth bypasses, secret exposure
   - **Style**: Naming conventions, code organization, readability
3. Provide feedback organized by severity (critical > warning > suggestion)
4. Include specific line references and suggested fixes
