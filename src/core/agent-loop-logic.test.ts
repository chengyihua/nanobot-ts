
const toolHallucinationPattern = /^\s*(runCommand|readFile|writeFile|listDir|editFile|describeImage|message|spawn|transcribe|synthesize|webSearch|webFetch|cron|spawnSubagent|saveMemory|switchModel|getSystemDiagnostics):\s*(\{[\s\S]*?\}|[^\s\n\r]+)/gim;

const isInsideCodeBlock = (text: string, pos: number) => {
    const prefix = text.substring(0, pos);
    const codeBlocks = prefix.match(/```/g);
    return codeBlocks && codeBlocks.length % 2 !== 0;
};

function expect(actual: any, expected: any, message: string) {
    if (actual !== expected) {
        console.error(`FAIL: ${message}`);
        console.error(`Expected: ${expected}, Actual: ${actual}`);
        process.exit(1);
    } else {
        console.log(`PASS: ${message}`);
    }
}

async function runTests() {
    console.log('Running Hallucination Detection Tests...');

    // Test 1
    {
        const text = `
Here is how you use the tool:
\`\`\`
readFile: { path: "test.txt" }
\`\`\`
`;
        let hasHallucination = false;
        
        // Current logic simulation
        if (text.match(toolHallucinationPattern)) {
            hasHallucination = true;
        }
        expect(hasHallucination, true, 'Current logic should detect hallucination (bug reproduction)');

        // Proposed fix logic
        hasHallucination = false;
        if (text.match(toolHallucinationPattern)) {
             let matchFound = false;
             text.replace(toolHallucinationPattern, (match, _p1, _p2, offset) => {
                if (!isInsideCodeBlock(text, offset)) {
                   matchFound = true;
                }
                return match;
             });
             if (matchFound) hasHallucination = true;
        }
        expect(hasHallucination, false, 'Proposed logic should ignore code blocks');
    }

    // Test 2
    {
        const text = `
I will read the file now.
readFile: { path: "test.txt" }
`;
        let hasHallucination = false;
        
        if (text.match(toolHallucinationPattern)) {
             let matchFound = false;
             text.replace(toolHallucinationPattern, (match, _p1, _p2, offset) => {
                if (!isInsideCodeBlock(text, offset)) {
                   matchFound = true;
                }
                return match;
             });
             if (matchFound) hasHallucination = true;
        }
        expect(hasHallucination, true, 'Proposed logic should detect outside code blocks');
    }
}

runTests();
