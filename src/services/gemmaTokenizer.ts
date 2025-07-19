// Gemma Tokenizer for ONNX model inference
// This implements a simplified version of the Gemma tokenizer

export interface TokenizerResult {
  input_ids: number[];
  attention_mask: number[];
  position_ids: number[];
}

export class GemmaTokenizer {
  private vocab: Map<string, number> = new Map();
  private reverseVocab: Map<number, string> = new Map();
  private maxLength: number = 2048;
  private padTokenId: number = 0;
  private bosTokenId: number = 2;
  private eosTokenId: number = 1;
  private unkTokenId: number = 3;

  constructor() {
    this.initializeBasicVocab();
  }

  private initializeBasicVocab() {
    // Initialize with basic Gemma vocabulary
    // This is a simplified version - in production, you'd load the full vocab from the model
    
    // Special tokens
    this.vocab.set('<pad>', 0);
    this.vocab.set('</s>', 1);
    this.vocab.set('<s>', 2);
    this.vocab.set('<unk>', 3);
    
    // Common words and subwords
    let tokenId = 4;
    const commonWords = [
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'shall',
      'I', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
      'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
      'medical', 'emergency', 'procedure', 'treatment', 'patient', 'doctor', 'nurse', 'hospital',
      'search', 'rescue', 'equipment', 'guideline', 'protocol', 'tccc', 'march', 'tourniquet',
      'airway', 'breathing', 'circulation', 'bleeding', 'shock', 'trauma', 'wound', 'injury',
      'building', 'violation', 'fix', 'repair', 'maintenance', 'safety', 'code', 'regulation'
    ];
    
    commonWords.forEach(word => {
      this.vocab.set(word.toLowerCase(), tokenId);
      this.reverseVocab.set(tokenId, word.toLowerCase());
      tokenId++;
    });
    
    // Add individual characters and common subwords
    for (let i = 32; i <= 126; i++) {
      const char = String.fromCharCode(i);
      if (!this.vocab.has(char)) {
        this.vocab.set(char, tokenId);
        this.reverseVocab.set(tokenId, char);
        tokenId++;
      }
    }
    
    // Add common subwords and prefixes
    const subwords = ['ing', 'ed', 'er', 'est', 'ly', 'tion', 'sion', 'ment', 'ness', 'ful', 'less'];
    subwords.forEach(subword => {
      if (!this.vocab.has(subword)) {
        this.vocab.set(subword, tokenId);
        this.reverseVocab.set(tokenId, subword);
        tokenId++;
      }
    });
  }

  async encode(text: string): Promise<TokenizerResult> {
    const tokens = this.tokenize(text);
    const inputIds = [this.bosTokenId]; // Start with BOS token
    const attentionMask = [1];
    const positionIds = [0]; // Position IDs start from 0
    
    for (const token of tokens) {
      if (inputIds.length >= this.maxLength - 1) break; // Leave room for EOS token
      
      const tokenId = this.vocab.get(token) || this.unkTokenId;
      inputIds.push(tokenId);
      attentionMask.push(1);
      positionIds.push(inputIds.length - 1); // Position ID is the current index
    }
    
    inputIds.push(this.eosTokenId); // End with EOS token
    attentionMask.push(1);
    positionIds.push(inputIds.length - 1);
    
    // Pad to max length
    while (inputIds.length < this.maxLength) {
      inputIds.push(this.padTokenId);
      attentionMask.push(0);
      positionIds.push(inputIds.length - 1);
    }
    
    return {
      input_ids: inputIds,
      attention_mask: attentionMask,
      position_ids: positionIds
    };
  }

  async decode(tokenIds: number[]): Promise<string> {
    const tokens: string[] = [];
    
    for (const tokenId of tokenIds) {
      if (tokenId === this.padTokenId || tokenId === this.bosTokenId || tokenId === this.eosTokenId) {
        continue; // Skip special tokens
      }
      
      const token = this.reverseVocab.get(tokenId) || `<unk:${tokenId}>`;
      tokens.push(token);
    }
    
    return tokens.join(' ').replace(/\s+/g, ' ').trim();
  }

  private tokenize(text: string): string[] {
    // Simple tokenization - split on whitespace and punctuation
    // In production, you'd use a more sophisticated tokenizer
    const normalized = text.toLowerCase().trim();
    
    // Split on whitespace and common punctuation
    const tokens = normalized.split(/\s+|[.,!?;:()[\]{}"'`~@#$%^&*+=|\\/<>]/);
    
    // Filter out empty tokens and add subword tokenization
    const result: string[] = [];
    for (const token of tokens) {
      if (token.length === 0) continue;
      
      // Check if token exists in vocabulary
      if (this.vocab.has(token)) {
        result.push(token);
      } else {
        // Simple subword tokenization
        const subwords = this.subwordTokenize(token);
        result.push(...subwords);
      }
    }
    
    return result;
  }

  private subwordTokenize(word: string): string[] {
    // Simple subword tokenization
    // In production, you'd use Byte Pair Encoding (BPE) or similar
    
    const tokens: string[] = [];
    let remaining = word;
    
    // Try to match longest possible subwords
    while (remaining.length > 0) {
      let found = false;
      
      // Try to match from longest to shortest
      for (let len = Math.min(remaining.length, 10); len > 0; len--) {
        const candidate = remaining.substring(0, len);
        if (this.vocab.has(candidate)) {
          tokens.push(candidate);
          remaining = remaining.substring(len);
          found = true;
          break;
        }
      }
      
      if (!found) {
        // If no match found, add as unknown token
        tokens.push(remaining[0] || '<unk>');
        remaining = remaining.substring(1);
      }
    }
    
    return tokens;
  }

  getVocabSize(): number {
    return this.vocab.size;
  }

  getMaxLength(): number {
    return this.maxLength;
  }
} 