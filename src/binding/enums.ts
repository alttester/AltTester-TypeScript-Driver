// Small enums of the binding API. Values are the wire ints (C# sends enums as ints).

export const NotificationType = { LOADSCENE: 0, UNLOADSCENE: 1, LOG: 2, APPLICATION_PAUSED: 3 } as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const AltLoadSceneMode = { Single: 0, Additive: 1 } as const;
export type AltLoadSceneMode = (typeof AltLoadSceneMode)[keyof typeof AltLoadSceneMode];

export const PlayerPrefKeyType = { Int: 1, String: 2, Float: 3 } as const;
export type PlayerPrefKeyType = (typeof PlayerPrefKeyType)[keyof typeof PlayerPrefKeyType];

/** Targets for setServerLogging. */
export const AltLogger = { File: 0, Unity: 1, Console: 2 } as const;
export type AltLogger = (typeof AltLogger)[keyof typeof AltLogger];

export const AltLogLevel = { Trace: 0, Debug: 1, Info: 2, Warn: 3, Error: 4, Fatal: 5, Off: 6 } as const;
export type AltLogLevel = (typeof AltLogLevel)[keyof typeof AltLogLevel];
