import * as fc from 'fast-check';
import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { MongoError } from 'mongodb';
import { Error as MongooseError } from 'mongoose';

describe('HttpExceptionFilter - Property-Based Tests', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(() => {
    filter = new HttpExceptionFilter();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      url: '/api/test',
      method: 'GET',
    };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };
  });

  /**
   * Property 37: Invalid Transition Error Messages
   *
   * For any invalid status transition attempt, the system must return an HTTP 400 error
   * with a descriptive message indicating the current status, requested status, and why
   * the transition is not allowed.
   *
   * Validates: Requirements 11.5
   */
  describe('Property 37: Invalid Transition Error Messages', () => {
    it('should return HTTP 400 with descriptive message for BadRequestException', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'PENDING',
            'CONFIRMED',
            'PACKED',
            'ASSIGNED',
            'OUT_FOR_DELIVERY',
            'DELIVERED',
          ),
          fc.constantFrom(
            'PENDING',
            'CONFIRMED',
            'PACKED',
            'ASSIGNED',
            'OUT_FOR_DELIVERY',
            'DELIVERED',
          ),
          (currentStatus, requestedStatus) => {
            // Reset mocks for each iteration
            mockResponse.status.mockClear();
            mockResponse.json.mockClear();

            // Create a descriptive error message
            const errorMessage = `Invalid status transition from ${currentStatus} to ${requestedStatus}. This transition is not allowed.`;
            const exception = new BadRequestException(errorMessage);

            filter.catch(exception, mockHost as any);

            // Verify HTTP 400 status
            expect(mockResponse.status).toHaveBeenCalledWith(
              HttpStatus.BAD_REQUEST,
            );

            // Verify response contains descriptive message
            const responseCall = mockResponse.json.mock.calls[0][0];
            expect(responseCall.statusCode).toBe(HttpStatus.BAD_REQUEST);
            expect(responseCall.message).toBe(errorMessage);
            expect(responseCall.message).toContain(currentStatus);
            expect(responseCall.message).toContain(requestedStatus);
            expect(responseCall.message).toContain('not allowed');
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should include timestamp and path in error response', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (errorMessage) => {
            // Reset mocks for each iteration
            mockResponse.status.mockClear();
            mockResponse.json.mockClear();

            const exception = new BadRequestException(errorMessage);

            filter.catch(exception, mockHost as any);

            const responseCall = mockResponse.json.mock.calls[0][0];
            expect(responseCall.timestamp).toBeDefined();
            expect(responseCall.path).toBe('/api/test');
            expect(new Date(responseCall.timestamp).getTime()).toBeGreaterThan(
              0,
            );
          },
        ),
        { numRuns: 30 },
      );
    });

    it('should handle various HTTP exception types with appropriate status codes', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            { status: HttpStatus.BAD_REQUEST, message: 'Bad request' },
            { status: HttpStatus.UNAUTHORIZED, message: 'Unauthorized' },
            { status: HttpStatus.FORBIDDEN, message: 'Forbidden' },
            { status: HttpStatus.NOT_FOUND, message: 'Not found' },
            {
              status: HttpStatus.INTERNAL_SERVER_ERROR,
              message: 'Internal error',
            },
          ),
          ({ status, message }) => {
            // Reset mocks for each iteration
            mockResponse.status.mockClear();
            mockResponse.json.mockClear();

            const exception = new HttpException(message, status);

            filter.catch(exception, mockHost as any);

            expect(mockResponse.status).toHaveBeenCalledWith(status);
            const responseCall = mockResponse.json.mock.calls[0][0];
            expect(responseCall.statusCode).toBe(status);
            expect(responseCall.message).toBe(message);
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  /**
   * Property 39: Database Error HTTP Codes
   *
   * For any database query failure, the system must return appropriate HTTP status codes:
   * 404 for not found, 500 for server errors, 400 for validation errors.
   *
   * Validates: Requirements 11.7
   */
  describe('Property 39: Database Error HTTP Codes', () => {
    it('should return HTTP 404 for DocumentNotFoundError', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (documentId) => {
            // Reset mocks for each iteration
            mockResponse.status.mockClear();
            mockResponse.json.mockClear();

            const error = new MongooseError.DocumentNotFoundError(
              'Document not found',
            );

            filter.catch(error, mockHost as any);

            expect(mockResponse.status).toHaveBeenCalledWith(
              HttpStatus.NOT_FOUND,
            );
            const responseCall = mockResponse.json.mock.calls[0][0];
            expect(responseCall.statusCode).toBe(HttpStatus.NOT_FOUND);
            expect(responseCall.message).toContain('not found');
          },
        ),
        { numRuns: 20 },
      );
    });

    it('should return HTTP 400 for ValidationError', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
            minLength: 1,
            maxLength: 5,
          }),
          (errorMessages) => {
            // Reset mocks for each iteration
            mockResponse.status.mockClear();
            mockResponse.json.mockClear();

            const validationError = new MongooseError.ValidationError();
            errorMessages.forEach((msg, index) => {
              validationError.errors[`field${index}`] = {
                message: msg,
              } as any;
            });

            filter.catch(validationError, mockHost as any);

            expect(mockResponse.status).toHaveBeenCalledWith(
              HttpStatus.BAD_REQUEST,
            );
            const responseCall = mockResponse.json.mock.calls[0][0];
            expect(responseCall.statusCode).toBe(HttpStatus.BAD_REQUEST);
            expect(responseCall.error).toBe('Validation Error');
          },
        ),
        { numRuns: 20 },
      );
    });

    it('should return HTTP 400 for CastError (invalid ObjectId)', () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 30 })
            .filter((s) => !/[^a-zA-Z0-9]/.test(s)), // Alphanumeric only
          fc
            .string({ minLength: 1, maxLength: 20 })
            .filter((s) => !/[^a-zA-Z0-9]/.test(s)), // Alphanumeric only
          (invalidValue, fieldName) => {
            // Reset mocks for each iteration
            mockResponse.status.mockClear();
            mockResponse.json.mockClear();

            const castError = new MongooseError.CastError(
              'ObjectId',
              invalidValue,
              fieldName,
            );

            filter.catch(castError, mockHost as any);

            expect(mockResponse.status).toHaveBeenCalledWith(
              HttpStatus.BAD_REQUEST,
            );
            const responseCall = mockResponse.json.mock.calls[0][0];
            expect(responseCall.statusCode).toBe(HttpStatus.BAD_REQUEST);
            expect(responseCall.message).toContain('Invalid');
          },
        ),
        { numRuns: 20 },
      );
    });

    it('should return HTTP 500 for generic MongoDB errors', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (errorMessage) => {
            // Reset mocks for each iteration
            mockResponse.status.mockClear();
            mockResponse.json.mockClear();

            const mongoError = new MongoError(errorMessage);

            filter.catch(mongoError, mockHost as any);

            expect(mockResponse.status).toHaveBeenCalledWith(
              HttpStatus.INTERNAL_SERVER_ERROR,
            );
            const responseCall = mockResponse.json.mock.calls[0][0];
            expect(responseCall.statusCode).toBe(
              HttpStatus.INTERNAL_SERVER_ERROR,
            );
            expect(responseCall.message).toBe('Database operation failed');
          },
        ),
        { numRuns: 20 },
      );
    });

    it('should return HTTP 409 for duplicate key errors', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (duplicateValue) => {
            // Reset mocks for each iteration
            mockResponse.status.mockClear();
            mockResponse.json.mockClear();

            const duplicateError = new MongoError('E11000 duplicate key error');
            (duplicateError as any).code = 11000;

            filter.catch(duplicateError, mockHost as any);

            expect(mockResponse.status).toHaveBeenCalledWith(
              HttpStatus.CONFLICT,
            );
            const responseCall = mockResponse.json.mock.calls[0][0];
            expect(responseCall.statusCode).toBe(HttpStatus.CONFLICT);
            expect(responseCall.message).toBe('Duplicate entry found');
          },
        ),
        { numRuns: 20 },
      );
    });
  });

  describe('Error Logging', () => {
    it('should log errors with context for all error types', () => {
      const loggerSpy = jest.spyOn(filter['logger'], 'error');
      const warnSpy = jest.spyOn(filter['logger'], 'warn');

      fc.assert(
        fc.property(
          fc.constantFrom(
            new HttpException('Server error', HttpStatus.INTERNAL_SERVER_ERROR),
            new HttpException('Bad request', HttpStatus.BAD_REQUEST),
            new MongoError('Database error'),
            new MongooseError.ValidationError(),
          ),
          (exception) => {
            filter.catch(exception, mockHost as any);

            // Verify logging occurred
            const totalCalls =
              loggerSpy.mock.calls.length + warnSpy.mock.calls.length;
            expect(totalCalls).toBeGreaterThan(0);

            // Reset for next iteration
            loggerSpy.mockClear();
            warnSpy.mockClear();
          },
        ),
        { numRuns: 20 },
      );
    });
  });
});
