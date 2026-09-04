import { LEARNER_TRANSCRIPT_STATUSES } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useCurrentUserSuspense } from "~/api/queries";
import { Icon } from "~/components/Icon";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { cn } from "~/lib/utils";

import type {
  LearnerTranscriptRevision,
  MentorSpeechPresentation,
} from "~/modules/Voice/voice-mentor-presentation.types";

type VoiceConversationTranscriptProps = {
  learnerTranscript: LearnerTranscriptRevision | null;
  mentorResponse: string;
  mentorSpeech: MentorSpeechPresentation | null;
  mentorName: string;
  mentorAvatarUrl?: string | null;
};

const NO_LEADING_SPACE_PATTERN = /^[,.;:!?…)}\]]/u;
const NO_TRAILING_SPACE_PATTERN = /[([{]$/u;

function getWordPrefix(words: MentorSpeechPresentation["words"], index: number): string {
  if (index === 0) {
    return "";
  }

  const word = words[index]?.text ?? "";
  const previousWord = words[index - 1]?.text ?? "";
  if (
    /^\s/u.test(word) ||
    /\s$/u.test(previousWord) ||
    NO_LEADING_SPACE_PATTERN.test(word) ||
    NO_TRAILING_SPACE_PATTERN.test(previousWord)
  ) {
    return "";
  }

  return " ";
}

function MentorAvatar({
  mentorName,
  mentorAvatarUrl,
}: Pick<VoiceConversationTranscriptProps, "mentorName" | "mentorAvatarUrl">) {
  if (mentorAvatarUrl) {
    return (
      <img src={mentorAvatarUrl} alt={mentorName} className="size-9 rounded-full object-cover" />
    );
  }

  return (
    <div className="flex size-9 items-center justify-center rounded-full bg-primary-100 ring-1 ring-primary-200/70">
      <Icon name="AiMentor" className="size-6 p-0.5 text-primary-700" aria-label={mentorName} />
    </div>
  );
}

function MentorTimedText({ speech }: { speech: MentorSpeechPresentation }) {
  return (
    <span aria-hidden="true">
      {speech.words.map((word, index) => (
        <span
          key={`${word.startMs}-${word.endMs}-${index}`}
          className={cn("rounded px-0.5 py-0.5", {
            "bg-primary-100 text-primary-950": index === speech.activeWordIndex,
            "text-neutral-900": speech.activeWordIndex === null || index < speech.activeWordIndex,
            "text-neutral-400": speech.activeWordIndex !== null && index > speech.activeWordIndex,
          })}
        >
          {getWordPrefix(speech.words, index)}
          {word.text}
        </span>
      ))}
    </span>
  );
}

export function VoiceConversationTranscript({
  learnerTranscript,
  mentorResponse,
  mentorSpeech,
  mentorName,
  mentorAvatarUrl,
}: VoiceConversationTranscriptProps) {
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUserSuspense();
  const isLearnerPartial = learnerTranscript?.status === LEARNER_TRANSCRIPT_STATUSES.PARTIAL;
  const hasMentorSpeech = Boolean(mentorSpeech?.words.length);
  const learnerDisplayName =
    `${currentUser?.firstName ?? ""} ${currentUser?.lastName ?? ""}`.trim() ||
    t("studentCourseView.lesson.aiMentorLesson.userName");

  if (!learnerTranscript && !mentorResponse) {
    return <div className="h-24" aria-hidden="true" />;
  }

  return (
    <div className="mx-auto flex min-h-24 w-full max-w-3xl flex-col justify-end gap-3">
      {learnerTranscript && (
        <div className="flex max-w-[88%] self-start items-start gap-3">
          <div className="mt-0.5 shrink-0">
            <UserAvatar
              userName={learnerDisplayName}
              profilePictureUrl={currentUser?.profilePictureUrl}
              className="size-9"
            />
          </div>
          <div className="min-w-0 flex flex-col gap-1">
            <span className="text-sm font-semibold text-primary-900">{learnerDisplayName}</span>
            <div
              aria-live={isLearnerPartial ? "polite" : "off"}
              className={cn(
                "w-fit max-w-full rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed",
                {
                  "border border-neutral-200 bg-white/70 text-neutral-400": isLearnerPartial,
                  "border border-neutral-200 bg-white/90 text-neutral-900 shadow-sm":
                    !isLearnerPartial,
                },
              )}
            >
              <span className={cn(!isLearnerPartial && "transcript-finalized-text")}>
                {learnerTranscript.text}
              </span>
            </div>
          </div>
        </div>
      )}

      {mentorResponse && (
        <div className="flex max-w-[88%] items-start gap-3">
          <div className="mt-0.5 shrink-0">
            <MentorAvatar mentorName={mentorName} mentorAvatarUrl={mentorAvatarUrl} />
          </div>
          <div className="min-w-0 flex flex-col gap-1">
            <span className="text-sm font-semibold text-primary-900">{mentorName}</span>
            <div className="rounded-2xl rounded-bl-md bg-white/90 px-4 py-3 text-sm leading-relaxed text-neutral-900 shadow-sm ring-1 ring-neutral-200/80">
              {hasMentorSpeech && mentorSpeech ? (
                <>
                  <span className="sr-only">{mentorResponse}</span>
                  <MentorTimedText speech={mentorSpeech} />
                </>
              ) : (
                mentorResponse
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
