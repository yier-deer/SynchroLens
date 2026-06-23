import type { PersonalDictEntry, TranslationConstraint } from '../../../shared/types';
import { TerminologyResolver } from '../dictionary/TerminologyResolver';

interface PersonalizationResolverDependencies {
  terminologyResolver: TerminologyResolver;
  getPersonalEntries: () => PersonalDictEntry[];
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function toConstraint(entry: PersonalDictEntry, matchType: 'exact' | 'similar', score?: number): TranslationConstraint {
  return {
    source: entry.source.trim(),
    target: entry.target.trim(),
    sourceType: 'personal',
    priority: 3,
    matchType,
    enforceMode: 'sentence',
    entryId: entry.id,
    score,
  };
}

export class PersonalizationResolver {
  constructor(private readonly deps: PersonalizationResolverDependencies) {}

  async resolve(text: string): Promise<TranslationConstraint[]> {
    const normalized = normalize(text);
    if (!normalized) {
      return [];
    }

    const exactMatches = this.deps
      .getPersonalEntries()
      .filter((entry) => {
        const source = normalize(entry.source);
        return source.length > 0 && normalized.includes(source);
      })
      .map((entry) => toConstraint(entry, 'exact'));

    const terminologyMatches = this.deps
      .terminologyResolver
      .resolve(text)
      .filter((constraint) => constraint.sourceType !== 'personal');

    return this.mergeConstraints([...exactMatches, ...terminologyMatches]);
  }

  private mergeConstraints(constraints: TranslationConstraint[]): TranslationConstraint[] {
    const bestBySource = new Map<string, TranslationConstraint>();

    for (const constraint of constraints) {
      const key = normalize(constraint.source);
      const current = bestBySource.get(key);
      if (!current || constraint.priority > current.priority) {
        bestBySource.set(key, constraint);
        continue;
      }

      if (constraint.priority === current.priority && constraint.matchType === 'exact' && current.matchType !== 'exact') {
        bestBySource.set(key, constraint);
      }
    }

    return Array.from(bestBySource.values()).sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }
      if (left.matchType !== right.matchType) {
        return left.matchType === 'exact' ? -1 : 1;
      }
      return right.source.length - left.source.length;
    });
  }
}
