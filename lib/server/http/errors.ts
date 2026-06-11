import 'server-only';

export class AuthenticationRequiredError extends Error {}

export class AuthorizationDeniedError extends Error {}

export class ExternalIdentityError extends Error {}

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
