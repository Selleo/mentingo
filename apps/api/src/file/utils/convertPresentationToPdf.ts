import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PRESENTATION_PDF_PREVIEW_TIMEOUT_MS = 120_000;

const DEFAULT_LIBREOFFICE_BINARY_CANDIDATES = [
  "libreoffice",
  "soffice",
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
];

const getLibreOfficeBinaryCandidates = () =>
  Array.from(
    new Set(
      process.env.LIBREOFFICE_PATH
        ? [process.env.LIBREOFFICE_PATH, ...DEFAULT_LIBREOFFICE_BINARY_CANDIDATES]
        : DEFAULT_LIBREOFFICE_BINARY_CANDIDATES,
    ),
  );

const buildLibreOfficePdfConversionArgs = (inputPath: string, outputDirectory: string) => [
  "--headless",
  "--nologo",
  "--nofirststartwizard",
  "--convert-to",
  "pdf",
  "--outdir",
  outputDirectory,
  inputPath,
];

const isMissingLibreOfficeBinaryError = (error: unknown) =>
  Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT",
  );

export const convertPresentationToPdf = async (
  inputPath: string,
  outputDirectory: string,
): Promise<void> => {
  const missingBinaryErrors: string[] = [];
  const binaryCandidates = getLibreOfficeBinaryCandidates();

  for (const binary of binaryCandidates) {
    try {
      await execFileAsync(binary, buildLibreOfficePdfConversionArgs(inputPath, outputDirectory), {
        timeout: PRESENTATION_PDF_PREVIEW_TIMEOUT_MS,
      });

      return;
    } catch (error) {
      if (isMissingLibreOfficeBinaryError(error)) {
        missingBinaryErrors.push(
          `${binary}: ${error instanceof Error ? error.message : String(error)}`,
        );
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    `LibreOffice executable not found. Install LibreOffice or set LIBREOFFICE_PATH. Tried: ${binaryCandidates.join(
      ", ",
    )}. Errors: ${missingBinaryErrors.join("; ")}`,
  );
};
