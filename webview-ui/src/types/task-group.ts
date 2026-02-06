export type TaskGroupStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked';
export type SubtaskStatus = 'not-started' | 'in-progress' | 'completed' | 'skipped';
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
    description?: string;
    status: TaskGroupStatus;
    createdAt: number;
    updatedAt: number;
    subtasks: Subtask[];
    progress: ProgressUpdate[];
}
