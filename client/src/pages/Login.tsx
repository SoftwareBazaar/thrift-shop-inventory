import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, PASSWORD_REQUIREMENTS, validatePasswordStrength } from '../contexts/MockAuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  getOfflineCredential,
  verifyRecoveryInput,
  updateOfflinePassword as updateOfflinePasswordStore,
} from '../utils/offlineCredentials';
import { normaliseUsername, derivePasswordHash } from '../utils/passwordUtils';
import SetSecretWord from '../components/SetSecretWord';
import { supabase } from '../lib/supabase';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showSetSecretWordModal, setShowSetSecretWordModal] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<any>(null);
  const [recoveryStep, setRecoveryStep] = useState<'identify' | 'verify-secret' | 'reset' | 'success'>('identify');
  const [secretWordPositions, setSecretWordPositions] = useState<number[]>([]);
  const [recoveryForm, setRecoveryForm] = useState({
    username: '',
    secretWordAnswers: {} as Record<number, string>,
    newPassword: '',
    confirmPassword: ''
  });
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryServerNote, setRecoveryServerNote] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const resetRecoveryState = () => {
    setRecoveryStep('identify');
    setSecretWordPositions([]);
    setRecoveryError('');
    setRecoverySuccess('');
    setRecoveryServerNote('');
    setRecoveryLoading(false);
    setCountdown(0);
    setCanResend(false);
    setRecoveryForm({
      username: username || '',
      secretWordAnswers: {},
      newPassword: '',
      confirmPassword: ''
    });
  };

  const openRecoveryModal = () => {
    resetRecoveryState();
    setShowRecoveryModal(true);
  };

  const closeRecoveryModal = () => {
    setShowRecoveryModal(false);
    resetRecoveryState();
  };

  const getOrdinalSuffix = (num: number): string => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return num + 'st';
    if (j === 2 && k !== 12) return num + 'nd';
    if (j === 3 && k !== 13) return num + 'rd';
    return num + 'th';
  };

  const handleRecoveryLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoverySuccess('');
    setRecoveryServerNote('');

    const trimmedUsername = recoveryForm.username.trim();
    if (!trimmedUsername) {
      setRecoveryError('Please enter a username to continue.');
      return;
    }

    setRecoveryLoading(true);

    try {
      let wordLength = 0;
      let hasSecretWord = false;

      // Try offline check first
      const record = getOfflineCredential(trimmedUsername);
      if (record && record.secretWord) {
        wordLength = record.secretWord.length;
        hasSecretWord = true;
      }

      // If online, check server for latest status
      const online = typeof navigator === 'undefined' ? true : navigator.onLine;
      if (isSupabaseConfigured() && online) {
        try {
          const { data, error: fetchError } = await (require('../lib/supabase').supabase as any)
            .from('users')
            .select('secret_word')
            .eq('username', trimmedUsername)
            .single();

          if (!fetchError && data?.secret_word) {
            wordLength = data.secret_word.length;
            hasSecretWord = true;
          }
        } catch (serverError) {
          console.warn('Server secret word lookup failed:', serverError);
        }
      }

      if (!hasSecretWord) {
        setRecoveryError('No secret word set for this account. Please contact an administrator.');
        setRecoveryLoading(false);
        return;
      }

      // Generate random positions to ask about
      const count = Math.min(3, wordLength);
      const positions: number[] = [];
      const availablePositions = Array.from({ length: wordLength }, (_, i) => i + 1);

      for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * availablePositions.length);
        positions.push(availablePositions[randomIndex]);
        availablePositions.splice(randomIndex, 1);
      }

      setSecretWordPositions(positions.sort((a, b) => a - b));
      setRecoveryForm(prev => ({
        ...prev,
        username: trimmedUsername,
        secretWordAnswers: {}
      }));
      setRecoveryStep('verify-secret');
    } catch (error) {
      console.error('Error during recovery lookup:', error);
      setRecoveryError('An error occurred. Please try again.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleVerifySecretWord = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoverySuccess('');

    // Check all positions have answers
    for (const position of secretWordPositions) {
      if (!recoveryForm.secretWordAnswers[position] || recoveryForm.secretWordAnswers[position].trim() === '') {
        setRecoveryError(`Please provide the ${getOrdinalSuffix(position)} character`);
        return;
      }
    }

    setRecoveryLoading(true);

    try {
      const record = getOfflineCredential(recoveryForm.username);
      if (!record || !record.secretWord) {
        setRecoveryError('Unable to verify secret word.');
        setRecoveryLoading(false);
        return;
      }

      // Verify the answers (case-insensitive)
      let isValid = true;
      for (const position of secretWordPositions) {
        const expectedChar = record.secretWord.charAt(position - 1);
        const providedChar = recoveryForm.secretWordAnswers[position].trim();

        if (expectedChar.toLowerCase() !== providedChar.toLowerCase()) {
          isValid = false;
          break;
        }
      }

      if (!isValid) {
        setRecoveryError('Incorrect answer(s). Please try again.');
        setRecoveryLoading(false);
        return;
      }

      // Verification successful
      setRecoverySuccess('Verification successful! Please set your new password.');
      setRecoveryStep('reset');
    } catch (error) {
      console.error('Error verifying secret word:', error);
      setRecoveryError('An error occurred during verification.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleRecoveryReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoverySuccess('');
    setRecoveryServerNote('');

    if (recoveryForm.newPassword !== recoveryForm.confirmPassword) {
      setRecoveryError('New passwords do not match.');
      return;
    }

    const strengthError = validatePasswordStrength(recoveryForm.newPassword);
    if (strengthError) {
      setRecoveryError(strengthError);
      return;
    }

    setRecoveryLoading(true);

    try {
      let serverSynced = false;
      const online = typeof navigator === 'undefined' ? true : navigator.onLine;
      if (isSupabaseConfigured() && online) {
        try {
          const response = await fetch('/api/auth/recover-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              username: recoveryForm.username,
              newPassword: recoveryForm.newPassword,
              secretWordAnswers: recoveryForm.secretWordAnswers,
              secretWordPositions: secretWordPositions
            })
          });
          let data: any = null;
          try {
            data = await response.json();
          } catch {
            data = null;
          }

          if (!response.ok) {
            // DEDUCTIVE REASONING FALLBACK: 
            // If the server returns 405 or 404, it's a routing issue. 
            // We should still allow the offline update to proceed so the user can log in.
            if (response.status === 405 || response.status === 404) {
              console.warn('⚠️ Server routing issue detected on password update (405). Proceeding with offline-only update.');
              setRecoveryServerNote('Server update failed (Routing 405) – your password will be updated for offline access. Please sign in while online later to sync.');
            } else if (response.status >= 400 && response.status < 500) {
              throw new Error(data?.message || 'We could not verify your account information with the server.');
            } else {
              throw new Error(data?.message || 'Unable to reach the server right now.');
            }
          }

          if (response.ok) {
            serverSynced = true;
          }
        } catch (serverError: any) {
          console.warn('Unable to update password on server, falling back to offline update.', serverError);
          if (serverError?.message?.includes('verify your account information')) {
            throw serverError;
          }
          setRecoveryServerNote('Server update failed – your password will be updated for offline access and will sync next time you sign in while online.');
        }
      }

      await updateOfflinePasswordStore(recoveryForm.username, recoveryForm.newPassword);
      const offlineRecord = getOfflineCredential(recoveryForm.username);
      if (offlineRecord && typeof window !== 'undefined') {
        const passwordVersion = await derivePasswordHash(recoveryForm.username, recoveryForm.newPassword);
        const cacheKey = 'thrift_shop_credentials';
        const rawCache = window.localStorage.getItem(cacheKey);
        let cache: Record<string, any> = {};
        try {
          cache = rawCache ? JSON.parse(rawCache) : {};
        } catch {
          cache = {};
        }
        cache[normaliseUsername(recoveryForm.username)] = {
          passwordHash: passwordVersion,
          user: offlineRecord.user,
          passwordVersion,
          updatedAt: new Date().toISOString()
        };
        window.localStorage.setItem(cacheKey, JSON.stringify(cache));
      }

      setRecoverySuccess(
        serverSynced
          ? 'Password updated successfully. You can now sign in with your new password.'
          : 'Password updated for offline access. Please sign in while online when possible to push the change to the server.'
      );
      setRecoveryStep('success');
    } catch (err: any) {
      setRecoveryError(err?.message || 'Unable to reset password right now.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username || !password) {
      setError('Please enter both username and password');
      setLoading(false);
      return;
    }

    try {
      await login(username, password);

      // The user is now set in the context, but let's check secret word
      // Verify both offline and online if possible
      let hasSecretWord = false;

      // Offline check
      const offlineRecord = getOfflineCredential(username);
      if (offlineRecord?.secretWord) {
        hasSecretWord = true;
      }

      // Online check if supabase is configured
      if (!hasSecretWord && isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const { data, error: fetchError } = await (supabase as any)
            .from('users')
            .select('secret_word')
            .eq('username', username)
            .single();

          if (!fetchError && data?.secret_word) {
            hasSecretWord = true;
          }
        } catch (err) {
          console.warn('Post-login secret word check failed:', err);
        }
      }

      if (!hasSecretWord) {
        setLoggedInUser({ username }); // Use username since login() returns void
        setShowSetSecretWordModal(true);
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-32 sm:h-40 w-auto flex items-center justify-center mb-6">
            <img
              src={`${process.env.PUBLIC_URL || ''}/sta-logo.png.png`}
              alt="Street Thrift Apparel Logo"
              className="h-32 sm:h-40 w-auto object-contain"
              style={{ maxWidth: '100%', display: 'block' }}
            />
          </div>
          <h2 className="mt-4 text-center text-2xl sm:text-3xl font-extrabold text-gray-900">
            Street Thrift Apparel
          </h2>
          <p className="mt-2 text-center text-base sm:text-lg text-gray-600 font-medium">
            Inventory Management System
          </p>
          <p className="mt-2 text-center text-sm text-gray-600">
            Professional Multi-Stall Management System
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow-xl rounded-lg">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your username"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 pr-10"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="text-right">
              <button
                type="button"
                onClick={openRecoveryModal}
                className="text-sm text-blue-600 hover:text-blue-800 focus:outline-none focus:underline"
              >
                Forgot password?
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Professional inventory management system for multi-stall operations
            </p>
          </div>
        </div>
      </div>

      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Reset Password</h3>
              <button
                type="button"
                onClick={closeRecoveryModal}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
                aria-label="Close reset password"
              >
                ✕
              </button>
            </div>

            {recoveryError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-md mb-4">
                {recoveryError}
              </div>
            )}

            {recoverySuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-md mb-4">
                {recoverySuccess}
              </div>
            )}

            {recoveryServerNote && recoveryStep !== 'success' && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm p-3 rounded-md mb-4">
                {recoveryServerNote}
              </div>
            )}

            {recoveryStep === 'identify' && (
              <form onSubmit={handleRecoveryLookup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={recoveryForm.username}
                    onChange={(e) => setRecoveryForm(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your username"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={closeRecoveryModal}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 focus:outline-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none disabled:opacity-60"
                    disabled={recoveryLoading}
                  >
                    {recoveryLoading ? 'Checking...' : 'Continue'}
                  </button>
                </div>
              </form>
            )}

            {recoveryStep === 'verify-secret' && (
              <form onSubmit={handleVerifySecretWord} className="space-y-4">
                <p className="text-sm text-gray-700">
                  For security, please answer the following questions about your secret word for <span className="font-semibold">{recoveryForm.username}</span>:
                </p>

                <div className="space-y-3">
                  {secretWordPositions.map((position, index) => (
                    <div key={position}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        What is the {getOrdinalSuffix(position)} character of your secret word?
                      </label>
                      <input
                        type="text"
                        maxLength={1}
                        value={recoveryForm.secretWordAnswers[position] || ''}
                        onChange={(e) => {
                          const value = e.target.value.slice(0, 1);
                          setRecoveryForm(prev => ({
                            ...prev,
                            secretWordAnswers: {
                              ...prev.secretWordAnswers,
                              [position]: value
                            }
                          }));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-xl font-mono"
                        placeholder="?"
                        autoFocus={index === 0}
                      />
                    </div>
                  ))}
                </div>

                <p className="text-xs text-gray-500">
                  <strong>Note:</strong> Answers are case-insensitive
                </p>

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setRecoveryStep('identify')}
                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 focus:outline-none"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none disabled:opacity-60"
                    disabled={recoveryLoading}
                  >
                    {recoveryLoading ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
              </form>
            )}


            {recoveryStep === 'reset' && (
              <form onSubmit={handleRecoveryReset} className="space-y-4">
                <p className="text-sm text-gray-700">
                  Create a new password. It must be at least {PASSWORD_REQUIREMENTS.minLength} characters long and include at least {PASSWORD_REQUIREMENTS.minSpecial} symbol characters.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input
                    type="password"
                    value={recoveryForm.newPassword}
                    onChange={(e) => setRecoveryForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={recoveryForm.confirmPassword}
                    onChange={(e) => setRecoveryForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setRecoveryStep('verify-secret')}
                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 focus:outline-none"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none disabled:opacity-60"
                    disabled={recoveryLoading}
                  >
                    {recoveryLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )
            }

            {
              recoveryStep === 'success' && (
                <div className="space-y-4">
                  <div className="text-sm text-green-700 font-medium bg-green-50 p-3 rounded-md border border-green-200">
                    {recoverySuccess}
                  </div>
                  {recoveryServerNote && (
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm p-3 rounded-md">
                      {recoveryServerNote}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setUsername(recoveryForm.username);
                        setPassword('');
                        closeRecoveryModal();
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none"
                    >
                      Return to Sign In
                    </button>
                  </div>
                </div>
              )
            }
          </div >
        </div >
      )}
      {showSetSecretWordModal && loggedInUser && (
        <SetSecretWord
          username={loggedInUser.username}
          isFirstTime={true}
          onComplete={async (word) => {
            // Success handled by parent component (modal logic)
            setShowSetSecretWordModal(false);
            navigate('/dashboard');
          }}
          onCancel={() => {
            setShowSetSecretWordModal(false);
            navigate('/dashboard');
          }}
        />
      )}
    </div >
  );
};

export default Login;