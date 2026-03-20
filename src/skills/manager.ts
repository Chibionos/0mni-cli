import { loadSkills, type Skill } from './loader.js';
import { debug } from '../utils/logger.js';

export class SkillManager {
  private skills: Skill[] = [];
  private readonly skillDirs: string[];

  constructor(skillDirs: string[]) {
    this.skillDirs = skillDirs;
  }

  async loadAll(): Promise<void> {
    this.skills = await loadSkills(this.skillDirs);
    debug(`SkillManager loaded ${this.skills.length} skill(s)`);
  }

  getSkills(): Skill[] {
    return [...this.skills];
  }

  getSkill(name: string): Skill | undefined {
    return this.skills.find((s) => s.name === name);
  }

  getSystemPromptAdditions(): string {
    if (this.skills.length === 0) return '';

    const sections = this.skills.map(
      (skill) =>
        `<skill name="${skill.name}">\n${skill.instructions}\n</skill>`,
    );

    return [
      '# Active Skills',
      '',
      ...sections,
    ].join('\n');
  }

  listSkills(): Array<{ name: string; description: string }> {
    return this.skills.map((s) => ({
      name: s.name,
      description: s.description,
    }));
  }
}
