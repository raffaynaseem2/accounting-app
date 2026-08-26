import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Response } from "express";

@Catch()
export class JsonExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<Request & { method?: string; originalUrl?: string; url?: string }>();
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : { message: "Internal server error" };
    const body = typeof payload === "string" ? { error: payload } : payload;

    const error = exception instanceof Error ? exception : null;
    const details = {
      name: error?.name ?? typeof exception,
      message: error?.message ?? String(exception),
      stack: error?.stack,
      status,
      method: request.method,
      url: request.originalUrl ?? request.url,
      response: payload,
      prisma: exception instanceof Prisma.PrismaClientKnownRequestError
        ? { code: exception.code, meta: exception.meta, clientVersion: exception.clientVersion }
        : undefined,
    };

    console.error(`[API EXCEPTION] ${request.method ?? "UNKNOWN"} ${request.originalUrl ?? request.url ?? "UNKNOWN"} -> ${status}`);
    console.error("[API EXCEPTION DETAILS]", details);
    if (error?.stack) console.error("[API EXCEPTION STACK]\n" + error.stack);

    response.status(status).type("application/json").json(body);
  }
}
