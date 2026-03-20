---
name: test-writer
description: Generates comprehensive test suites matching project conventions
license: MIT
---

# Test Writer Skill

When asked to write tests:

1. Examine existing test files to understand conventions (framework, patterns, naming)
2. Identify the code to test and its dependencies
3. Write tests covering:
   - Happy path
   - Edge cases (empty input, null, boundaries)
   - Error cases
   - Integration points
4. Use the same testing framework found in the project
5. Mock external dependencies, not internal modules
6. Name tests descriptively: "should [expected behavior] when [condition]"
