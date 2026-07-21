import { WORD_LIST } from "./wordlist";
import { activeLocalAccountId } from "./localStore";

// ─── Tokeniser ────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z'\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

// ─── Levenshtein (edit distance) ──────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  // Early exit for large length differences
  if (Math.abs(m - n) > 3) return 99;
  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = i;
    for (let j = 1; j <= n; j++) {
      const next = a[i - 1] === b[j - 1]
        ? row[j - 1]
        : 1 + Math.min(prev, row[j], row[j - 1]);
      row[j - 1] = prev;
      prev = next;
    }
    row[n] = prev;
  }
  return row[n];
}

// ─── Trie ─────────────────────────────────────────────────────────────────────

class TrieNode {
  children: Map<string, TrieNode> = new Map();
  word = "";
  isEnd = false;
}

class Trie {
  private root = new TrieNode();
  private freq: Map<string, number> = new Map();

  insert(word: string, freq = 1) {
    const lw = word.toLowerCase();
    let node = this.root;
    for (const ch of lw) {
      if (!node.children.has(ch)) node.children.set(ch, new TrieNode());
      node = node.children.get(ch)!;
    }
    node.isEnd = true;
    node.word = word;
    this.freq.set(lw, Math.max(freq, this.freq.get(lw) ?? 0));
  }

  bumpFreq(word: string) {
    const lw = word.toLowerCase();
    const next = (this.freq.get(lw) ?? 0) + 1;
    this.freq.set(lw, next);
    this.insert(word, next);
  }

  // Returns words matching the prefix, sorted by frequency descending
  search(prefix: string, limit = 5): string[] {
    const lp = prefix.toLowerCase();
    let node = this.root;
    for (const ch of lp) {
      if (!node.children.has(ch)) return [];
      node = node.children.get(ch)!;
    }
    const results: string[] = [];
    this._dfs(node, results, limit);
    return results.sort(
      (a, b) => (this.freq.get(b.toLowerCase()) ?? 0) - (this.freq.get(a.toLowerCase()) ?? 0)
    );
  }

  private _dfs(node: TrieNode, out: string[], limit: number) {
    if (out.length >= limit) return;
    if (node.isEnd) out.push(node.word);
    for (const child of node.children.values()) {
      if (out.length >= limit) return;
      this._dfs(child, out, limit);
    }
  }
}

// ─── Spell correction (linear Levenshtein scan) ───────────────────────────────

function spellCorrect(word: string, wordList: string[], maxDist = 2): string[] {
  const lw = word.toLowerCase();
  const hits: { word: string; dist: number }[] = [];
  for (const w of wordList) {
    const dist = levenshtein(lw, w.toLowerCase());
    if (dist <= maxDist) hits.push({ word: w, dist });
  }
  return hits.sort((a, b) => a.dist - b.dist).map((h) => h.word);
}

// ─── N-Gram language model ─────────────────────────────────────────────────────

// The model is trained on JOURNAL TEXT, so its storage is per-account — a single global key meant
// one person's private words resurfaced as another's suggestions on a shared browser. Signed-out
// visitors get an in-memory-only model (never persisted): there's no account to attribute it to,
// and a guest's words must not outlive their visit.
const LS_KEY_BASE = "progress_autocomplete_v1";

function lsKey(): string | null {
  const accountId = activeLocalAccountId();
  return accountId ? `${LS_KEY_BASE}:${accountId}` : null;
}

// Drop the pre-namespacing global model once: it may hold n-grams derived from a different
// account's (or a guest's) journal text, so it is deleted rather than adopted.
export function purgeLegacyAutocomplete(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(LS_KEY_BASE); } catch {}
}

type NMap = Record<string, Record<string, number>>;

class NGramModel {
  bigrams: NMap = {};
  trigrams: NMap = {};
  vocab: Record<string, number> = {};

  load(): this {
    if (typeof window === "undefined") return this;
    const key = lsKey();
    if (!key) return this; // signed out — in-memory only
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const d = JSON.parse(raw) as {
          bi?: NMap; tri?: NMap; vocab?: Record<string, number>;
        };
        this.bigrams  = d.bi    ?? {};
        this.trigrams = d.tri   ?? {};
        this.vocab    = d.vocab ?? {};
      }
    } catch { /* ignore storage errors */ }
    return this;
  }

  save(): void {
    if (typeof window === "undefined") return;
    const key = lsKey();
    if (!key) return; // signed out — never persist a guest's journal-derived model
    try {
      localStorage.setItem(key, JSON.stringify({
        bi:    this.bigrams,
        tri:   this.trigrams,
        vocab: this.vocab,
      }));
    } catch { /* ignore quota errors */ }
  }

  train(text: string): void {
    const words = tokenize(text);
    for (const w of words) this.vocab[w] = (this.vocab[w] ?? 0) + 1;

    for (let i = 0; i < words.length - 1; i++) {
      const key = words[i];
      if (!this.bigrams[key]) this.bigrams[key] = {};
      const next = words[i + 1];
      this.bigrams[key][next] = (this.bigrams[key][next] ?? 0) + 1;
    }

    for (let i = 0; i < words.length - 2; i++) {
      const key = `${words[i]} ${words[i + 1]}`;
      if (!this.trigrams[key]) this.trigrams[key] = {};
      const next = words[i + 2];
      this.trigrams[key][next] = (this.trigrams[key][next] ?? 0) + 1;
    }
  }

  // Returns top predicted next words given context words
  predict(context: string[]): string[] {
    let candidates: Record<string, number> = {};

    // Try trigram first (richer context)
    if (context.length >= 2) {
      const key = `${context[context.length - 2]} ${context[context.length - 1]}`;
      candidates = { ...this.trigrams[key] };
    }
    // Fall back to bigram
    if (Object.keys(candidates).length === 0 && context.length >= 1) {
      candidates = { ...this.bigrams[context[context.length - 1]] };
    }

    return Object.entries(candidates)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([w]) => w);
  }
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export interface AutocompleteEngine {
  getSuggestions(text: string, cursor: number): string[];
  train(text: string): void;
}

export function buildAutocompleteEngine(): AutocompleteEngine {
  const trie  = new Trie();
  const ngram = new NGramModel().load();

  // Seed trie from static word list
  for (const w of WORD_LIST) trie.insert(w, 1);

  // Seed trie from user's personal vocab (weighted by frequency)
  for (const [w, freq] of Object.entries(ngram.vocab)) {
    trie.insert(w, freq);
  }

  function getSuggestions(text: string, cursor: number): string[] {
    const before = text.slice(0, cursor);
    if (!before) return [];

    const isAfterSpace = /\s/.test(before[before.length - 1]);
    const allWords     = tokenize(before);

    const currentWord = isAfterSpace ? ""                         : (allWords[allWords.length - 1] ?? "");
    const context     = isAfterSpace ? allWords                   : allWords.slice(0, -1);

    // Mid-word with ≥ 2 chars → prefix search
    if (currentWord.length >= 2) {
      const prefixHits = trie.search(currentWord, 8);

      // Filter out exact match (user already typed it fully)
      const filtered = prefixHits.filter((w) => w.toLowerCase() !== currentWord.toLowerCase());

      if (filtered.length > 0) {
        // Intersect with n-gram context for ranking boost
        if (context.length > 0) {
          const contextSet = new Set(ngram.predict(context));
          const boosted = filtered.filter((w) => contextSet.has(w.toLowerCase()));
          const rest    = filtered.filter((w) => !contextSet.has(w.toLowerCase()));
          return [...boosted, ...rest].slice(0, 3);
        }
        return filtered.slice(0, 3);
      }

      // Nothing from trie → try spell correction (only for words ≥ 4 chars to avoid noise)
      if (currentWord.length >= 4) {
        const corrections = spellCorrect(currentWord, WORD_LIST);
        return corrections.slice(0, 3);
      }

      return [];
    }

    // After space (or < 2 chars typed) → predict next word from context
    if (context.length > 0) {
      const preds = ngram.predict(context);
      // Capitalise first letter if we're at the start of a sentence
      const isStartOfSentence = before.trimEnd().endsWith(".")
        || before.trimEnd().endsWith("!")
        || before.trimEnd().endsWith("?")
        || before.trimStart() === before; // very start of text
      return preds
        .slice(0, 3)
        .map((w) => isStartOfSentence ? w.charAt(0).toUpperCase() + w.slice(1) : w);
    }

    return [];
  }

  function train(text: string): void {
    ngram.train(text);
    // Update trie with newly learned vocabulary
    for (const [w, freq] of Object.entries(ngram.vocab)) {
      trie.insert(w, freq);
    }
    ngram.save();
  }

  return { getSuggestions, train };
}
