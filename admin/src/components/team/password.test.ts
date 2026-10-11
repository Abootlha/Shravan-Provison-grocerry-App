import { describe, expect, it } from 'vitest';
import { generatePassword, passwordStrength } from './password';

describe('generatePassword', () => {
    it('has the requested length and every character class', () => {
        for (let i = 0; i < 50; i++) {
            const pw = generatePassword(16);
            expect(pw).toHaveLength(16);
            expect(pw).toMatch(/[a-z]/);
            expect(pw).toMatch(/[A-Z]/);
            expect(pw).toMatch(/[0-9]/);
            expect(pw).toMatch(/[^A-Za-z0-9]/);
            expect(pw).not.toMatch(/[0O1lI]/);
        }
    });

    it('is rated strong', () => {
        for (let i = 0; i < 500; i++) expect(passwordStrength(generatePassword()).score).toBe(4);
    });
});

describe('passwordStrength', () => {
    it('is empty for no input', () => {
        expect(passwordStrength('').score).toBe(0);
    });

    it('flags passwords under the minimum length', () => {
        const result = passwordStrength('Ab1!', 12);
        expect(result.score).toBe(1);
        expect(result.hint).toContain('8 more');
    });

    it('penalises common words', () => {
        expect(passwordStrength('password1234').label).toBe('Weak');
    });

    it('rates long mixed passwords strong', () => {
        expect(passwordStrength('Tomato-Basket-42-Lane').label).toBe('Strong');
    });
});
