export interface PolicyCategory {
  id: string;
  label: string;
  keywords: string[];
}

export const DEFAULT_POLICY_CATEGORIES: PolicyCategory[] = [
  {
    id: "alcohol",
    label: "alcohol-related content",
    keywords: ["alcohol", "beer", "whiskey", "vodka", "wine", "liquor", "drunk"],
  },
  {
    id: "drugs",
    label: "drug-related content",
    keywords: ["cocaine", "heroin", "meth", "fentanyl", "opioid", "narcotic"],
  },
  {
    id: "sexual",
    label: "sexual content",
    keywords: ["pornography", "explicit sex", "nsfw"],
  },
  {
    id: "crime",
    label: "crime",
    keywords: ["how to rob", "how to steal", "murder how", "assault how"],
  },
  {
    id: "illegal",
    label: "illegal activity",
    keywords: ["piracy how", "counterfeit", "launder money"],
  },
  {
    id: "unethical",
    label: "unethical activity",
    keywords: ["harass", "dox", "stalk someone"],
  },
];

export interface PolicyMatch {
  categoryId: string;
  categoryLabel: string;
  matchedKeyword: string;
}

export function evaluatePolicy(
  input: string,
  categories: PolicyCategory[] = DEFAULT_POLICY_CATEGORIES,
): PolicyMatch | null {
  const haystack = input.toLowerCase();
  for (const category of categories) {
    for (const keyword of category.keywords) {
      if (haystack.includes(keyword.toLowerCase())) {
        return {
          categoryId: category.id,
          categoryLabel: category.label,
          matchedKeyword: keyword,
        };
      }
    }
  }
  return null;
}
