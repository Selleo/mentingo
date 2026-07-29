import { Editor as MailyEditor } from "@maily-to/core";
import {
  button,
  columns,
  divider,
  footer,
  heading1,
  heading2,
  heading3,
  image,
  section,
  spacer,
  text,
} from "@maily-to/core/blocks";
import { ImageUploadExtension } from "@maily-to/core/extensions";
import { ALLOWED_LESSON_IMAGE_FILE_TYPES, EMAIL_TEMPLATE_NODE_UUID_ATTR } from "@repo/shared";
import { AxiosError } from "axios";
import { Braces, PanelTop } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { ApiClient } from "~/api/api-client";
import { toast } from "~/components/ui/use-toast";
import { usePlatformLogo } from "~/hooks/usePlatformLogo";
import Loader from "~/modules/common/Loader/Loader";

import { ButtonFallbackExtension } from "../../tiptap/button-fallback";
import { DisableMailyVariableExtension } from "../../tiptap/disable-maily-variable";
import { buildTranslatedPlaceholder } from "../../tiptap/localized-placeholder";
import { LogoUrlLockExtension } from "../../tiptap/logo-url-lock";
import { useMailyEditorStyles } from "../../tiptap/maily-styles";
import { UuidExtension, stampContent } from "../../tiptap/uuid-extension";
import { VariableHighlightExtension } from "../../tiptap/variable-highlight";
import { applyStructuralChangesToBase } from "../../utils/applyStructuralChangesToBase";
import { collectBasePlaceholders } from "../../utils/collectBasePlaceholders";
import { extractStringsFromDoc } from "../../utils/extractStringsFromDoc";
import { flattenForLanguage } from "../../utils/flattenForLanguage";
import { insertVariablePlaceholder } from "../../utils/insertVariablePlaceholder";
import {
  TENANT_LOGO_PLACEHOLDER_SRC,
  TENANT_LOGO_VARIABLE,
  insertLogoHeader,
  packTenantLogoInDoc,
  resolveEffectiveLogoUrl,
  resolveTenantLogoInDoc,
} from "../../utils/logoHeader";
import {
  InlineDiagnosticStack,
  groupInlineDiagnostics,
} from "../InlineDiagnosticNote/InlineDiagnosticStack";

import type { BlockGroupItem, BlockItem } from "@maily-to/core/blocks";
import type {
  EmailTemplateBlocks,
  EmailTemplateDiagnostic,
  EmailTemplateNode,
  EmailTemplateStrings,
  SupportedLanguages,
  TranslationFragment,
} from "@repo/shared";
import type { Editor } from "@tiptap/core";
import type { TFunction } from "i18next";

type EmailTemplateEditorProps = {
  blocks: EmailTemplateBlocks;
  strings: EmailTemplateStrings;
  language: SupportedLanguages;
  baseLanguage: SupportedLanguages;
  onBlocksChange: (blocks: EmailTemplateBlocks) => void;
  onStringsChange: (nextForLanguage: Record<string, TranslationFragment>) => void;
  diagnosticsByNodeUuid?: Map<string, EmailTemplateDiagnostic[]>;
};

type InlineDiagnosticAnchor = {
  uuid: string;
  diagnostics: EmailTemplateDiagnostic[];
  top: number;
  left: number;
  width: number;
  height: number;
};

const INLINE_DIAGNOSTIC_ROW_HEIGHT = 24;
const INLINE_DIAGNOSTIC_GAP = 4;
const INLINE_DIAGNOSTIC_TOP_OFFSET = 1;
const INLINE_DIAGNOSTIC_EXTRA_NODE_SPACE = 16;
const INLINE_DIAGNOSTIC_CANVAS_PADDING = 4;

const translateBlock = (t: TFunction, block: BlockItem, key: string): BlockItem => ({
  ...block,
  title: t(`emailTemplates.builder.blocks.${key}.title`),
  description: t(`emailTemplates.builder.blocks.${key}.description`),
});

const buildBlocks = (t: TFunction, tenantLogoUrl: string | null): BlockGroupItem[] => {
  const logoHeader: BlockItem = {
    title: t("emailTemplates.builder.blocks.logoHeader.title"),
    description: t("emailTemplates.builder.blocks.logoHeader.description"),
    searchTerms: ["logo", "header", "brand", "tenant"],
    icon: <PanelTop className="mly:h-4 mly:w-4" />,
    command: insertLogoHeader(tenantLogoUrl),
  };

  const variablePlaceholder: BlockItem = {
    title: t("emailTemplates.builder.blocks.variable.title"),
    description: t("emailTemplates.builder.blocks.variable.description"),
    searchTerms: ["variable", "placeholder", "var", "{{"],
    icon: <Braces className="mly:h-4 mly:w-4" />,
    command: insertVariablePlaceholder(),
  };

  return [
    {
      title: t("emailTemplates.builder.blocks.groups.text"),
      commands: [
        translateBlock(t, text, "text"),
        translateBlock(t, heading1, "heading1"),
        translateBlock(t, heading2, "heading2"),
        translateBlock(t, heading3, "heading3"),
        variablePlaceholder,
      ],
    },
    {
      title: t("emailTemplates.builder.blocks.groups.media"),
      commands: [translateBlock(t, image, "image"), logoHeader],
    },
    {
      title: t("emailTemplates.builder.blocks.groups.structure"),
      commands: [
        translateBlock(t, section, "section"),
        translateBlock(t, columns, "columns"),
        translateBlock(t, divider, "divider"),
        translateBlock(t, spacer, "spacer"),
      ],
    },
    {
      title: t("emailTemplates.builder.blocks.groups.interactive"),
      commands: [translateBlock(t, button, "button")],
    },
    {
      title: t("emailTemplates.builder.blocks.groups.footer"),
      commands: [translateBlock(t, footer, "footer")],
    },
  ];
};

type ResolveDiagnosticNode = (uuid: string) => HTMLElement | null;

const findDiagnosticTarget = (
  root: HTMLElement,
  uuid: string,
  resolveDiagnosticNode?: ResolveDiagnosticNode,
): HTMLElement | undefined => {
  const dataUuidTarget = Array.from(root.querySelectorAll<HTMLElement>("[data-uuid]")).find(
    (element) =>
      element.dataset.uuid === uuid &&
      !element.closest<HTMLElement>("[data-inline-diagnostic-layer]"),
  );
  if (dataUuidTarget) return dataUuidTarget;

  const resolvedTarget = resolveDiagnosticNode?.(uuid);
  if (!resolvedTarget || !root.contains(resolvedTarget)) return undefined;
  if (resolvedTarget.closest<HTMLElement>("[data-inline-diagnostic-layer]")) return undefined;
  return resolvedTarget;
};

const findEditorNodeByUuid = (
  editor: Editor | null,
  root: HTMLElement,
  uuid: string,
): HTMLElement | null => {
  if (!editor) return null;

  let targetPos: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (targetPos !== null) return false;
    if (node.attrs?.[EMAIL_TEMPLATE_NODE_UUID_ATTR] === uuid) {
      targetPos = pos;
      return false;
    }
    return true;
  });

  if (targetPos === null) return null;
  const domNode = editor.view.nodeDOM(targetPos);
  let element: HTMLElement | null = null;
  if (domNode instanceof HTMLElement) {
    element = domNode;
  } else if (domNode instanceof Element) {
    element = domNode as HTMLElement;
  } else {
    element = domNode?.parentElement ?? null;
  }

  return element && root.contains(element) ? element : null;
};

const findClosestDiagnosticTarget = (
  root: HTMLElement,
  target: Node | null,
): HTMLElement | null => {
  const element =
    target?.nodeType === Node.ELEMENT_NODE ? (target as Element) : target?.parentElement;
  const diagnosticTarget = element?.closest<HTMLElement>("[data-uuid]");
  if (!diagnosticTarget || !root.contains(diagnosticTarget)) return null;
  if (diagnosticTarget.closest<HTMLElement>("[data-inline-diagnostic-layer]")) return null;
  return diagnosticTarget;
};

const getMutationTargetElement = (target: Node): Element | null => {
  if (target.nodeType === Node.ELEMENT_NODE) return target as Element;
  return target.parentElement;
};

const isInlineDiagnosticLayerMutation = (mutation: MutationRecord): boolean => {
  const target = getMutationTargetElement(mutation.target);
  return Boolean(target?.closest("[data-inline-diagnostic-layer]"));
};

const buildQuotedDataSelector = (attribute: string, value: string): string =>
  `[${attribute}=${JSON.stringify(value)}]`;

const getRenderedDiagnosticHeight = (root: HTMLElement, uuid: string): number | undefined => {
  const note = root.querySelector<HTMLElement>(
    buildQuotedDataSelector("data-inline-diagnostic-anchor", uuid),
  );
  const height = note?.getBoundingClientRect().height;
  return height && height > 0 ? height : undefined;
};

const getFallbackDiagnosticHeight = (diagnostics: EmailTemplateDiagnostic[]): number => {
  const displayItemCount = groupInlineDiagnostics(diagnostics).length;
  return (
    displayItemCount * INLINE_DIAGNOSTIC_ROW_HEIGHT +
    Math.max(0, displayItemCount - 1) * INLINE_DIAGNOSTIC_GAP
  );
};

const buildAnchoredNoteBox = (rootRect: DOMRect, targetRect: DOMRect) => {
  const rawLeft = targetRect.left - rootRect.left;
  const maximumWidth = Math.max(
    1,
    rootRect.right - targetRect.left - INLINE_DIAGNOSTIC_CANVAS_PADDING,
  );
  const width = Math.max(1, Math.min(targetRect.width, maximumWidth));
  const left = Math.max(
    0,
    Math.min(rawLeft, rootRect.width - width - INLINE_DIAGNOSTIC_CANVAS_PADDING),
  );
  return { left, width };
};

export const measureInlineDiagnosticAnchors = (
  root: HTMLElement,
  diagnosticsByNodeUuid: Map<string, EmailTemplateDiagnostic[]> | undefined,
  resolveDiagnosticNode?: ResolveDiagnosticNode,
): InlineDiagnosticAnchor[] => {
  const anchors: InlineDiagnosticAnchor[] = [];
  const rootRect = root.getBoundingClientRect();

  for (const [uuid, diagnostics] of diagnosticsByNodeUuid ?? []) {
    if (diagnostics.length === 0) continue;
    const target = findDiagnosticTarget(root, uuid, resolveDiagnosticNode);
    if (!target) continue;

    const targetRect = target.getBoundingClientRect();
    const noteBox = buildAnchoredNoteBox(rootRect, targetRect);
    anchors.push({
      uuid,
      diagnostics,
      top: targetRect.bottom - rootRect.top + INLINE_DIAGNOSTIC_TOP_OFFSET,
      left: noteBox.left,
      width: noteBox.width,
      height: getRenderedDiagnosticHeight(root, uuid) ?? getFallbackDiagnosticHeight(diagnostics),
    });
  }

  return anchors
    .sort((left, right) => left.top - right.top)
    .reduce<InlineDiagnosticAnchor[]>((positioned, anchor) => {
      const previous = positioned[positioned.length - 1];
      const top = previous
        ? Math.max(anchor.top, previous.top + previous.height + INLINE_DIAGNOSTIC_GAP)
        : anchor.top;
      positioned.push({ ...anchor, top });
      return positioned;
    }, []);
};

const buildUuidSelector = (uuid: string): string => buildQuotedDataSelector("data-uuid", uuid);

export const buildInlineDiagnosticSpacingCss = (anchors: InlineDiagnosticAnchor[]): string =>
  anchors
    .map((anchor) => {
      const space = Math.ceil(
        anchor.height + INLINE_DIAGNOSTIC_GAP + INLINE_DIAGNOSTIC_EXTRA_NODE_SPACE,
      );
      // Maily writes block spacing inline, so the reserved diagnostic gap must win that cascade.
      return `${buildUuidSelector(anchor.uuid)}{margin-bottom:${space}px!important;}`;
    })
    .join("\n");

const areDiagnosticsEqual = (
  left: EmailTemplateDiagnostic[],
  right: EmailTemplateDiagnostic[],
): boolean =>
  left.length === right.length &&
  left.every((diagnostic, index) => {
    const other = right[index];
    return (
      diagnostic.severity === other.severity &&
      diagnostic.reason === other.reason &&
      diagnostic.language === other.language &&
      diagnostic.nodeUuid === other.nodeUuid &&
      diagnostic.nodeType === other.nodeType &&
      diagnostic.detail === other.detail
    );
  });

const areAnchorsEqual = (
  left: InlineDiagnosticAnchor[],
  right: InlineDiagnosticAnchor[],
): boolean =>
  left.length === right.length &&
  left.every((anchor, index) => {
    const other = right[index];
    return (
      anchor.uuid === other.uuid &&
      anchor.top === other.top &&
      anchor.left === other.left &&
      anchor.width === other.width &&
      anchor.height === other.height &&
      areDiagnosticsEqual(anchor.diagnostics, other.diagnostics)
    );
  });

const getActiveDiagnosticNodeUuid = (root: HTMLElement): string | null => {
  if (!root.contains(root.ownerDocument.activeElement)) return null;
  const selection = root.ownerDocument.getSelection();
  const selectedTarget = selection ? findClosestDiagnosticTarget(root, selection.anchorNode) : null;
  const activeTarget = findClosestDiagnosticTarget(root, root.ownerDocument.activeElement);
  return selectedTarget?.dataset.uuid ?? activeTarget?.dataset.uuid ?? null;
};

const filterDeferredDiagnostics = (
  diagnosticsByNodeUuid: Map<string, EmailTemplateDiagnostic[]> | undefined,
  activeNodeUuid: string | null,
  deferredNodeUuids: Set<string>,
  pendingNodeUuids: Set<string>,
): Map<string, EmailTemplateDiagnostic[]> | undefined => {
  if (
    !diagnosticsByNodeUuid ||
    (pendingNodeUuids.size === 0 && (!activeNodeUuid || !deferredNodeUuids.has(activeNodeUuid)))
  ) {
    return diagnosticsByNodeUuid;
  }
  let changed = false;
  const next = new Map<string, EmailTemplateDiagnostic[]>();
  for (const [uuid, diagnostics] of diagnosticsByNodeUuid) {
    const shouldDefer =
      pendingNodeUuids.has(uuid) || (uuid === activeNodeUuid && deferredNodeUuids.has(uuid));
    const visibleDiagnostics = shouldDefer
      ? diagnostics.filter((diagnostic) => diagnostic.reason !== "empty_translation")
      : diagnostics;
    if (visibleDiagnostics.length !== diagnostics.length) changed = true;
    next.set(uuid, visibleDiagnostics);
  }
  return changed ? next : diagnosticsByNodeUuid;
};

const collectTemplateNodeUuids = (blocks: EmailTemplateBlocks): Set<string> => {
  const uuids = new Set<string>();
  const walk = (node: EmailTemplateNode) => {
    const uuid = node.attrs?.[EMAIL_TEMPLATE_NODE_UUID_ATTR];
    if (typeof uuid === "string" && uuid.length > 0) uuids.add(uuid);
    node.content?.forEach(walk);
  };
  walk(blocks);
  return uuids;
};

export const EmailTemplateEditor = (props: EmailTemplateEditorProps) => {
  const { data: tenantLogoUrl, isFetched } = usePlatformLogo();
  if (!isFetched) return <Loader />;
  return (
    <EmailTemplateEditorInner {...props} logoUrl={resolveEffectiveLogoUrl(tenantLogoUrl ?? null)} />
  );
};

const EmailTemplateEditorInner = ({
  blocks,
  strings,
  language,
  baseLanguage,
  onBlocksChange,
  onStringsChange,
  diagnosticsByNodeUuid,
  logoUrl,
}: EmailTemplateEditorProps & { logoUrl: string }) => {
  const { t } = useTranslation();
  useMailyEditorStyles();
  const isBase = language === baseLanguage;
  const editorRootRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const activeNodeSyncFrameRef = useRef<number | null>(null);
  const knownNodeUuidsRef = useRef<Set<string> | null>(null);
  const pendingDeferredNodeUuidsRef = useRef<Set<string>>(new Set());
  knownNodeUuidsRef.current ??= collectTemplateNodeUuids(blocks);
  const [editorUpdateCount, setEditorUpdateCount] = useState(0);
  const [activeDiagnosticNodeUuid, setActiveDiagnosticNodeUuid] = useState<string | null>(null);
  const [deferredNewNodeUuids, setDeferredNewNodeUuids] = useState<Set<string>>(() => new Set());
  const [pendingDeferredNodeUuids, setPendingDeferredNodeUuids] = useState<Set<string>>(
    () => new Set(),
  );
  const [diagnosticAnchors, setDiagnosticAnchors] = useState<InlineDiagnosticAnchor[]>([]);
  const [diagnosticBottomPadding, setDiagnosticBottomPadding] = useState(32);
  const visibleDiagnosticsByNodeUuid = useMemo(
    () =>
      filterDeferredDiagnostics(
        diagnosticsByNodeUuid,
        activeDiagnosticNodeUuid,
        deferredNewNodeUuids,
        pendingDeferredNodeUuids,
      ),
    [
      activeDiagnosticNodeUuid,
      deferredNewNodeUuids,
      diagnosticsByNodeUuid,
      pendingDeferredNodeUuids,
    ],
  );
  const diagnosticSpacingCss = useMemo(
    () => buildInlineDiagnosticSpacingCss(diagnosticAnchors),
    [diagnosticAnchors],
  );

  const basePlaceholdersRef = useRef<Record<string, string>>({});
  basePlaceholdersRef.current = useMemo(() => collectBasePlaceholders(blocks), [blocks]);

  const logoUrlsRef = useRef<string[]>([]);
  logoUrlsRef.current = [TENANT_LOGO_VARIABLE, TENANT_LOGO_PLACEHOLDER_SRC, logoUrl];

  const initialContent = useMemo(
    () => {
      const stamped = stampContent(blocks as never) as EmailTemplateBlocks;
      const flattened = flattenForLanguage({
        blocks: stamped,
        strings,
        language,
        baseLanguage,
      });
      return resolveTenantLogoInDoc(flattened, logoUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language],
  );

  const blockPalette = useMemo(() => buildBlocks(t, logoUrl), [t, logoUrl]);

  const editorExtensions = useMemo(() => {
    const uploadEmailTemplateImage = async (file: Blob): Promise<string> => {
      const formData = new FormData();
      formData.append("file", file, "email-template-image");

      try {
        const response = await ApiClient.api.emailTemplateImageControllerUpload(
          formData as unknown as { file: File },
          {
            headers: { "Content-Type": "multipart/form-data" },
            transformRequest: () => formData,
          },
        );
        return response.data.data.url;
      } catch (error) {
        const status = error instanceof AxiosError ? error.response?.status : undefined;
        const message =
          error instanceof AxiosError
            ? (error.response?.data as { message?: string } | undefined)?.message
            : undefined;

        const toastKey = match({ status, message })
          .when(
            ({ status: s }) => s === 413,
            () => "emailTemplates.image.tooLarge" as const,
          )
          .when(
            ({ status: s, message: m }) =>
              s === 400 && typeof m === "string" && m.includes("expected size"),
            () => "emailTemplates.image.tooLarge" as const,
          )
          .when(
            ({ status: s, message: m }) =>
              s === 400 && typeof m === "string" && m.includes("files.toast.invalidFileType"),
            () => "emailTemplates.image.invalidType" as const,
          )
          .otherwise(() => "emailTemplates.image.uploadFailed" as const);

        toast({ description: t(toastKey), variant: "destructive" });
        throw error;
      }
    };

    const getBasePlaceholder = isBase
      ? undefined
      : (uuid: string) => basePlaceholdersRef.current[uuid] ?? null;

    return [
      UuidExtension,
      ButtonFallbackExtension,
      VariableHighlightExtension,
      DisableMailyVariableExtension,
      buildTranslatedPlaceholder(t, getBasePlaceholder),
      ImageUploadExtension.configure({
        allowedMimeTypes: ALLOWED_LESSON_IMAGE_FILE_TYPES,
        onImageUpload: uploadEmailTemplateImage,
      }),
      LogoUrlLockExtension.configure({
        getLogoUrls: () => logoUrlsRef.current,
      }),
    ];
  }, [t, isBase]);

  const syncActiveDiagnosticNode = useCallback(() => {
    const root = editorRootRef.current;
    const nextActiveNodeUuid = root ? getActiveDiagnosticNodeUuid(root) : null;
    const pendingNodeUuids = pendingDeferredNodeUuidsRef.current;
    if (pendingNodeUuids.size > 0) {
      setDeferredNewNodeUuids((deferred) => {
        const next = new Set(deferred);
        pendingNodeUuids.forEach((uuid) => {
          if (uuid !== nextActiveNodeUuid) next.delete(uuid);
        });
        return next.size === deferred.size ? deferred : next;
      });
      pendingDeferredNodeUuidsRef.current = new Set();
      setPendingDeferredNodeUuids(pendingDeferredNodeUuidsRef.current);
    }
    setActiveDiagnosticNodeUuid((current) => {
      if (current && current !== nextActiveNodeUuid) {
        setDeferredNewNodeUuids((deferred) => {
          if (!deferred.has(current)) return deferred;
          const next = new Set(deferred);
          next.delete(current);
          return next;
        });
      }
      return current === nextActiveNodeUuid ? current : nextActiveNodeUuid;
    });
  }, []);

  const scheduleActiveDiagnosticNodeSync = useCallback(() => {
    if (activeNodeSyncFrameRef.current !== null) {
      cancelAnimationFrame(activeNodeSyncFrameRef.current);
    }
    activeNodeSyncFrameRef.current = requestAnimationFrame(() => {
      activeNodeSyncFrameRef.current = null;
      syncActiveDiagnosticNode();
    });
  }, [syncActiveDiagnosticNode]);

  const handleUpdate = (editor: Editor) => {
    editorRef.current = editor;
    setEditorUpdateCount((count) => count + 1);
    const doc = editor.getJSON() as EmailTemplateBlocks;
    const packed = packTenantLogoInDoc(doc, logoUrl);
    const nextNodeUuids = collectTemplateNodeUuids(packed);
    const previousNodeUuids = knownNodeUuidsRef.current ?? collectTemplateNodeUuids(blocks);
    const newNodeUuids = Array.from(nextNodeUuids).filter((uuid) => !previousNodeUuids.has(uuid));
    knownNodeUuidsRef.current = nextNodeUuids;
    if (newNodeUuids.length > 0) {
      setPendingDeferredNodeUuids((current) => {
        const next = new Set(current);
        newNodeUuids.forEach((uuid) => next.add(uuid));
        pendingDeferredNodeUuidsRef.current = next;
        return next;
      });
      setDeferredNewNodeUuids((current) => {
        const next = new Set(current);
        newNodeUuids.forEach((uuid) => next.add(uuid));
        return next;
      });
      scheduleActiveDiagnosticNodeSync();
    }
    if (isBase) {
      onBlocksChange(packed);
    } else {
      onStringsChange(extractStringsFromDoc(doc));
      onBlocksChange(applyStructuralChangesToBase(packed, blocks));
    }
  };

  useLayoutEffect(() => {
    const root = editorRootRef.current;
    if (!root) {
      setActiveDiagnosticNodeUuid(null);
      return;
    }
    const scheduleSync = () => {
      scheduleActiveDiagnosticNodeSync();
    };

    root.addEventListener("focusin", scheduleSync);
    root.addEventListener("focusout", scheduleSync);
    root.addEventListener("keyup", scheduleSync);
    root.addEventListener("mouseup", scheduleSync);
    root.ownerDocument.addEventListener("selectionchange", scheduleSync);
    scheduleSync();

    return () => {
      if (activeNodeSyncFrameRef.current !== null) {
        cancelAnimationFrame(activeNodeSyncFrameRef.current);
        activeNodeSyncFrameRef.current = null;
      }
      root.removeEventListener("focusin", scheduleSync);
      root.removeEventListener("focusout", scheduleSync);
      root.removeEventListener("keyup", scheduleSync);
      root.removeEventListener("mouseup", scheduleSync);
      root.ownerDocument.removeEventListener("selectionchange", scheduleSync);
    };
  }, [scheduleActiveDiagnosticNodeSync]);

  useLayoutEffect(() => {
    const root = editorRootRef.current;
    if (!root) {
      setDiagnosticAnchors([]);
      return;
    }
    let frame: number | null = null;
    const measure = () => {
      frame = null;
      const anchors = measureInlineDiagnosticAnchors(root, visibleDiagnosticsByNodeUuid, (uuid) =>
        findEditorNodeByUuid(editorRef.current, root, uuid),
      );
      const overlayBottom = anchors.reduce(
        (bottom, anchor) => Math.max(bottom, anchor.top + anchor.height),
        0,
      );
      setDiagnosticAnchors((current) => (areAnchorsEqual(current, anchors) ? current : anchors));
      const nextBottomPadding = Math.max(32, overlayBottom - root.clientHeight + 48);
      setDiagnosticBottomPadding((current) =>
        current === nextBottomPadding ? current : nextBottomPadding,
      );
    };
    const scheduleMeasure = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    // Maily/ProseMirror owns the editor DOM, so diagnostics stay in an overlay instead of
    // inserting sidecar siblings that can be reconciled away or serialized into content.
    measure();
    // The first pass creates anchors; the rAF pass reads the rendered note height after wrapping.
    scheduleMeasure();

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleMeasure);
    resizeObserver?.observe(root);

    const mutationObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver((mutations) => {
            if (mutations.every(isInlineDiagnosticLayerMutation)) return;
            scheduleMeasure();
          });
    mutationObserver?.observe(root, {
      attributes: true,
      attributeFilter: ["class", "data-uuid", "style"],
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [editorUpdateCount, language, visibleDiagnosticsByNodeUuid]);

  return (
    <div
      ref={editorRootRef}
      className="relative mx-auto w-[90%] max-w-[500px] rounded-3xl border border-neutral-200 bg-white px-[50px] py-8 shadow-sm"
      data-language={language}
      style={{ paddingBottom: diagnosticBottomPadding }}
    >
      {diagnosticSpacingCss && <style>{diagnosticSpacingCss}</style>}
      <MailyEditor
        key={language}
        contentJson={initialContent as never}
        onCreate={(editor) => {
          editorRef.current = editor;
        }}
        onUpdate={handleUpdate}
        extensions={editorExtensions}
        blocks={blockPalette}
        config={{
          hasMenuBar: false,
          bodyClassName: "mly:mt-0 mly:rounded-none mly:border-0 mly:bg-transparent mly:p-0",
        }}
      />
      <div
        aria-hidden={diagnosticAnchors.length === 0}
        className="pointer-events-none absolute inset-0 z-10"
        data-inline-diagnostic-layer
      >
        {diagnosticAnchors.map((anchor) => (
          <div
            key={anchor.uuid}
            className="absolute"
            data-inline-diagnostic-anchor={anchor.uuid}
            style={{
              top: anchor.top,
              left: anchor.left,
              width: anchor.width,
            }}
          >
            <InlineDiagnosticStack diagnostics={anchor.diagnostics} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmailTemplateEditor;
