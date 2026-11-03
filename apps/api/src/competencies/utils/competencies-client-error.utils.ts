import { CompetenciesApiError } from "@mentingo/competencies-sdk";
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { match } from "ts-pattern";

export function translateCompetenciesClientError(error: unknown) {
  if (error instanceof ForbiddenException) return error;
  if (!(error instanceof CompetenciesApiError))
    return new BadGatewayException("competencies.serviceError");

  return match(error.status)
    .with(HttpStatus.BAD_REQUEST, () => new BadRequestException("competencies.invalidRequest"))
    .with(
      HttpStatus.PAYLOAD_TOO_LARGE,
      () => new PayloadTooLargeException("competencies.invalidRequest"),
    )
    .with(HttpStatus.NOT_FOUND, () => new NotFoundException("competencies.notFound"))
    .with(HttpStatus.CONFLICT, () => new ConflictException("competencies.conflict"))
    .with(
      HttpStatus.UNAUTHORIZED,
      HttpStatus.FORBIDDEN,
      () => new ForbiddenException("competencies.unavailable"),
    )
    .otherwise(() => new BadGatewayException("competencies.serviceError"));
}
