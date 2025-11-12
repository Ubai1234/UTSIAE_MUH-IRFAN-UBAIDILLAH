'use client';

import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:3000/graphql',
});

// === MODIFIKASI DIMULAI DI SINI ===
// authLink sekarang membaca token dari localStorage
const authLink = setContext((_, { headers }) => {
  // Ambil token dari local storage
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '', // Tambahkan header
    }
  }
});
// === MODIFIKASI SELESAI ===

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

export function ApolloWrapper({ children }: { children: React.ReactNode }) {
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}