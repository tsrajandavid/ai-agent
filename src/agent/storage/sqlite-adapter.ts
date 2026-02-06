import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { TaskGroup, Subtask, ProgressUpdate, TaskGroupStorage } from '../task-group-types';

export class SQLiteAdapter implements TaskGroupStorage {
    private db: sqlite3.Database;
    private ready: Promise<void>;

    constructor(workspaceRoot: string) {
        const dataDir = path.join(workspaceRoot, '.agent', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        const dbPath = path.join(dataDir, 'task-groups.db');

        this.db = new sqlite3.Database(dbPath);
        this.ready = this.init();
    }

    private init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Task Groups Table
                this.db.run(`CREATE TABLE IF NOT EXISTS task_groups (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    status TEXT,
                    created_at INTEGER,
                    updated_at INTEGER
                )`);

                // Subtasks Table
                this.db.run(`CREATE TABLE IF NOT EXISTS subtasks (
                    id TEXT PRIMARY KEY,
                    group_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    status TEXT,
                    assigned_files TEXT, -- JSON array
                    dependencies TEXT,   -- JSON array
                    FOREIGN KEY(group_id) REFERENCES task_groups(id) ON DELETE CASCADE
                )`);

                // Progress Updates Table
                this.db.run(`CREATE TABLE IF NOT EXISTS progress_updates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    group_id TEXT NOT NULL,
                    subtask_id TEXT,
                    message TEXT NOT NULL,
                    type TEXT,
                    timestamp INTEGER,
                    FOREIGN KEY(group_id) REFERENCES task_groups(id) ON DELETE CASCADE
                )`, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    }

    async save(taskGroup: TaskGroup): Promise<void> {
        await this.ready;

        return new Promise<void>((resolve, reject) => {
            this.db.serialize(() => {
                const stmt = this.db.prepare(`INSERT OR REPLACE INTO task_groups 
                    (id, title, description, status, created_at, updated_at) 
                    VALUES (?, ?, ?, ?, ?, ?)`);

                stmt.run(
                    taskGroup.id,
                    taskGroup.title,
                    taskGroup.description || '',
                    taskGroup.status,
                    taskGroup.createdAt,
                    taskGroup.updatedAt
                );
                stmt.finalize();

                // Delete existing subtasks/progress to fully replace (simplest strategy for now)
                // Optimization: Update diffs instead, but replace is safer for consistency
                this.db.run('DELETE FROM subtasks WHERE group_id = ?', taskGroup.id);
                this.db.run('DELETE FROM progress_updates WHERE group_id = ?', taskGroup.id);

                // Insert Subtasks
                const subStmt = this.db.prepare(`INSERT INTO subtasks 
                    (id, group_id, title, description, status, assigned_files, dependencies)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`);

                taskGroup.subtasks.forEach(st => {
                    subStmt.run(
                        st.id,
                        taskGroup.id,
                        st.title,
                        st.description || '',
                        st.status,
                        JSON.stringify(st.assignedFiles || []),
                        JSON.stringify(st.dependencies || [])
                    );
                });
                subStmt.finalize();

                // Insert Progress Updates
                const progStmt = this.db.prepare(`INSERT INTO progress_updates
                    (group_id, subtask_id, message, type, timestamp)
                    VALUES (?, ?, ?, ?, ?)`);

                taskGroup.progress.forEach(p => {
                    progStmt.run(
                        taskGroup.id,
                        p.subtaskId || null,
                        p.message,
                        p.type,
                        p.timestamp
                    );
                });
                progStmt.finalize((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    }

    async get(id: string): Promise<TaskGroup | undefined> {
        await this.ready;

        return new Promise<TaskGroup | undefined>((resolve, reject) => {
            this.db.get('SELECT * FROM task_groups WHERE id = ?', [id], (err, row: any) => {
                if (err) return reject(err);
                if (!row) return resolve(undefined);

                const group: TaskGroup = {
                    id: row.id,
                    title: row.title,
                    description: row.description,
                    status: row.status,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                    subtasks: [],
                    progress: []
                };

                // Fetch subtasks
                this.db.all('SELECT * FROM subtasks WHERE group_id = ?', [id], (err, rows: any[]) => {
                    if (err) return reject(err);
                    group.subtasks = rows.map(r => ({
                        id: r.id,
                        title: r.title,
                        description: r.description,
                        status: r.status,
                        assignedFiles: JSON.parse(r.assigned_files || '[]'),
                        dependencies: JSON.parse(r.dependencies || '[]')
                    }));

                    // Fetch progress
                    this.db.all('SELECT * FROM progress_updates WHERE group_id = ? ORDER BY timestamp ASC', [id], (err, rows: any[]) => {
                        if (err) return reject(err);
                        group.progress = rows.map(r => ({
                            timestamp: r.timestamp,
                            message: r.message,
                            type: r.type,
                            subtaskId: r.subtask_id
                        }));
                        resolve(group);
                    });
                });
            });
        });
    }

    async getAll(): Promise<TaskGroup[]> {
        await this.ready;

        return new Promise<TaskGroup[]>((resolve, reject) => {
            this.db.all('SELECT id FROM task_groups ORDER BY updated_at DESC', async (err, rows: any[]) => {
                if (err) return reject(err);

                try {
                    const groups = await Promise.all(rows.map(row => this.get(row.id)));
                    resolve(groups.filter((g): g is TaskGroup => !!g));
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    async delete(id: string): Promise<void> {
        await this.ready;
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM task_groups WHERE id = ?', [id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}
