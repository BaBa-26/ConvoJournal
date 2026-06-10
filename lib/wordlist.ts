// Curated journal vocabulary — emotions, mental health, productivity, time, life.
// Kept as single words for Trie compatibility; multi-word context handled by N-Gram model.

export const WORD_LIST: string[] = [
  // ── Positive emotions ────────────────────────────────────────────────────────
  "happy", "happiness", "joyful", "joy", "content", "contented", "elated", "ecstatic",
  "pleased", "delighted", "cheerful", "blissful", "euphoric", "grateful", "thankful",
  "appreciative", "peaceful", "calm", "serene", "relaxed", "tranquil", "hopeful",
  "optimistic", "confident", "proud", "satisfied", "fulfilled", "excited", "enthusiastic",
  "motivated", "inspired", "energetic", "alive", "refreshed", "grounded", "secure",
  "loved", "valued", "appreciated", "supported", "connected", "belonging",

  // ── Difficult emotions ────────────────────────────────────────────────────────
  "sad", "sadness", "unhappy", "sorrowful", "melancholy", "downhearted", "dejected",
  "disappointed", "discouraged", "disheartened", "heartbroken", "grieving", "grief",
  "lonely", "isolated", "disconnected", "empty", "hollow", "numb", "apathetic",
  "hopeless", "defeated", "stuck", "lost", "helpless", "powerless",
  "anxious", "anxiety", "worried", "nervous", "stressed", "tense", "apprehensive",
  "uneasy", "restless", "overwhelmed", "burnout", "exhausted", "drained", "depleted",
  "tired", "weary", "fatigued", "heavy", "burdened",
  "angry", "frustrated", "irritated", "annoyed", "agitated", "resentful",
  "bitter", "furious", "upset", "confused", "conflicted", "torn",
  "uncertain", "doubtful", "insecure", "scared", "afraid", "fearful",
  "ashamed", "guilty", "embarrassed", "humiliated", "rejected", "abandoned",

  // ── Emotional texture ─────────────────────────────────────────────────────────
  "curious", "intrigued", "fascinated", "surprised", "shocked", "amazed",
  "moved", "touched", "emotional", "vulnerable", "open", "raw", "sensitive",
  "reflective", "thoughtful", "pensive", "nostalgic", "sentimental", "wistful",
  "bittersweet", "ambivalent", "mixed", "complicated", "processing",

  // ── Mental / psychological ────────────────────────────────────────────────────
  "mindset", "perspective", "awareness", "intention", "clarity", "purpose",
  "meaning", "growth", "healing", "recovery", "progress", "boundaries",
  "wellbeing", "balance", "routine", "habits", "pattern", "cycle",
  "breakthrough", "setback", "challenge", "resilience", "strength",
  "courage", "vulnerability", "acceptance", "gratitude", "compassion",
  "forgiveness", "mindfulness", "presence", "grounding", "coping",
  "trigger", "response", "reaction", "automatic", "chosen", "intentional",
  "avoidance", "confronting", "processing", "integrating", "reframing",
  "overthinking", "ruminating", "spiraling", "catastrophizing",

  // ── Reflection verbs ──────────────────────────────────────────────────────────
  "realized", "noticed", "discovered", "understood", "learned", "remembered",
  "forgot", "decided", "chose", "committed", "started", "finished", "completed",
  "accomplished", "struggled", "failed", "succeeded", "tried", "attempted",
  "overcame", "handled", "managed", "faced", "avoided", "reflected",
  "journaled", "wrote", "talked", "shared", "listened", "helped", "supported",
  "celebrated", "mourned", "acknowledged", "accepted", "released", "surrendered",
  "questioned", "doubted", "trusted", "believed", "doubted", "wondered",
  "imagined", "visualized", "planned", "prepared", "anticipated",

  // ── Time words ────────────────────────────────────────────────────────────────
  "today", "yesterday", "tomorrow", "morning", "afternoon", "evening", "tonight",
  "night", "midnight", "noon", "weekend", "weekday", "weekly", "monthly",
  "recently", "lately", "soon", "eventually", "always", "never", "sometimes",
  "usually", "often", "rarely", "occasionally", "earlier", "later",
  "before", "after", "during", "while", "meanwhile", "suddenly", "gradually",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",

  // ── Work / productivity ───────────────────────────────────────────────────────
  "work", "working", "career", "project", "deadline", "meeting", "presentation",
  "goal", "goals", "objective", "plan", "planning", "strategy", "priority",
  "priorities", "task", "tasks", "reminder", "schedule", "appointment",
  "commitment", "productivity", "focus", "distraction", "procrastination",
  "motivation", "discipline", "effort", "result", "outcome", "feedback",
  "review", "performance", "achievement", "milestone", "deadline",
  "collaboration", "communication", "delegation", "responsibility",

  // ── Relationships ─────────────────────────────────────────────────────────────
  "friend", "friends", "family", "partner", "relationship", "colleague",
  "coworker", "manager", "mentor", "therapist", "support", "connection",
  "conversation", "argument", "conflict", "understanding", "empathy",
  "trust", "honesty", "respect", "love", "affection", "intimacy",
  "distance", "boundaries", "dependency", "independence", "companionship",
  "community", "belonging", "social", "introvert", "extrovert",

  // ── Health / body ─────────────────────────────────────────────────────────────
  "sleep", "sleeping", "exercise", "workout", "eating", "food", "health",
  "body", "energy", "rest", "relaxation", "meditation", "yoga", "walk",
  "walking", "running", "breathing", "nutrition", "hydration", "appetite",
  "headache", "tension", "pain", "ache", "sick", "recovering", "healing",

  // ── Life / experience ─────────────────────────────────────────────────────────
  "life", "living", "experience", "moment", "memory", "past", "future",
  "present", "change", "transition", "uncertainty", "adventure", "travel",
  "home", "creative", "creativity", "reading", "music", "nature", "outside",
  "weather", "season", "environment", "space", "comfortable", "uncomfortable",

  // ── Common journal connectives ────────────────────────────────────────────────
  "because", "although", "however", "therefore", "overall", "honestly",
  "actually", "finally", "especially", "particularly", "instead", "despite",
  "regardless", "definitely", "probably", "perhaps", "really", "truly",
  "deeply", "completely", "absolutely", "somehow", "something", "everything",
  "nothing", "anything", "myself", "yourself", "together", "alone",
  "different", "important", "necessary", "difficult", "possible",
  "positive", "negative", "better", "worse", "great", "terrible",
  "amazing", "wonderful", "awful", "beautiful", "meaningful", "helpful",
  "grateful", "thankful", "sorry", "proud", "ashamed", "worried",
];
