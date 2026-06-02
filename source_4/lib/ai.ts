import { Mistral } from "@mistralai/mistralai";

export type MistralOcr = "mistral-ocr-2512";
export type MistralGp =
  | "mistral-large-2512"
  | "ministral-14b-2512";

export type MistralModel =
  | MistralGp
  | MistralOcr;


export type GenerateOptions = {
  model: MistralModel;
};

export const GenerateOptions = {
  default(): GenerateOptions {
    return {
      model: "mistral-large-2512",
    };
  },
};

export const client = (api_key: string) => new Mistral({
  apiKey: api_key,
});
