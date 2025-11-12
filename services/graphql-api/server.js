const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { PubSub } = require('graphql-subscriptions');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

// === TAMBAHAN UNTUK APOLLO SERVER v3 SUBSCRIPTIONS ===
const http = require('http'); // Tambahkan http
const { ApolloServerPluginDrainHttpServer } = require('apollo-server-core');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { WebSocketServer } = require('ws'); // Tambahkan ws
const { useServer } = require('graphql-ws/lib/use/ws');
// ====================================================

const app = express();
const pubsub = new PubSub();

// Enable CORS
app.use(cors({
  origin: [
    'http://localhost:3000', // API Gateway
    'http://localhost:3002', // Frontend
    'http://api-gateway:3000', // Docker container name
    'http://frontend-app:3002' // Docker container name
  ],
  credentials: true
}));

// Data dummy (sama seperti sebelumnya)
let posts = [
  { id: '1', title: 'Welcome to GraphQL', content: 'This is our first GraphQL post!', author: 'GraphQL Team', createdAt: new Date().toISOString() },
  { id: '2', title: 'Real-time Updates', content: 'Watch this space for real-time updates.', author: 'Development Team', createdAt: new Date().toISOString() }
];
let comments = [
  { id: '1', postId: '1', content: 'Great introduction!', author: 'John Doe', createdAt: new Date().toISOString() }
];

// Type Defs (Definisi Skema)
// Modifikasi: Hapus 'author' dari input createPost
const typeDefs = `
  type Post {
    id: ID!
    title: String!
    content: String!
    author: String!
    createdAt: String!
    comments: [Comment!]!
  }
  type Comment {
    id: ID!
    postId: ID!
    content: String!
    author: String!
    createdAt: String!
  }
  type Query {
    posts: [Post!]!
    post(id: ID!): Post
    comments(postId: ID!): [Comment!]!
  }
  type Mutation {
    createPost(title: String!, content: String!): Post!
    updatePost(id: ID!, title: String, content: String): Post!
    deletePost(id: ID!): Boolean!
    createComment(postId: ID!, content: String!, author: String!): Comment!
    deleteComment(id: ID!): Boolean!
  }
  type Subscription {
    postAdded: Post!
    commentAdded: Comment!
    postUpdated: Post!
    postDeleted: ID!
  }
`;

// Resolvers
// Modifikasi: Sesuaikan createPost untuk mengambil user dari context
const resolvers = {
  Query: {
    posts: () => posts,
    post: (_, { id }) => posts.find(post => post.id === id),
    comments: (_, { postId }) => comments.filter(comment => comment.postId === postId),
  },
  Post: {
    comments: (parent) => comments.filter(comment => comment.postId === parent.id),
  },
  Mutation: {
    createPost: (_, { title, content }, context) => {
      if (!context.user || !context.user.email) {
        throw new Error('Not authenticated or user email not found in token');
      }
      const newPost = {
        id: uuidv4(),
        title,
        content,
        author: context.user.email, // Ambil author dari context
        createdAt: new Date().toISOString(),
      };
      posts.push(newPost);
      pubsub.publish('POST_ADDED', { postAdded: newPost });
      return newPost;
    },
    // (Mutasi lainnya tetap sama...)
    updatePost: (_, { id, title, content }) => {
      const postIndex = posts.findIndex(post => post.id === id);
      if (postIndex === -1) throw new Error('Post not found');
      const updatedPost = { ...posts[postIndex], ...(title && { title }), ...(content && { content }) };
      posts[postIndex] = updatedPost;
      pubsub.publish('POST_UPDATED', { postUpdated: updatedPost });
      return updatedPost;
    },
    deletePost: (_, { id }) => {
      const postIndex = posts.findIndex(post => post.id === id);
      if (postIndex === -1) return false;
      comments = comments.filter(comment => comment.postId !== id);
      posts.splice(postIndex, 1);
      pubsub.publish('POST_DELETED', { postDeleted: id });
      return true;
    },
    createComment: (_, { postId, content, author }) => {
      const post = posts.find(p => p.id === postId);
      if (!post) throw new Error('Post not found');
      const newComment = { id: uuidv4(), postId, content, author, createdAt: new Date().toISOString() };
      comments.push(newComment);
      pubsub.publish('COMMENT_ADDED', { commentAdded: newComment });
      return newComment;
    },
    deleteComment: (_, { id }) => {
      const commentIndex = comments.findIndex(comment => comment.id === id);
      if (commentIndex === -1) return false;
      comments.splice(commentIndex, 1);
      return true;
    },
  },
  Subscription: {
    postAdded: { subscribe: () => pubsub.asyncIterator(['POST_ADDED']) },
    commentAdded: { subscribe: () => pubsub.asyncIterator(['COMMENT_ADDED']) },
    postUpdated: { subscribe: () => pubsub.asyncIterator(['POST_UPDATED']) },
    postDeleted: { subscribe: () => pubsub.asyncIterator(['POST_DELETED']) },
  },
};

// Gabungkan typeDefs dan resolvers ke dalam schema
const schema = makeExecutableSchema({ typeDefs, resolvers });

async function startServer() {
  // Buat HTTP server (diperlukan untuk subscriptions)
  const httpServer = http.createServer(app);

  // Buat WebSocket server
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql', // Sesuaikan path ini agar sama dengan Apollo
  });

  // Siapkan server cleanup
  const serverCleanup = useServer({ 
    schema,
    // Context untuk subscriptions
    context: (ctx) => {
      // Di sini Anda bisa menambahkan logic auth untuk WebSocket jika diperlukan
      return { pubsub };
    },
  }, wsServer);

  // Buat Apollo Server
  const server = new ApolloServer({
    schema,
    context: ({ req }) => {
      // Context untuk HTTP request (Query/Mutation)
      const userPayload = req.headers['x-user-payload'];
      let user = null;
      if (userPayload) {
        try {
          user = JSON.parse(userPayload);
        } catch (e) {
          console.error('Error parsing x-user-payload header:', e);
        }
      }
      return { req, pubsub, user };
    },
    plugins: [
      // Plugin untuk shutdown HTTP server
      ApolloServerPluginDrainHttpServer({ httpServer }),
      
      // Plugin untuk shutdown WebSocket server
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  const PORT = process.env.PORT || 4000;
  
  // Gunakan httpServer.listen alih-alih app.listen
  httpServer.listen(PORT, () => {
    console.log(`🚀 GraphQL API Server running on port ${PORT}`);
    console.log(`🛰  GraphQL endpoint: http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`🌊 Subscriptions ready at ws://localhost:${PORT}${server.graphqlPath}`);
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'graphql-api',
    timestamp: new Date().toISOString(),
    data: {
      posts: posts.length,
      comments: comments.length
    }
  });
});

startServer().catch(error => {
  console.error('Failed to start GraphQL server:', error);
  process.exit(1);
});