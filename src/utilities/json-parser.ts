/**
 * Robust JSON extraction utility
 */
export class JSONParser {
    /**
     * Extracts and parses the first JSON object or array found in a string.
     * Handles <think> tags, markdown code blocks, and leading/trailing text.
     */
    public static parse<T>(input: string): T {
        // 1. Strip think tags
        let processed = input.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        // 2. Try markdown code blocks
        const codeBlockMatch = processed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
            processed = codeBlockMatch[1].trim();
        }

        // 3. Find first [ or {
        const firstArr = processed.indexOf('[');
        const firstObj = processed.indexOf('{');

        let startChar: string;
        let endChar: string;
        let startIndex: number;

        if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
            startChar = '[';
            endChar = ']';
            startIndex = firstArr;
        } else if (firstObj !== -1) {
            startChar = '{';
            endChar = '}';
            startIndex = firstObj;
        } else {
            throw new Error('No JSON object or array found in input');
        }

        const balanced = this.extractBalanced(processed.slice(startIndex), startChar, endChar);
        if (!balanced) {
            throw new Error(`Failed to extract balanced JSON ${startChar === '[' ? 'array' : 'object'}`);
        }

        return JSON.parse(balanced) as T;
    }

    private static extractBalanced(input: string, startChar: string, endChar: string): string | null {
        let depth = 0;
        let inString = false;
        let escape = false;

        for (let i = 0; i < input.length; i++) {
            const char = input[i];

            if (escape) {
                escape = false;
                continue;
            }

            if (char === '\\' && inString) {
                escape = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === startChar) {
                    depth++;
                } else if (char === endChar) {
                    depth--;
                    if (depth === 0) {
                        return input.slice(0, i + 1);
                    }
                }
            }
        }

        return null;
    }
}
