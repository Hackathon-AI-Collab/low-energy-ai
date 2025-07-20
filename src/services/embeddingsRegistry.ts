// Lazy-loading registry for embedding JSON files (legacy uncompressed format)
// DISABLED: This causes OutOfMemoryError due to React Native require() loading all files immediately
// Use StreamingEmbeddingService instead

// DISABLED to prevent OutOfMemoryError
const manifestLoader = () => {
  console.warn('📦 embeddingsRegistry is disabled - use StreamingEmbeddingService instead');
  return null;
};

// DISABLED: These require() calls cause immediate loading of all 172MB of embeddings
// React Native eagerly evaluates require() statements even inside functions
const embeddingLoaders = {
  // All loaders disabled to prevent OutOfMemoryError
};

// In-memory cache for loaded embeddings (with size limits)
const embeddingCache = new Map<string, any>();
const CACHE_SIZE_LIMIT = 3; // Only keep 3 documents in memory at once

// Registry mapping with lazy loading
export const embeddingsRegistry = {
  manifestLoader,
  embeddingLoaders
};

// Helper functions
let manifestCache: any = null;

export function getManifest() {
  console.warn('📦 getManifest() disabled - use StreamingEmbeddingService instead');
  return null;
}

export function getEmbeddingsForDocument(documentId: string) {
  console.warn('📦 getEmbeddingsForDocument() disabled - use StreamingEmbeddingService instead');
  return null;
}

// Cache management functions - disabled
export function clearEmbeddingCache() {
  console.log('📦 clearEmbeddingCache() disabled - use StreamingEmbeddingService instead');
}

export function getCacheStats() {
  return {
    size: 0,
    limit: 0,
    documents: []
  };
}

// Background preloading function - disabled
export function preloadDocumentEmbeddings(documentIds: string[], delay: number = 1000) {
  console.log('📦 preloadDocumentEmbeddings() disabled - use StreamingEmbeddingService instead');
  return Promise.resolve();
}