export interface EmailContent {
  text: Promise<string>;
  html: Promise<string>;
}
