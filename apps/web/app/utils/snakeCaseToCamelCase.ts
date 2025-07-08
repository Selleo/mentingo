export const snakeCaseToCamelCase = (text: string) => {
  function capitalize(word: string) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
  const words = text.split("_").filter(Boolean);
  if (words.length === 0) return "";
  return words[0] + words.slice(1).map(capitalize).join("");
};
