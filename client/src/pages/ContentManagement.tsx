import React, { useState, useEffect } from 'react';
import './ContentManagement.css';

interface Content {
  content_id: number;
  title: string;
  description?: string;
  content_type: 'ea' | 'pricing' | 'promotion' | 'article' | 'other';
  price?: number;
  image_url?: string;
  image_alt_text?: string;
  status: 'active' | 'inactive' | 'draft';
  featured: boolean;
  display_order: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

const CONTENT_TYPES = [
  { value: 'ea', label: 'Expert Advisor' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'article', label: 'Article' },
  { value: 'other', label: 'Other' }
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'draft', label: 'Draft' }
];

const ContentManagement: React.FC = () => {
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content_type: 'ea',
    price: '',
    image_alt_text: '',
    status: 'active',
    featured: false,
    display_order: 0,
    image: null as File | null
  });

  const [previewImage, setPreviewImage] = useState<string>('');

  const token = localStorage.getItem('token');
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // Fetch content
  const fetchContent = async () => {
    try {
      setLoading(true);
      setError('');
      let url = `${apiUrl}/api/content`;
      const params = [];

      if (filterType) params.push(`type=${filterType}`);
      if (filterStatus) params.push(`status=${filterStatus}`);

      if (params.length > 0) {
        url += '?' + params.join('&');
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch content');
      }

      const data = await response.json();
      setContent(data.content || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Fetch content when filters change
  useEffect(() => {
    fetchContent();
  }, [filterType, filterStatus, fetchContent]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, image: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as any;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData({ ...formData, [name]: newValue });
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      content_type: 'ea',
      price: '',
      image_alt_text: '',
      status: 'active',
      featured: false,
      display_order: 0,
      image: null
    });
    setPreviewImage('');
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const data = new FormData();
      data.append('title', formData.title);
      data.append('description', formData.description);
      data.append('content_type', formData.content_type);
      if (formData.price) data.append('price', formData.price);
      data.append('image_alt_text', formData.image_alt_text);
      data.append('status', formData.status);
      data.append('featured', String(formData.featured));
      data.append('display_order', String(formData.display_order));

      if (formData.image) {
        data.append('image', formData.image);
      }

      const url = editingId
        ? `${apiUrl}/api/content/${editingId}`
        : `${apiUrl}/api/content`;

      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: data
      });

      if (!response.ok) {
        throw new Error('Failed to save content');
      }

      setSuccessMessage(editingId ? 'Content updated successfully' : 'Content created successfully');
      resetForm();
      await fetchContent();

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: Content) => {
    setFormData({
      title: item.title,
      description: item.description || '',
      content_type: item.content_type,
      price: item.price ? String(item.price) : '',
      image_alt_text: item.image_alt_text || '',
      status: item.status,
      featured: item.featured,
      display_order: item.display_order,
      image: null
    });

    if (item.image_url) {
      setPreviewImage(`${apiUrl}${item.image_url}`);
    }

    setEditingId(item.content_id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this content?')) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`${apiUrl}/api/content/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete content');
      }

      setSuccessMessage('Content deleted successfully');
      await fetchContent();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getContentTypeLabel = (type: string) => {
    return CONTENT_TYPES.find(t => t.value === type)?.label || type;
  };

  const getStatusLabel = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status)?.label || status;
  };

  return (
    <div className="content-management">
      <div className="cms-header">
        <h1>Content Management System</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : '+ Add New Content'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      {showForm && (
        <div className="cms-form-container">
          <h2>{editingId ? 'Edit Content' : 'Create New Content'}</h2>
          <form onSubmit={handleSubmit} className="cms-form">
            <div className="form-row">
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Enter content title"
                  required
                />
              </div>

              <div className="form-group">
                <label>Content Type *</label>
                <select
                  name="content_type"
                  value={formData.content_type}
                  onChange={handleInputChange}
                >
                  {CONTENT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Price</label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  placeholder="Enter price (optional)"
                  step="0.01"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label>Display Order</label>
                <input
                  type="number"
                  name="display_order"
                  value={formData.display_order}
                  onChange={handleInputChange}
                  min="0"
                />
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  {STATUS_OPTIONS.map(status => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter content description (optional)"
                rows={4}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Image Alt Text</label>
                <input
                  type="text"
                  name="image_alt_text"
                  value={formData.image_alt_text}
                  onChange={handleInputChange}
                  placeholder="Describe the image for accessibility"
                />
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    name="featured"
                    checked={formData.featured}
                    onChange={handleInputChange}
                  />
                  Featured Content
                </label>
              </div>
            </div>

            <div className="form-group">
              <label>Image Upload</label>
              <div className="image-upload-section">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="file-input"
                />
                <p className="upload-hint">Accepted formats: JPEG, PNG, GIF, WebP (Max 10MB)</p>

                {previewImage && (
                  <div className="image-preview">
                    <h4>Preview:</h4>
                    <img src={previewImage} alt="Preview" />
                  </div>
                )}

                {!previewImage && !formData.image && (
                  <div className="image-placeholder">
                    <div className="placeholder-icon">🖼️</div>
                    <p>No image selected</p>
                  </div>
                )}
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : editingId ? 'Update Content' : 'Create Content'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="cms-filters">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="filter-select"
        >
          <option value="">All Types</option>
          {CONTENT_TYPES.map(type => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="filter-select"
        >
          <option value="">All Status</option>
          {STATUS_OPTIONS.map(status => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </div>

      {loading && !showForm && <div className="loading">Loading content...</div>}

      <div className="cms-content-grid">
        {content.length === 0 ? (
          <div className="no-content">
            {filterType || filterStatus ? 'No content found matching your filters' : 'No content yet. Create your first content!'}
          </div>
        ) : (
          content.map(item => (
            <div key={item.content_id} className="content-card">
              <div className="card-image">
                {item.image_url ? (
                  <img src={`${apiUrl}${item.image_url}`} alt={item.image_alt_text || item.title} />
                ) : (
                  <div className="image-placeholder-card">
                    <div className="placeholder-icon">🖼️</div>
                  </div>
                )}
              </div>

              <div className="card-content">
                <div className="card-badges">
                  <span className={`badge badge-type ${item.content_type}`}>
                    {getContentTypeLabel(item.content_type)}
                  </span>
                  <span className={`badge badge-status ${item.status}`}>
                    {getStatusLabel(item.status)}
                  </span>
                  {item.featured && <span className="badge badge-featured">Featured</span>}
                </div>

                <h3>{item.title}</h3>
                {item.description && <p className="description">{item.description.substring(0, 100)}...</p>}

                <div className="card-meta">
                  {item.price && <span className="price">Price: ${item.price.toFixed(2)}</span>}
                  <span className="order">Order: {item.display_order}</span>
                </div>

                <div className="card-actions">
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleEdit(item)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(item.content_id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ContentManagement;
