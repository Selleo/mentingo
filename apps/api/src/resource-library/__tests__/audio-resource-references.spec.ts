import { extractLessonResourceIds } from "src/lesson/lesson-resource-references";

import {
  buildTenantResourceUrl,
  extractResourceIdsFromRichText,
  mapLocalizedTextEntries,
  removeResourceReferencesFromRichText,
  replaceResourceReferencesInRichText,
} from "../resource-library.utils";

describe("audio resource reference lifecycle", () => {
  const source = "11111111-1111-4111-8111-111111111111";
  const target = "22222222-2222-4222-8222-222222222222";
  const html = `<p>Podcast</p><div data-node-type="audio" data-resource-id="${source}" data-src="/api/lesson/lesson-resource/${source}" data-name="Episode.mp3"></div>`;

  it("extracts stable references for relation sync and archive/transfer discovery", () => {
    expect(extractLessonResourceIds(html)).toEqual([source]);
    expect(extractResourceIdsFromRichText(html)).toEqual([source]);
  });

  it("rewrites every localized audio reference during cross-tenant copy", () => {
    const rewrite = (content: string) =>
      replaceResourceReferencesInRichText(content, new Map([[source, target]]), {
        buildResourceUrl: (id, route) =>
          buildTenantResourceUrl("https://target.example", id, route),
      });
    const result = mapLocalizedTextEntries(
      { en: html, pl: html.replace("Podcast", "Odcinek") },
      rewrite,
    ) as Record<string, string>;
    for (const language of ["en", "pl"]) {
      expect(result[language]).not.toContain(source);
      expect(result[language]).toContain(`data-resource-id="${target}"`);
      expect(result[language]).toContain(
        `https://target.example/api/lesson/lesson-resource/${target}`,
      );
      expect(result[language]).toContain('data-node-type="audio"');
    }
    expect(result.pl).toContain("Odcinek");
  });

  it("removes an archived audio embed without removing surrounding content", () => {
    const result = removeResourceReferencesFromRichText(html, source);
    expect(result.hasChanged).toBe(true);
    expect(result.content).toContain("Podcast");
    expect(result.content).not.toContain(source);
    expect(result.content).not.toContain('data-node-type="audio"');
  });
});
