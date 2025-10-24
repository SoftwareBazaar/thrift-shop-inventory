import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

interface FeedbackMessage {
  feedback_id: number;
  customer_name: string;
  customer_phone: string;
  message: string;
  rating: number;
  feedback_type: 'complaint' | 'suggestion' | 'compliment' | 'general';
  status: 'new' | 'in_progress' | 'resolved';
  created_date: string;
  resolved_date?: string;
  response?: string;
}

const Feedback: React.FC = () => {
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<FeedbackMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackMessage | null>(null);
  const [response, setResponse] = useState('');
  const [filter, setFilter] = useState<'all' | 'new' | 'in_progress' | 'resolved'>('all');

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(5);
  const [feedbackType, setFeedbackType] = useState<'complaint' | 'suggestion' | 'compliment' | 'general'>('general');

  useEffect(() => {
    fetchFeedbacks();
  }, [filter]);

  const fetchFeedbacks = async () => {
    try {
      const response = await axios.get(`/api/feedback?filter=${filter}`);
      setFeedbacks(response.data.feedbacks || []);
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const feedbackData = {
        customer_name: customerName,
        customer_phone: customerPhone,
        message,
        rating,
        feedback_type: feedbackType
      };

      await axios.post('/api/feedback', feedbackData);
      
      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setMessage('');
      setRating(5);
      setFeedbackType('general');
      setShowForm(false);
      
      // Refresh feedbacks
      fetchFeedbacks();
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  const handleRespondToFeedback = async (feedbackId: number) => {
    try {
      await axios.put(`/api/feedback/${feedbackId}/respond`, {
        response,
        status: 'resolved'
      });
      
      setResponse('');
      setSelectedFeedback(null);
      fetchFeedbacks();
    } catch (error) {
      console.error('Error responding to feedback:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-red-100 text-red-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'complaint': return 'bg-red-100 text-red-800';
      case 'suggestion': return 'bg-blue-100 text-blue-800';
      case 'compliment': return 'bg-green-100 text-green-800';
      case 'general': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < rating ? 'text-yellow-400' : 'text-gray-300'}>
        ⭐
      </span>
    ));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading feedback...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-primary text-white p-6 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Customer Feedback System</h1>
            <p className="text-blue-100">Manage customer feedback and communications</p>
          </div>
          <div className="flex space-x-4">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="bg-white text-gray-900 px-4 py-2 rounded-lg"
            >
              <option value="all">All Feedback</option>
              <option value="new">New</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
            <button
              onClick={() => setShowForm(true)}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-medium"
            >
              📝 New Feedback
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-lg border-l-4 border-red-500">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-3xl">📝</span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">New Feedback</h3>
              <p className="text-2xl font-bold text-red-600">
                {feedbacks.filter(f => f.status === 'new').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg border-l-4 border-yellow-500">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-3xl">⏳</span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">In Progress</h3>
              <p className="text-2xl font-bold text-yellow-600">
                {feedbacks.filter(f => f.status === 'in_progress').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg border-l-4 border-green-500">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-3xl">✅</span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Resolved</h3>
              <p className="text-2xl font-bold text-green-600">
                {feedbacks.filter(f => f.status === 'resolved').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg border-l-4 border-blue-500">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-3xl">⭐</span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Avg Rating</h3>
              <p className="text-2xl font-bold text-blue-600">
                {feedbacks.length > 0 
                  ? (feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length).toFixed(1)
                  : '0.0'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback List */}
      <div className="bg-white rounded-lg shadow-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Customer Feedback</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {feedbacks.map((feedback) => (
            <div key={feedback.feedback_id} className="p-6 hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-4 mb-2">
                    <h3 className="text-lg font-medium text-gray-900">{feedback.customer_name}</h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(feedback.status)}`}>
                      {feedback.status}
                    </span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(feedback.feedback_type)}`}>
                      {feedback.feedback_type}
                    </span>
                    <div className="flex items-center">
                      {renderStars(feedback.rating)}
                    </div>
                  </div>
                  <p className="text-gray-600 mb-2">{feedback.message}</p>
                  <div className="text-sm text-gray-500">
                    <p>Phone: {feedback.customer_phone}</p>
                    <p>Date: {new Date(feedback.created_date).toLocaleString()}</p>
                  </div>
                  {feedback.response && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-900">Response:</h4>
                      <p className="text-blue-800">{feedback.response}</p>
                    </div>
                  )}
                </div>
                <div className="ml-4">
                  {feedback.status !== 'resolved' && (
                    <button
                      onClick={() => setSelectedFeedback(feedback)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      Respond
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Submit Customer Feedback</h3>
              <form onSubmit={handleSubmitFeedback} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Customer Name</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Customer Phone</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Feedback Type</label>
                  <select
                    value={feedbackType}
                    onChange={(e) => setFeedbackType(e.target.value as any)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="general">General</option>
                    <option value="complaint">Complaint</option>
                    <option value="suggestion">Suggestion</option>
                    <option value="compliment">Compliment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Rating</label>
                  <div className="flex space-x-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRating(i + 1)}
                        className={`text-2xl ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}
                      >
                        ⭐
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium"
                  >
                    Submit Feedback
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Response Modal */}
      {selectedFeedback && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Respond to Feedback</h3>
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>From:</strong> {selectedFeedback.customer_name}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Phone:</strong> {selectedFeedback.customer_phone}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Message:</strong> {selectedFeedback.message}
                </p>
                <div className="flex items-center">
                  <span className="text-sm text-gray-600 mr-2">Rating:</span>
                  {renderStars(selectedFeedback.rating)}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Response</label>
                <textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  rows={4}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Type your response here..."
                />
              </div>
              <div className="mt-6 flex space-x-3">
                <button
                  onClick={() => handleRespondToFeedback(selectedFeedback.feedback_id)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
                >
                  Send Response
                </button>
                <button
                  onClick={() => setSelectedFeedback(null)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Feedback;
