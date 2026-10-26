export interface EmbeddingProvider {
  readonly name: string;
  embed(texts: string[]): Promise<number[][]>;
}

export interface EmbeddingConfig {
  provider: "openai" | "ollama" | "none";
  model: string;
  dimensions: number;
}
