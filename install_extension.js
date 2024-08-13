const { exec } = require('child_process');
const path = require('path');

// Generate the absolute path to the VSIX file using dirname
const pathToVSIX = path.join(__dirname, 'dot-website-0.3.9.vsix');

(async () => {
  // Function to execute shell commands
  const executeCommand = (command) => {
    return /** @type {Promise<void>} */(new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Execution error: ${error}`);
          return reject(error);
        }
        console.log(`stdout: ${stdout}`);
        if (stderr && stderr.length > 0) {
          console.error(`stderr: ${stderr}`);
        }
        resolve();
      });
    }));
  };

  try {
    console.log('Make sure that VS Code is open.');
    // Installing the VSIX extension
    await executeCommand(`code --install-extension ${pathToVSIX}`);
    console.log('Right click on the .vsix file and click Install Extension VSIX.');

    // Optional: Additional command to open VS Code, can't control beyond launching it
    // await executeCommand('code');
    // console.log('VS Code opened.');
  } catch (error) {
    console.error('Failed to install the extension or open VS Code:', error);
  }
})();
