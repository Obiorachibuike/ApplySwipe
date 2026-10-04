type JobHandler<T> = (data: T) => Promise<void>;

interface QueuedTask<T> {
  id: string;
  name: string;
  data: T;
  createdAt: number;
}

export class BackgroundQueue {
  private handlers = new Map<string, JobHandler<any>>();
  private tasks: QueuedTask<any>[] = [];
  private isProcessing = false;

  public register<T>(taskName: string, handler: JobHandler<T>) {
    this.handlers.set(taskName, handler);
  }

  public async dispatch<T>(taskName: string, data: T): Promise<string> {
    const id = `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.tasks.push({ id, name: taskName, data, createdAt: Date.now() });

    // Process asynchronously in background
    setTimeout(() => this.processNext(), 10);
    return id;
  }

  private async processNext() {
    if (this.isProcessing || this.tasks.length === 0) return;
    this.isProcessing = true;
    const task = this.tasks.shift();
    if (task) {
      const handler = this.handlers.get(task.name);
      if (handler) {
        try {
          await handler(task.data);
        } catch (err) {
          console.error(`Error processing background job ${task.name}:`, err);
        }
      }
    }
    this.isProcessing = false;
    if (this.tasks.length > 0) {
      setTimeout(() => this.processNext(), 10);
    }
  }
}

export const backgroundQueue = new BackgroundQueue();
