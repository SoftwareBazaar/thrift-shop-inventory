/**
 * Password Recovery Functions for Login Component
 * These functions implement secret word verification for password reset
 */

import { getOfflineCredential } from '../utils/offlineCredentials';
import { generatePositionQuestions, verifySecretWordAnswers, getOrdinalSuffix } from '../utils/secretWordUtils';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface RecoveryState {
    step: 'identify' | 'verify-secret' | 'reset' | 'success';
    username: string;
    secretWordPositions: number[];
    secretWordAnswers: Record<number, string>;
    newPassword: string;
    confirmPassword: string;
    error: string;
    success: string;
    serverNote: string;
    loading: boolean;
}

/**
 * Step 1: Lookup username and check if secret word exists
 */
export async function handleRecoveryLookup(username: string): Promise<{
    success: boolean;
    hasSecretWord: boolean;
    secretWordLength?: number;
    error?: string;
}> {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
        return { success: false, hasSecretWord: false, error: 'Please enter a username to continue.' };
    }

    // Try to get user from offline credentials first
    const offlineRecord = getOfflineCredential(trimmedUsername);

    // If online and Supabase configured, check server
    const online = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (isSupabaseConfigured() && online) {
        try {
            const { data: userRow, error: fetchError } = await (supabase as any)
                .from('users')
                .select('user_id, username, secret_word')
                .eq('username', trimmedUsername)
                .single();

            if (fetchError || !userRow) {
                if (offlineRecord) {
                    // Fall back to offline
                    if (!offlineRecord.secretWord) {
                        return {
                            success: false,
                            hasSecretWord: false,
                            error: 'No secret word set for this account. Please contact an administrator.'
                        };
                    }
                    return {
                        success: true,
                        hasSecretWord: true,
                        secretWordLength: offlineRecord.secretWord.length
                    };
                }
                return { success: false, hasSecretWord: false, error: 'Username not found.' };
            }

            if (!userRow.secret_word) {
                return {
                    success: false,
                    hasSecretWord: false,
                    error: 'No secret word set for this account. Please contact an administrator to set one.'
                };
            }

            return {
                success: true,
                hasSecretWord: true,
                secretWordLength: userRow.secret_word.length
            };
        } catch (error) {
            console.error('Error looking up user:', error);
            // Fall back to offline
            if (offlineRecord) {
                if (!offlineRecord.secretWord) {
                    return {
                        success: false,
                        hasSecretWord: false,
                        error: 'No secret word set for this account.'
                    };
                }
                return {
                    success: true,
                    hasSecretWord: true,
                    secretWordLength: offlineRecord.secretWord.length
                };
            }
            return { success: false, hasSecretWord: false, error: 'Unable to verify username. Please try again.' };
        }
    }

    // Offline only
    if (!offlineRecord) {
        return {
            success: false,
            hasSecretWord: false,
            error: 'This account has not been synced for offline access. Connect to the internet to reset your password.'
        };
    }

    if (!offlineRecord.secretWord) {
        return {
            success: false,
            hasSecretWord: false,
            error: 'No secret word set for this account.'
        };
    }

    return {
        success: true,
        hasSecretWord: true,
        secretWordLength: offlineRecord.secretWord.length
    };
}

/**
 * Step 2: Verify secret word answers
 */
export async function verifySecretWordForRecovery(
    username: string,
    positions: number[],
    answers: Record<number, string>
): Promise<{ success: boolean; error?: string }> {
    // First try offline
    const offlineRecord = getOfflineCredential(username);

    if (offlineRecord && offlineRecord.secretWord) {
        const answersMap = new Map<number, string>();
        positions.forEach(pos => {
            if (answers[pos]) {
                answersMap.set(pos, answers[pos]);
            }
        });

        const isValid = verifySecretWordAnswers(offlineRecord.secretWord, answersMap);
        if (isValid) {
            return { success: true };
        }
    }

    // Try online if available
    const online = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (isSupabaseConfigured() && online) {
        try {
            const { data: userRow, error: fetchError } = await (supabase as any)
                .from('users')
                .select('secret_word')
                .eq('username', username)
                .single();

            if (fetchError || !userRow || !userRow.secret_word) {
                return { success: false, error: 'Unable to verify secret word.' };
            }

            const answersMap = new Map<number, string>();
            positions.forEach(pos => {
                if (answers[pos]) {
                    answersMap.set(pos, answers[pos]);
                }
            });

            const isValid = verifySecretWordAnswers(userRow.secret_word, answersMap);
            if (isValid) {
                return { success: true };
            }
        } catch (error) {
            console.error('Error verifying secret word:', error);
        }
    }

    return { success: false, error: 'Incorrect answer(s). Please try again.' };
}

/**
 * Generate position questions for secret word
 */
export function generateSecretWordQuestions(wordLength: number): number[] {
    const count = Math.min(3, wordLength);
    return generatePositionQuestions(wordLength, count);
}

/**
 * Format position for display (e.g., "2nd", "5th")
 */
export function formatPosition(position: number): string {
    return getOrdinalSuffix(position);
}
