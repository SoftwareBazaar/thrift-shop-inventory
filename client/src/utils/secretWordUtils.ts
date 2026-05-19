import bcrypt from 'bcryptjs';

/**
 * Validate secret word format
 * Rules: 6-20 characters, alphanumeric only
 */
export function validateSecretWord(word: string): { valid: boolean; error?: string } {
    if (!word || word.trim().length === 0) {
        return { valid: false, error: 'Secret word is required' };
    }

    const trimmed = word.trim();

    if (trimmed.length < 6) {
        return { valid: false, error: 'Secret word must be at least 6 characters long' };
    }

    if (trimmed.length > 20) {
        return { valid: false, error: 'Secret word must be no more than 20 characters long' };
    }

    // Only allow alphanumeric characters
    if (!/^[a-zA-Z0-9]+$/.test(trimmed)) {
        return { valid: false, error: 'Secret word must contain only letters and numbers' };
    }

    return { valid: true };
}

/**
 * Hash secret word using bcrypt
 */
export async function hashSecretWord(word: string): Promise<string> {
    const trimmed = word.trim();
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(trimmed.toLowerCase(), salt);
}

/**
 * Generate random character positions to ask during verification
 * @param wordLength - Length of the secret word
 * @param count - Number of positions to ask (default: 3)
 * @returns Array of positions (1-indexed for user display)
 */
export function generatePositionQuestions(wordLength: number, count: number = 3): number[] {
    if (wordLength < count) {
        count = wordLength;
    }

    const positions: number[] = [];
    const availablePositions = Array.from({ length: wordLength }, (_, i) => i + 1);

    // Shuffle and pick random positions
    for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * availablePositions.length);
        positions.push(availablePositions[randomIndex]);
        availablePositions.splice(randomIndex, 1);
    }

    return positions.sort((a, b) => a - b);
}

/**
 * Verify secret word answer for a specific position
 * @param secretWord - The actual secret word (unhashed)
 * @param position - Character position (1-indexed)
 * @param answer - User's answer
 * @returns Boolean indicating if answer is correct
 */
export function verifySecretWordAnswer(
    secretWord: string,
    position: number,
    answer: string
): boolean {
    if (!secretWord || !answer) return false;

    const normalizedWord = secretWord.trim().toLowerCase();
    const normalizedAnswer = answer.trim().toLowerCase();

    // Position is 1-indexed for users, convert to 0-indexed
    const charAtPosition = normalizedWord[position - 1];

    return charAtPosition === normalizedAnswer;
}

/**
 * Verify multiple answers at once
 * @param secretWord - The actual secret word (unhashed)
 * @param answers - Map of position to answer
 * @returns Boolean indicating if all answers are correct
 */
export function verifySecretWordAnswers(
    secretWord: string,
    answers: Map<number, string>
): boolean {
    for (const [position, answer] of answers.entries()) {
        if (!verifySecretWordAnswer(secretWord, position, answer)) {
            return false;
        }
    }
    return true;
}

/**
 * Compare plain secret word with hashed version
 */
export async function compareSecretWord(
    plainWord: string,
    hashedWord: string
): Promise<boolean> {
    return bcrypt.compare(plainWord.trim().toLowerCase(), hashedWord);
}

/**
 * Get ordinal suffix for position (1st, 2nd, 3rd, etc.)
 */
export function getOrdinalSuffix(position: number): string {
    const lastDigit = position % 10;
    const lastTwoDigits = position % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
        return `${position}th`;
    }

    switch (lastDigit) {
        case 1:
            return `${position}st`;
        case 2:
            return `${position}nd`;
        case 3:
            return `${position}rd`;
        default:
            return `${position}th`;
    }
}
