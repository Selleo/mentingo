import type { CSSProperties } from "react";

export const getBaseEmailStyles = (primaryColor: string) => ({
  body: {
    margin: 0,
    backgroundColor: "#fafafa",
    WebkitTextSizeAdjust: "100%",
  } as CSSProperties,

  headerSection: {
    backgroundColor: primaryColor,
    width: "100%",
    paddingTop: "50px",
  } as CSSProperties,

  headerContainer: {
    backgroundColor: "#ffffff",
    margin: "0 auto",
    height: "100%",
    borderRadius: "1.5rem 1.5rem 0 0",
    width: "90%",
    maxWidth: "600px",
  } as CSSProperties,

  logoSection: {
    marginBottom: "4rem",
    maxWidth: "80%",
  } as CSSProperties,

  simpleLogoSection: {
    textAlign: "right" as const,
    marginBottom: "2rem",
  } as CSSProperties,

  simpleLogoImage: {
    display: "block",
    marginLeft: "auto",
    marginRight: "2.5rem",
  } as CSSProperties,

  contentSection: {
    margin: "0 auto",
    maxWidth: "80%",
  } as CSSProperties,

  heading: {
    fontSize: "1.5rem",
    fontWeight: "400",
    margin: "0 0 2rem 0",
    lineHeight: "160%",
    fontFamily: '"all-round-gothic", "Arial Rounded MT Bold", sans-serif',
  } as CSSProperties,

  paragraph: {
    fontSize: "0.8rem",
    margin: "0 0 1rem 0",
    lineHeight: "150%",
  } as CSSProperties,

  buttonSection: {
    width: "100%",
  } as CSSProperties,

  buttonContainer: {
    backgroundColor: "#ffffff",
    margin: "0 auto",
    borderRadius: "0 0 1.5rem 1.5rem",
    width: "90%",
    maxWidth: "600px",
  } as CSSProperties,

  buttonWrapper: {
    textAlign: "center",
    margin: "4rem auto 3rem auto",
    maxWidth: "80%",
  } as CSSProperties,

  button: {
    backgroundColor: primaryColor,
    borderRadius: "3.5rem",
    fontWeight: "400",
    textAlign: "center",
    display: "inline-block",
    padding: "0.75rem 5rem",
    letterSpacing: "0.2rem",
    margin: "0 auto",
  } as CSSProperties,

  buttonText: {
    fontSize: "1rem",
    color: "#ffffff",
    textDecoration: "none",
    fontFamily: '"all-round-gothic", "Arial Rounded MT Bold", sans-serif',
    margin: 0,
  } as CSSProperties,

  footerSection: {
    color: "white",
    textAlign: "center",
  } as CSSProperties,

  footerText: {
    fontSize: "0.75rem",
    color: "#949494",
    marginBottom: "3.5rem",
    marginTop: "3.5rem",
  } as CSSProperties,
});
