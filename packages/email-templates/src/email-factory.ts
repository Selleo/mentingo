import { render } from "@react-email/render";
import { EmailContent } from "./email-content";

export function emailTemplateFactory<T extends unknown[]>(
  template: (...args: T) => Parameters<typeof render>[0],
): new (...args: T) => EmailContent {
  return class implements EmailContent {
    private readonly args: T;

    constructor(...args: T) {
      this.args = args;
    }

    get props(): T {
      return this.args;
    }

    get text(): Promise<string> {
      return render(template(...this.props), { plainText: true });
    }

    get html(): Promise<string> {
      return render(template(...this.props));
    }
  };
}
