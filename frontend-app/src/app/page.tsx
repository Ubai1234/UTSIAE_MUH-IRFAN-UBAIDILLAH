'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { userApi, authApi } from '@/lib/api';

// GraphQL queries and mutations (ini tetap sama)
const GET_POSTS = gql`
  query GetPosts {
    posts {
      id
      title
      content
      author
      createdAt
    }
  }
`;

const CREATE_POST = gql`
  mutation CreatePost($title: String!, $content: String!) {
    createPost(title: $title, content: $content) {
      id
      title
      content
      author
      createdAt
    }
  }
`;

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // === MODIFIKASI 1: Tambahkan state untuk 'view' ===
  const [view, setView] = useState<'login' | 'register'>('login'); // Mulai dari 'login'

  // State untuk form
  const [regForm, setRegForm] = useState({ name: '', email: '', password: '' });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [newPost, setNewPost] = useState({ title: '', content: '' });

  // Cek token saat komponen dimuat
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
    } else {
      setLoading(false); // Selesai loading jika tidak ada token
    }
  }, []);

  // GraphQL queries
  const { data: postsData, loading: postsLoading, refetch: refetchPosts } = useQuery(GET_POSTS, {
    skip: !token, // Jangan fetch post jika belum login
  });
  const [createPost] = useMutation(CREATE_POST);

  // Fetch users from REST API (Hanya jika token ada)
  useEffect(() => {
    if (token) {
      setLoading(true);
      fetchUsers();
    }
  }, [token]);

  const fetchUsers = async () => {
    try {
      const response = await userApi.getUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  // === MODIFIKASI 2: Ubah 'handleRegister' untuk pindah view ===
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authApi.register(regForm);
      alert('Registration successful! Please login.');
      setRegForm({ name: '', email: '', password: '' });
      setView('login'); // Pindahkan kembali ke view login
    } catch (error) {
      console.error('Error registering:', error);
      alert('Registration failed.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await authApi.login(loginForm);
      const { token } = response.data;
      
      localStorage.setItem('token', token);
      setToken(token); // Ini akan memicu re-render ke Dashboard
      
      setLoginForm({ email: '', password: '' });
      refetchPosts(); // Panggil refetch setelah login
    } catch (error) {
      console.error('Error logging in:', error);
      alert('Login failed. Check credentials.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUsers([]); 
    setView('login'); // Kembali ke view login setelah logout
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPost({
        variables: newPost,
      });
      setNewPost({ title: '', content: '' });
      refetchPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post. Are you logged in?');
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await userApi.deleteUser(id);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  // Tampilkan loading jika sedang memverifikasi token
  if (loading && token === null) {
     return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  // === MODIFIKASI 3: Ubah cara render halaman Auth ===
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <h1 className="text-4xl font-bold text-center text-gray-900">
            Microservices Demo App
          </h1>
          
          {/* Tampilkan Form Login */}
          {view === 'login' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Login</h2>
              <form onSubmit={handleLogin} className="mb-6">
                <div className="grid grid-cols-1 gap-4">
                  <input
                    type="email"
                    placeholder="Email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    className="border rounded-md px-3 py-2"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="border rounded-md px-3 py-2"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 w-full"
                  >
                    Login
                  </button>
                </div>
              </form>
              <p className="text-center text-sm">
                Belum punya akun?{' '}
                <button
                  onClick={() => setView('register')}
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Register di sini
                </button>
              </p>
            </div>
          )}

          {/* Tampilkan Form Register */}
          {view === 'register' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Register</h2>
              <form onSubmit={handleRegister} className="mb-6">
                <div className="grid grid-cols-1 gap-4">
                  <input
                    type="text"
                    placeholder="Name"
                    value={regForm.name}
                    onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                    className="border rounded-md px-3 py-2"
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    className="border rounded-md px-3 py-2"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={regForm.password}
                    onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    className="border rounded-md px-3 py-2"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-800 w-full"
                  >
                    Register
                  </button>
                </div>
              </form>
              <p className="text-center text-sm">
                Sudah punya akun?{' '}
                <button
                  onClick={() => setView('login')}
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Login di sini
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // === INI ADALAH DASHBOARD ANDA ===
  // (Render ini jika token ADA)
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900">
            Microservices Demo App
          </h1>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
          >
            Logout
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Users Section (REST API) */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Users (REST API)</h2>
            {loading ? (
              <p>Loading users...</p>
            ) : (
              <div className="space-y-4">
                {users.map((user: any) => (
                  <div key={user.id} className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <p className="font-semibold">{user.name}</p>
                      <p className="text-gray-600 text-sm">{user.email}</p>
                      <p className="text-gray-500 text-xs">Age: {user.age} • {user.role}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Posts Section (GraphQL) */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Posts (GraphQL)</h2>
            
            {/* Create Post Form */}
            <form onSubmit={handleCreatePost} className="mb-6">
              <div className="grid grid-cols-1 gap-4">
                <input
                  type="text"
                  placeholder="Title"
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  className="border rounded-md px-3 py-2"
                  required
                />
                <textarea
                  placeholder="Content"
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  className="border rounded-md px-3 py-2 h-24"
                  required
                />
                <button
                  type="submit"
                  className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
                >
                  Add Post (as Logged in User)
                </button>
              </div>
            </form>

            {/* Posts List */}
            {postsLoading ? (
              <p>Loading posts...</p>
            ) : (
              <div className="space-y-4">
                {postsData?.posts.map((post: any) => (
                  <div key={post.id} className="p-4 border rounded">
                    <h3 className="font-semibold text-lg">{post.title}</h3>
                    <p className="text-gray-600 mt-2">{post.content}</p>
                    <div className="flex justify-between items-center mt-3 text-sm text-gray-500">
                      <span>By: {post.author}</span>
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}