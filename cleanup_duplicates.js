const fs = require('fs');
const path = 'src/agent/system-prompt.ts';

try {
    let data = fs.readFileSync(path, 'utf8');

    const pattern = 'private buildAntiPatternsLayer(): string {';
    const first = data.indexOf(pattern);

    if (first === -1) {
        console.log('Could not find AntiPatterns layer at all.');
        process.exit(0);
    }

    const second = data.indexOf(pattern, first + 1);

    if (second !== -1) {
        console.log('Found duplicate AntiPatterns layer.');

        // It should be followed by ErrorHandling then Progress.
        // We want to keep Progress.
        const endMarker = 'private buildProgressCommunicationLayer(): string {';
        const endIndex = data.indexOf(endMarker, second);

        if (endIndex !== -1) {
            console.log('Found Progress layer. Deleting duplicates in between.');
            // Cut from second to endIndex (exclusive, keep endMarker)
            const header = data.substring(0, second);
            const footer = data.substring(endIndex);

            // Reassemble with clean indentation
            // We want to ensure we don't leave a huge gap
            // The footer starts with '    private buildProgress...'
            // The header ends with newline + indentation potentially

            data = header.trimEnd() + '\n\n' + footer;

            fs.writeFileSync(path, data, 'utf8');
            console.log('Successfully removed duplicates.');
        } else {
            console.log('Could not find Progress layer to delimit end of duplicates.');
        }
    } else {
        console.log('No duplicates found.');
    }
} catch (e) {
    console.error('Error cleaning duplicates:', e);
    process.exit(1);
}
