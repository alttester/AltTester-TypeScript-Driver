// Error hierarchy shared by the socket layer and the binding. Names follow the Python and C# bindings
// (Bindings~/python/alttester/exceptions.py, AltDriver/AltErrors.cs) so test code reads the same.
//
// AltException
// ├─ AltError (server-reported error; `type` is the wire error type)
// │  ├─ NotFoundException ── SceneNotFound, ObjectNotFound, CameraNotFound, PropertyNotFound, MethodNotFound,
// │  │                       MethodWithGivenParametersNotFound, ComponentNotFound, AssemblyNotFound, NullReference
// │  └─ PropertyCannotBeSet, CouldNotPerformOperation, CouldNotParseJsonString, FailedToParseArguments, Format,
// │     InvalidParameterType, InvalidCommand, InvalidPath, AltTesterInputModule, UnknownError
// ├─ AltTimeoutError (= CommandResponseTimeoutException)
// ├─ AltConnectionError ── NoAppConnected, AppDisconnected, MultipleDrivers, MultipleDriversTryingToConnect,
// │                        MaxNoOfConnectionsDriversExceeded, ConnectionTimeout
// ├─ WaitTimeOutException, AltTesterInvalidServerResponse, InvalidParameterValueException

import { formatClose, type CloseInfo } from './closeCodes';

export class AltException extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** An error the app or server reported in a response (`error: {type, message, trace}`). */
export class AltError extends AltException {
  constructor(
    readonly type: string,
    message: string,
    readonly trace = '',
  ) {
    super(message);
  }
}

export class NotFoundException extends AltError {}
export class SceneNotFoundException extends NotFoundException {}
export class ObjectNotFoundException extends NotFoundException {}
export class CameraNotFoundException extends NotFoundException {}
export class PropertyNotFoundException extends NotFoundException {}
export class MethodNotFoundException extends NotFoundException {}
export class MethodWithGivenParametersNotFoundException extends NotFoundException {}
export class ComponentNotFoundException extends NotFoundException {}
export class AssemblyNotFoundException extends NotFoundException {}
/** C# maps nullReferenceException to its own class, Python to NotFoundException; this is both. */
export class NullReferenceException extends NotFoundException {}
export class PropertyCannotBeSetException extends AltError {}
export class CouldNotPerformOperationException extends AltError {}
export class CouldNotParseJsonStringException extends AltError {}
export class FailedToParseArgumentsException extends AltError {}
export class FormatException extends AltError {}
export class InvalidParameterTypeException extends AltError {}
export class InvalidCommandException extends AltError {}
export class InvalidPathException extends AltError {}
export class AltTesterInputModuleException extends AltError {}
export class UnknownErrorException extends AltError {}

type AltErrorCtor = new (type: string, message: string, trace?: string) => AltError;

const ERROR_TYPES: Record<string, AltErrorCtor> = {
  ALTTESTERNotAddedAsDefineVariable: AltTesterInputModuleException,
  notFound: NotFoundException,
  sceneNotFound: SceneNotFoundException,
  objectNotFound: ObjectNotFoundException,
  objectWasNotFound: ObjectNotFoundException,
  cameraNotFound: CameraNotFoundException,
  propertyNotFound: PropertyNotFoundException,
  methodNotFound: MethodNotFoundException,
  methodWithGivenParametersNotFound: MethodWithGivenParametersNotFoundException,
  componentNotFound: ComponentNotFoundException,
  assemblyNotFound: AssemblyNotFoundException,
  propertyCannotBeSet: PropertyCannotBeSetException,
  couldNotPerformOperation: CouldNotPerformOperationException,
  couldNotParseJsonString: CouldNotParseJsonStringException,
  failedToParseMethodArguments: FailedToParseArgumentsException,
  formatException: FormatException,
  invalidParameterType: InvalidParameterTypeException,
  invalidCommand: InvalidCommandException,
  invalidPath: InvalidPathException,
  nullReferenceException: NullReferenceException,
  unknownError: UnknownErrorException,
};

const INVALID_COMMAND_HINT =
  ' You may want to set the Managed Stripping Level to `Minimal` from Player Settings -> Other Settings -> Optimization.';

/** Builds the typed error for a wire error. Unknown types stay a plain AltError (type preserved). */
export function createAltError(type: string, message: string, trace = ''): AltError {
  const Ctor = ERROR_TYPES[type];
  if (!Ctor) return new AltError(type, message, trace);
  const text = Ctor === InvalidCommandException ? `${message || 'Invalid command.'}${INVALID_COMMAND_HINT}` : message;
  return new Ctor(type, text, trace);
}

export class AltTimeoutError extends AltException {
  constructor(
    readonly commandName: string,
    timeoutMs: number,
  ) {
    super(`${commandName} got no reply within ${Math.round(timeoutMs / 1000)} s.`);
  }
}
/** Binding-style name for AltTimeoutError. */
export const CommandResponseTimeoutException = AltTimeoutError;
export type CommandResponseTimeoutException = AltTimeoutError;

export class AltConnectionError extends AltException {
  constructor(readonly info: CloseInfo) {
    super(formatClose(info));
  }
}
export class NoAppConnectedException extends AltConnectionError {}
export class AppDisconnectedException extends AltConnectionError {}
export class MultipleDriversException extends AltConnectionError {}
export class MultipleDriversTryingToConnectException extends AltConnectionError {}
export class MaxNoOfConnectionsDriversExceededException extends AltConnectionError {}
/** Connect kept failing until the connect timeout ran out; `info` is the last failure. */
export class ConnectionTimeoutException extends AltConnectionError {}

const CLOSE_ERRORS: Record<number, new (info: CloseInfo) => AltConnectionError> = {
  4001: NoAppConnectedException,
  4002: AppDisconnectedException,
  4005: MultipleDriversException,
  4007: MultipleDriversTryingToConnectException,
  4009: MaxNoOfConnectionsDriversExceededException,
};

export function createConnectionError(info: CloseInfo): AltConnectionError {
  const Ctor = CLOSE_ERRORS[info.code] ?? AltConnectionError;
  return new Ctor(info);
}

export class WaitTimeOutException extends AltException {}

/** A response frame did not carry what the protocol promises (e.g. "Ok" then "Finished"). */
export class AltTesterInvalidServerResponse extends AltException {
  constructor(
    readonly expected: unknown,
    readonly received: unknown,
  ) {
    super(`Expected to get response '${String(expected)}'; got '${typeof received === 'string' ? received : JSON.stringify(received)}'.`);
  }
}

export class InvalidParameterValueException extends AltException {}
