import { Submission, AnswerOption, Appeal } from '../types';
import { DEFAULT_ADMIN_ANSWERS } from '../constants';

export interface DBState {
  submissions: Submission[];
  adminAnswers: Record<number, AnswerOption>;
  appeals: Appeal[];
  appealDeadline: string;
  formTitle: string;
}

const DB_KEY = 'gabarito-app-db';

// This is the initial state for a fresh deployment.
const defaultState: DBState = {
  submissions: [],
  adminAnswers: DEFAULT_ADMIN_ANSWERS,
  appeals: [],
  appealDeadline: '',
  formTitle: 'Formulário de Avaliação',
};

// Simulate async API calls. In a real application, these would be fetch requests.
export const getData = async (): Promise<DBState> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        const item = window.localStorage.getItem(DB_KEY);
        if (item) {
          // Merge with default state to handle schema changes over time
          const storedData = JSON.parse(item);
          resolve({ ...defaultState, ...storedData });
        } else {
          resolve(defaultState);
        }
      } catch (error) {
        console.error("Failed to read from storage, using default state.", error);
        resolve(defaultState);
      }
    }, 250); // Simulate network latency
  });
};

export const setData = async (data: DBState): Promise<void> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        window.localStorage.setItem(DB_KEY, JSON.stringify(data));
        resolve();
      } catch (error) {
        console.error("Failed to write to storage.", error);
        reject(error);
      }
    }, 100); // Shorter latency for writes
  });
};
