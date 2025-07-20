import { SentenceTransformer } from './sentenceTransformer';

interface EmbeddingTask {
  id: string;
  text: string;
  resolve: (embedding: number[]) => void;
  reject: (error: Error) => void;
  priority?: number;
}

export interface EmbeddingProgress {
  totalTasks: number;
  completedTasks: number;
  currentTask?: string;
  isProcessing: boolean;
}

export class BackgroundEmbeddingService {
  private static instance: BackgroundEmbeddingService;
  private transformer: SentenceTransformer;
  private taskQueue: EmbeddingTask[] = [];
  private isProcessing = false;
  private progress: EmbeddingProgress = {
    totalTasks: 0,
    completedTasks: 0,
    isProcessing: false
  };

  private constructor() {
    this.transformer = new SentenceTransformer();
  }

  static getInstance(): BackgroundEmbeddingService {
    if (!BackgroundEmbeddingService.instance) {
      BackgroundEmbeddingService.instance = new BackgroundEmbeddingService();
    }
    return BackgroundEmbeddingService.instance;
  }

  getProgress(): EmbeddingProgress {
    return { ...this.progress };
  }

  async generateEmbedding(text: string, priority: number = 0): Promise<number[]> {
    return new Promise<number[]>((resolve, reject) => {
      const task: EmbeddingTask = {
        id: Date.now().toString() + Math.random().toString(36),
        text,
        resolve,
        reject,
        priority
      };

      // Insert task based on priority (higher priority first)
      let insertIndex = this.taskQueue.findIndex(t => (t.priority || 0) < priority);
      if (insertIndex === -1) {
        this.taskQueue.push(task);
      } else {
        this.taskQueue.splice(insertIndex, 0, task);
      }

      this.progress.totalTasks = this.taskQueue.length + (this.isProcessing ? 1 : 0);

      // Start processing if not already running
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.taskQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.progress.isProcessing = true;

    console.log(`🔄 BackgroundEmbeddingService: Starting to process ${this.taskQueue.length} embedding tasks`);

    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()!;
      
      try {
        console.log(`📝 Processing embedding task ${task.id} (${this.progress.completedTasks + 1}/${this.progress.totalTasks})`);
        this.progress.currentTask = task.text.substring(0, 100) + (task.text.length > 100 ? '...' : '');

        const embedding = await this.transformer.generateEmbedding(task.text);
        task.resolve(embedding);
        
        this.progress.completedTasks++;
        console.log(`✅ Completed embedding task ${task.id} (${this.progress.completedTasks}/${this.progress.totalTasks})`);

        // Add small delay to prevent blocking the UI thread completely
        await new Promise(resolve => setTimeout(resolve, 10));

      } catch (error) {
        console.error(`❌ Failed embedding task ${task.id}:`, error);
        task.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    console.log(`✅ BackgroundEmbeddingService: Completed processing all ${this.progress.completedTasks} embedding tasks`);
    
    this.isProcessing = false;
    this.progress.isProcessing = false;
    this.progress.currentTask = undefined;
    
    // Reset counters for next batch
    this.progress.totalTasks = 0;
    this.progress.completedTasks = 0;
  }

  // Batch process multiple texts efficiently
  async generateEmbeddings(texts: string[], priority: number = 0): Promise<number[][]> {
    const promises = texts.map(text => this.generateEmbedding(text, priority));
    return Promise.all(promises);
  }

  // Clear the queue (useful for canceling operations)
  clearQueue(): void {
    const rejectedTasks = [...this.taskQueue];
    this.taskQueue = [];
    this.progress.totalTasks = this.isProcessing ? 1 : 0;
    
    // Reject all pending tasks
    rejectedTasks.forEach(task => {
      task.reject(new Error('Task cancelled - queue cleared'));
    });
    
    console.log(`🧹 BackgroundEmbeddingService: Cleared ${rejectedTasks.length} pending tasks`);
  }

  // Get queue status
  getQueueStatus(): { pending: number; isProcessing: boolean } {
    return {
      pending: this.taskQueue.length,
      isProcessing: this.isProcessing
    };
  }
}