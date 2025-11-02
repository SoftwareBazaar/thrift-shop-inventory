import React, { useState, useEffect, useRef } from 'react';

interface VoiceAssistantProps {
  onTextReceived: (text: string) => void;
  onCommand?: (command: string, params: any) => void;
  placeholder?: string;
  disabled?: boolean;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ 
  onTextReceived, 
  onCommand, 
  placeholder = "Click to speak...",
  disabled = false 
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check if browser supports Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
      recognitionRef.current = new SpeechRecognition();
      
      // Configure recognition
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      // Handle results
      recognitionRef.current.onresult = (event: any) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        onTextReceived(transcript);
        
        // Try to parse commands if command handler is provided
        if (onCommand) {
          parseCommand(transcript, onCommand);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onTextReceived, onCommand]);

  const parseCommand = (text: string, commandHandler: (command: string, params: any) => void) => {
    const lowerText = text.toLowerCase().trim();
    
    // Add new item commands
    if (lowerText.includes('add item') || lowerText.includes('add new item')) {
      commandHandler('addItem', {});
      return;
    }
    
    // Search commands
    if (lowerText.startsWith('search for') || lowerText.startsWith('find')) {
      const searchTerm = text.replace(/^(search for|find)\s+/i, '').trim();
      commandHandler('search', { term: searchTerm });
      return;
    }
    
    // Filter by category
    if (lowerText.startsWith('show category') || lowerText.startsWith('filter by category')) {
      const category = text.replace(/^(show category|filter by category)\s+/i, '').trim();
      commandHandler('filterCategory', { category });
      return;
    }
    
    // Clear filters
    if (lowerText.includes('clear filter') || lowerText.includes('reset filter') || lowerText.includes('show all')) {
      commandHandler('clearFilters', {});
      return;
    }
    
    // Show low stock
    if (lowerText.includes('low stock') || lowerText.includes('out of stock')) {
      commandHandler('showLowStock', {});
      return;
    }
  };

  const startListening = () => {
    if (!isSupported || disabled || isListening) return;
    
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (error) {
      console.error('Error starting speech recognition:', error);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // Toggle listening on click
  const handleToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!isSupported) {
    return (
      <div className="inline-flex items-center px-3 py-2 text-sm text-gray-500 bg-gray-100 rounded-md">
        <span>🎤 Voice input not supported in this browser</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={disabled}
      className={`inline-flex items-center px-4 py-2 rounded-md transition-all duration-200 ${
        isListening
          ? 'bg-red-500 text-white animate-pulse'
          : 'bg-blue-500 hover:bg-blue-600 text-white'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      title={isListening ? 'Listening... Click to stop' : 'Click to speak'}
    >
      <span className="text-lg mr-2">{isListening ? '🛑' : '🎤'}</span>
      <span className="font-medium">
        {isListening ? 'Listening...' : 'Voice Input'}
      </span>
      {isListening && (
        <span className="ml-2 animate-bounce">●</span>
      )}
    </button>
  );
};

export default VoiceAssistant;

