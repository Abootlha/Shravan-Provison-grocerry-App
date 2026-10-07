import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MongoError } from 'mongodb';
import { Error as MongooseError } from 'mongoose';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    // Handle HTTP exceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        error = (exceptionResponse as any).error || error;
      }
    }
    // Handle MongoDB errors
    else if (exception instanceof MongoError) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Database operation failed';
      error = 'Database Error';

      // Handle duplicate key errors
      if ((exception as any).code === 11000) {
        status = HttpStatus.CONFLICT;
        message = 'Duplicate entry found';
        error = 'Conflict';
      }
    }
    // Handle Mongoose validation errors
    else if (exception instanceof MongooseError.ValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = Object.values(exception.errors)
        .map((err) => err.message)
        .join(', ');
      error = 'Validation Error';
    }
    // Handle Mongoose cast errors (invalid ObjectId)
    else if (exception instanceof MongooseError.CastError) {
      status = HttpStatus.BAD_REQUEST;
      message = `Invalid ${exception.path}: ${exception.value}`;
      error = 'Cast Error';
    }
    // Handle Mongoose document not found
    else if (exception instanceof MongooseError.DocumentNotFoundError) {
      status = HttpStatus.NOT_FOUND;
      message = 'Document not found';
      error = 'Not Found';
    }
    // Handle generic errors
    else if (exception instanceof Error) {
      message = exception.message;
    }

    // Log error with context
    const errorContext = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error,
      userId: (request as any).user?.userId,
      stack: exception instanceof Error ? exception.stack : undefined,
    };

    if (status >= 500) {
      this.logger.error('Server error occurred', errorContext);
    } else if (status >= 400) {
      this.logger.warn('Client error occurred', errorContext);
    }

    // Send response
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      error,
    });
  }
}
