import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import matter from 'gray-matter';
import { expandHome } from '../utils/fs.js';
import { debug } from '../utils/logger.js';

export interface Skill {
  name: string;
  description: string;
  instructions: string;
  allowedTools?: string[];
  metadata?: Record<string, string>;
}

export async function loadSkill(skillPath: string): Promise<Skill> {
  const resolved = resolve(expandHome(skillPath));
  const raw = await readFile(resolved, 'utf-8');
  const { data, content } = matter(raw);

  if (!data.name || typeof data.name !== 'string') {
    throw new Error(`Skill at ${resolved} is missing a "name" in frontmatter`);
  }

  return {
    name: data.name,
    description: data.description ?? '',
    instructions: content.trim(),
    allowedTools: Array.isArray(data.allowedTools)
      ? data.allowedTools
      : undefined,
    metadata: extractMetadata(data),
  };
}

export async function loadSkills(dirs: string[]): Promise<Skill[]> {
  const skills: Skill[] = [];

  for (const dir of dirs) {
    const resolved = resolve(expandHome(dir));

    try {
      const dirStat = await stat(resolved);
      if (!dirStat.isDirectory()) continue;
    } catch {
      debug(`Skill directory not found, skipping: ${resolved}`);
      continue;
    }

    const entries = await readdir(resolved, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillMdPath = join(resolved, entry.name, 'SKILL.md');
      try {
        const skill = await loadSkill(skillMdPath);
        skills.push(skill);
        debug(`Loaded skill: ${skill.name} from ${skillMdPath}`);
      } catch {
        debug(`No valid SKILL.md in ${join(resolved, entry.name)}`);
      }
    }
  }

  return skills;
}

function extractMetadata(
  data: Record<string, unknown>,
): Record<string, string> | undefined {
  const reserved = new Set([
    'name',
    'description',
    'allowedTools',
  ]);

  const meta: Record<string, string> = {};
  let hasEntries = false;

  for (const [key, value] of Object.entries(data)) {
    if (reserved.has(key)) continue;
    if (typeof value === 'string') {
      meta[key] = value;
      hasEntries = true;
    }
  }

  return hasEntries ? meta : undefined;
}
