// adb / iproxy helpers for device testing (Python reverse_port_forwarding.py, C# AltReversePortForwarding.cs).
// Node only: they run the adb / iproxy executables, which must be on PATH.

import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

function adbArgs(deviceId: string, ...rest: string[]): string[] {
  return deviceId ? ['-s', deviceId, ...rest] : rest;
}

export const AltReversePortForwarding = {
  /** `adb reverse tcp:<devicePort> tcp:<localPort>`: the app on the device reaches AltServer on this machine. */
  async reversePortForwardingAndroid(devicePort = 13000, localPort = 13000, deviceId = ''): Promise<string> {
    const { stdout } = await run('adb', adbArgs(deviceId, 'reverse', `tcp:${devicePort}`, `tcp:${localPort}`));
    return stdout.trim();
  },

  async removeReversePortForwardingAndroid(devicePort = 13000, deviceId = ''): Promise<string> {
    const { stdout } = await run('adb', adbArgs(deviceId, 'reverse', '--remove', `tcp:${devicePort}`));
    return stdout.trim();
  },

  async removeAllReversePortForwardingsAndroid(): Promise<string> {
    const { stdout } = await run('adb', ['reverse', '--remove-all']);
    return stdout.trim();
  },

  /**
   * iOS: starts `iproxy <localPort> <devicePort> [-u deviceId]` (libimobiledevice) so this machine reaches
   * a port on the device. Keep the returned process and kill it when done.
   */
  forwardIos(localPort = 13000, devicePort = 13000, deviceId = ''): ChildProcess {
    const args = [String(localPort), String(devicePort), ...(deviceId ? ['-u', deviceId] : [])];
    return spawn('iproxy', args, { stdio: 'ignore' });
  },
};
