import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';

const API_BASE = 'http://localhost:5000/api';

async function apiFetch(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Request failed.');
  }
  return data;
}

function App() {
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const data = await apiFetch(`/documents${queryString ? `?${queryString}` : ''}`);
    setDocuments(data.documents || []);
  };

  const fetchCategories = async () => {
    const data = await apiFetch('/categories');
    setCategories(data.categories || []);
  };

  const fetchStats = async () => {
    const data = await apiFetch('/stats');
    setStats(data);
  };

  useEffect(() => {
    const loadSession = async () => {
      try {
        const data = await apiFetch('/session');
        setUser(data.user);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchDocuments();
    fetchCategories();
    if (user.role === 'admin') fetchStats();
  }, [user]);

  const handleLogin = async (credentials) => {
    const data = await apiFetch('/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    setUser(data.user);
    return data;
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/logout', { method: 'POST' });
      setUser(null);
    } catch (err) {
      console.error(err);
    }
  };

  const contextValue = useMemo(() => ({
    user,
    setUser,
    documents,
    setDocuments,
    fetchDocuments,
    categories,
    setCategories,
    fetchCategories,
    stats,
    fetchStats,
    handleLogin,
    handleLogout,
  }), [user, documents, categories, stats]);

  if (loading) {
    return <div className="loading-shell">Loading STI Research Hub...</div>;
  }

  return <AppLayout context={contextValue} />;
}

function AppLayout({ context }) {
  const { user, handleLogout } = context;

  const navItems = [
    { to: '/', label: 'Home' },
    { to: '/repository', label: 'Research Repository' },
    { to: '/chatbot', label: 'AI Chatbot' },
    ...(user ? [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/profile', label: 'Profile' },
    ] : []),
    ...(user && user.role === 'admin' ? [{ to: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-badge">STI</span>
          <span>Research Hub</span>
        </Link>

        <nav className="nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}

          {!user ? (
            <Link to="/login" className="button primary small">Log In</Link>
          ) : (
            <button type="button" className="button secondary small" onClick={handleLogout}>Logout</button>
          )}
        </nav>
      </header>

      <main className="page-container">
        <Routes>
          <Route path="/" element={<LandingPage user={user} />} />
          <Route path="/login" element={<LoginPage user={user} onLogin={context.handleLogin} />} />
          <Route path="/dashboard" element={<ProtectedRoute user={user}><DashboardPage context={context} /></ProtectedRoute>} />
          <Route path="/repository" element={<RepositoryPage context={context} />} />
          <Route path="/chatbot" element={<ProtectedRoute user={user}><ChatbotPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute user={user}><ProfilePage user={user} setUser={context.setUser} /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute user={user} requiredRole="admin"><AdminPage context={context} /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

function ProtectedRoute({ user, requiredRole, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <div className="info-box alert">You do not have access to this page.</div>;
  }

  return children;
}

function LandingPage({ user }) {
  return (
    <div>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Academic Repository System</p>
          <h1>AI-Powered Repository and Research Retrieval Chatbot for STI Alaminos</h1>
          <p>
            Centralize academic resources, discover relevant studies, and ask natural-language questions to find the right research quickly.
          </p>

          <div className="actions">
            <Link to="/repository" className="button primary">Explore Research</Link>
            <Link to={user ? '/chatbot' : '/login'} className="button secondary">Ask AI</Link>
            {!user && <Link to="/login" className="button tertiary">Log In</Link>}
          </div>
        </div>

        <div className="card hero-panel">
          <h3>Featured Research</h3>
          <ul className="mini-list">
            <li>
              <strong>AI-Driven Learning Analytics in Higher Education</strong>
              <span>2024 • AI & Data Science</span>
            </li>
            <li>
              <strong>Secure Mobile Banking Systems</strong>
              <span>2023 • Cybersecurity</span>
            </li>
            <li>
              <strong>Network Optimization for Campus Wi-Fi</strong>
              <span>2024 • Systems & Networks</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="feature-grid">
        <div className="card feature-card">
          <h3>Knowledge Search</h3>
          <p>Search papers by title, author, abstract, department, course, and category.</p>
        </div>
        <div className="card feature-card">
          <h3>Role-Based Access</h3>
          <p>Students, faculty, and administrators each have the right access level for repository tasks.</p>
        </div>
        <div className="card feature-card">
          <h3>AI Recommendations</h3>
          <p>Ask in plain English and receive document-backed recommendations from the repository.</p>
        </div>
      </section>

      <section className="card about-box">
        <h2>About the STI Repository</h2>
        <p>
          This digital repository supports STI Alaminos faculty, students, and administrators with centralized access to academic papers, capstone work,
          course materials, and research discovery tools. It improves efficiency, transparency, and knowledge sharing across the institution.
        </p>
      </section>
    </div>
  );
}

function LoginPage({ user, onLogin }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await onLogin(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h2>Sign In</h2>

        <label>
          Username or Email
          <input
            type="text"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </label>

        <div className="row between compact">
          <label className="checkbox-row">
            <input type="checkbox" />
            Remember Me
          </label>
          <a href="#">Forgot Password</a>
        </div>

        {error && <div className="info-box alert">{error}</div>}

        <button type="submit" className="button primary full" disabled={loading}>
          {loading ? 'Signing In...' : 'Log In'}
        </button>
      </form>
    </div>
  );
}

function DashboardPage({ context }) {
  const { user, documents } = context;
  const recentDocs = documents.slice(0, 4);

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="eyebrow">Welcome</p>
          <h2>Hello, {user.name}</h2>
        </div>
      </div>

      <div className="stats-grid">
        <div className="card stat-box">
          <span>Documents</span>
          <strong>{documents.length}</strong>
        </div>
        <div className="card stat-box">
          <span>Role</span>
          <strong>{user.role}</strong>
        </div>
        <div className="card stat-box">
          <span>Recent Uploads</span>
          <strong>{recentDocs.length}</strong>
        </div>
      </div>

      <div className="card panel-box">
        <h3>Recently uploaded research</h3>
        <div className="document-list">
          {recentDocs.map((doc) => (
            <div key={doc.id} className="document-row">
              <div>
                <strong>{doc.title}</strong>
                <p>{doc.authors} • {doc.year}</p>
              </div>
              <Link to="/repository" className="button small secondary">View</Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RepositoryPage({ context }) {
  const { documents, categories, setDocuments } = context;
  const [filters, setFilters] = useState({ search: '', category: '', year: '', department: '', course: '' });
  const [selectedDoc, setSelectedDoc] = useState(null);

  const handleSearch = async (event) => {
    event.preventDefault();
    const params = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params[key] = value;
    });
    await context.fetchDocuments(params);
  };

  const handleDetails = async (documentId) => {
    const data = await apiFetch(`/documents/${documentId}`);
    setSelectedDoc(data.document);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="eyebrow">Research Repository</p>
          <h2>Search academic documents</h2>
        </div>
      </div>

      <form className="card filter-card" onSubmit={handleSearch}>
        <div className="filter-grid">
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search title, author, abstract, course..."
          />
          <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <input
            type="number"
            value={filters.year}
            placeholder="Year"
            onChange={(e) => setFilters({ ...filters, year: e.target.value })}
          />
          <input
            type="text"
            value={filters.department}
            placeholder="Department"
            onChange={(e) => setFilters({ ...filters, department: e.target.value })}
          />
          <input
            type="text"
            value={filters.course}
            placeholder="Course"
            onChange={(e) => setFilters({ ...filters, course: e.target.value })}
          />
          <button type="submit" className="button primary">Search</button>
        </div>
      </form>

      <div className="results-grid">
        {documents.length ? (
          documents.map((doc) => (
            <article key={doc.id} className="card doc-card">
              <div className="doc-meta">
                <span>{doc.category_name || 'Research'}</span>
                <span>{doc.year}</span>
              </div>
              <h3>{doc.title}</h3>
              <p className="muted">{doc.authors}</p>
              <p>{doc.abstract?.slice(0, 140)}...</p>
              <div className="actions small-actions">
                <button type="button" className="button small secondary" onClick={() => handleDetails(doc.id)}>
                  View Details
                </button>
                {doc.fileUrl && (
                  <a className="button small primary" href={`http://localhost:5000${doc.fileUrl}`} target="_blank" rel="noreferrer">
                    Download
                  </a>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className="card empty-state">No documents match your current filters.</div>
        )}
      </div>

      {selectedDoc && (
        <div className="modal-backdrop" onClick={() => setSelectedDoc(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedDoc.title}</h3>
            <p><strong>Authors:</strong> {selectedDoc.authors}</p>
            <p><strong>Year:</strong> {selectedDoc.year}</p>
            <p><strong>Category:</strong> {selectedDoc.category_name}</p>
            <p><strong>Course:</strong> {selectedDoc.course}</p>
            <p><strong>Department:</strong> {selectedDoc.department}</p>
            <div className="abstract-box">{selectedDoc.abstract}</div>
            <div className="actions">
              {selectedDoc.fileUrl && (
                <a className="button primary" href={`http://localhost:5000${selectedDoc.fileUrl}`} target="_blank" rel="noreferrer">
                  Download
                </a>
              )}
              <button type="button" className="button secondary" onClick={() => setSelectedDoc(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatbotPage() {
  const [messages, setMessages] = useState([
    { from: 'bot', text: 'Hello! Ask me about research topics, authors, departments, or coursework.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendQuestion = async (question = input) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    setMessages((prev) => [...prev, { from: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);

    try {
      const data = await apiFetch('/chat', {
        method: 'POST',
        body: JSON.stringify({ question: trimmed }),
      });

      const responseText = `${data.answer}\n\nRelated documents: ${data.results?.length || 0}`;
      setMessages((prev) => [...prev, { from: 'bot', text: responseText }]);
    } catch (err) {
      setMessages((prev) => [...prev, { from: 'bot', text: `Sorry, I could not answer that. ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'Which papers are about AI learning analytics?',
    'Find research on cybersecurity and authentication.',
    'Show me articles about campus Wi-Fi optimization.',
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="eyebrow">AI Research Retrieval</p>
          <h2>Ask the repository chatbot</h2>
        </div>
      </div>

      <div className="card chatbot-box">
        <div className="chat-log">
          {messages.map((message, index) => (
            <div key={`${message.from}-${index}`} className={`bubble ${message.from}`}>
              {message.text}
            </div>
          ))}
        </div>

        <div className="quick-questions">
          {suggestions.map((question) => (
            <button key={question} type="button" className="chip" onClick={() => sendQuestion(question)}>
              {question}
            </button>
          ))}
        </div>

        <div className="chat-input-row">
          <input
            type="text"
            value={input}
            placeholder="Ask in plain English..."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendQuestion();
            }}
          />
          <button type="button" className="button primary" onClick={() => sendQuestion()} disabled={loading}>
            {loading ? 'Searching...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfilePage({ user, setUser }) {
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', password: '' });
  const [message, setMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const data = await apiFetch('/profile', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      setUser(data.user);
      setMessage('Profile updated successfully.');
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="eyebrow">Profile</p>
          <h2>{user.name}</h2>
        </div>
      </div>

      <form className="card auth-card" onSubmit={handleSubmit}>
        <label>
          Full Name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>

        <label>
          Email
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>

        <label>
          New Password
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Leave blank to keep current password"
          />
        </label>

        {message && <div className="info-box success">{message}</div>}
        <button type="submit" className="button primary full">Save Changes</button>
      </form>
    </div>
  );
}

function AdminPage({ context }) {
  const { stats, categories, user } = context;
  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState({ name: '', username: '', email: '', password: '', role: 'student' });
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [status, setStatus] = useState('');

  useEffect(() => {
    const loadUsers = async () => {
      const data = await apiFetch('/users');
      setUsers(data.users || []);
    };
    loadUsers();
    context.fetchCategories();
  }, []);

  const handleCreateUser = async (event) => {
    event.preventDefault();
    try {
      await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify(userForm),
      });
      setStatus('User created successfully.');
      setUserForm({ name: '', username: '', email: '', password: '', role: 'student' });
      const data = await apiFetch('/users');
      setUsers(data.users || []);
    } catch (err) {
      setStatus(err.message);
    }
  };

  const handleCreateCategory = async (event) => {
    event.preventDefault();
    try {
      await apiFetch('/categories', {
        method: 'POST',
        body: JSON.stringify(categoryForm),
      });
      setStatus('Category added successfully.');
      setCategoryForm({ name: '', description: '' });
      context.fetchCategories();
    } catch (err) {
      setStatus(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="eyebrow">Administrator Dashboard</p>
          <h2>Repository management</h2>
        </div>
      </div>

      <div className="stats-grid">
        <div className="card stat-box">
          <span>Total Documents</span>
          <strong>{stats?.totalDocuments || 0}</strong>
        </div>
        <div className="card stat-box">
          <span>Total Users</span>
          <strong>{stats?.totalUsers || 0}</strong>
        </div>
        <div className="card stat-box">
          <span>Categories</span>
          <strong>{stats?.totalCategories || 0}</strong>
        </div>
      </div>

      {status && <div className="info-box success">{status}</div>}

      <div className="admin-grid">
        <form className="card panel-box" onSubmit={handleCreateUser}>
          <h3>Add User</h3>
          <label>
            Full Name
            <input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required />
          </label>
          <label>
            Username
            <input value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} required />
          </label>
          <label>
            Email
            <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
          </label>
          <label>
            Password
            <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required />
          </label>
          <label>
            Role
            <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button type="submit" className="button primary full">Create Account</button>
        </form>

        <form className="card panel-box" onSubmit={handleCreateCategory}>
          <h3>Add Category</h3>
          <label>
            Category Name
            <input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required />
          </label>
          <label>
            Description
            <textarea value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} />
          </label>
          <button type="submit" className="button secondary full">Save Category</button>
        </form>
      </div>

      <div className="card panel-box">
        <h3>User list</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.username}</td>
                <td>{row.role}</td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
