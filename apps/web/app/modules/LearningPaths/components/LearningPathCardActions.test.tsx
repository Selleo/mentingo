import { LEARNING_PATH_STATUSES } from "@repo/shared";
import { screen } from "@testing-library/react";

import { renderWith } from "~/utils/testUtils";

import { LearningPathCardActions } from "./LearningPathCardActions";

const renderActions = (onEnrollCurrentUser?: () => Promise<void>) =>
  renderWith().render(
    <LearningPathCardActions
      canEdit={false}
      canDelete={false}
      canManageEnrollment={false}
      learningPathId="learning-path-1"
      canPlayCourses={false}
      isPending={false}
      isEnrolled={false}
      groupOptions={[]}
      title="Learning path"
      status={LEARNING_PATH_STATUSES.PUBLISHED}
      sequenceEnabled={false}
      includesCertificate={false}
      onEnrollCurrentUser={onEnrollCurrentUser}
      onDelete={() => {}}
      onStatusChange={() => {}}
      onSequenceEnabledChange={() => {}}
      onCertificateChange={() => {}}
      onCertificateSignatureUpload={() => {}}
      onRemoveCertificateSignature={() => {}}
      onCertificateFontColorChange={() => {}}
    />,
  );

describe("LearningPathCardActions", () => {
  it("shows the enroll button when self-enrollment is available", () => {
    renderActions(async () => {});

    expect(screen.getByRole("button", { name: /enroll/i })).toBeInTheDocument();
  });

  it("hides the enroll button when self-enrollment is unavailable", () => {
    renderActions();

    expect(screen.queryByRole("button", { name: /enroll/i })).not.toBeInTheDocument();
  });
});
