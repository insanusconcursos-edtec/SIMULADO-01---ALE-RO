import { Submission, AnswerOption, Appeal } from '../types';
import { DEFAULT_ADMIN_ANSWERS } from '../constants';

export interface DBState {
  submissions: Submission[];
  adminAnswers: Record<number, AnswerOption>;
  appeals: Appeal[];
  appealDeadline: string;
  formTitle: string;
}

// A public, free JSON store. For a production app, use a proper backend database.
const DB_URL = 'https://api.npoint.io/0e4741398c49e7b39a38';

export const defaultState: DBState = {
  submissions: [],
  adminAnswers: DEFAULT_ADMIN_ANSWERS,
  appeals: [],
  appealDeadline: '',
  formTitle: 'Formulário de Avaliação',
};

export const getData = async (): Promise<DBState> => {
  try {
    // Use cache-busting to ensure the latest data is fetched.
    const response = await fetch(`${DB_URL}?t=${new Date().getTime()}`);
    if (!response.ok) {
      console.error("Failed to fetch from remote DB, using default state.", response.statusText);
      return defaultState;
    }
    const storedData = await response.json();
    
    if (Object.keys(storedData).length === 0) {
      return defaultState;
    }

    // Merge with default state to handle new properties if the schema evolves.
    return { ...defaultState, ...storedData };
  } catch (error) {
    console.error("Failed to read from remote DB, using default state.", error);
    return defaultState;
  }
};

export const setData = async (data: DBState): Promise<void> => {
  try {
    const response = await fetch(DB_URL, {
      method: 'POST',
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
    // In a real app, you might want to throw the error
    // to let the caller handle it (e.g., show an error message).
    throw error;
  }
};
