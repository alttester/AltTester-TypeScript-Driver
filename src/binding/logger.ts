// Pluggable logging. The bindings log to console and a file through loguru/NLog/slf4j; here the caller
// passes any object with these four methods (console works), or `true` for console output.

export interface AltDriverLogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

const noop = (): void => undefined;
export const silentLogger: AltDriverLogger = { debug: noop, info: noop, warn: noop, error: noop };

export const consoleLogger: AltDriverLogger = {
  debug: (m) => console.debug(`[AltTester] ${m}`),
  info: (m) => console.info(`[AltTester] ${m}`),
  warn: (m) => console.warn(`[AltTester] ${m}`),
  error: (m) => console.error(`[AltTester] ${m}`),
};

export function resolveLogger(option: boolean | AltDriverLogger | undefined): AltDriverLogger {
  if (option === true) return consoleLogger;
  if (!option) return silentLogger;
  return option;
}
