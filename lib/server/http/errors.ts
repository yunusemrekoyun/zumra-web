import 'server-only';

export class AuthenticationRequiredError extends Error {}

export class AuthorizationDeniedError extends Error {}

export class ExternalIdentityError extends Error {}

export class PublicFlowError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 400 | 404 | 409 | 410 | 429 = 400,
  ) {
    super(code);
    this.name = 'PublicFlowError';
  }
}

export class PayloadTooLargeError extends Error {
  constructor() {
    super('Request payload exceeds the allowed size.');
    this.name = 'PayloadTooLargeError';
  }
}

export class UnsupportedMediaTypeError extends Error {
  constructor() {
    super('Uploaded media type is not supported.');
    this.name = 'UnsupportedMediaTypeError';
  }
}

export class UnsafeMediaError extends Error {
  constructor() {
    super('Uploaded media did not pass the security scan.');
    this.name = 'UnsafeMediaError';
  }
}
