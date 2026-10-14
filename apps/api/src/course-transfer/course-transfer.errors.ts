export class CourseTransferBusyError extends Error {
  constructor() {
    super("This sharing relationship is already being transferred");
    this.name = CourseTransferBusyError.name;
  }
}

export class CourseTransferLeaseLostError extends Error {
  constructor() {
    super("The transfer claim is no longer current");
    this.name = CourseTransferLeaseLostError.name;
  }
}

export class CourseTransferFailedError extends Error {
  constructor() {
    super("This transfer failed and requires a new retry request");
    this.name = CourseTransferFailedError.name;
  }
}
