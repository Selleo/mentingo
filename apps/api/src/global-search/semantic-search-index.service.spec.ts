import { SemanticSearchIndexService } from "./semantic-search-index.service";

const source = {
  entityType: "articles",
  entityId: "entity",
  documentType: "content",
  language: "en",
  content: "The expenses policy permits filing a claim within thirty days.",
  sourceHash: "hash",
  sourceRevision: "",
  metadata: {},
  resourceReference: null,
  resourceContentType: null,
};

describe("semantic search indexing", () => {
  function setup() {
    const repository = {
      findSource: jest.fn().mockResolvedValue(source),
      deleteSource: jest.fn(),
      replace: jest.fn().mockResolvedValue(true),
    };
    const embedding = { embedTexts: jest.fn().mockResolvedValue([Array(1536).fill(0.2)]) };
    const s3 = { getFileSize: jest.fn(), getFileBuffer: jest.fn() };
    const extraction = { extractText: jest.fn() };
    const service = new SemanticSearchIndexService(
      repository as never,
      embedding as never,
      s3 as never,
      extraction as never,
    );
    return { service, repository, embedding, s3, extraction };
  }

  it("does not replace searchable chunks when the provider fails", async () => {
    const { service, repository, embedding } = setup();
    embedding.embedTexts.mockRejectedValue(new Error("provider unavailable"));
    await expect(service.process({ ...source, tenantId: "tenant" } as never)).rejects.toThrow(
      "provider unavailable",
    );
    expect(repository.replace).not.toHaveBeenCalled();
  });

  it("passes the revision read at execution for atomic activation", async () => {
    const { service, repository, embedding } = setup();
    await service.process({ ...source, tenantId: "tenant" } as never);
    expect(repository.replace).toHaveBeenCalledWith(
      source,
      [source.content],
      [Array(1536).fill(0.2)],
    );
    expect(embedding.embedTexts).toHaveBeenCalledWith([source.content]);
  });

  it("cleans up deleted sources without embedding", async () => {
    const { service, repository, embedding } = setup();
    repository.findSource.mockResolvedValue(undefined);
    await service.process({ ...source, tenantId: "tenant" } as never);
    expect(repository.deleteSource).toHaveBeenCalled();
    expect(embedding.embedTexts).not.toHaveBeenCalled();
  });

  it("extracts actual attachment contents and bounds file size", async () => {
    const { service, repository, s3, extraction, embedding } = setup();
    repository.findSource.mockResolvedValue({
      ...source,
      resourceReference: "tenant/file.pdf",
      resourceContentType: "application/pdf",
    } as never);
    s3.getFileSize.mockResolvedValue(100);
    s3.getFileBuffer.mockResolvedValue(Buffer.from("pdf"));
    extraction.extractText.mockResolvedValue([
      { pageContent: "Hidden paragraph inside attachment" },
    ]);
    await service.process({ ...source, tenantId: "tenant" } as never);
    expect(embedding.embedTexts).toHaveBeenCalledWith([
      expect.stringContaining("Hidden paragraph inside attachment"),
    ]);
    s3.getFileSize.mockResolvedValue(20 * 1024 * 1024);
    await expect(service.process({ ...source, tenantId: "tenant" } as never)).rejects.toThrow(
      "size limit",
    );
  });
});
