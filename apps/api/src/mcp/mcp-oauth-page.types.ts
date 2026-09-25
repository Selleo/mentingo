export type McpOAuthPageBrand = {
  logoUrl?: string | null;
  backgroundUrl?: string | null;
  primaryColor?: string | null;
  contrastColor?: string | null;
};

export type McpOAuthPage = {
  title: string;
  description: string;
  detail?: string;
  actions: string;
  brand?: McpOAuthPageBrand;
};
