export type TaskGroupStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked';
export type SubtaskStatus = 'not-started' | 'in-progress' | 'completed' | 'skipped' | 'failed';
export type ProgressType = 'info' | 'success' | 'warning' | 'error';

export interface Subtask {
    id: string;
    title: string;
    description?: string;
    status: SubtaskStatus;
    assignedFiles?: string[];
    dependencies?: string[];
}

export interface ProgressUpdate {
    timestamp: number;
    message: string;
    type: ProgressType;
    subtaskId?: string;
}

export interface TaskGroup {
    id: string;
    title: string;
    description?: string; // Goal
    status: TaskGroupStatus;
    isAutoRunning?: boolean;
    createdAt: number;
    updatedAt: number;
    subtasks: Subtask[];
    progress: ProgressUpdate[];
}

export interface TaskGroupStorage {
    save(taskGroup: TaskGroup): Promise<void>;
    get(id: string): Promise<TaskGroup | undefined>;
    getAll(): Promise<TaskGroup[]>;
    delete(id: string): Promise<void>;
}
