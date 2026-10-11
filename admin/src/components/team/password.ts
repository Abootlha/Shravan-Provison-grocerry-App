/** Password helpers for staff and rider accounts. Pure functions so they can be unit tested. */

// No look-alikes (0/O, 1/l/I) so a password read aloud or copied by hand survives.
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '-_.!@#%+=';

function randomIndex(max: number): number {
    const buf = new Uint32Array(1);
    // Rejection sampling keeps the distribution uniform.
    const limit = Math.floor(0x1_0000_0000 / max) * max;
    do {
        crypto.getRandomValues(buf);
    } while (buf[0] >= limit);
    return buf[0] % max;
}

const pick = (set: string) => set[randomIndex(set.length)];

/** A random password with at least one of each character class. */
export function generatePassword(length = 16): string {
    // Re-roll the rare draw the strength meter would flag (a run like "aaa" or a common word).
    for (;;) {
        const candidate = draw(length);
        if (passwordStrength(candidate, Math.min(length, 12)).score === 4 || length < 12) return candidate;
    }
}

function draw(length: number): string {
    const all = LOWER + UPPER + DIGITS + SYMBOLS;
    const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
    while (chars.length < length) chars.push(pick(all));
    for (let i = chars.length - 1; i > 0; i--) {
        const j = randomIndex(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
}

export interface PasswordStrength {
    /** 0 (empty) to 4 (strong). */
    score: 0 | 1 | 2 | 3 | 4;
    label: string;
    /** The one thing that would make it stronger, or null. */
    hint: string | null;
}

const COMMON = ['password', 'qwerty', '123456', 'admin', 'shravan', 'letmein', 'welcome', 'kirana', 'rider', 'manager'];

/**
 * A rough strength estimate: length plus character variety, penalising common words and
 * repeated characters. Not a substitute for the server's rules (minimum length is enforced there).
 */
export function passwordStrength(password: string, minLength = 12): PasswordStrength {
    if (!password) return { score: 0, label: '', hint: null };
    const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
    const lower = password.toLowerCase();
    const common = COMMON.some((word) => lower.includes(word));
    const repeats = /(.)\1{2,}/.test(password);

    if (password.length < minLength) {
        return { score: 1, label: 'Too short', hint: `Use at least ${minLength} characters (${minLength - password.length} more).` };
    }

    let points = 0;
    if (password.length >= minLength) points++;
    if (password.length >= minLength + 4) points++;
    if (classes >= 3) points++;
    if (classes === 4) points++;
    if (common) points -= 2;
    if (repeats) points -= 1;

    if (points <= 1) {
        return {
            score: 2,
            label: 'Weak',
            hint: common
                ? 'Avoid common words like "password" or the store name.'
                : repeats
                  ? 'Avoid repeating the same character.'
                  : 'Mix upper and lower case, numbers and a symbol.',
        };
    }
    if (points <= 3) {
        return {
            score: 3,
            label: 'Good',
            hint: password.length < minLength + 4 ? 'A few more characters would make it strong.' : 'Add a symbol or number to make it strong.',
        };
    }
    return { score: 4, label: 'Strong', hint: null };
}
