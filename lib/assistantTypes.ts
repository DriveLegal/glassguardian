// lib/assistantTypes.ts

export type AssistantAction = {
  type: string;
  label?: string;
  payload?: any;
};

export type Suggestion = {
  id: string;
  text: string;
  score?: number;
  actions?: AssistantAction[];
};

export type AssistantResponse = {
  suggestions: Suggestion[];
  raw?: any;
};