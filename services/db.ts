import { Submission, AnswerOption, Appeal } from '../types';
import { DEFAULT_ADMIN_ANSWERS } from '../constants';

export interface DBState {
  submissions: Submission[];
  adminAnswers: Record<number, AnswerOption>;
  appeals: Appeal[];
  appealDeadline: string;
  formTitle: string;
}

// Using npoint.io as a simple, free JSON store.
// This new endpoint was created to resolve the recurring "Failed to fetch" errors.
const DB_URL = 'https://api.npoint.io/e9914b43486a47a06f23';

export const defaultState: DBState = {
  submissions: [],
  adminAnswers: DEFAULT_ADMIN_ANSWERS,
  appeals: [],
  appealDeadline: '',
  // Aligning title with metadata for consistency
  formTitle: 'SIMULADO 01 - ALE RO - ASSISTENTE LEGISLATIVO (RANKING)',
};

export const getData = async (): Promise<DBState> => {
  try {
    // Adding a no-cache header to ensure we always get the latest data.
    const response = await fetch(DB_URL, { cache: 'no-cache' });
    if (!response.ok) {
      console.error("Failed to fetch from remote DB, using default state.", response.statusText);
      return { ...defaultState };
    }
    const storedData = await response.json();
    
    if (!storedData || typeof storedData !== 'object' || !storedData.submissions) {
        console.warn("Remote data is malformed, using default state.");
        return { ...defaultState };
    }

    // Merge with default state to handle new properties if the schema evolves.
    return { ...defaultState, ...storedData };
  } catch (error) {
    console.error("Failed to read from remote DB, using default state.", error);
    return { ...defaultState };
  }
};

export const setData = async (data: DBState): Promise<void> => {
  try {
    const response = await fetch(DB_URL, {
      method: 'POST', // npoint.io uses POST to update
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to write to remote DB.", error);
    throw error;
  }
};