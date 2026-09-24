/**
 * SkillSync NLP Resume Scorer
 * 
 * Re-implementation of the SkillSync Python NLP model (nlp.py) in TypeScript.
 * Uses exact skill extraction, canonical alias mapping, JD term coverage,
 * sublinear TF-IDF cosine similarity, and 70/30 skill/TF-IDF weighting.
 */

// ─── SKILL DICTIONARY ──────────────────────────────────────────────
export const SKILLS: string[] = [
  // IT / Software / Data Science / DevOps
  "python", "java", "c++", "c#", "c", "javascript", "typescript", "go", "golang", "rust",
  "ruby", "php", "swift", "kotlin", "scala", "r", "html", "css", "sql",
  "react", "react.js", "next.js", "vue.js", "angular", "node.js", "express", "express.js",
  "django", "flask", "fastapi", "spring boot", "spring", "asp.net", "laravel", "bootstrap", "tailwind",
  "mysql", "postgresql", "postgres", "mongodb", "redis", "sqlite", "oracle", "dynamodb", "cassandra", "elasticsearch",
  "aws", "azure", "gcp", "cloud", "docker", "kubernetes", "k8s", "terraform", "ansible", "jenkins", "ci/cd",
  "git", "github", "gitlab", "linux", "unix", "bash", "shell",
  "rest api", "restful api", "graphql", "microservices",
  "machine learning", "deep learning", "nlp", "natural language processing", "tensorflow", "pytorch",
  "scikit-learn", "pandas", "numpy", "opencv", "data analysis", "data science", "neural networks", "computer vision",
  "programming", "web development",

  // HR
  "recruitment", "talent acquisition", "employee relations", "talent management", "human resources", "hris",
  "onboarding", "performance management", "payroll", "employee engagement", "compensation", "benefits",
  "labor laws", "succession planning", "conflict resolution", "interviewing", "sourcing",

  // Finance / Accounting
  "financial analysis", "accounting", "financial reporting", "financial planning", "auditing", "budgeting",
  "forecasting", "taxation", "bookkeeping", "risk management", "compliance", "treasury", "portfolio management",
  "cash flow", "quickbooks", "sap", "tally", "excel", "financial modeling", "investment banking", "wealth management",
  "credit analysis", "loans", "retail banking", "commercial banking", "reconciliation", "financial statements",

  // Healthcare
  "patient care", "clinical", "nursing", "medical records", "emr", "ehr", "healthcare management", "triage",
  "phlebotomy", "diagnostics", "patient safety", "pharmacology", "icu", "cpr", "bls", "vital signs",
  "health information management", "patient assessment",

  // Sales / Marketing
  "sales", "business development", "lead generation", "crm", "salesforce", "account management", "negotiation",
  "client relations", "b2b", "b2c", "cold calling", "digital marketing", "seo", "sem", "content marketing",
  "social media marketing", "google analytics", "copywriting", "public relations", "brand management",
  "media relations", "press releases", "campaign management", "market research", "marketing strategy",

  // Design
  "ui/ux", "graphic design", "photoshop", "illustrator", "figma", "adobe xd", "indesign", "wireframing",
  "prototyping", "user research", "fashion design", "textile design", "apparel design", "creative direction",
  "sketching", "adobe creative suite",

  // Other Domains
  "aviation", "flight operations", "aircraft maintenance", "cabin crew", "air traffic control",
  "automotive engineering", "vehicle maintenance", "autocad", "cad", "quality control",
  "construction management", "site supervision", "civil engineering", "project planning", "building codes",
  "agronomy", "crop management", "soil science", "agricultural engineering", "irrigation",
  "culinary arts", "food preparation", "menu planning", "kitchen management", "food safety", "haccp",
  "bpo", "customer service", "call center", "technical support", "helpdesk", "ticket resolution",
  "legal research", "litigation", "contract drafting", "corporate law", "legal compliance", "legal advisory",
  "personal training", "fitness instruction", "nutrition", "wellness coaching", "strength training",
  "teaching", "curriculum development", "classroom management", "lesson planning", "educational leadership",
  "management consulting", "strategy", "process improvement", "business analysis", "change management",
];

// ─── CANONICAL SKILL ALIASES ───────────────────────────────────────
export const SKILL_ALIASES: Record<string, string> = {
  "js": "javascript",
  "jscript": "javascript",
  "ts": "typescript",
  "py": "python",
  "ml": "machine learning",
  "dl": "deep learning",
  "react.js": "react",
  "reactjs": "react",
  "node": "node.js",
  "nodejs": "node.js",
  "express.js": "express",
  "expressjs": "express",
  "postgres": "sql",
  "postgresql": "sql",
  "mysql": "sql",
  "pl/sql": "sql",
  "k8s": "kubernetes",
  "hr": "human resources",
  "qa": "quality control",
  "pr": "public relations",
  "ui": "ui/ux",
  "ux": "ui/ux",
};

// ─── GENERIC TERMS TO EXCLUDE ──────────────────────────────────────
export const GENERIC_TERMS = new Set([
  "software engineer",
  "software development",
  "problem solving",
]);

// ─── STOP WORDS ────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
  "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
  "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing",
  "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
  "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself",
  "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is",
  "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself",
  "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves",
  "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so",
  "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then",
  "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those",
  "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll",
  "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where", "where's",
  "which", "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't",
  "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves"
]);

/**
 * Normalize text preserving technical special characters (+, #, ., /, -).
 */
export function normalizeForSkillSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\+\#\.\/\-\s]/g, " ");
}

/**
 * Map detected skill or alias to canonical form.
 */
export function canonicalizeSkill(skill: string): string {
  const norm = skill.toLowerCase().trim();
  return SKILL_ALIASES[norm] || norm;
}

/**
 * Extract canonical skills from text.
 */
export function extractSkills(text: string): string[] {
  if (!text) return [];
  const normText = normalizeForSkillSearch(text);
  const foundSkills = new Set<string>();

  for (const skill of SKILLS) {
    const skillNorm = skill.toLowerCase();
    if (GENERIC_TERMS.has(skillNorm)) continue;

    const escaped = skillNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");

    if (pattern.test(normText)) {
      const canonical = canonicalizeSkill(skillNorm);
      if (!GENERIC_TERMS.has(canonical)) {
        foundSkills.add(canonical);
      }
    }
  }

  for (const [alias, canonical] of Object.entries(SKILL_ALIASES)) {
    if (GENERIC_TERMS.has(alias)) continue;

    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<![a-z0-9])${escapedAlias}(?![a-z0-9])`, "i");

    if (pattern.test(normText)) {
      if (!GENERIC_TERMS.has(canonical)) {
        foundSkills.add(canonical);
      }
    }
  }

  return Array.from(foundSkills).sort();
}

/**
 * Calculate Skill Match percentage between resume and JD.
 */
export function calculateSkillMatch(resumeText: string, jobDescription: string) {
  const resumeSkills = new Set(extractSkills(resumeText));
  const jdSkills = new Set(extractSkills(jobDescription));

  const matchedSkills = Array.from(resumeSkills).filter((s) => jdSkills.has(s)).sort();
  const missingSkills = Array.from(jdSkills).filter((s) => !resumeSkills.has(s)).sort();

  const skillScore = jdSkills.size === 0 ? 0 : (matchedSkills.length / jdSkills.size) * 100;

  return {
    resumeSkills: Array.from(resumeSkills).sort(),
    jdSkills: Array.from(jdSkills).sort(),
    matchedSkills,
    missingSkills,
    skillScore,
  };
}

/**
 * Clean text for TF-IDF (stopwords removal, lowercasing, word tokens).
 */
export function cleanText(text: string): string[] {
  const norm = text.toLowerCase().replace(/[^a-z\s]/g, " ");
  const tokens = norm.split(/\s+/).filter((word) => word.length > 1 && !STOP_WORDS.has(word));
  return tokens;
}

/**
 * Extract unigrams and bigrams from tokens array.
 */
function extractNGrams(tokens: string[]): string[] {
  const ngrams: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    ngrams.push(tokens[i]);
    if (i < tokens.length - 1) {
      ngrams.push(`${tokens[i]} ${tokens[i + 1]}`);
    }
  }
  return ngrams;
}

/**
 * Calculate JD term coverage & Cosine Similarity using TF-IDF (1-grams and 2-grams).
 */
export function calculateSimilarity(resumeText: string, jobDescription: string): number {
  const resumeTokens = cleanText(resumeText);
  const jdTokens = cleanText(jobDescription);

  if (resumeTokens.length === 0 || jdTokens.length === 0) {
    return 0.0;
  }

  const resumeNGrams = extractNGrams(resumeTokens);
  const jdNGrams = extractNGrams(jdTokens);

  const jdFreqs: Record<string, number> = {};
  for (const item of jdNGrams) {
    jdFreqs[item] = (jdFreqs[item] || 0) + 1;
  }

  const resumeFreqs: Record<string, number> = {};
  for (const item of resumeNGrams) {
    resumeFreqs[item] = (resumeFreqs[item] || 0) + 1;
  }

  // Sublinear TF: 1 + log(tf) if tf > 0
  const jdVectors: Record<string, number> = {};
  for (const [gram, freq] of Object.entries(jdFreqs)) {
    jdVectors[gram] = 1 + Math.log(freq);
  }

  const resumeVectors: Record<string, number> = {};
  for (const [gram, freq] of Object.entries(resumeFreqs)) {
    resumeVectors[gram] = 1 + Math.log(freq);
  }

  const jdKeys = Object.keys(jdVectors);
  if (jdKeys.length === 0) return 0.0;

  // JD term coverage
  let matchedWeight = 0.0;
  let totalWeight = 0.0;

  for (const gram of jdKeys) {
    const weight = jdVectors[gram];
    totalWeight += weight;
    if (resumeVectors[gram]) {
      matchedWeight += weight;
    }
  }

  const coverageScore = totalWeight > 0 ? (matchedWeight / totalWeight) * 100 : 0.0;

  // Cosine Similarity
  let dotProduct = 0.0;
  let normJdSq = 0.0;
  let normResSq = 0.0;

  for (const weight of Object.values(jdVectors)) {
    normJdSq += weight * weight;
  }
  for (const weight of Object.values(resumeVectors)) {
    normResSq += weight * weight;
  }

  for (const gram of jdKeys) {
    if (resumeVectors[gram]) {
      dotProduct += jdVectors[gram] * resumeVectors[gram];
    }
  }

  const cosineSim =
    normJdSq > 0 && normResSq > 0
      ? (dotProduct / (Math.sqrt(normJdSq) * Math.sqrt(normResSq))) * 100
      : 0.0;

  return 0.7 * coverageScore + 0.3 * cosineSim;
}

export type SkillSyncVerdict = "Strong Match" | "Moderate Match" | "Fair Match" | "Low Match";

export function getVerdict(score: number): SkillSyncVerdict {
  if (score >= 75) return "Strong Match";
  if (score >= 50) return "Moderate Match";
  if (score >= 25) return "Fair Match";
  return "Low Match";
}

export interface SkillSyncResult {
  tfidfScore: number;
  skillScore: number;
  finalScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  resumeSkills: string[];
  jdSkills: string[];
  verdict: SkillSyncVerdict;
}

/**
 * Calculate final SkillSync score (70% Skill Match + 30% TF-IDF Similarity).
 */
export function calculateSkillSyncScore(resumeText: string, jobDescription: string): SkillSyncResult {
  const skillResult = calculateSkillMatch(resumeText, jobDescription);
  const tfidfScore = calculateSimilarity(resumeText, jobDescription);

  const rawScore = 0.70 * skillResult.skillScore + 0.30 * tfidfScore;
  const finalScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  return {
    tfidfScore: Math.round(tfidfScore * 10) / 10,
    skillScore: Math.round(skillResult.skillScore * 10) / 10,
    finalScore,
    matchedSkills: skillResult.matchedSkills,
    missingSkills: skillResult.missingSkills,
    resumeSkills: skillResult.resumeSkills,
    jdSkills: skillResult.jdSkills,
    verdict: getVerdict(finalScore),
  };
}
