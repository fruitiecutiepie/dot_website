import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function runTest() {
	try {
		// The folder containing the Extension Manifest package.json
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The path to the extension test script
		const extensionTestsPath = path.resolve(__dirname, './suite/index');
		
		const exitCode = await runTests({ extensionDevelopmentPath, extensionTestsPath });
		process.exit(exitCode);
	} catch (err) {
		console.error('Failed to run tests');
		process.exit(1);
	}
}

runTest();
