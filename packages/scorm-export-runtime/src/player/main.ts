type LessonType = "content" | "quiz" | "embed";
type QuestionAnswer = string | string[];

type CourseJson = {
  schemaVersion: number;
  course: {
    id: string;
    title: string;
    language: string;
    logoPath: string;
  };
  theme?: {
    primaryColor?: string | null;
    contrastColor?: string | null;
  };
  settings: {
    quizFeedbackEnabled: boolean;
  };
  chapters: Array<{
    lessonIds: string[];
  }>;
  lessons: Record<string, Lesson>;
};

type BaseLesson = {
  id: string;
  title: string;
  type: LessonType;
};

type ContentLesson = BaseLesson & {
  type: "content";
  html: string;
};

type EmbedLesson = BaseLesson & {
  type: "embed";
  url: string;
  allowFullscreen: boolean;
};

type QuizLesson = BaseLesson & {
  type: "quiz";
  passingScorePercent?: number | null;
  questions: QuizQuestion[];
};

type Lesson = ContentLesson | EmbedLesson | QuizLesson;

type QuizQuestion = {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  solutionExplanation?: string | null;
  displayOrder?: number | null;
  options: QuizOption[];
  correctOptionIds: string[];
  assets: Array<{ packagePath: string }>;
};

type QuizOption = {
  id: string;
  title: string;
  displayOrder?: number | null;
  isCorrect: boolean;
  matchedWord?: string | null;
};

type SuspendData = {
  lessons?: Record<
    string,
    {
      completed?: boolean;
      submitted?: boolean;
      correct?: number;
      scorePercent?: number;
      answers?: Record<string, QuestionAnswer>;
    }
  >;
};

type ScormApi = {
  LMSInitialize: (value: string) => string;
  LMSFinish: (value: string) => string;
  LMSGetValue: (key: string) => string;
  LMSSetValue: (key: string, value: string) => string;
  LMSCommit: (value: string) => string;
};

declare global {
  interface Window {
    API?: ScormApi;
    videojs?: (element: Element, options?: Record<string, unknown>) => VideoJsPlayer;
    MentingoScormExportRuntime?: {
      boot: () => Promise<void>;
    };
  }
}

type VideoJsPlayer = {
  src: (source: Array<{ src: string; type?: string }>) => void;
  ready: (callback: () => void) => void;
  on: (event: string, callback: () => void) => void;
  addClass?: (className: string) => void;
};

type RuntimeLabels = {
  passed: string;
  notPassed: string;
  score: string;
  correct: string;
  submitQuiz: string;
  submitted: string;
  true: string;
  false: string;
  yourAnswer: string;
  correctAnswer: string;
  expectedAnswer: string;
};

const DEFAULT_PRIMARY_COLOR = "#4596FD";
const DEFAULT_CONTRAST_COLOR = "#FFFFFF";
const DEFAULT_LOGO_PATH = "player/assets/mentingo-signet.svg";
const RUNTIME_LABELS: Record<string, RuntimeLabels> = {
  en: {
    passed: "Passed",
    notPassed: "Not passed",
    score: "Score",
    correct: "Correct",
    submitQuiz: "Submit quiz",
    submitted: "Submitted",
    true: "True",
    false: "False",
    yourAnswer: "Your answer",
    correctAnswer: "Correct answer",
    expectedAnswer: "Expected answer",
  },
  pl: {
    passed: "Zaliczono",
    notPassed: "Nie zaliczono",
    score: "Wynik",
    correct: "Poprawne",
    submitQuiz: "Zatwierdz quiz",
    submitted: "Zatwierdzono",
    true: "Prawda",
    false: "Falsz",
    yourAnswer: "Twoja odpowiedz",
    correctAnswer: "Poprawna odpowiedz",
    expectedAnswer: "Oczekiwana odpowiedz",
  },
  de: {
    passed: "Bestanden",
    notPassed: "Nicht bestanden",
    score: "Ergebnis",
    correct: "Richtig",
    submitQuiz: "Quiz absenden",
    submitted: "Abgesendet",
    true: "Richtig",
    false: "Falsch",
    yourAnswer: "Deine Antwort",
    correctAnswer: "Richtige Antwort",
    expectedAnswer: "Erwartete Antwort",
  },
  cs: {
    passed: "Splneno",
    notPassed: "Nesplneno",
    score: "Skore",
    correct: "Spravne",
    submitQuiz: "Odeslat kviz",
    submitted: "Odeslano",
    true: "Pravda",
    false: "Nepravda",
    yourAnswer: "Vase odpoved",
    correctAnswer: "Spravna odpoved",
    expectedAnswer: "Ocekavana odpoved",
  },
  lt: {
    passed: "Islaikyta",
    notPassed: "Neislaikyta",
    score: "Rezultatas",
    correct: "Teisingai",
    submitQuiz: "Pateikti testa",
    submitted: "Pateikta",
    true: "Tiesa",
    false: "Netiesa",
    yourAnswer: "Jusu atsakymas",
    correctAnswer: "Teisingas atsakymas",
    expectedAnswer: "Tiketinas atsakymas",
  },
};
const QUESTION_TYPE = {
  SINGLE_CHOICE: "single_choice",
  MULTIPLE_CHOICE: "multiple_choice",
  TRUE_OR_FALSE: "true_or_false",
  PHOTO_SINGLE: "photo_question_single_choice",
  PHOTO_MULTIPLE: "photo_question_multiple_choice",
  FILL_TEXT: "fill_in_the_blanks_text",
  FILL_DND: "fill_in_the_blanks_dnd",
  MATCH_WORDS: "match_words",
  BRIEF_RESPONSE: "brief_response",
  DETAILED_RESPONSE: "detailed_response",
} as const;

async function loadCourseJson(): Promise<CourseJson | null> {
  try {
    const response = await fetch("../data/course.json");
    if (!response.ok) return null;
    return (await response.json()) as CourseJson;
  } catch {
    return null;
  }
}

function getLessonId() {
  const queryLessonId = new URLSearchParams(window.location.search).get("lessonId");
  if (queryLessonId) return queryLessonId;

  return new URLSearchParams(window.location.hash.replace(/^#/, "")).get("lessonId") ?? "";
}

function getScormApi(): ScormApi | null {
  return findScormApi(window) ?? findScormApi(getWindowOpener(window));
}

function findScormApi(startWindow: Window | null) {
  let candidate = startWindow;
  const visited = new Set<Window>();

  for (let depth = 0; candidate && depth < 20 && !visited.has(candidate); depth += 1) {
    visited.add(candidate);

    const api = getWindowApi(candidate);
    if (api) return api;

    const parent = getWindowParent(candidate);
    if (!parent || parent === candidate) return null;
    candidate = parent;
  }

  return null;
}

function getWindowApi(candidate: Window) {
  try {
    return candidate.API ?? null;
  } catch {
    return null;
  }
}

function getWindowParent(candidate: Window) {
  try {
    return candidate.parent ?? null;
  } catch {
    return null;
  }
}

function getWindowOpener(candidate: Window) {
  try {
    return candidate.opener ?? null;
  } catch {
    return null;
  }
}

function readSuspendData(api: ScormApi | null): SuspendData {
  if (!api) return {};
  try {
    const value = api.LMSGetValue("cmi.suspend_data");
    return value ? (JSON.parse(value) as SuspendData) : {};
  } catch {
    return {};
  }
}

function createRuntimeState(api: ScormApi | null, lesson: Lesson) {
  const suspendData = readSuspendData(api);
  suspendData.lessons ??= {};
  suspendData.lessons[lesson.id] ??= {};

  const persist = () => {
    if (!api) return;
    api.LMSSetValue("cmi.suspend_data", JSON.stringify(suspendData));
    api.LMSCommit("");
  };

  return {
    lessonState: suspendData.lessons[lesson.id],
    complete() {
      suspendData.lessons![lesson.id].completed = true;
      api?.LMSSetValue("cmi.core.lesson_status", "completed");
      persist();
    },
    submitQuiz(
      scorePercent: number,
      correct: number,
      passed: boolean,
      answers: Record<string, QuestionAnswer>,
    ) {
      const state = suspendData.lessons![lesson.id];
      state.completed = true;
      state.submitted = true;
      state.correct = correct;
      state.scorePercent = scorePercent;
      state.answers = answers;
      api?.LMSSetValue("cmi.core.score.raw", String(Math.round(scorePercent)));
      api?.LMSSetValue("cmi.core.score.min", "0");
      api?.LMSSetValue("cmi.core.score.max", "100");
      api?.LMSSetValue("cmi.core.lesson_status", passed ? "passed" : "failed");
      persist();
    },
  };
}

function applyTheme(courseJson: CourseJson) {
  const primary = courseJson.theme?.primaryColor || DEFAULT_PRIMARY_COLOR;
  const contrast = courseJson.theme?.contrastColor || DEFAULT_CONTRAST_COLOR;
  const shades = buildPrimaryShades(primary);

  Object.entries(shades).forEach(([key, value]) => {
    document.documentElement.style.setProperty(`--primary-${key}`, value);
  });
  document.documentElement.style.setProperty("--primary", shades[700]);
  document.documentElement.style.setProperty("--contrast", contrast);
}

function buildPrimaryShades(hex: string) {
  const { h, s, l } = hexToHsl(hex);
  const shadeLightness = {
    50: 97,
    100: 90,
    200: 80,
    300: 70,
    400: 60,
    500: 50,
    600: 40,
    700: l,
    800: 25,
    900: 15,
    950: 10,
  };

  return Object.fromEntries(
    Object.entries(shadeLightness).map(([key, lightness]) => [key, hslToHex(h, s, lightness)]),
  ) as Record<number, string>;
}

function hexToHsl(hex: string) {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return { h: 0, s: 0, l: l * 100 };

  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  if (max === g) h = (b - r) / d + 2;
  if (max === b) h = (r - g) / d + 4;

  return { h: normalizeHue(h * 60), s: s * 100, l: l * 100 };
}

function getRuntimeLabels(language: string) {
  const normalizedLanguage = language.toLowerCase();
  return (
    RUNTIME_LABELS[normalizedLanguage] ??
    RUNTIME_LABELS[normalizedLanguage.split("-")[0]] ??
    RUNTIME_LABELS.en
  );
}

function hslToHex(h: number, s: number, l: number) {
  const hue = normalizeHue(h);
  const saturation = s / 100;
  const lightness = l / 100;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - c / 2;
  const [r, g, b] = hslSegmentToRgb(hue, c, x);

  return `#${[r, g, b]
    .map((value) =>
      Math.round((value + m) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function normalizeHue(hue: number) {
  return ((hue % 360) + 360) % 360;
}

function hslSegmentToRgb(hue: number, c: number, x: number) {
  if (hue < 60) return [c, x, 0];
  if (hue < 120) return [x, c, 0];
  if (hue < 180) return [0, c, x];
  if (hue < 240) return [0, x, c];
  if (hue < 300) return [x, 0, c];
  return [c, 0, x];
}

function renderShell(root: HTMLElement, courseJson: CourseJson) {
  root.innerHTML = "";
  const shell = element("section", "runtime-shell");
  const header = element("header", "runtime-header");
  const brand = element("div", "runtime-brand");
  const logo = element("img", "runtime-logo") as HTMLImageElement;
  logo.src = resolveRuntimeReference(courseJson.course.logoPath);
  logo.alt = "";
  logo.addEventListener("error", () => {
    if (!logo.src.endsWith(DEFAULT_LOGO_PATH))
      logo.src = resolveRuntimeReference(DEFAULT_LOGO_PATH);
  });
  brand.append(logo);
  header.append(brand);
  const lessonContainer = element("main", "runtime-lesson");
  shell.append(header, lessonContainer);
  root.append(shell);
  return lessonContainer;
}

function renderContentLesson(container: HTMLElement, lesson: ContentLesson) {
  container.append(renderTitle(lesson.title), renderHtmlContent(lesson.html));
}

function renderEmbedLesson(container: HTMLElement, lesson: EmbedLesson, complete: () => void) {
  container.append(renderTitle(lesson.title));
  const frame = element("iframe", "embed-frame") as HTMLIFrameElement;
  frame.src = lesson.url;
  frame.title = lesson.title;
  frame.loading = "eager";
  frame.referrerPolicy = "no-referrer-when-downgrade";
  frame.setAttribute("allow", "fullscreen; autoplay; encrypted-media; clipboard-write");
  if (lesson.allowFullscreen) frame.allowFullscreen = true;
  frame.addEventListener("load", complete, { once: true });
  container.append(frame);
  window.setTimeout(complete, 1500);
}

function renderHtmlContent(html: string) {
  const wrapper = element("article", "content-viewer");
  wrapper.innerHTML = html;
  enhanceContentNodes(wrapper);
  return wrapper;
}

function enhanceContentNodes(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-node-type="video"]').forEach((node) => {
    const src = node.dataset.src || node.getAttribute("href");
    if (!src) return;
    const video = createVideoBlock(resolveRuntimeReference(src), node.dataset.provider);
    node.replaceWith(video);
  });

  root
    .querySelectorAll<HTMLElement>(
      '[data-node-type="presentation"], [data-node-type="pdf-preview"]',
    )
    .forEach((node) => {
      const src = node.dataset.src || node.getAttribute("href");
      if (!src) return;
      const frame = element("iframe", "content-frame") as HTMLIFrameElement;
      frame.src = resolveRuntimeReference(src);
      frame.title = node.dataset.name || "Embedded content";
      frame.setAttribute("allow", "fullscreen; autoplay; encrypted-media");
      frame.allowFullscreen = true;
      node.replaceWith(frame);
    });

  root.querySelectorAll<HTMLElement>('[data-node-type="downloadable-file"]').forEach((node) => {
    const src = node.dataset.src || node.getAttribute("href");
    if (!src) return;
    const link = element(
      "a",
      "download-card",
      node.dataset.name || "Download file",
    ) as HTMLAnchorElement;
    link.href = resolveRuntimeReference(src);
    link.download = node.dataset.name || "";
    node.replaceWith(link);
  });
}

function createVideoBlock(src: string, provider?: string) {
  const wrap = element("div", "video-frame");
  const video = document.createElement("video-js");
  video.className = "mentingo-video-js";
  wrap.append(video);

  window.setTimeout(() => {
    if (!window.videojs) return;
    const player = window.videojs(video, {
      controls: true,
      responsive: true,
      fluid: true,
      bigPlayButton: false,
      inactivityTimeout: 3000,
      techOrder: ["html5", "youtube", "Vimeo"],
      html5: {
        vhs: { overrideNative: true },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
    });
    player.ready(() => player.addClass?.("vjs-mentingo-ready"));
    player.src([{ src, type: getVideoType(src, provider) }]);
  });

  return wrap;
}

function getVideoType(src: string, provider?: string) {
  if (provider === "youtube" || /youtube\.com|youtu\.be/i.test(src)) return "video/youtube";
  if (provider === "vimeo" || /vimeo\.com/i.test(src)) return "video/vimeo";
  if (/\.m3u8($|\?)/i.test(src)) return "application/vnd.apple.mpegurl";
  return "video/mp4";
}

function renderQuizLesson(
  container: HTMLElement,
  lesson: QuizLesson,
  courseJson: CourseJson,
  runtime: ReturnType<typeof createRuntimeState>,
) {
  const savedAnswers = runtime.lessonState.answers ?? {};
  const labels = getRuntimeLabels(courseJson.course.language);
  let submitted = Boolean(runtime.lessonState.submitted);
  const form = element("form", "quiz-form") as HTMLFormElement;
  const feedback = element("div", "quiz-feedback");
  const actions = element("div", "quiz-actions");
  const submit = element(
    "button",
    "primary-button",
    submitted ? labels.submitted : labels.submitQuiz,
  ) as HTMLButtonElement;
  submit.type = "submit";
  submit.disabled = submitted;

  form.append(renderTitle(lesson.title));
  lesson.questions.forEach((question) => {
    form.append(
      renderQuestion(
        question,
        savedAnswers[question.id],
        submitted,
        courseJson.settings.quizFeedbackEnabled,
        labels,
      ),
    );
  });
  actions.append(submit);
  form.append(feedback, actions);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const answers = collectQuizAnswers(form, lesson);
    const result = scoreQuiz(lesson, answers);
    submitted = true;
    runtime.submitQuiz(result.scorePercent, result.correct, result.passed, answers);
    feedback.replaceChildren(renderScore(result, lesson, labels));
    submit.textContent = labels.submitted;
    submit.disabled = true;
    form
      .querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >("input, textarea, select")
      .forEach((input) => {
        input.disabled = true;
      });
    if (courseJson.settings.quizFeedbackEnabled) {
      lesson.questions.forEach((question) => {
        const card = form.querySelector<HTMLElement>(
          `.question-card[data-question-id="${question.id}"]`,
        );
        if (card) updateQuestionFeedback(card, question, answers[question.id], labels, true);
      });
    }
  });

  container.append(form);
  if (submitted) {
    const scorePercent = runtime.lessonState.scorePercent ?? 0;
    feedback.append(
      renderScore(
        {
          correct: runtime.lessonState.correct ?? scoreQuiz(lesson, savedAnswers).correct,
          scorePercent,
          passed: scorePercent >= (lesson.passingScorePercent ?? 0),
        },
        lesson,
        labels,
      ),
    );
  }
}

function renderQuestion(
  question: QuizQuestion,
  savedAnswer: QuestionAnswer | undefined,
  submitted: boolean,
  showFeedback: boolean,
  labels: RuntimeLabels,
) {
  const card = element("section", "question-card");
  card.dataset.questionId = question.id;
  card.dataset.questionType = question.type;
  card.append(element("h2", "question-title", question.title));
  if (question.assets[0]?.packagePath) {
    const image = element("img", "question-image") as HTMLImageElement;
    image.src = resolveRuntimeReference(question.assets[0].packagePath);
    image.alt = "";
    card.append(image);
  }
  if (question.description && !isFillInTheBlanksQuestion(question)) {
    card.append(renderHtmlContent(question.description));
  }

  const answerArea = element("div", "answer-area");
  renderAnswerControl(answerArea, question, savedAnswer, submitted, labels);
  card.append(answerArea);

  const feedback = element("div", "question-feedback");
  card.append(feedback);
  updateQuestionFeedback(card, question, savedAnswer, labels, submitted && showFeedback);

  return card;
}

function renderAnswerControl(
  container: HTMLElement,
  question: QuizQuestion,
  savedAnswer: QuestionAnswer | undefined,
  submitted: boolean,
  labels: RuntimeLabels,
) {
  if (
    question.type === QUESTION_TYPE.BRIEF_RESPONSE ||
    question.type === QUESTION_TYPE.DETAILED_RESPONSE
  ) {
    const input = element("textarea", "text-answer") as HTMLTextAreaElement;
    input.name = question.id;
    input.rows = question.type === QUESTION_TYPE.DETAILED_RESPONSE ? 6 : 3;
    input.value = typeof savedAnswer === "string" ? savedAnswer : "";
    input.disabled = submitted;
    container.append(input);
    return;
  }

  if (question.type === QUESTION_TYPE.FILL_TEXT) {
    renderFillText(container, question, savedAnswer, submitted);
    return;
  }

  if (question.type === QUESTION_TYPE.FILL_DND) {
    renderFillDnd(container, question, savedAnswer, submitted);
    return;
  }

  if (question.type === QUESTION_TYPE.MATCH_WORDS) {
    question.options.forEach((option) => {
      const optionIndex = question.options.findIndex((candidate) => candidate.id === option.id);
      const row = element("label", "match-row");
      row.append(element("span", "", option.title));
      const input = element("input", "match-input") as HTMLInputElement;
      input.name = `${question.id}:${option.id}`;
      input.value = Array.isArray(savedAnswer) ? (savedAnswer[optionIndex] ?? "") : "";
      input.disabled = submitted;
      row.append(input);
      container.append(row);
    });
    return;
  }

  if (question.type === QUESTION_TYPE.TRUE_OR_FALSE) {
    renderTrueFalse(container, question, savedAnswer, submitted, labels);
    return;
  }

  const multiple =
    question.type === QUESTION_TYPE.MULTIPLE_CHOICE ||
    question.type === QUESTION_TYPE.PHOTO_MULTIPLE;
  question.options.forEach((option) => {
    const label = element("label", "choice-row");
    const input = element("input", "") as HTMLInputElement;
    input.type = multiple ? "checkbox" : "radio";
    input.name = question.id;
    input.value = option.id;
    input.disabled = submitted;
    if (isSavedChoiceChecked(savedAnswer, option.id, input.value)) {
      input.checked = true;
    }
    label.append(input, element("span", "", option.title));
    container.append(label);
  });
}

function renderTrueFalse(
  container: HTMLElement,
  question: QuizQuestion,
  savedAnswer: QuestionAnswer | undefined,
  submitted: boolean,
  labels: RuntimeLabels,
) {
  question.options.forEach((option, optionIndex) => {
    const row = element("div", "true-false-row");
    row.append(element("div", "true-false-statement", option.title));
    const controls = element("div", "true-false-controls");

    ["true", "false"].forEach((value) => {
      const label = element("label", "true-false-option");
      const input = element("input", "") as HTMLInputElement;
      input.type = "radio";
      input.name = `${question.id}:${option.id}`;
      input.value = value;
      input.disabled = submitted;
      input.checked = Array.isArray(savedAnswer) && savedAnswer[optionIndex] === value;
      label.append(input, element("span", "", value === "true" ? labels.true : labels.false));
      controls.append(label);
    });

    row.append(controls);
    container.append(row);
  });
}

function renderFillText(
  container: HTMLElement,
  question: QuizQuestion,
  savedAnswer: QuestionAnswer | undefined,
  submitted: boolean,
) {
  const parts = (question.description ?? "").split("[word]");
  const answers = Array.isArray(savedAnswer) ? savedAnswer : [];
  const sentence = element("div", "fill-sentence");
  parts.forEach((part, index) => {
    sentence.append(document.createTextNode(stripHtml(part)));
    if (index < parts.length - 1) {
      const input = element("input", "blank-input") as HTMLInputElement;
      input.name = `${question.id}:${index + 1}`;
      input.value = answers[index] ?? "";
      input.disabled = submitted;
      sentence.append(input);
    }
  });
  container.append(sentence);
}

function renderFillDnd(
  container: HTMLElement,
  question: QuizQuestion,
  savedAnswer: QuestionAnswer | undefined,
  submitted: boolean,
) {
  const parts = stripHtml(question.description ?? "").split("[word]");
  const answers = Array.isArray(savedAnswer) ? savedAnswer : [];
  const sentence = element("div", "fill-sentence dnd-sentence");

  parts.forEach((part, index) => {
    sentence.append(document.createTextNode(part));
    if (index < parts.length - 1) {
      const blank = element("button", "dnd-blank", answers[index] ?? "") as HTMLButtonElement;
      blank.type = "button";
      blank.dataset.blankIndex = String(index);
      blank.dataset.word = answers[index] ?? "";
      blank.setAttribute("aria-label", "Drop word");
      blank.disabled = submitted;
      const input = element("input") as HTMLInputElement;
      input.type = "hidden";
      input.name = `${question.id}:${index + 1}`;
      input.value = answers[index] ?? "";
      sentence.append(blank, input);
    }
  });

  const bank = element("div", "word-bank");
  question.options.forEach((option) => {
    const chip = element("button", "word-chip", option.title) as HTMLButtonElement;
    chip.type = "button";
    chip.draggable = !submitted;
    chip.disabled = submitted;
    chip.dataset.word = option.title;
    chip.hidden = answers.includes(option.title);
    bank.append(chip);
  });

  if (!submitted) wireDragAndDrop(sentence, bank);
  container.append(sentence, bank);
}

function wireDragAndDrop(sentence: HTMLElement, bank: HTMLElement) {
  let draggedWord = "";
  let draggedChip: HTMLButtonElement | null = null;

  bank.querySelectorAll<HTMLButtonElement>(".word-chip").forEach((chip) => {
    chip.addEventListener("dragstart", (event) => {
      draggedWord = chip.dataset.word ?? chip.textContent ?? "";
      draggedChip = chip;
      event.dataTransfer?.setData("text/plain", draggedWord);
    });
  });

  sentence.querySelectorAll<HTMLButtonElement>(".dnd-blank").forEach((blank) => {
    blank.addEventListener("dragover", (event) => {
      event.preventDefault();
      blank.classList.add("is-drag-over");
    });
    blank.addEventListener("dragleave", () => blank.classList.remove("is-drag-over"));
    blank.addEventListener("drop", (event) => {
      event.preventDefault();
      blank.classList.remove("is-drag-over");
      const word = event.dataTransfer?.getData("text/plain") || draggedWord;
      if (!word) return;
      restoreWordChip(bank, blank.dataset.word ?? "");
      blank.textContent = word;
      blank.dataset.word = word;
      const input = blank.nextElementSibling;
      if (input instanceof HTMLInputElement) input.value = word;
      const chip = draggedChip ?? findWordChip(bank, word);
      if (chip) chip.hidden = true;
      draggedChip = null;
      draggedWord = "";
    });
  });
}

function restoreWordChip(bank: HTMLElement, word: string) {
  const chip = findWordChip(bank, word);
  if (chip) chip.hidden = false;
}

function findWordChip(bank: HTMLElement, word: string) {
  return Array.from(bank.querySelectorAll<HTMLButtonElement>(".word-chip")).find(
    (chip) => chip.dataset.word === word,
  );
}

function isSavedChoiceChecked(
  savedAnswer: QuestionAnswer | undefined,
  optionId: string,
  value: string,
) {
  if (Array.isArray(savedAnswer))
    return savedAnswer.includes(optionId) || savedAnswer.includes(value);
  return savedAnswer === optionId || savedAnswer === value;
}

function resolveRuntimeReference(reference: string) {
  if (
    reference.startsWith("http://") ||
    reference.startsWith("https://") ||
    reference.startsWith("../") ||
    reference.startsWith("./") ||
    reference.startsWith("#") ||
    reference.startsWith("data:")
  ) {
    return reference;
  }

  if (reference.startsWith("player/")) return `./${reference.replace(/^player\//, "")}`;
  if (reference.startsWith("assets/")) return `../${reference}`;

  return reference;
}

function collectQuizAnswers(form: HTMLFormElement, lesson: QuizLesson) {
  const answers: Record<string, QuestionAnswer> = {};
  lesson.questions.forEach((question) => {
    if (
      question.type === QUESTION_TYPE.BRIEF_RESPONSE ||
      question.type === QUESTION_TYPE.DETAILED_RESPONSE
    ) {
      answers[question.id] =
        (form.elements.namedItem(question.id) as HTMLTextAreaElement)?.value ?? "";
      return;
    }

    if (question.type === QUESTION_TYPE.FILL_TEXT || question.type === QUESTION_TYPE.FILL_DND) {
      answers[question.id] = Array.from(
        form.querySelectorAll<HTMLInputElement>(`input[name^="${question.id}:"]`),
      ).map((input) => input.value.trim());
      return;
    }

    if (question.type === QUESTION_TYPE.TRUE_OR_FALSE) {
      answers[question.id] = question.options.map((option) => {
        const checkedInput = form.querySelector<HTMLInputElement>(
          `input[name="${question.id}:${option.id}"]:checked`,
        );
        return checkedInput?.value ?? "";
      });
      return;
    }

    if (question.type === QUESTION_TYPE.MATCH_WORDS) {
      answers[question.id] = question.options.map((option) => {
        const inputs = Array.from(
          form.querySelectorAll<HTMLInputElement>(`input[name="${question.id}:${option.id}"]`),
        );
        const checkedInput = inputs.find((input) => input.checked);
        return checkedInput?.value ?? inputs[0]?.value.trim() ?? "";
      });
      return;
    }

    answers[question.id] = Array.from(
      form.querySelectorAll<HTMLInputElement>(`input[name="${question.id}"]:checked`),
    ).map((input) => input.value);
  });
  return answers;
}

function scoreQuiz(lesson: QuizLesson, answers: Record<string, QuestionAnswer>) {
  let correct = 0;
  lesson.questions.forEach((question) => {
    if (isQuestionCorrect(question, answers[question.id])) correct += 1;
  });
  const scorePercent = lesson.questions.length ? (correct / lesson.questions.length) * 100 : 100;
  const passed = scorePercent >= (lesson.passingScorePercent ?? 0);
  return { correct, scorePercent, passed };
}

function isQuestionCorrect(question: QuizQuestion, answer: QuestionAnswer | undefined) {
  if (
    question.type === QUESTION_TYPE.BRIEF_RESPONSE ||
    question.type === QUESTION_TYPE.DETAILED_RESPONSE
  ) {
    return typeof answer === "string" && answer.trim().length > 0;
  }
  if (question.type === QUESTION_TYPE.FILL_TEXT || question.type === QUESTION_TYPE.FILL_DND) {
    const answerValues = Array.isArray(answer) ? answer : [];
    return isBlankQuestionCorrect(question, answerValues);
  }
  if (question.type === QUESTION_TYPE.MATCH_WORDS) {
    const values = Array.isArray(answer) ? answer : [];
    return question.options.every(
      (option, index) => values[index]?.trim() === (option.matchedWord ?? ""),
    );
  }
  if (question.type === QUESTION_TYPE.TRUE_OR_FALSE) {
    const values = Array.isArray(answer) ? answer : [];
    return question.options.every((option, index) => values[index] === String(option.isCorrect));
  }
  const selected = new Set(Array.isArray(answer) ? answer : answer ? [answer] : []);
  return question.options.every((option) => selected.has(option.id) === option.isCorrect);
}

function renderScore(
  result: { correct: number; scorePercent: number; passed: boolean },
  lesson: QuizLesson,
  labels: RuntimeLabels,
) {
  const node = element("div", "quiz-summary");
  node.append(
    element(
      "span",
      result.passed ? "quiz-summary-status is-pass" : "quiz-summary-status is-fail",
      result.passed ? labels.passed : labels.notPassed,
    ),
    element("span", "quiz-summary-item", `${labels.score}: ${Math.round(result.scorePercent)}%`),
    element(
      "span",
      "quiz-summary-item",
      `${labels.correct}: ${result.correct} / ${lesson.questions.length}`,
    ),
  );
  return node;
}

function updateQuestionFeedback(
  card: HTMLElement,
  question: QuizQuestion,
  answer: QuestionAnswer | undefined,
  labels: RuntimeLabels,
  showFeedback: boolean,
) {
  decorateSubmittedAnswers(card, question, answer, labels, showFeedback);

  const feedback = card.querySelector<HTMLElement>(".question-feedback");
  if (!feedback) return;
  feedback.replaceChildren();
  feedback.hidden = !showFeedback;
  if (!showFeedback) return;

  const correctAnswer = renderCorrectAnswer(question, labels);
  if (correctAnswer) feedback.append(correctAnswer);
  if (question.solutionExplanation)
    feedback.append(renderHtmlContent(question.solutionExplanation));
  if (!feedback.childElementCount) feedback.hidden = true;
}

function decorateSubmittedAnswers(
  card: HTMLElement,
  question: QuizQuestion,
  answer: QuestionAnswer | undefined,
  labels: RuntimeLabels,
  showFeedback: boolean,
) {
  card.querySelectorAll(".is-correct, .is-wrong, .is-missed").forEach((node) => {
    node.classList.remove("is-correct", "is-wrong", "is-missed");
  });
  card.querySelectorAll(".answer-feedback-label").forEach((node) => node.remove());
  if (!showFeedback) return;

  if (question.type === QUESTION_TYPE.TRUE_OR_FALSE) {
    const values = Array.isArray(answer) ? answer : [];
    question.options.forEach((option, optionIndex) => {
      card
        .querySelectorAll<HTMLElement>(
          `.true-false-row:nth-of-type(${optionIndex + 1}) .true-false-option`,
        )
        .forEach((label) => {
          const input = label.querySelector<HTMLInputElement>("input");
          const value = input?.value ?? "";
          const isCorrectOption = value === String(option.isCorrect);
          if (isCorrectOption) {
            label.classList.add(values[optionIndex] === value ? "is-correct" : "is-missed");
          }
        });
    });
    return;
  }

  if (isChoiceQuestion(question)) {
    const selected = new Set(Array.isArray(answer) ? answer : answer ? [answer] : []);
    question.options.forEach((option) => {
      const input = card.querySelector<HTMLInputElement>(`input[value="${option.id}"]`);
      const row = input?.closest<HTMLElement>(".choice-row");
      if (!row) return;
      applyAnswerStatus(row, option.isCorrect, selected.has(option.id), labels);
    });
  }
}

function applyAnswerStatus(
  target: HTMLElement,
  isCorrectOption: boolean,
  isSelected: boolean,
  labels: RuntimeLabels,
  showLabel = true,
) {
  if (isSelected && isCorrectOption) {
    target.classList.add("is-correct");
    if (showLabel) target.append(element("span", "answer-feedback-label", labels.yourAnswer));
    return;
  }
  if (isSelected) {
    target.classList.add("is-wrong");
    if (showLabel) target.append(element("span", "answer-feedback-label", labels.yourAnswer));
    return;
  }
  if (isCorrectOption) {
    target.classList.add("is-missed");
    if (showLabel) target.append(element("span", "answer-feedback-label", labels.correctAnswer));
  }
}

function isChoiceQuestion(question: QuizQuestion) {
  return (
    question.type === QUESTION_TYPE.SINGLE_CHOICE ||
    question.type === QUESTION_TYPE.MULTIPLE_CHOICE ||
    question.type === QUESTION_TYPE.PHOTO_SINGLE ||
    question.type === QUESTION_TYPE.PHOTO_MULTIPLE
  );
}

function renderCorrectAnswer(question: QuizQuestion, labels: RuntimeLabels) {
  if (question.type === QUESTION_TYPE.MATCH_WORDS) {
    const values = question.options.map((option) => `${option.title}: ${option.matchedWord ?? ""}`);
    return renderExpectedAnswer(values, labels);
  }

  if (isFillInTheBlanksQuestion(question)) {
    const values = getCorrectOptions(question).map((option) => option.title);
    return renderExpectedAnswer(values, labels);
  }

  return null;
}

function renderExpectedAnswer(values: string[], labels: RuntimeLabels) {
  if (!values.length) return null;

  const wrapper = element("div", "expected-answer");
  wrapper.append(element("div", "expected-answer-label", labels.expectedAnswer));
  const list = element("div", "expected-answer-list");
  values.forEach((value) => {
    if (value.trim()) list.append(element("span", "expected-answer-chip", value));
  });
  if (!list.childElementCount) return null;
  wrapper.append(list);
  return wrapper;
}

function isBlankQuestionCorrect(question: QuizQuestion, answerValues: string[]) {
  const correctOptions = getCorrectOptions(question);
  if (!answerValues.length || !correctOptions.length) return false;

  const blankCount = getBlankCount(question);
  if (blankCount === 1) {
    return correctOptions.some((option) => isSameAnswer(answerValues[0], option.title));
  }

  if (correctOptions.length === blankCount) {
    return correctOptions.every((option, index) => isSameAnswer(answerValues[index], option.title));
  }

  return answerValues.every((answer) =>
    correctOptions.some((option) => isSameAnswer(answer, option.title)),
  );
}

function getCorrectOptions(question: QuizQuestion) {
  const correctOptionIds = new Set(question.correctOptionIds);
  const correctOptions = question.options.filter(
    (option) => option.isCorrect || correctOptionIds.has(option.id),
  );
  return correctOptions.length ? correctOptions : question.options;
}

function getBlankCount(question: QuizQuestion) {
  return Math.max(stripHtml(question.description ?? "").split("[word]").length - 1, 0);
}

function isSameAnswer(answer: string | undefined, expected: string) {
  return (answer ?? "").trim().toLocaleLowerCase() === expected.trim().toLocaleLowerCase();
}

function isFillInTheBlanksQuestion(question: QuizQuestion) {
  return question.type === QUESTION_TYPE.FILL_TEXT || question.type === QUESTION_TYPE.FILL_DND;
}

function renderTitle(title: string) {
  const header = element("div", "lesson-heading");
  header.append(element("h1", "", title));
  return header;
}

function stripHtml(value: string) {
  const template = document.createElement("template");
  template.innerHTML = value;
  return template.content.textContent ?? "";
}

function element(tag: string, className = "", text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (typeof text === "string") node.textContent = text;
  return node;
}

function resolveLesson(courseJson: CourseJson) {
  const requestedLessonId = getLessonId();
  const requestedLesson = courseJson.lessons[requestedLessonId];
  if (requestedLesson) return requestedLesson;

  const orderedLessonIds = courseJson.chapters.flatMap((chapter) => chapter.lessonIds);
  const availableLessons = orderedLessonIds
    .map((lessonId) => courseJson.lessons[lessonId])
    .filter((lesson): lesson is Lesson => Boolean(lesson));

  if (!requestedLessonId && availableLessons.length === 1) return availableLessons[0];

  return null;
}

function renderLoadError(root: HTMLElement, courseJson: CourseJson | null) {
  root.innerHTML = "";
  const message = courseJson
    ? "This SCORM lesson could not be loaded because the launch URL did not include a valid lesson id."
    : "This SCORM lesson could not be loaded because the package data is missing.";
  root.append(element("div", "load-error", message));
}

async function boot() {
  const root = document.getElementById("scorm-export-root");
  if (!root) return;

  const courseJson = await loadCourseJson();
  const lesson = courseJson ? resolveLesson(courseJson) : null;
  if (!courseJson || !lesson) {
    renderLoadError(root, courseJson);
    return;
  }

  applyTheme(courseJson);
  const api = getScormApi();
  api?.LMSInitialize("");
  const runtime = createRuntimeState(api, lesson);
  const container = renderShell(root, courseJson);

  if (lesson.type === "content") {
    renderContentLesson(container, lesson);
    runtime.complete();
  }
  if (lesson.type === "embed") renderEmbedLesson(container, lesson, runtime.complete);
  if (lesson.type === "quiz") renderQuizLesson(container, lesson, courseJson, runtime);

  window.addEventListener("beforeunload", () => {
    api?.LMSCommit("");
    api?.LMSFinish("");
  });
  document.documentElement.dataset.scormExportRuntime = "ready";
}

window.MentingoScormExportRuntime = { boot };

void boot();

export {};
