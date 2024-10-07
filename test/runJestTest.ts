import { exec } from 'child_process';

async function runJestTests() {
    console.log('Running Jest Tests...');
    return new Promise((resolve, reject) => {
        exec('jest --config jest.config.ts', (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                reject(error);
                return;
            }
            if (stderr) {
                console.error(`Stderr: ${stderr}`);
                reject(new Error(stderr));
                return;
            }
            console.log(`Stdout: ${stdout}`);
            resolve(stdout);
        });
    });
}

runJestTests();