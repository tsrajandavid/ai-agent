import { Tool } from './tool-interface';
import * as cp from 'child_process';
import * as util from 'util';

const exec = util.promisify(cp.exec);

export class RunCommandTool implements Tool {
    name = 'run_command';
    description = 'Execute a shell command. Usage: run_command <command>';

    constructor(private workspaceRoot: string) { }

    async execute(command: string): Promise<string> {
        try {
            // Basic security: preventing some obvious dangerous commands could go here
            // For now, we rely on the user (or future validation layer) 

            const { stdout, stderr } = await exec(command, { cwd: this.workspaceRoot });

            if (stderr && !stdout) {
                return `Stderr: ${stderr}`;
            }

            return stdout + (stderr ? `\nStderr: ${stderr}` : '');
        } catch (error: any) {
            return `Error executing command: ${error.message}`;
        }
    }
}
