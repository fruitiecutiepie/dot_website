import * as path from 'path';
import { runTests } from '@vscode/test-electron';
// import { exec } from 'child_process';

// async function runJestTests() {
//     return new Promise((resolve, reject) => {
//         exec('jest --config jest.config.ts', (error, stdout, stderr) => {
//             if (error) {
//                 console.error(`Error: ${error.message}`);
//                 reject(error);
//                 return;
//             }
//             if (stderr) {
//                 console.error(`Stderr: ${stderr}`);
//                 reject(new Error(stderr));
//                 return;
//             }
//             console.log(`Stdout: ${stdout}`);
//             resolve(stdout);
//         });
//     });
// }
// runJestTests();

async function runTest() {
	try {
		// console.log('Running Jest Tests...');
		// await runJestTests();

		console.log('Running VS Code Tests...');
		// The folder containing the Extension Manifest package.json
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The path to the extension test script
		const extensionTestsPath = path.resolve(__dirname, './suite/index');
		
		const exitCode = await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: ['--disable-gpu'],
		});
		process.exit(exitCode);
	} catch (err) {
		console.error('Failed to run tests');
		process.exit(1);
	}
}

runTest();
