import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { PHONE_LOGIN_HANDLES } from "../../../../e2e/data/auth/handles";

import { PhoneLoginForm } from "./PhoneLoginForm";

const mocks = vi.hoisted(() => ({
  requestLoginCode: vi.fn(),
  verifyLoginCode: vi.fn(),
  handleAuthSuccess: vi.fn(),
}));

vi.mock("~/api/api-client", () => ({
  ApiClient: {
    api: {
      phoneAuthControllerRequestLoginCode: mocks.requestLoginCode,
      phoneAuthControllerVerifyLoginCode: mocks.verifyLoginCode,
    },
  },
}));

vi.mock("~/api/mutations/helpers/handleAuthSuccess", () => ({
  handleAuthSuccess: mocks.handleAuthSuccess,
}));

describe("PhoneLoginForm", () => {
  beforeAll(() => {
    // input-otp probes for password manager badges; jsdom has no layout engine.
    document.elementFromPoint = vi.fn(() => null);
  });

  beforeEach(() => {
    mocks.requestLoginCode.mockReset();
    mocks.verifyLoginCode.mockReset();
    mocks.handleAuthSuccess.mockReset();

    mocks.requestLoginCode.mockResolvedValue({
      data: {
        data: {
          message: "phoneAuth.toast.codeSent",
          resendAvailableInSeconds: 60,
          codeTtlSeconds: 300,
        },
      },
    });
    mocks.verifyLoginCode.mockResolvedValue({
      data: { data: { id: "user-id", shouldVerifyMFA: false } },
    });
  });

  it("validates the phone number before requesting a code", async () => {
    renderWith({ withQuery: true }).render(<PhoneLoginForm />);

    const user = userEvent.setup();

    await user.type(screen.getByTestId(PHONE_LOGIN_HANDLES.PHONE_INPUT), "12ab");
    await user.click(screen.getByTestId(PHONE_LOGIN_HANDLES.REQUEST_CODE));

    expect(await screen.findByText("Enter a valid phone number")).toBeInTheDocument();
    expect(mocks.requestLoginCode).not.toHaveBeenCalled();
  });

  it("requests a code, shows the resend countdown and signs in with the code", async () => {
    renderWith({ withQuery: true }).render(<PhoneLoginForm />);

    const user = userEvent.setup();

    await user.type(screen.getByTestId(PHONE_LOGIN_HANDLES.PHONE_INPUT), "8 916 123-45-67");
    await user.click(screen.getByTestId(PHONE_LOGIN_HANDLES.REQUEST_CODE));

    await waitFor(() =>
      expect(mocks.requestLoginCode).toHaveBeenCalledWith({ phone: "8 916 123-45-67" }),
    );

    expect(
      await screen.findByText(/Enter the 6-digit code sent to 8 916 123-45-67/),
    ).toBeInTheDocument();
    expect(screen.getByTestId(PHONE_LOGIN_HANDLES.RESEND_CODE)).toBeDisabled();
    expect(screen.getByTestId(PHONE_LOGIN_HANDLES.RESEND_CODE)).toHaveTextContent(
      /Resend in \d+ s/,
    );

    await user.type(screen.getByTestId(PHONE_LOGIN_HANDLES.CODE_INPUT), "123456");
    await user.click(screen.getByTestId(PHONE_LOGIN_HANDLES.SUBMIT));

    await waitFor(() =>
      expect(mocks.verifyLoginCode).toHaveBeenCalledWith({
        phone: "8 916 123-45-67",
        code: "123456",
        rememberMe: false,
      }),
    );
    await waitFor(() => expect(mocks.handleAuthSuccess).toHaveBeenCalled());
  });

  it("does not submit an incomplete code", async () => {
    renderWith({ withQuery: true }).render(<PhoneLoginForm />);

    const user = userEvent.setup();

    await user.type(screen.getByTestId(PHONE_LOGIN_HANDLES.PHONE_INPUT), "+79161234567");
    await user.click(screen.getByTestId(PHONE_LOGIN_HANDLES.REQUEST_CODE));

    await screen.findByTestId(PHONE_LOGIN_HANDLES.CODE_INPUT);

    await user.type(screen.getByTestId(PHONE_LOGIN_HANDLES.CODE_INPUT), "123");
    await user.click(screen.getByTestId(PHONE_LOGIN_HANDLES.SUBMIT));

    expect(await screen.findByText("Enter the 6-digit code")).toBeInTheDocument();
    expect(mocks.verifyLoginCode).not.toHaveBeenCalled();
  });

  it("lets the user go back and change the number", async () => {
    renderWith({ withQuery: true }).render(<PhoneLoginForm />);

    const user = userEvent.setup();

    await user.type(screen.getByTestId(PHONE_LOGIN_HANDLES.PHONE_INPUT), "+79161234567");
    await user.click(screen.getByTestId(PHONE_LOGIN_HANDLES.REQUEST_CODE));
    await user.click(await screen.findByTestId(PHONE_LOGIN_HANDLES.CHANGE_PHONE));

    expect(screen.getByTestId(PHONE_LOGIN_HANDLES.PHONE_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(PHONE_LOGIN_HANDLES.REQUEST_CODE)).toBeEnabled();
  });
});
