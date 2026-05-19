import React, { useState } from 'react';
import { validateSecretWord } from '../utils/secretWordUtils';

interface SetSecretWordProps {
    username: string;
    onComplete: (secretWord: string) => Promise<void>;
    onCancel?: () => void;
    isFirstTime?: boolean;
}

const SetSecretWord: React.FC<SetSecretWordProps> = ({
    username,
    onComplete,
    onCancel,
    isFirstTime = true,
}) => {
    const [secretWord, setSecretWord] = useState('');
    const [confirmWord, setConfirmWord] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showWords, setShowWords] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate secret word
        const validation = validateSecretWord(secretWord);
        if (!validation.valid) {
            setError(validation.error || 'Invalid secret word');
            return;
        }

        // Check if words match
        if (secretWord !== confirmWord) {
            setError('Secret words do not match');
            return;
        }

        setLoading(true);
        try {
            await onComplete(secretWord);
            // Success handled by parent component
        } catch (err: any) {
            setError(err.message || 'Failed to set secret word');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6">
                <div className="mb-4">
                    <h3 className="text-xl font-bold text-gray-900">
                        {isFirstTime ? 'Set Your Secret Word' : 'Update Secret Word'}
                    </h3>
                    <p className="text-sm text-gray-600 mt-2">
                        {isFirstTime
                            ? 'Set a secret word to help you recover your password if you forget it.'
                            : 'Update your secret word for password recovery.'}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-md mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Secret Word
                        </label>
                        <div className="relative">
                            <input
                                type={showWords ? 'text' : 'password'}
                                value={secretWord}
                                onChange={(e) => setSecretWord(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter 6-20 characters"
                                autoFocus
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowWords(!showWords)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
                            >
                                {showWords ? '🙈' : '👁️'}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            6-20 characters, letters and numbers only
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Confirm Secret Word
                        </label>
                        <input
                            type={showWords ? 'text' : 'password'}
                            value={confirmWord}
                            onChange={(e) => setConfirmWord(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Re-enter your secret word"
                            required
                        />
                    </div>

                    <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
                        <p className="text-xs text-blue-800">
                            <strong>💡 Tip:</strong> Choose a word you'll remember but others won't guess.
                            During password recovery, you'll be asked for specific letters from this word.
                        </p>
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                        {!isFirstTime && onCancel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 focus:outline-none"
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Saving...' : isFirstTime ? 'Set Secret Word' : 'Update Secret Word'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SetSecretWord;
