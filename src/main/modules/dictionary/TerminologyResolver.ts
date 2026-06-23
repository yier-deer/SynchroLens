import type { DictEntry, DictType, TranslationConstraint } from '../../../shared/types';

interface TerminologyResolverDependencies {
  getLanguageEntries: () => DictEntry[];
  getDomainEntries: () => DictEntry[];
  getPersonalEntries?: () => DictEntry[];
}

const PRIORITY_BY_TYPE: Record<DictType, number> = {
  language: 1,
  domain: 2,
  personal: 3,
};

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function buildConstraint(entry: DictEntry, sourceType: DictType, filePath?: string): TranslationConstraint {
  return {
    source: entry.source.trim(),
    target: entry.target.trim(),
    sourceType,
    priority: PRIORITY_BY_TYPE[sourceType],
    matchType: 'exact',
    enforceMode: sourceType === 'personal' ? 'sentence' : 'term',
    entryId: entry.id,
    filePath,
  };
}

export class TerminologyResolver {
  constructor(private readonly deps: TerminologyResolverDependencies) {}

  resolve(text: string): TranslationConstraint[] {
    const sourceText = text.trim();
    if (!sourceText) {
      return [];
    }

    const candidates: TranslationConstraint[] = [];
    candidates.push(...this.matchEntries(sourceText, 'language', this.deps.getLanguageEntries()));
    candidates.push(...this.matchEntries(sourceText, 'domain', this.deps.getDomainEntries()));
    candidates.push(...this.matchEntries(sourceText, 'personal', this.deps.getPersonalEntries?.() ?? []));

    return this.deduplicate(candidates);
  }

  private matchEntries(text: string, dictType: DictType, entries: DictEntry[]): TranslationConstraint[] {
    const normalizedText = normalize(text);
    return entries
      .filter((entry) => {
        const source = entry.source?.trim();
        const target = entry.target?.trim();
        if (!source || !target) {
          return false;
        }
        return normalizedText.includes(normalize(source));
      })
      .map((entry) => buildConstraint(entry, dictType));
  }

  private deduplicate(constraints: TranslationConstraint[]): TranslationConstraint[] {
    const bestBySource = new Map<string, TranslationConstraint>();

    for (const constraint of constraints) {
      const key = normalize(constraint.source);
      const current = bestBySource.get(key);
      if (!current || constraint.priority > current.priority) {
        bestBySource.set(key, constraint);
        continue;
      }

      if (constraint.priority === current.priority && constraint.source.length > current.source.length) {
        bestBySource.set(key, constraint);
      }
    }

    return Array.from(bestBySource.values()).sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }
      return right.source.length - left.source.length;
    });
  }
}
