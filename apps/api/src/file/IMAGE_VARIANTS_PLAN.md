# Image Upload Variants Plan

## Goal

Generate optimized image variants for new raster image uploads so the app no
longer stores or serves unbounded original uploads for supported image types.
Existing image references must keep working without migration.

## Decisions

- Supported source MIME types: `image/jpeg`, `image/png`, and `image/webp`.
- Unsupported image types such as `image/svg+xml` and GIF keep the current upload
  path.
- Generated output format: WebP.
- Raw originals are not stored for supported raster uploads.
- All four fixed variants are always generated, including upscaling smaller
  source images.
- No runtime S3 `HeadObject` check on normal image URL generation.
- No migration or backfill for existing references.

## Storage Shape

New raster image uploads use a logical reference key plus suffixed variant keys:

```txt
<resource>/variants/<hash>.webp
<resource>/variants/<hash>-640w.webp
<resource>/variants/<hash>-960w.webp
<resource>/variants/<hash>-1280w.webp
<resource>/variants/<hash>-1920w.webp
```

The DB/file reference stored in existing fields is the logical reference key:

```txt
<resource>/variants/<hash>.webp
```

The unsuffixed key is a logical family reference only. It is not uploaded as an S3
object. URL resolution maps it to a concrete variant, defaulting to `HIGH`.

## Quality Constants

Use fixed quality names and widths:

```ts
export const IMAGE_QUALITY = {
  SMALL: "640w",
  MEDIUM: "960w",
  LARGE: "1280w",
  HIGH: "1920w",
} as const;
```

## Helper Behavior

Add helpers for variant-aware references:

```ts
isImageVariantReference(reference: string): boolean
getImageVariantKey(reference: string, quality: ImageQuality): string
getImageUrlByQuality(reference: string, quality?: ImageQuality): Promise<string>
```

Rules:

- If a reference contains `/variants/`, inject the quality suffix before the file
  extension.
- If a reference does not contain `/variants/`, treat it as legacy and sign it
  directly.
- `getImageUrlByQuality(reference, IMAGE_QUALITY.HIGH)` maps
  `<hash>.webp` to `<hash>-1920w.webp`.
- Normal URL generation must not check S3 existence. Upload guarantees variant
  keys exist for new raster references.

## Upload Behavior

`FileService.uploadFile()` should:

- keep existing validation and tenant checks;
- reject videos as it does now;
- route supported raster images to `ImageVariantService`;
- keep non-raster files on the current S3 upload path;
- return `fileKey` as the logical WebP reference key;
- return `fileUrl` signed for the high quality WebP variant;
- return or internally carry `contentType: "image/webp"` for variant uploads.

`ImageVariantService` should:

- read source dimensions with `sharp.metadata()`;
- create all fixed variant files with exact target widths;
- upload every generated buffer through `S3Service.uploadFile`;
- use `image/webp` as content type for variants;
- throw `ConflictException("files.toast.imageVariantGenerationFailed")` on
  generation or upload failure.

## Resource Metadata

`uploadResource()` should keep storing `resources.reference` as `fileKey`, but
when the upload result is an optimized image it should store:

```ts
metadata: {
  originalFilename,
  size,
  checksum,
  imageVariants: {
    originalWidth,
    originalHeight,
    variants: {
      "640w": { key, width, height, contentType: "image/webp" },
      "960w": { key, width, height, contentType: "image/webp" },
      "1280w": { key, width, height, contentType: "image/webp" },
      "1920w": { key, width, height, contentType: "image/webp" },
    },
  },
}
```

For non-image uploads, keep current metadata behavior.

## Compatibility Notes

- Existing references without `/variants/` remain valid and are signed directly.
- Existing callers that store a single `fileKey` continue doing so.
- No frontend change is required for v1 because `fileKey` and `fileUrl` remain
  present.
- Future work can switch selected API responses to use
  `getImageUrlByQuality()` with lower quality values for cards, avatars, and
  thumbnails.

## Checklist

- [x] Add image quality constants and variant key helpers.
- [x] Add ImageVariantService for raster image conversion and S3 uploads.
- [x] Wire ImageVariantService into FilesModule.
- [x] Update FileService.uploadFile() to route supported raster images through variants.
- [x] Update uploadResource() metadata/contentType handling for optimized image uploads.
- [x] Add focused unit tests for helper behavior and variant generation.
- [x] Run focused tests and API lint/typecheck.
