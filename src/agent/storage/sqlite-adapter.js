"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteAdapter = void 0;
const sqlite3 = __importStar(require("sqlite3"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class SQLiteAdapter {
    constructor(workspaceRoot) {
        const dataDir = path.join(workspaceRoot, '.agent', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        const dbPath = path.join(dataDir, 'task-groups.db');
        this.db = new sqlite3.Database(dbPath);
        this.ready = this.init();
    }
    init() {
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
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        });
    }
    async save(taskGroup) {
        await this.ready;
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                const stmt = this.db.prepare(`INSERT OR REPLACE INTO task_groups 
                    (id, title, description, status, created_at, updated_at) 
                    VALUES (?, ?, ?, ?, ?, ?)`);
                stmt.run(taskGroup.id, taskGroup.title, taskGroup.description || '', taskGroup.status, taskGroup.createdAt, taskGroup.updatedAt);
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
                    subStmt.run(st.id, taskGroup.id, st.title, st.description || '', st.status, JSON.stringify(st.assignedFiles || []), JSON.stringify(st.dependencies || []));
                });
                subStmt.finalize();
                // Insert Progress Updates
                const progStmt = this.db.prepare(`INSERT INTO progress_updates
                    (group_id, subtask_id, message, type, timestamp)
                    VALUES (?, ?, ?, ?, ?)`);
                taskGroup.progress.forEach(p => {
                    progStmt.run(taskGroup.id, p.subtaskId || null, p.message, p.type, p.timestamp);
                });
                progStmt.finalize((err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        });
    }
    async get(id) {
        await this.ready;
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM task_groups WHERE id = ?', [id], (err, row) => {
                if (err)
                    return reject(err);
                if (!row)
                    return resolve(undefined);
                const group = {
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
                this.db.all('SELECT * FROM subtasks WHERE group_id = ?', [id], (err, rows) => {
                    if (err)
                        return reject(err);
                    group.subtasks = rows.map(r => ({
                        id: r.id,
                        title: r.title,
                        description: r.description,
                        status: r.status,
                        assignedFiles: JSON.parse(r.assigned_files || '[]'),
                        dependencies: JSON.parse(r.dependencies || '[]')
                    }));
                    // Fetch progress
                    this.db.all('SELECT * FROM progress_updates WHERE group_id = ? ORDER BY timestamp ASC', [id], (err, rows) => {
                        if (err)
                            return reject(err);
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
    async getAll() {
        await this.ready;
        return new Promise((resolve, reject) => {
            this.db.all('SELECT id FROM task_groups ORDER BY updated_at DESC', async (err, rows) => {
                if (err)
                    return reject(err);
                try {
                    const groups = await Promise.all(rows.map(row => this.get(row.id)));
                    resolve(groups.filter((g) => !!g));
                }
                catch (error) {
                    reject(error);
                }
            });
        });
    }
    async delete(id) {
        await this.ready;
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM task_groups WHERE id = ?', [id], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
}
exports.SQLiteAdapter = SQLiteAdapter;
