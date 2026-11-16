import { buildScormExportFilename } from "./course-scorm-export.utils";

describe("buildScormExportFilename", () => {
  it.each([
    {
      title: "Cyberbezpieczeństwo w praktyce: szkolenie dla wszystkich pracowników",
      filename: "cyberbezpieczenstwo-w-praktyce-szkolenie-dla-wszystkich-pracownikow-scorm-12.zip",
    },
    { title: "Sales Onboarding 101", filename: "sales-onboarding-101-scorm-12.zip" },
    { title: "🎓", filename: "course-scorm-12.zip" },
  ])("names the package for $title as $filename", ({ title, filename }) => {
    expect(buildScormExportFilename(title)).toBe(filename);
  });
});
