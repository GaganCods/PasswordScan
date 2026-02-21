/**
 * strength-engine.js
 * Password Strength Analysis Engine
 * Pure functions only — no DOM access.
 * @module strengthEngine
 */

'use strict';

// ── COMMON PASSWORD DICTIONARY ─────────────────────────────────────────────
const COMMON_PASSWORDS = new Set([
  'password','password1','password123','123456','12345678','1234567890',
  '123456789','qwerty','abc123','111111','letmein','monkey','dragon',
  'master','sunshine','princess','welcome','shadow','superman','michael',
  'football','baseball','soccer','hockey','batman','trustno1','iloveyou',
  'admin','login','pass','test','guest','user','hello','world',
  'qwerty123','qwertyuiop','asdfgh','asdfghjkl','zxcvbnm','pass1234',
  '1q2w3e4r','1qaz2wsx','q1w2e3r4','password!','p@ssword','p@ss1234',
  'passw0rd','pa$$word','passw0rd!','p@ssw0rd','changeme','letmein1',
  '000000','654321','123321','112233','121212','696969','777777','999999',
  '1234','12345','123123','111222','1234567','7654321','987654321',
  'joshua','jessica','charlie','andrew','thomas','hunter','ranger',
  'daniel','george','jordan','harley','austin','taylor','robert',
  'access','flower','matrix','killer','secret','cheese','butter',
  'apple','banana','orange','summer','winter','spring','autumn','season',
  'coffee','cookie','cupcake','freedom','america','united','starwars',
  'batman1','spiderman','avengers','thrones','gaming','player1',
  'nintendo','playstation','xbox360','internet','computer','keyboard',
  'windows','android','iphone','google','facebook','twitter','instagram',
  'linkedin','youtube','amazon','netflix','spotify','discord','reddit',
  'qaz123','wsx456','edc789','rfv000','tgb111','yhn222','ujm333',
  'abc1234','abcd1234','abcde123','abcdefgh','aaaaaa','bbbbbb',
  '123qwe','qwe123','asd123','zxc123','1111111','22222222','33333333',
  'pass12','pass123','pass1234','admin123','root123','toor','root',
  'alpine','centos','debian','ubuntu','kali','parrot','archlinux',
  'love','hate','life','live','real','fake','good','evil','sexy',
  'sex','god','dog','cat','fish','bird','lion','wolf','bear','tiger',
  'ncc1701','2112','42','007','1337','31337','1234abcd','abcd4321',
]);

// ── SEQUENTIAL PATTERN SETS ────────────────────────────────────────────────
const SEQUENCES = [
  'abcdefghijklmnopqrstuvwxyz',
  'qwertyuiopasdfghjklzxcvbnm',
  'qwertyuiop','asdfghjkl','zxcvbnm',
  '01234567890','09876543210',
];

// ── KEYBOARD PATTERNS ──────────────────────────────────────────────────────
const KEYBOARD_PATTERNS = [
  'qwerty','asdfgh','zxcvbn','qazwsx','edcrfv','tgbyhn','ujmikl',
  '!@#$%^','!qaz','2wsx','#edc','$rfv','%tgb','^yhn','&ujm',
];

// ── HELPER: Detect sequential characters ──────────────────────────────────
function hasSequential(pwd) {
  const lower = pwd.toLowerCase();
  for (const seq of SEQUENCES) {
    for (let i = 0; i < seq.length - 2; i++) {
      const chunk = seq.slice(i, i + 3);
      if (lower.includes(chunk)) return true;
    }
  }
  return false;
}

// ── HELPER: Detect keyboard patterns ──────────────────────────────────────
function hasKeyboardPattern(pwd) {
  const lower = pwd.toLowerCase();
  for (const pat of KEYBOARD_PATTERNS) {
    if (lower.includes(pat)) return true;
  }
  return false;
}

// ── HELPER: Detect repeated characters ────────────────────────────────────
function getRepetitionPenalty(pwd) {
  // Count repeated consecutive characters
  let penalty = 0;
  let run = 1;
  for (let i = 1; i < pwd.length; i++) {
    if (pwd[i].toLowerCase() === pwd[i - 1].toLowerCase()) {
      run++;
      if (run === 3) penalty += 3;
      else if (run > 3) penalty += 2;
    } else {
      run = 1;
    }
  }
  // Count character frequency dominance
  const freq = {};
  for (const ch of pwd.toLowerCase()) {
    freq[ch] = (freq[ch] || 0) + 1;
  }
  const maxFreq = Math.max(...Object.values(freq));
  if (pwd.length > 0 && maxFreq / pwd.length > 0.5) penalty += 5;
  return Math.min(penalty, 15);
}

// ── HELPER: Estimate crack time ────────────────────────────────────────────
function estimateCrackTime(entropy) {
  // Assume 10 billion guesses/second (offline fast hash)
  const GUESSES_PER_SEC = 1e10;
  const combinations = Math.pow(2, entropy);
  const seconds = combinations / GUESSES_PER_SEC / 2; // average

  if (seconds < 0.001)   return 'Instant';
  if (seconds < 1)       return 'Less than a second';
  if (seconds < 60)      return `${Math.round(seconds)} seconds`;
  if (seconds < 3600)    return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400)   return `${Math.round(seconds / 3600)} hours`;
  if (seconds < 2592000) return `${Math.round(seconds / 86400)} days`;
  if (seconds < 31536000)return `${Math.round(seconds / 2592000)} months`;

  const years = seconds / 31536000;
  if (years < 1000)      return `${Math.round(years)} years`;
  if (years < 1e6)       return `${Math.round(years / 1000)} thousand years`;
  if (years < 1e9)       return `${Math.round(years / 1e6)} million years`;
  if (years < 1e12)      return `${Math.round(years / 1e9)} billion years`;
  return 'Centuries';
}

// ── HELPER: Character set size ─────────────────────────────────────────────
function getCharsetSize(pwd) {
  let size = 0;
  if (/[a-z]/.test(pwd)) size += 26;
  if (/[A-Z]/.test(pwd)) size += 26;
  if (/\d/.test(pwd))    size += 10;
  if (/[^a-zA-Z0-9]/.test(pwd)) size += 32;
  return Math.max(size, 1);
}

// ── HELPER: Build suggestions ──────────────────────────────────────────────
function buildSuggestions(pwd, factors) {
  const suggestions = [];
  const len = pwd.length;

  if (len < 8)  suggestions.push('Use at least 8 characters — longer passwords are much harder to crack.');
  if (len < 12) suggestions.push('Aim for 12+ characters for significantly better protection.');
  if (len < 16) suggestions.push('16+ characters is considered highly secure by most standards.');

  if (!factors.hasUpper) suggestions.push('Add uppercase letters (A–Z) to expand the character set.');
  if (!factors.hasLower) suggestions.push('Include lowercase letters (a–z) for better variety.');
  if (!factors.hasDigit) suggestions.push('Mix in numbers (0–9) to increase complexity.');
  if (!factors.hasSymbol) suggestions.push('Add symbols like !, @, #, $ — they dramatically increase strength.');

  if (factors.isCommon)   suggestions.push('This is a very commonly used password. Choose something unique.');
  if (factors.sequential) suggestions.push('Avoid sequential patterns like "abc" or "123" — they\'re easy to guess.');
  if (factors.keyboard)   suggestions.push('Avoid keyboard patterns like "qwerty" or "asdfgh".');
  if (factors.repeated)   suggestions.push('Avoid repeating the same characters (e.g. "aaa" or "111").');

  if (suggestions.length === 0 && len >= 16) {
    suggestions.push('Excellent password! Consider storing it in a password manager.');
  }

  return suggestions.slice(0, 5); // max 5 suggestions
}

// ── MAIN EXPORT: analyzePassword ──────────────────────────────────────────
/**
 * Analyzes a password and returns a detailed score object.
 * @param {string} password
 * @returns {{
 *   score: number,
 *   label: string,
 *   crackTime: string,
 *   suggestions: string[],
 *   entropy: number,
 *   factors: object
 * }}
 */
export function analyzePassword(password) {
  // Empty password
  if (!password) {
    return {
      score: 0,
      label: '',
      crackTime: '—',
      suggestions: [],
      entropy: 0,
      factors: {},
    };
  }

  const len = password.length;
  const lowerPwd = password.toLowerCase();

  // ── Detect characteristics
  const hasUpper   = /[A-Z]/.test(password);
  const hasLower   = /[a-z]/.test(password);
  const hasDigit   = /\d/.test(password);
  const hasSymbol  = /[^a-zA-Z0-9]/.test(password);
  const isCommon   = COMMON_PASSWORDS.has(lowerPwd);
  const sequential = hasSequential(password);
  const keyboard   = hasKeyboardPattern(password);
  const repPenalty = getRepetitionPenalty(password);
  const repeated   = repPenalty > 5;

  // ── Immediately fail if common password
  if (isCommon) {
    return {
      score: 0,
      label: 'Weak',
      crackTime: 'Instant',
      suggestions: [
        'This password is extremely common and appears in breach databases.',
        'Choose a completely unique password that is not a dictionary word.',
        'Use a mix of random characters or a passphrase with special characters.',
      ],
      entropy: 1,
      factors: { hasUpper, hasLower, hasDigit, hasSymbol, isCommon, sequential, keyboard, repeated },
    };
  }

  // ── Scoring
  let score = 0;

  // Length (up to 20 pts)
  score += Math.min(len, 20);

  // Uppercase (each char, max 10 pts)
  const upperCount = (password.match(/[A-Z]/g) || []).length;
  score += Math.min(upperCount * 2, 10);

  // Lowercase (each char, max 10 pts)
  const lowerCount = (password.match(/[a-z]/g) || []).length;
  score += Math.min(lowerCount, 10);

  // Digits (each digit, max 10 pts)
  const digitCount = (password.match(/\d/g) || []).length;
  score += Math.min(digitCount * 2, 10);

  // Symbols (each symbol, max 15 pts)
  const symbolCount = (password.match(/[^a-zA-Z0-9]/g) || []).length;
  score += Math.min(symbolCount * 3, 15);

  // Variety bonus (how many types used, max 10 pts)
  const varieties = [hasUpper, hasLower, hasDigit, hasSymbol].filter(Boolean).length;
  score += varieties * 2.5;

  // Length bonus
  if (len >= 16) score += 5;
  if (len >= 20) score += 3;

  // ── Penalties
  if (sequential) score -= 10;
  if (keyboard)   score -= 10;
  score -= repPenalty;

  // Clamp to 0–100
  score = Math.max(0, Math.min(100, Math.round(score)));

  // ── Entropy
  const charsetSize = getCharsetSize(password);
  const entropy = len * Math.log2(charsetSize);

  // ── Label
  let label;
  if (score < 25)      label = 'Weak';
  else if (score < 50) label = 'Moderate';
  else if (score < 75) label = 'Strong';
  else                 label = 'Very Strong';

  // ── Crack time
  const crackTime = estimateCrackTime(entropy);

  // ── Suggestions
  const factors = { hasUpper, hasLower, hasDigit, hasSymbol, isCommon, sequential, keyboard, repeated };
  const suggestions = buildSuggestions(password, factors);

  return { score, label, crackTime, suggestions, entropy: Math.round(entropy), factors };
}
