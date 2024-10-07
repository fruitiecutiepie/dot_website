import os from "os";
import path from "path";
import { exec } from "child_process";

const LOCAL_CHROMIUM_PATH = path.join(__dirname, ".local-chromium");
const VERSION = "127.0.6533.119";

const exec_command = (
  command: string,
): Promise<[
  ok: string | undefined,
  err: string | undefined
]> => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        console.error(`stderr: ${stderr}`);
        console.error(`stdout: ${stdout}`);
        resolve([undefined, stderr.toString()]);
        return;
      }
      resolve([stdout.toString(), undefined]);
    });
  });
};

const get_platform = (
): [
  platform: string | undefined,
  error: string | undefined
] => {
  const platform = os.platform();
  const arch = os.arch(); // 'arm', 'arm64', 'ia32', 'loong64', 'mips', 'mipsel', 'ppc', 'ppc64', 'riscv64', 's390', 's390x', and 'x64'

  let executable_path: string;
  switch (platform) {
    case "linux":
      return ["linux", undefined];
    case "darwin":
      return arch === "arm64"
        ? ["mac_arm", undefined]
        : ["mac", undefined];
    case "win32":
      return arch === "x64"
        ? ["win64", undefined]
        : ["win32", undefined];
    default:
      return [undefined, `Unsupported platform ${platform}`];
  }
};

export const install_chromium = async (): Promise<[
  executable_path: string | undefined,
  err: string | undefined
]> => {
  const [platform, platform_err] = get_platform();
  if (platform_err) {
    return [undefined, platform_err];
  }
  console.log(`Installing Chromium for ${platform}...`);
  const [stdout, stderr] = await exec_command(
    `npx puppeteer@23.4.0 browsers install chrome-headless-shell@${VERSION} --path ${LOCAL_CHROMIUM_PATH} --platform ${platform}`,
  );
  if (stderr) {
    return [undefined, stderr];
  }
  if (!stdout) {
    return [undefined, 'No output from puppeteer browsers install'];
  }
  const regex = new RegExp(`chrome-headless-shell@${VERSION} (.+?)\\n`, 'g'); // Use non-greedy match for multiple lines

  let match: RegExpExecArray | null;
  while ((match = regex.exec(stdout)) !== null) {
    const executable_path = match[1].trim();
    console.log(`Chromium installed at ${executable_path}`);
    return [executable_path, undefined];
  }

  return [undefined, `Could not find chromium path stdout: ${stdout.toString()}`];
}